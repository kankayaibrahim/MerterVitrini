package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
)

type StoreCatalogHandler struct{}

func NewStoreCatalogHandler() *StoreCatalogHandler {
	return &StoreCatalogHandler{}
}

func getDisplayRate(ctx context.Context, displayCurrency string) float64 {
	if displayCurrency == "" || displayCurrency == "TRY" || displayCurrency == "TL" {
		return 1.0
	}
	ctxRate, cancelRate := context.WithTimeout(ctx, 5*time.Second)
	defer cancelRate()

	displayRate := 1.0
	err := db.Pool.QueryRow(ctxRate, `
		SELECT buying_rate FROM catalog.exchange_rates 
		WHERE currency_code = $1 
		ORDER BY publication_date DESC LIMIT 1
	`, strings.ToUpper(displayCurrency)).Scan(&displayRate)
	if err != nil {
		log.Printf("[STORE API WARNING] Failed to fetch rate for display currency %s: %v. Using 1.0 fallback.", displayCurrency, err)
		return 1.0
	}
	return displayRate
}

func appendCatalogSearchFilter(sqlBase *string, q string, argIndex *int, args *[]any) {
	if q == "" {
		return
	}
	words := strings.Fields(q)
	for _, word := range words {
		trimmed := strings.TrimSpace(word)
		if trimmed == "" {
			continue
		}
		*sqlBase += fmt.Sprintf(` AND (
			p.title ILIKE $%[1]d 
			OR p.custom_sku ILIKE $%[1]d 
			OR p.description ILIKE $%[1]d 
			OR p.category_title ILIKE $%[1]d 
			OR p.brand_name ILIKE $%[1]d 
			OR p.color ILIKE $%[1]d
			OR p.kumas_fabric ILIKE $%[1]d
			OR EXISTS (
				SELECT 1 FROM catalog.product_translations pt
				WHERE pt.product_id = p.id AND (pt.title ILIKE $%[1]d OR pt.description ILIKE $%[1]d OR pt.short_description ILIKE $%[1]d)
			)
			OR EXISTS (
				SELECT 1 FROM catalog.products prod
				JOIN catalog.color_translations ct ON prod.color_id = ct.color_id
				WHERE prod.id = p.id AND ct.color_name ILIKE $%[1]d
			)
			OR EXISTS (
				SELECT 1 FROM catalog.products prod
				JOIN catalog.fabric_translations ft ON prod.fabric_id = ft.fabric_id
				WHERE prod.id = p.id AND ft.fabric_name ILIKE $%[1]d
			)
			OR EXISTS (
				SELECT 1 FROM catalog.category_translations cat_trans
				WHERE cat_trans.category_id = p.category_id AND cat_trans.title ILIKE $%[1]d
			)
			OR EXISTS (
				SELECT 1 
				FROM catalog.product_attributes_map pam 
				JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id 
				LEFT JOIN catalog.attribute_value_translations avt ON av.id = avt.attribute_value_id
				WHERE pam.product_id = p.id AND (av.attribute_value ILIKE $%[1]d OR avt.attribute_value ILIKE $%[1]d)
			)
		)`, *argIndex)
		*args = append(*args, "%"+trimmed+"%")
		*argIndex++
	}
}

func parseCommaSeparatedStrings(raw string) []string {
	if raw == "" {
		return nil
	}
	var list []string
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			list = append(list, trimmed)
		}
	}
	return list
}

func parseCommaSeparatedValues(values []string) []string {
	var result []string
	for _, val := range values {
		result = append(result, parseCommaSeparatedStrings(val)...)
	}
	return result
}

func appendCatalogInFilter(sqlBase *string, column, rawValues string, argIndex *int, args *[]any) {
	list := parseCommaSeparatedStrings(rawValues)
	if len(list) == 0 {
		return
	}
	*sqlBase += fmt.Sprintf(" AND %s IN (", column)
	for i, val := range list {
		if i > 0 {
			*sqlBase += ", "
		}
		*sqlBase += fmt.Sprintf("$%d", *argIndex)
		*args = append(*args, val)
		*argIndex++
	}
	*sqlBase += ")"
}

