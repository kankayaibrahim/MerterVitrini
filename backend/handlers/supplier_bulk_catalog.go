package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
)

var productArchiveSchemaOnce sync.Once

func ensureProductArchiveSchema(ctx context.Context) {
	productArchiveSchemaOnce.Do(func() {
		ddl := `
		ALTER TABLE catalog.products
			ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
			ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
			ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL;
		CREATE INDEX IF NOT EXISTS idx_products_brand_archived_active
			ON catalog.products (brand_id, is_archived, is_active);
		`
		_, _ = db.Pool.Exec(ctx, ddl)
	})
}

// ToggleArchiveProduct handles POST /api/v1/supplier/products/{id}/archive
func (h *SupplierPortalHandler) ToggleArchiveProduct(w http.ResponseWriter, r *http.Request) {
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

	var req struct {
		IsArchived    bool `json:"is_archived"`
		RestoreActive bool `json:"restore_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz veri formatı"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	ensureProductArchiveSchema(ctx)

	if req.IsArchived {
		res, err := db.Pool.Exec(ctx, `
			UPDATE catalog.products
			SET is_archived = true,
			    is_active = false,
			    deactivated_at = COALESCE(deactivated_at, CURRENT_TIMESTAMP),
			    archived_at = CURRENT_TIMESTAMP,
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $1 AND brand_id = $2
		`, id, claims.BrandID)
		if err != nil || res.RowsAffected() == 0 {
			writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Ürün arşivlenemedi veya yetkiniz yok"})
			return
		}
		triggerProductMVRefresh()
		writeSupplierJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "Ürün eski koleksiyon arşivine taşındı ve vitrinden kaldırıldı.",
		})
		return
	}

	var restoredSlug, restoredTitle string
	err := db.Pool.QueryRow(ctx, `
		UPDATE catalog.products
		SET is_archived = false,
		    is_active = $3,
		    deactivated_at = CASE WHEN $3 = true THEN NULL ELSE deactivated_at END,
		    archived_at = NULL,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND brand_id = $2
		RETURNING coalesce(slug, ''), title
	`, id, claims.BrandID, req.RestoreActive).Scan(&restoredSlug, &restoredTitle)
	if err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Ürün arşivden çıkarılamadı"})
		return
	}

	if req.RestoreActive && strings.TrimSpace(restoredSlug) != "" {
		triggerProductMVRefreshAndIndexNow([]string{restoredSlug}, IndexNowSubmissionMeta{
			TriggerSource: "supplier_portal",
			SourceLabel:   "Tedarikçi Arşivden Yayına Alma: " + restoredTitle,
			ProductCount:  1,
		})
	} else {
		triggerProductMVRefresh()
	}
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Ürün arşivden çıkarıldı.",
	})
}

type bulkArchiveRequest struct {
	ProductIDs    []string `json:"product_ids"`
	IsArchived    bool     `json:"is_archived"`
	RestoreActive bool     `json:"restore_active"`
	Season        string   `json:"season"`
	OlderThanDays int      `json:"older_than_days"`
	ZeroStockOnly bool     `json:"zero_stock_only"`
}

func executeBulkArchiveByIDs(ctx context.Context, brandID string, req bulkArchiveRequest) (int64, []string, error) {
	if req.IsArchived {
		tag, err := db.Pool.Exec(ctx, `
			UPDATE catalog.products
			SET is_archived = true,
			    is_active = false,
			    deactivated_at = COALESCE(deactivated_at, CURRENT_TIMESTAMP),
			    archived_at = CURRENT_TIMESTAMP,
			    updated_at = CURRENT_TIMESTAMP
			WHERE brand_id = $1 AND id::text = ANY($2)
		`, brandID, req.ProductIDs)
		if err != nil {
			return 0, nil, err
		}
		return tag.RowsAffected(), nil, nil
	}

	rows, err := db.Pool.Query(ctx, `
		UPDATE catalog.products
		SET is_archived = false,
		    is_active = $3,
		    deactivated_at = CASE WHEN $3 = true THEN NULL ELSE deactivated_at END,
		    archived_at = NULL,
		    updated_at = CURRENT_TIMESTAMP
		WHERE brand_id = $1 AND id::text = ANY($2)
		RETURNING coalesce(slug, '')
	`, brandID, req.ProductIDs, req.RestoreActive)
	if err != nil {
		return 0, nil, err
	}
	defer rows.Close()

	var count int64
	var restoredSlugs []string
	for rows.Next() {
		var s string
		if scanErr := rows.Scan(&s); scanErr == nil {
			count++
			if req.RestoreActive && strings.TrimSpace(s) != "" {
				restoredSlugs = append(restoredSlugs, s)
			}
		}
	}
	return count, restoredSlugs, nil
}

func executeBulkArchiveByRules(ctx context.Context, brandID string, req bulkArchiveRequest) (int64, error) {
	season := strings.TrimSpace(req.Season)
	if season == "" && req.OlderThanDays <= 0 && !req.ZeroStockOnly {
		return 0, fmt.Errorf("Lütfen arşivlenecek sezon, gün sınırı veya stok durumu seçin")
	}

	tag, err := db.Pool.Exec(ctx, `
		UPDATE catalog.products p
		SET is_archived = true,
		    is_active = false,
		    deactivated_at = COALESCE(p.deactivated_at, CURRENT_TIMESTAMP),
		    archived_at = CURRENT_TIMESTAMP,
		    updated_at = CURRENT_TIMESTAMP
		WHERE p.brand_id = $1
		  AND COALESCE(p.is_archived, false) = false
		  AND ($2 = '' OR COALESCE(p.season, '') ILIKE $2)
		  AND ($3 <= 0 OR p.created_at < NOW() - ($3 * INTERVAL '1 day'))
		  AND ($4 = false OR p.stock <= 0)
	`, brandID, season, req.OlderThanDays, req.ZeroStockOnly)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// BulkArchiveProducts handles POST /api/v1/supplier/products/bulk-archive
func (h *SupplierPortalHandler) BulkArchiveProducts(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	var req bulkArchiveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek verisi"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	ensureProductArchiveSchema(ctx)

	var affected int64
	var restoredSlugs []string
	var err error
	if len(req.ProductIDs) > 0 {
		affected, restoredSlugs, err = executeBulkArchiveByIDs(ctx, claims.BrandID, req)
	} else {
		affected, err = executeBulkArchiveByRules(ctx, claims.BrandID, req)
	}
	if err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	if len(restoredSlugs) > 0 {
		triggerProductMVRefreshAndIndexNow(restoredSlugs, IndexNowSubmissionMeta{
			TriggerSource: "supplier_portal",
			SourceLabel:   fmt.Sprintf("Tedarikçi Toplu Arşivden Yayına Alma (%d ürün)", len(restoredSlugs)),
			ProductCount:  len(restoredSlugs),
		})
	} else {
		triggerProductMVRefresh()
	}
	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"affected_count": affected,
		"message":        fmt.Sprintf("%d ürün koleksiyon arşivi işlemi tamamlandı.", affected),
	})
}

// DownloadExcelTemplate handles GET /api/v1/supplier/products/excel-template
func (h *SupplierPortalHandler) DownloadExcelTemplate(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	f := excelize.NewFile()
	defer f.Close()

	mainSheet := "Urun_Yukleme_Sablonu"
	f.SetSheetName("Sheet1", mainSheet)

	headers := []string{
		"Ürün Başlığı *",
		"Kategori Adı veya Slug *",
		"Toptan Satış Fiyatı *",
		"Para Birimi (TRY/USD/EUR)",
		"Paket / Seri Bilgisi",
		"Seri Oranı",
		"Min. Sipariş (MOQ)",
		"Bedenler ve Stoklar (Örn: S:10,M:20,L:20,XL:10)",
		"Renk",
		"Kumaş",
		"Sezon",
		"Cinsiyet",
		"Görsel URL'leri (Virgülle Ayırın)",
		"Kısa Açıklama",
		"Detaylı Açıklama",
		"Tedarikçi Ürün / Model Kodu (Opsiyonel - Aynı Kod Varsa Güncellenir)",
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF", Size: 11},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#0F172A"}, Pattern: 1},
	})

	for idx, hText := range headers {
		colName, _ := excelize.ColumnNumberToName(idx + 1)
		cell := fmt.Sprintf("%s1", colName)
		_ = f.SetCellValue(mainSheet, cell, hText)
		_ = f.SetCellStyle(mainSheet, cell, cell, headerStyle)
		_ = f.SetColWidth(mainSheet, colName, colName, 24)
	}

	sampleRow1 := []any{
		"Kadın Kruvaze Yaka Kaşe Kaban",
		"Kaban",
		1250.00,
		"TRY",
		"S-M-L-XL 4'lü Seri Paket",
		"1-2-2-1",
		4,
		"S:10,M:20,L:20,XL:10",
		"Siyah",
		"Kaşe",
		"2026 Sonbahar/Kış",
		"Kadın",
		"https://mertervitrini.com.tr/placeholder.png",
		"Astarlı, birinci sınıf Merter üretimi toptan kaşe kaban.",
		"İhracata uygun kalıp, kruvaze yaka, kemerli kadın kaşe kaban serisi.",
		"KBN-2026-01",
	}
	for idx, val := range sampleRow1 {
		colName, _ := excelize.ColumnNumberToName(idx + 1)
		_ = f.SetCellValue(mainSheet, fmt.Sprintf("%s2", colName), val)
	}

	catSheet := "Kategoriler_Rehberi"
	_, _ = f.NewSheet(catSheet)
	_ = f.SetCellValue(catSheet, "A1", "Kategori Adı")
	_ = f.SetCellValue(catSheet, "B1", "Kategori Slug")
	_ = f.SetCellValue(catSheet, "C1", "Kategori UUID")
	_ = f.SetCellStyle(catSheet, "A1", "C1", headerStyle)
	_ = f.SetColWidth(catSheet, "A", "C", 30)

	cRows, err := db.Pool.Query(ctx, `SELECT id::text, title, slug FROM catalog.categories WHERE is_active = true ORDER BY node_path ASC`)
	if err == nil {
		defer cRows.Close()
		rowNum := 2
		for cRows.Next() {
			var cid, ctitle, cslug string
			if scanErr := cRows.Scan(&cid, &ctitle, &cslug); scanErr == nil {
				_ = f.SetCellValue(catSheet, fmt.Sprintf("A%d", rowNum), ctitle)
				_ = f.SetCellValue(catSheet, fmt.Sprintf("B%d", rowNum), cslug)
				_ = f.SetCellValue(catSheet, fmt.Sprintf("C%d", rowNum), cid)
				rowNum++
			}
		}
	}

	w.Header().Set(headerContentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="mertervitrini_toplu_urun_sablonu.xlsx"`)
	_ = f.Write(w)
}

