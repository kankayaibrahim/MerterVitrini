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
	LastLoginAt       *string              `json:"last_login_at"`
	LoginHistory      []LoginHistoryRecord `json:"login_history"`
}

type ToggleBlockRequest struct {
	IsBlocked   bool   `json:"is_blocked"`
	BlockReason string `json:"block_reason"`
}

func (h *CustomersHandler) ListCustomers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	search := strings.TrimSpace(r.URL.Query().Get("search"))

	query := `
		SELECT u.id, u.first_name, u.last_name, u.email, COALESCE(u.phone, ''), u.user_role, u.is_active, u.is_blocked, u.block_reason, u.created_at, u.updated_at,
		       u.registration_ip, u.billing_address, u.delivery_address, u.tax_no_tckn, u.instagram_username, u.preferred_lang, u.preferred_currency,
		       (SELECT login_at FROM identity.user_login_history WHERE user_id = u.id ORDER BY login_at DESC LIMIT 1) as last_login_at,
		       COALESCE(
		           (SELECT json_agg(json_build_object('login_at', login_at, 'ip_address', ip_address) ORDER BY login_at DESC)
		            FROM identity.user_login_history
		            WHERE user_id = u.id), '[]'::json
		       ) as login_history_json
		FROM identity.users u
		WHERE u.user_role = 'customer'
	`
	var args []any
	if search != "" {
		query += " AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1)"
		args = append(args, "%"+search+"%")
	}
	query += " ORDER BY u.created_at DESC"

	rows, err := db.Pool.Query(r.Context(), query, args...)
	if err != nil {
		log.Printf("[ADMIN CUSTOMERS ERROR] Failed to list customers: %v", err)
		http.Error(w, `{"error":"Müşteri listesi alınırken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	customers := []CustomerResponse{}
	for rows.Next() {
		var c CustomerResponse
		var createdAt, updatedAt time.Time
		var lastLoginAtTime *time.Time
		var loginHistoryBytes []byte
		if err := rows.Scan(
			&c.ID, &c.FirstName, &c.LastName, &c.Email, &c.Phone, &c.Role, &c.IsActive, &c.IsBlocked, &c.BlockReason, &createdAt, &updatedAt,
			&c.RegistrationIP, &c.BillingAddress, &c.DeliveryAddress, &c.TaxNoTCKN, &c.InstagramUsername, &c.PreferredLang, &c.PreferredCurrency,
			&lastLoginAtTime, &loginHistoryBytes,
		); err != nil {
			log.Printf("[ADMIN CUSTOMERS ERROR] Failed to scan customer: %v", err)
			continue
		}
		
		c.CreatedAt = createdAt.Format(time.RFC3339)
		c.UpdatedAt = updatedAt.Format(time.RFC3339)
		
		if lastLoginAtTime != nil {
			formatted := lastLoginAtTime.Format(time.RFC3339)
			c.LastLoginAt = &formatted
		}
		
		if len(loginHistoryBytes) > 0 {
			json.Unmarshal(loginHistoryBytes, &c.LoginHistory)
		}

		customers = append(customers, c)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(customers)
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

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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