func appendSingleAttributeFilter(sqlBase *string, attrName string, attrValues []string, argIndex *int, args *[]any) {
	*sqlBase += fmt.Sprintf(" AND p.id IN (SELECT pam.product_id FROM catalog.product_attributes_map pam JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id JOIN catalog.attributes a ON av.attribute_id = a.id WHERE a.attribute_name = $%d AND av.attribute_value IN (", *argIndex)
	*args = append(*args, attrName)
	*argIndex++
	for i, val := range attrValues {
		if i > 0 {
			*sqlBase += ", "
		}
		*sqlBase += fmt.Sprintf("$%d", *argIndex)
		*args = append(*args, val)
		*argIndex++
	}
	*sqlBase += "))"
}

func appendCatalogDynamicAttributesFilter(sqlBase *string, query url.Values, argIndex *int, args *[]any) {
	for key, values := range query {
		if len(values) == 0 || !strings.HasPrefix(key, "attr_") {
			continue
		}
		attrValues := parseCommaSeparatedValues(values)
		if len(attrValues) > 0 {
			appendSingleAttributeFilter(sqlBase, key[5:], attrValues, argIndex, args)
		}
	}
}

func appendCatalogPriceFilter(sqlBase *string, query url.Values, displayRate float64, sqlPriceInTRY string, argIndex *int, args *[]any) {
	minPriceStr := query.Get("min_price")
	maxPriceStr := query.Get("max_price")
	if minPriceStr != "" {
		if minP, err := strconv.ParseFloat(minPriceStr, 64); err == nil {
			*sqlBase += fmt.Sprintf(" AND %s >= $%d", sqlPriceInTRY, *argIndex)
			*args = append(*args, minP*displayRate)
			*argIndex++
		}
	}
	if maxPriceStr != "" {
		if maxP, err := strconv.ParseFloat(maxPriceStr, 64); err == nil {
			*sqlBase += fmt.Sprintf(" AND %s <= $%d", sqlPriceInTRY, *argIndex)
			*args = append(*args, maxP*displayRate)
			*argIndex++
		}
	}
}

func buildCatalogFilterSQL(query url.Values, displayRate float64, sqlPriceInTRY string) (string, []any, int) {
	sqlBase := `
		FROM catalog.mv_products p
		WHERE p.is_active = true`
	args := []any{}
	argIndex := 1

	appendCatalogSearchFilter(&sqlBase, query.Get("q"), &argIndex, &args)
	appendCatalogInFilter(&sqlBase, "p.brand_id", query.Get("brand_id"), &argIndex, &args)

	categoryID := query.Get("category_id")
	if categoryID != "" {
		sqlBase += fmt.Sprintf(` AND (
			p.category_id = (SELECT id FROM catalog.categories WHERE id::text = $%d OR slug = $%d LIMIT 1)
			OR p.node_path <@ (
				SELECT node_path FROM catalog.categories WHERE id::text = $%d OR slug = $%d LIMIT 1
			)
		)`, argIndex, argIndex, argIndex, argIndex)
		args = append(args, categoryID)
		argIndex++
	}

	appendCatalogDynamicAttributesFilter(&sqlBase, query, &argIndex, &args)
	appendCatalogPriceFilter(&sqlBase, query, displayRate, sqlPriceInTRY, &argIndex, &args)
	appendCatalogInFilter(&sqlBase, "p.gender", query.Get("gender"), &argIndex, &args)
	appendCatalogInFilter(&sqlBase, "p.season", query.Get("season"), &argIndex, &args)

	return sqlBase, args, argIndex
}

func buildCatalogOrderBy(sortBy, sqlPriceInTRY string) string {
	switch sortBy {
	case "price_asc":
		return fmt.Sprintf(" ORDER BY %s ASC", sqlPriceInTRY)
	case "price_desc":
		return fmt.Sprintf(" ORDER BY %s DESC", sqlPriceInTRY)
	case "name_asc":
		return " ORDER BY p.title ASC"
	case "name_desc":
		return " ORDER BY p.title DESC"
	case "sku_asc":
		return " ORDER BY p.custom_sku ASC"
	case "sku_desc":
		return " ORDER BY p.custom_sku DESC"
	case "newest":
		return " ORDER BY p.created_at DESC"
	default:
		return " ORDER BY p.created_at DESC"
	}
}

func scanCatalogProducts(rows pgx.Rows) ([]*models.Product, error) {
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
			return nil, err
		}
		if len(imagesBytes) > 0 {
			_ = json.Unmarshal(imagesBytes, &p.Images)
		}
		if len(translationsBytes) > 0 {
			_ = json.Unmarshal(translationsBytes, &p.Translations)
		}
		products = append(products, &p)
	}
	return products, nil
}

