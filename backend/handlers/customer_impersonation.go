package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
	"mertervitrini/backend/services"

	"github.com/jackc/pgx/v5"
)

const customerImpersonationTTL = 2 * time.Hour

var (
	impersonationSchemaOnce sync.Once
	impersonationSchemaErr  error
)

// EnsureCustomerImpersonationSchema provisions the audit log table idempotently on startup.
func EnsureCustomerImpersonationSchema(ctx context.Context) error {
	if db.Pool == nil {
		return nil
	}
	impersonationSchemaOnce.Do(func() {
		ddl := `
		CREATE SCHEMA IF NOT EXISTS identity;
		CREATE TABLE IF NOT EXISTS identity.impersonation_logs (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			admin_user_id VARCHAR(255) NOT NULL DEFAULT '',
			admin_email VARCHAR(150) NOT NULL DEFAULT '',
			admin_role VARCHAR(50) NOT NULL DEFAULT '',
			customer_id VARCHAR(255) NOT NULL,
			customer_email VARCHAR(150) NOT NULL DEFAULT '',
			ip_address VARCHAR(64) NOT NULL DEFAULT '',
			user_agent VARCHAR(512) NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_impersonation_logs_customer_created
			ON identity.impersonation_logs (customer_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin_created
			ON identity.impersonation_logs (admin_email, created_at DESC);`
		_, impersonationSchemaErr = db.Pool.Exec(ctx, ddl)
	})
	return impersonationSchemaErr
}

type impersonationCustomerRecord struct {
	ID                string
	FirstName         string
	LastName          string
	Email             string
	Phone             string
	PreferredLang     string
	PreferredCurrency string
	BillingAddress    string
	DeliveryAddress   string
	TaxNoTCKN         string
	InstagramUsername string
	UserRole          string
	IsActive          bool
	IsBlocked         bool
}

func isStaffAccountRole(role string) bool {
	switch models.UserRole(strings.ToLower(strings.TrimSpace(role))) {
	case models.RoleSuperAdmin, models.RoleAdmin, models.RoleEditor, models.RoleSalesManager, models.RoleWarehouse:
		return true
	default:
		return false
	}
}

func resolveCustomerTokenSecret(cfg *config.Config) string {
	if cfg != nil && strings.TrimSpace(cfg.JWTSecret) != "" {
		return strings.TrimSpace(cfg.JWTSecret)
	}
	loaded := config.LoadConfig()
	if loaded != nil {
		return strings.TrimSpace(loaded.JWTSecret)
	}
	return ""
}

func fetchCustomerForImpersonation(ctx context.Context, customerID string) (*impersonationCustomerRecord, int, string) {
	var rec impersonationCustomerRecord
	err := db.Pool.QueryRow(ctx, `
		SELECT id,
		       COALESCE(first_name, ''),
		       COALESCE(last_name, ''),
		       COALESCE(email, ''),
		       COALESCE(phone, ''),
		       COALESCE(NULLIF(preferred_lang, ''), 'tr'),
		       COALESCE(NULLIF(preferred_currency, ''), 'TRY'),
		       COALESCE(billing_address, ''),
		       COALESCE(delivery_address, ''),
		       COALESCE(tax_no_tckn, ''),
		       COALESCE(instagram_username, ''),
		       COALESCE(user_role, 'customer'),
		       COALESCE(is_active, true),
		       COALESCE(is_blocked, false)
		FROM identity.users
		WHERE id = $1
		LIMIT 1
	`, customerID).Scan(
		&rec.ID,
		&rec.FirstName,
		&rec.LastName,
		&rec.Email,
		&rec.Phone,
		&rec.PreferredLang,
		&rec.PreferredCurrency,
		&rec.BillingAddress,
		&rec.DeliveryAddress,
		&rec.TaxNoTCKN,
		&rec.InstagramUsername,
		&rec.UserRole,
		&rec.IsActive,
		&rec.IsBlocked,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, http.StatusNotFound, `{"error":"Müşteri bulunamadı"}`
		}
		log.Printf("[IMPERSONATION ERROR] Failed to load customer %s: %v", customerID, err)
		return nil, http.StatusInternalServerError, `{"error":"Müşteri bilgileri alınamadı"}`
	}
	if isStaffAccountRole(rec.UserRole) {
		return nil, http.StatusForbidden, `{"error":"Yönetici veya personel hesapları adına giriş yapılamaz"}`
	}
	if !rec.IsActive {
		return nil, http.StatusForbidden, `{"error":"Pasif durumdaki müşteri hesabı adına giriş yapılamaz"}`
	}
	if rec.IsBlocked {
		return nil, http.StatusForbidden, `{"error":"Engellenmiş müşteri hesabı adına giriş yapılamaz"}`
	}
	return &rec, 0, ""
}

