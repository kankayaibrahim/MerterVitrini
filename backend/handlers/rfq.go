package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
)

func writeMarketplaceJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// BuyerRfqOfferDTO represents a manufacturer's offer on a buying lead.
type BuyerRfqOfferDTO struct {
	ID               string    `json:"id"`
	RfqID            string    `json:"rfq_id"`
	BrandID          string    `json:"brand_id"`
	BrandName        string    `json:"brand_name"`
	OfferedUnitPrice float64   `json:"offered_unit_price"`
	Currency         string    `json:"currency"`
	MinOrderQuantity int       `json:"min_order_quantity"`
	DeliveryDays     int       `json:"delivery_days"`
	Notes            string    `json:"notes"`
	SupplierPhone    string    `json:"supplier_phone"`
	SupplierWhatsapp string    `json:"supplier_whatsapp"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
}

// BuyerRfqDTO represents a B2B Buying Lead (RFQ) item.
type BuyerRfqDTO struct {
	ID             string             `json:"id"`
	RfqNumber      string             `json:"rfq_number"`
	Title          string             `json:"title"`
	CategoryName   string             `json:"category_name"`
	TargetQuantity int                `json:"target_quantity"`
	UnitType       string             `json:"unit_type"`
	TargetPrice    *float64           `json:"target_price,omitempty"`
	Currency       string             `json:"currency"`
	ProductionType string             `json:"production_type"`
	Description    string             `json:"description"`
	BuyerName      string             `json:"buyer_name"`
	BuyerCompany   string             `json:"buyer_company"`
	BuyerCountry   string             `json:"buyer_country"`
	BuyerPhone     string             `json:"buyer_phone,omitempty"`
	BuyerWhatsapp  string             `json:"buyer_whatsapp,omitempty"`
	BuyerEmail         string             `json:"buyer_email,omitempty"`
	BuyerEmailVerified bool               `json:"buyer_email_verified"`
	Status             string             `json:"status"`
	OfferCount     int                `json:"offer_count"`
	MyOffer        *BuyerRfqOfferDTO  `json:"my_offer,omitempty"`
	Offers         []BuyerRfqOfferDTO `json:"offers,omitempty"`
	CreatedAt      time.Time          `json:"created_at"`
}

// CreateBuyerRfqRequest is the payload for POST /api/v1/store/rfqs.
type CreateBuyerRfqRequest struct {
	Title          string   `json:"title"`
	CategoryName   string   `json:"category_name"`
	TargetQuantity int      `json:"target_quantity"`
	UnitType       string   `json:"unit_type"`
	TargetPrice    *float64 `json:"target_price,omitempty"`
	Currency       string   `json:"currency"`
	ProductionType string   `json:"production_type"`
	Description    string   `json:"description"`
	BuyerName      string   `json:"buyer_name"`
	BuyerCompany   string   `json:"buyer_company"`
	BuyerCountry   string   `json:"buyer_country"`
	BuyerPhone     string   `json:"buyer_phone"`
	BuyerWhatsapp  string   `json:"buyer_whatsapp"`
	BuyerEmail     string   `json:"buyer_email"`
}

// SubmitSupplierRfqOfferRequest is the payload for POST /api/v1/supplier/rfqs/{id}/offers.
type SubmitSupplierRfqOfferRequest struct {
	OfferedUnitPrice float64 `json:"offered_unit_price"`
	Currency         string  `json:"currency"`
	MinOrderQuantity int     `json:"min_order_quantity"`
	DeliveryDays     int     `json:"delivery_days"`
	Notes            string  `json:"notes"`
}

func maskBuyerNameForPublic(name string) string {
	trimmed := strings.TrimSpace(name)
	if len(trimmed) <= 2 {
		return trimmed + "***"
	}
	parts := strings.Fields(trimmed)
	if len(parts) == 0 {
		return "B2B Alıcı"
	}
	first := []rune(parts[0])
	if len(first) > 2 {
		return string(first[:2]) + "***"
	}
	return string(first) + "***"
}

func isStoreOrSupplierAuthenticated(r *http.Request) bool {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if _, err := verifyTokenAndGetUserID(authHeader); err == nil {
		return true
	}
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return false
	}
	tokenStr := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	if tokenStr == "" {
		return false
	}
	claims, err := decodeJWTClaims(tokenStr)
	if err != nil {
		return false
	}
	if exp, ok := claims["exp"].(float64); ok && int64(exp) <= time.Now().Unix() {
		return false
	}
	if sub, ok := claims["sub"].(string); ok && strings.TrimSpace(sub) != "" {
		return true
	}
	if uid, ok := claims["user_id"].(string); ok && strings.TrimSpace(uid) != "" {
		return true
	}
	if bid, ok := claims["brand_id"].(string); ok && strings.TrimSpace(bid) != "" {
		return true
	}
	return false
}

// ListPublicRfqs handles GET /api/v1/store/rfqs for the member-authenticated storefront RFQ board.
func (h *MarketplaceHandler) ListPublicRfqs(w http.ResponseWriter, r *http.Request) {
	if !isStoreOrSupplierAuthenticated(r) {
		writeMarketplaceJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "Alıcı talep panosunu görüntülemek için üye girişi yapmalısınız.",
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	prodType := strings.TrimSpace(r.URL.Query().Get("production_type"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	rows, err := db.Pool.Query(ctx, `
		SELECT
			r.id::text, r.rfq_number, r.title, r.category_name, r.target_quantity,
			r.unit_type, r.target_price, r.currency, r.production_type, r.description,
			r.buyer_name, r.buyer_company, r.buyer_country, r.status, r.created_at,
			(SELECT COUNT(*)::int FROM catalog.buyer_rfq_offers o WHERE o.rfq_id = r.id) AS offer_count,
			COALESCE(u.email_verified, false) AS buyer_email_verified
		FROM catalog.buyer_rfqs r
		LEFT JOIN identity.users u ON LOWER(u.email) = LOWER(r.buyer_email)
		WHERE r.status = 'APPROVED'
		  AND ($1 = '' OR r.production_type = $1)
		  AND ($2 = '' OR r.title ILIKE '%' || $2 || '%' OR r.category_name ILIKE '%' || $2 || '%' OR r.buyer_country ILIKE '%' || $2 || '%')
		ORDER BY r.created_at DESC
		LIMIT 100
	`, prodType, search)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusOK, []BuyerRfqDTO{})
		return
	}
	defer rows.Close()

	list := []BuyerRfqDTO{}
	for rows.Next() {
		var item BuyerRfqDTO
		if err := rows.Scan(
			&item.ID, &item.RfqNumber, &item.Title, &item.CategoryName, &item.TargetQuantity,
			&item.UnitType, &item.TargetPrice, &item.Currency, &item.ProductionType, &item.Description,
			&item.BuyerName, &item.BuyerCompany, &item.BuyerCountry, &item.Status, &item.CreatedAt,
			&item.OfferCount, &item.BuyerEmailVerified,
		); err == nil {
			item.BuyerName = maskBuyerNameForPublic(item.BuyerName)
			list = append(list, item)
		}
	}

	writeMarketplaceJSON(w, http.StatusOK, list)
}

// CreatePublicRfq handles POST /api/v1/store/rfqs so authenticated buyers can post a new buying lead.
func (h *MarketplaceHandler) CreatePublicRfq(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMarketplaceJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	if !isStoreOrSupplierAuthenticated(r) {
		writeMarketplaceJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "Alım ilanı (RFQ) açmak için üye girişi yapmalısınız.",
		})
		return
	}

	var req CreateBuyerRfqRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek verisi."})
		return
	}

	title := strings.TrimSpace(req.Title)
	buyerName := strings.TrimSpace(req.BuyerName)
	buyerPhone := strings.TrimSpace(req.BuyerPhone)
	if title == "" || buyerName == "" || buyerPhone == "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "İlan başlığı, ad soyad ve telefon numarası zorunludur."})
		return
	}

	qty := req.TargetQuantity
	if qty <= 0 {
		qty = 100
	}
	unitType := strings.ToUpper(strings.TrimSpace(req.UnitType))
	if unitType == "" {
		unitType = "ADET"
	}
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "USD"
	}
	prodType := strings.TrimSpace(req.ProductionType)
	if prodType == "" {
		prodType = "hazir_toptan"
	}
	country := strings.TrimSpace(req.BuyerCountry)
	if country == "" {
		country = "Türkiye"
	}
	whatsapp := strings.TrimSpace(req.BuyerWhatsapp)
	if whatsapp == "" {
		whatsapp = buyerPhone
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	var seqVal int64
	_ = db.Pool.QueryRow(ctx, `SELECT nextval('catalog.buyer_rfq_seq')`).Scan(&seqVal)
	rfqNumber := fmt.Sprintf("MV-RFQ-%d-%04d", time.Now().Year(), seqVal)

	var item BuyerRfqDTO
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.buyer_rfqs (
			rfq_number, title, category_name, target_quantity, unit_type,
			target_price, currency, production_type, description,
			buyer_name, buyer_company, buyer_country, buyer_phone, buyer_whatsapp, buyer_email, status
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'APPROVED')
		RETURNING id::text, rfq_number, title, category_name, target_quantity, unit_type,
		          target_price, currency, production_type, description, buyer_name, buyer_company,
		          buyer_country, status, created_at
	`,
		rfqNumber, title, strings.TrimSpace(req.CategoryName), qty, unitType,
		req.TargetPrice, currency, prodType, strings.TrimSpace(req.Description),
		buyerName, strings.TrimSpace(req.BuyerCompany), country, buyerPhone, whatsapp, strings.TrimSpace(req.BuyerEmail),
	).Scan(
		&item.ID, &item.RfqNumber, &item.Title, &item.CategoryName, &item.TargetQuantity, &item.UnitType,
		&item.TargetPrice, &item.Currency, &item.ProductionType, &item.Description, &item.BuyerName, &item.BuyerCompany,
		&item.BuyerCountry, &item.Status, &item.CreatedAt,
	)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": "Alım talebi kaydedilemedi."})
		return
	}

	RecordMemberActivityAsync(r, MemberActivityInput{
		EventType:     "rfq_create",
		EventCategory: "lead",
		Title:         "Toptan alım ilanı (RFQ) oluşturdu: " + title,
		Subtitle:      fmt.Sprintf("%s • %d %s (%s)", item.RfqNumber, item.TargetQuantity, item.UnitType, item.BuyerCountry),
		URLPath:       "/alim-ilanlari",
		EntityType:    "rfq",
		EntityID:      item.ID,
	})

	writeMarketplaceJSON(w, http.StatusCreated, item)
}

