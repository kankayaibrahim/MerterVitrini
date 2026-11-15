package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/httpclient"
)

type CustomersHandler struct {
	Cfg *config.Config
}

func NewCustomersHandler(cfg *config.Config) *CustomersHandler {
	return &CustomersHandler{Cfg: cfg}
}

type LoginHistoryRecord struct {
	LoginAt   string `json:"login_at"`
	IPAddress string `json:"ip_address"`
}

type CustomerResponse struct {
	ID                string               `json:"id"`
	FirstName         string               `json:"first_name"`
	LastName          string               `json:"last_name"`
	Email             string               `json:"email"`
	Phone             string               `json:"phone"`
	Role              string               `json:"role"`
	EmailVerified     bool                 `json:"email_verified"`
	IsVerified        bool                 `json:"is_verified"`
	IsActive          bool                 `json:"is_active"`
	IsBlocked         bool                 `json:"is_blocked"`
	BlockReason       *string              `json:"block_reason"`
	CreatedAt         string               `json:"created_at"`
	UpdatedAt         string               `json:"updated_at"`
	RegistrationIP    *string              `json:"registration_ip"`
	BillingAddress    *string              `json:"billing_address"`
	DeliveryAddress   *string              `json:"delivery_address"`
	TaxNoTCKN         *string              `json:"tax_no_tckn"`
	InstagramUsername *string              `json:"instagram_username"`
	PreferredLang     *string              `json:"preferred_lang"`
	PreferredCurrency *string              `json:"preferred_currency"`
	CountryCode       *string              `json:"country_code"`
	CountryName       *string              `json:"country_name"`
	City              *string              `json:"city"`
	RegionName        *string              `json:"region_name"`
	Latitude          *float64             `json:"latitude"`
	Longitude         *float64             `json:"longitude"`
	GeoSource         *string              `json:"geo_source"`
	LastLoginAt       *string              `json:"last_login_at"`
	LastActiveAt      *string              `json:"last_active_at"`
	IsOnline          bool                 `json:"is_online"`
	OrdersCount       int                  `json:"orders_count"`
	OrdersTotalAmount float64              `json:"orders_total_amount"`
	CartItemsCount    int                  `json:"cart_items_count"`
	PagesRead         int                  `json:"pages_read"`
	ProductsViewed    int                  `json:"products_viewed"`
	LastEventTitle    string               `json:"last_event_title"`
	LastEventCategory string               `json:"last_event_category"`
	LoginHistory      []LoginHistoryRecord `json:"login_history"`
}

type ToggleBlockRequest struct {
	IsBlocked   bool   `json:"is_blocked"`
	BlockReason string `json:"block_reason"`
}

func resolveCustomerOrderBySQL(sortParam string) string {
	switch strings.ToLower(strings.TrimSpace(sortParam)) {
	case "oldest":
		return "ORDER BY created_at ASC"
	case "last_active":
		return "ORDER BY last_active_at DESC NULLS LAST, created_at DESC"
	case "most_orders":
		return "ORDER BY orders_count DESC, orders_total_amount DESC, created_at DESC"
	case "highest_spend":
		return "ORDER BY orders_total_amount DESC, orders_count DESC, created_at DESC"
	case "most_engaged":
		return "ORDER BY (pages_read + products_viewed * 2 + cart_items_count * 3 + orders_count * 5) DESC, last_active_at DESC"
	default:
		return "ORDER BY created_at DESC"
	}
}

