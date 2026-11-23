package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/safe"
	"mertervitrini/backend/services"
)

var supplierSkuIndexOnce sync.Once

func ensureSupplierSkuUniqueIndex(ctx context.Context) {
	if db.Pool == nil {
		return
	}
	supplierSkuIndexOnce.Do(func() {
		_, _ = db.Pool.Exec(ctx, `
			CREATE UNIQUE INDEX IF NOT EXISTS uq_products_brand_manual_supplier_sku
			ON catalog.products (brand_id, UPPER(BTRIM(sku)))
			WHERE feed_id IS NULL
			  AND brand_id IS NOT NULL
			  AND sku IS NOT NULL
			  AND BTRIM(sku) <> ''
			  AND COALESCE(is_archived, false) = false;

			CREATE INDEX IF NOT EXISTS idx_products_brand_supplier_sku_lookup
			ON catalog.products (brand_id, UPPER(BTRIM(sku)))
			WHERE brand_id IS NOT NULL AND sku IS NOT NULL AND BTRIM(sku) <> '';
		`)
	})
}

func normalizeSupplierSKU(raw string) string {
	cleaned := strings.TrimSpace(raw)
	if cleaned == "" {
		return ""
	}
	if utf8.RuneCountInString(cleaned) > 100 {
		cleaned = string([]rune(cleaned)[:100])
	}
	return cleaned
}

func resolveSupplierInputSKU(req *models.SupplierProductInput) (string, bool) {
	if req == nil {
		return "", false
	}
	if req.SupplierSKU != nil {
		return normalizeSupplierSKU(*req.SupplierSKU), true
	}
	if req.SKU != nil {
		return normalizeSupplierSKU(*req.SKU), true
	}
	return "", false
}