type categoryLookupMap struct {
	byID    map[string]string
	bySlug  map[string]string
	byTitle map[string]string
	defID   string
}

func loadCategoryLookupMap(ctx context.Context) categoryLookupMap {
	res := categoryLookupMap{
		byID:    make(map[string]string),
		bySlug:  make(map[string]string),
		byTitle: make(map[string]string),
	}
	rows, err := db.Pool.Query(ctx, `SELECT id::text, title, slug FROM catalog.categories WHERE is_active = true ORDER BY node_path ASC`)
	if err != nil {
		return res
	}
	defer rows.Close()
	for rows.Next() {
		var id, title, slug string
		if rows.Scan(&id, &title, &slug) == nil {
			if res.defID == "" {
				res.defID = id
			}
			res.byID[strings.ToLower(strings.TrimSpace(id))] = id
			res.bySlug[strings.ToLower(strings.TrimSpace(slug))] = id
			res.byTitle[strings.ToLower(strings.TrimSpace(title))] = id
		}
	}
	return res
}

func (m categoryLookupMap) resolve(raw string) string {
	key := strings.ToLower(strings.TrimSpace(raw))
	if key == "" {
		return m.defID
	}
	if id, ok := m.byID[key]; ok {
		return id
	}
	if id, ok := m.bySlug[key]; ok {
		return id
	}
	if id, ok := m.byTitle[key]; ok {
		return id
	}
	for titleKey, id := range m.byTitle {
		if strings.Contains(titleKey, key) || strings.Contains(key, titleKey) {
			return id
		}
	}
	return m.defID
}

