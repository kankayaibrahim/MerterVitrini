package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
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

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpx"

	"github.com/jackc/pgx/v5"
)

type StoreCatalogHandler struct {
	Cfg *config.Config
}

func NewStoreCatalogHandler(cfgs ...*config.Config) *StoreCatalogHandler {
	var cfg *config.Config
	if len(cfgs) > 0 {
		cfg = cfgs[0]
	}
	return &StoreCatalogHandler{Cfg: cfg}
}

func shouldRecordStoreBrandEvent(r *http.Request) bool {
	if isSSRPrefetchRequest(r) {
		return false
	}
	if r != nil {
		if isBot, _ := classifyVisitorBot(r, r.UserAgent()); isBot {
			return false
		}
	}
	return true
}

func isStorePriceVisibleToCaller(ctx context.Context, r *http.Request) bool {
	var showToGuests bool
	if db.Pool != nil {
		_ = db.Pool.QueryRow(ctx, `SELECT COALESCE(show_prices_to_guests, false) FROM catalog.settings LIMIT 1`).Scan(&showToGuests)
	}
	if showToGuests {
		return true
	}
	return resolveAuthenticatedMemberID(r, "") != ""
}

func sanitizePublicStoreProduct(p *models.Product, showPrices bool) {
	if p == nil {
		return
	}
	p.BuyingPrice = nil
	p.FeedID = nil
	p.SourceProductID = ""
	p.SourceURL = nil

	for _, v := range p.Variants {
		if v == nil {
			continue
		}
		v.SourceVariantID = ""
		if !showPrices {
			v.Price = 0
			v.DiscountedPrice = nil
		}
	}

	if !showPrices {
		p.Price = 0
		p.DiscountedPrice = nil
		p.SinglePrice = nil
	}
}

func sanitizePublicStoreProducts(products []*models.Product, showPrices bool) {
	for _, p := range products {
		sanitizePublicStoreProduct(p, showPrices)
	}
}

var catalogExtraFilterKeys = []string{
	"brand_id", "category_id", "min_price", "max_price",
	"gender", "season", "fason", "private_label",
	"company_type", "max_moq", "export_country",
}

func hasCatalogExtraFilters(query url.Values) bool {
	for _, key := range catalogExtraFilterKeys {
		if strings.TrimSpace(query.Get(key)) != "" {
			return true
		}
	}
	for k, vals := range query {
		if strings.HasPrefix(k, "attr_") && len(parseCommaSeparatedValues(vals)) > 0 {
			return true
		}
	}
	return false
}

