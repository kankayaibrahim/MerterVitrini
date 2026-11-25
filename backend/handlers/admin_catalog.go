package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/safe"
	"mertervitrini/backend/services"

	"github.com/jackc/pgx/v5"
)

func notifyCategoryIndexNowAsync(categoryID, title string, isActive bool) {
	if !isActive || strings.TrimSpace(categoryID) == "" {
		return
	}
	safe.Go("Category IndexNow Notify", func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()
		urls := BuildSingleCategoryIndexNowURLs(bgCtx, categoryID)
		if len(urls) == 0 {
			return
		}
		NotifyIndexNowWithMeta(IndexNowSubmissionMeta{
			TriggerSource: "category",
			SourceLabel:   "Kategori: " + strings.TrimSpace(title),
			ProductCount:  1,
		}, urls)
	})
}

type AdminCatalogHandler struct {
	Cfg   *config.Config
	Media services.MediaProcessor
}

func NewAdminCatalogHandler(cfgs ...*config.Config) *AdminCatalogHandler {
	var cfg *config.Config
	if len(cfgs) > 0 {
		cfg = cfgs[0]
	}
	return &AdminCatalogHandler{Cfg: cfg}
}

// SetMediaProcessor injects the shared media processor dependency.
func (h *AdminCatalogHandler) SetMediaProcessor(media services.MediaProcessor) {
	h.Media = media
}

// --- CATEGORY HANDLERS ---

// ListCategories fetches all categories and builds a hierarchical tree
func (h *AdminCatalogHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		WITH direct_counts AS (
			SELECT p.category_id,
			       COUNT(*)::int AS direct_total,
			       COUNT(*) FILTER (WHERE p.is_active = true)::int AS direct_active
			FROM catalog.products p
			WHERE p.deleted_at IS NULL AND p.category_id IS NOT NULL
			GROUP BY p.category_id
		),
		rolled_counts AS (
			SELECT c.id AS category_id,
			       COALESCE(dc_self.direct_total, 0) AS direct_total,
			       COALESCE(dc_self.direct_active, 0) AS direct_active,
			       COALESCE(SUM(dc_desc.direct_total), 0)::int AS subtree_total,
			       COALESCE(SUM(dc_desc.direct_active), 0)::int AS subtree_active
			FROM catalog.categories c
			LEFT JOIN direct_counts dc_self ON dc_self.category_id = c.id
			LEFT JOIN catalog.categories desc_c ON desc_c.node_path <@ c.node_path
			LEFT JOIN direct_counts dc_desc ON dc_desc.category_id = desc_c.id
			GROUP BY c.id, dc_self.direct_total, dc_self.direct_active
		)
		SELECT c.id, c.parent_id, c.title, c.slug, c.node_path, c.is_active, c.created_at, c.updated_at,
		       COALESCE(rc.subtree_total, 0) AS total_products,
		       COALESCE(rc.subtree_active, 0) AS active_products,
		       COALESCE(rc.direct_total, 0) AS direct_total_products,
		       COALESCE(rc.direct_active, 0) AS direct_active_products,
		       COALESCE(
		           (SELECT json_object_agg(ct.language_code, json_build_object('category_id', ct.category_id, 'language_code', ct.language_code, 'title', ct.title, 'seo_description', ct.seo_description))
		            FROM catalog.category_translations ct
		            WHERE ct.category_id = c.id), '{}'::json
		       ) as translations_json
		FROM catalog.categories c
		LEFT JOIN rolled_counts rc ON rc.category_id = c.id
		ORDER BY c.node_path ASC, c.title ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list categories: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var categories []*models.Category
	for rows.Next() {
		var c models.Category
		var transBytes []byte
		err := rows.Scan(
			&c.ID, &c.ParentID, &c.Title, &c.Slug, &c.NodePath, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
			&c.TotalProducts, &c.ActiveProducts, &c.DirectTotalProducts, &c.DirectActiveProducts, &transBytes,
		)
		if err != nil {
			log.Printf("Failed to scan category: %v", err)
			continue
		}
		c.Translations = make(map[string]models.CategoryTranslation)
		if len(transBytes) > 0 {
			_ = json.Unmarshal(transBytes, &c.Translations)
		}
		categories = append(categories, &c)
	}

	tree := buildCategoryTree(categories)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(tree)
}