func collectProductGroupIDs(products []*models.Product) []string {
	var groupIDs []string
	seenGroups := make(map[string]bool)
	for _, p := range products {
		if p.SourceProductGroupID == nil || *p.SourceProductGroupID == "" || p.FeedID == nil || *p.FeedID == "" {
			continue
		}
		k := *p.FeedID + "_" + *p.SourceProductGroupID
		if !seenGroups[k] {
			seenGroups[k] = true
			groupIDs = append(groupIDs, *p.SourceProductGroupID)
		}
	}
	return groupIDs
}

func querySiblingProductMap(ctx context.Context, groupIDs []string) map[string][]*models.SiblingProduct {
	siblingsMap := make(map[string][]*models.SiblingProduct)
	siblingsQuery := `
		SELECT p.id, COALESCE(p.feed_id, '') as feed_id, COALESCE(p.source_product_group_id, '') as source_product_group_id, 
		       p.custom_sku, p.slug, p.slug_id, COALESCE(col.color_name, 'Standart') as color,
		       COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1), '') as image_url
		FROM catalog.products p
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE p.source_product_group_id = ANY($1) AND p.is_active = true
		ORDER BY col.color_name ASC`

	sRows, err := db.Pool.Query(ctx, siblingsQuery, groupIDs)
	if err != nil {
		log.Printf("[STORE API WARNING] Failed to query sibling color variants: %v", err)
		return siblingsMap
	}
	defer sRows.Close()

	for sRows.Next() {
		var sib models.SiblingProduct
		var feedID, groupID string
		if err := sRows.Scan(&sib.ID, &feedID, &groupID, &sib.CustomSku, &sib.Slug, &sib.SlugID, &sib.Color, &sib.ImageUrl); err == nil {
			key := feedID + "_" + groupID
			siblingsMap[key] = append(siblingsMap[key], &sib)
		}
	}
	return siblingsMap
}

func assignProductSiblings(products []*models.Product, siblingsMap map[string][]*models.SiblingProduct) {
	for _, p := range products {
		if p.SourceProductGroupID == nil || *p.SourceProductGroupID == "" || p.FeedID == nil || *p.FeedID == "" {
			continue
		}
		key := *p.FeedID + "_" + *p.SourceProductGroupID
		allSiblings := siblingsMap[key]
		var filtered []*models.SiblingProduct
		for _, sib := range allSiblings {
			if sib.ID != p.ID {
				filtered = append(filtered, sib)
			}
		}
		p.ColorVariants = filtered
	}
}

func fetchCatalogSiblingVariants(ctx context.Context, products []*models.Product) {
	groupIDs := collectProductGroupIDs(products)
	if len(groupIDs) == 0 {
		return
	}
	siblingsMap := querySiblingProductMap(ctx, groupIDs)
	assignProductSiblings(products, siblingsMap)
}

func fetchBrandFacets(ctx context.Context, sqlBase string, baseArgs []any) map[string]int {
	brandStats := make(map[string]int)
	query := "SELECT p.brand_id, COUNT(*)" + sqlBase + " GROUP BY p.brand_id"
	rows, err := db.Pool.Query(ctx, query, baseArgs...)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query brand facets: %v", err)
		return brandStats
	}
	defer rows.Close()
	for rows.Next() {
		var bID string
		var count int
		if err := rows.Scan(&bID, &count); err == nil {
			brandStats[bID] = count
		}
	}
	return brandStats
}

func fetchStringFacets(ctx context.Context, query string, baseArgs []any) map[string]int {
	stats := make(map[string]int)
	rows, err := db.Pool.Query(ctx, query, baseArgs...)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query facets: %v", err)
		return stats
	}
	defer rows.Close()
	for rows.Next() {
		var val string
		var count int
		if err := rows.Scan(&val, &count); err == nil && val != "" {
			stats[val] = count
		}
	}
	return stats
}

func fetchAttributeFacets(ctx context.Context, sqlBase string, baseArgs []any) map[string]map[string]int {
	attributeStats := make(map[string]map[string]int)
	cleanSqlBase := strings.Replace(sqlBase, "FROM catalog.mv_products p", "FROM catalog.mv_products p INNER JOIN catalog.product_attributes_map pam ON p.id = pam.product_id INNER JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id INNER JOIN catalog.attributes a ON av.attribute_id = a.id", 1)
	attrQuery := "SELECT a.attribute_name, av.attribute_value, COUNT(DISTINCT p.id) " + cleanSqlBase + " GROUP BY a.attribute_name, av.attribute_value"
	rows, err := db.Pool.Query(ctx, attrQuery, baseArgs...)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query attribute facets: %v", err)
		return attributeStats
	}
	defer rows.Close()
	for rows.Next() {
		var attrName, attrVal string
		var count int
		if err := rows.Scan(&attrName, &attrVal, &count); err == nil && attrName != "" && attrVal != "" {
			if _, exists := attributeStats[attrName]; !exists {
				attributeStats[attrName] = make(map[string]int)
			}
			attributeStats[attrName][attrVal] = count
		}
	}
	return attributeStats
}

