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
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/admin/backend/db"
	"mertervitrini/admin/backend/models"
)

type CatalogHandler struct{}

func NewCatalogHandler() *CatalogHandler {
	return &CatalogHandler{}
}

// --- CATEGORY HANDLERS ---

// ListCategories fetches all categories and builds a hierarchical tree
func (h *CatalogHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT c.id, c.parent_id, c.title, c.slug, c.node_path, c.is_active, c.created_at, c.updated_at,
		       COALESCE(
		           (SELECT json_object_agg(ct.language_code, json_build_object('category_id', ct.category_id, 'language_code', ct.language_code, 'title', ct.title, 'seo_description', ct.seo_description))
		            FROM catalog.category_translations ct
		            WHERE ct.category_id = c.id), '{}'::json
		       ) as translations_json
		FROM catalog.categories c 
		ORDER BY c.node_path::text`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to query categories: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var categories []*models.Category
	for rows.Next() {
		var c models.Category
		var transBytes []byte
		err := rows.Scan(&c.ID, &c.ParentID, &c.Title, &c.Slug, &c.NodePath, &c.IsActive, &c.CreatedAt, &c.UpdatedAt, &transBytes)
		if err != nil {
			log.Printf("Failed to scan category: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		if len(transBytes) > 0 {
			json.Unmarshal(transBytes, &c.Translations)
		}
		categories = append(categories, &c)
	}

	tree := buildCategoryTree(categories)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tree)
}

// CreateCategory adds a new category and lets DB calculate ltree node_path
func (h *CatalogHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ParentID     *string                                `json:"parent_id"`
		Title        string                                 `json:"title"`
		IsActive     bool                                   `json:"is_active"`
		Translations map[string]models.CategoryTranslation `json:"translations"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, `{"error":"Category title is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO catalog.categories (parent_id, title, slug, is_active) 
		VALUES ($1, $2, catalog.fn_slugify($3), $4) 
		RETURNING id, parent_id, title, slug, node_path, is_active, created_at, updated_at`

	var c models.Category
	err = tx.QueryRow(ctx, query, req.ParentID, req.Title, req.Title, req.IsActive).Scan(
		&c.ID, &c.ParentID, &c.Title, &c.Slug, &c.NodePath, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		log.Printf("Failed to create category: %v", err)
		http.Error(w, `{"error":"Failed to create category"}`, http.StatusInternalServerError)
		return
	}

	c.Translations = make(map[string]models.CategoryTranslation)

	insertTranslationQuery := `
		INSERT INTO catalog.category_translations (category_id, language_code, title, seo_description)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (category_id, language_code) DO UPDATE SET title = EXCLUDED.title, seo_description = EXCLUDED.seo_description`

	for lang, t := range req.Translations {
		title := strings.TrimSpace(t.Title)
		if title == "" {
			title = req.Title
		}
		var seoDesc *string
		if t.SeoDescription != nil && strings.TrimSpace(*t.SeoDescription) != "" {
			trimmed := strings.TrimSpace(*t.SeoDescription)
			seoDesc = &trimmed
		}

		_, err = tx.Exec(ctx, insertTranslationQuery, c.ID, lang, title, seoDesc)
		if err != nil {
			log.Printf("Failed to insert category translation for %s: %v", lang, err)
			http.Error(w, `{"error":"Failed to save category translations"}`, http.StatusInternalServerError)
			return
		}

		c.Translations[lang] = models.CategoryTranslation{
			CategoryID:     c.ID,
			LanguageCode:   lang,
			Title:          title,
			SeoDescription: seoDesc,
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

// UpdateCategory updates category fields and lets DB triggers automatically handle ltree paths
func (h *CatalogHandler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Category ID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		ParentID     *string                                `json:"parent_id"`
		Title        string                                 `json:"title"`
		IsActive     bool                                   `json:"is_active"`
		Translations map[string]models.CategoryTranslation `json:"translations"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, `{"error":"Category title is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Check if parent_id is the same as category ID to prevent self-referencing hierarchy loops
	if req.ParentID != nil && *req.ParentID == id {
		http.Error(w, `{"error":"A category cannot be its own parent"}`, http.StatusBadRequest)
		return
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	query := `
		UPDATE catalog.categories 
		SET parent_id = $1, title = $2, slug = catalog.fn_slugify($3), is_active = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $5
		RETURNING id, parent_id, title, slug, node_path, is_active, created_at, updated_at`

	var c models.Category
	err = tx.QueryRow(ctx, query, req.ParentID, req.Title, req.Title, req.IsActive, id).Scan(
		&c.ID, &c.ParentID, &c.Title, &c.Slug, &c.NodePath, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Category not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update category %s: %v", id, err)
		http.Error(w, `{"error":"Failed to update category"}`, http.StatusInternalServerError)
		return
	}

	// Delete old translations
	_, err = tx.Exec(ctx, "DELETE FROM catalog.category_translations WHERE category_id = $1", id)
	if err != nil {
		log.Printf("Failed to clear old category translations: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	c.Translations = make(map[string]models.CategoryTranslation)

	insertTranslationQuery := `
		INSERT INTO catalog.category_translations (category_id, language_code, title, seo_description)
		VALUES ($1, $2, $3, $4)`

	for lang, t := range req.Translations {
		title := strings.TrimSpace(t.Title)
		if title == "" {
			title = req.Title
		}
		var seoDesc *string
		if t.SeoDescription != nil && strings.TrimSpace(*t.SeoDescription) != "" {
			trimmed := strings.TrimSpace(*t.SeoDescription)
			seoDesc = &trimmed
		}

		_, err = tx.Exec(ctx, insertTranslationQuery, c.ID, lang, title, seoDesc)
		if err != nil {
			log.Printf("Failed to insert category translation for %s: %v", lang, err)
			http.Error(w, `{"error":"Failed to save category translations"}`, http.StatusInternalServerError)
			return
		}

		c.Translations[lang] = models.CategoryTranslation{
			CategoryID:     c.ID,
			LanguageCode:   lang,
			Title:          title,
			SeoDescription: seoDesc,
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

// DeleteCategory deletes a category by UUID (DB automatically sets children's parent_id to NULL)
func (h *CatalogHandler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Category ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM catalog.categories WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete category %s: %v", id, err)
		http.Error(w, `{"error":"Failed to delete category"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"Category not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// buildCategoryTree is a helper to convert a flat sorted list of categories into a tree structure
func buildCategoryTree(flat []*models.Category) []*models.CategoryNode {
	nodesMap := make(map[string]*models.CategoryNode)
	var rootNodes []*models.CategoryNode

	// First pass: Instantiate nodes
	for _, c := range flat {
		nodesMap[c.ID] = &models.CategoryNode{
			ID:           c.ID,
			ParentID:     c.ParentID,
			Title:        c.Title,
			Slug:         c.Slug,
			NodePath:     c.NodePath,
			IsActive:     c.IsActive,
			Translations: c.Translations,
			Children:     make([]*models.CategoryNode, 0),
		}
	}

	// Second pass: Link parents and children
	for _, c := range flat {
		node := nodesMap[c.ID]
		if c.ParentID == nil || *c.ParentID == "" {
			rootNodes = append(rootNodes, node)
		} else {
			if parent, exists := nodesMap[*c.ParentID]; exists {
				parent.Children = append(parent.Children, node)
			} else {
				// Fallback to root if parent not found in result
				rootNodes = append(rootNodes, node)
			}
		}
	}

	return rootNodes
}

// --- PRODUCT HANDLERS ---

// ListProducts lists products with support for pagination, search, category/brand filters
func (h *CatalogHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Read query parameters
	q := r.URL.Query().Get("q")
	brandID := r.URL.Query().Get("brand_id")
	categoryID := r.URL.Query().Get("category_id")
	
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 20
	offset := 0

	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Dynamic Query Builder
	filterSQL := ""
	args := []any{}
	argIndex := 1

	if q != "" {
		words := strings.Fields(q)
		for _, word := range words {
			if trimmed := strings.TrimSpace(word); trimmed != "" {
				filterSQL += fmt.Sprintf(` AND (
					p.title ILIKE $%d 
					OR p.custom_sku ILIKE $%d 
					OR p.description ILIKE $%d 
					OR c.title ILIKE $%d 
					OR b.brand_name ILIKE $%d 
					OR fab.fabric_name ILIKE $%d
					OR EXISTS (
						SELECT 1 FROM catalog.colors col WHERE p.color_id = col.id AND col.color_name ILIKE $%d
					)
					OR EXISTS (
						SELECT 1 
						FROM catalog.product_attributes_map pam 
						JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id 
						WHERE pam.product_id = p.id AND av.attribute_value ILIKE $%d
					)
				)`, argIndex, argIndex, argIndex, argIndex, argIndex, argIndex, argIndex, argIndex)
				args = append(args, "%"+trimmed+"%")
				argIndex++
			}
		}
	}

	if brandID != "" {
		filterSQL += fmt.Sprintf(" AND p.brand_id = $%d", argIndex)
		args = append(args, brandID)
		argIndex++
	}

	if categoryID != "" {
		// Beautiful ltree query matching requested category and all its children subpaths recursively
		filterSQL += fmt.Sprintf(" AND (p.category_id = $%d OR p.category_id IN (SELECT id FROM catalog.categories WHERE node_path <@ (SELECT node_path FROM catalog.categories WHERE id = $%d)))", argIndex, argIndex)
		args = append(args, categoryID)
		argIndex++
	}

	// 1. Get total count matching current filters
	var totalCount int
	countQuery := `
		SELECT COUNT(*) 
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON p.brand_id = b.id
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		WHERE 1=1` + filterSQL

	err := db.Pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		log.Printf("Failed to count products: %v", err)
		totalCount = 0
	}

	// 2. Fetch paginated products
	sqlQuery := `
		SELECT p.id, p.feed_id, p.source_product_id, p.title, p.slug, p.custom_sku, 
		       p.short_description, p.description, p.brand_id, p.category_id, 
		       p.gender, p.season, COALESCE(fab.fabric_name, 'Polyester') as kumas_fabric, p.desi_volume, p.shipping_weight_kg, 
		       p.packing_ratio, p.series_ratio, p.minimum_order_quantity, p.is_active, 
		       p.created_at, p.updated_at, b.brand_name as brand_name, c.title as category_title,
		       p.source_url,
		       COALESCE(
		           (SELECT json_agg(json_build_object('id', img.id, 'product_id', img.product_id, 'image_url', img.image_url, 'sort_order', img.sort_order, 'is_cover', img.is_cover))
		            FROM catalog.product_images img
		            WHERE img.product_id = p.id), '[]'::json
		       ) as images_json
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON p.brand_id = b.id
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		LEFT JOIN catalog.fabrics fab ON p.fabric_id = fab.id
		WHERE 1=1` + filterSQL + fmt.Sprintf(" ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)

	paginatedArgs := append(args, limit, offset)

	rows, err := db.Pool.Query(ctx, sqlQuery, paginatedArgs...)
	if err != nil {
		log.Printf("Failed to list products: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	products := []*models.Product{}
	for rows.Next() {
		var p models.Product
		var imagesBytes []byte
		err := rows.Scan(
			&p.ID, &p.FeedID, &p.SourceProductID, &p.Title, &p.Slug, &p.CustomSku,
			&p.ShortDescription, &p.Description, &p.BrandID, &p.CategoryID,
			&p.Gender, &p.Season, &p.KumasFabric, &p.DesiVolume, &p.ShippingWeightKg,
			&p.PackingRatio, &p.SeriesRatio, &p.MinimumOrderQty, &p.IsActive,
			&p.CreatedAt, &p.UpdatedAt, &p.BrandName, &p.CategoryTitle,
			&p.SourceURL, &imagesBytes,
		)
		if err != nil {
			log.Printf("Failed to scan product: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		if len(imagesBytes) > 0 {
			json.Unmarshal(imagesBytes, &p.Images)
		}
		products = append(products, &p)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Total-Count", strconv.Itoa(totalCount))
	w.Header().Set("Access-Control-Expose-Headers", "X-Total-Count")
	json.NewEncoder(w).Encode(products)
}

// GetProductByID returns detailed product along with variants and images
func (h *CatalogHandler) GetProductByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Go 1.22 wildcard path parameter extraction
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Product ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var p models.Product
	prodQuery := `
		SELECT p.id, p.feed_id, p.source_product_id, p.title, p.slug, p.custom_sku, 
		       p.short_description, p.description, p.brand_id, p.category_id, 
		       p.gender, p.season, COALESCE(fab.fabric_name, 'Polyester') as kumas_fabric, p.desi_volume, p.shipping_weight_kg, 
		       p.packing_ratio, p.series_ratio, p.minimum_order_quantity, p.is_active, 
		       p.created_at, p.updated_at, b.brand_name as brand_name, c.title as category_title,
		       p.source_url, COALESCE(p.source_product_group_id, '')
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON p.brand_id = b.id
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		LEFT JOIN catalog.fabrics fab ON p.fabric_id = fab.id
		WHERE p.id = $1`

	err := db.Pool.QueryRow(ctx, prodQuery, id).Scan(
		&p.ID, &p.FeedID, &p.SourceProductID, &p.Title, &p.Slug, &p.CustomSku,
		&p.ShortDescription, &p.Description, &p.BrandID, &p.CategoryID,
		&p.Gender, &p.Season, &p.KumasFabric, &p.DesiVolume, &p.ShippingWeightKg,
		&p.PackingRatio, &p.SeriesRatio, &p.MinimumOrderQty, &p.IsActive,
		&p.CreatedAt, &p.UpdatedAt, &p.BrandName, &p.CategoryTitle,
		&p.SourceURL, &p.SourceProductGroupID,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Product not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to fetch product %s: %v", id, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	// Fetch Variants
	var variants []*models.ProductVariant
	variantQuery := `
		SELECT id, product_id, source_variant_id, custom_sku AS sku, custom_sku, barcode, stock, 0.0 AS price, 
		       NULL AS discounted_price, 10.0 AS tax_rate, 'TRY' AS currency, NULL AS color, variant_size AS size, is_active, created_at, updated_at
		FROM catalog.product_variants
		WHERE product_id = $1`
	
	vRows, err := db.Pool.Query(ctx, variantQuery, id)
	if err == nil {
		defer vRows.Close()
		for vRows.Next() {
			var v models.ProductVariant
			err := vRows.Scan(
				&v.ID, &v.ProductID, &v.SourceVariantID, &v.Sku, &v.CustomSku, &v.Barcode,
				&v.Stock, &v.Price, &v.DiscountedPrice, &v.TaxRate, &v.Currency, &v.Color, &v.Size,
				&v.IsActive, &v.CreatedAt, &v.UpdatedAt,
			)
			if err == nil {
				variants = append(variants, &v)
			}
		}
	}
	p.Variants = variants

	// Fetch Other Colors in the Same Group
	var groupProducts []*models.GroupProductColor
	if p.SourceProductGroupID != "" {
		var feedIDStr string
		if p.FeedID != nil {
			feedIDStr = *p.FeedID
		}
		
		groupQuery := `
			SELECT gp.id, gp.source_product_id, COALESCE(col.color_name, 'Standart') as color, gp.custom_sku, gp.stock,
			       COALESCE((SELECT img.image_url FROM catalog.product_images img WHERE img.product_id = gp.id AND img.is_cover = true LIMIT 1), '') as cover_image_url
			FROM catalog.products gp
			LEFT JOIN catalog.colors col ON gp.color_id = col.id
			WHERE gp.feed_id = $1 AND gp.source_product_group_id = $2 AND gp.is_active = true
			ORDER BY col.color_name ASC`
		
		gRows, err := db.Pool.Query(ctx, groupQuery, feedIDStr, p.SourceProductGroupID)
		if err == nil {
			defer gRows.Close()
			for gRows.Next() {
				var gp models.GroupProductColor
				var coverImg string
				err := gRows.Scan(&gp.ID, &gp.SourceProductID, &gp.Color, &gp.CustomSku, &gp.Stock, &coverImg)
				if err == nil {
					if coverImg != "" {
						gp.CoverImageUrl = &coverImg
					}
					groupProducts = append(groupProducts, &gp)
				}
			}
		}
	}
	p.GroupProducts = groupProducts

	// Fetch Images
	var images []*models.ProductImage
	imageQuery := `
		SELECT id, product_id, image_url, sort_order, is_cover, created_at
		FROM catalog.product_images
		WHERE product_id = $1
		ORDER BY sort_order ASC`

	iRows, err := db.Pool.Query(ctx, imageQuery, id)
	if err == nil {
		defer iRows.Close()
		for iRows.Next() {
			var img models.ProductImage
			err := iRows.Scan(&img.ID, &img.ProductID, &img.ImageUrl, &img.SortOrder, &img.IsCover, &img.CreatedAt)
			if err == nil {
				images = append(images, &img)
			}
		}
	}
	p.Images = images

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

// GetSettings fetches the global storefront settings (for admin view)
func (h *CatalogHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var s models.Settings
	query := `SELECT id, address, phone, whatsapp, email, show_single_price, updated_at FROM catalog.settings LIMIT 1`
	err := db.Pool.QueryRow(ctx, query).Scan(&s.ID, &s.Address, &s.Phone, &s.Whatsapp, &s.Email, &s.ShowSinglePrice, &s.UpdatedAt)
	if err != nil {
		log.Printf("[ADMIN API ERROR] Failed to fetch settings: %v", err)
		http.Error(w, `{"error":"Failed to fetch settings"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

// UpdateSettings updates the global storefront settings using singleton UPSERT
func (h *CatalogHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Address         string `json:"address"`
		Phone           string `json:"phone"`
		Whatsapp        string `json:"whatsapp"`
		Email           string `json:"email"`
		ShowSinglePrice bool   `json:"show_single_price"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Address == "" || req.Phone == "" || req.Whatsapp == "" || req.Email == "" {
		http.Error(w, `{"error":"All fields (address, phone, whatsapp, email) are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO catalog.settings (address, phone, whatsapp, email, show_single_price)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (singleton_guard) DO UPDATE SET
			address = EXCLUDED.address,
			phone = EXCLUDED.phone,
			whatsapp = EXCLUDED.whatsapp,
			email = EXCLUDED.email,
			show_single_price = EXCLUDED.show_single_price,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id, address, phone, whatsapp, email, show_single_price, updated_at`

	var s models.Settings
	err := db.Pool.QueryRow(ctx, query, req.Address, req.Phone, req.Whatsapp, req.Email, req.ShowSinglePrice).Scan(
		&s.ID, &s.Address, &s.Phone, &s.Whatsapp, &s.Email, &s.ShowSinglePrice, &s.UpdatedAt,
	)
	if err != nil {
		log.Printf("[ADMIN API ERROR] Failed to update settings: %v", err)
		http.Error(w, `{"error":"Failed to update settings"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

// RefreshProductCache refreshes the storefront product materialized view concurrently
func (h *CatalogHandler) RefreshProductCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, "REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products")
	if err != nil {
		log.Printf("[ADMIN CACHE ERROR] Failed to refresh mv_products: %v", err)
		http.Error(w, `{"error":"Önbellek güncellenirken bir hata oluştu"}` + err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"success","message":"Ürün önbelleği başarıyla güncellendi."}`))
}