// ListSupplierRfqs handles GET /api/v1/supplier/rfqs for authenticated suppliers.
func (h *MarketplaceHandler) ListSupplierRfqs(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || claims.BrandID == "" {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT
			r.id::text, r.rfq_number, r.title, r.category_name, r.target_quantity,
			r.unit_type, r.target_price, r.currency, r.production_type, r.description,
			r.buyer_name, r.buyer_company, r.buyer_country, r.buyer_phone, r.buyer_whatsapp, r.buyer_email,
			r.status, r.created_at,
			(SELECT COUNT(*)::int FROM catalog.buyer_rfq_offers o WHERE o.rfq_id = r.id) AS offer_count,
			COALESCE(u.email_verified, false) AS buyer_email_verified
		FROM catalog.buyer_rfqs r
		LEFT JOIN identity.users u ON LOWER(u.email) = LOWER(r.buyer_email)
		WHERE r.status = 'APPROVED'
		ORDER BY r.created_at DESC
		LIMIT 100
	`)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusOK, []BuyerRfqDTO{})
		return
	}
	defer rows.Close()

	list := []BuyerRfqDTO{}
	for rows.Next() {
		var item BuyerRfqDTO
		if err := rows.Scan(
			&item.ID, &item.RfqNumber, &item.Title, &item.CategoryName, &item.TargetQuantity,
			&item.UnitType, &item.TargetPrice, &item.Currency, &item.ProductionType, &item.Description,
			&item.BuyerName, &item.BuyerCompany, &item.BuyerCountry, &item.BuyerPhone, &item.BuyerWhatsapp, &item.BuyerEmail,
			&item.Status, &item.CreatedAt, &item.OfferCount, &item.BuyerEmailVerified,
		); err == nil {
			item.MyOffer = fetchSupplierOwnRfqOffer(ctx, item.ID, claims.BrandID)
			list = append(list, item)
		}
	}

	writeMarketplaceJSON(w, http.StatusOK, list)
}

func fetchSupplierOwnRfqOffer(ctx context.Context, rfqID, brandID string) *BuyerRfqOfferDTO {
	var off BuyerRfqOfferDTO
	err := db.Pool.QueryRow(ctx, `
		SELECT
			o.id::text, o.rfq_id::text, o.brand_id::text, b.brand_name,
			o.offered_unit_price, o.currency, o.min_order_quantity, o.delivery_days,
			o.notes, o.supplier_phone, o.supplier_whatsapp, o.status, o.created_at
		FROM catalog.buyer_rfq_offers o
		JOIN catalog.brands b ON b.id = o.brand_id
		WHERE o.rfq_id = $1 AND o.brand_id = $2
		LIMIT 1
	`, rfqID, brandID).Scan(
		&off.ID, &off.RfqID, &off.BrandID, &off.BrandName,
		&off.OfferedUnitPrice, &off.Currency, &off.MinOrderQuantity, &off.DeliveryDays,
		&off.Notes, &off.SupplierPhone, &off.SupplierWhatsapp, &off.Status, &off.CreatedAt,
	)
	if err != nil {
		return nil
	}
	return &off
}

// SubmitSupplierRfqOffer handles POST /api/v1/supplier/rfqs/{id}/offers.
func (h *MarketplaceHandler) SubmitSupplierRfqOffer(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || claims.BrandID == "" {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	rfqID := strings.TrimSpace(r.PathValue("id"))
	if rfqID == "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "RFQ kimliği eksik."})
		return
	}

	var req SubmitSupplierRfqOfferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.OfferedUnitPrice <= 0 {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçerli bir birim fiyat giriniz."})
		return
	}

	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "USD"
	}
	moq := req.MinOrderQuantity
	if moq <= 0 {
		moq = 1
	}
	days := req.DeliveryDays
	if days <= 0 {
		days = 7
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	var brandName, supPhone, supWhatsapp string
	_ = db.Pool.QueryRow(ctx, `
		SELECT brand_name, COALESCE(phone, ''), COALESCE(whatsapp_phone, '')
		FROM catalog.brands WHERE id = $1
	`, claims.BrandID).Scan(&brandName, &supPhone, &supWhatsapp)

	var rfqTitle, rfqNumber, buyerName, buyerWa, buyerPhone string
	err := db.Pool.QueryRow(ctx, `
		SELECT title, rfq_number, buyer_name, COALESCE(buyer_whatsapp, ''), COALESCE(buyer_phone, '')
		FROM catalog.buyer_rfqs WHERE id = $1
	`, rfqID).Scan(&rfqTitle, &rfqNumber, &buyerName, &buyerWa, &buyerPhone)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusNotFound, map[string]string{"error": "Alım talebi bulunamadı."})
		return
	}

	var offerID string
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.buyer_rfq_offers (
			rfq_id, brand_id, offered_unit_price, currency, min_order_quantity,
			delivery_days, notes, supplier_phone, supplier_whatsapp, status
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SENT')
		ON CONFLICT (rfq_id, brand_id) DO UPDATE SET
			offered_unit_price = EXCLUDED.offered_unit_price,
			currency = EXCLUDED.currency,
			min_order_quantity = EXCLUDED.min_order_quantity,
			delivery_days = EXCLUDED.delivery_days,
			notes = EXCLUDED.notes,
			updated_at = NOW()
		RETURNING id::text
	`, rfqID, claims.BrandID, req.OfferedUnitPrice, currency, moq, days, strings.TrimSpace(req.Notes), supPhone, supWhatsapp).Scan(&offerID)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": "Teklif kaydedilemedi."})
		return
	}

	targetWa := buyerWa
	if targetWa == "" {
		targetWa = buyerPhone
	}
	digits := normalizeWhatsappDigits(targetWa)
	waText := fmt.Sprintf(
		"Merhaba %s,\nMerter Vitrini üzerindeki *%s* (%s) alım talebiniz için *%s* üretici firması olarak teklifimiz:\n\n• Birim Fiyat: %.2f %s\n• Min. Sipariş: %d\n• Teslim Süresi: %d Gün\n• Not: %s",
		buyerName, rfqTitle, rfqNumber, brandName, req.OfferedUnitPrice, currency, moq, days, strings.TrimSpace(req.Notes),
	)
	waURL := ""
	if digits != "" {
		waURL = fmt.Sprintf("https://wa.me/%s?text=%s", digits, url.QueryEscape(waText))
	}

	writeMarketplaceJSON(w, http.StatusOK, map[string]any{
		"id":           offerID,
		"whatsapp_url": waURL,
	})
}