func fetchCatalogFacets(ctx context.Context, sqlBase string, baseArgs []any) map[string]any {
	return map[string]any{
		"brands":     fetchBrandFacets(ctx, sqlBase, baseArgs),
		"genders":    fetchStringFacets(ctx, "SELECT p.gender, COUNT(*)"+sqlBase+" GROUP BY p.gender", baseArgs),
		"seasons":    fetchStringFacets(ctx, "SELECT p.season, COUNT(*)"+sqlBase+" GROUP BY p.season", baseArgs),
		"attributes": fetchAttributeFacets(ctx, sqlBase, baseArgs),
	}
}

// ListProducts queries the active storefront products with dynamic search, filters, pagination, and sorting
func (h *StoreCatalogHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	limit := 24
	offset := 0
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}
	if o, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && o >= 0 {
		offset = o
	}

	displayCurrency := r.URL.Query().Get("display_currency")
	if displayCurrency == "" {
		displayCurrency = "TRY"
	}
	displayRate := getDisplayRate(r.Context(), displayCurrency)

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

	sqlBase, args, argIndex := buildCatalogFilterSQL(r.URL.Query(), displayRate, sqlPriceInTRY)

	countQuery := "SELECT COUNT(*)" + sqlBase
	var totalCount int
	_ = db.Pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount)

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

	sqlQuery := selectPrefix + sqlBase + buildCatalogOrderBy(r.URL.Query().Get("sort_by"), sqlPriceInTRY)
	sqlQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := db.Pool.Query(ctx, sqlQuery, args...)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query products: %v", err)
		http.Error(w, `{"error":"Failed to fetch catalog"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	products, err := scanCatalogProducts(rows)
	if err != nil {
		log.Printf("Failed to scan storefront product row: %v", err)
		http.Error(w, `{"error":"Failed to process products"}`, http.StatusInternalServerError)
		return
	}
	rows.Close()

	fetchCatalogSiblingVariants(ctx, products)
	facets := fetchCatalogFacets(ctx, sqlBase, args[:argIndex-1])

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(map[string]any{
		"products": products,
		"total":    totalCount,
		"facets":   facets,
	})
}

func fetchProductBase(ctx context.Context, id string) (*models.Product, error) {
	var p models.Product
	var translationsBytes []byte
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
		return nil, err
	}
	if len(translationsBytes) > 0 {
		_ = json.Unmarshal(translationsBytes, &p.Translations)
	}
	return &p, nil
}

func fetchStoreProductVariants(ctx context.Context, productID string) []*models.ProductVariant {
	var variants []*models.ProductVariant
	variantQuery := `
		SELECT id, product_id, source_variant_id, custom_sku, barcode, stock, variant_size AS size, is_single, is_active, created_at, updated_at
		FROM catalog.product_variants
		WHERE product_id = $1 AND is_active = true
		ORDER BY is_single ASC, variant_size ASC`
	vRows, err := db.Pool.Query(ctx, variantQuery, productID)
	if err != nil {
		return variants
	}
	defer vRows.Close()
	for vRows.Next() {
		var v models.ProductVariant
		if err := vRows.Scan(&v.ID, &v.ProductID, &v.SourceVariantID, &v.CustomSku, &v.Barcode, &v.Stock, &v.Size, &v.IsSingle, &v.IsActive, &v.CreatedAt, &v.UpdatedAt); err == nil {
			variants = append(variants, &v)
		}
	}
	return variants
}

func fetchProductAttributes(ctx context.Context, productID string) []*models.ProductAttribute {
	var attributes []*models.ProductAttribute
	attrQuery := `
		SELECT a.attribute_name AS name, av.attribute_value AS value
		FROM catalog.product_attributes_map pam
		JOIN catalog.attribute_values av ON pam.attribute_value_id = av.id
		JOIN catalog.attributes a ON av.attribute_id = a.id
		WHERE pam.product_id = $1
		ORDER BY a.attribute_name ASC`
	aRows, err := db.Pool.Query(ctx, attrQuery, productID)
	if err != nil {
		return attributes
	}
	defer aRows.Close()
	for aRows.Next() {
		var attr models.ProductAttribute
		if err := aRows.Scan(&attr.Name, &attr.Value); err == nil {
			attributes = append(attributes, &attr)
		}
	}
	return attributes
}

func fetchAndInjectAttributeTranslations(ctx context.Context, p *models.Product) {
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
	if err != nil {
		return
	}
	defer taRows.Close()

	if p.Translations == nil {
		p.Translations = make(map[string]any)
	}

	for taRows.Next() {
		var lang, name, value string
		if err := taRows.Scan(&lang, &name, &value); err == nil {
			var tMap map[string]any
			if existing, ok := p.Translations[lang].(map[string]any); ok {
				tMap = existing
			} else {
				tMap = make(map[string]any)
			}

			var attrs []any
			if existingAttrs, ok := tMap["attributes"].([]any); ok {
				attrs = existingAttrs
			}
			attrs = append(attrs, map[string]string{"name": name, "value": value})
			tMap["attributes"] = attrs
			p.Translations[lang] = tMap
		}
	}
}

func fetchProductSiblings(ctx context.Context, p *models.Product) {
	if p.SourceProductGroupID == nil || *p.SourceProductGroupID == "" {
		return
	}
	siblingsQuery := `
		SELECT p.id, p.custom_sku, p.slug, p.slug_id, COALESCE(col.color_name, 'Standart') as color,
		       COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1), '') as image_url
		FROM catalog.products p
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE p.source_product_group_id = $1 AND p.feed_id = $2 AND p.id != $3 AND p.is_active = true
		ORDER BY col.color_name ASC`
	sRows, err := db.Pool.Query(ctx, siblingsQuery, p.SourceProductGroupID, p.FeedID, p.ID)
	if err != nil {
		return
	}
	defer sRows.Close()

	var siblings []*models.SiblingProduct
	for sRows.Next() {
		var sib models.SiblingProduct
		if err := sRows.Scan(&sib.ID, &sib.CustomSku, &sib.Slug, &sib.SlugID, &sib.Color, &sib.ImageUrl); err == nil {
			siblings = append(siblings, &sib)
		}
	}
	p.ColorVariants = siblings
}

// GetProductByID fetches product, dynamic variant structures and translation tables
func (h *StoreCatalogHandler) GetProductByID(w http.ResponseWriter, r *http.Request) {
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

	p, err := fetchProductBase(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Product not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to query product details %s: %v", id, err)
		http.Error(w, `{"error":"Failed to fetch product information"}`, http.StatusInternalServerError)
		return
	}

	p.Images = fetchProductImages(ctx, p.ID)
	p.Variants = fetchStoreProductVariants(ctx, p.ID)
	p.Attributes = fetchProductAttributes(ctx, p.ID)
	fetchAndInjectAttributeTranslations(ctx, p)
	fetchProductSiblings(ctx, p)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(p)
}

type flatCategoryItem struct {
	models.Category
	TotalProducts  int
	ActiveProducts int
}

func fetchFlatCategories(ctx context.Context) ([]*flatCategoryItem, error) {
	query := `
		SELECT id, parent_id, title, slug, node_path, is_active, created_at, updated_at,
		       (SELECT COUNT(*) FROM catalog.products p WHERE p.category_id = c.id OR p.category_id IN (SELECT id FROM catalog.categories WHERE node_path <@ c.node_path)) as total_products,
		       (SELECT COUNT(*) FROM catalog.products p WHERE (p.category_id = c.id OR p.category_id IN (SELECT id FROM catalog.categories WHERE node_path <@ c.node_path)) AND p.is_active = true) as active_products
		FROM catalog.categories c
		WHERE is_active = true
		ORDER BY node_path ASC, title ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var flatList []*flatCategoryItem
	for rows.Next() {
		var fc flatCategoryItem
		if err := rows.Scan(
			&fc.ID, &fc.ParentID, &fc.Title, &fc.Slug, &fc.NodePath, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt,
			&fc.TotalProducts, &fc.ActiveProducts,
		); err == nil {
			flatList = append(flatList, &fc)
		}
	}
	return flatList, nil
}

