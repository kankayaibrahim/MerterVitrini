package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/db"
)

var sponsoredSchemaOnce sync.Once

func ensureSponsoredAndNewsletterSchema(ctx context.Context) {
	sponsoredSchemaOnce.Do(func() {
		ddl := `
		CREATE TABLE IF NOT EXISTS catalog.sponsored_slots (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			placement VARCHAR(64) NOT NULL DEFAULT 'home_featured_suppliers',
			brand_id UUID REFERENCES catalog.brands(id) ON DELETE SET NULL,
			category_slug VARCHAR(150) NOT NULL DEFAULT '',
			title VARCHAR(255) NOT NULL,
			subtitle VARCHAR(255) NOT NULL DEFAULT '',
			badge_text VARCHAR(80) NOT NULL DEFAULT 'SPONSORLU ÜRETİCİ',
			image_url TEXT NOT NULL DEFAULT '',
			cta_text VARCHAR(100) NOT NULL DEFAULT 'Koleksiyonu İncele',
			target_url TEXT NOT NULL DEFAULT '',
			translations JSONB NOT NULL DEFAULT '{}'::jsonb,
			priority INT NOT NULL DEFAULT 10,
			is_active BOOLEAN NOT NULL DEFAULT true,
			starts_at TIMESTAMPTZ,
			ends_at TIMESTAMPTZ,
			impression_count BIGINT NOT NULL DEFAULT 0,
			click_count BIGINT NOT NULL DEFAULT 0,
			fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
			notes TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_sponsored_slots_placement_active
			ON catalog.sponsored_slots (placement, is_active, priority ASC);

		CREATE TABLE IF NOT EXISTS catalog.newsletter_subscribers (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			email VARCHAR(255) NOT NULL UNIQUE,
			full_name VARCHAR(150) NOT NULL DEFAULT '',
			company_name VARCHAR(200) NOT NULL DEFAULT '',
			country VARCHAR(100) NOT NULL DEFAULT '',
			preferred_lang VARCHAR(10) NOT NULL DEFAULT 'tr',
			interested_categories VARCHAR(255) NOT NULL DEFAULT '',
			kvkk_consent BOOLEAN NOT NULL DEFAULT true,
			commercial_consent BOOLEAN NOT NULL DEFAULT true,
			consent_ip VARCHAR(64) NOT NULL DEFAULT '',
			is_active BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			unsubscribed_at TIMESTAMPTZ
		);
		CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_active
			ON catalog.newsletter_subscribers (is_active, preferred_lang);

		CREATE TABLE IF NOT EXISTS catalog.newsletter_campaigns (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			subject VARCHAR(255) NOT NULL,
			target_lang VARCHAR(10) NOT NULL DEFAULT 'all',
			content_summary TEXT NOT NULL DEFAULT '',
			sponsor_brand_id UUID REFERENCES catalog.brands(id) ON DELETE SET NULL,
			recipient_count INT NOT NULL DEFAULT 0,
			status VARCHAR(32) NOT NULL DEFAULT 'SENT',
			sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		`
		_, _ = db.Pool.Exec(ctx, ddl)

		seedSQL := `
		INSERT INTO catalog.sponsored_slots (
			placement, brand_id, category_slug, title, subtitle, badge_text,
			image_url, cta_text, target_url, translations, priority, is_active, fee_amount, currency, notes
		)
		SELECT
			'home_featured_suppliers',
			b.id,
			'',
			b.name,
			COALESCE(NULLIF(b.short_description, ''), 'Merter Doğrulanmış Toptan & İhracat Üreticisi — Doğrudan Fabrika Fiyatı'),
			'ÖNE ÇIKAN ÜRETİCİ',
			COALESCE(NULLIF(b.cover_image_url, ''), '/banners/collection_kadin.webp?v=2'),
			'Firma Vitrinini Aç',
			'/ureticiler/' || COALESCE(NULLIF(b.slug, ''), b.id::text),
			jsonb_build_object(
				'en', jsonb_build_object(
					'title', b.name,
					'subtitle', 'Verified Merter Wholesale & Export Manufacturer — Direct Factory Price',
					'badge_text', 'FEATURED MANUFACTURER',
					'cta_text', 'View Showroom'
				),
				'ru', jsonb_build_object(
					'title', b.name,
					'subtitle', 'Проверенный производитель Мертер — Прямые фабричные цены',
					'badge_text', 'РЕКОМЕНДУЕМЫЙ ПРОИЗВОДИТЕЛЬ',
					'cta_text', 'Открыть витрину'
				),
				'ar', jsonb_build_object(
					'title', b.name,
					'subtitle', 'مصنع جملة معتمد في مارتر — أسعار المصنع مباشرة',
					'badge_text', 'مصنع مميز',
					'cta_text', 'عرض صالة العرض'
				)
			),
			10,
			true,
			2490.00,
			'TRY',
			'Varsayılan Öne Çıkan Üretici Sponsorluk Alanı'
		FROM catalog.brands b
		WHERE b.is_active = true
		  AND NOT EXISTS (SELECT 1 FROM catalog.sponsored_slots LIMIT 1)
		ORDER BY b.name ASC
		LIMIT 3;

		INSERT INTO catalog.sponsored_slots (
			placement, brand_id, category_slug, title, subtitle, badge_text,
			image_url, cta_text, target_url, translations, priority, is_active, fee_amount, currency, notes
		)
		SELECT
			'category_sponsor',
			b.id,
			'kadin-giyim',
			b.name || ' — Yeni Sezon Toptan Kadın Koleksiyonu',
			'Seri asortili paketler, Private Label & Fason üretim imkanı ve %0 komisyonla doğrudan üreticiden sipariş',
			'KATEGORİ SPONSORU',
			'/banners/hero_women_collection.webp?v=2',
			'Üretici Koleksiyonunu Gör',
			'/ureticiler/' || COALESCE(NULLIF(b.slug, ''), b.id::text),
			jsonb_build_object(
				'en', jsonb_build_object(
					'title', b.name || ' — New Season Wholesale Women Collection',
					'subtitle', 'Full size-run packs, Private Label & Contract manufacturing directly from the factory',
					'badge_text', 'CATEGORY SPONSOR',
					'cta_text', 'Explore Collection'
				),
				'ru', jsonb_build_object(
					'title', b.name || ' — Новая оптовая женская коллекция',
					'subtitle', 'Серийные пакеты, производство Private Label и прямые поставки с фабрики',
					'badge_text', 'СПОНСОР КАТЕГОРИИ',
					'cta_text', 'Смотреть коллекцию'
				),
				'ar', jsonb_build_object(
					'title', b.name || ' — تشكيلة الموسم الجديد للملابس النسائية بالجملة',
					'subtitle', 'باقات سيريه كاملة، تصنيع علامة خاصة وطلب مباشر من المصنع بدون عمولة',
					'badge_text', 'راعي القسم',
					'cta_text', 'استكشف التشكيلة'
				)
			),
			5,
			true,
			1490.00,
			'TRY',
			'Kadın Giyim Kategori Sponsorluğu'
		FROM catalog.brands b
		WHERE b.is_active = true
		  AND NOT EXISTS (SELECT 1 FROM catalog.sponsored_slots WHERE placement = 'category_sponsor')
		ORDER BY b.name ASC
		LIMIT 1;
		`
		_, _ = db.Pool.Exec(ctx, seedSQL)
	})
}