// ListAdminRfqs handles GET /api/v1/admin/rfqs for admin moderation.
func (h *MarketplaceHandler) ListAdminRfqs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))
	rows, err := db.Pool.Query(ctx, `
		SELECT
			r.id::text, r.rfq_number, r.title, r.category_name, r.target_quantity,
			r.unit_type, r.target_price, r.currency, r.production_type, r.description,
			r.buyer_name, r.buyer_company, r.buyer_country, r.buyer_phone, r.buyer_whatsapp, r.buyer_email,
			r.status, r.created_at,
			(SELECT COUNT(*)::int FROM catalog.buyer_rfq_offers o WHERE o.rfq_id = r.id) AS offer_count,
			COALESCE(u.email_verified, false) AS buyer_email_verified
		FROM catalog.buyer_rfqs r
		LEFT JOIN identity.users u ON LOWER(u.email) = LOWER(r.buyer_email)
		WHERE ($1 = '' OR r.status = $1)
		ORDER BY r.created_at DESC
		LIMIT 150
	`, statusFilter)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusOK, []BuyerRfqDTO{})
		return
	}
	defer rows.Close()

	list := []BuyerRfqDTO{}
	for rows.Next() {
		var item BuyerRfqDTO
		if err := rows.Scan(
			&item.ID, &item.RfqNumber, &item.Title, &item.CategoryName, &item.TargetQuantity,
			&item.UnitType, &item.TargetPrice, &item.Currency, &item.ProductionType, &item.Description,
			&item.BuyerName, &item.BuyerCompany, &item.BuyerCountry, &item.BuyerPhone, &item.BuyerWhatsapp, &item.BuyerEmail,
			&item.Status, &item.CreatedAt, &item.OfferCount, &item.BuyerEmailVerified,
		); err == nil {
			list = append(list, item)
		}
	}

	writeMarketplaceJSON(w, http.StatusOK, list)
}

// UpdateAdminRfqStatus handles PUT /api/v1/admin/rfqs/{id}/status.
func (h *MarketplaceHandler) UpdateAdminRfqStatus(w http.ResponseWriter, r *http.Request) {
	rfqID := strings.TrimSpace(r.PathValue("id"))
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || rfqID == "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek."})
		return
	}
	status := strings.ToUpper(strings.TrimSpace(req.Status))
	if status != "APPROVED" && status != "PENDING" && status != "REJECTED" && status != "CLOSED" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz durum kodu."})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(ctx, `UPDATE catalog.buyer_rfqs SET status = $1, updated_at = NOW() WHERE id = $2`, status, rfqID)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": "Durum güncellenemedi."})
		return
	}
	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": status})
}

// DeleteAdminRfq handles DELETE /api/v1/admin/rfqs/{id}.
func (h *MarketplaceHandler) DeleteAdminRfq(w http.ResponseWriter, r *http.Request) {
	rfqID := strings.TrimSpace(r.PathValue("id"))
	if rfqID == "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "ID gerekli."})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	_, _ = db.Pool.Exec(ctx, `DELETE FROM catalog.buyer_rfqs WHERE id = $1`, rfqID)
	writeMarketplaceJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}