func isUniqueViolationErr(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func ensureUniqueSupplierProductSKUOrWriteErr(w http.ResponseWriter, ctx context.Context, tx pgx.Tx, brandID, supplierSKU, excludeID string) bool {
	if supplierSKU == "" {
		return true
	}
	var conflictCustomSKU string
	err := tx.QueryRow(ctx, `
		SELECT custom_sku
		FROM catalog.products
		WHERE brand_id = $1
		  AND UPPER(BTRIM(sku)) = UPPER($2)
		  AND COALESCE(is_archived, false) = false
		  AND ($3 = '' OR id::text <> $3)
		LIMIT 1
	`, brandID, supplierSKU, excludeID).Scan(&conflictCustomSKU)
	if errors.Is(err, pgx.ErrNoRows) {
		return true
	}
	if err != nil {
		log.Printf("[SUPPLIER SKU CHECK] Query error: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "Ürün kodu benzersizliği kontrol edilemedi")
		return false
	}
	httpx.Error(w, http.StatusConflict, fmt.Sprintf("Bu ürün/model kodu (%s) mağazanızda zaten başka bir üründe (%s) kayıtlı.", supplierSKU, conflictCustomSKU))
	return false
}

func writeSupplierJSON(w http.ResponseWriter, status int, data any) {
	httpx.JSON(w, status, data)
}

func triggerProductMVRefresh() {
	safe.Go("Supplier MV Refresh", func() {
		bgCtx, bgCancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer bgCancel()
		if err := refreshCatalogMV(bgCtx); err != nil {
			log.Printf("[SUPPLIER PORTAL] Async MV refresh error: %v", err)
		}
	})
}

func resolveActiveProductIDsBySlugs(ctx context.Context, slugs []string) []string {
	cleanSlugs := dedupeNonEmptyStrings(slugs)
	if db.Pool == nil || len(cleanSlugs) == 0 {
		return nil
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT id::text
		FROM catalog.products
		WHERE slug = ANY($1)
		  AND is_active = true
		  AND COALESCE(is_archived, false) = false`, cleanSlugs)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if scanErr := rows.Scan(&id); scanErr == nil && strings.TrimSpace(id) != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

func submitTranslationReadyProductsToIndexNow(ctx context.Context, productIDs []string, meta IndexNowSubmissionMeta) {
	readyRefs, readyErr := filterTranslationCompleteProductRefs(ctx, productIDs)
	if readyErr != nil {
		log.Printf("[SUPPLIER PORTAL] Ready check error: %v", readyErr)
		return
	}
	if len(readyRefs) == 0 {
		log.Printf("[SUPPLIER PORTAL] IndexNow deferred until all target translations finish (products=%d)", len(productIDs))
		return
	}

	readyIDs, readySlugs := extractProductRefIDsAndSlugs(readyRefs)
	urls, productCount := BuildProductIndexNowURLs(readySlugs)
	if len(urls) == 0 {
		return
	}
	if meta.ProductCount <= 0 {
		meta.ProductCount = productCount
	}

	entry, submitErr := SubmitIndexNowSync(ctx, meta, urls)
	if submitErr != nil {
		log.Printf("[SUPPLIER PORTAL] IndexNow submission error: %v", submitErr)
		return
	}
	if entry != nil && entry.Status == "success" {
		if markErr := markProductsIndexNowNotified(ctx, readyIDs); markErr != nil {
			log.Printf("[SUPPLIER PORTAL] Failed to mark notified products: %v", markErr)
		}
	}
}

func runProductMVRefreshAndIndexNow(ctx context.Context, slugs []string, meta IndexNowSubmissionMeta) {
	productIDs := resolveActiveProductIDsBySlugs(ctx, slugs)
	if len(productIDs) > 0 {
		if _, trErr := AutoTranslateProductsByIDs(ctx, productIDs); trErr != nil {
			log.Printf("[SUPPLIER PORTAL] Pre-IndexNow auto-translation warning: %v", trErr)
		}
	}

	if err := refreshCatalogMV(ctx); err != nil {
		log.Printf("[SUPPLIER PORTAL] Async MV refresh error: %v", err)
	}

	if len(productIDs) > 0 {
		submitTranslationReadyProductsToIndexNow(ctx, productIDs, meta)
	}
}

// triggerProductMVRefreshAndIndexNow auto-translates missing languages first, refreshes catalog.mv_products,
// and submits only translation-complete active slugs to IndexNow.
func triggerProductMVRefreshAndIndexNow(slugs []string, meta IndexNowSubmissionMeta) {
	slugsCopy := append([]string(nil), slugs...)
	safe.Go("Supplier Auto-Translate, MV Refresh & IndexNow", func() {
		bgCtx, bgCancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer bgCancel()
		runProductMVRefreshAndIndexNow(bgCtx, slugsCopy, meta)
	})
}

func parseSupplierPagination(r *http.Request) (int, int) {
	limit := 24
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	return limit, offset
}

func buildProductFilterConditions(brandID, q, categoryID, status string) ([]string, []any, int) {
	conditions := []string{"p.brand_id = $1"}
	args := []any{brandID}
	argIdx := 2

	if q != "" {
		conditions = append(conditions, fmt.Sprintf("(p.title ILIKE $%d OR p.custom_sku ILIKE $%d OR p.sku ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+q+"%")
		argIdx++
	}

	if categoryID != "" {
		conditions = append(conditions, fmt.Sprintf("p.category_id = $%d", argIdx))
		args = append(args, categoryID)
		argIdx++
	}

	switch status {
	case "active":
		conditions = append(conditions, "p.is_active = true AND COALESCE(p.is_archived, false) = false")
	case "passive", "draft":
		conditions = append(conditions, "p.is_active = false AND COALESCE(p.is_archived, false) = false")
	case "archived":
		conditions = append(conditions, "COALESCE(p.is_archived, false) = true")
	default:
		conditions = append(conditions, "COALESCE(p.is_archived, false) = false")
	}

	return conditions, args, argIdx
}

func insertProductVariants(ctx context.Context, tx pgx.Tx, productID, sourceProductID string, variants []models.SupplierProductVariantInput, fallbackStock int) {
	if len(variants) > 0 {
		for _, v := range variants {
			vSize := strings.TrimSpace(v.Size)
			if vSize == "" {
				vSize = "STD"
			}
			sourceVarID := fmt.Sprintf("%s-%s", sourceProductID, vSize)
			_, _ = tx.Exec(ctx, `
				INSERT INTO catalog.product_variants (
					product_id, variant_size, barcode, stock, is_single, source_variant_id, is_active
				) VALUES ($1, $2, $3, $4, $5, $6, true)
				ON CONFLICT (product_id, source_variant_id) DO NOTHING`,
				productID, vSize, v.Barcode, v.Stock, v.IsSingle, sourceVarID)
		}
		return
	}

	sourceVarID := fmt.Sprintf("%s-STD", sourceProductID)
	_, _ = tx.Exec(ctx, `
		INSERT INTO catalog.product_variants (
			product_id, variant_size, barcode, stock, is_single, source_variant_id, is_active
		) VALUES ($1, 'STANDART', '', $2, false, $3, true)`,
		productID, fallbackStock, sourceVarID)
}

func insertProductImages(ctx context.Context, tx pgx.Tx, productID string, images []string) {
	for idx, imgUrl := range images {
		imgUrl = strings.TrimSpace(imgUrl)
		if imgUrl == "" {
			continue
		}
		isCover := (idx == 0)
		_, _ = tx.Exec(ctx, `
			INSERT INTO catalog.product_images (product_id, image_url, sort_order, is_cover)
			VALUES ($1, $2, $3, $4)`,
			productID, imgUrl, idx, isCover)
	}
}

func updateProductVariants(ctx context.Context, tx pgx.Tx, productID string, variants []models.SupplierProductVariantInput) {
	if len(variants) == 0 {
		return
	}
	_, _ = tx.Exec(ctx, "DELETE FROM catalog.product_variants WHERE product_id = $1", productID)
	for _, v := range variants {
		vSize := strings.TrimSpace(v.Size)
		if vSize == "" {
			vSize = "STD"
		}
		sourceVarID := fmt.Sprintf("%s-%s", productID, vSize)
		_, _ = tx.Exec(ctx, `
			INSERT INTO catalog.product_variants (
				product_id, variant_size, barcode, stock, is_single, source_variant_id, is_active
			) VALUES ($1, $2, $3, $4, $5, $6, true)`,
			productID, vSize, v.Barcode, v.Stock, v.IsSingle, sourceVarID)
	}
}

func updateProductImages(ctx context.Context, tx pgx.Tx, productID string, images []string) {
	if len(images) == 0 {
		return
	}
	_, _ = tx.Exec(ctx, "DELETE FROM catalog.product_images WHERE product_id = $1", productID)
	for idx, imgUrl := range images {
		imgUrl = strings.TrimSpace(imgUrl)
		if imgUrl == "" {
			continue
		}
		isCover := (idx == 0)
		_, _ = tx.Exec(ctx, `
			INSERT INTO catalog.product_images (product_id, image_url, sort_order, is_cover)
			VALUES ($1, $2, $3, $4)`,
			productID, imgUrl, idx, isCover)
	}
}

type SupplierPortalHandler struct {
	Cfg      *config.Config
	Media    services.MediaProcessor
	Notifier services.NotificationDispatcher
}

func NewSupplierPortalHandler(cfg *config.Config, mediaProcessors ...services.MediaProcessor) *SupplierPortalHandler {
	var media services.MediaProcessor
	if len(mediaProcessors) > 0 && mediaProcessors[0] != nil {
		media = mediaProcessors[0]
	} else {
		media = services.NewLocalImageMediaService("")
	}
	return &SupplierPortalHandler{Cfg: cfg, Media: media}
}

// SetNotifier injects the NotificationDispatcher used for favorite-supplier product alerts.
func (h *SupplierPortalHandler) SetNotifier(n services.NotificationDispatcher) {
	if h != nil {
		h.Notifier = n
	}
}

func issueLocalSupplierJWT(jwtSecret string, u *models.SupplierUser) string {
	if jwtSecret == "" || u == nil {
		return ""
	}
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":          u.ID,
		"brand_id":     u.BrandID,
		"brand_name":   u.BrandName,
		"alias_code":   u.AliasCode,
		"email":        u.Email,
		"contact_name": u.ContactName,
		"is_owner":     u.IsOwner,
		"job_title":    u.JobTitle,
		"role":         "supplier",
		"iat":          now.Unix(),
		"exp":          now.Add(7 * 24 * time.Hour).Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(jwtSecret))
	if err != nil {
		return ""
	}
	return signed
}

// attemptLegacySupplierMigration provisions legacy bcrypt users into Keycloak on first login, falling back to local HS256 JWT
func (h *SupplierPortalHandler) attemptLegacySupplierMigration(ctx context.Context, u *models.SupplierUser, passwordHash *string, password string) string {
	if passwordHash == nil || *passwordHash == "" {
		return ""
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*passwordHash), []byte(password)); err != nil {
		return ""
	}

	phoneStr := ""
	if u.Phone != nil {
		phoneStr = *u.Phone
	}

	newKCID, err := createKeycloakSupplierUser(ctx, h.Cfg, u.Email, u.ContactName, password, phoneStr, u.BrandID)
	if err == nil && newKCID != "" {
		u.KeycloakID = &newKCID
		_, _ = db.Pool.Exec(ctx, "UPDATE catalog.supplier_users SET keycloak_id = $1 WHERE id = $2", newKCID, u.ID)
		if kcToken, kcErr := loginKeycloakUser(ctx, h.Cfg, u.Email, password); kcErr == nil && kcToken != "" {
			return kcToken
		}
	}

	return issueLocalSupplierJWT(h.Cfg.JWTSecret, u)
}

// Login authenticates a supplier user with email and password via Keycloak (with legacy/sub-user fallback)
func (h *SupplierPortalHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.SupplierLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek formatı"}`, http.StatusBadRequest)
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		http.Error(w, `{"error":"E-posta ve şifre zorunludur"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	u, passwordHash, brandActive, err := lookupSupplierUserByEmail(ctx, email)
	if err != nil {
		http.Error(w, `{"error":"E-posta veya şifre hatalı"}`, http.StatusUnauthorized)
		return
	}

	if !u.IsActive {
		http.Error(w, `{"error":"Tedarikçi hesabınız askıya alınmıştır. Lütfen yönetici ile iletişime geçin."}`, http.StatusForbidden)
		return
	}

	if !brandActive {
		http.Error(w, `{"error":"Bağlı olduğunuz tedarikçi firma pasif durumdadır."}`, http.StatusForbidden)
		return
	}

	// 1. Try Keycloak Direct Access Grant authentication first
	tokenString, kcErr := loginKeycloakUser(ctx, h.Cfg, email, req.Password)
	if kcErr != nil {
		tokenString = h.attemptLegacySupplierMigration(ctx, u, passwordHash, req.Password)
	}

	// If tokenString is still empty, authentication has failed
	if tokenString == "" {
		http.Error(w, `{"error":"E-posta veya şifre hatalı"}`, http.StatusUnauthorized)
		return
	}

	// Update last_login_at and record login session audit
	_, _ = db.Pool.Exec(ctx, "UPDATE catalog.supplier_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1", u.ID)
	loginSessType := AuditActorSupplierSubUser
	if u.IsOwner {
		loginSessType = AuditActorSupplierOwner
	}
	recordSupplierSessionLogAsync(r, supplierSessionLogInput{
		SessionType:         loginSessType,
		BrandID:             u.BrandID,
		BrandName:           u.BrandName,
		SupplierUserID:      u.ID,
		SupplierEmail:       u.Email,
		SupplierContactName: u.ContactName,
		SupplierIsOwner:     u.IsOwner,
		SupplierJobTitle:    u.JobTitle,
	})

	writeSupplierJSON(w, http.StatusOK, models.SupplierLoginResponse{
		Token: tokenString,
		User:  u,
	})
}

func lookupSupplierUserByEmail(ctx context.Context, email string) (*models.SupplierUser, *string, bool, error) {
	var u models.SupplierUser
	var passwordHash *string
	var brandActive bool

	query := `
		SELECT 
			u.id, 
			u.brand_id, 
			b.brand_name, 
			coalesce(b.alias_code, '') as alias_code,
			u.email, 
			u.password_hash, 
			u.contact_name, 
			u.phone, 
			coalesce(u.job_title, 'Firma Yetkilisi'),
			coalesce(u.spoken_languages, 'TR'),
			coalesce(u.is_owner, true),
			u.keycloak_id,
			u.is_active, 
			b.is_active as brand_active,
			u.created_at, 
			u.updated_at
		FROM catalog.supplier_users u
		JOIN catalog.brands b ON u.brand_id = b.id
		WHERE lower(u.email) = $1`

	err := db.Pool.QueryRow(ctx, query, email).Scan(
		&u.ID,
		&u.BrandID,
		&u.BrandName,
		&u.AliasCode,
		&u.Email,
		&passwordHash,
		&u.ContactName,
		&u.Phone,
		&u.JobTitle,
		&u.SpokenLanguages,
		&u.IsOwner,
		&u.KeycloakID,
		&u.IsActive,
		&brandActive,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		return nil, nil, false, err
	}
	return &u, passwordHash, brandActive, nil
}

// GetProfile returns logged-in supplier info, open company profile, and dashboard statistics
func (h *SupplierPortalHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	ensureProductArchiveSchema(ctx)

	var totalProducts, activeProducts, draftProducts, totalStock, totalVariants, totalOrders int
	statsQuery := `
		SELECT 
			count(DISTINCT p.id),
			count(DISTINCT p.id) FILTER (WHERE p.is_active = true),
			count(DISTINCT p.id) FILTER (WHERE p.is_active = false AND COALESCE(p.is_archived, false) = false),
			coalesce(sum(v.stock), 0),
			count(v.id)
		FROM catalog.products p
		LEFT JOIN catalog.product_variants v ON p.id = v.product_id
		WHERE p.brand_id = $1`

	_ = db.Pool.QueryRow(ctx, statsQuery, claims.BrandID).Scan(&totalProducts, &activeProducts, &draftProducts, &totalStock, &totalVariants)
	_ = db.Pool.QueryRow(ctx, `SELECT count(*) FROM catalog.supplier_sub_orders WHERE brand_id = $1`, claims.BrandID).Scan(&totalOrders)

	var brandProfile models.Brand
	var descTransJSON, addressesBytes []byte
	brandQuery := `
		SELECT 
			b.id, b.brand_name, b.slug, b.alias_code,
			coalesce(b.subdomain, ''), coalesce(b.subdomain_enabled, true),
			coalesce(b.company_type, 'uretici_toptanci'),
			coalesce(b.description, ''),
			coalesce(b.description_translations, '{}'::jsonb),
			b.website, b.phone,
			coalesce(b.landline_phone, ''),
			coalesce(
				nullif(b.whatsapp_phone, ''),
				nullif(b.phone, ''),
				(SELECT coalesce(nullif(su.phone, ''), '') FROM catalog.supplier_users su WHERE su.brand_id = b.id AND su.phone IS NOT NULL AND su.phone <> '' ORDER BY su.is_owner DESC, su.created_at ASC LIMIT 1),
				''
			),
			coalesce(b.public_email, ''),
			coalesce(b.instagram_handle, ''),
			coalesce(b.city, ''),
			coalesce(b.district, ''),
			coalesce(b.location_address, ''),
			coalesce(b.export_countries, ''),
			coalesce(b.min_order_quantity, 1),
			coalesce(b.supports_private_label, false),
			coalesce(b.supports_fason, false),
			coalesce(b.is_verified, true),
			coalesce(b.whatsapp_only_ordering, false),
			coalesce(b.bank_name, ''),
			coalesce(b.bank_account_holder, ''),
			coalesce(b.iban, ''),
			coalesce(b.addresses, '[]'::jsonb),
			b.is_active, b.created_at, b.updated_at
		FROM catalog.brands b
		WHERE b.id = $1`
	_ = db.Pool.QueryRow(ctx, brandQuery, claims.BrandID).Scan(
		&brandProfile.ID, &brandProfile.Name, &brandProfile.Slug, &brandProfile.AliasCode,
		&brandProfile.Subdomain, &brandProfile.SubdomainEnabled,
		&brandProfile.CompanyType, &brandProfile.Description, &descTransJSON,
		&brandProfile.Website, &brandProfile.Phone, &brandProfile.LandlinePhone,
		&brandProfile.WhatsappPhone, &brandProfile.PublicEmail, &brandProfile.InstagramHandle,
		&brandProfile.City, &brandProfile.District, &brandProfile.LocationAddress,
		&brandProfile.ExportCountries, &brandProfile.MinOrderQuantity,
		&brandProfile.SupportsPrivateLabel, &brandProfile.SupportsFason, &brandProfile.IsVerified,
		&brandProfile.WhatsappOnlyOrdering,
		&brandProfile.BankName, &brandProfile.BankAccountHolder, &brandProfile.IBAN,
		&addressesBytes,
		&brandProfile.IsActive, &brandProfile.CreatedAt, &brandProfile.UpdatedAt,
	)
	if len(addressesBytes) > 0 {
		_ = json.Unmarshal(addressesBytes, &brandProfile.Addresses)
	}
	brandProfile.DescriptionTranslations = make(map[string]string)
	if len(descTransJSON) > 0 {
		_ = json.Unmarshal(descTransJSON, &brandProfile.DescriptionTranslations)
	}
	if brandProfile.DescriptionTranslations["tr"] == "" && brandProfile.Description != "" {
		brandProfile.DescriptionTranslations["tr"] = brandProfile.Description
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"user":          claims,
		"brand_profile": brandProfile,
		"stats": map[string]int{
			"total_products":  totalProducts,
			"active_products": activeProducts,
			"draft_products":  draftProducts,
			"total_stock":     totalStock,
			"total_variants":  totalVariants,
			"total_orders":    totalOrders,
		},
	})
}

type UpdateSupplierBrandProfileRequest struct {
	BrandName               string            `json:"brand_name"`
	Subdomain               *string           `json:"subdomain,omitempty"`
	CompanyType             string            `json:"company_type"`
	Description             string            `json:"description"`
	DescriptionTranslations map[string]string `json:"description_translations,omitempty"`
	Phone                   string            `json:"phone"`
	LandlinePhone           *string           `json:"landline_phone,omitempty"`
	WhatsappPhone           string            `json:"whatsapp_phone"`
	PublicEmail             string            `json:"public_email"`
	Website                 string            `json:"website"`
	InstagramHandle         string            `json:"instagram_handle"`
	City                    *string           `json:"city,omitempty"`
	District                *string           `json:"district,omitempty"`
	LocationAddress         string            `json:"location_address"`
	Addresses               []any             `json:"addresses,omitempty"`
	ExportCountries         string            `json:"export_countries"`
	MinOrderQuantity        int               `json:"min_order_quantity"`
	SupportsPrivateLabel    bool              `json:"supports_private_label"`
	SupportsFason           bool              `json:"supports_fason"`
	BankName                string            `json:"bank_name"`
	BankAccountHolder       string            `json:"bank_account_holder"`
	IBAN                    string            `json:"iban"`
	WhatsappOnlyOrdering    *bool             `json:"whatsapp_only_ordering,omitempty"`
	QuickWhatsappOnly       bool              `json:"quick_whatsapp_only"`
}

func handleQuickWhatsappUpdate(ctx context.Context, w http.ResponseWriter, brandID, rawWhatsapp string) {
	waTrim := strings.TrimSpace(rawWhatsapp)
	_, err := db.Pool.Exec(ctx, `
		UPDATE catalog.brands
		SET whatsapp_phone = $1,
		    phone = CASE WHEN phone IS NULL OR phone = '' THEN $1 ELSE phone END,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`, waTrim, brandID)
	if err != nil {
		log.Printf("[SUPPLIER PORTAL] QuickWhatsappOnly error: %v", err)
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "WhatsApp numarası güncellenemedi."})
		return
	}
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"whatsapp_phone": waTrim,
		"message":        "Doğrudan sipariş WhatsApp hattınız başarıyla kaydedildi.",
	})
}

func isSupportedBrandLang(lang string) bool {
	return lang == "tr" || lang == "en" || lang == "ru" || lang == "ar"
}

func prepareBrandDescriptionTranslations(desc string, rawTrans map[string]string) (string, []byte) {
	descTrim := strings.TrimSpace(desc)
	descMap := make(map[string]string)
	for k, v := range rawTrans {
		lang := strings.ToLower(strings.TrimSpace(k))
		if isSupportedBrandLang(lang) {
			descMap[lang] = strings.TrimSpace(v)
		}
	}
	if descTrim == "" {
		descTrim = descMap["tr"]
	} else {
		descMap["tr"] = descTrim
	}
	descTransBytes, _ := json.Marshal(descMap)
	return descTrim, descTransBytes
}

func getOptionalContactPointers(website, phone, whatsapp string) (*string, *string) {
	websitePtr := normalizeBrandWebsite(website)
	var phonePtr *string
	pStr := strings.TrimSpace(phone)
	if pStr == "" {
		pStr = strings.TrimSpace(whatsapp)
	}
	if pStr != "" {
		phonePtr = &pStr
	}
	return websitePtr, phonePtr
}

func syncSupplierWalletIBAN(ctx context.Context, brandID, ibanClean, bankName, bankHolder string) {
	if ibanClean == "" && strings.TrimSpace(bankName) == "" {
		return
	}
	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO catalog.supplier_wallets (brand_id, iban, bank_name, bank_account_holder, commission_rate)
		VALUES ($1, $2, $3, $4, 0.00)
		ON CONFLICT (brand_id) DO UPDATE SET
			iban = EXCLUDED.iban,
			bank_name = EXCLUDED.bank_name,
			bank_account_holder = EXCLUDED.bank_account_holder,
			updated_at = CURRENT_TIMESTAMP`,
		brandID, ibanClean, strings.TrimSpace(bankName), strings.TrimSpace(bankHolder),
	)
}

// UpdateProfile allows a supplier to update their own open company profile, contact channels, capabilities, and direct payment IBAN
func (h *SupplierPortalHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	var req UpdateSupplierBrandProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek formatı."})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if req.QuickWhatsappOnly {
		handleQuickWhatsappUpdate(ctx, w, claims.BrandID, req.WhatsappPhone)
		return
	}

	brandName := strings.TrimSpace(req.BrandName)
	if brandName == "" {
		brandName = claims.BrandName
	}
	companyType := strings.TrimSpace(req.CompanyType)
	if companyType == "" {
		companyType = "uretici_toptanci"
	}
	minOrderQty := req.MinOrderQuantity
	if minOrderQty < 1 {
		minOrderQty = 1
	}
	ibanClean := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(req.IBAN), " ", ""))

	websitePtr, phonePtr := getOptionalContactPointers(req.Website, req.Phone, req.WhatsappPhone)
	descTrim, descTransBytes := prepareBrandDescriptionTranslations(req.Description, req.DescriptionTranslations)
	landlinePtr := normalizeOptionalStringPtr(req.LandlinePhone, 50)
	cityPtr := normalizeOptionalStringPtr(req.City, 100)
	districtPtr := normalizeOptionalStringPtr(req.District, 100)
	instagramClean := normalizeBrandInstagramHandle(req.InstagramHandle)

	var addressesJSONPtr *string
	if req.Addresses != nil {
		if addrBytes, marshalErr := json.Marshal(req.Addresses); marshalErr == nil {
			addrStr := string(addrBytes)
			addressesJSONPtr = &addrStr
		}
	}

	updateSubdomain := false
	subdomainVal := ""
	if req.Subdomain != nil {
		var subEnabled bool
		_ = db.Pool.QueryRow(ctx, `SELECT COALESCE(subdomain_enabled, true) FROM catalog.brands WHERE id = $1`, claims.BrandID).Scan(&subEnabled)
		if !subEnabled {
			writeSupplierJSON(w, http.StatusForbidden, map[string]string{"error": "Özel mağaza subdomain özelliği hesabınızda aktif değil."})
			return
		}
		normSub, valErr := NormalizeAndValidateBrandSubdomain(*req.Subdomain)
		if valErr != nil {
			writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": valErr.Error()})
			return
		}
		updateSubdomain = true
		subdomainVal = normSub
	}

	updateQuery := `
		UPDATE catalog.brands
		SET 
			brand_name = $1,
			subdomain = CASE WHEN $23::boolean THEN NULLIF($24, '') ELSE subdomain END,
			company_type = $2,
			description = $3,
			description_translations = $4::jsonb,
			phone = $5,
			landline_phone = COALESCE($6, landline_phone, ''),
			whatsapp_phone = $7,
			public_email = $8,
			website = $9,
			instagram_handle = $10,
			city = COALESCE($11, city, ''),
			district = COALESCE($12, district, ''),
			location_address = $13,
			addresses = COALESCE($14::jsonb, addresses),
			export_countries = $15,
			min_order_quantity = $16,
			supports_private_label = $17,
			supports_fason = $18,
			bank_name = $19,
			bank_account_holder = $20,
			iban = $21,
			whatsapp_only_ordering = COALESCE($22, whatsapp_only_ordering, false),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $25`

	_, err := db.Pool.Exec(ctx, updateQuery,
		brandName,
		companyType,
		descTrim,
		string(descTransBytes),
		phonePtr,
		landlinePtr,
		strings.TrimSpace(req.WhatsappPhone),
		strings.TrimSpace(req.PublicEmail),
		websitePtr,
		instagramClean,
		cityPtr,
		districtPtr,
		strings.TrimSpace(req.LocationAddress),
		addressesJSONPtr,
		strings.TrimSpace(req.ExportCountries),
		minOrderQty,
		req.SupportsPrivateLabel,
		req.SupportsFason,
		strings.TrimSpace(req.BankName),
		strings.TrimSpace(req.BankAccountHolder),
		ibanClean,
		req.WhatsappOnlyOrdering,
		updateSubdomain,
		subdomainVal,
		claims.BrandID,
	)
	if err != nil {
		if isSubdomainUniqueViolation(err) {
			writeSupplierJSON(w, http.StatusConflict, map[string]string{"error": "Bu alt alan adı (subdomain) başka bir tedarikçi tarafından kullanılıyor."})
			return
		}
		log.Printf("[SUPPLIER PORTAL] UpdateProfile error: %v", err)
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Firma profili güncellenemedi."})
		return
	}

	syncSupplierWalletIBAN(ctx, claims.BrandID, ibanClean, req.BankName, req.BankAccountHolder)
	triggerProductMVRefresh()
	h.GetProfile(w, r)
}

