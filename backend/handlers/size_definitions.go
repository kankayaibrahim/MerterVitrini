package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpx"
)

const defaultSupplierSeriesStock = 100

var (
	sizeDefinitionsSchemaMu    sync.Mutex
	sizeDefinitionsSchemaReady bool
)

const sizeDefinitionsBootstrapSQL = `
CREATE TABLE IF NOT EXISTS catalog.size_definitions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    code VARCHAR(32) NOT NULL,
    label VARCHAR(64) NOT NULL,
    size_group VARCHAR(32) NOT NULL DEFAULT 'letter',
    sort_order INT NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_size_definitions_group_code UNIQUE (size_group, code)
);

CREATE INDEX IF NOT EXISTS idx_size_definitions_active_order
    ON catalog.size_definitions (is_active, size_group, sort_order);

CREATE TABLE IF NOT EXISTS catalog.series_templates (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    template_key VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    category_hint VARCHAR(80) NOT NULL DEFAULT 'Genel',
    sizes TEXT[] NOT NULL,
    series_ratio VARCHAR(50) NOT NULL DEFAULT '1-1-1-1',
    units_per_series INT NOT NULL DEFAULT 4,
    sort_order INT NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_series_templates_active_order
    ON catalog.series_templates (is_active, sort_order);

ALTER TABLE catalog.products
    ADD COLUMN IF NOT EXISTS series_stock INT NOT NULL DEFAULT 100;

INSERT INTO catalog.size_definitions (code, label, size_group, sort_order) VALUES
    ('XS', 'XS', 'letter', 10),
    ('S', 'S', 'letter', 20),
    ('M', 'M', 'letter', 30),
    ('L', 'L', 'letter', 40),
    ('XL', 'XL', 'letter', 50),
    ('2XL', '2XL', 'letter', 60),
    ('3XL', '3XL', 'letter', 70),
    ('4XL', '4XL', 'letter', 80),
    ('5XL', '5XL', 'letter', 90),
    ('S-M', 'S-M', 'combo', 110),
    ('M-L', 'M-L', 'combo', 120),
    ('L-XL', 'L-XL', 'combo', 130),
    ('2XL-3XL', '2XL-3XL', 'combo', 140),
    ('4XL-5XL', '4XL-5XL', 'combo', 150),
    ('34', '34', 'numeric_eu', 210),
    ('36', '36', 'numeric_eu', 220),
    ('38', '38', 'numeric_eu', 230),
    ('40', '40', 'numeric_eu', 240),
    ('42', '42', 'numeric_eu', 250),
    ('44', '44', 'numeric_eu', 260),
    ('46', '46', 'numeric_eu', 270),
    ('48', '48', 'numeric_eu', 280),
    ('50', '50', 'numeric_eu', 290),
    ('52', '52', 'numeric_eu', 300),
    ('54', '54', 'numeric_eu', 310),
    ('26', '26', 'jeans', 410),
    ('27', '27', 'jeans', 420),
    ('28', '28', 'jeans', 430),
    ('29', '29', 'jeans', 440),
    ('30', '30', 'jeans', 450),
    ('31', '31', 'jeans', 460),
    ('32', '32', 'jeans', 470),
    ('33', '33', 'jeans', 480),
    ('34', '34', 'jeans', 490),
    ('36', '36', 'jeans', 500),
    ('38', '38', 'jeans', 510),
    ('2-3 YAŞ', '2-3 Yaş', 'kids', 610),
    ('3-4 YAŞ', '3-4 Yaş', 'kids', 620),
    ('4-5 YAŞ', '4-5 Yaş', 'kids', 630),
    ('5-6 YAŞ', '5-6 Yaş', 'kids', 640),
    ('7-8 YAŞ', '7-8 Yaş', 'kids', 650),
    ('9-10 YAŞ', '9-10 Yaş', 'kids', 660),
    ('11-12 YAŞ', '11-12 Yaş', 'kids', 670),
    ('13-14 YAŞ', '13-14 Yaş', 'kids', 680),
    ('36', '36', 'shoes', 710),
    ('37', '37', 'shoes', 720),
    ('38', '38', 'shoes', 730),
    ('39', '39', 'shoes', 740),
    ('40', '40', 'shoes', 750),
    ('41', '41', 'shoes', 760),
    ('42', '42', 'shoes', 770),
    ('43', '43', 'shoes', 780),
    ('44', '44', 'shoes', 790),
    ('STD', 'Standart (Tek Beden)', 'standard', 900)
ON CONFLICT (size_group, code) DO NOTHING;

INSERT INTO catalog.series_templates (template_key, name, category_hint, sizes, series_ratio, units_per_series, sort_order) VALUES
    ('s_m_l_xl_4', 'S - M - L - XL (4''lü Seri)', 'Üst Giyim / Elbise', ARRAY['S','M','L','XL'], '1-1-1-1', 4, 10),
    ('s_m_l_3', 'S - M - L (3''lü Seri)', 'Üst Giyim / Takım', ARRAY['S','M','L'], '1-1-1', 3, 20),
    ('s_m_l_xl_6_assort', 'S - M - L - XL (6''lı Asorti 1-2-2-1)', 'Toptan Hızlı Seri', ARRAY['S','M','L','XL'], '1-2-2-1', 6, 30),
    ('s_m_l_6_double', 'S - M - L (6''lı Çift Seri 2-2-2)', 'Triko / Sweatshirt', ARRAY['S','M','L'], '2-2-2', 6, 40),
    ('m_l_xl_2xl_4', 'M - L - XL - 2XL (4''lü Seri)', 'Rahat Kalıp / Erkek', ARRAY['M','L','XL','2XL'], '1-1-1-1', 4, 50),
    ('sm_lxl_4', 'S-M / L-XL (4''lü Esnek Seri)', 'Triko / İkili Kalıp', ARRAY['S-M','L-XL'], '2-2', 4, 60),
    ('sm_lxl_2xl3xl_6', 'S-M / L-XL / 2XL-3XL (6''lı Seri)', 'Elbise / Takım', ARRAY['S-M','L-XL','2XL-3XL'], '2-2-2', 6, 70),
    ('eu_36_42_4', '36 - 38 - 40 - 42 (4''lü Kadın Seri)', 'Abiye / Elbise / Ceket', ARRAY['36','38','40','42'], '1-1-1-1', 4, 80),
    ('eu_36_44_5', '36 - 38 - 40 - 42 - 44 (5''li Seri)', 'Kadın Giyim', ARRAY['36','38','40','42','44'], '1-1-1-1-1', 5, 90),
    ('plus_42_48_4', '42 - 44 - 46 - 48 (4''lü Büyük Beden)', 'Büyük Beden', ARRAY['42','44','46','48'], '1-1-1-1', 4, 100),
    ('jeans_28_36_5', '28 - 30 - 32 - 34 - 36 (5''li Jean Seri)', 'Kot / Pantolon', ARRAY['28','30','32','34','36'], '1-1-1-1-1', 5, 110),
    ('std_single_1', 'Standart Tek Beden (STD)', 'Şal / Aksesuar / Oversize', ARRAY['STD'], '1', 1, 120)
ON CONFLICT (template_key) DO NOTHING;
`

