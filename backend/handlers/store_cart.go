package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	_ "image/jpeg"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
	golangDraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
	"mertervitrini/backend/db"
)

const (
	fontFamilySegoeUI = "Segoe UI"
	colorBorderSlate  = "#cbd5e1"
	colorBorderHeader = "#94a3b8"
	colorBgTotalRow   = "#F8FAFC"
	colorTextTotalRow = "#0F172A"
)

type CartHandler struct{}

func NewCartHandler() *CartHandler {
	return &CartHandler{}
}

type AddToCartRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"` // total units/pieces
}

type UpdateCartItemRequest struct {
	Quantity int `json:"quantity"` // total units/pieces
}

type CartResponseItem struct {
	ID               string            `json:"id"`
	ProductID        string            `json:"product_id"`
	Title            string            `json:"title"`
	CustomSku        string            `json:"custom_sku"`
	Color            string            `json:"color"`
	PackagesQty      int               `json:"packages_qty"`
	UnitsPerPackage  int               `json:"units_per_package"`
	PricePerUnit     float64           `json:"price_per_unit"`
	WeightPerUnit    float64           `json:"weight_per_unit"`
	ImageUrl         string            `json:"image_url"`
	Currency         string            `json:"currency"`
	TitleTranslations map[string]string `json:"title_translations"`
	Slug             string            `json:"slug"`
}

func mapCartRowToItem(rows pgx.Rows) (CartResponseItem, error) {
	var item CartResponseItem
	var seriesRatio *string
	var price float64
	var discountedPrice *float64
	var shippingWeight *float64
	var quantity int
	var transBytes []byte

	err := rows.Scan(
		&item.ID, &item.ProductID, &item.Title, &item.CustomSku, &item.Color,
		&seriesRatio, &price, &discountedPrice, &item.Currency, &shippingWeight,
		&quantity, &item.ImageUrl, &transBytes, &item.Slug,
	)
	if err != nil {
		return item, err
	}

	ratioStr := ""
	if seriesRatio != nil {
		ratioStr = *seriesRatio
	}
	unitsPerPkg := getUnitsFromSeriesRatio(ratioStr)

	packagesQty := quantity / unitsPerPkg
	if packagesQty <= 0 {
		packagesQty = 1
	}

	item.UnitsPerPackage = unitsPerPkg
	item.PackagesQty = packagesQty

	item.PricePerUnit = price
	if discountedPrice != nil && *discountedPrice > 0 && *discountedPrice < price {
		item.PricePerUnit = *discountedPrice
	}

	item.WeightPerUnit = 0.35
	if shippingWeight != nil {
		item.WeightPerUnit = *shippingWeight
	}

	item.TitleTranslations = make(map[string]string)
	if len(transBytes) > 0 {
		_ = json.Unmarshal(transBytes, &item.TitleTranslations)
	}

	return item, nil
}

// FetchCartItemsByUserID retrieves all active cart items for the specified customer ID.
func FetchCartItemsByUserID(ctx context.Context, userID string) ([]CartResponseItem, error) {
	query := `
		SELECT ci.id, ci.product_id, p.title, p.custom_sku, COALESCE(col.color_name, 'Standart') as color,
		       p.series_ratio, p.price, COALESCE(ci.custom_unit_price, p.discounted_price) as discounted_price, p.currency, p.shipping_weight_kg,
		       ci.quantity,
		       COALESCE(
		           (SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1),
		           '/placeholder.png'
		       ) as image_url,
		       COALESCE(
		           (SELECT json_object_agg(t.language_code, t.title)
		            FROM catalog.product_translations t
		            WHERE t.product_id = p.id), '{}'::json
		       ) as translations_json,
		       p.slug
		FROM catalog.cart_items ci
		INNER JOIN catalog.carts c ON ci.cart_id = c.id
		INNER JOIN catalog.products p ON ci.product_id = p.id
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE c.user_id = $1 AND p.deleted_at IS NULL
		ORDER BY ci.created_at ASC
	`
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []CartResponseItem{}
	for rows.Next() {
		item, errScan := mapCartRowToItem(rows)
		if errScan != nil {
			log.Printf("[STORE CART ERROR] Failed to scan cart row: %v", errScan)
			continue
		}
		items = append(items, item)
	}
	return items, nil
}