// SponsoredSlotDTO represents a sponsored placement or ad slot.
type SponsoredSlotDTO struct {
	ID              string          `json:"id"`
	Placement       string          `json:"placement"`
	BrandID         *string         `json:"brand_id,omitempty"`
	BrandName       string          `json:"brand_name"`
	BrandSlug       string          `json:"brand_slug"`
	BrandVerified   bool            `json:"brand_verified"`
	CompanyType     string          `json:"company_type"`
	ExportCountries string          `json:"export_countries"`
	WhatsappPhone   string          `json:"whatsapp_phone"`
	City            string          `json:"city"`
	District        string          `json:"district"`
	ProductCount    int             `json:"product_count"`
	CategorySlug    string          `json:"category_slug"`
	Title           string          `json:"title"`
	Subtitle        string          `json:"subtitle"`
	BadgeText       string          `json:"badge_text"`
	ImageURL        string          `json:"image_url"`
	CtaText         string          `json:"cta_text"`
	TargetURL       string          `json:"target_url"`
	Translations    json.RawMessage `json:"translations"`
	Priority        int             `json:"priority"`
	IsActive        bool            `json:"is_active"`
	ImpressionCount int64           `json:"impression_count"`
	ClickCount      int64           `json:"click_count"`
	FeeAmount       float64         `json:"fee_amount"`
	Currency        string          `json:"currency"`
	Notes           string          `json:"notes"`
	CreatedAt       time.Time       `json:"created_at"`
}