func ensureSizeDefinitionsSchema(ctx context.Context) {
	sizeDefinitionsSchemaMu.Lock()
	defer sizeDefinitionsSchemaMu.Unlock()
	if sizeDefinitionsSchemaReady {
		return
	}
	if _, err := db.Pool.Exec(ctx, sizeDefinitionsBootstrapSQL); err != nil {
		log.Printf("[SIZE DEFINITIONS] Bootstrap warning: %v", err)
		return
	}
	sizeDefinitionsSchemaReady = true
}

func normalizeSizeCodeInput(raw string) string {
	code := strings.ToUpper(strings.TrimSpace(raw))
	switch code {
	case "STANDART", "STANDARD", "STANDART (STD)", "STANDART (TEK BEDEN)", "TEK BEDEN", "ONE SIZE", "OS":
		return "STD"
	case "XXL":
		return "2XL"
	case "XXXL":
		return "3XL"
	case "XXXXL":
		return "4XL"
	default:
		return code
	}
}

func fetchActiveSizeDefinitions(ctx context.Context) []models.SizeDefinition {
	ensureSizeDefinitionsSchema(ctx)
	out := make([]models.SizeDefinition, 0)
	rows, err := db.Pool.Query(ctx, `
		SELECT id, code, label, size_group, sort_order, is_active, created_at
		FROM catalog.size_definitions
		WHERE is_active = true
		ORDER BY sort_order ASC, code ASC`)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var item models.SizeDefinition
		if scanErr := rows.Scan(&item.ID, &item.Code, &item.Label, &item.SizeGroup, &item.SortOrder, &item.IsActive, &item.CreatedAt); scanErr == nil {
			out = append(out, item)
		}
	}
	return out
}