// GetCart retrieves all cart items for the currently logged-in user
func (h *CartHandler) GetCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	items, err := FetchCartItemsByUserID(r.Context(), userID)
	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to query cart: %v", err)
		http.Error(w, `{"error":"Sepet yüklenemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(items)
}

func (h *CartHandler) AddToCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req AddToCartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.ProductID == "" || req.Quantity <= 0 {
		http.Error(w, `{"error":"ProductID and valid quantity are required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Use transaction
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to start tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Ensure cart exists
	var cartID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.carts (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING id
	`, userID).Scan(&cartID)
	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to get/create cart: %v", err)
		http.Error(w, `{"error":"Sepet oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	// Insert or update cart item atomically via idx_cart_items_cart_product_uq
	_, err = tx.Exec(ctx, `
		INSERT INTO catalog.cart_items (cart_id, product_id, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = catalog.cart_items.quantity + EXCLUDED.quantity
	`, cartID, req.ProductID, req.Quantity)

	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to add item to cart: %v", err)
		http.Error(w, `{"error":"Ürün sepete eklenemedi"}`, http.StatusInternalServerError)
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to commit tx: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true}`))
}

func (h *CartHandler) UpdateCartItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	itemID := r.PathValue("item_id")
	if itemID == "" {
		http.Error(w, `{"error":"Item ID is required"}`, http.StatusBadRequest)
		return
	}

	var req UpdateCartItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.Quantity <= 0 {
		http.Error(w, `{"error":"Valid quantity is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Update item only if it belongs to user's cart; reset negotiated custom_unit_price if quantity is reduced
	res, err := db.Pool.Exec(ctx, `
		UPDATE catalog.cart_items
		SET custom_unit_price = CASE WHEN custom_unit_price IS NOT NULL AND $1 < quantity THEN NULL ELSE custom_unit_price END,
		    offer_message_id   = CASE WHEN custom_unit_price IS NOT NULL AND $1 < quantity THEN NULL ELSE offer_message_id END,
		    quantity          = $1
		WHERE id = $2 AND cart_id IN (SELECT id FROM catalog.carts WHERE user_id = $3)
	`, req.Quantity, itemID, userID)

	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to update item: %v", err)
		http.Error(w, `{"error":"Sepet güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	if res.RowsAffected() == 0 {
		http.Error(w, `{"error":"Sepet kalemi bulunamadı"}`, http.StatusNotFound)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true}`))
}

func (h *CartHandler) DeleteCartItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	itemID := r.PathValue("item_id")
	if itemID == "" {
		http.Error(w, `{"error":"Item ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Delete item only if it belongs to user's cart
	res, err := db.Pool.Exec(ctx, `
		DELETE FROM catalog.cart_items
		WHERE id = $1 AND cart_id IN (SELECT id FROM catalog.carts WHERE user_id = $2)
	`, itemID, userID)

	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to delete item: %v", err)
		http.Error(w, `{"error":"Ürün sepetten silinemedi"}`, http.StatusInternalServerError)
		return
	}

	if res.RowsAffected() == 0 {
		http.Error(w, `{"error":"Sepet kalemi bulunamadı"}`, http.StatusNotFound)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true}`))
}

func (h *CartHandler) ClearCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	_, err = db.Pool.Exec(ctx, `
		DELETE FROM catalog.cart_items
		WHERE cart_id IN (SELECT id FROM catalog.carts WHERE user_id = $1)
	`, userID)

	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to clear cart: %v", err)
		http.Error(w, `{"error":"Sepet temizlenemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true}`))
}

// getUnitsFromSeriesRatio sums the parts of series_ratio e.g. 1-2-2-1 -> 6
func getUnitsFromSeriesRatio(seriesRatio string) int {
	if seriesRatio == "" {
		return 1
	}
	parts := strings.FieldsFunc(seriesRatio, func(c rune) bool {
		return c == '-' || c == ',' || c == ' '
	})
	total := 0
	for _, p := range parts {
		var val int
		// simple string conversion manually to avoid strconv import cycle or complexity
		for i := 0; i < len(p); i++ {
			if p[i] >= '0' && p[i] <= '9' {
				val = val*10 + int(p[i]-'0')
			}
		}
		if val > 0 {
			total += val
		}
	}
	if total > 0 {
		return total
	}
	return 1
}