func computeProductSEOContentHash(p *models.Product) string {
	title := strings.ToLower(strings.TrimSpace(p.Title))
	desc := strings.ToLower(strings.TrimSpace(derefStringOr(p.Description, "")))
	fabric := strings.ToLower(strings.TrimSpace(derefStringOr(p.KumasFabric, "")))
	gender := strings.ToLower(strings.TrimSpace(derefStringOr(p.Gender, "")))
	raw := title + "|" + desc + "|" + fabric + "|" + gender
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func populateProductAIContent(ctx context.Context, p *models.Product) {
	if db.Pool == nil || p == nil || p.ID == "" {
		return
	}
	contentHash := computeProductSEOContentHash(p)
	var seoTitle, seoDesc string
	var highlightsBytes []byte
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(seo_title, ''), COALESCE(meta_title, '')),
		       COALESCE(NULLIF(seo_description, ''), COALESCE(meta_description, '')),
		       COALESCE(highlights, '[]'::jsonb)
		FROM catalog.product_ai_content
		WHERE product_id = $1 OR content_hash = $2
		ORDER BY (product_id = $1) DESC, updated_at DESC
		LIMIT 1
	`, p.ID, contentHash).Scan(&seoTitle, &seoDesc, &highlightsBytes)
	if err != nil {
		return
	}
	if trimmedTitle := strings.TrimSpace(seoTitle); trimmedTitle != "" {
		p.SeoTitle = &trimmedTitle
	}
	if trimmedDesc := strings.TrimSpace(seoDesc); trimmedDesc != "" {
		p.SeoDescription = &trimmedDesc
	}
	if len(highlightsBytes) > 0 {
		var highlights []string
		if json.Unmarshal(highlightsBytes, &highlights) == nil && len(highlights) > 0 {
			p.AiHighlights = highlights
		}
	}
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

func appendCatalogB2BFilters(sqlBase *string, query url.Values, argIndex *int, args *[]any) {
	if strings.EqualFold(strings.TrimSpace(query.Get("fason")), "true") {
		*sqlBase += " AND EXISTS (SELECT 1 FROM catalog.brands b WHERE b.id = p.brand_id AND b.supports_fason = true)"
	}
	if strings.EqualFold(strings.TrimSpace(query.Get("private_label")), "true") {
		*sqlBase += " AND EXISTS (SELECT 1 FROM catalog.brands b WHERE b.id = p.brand_id AND b.supports_private_label = true)"
	}
	if companyType := strings.TrimSpace(query.Get("company_type")); companyType != "" {
		*sqlBase += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM catalog.brands b WHERE b.id = p.brand_id AND COALESCE(b.company_type, 'uretici_toptanci') = $%d)", *argIndex)
		*args = append(*args, companyType)
		*argIndex++
	}
	if maxMoqStr := strings.TrimSpace(query.Get("max_moq")); maxMoqStr != "" {
		if maxMoq, err := strconv.Atoi(maxMoqStr); err == nil && maxMoq > 0 {
			*sqlBase += fmt.Sprintf(" AND (p.minimum_order_quantity <= $%d OR EXISTS (SELECT 1 FROM catalog.brands b WHERE b.id = p.brand_id AND COALESCE(b.min_order_quantity, 1) <= $%d))", *argIndex, *argIndex)
			*args = append(*args, maxMoq)
			*argIndex++
		}
	}
	if exportCountry := strings.TrimSpace(query.Get("export_country")); exportCountry != "" {
		*sqlBase += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM catalog.brands b WHERE b.id = p.brand_id AND b.export_countries ILIKE $%d)", *argIndex)
		*args = append(*args, "%"+exportCountry+"%")
		*argIndex++
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
	appendCatalogB2BFilters(&sqlBase, query, &argIndex, &args)

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
	products := make([]*models.Product, 0, 32)
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
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("catalog products scan iteration error: %w", err)
	}
	return products, nil
}

func buildSiblingGroupMapKey(brandID *string, feedID *string, groupID *string) string {
	if groupID == nil {
		return ""
	}
	g := strings.TrimSpace(*groupID)
	if g == "" {
		return ""
	}
	if brandID != nil {
		if b := strings.TrimSpace(*brandID); b != "" {
			return "b:" + b + "|" + g
		}
	}
	if feedID != nil {
		if f := strings.TrimSpace(*feedID); f != "" {
			return "f:" + f + "|" + g
		}
	}
	return ""
}

func collectProductGroupIDs(products []*models.Product) []string {
	var groupIDs []string
	seenGroups := make(map[string]bool)
	for _, p := range products {
		if p == nil || buildSiblingGroupMapKey(p.BrandID, p.FeedID, p.SourceProductGroupID) == "" {
			continue
		}
		g := strings.TrimSpace(*p.SourceProductGroupID)
		if !seenGroups[g] {
			seenGroups[g] = true
			groupIDs = append(groupIDs, g)
		}
	}
	return groupIDs
}

func querySiblingProductMap(ctx context.Context, groupIDs []string) map[string][]*models.SiblingProduct {
	siblingsMap := make(map[string][]*models.SiblingProduct)
	if len(groupIDs) == 0 || db.Pool == nil {
		return siblingsMap
	}
	siblingsQuery := `
		SELECT p.id, COALESCE(p.brand_id::text, '') as brand_id, COALESCE(p.feed_id, '') as feed_id,
		       COALESCE(p.source_product_group_id, '') as source_product_group_id,
		       p.custom_sku, p.slug, p.slug_id, COALESCE(col.color_name, 'Standart') as color,
		       COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY is_cover DESC, sort_order ASC LIMIT 1), '') as image_url
		FROM catalog.products p
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE p.source_product_group_id = ANY($1)
		  AND p.is_active = true
		  AND COALESCE(p.is_archived, false) = false
		ORDER BY col.color_name ASC`

	sRows, err := db.Pool.Query(ctx, siblingsQuery, groupIDs)
	if err != nil {
		log.Printf("[STORE API WARNING] Failed to query sibling color variants: %v", err)
		return siblingsMap
	}
	defer sRows.Close()

	for sRows.Next() {
		var sib models.SiblingProduct
		var brandID, feedID, groupID string
		if err := sRows.Scan(&sib.ID, &brandID, &feedID, &groupID, &sib.CustomSku, &sib.Slug, &sib.SlugID, &sib.Color, &sib.ImageUrl); err != nil {
			continue
		}
		g := strings.TrimSpace(groupID)
		if g == "" {
			continue
		}
		if b := strings.TrimSpace(brandID); b != "" {
			key := "b:" + b + "|" + g
			siblingsMap[key] = append(siblingsMap[key], &sib)
		}
		if f := strings.TrimSpace(feedID); f != "" {
			key := "f:" + f + "|" + g
			siblingsMap[key] = append(siblingsMap[key], &sib)
		}
	}
	if err := sRows.Err(); err != nil {
		log.Printf("[STORE API WARNING] Sibling color variants scan iteration error: %v", err)
	}
	return siblingsMap
}

func assignProductSiblings(products []*models.Product, siblingsMap map[string][]*models.SiblingProduct) {
	for _, p := range products {
		if p == nil {
			continue
		}
		key := buildSiblingGroupMapKey(p.BrandID, p.FeedID, p.SourceProductGroupID)
		if key == "" {
			continue
		}
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
	fetchCatalogBrandProfiles(ctx, products)
	facets := fetchCatalogFacets(ctx, sqlBase, args[:argIndex-1])

	queryParams := r.URL.Query()
	if searchText := strings.TrimSpace(queryParams.Get("q")); searchText != "" && offset == 0 && shouldRecordStoreBrandEvent(r) {
		recordStoreSearchLogAsync(r, searchLogEntry{
			QueryText:    searchText,
			LanguageCode: queryParams.Get("lang"),
			CategorySlug: queryParams.Get("category_id"),
			ResultsCount: totalCount,
			HasFilters:   hasCatalogExtraFilters(queryParams),
		})
	}

	showPrices := isStorePriceVisibleToCaller(ctx, r)
	sanitizePublicStoreProducts(products, showPrices)

	w.Header().Add("Vary", "Authorization")
	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(map[string]any{
		"products": products,
		"total":    totalCount,
		"facets":   facets,
	})
}

func collectUniqueProductBrandIDs(products []*models.Product) []string {
	seen := make(map[string]bool, len(products))
	var brandIDs []string
	for _, p := range products {
		if p != nil && p.BrandID != nil {
			bid := strings.TrimSpace(*p.BrandID)
			if bid != "" && !seen[bid] {
				seen[bid] = true
				brandIDs = append(brandIDs, bid)
			}
		}
	}
	return brandIDs
}

func fetchCatalogBrandProfiles(ctx context.Context, products []*models.Product) {
	brandIDs := collectUniqueProductBrandIDs(products)
	if len(brandIDs) == 0 {
		return
	}
	brandRows, err := db.Pool.Query(ctx, `
		SELECT b.id, b.brand_name AS name, b.slug, b.alias_code,
		       COALESCE(b.company_type, 'uretici_toptanci'),
		       COALESCE(b.description, ''),
		       b.website, b.phone,
		       COALESCE(b.landline_phone, ''),
		       COALESCE(
		           NULLIF(b.whatsapp_phone, ''),
		           NULLIF(b.phone, ''),
		           (SELECT COALESCE(NULLIF(su.phone, ''), '') FROM catalog.supplier_users su WHERE su.brand_id = b.id AND su.phone IS NOT NULL AND su.phone <> '' ORDER BY su.is_owner DESC, su.created_at ASC LIMIT 1),
		           ''
		       ),
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
		       COALESCE(b.bank_name, ''),
		       COALESCE(b.bank_account_holder, ''),
		       COALESCE(b.iban, '')
		FROM catalog.brands b
		WHERE b.is_active = true AND b.id::text = ANY($1)
	`, brandIDs)
	if err != nil {
		return
	}
	defer brandRows.Close()

	brandMap := make(map[string]*models.Brand)
	for brandRows.Next() {
		var b models.Brand
		if err := brandRows.Scan(
			&b.ID, &b.Name, &b.Slug, &b.AliasCode,
			&b.CompanyType, &b.Description,
			&b.Website, &b.Phone, &b.LandlinePhone,
			&b.WhatsappPhone, &b.PublicEmail, &b.InstagramHandle,
			&b.City, &b.District, &b.LocationAddress, &b.ExportCountries, &b.MinOrderQuantity,
			&b.SupportsPrivateLabel, &b.SupportsFason, &b.IsVerified,
			&b.BankName, &b.BankAccountHolder, &b.IBAN,
		); err == nil {
			b.IsActive = true
			brandCopy := b
			brandMap[b.ID] = &brandCopy
		}
	}

	for _, p := range products {
		if p.BrandID != nil {
			if bp, ok := brandMap[*p.BrandID]; ok {
				p.BrandProfile = bp
			}
		}
	}
}

func fetchProductBase(ctx context.Context, id string) (*models.Product, error) {
	var p models.Product
	var b models.Brand
	var translationsBytes []byte
	prodQuery := `
		SELECT p.id, p.feed_id, p.source_product_id, p.source_product_group_id, p.title, p.slug, p.slug_id, p.custom_sku, 
		       p.short_description, p.description, p.brand_id, p.category_id, 
		       p.gender, p.season, COALESCE(fab.fabric_name, 'Polyester') as kumas_fabric, p.desi_volume, p.shipping_weight_kg, 
		       p.packing_ratio, p.series_ratio, p.minimum_order_quantity, 
		       p.price, p.discounted_price, p.single_price, p.buying_price, p.currency, p.tax_rate, COALESCE(col.color_name, 'Standart') as color, p.stock, p.sku, p.barcode,
		       p.is_active, 
		       p.created_at, p.updated_at, b.brand_name as brand_name, c.title as category_title,
		       b.id, b.brand_name, b.slug, b.alias_code,
		       COALESCE(b.company_type, 'uretici_toptanci'),
		       COALESCE(b.description, ''),
		       b.website, b.phone,
		       COALESCE(b.landline_phone, ''),
		       COALESCE(
		           NULLIF(b.whatsapp_phone, ''),
		           NULLIF(b.phone, ''),
		           (SELECT COALESCE(NULLIF(su.phone, ''), '') FROM catalog.supplier_users su WHERE su.brand_id = b.id AND su.phone IS NOT NULL AND su.phone <> '' ORDER BY su.is_owner DESC, su.created_at ASC LIMIT 1),
		           ''
		       ),
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
		       COALESCE(b.bank_name, ''),
		       COALESCE(b.bank_account_holder, ''),
		       COALESCE(b.iban, ''),
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
		&b.ID, &b.Name, &b.Slug, &b.AliasCode,
		&b.CompanyType, &b.Description,
		&b.Website, &b.Phone, &b.LandlinePhone,
		&b.WhatsappPhone, &b.PublicEmail, &b.InstagramHandle,
		&b.City, &b.District, &b.LocationAddress, &b.ExportCountries, &b.MinOrderQuantity,
		&b.SupportsPrivateLabel, &b.SupportsFason, &b.IsVerified,
		&b.BankName, &b.BankAccountHolder, &b.IBAN,
		&translationsBytes,
	)
	if err != nil {
		return nil, err
	}
	b.IsActive = true
	p.BrandProfile = &b
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
	if err := vRows.Err(); err != nil {
		log.Printf("[STORE API WARNING] Variants scan error for product %s: %v", productID, err)
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
	if err := aRows.Err(); err != nil {
		log.Printf("[STORE API WARNING] Attributes scan error for product %s: %v", productID, err)
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
	if err := taRows.Err(); err != nil {
		log.Printf("[STORE API WARNING] Attribute translations scan error for product %s: %v", p.ID, err)
	}
}

func fetchProductSiblings(ctx context.Context, p *models.Product) {
	if p == nil || p.SourceProductGroupID == nil || db.Pool == nil {
		return
	}
	groupID := strings.TrimSpace(*p.SourceProductGroupID)
	if groupID == "" {
		return
	}
	brandID := strings.TrimSpace(derefStringOr(p.BrandID, ""))
	feedID := strings.TrimSpace(derefStringOr(p.FeedID, ""))
	if brandID == "" && feedID == "" {
		return
	}

	siblingsQuery := `
		SELECT p.id, p.custom_sku, p.slug, p.slug_id, COALESCE(col.color_name, 'Standart') as color,
		       COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY is_cover DESC, sort_order ASC LIMIT 1), '') as image_url
		FROM catalog.products p
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE p.source_product_group_id = $1
		  AND (
		    ($2 <> '' AND p.brand_id::text = $2)
		    OR ($2 = '' AND COALESCE(p.feed_id, '') = $3)
		  )
		  AND p.id != $4
		  AND p.is_active = true
		  AND COALESCE(p.is_archived, false) = false
		ORDER BY col.color_name ASC`
	sRows, err := db.Pool.Query(ctx, siblingsQuery, groupID, brandID, feedID, p.ID)
	if err != nil {
		log.Printf("[STORE API WARNING] Product siblings query error for product %s: %v", p.ID, err)
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
	if err := sRows.Err(); err != nil {
		log.Printf("[STORE API WARNING] Product siblings scan error for product %s: %v", p.ID, err)
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
	populateProductAIContent(ctx, p)

	if p.BrandID != nil && *p.BrandID != "" && shouldRecordStoreBrandEvent(r) {
		RecordBrandAnalyticsEvent(*p.BrandID, p.ID, "product_view", r)
	}

	showPrices := isStorePriceVisibleToCaller(ctx, r)
	sanitizePublicStoreProduct(p, showPrices)

	w.Header().Add("Vary", "Authorization")
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
		SELECT b.id, b.brand_name AS name, b.slug, b.alias_code,
		       COALESCE(b.company_type, 'uretici_toptanci'),
		       COALESCE(b.description, ''),
		       COALESCE(b.description_translations, '{}'::jsonb),
		       b.website, b.phone,
		       COALESCE(b.landline_phone, ''),
		       COALESCE(
		           NULLIF(b.whatsapp_phone, ''),
		           NULLIF(b.phone, ''),
		           (SELECT COALESCE(NULLIF(su.phone, ''), '') FROM catalog.supplier_users su WHERE su.brand_id = b.id AND su.phone IS NOT NULL AND su.phone <> '' ORDER BY su.is_owner DESC, su.created_at ASC LIMIT 1),
		           ''
		       ),
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
		       COALESCE(b.bank_name, ''),
		       COALESCE(b.bank_account_holder, ''),
		       COALESCE(b.iban, ''),
		       (SELECT COUNT(*)::int FROM catalog.products p WHERE p.brand_id = b.id AND p.is_active = true) AS active_product_count,
		       b.addresses, b.is_active, b.created_at, b.updated_at
		FROM catalog.brands b
		WHERE b.is_active = true
		  AND EXISTS (SELECT 1 FROM catalog.products p WHERE p.brand_id = b.id AND p.is_active = true)
		ORDER BY b.brand_name ASC`

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
		var addressesBytes, descTransBytes []byte
		err := rows.Scan(
			&b.ID, &b.Name, &b.Slug, &b.AliasCode,
			&b.CompanyType, &b.Description, &descTransBytes,
			&b.Website, &b.Phone, &b.LandlinePhone,
			&b.WhatsappPhone, &b.PublicEmail, &b.InstagramHandle,
			&b.City, &b.District, &b.LocationAddress, &b.ExportCountries, &b.MinOrderQuantity,
			&b.SupportsPrivateLabel, &b.SupportsFason, &b.IsVerified,
			&b.BankName, &b.BankAccountHolder, &b.IBAN,
			&b.ActiveProductCount,
			&addressesBytes, &b.IsActive, &b.CreatedAt, &b.UpdatedAt,
		)
		if err == nil {
			if len(addressesBytes) > 0 {
				json.Unmarshal(addressesBytes, &b.Addresses)
			}
			if len(descTransBytes) > 0 {
				json.Unmarshal(descTransBytes, &b.DescriptionTranslations)
			}
			brands = append(brands, &b)
		}
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(brands)
}

// GetBrandBySlug queries a single active wholesale brand/supplier by slug or ID
func (h *StoreCatalogHandler) GetBrandBySlug(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	slugOrID := strings.TrimSpace(r.PathValue("slug"))
	if slugOrID == "" {
		http.Error(w, `{"error":"Supplier slug is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT b.id, b.brand_name AS name, b.slug, b.alias_code,
		       COALESCE(b.company_type, 'uretici_toptanci'),
		       COALESCE(b.description, ''),
		       COALESCE(b.description_translations, '{}'::jsonb),
		       b.website, b.phone,
		       COALESCE(b.landline_phone, ''),
		       COALESCE(
		           NULLIF(b.whatsapp_phone, ''),
		           NULLIF(b.phone, ''),
		           (SELECT COALESCE(NULLIF(su.phone, ''), '') FROM catalog.supplier_users su WHERE su.brand_id = b.id AND su.phone IS NOT NULL AND su.phone <> '' ORDER BY su.is_owner DESC, su.created_at ASC LIMIT 1),
		           ''
		       ),
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
		       COALESCE(b.bank_name, ''),
		       COALESCE(b.bank_account_holder, ''),
		       COALESCE(b.iban, ''),
		       (SELECT COUNT(*)::int FROM catalog.products p WHERE p.brand_id = b.id AND p.is_active = true) AS active_product_count,
		       b.addresses, b.is_active, b.created_at, b.updated_at
		FROM catalog.brands b
		WHERE b.is_active = true AND (b.slug = $1 OR b.id::text = $1)
		LIMIT 1`

	var b models.Brand
	var addressesBytes, descTransBytes []byte
	err := db.Pool.QueryRow(ctx, query, slugOrID).Scan(
		&b.ID, &b.Name, &b.Slug, &b.AliasCode,
		&b.CompanyType, &b.Description, &descTransBytes,
		&b.Website, &b.Phone, &b.LandlinePhone,
		&b.WhatsappPhone, &b.PublicEmail, &b.InstagramHandle,
		&b.City, &b.District, &b.LocationAddress, &b.ExportCountries, &b.MinOrderQuantity,
		&b.SupportsPrivateLabel, &b.SupportsFason, &b.IsVerified,
		&b.BankName, &b.BankAccountHolder, &b.IBAN,
		&b.ActiveProductCount,
		&addressesBytes, &b.IsActive, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		http.Error(w, `{"error":"Supplier not found"}`, http.StatusNotFound)
		return
	}
	if len(addressesBytes) > 0 {
		json.Unmarshal(addressesBytes, &b.Addresses)
	}
	if len(descTransBytes) > 0 {
		json.Unmarshal(descTransBytes, &b.DescriptionTranslations)
	}

	if shouldRecordStoreBrandEvent(r) {
		RecordBrandAnalyticsEvent(b.ID, "", "profile_view", r)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(b)
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

// GetStoreSettings fetches the singleton global storefront contact settings
func (h *StoreCatalogHandler) GetStoreSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var s models.Settings
	query := `SELECT id, address, phone, whatsapp, email, show_single_price, COALESCE(show_prices_to_guests, false), updated_at FROM catalog.settings LIMIT 1`
	err := db.Pool.QueryRow(ctx, query).Scan(&s.ID, &s.Address, &s.Phone, &s.Whatsapp, &s.Email, &s.ShowSinglePrice, &s.ShowPricesToGuests, &s.UpdatedAt)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to fetch settings: %v", err)
		http.Error(w, `{"error":"Failed to fetch settings"}`, http.StatusInternalServerError)
		return
	}

	var cfg *config.Config
	if h != nil {
		cfg = h.Cfg
	}
	effectiveReCaptcha := resolveEffectiveReCaptcha(ctx, cfg)
	s.RecaptchaEnabled = effectiveReCaptcha.Enforce
	if effectiveReCaptcha.Enforce {
		s.RecaptchaSiteKey = effectiveReCaptcha.SiteKey
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
			pageID, pageSlug           string
			isActive                   bool
			createdAt, updatedAt       time.Time
			langCode, title, content   *string
			metaTitle, metaDescription *string
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
			pageID, pageSlug           string
			isActive                   bool
			createdAt, updatedAt       time.Time
			langCode, title, content   *string
			metaTitle, metaDescription *string
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
		       t.language_code, t.title,
		       COALESCE(NULLIF(t.summary, ''), LEFT(REGEXP_REPLACE(t.content, '<[^>]+>', ' ', 'g'), 180)) AS summary,
		       t.meta_title, t.meta_description,
		       COALESCE(t.slug, b.slug) AS trans_slug
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
			postID, slug             string
			coverImage               *string
			isActive                 bool
			createdAt, updatedAt     time.Time
			langCode, title, summary *string
			metaTitle, metaDesc      *string
			transSlug                *string
		)

		err := rows.Scan(
			&postID, &slug, &coverImage, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &summary, &metaTitle, &metaDesc, &transSlug,
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

		if langCode != nil && title != nil {
			post.Translations[*langCode] = models.BlogPostTranslation{
				Slug:            transSlug,
				Title:           *title,
				Summary:         summary,
				Content:         "",
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

// GetBlogPostBySlug returns a single active blog post by its slug (supports localized slug lookup)
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
		       t.language_code, t.title, t.summary, t.content, t.meta_title, t.meta_description,
		       COALESCE(t.slug, b.slug) AS trans_slug
		FROM catalog.blog_posts b
		LEFT JOIN catalog.blog_post_translations t ON b.id = t.post_id
		WHERE b.is_active = true
		  AND (
		      b.slug = $1
		      OR b.id IN (
		          SELECT post_id FROM catalog.blog_post_translations WHERE slug = $1
		      )
		  )`

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
			postID, postSlug             string
			coverImage                   *string
			isActive                     bool
			createdAt, updatedAt         time.Time
			langCode, title, summary     *string
			content, metaTitle, metaDesc *string
			transSlug                    *string
		)

		err := rows.Scan(
			&postID, &postSlug, &coverImage, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &summary, &content, &metaTitle, &metaDesc, &transSlug,
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
				Slug:            transSlug,
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
	ID                     string   `xml:"g:id"`
	Title                  string   `xml:"g:title"`
	Description            string   `xml:"g:description"`
	Link                   string   `xml:"g:link"`
	ImageLink              string   `xml:"g:image_link"`
	AdditionalImageLinks   []string `xml:"g:additional_image_link,omitempty"`
	Availability           string   `xml:"g:availability"`
	Price                  string   `xml:"g:price"`
	SalePrice              string   `xml:"g:sale_price,omitempty"`
	Brand                  string   `xml:"g:brand,omitempty"`
	GoogleProductCategory  string   `xml:"g:google_product_category,omitempty"`
	Condition              string   `xml:"g:condition"`
	Gender                 string   `xml:"g:gender,omitempty"`
	ItemGroupID            string   `xml:"g:item_group_id,omitempty"`
	Multipack              int      `xml:"g:multipack,omitempty"`
	UnitPricingMeasure     string   `xml:"g:unit_pricing_measure,omitempty"`
	UnitPricingBaseMeasure string   `xml:"g:unit_pricing_base_measure,omitempty"`
	CustomLabel0           string   `xml:"g:custom_label_0,omitempty"`
	CustomLabel1           string   `xml:"g:custom_label_1,omitempty"`
	CustomLabel2           string   `xml:"g:custom_label_2,omitempty"`
	CustomLabel3           string   `xml:"g:custom_label_3,omitempty"`
	CustomLabel4           string   `xml:"g:custom_label_4,omitempty"`
	ExcludedDestination    string   `xml:"g:excluded_destination,omitempty"`
}

type gChannel struct {
	Title       string  `xml:"title"`
	Link        string  `xml:"link"`
	Description string  `xml:"description"`
	Items       []gItem `xml:"item"`
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

func isRatioDelimiter(r rune) bool {
	return r == '-' || r == ',' || r == '/'
}

func parseRatioString(ratio string) int {
	parts := strings.FieldsFunc(strings.TrimSpace(ratio), isRatioDelimiter)
	total := 0
	hasNum := false
	for _, part := range parts {
		if n, err := strconv.Atoi(strings.TrimSpace(part)); err == nil && n > 0 {
			total += n
			hasNum = true
		}
	}
	if hasNum && total > 0 {
		return total
	}
	if len(parts) > 1 {
		return len(parts)
	}
	return 0
}

func parseSeriesPieces(seriesRatio *string, moq *int) int {
	if seriesRatio != nil && *seriesRatio != "" {
		if pieces := parseRatioString(*seriesRatio); pieces > 0 {
			return pieces
		}
	}
	if moq != nil && *moq > 1 {
		return *moq
	}
	return 1
}

func derefStringOr(ptr *string, fallback string) string {
	if ptr != nil && *ptr != "" {
		return *ptr
	}
	return fallback
}

func buildGoogleCustomLabels(seriesRatio, fabric *string, moq *int) (string, string, string) {
	var label1, label2, label3 string
	if seriesRatio != nil && *seriesRatio != "" {
		label1 = fmt.Sprintf("Seri: %s", *seriesRatio)
	}

	minOrder := 1
	if moq != nil && *moq > 0 {
		minOrder = *moq
	}
	label2 = fmt.Sprintf("MOQ: %d Paket", minOrder)

	if fabric != nil && *fabric != "" && *fabric != "Polyester" {
		label3 = *fabric
	}
	return label1, label2, label3
}

func formatGooglePrices(price float64, discountedPrice *float64, currency string) (string, string) {
	priceStr := fmt.Sprintf("%.2f %s", price, currency)
	var salePriceStr string
	if discountedPrice != nil && *discountedPrice > 0 {
		salePriceStr = fmt.Sprintf("%.2f %s", *discountedPrice, currency)
	}
	return priceStr, salePriceStr
}

func normalizeFeedLang(raw, fallback string) string {
	clean := strings.ToLower(strings.TrimSpace(raw))
	if supportedLangSegments[clean] {
		return clean
	}
	return fallback
}

func formatLocalizedProductURL(slug, lang string) string {
	if lang == "" || lang == defaultLangTR {
		return fmt.Sprintf("%s/product/%s", siteBaseURL, slug)
	}
	return fmt.Sprintf("%s/product/%s?lang=%s", siteBaseURL, slug, lang)
}

func localizedWholesalePackSuffix(lang string, packPieces int) string {
	switch lang {
	case "en":
		return fmt.Sprintf("[Wholesale Pack / %d Pcs]", packPieces)
	case "ru":
		return fmt.Sprintf("[Оптом серия / %d шт.]", packPieces)
	case "ar":
		return fmt.Sprintf("[جملة سيري / %d قطعة]", packPieces)
	case "de":
		return fmt.Sprintf("[Großhandel Serie / %d Stk.]", packPieces)
	case "fr":
		return fmt.Sprintf("[Série Grossiste / %d Pcs]", packPieces)
	case "pl":
		return fmt.Sprintf("[Hurt Seria / %d szt.]", packPieces)
	case "bg":
		return fmt.Sprintf("[На едро серия / %d бр.]", packPieces)
	default:
		return fmt.Sprintf("[Toptan Seri / %d Adet]", packPieces)
	}
}

func mapRowToGoogleMerchantItem(rows pgx.Rows, lang string) (gItem, error) {
	var (
		id, title, slug                                          string
		description, customSku, gender, brandName, categoryTitle *string
		sourceProductGroupID                                     *string
		price                                                    float64
		discountedPrice                                          *float64
		currency                                                 string
		stock                                                    int
		imagesBytes                                              []byte
		seriesRatio, fabric                                      *string
		moq                                                      *int
	)

	err := rows.Scan(
		&id, &title, &description, &customSku, &slug,
		&gender, &price, &discountedPrice, &currency, &stock,
		&brandName, &categoryTitle, &imagesBytes, &sourceProductGroupID,
		&seriesRatio, &moq, &fabric,
	)
	if err != nil {
		return gItem{}, err
	}

	mainImage, additionalImages := normalizeGoogleImages(imagesBytes)
	availability := "out_of_stock"
	if stock > 0 {
		availability = "in_stock"
	}

	priceStr, salePriceStr := formatGooglePrices(price, discountedPrice, currency)
	customLabel1, customLabel2, customLabel3 := buildGoogleCustomLabels(seriesRatio, fabric, moq)

	packPieces := parseSeriesPieces(seriesRatio, moq)
	displayTitle := title
	var unitPricingMeasure, unitPricingBaseMeasure string
	if packPieces > 1 {
		displayTitle = fmt.Sprintf("%s %s", title, localizedWholesalePackSuffix(lang, packPieces))
		unitPricingMeasure = fmt.Sprintf("%d ct", packPieces)
		unitPricingBaseMeasure = "1 ct"
	}

	return gItem{
		ID:                     derefStringOr(customSku, id),
		Title:                  displayTitle,
		Description:            derefStringOr(description, title),
		Link:                   formatLocalizedProductURL(slug, lang),
		ImageLink:              mainImage,
		AdditionalImageLinks:   additionalImages,
		Availability:           availability,
		Price:                  priceStr,
		SalePrice:              salePriceStr,
		Brand:                  derefStringOr(brandName, defaultStoreVendorName),
		GoogleProductCategory:  derefStringOr(categoryTitle, "Apparel & Accessories > Clothing"),
		Condition:              "new",
		Gender:                 normalizeGoogleGender(gender),
		ItemGroupID:            derefStringOr(sourceProductGroupID, ""),
		Multipack:              packPieces,
		UnitPricingMeasure:     unitPricingMeasure,
		UnitPricingBaseMeasure: unitPricingBaseMeasure,
		CustomLabel0:           "Wholesale B2B",
		CustomLabel1:           customLabel1,
		CustomLabel2:           customLabel2,
		CustomLabel3:           customLabel3,
	}, nil
}

// GoogleMerchantFeed returns all active products in Google Merchant Center RSS 2.0 XML format (supports ?lang=tr|en|ru|ar|de|fr|pl|bg).
func (h *StoreCatalogHandler) GoogleMerchantFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	lang := normalizeFeedLang(r.URL.Query().Get("lang"), defaultLangTR)
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	query := `
		SELECT p.id,
		       CASE WHEN $1 = 'tr' THEN p.title ELSE COALESCE(NULLIF(pt.title, ''), p.title) END AS loc_title,
		       CASE WHEN $1 = 'tr' THEN p.description ELSE COALESCE(NULLIF(pt.description, ''), NULLIF(pt.short_description, ''), p.description) END AS loc_desc,
		       p.custom_sku, p.slug,
		       p.gender, p.price, p.discounted_price, p.currency, p.stock,
		       p.brand_name,
		       CASE WHEN $1 = 'tr' THEN p.category_title ELSE COALESCE(NULLIF(ct.title, ''), p.category_title) END AS loc_cat,
		       p.images_json, p.source_product_group_id,
		       p.series_ratio, p.minimum_order_quantity, p.kumas_fabric
		FROM catalog.mv_products p
		LEFT JOIN catalog.product_translations pt ON pt.product_id = p.id AND pt.language_code = $1
		LEFT JOIN catalog.category_translations ct ON ct.category_id = p.category_id AND ct.language_code = $1
		WHERE p.is_active = true`

	rows, err := db.Pool.Query(ctx, query, lang)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query products for Google Merchant Feed: %v", err)
		http.Error(w, errJSONFailedQueryProds, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var showToGuests bool
	if db.Pool != nil {
		_ = db.Pool.QueryRow(ctx, `SELECT COALESCE(show_prices_to_guests, false) FROM catalog.settings LIMIT 1`).Scan(&showToGuests)
	}

	var xmlItems []gItem
	for rows.Next() {
		item, errScan := mapRowToGoogleMerchantItem(rows, lang)
		if errScan != nil {
			log.Printf("[STORE API ERROR] Failed to scan product row for Google Merchant Feed: %v", errScan)
			continue
		}
		if !showToGuests {
			item.ExcludedDestination = "Shopping_ads"
			item.CustomLabel0 = "Wholesale B2B - Member Quote"
			item.CustomLabel4 = "MembersOnly"
		}
		xmlItems = append(xmlItems, item)
	}

	feedLink := siteBaseURL
	if lang != defaultLangTR {
		feedLink = fmt.Sprintf("%s?lang=%s", siteBaseURL, lang)
	}

	rssFeed := gRSS{
		Version: "2.0",
		GNS:     "http://base.google.com/ns/1.0",
		Channel: gChannel{
			Title:       defaultStoreVendorName,
			Link:        feedLink,
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

// GetProductsSitemapData returns lightweight product sitemap data (slug and updated_at) from catalog.mv_products.
func (h *StoreCatalogHandler) GetProductsSitemapData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	query := `
		SELECT slug, updated_at
		FROM catalog.mv_products
		WHERE is_active = true
		ORDER BY updated_at DESC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query products for sitemap: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "Failed to load products for sitemap")
		return
	}
	defer rows.Close()

	type sitemapProduct struct {
		Slug      string     `json:"slug"`
		UpdatedAt *time.Time `json:"updated_at"`
	}

	items := make([]sitemapProduct, 0, 1024)
	for rows.Next() {
		var item sitemapProduct
		if err := rows.Scan(&item.Slug, &item.UpdatedAt); err != nil {
			log.Printf("[STORE API ERROR] Failed to scan sitemap product row: %v", err)
			continue
		}
		items = append(items, item)
	}

	httpx.JSON(w, http.StatusOK, items)
}

type ymlCurrency struct {
	ID   string `xml:"id,attr"`
	Rate string `xml:"rate,attr"`
}

type ymlCategory struct {
	ID       int    `xml:"id,attr"`
	ParentID int    `xml:"parentId,attr,omitempty"`
	Name     string `xml:",chardata"`
}

type ymlParam struct {
	Name  string `xml:"name,attr"`
	Value string `xml:",chardata"`
}

type ymlOffer struct {
	ID                   string     `xml:"id,attr"`
	Available            bool       `xml:"available,attr"`
	GroupID              string     `xml:"group_id,attr,omitempty"`
	URL                  string     `xml:"url"`
	Price                string     `xml:"price"`
	OldPrice             string     `xml:"oldprice,omitempty"`
	CurrencyID           string     `xml:"currencyId"`
	CategoryID           int        `xml:"categoryId"`
	Pictures             []string   `xml:"picture,omitempty"`
	Vendor               string     `xml:"vendor,omitempty"`
	VendorCode           string     `xml:"vendorCode,omitempty"`
	Name                 string     `xml:"name"`
	Description          string     `xml:"description,omitempty"`
	SalesNotes           string     `xml:"sales_notes"`
	ManufacturerWarranty bool       `xml:"manufacturer_warranty"`
	CountryOfOrigin      string     `xml:"country_of_origin"`
	Params               []ymlParam `xml:"param,omitempty"`
}

type ymlShop struct {
	Name       string        `xml:"name"`
	Company    string        `xml:"company"`
	URL        string        `xml:"url"`
	Currencies []ymlCurrency `xml:"currencies>currency"`
	Categories []ymlCategory `xml:"categories>category"`
	Offers     []ymlOffer    `xml:"offers>offer"`
}

type ymlCatalog struct {
	XMLName xml.Name `xml:"yml_catalog"`
	Date    string   `xml:"date,attr"`
	Shop    ymlShop  `xml:"shop"`
}

const (
	yandexWholesaleSalesNotes = "Оптом размерными рядами из Мертера (Стамбул)"
	defaultStoreVendorName    = "Merter Vitrini"
	errJSONFailedQueryProds   = `{"error":"Failed to query products"}`
)

func fetchYMLCurrencies(ctx context.Context) []ymlCurrency {
	currencies := []ymlCurrency{{ID: defaultCurrencyTRY, Rate: "1"}}
	rows, err := db.Pool.Query(ctx, `
		SELECT DISTINCT ON (UPPER(currency_code))
			UPPER(currency_code), buying_rate
		FROM catalog.exchange_rates
		WHERE UPPER(currency_code) IN ('USD', 'EUR', 'RUB', 'GBP')
		ORDER BY UPPER(currency_code), publication_date DESC
	`)
	if err != nil {
		return currencies
	}
	defer rows.Close()

	for rows.Next() {
		var code string
		var rate float64
		if rows.Scan(&code, &rate) == nil && rate > 0 {
			currencies = append(currencies, ymlCurrency{
				ID:   code,
				Rate: fmt.Sprintf("%.4f", rate),
			})
		}
	}
	return currencies
}

func fetchYMLCategories(ctx context.Context, lang string) ([]ymlCategory, map[string]int) {
	idMap := make(map[string]int)
	type rawCat struct {
		uuid     string
		parentID *string
		title    string
	}
	var rawList []rawCat

	rows, err := db.Pool.Query(ctx, `
		SELECT c.id::text, c.parent_id::text,
		       CASE WHEN $1 = 'tr' THEN c.title ELSE COALESCE(NULLIF(ct.title, ''), c.title) END AS loc_title
		FROM catalog.categories c
		LEFT JOIN catalog.category_translations ct ON ct.category_id = c.id AND ct.language_code = $1
		WHERE c.is_active = true
		ORDER BY c.node_path ASC, c.title ASC
	`, lang)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rc rawCat
			if rows.Scan(&rc.uuid, &rc.parentID, &rc.title) == nil {
				rawList = append(rawList, rc)
				idMap[rc.uuid] = len(rawList)
			}
		}
	}

	if len(rawList) == 0 {
		return []ymlCategory{{ID: 1, Name: "Одежда оптом"}}, idMap
	}

	categories := make([]ymlCategory, 0, len(rawList))
	for i, rc := range rawList {
		parentNum := 0
		if rc.parentID != nil {
			parentNum = idMap[*rc.parentID]
		}
		categories = append(categories, ymlCategory{
			ID:       i + 1,
			ParentID: parentNum,
			Name:     rc.title,
		})
	}
	return categories, idMap
}

func buildYMLOfferParams(seriesRatio, fabric *string, moq *int) []ymlParam {
	var params []ymlParam
	if seriesRatio != nil && strings.TrimSpace(*seriesRatio) != "" {
		params = append(params, ymlParam{Name: "Серия / Размеры", Value: strings.TrimSpace(*seriesRatio)})
	}
	minQty := 1
	if moq != nil && *moq > 0 {
		minQty = *moq
	}
	params = append(params, ymlParam{Name: "Мин. партия (MOQ)", Value: fmt.Sprintf("%d сер.", minQty)})
	if fabric != nil && strings.TrimSpace(*fabric) != "" {
		params = append(params, ymlParam{Name: "Ткань", Value: strings.TrimSpace(*fabric)})
	}
	return params
}

func mapRowToYMLOffer(rows pgx.Rows, lang string, catIDMap map[string]int) (ymlOffer, error) {
	var (
		id, title, slug                   string
		description, customSku, brandName *string
		catUUID, sourceProductGroupID     *string
		price                             float64
		discountedPrice                   *float64
		currency                          string
		stock                             int
		imagesBytes                       []byte
		seriesRatio, fabric               *string
		moq                               *int
	)

	err := rows.Scan(
		&id, &title, &description, &customSku, &slug,
		&price, &discountedPrice, &currency, &stock,
		&brandName, &catUUID, &imagesBytes, &sourceProductGroupID,
		&seriesRatio, &moq, &fabric,
	)
	if err != nil {
		return ymlOffer{}, err
	}

	mainImg, extraImgs := normalizeGoogleImages(imagesBytes)
	pictures := append([]string{mainImg}, extraImgs...)
	if len(pictures) > 10 {
		pictures = pictures[:10]
	}

	effectivePrice := price
	var oldPriceStr string
	if discountedPrice != nil && *discountedPrice > 0 && *discountedPrice < price {
		effectivePrice = *discountedPrice
		oldPriceStr = fmt.Sprintf("%.2f", price)
	}

	catNum := 1
	if catUUID != nil {
		if mapped, ok := catIDMap[*catUUID]; ok {
			catNum = mapped
		}
	}

	packPieces := parseSeriesPieces(seriesRatio, moq)
	offerName := title
	if packPieces > 1 {
		offerName = fmt.Sprintf("%s %s", title, localizedWholesalePackSuffix(lang, packPieces))
	}

	return ymlOffer{
		ID:                   derefStringOr(customSku, id),
		Available:            stock > 0,
		GroupID:              derefStringOr(sourceProductGroupID, ""),
		URL:                  formatLocalizedProductURL(slug, lang),
		Price:                fmt.Sprintf("%.2f", effectivePrice),
		OldPrice:             oldPriceStr,
		CurrencyID:           normalizeCurrencyCode(currency),
		CategoryID:           catNum,
		Pictures:             pictures,
		Vendor:               derefStringOr(brandName, defaultStoreVendorName),
		VendorCode:           derefStringOr(customSku, ""),
		Name:                 offerName,
		Description:          derefStringOr(description, title),
		SalesNotes:           yandexWholesaleSalesNotes,
		ManufacturerWarranty: true,
		CountryOfOrigin:      "Турция",
		Params:               buildYMLOfferParams(seriesRatio, fabric, moq),
	}, nil
}

// YandexMarketFeed returns active wholesale products in Yandex Market YML XML format for CIS B2B indexing.
func (h *StoreCatalogHandler) YandexMarketFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	lang := normalizeFeedLang(r.URL.Query().Get("lang"), "ru")
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	currencies := fetchYMLCurrencies(ctx)
	categories, catIDMap := fetchYMLCategories(ctx, lang)

	offerQuery := `
		SELECT p.id,
		       CASE WHEN $1 = 'tr' THEN p.title ELSE COALESCE(NULLIF(pt.title, ''), p.title) END AS loc_title,
		       CASE WHEN $1 = 'tr' THEN p.description ELSE COALESCE(NULLIF(pt.description, ''), NULLIF(pt.short_description, ''), p.description) END AS loc_desc,
		       p.custom_sku, p.slug,
		       p.price, p.discounted_price, COALESCE(p.currency, 'TRY'), p.stock,
		       p.brand_name, p.category_id::text, p.images_json, p.source_product_group_id,
		       p.series_ratio, p.minimum_order_quantity, p.kumas_fabric
		FROM catalog.mv_products p
		LEFT JOIN catalog.product_translations pt ON pt.product_id = p.id AND pt.language_code = $1
		WHERE p.is_active = true AND p.price > 0`

	rows, err := db.Pool.Query(ctx, offerQuery, lang)
	if err != nil {
		log.Printf("[STORE API ERROR] Failed to query products for Yandex YML Feed: %v", err)
		http.Error(w, errJSONFailedQueryProds, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	offers := make([]ymlOffer, 0, 256)
	for rows.Next() {
		if offer, scanErr := mapRowToYMLOffer(rows, lang, catIDMap); scanErr == nil {
			offers = append(offers, offer)
		}
	}

	catalog := ymlCatalog{
		Date: time.Now().In(istanbulLocation()).Format(time.RFC3339),
		Shop: ymlShop{
			Name:       defaultStoreVendorName,
			Company:    "Merter Vitrini B2B Wholesale",
			URL:        siteBaseURL,
			Currencies: currencies,
			Categories: categories,
			Offers:     offers,
		},
	}

	w.Header().Set(headerContentType, mimeApplicationXMLUTF8)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(xml.Header))

	encoder := xml.NewEncoder(w)
	encoder.Indent("", "  ")
	if err := encoder.Encode(catalog); err != nil {
		log.Printf("[STORE API ERROR] Failed to encode Yandex Market YML: %v", err)
	}
}

type CatalogDeltaItem struct {
	ID              string   `json:"id"`
	Title           string   `json:"title"`
	Slug            string   `json:"slug"`
	Brand           string   `json:"brand"`
	CategorySlug    string   `json:"category_slug"`
	Gender          *string  `json:"gender,omitempty"`
	Season          *string  `json:"season,omitempty"`
	Fabric          *string  `json:"fabric,omitempty"`
	Price           float64  `json:"price"`
	DiscountedPrice *float64 `json:"discounted_price,omitempty"`
	Currency        string   `json:"currency"`
	Stock           int      `json:"stock"`
	SeriesRatio     *string  `json:"series_ratio,omitempty"`
	MOQ             int      `json:"moq"`
	CoverImage      *string  `json:"cover_image,omitempty"`
	Colors          string   `json:"colors,omitempty"`
	Sizes           string   `json:"sizes,omitempty"`
	UpdatedAt       string   `json:"updated_at"`
}

type CatalogDeltaResponse struct {
	Products   []CatalogDeltaItem `json:"products"`
	Count      int                `json:"count"`
	DeltaToken string             `json:"delta_token"`
}

func parseDeltaSinceTime(sinceStr string) *time.Time {
	if sinceStr == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, sinceStr)
	if err != nil {
		return nil
	}
	return &t
}

// CatalogDelta returns updated products for client-side PGlite IndexedDB cache sync
func (h *StoreCatalogHandler) CatalogDelta(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	sinceTime := parseDeltaSinceTime(r.URL.Query().Get("since"))
	limit := 300
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 1000 {
		limit = l
	}

	query := `
		SELECT 
			p.id, p.title, p.slug, COALESCE(p.brand_name, 'Merter Vitrini'), COALESCE(p.category_id::text, ''),
			p.gender, p.season, p.kumas_fabric, p.price, p.discounted_price, COALESCE(p.currency, 'TRY'),
			p.stock, p.series_ratio, COALESCE(p.minimum_order_quantity, 1), p.images_json, p.color, p.updated_at
		FROM catalog.mv_products p
		WHERE p.is_active = true
		  AND ($1::timestamptz IS NULL OR p.updated_at >= $1)
		ORDER BY p.updated_at DESC
		LIMIT $2
	`

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	showPrices := isStorePriceVisibleToCaller(ctx, r)

	rows, err := db.Pool.Query(ctx, query, sinceTime, limit)
	if err != nil {
		log.Printf("[DELTA SYNC ERROR] Failed to query mv_products: %v", err)
		http.Error(w, `{"error":"Senkronizasyon verisi alınamadı"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]CatalogDeltaItem, 0, limit)
	for rows.Next() {
		var (
			item        CatalogDeltaItem
			imagesBytes []byte
			color       *string
			updatedAt   time.Time
		)

		if scanErr := rows.Scan(
			&item.ID, &item.Title, &item.Slug, &item.Brand, &item.CategorySlug,
			&item.Gender, &item.Season, &item.Fabric, &item.Price, &item.DiscountedPrice, &item.Currency,
			&item.Stock, &item.SeriesRatio, &item.MOQ, &imagesBytes, &color, &updatedAt,
		); scanErr != nil {
			continue
		}

		if !showPrices {
			item.Price = 0
			item.DiscountedPrice = nil
		}

		item.UpdatedAt = updatedAt.Format(time.RFC3339)
		if color != nil && *color != "" {
			item.Colors = *color
		}

		_, mainImg := parseRawGoogleImages(imagesBytes)
		if mainImg != "" {
			item.CoverImage = &mainImg
		}

		items = append(items, item)
	}

	w.Header().Add("Vary", "Authorization")
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(CatalogDeltaResponse{
		Products:   items,
		Count:      len(items),
		DeltaToken: time.Now().UTC().Format(time.RFC3339),
	})
}
