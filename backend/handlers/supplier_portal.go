package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
)

const (
	refreshMaterializedViewSQL = "REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products"
)

func writeSupplierJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
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
		conditions = append(conditions, "p.is_active = true")
	case "passive":
		conditions = append(conditions, "p.is_active = false")
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
	Cfg *config.Config
}

func NewSupplierPortalHandler(cfg *config.Config) *SupplierPortalHandler {
	return &SupplierPortalHandler{Cfg: cfg}
}

// attemptLegacySupplierMigration provisions legacy bcrypt users into Keycloak on first login
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
	if err != nil || newKCID == "" {
		return ""
	}

	u.KeycloakID = &newKCID
	_, _ = db.Pool.Exec(ctx, "UPDATE catalog.supplier_users SET keycloak_id = $1 WHERE id = $2", newKCID, u.ID)

	token, _ := loginKeycloakUser(ctx, h.Cfg, u.Email, password)
	return token
}

// Login authenticates a supplier user with email and password via Keycloak (with legacy fallback)
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
		&u.KeycloakID,
		&u.IsActive,
		&brandActive,
		&u.CreatedAt,
		&u.UpdatedAt,
	)

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
		tokenString = h.attemptLegacySupplierMigration(ctx, &u, passwordHash, req.Password)
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
		User:  &u,
	})
}

// GetProfile returns logged-in supplier info and dashboard statistics
func (h *SupplierPortalHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"Yetkisiz erişim"}`, http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var totalProducts, activeProducts, totalStock, totalVariants int
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

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"user": claims,
		"stats": map[string]int{
			"total_products":  totalProducts,
			"active_products": activeProducts,
			"total_stock":     totalStock,
			"total_variants":  totalVariants,
		},
	})
}

// ListProducts returns products belonging strictly to this supplier
func (h *SupplierPortalHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"Yetkisiz erişim"}`, http.StatusUnauthorized)
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	categoryID := strings.TrimSpace(r.URL.Query().Get("category_id"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	limit, offset := parseSupplierPagination(r)

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

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
		http.Error(w, `{"error":"Yetkisiz erişim"}`, http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"ID zorunludur"}`, http.StatusBadRequest)
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

	writeSupplierJSON(w, http.StatusOK, p)
}

// CreateProduct adds a new supplier product directly to catalog.products
func (h *SupplierPortalHandler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"Yetkisiz erişim"}`, http.StatusUnauthorized)
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

	// Insert Turkish translation
	_, _ = tx.Exec(ctx, `
		INSERT INTO catalog.product_translations (product_id, language_code, title, short_description, description)
		VALUES ($1, 'tr', $2, $3, $4)
		ON CONFLICT (product_id, language_code) DO NOTHING`,
		newProductID, req.Title, req.ShortDescription, req.Description)

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
		http.Error(w, `{"error":"Yetkisiz erişim"}`, http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"ID zorunludur"}`, http.StatusBadRequest)
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

	// Update translation
	_, _ = tx.Exec(ctx, `
		UPDATE catalog.product_translations 
		SET title = $1, short_description = $2, description = $3
		WHERE product_id = $4 AND language_code = 'tr'`,
		req.Title, req.ShortDescription, req.Description, id)

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
		http.Error(w, `{"error":"Yetkisiz erişim"}`, http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"ID zorunludur"}`, http.StatusBadRequest)
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

// UploadImage handles file upload for product photos
func (h *SupplierPortalHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"Yetkisiz erişim"}`, http.StatusUnauthorized)
		return
	}

	// Limit to 10MB
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, `{"error":"Dosya boyutu çok büyük (Max: 10MB)"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, `{"error":"Yüklenecek görsel dosyası bulunamadı"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		http.Error(w, `{"error":"Desteklenmeyen dosya formatı. Sadece JPG, PNG ve WebP kabul edilir."}`, http.StatusBadRequest)
		return
	}

	mediaRoot := getMediaDir()
	productsDir := filepath.Join(mediaRoot, "products")
	_ = os.MkdirAll(productsDir, 0755)

	filename := fmt.Sprintf("sup_%d_%s", time.Now().UnixNano(), header.Filename)
	filename = strings.ReplaceAll(filename, " ", "_")
	destPath := filepath.Join(productsDir, filename)

	dst, err := os.Create(destPath)
	if err != nil {
		log.Printf("[IMAGE UPLOAD] File create error: %v", err)
		http.Error(w, `{"error":"Dosya sunucuya yazılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, `{"error":"Dosya kopyalanamadı"}`, http.StatusInternalServerError)
		return
	}

	imageUrl := fmt.Sprintf("/uploads/products/%s", filename)
	writeSupplierJSON(w, http.StatusOK, map[string]string{
		"image_url": imageUrl,
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

