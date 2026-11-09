package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/services"
)

const (
	refreshMaterializedViewSQL = "REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products"
)

func writeSupplierJSON(w http.ResponseWriter, status int, data any) {
	httpx.JSON(w, status, data)
}

func triggerProductMVRefresh() {
	go func() {
		bgCtx, bgCancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer bgCancel()
		if _, err := db.Pool.Exec(bgCtx, refreshMaterializedViewSQL); err != nil {
			log.Printf("[SUPPLIER PORTAL] Async MV refresh error: %v", err)
		}
	}()
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
	case "passive":
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
	Cfg   *config.Config
	Media services.MediaProcessor
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

	// Update last_login_at
	_, _ = db.Pool.Exec(ctx, "UPDATE catalog.supplier_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1", u.ID)

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

	var totalProducts, activeProducts, totalStock, totalVariants, totalOrders int
	statsQuery := `
		SELECT 
			count(DISTINCT p.id),
			count(DISTINCT p.id) FILTER (WHERE p.is_active = true),
			coalesce(sum(v.stock), 0),
			count(v.id)
		FROM catalog.products p
		LEFT JOIN catalog.product_variants v ON p.id = v.product_id
		WHERE p.brand_id = $1`

	_ = db.Pool.QueryRow(ctx, statsQuery, claims.BrandID).Scan(&totalProducts, &activeProducts, &totalStock, &totalVariants)
	_ = db.Pool.QueryRow(ctx, `SELECT count(*) FROM catalog.supplier_sub_orders WHERE brand_id = $1`, claims.BrandID).Scan(&totalOrders)

	var brandProfile models.Brand
	var descTransJSON []byte
	brandQuery := `
		SELECT 
			b.id, b.brand_name, b.slug, b.alias_code,
			coalesce(b.company_type, 'uretici_toptanci'),
			coalesce(b.description, ''),
			coalesce(b.description_translations, '{}'::jsonb),
			b.website, b.phone,
			coalesce(
				nullif(b.whatsapp_phone, ''),
				nullif(b.phone, ''),
				(SELECT coalesce(nullif(su.phone, ''), '') FROM catalog.supplier_users su WHERE su.brand_id = b.id AND su.phone IS NOT NULL AND su.phone <> '' ORDER BY su.is_owner DESC, su.created_at ASC LIMIT 1),
				''
			),
			coalesce(b.public_email, ''),
			coalesce(b.instagram_handle, ''),
			coalesce(b.location_address, ''),
			coalesce(b.export_countries, ''),
			coalesce(b.min_order_quantity, 1),
			coalesce(b.supports_private_label, false),
			coalesce(b.supports_fason, false),
			coalesce(b.is_verified, true),
			coalesce(b.bank_name, ''),
			coalesce(b.bank_account_holder, ''),
			coalesce(b.iban, ''),
			b.is_active, b.created_at, b.updated_at
		FROM catalog.brands b
		WHERE b.id = $1`
	_ = db.Pool.QueryRow(ctx, brandQuery, claims.BrandID).Scan(
		&brandProfile.ID, &brandProfile.Name, &brandProfile.Slug, &brandProfile.AliasCode,
		&brandProfile.CompanyType, &brandProfile.Description, &descTransJSON,
		&brandProfile.Website, &brandProfile.Phone,
		&brandProfile.WhatsappPhone, &brandProfile.PublicEmail, &brandProfile.InstagramHandle,
		&brandProfile.LocationAddress, &brandProfile.ExportCountries, &brandProfile.MinOrderQuantity,
		&brandProfile.SupportsPrivateLabel, &brandProfile.SupportsFason, &brandProfile.IsVerified,
		&brandProfile.BankName, &brandProfile.BankAccountHolder, &brandProfile.IBAN,
		&brandProfile.IsActive, &brandProfile.CreatedAt, &brandProfile.UpdatedAt,
	)
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
			"total_stock":     totalStock,
			"total_variants":  totalVariants,
			"total_orders":    totalOrders,
		},
	})
}

