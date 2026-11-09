package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/db"
)

var serviceProvidersSchemaOnce sync.Once

func ensureServiceProvidersSchema(ctx context.Context) {
	serviceProvidersSchemaOnce.Do(func() {
		ddl := `
		CREATE TABLE IF NOT EXISTS catalog.service_providers (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			slug VARCHAR(180) NOT NULL UNIQUE,
			company_name VARCHAR(200) NOT NULL,
			service_category VARCHAR(64) NOT NULL DEFAULT 'kargo_lojistik',
			short_description VARCHAR(300) NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			services_offered TEXT NOT NULL DEFAULT '',
			target_countries VARCHAR(255) NOT NULL DEFAULT '',
			city VARCHAR(100) NOT NULL DEFAULT 'İstanbul',
			district VARCHAR(100) NOT NULL DEFAULT 'Merter',
			address TEXT NOT NULL DEFAULT '',
			phone VARCHAR(64) NOT NULL DEFAULT '',
			whatsapp_phone VARCHAR(64) NOT NULL DEFAULT '',
			email VARCHAR(180) NOT NULL DEFAULT '',
			website VARCHAR(255) NOT NULL DEFAULT '',
			logo_url TEXT NOT NULL DEFAULT '',
			is_verified BOOLEAN NOT NULL DEFAULT true,
			is_sponsored BOOLEAN NOT NULL DEFAULT false,
			is_active BOOLEAN NOT NULL DEFAULT true,
			priority INT NOT NULL DEFAULT 10,
			view_count BIGINT NOT NULL DEFAULT 0,
			whatsapp_click_count BIGINT NOT NULL DEFAULT 0,
			translations JSONB NOT NULL DEFAULT '{}'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_service_providers_category_active
			ON catalog.service_providers (service_category, is_active, is_sponsored DESC, priority ASC);
		`
		_, _ = db.Pool.Exec(ctx, ddl)

		cleanupDemoSeedSQL := `
		DELETE FROM catalog.service_providers
		WHERE slug IN (
			'merter-global-kargo-lojistik',
			'studio-merter-lookbook-produksiyon',
			'merter-etiket-ve-luks-ambalaj',
			'pro-kalip-dijital-modelhane-merter',
			'avrasya-tekstil-ihracat-ve-gumruk-danismanligi'
		);
		`
		_, _ = db.Pool.Exec(ctx, cleanupDemoSeedSQL)
	})
}

// ServiceProviderDTO represents a B2B Sectoral Service Provider (Cargo, Studio, Label/Packaging, Pattern Making, Export Consulting).
type ServiceProviderDTO struct {
	ID                 string          `json:"id"`
	Slug               string          `json:"slug"`
	CompanyName        string          `json:"company_name"`
	ServiceCategory    string          `json:"service_category"`
	ShortDescription   string          `json:"short_description"`
	Description        string          `json:"description"`
	ServicesOffered    string          `json:"services_offered"`
	TargetCountries    string          `json:"target_countries"`
	City               string          `json:"city"`
	District           string          `json:"district"`
	Address            string          `json:"address"`
	Phone              string          `json:"phone"`
	WhatsappPhone      string          `json:"whatsapp_phone"`
	Email              string          `json:"email"`
	Website            string          `json:"website"`
	LogoURL            string          `json:"logo_url"`
	IsVerified         bool            `json:"is_verified"`
	IsSponsored        bool            `json:"is_sponsored"`
	IsActive           bool            `json:"is_active"`
	Priority           int             `json:"priority"`
	ViewCount          int64           `json:"view_count"`
	WhatsappClickCount int64           `json:"whatsapp_click_count"`
	Translations       json.RawMessage `json:"translations"`
	CreatedAt          time.Time       `json:"created_at"`
}