// NewsletterSubscriberDTO represents an opted-in B2B newsletter subscriber.
type NewsletterSubscriberDTO struct {
	ID                   string    `json:"id"`
	Email                string    `json:"email"`
	FullName             string    `json:"full_name"`
	CompanyName          string    `json:"company_name"`
	Country              string    `json:"country"`
	PreferredLang        string    `json:"preferred_lang"`
	InterestedCategories string    `json:"interested_categories"`
	KvkkConsent          bool      `json:"kvkk_consent"`
	CommercialConsent    bool      `json:"commercial_consent"`
	ConsentIP            string    `json:"consent_ip"`
	IsActive             bool      `json:"is_active"`
	CreatedAt            time.Time `json:"created_at"`
}

// NewsletterCampaignDTO represents a dispatched B2B newsletter campaign.
type NewsletterCampaignDTO struct {
	ID             string    `json:"id"`
	Subject        string    `json:"subject"`
	TargetLang     string    `json:"target_lang"`
	ContentSummary string    `json:"content_summary"`
	SponsorBrandID *string   `json:"sponsor_brand_id,omitempty"`
	SponsorName    string    `json:"sponsor_name"`
	RecipientCount int       `json:"recipient_count"`
	Status         string    `json:"status"`
	SentAt         time.Time `json:"sent_at"`
}

