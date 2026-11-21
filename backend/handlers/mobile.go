package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/services"
)

const (
	maxSingleImageBytes = 25 << 20 // 25 MB
	maxBatchImageBytes  = 50 << 20 // 50 MB
)

// MobileHandlerDeps encapsulates DIP service abstractions injected into MobileHandler.
type MobileHandlerDeps struct {
	Media        services.MediaProcessor
	Tokens       services.TokenService
	Deletion     *services.AccountDeletionRegistry
	SupplierApps *SupplierApplicationsHandler
	Marketplace  *MarketplaceHandler
}

// MobileHandler coordinates mobile B2B HTTP endpoints by delegating domain logic to injected services.
type MobileHandler struct {
	Cfg          *config.Config
	StoreAuth    *StoreAuthHandler
	SupplierAuth *SupplierPortalHandler
	SupplierApps *SupplierApplicationsHandler
	Marketplace  *MarketplaceHandler
	Media        services.MediaProcessor
	Tokens       services.TokenService
	Deletion     *services.AccountDeletionRegistry
}

func deleteKeycloakUserViaAdmin(ctx context.Context, cfg *config.Config, storeAuth *StoreAuthHandler, userID string) error {
	adminTok, err := storeAuth.getAdminAccessToken(ctx)
	if err != nil || adminTok == "" {
		return err
	}
	kcURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", cfg.KeycloakURL, cfg.KeycloakRealm, userID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, kcURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+adminTok)
	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func buildDefaultDeletionRegistry(cfg *config.Config, storeAuth *StoreAuthHandler) *services.AccountDeletionRegistry {
	var kcDeleter services.KeycloakUserDeleter
	if storeAuth != nil && cfg != nil {
		kcDeleter = func(ctx context.Context, userID string) error {
			return deleteKeycloakUserViaAdmin(ctx, cfg, storeAuth, userID)
		}
	}
	return services.NewAccountDeletionRegistry(
		db.Pool,
		services.NewCustomerDeletionStrategy(db.Pool, kcDeleter),
		services.NewSupplierDeletionStrategy(db.Pool),
	)
}

func resolveTokenService(cfg *config.Config, injected services.TokenService) services.TokenService {
	if injected != nil {
		return injected
	}
	if cfg == nil {
		return services.NewUnifiedTokenService("", "", db.Pool)
	}
	return services.NewUnifiedTokenService(cfg.JWTSecret, cfg.KeycloakPublicKey, db.Pool)
}

func NewMobileHandler(
	cfg *config.Config,
	storeAuth *StoreAuthHandler,
	supplierAuth *SupplierPortalHandler,
	deps ...MobileHandlerDeps,
) *MobileHandler {
	var d MobileHandlerDeps
	if len(deps) > 0 {
		d = deps[0]
	}

	mediaSvc := d.Media
	if mediaSvc == nil {
		mediaSvc = services.NewLocalImageMediaService("")
	}

	deletionReg := d.Deletion
	if deletionReg == nil {
		deletionReg = buildDefaultDeletionRegistry(cfg, storeAuth)
	}

	supplierApps := d.SupplierApps
	if supplierApps == nil {
		supplierApps = NewSupplierApplicationsHandler(cfg)
	}

	marketplace := d.Marketplace
	if marketplace == nil {
		marketplace = NewMarketplaceHandler(cfg, services.NewPostgresNotificationDispatcher(db.Pool))
	}

	return &MobileHandler{
		Cfg:          cfg,
		StoreAuth:    storeAuth,
		SupplierAuth: supplierAuth,
		SupplierApps: supplierApps,
		Marketplace:  marketplace,
		Media:        mediaSvc,
		Tokens:       resolveTokenService(cfg, d.Tokens),
		Deletion:     deletionReg,
	}
}

// MediaRootDir returns the active media upload root directory for static serving in local/dev environments.
func MediaRootDir() string {
	return getMediaDir()
}

// Bootstrap serves GET /api/v1/mobile/bootstrap with unified storefront + app configuration payload.
func (h *MobileHandler) Bootstrap(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	var settings models.Settings
	_ = db.Pool.QueryRow(ctx, `
		SELECT id, address, phone, whatsapp, email, show_single_price, COALESCE(show_prices_to_guests, false), updated_at
		FROM catalog.settings LIMIT 1
	`).Scan(&settings.ID, &settings.Address, &settings.Phone, &settings.Whatsapp, &settings.Email, &settings.ShowSinglePrice, &settings.ShowPricesToGuests, &settings.UpdatedAt)

	release := h.loadMobileReleaseManifest()
	isAuthed := h.hasVerifiedBootstrapCaller(ctx, r.Header.Get("Authorization"))
	hidePrices := !isAuthed && !settings.ShowPricesToGuests
	formChallengeToken, _ := issueMobileChallengeToken(h.Cfg, mobileChallengeDefaultPurpose, time.Now().UTC())

	httpx.JSON(w, http.StatusOK, map[string]any{
		"app_config": map[string]any{
			"app_name":             release.AppName,
			"package_id":           release.PackageID,
			"min_android_version":  release.Version,
			"min_build_number":     release.MinBuildNumber,
			"latest_version":       release.Version,
			"latest_build_number":  release.BuildNumber,
			"force_update":         release.ForceUpdate,
			"apk_available":        release.ApkAvailable,
			"apk_download_url":     release.DownloadURL,
			"apk_sha256":           release.SHA256,
			"apk_size_bytes":       release.FileSizeBytes,
			"release_notes":        release.ReleaseNotes,
			"ws_path":              "/api/v1/chat/ws",
			"privacy_policy_url":   "https://mertervitrini.com.tr/tr/pages/gizlilik-politikasi",
			"terms_url":            "https://mertervitrini.com.tr/tr/pages/kullanim-kosullari",
			"account_deletion_url": "https://mertervitrini.com.tr/account-deletion",
			"dual_role_enabled":    true,
			"form_challenge_token": formChallengeToken,
		},
		"settings":          settings,
		"languages":         fetchBootstrapLanguages(ctx),
		"exchange_rates":    fetchBootstrapExchangeRates(ctx),
		"categories":        fetchBootstrapCategories(ctx),
		"brands":            fetchBootstrapBrands(ctx),
		"newest_products":   sanitizeMobileBootstrapProducts(fetchBootstrapProducts(ctx, "ORDER BY p.created_at DESC LIMIT 12"), hidePrices),
		"featured_products": sanitizeMobileBootstrapProducts(fetchBootstrapProducts(ctx, "ORDER BY (p.discounted_price IS NOT NULL AND p.discounted_price > 0) DESC, p.stock DESC, p.created_at DESC LIMIT 12"), hidePrices),
	})
}

func (h *MobileHandler) hasVerifiedBootstrapCaller(ctx context.Context, authHeader string) bool {
	if h == nil || h.Tokens == nil || authHeader == "" {
		return false
	}
	principal, err := h.Tokens.ResolvePrincipal(ctx, authHeader)
	return err == nil && principal != nil && principal.UserID != ""
}

func sanitizeMobileBootstrapProducts(prods []*models.Product, hidePrices bool) []*models.Product {
	for _, p := range prods {
		if p == nil {
			continue
		}
		p.BuyingPrice = nil
		p.FeedID = nil
		p.SourceProductID = ""
		if hidePrices || (p.BrandProfile != nil && p.BrandProfile.WhatsappOnlyOrdering) {
			p.Price = 0
			p.DiscountedPrice = nil
			p.SinglePrice = nil
			for _, v := range p.Variants {
				if v != nil {
					v.Price = 0
					v.DiscountedPrice = nil
				}
			}
		}
	}
	return prods
}

func fetchBootstrapLanguages(ctx context.Context) []*models.Language {
	languages := make([]*models.Language, 0, 4)
	rows, err := db.Pool.Query(ctx, `
		SELECT code, label, flag, category_prefix, text_direction AS dir, is_active, sort_order
		FROM catalog.languages WHERE is_active = true ORDER BY sort_order ASC, code ASC
	`)
	if err != nil {
		return languages
	}
	defer rows.Close()
	for rows.Next() {
		var l models.Language
		if err := rows.Scan(&l.Code, &l.Label, &l.Flag, &l.CategoryPrefix, &l.Dir, &l.IsActive, &l.SortOrder); err == nil {
			languages = append(languages, &l)
		}
	}
	return languages
}

func fetchBootstrapExchangeRates(ctx context.Context) []*models.ExchangeRate {
	rates := make([]*models.ExchangeRate, 0, 4)
	rows, err := db.Pool.Query(ctx, `
		SELECT DISTINCT ON (currency_code)
			id, currency_code, buying_rate, selling_rate, publication_date, created_at, updated_at
		FROM catalog.exchange_rates
		ORDER BY currency_code, publication_date DESC
	`)
	if err != nil {
		return rates
	}
	defer rows.Close()
	for rows.Next() {
		var er models.ExchangeRate
		if err := rows.Scan(&er.ID, &er.CurrencyCode, &er.BuyingRate, &er.SellingRate, &er.PublicationDate, &er.CreatedAt, &er.UpdatedAt); err == nil {
			rates = append(rates, &er)
		}
	}
	return rates
}

func fetchBootstrapCategories(ctx context.Context) []*models.CategoryNode {
	flatList, err := fetchFlatCategories(ctx)
	if err != nil {
		return []*models.CategoryNode{}
	}
	nodesMap := make(map[string]*models.CategoryNode, len(flatList))
	for _, c := range flatList {
		nodesMap[c.ID] = &models.CategoryNode{
			ID:             c.ID,
			ParentID:       c.ParentID,
			Title:          c.Title,
			Slug:           c.Slug,
			NodePath:       c.NodePath,
			IsActive:       c.IsActive,
			TotalProducts:  c.TotalProducts,
			ActiveProducts: c.ActiveProducts,
			Children:       make([]*models.CategoryNode, 0),
			Translations:   make(map[string]models.CategoryTranslation),
		}
	}
	attachCategoryTranslations(ctx, nodesMap)
	return buildStoreCategoryTree(flatList, nodesMap)
}

func extractBrandCity(locationAddress string, addresses []map[string]any) string {
	for _, addr := range addresses {
		if c, ok := addr["city"].(string); ok && strings.TrimSpace(c) != "" {
			return strings.TrimSpace(c)
		}
		if d, ok := addr["district"].(string); ok && strings.TrimSpace(d) != "" {
			return strings.TrimSpace(d)
		}
	}
	lower := strings.ToLower(locationAddress)
	switch {
	case strings.Contains(lower, "istanbul") || strings.Contains(lower, "i̇stanbul") || strings.Contains(lower, "merter") || strings.Contains(lower, "güngören") || strings.Contains(lower, "osmanbey") || strings.Contains(lower, "laleli") || strings.Contains(lower, "zeytinburnu"):
		return "İstanbul"
	case strings.Contains(lower, "bursa"):
		return "Bursa"
	case strings.Contains(lower, "denizli"):
		return "Denizli"
	case strings.Contains(lower, "izmir") || strings.Contains(lower, "i̇zmir"):
		return "İzmir"
	case strings.Contains(lower, "ankara"):
		return "Ankara"
	default:
		return ""
	}
}

func fetchBootstrapBrands(ctx context.Context) []map[string]any {
	brands := make([]map[string]any, 0, 16)
	rows, err := db.Pool.Query(ctx, `
		SELECT b.id::text, b.brand_name AS display_name, b.slug,
		       COALESCE(b.company_type, 'uretici_toptanci'),
		       COALESCE(b.description, ''),
		       COALESCE(b.description_translations, '{}'::jsonb),
		       COALESCE(b.website, ''),
		       COALESCE(
		           NULLIF(b.whatsapp_phone, ''),
		           NULLIF(b.phone, ''),
		           (SELECT COALESCE(NULLIF(su.phone, ''), '') FROM catalog.supplier_users su WHERE su.brand_id = b.id AND su.phone IS NOT NULL AND su.phone <> '' ORDER BY su.is_owner DESC, su.created_at ASC LIMIT 1),
		           ''
		       ),
		       COALESCE(b.phone, ''),
		       COALESCE(b.landline_phone, ''),
		       COALESCE(b.public_email, ''),
		       COALESCE(b.instagram_handle, ''),
		       COALESCE(b.city, ''),
		       COALESCE(b.district, ''),
		       COALESCE(b.location_address, ''),
		       COALESCE(b.export_countries, ''),
		       COALESCE(b.min_order_quantity, 1),
		       COALESCE(b.supports_private_label, false),
		       COALESCE(b.supports_fason, false),
		       COALESCE(b.is_verified, true),
		       COALESCE(b.whatsapp_only_ordering, false),
		       (SELECT COUNT(*)::int FROM catalog.products p WHERE p.brand_id = b.id AND p.is_active = true) AS active_product_count,
		       COALESCE(b.addresses, '[]'::jsonb)
		FROM catalog.brands b
		WHERE b.is_active = true
		  AND EXISTS (SELECT 1 FROM catalog.products p WHERE p.brand_id = b.id AND p.is_active = true)
		ORDER BY b.brand_name ASC
	`)
	if err != nil {
		return brands
	}
	defer rows.Close()
	for rows.Next() {
		var (
			id, displayName, slug, companyType, description, website     string
			whatsappPhone, phone, landlinePhone, publicEmail, instagramHandle string
			brandCity, brandDistrict, locationAddress, exportCountries   string
			minOrderQty, activeProductCount                              int
			supportsPrivateLabel, supportsFason, isVerified, whatsappOnlyOrdering bool
			descTransBytes, addressesBytes                               []byte
		)
		if err := rows.Scan(
			&id, &displayName, &slug, &companyType, &description, &descTransBytes,
			&website, &whatsappPhone, &phone, &landlinePhone, &publicEmail, &instagramHandle,
			&brandCity, &brandDistrict, &locationAddress, &exportCountries, &minOrderQty,
			&supportsPrivateLabel, &supportsFason, &isVerified, &whatsappOnlyOrdering,
			&activeProductCount, &addressesBytes,
		); err != nil {
			continue
		}

		var descTranslations map[string]string
		if len(descTransBytes) > 0 {
			_ = json.Unmarshal(descTransBytes, &descTranslations)
		}
		var addresses []map[string]any
		if len(addressesBytes) > 0 {
			_ = json.Unmarshal(addressesBytes, &addresses)
		}

		effectiveCity := strings.TrimSpace(brandCity)
		if effectiveCity == "" {
			effectiveCity = extractBrandCity(locationAddress, addresses)
		}

		brands = append(brands, map[string]any{
			"id":                       id,
			"name":                     displayName,
			"slug":                     slug,
			"logo_url":                 "",
			"city":                     effectiveCity,
			"district":                 strings.TrimSpace(brandDistrict),
			"company_type":             companyType,
			"description":              description,
			"description_translations": descTranslations,
			"website":                  website,
			"whatsapp_phone":           whatsappPhone,
			"phone":                    phone,
			"landline_phone":           landlinePhone,
			"public_email":             publicEmail,
			"instagram_handle":         instagramHandle,
			"location_address":         locationAddress,
			"export_countries":         exportCountries,
			"min_order_qty":            minOrderQty,
			"min_order_quantity":       minOrderQty,
			"supports_private_label":   supportsPrivateLabel,
			"supports_fason":           supportsFason,
			"is_verified":              isVerified,
			"whatsapp_only_ordering":   whatsappOnlyOrdering,
			"product_count":            activeProductCount,
			"active_product_count":     activeProductCount,
			"addresses":                addresses,
		})
	}
	return brands
}

const mobileCatalogSelectPrefix = `
	SELECT p.id, p.feed_id, p.source_product_id, p.source_product_group_id, p.title, p.slug, p.slug_id, p.custom_sku,
	       p.short_description, p.description, p.brand_id, p.category_id,
	       p.gender, p.season, p.kumas_fabric, p.desi_volume, p.shipping_weight_kg,
	       p.packing_ratio, p.series_ratio, p.minimum_order_quantity,
	       p.price, p.discounted_price, p.single_price, p.buying_price, p.currency, p.tax_rate, p.color, p.stock, p.sku, p.barcode,
	       p.is_active,
	       p.created_at, p.updated_at, p.brand_name, p.category_title,
	       p.images_json, p.translations_json
	FROM catalog.mv_products p
	WHERE p.is_active = true
`

func fetchBootstrapProducts(ctx context.Context, orderAndLimit string) []*models.Product {
	rows, err := db.Pool.Query(ctx, mobileCatalogSelectPrefix+" "+orderAndLimit)
	if err != nil {
		return []*models.Product{}
	}
	defer rows.Close()
	prods, err := scanCatalogProducts(rows)
	if err != nil {
		return []*models.Product{}
	}
	fetchCatalogBrandProfiles(ctx, prods)
	return prods
}