func slugifyServiceProviderName(name string) string {
	replacer := strings.NewReplacer(
		"ç", "c", "Ç", "c",
		"ğ", "g", "Ğ", "g",
		"ı", "i", "İ", "i",
		"ö", "o", "Ö", "o",
		"ş", "s", "Ş", "s",
		"ü", "u", "Ü", "u",
	)
	s := strings.ToLower(replacer.Replace(strings.TrimSpace(name)))
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			prevDash = false
		} else if !prevDash && b.Len() > 0 {
			b.WriteRune('-')
			prevDash = true
		}
	}
	res := strings.Trim(b.String(), "-")
	if res == "" {
		res = "hizmet-saglayici"
	}
	return fmt.Sprintf("%s-%d", res, time.Now().Unix()%10000)
}

// ListPublicServiceProviders handles GET /api/v1/store/service-providers.
func (h *MarketplaceHandler) ListPublicServiceProviders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	category := strings.TrimSpace(r.URL.Query().Get("category"))
	searchQ := strings.TrimSpace(r.URL.Query().Get("q"))
	searchPattern := "%" + searchQ + "%"

	rows, err := db.Pool.Query(ctx, `
		SELECT
			id::text, slug, company_name, service_category, short_description, description,
			services_offered, target_countries, city, district, address,
			phone, whatsapp_phone, email, website, logo_url,
			is_verified, is_sponsored, is_active, priority,
			view_count, whatsapp_click_count, COALESCE(translations, '{}'::jsonb), created_at
		FROM catalog.service_providers
		WHERE is_active = true
		  AND ($1 = '' OR $1 = 'all' OR service_category = $1)
		  AND ($2 = '' OR company_name ILIKE $3 OR short_description ILIKE $3 OR services_offered ILIKE $3 OR target_countries ILIKE $3)
		ORDER BY is_sponsored DESC, priority ASC, company_name ASC
	`, category, searchQ, searchPattern)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusOK, []ServiceProviderDTO{})
		return
	}
	defer rows.Close()

	items := make([]ServiceProviderDTO, 0)
	for rows.Next() {
		var item ServiceProviderDTO
		var rawTrans []byte
		if scanErr := rows.Scan(
			&item.ID, &item.Slug, &item.CompanyName, &item.ServiceCategory, &item.ShortDescription, &item.Description,
			&item.ServicesOffered, &item.TargetCountries, &item.City, &item.District, &item.Address,
			&item.Phone, &item.WhatsappPhone, &item.Email, &item.Website, &item.LogoURL,
			&item.IsVerified, &item.IsSponsored, &item.IsActive, &item.Priority,
			&item.ViewCount, &item.WhatsappClickCount, &rawTrans, &item.CreatedAt,
		); scanErr == nil {
			item.Translations = json.RawMessage(rawTrans)
			items = append(items, item)
		}
	}

	writeMarketplaceJSON(w, http.StatusOK, items)
}

// CreatePublicServiceProviderApplication handles POST /api/v1/store/service-providers.
func (h *MarketplaceHandler) CreatePublicServiceProviderApplication(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	var req struct {
		CompanyName      string `json:"company_name"`
		ServiceCategory  string `json:"service_category"`
		ShortDescription string `json:"short_description"`
		ServicesOffered  string `json:"services_offered"`
		TargetCountries  string `json:"target_countries"`
		Address          string `json:"address"`
		Phone            string `json:"phone"`
		WhatsappPhone    string `json:"whatsapp_phone"`
		Email            string `json:"email"`
		Website          string `json:"website"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz başvuru verisi"})
		return
	}

	companyName := strings.TrimSpace(req.CompanyName)
	phone := strings.TrimSpace(req.Phone)
	if companyName == "" || phone == "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Firma adı ve telefon numarası zorunludur"})
		return
	}

	cat := strings.TrimSpace(req.ServiceCategory)
	if cat == "" {
		cat = "kargo_lojistik"
	}
	wa := strings.TrimSpace(req.WhatsappPhone)
	if wa == "" {
		wa = phone
	}
	slug := slugifyServiceProviderName(companyName)

	var id string
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.service_providers (
			slug, company_name, service_category, short_description, description,
			services_offered, target_countries, city, district, address,
			phone, whatsapp_phone, email, website, is_verified, is_sponsored, is_active, priority
		) VALUES ($1, $2, $3, $4, $4, $5, $6, 'İstanbul', 'Merter', $7, $8, $9, $10, $11, false, false, false, 50)
		RETURNING id::text
	`,
		slug,
		companyName,
		cat,
		strings.TrimSpace(req.ShortDescription),
		strings.TrimSpace(req.ServicesOffered),
		strings.TrimSpace(req.TargetCountries),
		strings.TrimSpace(req.Address),
		phone,
		wa,
		strings.TrimSpace(req.Email),
		strings.TrimSpace(req.Website),
	).Scan(&id)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": "Başvuru kaydedilemedi"})
		return
	}

	writeMarketplaceJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "created"})
}

