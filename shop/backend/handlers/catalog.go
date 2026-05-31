package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/shop/backend/db"
	"mertervitrini/shop/backend/models"
)

type CatalogHandler struct{}

func NewCatalogHandler() *CatalogHandler {
	return &CatalogHandler{}
}

// ListProducts queries the active storefront products with dynamic search, filters, pagination, and sorting
func (h *CatalogHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Read parameters
	q := r.URL.Query().Get("q")
	brandID := r.URL.Query().Get("brand_id")
	categoryID := r.URL.Query().Get("category_id")
	sortBy := r.URL.Query().Get("sort_by") // 'price_asc', 'price_desc', 'newest'
	
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 24
	offset := 0

	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	displayCurrency := r.URL.Query().Get("display_currency")
	if displayCurrency == "" {
		displayCurrency = "TRY"
	}

	displayRate := 1.0
	if displayCurrency != "TRY" && displayCurrency != "TL" {
		ctxRate, cancelRate := context.WithTimeout(r.Context(), 5*time.Second)
		err := db.Pool.QueryRow(ctxRate, `
			SELECT buying_rate FROM catalog.exchange_rates 
			WHERE currency_code = $1 
			ORDER BY publication_date DESC LIMIT 1
		`, strings.ToUpper(displayCurrency)).Scan(&displayRate)
		cancelRate()
		if err != nil {
			log.Printf("[STORE API WARNING] Failed to fetch rate for display currency %s: %v. Using 1.0 fallback.", displayCurrency, err)
			displayRate = 1.0
		}
	}

	// Unified price in TRY calculation SQL fragment
	sqlPriceInTRY := `CASE 
		WHEN p.currency = 'TRY' OR p.currency = 'TL' THEN COALESCE(p.discounted_price, p.price)
		ELSE COALESCE(p.discounted_price, p.price) * COALESCE(
			(SELECT buying_rate FROM catalog.exchange_rates 
			 WHERE currency_code = p.currency 
			 ORDER BY publication_date DESC LIMIT 1), 1.0
		)
	END`

	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()

	// Dynamic SQL construction (Only shows active products and active brands)
	selectPrefix := `
		SELECT p.id, p.feed_id, p.source_product_id, p.source_product_group_id, p.title, p.slug, p.slug_id, p.custom_sku, 
		       p.short_description, p.description, p.brand_id, p.category_id, 
		       p.gender, p.season, p.kumas_fabric, p.desi_volume, p.shipping_weight_kg, 
		       p.packing_ratio, p.series_ratio, p.minimum_order_quantity, 
		       p.price, p.discounted_price, p.single_price, p.buying_price, p.currency, p.tax_rate, p.color, p.stock, p.sku, p.barcode,
		       p.is_active, 
		       p.created_at, p.updated_at, p.brand_name, p.category_title,
		       p.images_json,
		       p.translations_json `

	sqlBase := `
		FROM catalog.mv_products p
		WHERE p.is_active = true`

	args := []any{}
	argIndex := 1

	if q != "" {
		words := strings.Fields(q)
		for _, word := range words {
			if trimmed := strings.TrimSpace(word); trimmed != "" {
				sqlBase += fmt.Sprintf(` AND (
					p.title ILIKE $%d 
					OR p.custom_sku ILIKE $%d 
					OR p.description ILIKE $%d 
					OR p.category_title ILIKE $%d 
					OR p.brand_name ILIKE $%d 
					OR p.color ILIKE $%d
					OR p.kumas_fabric ILIKE $%d
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
		brandsList := []string{}
		for _, part := range strings.Split(brandID, ",") {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				brandsList = append(brandsList, trimmed)
			}
		}
		if len(brandsList) > 0 {
			sqlBase += " AND p.brand_id IN ("
			for i, b := range brandsList {
				if i > 0 {
					sqlBase += ", "
				}
				sqlBase += fmt.Sprintf("$%d", argIndex)
				args = append(args, b)
				argIndex++
			}
			sqlBase += ")"
		}
	}

	if categoryID != "" {
		// Matches target category (by ID or Slug) and recursively all its nested child paths using view's precomputed node_path!
		sqlBase += fmt.Sprintf(` AND (
			p.category_id = (SELECT id FROM catalog.categories WHERE id::text = $%d OR slug = $%d LIMIT 1)
			OR p.node_path <@ (
				SELECT node_path FROM catalog.categories WHERE id::text = $%d OR slug = $%d LIMIT 1
			)
		)`, argIndex, argIndex, argIndex, argIndex)
		args = append(args, categoryID)
		argIndex++
	}

	// Dynamic product_attributes filters (e.g. attr_Desen=Çizgili)
	for key, values := range r.URL.Query() {
		if len(values) == 0 || len(values[0]) == 0 {
			continue
		}
		if len(key) > 5 && key[:5] == "attr_" {
			attrName := key[5:]
			var attrValues []string
			for _, val := range values {
				for _, part := range strings.Split(val, ",") {
					if trimmed := strings.TrimSpace(part); trimmed != "" {
						attrValues = append(attrValues, trimmed)
					}
				}
			}
			if len(attrValues) > 0 {
				sqlBase += fmt.Sprintf(" AND p.id IN (SELECT pam.product_id FROM catalog.product_attributes_map pam JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id JOIN catalog.attributes a ON av.attribute_id = a.id WHERE a.attribute_name = $%d AND av.attribute_value IN (", argIndex)
				args = append(args, attrName)
				argIndex++
				for i, val := range attrValues {
					if i > 0 {
						sqlBase += ", "
					}
					sqlBase += fmt.Sprintf("$%d", argIndex)
					args = append(args, val)
					argIndex++
				}
				sqlBase += "))"
			}
		}
	}

	// Price Range Filters (min_price and max_price, relative to display_currency converted to TRY)
	minPriceStr := r.URL.Query().Get("min_price")
	maxPriceStr := r.URL.Query().Get("max_price")
	if minPriceStr != "" {
		if minP, err := strconv.ParseFloat(minPriceStr, 64); err == nil {
			minPInTRY := minP * displayRate
			sqlBase += fmt.Sprintf(" AND %s >= $%d", sqlPriceInTRY, argIndex)
			args = append(args, minPInTRY)
			argIndex++
		}
	}
	if maxPriceStr != "" {
		if maxP, err := strconv.ParseFloat(maxPriceStr, 64); err == nil {
			maxPInTRY := maxP * displayRate
			sqlBase += fmt.Sprintf(" AND %s <= $%d", sqlPriceInTRY, argIndex)
			args = append(args, maxPInTRY)
			argIndex++
		}
	}

	// Gender Filter (comma-separated B2B spec)
	genderStr := r.URL.Query().Get("gender")
	if genderStr != "" {
		gendersList := []string{}
		for _, part := range strings.Split(genderStr, ",") {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				gendersList = append(gendersList, trimmed)
			}
		}
		if len(gendersList) > 0 {
			sqlBase += " AND p.gender IN ("
			for i, g := range gendersList {
				if i > 0 {
					sqlBase += ", "
				}
				sqlBase += fmt.Sprintf("$%d", argIndex)
				args = append(args, g)
				argIndex++
			}
			sqlBase += ")"
		}
	}

	// Season Filter (comma-separated B2B spec)
	seasonStr := r.URL.Query().Get("season")
	if seasonStr != "" {
		seasonsList := []string{}
		for _, part := range strings.Split(seasonStr, ",") {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				seasonsList = append(seasonsList, trimmed)
			}
		}
		if len(seasonsList) > 0 {
			sqlBase += " AND p.season IN ("
			for i, s := range seasonsList {
				if i > 0 {
					sqlBase += ", "
				}
				sqlBase += fmt.Sprintf("$%d", argIndex)
				args = append(args, s)
				argIndex++
			}
			sqlBase += ")"
		}
	}

	// 1. Fetch total counts with filters
	countQuery := "SELECT COUNT(*)" + sqlBase
	var totalCount int
	err := db.Pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query product counts: %v", err)
		totalCount = 0
	}

	// 2. Fetch products with limit and offset
	sqlQuery := selectPrefix + sqlBase

	switch sortBy {
	case "price_asc":
		sqlQuery += fmt.Sprintf(" ORDER BY %s ASC", sqlPriceInTRY)
	case "price_desc":
		sqlQuery += fmt.Sprintf(" ORDER BY %s DESC", sqlPriceInTRY)
	case "name_asc":
		sqlQuery += " ORDER BY p.title ASC"
	case "name_desc":
		sqlQuery += " ORDER BY p.title DESC"
	case "sku_asc":
		sqlQuery += " ORDER BY p.custom_sku ASC"
	case "sku_desc":
		sqlQuery += " ORDER BY p.custom_sku DESC"
	case "newest":
		sqlQuery += " ORDER BY p.created_at DESC"
	default:
		sqlQuery += " ORDER BY p.created_at DESC"
	}

	sqlQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := db.Pool.Query(ctx, sqlQuery, args...)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query products: %v", err)
		http.Error(w, `{"error":"Failed to fetch catalog"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	products := []*models.Product{}
	for rows.Next() {
		var p models.Product
		var imagesBytes, translationsBytes []byte
		err := rows.Scan(
			&p.ID, &p.FeedID, &p.SourceProductID, &p.SourceProductGroupID, &p.Title, &p.Slug, &p.SlugID, &p.CustomSku,
			&p.ShortDescription, &p.Description, &p.BrandID, &p.CategoryID,
			&p.Gender, &p.Season, &p.KumasFabric, &p.DesiVolume, &p.ShippingWeightKg,
			&p.PackingRatio, &p.SeriesRatio, &p.MinimumOrderQty,
			&p.Price, &p.DiscountedPrice, &p.SinglePrice, &p.BuyingPrice, &p.Currency, &p.TaxRate, &p.Color, &p.Stock, &p.Sku, &p.Barcode,
			&p.IsActive, 
			&p.CreatedAt, &p.UpdatedAt, &p.BrandName, &p.CategoryTitle,
			&imagesBytes, &translationsBytes,
		)
		if err != nil {
			log.Printf("Failed to scan storefront product row: %v", err)
			http.Error(w, `{"error":"Failed to process products"}`, http.StatusInternalServerError)
			return
		}
		if len(imagesBytes) > 0 {
			json.Unmarshal(imagesBytes, &p.Images)
		}
		if len(translationsBytes) > 0 {
			json.Unmarshal(translationsBytes, &p.Translations)
		}
		products = append(products, &p)
	}
	rows.Close() // Explicitly release main query connection immediately

	// --- Faceted Counts Calculation ---
	brandStats := make(map[string]int)
	genderStats := make(map[string]int)
	seasonStats := make(map[string]int)
	attributeStats := make(map[string]map[string]int)

	// Base args without limit/offset (exactly argIndex-1 elements)
	baseArgs := args[:argIndex-1]

	// 1. Brand Facets
	brandQuery := "SELECT p.brand_id, COUNT(*)" + sqlBase + " GROUP BY p.brand_id"
	if bRows, err := db.Pool.Query(ctx, brandQuery, baseArgs...); err == nil {
		for bRows.Next() {
			var bID string
			var count int
			if err := bRows.Scan(&bID, &count); err == nil {
				brandStats[bID] = count
			}
		}
		bRows.Close() // Close explicitly immediately
	} else {
		log.Printf("[STORE API ERROR] Failed to query brand facets: %v", err)
	}

	// 2. Gender Facets
	genderQuery := "SELECT p.gender, COUNT(*)" + sqlBase + " GROUP BY p.gender"
	if gRows, err := db.Pool.Query(ctx, genderQuery, baseArgs...); err == nil {
		for gRows.Next() {
			var gender string
			var count int
			if err := gRows.Scan(&gender, &count); err == nil {
				if gender != "" {
					genderStats[gender] = count
				}
			}
		}
		gRows.Close() // Close explicitly immediately
	} else {
		log.Printf("[STORE API ERROR] Failed to query gender facets: %v", err)
	}

	// 3. Season Facets
	seasonQuery := "SELECT p.season, COUNT(*)" + sqlBase + " GROUP BY p.season"
	if sRows, err := db.Pool.Query(ctx, seasonQuery, baseArgs...); err == nil {
		for sRows.Next() {
			var season string
			var count int
			if err := sRows.Scan(&season, &count); err == nil {
				if season != "" {
					seasonStats[season] = count
				}
			}
		}
		sRows.Close() // Close explicitly immediately
	} else {
		log.Printf("[STORE API ERROR] Failed to query season facets: %v", err)
	}

	// 4. Dynamic Attribute Facets
	cleanSqlBase := strings.Replace(sqlBase, "FROM catalog.mv_products p", "FROM catalog.mv_products p INNER JOIN catalog.product_attributes_map pam ON p.id = pam.product_id INNER JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id INNER JOIN catalog.attributes a ON av.attribute_id = a.id", 1)
	attrQuery := "SELECT a.attribute_name, av.attribute_value, COUNT(DISTINCT p.id) " + cleanSqlBase + " GROUP BY a.attribute_name, av.attribute_value"
	if aRows, err := db.Pool.Query(ctx, attrQuery, baseArgs...); err == nil {
		for aRows.Next() {
			var attrName, attrVal string
			var count int
			if err := aRows.Scan(&attrName, &attrVal, &count); err == nil {
				if attrName != "" && attrVal != "" {
					if _, exists := attributeStats[attrName]; !exists {
						attributeStats[attrName] = make(map[string]int)
					}
					attributeStats[attrName][attrVal] = count
				}
			}
		}
		aRows.Close() // Close explicitly immediately
	} else {
		log.Printf("[STORE API ERROR] Failed to query attribute facets: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	responsePayload := map[string]any{
		"products": products,
		"total":    totalCount,
		"facets": map[string]any{
			"brands":     brandStats,
			"genders":    genderStats,
			"seasons":    seasonStats,
			"attributes": attributeStats,
		},
	}
	json.NewEncoder(w).Encode(responsePayload)
}

// GetProductByID fetches product, dynamic variant structures and translation tables
func (h *CatalogHandler) GetProductByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Product ID or Slug is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var p models.Product
	var translationsBytes []byte

	// Allows lookup by direct UUID OR SlugID
	prodQuery := `
		SELECT p.id, p.feed_id, p.source_product_id, p.source_product_group_id, p.title, p.slug, p.slug_id, p.custom_sku, 
		       p.short_description, p.description, p.brand_id, p.category_id, 
		       p.gender, p.season, COALESCE(fab.fabric_name, 'Polyester') as kumas_fabric, p.desi_volume, p.shipping_weight_kg, 
		       p.packing_ratio, p.series_ratio, p.minimum_order_quantity, 
		       p.price, p.discounted_price, p.single_price, p.buying_price, p.currency, p.tax_rate, COALESCE(col.color_name, 'Standart') as color, p.stock, p.sku, p.barcode,
		       p.is_active, 
		       p.created_at, p.updated_at, COALESCE(NULLIF(b.alias_code, ''), b.brand_name) as brand_name, c.title as category_title,
		       COALESCE(
		           (SELECT json_object_agg(t.language_code, json_build_object('title', t.title, 'short_description', t.short_description, 'description', t.description))
		            FROM catalog.product_translations t
		            WHERE t.product_id = p.id), '{}'::json
		       ) as translations_json
		FROM catalog.products p
		INNER JOIN catalog.brands b ON p.brand_id = b.id AND b.is_active = true
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		LEFT JOIN catalog.fabrics fab ON p.fabric_id = fab.id
		WHERE (p.id::text = $1 OR p.slug_id = $1 OR p.slug = $1) AND p.is_active = true`

	err := db.Pool.QueryRow(ctx, prodQuery, id).Scan(
		&p.ID, &p.FeedID, &p.SourceProductID, &p.SourceProductGroupID, &p.Title, &p.Slug, &p.SlugID, &p.CustomSku,
		&p.ShortDescription, &p.Description, &p.BrandID, &p.CategoryID,
		&p.Gender, &p.Season, &p.KumasFabric, &p.DesiVolume, &p.ShippingWeightKg,
		&p.PackingRatio, &p.SeriesRatio, &p.MinimumOrderQty,
		&p.Price, &p.DiscountedPrice, &p.SinglePrice, &p.BuyingPrice, &p.Currency, &p.TaxRate, &p.Color, &p.Stock, &p.Sku, &p.Barcode,
		&p.IsActive, 
		&p.CreatedAt, &p.UpdatedAt, &p.BrandName, &p.CategoryTitle,
		&translationsBytes,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Product not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to query product details %s: %v", id, err)
		http.Error(w, `{"error":"Failed to fetch product information"}`, http.StatusInternalServerError)
		return
	}
	if len(translationsBytes) > 0 {
		json.Unmarshal(translationsBytes, &p.Translations)
	}

	// 2. Fetch cover and gallery images
	var images []*models.ProductImage
	imgQuery := `
		SELECT id, product_id, image_url, sort_order, is_cover, created_at
		FROM catalog.product_images
		WHERE product_id = $1
		ORDER BY sort_order ASC`
	
	iRows, err := db.Pool.Query(ctx, imgQuery, p.ID)
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

	// 3. Fetch active variants
	var variants []*models.ProductVariant
	variantQuery := `
		SELECT id, product_id, source_variant_id, custom_sku, barcode, stock, variant_size AS size, is_single, is_active, created_at, updated_at
		FROM catalog.product_variants
		WHERE product_id = $1 AND is_active = true
		ORDER BY is_single ASC, variant_size ASC`

	vRows, err := db.Pool.Query(ctx, variantQuery, p.ID)
	if err == nil {
		defer vRows.Close()
		for vRows.Next() {
			var v models.ProductVariant
			err := vRows.Scan(
				&v.ID, &v.ProductID, &v.SourceVariantID, &v.CustomSku, &v.Barcode, &v.Stock, &v.Size, &v.IsSingle, &v.IsActive, &v.CreatedAt, &v.UpdatedAt,
			)
			if err == nil {
				variants = append(variants, &v)
			}
		}
	}
	p.Variants = variants

	// 4. Fetch dynamic product attributes (TR/base values)
	var attributes []*models.ProductAttribute
	attrQuery := `
		SELECT a.attribute_name AS name, av.attribute_value AS value
		FROM catalog.product_attributes_map pam
		JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id
		JOIN catalog.attributes a ON av.attribute_id = a.id
		WHERE pam.product_id = $1
		ORDER BY a.attribute_name ASC`
	aRows, err := db.Pool.Query(ctx, attrQuery, p.ID)
	if err == nil {
		defer aRows.Close()
		for aRows.Next() {
			var attr models.ProductAttribute
			err := aRows.Scan(&attr.Name, &attr.Value)
			if err == nil {
				attributes = append(attributes, &attr)
			}
		}
	}
	p.Attributes = attributes

	// 5. Fetch attribute translations and inject into p.Translations
	transAttrQuery := `
		SELECT l.code AS language_code, COALESCE(at.attribute_name, a.attribute_name) AS name, COALESCE(avt.attribute_value, av.attribute_value) AS value
		FROM catalog.product_attributes_map pam
		JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id
		JOIN catalog.attributes a ON av.attribute_id = a.id
		CROSS JOIN (
			SELECT DISTINCT code FROM (
				SELECT LEFT(code, 2) AS code FROM catalog.languages WHERE is_active = true AND code NOT IN ('tr', 'tr_TR')
			) l_sub
		) l
		LEFT JOIN catalog.attribute_translations at ON a.id = at.attribute_id AND at.language_code = l.code
		LEFT JOIN catalog.attribute_value_translations avt ON av.id = avt.attribute_value_id AND avt.language_code = l.code
		WHERE pam.product_id = $1`
	taRows, err := db.Pool.Query(ctx, transAttrQuery, p.ID)
	if err == nil {
		defer taRows.Close()
		for taRows.Next() {
			var lang, name, value string
			err := taRows.Scan(&lang, &name, &value)
			if err == nil {
				if p.Translations == nil {
					p.Translations = make(map[string]any)
				}
				
				// Get or create the translation map for this language
				var tMap map[string]any
				if existing, ok := p.Translations[lang]; ok {
					if m, ok := existing.(map[string]any); ok {
						tMap = m
					}
				}
				if tMap == nil {
					tMap = make(map[string]any)
				}
				
				// Get or create the attributes list in the translation map
				var attrs []any
				if existingAttrs, ok := tMap["attributes"]; ok {
					if l, ok := existingAttrs.([]any); ok {
						attrs = l
					}
				}
				
				attrs = append(attrs, map[string]string{
					"name":  name,
					"value": value,
				})
				tMap["attributes"] = attrs
				p.Translations[lang] = tMap
			}
		}
	}

	// 6. Fetch sibling color variants sharing the same source_product_group_id
	if p.SourceProductGroupID != nil && *p.SourceProductGroupID != "" {
		siblingsQuery := `
			SELECT p.id, p.custom_sku, p.slug, p.slug_id, COALESCE(col.color_name, 'Standart') as color,
			       COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1), '') as image_url
			FROM catalog.products p
			LEFT JOIN catalog.colors col ON p.color_id = col.id
			WHERE p.source_product_group_id = $1 AND p.feed_id = $2 AND p.id != $3 AND p.is_active = true
			ORDER BY col.color_name ASC`
		
		sRows, err := db.Pool.Query(ctx, siblingsQuery, p.SourceProductGroupID, p.FeedID, p.ID)
		if err == nil {
			defer sRows.Close()
			var siblings []*models.SiblingProduct
			for sRows.Next() {
				var sib models.SiblingProduct
				err := sRows.Scan(&sib.ID, &sib.CustomSku, &sib.Slug, &sib.SlugID, &sib.Color, &sib.ImageUrl)
				if err == nil {
					siblings = append(siblings, &sib)
				}
			}
			p.ColorVariants = siblings
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

// ListCategories fetches active categories hierarchically
func (h *CatalogHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, parent_id, title, slug, node_path, is_active, created_at, updated_at,
		       (SELECT COUNT(*) FROM catalog.products p WHERE p.category_id = c.id OR p.category_id IN (SELECT id FROM catalog.categories WHERE node_path <@ c.node_path)) as total_products,
		       (SELECT COUNT(*) FROM catalog.products p WHERE (p.category_id = c.id OR p.category_id IN (SELECT id FROM catalog.categories WHERE node_path <@ c.node_path)) AND p.is_active = true) as active_products
		FROM catalog.categories c
		WHERE is_active = true
		ORDER BY node_path ASC, title ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list storefront categories: %v", err)
		http.Error(w, `{"error":"Failed to query categories"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type flatCategory struct {
		models.Category
		TotalProducts  int
		ActiveProducts int
	}

	flatList := []*flatCategory{}
	for rows.Next() {
		var fc flatCategory
		err := rows.Scan(
			&fc.ID, &fc.ParentID, &fc.Title, &fc.Slug, &fc.NodePath, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt,
			&fc.TotalProducts, &fc.ActiveProducts,
		)
		if err == nil {
			flatList = append(flatList, &fc)
		}
	}

	// Hierarchical tree builder
	nodesMap := make(map[string]*models.CategoryNode)
	var roots []*models.CategoryNode

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
			Translations:   make(map[string]map[string]any),
		}
	}

	// Fetch category translations dynamically from the database
	transQuery := `
		SELECT category_id, language_code, title 
		FROM catalog.category_translations`
	transRows, err := db.Pool.Query(ctx, transQuery)
	if err == nil {
		defer transRows.Close()
		for transRows.Next() {
			var catID, langCode, transTitle string
			if scanErr := transRows.Scan(&catID, &langCode, &transTitle); scanErr == nil {
				if node, exists := nodesMap[catID]; exists {
					if node.Translations == nil {
						node.Translations = make(map[string]map[string]any)
					}
					if _, langExists := node.Translations[langCode]; !langExists {
						node.Translations[langCode] = make(map[string]any)
					}
					node.Translations[langCode]["title"] = transTitle
				}
			}
		}
	}

	for _, c := range flatList {
		node := nodesMap[c.ID]
		if c.ParentID == nil || *c.ParentID == "" {
			roots = append(roots, node)
		} else {
			if parent, exists := nodesMap[*c.ParentID]; exists {
				parent.Children = append(parent.Children, node)
			} else {
				roots = append(roots, node)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roots)
}

// ListBrands queries the active wholesale brands/suppliers list
func (h *CatalogHandler) ListBrands(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, brand_name AS name, slug, alias_code, website, phone, addresses, is_active, created_at, updated_at
		FROM catalog.brands
		WHERE is_active = true
		ORDER BY brand_name ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list active storefront brands: %v", err)
		http.Error(w, `{"error":"Failed to fetch active suppliers"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	brands := []*models.Brand{}
	for rows.Next() {
		var b models.Brand
		var addressesBytes []byte
		err := rows.Scan(&b.ID, &b.Name, &b.Slug, &b.AliasCode, &b.Website, &b.Phone, &addressesBytes, &b.IsActive, &b.CreatedAt, &b.UpdatedAt)
		if err == nil {
			if len(addressesBytes) > 0 {
				json.Unmarshal(addressesBytes, &b.Addresses)
			}
			brands = append(brands, &b)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(brands)
}

// ListAttributes queries the active distinct product attributes for sidebar filtering
func (h *CatalogHandler) ListAttributes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT a.attribute_name AS name, av.attribute_value AS value, COUNT(*) as cnt
		FROM catalog.product_attributes_map pam
		JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id
		JOIN catalog.attributes a ON av.attribute_id = a.id
		WHERE a.attribute_name IN ('Kalıp', 'Desen', 'Boy', 'Yaka Tipi', 'Kol Boyu')
		GROUP BY a.attribute_name, av.attribute_value
		HAVING COUNT(*) >= 5
		ORDER BY a.attribute_name ASC, cnt DESC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list active storefront attributes: %v", err)
		http.Error(w, `{"error":"Failed to fetch attributes"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	attrMap := make(map[string][]string)
	for rows.Next() {
		var name, value string
		var cnt int
		err := rows.Scan(&name, &value, &cnt)
		if err == nil {
			if trimmed := strings.TrimSpace(value); trimmed != "" {
				attrMap[name] = append(attrMap[name], trimmed)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(attrMap)
}

// Helper sql.NullString wrapper mapping
func scanNullString(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}

// GetStoreSettings fetches the singleton global storefront contact settings
func (h *CatalogHandler) GetStoreSettings(w http.ResponseWriter, r *http.Request) {
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
		log.Printf("[STORE API ERROR] Failed to fetch settings: %v", err)
		http.Error(w, `{"error":"Failed to fetch settings"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

// ListLanguages queries the active storefront languages list from the database
func (h *CatalogHandler) ListLanguages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT code, label, flag, category_prefix, text_direction AS dir, is_active, sort_order
		FROM catalog.languages
		WHERE is_active = true
		ORDER BY sort_order ASC, code ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list active storefront languages: %v", err)
		http.Error(w, `{"error":"Failed to query languages"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	languages := []*models.Language{}
	for rows.Next() {
		var l models.Language
		err := rows.Scan(&l.Code, &l.Label, &l.Flag, &l.CategoryPrefix, &l.Dir, &l.IsActive, &l.SortOrder)
		if err == nil {
			languages = append(languages, &l)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(languages)
}

// GetExchangeRates queries the active storefront exchange rates list from the database,
// implementing the daily 15:30 publication time-boundary and holiday fallback logic.
func (h *CatalogHandler) GetExchangeRates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Select the latest published rate for each currency code active up to current date.
	// Boundary: If current Istanbul time is before 15:30, we must strictly use rates published on T-1 or earlier.
	// If it is after 15:30, we can use rates published on T (today) or earlier.
	query := `
		SELECT DISTINCT ON (currency_code)
			id, currency_code, buying_rate, selling_rate, publication_date, created_at, updated_at
		FROM catalog.exchange_rates
		WHERE publication_date <= CASE 
			WHEN EXTRACT(HOUR FROM CURRENT_TIME AT TIME ZONE 'Europe/Istanbul') >= 15 AND EXTRACT(MINUTE FROM CURRENT_TIME AT TIME ZONE 'Europe/Istanbul') >= 30 
			THEN CURRENT_DATE 
			ELSE CURRENT_DATE - 1 
		END
		ORDER BY currency_code, publication_date DESC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to fetch active exchange rates: %v", err)
		http.Error(w, `{"error":"Failed to query exchange rates"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	rates := []*models.ExchangeRate{}
	for rows.Next() {
		var er models.ExchangeRate
		err := rows.Scan(&er.ID, &er.CurrencyCode, &er.BuyingRate, &er.SellingRate, &er.PublicationDate, &er.CreatedAt, &er.UpdatedAt)
		if err == nil {
			rates = append(rates, &er)
		} else {
			log.Printf("[STORE API WARNING] Failed to scan exchange rate row: %v", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rates)
}

// GetPageBySlug fetches a single active custom page by its slug, returning all its translations
func (h *CatalogHandler) GetPageBySlug(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	slug := r.PathValue("slug")
	if slug == "" {
		http.Error(w, `{"error":"Slug is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT p.id, p.slug, p.is_active, p.created_at, p.updated_at,
		       t.language_code, t.title, t.content, t.meta_title, t.meta_description
		FROM catalog.pages p
		LEFT JOIN catalog.page_translations t ON p.id = t.page_id
		WHERE p.slug = $1 AND p.is_active = true`

	rows, err := db.Pool.Query(ctx, query, slug)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to fetch page by slug %s: %v", slug, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var page *models.Page

	for rows.Next() {
		var (
			pageID, pageSlug              string
			isActive                      bool
			createdAt, updatedAt          time.Time
			langCode, title, content      *string
			metaTitle, metaDescription    *string
		)

		err := rows.Scan(
			&pageID, &pageSlug, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &content, &metaTitle, &metaDescription,
		)
		if err != nil {
			log.Printf("[STORE API ERROR] Failed to scan page row: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}

		if page == nil {
			page = &models.Page{
				ID:           pageID,
				Slug:         pageSlug,
				IsActive:     isActive,
				Translations: make(map[string]models.PageTranslation),
				CreatedAt:    createdAt,
				UpdatedAt:    updatedAt,
			}
		}

		if langCode != nil && title != nil && content != nil {
			page.Translations[*langCode] = models.PageTranslation{
				Title:           *title,
				Content:         *content,
				MetaTitle:       metaTitle,
				MetaDescription: metaDescription,
			}
		}
	}

	if page == nil {
		http.Error(w, `{"error":"Page not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(page)
}

// ListPages returns all active dynamic pages for storefront
func (h *CatalogHandler) ListPages(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT p.id, p.slug, p.is_active, p.created_at, p.updated_at,
		       t.language_code, t.title, t.content, t.meta_title, t.meta_description
		FROM catalog.pages p
		LEFT JOIN catalog.page_translations t ON p.id = t.page_id
		WHERE p.is_active = true
		ORDER BY p.created_at DESC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to list pages: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	pagesMap := make(map[string]*models.Page)
	var orderedPageIDs []string

	for rows.Next() {
		var (
			pageID, pageSlug              string
			isActive                      bool
			createdAt, updatedAt          time.Time
			langCode, title, content      *string
			metaTitle, metaDescription    *string
		)

		err := rows.Scan(
			&pageID, &pageSlug, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &content, &metaTitle, &metaDescription,
		)
		if err != nil {
			log.Printf("[STORE API ERROR] Failed to scan page list row: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}

		page, exists := pagesMap[pageID]
		if !exists {
			page = &models.Page{
				ID:           pageID,
				Slug:         pageSlug,
				IsActive:     isActive,
				Translations: make(map[string]models.PageTranslation),
				CreatedAt:    createdAt,
				UpdatedAt:    updatedAt,
			}
			pagesMap[pageID] = page
			orderedPageIDs = append(orderedPageIDs, pageID)
		}

		if langCode != nil && title != nil && content != nil {
			page.Translations[*langCode] = models.PageTranslation{
				Title:           *title,
				Content:         *content,
				MetaTitle:       metaTitle,
				MetaDescription: metaDescription,
			}
		}
	}

	pagesList := make([]*models.Page, 0, len(orderedPageIDs))
	for _, id := range orderedPageIDs {
		pagesList = append(pagesList, pagesMap[id])
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pagesList)
}