type UpdateSupplierBrandProfileRequest struct {
	BrandName               string            `json:"brand_name"`
	CompanyType             string            `json:"company_type"`
	Description             string            `json:"description"`
	DescriptionTranslations map[string]string `json:"description_translations,omitempty"`
	Phone                   string            `json:"phone"`
	WhatsappPhone           string            `json:"whatsapp_phone"`
	PublicEmail             string            `json:"public_email"`
	Website                 string            `json:"website"`
	InstagramHandle         string            `json:"instagram_handle"`
	LocationAddress         string            `json:"location_address"`
	ExportCountries         string            `json:"export_countries"`
	MinOrderQuantity        int               `json:"min_order_quantity"`
	SupportsPrivateLabel    bool              `json:"supports_private_label"`
	SupportsFason           bool              `json:"supports_fason"`
	BankName                string            `json:"bank_name"`
	BankAccountHolder       string            `json:"bank_account_holder"`
	IBAN                    string            `json:"iban"`
	QuickWhatsappOnly       bool              `json:"quick_whatsapp_only"`
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
		waTrim := strings.TrimSpace(req.WhatsappPhone)
		_, err := db.Pool.Exec(ctx, `
			UPDATE catalog.brands
			SET whatsapp_phone = $1,
			    phone = CASE WHEN phone IS NULL OR phone = '' THEN $1 ELSE phone END,
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, waTrim, claims.BrandID)
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

	var websitePtr, phonePtr *string
	if wStr := strings.TrimSpace(req.Website); wStr != "" {
		websitePtr = &wStr
	}
	pStr := strings.TrimSpace(req.Phone)
	if pStr == "" {
		pStr = strings.TrimSpace(req.WhatsappPhone)
	}
	if pStr != "" {
		phonePtr = &pStr
	}

	descTrim := strings.TrimSpace(req.Description)
	descMap := make(map[string]string)
	for k, v := range req.DescriptionTranslations {
		lang := strings.ToLower(strings.TrimSpace(k))
		if lang == "tr" || lang == "en" || lang == "ru" || lang == "ar" {
			descMap[lang] = strings.TrimSpace(v)
		}
	}
	if descTrim == "" && descMap["tr"] != "" {
		descTrim = descMap["tr"]
	}
	if descTrim != "" {
		descMap["tr"] = descTrim
	}
	descTransBytes, _ := json.Marshal(descMap)

	updateQuery := `
		UPDATE catalog.brands
		SET 
			brand_name = $1,
			company_type = $2,
			description = $3,
			description_translations = $4::jsonb,
			phone = $5,
			whatsapp_phone = $6,
			public_email = $7,
			website = $8,
			instagram_handle = $9,
			location_address = $10,
			export_countries = $11,
			min_order_quantity = $12,
			supports_private_label = $13,
			supports_fason = $14,
			bank_name = $15,
			bank_account_holder = $16,
			iban = $17,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $18`

	_, err := db.Pool.Exec(ctx, updateQuery,
		brandName,
		companyType,
		descTrim,
		string(descTransBytes),
		phonePtr,
		strings.TrimSpace(req.WhatsappPhone),
		strings.TrimSpace(req.PublicEmail),
		websitePtr,
		strings.TrimSpace(req.InstagramHandle),
		strings.TrimSpace(req.LocationAddress),
		strings.TrimSpace(req.ExportCountries),
		minOrderQty,
		req.SupportsPrivateLabel,
		req.SupportsFason,
		strings.TrimSpace(req.BankName),
		strings.TrimSpace(req.BankAccountHolder),
		ibanClean,
		claims.BrandID,
	)
	if err != nil {
		log.Printf("[SUPPLIER PORTAL] UpdateProfile error: %v", err)
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Firma profili güncellenemedi."})
		return
	}

	// Synchronize IBAN & bank info with supplier_wallets as well
	if ibanClean != "" || strings.TrimSpace(req.BankName) != "" {
		_, _ = db.Pool.Exec(ctx, `
			INSERT INTO catalog.supplier_wallets (brand_id, iban, bank_name, bank_account_holder, commission_rate)
			VALUES ($1, $2, $3, $4, 0.00)
			ON CONFLICT (brand_id) DO UPDATE SET
				iban = EXCLUDED.iban,
				bank_name = EXCLUDED.bank_name,
				bank_account_holder = EXCLUDED.bank_account_holder,
				updated_at = CURRENT_TIMESTAMP`,
			claims.BrandID, ibanClean, strings.TrimSpace(req.BankName), strings.TrimSpace(req.BankAccountHolder),
		)
	}

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
			coalesce(c.title, '') as category_title,
			p.buying_price,
			p.price,
			p.currency,
			p.packing_ratio,
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
			count(v.id) as variants_count
		FROM catalog.products p
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		LEFT JOIN catalog.product_variants v ON p.id = v.product_id
		%s
		GROUP BY p.id, c.title
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
		CategoryTitle        string    `json:"category_title"`
		BuyingPrice          float64   `json:"buying_price"`
		Price                float64   `json:"price"`
		Currency             string    `json:"currency"`
		PackingRatio         *string   `json:"packing_ratio,omitempty"`
		MinimumOrderQuantity int       `json:"minimum_order_quantity"`
		IsActive             bool      `json:"is_active"`
		IsArchived           bool      `json:"is_archived"`
		Season               string    `json:"season,omitempty"`
		CreatedAt            time.Time `json:"created_at"`
		UpdatedAt            time.Time `json:"updated_at"`
		CoverImage           string    `json:"cover_image"`
		TotalStock           int       `json:"total_stock"`
		VariantsCount        int       `json:"variants_count"`
	}

	products := make([]ProductRow, 0)
	for rows.Next() {
		var pr ProductRow
		if err := rows.Scan(
			&pr.ID,
			&pr.Title,
			&pr.CustomSKU,
			&pr.CategoryTitle,
			&pr.BuyingPrice,
			&pr.Price,
			&pr.Currency,
			&pr.PackingRatio,
			&pr.MinimumOrderQuantity,
			&pr.IsActive,
			&pr.IsArchived,
			&pr.Season,
			&pr.CreatedAt,
			&pr.UpdatedAt,
			&pr.CoverImage,
			&pr.TotalStock,
			&pr.VariantsCount,
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

	var p models.Product
	query := `
		SELECT 
			id, title, slug, custom_sku, short_description, description, 
			category_id, color_id, fabric_id, gender, season, 
			buying_price, price, currency, packing_ratio, series_ratio, 
			minimum_order_quantity, is_active, created_at, updated_at
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

	// Fetch variants
	varVariants := make([]*models.ProductVariant, 0)
	vRows, vErr := db.Pool.Query(ctx, "SELECT id, product_id, variant_size, barcode, stock, is_single, custom_sku, is_active FROM catalog.product_variants WHERE product_id = $1 ORDER BY variant_size ASC", p.ID)
	if vErr == nil {
		defer vRows.Close()
		for vRows.Next() {
			var v models.ProductVariant
			if err := vRows.Scan(&v.ID, &v.ProductID, &v.Size, &v.Barcode, &v.Stock, &v.IsSingle, &v.CustomSku, &v.IsActive); err == nil {
				varVariants = append(varVariants, &v)
			}
		}
	}
	p.Variants = varVariants

	// Fetch images
	varImages := make([]*models.ProductImage, 0)
	iRows, iErr := db.Pool.Query(ctx, "SELECT id, product_id, image_url, sort_order, is_cover FROM catalog.product_images WHERE product_id = $1 ORDER BY is_cover DESC, sort_order ASC", p.ID)
	if iErr == nil {
		defer iRows.Close()
		for iRows.Next() {
			var img models.ProductImage
			if err := iRows.Scan(&img.ID, &img.ProductID, &img.ImageUrl, &img.SortOrder, &img.IsCover); err == nil {
				varImages = append(varImages, &img)
			}
		}
	}
	p.Images = varImages

	// Fetch multi-language translations (tr, en, ru, ar)
	p.Translations = loadSupplierProductTranslations(ctx, p.ID, p.Title, p.ShortDescription, p.Description)

	writeSupplierJSON(w, http.StatusOK, p)
}

// CreateProduct adds a new supplier product directly to catalog.products
func (h *SupplierPortalHandler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	var req models.SupplierProductInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz veri biçimi"}`, http.StatusBadRequest)
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" || req.CategoryID == "" || req.Price <= 0 {
		http.Error(w, `{"error":"Ürün adı, kategori ve satış fiyatı zorunludur"}`, http.StatusBadRequest)
		return
	}

	if req.Currency == "" {
		req.Currency = "TRY"
	}
	if req.MinimumOrderQuantity <= 0 {
		req.MinimumOrderQuantity = 1
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"Veritabanı işlemi başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Generate source_product_id
	sourceProductID := fmt.Sprintf("SUP-%d", time.Now().UnixNano())

	// Calculate initial total stock
	initialStock := 0
	for _, v := range req.Variants {
		initialStock += v.Stock
	}

	var newProductID string
	var customSKU string
	var slug string

	insertProductSQL := `
		INSERT INTO catalog.products (
			brand_id, feed_id, source_product_id, title, short_description, description,
			category_id, color_id, fabric_id, gender, season,
			buying_price, price, currency, packing_ratio, series_ratio,
			minimum_order_quantity, stock, is_active
		) VALUES (
			$1, NULL, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			$16, $17, $18
		) RETURNING id, custom_sku, slug`

	err = tx.QueryRow(
		ctx,
		insertProductSQL,
		claims.BrandID,
		sourceProductID,
		req.Title,
		req.ShortDescription,
		req.Description,
		req.CategoryID,
		req.ColorID,
		req.FabricID,
		req.Gender,
		req.Season,
		req.BuyingPrice,
		req.Price,
		req.Currency,
		req.PackingRatio,
		req.SeriesRatio,
		req.MinimumOrderQuantity,
		initialStock,
		req.IsActive,
	).Scan(&newProductID, &customSKU, &slug)

	if err != nil {
		log.Printf("[SUPPLIER PRODUCT] Create error: %v", err)
		http.Error(w, fmt.Sprintf(`{"error":"Ürün kaydedilemedi: %v"}`, err), http.StatusInternalServerError)
		return
	}

	// Upsert Turkish and any provided multi-language translations (en, ru, ar)
	upsertSupplierProductTranslations(ctx, tx, newProductID, req.Title, req.ShortDescription, req.Description, req.Translations)

	insertProductVariants(ctx, tx, newProductID, sourceProductID, req.Variants, initialStock)
	insertProductImages(ctx, tx, newProductID, req.Images)

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"İşlem onaylanamadı"}`, http.StatusInternalServerError)
		return
	}

	triggerProductMVRefresh()

	writeSupplierJSON(w, http.StatusCreated, map[string]any{
		"message":    "Ürün başarıyla oluşturuldu ve vitrinde yayına alındı.",
		"id":         newProductID,
		"custom_sku": customSKU,
		"slug":       slug,
	})
}

// UpdateProduct updates product details and variants
func (h *SupplierPortalHandler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
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

	var req models.SupplierProductInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz veri biçimi"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"Veritabanı işlemi başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Verify ownership
	var exists bool
	_ = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.products WHERE id = $1 AND brand_id = $2)", id, claims.BrandID).Scan(&exists)
	if !exists {
		http.Error(w, `{"error":"Ürün bulunamadı veya güncelleme yetkiniz yok"}`, http.StatusNotFound)
		return
	}

	initialStock := 0
	for _, v := range req.Variants {
		initialStock += v.Stock
	}

	updateSQL := `
		UPDATE catalog.products SET
			title = $1, short_description = $2, description = $3,
			category_id = $4, color_id = $5, fabric_id = $6,
			gender = $7, season = $8, buying_price = $9, price = $10,
			currency = $11, packing_ratio = $12, series_ratio = $13,
			minimum_order_quantity = $14, stock = $15, is_active = $16,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $17 AND brand_id = $18`

	_, err = tx.Exec(
		ctx,
		updateSQL,
		req.Title,
		req.ShortDescription,
		req.Description,
		req.CategoryID,
		req.ColorID,
		req.FabricID,
		req.Gender,
		req.Season,
		req.BuyingPrice,
		req.Price,
		req.Currency,
		req.PackingRatio,
		req.SeriesRatio,
		req.MinimumOrderQuantity,
		initialStock,
		req.IsActive,
		id,
		claims.BrandID,
	)
	if err != nil {
		log.Printf("[SUPPLIER PRODUCT] Update error: %v", err)
		http.Error(w, `{"error":"Ürün güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	// Upsert Turkish and any provided multi-language translations (en, ru, ar)
	upsertSupplierProductTranslations(ctx, tx, id, req.Title, req.ShortDescription, req.Description, req.Translations)

	updateProductVariants(ctx, tx, id, req.Variants)
	updateProductImages(ctx, tx, id, req.Images)

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"İşlem kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	triggerProductMVRefresh()

	writeSupplierJSON(w, http.StatusOK, map[string]string{"message": "Ürün başarıyla güncellendi."})
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

	res, err := db.Pool.Exec(ctx, "DELETE FROM catalog.products WHERE id = $1 AND brand_id = $2", id, claims.BrandID)
	if err != nil || res.RowsAffected() == 0 {
		http.Error(w, `{"error":"Ürün silinemedi veya yetkiniz yok"}`, http.StatusBadRequest)
		return
	}

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
		"colors":  colors,
		"fabrics": fabrics,
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

	supportedLangs := []string{"en", "ru", "ar"}
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

	var currentTitle, currentShort, currentDesc string
	err = tx.QueryRow(ctx, `
		SELECT title, coalesce(short_description, ''), coalesce(description, '')
		FROM catalog.products
		WHERE id = $1 AND brand_id = $2`, id, claims.BrandID).Scan(&currentTitle, &currentShort, &currentDesc)
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

	triggerProductMVRefresh()
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Çok dilli ürün çevirileri (TR / EN / RU / AR) başarıyla güncellendi.",
	})
}

// AutoTranslateFields translates given text fields from source language (default 'tr') into target languages ('en', 'ru', 'ar') using LibreTranslate
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
		targetLangs = []string{"en", "ru", "ar"}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	results := make(map[string]map[string]string)
	for _, rawLang := range targetLangs {
		lang := strings.ToLower(strings.TrimSpace(rawLang))
		if lang != "en" && lang != "ru" && lang != "ar" && lang != "tr" {
			continue
		}
		if lang == sourceLang {
			continue
		}
		langMap := make(map[string]string)
		for fieldKey, sourceText := range req.Fields {
			trimmed := strings.TrimSpace(sourceText)
			if trimmed == "" {
				langMap[fieldKey] = ""
				continue
			}
			translated, err := translateText(ctx, trimmed, sourceLang, lang)
			if err != nil || strings.TrimSpace(translated) == "" {
				langMap[fieldKey] = trimmed
			} else {
				langMap[fieldKey] = strings.TrimSpace(translated)
			}
		}
		results[lang] = langMap
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"translations": results,
	})
}