func resolveOrInsertColorID(ctx context.Context, rawColor string) *string {
	name := strings.TrimSpace(rawColor)
	if name == "" {
		return nil
	}
	var id string
	err := db.Pool.QueryRow(ctx, `SELECT id::text FROM catalog.colors WHERE lower(color_name) = lower($1) LIMIT 1`, name).Scan(&id)
	if err == nil && id != "" {
		return &id
	}
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.colors (color_name)
		VALUES ($1)
		ON CONFLICT (color_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING id::text
	`, name).Scan(&id)
	if err == nil && id != "" {
		return &id
	}
	return nil
}

func resolveOrInsertFabricID(ctx context.Context, rawFabric string) *string {
	name := strings.TrimSpace(rawFabric)
	if name == "" {
		return nil
	}
	var id string
	err := db.Pool.QueryRow(ctx, `SELECT id::text FROM catalog.fabrics WHERE lower(fabric_name) = lower($1) LIMIT 1`, name).Scan(&id)
	if err == nil && id != "" {
		return &id
	}
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.fabrics (fabric_name)
		VALUES ($1)
		ON CONFLICT (fabric_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING id::text
	`, name).Scan(&id)
	if err == nil && id != "" {
		return &id
	}
	return nil
}

func parseSingleVariantToken(token string) (models.SupplierProductVariantInput, bool) {
	if token == "" {
		return models.SupplierProductVariantInput{}, false
	}
	kv := strings.SplitN(token, ":", 2)
	size := strings.TrimSpace(kv[0])
	if size == "" {
		return models.SupplierProductVariantInput{}, false
	}
	stock := 10
	if len(kv) == 2 {
		if parsed, err := strconv.Atoi(strings.TrimSpace(kv[1])); err == nil && parsed >= 0 {
			stock = parsed
		}
	}
	return models.SupplierProductVariantInput{Size: size, Stock: stock}, true
}