func buildCustomerListFilters(q url.Values) (whereSQL string, args []any, orderBySQL string) {
	var clauses []string
	search := strings.TrimSpace(q.Get("search"))
	country := strings.TrimSpace(q.Get("country"))
	period := strings.TrimSpace(q.Get("period"))
	status := strings.ToLower(strings.TrimSpace(q.Get("status")))

	if search != "" {
		args = append(args, "%"+search+"%")
		p := fmt.Sprintf("$%d", len(args))
		clauses = append(clauses, fmt.Sprintf(
			"(first_name ILIKE %s OR last_name ILIKE %s OR email ILIKE %s OR phone ILIKE %s OR COALESCE(country_name, '') ILIKE %s OR COALESCE(city, '') ILIKE %s OR COALESCE(country_code, '') ILIKE %s OR COALESCE(instagram_username, '') ILIKE %s OR COALESCE(registration_ip, '') ILIKE %s)",
			p, p, p, p, p, p, p, p, p,
		))
	}

	if country != "" && !strings.EqualFold(country, "ALL") {
		switch strings.ToUpper(country) {
		case "FOREIGN":
			clauses = append(clauses, "COALESCE(country_code, '') <> '' AND UPPER(country_code) <> 'TR'")
		case "UNKNOWN":
			clauses = append(clauses, "COALESCE(country_code, '') = ''")
		default:
			if iso := NormalizeISO2(country); iso != "" {
				args = append(args, iso)
				clauses = append(clauses, fmt.Sprintf("UPPER(COALESCE(country_code, '')) = $%d", len(args)))
			}
		}
	}

	if periodCond := customerPeriodSQLCondition(period, "created_at"); periodCond != "" {
		clauses = append(clauses, "("+periodCond+")")
	}

	switch status {
	case "active":
		clauses = append(clauses, "is_active = true AND is_blocked = false")
	case "blocked":
		clauses = append(clauses, "is_blocked = true")
	case "verified":
		clauses = append(clauses, "email_verified = true")
	case "unverified":
		clauses = append(clauses, "email_verified = false")
	case "online":
		clauses = append(clauses, "last_active_at >= NOW() - INTERVAL '10 minutes'")
	case "with_orders":
		clauses = append(clauses, "orders_count > 0")
	case "with_cart":
		clauses = append(clauses, "cart_items_count > 0")
	}

	if len(clauses) > 0 {
		whereSQL = "WHERE " + strings.Join(clauses, " AND ")
	}
	orderBySQL = resolveCustomerOrderBySQL(q.Get("sort"))
	return whereSQL, args, orderBySQL
}