func insertImpersonationAuditLog(ctx context.Context, r *http.Request, staff *models.UserInfo, customer *impersonationCustomerRecord) {
	if db.Pool == nil || staff == nil || customer == nil {
		return
	}
	_ = EnsureCustomerImpersonationSchema(ctx)
	ip := clampStringLen(getClientIP(r), 60)
	ua := clampStringLen(strings.TrimSpace(r.UserAgent()), 500)
	if _, err := db.Pool.Exec(ctx, `
		INSERT INTO identity.impersonation_logs
			(admin_user_id, admin_email, admin_role, customer_id, customer_email, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, staff.ID, staff.Email, staff.Role, customer.ID, customer.Email, ip, ua); err != nil {
		log.Printf("[IMPERSONATION WARNING] Failed to insert audit log for customer=%s: %v", customer.ID, err)
	}
}

func clampStringLen(s string, maxLen int) string {
	if maxLen <= 0 || len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}

func writeJSONErrorRaw(w http.ResponseWriter, statusCode int, body string) {
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(statusCode)
	_, _ = w.Write([]byte(body))
}

// ImpersonateCustomer issues a short-lived customer-only storefront token so authorized staff can test or assist with orders.
func (h *CustomersHandler) ImpersonateCustomer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONErrorRaw(w, http.StatusMethodNotAllowed, `{"error":"Method not allowed"}`)
		return
	}

	customerID := strings.TrimSpace(r.PathValue("id"))
	if customerID == "" {
		writeJSONErrorRaw(w, http.StatusBadRequest, `{"error":"Müşteri ID gereklidir"}`)
		return
	}

	staff, ok := middleware.GetUserFromContext(r.Context())
	if !ok || staff == nil {
		writeJSONErrorRaw(w, http.StatusUnauthorized, `{"error":"Yetkili kullanıcı doğrulanamadı"}`)
		return
	}

	if db.Pool == nil {
		writeJSONErrorRaw(w, http.StatusServiceUnavailable, `{"error":"Veritabanı bağlantısı hazır değil"}`)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	customer, statusErr, errBody := fetchCustomerForImpersonation(ctx, customerID)
	if customer == nil {
		writeJSONErrorRaw(w, statusErr, errBody)
		return
	}

	secret := resolveCustomerTokenSecret(h.Cfg)
	if secret == "" {
		writeJSONErrorRaw(w, http.StatusInternalServerError, `{"error":"Token imzalama anahtarı yapılandırılmamış"}`)
		return
	}

	fullName := strings.TrimSpace(fmt.Sprintf("%s %s", customer.FirstName, customer.LastName))
	tokenSvc := services.NewUnifiedTokenService(secret, "", db.Pool)
	token := tokenSvc.IssueCustomerImpersonationJWT(services.CustomerImpersonationInput{
		CustomerID:    customer.ID,
		CustomerEmail: customer.Email,
		CustomerName:  fullName,
		CompanyName:   customer.InstagramUsername,
		Phone:         customer.Phone,
		AdminID:       staff.ID,
		AdminEmail:    staff.Email,
		TTL:           customerImpersonationTTL,
	})
	if token == "" {
		writeJSONErrorRaw(w, http.StatusInternalServerError, `{"error":"Müşteri oturum tokeni oluşturulamadı"}`)
		return
	}

	insertImpersonationAuditLog(ctx, r, staff, customer)
	log.Printf("[IMPERSONATION] Staff=%s (%s) started customer impersonation for customer=%s (%s)", staff.Email, staff.Role, customer.ID, customer.Email)

	cartItems, err := FetchCartItemsByUserID(ctx, customer.ID)
	if err != nil {
		cartItems = []CartResponseItem{}
	}
	cartPackagesCount := sumCartPackages(cartItems)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success":    true,
		"token":      token,
		"expires_in": int(customerImpersonationTTL.Seconds()),
		"customer": map[string]any{
			"id":                 customer.ID,
			"first_name":         customer.FirstName,
			"last_name":          customer.LastName,
			"email":              customer.Email,
			"phone":              customer.Phone,
			"role":               models.RoleCustomer,
			"preferred_lang":     customer.PreferredLang,
			"preferred_currency": customer.PreferredCurrency,
			"billing_address":    customer.BillingAddress,
			"delivery_address":   customer.DeliveryAddress,
			"tax_no_tckn":        customer.TaxNoTCKN,
			"instagram_username": customer.InstagramUsername,
			"impersonated":       true,
			"impersonated_by":    staff.Email,
			"impersonated_by_id": staff.ID,
		},
		"cart_items":       cartItems,
		"cart_items_count": cartPackagesCount,
	})
}

func sumCartPackages(items []CartResponseItem) int {
	total := 0
	for _, it := range items {
		total += it.PackagesQty
	}
	return total
}

// GetCustomerCart returns the live unfinished cart items of a customer for Admin customer support inspection.
func (h *CustomersHandler) GetCustomerCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONErrorRaw(w, http.StatusMethodNotAllowed, `{"error":"Method not allowed"}`)
		return
	}

	customerID := strings.TrimSpace(r.PathValue("id"))
	if customerID == "" {
		writeJSONErrorRaw(w, http.StatusBadRequest, `{"error":"Müşteri ID gereklidir"}`)
		return
	}

	if db.Pool == nil {
		writeJSONErrorRaw(w, http.StatusServiceUnavailable, `{"error":"Veritabanı bağlantısı hazır değil"}`)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	items, err := FetchCartItemsByUserID(ctx, customerID)
	if err != nil {
		log.Printf("[IMPERSONATION CART ERROR] Failed to load cart for customer=%s: %v", customerID, err)
		writeJSONErrorRaw(w, http.StatusInternalServerError, `{"error":"Müşteri sepeti yüklenemedi"}`)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"customer_id":    customerID,
		"items":          items,
		"items_count":    len(items),
		"total_packages": sumCartPackages(items),
	})
}