// ListPublicSponsoredSlots handles GET /api/v1/store/sponsored-slots.
func (h *MarketplaceHandler) ListPublicSponsoredSlots(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	placement := strings.TrimSpace(r.URL.Query().Get("placement"))
	categorySlug := strings.TrimSpace(r.URL.Query().Get("category_slug"))

	rows, err := db.Pool.Query(ctx, `
		SELECT
			s.id::text,
			s.placement,
			s.brand_id::text,
			COALESCE(b.name, '') AS brand_name,
			COALESCE(NULLIF(b.slug, ''), b.id::text, '') AS brand_slug,
			COALESCE(b.is_verified, true) AS brand_verified,
			COALESCE(b.company_type, 'uretici_toptanci') AS company_type,
			COALESCE(b.export_countries, '') AS export_countries,
			COALESCE(b.whatsapp_phone, '') AS whatsapp_phone,
			COALESCE(b.city, 'İstanbul') AS city,
			COALESCE(b.district, 'Merter') AS district,
			COALESCE((SELECT COUNT(*) FROM catalog.products p WHERE p.brand_id = b.id AND p.is_active = true), 0)::int AS product_count,
			s.category_slug,
			s.title,
			s.subtitle,
			s.badge_text,
			s.image_url,
			s.cta_text,
			s.target_url,
			COALESCE(s.translations, '{}'::jsonb),
			s.priority,
			s.is_active,
			s.impression_count,
			s.click_count,
			s.fee_amount::float8,
			s.currency,
			s.notes,
			s.created_at
		FROM catalog.sponsored_slots s
		LEFT JOIN catalog.brands b ON b.id = s.brand_id
		WHERE s.is_active = true
		  AND (s.starts_at IS NULL OR s.starts_at <= NOW())
		  AND (s.ends_at IS NULL OR s.ends_at >= NOW())
		  AND ($1 = '' OR s.placement = $1)
		  AND ($2 = '' OR s.category_slug = '' OR s.category_slug = $2)
		ORDER BY s.priority ASC, s.created_at DESC
		LIMIT 20
	`, placement, categorySlug)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusOK, []SponsoredSlotDTO{})
		return
	}
	defer rows.Close()

	items := make([]SponsoredSlotDTO, 0)
	slotIDs := make([]string, 0)
	for rows.Next() {
		var item SponsoredSlotDTO
		var rawTrans []byte
		if scanErr := rows.Scan(
			&item.ID,
			&item.Placement,
			&item.BrandID,
			&item.BrandName,
			&item.BrandSlug,
			&item.BrandVerified,
			&item.CompanyType,
			&item.ExportCountries,
			&item.WhatsappPhone,
			&item.City,
			&item.District,
			&item.ProductCount,
			&item.CategorySlug,
			&item.Title,
			&item.Subtitle,
			&item.BadgeText,
			&item.ImageURL,
			&item.CtaText,
			&item.TargetURL,
			&rawTrans,
			&item.Priority,
			&item.IsActive,
			&item.ImpressionCount,
			&item.ClickCount,
			&item.FeeAmount,
			&item.Currency,
			&item.Notes,
			&item.CreatedAt,
		); scanErr == nil {
			if len(rawTrans) == 0 {
				item.Translations = json.RawMessage(`{}`)
			} else {
				item.Translations = json.RawMessage(rawTrans)
			}
			items = append(items, item)
			slotIDs = append(slotIDs, item.ID)
		}
	}

	if len(slotIDs) > 0 {
		_, _ = db.Pool.Exec(ctx, `
			UPDATE catalog.sponsored_slots
			SET impression_count = impression_count + 1
			WHERE id::text = ANY($1)
		`, slotIDs)
	}

	writeMarketplaceJSON(w, http.StatusOK, items)
}

// TrackSponsoredSlotClick handles POST /api/v1/store/sponsored-slots/{id}/click.
func (h *MarketplaceHandler) TrackSponsoredSlotClick(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	slotID := strings.TrimSpace(r.PathValue("id"))
	if slotID == "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "slot id required"})
		return
	}

	var brandID *string
	_ = db.Pool.QueryRow(ctx, `
		UPDATE catalog.sponsored_slots
		SET click_count = click_count + 1, updated_at = NOW()
		WHERE id::text = $1
		RETURNING brand_id::text
	`, slotID).Scan(&brandID)

	if brandID != nil && *brandID != "" {
		_, _ = db.Pool.Exec(ctx, `
			INSERT INTO analytics.brand_events (brand_id, event_type, visitor_country_code, source_page)
			VALUES ($1::uuid, 'profile_view', 'TR', 'sponsored_slot')
		`, *brandID)
	}

	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "recorded"})
}

