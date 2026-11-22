package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

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
		token := strings.TrimSpace(p)
		if token == "" {
			continue
		}
		kv := strings.SplitN(token, ":", 2)
		size := strings.TrimSpace(kv[0])
		stock := 10
		if len(kv) == 2 {
			if parsed, err := strconv.Atoi(strings.TrimSpace(kv[1])); err == nil && parsed >= 0 {
				stock = parsed
			}
		}
		if size != "" {
			variants = append(variants, models.SupplierProductVariantInput{
				Size:  size,
				Stock: stock,
			})
			totalStock += stock
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

func insertSingleImportedRow(
	ctx context.Context,
	brandID string,
	rowIdx int,
	row []string,
	cats categoryLookupMap,
	contentAccepted bool,
	contentVersion int,
) (string, error) {
	title := cellAt(row, 0)
	catRaw := cellAt(row, 1)
	price := parsePriceValue(cellAt(row, 2))
	if title == "" || price <= 0 {
		return "", fmt.Errorf("Satır %d: Ürün başlığı ve geçerli satış fiyatı zorunludur", rowIdx)
	}

	catID := cats.resolve(catRaw)
	if catID == "" {
		return "", fmt.Errorf("Satır %d: Geçerli bir kategori bulunamadı", rowIdx)
	}

	currency := strings.ToUpper(cellAt(row, 3))
	if currency != "USD" && currency != "EUR" && currency != "TRY" {
		currency = "TRY"
	}
	packingRatio := cellAt(row, 4)
	seriesRatio := cellAt(row, 5)
	moq, _ := strconv.Atoi(cellAt(row, 6))
	if moq <= 0 {
		moq = 1
	}

	variants, totalStock := parseVariantsCell(cellAt(row, 7))
	colorID := resolveOrInsertColorID(ctx, cellAt(row, 8))
	fabricID := resolveOrInsertFabricID(ctx, cellAt(row, 9))
	season := cellAt(row, 10)
	gender := cellAt(row, 11)
	imagesRaw := cellAt(row, 12)
	shortDesc := cellAt(row, 13)
	desc := cellAt(row, 14)

	images := make([]string, 0)
	for _, part := range strings.Split(imagesRaw, ",") {
		u := strings.TrimSpace(part)
		if u != "" && !strings.HasSuffix(u, "/placeholder.png") {
			images = append(images, u)
		}
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("Satır %d: Veritabanı işlemi başlatılamadı", rowIdx)
	}
	defer tx.Rollback(ctx)

	sourceProductID := fmt.Sprintf("XLS-%d-%d", time.Now().UnixNano(), rowIdx)
	var newProductID, newSlug string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.products (
			brand_id, feed_id, source_product_id, title, short_description, description,
			category_id, color_id, fabric_id, gender, season,
			buying_price, price, currency, packing_ratio, series_ratio,
			minimum_order_quantity, stock, is_active,
			content_responsibility_accepted, content_responsibility_accepted_at, content_responsibility_version
		) VALUES (
			$1, NULL, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			0, $11, $12, $13, $14,
			$15, $16, true,
			$17, CASE WHEN $17 THEN CURRENT_TIMESTAMP ELSE NULL END, CASE WHEN $17 THEN $18::integer ELSE NULL::integer END
		) RETURNING id::text, coalesce(slug, '')
	`,
		brandID, sourceProductID, title, shortDesc, desc,
		catID, colorID, fabricID, gender, season,
		price, currency, packingRatio, seriesRatio,
		moq, totalStock, contentAccepted, contentVersion,
	).Scan(&newProductID, &newSlug)
	if err != nil {
		return "", fmt.Errorf("Satır %d (%s): Kayıt hatası", rowIdx, title)
	}

	upsertSupplierProductTranslations(ctx, tx, newProductID, title, shortDesc, desc, nil)
	insertProductVariants(ctx, tx, newProductID, sourceProductID, variants, totalStock)
	insertProductImages(ctx, tx, newProductID, images)

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return "", fmt.Errorf("Satır %d: Onay hatası", rowIdx)
	}
	return newSlug, nil
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
	cats := loadCategoryLookupMap(ctx)
	contentVer := resolveActivePolicyVersion(ctx, "supplier_agreement")

	importedCount := 0
	skippedCount := 0
	rowErrors := make([]string, 0)
	importedSlugs := make([]string, 0)

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) == 0 || cellAt(row, 0) == "" {
			continue
		}
		slug, err := insertSingleImportedRow(ctx, claims.BrandID, i+1, row, cats, declAccepted, contentVer)
		if err != nil {
			skippedCount++
			if len(rowErrors) < 15 {
				rowErrors = append(rowErrors, err.Error())
			}
			continue
		}
		importedCount++
		if strings.TrimSpace(slug) != "" {
			importedSlugs = append(importedSlugs, slug)
		}
	}

	if len(importedSlugs) > 0 {
		triggerProductMVRefreshAndIndexNow(importedSlugs, IndexNowSubmissionMeta{
			TriggerSource: "supplier_excel",
			SourceLabel:   fmt.Sprintf("Tedarikçi Excel Aktarımı (%d yeni ürün)", len(importedSlugs)),
			ProductCount:  len(importedSlugs),
		})
	} else if importedCount > 0 {
		triggerProductMVRefresh()
	}

	if importedCount > 0 && strings.TrimSpace(r.FormValue("content_responsibility_accepted")) != "" {
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
			Metadata:     map[string]any{"imported_count": importedCount},
		})
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"imported_count": importedCount,
		"skipped_count":  skippedCount,
		"errors":         rowErrors,
		"message":        fmt.Sprintf("%d ürün başarıyla kataloğunuza eklendi.", importedCount),
	})
}