type SyncCartRequestItem struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type SyncCartRequest struct {
	Items []SyncCartRequestItem `json:"items"`
}

func (h *CartHandler) SyncCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req SyncCartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Use database transaction to cleanly sync items
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[STORE CART ERROR] Sync fail begin tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Ensure cart exists manually to avoid constraint assumptions
	var cartID string
	var existingCartID string
	errFind := tx.QueryRow(ctx, "SELECT id FROM catalog.carts WHERE user_id = $1", userID).Scan(&existingCartID)
	switch errFind {
	case pgx.ErrNoRows:
		err = tx.QueryRow(ctx, "INSERT INTO catalog.carts (user_id) VALUES ($1) RETURNING id", userID).Scan(&cartID)
	case nil:
		cartID = existingCartID
		_, err = tx.Exec(ctx, "UPDATE catalog.carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", cartID)
	default:
		err = errFind
	}

	if err != nil {
		log.Printf("[STORE CART ERROR] Sync fail get/create cart: %v", err)
		http.Error(w, `{"error":"Sepet bulunamadı veya oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	if err := syncCartItemsPreservingOffers(ctx, tx, cartID, req.Items); err != nil {
		log.Printf("[STORE CART ERROR] Sync fail upsert items: %v", err)
		http.Error(w, `{"error":"Sepet güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[STORE CART ERROR] Sync fail commit tx: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true}`))
}

func deduplicateSyncCartItems(items []SyncCartRequestItem) ([]SyncCartRequestItem, []string) {
	qtyByProduct := make(map[string]int, len(items))
	orderedIDs := make([]string, 0, len(items))
	for _, item := range items {
		pid := strings.TrimSpace(item.ProductID)
		if pid == "" || item.Quantity <= 0 {
			continue
		}
		if _, exists := qtyByProduct[pid]; !exists {
			orderedIDs = append(orderedIDs, pid)
		}
		qtyByProduct[pid] += item.Quantity
	}
	deduped := make([]SyncCartRequestItem, 0, len(orderedIDs))
	for _, pid := range orderedIDs {
		deduped = append(deduped, SyncCartRequestItem{
			ProductID: pid,
			Quantity:  qtyByProduct[pid],
		})
	}
	return deduped, orderedIDs
}

func syncCartItemsPreservingOffers(ctx context.Context, tx pgx.Tx, cartID string, items []SyncCartRequestItem) error {
	deduped, keepIDs := deduplicateSyncCartItems(items)
	if len(keepIDs) == 0 {
		_, err := tx.Exec(ctx, "DELETE FROM catalog.cart_items WHERE cart_id = $1", cartID)
		return err
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM catalog.cart_items
		WHERE cart_id = $1 AND NOT (product_id::text = ANY($2))
	`, cartID, keepIDs); err != nil {
		return err
	}

	for _, item := range deduped {
		if _, err := tx.Exec(ctx, `
			INSERT INTO catalog.cart_items (cart_id, product_id, quantity)
			VALUES ($1, $2, $3)
			ON CONFLICT (cart_id, product_id) DO UPDATE SET
				custom_unit_price = CASE
					WHEN catalog.cart_items.custom_unit_price IS NOT NULL AND EXCLUDED.quantity < catalog.cart_items.quantity THEN NULL
					ELSE catalog.cart_items.custom_unit_price
				END,
				offer_message_id = CASE
					WHEN catalog.cart_items.custom_unit_price IS NOT NULL AND EXCLUDED.quantity < catalog.cart_items.quantity THEN NULL
					ELSE catalog.cart_items.offer_message_id
				END,
				quantity = EXCLUDED.quantity
		`, cartID, item.ProductID, item.Quantity); err != nil {
			return err
		}
	}
	return nil
}

// --- Cart Excel Export ---

type CartExchangeRate struct {
	CurrencyCode string
	BuyingRate   float64
}

type ExportCartExcelRequestItem struct {
	ProductID         string            `json:"product_id"`
	Title             string            `json:"title"`
	CustomSku         string            `json:"custom_sku"`
	Color             string            `json:"color"`
	PackagesQty       int               `json:"packages_qty"`
	UnitsPerPackage   int               `json:"units_per_package"`
	PricePerUnit      float64           `json:"price_per_unit"`
	WeightPerUnit     float64           `json:"weight_per_unit"`
	ImageUrl          string            `json:"image_url"`
	Currency          string            `json:"currency"`
	Slug              string            `json:"slug"`
	TitleTranslations map[string]string `json:"title_translations"`
}

type ExportCartExcelRequest struct {
	Lang            string                        `json:"lang"`
	DisplayCurrency string                        `json:"display_currency"`
	Items           []ExportCartExcelRequestItem `json:"items"`
}

func findExchangeRate(currency string, rates []CartExchangeRate) float64 {
	for _, r := range rates {
		if strings.ToUpper(r.CurrencyCode) == currency {
			return r.BuyingRate
		}
	}
	return 0
}

func convertPriceGo(price float64, baseCurrency string, targetCurrency string, rates []CartExchangeRate) float64 {
	base := strings.ToUpper(baseCurrency)
	if base == "" {
		base = "TRY"
	}
	target := strings.ToUpper(targetCurrency)
	if target == "" {
		target = "TRY"
	}
	if base == target {
		return price
	}

	// Convert base to TRY
	priceInTRY := price
	if base != "TRY" && base != "TL" {
		if baseRate := findExchangeRate(base, rates); baseRate > 0 {
			priceInTRY = price * baseRate
		}
	}

	// Convert TRY to target
	if target == "TRY" || target == "TL" {
		return priceInTRY
	}

	if targetRate := findExchangeRate(target, rates); targetRate > 0 {
		return priceInTRY / targetRate
	}

	return price
}

func resizeToPNGBytes(imgPath string, maxW, maxH int) ([]byte, int, int, error) {
	file, err := os.Open(imgPath)
	if err != nil {
		return nil, 0, 0, err
	}
	defer file.Close()

	srcImg, _, err := image.Decode(file)
	if err != nil {
		return nil, 0, 0, err
	}

	bounds := srcImg.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	scale := 1.0
	if w > maxW || h > maxH {
		scaleW := float64(maxW) / float64(w)
		scaleH := float64(maxH) / float64(h)
		if scaleW < scaleH {
			scale = scaleW
		} else {
			scale = scaleH
		}
	}

	newW := int(float64(w) * scale)
	newH := int(float64(h) * scale)
	if newW <= 0 {
		newW = 1
	}
	if newH <= 0 {
		newH = 1
	}

	dstImg := image.NewRGBA(image.Rect(0, 0, newW, newH))
	golangDraw.CatmullRom.Scale(dstImg, dstImg.Bounds(), srcImg, srcImg.Bounds(), golangDraw.Over, nil)

	var buf bytes.Buffer
	err = png.Encode(&buf, dstImg)
	if err != nil {
		return nil, 0, 0, err
	}

	return buf.Bytes(), newW, newH, nil
}

type CartExcelStyles struct {
	HeaderStyle     int
	TextStyle       int
	CenterStyle     int
	IntStyle        int
	FloatStyle      int
	TotalTextStyle  int
	TotalIntStyle   int
	TotalFloatStyle int
	LinkStyle       int
}

func initCartExcelStyles(f *excelize.File) CartExcelStyles {
	borderSlate := []excelize.Border{
		{Type: "left", Color: colorBorderSlate, Style: 1},
		{Type: "right", Color: colorBorderSlate, Style: 1},
		{Type: "top", Color: colorBorderSlate, Style: 1},
		{Type: "bottom", Color: colorBorderSlate, Style: 1},
	}
	borderTotal := []excelize.Border{
		{Type: "left", Color: colorBorderHeader, Style: 1},
		{Type: "right", Color: colorBorderHeader, Style: 1},
		{Type: "top", Color: colorBorderHeader, Style: 2},
		{Type: "bottom", Color: colorBorderHeader, Style: 2},
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"#1E293B"}, Pattern: 1},
		Font:      &excelize.Font{Bold: true, Size: 10, Color: "#FFFFFF", Family: fontFamilySegoeUI},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border:    borderSlate,
	})

	textStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Family: fontFamilySegoeUI},
		Alignment: &excelize.Alignment{Vertical: "center"},
		Border:    borderSlate,
	})

	centerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Family: fontFamilySegoeUI},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border:    borderSlate,
	})

	numFmtInt := "#,##0"
	intStyle, _ := f.NewStyle(&excelize.Style{
		Font:         &excelize.Font{Size: 10, Family: fontFamilySegoeUI},
		Alignment:    &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		CustomNumFmt: &numFmtInt,
		Border:       borderSlate,
	})

	numFmtFloat := "#,##0.00"
	floatStyle, _ := f.NewStyle(&excelize.Style{
		Font:         &excelize.Font{Size: 10, Family: fontFamilySegoeUI},
		Alignment:    &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		CustomNumFmt: &numFmtFloat,
		Border:       borderSlate,
	})

	totalTextStyle, _ := f.NewStyle(&excelize.Style{
		Fill:      excelize.Fill{Type: "pattern", Color: []string{colorBgTotalRow}, Pattern: 1},
		Font:      &excelize.Font{Bold: true, Size: 10, Color: colorTextTotalRow, Family: fontFamilySegoeUI},
		Alignment: &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		Border:    borderTotal,
	})

	totalIntStyle, _ := f.NewStyle(&excelize.Style{
		Fill:         excelize.Fill{Type: "pattern", Color: []string{colorBgTotalRow}, Pattern: 1},
		Font:         &excelize.Font{Bold: true, Size: 10, Color: colorTextTotalRow, Family: fontFamilySegoeUI},
		Alignment:    &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		CustomNumFmt: &numFmtInt,
		Border:       borderTotal,
	})

	totalFloatStyle, _ := f.NewStyle(&excelize.Style{
		Fill:         excelize.Fill{Type: "pattern", Color: []string{colorBgTotalRow}, Pattern: 1},
		Font:         &excelize.Font{Bold: true, Size: 10, Color: colorTextTotalRow, Family: fontFamilySegoeUI},
		Alignment:    &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		CustomNumFmt: &numFmtFloat,
		Border:       borderTotal,
	})

	linkStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Color: "#0284C7", Underline: "single", Family: fontFamilySegoeUI},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border:    borderSlate,
	})

	return CartExcelStyles{
		HeaderStyle:     headerStyle,
		TextStyle:       textStyle,
		CenterStyle:     centerStyle,
		IntStyle:        intStyle,
		FloatStyle:      floatStyle,
		TotalTextStyle:  totalTextStyle,
		TotalIntStyle:   totalIntStyle,
		TotalFloatStyle: totalFloatStyle,
		LinkStyle:       linkStyle,
	}
}

func setupCartExcelSheet(f *excelize.File, sheetName string, headerStyle int) {
	widths := map[string]float64{
		"A": 18, "B": 45, "C": 18, "D": 15, "E": 12,
		"F": 12, "G": 16, "H": 18, "I": 12, "J": 22,
	}
	for col, w := range widths {
		f.SetColWidth(sheetName, col, col, w)
	}

	f.SetRowHeight(sheetName, 1, 35)

	headers := []string{
		"Ürün Resmi / Product Image",
		"Ürün Açıklaması / Product Description",
		"SKU / Kod / SKU / Code",
		"Renk / Color",
		"Paket / Packages",
		"Adet / Pieces",
		"Birim Fiyat / Unit Price",
		"Toplam / Total",
		"Para Birimi / Currency",
		"Ürün Linki / Product Link",
	}

	for i, hText := range headers {
		colName, _ := excelize.ColumnNumberToName(i + 1)
		cell := colName + "1"
		f.SetCellValue(sheetName, cell, hText)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	f.AutoFilter(sheetName, "A1:J1", nil)
}

func fetchCartExchangeRates(ctx context.Context) []CartExchangeRate {
	var rates []CartExchangeRate
	rateRows, err := db.Pool.Query(ctx, "SELECT currency_code, buying_rate FROM catalog.exchange_rates")
	if err != nil {
		return rates
	}
	defer rateRows.Close()

	for rateRows.Next() {
		var rt CartExchangeRate
		if errScan := rateRows.Scan(&rt.CurrencyCode, &rt.BuyingRate); errScan == nil {
			rates = append(rates, rt)
		}
	}
	return rates
}

func embedCartItemImage(f *excelize.File, sheetName string, rNum int, imageURL, mediaDir string) {
	if !strings.HasPrefix(imageURL, uploadsPrefix) {
		return
	}
	rel := strings.TrimPrefix(imageURL, uploadsPrefix)
	imgPath := filepath.Join(mediaDir, rel)
	if _, errStat := os.Stat(imgPath); errStat != nil {
		return
	}

	imageBytes, newW, newH, errResize := resizeToPNGBytes(imgPath, 105, 110)
	if errResize != nil || imageBytes == nil {
		return
	}

	cell := fmt.Sprintf("A%d", rNum)
	offsetX := (144 - newW) / 2
	offsetY := (113 - newH) / 2
	if offsetX < 0 {
		offsetX = 0
	}
	if offsetY < 0 {
		offsetY = 0
	}

	_ = f.AddPictureFromBytes(sheetName, cell, &excelize.Picture{
		Extension: ".png",
		File:      imageBytes,
		Format: &excelize.GraphicOptions{
			OffsetX:     offsetX,
			OffsetY:     offsetY,
			Positioning: "oneCell",
		},
	})
}

type CartExcelRowWriter struct {
	File      *excelize.File
	SheetName string
	Req       ExportCartExcelRequest
	Rates     []CartExchangeRate
	Styles    CartExcelStyles
	MediaDir  string
}

func (w *CartExcelRowWriter) WriteRow(rNum int, item ExportCartExcelRequestItem) {
	titleText := item.Title
	if item.TitleTranslations != nil && item.TitleTranslations[w.Req.Lang] != "" {
		titleText = item.TitleTranslations[w.Req.Lang]
	}

	currency := w.Req.DisplayCurrency
	if currency == "" {
		currency = "TRY"
	}
	var pricePerUnit float64

	if w.Req.DisplayCurrency != "" && len(w.Rates) > 0 {
		pricePerUnit = convertPriceGo(item.PricePerUnit, item.Currency, w.Req.DisplayCurrency, w.Rates)
	} else {
		pricePerUnit = item.PricePerUnit
		if item.Currency != "" {
			currency = item.Currency
		}
	}

	// Write standard values
	w.File.SetCellValue(w.SheetName, fmt.Sprintf("B%d", rNum), titleText)
	w.File.SetCellValue(w.SheetName, fmt.Sprintf("C%d", rNum), item.CustomSku)
	w.File.SetCellValue(w.SheetName, fmt.Sprintf("D%d", rNum), item.Color)
	w.File.SetCellValue(w.SheetName, fmt.Sprintf("E%d", rNum), item.PackagesQty)

	// Formulas
	w.File.SetCellFormula(w.SheetName, fmt.Sprintf("F%d", rNum), fmt.Sprintf("=E%d*%d", rNum, item.UnitsPerPackage))
	w.File.SetCellValue(w.SheetName, fmt.Sprintf("G%d", rNum), pricePerUnit)
	w.File.SetCellFormula(w.SheetName, fmt.Sprintf("H%d", rNum), fmt.Sprintf("=F%d*G%d", rNum, rNum))
	w.File.SetCellValue(w.SheetName, fmt.Sprintf("I%d", rNum), currency)

	// Links
	openText := "Open Product"
	if w.Req.Lang == "tr" {
		openText = "Ürünü Aç"
	}
	targetID := item.Slug
	if targetID == "" {
		targetID = item.ProductID
	}
	absoluteURL := fmt.Sprintf("%s/product/%s/", siteBaseURL, targetID)
	w.File.SetCellHyperLink(w.SheetName, fmt.Sprintf("J%d", rNum), absoluteURL, "External")
	w.File.SetCellValue(w.SheetName, fmt.Sprintf("J%d", rNum), openText)

	// Apply cell styles
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("A%d", rNum), fmt.Sprintf("A%d", rNum), w.Styles.CenterStyle)
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("B%d", rNum), fmt.Sprintf("B%d", rNum), w.Styles.TextStyle)
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("C%d", rNum), fmt.Sprintf("C%d", rNum), w.Styles.CenterStyle)
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("D%d", rNum), fmt.Sprintf("D%d", rNum), w.Styles.CenterStyle)
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("E%d", rNum), fmt.Sprintf("E%d", rNum), w.Styles.IntStyle)
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("F%d", rNum), fmt.Sprintf("F%d", rNum), w.Styles.IntStyle)
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("G%d", rNum), fmt.Sprintf("G%d", rNum), w.Styles.FloatStyle)
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("H%d", rNum), fmt.Sprintf("H%d", rNum), w.Styles.FloatStyle)
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("I%d", rNum), fmt.Sprintf("I%d", rNum), w.Styles.CenterStyle)
	w.File.SetCellStyle(w.SheetName, fmt.Sprintf("J%d", rNum), fmt.Sprintf("J%d", rNum), w.Styles.LinkStyle)

	embedCartItemImage(w.File, w.SheetName, rNum, item.ImageUrl, w.MediaDir)
}

func writeCartExcelGrandTotal(f *excelize.File, sheetName string, grandTotalRow, maxRows int, lang string, styles CartExcelStyles) {
	f.SetRowHeight(sheetName, grandTotalRow, 30)

	totalLabel := "Grand Total / Genel Toplam:"
	if lang == "tr" {
		totalLabel = "Genel Toplam / Grand Total:"
	}
	f.MergeCell(sheetName, fmt.Sprintf("A%d", grandTotalRow), fmt.Sprintf("D%d", grandTotalRow))
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", grandTotalRow), totalLabel)

	f.SetCellFormula(sheetName, fmt.Sprintf("E%d", grandTotalRow), fmt.Sprintf("=SUM(E2:E%d)", maxRows+1))
	f.SetCellFormula(sheetName, fmt.Sprintf("F%d", grandTotalRow), fmt.Sprintf("=SUM(F2:F%d)", maxRows+1))
	f.SetCellFormula(sheetName, fmt.Sprintf("H%d", grandTotalRow), fmt.Sprintf("=SUM(H2:H%d)", maxRows+1))

	// Apply Styles to Grand Total Row (Only A to J)
	f.SetCellStyle(sheetName, fmt.Sprintf("A%d", grandTotalRow), fmt.Sprintf("D%d", grandTotalRow), styles.TotalTextStyle)
	f.SetCellStyle(sheetName, fmt.Sprintf("E%d", grandTotalRow), fmt.Sprintf("E%d", grandTotalRow), styles.TotalIntStyle)
	f.SetCellStyle(sheetName, fmt.Sprintf("F%d", grandTotalRow), fmt.Sprintf("F%d", grandTotalRow), styles.TotalIntStyle)
	f.SetCellStyle(sheetName, fmt.Sprintf("G%d", grandTotalRow), fmt.Sprintf("G%d", grandTotalRow), styles.TotalTextStyle)
	f.SetCellStyle(sheetName, fmt.Sprintf("H%d", grandTotalRow), fmt.Sprintf("H%d", grandTotalRow), styles.TotalFloatStyle)
	f.SetCellStyle(sheetName, fmt.Sprintf("I%d", grandTotalRow), fmt.Sprintf("I%d", grandTotalRow), styles.TotalTextStyle)
	f.SetCellStyle(sheetName, fmt.Sprintf("J%d", grandTotalRow), fmt.Sprintf("J%d", grandTotalRow), styles.TotalTextStyle)
}

func (h *CartHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req ExportCartExcelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	rates := fetchCartExchangeRates(r.Context())

	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Sheet1"
	styles := initCartExcelStyles(f)
	setupCartExcelSheet(f, sheetName, styles.HeaderStyle)

	maxRows := len(req.Items)
	grandTotalRow := maxRows + 2
	mediaDir := getMediaDir()

	rowWriter := CartExcelRowWriter{
		File:      f,
		SheetName: sheetName,
		Req:       req,
		Rates:     rates,
		Styles:    styles,
		MediaDir:  mediaDir,
	}

	for idx := 0; idx < maxRows; idx++ {
		rNum := idx + 2
		f.SetRowHeight(sheetName, rNum, 85)
		rowWriter.WriteRow(rNum, req.Items[idx])
	}

	writeCartExcelGrandTotal(f, sheetName, grandTotalRow, maxRows, req.Lang, styles)

	w.Header().Set(headerContentType, mimeSpreadsheetML)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=sepet-%s.xlsx", time.Now().Format("2006-01-02")))

	if err := f.Write(w); err != nil {
		log.Printf("[STORE CART ERROR] Failed to write XLSX: %v", err)
	}
}

