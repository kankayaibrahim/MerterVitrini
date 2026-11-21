package handlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpx"
)

var supplierSiblingSchemaOnce sync.Once

func ensureSupplierSiblingSchema(ctx context.Context) {
	if db.Pool == nil {
		return
	}
	supplierSiblingSchemaOnce.Do(func() {
		ddl := `
		CREATE INDEX IF NOT EXISTS idx_products_brand_group_id
			ON catalog.products (brand_id, source_product_group_id)
			WHERE source_product_group_id IS NOT NULL;`
		if _, err := db.Pool.Exec(ctx, ddl); err != nil {
			log.Printf("[SUPPLIER SIBLINGS] Index creation warning: %v", err)
		}
	})
}

func cleanNonEmptyStrings(items []string) []string {
	out := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	return out
}

func normalizeOptionalIDPtr(ptr *string) *string {
	if ptr == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*ptr)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func resolveFallbackCategoryForSupplier(ctx context.Context, brandID string) string {
	if db.Pool == nil {
		return ""
	}
	var catID string
	if strings.TrimSpace(brandID) != "" {
		err := db.Pool.QueryRow(ctx, `
			SELECT p.category_id::text
			FROM catalog.products p
			JOIN catalog.categories c ON c.id = p.category_id
			WHERE p.brand_id = $1
			  AND p.category_id IS NOT NULL
			  AND c.is_active = true
			ORDER BY p.created_at DESC
			LIMIT 1`, brandID).Scan(&catID)
		if err == nil && strings.TrimSpace(catID) != "" {
			return strings.TrimSpace(catID)
		}
	}

	err := db.Pool.QueryRow(ctx, `
		SELECT id::text
		FROM catalog.categories
		WHERE is_active = true
		ORDER BY node_path ASC
		LIMIT 1`).Scan(&catID)
	if err == nil {
		return strings.TrimSpace(catID)
	}
	return ""
}

func normalizeSupplierDraftOrPublishInput(ctx context.Context, brandID string, req *models.SupplierProductInput, hasExistingImages bool) error {
	if req == nil {
		return errors.New("geçersiz ürün verisi")
	}
	if req.IsDraft != nil && *req.IsDraft {
		req.IsActive = false
	}

	req.Title = strings.TrimSpace(req.Title)
	req.CategoryID = strings.TrimSpace(req.CategoryID)
	req.ColorID = normalizeOptionalIDPtr(req.ColorID)
	req.FabricID = normalizeOptionalIDPtr(req.FabricID)
	req.Images = cleanNonEmptyStrings(req.Images)
	if req.Price < 0 {
		req.Price = 0
	}
	req.Currency = strings.ToUpper(strings.TrimSpace(req.Currency))
	if req.Currency == "" {
		req.Currency = "TRY"
	}
	if req.MinimumOrderQuantity <= 0 {
		req.MinimumOrderQuantity = 1
	}

	hasImages := len(req.Images) > 0 || hasExistingImages
	if req.IsActive {
		return validatePublishedProductInput(req, hasImages)
	}

	if req.Title == "" && !hasImages {
		return errors.New("Taslak kaydetmek için en az bir ürün adı veya fotoğraf eklemelisiniz.")
	}
	if req.Title == "" {
		req.Title = fmt.Sprintf("Taslak Model %s", time.Now().Format("02.01 15:04"))
	}
	if req.CategoryID == "" && db.Pool != nil {
		req.CategoryID = resolveFallbackCategoryForSupplier(ctx, brandID)
	}
	if req.CategoryID == "" {
		return errors.New("Taslak ürün için lütfen bir kategori seçiniz.")
	}
	return nil
}

func validatePublishedProductInput(req *models.SupplierProductInput, hasImages bool) error {
	if req.Title == "" {
		return errors.New("Ürünü yayına almak için ürün adı zorunludur.")
	}
	if req.CategoryID == "" {
		return errors.New("Ürünü yayına almak için kategori seçmelisiniz.")
	}
	if req.Price <= 0 {
		return errors.New("Ürünü yayına almak için 0'dan büyük bir satış fiyatı girmelisiniz.")
	}
	if !hasImages {
		return errors.New("Ürünü yayına almak için en az 1 ürün fotoğrafı yüklemelisiniz.")
	}
	return nil
}