// CreateCategory adds a new category and lets DB calculate ltree node_path
func (h *AdminCatalogHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ParentID     *string                               `json:"parent_id"`
		Title        string                                `json:"title"`
		IsActive     bool                                  `json:"is_active"`
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

	savedTrans, err := saveCategoryTranslations(ctx, tx, c.ID, req.Title, req.Translations)
	if err != nil {
		log.Printf("Failed to save category translations: %v", err)
		http.Error(w, `{"error":"Failed to save category translations"}`, http.StatusInternalServerError)
		return
	}
	c.Translations = savedTrans

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	notifyCategoryIndexNowAsync(c.ID, c.Title, c.IsActive)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

// UpdateCategory updates category fields and lets DB triggers automatically handle ltree paths
func (h *AdminCatalogHandler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
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
		ParentID     *string                               `json:"parent_id"`
		Title        string                                `json:"title"`
		IsActive     bool                                  `json:"is_active"`
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

	if req.ParentID != nil && *req.ParentID == id {
		http.Error(w, `{"error":"A category cannot be its own parent"}`, http.StatusBadRequest)
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
	if _, err = tx.Exec(ctx, "DELETE FROM catalog.category_translations WHERE category_id = $1", id); err != nil {
		log.Printf("Failed to clear old category translations: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	savedTrans, err := saveCategoryTranslations(ctx, tx, c.ID, req.Title, req.Translations)
	if err != nil {
		log.Printf("Failed to insert category translations: %v", err)
		http.Error(w, `{"error":"Failed to save category translations"}`, http.StatusInternalServerError)
		return
	}
	c.Translations = savedTrans

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	notifyCategoryIndexNowAsync(c.ID, c.Title, c.IsActive)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(c)
}

func saveCategoryTranslations(ctx context.Context, tx pgx.Tx, categoryID, defaultTitle string, translations map[string]models.CategoryTranslation) (map[string]models.CategoryTranslation, error) {
	insertTranslationQuery := `
		INSERT INTO catalog.category_translations (category_id, language_code, title, seo_description)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (category_id, language_code) DO UPDATE SET title = EXCLUDED.title, seo_description = EXCLUDED.seo_description`

	result := make(map[string]models.CategoryTranslation)
	for lang, t := range translations {
		title := strings.TrimSpace(t.Title)
		if title == "" {
			title = defaultTitle
		}
		var seoDesc *string
		if t.SeoDescription != nil && strings.TrimSpace(*t.SeoDescription) != "" {
			trimmed := strings.TrimSpace(*t.SeoDescription)
			seoDesc = &trimmed
		}

		if _, err := tx.Exec(ctx, insertTranslationQuery, categoryID, lang, title, seoDesc); err != nil {
			return nil, err
		}

		result[lang] = models.CategoryTranslation{
			CategoryID:     categoryID,
			LanguageCode:   lang,
			Title:          title,
			SeoDescription: seoDesc,
		}
	}
	return result, nil
}

// DeleteCategory deletes a category by UUID (DB automatically sets children's parent_id to NULL)
func (h *AdminCatalogHandler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
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

	for _, c := range flat {
		nodesMap[c.ID] = &models.CategoryNode{
			ID:                   c.ID,
			ParentID:             c.ParentID,
			Title:                c.Title,
			Slug:                 c.Slug,
			NodePath:             c.NodePath,
			IsActive:             c.IsActive,
			TotalProducts:        c.TotalProducts,
			ActiveProducts:       c.ActiveProducts,
			DirectTotalProducts:  c.DirectTotalProducts,
			DirectActiveProducts: c.DirectActiveProducts,
			Translations:         c.Translations,
			Children:             make([]*models.CategoryNode, 0),
		}
	}

	for _, c := range flat {
		node := nodesMap[c.ID]
		if c.ParentID == nil || *c.ParentID == "" {
			rootNodes = append(rootNodes, node)
		} else {
			if parent, exists := nodesMap[*c.ParentID]; exists {
				parent.Children = append(parent.Children, node)
			} else {
				rootNodes = append(rootNodes, node)
			}
		}
	}

	return rootNodes
}

// --- PRODUCT HANDLERS ---

const effectiveAdminPriceExpr = "COALESCE(NULLIF(p.discounted_price, 0), COALESCE(p.price, 0))"

type adminProductFilterParams struct {
	Query       string
	BrandID     string
	CategoryID  string
	Status      string
	Currency    string
	MinPrice    *float64
	MaxPrice    *float64
	PriceStatus string
	StockStatus string
	HasImage    string
	Gender      string
	Season      string
	Source      string
	ActorType   string
	DateFrom    string
	DateTo      string
	SortBy      string
}

func parseNonNegativeFloatQuery(raw string) *float64 {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	val, err := strconv.ParseFloat(trimmed, 64)
	if err != nil || math.IsNaN(val) || math.IsInf(val, 0) || val < 0 {
		return nil
	}
	return &val
}

func parseAdminCurrencyQuery(raw string) string {
	upper := strings.ToUpper(strings.TrimSpace(raw))
	if upper == "TL" {
		upper = "TRY"
	}
	switch upper {
	case "TRY", "USD", "EUR", "GBP":
		return upper
	default:
		return ""
	}
}

func parseAdminDateQuery(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if _, err := time.Parse("2006-01-02", trimmed); err != nil {
		return ""
	}
	return trimmed
}

func parseAdminProductFilterParams(r *http.Request) adminProductFilterParams {
	q := r.URL.Query()
	search := strings.TrimSpace(q.Get("q"))
	if search == "" {
		search = strings.TrimSpace(q.Get("search"))
	}
	return adminProductFilterParams{
		Query:       search,
		BrandID:     strings.TrimSpace(q.Get("brand_id")),
		CategoryID:  strings.TrimSpace(q.Get("category_id")),
		Status:      strings.TrimSpace(q.Get("status")),
		Currency:    parseAdminCurrencyQuery(q.Get("currency")),
		MinPrice:    parseNonNegativeFloatQuery(q.Get("min_price")),
		MaxPrice:    parseNonNegativeFloatQuery(q.Get("max_price")),
		PriceStatus: strings.TrimSpace(q.Get("price_status")),
		StockStatus: strings.TrimSpace(q.Get("stock_status")),
		HasImage:    strings.TrimSpace(q.Get("has_image")),
		Gender:      strings.TrimSpace(q.Get("gender")),
		Season:      strings.TrimSpace(q.Get("season")),
		Source:      strings.TrimSpace(q.Get("source")),
		ActorType:   strings.TrimSpace(q.Get("actor_type")),
		DateFrom:    parseAdminDateQuery(q.Get("date_from")),
		DateTo:      parseAdminDateQuery(q.Get("date_to")),
		SortBy:      strings.TrimSpace(q.Get("sort_by")),
	}
}

func appendAdminProductSearchFilter(filterSQL *strings.Builder, args *[]any, argIndex *int, q string) {
	if q == "" {
		return
	}
	for _, word := range strings.Fields(q) {
		trimmed := strings.TrimSpace(word)
		if trimmed == "" {
			continue
		}
		filterSQL.WriteString(fmt.Sprintf(` AND (
			p.title ILIKE $%[1]d
			OR p.custom_sku ILIKE $%[1]d
			OR p.source_product_id ILIKE $%[1]d
			OR p.barcode ILIKE $%[1]d
			OR p.description ILIKE $%[1]d
			OR c.title ILIKE $%[1]d
			OR b.brand_name ILIKE $%[1]d
			OR fab.fabric_name ILIKE $%[1]d
			OR EXISTS (
				SELECT 1 FROM catalog.colors col WHERE p.color_id = col.id AND col.color_name ILIKE $%[1]d
			)
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
		)`, *argIndex))
		*args = append(*args, "%"+trimmed+"%")
		*argIndex++
	}
}

func appendAdminProductPricingAndStockFilter(filterSQL *strings.Builder, args *[]any, argIndex *int, params adminProductFilterParams) {
	if params.Currency != "" {
		if params.Currency == "TRY" {
			filterSQL.WriteString(" AND UPPER(COALESCE(NULLIF(p.currency, ''), 'TRY')) IN ('TRY', 'TL')")
		} else {
			filterSQL.WriteString(fmt.Sprintf(" AND UPPER(COALESCE(p.currency, '')) = $%d", *argIndex))
			*args = append(*args, params.Currency)
			*argIndex++
		}
	}

	if params.MinPrice != nil {
		filterSQL.WriteString(fmt.Sprintf(" AND %s >= $%d", effectiveAdminPriceExpr, *argIndex))
		*args = append(*args, *params.MinPrice)
		*argIndex++
	}

	if params.MaxPrice != nil {
		filterSQL.WriteString(fmt.Sprintf(" AND %s <= $%d", effectiveAdminPriceExpr, *argIndex))
		*args = append(*args, *params.MaxPrice)
		*argIndex++
	}

	switch strings.ToLower(strings.TrimSpace(params.PriceStatus)) {
	case "priced":
		filterSQL.WriteString(" AND COALESCE(p.price, 0) > 0")
	case "unpriced":
		filterSQL.WriteString(" AND COALESCE(p.price, 0) <= 0")
	case "discounted":
		filterSQL.WriteString(" AND p.discounted_price IS NOT NULL AND p.discounted_price > 0 AND p.discounted_price < COALESCE(p.price, 0)")
	}

	switch strings.ToLower(strings.TrimSpace(params.StockStatus)) {
	case "in_stock":
		filterSQL.WriteString(" AND COALESCE(p.stock, 0) > 0")
	case "out_of_stock":
		filterSQL.WriteString(" AND COALESCE(p.stock, 0) <= 0")
	case "low_stock":
		filterSQL.WriteString(" AND (COALESCE(p.stock, 0) > 0 AND COALESCE(p.stock, 0) <= 10)")
	}
}

func appendAdminProductCatalogMetaFilter(filterSQL *strings.Builder, args *[]any, argIndex *int, params adminProductFilterParams) {
	if params.BrandID != "" {
		filterSQL.WriteString(fmt.Sprintf(" AND (p.brand_id = $%[1]d OR p.feed_id IN (SELECT id FROM integration.xml_feeds WHERE brand_id = $%[1]d))", *argIndex))
		*args = append(*args, params.BrandID)
		*argIndex++
	}

	if params.CategoryID == "uncategorized" {
		filterSQL.WriteString(" AND p.category_id IS NULL")
	} else if params.CategoryID != "" {
		filterSQL.WriteString(fmt.Sprintf(" AND (p.category_id = $%[1]d OR p.category_id IN (SELECT id FROM catalog.categories WHERE node_path <@ (SELECT node_path FROM catalog.categories WHERE id = $%[1]d)))", *argIndex))
		*args = append(*args, params.CategoryID)
		*argIndex++
	}

	switch strings.ToLower(strings.TrimSpace(params.Status)) {
	case "active":
		filterSQL.WriteString(" AND p.is_active = true")
	case "inactive":
		filterSQL.WriteString(" AND p.is_active = false")
	}

	switch strings.ToLower(strings.TrimSpace(params.HasImage)) {
	case "yes":
		filterSQL.WriteString(" AND EXISTS (SELECT 1 FROM catalog.product_images pi WHERE pi.product_id = p.id)")
	case "no":
		filterSQL.WriteString(" AND NOT EXISTS (SELECT 1 FROM catalog.product_images pi WHERE pi.product_id = p.id)")
	}

	switch strings.ToLower(strings.TrimSpace(params.Source)) {
	case "xml":
		filterSQL.WriteString(" AND p.feed_id IS NOT NULL")
	case "manual":
		filterSQL.WriteString(" AND p.feed_id IS NULL")
	}

	switch strings.ToLower(strings.TrimSpace(params.ActorType)) {
	case AuditActorAdminImpersonation, AuditActorSupplierOwner, AuditActorSupplierSubUser, AuditActorAdminPanel:
		filterSQL.WriteString(fmt.Sprintf(" AND COALESCE(p.created_by_actor_type, '') = $%d", *argIndex))
		*args = append(*args, strings.ToLower(strings.TrimSpace(params.ActorType)))
		*argIndex++
	case AuditActorXMLFeed:
		filterSQL.WriteString(" AND (COALESCE(p.created_by_actor_type, '') = 'xml_feed' OR (COALESCE(p.created_by_actor_type, '') = '' AND p.feed_id IS NOT NULL))")
	}
}

func appendAdminProductAttributesAndDateFilter(filterSQL *strings.Builder, args *[]any, argIndex *int, params adminProductFilterParams) {
	if params.Gender != "" {
		filterSQL.WriteString(fmt.Sprintf(" AND LOWER(TRIM(COALESCE(p.gender, ''))) = LOWER($%d)", *argIndex))
		*args = append(*args, params.Gender)
		*argIndex++
	}
	if params.Season != "" {
		filterSQL.WriteString(fmt.Sprintf(" AND LOWER(TRIM(COALESCE(p.season, ''))) = LOWER($%d)", *argIndex))
		*args = append(*args, params.Season)
		*argIndex++
	}
	if params.DateFrom != "" {
		filterSQL.WriteString(fmt.Sprintf(" AND p.created_at >= $%d::date", *argIndex))
		*args = append(*args, params.DateFrom)
		*argIndex++
	}
	if params.DateTo != "" {
		filterSQL.WriteString(fmt.Sprintf(" AND p.created_at < ($%d::date + INTERVAL '1 day')", *argIndex))
		*args = append(*args, params.DateTo)
		*argIndex++
	}
}

func buildAdminProductFilterSQL(params adminProductFilterParams) (string, []any) {
	var filterSQL strings.Builder
	filterSQL.WriteString(" AND p.deleted_at IS NULL")
	var args []any
	argIndex := 1

	appendAdminProductSearchFilter(&filterSQL, &args, &argIndex, params.Query)
	appendAdminProductCatalogMetaFilter(&filterSQL, &args, &argIndex, params)
	appendAdminProductPricingAndStockFilter(&filterSQL, &args, &argIndex, params)
	appendAdminProductAttributesAndDateFilter(&filterSQL, &args, &argIndex, params)

	return filterSQL.String(), args
}

func buildProductFilterSQL(q, brandID, categoryID, status string) (string, []any) {
	return buildAdminProductFilterSQL(adminProductFilterParams{
		Query:      q,
		BrandID:    brandID,
		CategoryID: categoryID,
		Status:     status,
	})
}

func buildAdminProductOrderBy(sortBy string) string {
	switch strings.ToLower(strings.TrimSpace(sortBy)) {
	case "oldest":
		return "ORDER BY p.created_at ASC, p.id ASC"
	case "updated_desc":
		return "ORDER BY p.updated_at DESC, p.id DESC"
	case "price_asc":
		return fmt.Sprintf("ORDER BY (COALESCE(p.price, 0) <= 0) ASC, %s ASC, p.created_at DESC", effectiveAdminPriceExpr)
	case "price_desc":
		return fmt.Sprintf("ORDER BY %s DESC, p.created_at DESC", effectiveAdminPriceExpr)
	case "stock_desc":
		return "ORDER BY COALESCE(p.stock, 0) DESC, COALESCE(p.series_stock, 0) DESC, p.created_at DESC"
	case "stock_asc":
		return "ORDER BY COALESCE(p.stock, 0) ASC, COALESCE(p.series_stock, 0) ASC, p.created_at DESC"
	case "title_asc":
		return "ORDER BY LOWER(p.title) ASC, p.created_at DESC"
	default:
		return "ORDER BY p.created_at DESC, p.id DESC"
	}
}

// ListProducts lists products with support for pagination, search, category/brand/status, and advanced filters
func (h *AdminCatalogHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	params := parseAdminProductFilterParams(r)

	limit := 20
	offset := 0

	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 200 {
		limit = l
	}
	if o, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && o >= 0 {
		offset = o
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	_ = EnsureSupplierAuditSchema(ctx)

	filterSQL, args := buildAdminProductFilterSQL(params)

	var totalCount int
	countQuery := `
		SELECT COUNT(*)
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON p.brand_id = b.id
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		LEFT JOIN catalog.fabrics fab ON p.fabric_id = fab.id
		WHERE 1=1` + filterSQL

	if err := db.Pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		log.Printf("Failed to count products: %v", err)
		totalCount = 0
	}

	orderBySQL := buildAdminProductOrderBy(params.SortBy)
	sqlQuery := fmt.Sprintf(`
		SELECT p.id, p.feed_id, p.source_product_id, p.title, p.slug, COALESCE(p.slug_id, ''), p.custom_sku,
		       p.short_description, p.description, p.brand_id, p.category_id,
		       p.gender, p.season, COALESCE(fab.fabric_name, 'Polyester') as kumas_fabric, p.desi_volume, p.shipping_weight_kg,
		       p.packing_ratio, p.series_ratio, p.minimum_order_quantity,
		       COALESCE(p.price, 0), p.discounted_price, p.buying_price, p.single_price,
		       COALESCE(NULLIF(p.currency, ''), 'TRY'), COALESCE(p.stock, 0), COALESCE(p.series_stock, 0),
		       col.color_name, p.barcode, p.is_active,
		       p.created_at, p.updated_at, b.brand_name as brand_name, c.title as category_title,
		       p.source_url,
		       CASE WHEN COALESCE(p.created_by_actor_type, '') <> '' THEN p.created_by_actor_type WHEN p.feed_id IS NOT NULL THEN 'xml_feed' ELSE '' END,
		       COALESCE(p.created_by_user_id, ''),
		       COALESCE(p.created_by_email, ''),
		       COALESCE(p.created_by_name, ''),
		       COALESCE(p.created_by_role, ''),
		       COALESCE(p.created_by_impersonated_by_email, ''),
		       COALESCE(p.updated_by_actor_type, ''),
		       COALESCE(p.updated_by_email, ''),
		       COALESCE(p.updated_by_name, ''),
		       COALESCE(p.updated_by_impersonated_by_email, ''),
		       COALESCE(
		           (SELECT json_agg(json_build_object('id', img.id, 'product_id', img.product_id, 'image_url', img.image_url, 'media_type', COALESCE(img.media_type, 'image'), 'sort_order', img.sort_order, 'is_cover', img.is_cover) ORDER BY img.sort_order ASC)
		            FROM catalog.product_images img
		            WHERE img.product_id = p.id), '[]'::json
		       ) as images_json
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON p.brand_id = b.id
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		LEFT JOIN catalog.fabrics fab ON p.fabric_id = fab.id
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE 1=1%s
		%s
		LIMIT $%d OFFSET $%d`, filterSQL, orderBySQL, len(args)+1, len(args)+2)

	queryArgs := append(args, limit, offset)
	rows, err := db.Pool.Query(ctx, sqlQuery, queryArgs...)
	if err != nil {
		log.Printf("Failed to query products: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	products := make([]*models.Product, 0)
	for rows.Next() {
		var p models.Product
		var imgJSON []byte
		err := rows.Scan(
			&p.ID, &p.FeedID, &p.SourceProductID, &p.Title, &p.Slug, &p.SlugID, &p.CustomSku,
			&p.ShortDescription, &p.Description, &p.BrandID, &p.CategoryID,
			&p.Gender, &p.Season, &p.KumasFabric, &p.DesiVolume, &p.ShippingWeightKg,
			&p.PackingRatio, &p.SeriesRatio, &p.MinimumOrderQty,
			&p.Price, &p.DiscountedPrice, &p.BuyingPrice, &p.SinglePrice,
			&p.Currency, &p.Stock, &p.SeriesStock,
			&p.Color, &p.Barcode, &p.IsActive,
			&p.CreatedAt, &p.UpdatedAt, &p.BrandName, &p.CategoryTitle,
			&p.SourceURL,
			&p.CreatedByActorType, &p.CreatedByUserID, &p.CreatedByEmail, &p.CreatedByName, &p.CreatedByRole, &p.CreatedByImpersonatedByEmail,
			&p.UpdatedByActorType, &p.UpdatedByEmail, &p.UpdatedByName, &p.UpdatedByImpersonatedByEmail,
			&imgJSON,
		)
		if err != nil {
			log.Printf("Failed to scan product: %v", err)
			continue
		}
		if len(imgJSON) > 0 {
			_ = json.Unmarshal(imgJSON, &p.Images)
		}
		products = append(products, &p)
	}

	w.Header().Set("X-Total-Count", strconv.Itoa(totalCount))
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Header().Set("Access-Control-Expose-Headers", "X-Total-Count")
	json.NewEncoder(w).Encode(products)
}

func fetchProductVariants(ctx context.Context, productID string) []*models.ProductVariant {
	variantQuery := `
		SELECT id, product_id, source_variant_id, custom_sku AS sku, custom_sku, barcode, stock, 0.0 AS price, 
		       NULL AS discounted_price, 10.0 AS tax_rate, 'TRY' AS currency, NULL AS color, variant_size AS size, is_active, created_at, updated_at
		FROM catalog.product_variants
		WHERE product_id = $1`

	var variants []*models.ProductVariant
	vRows, err := db.Pool.Query(ctx, variantQuery, productID)
	if err != nil {
		return variants
	}
	defer vRows.Close()

	for vRows.Next() {
		var v models.ProductVariant
		if err := vRows.Scan(
			&v.ID, &v.ProductID, &v.SourceVariantID, &v.Sku, &v.CustomSku, &v.Barcode,
			&v.Stock, &v.Price, &v.DiscountedPrice, &v.TaxRate, &v.Currency, &v.Color, &v.Size,
			&v.IsActive, &v.CreatedAt, &v.UpdatedAt,
		); err == nil {
			variants = append(variants, &v)
		}
	}
	return variants
}

func fetchGroupProducts(ctx context.Context, feedID *string, groupID *string) []*models.GroupProductColor {
	var groupProducts []*models.GroupProductColor
	if groupID == nil || *groupID == "" {
		return groupProducts
	}

	feedIDStr := ""
	if feedID != nil {
		feedIDStr = *feedID
	}

	groupQuery := `
		SELECT gp.id, gp.source_product_id, COALESCE(col.color_name, 'Standart') as color, gp.custom_sku, gp.stock,
		       COALESCE((SELECT img.image_url FROM catalog.product_images img WHERE img.product_id = gp.id AND img.is_cover = true LIMIT 1), '') as cover_image_url
		FROM catalog.products gp
		LEFT JOIN catalog.colors col ON gp.color_id = col.id
		WHERE gp.feed_id = $1 AND gp.source_product_group_id = $2 AND gp.is_active = true
		ORDER BY col.color_name ASC`

	gRows, err := db.Pool.Query(ctx, groupQuery, feedIDStr, groupID)
	if err != nil {
		return groupProducts
	}
	defer gRows.Close()

	for gRows.Next() {
		var gp models.GroupProductColor
		var coverImg string
		if err := gRows.Scan(&gp.ID, &gp.SourceProductID, &gp.Color, &gp.CustomSku, &gp.Stock, &coverImg); err == nil {
			if coverImg != "" {
				gp.CoverImageUrl = &coverImg
			}
			groupProducts = append(groupProducts, &gp)
		}
	}
	return groupProducts
}

func fetchProductImages(ctx context.Context, productID string) []*models.ProductImage {
	imageQuery := `
		SELECT id, product_id, image_url, COALESCE(media_type, 'image'), sort_order, is_cover, created_at
		FROM catalog.product_images
		WHERE product_id = $1
		ORDER BY sort_order ASC`

	var images []*models.ProductImage
	iRows, err := db.Pool.Query(ctx, imageQuery, productID)
	if err != nil {
		return images
	}
	defer iRows.Close()

	for iRows.Next() {
		var img models.ProductImage
		if err := iRows.Scan(&img.ID, &img.ProductID, &img.ImageUrl, &img.MediaType, &img.SortOrder, &img.IsCover, &img.CreatedAt); err == nil {
			images = append(images, &img)
		}
	}
	return images
}

// GetProductByID returns detailed product along with variants and images
func (h *AdminCatalogHandler) GetProductByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Product ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	_ = EnsureSupplierAuditSchema(ctx)

	var p models.Product
	prodQuery := `
		SELECT p.id, p.feed_id, p.source_product_id, p.title, p.slug, COALESCE(p.slug_id, ''), p.custom_sku,
		       p.short_description, p.description, p.brand_id, p.category_id,
		       p.gender, p.season, COALESCE(fab.fabric_name, 'Polyester') as kumas_fabric, p.desi_volume, p.shipping_weight_kg,
		       p.packing_ratio, p.series_ratio, p.minimum_order_quantity,
		       COALESCE(p.price, 0), p.discounted_price, p.buying_price, p.single_price,
		       COALESCE(NULLIF(p.currency, ''), 'TRY'), COALESCE(p.stock, 0), COALESCE(p.series_stock, 0),
		       col.color_name, p.barcode, p.is_active,
		       p.created_at, p.updated_at, b.brand_name as brand_name, c.title as category_title,
		       p.source_url, COALESCE(p.source_product_group_id, ''),
		       CASE WHEN COALESCE(p.created_by_actor_type, '') <> '' THEN p.created_by_actor_type WHEN p.feed_id IS NOT NULL THEN 'xml_feed' ELSE '' END,
		       COALESCE(p.created_by_user_id, ''),
		       COALESCE(p.created_by_email, ''),
		       COALESCE(p.created_by_name, ''),
		       COALESCE(p.created_by_role, ''),
		       COALESCE(p.created_by_impersonated_by_email, ''),
		       COALESCE(p.updated_by_actor_type, ''),
		       COALESCE(p.updated_by_email, ''),
		       COALESCE(p.updated_by_name, ''),
		       COALESCE(p.updated_by_impersonated_by_email, '')
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON p.brand_id = b.id
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		LEFT JOIN catalog.fabrics fab ON p.fabric_id = fab.id
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE p.id = $1`

	err := db.Pool.QueryRow(ctx, prodQuery, id).Scan(
		&p.ID, &p.FeedID, &p.SourceProductID, &p.Title, &p.Slug, &p.SlugID, &p.CustomSku,
		&p.ShortDescription, &p.Description, &p.BrandID, &p.CategoryID,
		&p.Gender, &p.Season, &p.KumasFabric, &p.DesiVolume, &p.ShippingWeightKg,
		&p.PackingRatio, &p.SeriesRatio, &p.MinimumOrderQty,
		&p.Price, &p.DiscountedPrice, &p.BuyingPrice, &p.SinglePrice,
		&p.Currency, &p.Stock, &p.SeriesStock,
		&p.Color, &p.Barcode, &p.IsActive,
		&p.CreatedAt, &p.UpdatedAt, &p.BrandName, &p.CategoryTitle,
		&p.SourceURL, &p.SourceProductGroupID,
		&p.CreatedByActorType, &p.CreatedByUserID, &p.CreatedByEmail, &p.CreatedByName, &p.CreatedByRole, &p.CreatedByImpersonatedByEmail,
		&p.UpdatedByActorType, &p.UpdatedByEmail, &p.UpdatedByName, &p.UpdatedByImpersonatedByEmail,
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

	p.Variants = fetchProductVariants(ctx, id)
	p.GroupProducts = fetchGroupProducts(ctx, p.FeedID, p.SourceProductGroupID)
	p.Images = fetchProductImages(ctx, id)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(p)
}

// GetSettings fetches the global storefront settings (for admin view)
func (h *AdminCatalogHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var s models.Settings
	var dbEnabled bool
	var dbSiteKey, dbSecretKey string
	query := `SELECT id, address, phone, whatsapp, email, show_single_price, COALESCE(show_prices_to_guests, false), COALESCE(recaptcha_enabled, true), COALESCE(recaptcha_site_key, ''), COALESCE(recaptcha_secret_key, ''), updated_at FROM catalog.settings LIMIT 1`
	err := db.Pool.QueryRow(ctx, query).Scan(&s.ID, &s.Address, &s.Phone, &s.Whatsapp, &s.Email, &s.ShowSinglePrice, &s.ShowPricesToGuests, &dbEnabled, &dbSiteKey, &dbSecretKey, &s.UpdatedAt)
	if err != nil {
		log.Printf("[ADMIN API ERROR] Failed to fetch settings: %v", err)
		http.Error(w, `{"error":"Failed to fetch settings"}`, http.StatusInternalServerError)
		return
	}

	eff := resolveEffectiveReCaptcha(ctx, h.Cfg)
	s.RecaptchaEnabled = dbEnabled
	s.RecaptchaSiteKey = strings.TrimSpace(dbSiteKey)
	if s.RecaptchaSiteKey == "" {
		s.RecaptchaSiteKey = eff.SiteKey
	}
	s.RecaptchaHasSecret = strings.TrimSpace(dbSecretKey) != "" || eff.HasSecret

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(s)
}

// UpdateSettings updates the global storefront settings using singleton UPSERT
func (h *AdminCatalogHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Address              string  `json:"address"`
		Phone                string  `json:"phone"`
		Whatsapp             string  `json:"whatsapp"`
		Email                string  `json:"email"`
		ShowSinglePrice      bool    `json:"show_single_price"`
		ShowPricesToGuests   bool    `json:"show_prices_to_guests"`
		RecaptchaEnabled     *bool   `json:"recaptcha_enabled"`
		RecaptchaSiteKey     *string `json:"recaptcha_site_key"`
		RecaptchaSecretKey   *string `json:"recaptcha_secret_key"`
		ClearRecaptchaSecret bool    `json:"clear_recaptcha_secret"`
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

	existingEnabled, existingSiteKey, existingSecretKey, hasExisting := loadDBReCaptchaSettings(ctx)
	nextEnabled := true
	if hasExisting {
		nextEnabled = existingEnabled
	}
	if req.RecaptchaEnabled != nil {
		nextEnabled = *req.RecaptchaEnabled
	}

	nextSiteKey := existingSiteKey
	if req.RecaptchaSiteKey != nil {
		nextSiteKey = strings.TrimSpace(*req.RecaptchaSiteKey)
	}

	nextSecretKey := existingSecretKey
	if req.ClearRecaptchaSecret {
		nextSecretKey = ""
	} else if req.RecaptchaSecretKey != nil {
		trimmedSecret := strings.TrimSpace(*req.RecaptchaSecretKey)
		if trimmedSecret != "" {
			nextSecretKey = trimmedSecret
		}
	}

	query := `
		INSERT INTO catalog.settings (address, phone, whatsapp, email, show_single_price, show_prices_to_guests, recaptcha_enabled, recaptcha_site_key, recaptcha_secret_key)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (singleton_guard) DO UPDATE SET
			address = EXCLUDED.address,
			phone = EXCLUDED.phone,
			whatsapp = EXCLUDED.whatsapp,
			email = EXCLUDED.email,
			show_single_price = EXCLUDED.show_single_price,
			show_prices_to_guests = EXCLUDED.show_prices_to_guests,
			recaptcha_enabled = EXCLUDED.recaptcha_enabled,
			recaptcha_site_key = EXCLUDED.recaptcha_site_key,
			recaptcha_secret_key = EXCLUDED.recaptcha_secret_key,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id, address, phone, whatsapp, email, show_single_price, COALESCE(show_prices_to_guests, false), COALESCE(recaptcha_enabled, true), COALESCE(recaptcha_site_key, ''), COALESCE(recaptcha_secret_key, ''), updated_at`

	var s models.Settings
	var savedEnabled bool
	var savedSiteKey, savedSecretKey string
	err := db.Pool.QueryRow(
		ctx,
		query,
		req.Address,
		req.Phone,
		req.Whatsapp,
		req.Email,
		req.ShowSinglePrice,
		req.ShowPricesToGuests,
		nextEnabled,
		nextSiteKey,
		nextSecretKey,
	).Scan(
		&s.ID,
		&s.Address,
		&s.Phone,
		&s.Whatsapp,
		&s.Email,
		&s.ShowSinglePrice,
		&s.ShowPricesToGuests,
		&savedEnabled,
		&savedSiteKey,
		&savedSecretKey,
		&s.UpdatedAt,
	)
	if err != nil {
		log.Printf("[ADMIN API ERROR] Failed to update settings: %v", err)
		http.Error(w, `{"error":"Failed to update settings"}`, http.StatusInternalServerError)
		return
	}

	invalidateReCaptchaSettingsCache()
	eff := resolveEffectiveReCaptcha(ctx, h.Cfg)
	s.RecaptchaEnabled = savedEnabled
	s.RecaptchaSiteKey = strings.TrimSpace(savedSiteKey)
	if s.RecaptchaSiteKey == "" {
		s.RecaptchaSiteKey = eff.SiteKey
	}
	s.RecaptchaHasSecret = strings.TrimSpace(savedSecretKey) != "" || eff.HasSecret

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(s)
}

// RefreshProductCache refreshes the storefront product materialized view concurrently
func (h *AdminCatalogHandler) RefreshProductCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, "REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products")
	if err != nil {
		log.Printf("[ADMIN CACHE ERROR] Failed to refresh mv_products: %v", err)
		http.Error(w, `{"error":"Önbellek güncellenirken bir hata oluştu"}`+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"status":"success","message":"Ürün önbelleği başarıyla güncellendi."}`))
}

type bulkProductActionRequest struct {
	Action       string   `json:"action"`
	ProductIDs   []string `json:"product_ids"`
	DeleteImages bool     `json:"delete_images"`
}

func parseBulkProductActionRequest(r *http.Request) (string, []string, bool, error) {
	var req bulkProductActionRequest
	if err := httpx.DecodeJSON(r, &req, 0); err != nil {
		return "", nil, false, errors.New("geçersiz JSON istek gövdesi")
	}

	action := strings.ToLower(strings.TrimSpace(req.Action))
	if action != "activate" && action != "deactivate" && action != "delete" {
		return "", nil, false, errors.New("geçersiz işlem türü: activate, deactivate veya delete olmalıdır")
	}

	cleanIDs := dedupeNonEmptyStrings(req.ProductIDs)
	if len(cleanIDs) == 0 {
		return "", nil, false, errors.New("en az bir ürün seçilmelidir")
	}
	if len(cleanIDs) > 500 {
		return "", nil, false, errors.New("tek seferde en fazla 500 ürün işlenebilir")
	}
	for _, id := range cleanIDs {
		if !isValidUUIDString(id) {
			return "", nil, false, fmt.Errorf("geçersiz ürün kimliği: %s", id)
		}
	}

	return action, cleanIDs, req.DeleteImages, nil
}

func bulkActivateProducts(ctx context.Context, productIDs []string) (int64, error) {
	cmdTag, err := db.Pool.Exec(ctx, `
		UPDATE catalog.products
		SET is_active = true, deactivated_at = NULL, updated_at = CURRENT_TIMESTAMP
		WHERE id = ANY($1::uuid[])
		  AND deleted_at IS NULL
		  AND is_active = false`, productIDs)
	if err != nil {
		return 0, err
	}

	_, _ = db.Pool.Exec(ctx, `
		UPDATE catalog.product_variants
		SET is_active = true
		WHERE product_id = ANY($1::uuid[])
		  AND COALESCE(stock, 0) > 0`, productIDs)

	return cmdTag.RowsAffected(), nil
}

func bulkDeactivateProducts(ctx context.Context, productIDs []string) (int64, error) {
	cmdTag, err := db.Pool.Exec(ctx, `
		UPDATE catalog.products
		SET is_active = false, deactivated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE id = ANY($1::uuid[])
		  AND deleted_at IS NULL
		  AND is_active = true`, productIDs)
	if err != nil {
		return 0, err
	}

	_, _ = db.Pool.Exec(ctx, `
		UPDATE catalog.product_variants
		SET is_active = false
		WHERE product_id = ANY($1::uuid[])`, productIDs)

	return cmdTag.RowsAffected(), nil
}

func fetchProductImageURLsByIDs(ctx context.Context, productIDs []string) []string {
	rows, err := db.Pool.Query(ctx, `
		SELECT DISTINCT image_url
		FROM catalog.product_images
		WHERE product_id = ANY($1::uuid[])`, productIDs)
	if err != nil {
		log.Printf("[ADMIN BULK DELETE WARNING] Failed to read product images: %v", err)
		return nil
	}
	defer rows.Close()

	var imageURLs []string
	for rows.Next() {
		var imgURL string
		if scanErr := rows.Scan(&imgURL); scanErr == nil && imgURL != "" {
			imageURLs = append(imageURLs, imgURL)
		}
	}
	return imageURLs
}

func bulkDeleteProducts(ctx context.Context, productIDs []string, deleteImages bool) (int64, int, error) {
	var imageURLs []string
	if deleteImages {
		imageURLs = fetchProductImageURLsByIDs(ctx, productIDs)
	}

	cmdTag, err := db.Pool.Exec(ctx, `
		UPDATE catalog.products
		SET is_active = false,
		    deactivated_at = COALESCE(deactivated_at, CURRENT_TIMESTAMP),
		    deleted_at = CURRENT_TIMESTAMP,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = ANY($1::uuid[])
		  AND deleted_at IS NULL`, productIDs)
	if err != nil {
		return 0, 0, err
	}

	_, _ = db.Pool.Exec(ctx, `
		UPDATE catalog.product_variants
		SET is_active = false
		WHERE product_id = ANY($1::uuid[])`, productIDs)

	imagesRemoved := 0
	if deleteImages {
		_, _ = db.Pool.Exec(ctx, `
			DELETE FROM catalog.product_images
			WHERE product_id = ANY($1::uuid[])`, productIDs)
		imagesRemoved = cleanupUnreferencedProductImages(ctx, imageURLs)
	}

	return cmdTag.RowsAffected(), imagesRemoved, nil
}

// BulkProductAction applies activate, deactivate, or soft-delete (+ optional disk image cleanup)
// across up to 500 selected product IDs and triggers an asynchronous materialized view refresh.
func (h *AdminCatalogHandler) BulkProductAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.Error(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	action, productIDs, deleteImages, err := parseBulkProductActionRequest(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var affected int64
	var imagesRemoved int
	var opErr error
	var message string

	switch action {
	case "activate":
		affected, opErr = bulkActivateProducts(ctx, productIDs)
		message = fmt.Sprintf("%d ürün aktife alındı.", affected)
	case "deactivate":
		affected, opErr = bulkDeactivateProducts(ctx, productIDs)
		message = fmt.Sprintf("%d ürün pasife alındı.", affected)
	case "delete":
		affected, imagesRemoved, opErr = bulkDeleteProducts(ctx, productIDs, deleteImages)
		message = fmt.Sprintf("%d ürün silindi.", affected)
	}

	if opErr != nil {
		log.Printf("[ADMIN BULK ACTION ERROR] action=%s count=%d err=%v", action, len(productIDs), opErr)
		httpx.Error(w, http.StatusInternalServerError, "Toplu ürün işlemi sırasında veritabanı hatası oluştu")
		return
	}

	triggerProductMVRefresh()

	httpx.JSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"action":         action,
		"affected_count": affected,
		"images_removed": imagesRemoved,
		"message":        message,
	})
}

func isAdminVideoUpload(filename, contentType string) bool {
	if services.IsVideoMediaURL(filename) {
		return true
	}
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(contentType)), "video/")
}

func (h *AdminCatalogHandler) resolveMediaProcessor() services.MediaProcessor {
	if h.Media != nil {
		return h.Media
	}
	return services.NewLocalImageMediaService("")
}

func promoteFallbackCoverImage(ctx context.Context, productID string) {
	_, _ = db.Pool.Exec(ctx, `
		UPDATE catalog.product_images
		SET is_cover = true
		WHERE id = (
			SELECT id
			FROM catalog.product_images
			WHERE product_id = $1 AND COALESCE(media_type, 'image') = 'image'
			ORDER BY sort_order ASC
			LIMIT 1
		)`, productID)
}

// UploadProductMedia attaches an image or MP4/WebM video directly to an existing product.
func (h *AdminCatalogHandler) UploadProductMedia(w http.ResponseWriter, r *http.Request) {
	productID := strings.TrimSpace(r.PathValue("id"))
	if productID == "" {
		httpx.Error(w, http.StatusBadRequest, "Product ID is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	var exists bool
	if err := db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM catalog.products WHERE id = $1 AND deleted_at IS NULL)`, productID).Scan(&exists); err != nil || !exists {
		httpx.Error(w, http.StatusNotFound, "Ürün bulunamadı")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 52<<20)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Medya dosyası çok büyük (Video max 50 MB, Görsel max 25 MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		file, header, err = r.FormFile("video")
	}
	if err != nil {
		file, header, err = r.FormFile("image")
	}
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Yüklenecek medya dosyası bulunamadı")
		return
	}
	defer file.Close()

	mediaSvc := h.resolveMediaProcessor()
	isVideo := isAdminVideoUpload(header.Filename, header.Header.Get("Content-Type"))

	var savedURL string
	mediaType := "image"
	if isVideo {
		mediaType = "video"
		var videoSvc services.VideoMediaProcessor
		if v, ok := mediaSvc.(services.VideoMediaProcessor); ok {
			videoSvc = v
		} else {
			videoSvc = services.NewLocalImageMediaService("")
		}
		savedURL, err = videoSvc.SaveUploadedVideo(file, header.Filename, "products", "admvid")
	} else {
		savedURL, err = mediaSvc.SaveUploadedImage(file, header.Filename, "products", "adm")
	}
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	var hasCover bool
	_ = db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM catalog.product_images
			WHERE product_id = $1 AND is_cover = true AND COALESCE(media_type, 'image') = 'image'
		)`, productID).Scan(&hasCover)

	isCover := mediaType == "image" && !hasCover
	var created models.ProductImage
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.product_images (product_id, image_url, media_type, sort_order, is_cover)
		VALUES (
			$1, $2, $3,
			COALESCE((SELECT MAX(sort_order) + 1 FROM catalog.product_images WHERE product_id = $1), 0),
			$4
		)
		RETURNING id, product_id, image_url, media_type, sort_order, is_cover, created_at`,
		productID, savedURL, mediaType, isCover,
	).Scan(&created.ID, &created.ProductID, &created.ImageUrl, &created.MediaType, &created.SortOrder, &created.IsCover, &created.CreatedAt)
	if err != nil {
		log.Printf("[ADMIN MEDIA ERROR] DB insert failed for product %s: %v", productID, err)
		httpx.Error(w, http.StatusInternalServerError, "Medya veritabanına kaydedilemedi")
		return
	}

	triggerProductMVRefresh()

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"media":  created,
		"images": fetchProductImages(ctx, productID),
	})
}