func parseVariantsCell(raw string) ([]models.SupplierProductVariantInput, int) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []models.SupplierProductVariantInput{
			{Size: "S", Stock: 10},
			{Size: "M", Stock: 15},
			{Size: "L", Stock: 15},
			{Size: "XL", Stock: 10},
		}, 50
	}
	if n, err := strconv.Atoi(trimmed); err == nil && n >= 0 {
		return []models.SupplierProductVariantInput{{Size: "STANDART", Stock: n}}, n
	}

	parts := strings.FieldsFunc(trimmed, func(r rune) bool {
		return r == ',' || r == ';' || r == '|'
	})
	variants := make([]models.SupplierProductVariantInput, 0, len(parts))
	totalStock := 0
	for _, p := range parts {
		if variant, ok := parseSingleVariantToken(strings.TrimSpace(p)); ok {
			variants = append(variants, variant)
			totalStock += variant.Stock
		}
	}
	if len(variants) == 0 {
		return []models.SupplierProductVariantInput{{Size: "STANDART", Stock: 20}}, 20
	}
	return variants, totalStock
}

func parseSpreadsheetRows(file io.Reader, filename string) ([][]string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == ".csv" {
		reader := csv.NewReader(file)
		reader.FieldsPerRecord = -1
		reader.LazyQuotes = true
		return reader.ReadAll()
	}

	f, err := excelize.OpenReader(file)
	if err != nil {
		return nil, fmt.Errorf("Excel dosyası okunamadı (.xlsx veya .csv yükleyiniz)")
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("Excel dosyasında çalışma sayfası bulunamadı")
	}
	return f.GetRows(sheets[0])
}

func cellAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

func parsePriceValue(raw string) float64 {
	cleaned := strings.ReplaceAll(strings.TrimSpace(raw), ",", ".")
	val, err := strconv.ParseFloat(cleaned, 64)
	if err != nil || val < 0 {
		return 0
	}
	return val
}

type excelImportSession struct {
	BrandID         string
	SKUColIdx       int
	Cats            categoryLookupMap
	ContentAccepted bool
	ContentVersion  int
	AuditActor      ProductAuditActor
}

type importedSpreadsheetItem struct {
	BrandID         string
	RowIdx          int
	Title           string
	SupplierSKU     string
	CatID           string
	Price           float64
	Currency        string
	PackingRatio    string
	SeriesRatio     string
	MOQ             int
	Variants        []models.SupplierProductVariantInput
	TotalStock      int
	ColorID         *string
	FabricID        *string
	Season          string
	Gender          string
	Images          []string
	ShortDesc       string
	Desc            string
	ContentAccepted bool
	ContentVersion  int
	AuditActor      ProductAuditActor
}

func detectSupplierSKUColumn(headerRow []string) int {
	for idx, raw := range headerRow {
		h := strings.ToLower(strings.TrimSpace(raw))
		if strings.Contains(h, "model kodu") || strings.Contains(h, "ürün kodu") || strings.Contains(h, "urun kodu") || strings.Contains(h, "sku") {
			return idx
		}
	}
	return 15
}