// TrackServiceProviderClick handles POST /api/v1/store/service-providers/{id}/click.
func (h *MarketplaceHandler) TrackServiceProviderClick(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	providerID := strings.TrimSpace(r.PathValue("id"))
	if providerID != "" {
		_, _ = db.Pool.Exec(ctx, `
			UPDATE catalog.service_providers
			SET whatsapp_click_count = whatsapp_click_count + 1, updated_at = NOW()
			WHERE id::text = $1
		`, providerID)
	}
	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "recorded"})
}

// ListAdminServiceProviders handles GET /api/v1/admin/service-providers.
func (h *MarketplaceHandler) ListAdminServiceProviders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			id::text, slug, company_name, service_category, short_description, description,
			services_offered, target_countries, city, district, address,
			phone, whatsapp_phone, email, website, logo_url,
			is_verified, is_sponsored, is_active, priority,
			view_count, whatsapp_click_count, COALESCE(translations, '{}'::jsonb), created_at
		FROM catalog.service_providers
		ORDER BY is_sponsored DESC, priority ASC, created_at DESC
	`)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := make([]ServiceProviderDTO, 0)
	for rows.Next() {
		var item ServiceProviderDTO
		var rawTrans []byte
		if scanErr := rows.Scan(
			&item.ID, &item.Slug, &item.CompanyName, &item.ServiceCategory, &item.ShortDescription, &item.Description,
			&item.ServicesOffered, &item.TargetCountries, &item.City, &item.District, &item.Address,
			&item.Phone, &item.WhatsappPhone, &item.Email, &item.Website, &item.LogoURL,
			&item.IsVerified, &item.IsSponsored, &item.IsActive, &item.Priority,
			&item.ViewCount, &item.WhatsappClickCount, &rawTrans, &item.CreatedAt,
		); scanErr == nil {
			item.Translations = json.RawMessage(rawTrans)
			items = append(items, item)
		}
	}

	writeMarketplaceJSON(w, http.StatusOK, items)
}

// UpdateAdminServiceProvider handles PUT /api/v1/admin/service-providers/{id}.
func (h *MarketplaceHandler) UpdateAdminServiceProvider(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	id := strings.TrimSpace(r.PathValue("id"))
	var req struct {
		IsActive    *bool `json:"is_active"`
		IsVerified  *bool `json:"is_verified"`
		IsSponsored *bool `json:"is_sponsored"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	_, err := db.Pool.Exec(ctx, `
		UPDATE catalog.service_providers
		SET
			is_active = COALESCE($2, is_active),
			is_verified = COALESCE($3, is_verified),
			is_sponsored = COALESCE($4, is_sponsored),
			updated_at = NOW()
		WHERE id::text = $1
	`, id, req.IsActive, req.IsVerified, req.IsSponsored)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteAdminServiceProvider handles DELETE /api/v1/admin/service-providers/{id}.
func (h *MarketplaceHandler) DeleteAdminServiceProvider(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	id := strings.TrimSpace(r.PathValue("id"))
	_, _ = db.Pool.Exec(ctx, `DELETE FROM catalog.service_providers WHERE id::text = $1`, id)
	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