func fetchActiveSeriesTemplates(ctx context.Context) []models.SeriesTemplate {
	ensureSizeDefinitionsSchema(ctx)
	out := make([]models.SeriesTemplate, 0)
	rows, err := db.Pool.Query(ctx, `
		SELECT id, template_key, name, category_hint, sizes, series_ratio, units_per_series, sort_order, is_active, created_at
		FROM catalog.series_templates
		WHERE is_active = true
		ORDER BY sort_order ASC, name ASC`)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var item models.SeriesTemplate
		if scanErr := rows.Scan(
			&item.ID, &item.TemplateKey, &item.Name, &item.CategoryHint,
			&item.Sizes, &item.SeriesRatio, &item.UnitsPerSeries,
			&item.SortOrder, &item.IsActive, &item.CreatedAt,
		); scanErr == nil {
			out = append(out, item)
		}
	}
	return out
}

func loadAllowedSizesMap(ctx context.Context, existingProductID string) map[string]int {
	defs := fetchActiveSizeDefinitions(ctx)
	allowed := make(map[string]int, len(defs)+4)
	for _, d := range defs {
		norm := normalizeSizeCodeInput(d.Code)
		if existingOrder, exists := allowed[norm]; !exists || d.SortOrder < existingOrder {
			allowed[norm] = d.SortOrder
		}
	}
	if existingProductID != "" {
		rows, err := db.Pool.Query(ctx, "SELECT variant_size FROM catalog.product_variants WHERE product_id = $1", existingProductID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var sz string
				if rows.Scan(&sz) == nil {
					norm := normalizeSizeCodeInput(sz)
					if norm != "" {
						if _, ok := allowed[norm]; !ok {
							allowed[norm] = 950
						}
					}
				}
			}
		}
	}
	return allowed
}

func parseSeriesWeightsForSizes(rawRatio string, sizeCount int) ([]int, string, int) {
	if sizeCount <= 0 {
		return []int{1}, "1", 1
	}
	parts := strings.FieldsFunc(strings.TrimSpace(rawRatio), func(r rune) bool {
		return r == '-' || r == ',' || r == '/' || r == '+' || r == ' '
	})
	parsed := make([]int, 0, len(parts))
	for _, p := range parts {
		token := p
		if eqIdx := strings.LastIndex(p, "="); eqIdx >= 0 {
			token = p[eqIdx+1:]
		}
		v, err := strconv.Atoi(strings.TrimSpace(token))
		if err == nil && v > 0 && v <= 50 {
			parsed = append(parsed, v)
		}
	}

	weights := make([]int, sizeCount)
	if len(parsed) == sizeCount {
		copy(weights, parsed)
	} else if len(parsed) == 1 && parsed[0] > 1 {
		for i := range weights {
			weights[i] = parsed[0]
		}
	} else {
		for i := range weights {
			weights[i] = 1
		}
	}

	strParts := make([]string, sizeCount)
	totalUnits := 0
	for i, w := range weights {
		strParts[i] = strconv.Itoa(w)
		totalUnits += w
	}
	if totalUnits <= 0 {
		totalUnits = sizeCount
	}
	return weights, strings.Join(strParts, "-"), totalUnits
}

func validateAndSortSelectedSizes(rawSizes []string, allowed map[string]int) ([]string, error) {
	seen := make(map[string]bool, len(rawSizes))
	cleaned := make([]string, 0, len(rawSizes))
	for _, raw := range rawSizes {
		code := normalizeSizeCodeInput(raw)
		if code == "" {
			continue
		}
		if _, ok := allowed[code]; !ok {
			return nil, fmt.Errorf("geçersiz beden seçimi (%s): lütfen yalnızca sistemde tanımlı standart bedenlerden seçim yapınız", raw)
		}
		if !seen[code] {
			seen[code] = true
			cleaned = append(cleaned, code)
		}
	}
	sort.SliceStable(cleaned, func(i, j int) bool {
		return allowed[cleaned[i]] < allowed[cleaned[j]]
	})
	return cleaned, nil
}