func parseImportedSpreadsheetRow(ctx context.Context, sess excelImportSession, rowIdx int, row []string) (*importedSpreadsheetItem, error) {
	title := cellAt(row, 0)
	price := parsePriceValue(cellAt(row, 2))
	if title == "" || price <= 0 {
		return nil, fmt.Errorf("Satır %d: Ürün başlığı ve geçerli satış fiyatı zorunludur", rowIdx)
	}

	catID := sess.Cats.resolve(cellAt(row, 1))
	if catID == "" {
		return nil, fmt.Errorf("Satır %d: Geçerli bir kategori bulunamadı", rowIdx)
	}

	currency := strings.ToUpper(cellAt(row, 3))
	if currency != "USD" && currency != "EUR" && currency != "TRY" {
		currency = "TRY"
	}

	moq, _ := strconv.Atoi(cellAt(row, 6))
	if moq <= 0 {
		moq = 1
	}

	variants, totalStock := parseVariantsCell(cellAt(row, 7))
	images := make([]string, 0)
	for _, part := range strings.Split(cellAt(row, 12), ",") {
		u := strings.TrimSpace(part)
		if u != "" && !strings.HasSuffix(u, "/placeholder.png") {
			images = append(images, u)
		}
	}

	return &importedSpreadsheetItem{
		BrandID:         sess.BrandID,
		RowIdx:          rowIdx,
		Title:           title,
		SupplierSKU:     normalizeSupplierSKU(cellAt(row, sess.SKUColIdx)),
		CatID:           catID,
		Price:           price,
		Currency:        currency,
		PackingRatio:    cellAt(row, 4),
		SeriesRatio:     cellAt(row, 5),
		MOQ:             moq,
		Variants:        variants,
		TotalStock:      totalStock,
		ColorID:         resolveOrInsertColorID(ctx, cellAt(row, 8)),
		FabricID:        resolveOrInsertFabricID(ctx, cellAt(row, 9)),
		Season:          cellAt(row, 10),
		Gender:          cellAt(row, 11),
		Images:          images,
		ShortDesc:       cellAt(row, 13),
		Desc:            cellAt(row, 14),
		ContentAccepted: sess.ContentAccepted,
		ContentVersion:  sess.ContentVersion,
	}, nil
}

func updateExistingImportedProductTx(ctx context.Context, tx pgx.Tx, existingID string, item *importedSpreadsheetItem) (string, string, error) {
	var updatedSlug, updatedCustomSKU string
	err := tx.QueryRow(ctx, `
		UPDATE catalog.products SET
			title = $1, short_description = $2, description = $3,
			category_id = $4, color_id = COALESCE($5, color_id), fabric_id = COALESCE($6, fabric_id),
			gender = NULLIF($7, ''), season = NULLIF($8, ''),
			price = $9, currency = $10, packing_ratio = NULLIF($11, ''), series_ratio = NULLIF($12, ''),
			minimum_order_quantity = $13, stock = $14,
			is_active = true, is_archived = false, archived_at = NULL, deactivated_at = NULL,
			sku = COALESCE(NULLIF(BTRIM($15), ''), sku),
			content_responsibility_accepted = CASE WHEN $16 THEN true ELSE content_responsibility_accepted END,
			content_responsibility_accepted_at = CASE WHEN $16 THEN CURRENT_TIMESTAMP ELSE content_responsibility_accepted_at END,
			content_responsibility_version = CASE WHEN $16 THEN $17::integer ELSE content_responsibility_version END,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $18 AND brand_id = $19
		RETURNING coalesce(slug, ''), coalesce(custom_sku, '')
	`,
		item.Title, item.ShortDesc, item.Desc,
		item.CatID, item.ColorID, item.FabricID,
		item.Gender, item.Season,
		item.Price, item.Currency, item.PackingRatio, item.SeriesRatio,
		item.MOQ, item.TotalStock, item.SupplierSKU,
		item.ContentAccepted, item.ContentVersion,
		existingID, item.BrandID,
	).Scan(&updatedSlug, &updatedCustomSKU)
	if err != nil {
		return "", "", fmt.Errorf("Satır %d (%s): Güncelleme hatası", item.RowIdx, item.Title)
	}

	upsertSupplierProductTranslations(ctx, tx, existingID, item.Title, item.ShortDesc, item.Desc, nil)
	updateProductVariants(ctx, tx, existingID, item.Variants)
	if len(item.Images) > 0 {
		updateProductImages(ctx, tx, existingID, item.Images)
	}
	return updatedSlug, updatedCustomSKU, nil
}