func attachCategoryTranslations(ctx context.Context, nodesMap map[string]*models.CategoryNode) {
	transQuery := `
		SELECT category_id, language_code, title, seo_description 
		FROM catalog.category_translations`
	transRows, err := db.Pool.Query(ctx, transQuery)
	if err != nil {
		return
	}
	defer transRows.Close()

	for transRows.Next() {
		var catID, langCode, transTitle string
		var seoDesc *string
		if err := transRows.Scan(&catID, &langCode, &transTitle, &seoDesc); err == nil {
			if node, exists := nodesMap[catID]; exists {
				if node.Translations == nil {
					node.Translations = make(map[string]models.CategoryTranslation)
				}
				node.Translations[langCode] = models.CategoryTranslation{
					CategoryID:     catID,
					LanguageCode:   langCode,
					Title:          transTitle,
					SeoDescription: seoDesc,
				}
			}
		}
	}
}

func buildStoreCategoryTree(flatList []*flatCategoryItem, nodesMap map[string]*models.CategoryNode) []*models.CategoryNode {
	var roots []*models.CategoryNode
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
	return roots
}

// ListCategories fetches active categories hierarchically
func (h *StoreCatalogHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	flatList, err := fetchFlatCategories(ctx)
	if err != nil {
		log.Printf("Failed to list storefront categories: %v", err)
		http.Error(w, `{"error":"Failed to query categories"}`, http.StatusInternalServerError)
		return
	}

	nodesMap := make(map[string]*models.CategoryNode)
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
	roots := buildStoreCategoryTree(flatList, nodesMap)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(roots)
}