// resolveSupplierSeriesAndVariants normalizes supplier product input so suppliers select predefined sizes
// and specify estimated series count (default 100 series) instead of typing sizes or per-size piece counts.
func resolveSupplierSeriesAndVariants(ctx context.Context, req *models.SupplierProductInput, existingProductID string) (int, error) {
	allowed := loadAllowedSizesMap(ctx, existingProductID)

	rawSizes := make([]string, 0)
	if len(req.SelectedSizes) > 0 {
		rawSizes = append(rawSizes, req.SelectedSizes...)
	} else if len(req.Variants) > 0 {
		for _, v := range req.Variants {
			rawSizes = append(rawSizes, v.Size)
		}
	} else {
		rawSizes = []string{"S", "M", "L", "XL"}
	}

	sizes, err := validateAndSortSelectedSizes(rawSizes, allowed)
	if err != nil {
		return 0, err
	}
	if len(sizes) == 0 {
		sizes = []string{"STD"}
	}

	seriesStock := req.SeriesStock
	if seriesStock <= 0 {
		seriesStock = inferSeriesStockFromVariants(req.Variants)
	}
	req.SeriesStock = seriesStock

	weights, normalizedRatio, unitsPerSeries := parseSeriesWeightsForSizes(req.SeriesRatio, len(sizes))
	req.SeriesRatio = normalizedRatio
	req.PackingRatio = strings.Join(sizes, ",")

	minSeries := req.MinOrderSeries
	if minSeries <= 0 {
		if req.MinimumOrderQuantity > unitsPerSeries && unitsPerSeries > 0 {
			minSeries = (req.MinimumOrderQuantity + unitsPerSeries - 1) / unitsPerSeries
		} else {
			minSeries = 1
		}
	}
	req.MinOrderSeries = minSeries
	req.MinimumOrderQuantity = minSeries * unitsPerSeries

	existingBarcodes := make(map[string]string, len(req.Variants))
	for _, v := range req.Variants {
		existingBarcodes[normalizeSizeCodeInput(v.Size)] = strings.TrimSpace(v.Barcode)
	}

	builtVariants := make([]models.SupplierProductVariantInput, 0, len(sizes))
	totalStock := 0
	for idx, sz := range sizes {
		unitStock := weights[idx] * seriesStock
		totalStock += unitStock
		builtVariants = append(builtVariants, models.SupplierProductVariantInput{
			Size:     sz,
			Barcode:  existingBarcodes[sz],
			Stock:    unitStock,
			IsSingle: false,
		})
	}
	req.Variants = builtVariants
	return totalStock, nil
}

func inferSeriesStockFromVariants(variants []models.SupplierProductVariantInput) int {
	if len(variants) == 0 {
		return defaultSupplierSeriesStock
	}
	minPositive := 0
	for _, v := range variants {
		if v.Stock > 0 && (minPositive == 0 || v.Stock < minPositive) {
			minPositive = v.Stock
		}
	}
	if minPositive > 0 {
		return minPositive
	}
	return defaultSupplierSeriesStock
}

// --- ADMIN CATALOG LOOKUP MANAGEMENT ENDPOINTS ---