// ListProducts returns products belonging strictly to this supplier
func (h *SupplierPortalHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	categoryID := strings.TrimSpace(r.URL.Query().Get("category_id"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	limit, offset := parseSupplierPagination(r)

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	ensureProductArchiveSchema(ctx)
	ensureSizeDefinitionsSchema(ctx)
	ensureSupplierSiblingSchema(ctx)

	conditions, args, argIdx := buildProductFilterConditions(claims.BrandID, q, categoryID, status)
	whereClause := "WHERE " + strings.Join(conditions, " AND ")

	// Total count query
	var totalCount int
	countQuery := fmt.Sprintf("SELECT count(*) FROM catalog.products p %s", whereClause)
	_ = db.Pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount)

	// Items query
	queryArgs := append(args, limit, offset)
	itemsQuery := fmt.Sprintf(`
		SELECT 
			p.id,
			p.title,
			p.custom_sku,
			coalesce(p.sku, '') as sku,
			coalesce(p.category_id::text, '') as category_id,
			coalesce(c.title, '') as category_title,
			p.color_id::text,
			coalesce(col.color_name, '') as color,
			p.source_product_group_id,
			p.buying_price,
			p.price,
			p.currency,
			p.packing_ratio,
			coalesce(p.series_ratio, '') as series_ratio,
			coalesce(p.series_stock, 100) as series_stock,
			p.minimum_order_quantity,
			p.is_active,
			coalesce(p.is_archived, false) as is_archived,
			coalesce(p.season, '') as season,
			p.created_at,
			p.updated_at,
			coalesce(
				(SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY is_cover DESC, sort_order ASC LIMIT 1),
				''
			) as cover_image,
			coalesce(sum(v.stock), 0) as total_stock,
			count(v.id) as variants_count,
			(SELECT count(*) FROM catalog.products p2
			 WHERE p2.brand_id = p.brand_id
			   AND p2.source_product_group_id IS NOT NULL
			   AND p2.source_product_group_id <> ''
			   AND p2.source_product_group_id = p.source_product_group_id
			   AND p2.id <> p.id
			   AND COALESCE(p2.is_archived, false) = false) as sibling_count
		FROM catalog.products p
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		LEFT JOIN catalog.product_variants v ON p.id = v.product_id
		%s
		GROUP BY p.id, c.title, col.color_name
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d`, whereClause, argIdx, argIdx+1)

	rows, err := db.Pool.Query(ctx, itemsQuery, queryArgs...)
	if err != nil {
		log.Printf("[SUPPLIER PRODUCTS] List error: %v", err)
		http.Error(w, `{"error":"Ürünler yüklenemedi"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ProductRow struct {
		ID                   string    `json:"id"`
		Title                string    `json:"title"`
		CustomSKU            string    `json:"custom_sku"`
		SKU                  string    `json:"sku,omitempty"`
		CategoryID           string    `json:"category_id"`
		CategoryTitle        string    `json:"category_title"`
		ColorID              *string   `json:"color_id,omitempty"`
		Color                string    `json:"color,omitempty"`
		SourceProductGroupID *string   `json:"source_product_group_id,omitempty"`
		BuyingPrice          float64   `json:"buying_price"`
		Price                float64   `json:"price"`
		Currency             string    `json:"currency"`
		PackingRatio         *string   `json:"packing_ratio,omitempty"`
		SeriesRatio          string    `json:"series_ratio,omitempty"`
		SeriesStock          int       `json:"series_stock"`
		MinimumOrderQuantity int       `json:"minimum_order_quantity"`
		IsActive             bool      `json:"is_active"`
		IsArchived           bool      `json:"is_archived"`
		Season               string    `json:"season,omitempty"`
		CreatedAt            time.Time `json:"created_at"`
		UpdatedAt            time.Time `json:"updated_at"`
		CoverImage           string    `json:"cover_image"`
		TotalStock           int       `json:"total_stock"`
		VariantsCount        int       `json:"variants_count"`
		SiblingCount         int       `json:"sibling_count"`
	}

	products := make([]ProductRow, 0)
	for rows.Next() {
		var pr ProductRow
		if err := rows.Scan(
			&pr.ID,
			&pr.Title,
			&pr.CustomSKU,
			&pr.SKU,
			&pr.CategoryID,
			&pr.CategoryTitle,
			&pr.ColorID,
			&pr.Color,
			&pr.SourceProductGroupID,
			&pr.BuyingPrice,
			&pr.Price,
			&pr.Currency,
			&pr.PackingRatio,
			&pr.SeriesRatio,
			&pr.SeriesStock,
			&pr.MinimumOrderQuantity,
			&pr.IsActive,
			&pr.IsArchived,
			&pr.Season,
			&pr.CreatedAt,
			&pr.UpdatedAt,
			&pr.CoverImage,
			&pr.TotalStock,
			&pr.VariantsCount,
			&pr.SiblingCount,
		); err != nil {
			log.Printf("[SUPPLIER PRODUCTS] Scan error: %v", err)
			continue
		}
		products = append(products, pr)
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"products": products,
		"total":    totalCount,
		"limit":    limit,
		"offset":   offset,
	})
}

func loadSupplierProductVariants(ctx context.Context, productID string) []*models.ProductVariant {
	variants := make([]*models.ProductVariant, 0)
	vRows, err := db.Pool.Query(
		ctx,
		"SELECT id, product_id, variant_size, barcode, stock, is_single, custom_sku, is_active FROM catalog.product_variants WHERE product_id = $1 ORDER BY id ASC",
		productID,
	)
	if err != nil {
		return variants
	}
	defer vRows.Close()

	for vRows.Next() {
		var v models.ProductVariant
		if scanErr := vRows.Scan(&v.ID, &v.ProductID, &v.Size, &v.Barcode, &v.Stock, &v.IsSingle, &v.CustomSku, &v.IsActive); scanErr == nil {
			variants = append(variants, &v)
		}
	}
	return variants
}

func loadSupplierProductImages(ctx context.Context, productID string) []*models.ProductImage {
	images := make([]*models.ProductImage, 0)
	iRows, err := db.Pool.Query(
		ctx,
		"SELECT id, product_id, image_url, sort_order, is_cover FROM catalog.product_images WHERE product_id = $1 ORDER BY is_cover DESC, sort_order ASC",
		productID,
	)
	if err != nil {
		return images
	}
	defer iRows.Close()

	for iRows.Next() {
		var img models.ProductImage
		if scanErr := iRows.Scan(&img.ID, &img.ProductID, &img.ImageUrl, &img.SortOrder, &img.IsCover); scanErr == nil {
			images = append(images, &img)
		}
	}
	return images
}

// GetProduct returns full product details with variants and images
func (h *SupplierPortalHandler) GetProduct(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, errJSONMissingID, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	ensureSizeDefinitionsSchema(ctx)

	var p models.Product
	query := `
		SELECT 
			id, title, slug, custom_sku, sku, source_product_group_id, short_description, description, 
			category_id, color_id, fabric_id, gender, season, 
			buying_price, price, currency, packing_ratio, series_ratio, 
			coalesce(series_stock, 100), minimum_order_quantity, is_active, created_at, updated_at
		FROM catalog.products 
		WHERE id = $1 AND brand_id = $2`

	var colorID, fabricID *string
	var buyingPrice, price float64
	var minOrderQty int
	err := db.Pool.QueryRow(ctx, query, id, claims.BrandID).Scan(
		&p.ID,
		&p.Title,
		&p.Slug,
		&p.CustomSku,
		&p.Sku,
		&p.SourceProductGroupID,
		&p.ShortDescription,
		&p.Description,
		&p.CategoryID,
		&colorID,
		&fabricID,
		&p.Gender,
		&p.Season,
		&buyingPrice,
		&price,
		&p.Currency,
		&p.PackingRatio,
		&p.SeriesRatio,
		&p.SeriesStock,
		&minOrderQty,
		&p.IsActive,
		&p.CreatedAt,
		&p.UpdatedAt,
	)
	p.ColorID = colorID
	p.FabricID = fabricID
	p.BuyingPrice = &buyingPrice
	p.Price = price
	p.MinimumOrderQty = minOrderQty
	if err != nil {
		http.Error(w, `{"error":"Ürün bulunamadı veya bu ürüne erişim yetkiniz yok"}`, http.StatusNotFound)
		return
	}

	// Fetch variants in natural insertion order (UUIDv7 ordered) & product images
	p.Variants = loadSupplierProductVariants(ctx, p.ID)
	p.Images = loadSupplierProductImages(ctx, p.ID)

	// Fetch multi-language translations (tr, en, ru, ar)
	p.Translations = loadSupplierProductTranslations(ctx, p.ID, p.Title, p.ShortDescription, p.Description)
	if p.SourceProductGroupID != nil && strings.TrimSpace(*p.SourceProductGroupID) != "" {
		supSiblings, colorVars := fetchSupplierSiblings(ctx, claims.BrandID, p.ID, strings.TrimSpace(*p.SourceProductGroupID))
		p.SupplierSiblings = supSiblings
		p.ColorVariants = colorVars
	}

	writeSupplierJSON(w, http.StatusOK, p)
}

func buildSupplierInsertParams(brandID, sourceProductID string, groupID *string, req *models.SupplierProductInput, initialStock int) supplierProductInsertParams {
	supplierSKU, _ := resolveSupplierInputSKU(req)
	return supplierProductInsertParams{
		BrandID:              brandID,
		SourceProductID:      sourceProductID,
		SourceProductGroupID: groupID,
		SupplierSKU:          supplierSKU,
		Title:                req.Title,
		ShortDescription:     req.ShortDescription,
		Description:          req.Description,
		CategoryID:           req.CategoryID,
		ColorID:              req.ColorID,
		FabricID:             req.FabricID,
		Gender:               req.Gender,
		Season:               req.Season,
		BuyingPrice:          req.BuyingPrice,
		Price:                req.Price,
		Currency:             req.Currency,
		PackingRatio:         req.PackingRatio,
		SeriesRatio:          req.SeriesRatio,
		MinimumOrderQuantity: req.MinimumOrderQuantity,
		SeriesStock:          req.SeriesStock,
		InitialStock:         initialStock,
		IsActive:             req.IsActive,
		Images:               req.Images,
		Variants:             req.Variants,
		Translations:         req.Translations,
	}
}

// CreateProduct adds a new supplier product (or draft with optional color siblings) directly to catalog.products
func (h *SupplierPortalHandler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	var req models.SupplierProductInput
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz veri biçimi")
		return
	}
	if declErr := validateSupplierContentDeclaration(req.ContentResponsibilityAccepted); declErr != nil {
		httpx.Error(w, http.StatusBadRequest, declErr.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	ensureSupplierSiblingSchema(ctx)
	ensureSupplierSkuUniqueIndex(ctx)
	_ = EnsureSupplierAuditSchema(ctx)

	if err := normalizeSupplierDraftOrPublishInput(ctx, claims.BrandID, &req, false); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	supplierSKU, _ := resolveSupplierInputSKU(&req)
	initialStock, normErr := resolveSupplierSeriesAndVariants(ctx, &req, "")
	if normErr != nil {
		httpx.Error(w, http.StatusBadRequest, normErr.Error())
		return
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Veritabanı işlemi başlatılamadı")
		return
	}
	defer tx.Rollback(ctx)

	if !ensureUniqueSupplierProductSKUOrWriteErr(w, ctx, tx, claims.BrandID, supplierSKU, "") {
		return
	}

	needGroup := hasNonEmptyColorVariantDrafts(req.AdditionalColorVariants)
	groupID, grpErr := resolveOrLinkGroupIDTx(ctx, tx, claims.BrandID, req.SourceProductGroupID, req.LinkWithProductID, needGroup)
	if grpErr != nil {
		httpx.Error(w, http.StatusBadRequest, grpErr.Error())
		return
	}

	mainSourceID := fmt.Sprintf("SUP-%d-0", time.Now().UnixNano())
	mainItem, mainSlug, err := insertSupplierProductRowTx(ctx, tx, buildSupplierInsertParams(claims.BrandID, mainSourceID, groupID, &req, initialStock))
	if err != nil {
		if isUniqueViolationErr(err) {
			httpx.Error(w, http.StatusConflict, "Bu ürün/model kodu mağazanızda zaten başka bir üründe kayıtlı.")
			return
		}
		log.Printf("[SUPPLIER PRODUCT] Create error: %v", err)
		httpx.Error(w, http.StatusInternalServerError, fmt.Sprintf("Ürün kaydedilemedi: %v", err))
		return
	}

	siblingRefs, activeSiblingSlugs, sibErr := insertAdditionalColorVariantsTx(ctx, tx, claims.BrandID, &req, groupID, initialStock)
	if sibErr != nil {
		httpx.Error(w, http.StatusBadRequest, sibErr.Error())
		return
	}

	siblingIDs := make([]string, 0, len(siblingRefs))
	auditItems := make([]productAuditItemRef, 0, 1+len(siblingRefs))
	auditItems = append(auditItems, productAuditItemRef{
		ProductID: mainItem.ID,
		Title:     mainItem.Title,
		CustomSKU: mainItem.CustomSKU,
	})
	for _, sr := range siblingRefs {
		siblingIDs = append(siblingIDs, sr.ProductID)
		auditItems = append(auditItems, sr)
	}

	allCreatedIDs := make([]string, 0, 1+len(siblingIDs))
	allCreatedIDs = append(allCreatedIDs, mainItem.ID)
	allCreatedIDs = append(allCreatedIDs, siblingIDs...)
	contentVer := resolveActivePolicyVersion(ctx, "supplier_agreement")
	if stampErr := stampProductsContentResponsibilityTx(ctx, tx, allCreatedIDs, isExplicitlyAccepted(req.ContentResponsibilityAccepted), contentVer); stampErr != nil {
		httpx.Error(w, http.StatusInternalServerError, "Hukuki sorumluluk onayı kaydedilemedi")
		return
	}
	auditActor := resolveSupplierAuditActor(claims)
	if auditErr := stampProductsCreatedAuditTx(ctx, tx, allCreatedIDs, auditActor); auditErr != nil {
		log.Printf("[SUPPLIER PRODUCT] Audit stamp error: %v", auditErr)
		httpx.Error(w, http.StatusInternalServerError, "Ürün denetim kaydı oluşturulamadı")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "İşlem onaylanamadı")
		return
	}

	recordProductAuditLogsAsync(r, claims.BrandID, claims.BrandName, "create", auditItems, auditActor, map[string]any{
		"is_active":     req.IsActive,
		"product_count": len(allCreatedIDs),
	})

	if req.ContentResponsibilityAccepted != nil && *req.ContentResponsibilityAccepted {
		recordLegalConsentAsync(legalConsentLogEntry{
			ConsentType:  "supplier_product_publish",
			PolicyType:   "supplier_agreement",
			ActorRole:    "supplier",
			ActorUserID:  claims.UserID,
			BrandID:      claims.BrandID,
			EntityType:   "product",
			EntityID:     formatConsentEntityIDs(allCreatedIDs),
			Email:        claims.Email,
			IPAddress:    getClientIP(r),
			UserAgent:    r.UserAgent(),
			AcceptedText: supplierContentDeclarationMsg,
			Metadata: map[string]any{
				"product_count": len(allCreatedIDs),
				"is_active":     req.IsActive,
			},
		})
	}

	var notifySlugs []string
	if req.IsActive && strings.TrimSpace(mainSlug) != "" {
		notifySlugs = append(notifySlugs, mainSlug)
	}
	for _, s := range activeSiblingSlugs {
		if strings.TrimSpace(s) != "" {
			notifySlugs = append(notifySlugs, s)
		}
	}
	if len(notifySlugs) > 0 {
		triggerProductMVRefreshAndIndexNow(notifySlugs, IndexNowSubmissionMeta{
			TriggerSource: "supplier_portal",
			SourceLabel:   "Tedarikçi Yeni Ürün: " + req.Title,
			ProductCount:  len(notifySlugs),
		})
	} else {
		triggerProductMVRefresh()
	}

	if req.IsActive && strings.TrimSpace(mainSlug) != "" {
		cleanImgs := cleanNonEmptyStrings(req.Images)
		firstImg := ""
		if len(cleanImgs) > 0 {
			firstImg = cleanImgs[0]
		}
		NotifyFavoriteSupplierFollowersAsync(h.Cfg, h.Notifier, claims.BrandID, []NewProductAlertItem{{
			ID:       mainItem.ID,
			Slug:     mainSlug,
			Title:    req.Title,
			ImageURL: firstImg,
		}})
	}

	msg := "Ürün taslak olarak kaydedildi."
	if req.IsActive {
		msg = "Ürün başarıyla oluşturuldu ve vitrinde yayına alındı."
	}
	writeSupplierJSON(w, http.StatusCreated, map[string]any{
		"message":                 msg,
		"id":                      mainItem.ID,
		"custom_sku":              mainItem.CustomSKU,
		"slug":                    mainSlug,
		"is_active":               req.IsActive,
		"source_product_group_id": derefStringOr(groupID, ""),
		"created_sibling_ids":     siblingIDs,
	})
}

func resolveUpdatedProductGroupIDTx(ctx context.Context, tx pgx.Tx, brandID string, existingGroupID *string, req *models.SupplierProductInput) (*string, error) {
	if normalizeOptionalIDPtr(req.LinkWithProductID) != nil {
		return resolveOrLinkGroupIDTx(ctx, tx, brandID, req.SourceProductGroupID, req.LinkWithProductID, false)
	}
	if req.SourceProductGroupID != nil {
		return normalizeOptionalIDPtr(req.SourceProductGroupID), nil
	}
	return existingGroupID, nil
}

// UpdateProduct updates product details and variants
func (h *SupplierPortalHandler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		http.Error(w, errJSONMissingID, http.StatusBadRequest)
		return
	}

	var req models.SupplierProductInput
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz veri biçimi")
		return
	}
	if declErr := validateSupplierContentDeclaration(req.ContentResponsibilityAccepted); declErr != nil {
		httpx.Error(w, http.StatusBadRequest, declErr.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	ensureSupplierSiblingSchema(ctx)
	ensureSupplierSkuUniqueIndex(ctx)
	_ = EnsureSupplierAuditSchema(ctx)

	hasExisting := len(cleanNonEmptyStrings(req.Images)) == 0 && hasExistingProductImages(ctx, id)
	if err := normalizeSupplierDraftOrPublishInput(ctx, claims.BrandID, &req, hasExisting); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	supplierSKU, hasSKUField := resolveSupplierInputSKU(&req)
	initialStock, normErr := resolveSupplierSeriesAndVariants(ctx, &req, id)
	if normErr != nil {
		httpx.Error(w, http.StatusBadRequest, normErr.Error())
		return
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Veritabanı işlemi başlatılamadı")
		return
	}
	defer tx.Rollback(ctx)

	if hasSKUField && !ensureUniqueSupplierProductSKUOrWriteErr(w, ctx, tx, claims.BrandID, supplierSKU, id) {
		return
	}

	var wasActive bool
	var existingGroupID *string
	if err := tx.QueryRow(ctx, "SELECT COALESCE(is_active, false), source_product_group_id FROM catalog.products WHERE id = $1 AND brand_id = $2", id, claims.BrandID).Scan(&wasActive, &existingGroupID); err != nil {
		httpx.Error(w, http.StatusNotFound, "Ürün bulunamadı veya güncelleme yetkiniz yok")
		return
	}

	groupID, grpErr := resolveUpdatedProductGroupIDTx(ctx, tx, claims.BrandID, existingGroupID, &req)
	if grpErr != nil {
		httpx.Error(w, http.StatusBadRequest, grpErr.Error())
		return
	}

	updateSQL := `
		UPDATE catalog.products SET
			title = $1, short_description = $2, description = $3,
			category_id = $4, color_id = $5, fabric_id = $6,
			gender = $7, season = $8, buying_price = $9, price = $10,
			currency = $11, packing_ratio = $12, series_ratio = $13,
			minimum_order_quantity = $14, series_stock = $15, stock = $16, is_active = $17,
			deactivated_at = CASE
				WHEN $17 = false AND is_active = true THEN CURRENT_TIMESTAMP
				WHEN $17 = true THEN NULL
				ELSE deactivated_at
			END,
			source_product_group_id = $18,
			sku = CASE WHEN $19 THEN NULLIF(BTRIM($20), '') ELSE sku END,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $21 AND brand_id = $22
		RETURNING coalesce(slug, ''), coalesce(custom_sku, '')`

	var updatedSlug, updatedCustomSKU string
	err = tx.QueryRow(
		ctx, updateSQL,
		req.Title, req.ShortDescription, req.Description,
		req.CategoryID, req.ColorID, req.FabricID,
		req.Gender, req.Season, req.BuyingPrice, req.Price,
		req.Currency, req.PackingRatio, req.SeriesRatio,
		req.MinimumOrderQuantity, req.SeriesStock, initialStock, req.IsActive,
		groupID, hasSKUField, supplierSKU, id, claims.BrandID,
	).Scan(&updatedSlug, &updatedCustomSKU)
	if err != nil {
		if isUniqueViolationErr(err) {
			httpx.Error(w, http.StatusConflict, fmt.Sprintf("Bu ürün/model kodu (%s) mağazanızda zaten başka bir üründe kayıtlı.", supplierSKU))
			return
		}
		log.Printf("[SUPPLIER PRODUCT] Update error: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "Ürün güncellenemedi")
		return
	}

	upsertSupplierProductTranslations(ctx, tx, id, req.Title, req.ShortDescription, req.Description, req.Translations)
	updateProductVariants(ctx, tx, id, req.Variants)
	updateProductImages(ctx, tx, id, req.Images)
	if req.ContentResponsibilityAccepted != nil && *req.ContentResponsibilityAccepted {
		contentVer := resolveActivePolicyVersion(ctx, "supplier_agreement")
		if stampErr := stampProductsContentResponsibilityTx(ctx, tx, []string{id}, true, contentVer); stampErr != nil {
			httpx.Error(w, http.StatusInternalServerError, "Hukuki sorumluluk onayı güncellenemedi")
			return
		}
	}
	auditActor := resolveSupplierAuditActor(claims)
	if auditErr := stampProductUpdatedAuditTx(ctx, tx, id, auditActor); auditErr != nil {
		log.Printf("[SUPPLIER PRODUCT] Update audit stamp error: %v", auditErr)
		httpx.Error(w, http.StatusInternalServerError, "Ürün güncelleme denetim kaydı oluşturulamadı")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "İşlem kaydedilemedi")
		return
	}

	recordProductAuditLogsAsync(r, claims.BrandID, claims.BrandName, "update", []productAuditItemRef{{
		ProductID: id,
		Title:     req.Title,
		CustomSKU: updatedCustomSKU,
	}}, auditActor, map[string]any{"is_active": req.IsActive})

	if req.ContentResponsibilityAccepted != nil && *req.ContentResponsibilityAccepted {
		recordLegalConsentAsync(legalConsentLogEntry{
			ConsentType:  "supplier_product_update",
			PolicyType:   "supplier_agreement",
			ActorRole:    "supplier",
			ActorUserID:  claims.UserID,
			BrandID:      claims.BrandID,
			EntityType:   "product",
			EntityID:     id,
			Email:        claims.Email,
			IPAddress:    getClientIP(r),
			UserAgent:    r.UserAgent(),
			AcceptedText: supplierContentDeclarationMsg,
			Metadata:     map[string]any{"is_active": req.IsActive},
		})
	}

	if req.IsActive && strings.TrimSpace(updatedSlug) != "" {
		triggerProductMVRefreshAndIndexNow([]string{updatedSlug}, IndexNowSubmissionMeta{
			TriggerSource: "supplier_portal",
			SourceLabel:   "Tedarikçi Ürün Yayınlama/Güncelleme: " + req.Title,
			ProductCount:  1,
		})
	} else {
		triggerProductMVRefresh()
	}

	if !wasActive && req.IsActive && strings.TrimSpace(updatedSlug) != "" {
		cleanImgs := cleanNonEmptyStrings(req.Images)
		firstImg := ""
		if len(cleanImgs) > 0 {
			firstImg = cleanImgs[0]
		}
		NotifyFavoriteSupplierFollowersAsync(h.Cfg, h.Notifier, claims.BrandID, []NewProductAlertItem{{
			ID:       id,
			Slug:     updatedSlug,
			Title:    req.Title,
			ImageURL: firstImg,
		}})
	}
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"message":                 "Ürün başarıyla güncellendi.",
		"is_active":               req.IsActive,
		"source_product_group_id": derefStringOr(groupID, ""),
	})
}

// DeleteProduct deletes a supplier product
func (h *SupplierPortalHandler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, errJSONMissingID, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var deletedSKU, deletedCustomSKU, deletedTitle string
	err := db.Pool.QueryRow(
		ctx,
		"DELETE FROM catalog.products WHERE id = $1 AND brand_id = $2 RETURNING coalesce(sku, ''), coalesce(custom_sku, ''), coalesce(title, '')",
		id,
		claims.BrandID,
	).Scan(&deletedSKU, &deletedCustomSKU, &deletedTitle)
	if err != nil {
		http.Error(w, `{"error":"Ürün silinemedi veya yetkiniz yok"}`, http.StatusBadRequest)
		return
	}

	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO catalog.product_deletion_logs (product_id, brand_id, sku, title, deletion_mode, actor_type)
		VALUES ($1, $2, $3, $4, 'hard', 'supplier')
	`, id, claims.BrandID, deletedSKU, deletedTitle)
	recordProductAuditLogsAsync(r, claims.BrandID, claims.BrandName, "delete", []productAuditItemRef{{
		ProductID: id,
		Title:     deletedTitle,
		CustomSKU: firstNonEmptyAuditStr(deletedCustomSKU, deletedSKU),
	}}, resolveSupplierAuditActor(claims), map[string]any{"deletion_mode": "hard"})

	triggerProductMVRefresh()

	writeSupplierJSON(w, http.StatusOK, map[string]string{"message": "Ürün kalıcı olarak silindi."})
}

// UploadImage handles file upload for product photos (supports up to 25MB mobile camera photos with auto-optimization)
func (h *SupplierPortalHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(25 << 20); err != nil {
		http.Error(w, `{"error":"Dosya boyutu çok büyük (Max: 25MB)"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, `{"error":"Yüklenecek görsel dosyası bulunamadı"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	mediaSvc := h.Media
	if mediaSvc == nil {
		mediaSvc = services.NewLocalImageMediaService("")
	}
	imageURL, err := mediaSvc.SaveUploadedImage(file, header.Filename, "products", "sup")
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusBadRequest)
		return
	}

	writeSupplierJSON(w, http.StatusOK, map[string]string{
		"image_url": imageURL,
	})
}

// ListCategories returns categories for dropdown
func (h *SupplierPortalHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	query := `
		SELECT id, title, slug, node_path::text 
		FROM catalog.categories 
		WHERE is_active = true 
		ORDER BY node_path ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		http.Error(w, `{"error":"Kategoriler yüklenemedi"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type CatItem struct {
		ID       string `json:"id"`
		Title    string `json:"title"`
		Slug     string `json:"slug"`
		NodePath string `json:"node_path"`
	}

	cats := make([]CatItem, 0)
	for rows.Next() {
		var c CatItem
		if err := rows.Scan(&c.ID, &c.Title, &c.Slug, &c.NodePath); err == nil {
			cats = append(cats, c)
		}
	}

	writeSupplierJSON(w, http.StatusOK, cats)
}

// ListAttributes returns colors and fabrics for product attribute selectors
func (h *SupplierPortalHandler) ListAttributes(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	type Item struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Code string `json:"code,omitempty"`
	}

	colors := make([]Item, 0)
	cRows, cErr := db.Pool.Query(ctx, "SELECT id, color_name, coalesce(color_code, '') FROM catalog.colors ORDER BY color_name ASC")
	if cErr == nil {
		defer cRows.Close()
		for cRows.Next() {
			var it Item
			if err := cRows.Scan(&it.ID, &it.Name, &it.Code); err == nil {
				colors = append(colors, it)
			}
		}
	}

	fabrics := make([]Item, 0)
	fRows, fErr := db.Pool.Query(ctx, "SELECT id, fabric_name FROM catalog.fabrics ORDER BY fabric_name ASC")
	if fErr == nil {
		defer fRows.Close()
		for fRows.Next() {
			var it Item
			if err := fRows.Scan(&it.ID, &it.Name); err == nil {
				fabrics = append(fabrics, it)
			}
		}
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"colors":           colors,
		"fabrics":          fabrics,
		"sizes":            fetchActiveSizeDefinitions(ctx),
		"series_templates": fetchActiveSeriesTemplates(ctx),
	})
}

// VerifySetupToken validates supplier password setup token and returns basic details for the UI
func (h *SupplierPortalHandler) VerifySetupToken(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		http.Error(w, `{"error":"Şifre belirleme belirteci (token) eksik"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var email, contactName, brandName string
	var expiresAt time.Time

	query := `
		SELECT u.email, u.contact_name, b.brand_name, u.setup_token_expires_at
		FROM catalog.supplier_users u
		JOIN catalog.brands b ON u.brand_id = b.id
		WHERE u.setup_token = $1`

	err := db.Pool.QueryRow(ctx, query, token).Scan(&email, &contactName, &brandName, &expiresAt)
	if err != nil {
		http.Error(w, `{"error":"Geçersiz veya süresi dolmuş şifre belirleme bağlantısı"}`, http.StatusNotFound)
		return
	}

	if time.Now().After(expiresAt) {
		http.Error(w, `{"error":"Şifre belirleme bağlantısının 48 saatlik geçerlilik süresi dolmuştur. Lütfen destek ekibimizle iletişime geçiniz."}`, http.StatusGone)
		return
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"valid":        true,
		"email":        email,
		"contact_name": contactName,
		"brand_name":   brandName,
	})
}

// SetupPassword sets the supplier password, syncs with Keycloak and logs the supplier in
func (h *SupplierPortalHandler) SetupPassword(w http.ResponseWriter, r *http.Request) {
	var req models.SupplierSetupPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek formatı"}`, http.StatusBadRequest)
		return
	}

	req.Token = strings.TrimSpace(req.Token)
	req.Password = strings.TrimSpace(req.Password)

	if req.Token == "" {
		http.Error(w, `{"error":"Belirteç (token) zorunludur"}`, http.StatusBadRequest)
		return
	}

	if len(req.Password) < 6 {
		http.Error(w, `{"error":"Şifre en az 6 karakter olmalıdır"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var u models.SupplierUser
	var expiresAt time.Time

	query := `
		SELECT u.id, u.brand_id, b.brand_name, coalesce(b.alias_code, ''), u.email, u.contact_name, u.phone, u.keycloak_id, u.setup_token_expires_at
		FROM catalog.supplier_users u
		JOIN catalog.brands b ON u.brand_id = b.id
		WHERE u.setup_token = $1`

	err := db.Pool.QueryRow(ctx, query, req.Token).Scan(
		&u.ID, &u.BrandID, &u.BrandName, &u.AliasCode, &u.Email, &u.ContactName, &u.Phone, &u.KeycloakID, &expiresAt,
	)
	if err != nil {
		http.Error(w, `{"error":"Geçersiz veya süresi dolmuş şifre belirleme bağlantısı"}`, http.StatusNotFound)
		return
	}

	if time.Now().After(expiresAt) {
		http.Error(w, `{"error":"Şifre belirleme bağlantısının süresi dolmuştur"}`, http.StatusGone)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		http.Error(w, `{"error":"Şifre şifrelenirken hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	// Update DB password and clear setup token
	_, err = db.Pool.Exec(ctx, `
		UPDATE catalog.supplier_users 
		SET password_hash = $1, setup_token = NULL, setup_token_expires_at = NULL, is_active = true, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2`, string(hashed), u.ID)
	if err != nil {
		log.Printf("[SUPPLIER SETUP ERROR] DB update failed: %v", err)
		http.Error(w, `{"error":"Şifre kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	// Create or update Keycloak user
	phoneStr := ""
	if u.Phone != nil {
		phoneStr = *u.Phone
	}
	if u.KeycloakID != nil && *u.KeycloakID != "" {
		_ = updateKeycloakSupplierUser(ctx, h.Cfg, *u.KeycloakID, u.ContactName, req.Password, true)
	} else {
		newKCID, kcErr := createKeycloakSupplierUser(ctx, h.Cfg, u.Email, u.ContactName, req.Password, phoneStr, u.BrandID)
		if kcErr == nil && newKCID != "" {
			u.KeycloakID = &newKCID
			_, _ = db.Pool.Exec(ctx, "UPDATE catalog.supplier_users SET keycloak_id = $1 WHERE id = $2", newKCID, u.ID)
		}
	}

	// Direct login
	tokenString, _ := loginKeycloakUser(ctx, h.Cfg, u.Email, req.Password)
	if tokenString == "" {
		tokenString = issueLocalSupplierJWT(h.Cfg.JWTSecret, &u)
	}

	// Update last login
	_, _ = db.Pool.Exec(ctx, "UPDATE catalog.supplier_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1", u.ID)

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Şifreniz başarıyla oluşturuldu! Tedarikçi yönetim portalına yönlendiriliyorsunuz.",
		"token":   tokenString,
		"user": map[string]any{
			"id":           u.ID,
			"brand_id":     u.BrandID,
			"brand_name":   u.BrandName,
			"email":        u.Email,
			"contact_name": u.ContactName,
		},
	})
}

func loadSupplierProductTranslations(ctx context.Context, productID string, defaultTitle string, defaultShort *string, defaultDesc *string) map[string]any {
	out := make(map[string]any)
	shortStr := ""
	if defaultShort != nil {
		shortStr = *defaultShort
	}
	descStr := ""
	if defaultDesc != nil {
		descStr = *defaultDesc
	}
	out["tr"] = map[string]string{
		"title":             defaultTitle,
		"short_description": shortStr,
		"description":       descStr,
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT language_code, coalesce(title, ''), coalesce(short_description, ''), coalesce(description, '')
		FROM catalog.product_translations
		WHERE product_id = $1`, productID)
	if err != nil {
		return out
	}
	defer rows.Close()

	for rows.Next() {
		var lang, title, shortDesc, desc string
		if err := rows.Scan(&lang, &title, &shortDesc, &desc); err == nil {
			code := strings.ToLower(strings.TrimSpace(lang))
			if len(code) > 2 {
				code = code[:2]
			}
			out[code] = map[string]string{
				"title":             title,
				"short_description": shortDesc,
				"description":       desc,
			}
		}
	}
	return out
}

func upsertSupplierProductTranslations(
	ctx context.Context,
	tx pgx.Tx,
	productID string,
	trTitle string,
	trShort string,
	trDesc string,
	translations map[string]models.SupplierTranslationInput,
) {
	_, _ = tx.Exec(ctx, `
		INSERT INTO catalog.product_translations (product_id, language_code, title, short_description, description)
		VALUES ($1, 'tr', $2, $3, $4)
		ON CONFLICT (product_id, language_code) DO UPDATE SET
			title = EXCLUDED.title,
			short_description = EXCLUDED.short_description,
			description = EXCLUDED.description`,
		productID, strings.TrimSpace(trTitle), strings.TrimSpace(trShort), strings.TrimSpace(trDesc))

	supportedLangs := []string{"en", "ru", "ar", "de", "fr", "pl", "bg"}
	for _, lang := range supportedLangs {
		item, exists := translations[lang]
		if !exists {
			continue
		}
		tTitle := strings.TrimSpace(item.Title)
		tShort := strings.TrimSpace(item.ShortDescription)
		tDesc := strings.TrimSpace(item.Description)
		if tTitle == "" && tShort == "" && tDesc == "" {
			continue
		}
		if tTitle == "" {
			tTitle = strings.TrimSpace(trTitle)
		}
		_, _ = tx.Exec(ctx, `
			INSERT INTO catalog.product_translations (product_id, language_code, title, short_description, description)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (product_id, language_code) DO UPDATE SET
				title = EXCLUDED.title,
				short_description = EXCLUDED.short_description,
				description = EXCLUDED.description`,
			productID, lang, tTitle, tShort, tDesc)
	}
}

// GetProductTranslations returns TR, EN, RU, AR translations for a supplier product
func (h *SupplierPortalHandler) GetProductTranslations(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, errJSONMissingID, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var title string
	var shortDesc, desc *string
	err := db.Pool.QueryRow(ctx, `
		SELECT title, short_description, description
		FROM catalog.products
		WHERE id = $1 AND brand_id = $2`, id, claims.BrandID).Scan(&title, &shortDesc, &desc)
	if err != nil {
		http.Error(w, `{"error":"Ürün bulunamadı veya yetkiniz yok"}`, http.StatusNotFound)
		return
	}

	translations := loadSupplierProductTranslations(ctx, id, title, shortDesc, desc)
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"product_id":   id,
		"translations": translations,
	})
}

// UpdateProductTranslations saves manual TR, EN, RU, AR translations for a supplier product
func (h *SupplierPortalHandler) UpdateProductTranslations(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, errJSONMissingID, http.StatusBadRequest)
		return
	}

	var req struct {
		Translations map[string]models.SupplierTranslationInput `json:"translations"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz veri biçimi"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"Veritabanı işlemi başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var currentTitle, currentShort, currentDesc, productSlug string
	var isActive bool
	err = tx.QueryRow(ctx, `
		SELECT title, coalesce(short_description, ''), coalesce(description, ''), coalesce(slug, ''), is_active
		FROM catalog.products
		WHERE id = $1 AND brand_id = $2`, id, claims.BrandID).Scan(&currentTitle, &currentShort, &currentDesc, &productSlug, &isActive)
	if err != nil {
		http.Error(w, `{"error":"Ürün bulunamadı veya yetkiniz yok"}`, http.StatusNotFound)
		return
	}

	if trInput, ok := req.Translations["tr"]; ok {
		if strings.TrimSpace(trInput.Title) != "" {
			currentTitle = strings.TrimSpace(trInput.Title)
		}
		currentShort = strings.TrimSpace(trInput.ShortDescription)
		currentDesc = strings.TrimSpace(trInput.Description)
		_, _ = tx.Exec(ctx, `
			UPDATE catalog.products
			SET title = $1, short_description = $2, description = $3, updated_at = CURRENT_TIMESTAMP
			WHERE id = $4 AND brand_id = $5`,
			currentTitle, currentShort, currentDesc, id, claims.BrandID)
	}

	upsertSupplierProductTranslations(ctx, tx, id, currentTitle, currentShort, currentDesc, req.Translations)

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"Çeviriler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	if isActive && strings.TrimSpace(productSlug) != "" {
		triggerProductMVRefreshAndIndexNow([]string{productSlug}, IndexNowSubmissionMeta{
			TriggerSource: "supplier_portal",
			SourceLabel:   "Tedarikçi Çok Dilli Çeviri Güncellemesi: " + currentTitle,
			ProductCount:  1,
		})
	} else {
		triggerProductMVRefresh()
	}
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Çok dilli ürün çevirileri (TR / EN / RU / AR / DE / FR / PL / BG) başarıyla güncellendi.",
	})
}

func isValidTargetLang(lang, sourceLang string) bool {
	if lang == sourceLang {
		return false
	}
	switch lang {
	case "en", "ru", "ar", "de", "fr", "pl", "bg", "tr":
		return true
	default:
		return false
	}
}

func translateSingleField(ctx context.Context, text, sourceLang, targetLang string) string {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return ""
	}
	translated, err := translateText(ctx, trimmed, sourceLang, targetLang)
	if err != nil || strings.TrimSpace(translated) == "" {
		return trimmed
	}
	return strings.TrimSpace(translated)
}

func translateFieldsForTargetLang(ctx context.Context, fields map[string]string, sourceLang, targetLang string) map[string]string {
	langMap := make(map[string]string, len(fields))
	for fieldKey, sourceText := range fields {
		langMap[fieldKey] = translateSingleField(ctx, sourceText, sourceLang, targetLang)
	}
	return langMap
}

// AutoTranslateFields translates given text fields from source language (default 'tr') into all 7 storefront target languages ('en', 'ru', 'ar', 'de', 'fr', 'pl', 'bg') using LibreTranslate
func (h *SupplierPortalHandler) AutoTranslateFields(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	var req struct {
		SourceLang  string            `json:"source_lang"`
		TargetLangs []string          `json:"target_langs"`
		Fields      map[string]string `json:"fields"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek formatı"}`, http.StatusBadRequest)
		return
	}

	sourceLang := strings.ToLower(strings.TrimSpace(req.SourceLang))
	if sourceLang == "" {
		sourceLang = "tr"
	}
	targetLangs := req.TargetLangs
	if len(targetLangs) == 0 {
		targetLangs = []string{"en", "ru", "ar", "de", "fr", "pl", "bg"}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	results := make(map[string]map[string]string, len(targetLangs))
	for _, rawLang := range targetLangs {
		lang := strings.ToLower(strings.TrimSpace(rawLang))
		if !isValidTargetLang(lang, sourceLang) {
			continue
		}
		results[lang] = translateFieldsForTargetLang(ctx, req.Fields, sourceLang, lang)
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"translations": results,
	})
}