func insertNewImportedProductTx(ctx context.Context, tx pgx.Tx, item *importedSpreadsheetItem) (string, string, string, error) {
	sourceProductID := fmt.Sprintf("XLS-%d-%d", time.Now().UnixNano(), item.RowIdx)
	var newProductID, newSlug, customSKU string
	err := tx.QueryRow(ctx, `
		INSERT INTO catalog.products (
			brand_id, feed_id, source_product_id, sku, title, short_description, description,
			category_id, color_id, fabric_id, gender, season,
			buying_price, price, currency, packing_ratio, series_ratio,
			minimum_order_quantity, stock, is_active,
			content_responsibility_accepted, content_responsibility_accepted_at, content_responsibility_version
		) VALUES (
			$1, NULL, $2, NULLIF(BTRIM($3), ''), $4, $5, $6,
			$7, $8, $9, $10, $11,
			0, $12, $13, $14, $15,
			$16, $17, true,
			$18, CASE WHEN $18 THEN CURRENT_TIMESTAMP ELSE NULL END, CASE WHEN $18 THEN $19::integer ELSE NULL::integer END
		) RETURNING id::text, coalesce(slug, ''), coalesce(custom_sku, '')
	`,
		item.BrandID, sourceProductID, item.SupplierSKU, item.Title, item.ShortDesc, item.Desc,
		item.CatID, item.ColorID, item.FabricID, item.Gender, item.Season,
		item.Price, item.Currency, item.PackingRatio, item.SeriesRatio,
		item.MOQ, item.TotalStock, item.ContentAccepted, item.ContentVersion,
	).Scan(&newProductID, &newSlug, &customSKU)
	if err != nil {
		return "", "", "", fmt.Errorf("Satır %d (%s): Kayıt hatası", item.RowIdx, item.Title)
	}

	upsertSupplierProductTranslations(ctx, tx, newProductID, item.Title, item.ShortDesc, item.Desc, nil)
	insertProductVariants(ctx, tx, newProductID, sourceProductID, item.Variants, item.TotalStock)
	insertProductImages(ctx, tx, newProductID, item.Images)
	return newProductID, newSlug, customSKU, nil
}

func upsertSingleImportedRow(
	ctx context.Context,
	sess excelImportSession,
	rowIdx int,
	row []string,
) (slug string, auditRef productAuditItemRef, alertItem *NewProductAlertItem, updated bool, err error) {
	item, parseErr := parseImportedSpreadsheetRow(ctx, sess, rowIdx, row)
	if parseErr != nil {
		return "", productAuditItemRef{}, nil, false, parseErr
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return "", productAuditItemRef{}, nil, false, fmt.Errorf("Satır %d: Veritabanı işlemi başlatılamadı", rowIdx)
	}
	defer tx.Rollback(ctx)

	var existingID, existingSlug string
	if item.SupplierSKU != "" {
		lookupErr := tx.QueryRow(ctx, `
			SELECT id::text, COALESCE(slug, '')
			FROM catalog.products
			WHERE brand_id = $1
			  AND UPPER(BTRIM(sku)) = UPPER($2)
			  AND COALESCE(is_archived, false) = false
			ORDER BY (feed_id IS NULL) DESC, created_at ASC
			LIMIT 1
		`, sess.BrandID, item.SupplierSKU).Scan(&existingID, &existingSlug)
		if lookupErr != nil && !errors.Is(lookupErr, pgx.ErrNoRows) {
			return "", productAuditItemRef{}, nil, false, fmt.Errorf("Satır %d (%s): Ürün kodu kontrol hatası", rowIdx, item.Title)
		}
	}

	if existingID != "" {
		updatedSlug, updatedSKU, updErr := updateExistingImportedProductTx(ctx, tx, existingID, item)
		if updErr != nil {
			return "", productAuditItemRef{}, nil, false, updErr
		}
		if auditErr := stampProductUpdatedAuditTx(ctx, tx, existingID, sess.AuditActor); auditErr != nil {
			return "", productAuditItemRef{}, nil, false, fmt.Errorf("Satır %d: Denetim kaydı hatası", rowIdx)
		}
		if commitErr := tx.Commit(ctx); commitErr != nil {
			return "", productAuditItemRef{}, nil, false, fmt.Errorf("Satır %d: Onay hatası", rowIdx)
		}
		return updatedSlug, productAuditItemRef{
			ProductID: existingID,
			Title:     item.Title,
			CustomSKU: firstNonEmptyAuditStr(updatedSKU, item.SupplierSKU),
		}, nil, true, nil
	}

	newID, newSlug, newCustomSKU, insErr := insertNewImportedProductTx(ctx, tx, item)
	if insErr != nil {
		return "", productAuditItemRef{}, nil, false, insErr
	}
	if auditErr := stampProductsCreatedAuditTx(ctx, tx, []string{newID}, sess.AuditActor); auditErr != nil {
		return "", productAuditItemRef{}, nil, false, fmt.Errorf("Satır %d: Denetim kaydı hatası", rowIdx)
	}
	if commitErr := tx.Commit(ctx); commitErr != nil {
		return "", productAuditItemRef{}, nil, false, fmt.Errorf("Satır %d: Onay hatası", rowIdx)
	}
	firstImg := ""
	if len(item.Images) > 0 {
		firstImg = item.Images[0]
	}
	return newSlug, productAuditItemRef{
			ProductID: newID,
			Title:     item.Title,
			CustomSKU: firstNonEmptyAuditStr(newCustomSKU, item.SupplierSKU),
		}, &NewProductAlertItem{
			ID:       newID,
			Slug:     newSlug,
			Title:    item.Title,
			ImageURL: firstImg,
		}, false, nil
}