func mintFallbackSiblingGroupCode() string {
	return fmt.Sprintf("GRP-%s", strings.ToUpper(strconv.FormatInt(time.Now().UnixNano()/1000, 36)))
}

func mintSiblingGroupCodeFromSKU(sku string) string {
	cleanSKU := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(sku), " ", ""))
	if cleanSKU == "" {
		return mintFallbackSiblingGroupCode()
	}
	return "GRP-" + cleanSKU
}

func resolveOrLinkGroupIDTx(
	ctx context.Context,
	tx pgx.Tx,
	brandID string,
	explicitGroupID *string,
	linkWithProductID *string,
	needGroupForInlineColors bool,
) (*string, error) {
	linkID := strings.TrimSpace(derefStringOr(linkWithProductID, ""))
	if linkID != "" {
		var existingGrp, customSKU string
		err := tx.QueryRow(ctx, `
			SELECT coalesce(source_product_group_id, ''), coalesce(custom_sku, '')
			FROM catalog.products
			WHERE id = $1 AND brand_id = $2`, linkID, brandID).Scan(&existingGrp, &customSKU)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errors.New("Bağlanmak istenen ana ürün bulunamadı veya yetkiniz yok.")
			}
			return nil, fmt.Errorf("bağlanacak ürün sorgulanamadı: %w", err)
		}

		existingGrp = strings.TrimSpace(existingGrp)
		if existingGrp != "" {
			return &existingGrp, nil
		}

		minted := mintSiblingGroupCodeFromSKU(customSKU)
		if _, err := tx.Exec(ctx, `
			UPDATE catalog.products
			SET source_product_group_id = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2 AND brand_id = $3`, minted, linkID, brandID); err != nil {
			return nil, fmt.Errorf("bağlantı grubu oluşturulamadı: %w", err)
		}
		return &minted, nil
	}

	if explicit := strings.TrimSpace(derefStringOr(explicitGroupID, "")); explicit != "" {
		return &explicit, nil
	}
	if needGroupForInlineColors {
		minted := mintFallbackSiblingGroupCode()
		return &minted, nil
	}
	return nil, nil
}

func fetchSupplierSiblings(ctx context.Context, brandID, productID, groupID string) ([]models.SupplierSiblingItem, []*models.SiblingProduct) {
	items := make([]models.SupplierSiblingItem, 0)
	colorVars := make([]*models.SiblingProduct, 0)
	cleanGroup := strings.TrimSpace(groupID)
	if cleanGroup == "" || strings.TrimSpace(brandID) == "" || db.Pool == nil {
		return items, colorVars
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT
			p.id::text,
			p.title,
			p.custom_sku,
			p.slug,
			p.slug_id,
			p.color_id::text,
			COALESCE(col.color_name, 'Standart') AS color_name,
			COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY is_cover DESC, sort_order ASC LIMIT 1), '') AS image_url,
			p.price,
			COALESCE(p.currency, 'TRY') AS currency,
			p.is_active,
			COALESCE(p.source_product_group_id, '') AS source_product_group_id
		FROM catalog.products p
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE p.brand_id = $1
		  AND p.source_product_group_id = $2
		  AND ($3 = '' OR p.id::text <> $3)
		  AND COALESCE(p.is_archived, false) = false
		ORDER BY p.created_at ASC`,
		brandID, cleanGroup, strings.TrimSpace(productID))
	if err != nil {
		log.Printf("[SUPPLIER SIBLINGS] Fetch warning: %v", err)
		return items, colorVars
	}
	defer rows.Close()

	for rows.Next() {
		var item models.SupplierSiblingItem
		var slugID string
		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&item.CustomSKU,
			&item.Slug,
			&slugID,
			&item.ColorID,
			&item.Color,
			&item.ImageUrl,
			&item.Price,
			&item.Currency,
			&item.IsActive,
			&item.SourceProductGroupID,
		); err != nil {
			continue
		}
		items = append(items, item)
		colorVars = append(colorVars, &models.SiblingProduct{
			ID:        item.ID,
			CustomSku: item.CustomSKU,
			Slug:      item.Slug,
			SlugID:    slugID,
			Color:     item.Color,
			ImageUrl:  item.ImageUrl,
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("[SUPPLIER SIBLINGS] Rows iteration warning: %v", err)
	}
	return items, colorVars
}

func hasExistingProductImages(ctx context.Context, productID string) bool {
	if db.Pool == nil || strings.TrimSpace(productID) == "" {
		return false
	}
	var exists bool
	if err := db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM catalog.product_images WHERE product_id = $1)`, productID).Scan(&exists); err != nil {
		return false
	}
	return exists
}