func (h *AdminCatalogHandler) ListSizeDefinitions(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	ensureSizeDefinitionsSchema(ctx)

	rows, err := db.Pool.Query(ctx, `
		SELECT id, code, label, size_group, sort_order, is_active, created_at
		FROM catalog.size_definitions
		ORDER BY sort_order ASC, code ASC`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Beden tanımları yüklenemedi")
		return
	}
	defer rows.Close()

	items := make([]models.SizeDefinition, 0)
	for rows.Next() {
		var it models.SizeDefinition
		if rows.Scan(&it.ID, &it.Code, &it.Label, &it.SizeGroup, &it.SortOrder, &it.IsActive, &it.CreatedAt) == nil {
			items = append(items, it)
		}
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *AdminCatalogHandler) CreateSizeDefinition(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code      string `json:"code"`
		Label     string `json:"label"`
		SizeGroup string `json:"size_group"`
		SortOrder int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz veri formatı")
		return
	}
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		httpx.Error(w, http.StatusBadRequest, "Beden kodu zorunludur")
		return
	}
	label := strings.TrimSpace(req.Label)
	if label == "" {
		label = code
	}
	group := strings.TrimSpace(req.SizeGroup)
	if group == "" {
		group = "letter"
	}
	if req.SortOrder <= 0 {
		req.SortOrder = 100
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	ensureSizeDefinitionsSchema(ctx)

	var created models.SizeDefinition
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.size_definitions (code, label, size_group, sort_order, is_active)
		VALUES ($1, $2, $3, $4, true)
		ON CONFLICT (size_group, code) DO UPDATE SET
			label = EXCLUDED.label,
			sort_order = EXCLUDED.sort_order,
			is_active = true
		RETURNING id, code, label, size_group, sort_order, is_active, created_at`,
		code, label, group, req.SortOrder,
	).Scan(&created.ID, &created.Code, &created.Label, &created.SizeGroup, &created.SortOrder, &created.IsActive, &created.CreatedAt)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Beden tanımı kaydedilemedi")
		return
	}
	httpx.JSON(w, http.StatusCreated, created)
}

func (h *AdminCatalogHandler) DeleteSizeDefinition(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "ID zorunludur")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if _, err := db.Pool.Exec(ctx, "DELETE FROM catalog.size_definitions WHERE id = $1", id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Beden tanımı silinemedi")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true})
}

func (h *AdminCatalogHandler) ListSeriesTemplates(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	ensureSizeDefinitionsSchema(ctx)

	rows, err := db.Pool.Query(ctx, `
		SELECT id, template_key, name, category_hint, sizes, series_ratio, units_per_series, sort_order, is_active, created_at
		FROM catalog.series_templates
		ORDER BY sort_order ASC, name ASC`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Seri şablonları yüklenemedi")
		return
	}
	defer rows.Close()

	items := make([]models.SeriesTemplate, 0)
	for rows.Next() {
		var it models.SeriesTemplate
		if rows.Scan(
			&it.ID, &it.TemplateKey, &it.Name, &it.CategoryHint,
			&it.Sizes, &it.SeriesRatio, &it.UnitsPerSeries,
			&it.SortOrder, &it.IsActive, &it.CreatedAt,
		) == nil {
			items = append(items, it)
		}
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *AdminCatalogHandler) CreateSeriesTemplate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name         string   `json:"name"`
		CategoryHint string   `json:"category_hint"`
		Sizes        []string `json:"sizes"`
		SeriesRatio  string   `json:"series_ratio"`
		SortOrder    int      `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz veri formatı")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len(req.Sizes) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Şablon adı ve en az bir tanımlı beden seçimi zorunludur")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	allowed := loadAllowedSizesMap(ctx, "")
	sizes, err := validateAndSortSelectedSizes(req.Sizes, allowed)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	_, normalizedRatio, unitsPerSeries := parseSeriesWeightsForSizes(req.SeriesRatio, len(sizes))
	catHint := strings.TrimSpace(req.CategoryHint)
	if catHint == "" {
		catHint = "Genel"
	}
	if req.SortOrder <= 0 {
		req.SortOrder = 100
	}
	tplKey := fmt.Sprintf("custom_%d", time.Now().UnixNano())

	var created models.SeriesTemplate
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.series_templates (
			template_key, name, category_hint, sizes, series_ratio, units_per_series, sort_order, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
		RETURNING id, template_key, name, category_hint, sizes, series_ratio, units_per_series, sort_order, is_active, created_at`,
		tplKey, name, catHint, sizes, normalizedRatio, unitsPerSeries, req.SortOrder,
	).Scan(
		&created.ID, &created.TemplateKey, &created.Name, &created.CategoryHint,
		&created.Sizes, &created.SeriesRatio, &created.UnitsPerSeries,
		&created.SortOrder, &created.IsActive, &created.CreatedAt,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Seri şablonu kaydedilemedi")
		return
	}
	httpx.JSON(w, http.StatusCreated, created)
}

func (h *AdminCatalogHandler) DeleteSeriesTemplate(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "ID zorunludur")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if _, err := db.Pool.Exec(ctx, "DELETE FROM catalog.series_templates WHERE id = $1", id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Seri şablonu silinemedi")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true})
}