// DeleteProductMedia removes a single photo or video from a product and cleans up unreferenced disk files.
func (h *AdminCatalogHandler) DeleteProductMedia(w http.ResponseWriter, r *http.Request) {
	productID := strings.TrimSpace(r.PathValue("id"))
	mediaID := strings.TrimSpace(r.PathValue("mediaId"))
	if productID == "" || mediaID == "" {
		httpx.Error(w, http.StatusBadRequest, "Product ID ve Media ID zorunludur")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var deletedURL string
	var wasCover bool
	err := db.Pool.QueryRow(ctx, `
		DELETE FROM catalog.product_images
		WHERE id = $1 AND product_id = $2
		RETURNING image_url, COALESCE(is_cover, false)`,
		mediaID, productID,
	).Scan(&deletedURL, &wasCover)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "Medya kaydı bulunamadı")
			return
		}
		log.Printf("[ADMIN MEDIA ERROR] Delete failed product=%s media=%s err=%v", productID, mediaID, err)
		httpx.Error(w, http.StatusInternalServerError, "Medya silinemedi")
		return
	}

	if wasCover {
		promoteFallbackCoverImage(ctx, productID)
	}
	cleanupUnreferencedProductImages(ctx, []string{deletedURL})
	triggerProductMVRefresh()

	httpx.JSON(w, http.StatusOK, map[string]any{
		"deleted": true,
		"images":  fetchProductImages(ctx, productID),
	})
}