func buildExcelImportSummaryMessage(importedCount, updatedCount int) string {
	switch {
	case importedCount > 0 && updatedCount > 0:
		return fmt.Sprintf("%d yeni ürün eklendi, %d mevcut ürün model kodu eşleşmesiyle güncellendi.", importedCount, updatedCount)
	case updatedCount > 0:
		return fmt.Sprintf("%d mevcut ürün model kodu eşleşmesiyle güncellendi.", updatedCount)
	default:
		return fmt.Sprintf("%d ürün başarıyla kataloğunuza eklendi.", importedCount)
	}
}

type excelImportBatchResult struct {
	ImportedCount     int
	UpdatedCount      int
	SkippedCount      int
	RowErrors         []string
	AffectedSlugs     []string
	NewAlertItems     []NewProductAlertItem
	CreatedAuditItems []productAuditItemRef
	UpdatedAuditItems []productAuditItemRef
}

func appendCappedRowError(rowErrors []string, msg string) []string {
	if len(rowErrors) >= 15 {
		return rowErrors
	}
	return append(rowErrors, msg)
}

func recordExcelRowUpsertResult(
	res *excelImportBatchResult,
	slug string,
	auditRef productAuditItemRef,
	alertItem *NewProductAlertItem,
	wasUpdated bool,
) {
	if wasUpdated {
		res.UpdatedCount++
		res.UpdatedAuditItems = append(res.UpdatedAuditItems, auditRef)
	} else {
		res.ImportedCount++
		res.CreatedAuditItems = append(res.CreatedAuditItems, auditRef)
		if alertItem != nil {
			res.NewAlertItems = append(res.NewAlertItems, *alertItem)
		}
	}
	if strings.TrimSpace(slug) != "" {
		res.AffectedSlugs = append(res.AffectedSlugs, slug)
	}
}

func processExcelImportRows(ctx context.Context, sess excelImportSession, rows [][]string) excelImportBatchResult {
	res := excelImportBatchResult{
		RowErrors:         make([]string, 0),
		AffectedSlugs:     make([]string, 0),
		NewAlertItems:     make([]NewProductAlertItem, 0),
		CreatedAuditItems: make([]productAuditItemRef, 0),
		UpdatedAuditItems: make([]productAuditItemRef, 0),
	}
	seenSKUs := make(map[string]int)

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) == 0 || cellAt(row, 0) == "" {
			continue
		}
		normSKU := strings.ToUpper(normalizeSupplierSKU(cellAt(row, sess.SKUColIdx)))
		if firstRow, dup := seenSKUs[normSKU]; normSKU != "" && dup {
			res.SkippedCount++
			res.RowErrors = appendCappedRowError(
				res.RowErrors,
				fmt.Sprintf("Satır %d: Aynı dosya içinde mükerrer ürün kodu (%s) — ilk olarak satır %d işlendi", i+1, normSKU, firstRow),
			)
			continue
		}
		if normSKU != "" {
			seenSKUs[normSKU] = i + 1
		}

		slug, auditRef, alertItem, wasUpdated, err := upsertSingleImportedRow(ctx, sess, i+1, row)
		if err != nil {
			res.SkippedCount++
			res.RowErrors = appendCappedRowError(res.RowErrors, err.Error())
			continue
		}
		recordExcelRowUpsertResult(&res, slug, auditRef, alertItem, wasUpdated)
	}
	return res
}