// SubscribeNewsletter handles POST /api/v1/store/newsletter/subscribe.
func (h *MarketplaceHandler) SubscribeNewsletter(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	var req struct {
		Email                string `json:"email"`
		FullName             string `json:"full_name"`
		CompanyName          string `json:"company_name"`
		Country              string `json:"country"`
		PreferredLang        string `json:"preferred_lang"`
		InterestedCategories string `json:"interested_categories"`
		KvkkConsent          bool   `json:"kvkk_consent"`
		CommercialConsent    bool   `json:"commercial_consent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek formatı"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || !strings.Contains(email, "@") {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçerli bir e-posta adresi giriniz"})
		return
	}
	if !req.CommercialConsent || !req.KvkkConsent {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "KVKK ve ticari elektronik ileti onayı zorunludur"})
		return
	}

	lang := strings.TrimSpace(req.PreferredLang)
	if lang == "" {
		lang = "tr"
	}
	clientIP := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if clientIP == "" {
		clientIP = r.RemoteAddr
	}

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO catalog.newsletter_subscribers (
			email, full_name, company_name, country, preferred_lang,
			interested_categories, kvkk_consent, commercial_consent, consent_ip, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, true, true, $7, true)
		ON CONFLICT (email) DO UPDATE SET
			full_name = EXCLUDED.full_name,
			company_name = EXCLUDED.company_name,
			country = EXCLUDED.country,
			preferred_lang = EXCLUDED.preferred_lang,
			interested_categories = EXCLUDED.interested_categories,
			kvkk_consent = true,
			commercial_consent = true,
			consent_ip = EXCLUDED.consent_ip,
			is_active = true,
			unsubscribed_at = NULL
	`, email, strings.TrimSpace(req.FullName), strings.TrimSpace(req.CompanyName), strings.TrimSpace(req.Country), lang, strings.TrimSpace(req.InterestedCategories), clientIP)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": "Kayıt sırasında hata oluştu"})
		return
	}

	writeMarketplaceJSON(w, http.StatusCreated, map[string]string{"status": "subscribed"})
}

// ListAdminSponsoredSlots handles GET /api/v1/admin/sponsored-slots.
func (h *MarketplaceHandler) ListAdminSponsoredSlots(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			s.id::text,
			s.placement,
			s.brand_id::text,
			COALESCE(b.name, '') AS brand_name,
			COALESCE(NULLIF(b.slug, ''), b.id::text, '') AS brand_slug,
			COALESCE(b.is_verified, true) AS brand_verified,
			COALESCE(b.company_type, 'uretici_toptanci') AS company_type,
			COALESCE(b.export_countries, '') AS export_countries,
			COALESCE(b.whatsapp_phone, '') AS whatsapp_phone,
			COALESCE(b.city, 'İstanbul') AS city,
			COALESCE(b.district, 'Merter') AS district,
			0 AS product_count,
			s.category_slug,
			s.title,
			s.subtitle,
			s.badge_text,
			s.image_url,
			s.cta_text,
			s.target_url,
			COALESCE(s.translations, '{}'::jsonb),
			s.priority,
			s.is_active,
			s.impression_count,
			s.click_count,
			s.fee_amount::float8,
			s.currency,
			s.notes,
			s.created_at
		FROM catalog.sponsored_slots s
		LEFT JOIN catalog.brands b ON b.id = s.brand_id
		ORDER BY s.priority ASC, s.created_at DESC
	`)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := make([]SponsoredSlotDTO, 0)
	for rows.Next() {
		var item SponsoredSlotDTO
		var rawTrans []byte
		if scanErr := rows.Scan(
			&item.ID,
			&item.Placement,
			&item.BrandID,
			&item.BrandName,
			&item.BrandSlug,
			&item.BrandVerified,
			&item.CompanyType,
			&item.ExportCountries,
			&item.WhatsappPhone,
			&item.City,
			&item.District,
			&item.ProductCount,
			&item.CategorySlug,
			&item.Title,
			&item.Subtitle,
			&item.BadgeText,
			&item.ImageURL,
			&item.CtaText,
			&item.TargetURL,
			&rawTrans,
			&item.Priority,
			&item.IsActive,
			&item.ImpressionCount,
			&item.ClickCount,
			&item.FeeAmount,
			&item.Currency,
			&item.Notes,
			&item.CreatedAt,
		); scanErr == nil {
			item.Translations = json.RawMessage(rawTrans)
			items = append(items, item)
		}
	}

	writeMarketplaceJSON(w, http.StatusOK, items)
}

// CreateAdminSponsoredSlot handles POST /api/v1/admin/sponsored-slots.
func (h *MarketplaceHandler) CreateAdminSponsoredSlot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	var req struct {
		Placement    string  `json:"placement"`
		BrandID      string  `json:"brand_id"`
		CategorySlug string  `json:"category_slug"`
		Title        string  `json:"title"`
		Subtitle     string  `json:"subtitle"`
		BadgeText    string  `json:"badge_text"`
		ImageURL     string  `json:"image_url"`
		CtaText      string  `json:"cta_text"`
		TargetURL    string  `json:"target_url"`
		Priority     int     `json:"priority"`
		IsActive     bool    `json:"is_active"`
		FeeAmount    float64 `json:"fee_amount"`
		Currency     string  `json:"currency"`
		Notes        string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Başlık zorunludur"})
		return
	}
	placement := strings.TrimSpace(req.Placement)
	if placement == "" {
		placement = "home_featured_suppliers"
	}
	badge := strings.TrimSpace(req.BadgeText)
	if badge == "" {
		badge = "SPONSORLU VİTRİN"
	}
	cta := strings.TrimSpace(req.CtaText)
	if cta == "" {
		cta = "Koleksiyonu İncele"
	}
	currency := strings.TrimSpace(req.Currency)
	if currency == "" {
		currency = "TRY"
	}

	var brandIDPtr *string
	if strings.TrimSpace(req.BrandID) != "" {
		b := strings.TrimSpace(req.BrandID)
		brandIDPtr = &b
	}

	var id string
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.sponsored_slots (
			placement, brand_id, category_slug, title, subtitle, badge_text,
			image_url, cta_text, target_url, priority, is_active, fee_amount, currency, notes
		) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id::text
	`,
		placement,
		brandIDPtr,
		strings.TrimSpace(req.CategorySlug),
		title,
		strings.TrimSpace(req.Subtitle),
		badge,
		strings.TrimSpace(req.ImageURL),
		cta,
		strings.TrimSpace(req.TargetURL),
		req.Priority,
		req.IsActive,
		req.FeeAmount,
		currency,
		strings.TrimSpace(req.Notes),
	).Scan(&id)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeMarketplaceJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "created"})
}