func (h *CustomersHandler) ListCustomers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ensureCustomerGeoColumns(r.Context())

	whereSQL, args, orderBySQL := buildCustomerListFilters(r.URL.Query())

	query := `
		WITH customer_rows AS (
			SELECT
				u.id,
				u.first_name,
				u.last_name,
				u.email,
				COALESCE(u.phone, '') AS phone,
				u.user_role,
				COALESCE(u.email_verified, false) AS email_verified,
				COALESCE(u.is_active, true) AS is_active,
				COALESCE(u.is_blocked, false) AS is_blocked,
				u.block_reason,
				u.created_at,
				u.updated_at,
				u.registration_ip,
				u.billing_address,
				u.delivery_address,
				u.tax_no_tckn,
				u.instagram_username,
				u.preferred_lang,
				u.preferred_currency,
				NULLIF(TRIM(u.country_code), '') AS country_code,
				NULLIF(TRIM(u.country_name), '') AS country_name,
				NULLIF(TRIM(u.city), '') AS city,
				NULLIF(TRIM(u.region_name), '') AS region_name,
				u.latitude,
				u.longitude,
				NULLIF(TRIM(u.geo_source), '') AS geo_source,
				(SELECT MAX(lh.login_at) FROM identity.user_login_history lh WHERE lh.user_id = u.id) AS last_login_at,
				GREATEST(
					u.created_at,
					COALESCE((SELECT MAX(lh2.login_at) FROM identity.user_login_history lh2 WHERE lh2.user_id = u.id), u.created_at),
					COALESCE(me_agg.last_me_at, u.created_at),
					COALESCE(pv_agg.last_pv_at, u.created_at)
				) AS last_active_at,
				(
					COALESCE((SELECT COUNT(*) FROM catalog.orders o WHERE o.user_id = u.id), 0) +
					COALESCE((SELECT COUNT(*) FROM catalog.store_inquiries si WHERE LOWER(si.email) = LOWER(u.email)), 0)
				)::int AS orders_count,
				(
					COALESCE((SELECT SUM(CASE WHEN COALESCE(o.total_amount_try, 0) > 0 THEN o.total_amount_try ELSE o.total_amount END) FROM catalog.orders o WHERE o.user_id = u.id), 0) +
					COALESCE((SELECT SUM(ii.quantity * ii.price) FROM catalog.store_inquiry_items ii INNER JOIN catalog.store_inquiries si ON ii.inquiry_id = si.id WHERE LOWER(si.email) = LOWER(u.email)), 0)
				)::double precision AS orders_total_amount,
				COALESCE((SELECT SUM(ci.quantity)::int FROM catalog.cart_items ci INNER JOIN catalog.carts ca ON ci.cart_id = ca.id WHERE ca.user_id = u.id), 0) AS cart_items_count,
				GREATEST(COALESCE(me_agg.pages_read, 0), COALESCE(pv_agg.pv_count, 0))::int AS pages_read,
				COALESCE(me_agg.products_viewed, 0)::int AS products_viewed,
				COALESCE(me_last.title, '') AS last_event_title,
				COALESCE(me_last.event_category, 'auth') AS last_event_category,
				COALESCE(
					(
						SELECT json_agg(json_build_object('login_at', login_at, 'ip_address', ip_address) ORDER BY login_at DESC)
						FROM identity.user_login_history
						WHERE user_id = u.id
					),
					'[]'::json
				) AS login_history_json
			FROM identity.users u
			LEFT JOIN LATERAL (
				SELECT
					COUNT(*) FILTER (WHERE ` + memberPageVisitSQLFilter + `)::int AS pages_read,
					COUNT(DISTINCT me.entity_id) FILTER (WHERE me.event_type = 'product_view' AND me.entity_id IS NOT NULL AND me.entity_id <> '')::int AS products_viewed,
					MAX(me.created_at) AS last_me_at
				FROM analytics.member_events me
				WHERE me.user_id = u.id
				   OR me.visitor_id IN (SELECT uvl.visitor_id FROM analytics.user_visitor_links uvl WHERE uvl.user_id = u.id)
			) me_agg ON true
			LEFT JOIN LATERAL (
				SELECT
					COUNT(*)::int AS pv_count,
					MAX(pv.created_at) AS last_pv_at
				FROM analytics.page_views pv
				WHERE COALESCE(pv.is_bot, false) = false
				  AND (
					pv.user_id = u.id
					OR pv.visitor_id IN (SELECT uvl2.visitor_id FROM analytics.user_visitor_links uvl2 WHERE uvl2.user_id = u.id)
				  )
			) pv_agg ON true
			LEFT JOIN LATERAL (
				SELECT me2.title, me2.event_category
				FROM analytics.member_events me2
				WHERE me2.user_id = u.id
				   OR me2.visitor_id IN (SELECT uvl3.visitor_id FROM analytics.user_visitor_links uvl3 WHERE uvl3.user_id = u.id)
				ORDER BY me2.created_at DESC
				LIMIT 1
			) me_last ON true
			WHERE u.user_role = 'customer'
		)
		SELECT
			id, first_name, last_name, email, phone, user_role,
			email_verified, is_active, is_blocked, block_reason, created_at, updated_at,
			registration_ip, billing_address, delivery_address, tax_no_tckn, instagram_username, preferred_lang, preferred_currency,
			country_code, country_name, city, region_name, latitude, longitude, geo_source,
			last_login_at, last_active_at, orders_count, orders_total_amount, cart_items_count,
			pages_read, products_viewed, last_event_title, last_event_category, login_history_json
		FROM customer_rows
		` + whereSQL + `
		` + orderBySQL + `
	`

	rows, err := db.Pool.Query(r.Context(), query, args...)
	if err != nil {
		log.Printf("[ADMIN CUSTOMERS ERROR] Failed to list customers: %v", err)
		http.Error(w, `{"error":"Müşteri listesi alınırken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	customers := []CustomerResponse{}
	now := time.Now()
	for rows.Next() {
		var c CustomerResponse
		var createdAt, updatedAt, lastActiveAt time.Time
		var lastLoginAtTime *time.Time
		var loginHistoryBytes []byte
		if err := rows.Scan(
			&c.ID, &c.FirstName, &c.LastName, &c.Email, &c.Phone, &c.Role,
			&c.EmailVerified, &c.IsActive, &c.IsBlocked, &c.BlockReason, &createdAt, &updatedAt,
			&c.RegistrationIP, &c.BillingAddress, &c.DeliveryAddress, &c.TaxNoTCKN, &c.InstagramUsername, &c.PreferredLang, &c.PreferredCurrency,
			&c.CountryCode, &c.CountryName, &c.City, &c.RegionName, &c.Latitude, &c.Longitude, &c.GeoSource,
			&lastLoginAtTime, &lastActiveAt, &c.OrdersCount, &c.OrdersTotalAmount, &c.CartItemsCount,
			&c.PagesRead, &c.ProductsViewed, &c.LastEventTitle, &c.LastEventCategory, &loginHistoryBytes,
		); err != nil {
			log.Printf("[ADMIN CUSTOMERS ERROR] Failed to scan customer: %v", err)
			continue
		}
		c.IsActive = c.IsActive && !c.IsBlocked
		c.IsVerified = c.EmailVerified
		if c.CountryCode != nil {
			rawName := ""
			if c.CountryName != nil {
				rawName = *c.CountryName
			}
			if canonical := CanonicalCountryNameTr(*c.CountryCode, rawName); canonical != "" {
				c.CountryName = &canonical
			}
		}

		c.CreatedAt = createdAt.Format(time.RFC3339)
		c.UpdatedAt = updatedAt.Format(time.RFC3339)
		lastActiveFormatted := lastActiveAt.Format(time.RFC3339)
		c.LastActiveAt = &lastActiveFormatted
		c.IsOnline = now.Sub(lastActiveAt) <= 10*time.Minute

		if lastLoginAtTime != nil {
			formatted := lastLoginAtTime.Format(time.RFC3339)
			c.LastLoginAt = &formatted
		}

		c.LoginHistory = []LoginHistoryRecord{}
		if len(loginHistoryBytes) > 0 {
			_ = json.Unmarshal(loginHistoryBytes, &c.LoginHistory)
		}

		customers = append(customers, c)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(customers)
}

func (h *CustomersHandler) ToggleBlockCustomer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	customerID := r.PathValue("id")
	if customerID == "" {
		http.Error(w, `{"error":"Müşteri ID bulunamadı"}`, http.StatusBadRequest)
		return
	}

	var req ToggleBlockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek gövdesi"}`, http.StatusBadRequest)
		return
	}

	var blockReasonPtr *string
	if req.IsBlocked && req.BlockReason != "" {
		reason := req.BlockReason
		blockReasonPtr = &reason
	}

	_, err := db.Pool.Exec(r.Context(), `
		UPDATE identity.users
		SET is_blocked = $1, block_reason = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3 AND user_role = 'customer'
	`, req.IsBlocked, blockReasonPtr, customerID)

	if err != nil {
		log.Printf("[ADMIN CUSTOMERS ERROR] Failed to toggle customer block status: %v", err)
		http.Error(w, `{"error":"Müşteri durumu güncellenirken hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true,"message":"Müşteri durumu başarıyla güncellendi"}`))
}