func finalizeExcelImportSideEffects(
	h *SupplierPortalHandler,
	r *http.Request,
	claims *middleware.SupplierClaims,
	filename string,
	auditActor ProductAuditActor,
	res excelImportBatchResult,
) {
	if len(res.CreatedAuditItems) > 0 {
		recordProductAuditLogsAsync(r, claims.BrandID, claims.BrandName, "excel_import", res.CreatedAuditItems, auditActor, map[string]any{
			"filename": filename,
			"mode":     "create",
		})
	}
	if len(res.UpdatedAuditItems) > 0 {
		recordProductAuditLogsAsync(r, claims.BrandID, claims.BrandName, "update", res.UpdatedAuditItems, auditActor, map[string]any{
			"filename": filename,
			"source":   "excel_import",
		})
	}

	totalChanged := res.ImportedCount + res.UpdatedCount
	if len(res.AffectedSlugs) > 0 {
		triggerProductMVRefreshAndIndexNow(res.AffectedSlugs, IndexNowSubmissionMeta{
			TriggerSource: "supplier_excel",
			SourceLabel:   fmt.Sprintf("Tedarikçi Excel Aktarımı (%d yeni, %d güncellenen)", res.ImportedCount, res.UpdatedCount),
			ProductCount:  len(res.AffectedSlugs),
		})
	} else if totalChanged > 0 {
		triggerProductMVRefresh()
	}
	if len(res.NewAlertItems) > 0 {
		NotifyFavoriteSupplierFollowersAsync(h.Cfg, h.Notifier, claims.BrandID, res.NewAlertItems)
	}

	if totalChanged > 0 && strings.TrimSpace(r.FormValue("content_responsibility_accepted")) != "" {
		recordLegalConsentAsync(legalConsentLogEntry{
			ConsentType:  "supplier_excel_import",
			PolicyType:   "supplier_agreement",
			ActorRole:    "supplier",
			ActorUserID:  claims.UserID,
			BrandID:      claims.BrandID,
			EntityType:   "brand",
			EntityID:     claims.BrandID,
			Email:        claims.Email,
			IPAddress:    getClientIP(r),
			UserAgent:    r.UserAgent(),
			AcceptedText: supplierContentDeclarationMsg,
			Metadata:     map[string]any{"imported_count": res.ImportedCount, "updated_count": res.UpdatedCount},
		})
	}
}

// ImportProductsFromExcel handles POST /api/v1/supplier/products/import-excel
func (h *SupplierPortalHandler) ImportProductsFromExcel(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(15 << 20); err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Dosya boyutu çok büyük (Maksimum 15MB)"})
		return
	}

	declAccepted, declErr := validateSupplierMultipartContentDeclaration(r)
	if declErr != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": declErr.Error()})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Yüklenecek Excel (.xlsx) veya CSV dosyası seçilmedi"})
		return
	}
	defer file.Close()

	rows, err := parseSpreadsheetRows(file, header.Filename)
	if err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if len(rows) <= 1 {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Dosyada içe aktarılacak ürün satırı bulunamadı"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	ensureProductArchiveSchema(ctx)
	ensureSupplierSkuUniqueIndex(ctx)
	_ = EnsureSupplierAuditSchema(ctx)

	auditActor := resolveSupplierAuditActor(claims)
	sess := excelImportSession{
		BrandID:         claims.BrandID,
		SKUColIdx:       detectSupplierSKUColumn(rows[0]),
		Cats:            loadCategoryLookupMap(ctx),
		ContentAccepted: declAccepted,
		ContentVersion:  resolveActivePolicyVersion(ctx, "supplier_agreement"),
		AuditActor:      auditActor,
	}

	res := processExcelImportRows(ctx, sess, rows)
	finalizeExcelImportSideEffects(h, r, claims, header.Filename, auditActor, res)

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"imported_count": res.ImportedCount,
		"updated_count":  res.UpdatedCount,
		"skipped_count":  res.SkippedCount,
		"errors":         res.RowErrors,
		"message":        buildExcelImportSummaryMessage(res.ImportedCount, res.UpdatedCount),
	})
}