type supplierProductInsertParams struct {
	BrandID              string
	SourceProductID      string
	SourceProductGroupID *string
	Title                string
	ShortDescription     string
	Description          string
	CategoryID           string
	ColorID              *string
	FabricID             *string
	Gender               string
	Season               string
	BuyingPrice          float64
	Price                float64
	Currency             string
	PackingRatio         string
	SeriesRatio          string
	MinimumOrderQuantity int
	SeriesStock          int
	InitialStock         int
	IsActive             bool
	Images               []string
	Variants             []models.SupplierProductVariantInput
	Translations         map[string]models.SupplierTranslationInput
}

type createdBatchDraftItem struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	CustomSKU  string `json:"custom_sku"`
	CoverImage string `json:"cover_image"`
}

func insertSupplierProductRowTx(ctx context.Context, tx pgx.Tx, p supplierProductInsertParams) (createdBatchDraftItem, string, error) {
	const insertSQL = `
		INSERT INTO catalog.products (
			brand_id, feed_id, source_product_id, source_product_group_id, title, short_description, description,
			category_id, color_id, fabric_id, gender, season,
			buying_price, price, currency, packing_ratio, series_ratio,
			minimum_order_quantity, series_stock, stock, is_active
		) VALUES (
			$1, NULL, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16,
			$17, $18, $19, $20
		) RETURNING id, custom_sku, slug`

	var newID, customSKU, slug string
	err := tx.QueryRow(
		ctx,
		insertSQL,
		p.BrandID,
		p.SourceProductID,
		p.SourceProductGroupID,
		p.Title,
		p.ShortDescription,
		p.Description,
		p.CategoryID,
		p.ColorID,
		p.FabricID,
		p.Gender,
		p.Season,
		p.BuyingPrice,
		p.Price,
		p.Currency,
		p.PackingRatio,
		p.SeriesRatio,
		p.MinimumOrderQuantity,
		p.SeriesStock,
		p.InitialStock,
		p.IsActive,
	).Scan(&newID, &customSKU, &slug)
	if err != nil {
		return createdBatchDraftItem{}, "", err
	}

	upsertSupplierProductTranslations(ctx, tx, newID, p.Title, p.ShortDescription, p.Description, p.Translations)
	insertProductVariants(ctx, tx, newID, p.SourceProductID, p.Variants, p.InitialStock)
	insertProductImages(ctx, tx, newID, p.Images)

	cover := ""
	if len(p.Images) > 0 {
		cover = p.Images[0]
	}
	return createdBatchDraftItem{
		ID:         newID,
		Title:      p.Title,
		CustomSKU:  customSKU,
		CoverImage: cover,
	}, slug, nil
}

func hasNonEmptyColorVariantDrafts(variants []models.SupplierColorVariantDraftInput) bool {
	for _, v := range variants {
		if normalizeOptionalIDPtr(v.ColorID) != nil || len(cleanNonEmptyStrings(v.Images)) > 0 || strings.TrimSpace(v.Title) != "" {
			return true
		}
	}
	return false
}