// ListBrands queries the active wholesale brands/suppliers list
func (h *StoreCatalogHandler) ListBrands(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(brands)
}

// ListAttributes queries the active distinct product attributes for sidebar filtering
func (h *StoreCatalogHandler) ListAttributes(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
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
func (h *StoreCatalogHandler) GetStoreSettings(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(s)
}

// ListLanguages queries the active storefront languages list from the database
func (h *StoreCatalogHandler) ListLanguages(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(languages)
}

// GetExchangeRates queries the active storefront exchange rates list from the database,
// implementing the daily 15:30 publication time-boundary and holiday fallback logic.
func (h *StoreCatalogHandler) GetExchangeRates(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(rates)
}

// GetPageBySlug fetches a single active custom page by its slug, returning all its translations
func (h *StoreCatalogHandler) GetPageBySlug(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(page)
}

// ListPages returns all active dynamic pages for storefront
func (h *StoreCatalogHandler) ListPages(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(pagesList)
}

// ListBlogPosts returns active blog posts for storefront
func (h *StoreCatalogHandler) ListBlogPosts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT b.id, b.slug, b.cover_image, b.is_active, b.created_at, b.updated_at,
		       t.language_code, t.title, t.summary, t.content, t.meta_title, t.meta_description
		FROM catalog.blog_posts b
		LEFT JOIN catalog.blog_post_translations t ON b.id = t.post_id
		WHERE b.is_active = true
		ORDER BY b.created_at DESC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to list blog posts: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	blogMap := make(map[string]*models.BlogPost)
	var orderedBlogIDs []string

	for rows.Next() {
		var (
			postID, slug                  string
			coverImage                    *string
			isActive                      bool
			createdAt, updatedAt          time.Time
			langCode, title, summary      *string
			content, metaTitle, metaDesc *string
		)

		err := rows.Scan(
			&postID, &slug, &coverImage, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &summary, &content, &metaTitle, &metaDesc,
		)
		if err != nil {
			log.Printf("[STORE API ERROR] Failed to scan blog post row: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}

		post, exists := blogMap[postID]
		if !exists {
			post = &models.BlogPost{
				ID:           postID,
				Slug:         slug,
				CoverImage:   coverImage,
				IsActive:     isActive,
				Translations: make(map[string]models.BlogPostTranslation),
				CreatedAt:    createdAt,
				UpdatedAt:    updatedAt,
			}
			blogMap[postID] = post
			orderedBlogIDs = append(orderedBlogIDs, postID)
		}

		if langCode != nil && title != nil && content != nil {
			post.Translations[*langCode] = models.BlogPostTranslation{
				Title:           *title,
				Summary:         summary,
				Content:         *content,
				MetaTitle:       metaTitle,
				MetaDescription: metaDesc,
			}
		}
	}

	blogList := make([]*models.BlogPost, 0, len(orderedBlogIDs))
	for _, id := range orderedBlogIDs {
		blogList = append(blogList, blogMap[id])
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(blogList)
}

// GetBlogPostBySlug returns a single active blog post by its slug
func (h *StoreCatalogHandler) GetBlogPostBySlug(w http.ResponseWriter, r *http.Request) {
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
		SELECT b.id, b.slug, b.cover_image, b.is_active, b.created_at, b.updated_at,
		       t.language_code, t.title, t.summary, t.content, t.meta_title, t.meta_description
		FROM catalog.blog_posts b
		LEFT JOIN catalog.blog_post_translations t ON b.id = t.post_id
		WHERE b.slug = $1 AND b.is_active = true`

	rows, err := db.Pool.Query(ctx, query, slug)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to fetch blog post by slug %s: %v", slug, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var post *models.BlogPost

	for rows.Next() {
		var (
			postID, postSlug              string
			coverImage                    *string
			isActive                      bool
			createdAt, updatedAt          time.Time
			langCode, title, summary      *string
			content, metaTitle, metaDesc *string
		)

		err := rows.Scan(
			&postID, &postSlug, &coverImage, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &summary, &content, &metaTitle, &metaDesc,
		)
		if err != nil {
			log.Printf("[STORE API ERROR] Failed to scan blog post row: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}

		if post == nil {
			post = &models.BlogPost{
				ID:           postID,
				Slug:         postSlug,
				CoverImage:   coverImage,
				IsActive:     isActive,
				Translations: make(map[string]models.BlogPostTranslation),
				CreatedAt:    createdAt,
				UpdatedAt:    updatedAt,
			}
		}

		if langCode != nil && title != nil && content != nil {
			post.Translations[*langCode] = models.BlogPostTranslation{
				Title:           *title,
				Summary:         summary,
				Content:         *content,
				MetaTitle:       metaTitle,
				MetaDescription: metaDesc,
			}
		}
	}

	if post == nil {
		http.Error(w, `{"error":"Blog post not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(post)
}

type gItem struct {
	ID                    string   `xml:"g:id"`
	Title                 string   `xml:"g:title"`
	Description           string   `xml:"g:description"`
	Link                  string   `xml:"g:link"`
	ImageLink             string   `xml:"g:image_link"`
	AdditionalImageLinks  []string `xml:"g:additional_image_link,omitempty"`
	Availability          string   `xml:"g:availability"`
	Price                 string   `xml:"g:price"`
	SalePrice             string   `xml:"g:sale_price,omitempty"`
	Brand                 string   `xml:"g:brand,omitempty"`
	GoogleProductCategory string   `xml:"g:google_product_category,omitempty"`
	Condition             string   `xml:"g:condition"`
	Gender                string   `xml:"g:gender,omitempty"`
	ItemGroupID           string   `xml:"g:item_group_id,omitempty"`
}

type gChannel struct {
	Title       string   `xml:"title"`
	Link        string   `xml:"link"`
	Description string   `xml:"description"`
	Items       []gItem  `xml:"item"`
}

type gRSS struct {
	XMLName xml.Name `xml:"rss"`
	Version string   `xml:"version,attr"`
	GNS     string   `xml:"xmlns:g,attr"`
	Channel gChannel `xml:"channel"`
}

func resolveFullImageURL(imgURL string) string {
	if !strings.HasPrefix(imgURL, "http://") && !strings.HasPrefix(imgURL, "https://") {
		return siteBaseURL + imgURL
	}
	return imgURL
}

func parseRawGoogleImages(imagesBytes []byte) ([]string, string) {
	var imgs []struct {
		ImageUrl string `json:"image_url"`
		IsCover  bool   `json:"is_cover"`
	}
	if len(imagesBytes) > 0 {
		_ = json.Unmarshal(imagesBytes, &imgs)
	}

	var coverImage string
	var allImages []string
	for _, img := range imgs {
		fullURL := resolveFullImageURL(img.ImageUrl)
		allImages = append(allImages, fullURL)
		if img.IsCover && coverImage == "" {
			coverImage = fullURL
		}
	}
	return allImages, coverImage
}

func normalizeGoogleImages(imagesBytes []byte) (string, []string) {
	allImages, coverImage := parseRawGoogleImages(imagesBytes)

	mainImage := coverImage
	if mainImage == "" {
		if len(allImages) > 0 {
			mainImage = allImages[0]
		} else {
			mainImage = siteBaseURL + "/placeholder.png"
		}
	}

	var additionalImages []string
	for _, img := range allImages {
		if img != mainImage {
			additionalImages = append(additionalImages, img)
		}
	}

	if len(additionalImages) > 10 {
		additionalImages = additionalImages[:10]
	}
	return mainImage, additionalImages
}

func normalizeGoogleGender(gender *string) string {
	if gender == nil {
		return "unisex"
	}
	gLower := strings.ToLower(*gender)
	if strings.Contains(gLower, "kad") || strings.Contains(gLower, "wom") || strings.Contains(gLower, "bayan") {
		return "female"
	}
	if strings.Contains(gLower, "erk") || strings.Contains(gLower, "men") || strings.Contains(gLower, "bay") {
		return "male"
	}
	return "unisex"
}

func mapRowToGoogleMerchantItem(rows pgx.Rows) (gItem, error) {
	var (
		id, title, slug                                          string
		description, customSku, gender, brandName, categoryTitle *string
		sourceProductGroupID                                     *string
		price                                                    float64
		discountedPrice                                          *float64
		currency                                                 string
		stock                                                    int
		imagesBytes                                              []byte
	)

	err := rows.Scan(
		&id, &title, &description, &customSku, &slug,
		&gender, &price, &discountedPrice, &currency, &stock,
		&brandName, &categoryTitle, &imagesBytes, &sourceProductGroupID,
	)
	if err != nil {
		return gItem{}, err
	}

	productURL := fmt.Sprintf("%s/product/%s", siteBaseURL, slug)
	descStr := title
	if description != nil && *description != "" {
		descStr = *description
	}

	mainImage, additionalImages := normalizeGoogleImages(imagesBytes)

	availability := "out_of_stock"
	if stock > 0 {
		availability = "in_stock"
	}

	priceStr := fmt.Sprintf("%.2f %s", price, currency)
	var salePriceStr string
	if discountedPrice != nil && *discountedPrice > 0 {
		salePriceStr = fmt.Sprintf("%.2f %s", *discountedPrice, currency)
	}

	brand := "Merter Vitrini"
	if brandName != nil && *brandName != "" {
		brand = *brandName
	}

	googleCategory := "Apparel & Accessories > Clothing"
	if categoryTitle != nil && *categoryTitle != "" {
		googleCategory = *categoryTitle
	}

	itemID := id
	if customSku != nil && *customSku != "" {
		itemID = *customSku
	}

	itemGroupID := ""
	if sourceProductGroupID != nil {
		itemGroupID = *sourceProductGroupID
	}

	return gItem{
		ID:                    itemID,
		Title:                 title,
		Description:           descStr,
		Link:                  productURL,
		ImageLink:             mainImage,
		AdditionalImageLinks:  additionalImages,
		Availability:          availability,
		Price:                 priceStr,
		SalePrice:             salePriceStr,
		Brand:                 brand,
		GoogleProductCategory: googleCategory,
		Condition:             "new",
		Gender:                normalizeGoogleGender(gender),
		ItemGroupID:           itemGroupID,
	}, nil
}

// GoogleMerchantFeed returns all active products in Google Merchant Center RSS 2.0 XML format
func (h *StoreCatalogHandler) GoogleMerchantFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	query := `
		SELECT p.id, p.title, p.description, p.custom_sku, p.slug, 
		       p.gender, p.price, p.discounted_price, p.currency, p.stock, 
		       p.brand_name, p.category_title, p.images_json, p.source_product_group_id
		FROM catalog.mv_products p
		WHERE p.is_active = true`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query products for Google Merchant Feed: %v", err)
		http.Error(w, `{"error":"Failed to query products"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var xmlItems []gItem
	for rows.Next() {
		item, errScan := mapRowToGoogleMerchantItem(rows)
		if errScan != nil {
			log.Printf("[STORE API ERROR] Failed to scan product row for Google Merchant Feed: %v", errScan)
			continue
		}
		xmlItems = append(xmlItems, item)
	}

	rssFeed := gRSS{
		Version: "2.0",
		GNS:     "http://base.google.com/ns/1.0",
		Channel: gChannel{
			Title:       "Merter Vitrini",
			Link:        siteBaseURL,
			Description: "Merter Toptan B2B Tekstil E-Ticaret",
			Items:       xmlItems,
		},
	}

	w.Header().Set(headerContentType, mimeApplicationXMLUTF8)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(xml.Header))

	encoder := xml.NewEncoder(w)
	encoder.Indent("", "  ")
	if err := encoder.Encode(rssFeed); err != nil {
		log.Printf("[STORE API ERROR] Failed to encode Google Merchant XML: %v", err)
	}
}