// UpdateAdminSponsoredSlot handles PUT /api/v1/admin/sponsored-slots/{id}.
func (h *MarketplaceHandler) UpdateAdminSponsoredSlot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	slotID := strings.TrimSpace(r.PathValue("id"))
	var req struct {
		IsActive *bool    `json:"is_active"`
		Priority *int     `json:"priority"`
		Title    *string  `json:"title"`
		Subtitle *string  `json:"subtitle"`
		Target   *string  `json:"target_url"`
		Fee      *float64 `json:"fee_amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	_, err := db.Pool.Exec(ctx, `
		UPDATE catalog.sponsored_slots
		SET
			is_active = COALESCE($2, is_active),
			priority = COALESCE($3, priority),
			title = COALESCE($4, title),
			subtitle = COALESCE($5, subtitle),
			target_url = COALESCE($6, target_url),
			fee_amount = COALESCE($7, fee_amount),
			updated_at = NOW()
		WHERE id::text = $1
	`, slotID, req.IsActive, req.Priority, req.Title, req.Subtitle, req.Target, req.Fee)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteAdminSponsoredSlot handles DELETE /api/v1/admin/sponsored-slots/{id}.
func (h *MarketplaceHandler) DeleteAdminSponsoredSlot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	slotID := strings.TrimSpace(r.PathValue("id"))
	_, _ = db.Pool.Exec(ctx, `DELETE FROM catalog.sponsored_slots WHERE id::text = $1`, slotID)
	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// GetAdminNewsletterOverview handles GET /api/v1/admin/newsletter/overview.
func (h *MarketplaceHandler) GetAdminNewsletterOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	subRows, err := db.Pool.Query(ctx, `
		SELECT
			id::text, email, full_name, company_name, country, preferred_lang,
			interested_categories, kvkk_consent, commercial_consent, consent_ip, is_active, created_at
		FROM catalog.newsletter_subscribers
		ORDER BY created_at DESC
		LIMIT 250
	`)
	subscribers := make([]NewsletterSubscriberDTO, 0)
	if err == nil {
		defer subRows.Close()
		for subRows.Next() {
			var s NewsletterSubscriberDTO
			if scanErr := subRows.Scan(
				&s.ID, &s.Email, &s.FullName, &s.CompanyName, &s.Country, &s.PreferredLang,
				&s.InterestedCategories, &s.KvkkConsent, &s.CommercialConsent, &s.ConsentIP, &s.IsActive, &s.CreatedAt,
			); scanErr == nil {
				subscribers = append(subscribers, s)
			}
		}
	}

	campRows, campErr := db.Pool.Query(ctx, `
		SELECT
			c.id::text, c.subject, c.target_lang, c.content_summary,
			c.sponsor_brand_id::text, COALESCE(b.name, '') AS sponsor_name,
			c.recipient_count, c.status, c.sent_at
		FROM catalog.newsletter_campaigns c
		LEFT JOIN catalog.brands b ON b.id = c.sponsor_brand_id
		ORDER BY c.sent_at DESC
		LIMIT 50
	`)
	campaigns := make([]NewsletterCampaignDTO, 0)
	if campErr == nil {
		defer campRows.Close()
		for campRows.Next() {
			var c NewsletterCampaignDTO
			if scanErr := campRows.Scan(
				&c.ID, &c.Subject, &c.TargetLang, &c.ContentSummary,
				&c.SponsorBrandID, &c.SponsorName, &c.RecipientCount, &c.Status, &c.SentAt,
			); scanErr == nil {
				campaigns = append(campaigns, c)
			}
		}
	}

	writeMarketplaceJSON(w, http.StatusOK, map[string]any{
		"subscribers": subscribers,
		"campaigns":   campaigns,
	})
}

// DeleteAdminNewsletterSubscriber handles DELETE /api/v1/admin/newsletter/subscribers/{id}.
func (h *MarketplaceHandler) DeleteAdminNewsletterSubscriber(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	subID := strings.TrimSpace(r.PathValue("id"))
	_, _ = db.Pool.Exec(ctx, `DELETE FROM catalog.newsletter_subscribers WHERE id::text = $1`, subID)
	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// CreateAdminNewsletterCampaign handles POST /api/v1/admin/newsletter/campaigns.
func (h *MarketplaceHandler) CreateAdminNewsletterCampaign(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureSponsoredAndNewsletterSchema(ctx)

	var req struct {
		Subject        string `json:"subject"`
		TargetLang     string `json:"target_lang"`
		ContentSummary string `json:"content_summary"`
		SponsorBrandID string `json:"sponsor_brand_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Bülten konusu zorunludur"})
		return
	}
	targetLang := strings.TrimSpace(req.TargetLang)
	if targetLang == "" {
		targetLang = "all"
	}

	var recipientCount int
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM catalog.newsletter_subscribers
		WHERE is_active = true
		  AND commercial_consent = true
		  AND ($1 = 'all' OR preferred_lang = $1)
	`, targetLang).Scan(&recipientCount)

	var sponsorPtr *string
	if strings.TrimSpace(req.SponsorBrandID) != "" {
		s := strings.TrimSpace(req.SponsorBrandID)
		sponsorPtr = &s
	}

	var campaignID string
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.newsletter_campaigns (
			subject, target_lang, content_summary, sponsor_brand_id, recipient_count, status
		) VALUES ($1, $2, $3, $4::uuid, $5, 'SENT')
		RETURNING id::text
	`, subject, targetLang, strings.TrimSpace(req.ContentSummary), sponsorPtr, recipientCount).Scan(&campaignID)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeMarketplaceJSON(w, http.StatusCreated, map[string]any{
		"id":              campaignID,
		"recipient_count": recipientCount,
		"status":          "SENT",
	})
}