func insertAdditionalColorVariantsTx(
	ctx context.Context,
	tx pgx.Tx,
	brandID string,
	req *models.SupplierProductInput,
	groupID *string,
	initialStock int,
) ([]string, []string, error) {
	siblingIDs := make([]string, 0, len(req.AdditionalColorVariants))
	activeSlugs := make([]string, 0, len(req.AdditionalColorVariants))

	for idx, v := range req.AdditionalColorVariants {
		imgs := cleanNonEmptyStrings(v.Images)
		colorID := normalizeOptionalIDPtr(v.ColorID)
		title := strings.TrimSpace(v.Title)
		if colorID == nil && len(imgs) == 0 && title == "" {
			continue
		}
		if title == "" {
			title = req.Title
		}

		price := req.Price
		if v.Price != nil {
			price = *v.Price
			if price < 0 {
				price = 0
			}
		}

		isActive := resolveInlineVariantActiveState(req, v, price, len(imgs) > 0)
		if isActive && (price <= 0 || len(imgs) == 0) {
			return nil, nil, errors.New("Ek renk varyantını yayına almak için fiyat (> 0) ve en az 1 fotoğraf eklemelisiniz.")
		}

		sourceProductID := fmt.Sprintf("SUP-%d-%d", time.Now().UnixNano(), idx+1)
		created, slug, err := insertSupplierProductRowTx(ctx, tx, supplierProductInsertParams{
			BrandID:              brandID,
			SourceProductID:      sourceProductID,
			SourceProductGroupID: groupID,
			Title:                title,
			ShortDescription:     req.ShortDescription,
			Description:          req.Description,
			CategoryID:           req.CategoryID,
			ColorID:              colorID,
			FabricID:             req.FabricID,
			Gender:               req.Gender,
			Season:               req.Season,
			BuyingPrice:          req.BuyingPrice,
			Price:                price,
			Currency:             req.Currency,
			PackingRatio:         req.PackingRatio,
			SeriesRatio:          req.SeriesRatio,
			MinimumOrderQuantity: req.MinimumOrderQuantity,
			SeriesStock:          req.SeriesStock,
			InitialStock:         initialStock,
			IsActive:             isActive,
			Images:               imgs,
			Variants:             req.Variants,
			Translations:         req.Translations,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("ek renk varyantı oluşturulamadı: %w", err)
		}
		siblingIDs = append(siblingIDs, created.ID)
		if isActive && slug != "" {
			activeSlugs = append(activeSlugs, slug)
		}
	}
	return siblingIDs, activeSlugs, nil
}

func resolveInlineVariantActiveState(req *models.SupplierProductInput, v models.SupplierColorVariantDraftInput, price float64, hasImg bool) bool {
	if req.IsDraft != nil && *req.IsDraft {
		return false
	}
	if v.IsActive != nil {
		return *v.IsActive
	}
	if !req.IsActive {
		return false
	}
	return price > 0 && hasImg
}

// ListProductSiblings handles GET /api/v1/supplier/products/{id}/siblings.
func (h *SupplierPortalHandler) ListProductSiblings(w http.ResponseWriter, r *http.Request) {
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

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var groupID string
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(source_product_group_id, '')
		FROM catalog.products
		WHERE id = $1 AND brand_id = $2`, id, claims.BrandID).Scan(&groupID)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "Ürün bulunamadı veya bu ürüne erişim yetkiniz yok")
		return
	}

	siblings, _ := fetchSupplierSiblings(ctx, claims.BrandID, id, groupID)
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"source_product_group_id": strings.TrimSpace(groupID),
		"siblings":                siblings,
	})
}

type linkSiblingsRequest struct {
	TargetProductIDs []string `json:"target_product_ids"`
	GroupCode        string   `json:"group_code"`
}

func resolveGroupIDForLinkTx(ctx context.Context, tx pgx.Tx, brandID, currentGroup, customSKU, reqGroupCode string, targetIDs []string) string {
	if g := strings.TrimSpace(currentGroup); g != "" {
		return g
	}
	if len(targetIDs) > 0 {
		var existingTargetGroup string
		err := tx.QueryRow(ctx, `
			SELECT COALESCE(source_product_group_id, '')
			FROM catalog.products
			WHERE id::text = ANY($1)
			  AND brand_id = $2
			  AND COALESCE(source_product_group_id, '') <> ''
			  AND COALESCE(is_archived, false) = false
			LIMIT 1`, targetIDs, brandID).Scan(&existingTargetGroup)
		if err == nil && strings.TrimSpace(existingTargetGroup) != "" {
			return strings.TrimSpace(existingTargetGroup)
		}
	}
	if g := strings.TrimSpace(reqGroupCode); g != "" {
		return g
	}
	return mintSiblingGroupCodeFromSKU(customSKU)
}

// LinkProductSiblings handles POST /api/v1/supplier/products/{id}/siblings.
func (h *SupplierPortalHandler) LinkProductSiblings(w http.ResponseWriter, r *http.Request) {
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

	var req linkSiblingsRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz veri biçimi")
		return
	}

	cleanedTargets := cleanNonEmptyStrings(req.TargetProductIDs)
	targetIDs := make([]string, 0, len(cleanedTargets))
	for _, tid := range cleanedTargets {
		if tid != id {
			targetIDs = append(targetIDs, tid)
		}
	}
	if len(targetIDs) == 0 && strings.TrimSpace(req.GroupCode) == "" {
		httpx.Error(w, http.StatusBadRequest, "Bağlanacak en az bir hedef ürün seçmelisiniz")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	ensureSupplierSiblingSchema(ctx)

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Veritabanı işlemi başlatılamadı")
		return
	}
	defer tx.Rollback(ctx)

	var currentGroup, customSKU string
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(source_product_group_id, ''), COALESCE(custom_sku, '')
		FROM catalog.products
		WHERE id = $1 AND brand_id = $2`, id, claims.BrandID).Scan(&currentGroup, &customSKU)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "Ürün bulunamadı veya bu ürüne erişim yetkiniz yok")
		return
	}

	groupID := resolveGroupIDForLinkTx(ctx, tx, claims.BrandID, currentGroup, customSKU, req.GroupCode, targetIDs)

	if _, err := tx.Exec(ctx, `
		UPDATE catalog.products
		SET source_product_group_id = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND brand_id = $3`, groupID, id, claims.BrandID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Ana ürün renk grubu güncellenemedi")
		return
	}

	if len(targetIDs) > 0 {
		if _, err := tx.Exec(ctx, `
			UPDATE catalog.products
			SET source_product_group_id = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id::text = ANY($2)
			  AND brand_id = $3
			  AND COALESCE(is_archived, false) = false`, groupID, targetIDs, claims.BrandID); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "Seçilen ürünler renk grubuna bağlanamadı")
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Bağlantı işlemi onaylanamadı")
		return
	}

	triggerProductMVRefresh()
	siblings, _ := fetchSupplierSiblings(ctx, claims.BrandID, id, groupID)
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"source_product_group_id": groupID,
		"siblings":                siblings,
	})
}