func (h *CustomersHandler) getAdminAccessToken(ctx context.Context) (string, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)
	
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", h.Cfg.KeycloakClientID)
	form.Set("client_secret", h.Cfg.KeycloakClientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set(headerContentType, mimeFormURLEncoded)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to get admin token: status %d, body: %s", resp.StatusCode, body)
	}

	var tokenResp map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	accessToken, _ := tokenResp["access_token"].(string)
	if accessToken == "" {
		return "", fmt.Errorf("access_token not found in response")
	}

	return accessToken, nil
}

func (h *CustomersHandler) DeleteCustomer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	customerID := r.PathValue("id")
	if customerID == "" {
		http.Error(w, `{"error":"Müşteri ID bulunamadı"}`, http.StatusBadRequest)
		return
	}

	// 1. Get Keycloak Admin Access Token
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	accessToken, err := h.getAdminAccessToken(ctx)
	if err != nil {
		log.Printf("[ADMIN CUSTOMERS ERROR] Failed to get admin access token: %v", err)
		http.Error(w, `{"error":"Keycloak yetkilendirme hatası"}`, http.StatusInternalServerError)
		return
	}

	// 2. Delete User from Keycloak
	deleteURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm, customerID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, deleteURL, nil)
	if err != nil {
		log.Printf("[ADMIN CUSTOMERS ERROR] Failed to construct Keycloak delete request: %v", err)
		http.Error(w, `{"error":"İstek oluşturulurken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		log.Printf("[ADMIN CUSTOMERS ERROR] Failed to execute Keycloak delete request: %v", err)
		http.Error(w, `{"error":"Keycloak sunucusuna erişilemedi"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[ADMIN CUSTOMERS ERROR] Keycloak delete user returned status %d: %s", resp.StatusCode, body)
		http.Error(w, fmt.Sprintf(`{"error":"Keycloak üzerinde kullanıcı silinemedi: %s"}`, body), resp.StatusCode)
		return
	}

	// 3. Delete user from local database
	res, err := db.Pool.Exec(ctx, `
		DELETE FROM identity.users
		WHERE id = $1 AND user_role = 'customer'
	`, customerID)
	if err != nil {
		log.Printf("[ADMIN CUSTOMERS ERROR] Failed to delete customer from database: %v", err)
		http.Error(w, `{"error":"Müşteri veri tabanından silinirken hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	if res.RowsAffected() == 0 {
		log.Printf("[ADMIN CUSTOMERS WARNING] Customer ID %s deleted from Keycloak (or not found) but local DB delete affected 0 rows", customerID)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true,"message":"Müşteri başarıyla silindi"}`))
}