// UnlinkProductSibling handles DELETE /api/v1/supplier/products/{id}/siblings/{targetId}.
func (h *SupplierPortalHandler) UnlinkProductSibling(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	targetID := strings.TrimSpace(r.PathValue("targetId"))
	if id == "" || targetID == "" {
		httpx.Error(w, http.StatusBadRequest, "Ürün ve hedef kardeş ürün kimliği zorunludur")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Veritabanı işlemi başlatılamadı")
		return
	}
	defer tx.Rollback(ctx)

	var groupID string
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(source_product_group_id, '')
		FROM catalog.products
		WHERE id = $1 AND brand_id = $2`, id, claims.BrandID).Scan(&groupID); err != nil {
		httpx.Error(w, http.StatusNotFound, "Ürün bulunamadı veya bu ürüne erişim yetkiniz yok")
		return
	}

	groupID = strings.TrimSpace(groupID)
	if groupID == "" {
		writeSupplierJSON(w, http.StatusOK, map[string]any{
			"source_product_group_id": "",
			"siblings":                []models.SupplierSiblingItem{},
		})
		return
	}

	res, err := tx.Exec(ctx, `
		UPDATE catalog.products
		SET source_product_group_id = NULL, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND brand_id = $2 AND source_product_group_id = $3`, targetID, claims.BrandID, groupID)
	if err != nil || res.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "Gruptan çıkarılacak kardeş ürün bulunamadı")
		return
	}

	var remaining int
	if err := tx.QueryRow(ctx, `
		SELECT count(*)
		FROM catalog.products
		WHERE brand_id = $1
		  AND source_product_group_id = $2
		  AND COALESCE(is_archived, false) = false`, claims.BrandID, groupID).Scan(&remaining); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Kalan grup üyeleri kontrol edilemedi")
		return
	}

	if remaining <= 1 {
		if _, err := tx.Exec(ctx, `
			UPDATE catalog.products
			SET source_product_group_id = NULL, updated_at = CURRENT_TIMESTAMP
			WHERE brand_id = $1 AND source_product_group_id = $2`, claims.BrandID, groupID); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "Son kalan grup bağı temizlenemedi")
			return
		}
		groupID = ""
	} else if targetID == id {
		groupID = ""
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Ayırma işlemi onaylanamadı")
		return
	}

	triggerProductMVRefresh()
	siblings, _ := fetchSupplierSiblings(ctx, claims.BrandID, id, groupID)
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"source_product_group_id": groupID,
		"siblings":                siblings,
	})
}

type BatchDraftCreateRequest struct {
	Mode              string   `json:"mode"` // "per_photo" | "single_product" | "color_siblings"
	ImageURLs         []string `json:"image_urls"`
	TitlePrefix       string   `json:"title_prefix"`
	CategoryID        string   `json:"category_id"`
	Price             float64  `json:"price"`
	Currency          string   `json:"currency"`
	SelectedSizes     []string `json:"selected_sizes,omitempty"`
	SeriesRatio       string   `json:"series_ratio,omitempty"`
	SeriesStock                   int      `json:"series_stock,omitempty"`
	ContentResponsibilityAccepted *bool    `json:"content_responsibility_accepted,omitempty"`
	LinkWithProductID             *string  `json:"link_with_product_id,omitempty"`
}

func normalizeBatchDraftMode(raw string) (string, error) {
	mode := strings.ToLower(strings.TrimSpace(raw))
	if mode == "" {
		return "per_photo", nil
	}
	switch mode {
	case "per_photo", "single_product", "color_siblings":
		return mode, nil
	default:
		return "", errors.New("Geçersiz taslak oluşturma modu (per_photo, single_product veya color_siblings olmalıdır)")
	}
}

type batchDraftSpec struct {
	title  string
	images []string
}

func buildBatchDraftSpecs(mode, titlePrefix string, imageURLs []string) []batchDraftSpec {
	prefix := strings.TrimSpace(titlePrefix)
	if prefix == "" {
		prefix = fmt.Sprintf("Taslak Model %s", time.Now().Format("02.01 15:04"))
	}
	if mode == "single_product" {
		return []batchDraftSpec{{title: prefix, images: imageURLs}}
	}
	specs := make([]batchDraftSpec, 0, len(imageURLs))
	for idx, imgURL := range imageURLs {
		specs = append(specs, batchDraftSpec{
			title:  fmt.Sprintf("%s #%d", prefix, idx+1),
			images: []string{imgURL},
		})
	}
	return specs
}

func insertBatchDraftRowsTx(
	ctx context.Context,
	tx pgx.Tx,
	brandID, categoryID, currency string,
	price float64,
	groupID *string,
	templateReq *models.SupplierProductInput,
	initialStock int,
	specs []batchDraftSpec,
) ([]createdBatchDraftItem, error) {
	created := make([]createdBatchDraftItem, 0, len(specs))
	baseStamp := time.Now().UnixNano()
	for idx, spec := range specs {
		sourceProductID := fmt.Sprintf("SUP-%d-%d", baseStamp, idx+1)
		item, _, err := insertSupplierProductRowTx(ctx, tx, supplierProductInsertParams{
			BrandID:              brandID,
			SourceProductID:      sourceProductID,
			SourceProductGroupID: groupID,
			Title:                spec.title,
			CategoryID:           categoryID,
			Price:                price,
			Currency:             currency,
			PackingRatio:         templateReq.PackingRatio,
			SeriesRatio:          templateReq.SeriesRatio,
			MinimumOrderQuantity: templateReq.MinimumOrderQuantity,
			SeriesStock:          templateReq.SeriesStock,
			InitialStock:         initialStock,
			IsActive:             false,
			Images:               spec.images,
			Variants:             templateReq.Variants,
		})
		if err != nil {
			return nil, err
		}
		created = append(created, item)
	}
	return created, nil
}

// BatchCreateDraftProducts handles POST /api/v1/supplier/products/batch-drafts.
func (h *SupplierPortalHandler) BatchCreateDraftProducts(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	var req BatchDraftCreateRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz veri biçimi")
		return
	}
	if declErr := validateSupplierContentDeclaration(req.ContentResponsibilityAccepted); declErr != nil {
		httpx.Error(w, http.StatusBadRequest, declErr.Error())
		return
	}

	imageURLs := cleanNonEmptyStrings(req.ImageURLs)
	if len(imageURLs) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Toplu taslak oluşturmak için en az 1 fotoğraf eklemelisiniz")
		return
	}
	if len(imageURLs) > 30 {
		imageURLs = imageURLs[:30]
	}

	mode, err := normalizeBatchDraftMode(req.Mode)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()
	ensureSupplierSiblingSchema(ctx)

	categoryID := strings.TrimSpace(req.CategoryID)
	if categoryID == "" {
		categoryID = resolveFallbackCategoryForSupplier(ctx, claims.BrandID)
	}
	if categoryID == "" {
		httpx.Error(w, http.StatusBadRequest, "Taslak ürünler için geçerli bir kategori seçmelisiniz")
		return
	}

	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "TRY"
	}
	price := max(req.Price, 0)
	seriesStock := req.SeriesStock
	if seriesStock <= 0 {
		seriesStock = defaultSupplierSeriesStock
	}

	templateReq := models.SupplierProductInput{
		SelectedSizes: req.SelectedSizes,
		SeriesRatio:   req.SeriesRatio,
		SeriesStock:   seriesStock,
	}
	initialStock, normErr := resolveSupplierSeriesAndVariants(ctx, &templateReq, "")
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

	linkWith := normalizeOptionalIDPtr(req.LinkWithProductID)
	var groupID *string
	if mode == "color_siblings" || linkWith != nil {
		groupID, err = resolveOrLinkGroupIDTx(ctx, tx, claims.BrandID, nil, linkWith, mode == "color_siblings")
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	specs := buildBatchDraftSpecs(mode, req.TitlePrefix, imageURLs)
	created, insertErr := insertBatchDraftRowsTx(ctx, tx, claims.BrandID, categoryID, currency, price, groupID, &templateReq, initialStock, specs)
	if insertErr != nil {
		log.Printf("[SUPPLIER BATCH DRAFT] Insert error: %v", insertErr)
		httpx.Error(w, http.StatusInternalServerError, "Taslak ürünler kaydedilemedi")
		return
	}

	createdIDs := make([]string, 0, len(created))
	for _, item := range created {
		createdIDs = append(createdIDs, item.ID)
	}
	contentVer := resolveActivePolicyVersion(ctx, "supplier_agreement")
	if stampErr := stampProductsContentResponsibilityTx(ctx, tx, createdIDs, isExplicitlyAccepted(req.ContentResponsibilityAccepted), contentVer); stampErr != nil {
		httpx.Error(w, http.StatusInternalServerError, "Taslak hukuki onayı kaydedilemedi")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Taslak işlemi onaylanamadı")
		return
	}

	if req.ContentResponsibilityAccepted != nil && *req.ContentResponsibilityAccepted {
		recordLegalConsentAsync(legalConsentLogEntry{
			ConsentType:  "supplier_batch_draft",
			PolicyType:   "supplier_agreement",
			ActorRole:    "supplier",
			ActorUserID:  claims.UserID,
			BrandID:      claims.BrandID,
			EntityType:   "product",
			EntityID:     formatConsentEntityIDs(createdIDs),
			Email:        claims.Email,
			IPAddress:    getClientIP(r),
			UserAgent:    r.UserAgent(),
			AcceptedText: supplierContentDeclarationMsg,
			Metadata:     map[string]any{"created_count": len(created), "mode": mode},
		})
	}

	triggerProductMVRefresh()
	writeSupplierJSON(w, http.StatusCreated, map[string]any{
		"created_count":           len(created),
		"source_product_group_id": derefStringOr(groupID, ""),
		"products":                created,
	})
}
