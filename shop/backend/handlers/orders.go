package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/shop/backend/db"
)

type OrdersHandler struct{}

func NewOrdersHandler() *OrdersHandler {
	return &OrdersHandler{}
}

type CreateOrderRequest struct {
	BillingAddress  string `json:"billing_address"`
	DeliveryAddress string `json:"delivery_address"`
	PaymentMethod   string `json:"payment_method"` // Defaults to "BANK_TRANSFER"
}

type PaymentNotificationRequest struct {
	BankName   string  `json:"bank_name"`
	SenderName string  `json:"sender_name"`
	Amount     float64 `json:"amount"`
	Notes      string  `json:"notes"`
}

type RefundRequestItem struct {
	OrderItemID string `json:"order_item_id"`
	Quantity    int    `json:"quantity"`
}

type RefundRequest struct {
	RefundType string              `json:"refund_type"` // "FULL" or "PARTIAL"
	Reason     string              `json:"reason"`
	Items      []RefundRequestItem `json:"items"`
}

type OrderItemResponse struct {
	ID                  string  `json:"id"`
	ProductID           string  `json:"product_id"`
	ProductName         string  `json:"product_name"`
	ProductSKU          string  `json:"product_sku"`
	Quantity            int     `json:"quantity"`
	PriceAtPurchase     float64 `json:"price_at_purchase"`
	ImageUrlAtPurchase  string  `json:"image_url_at_purchase"`
	CreatedAt           string  `json:"created_at"`
}

type OrderResponse struct {
	ID              string              `json:"id"`
	OrderNumber     string              `json:"order_number"`
	TotalAmount     float64             `json:"total_amount"`
	PaymentMethod   string              `json:"payment_method"`
	OrderStatus     string              `json:"order_status"`
	BillingAddress  string              `json:"billing_address"`
	DeliveryAddress string              `json:"delivery_address"`
	CreatedAt       string              `json:"created_at"`
	UpdatedAt       string              `json:"updated_at"`
	Items           []OrderItemResponse `json:"items"`
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

func getLocalImagePath(imgURL string) string {
	if imgURL == "" {
		return ""
	}
	
	// If it starts with a URL scheme, strip it to extract local paths
	if strings.HasPrefix(imgURL, "http://") || strings.HasPrefix(imgURL, "https://") {
		parts := strings.SplitN(imgURL, "/", 4)
		if len(parts) >= 4 {
			imgURL = "/" + parts[3]
		}
	}
	
	mediaDir := getMediaDir()
	
	// 1. Check if it references standard uploads path
	if strings.HasPrefix(imgURL, "/uploads/") {
		rel := strings.TrimPrefix(imgURL, "/uploads/")
		path := filepath.Join(mediaDir, rel)
		if fileExists(path) {
			return path
		}
	}
	
	// 2. Direct path checks
	if fileExists(imgURL) {
		return imgURL
	}
	
	// 3. Fallback for Windows local downloads in parsers directory
	if strings.HasPrefix(imgURL, "./downloads/") {
		rel := strings.TrimPrefix(imgURL, "./downloads/")
		path := filepath.Join("..", "admin", "backend", "parsers", "downloads", rel)
		if fileExists(path) {
			return path
		}
	}
	
	// 4. Try joining with media directory directly
	path := filepath.Join(mediaDir, imgURL)
	if fileExists(path) {
		return path
	}
	
	return ""
}

func parseRatioParts(seriesRatio string) []int {
	if seriesRatio == "" {
		return nil
	}
	partsStr := strings.FieldsFunc(seriesRatio, func(c rune) bool {
		return c == '-' || c == ',' || c == ' '
	})
	parts := []int{}
	for _, p := range partsStr {
		var val int
		for i := 0; i < len(p); i++ {
			if p[i] >= '0' && p[i] <= '9' {
				val = val*10 + int(p[i]-'0')
			}
		}
		if val > 0 {
			parts = append(parts, val)
		}
	}
	return parts
}

func distributeStockDeduction(quantity int, seriesRatio string, variantsCount int) []int {
	if variantsCount <= 0 {
		return nil
	}
	parts := parseRatioParts(seriesRatio)
	totalRatioUnits := 0
	for _, p := range parts {
		totalRatioUnits += p
	}
	if totalRatioUnits <= 0 {
		totalRatioUnits = 1
	}

	packages := quantity / totalRatioUnits
	if packages <= 0 {
		packages = 1
	}

	deductions := make([]int, variantsCount)
	if len(parts) == variantsCount {
		totalDeducted := 0
		for i := 0; i < variantsCount-1; i++ {
			deductions[i] = parts[i] * packages
			totalDeducted += deductions[i]
		}
		deductions[variantsCount-1] = quantity - totalDeducted
		if deductions[variantsCount-1] < 0 {
			deductions[variantsCount-1] = 0
		}
	} else {
		base := quantity / variantsCount
		rem := quantity % variantsCount
		for i := 0; i < variantsCount; i++ {
			deductions[i] = base
			if i < rem {
				deductions[i]++
			}
		}
	}
	return deductions
}

func (h *OrdersHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.BillingAddress == "" || req.DeliveryAddress == "" {
		http.Error(w, `{"error":"Fatura ve teslimat adresleri zorunludur"}`, http.StatusBadRequest)
		return
	}

	if req.PaymentMethod == "" {
		req.PaymentMethod = "BANK_TRANSFER"
	}

	ctx := r.Context()

	// 1. Fetch user's cart ID
	var cartID string
	err = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.carts WHERE user_id = $1", userID).Scan(&cartID)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sepet bulunamadı"}`, http.StatusBadRequest)
		return
	} else if err != nil {
		log.Printf("[CREATE ORDER ERROR] Failed to fetch cart: %v", err)
		http.Error(w, `{"error":"İşlem sırasında hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	// 2. Fetch cart items
	rows, err := db.Pool.Query(ctx, `
		SELECT ci.product_id, ci.quantity, p.title, p.custom_sku, p.price, p.discounted_price, p.series_ratio, p.stock,
		       COALESCE(
		           (SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1),
		           '/placeholder.png'
		       ) as image_url
		FROM catalog.cart_items ci
		INNER JOIN catalog.products p ON ci.product_id = p.id
		WHERE ci.cart_id = $1 AND p.deleted_at IS NULL
	`, cartID)
	if err != nil {
		log.Printf("[CREATE ORDER ERROR] Failed to query cart items: %v", err)
		http.Error(w, `{"error":"Sepet detayları sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type cartItemInfo struct {
		ProductID       string
		Quantity        int
		Title           string
		CustomSku       string
		Price           float64
		DiscountedPrice *float64
		SeriesRatio     string
		CurrentStock    int
		ImageUrl        string
	}

	var items []cartItemInfo
	var totalAmount float64

	for rows.Next() {
		var item cartItemInfo
		err := rows.Scan(
			&item.ProductID, &item.Quantity, &item.Title, &item.CustomSku, &item.Price, &item.DiscountedPrice,
			&item.SeriesRatio, &item.CurrentStock, &item.ImageUrl,
		)
		if err != nil {
			log.Printf("[CREATE ORDER ERROR] Failed to scan cart item: %v", err)
			continue
		}
		items = append(items, item)

		unitPrice := item.Price
		if item.DiscountedPrice != nil && *item.DiscountedPrice > 0 && *item.DiscountedPrice < item.Price {
			unitPrice = *item.DiscountedPrice
		}
		totalAmount += unitPrice * float64(item.Quantity)
	}

	if len(items) == 0 {
		http.Error(w, `{"error":"Sepetiniz boş"}`, http.StatusBadRequest)
		return
	}

	// Start transactional block
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[CREATE ORDER ERROR] Failed to begin tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Verify stock and prepare variant updates inside the tx
	type variantStockUpdate struct {
		VariantID string
		Deduction int
	}
	var variantUpdates []variantStockUpdate

	for _, item := range items {
		// A. Verify main product stock
		if item.CurrentStock < item.Quantity {
			http.Error(w, fmt.Sprintf(`{"error":"Yetersiz stok: %s (Mevcut: %d, İstenen: %d)"}`, item.Title, item.CurrentStock, item.Quantity), http.StatusBadRequest)
			return
		}

		// B. Fetch and lock active variants
		vRows, err := tx.Query(ctx, `
			SELECT id, stock, variant_size 
			FROM catalog.product_variants 
			WHERE product_id = $1 AND is_active = true 
			ORDER BY is_single ASC, variant_size ASC
			FOR UPDATE
		`, item.ProductID)
		if err != nil {
			log.Printf("[CREATE ORDER ERROR] Failed to query variants: %v", err)
			http.Error(w, `{"error":"Stok kontrolü sırasında hata"}`, http.StatusInternalServerError)
			return
		}

		type variantInfo struct {
			ID   string
			Stock int
			Size string
		}
		var variants []variantInfo
		for vRows.Next() {
			var v variantInfo
			if err := vRows.Scan(&v.ID, &v.Stock, &v.Size); err == nil {
				variants = append(variants, v)
			}
		}
		vRows.Close()

		if len(variants) > 0 {
			deductions := distributeStockDeduction(item.Quantity, item.SeriesRatio, len(variants))
			for i, v := range variants {
				ded := deductions[i]
				if v.Stock < ded {
					http.Error(w, fmt.Sprintf(`{"error":"Yetersiz varyant stoku: %s (%s beden)"}`, item.Title, v.Size), http.StatusBadRequest)
					return
				}
				variantUpdates = append(variantUpdates, variantStockUpdate{
					VariantID: v.ID,
					Deduction: ded,
				})
			}
		}
	}

	// 3. Generate sequential order_number format YYYYMMDD-XXXX
	datePrefix := time.Now().Format("20060102")
	var lastOrderNumber string
	err = tx.QueryRow(ctx, `
		SELECT order_number 
		FROM catalog.orders 
		WHERE order_number LIKE $1 
		ORDER BY order_number DESC 
		LIMIT 1 
		FOR UPDATE
	`, datePrefix+"-%").Scan(&lastOrderNumber)

	seq := 1
	if err == nil {
		parts := strings.Split(lastOrderNumber, "-")
		if len(parts) == 2 {
			var lastSeq int
			fmt.Sscanf(parts[1], "%d", &lastSeq)
			seq = lastSeq + 1
		}
	}

	orderNumber := fmt.Sprintf("%s-%04d", datePrefix, seq)

	// 4. Create Order
	var orderID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.orders (order_number, user_id, total_amount, payment_method, order_status, billing_address, delivery_address)
		VALUES ($1, $2, $3, $4, 'PENDING_PAYMENT', $5, $6)
		RETURNING id
	`, orderNumber, userID, totalAmount, req.PaymentMethod, req.BillingAddress, req.DeliveryAddress).Scan(&orderID)

	if err != nil {
		log.Printf("[CREATE ORDER ERROR] Failed to insert order: %v", err)
		http.Error(w, `{"error":"Sipariş oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	// 5. Deduct stock and insert order items
	for _, item := range items {
		// Deduct product main stock
		_, err = tx.Exec(ctx, `
			UPDATE catalog.products 
			SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, item.Quantity, item.ProductID)
		if err != nil {
			log.Printf("[CREATE ORDER ERROR] Failed to deduct main product stock: %v", err)
			http.Error(w, `{"error":"Stok düşümü başarısız"}`, http.StatusInternalServerError)
			return
		}

		// Insert order item (denormalized name, SKU, price, image URL)
		unitPrice := item.Price
		if item.DiscountedPrice != nil && *item.DiscountedPrice > 0 && *item.DiscountedPrice < item.Price {
			unitPrice = *item.DiscountedPrice
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO catalog.order_items (order_id, product_id, product_name, product_sku, quantity, price_at_purchase, image_url_at_purchase)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, orderID, item.ProductID, item.Title, item.CustomSku, item.Quantity, unitPrice, item.ImageUrl)
		if err != nil {
			log.Printf("[CREATE ORDER ERROR] Failed to insert order item: %v", err)
			http.Error(w, `{"error":"Sipariş kalemi eklenemedi"}`, http.StatusInternalServerError)
			return
		}
	}

	// Apply variant stock updates
	for _, up := range variantUpdates {
		_, err = tx.Exec(ctx, `
			UPDATE catalog.product_variants 
			SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, up.Deduction, up.VariantID)
		if err != nil {
			log.Printf("[CREATE ORDER ERROR] Failed to deduct variant stock: %v", err)
			http.Error(w, `{"error":"Varyant stok düşümü başarısız"}`, http.StatusInternalServerError)
			return
		}
	}

	// 6. Empty shopping cart
	_, err = tx.Exec(ctx, "DELETE FROM catalog.cart_items WHERE cart_id = $1", cartID)
	if err != nil {
		log.Printf("[CREATE ORDER ERROR] Failed to clear cart items: %v", err)
		http.Error(w, `{"error":"Sepet temizlenirken hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[CREATE ORDER ERROR] Failed to commit: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"success":      true,
		"order_id":     orderID,
		"order_number": orderNumber,
	})
}

func (h *OrdersHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	// 1. Fetch user orders
	rows, err := db.Pool.Query(ctx, `
		SELECT id, order_number, total_amount, payment_method, order_status, billing_address, delivery_address, created_at, updated_at
		FROM catalog.orders
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		log.Printf("[LIST ORDERS ERROR] Failed to query orders: %v", err)
		http.Error(w, `{"error":"Sipariş geçmişi yüklenemedi"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []OrderResponse
	orderMap := make(map[string]*OrderResponse)

	for rows.Next() {
		var o OrderResponse
		var createdAt, updatedAt time.Time
		err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.TotalAmount, &o.PaymentMethod, &o.OrderStatus,
			&o.BillingAddress, &o.DeliveryAddress, &createdAt, &updatedAt,
		)
		if err != nil {
			log.Printf("[LIST ORDERS ERROR] Failed to scan order row: %v", err)
			continue
		}
		o.CreatedAt = createdAt.Format(time.RFC3339)
		o.UpdatedAt = updatedAt.Format(time.RFC3339)
		o.Items = []OrderItemResponse{}
		
		orders = append(orders, o)
	}
	rows.Close()

	// Populate map pointer
	for i := range orders {
		orderMap[orders[i].ID] = &orders[i]
	}

	// 2. Fetch order items for these orders using subquery
	itemRows, err := db.Pool.Query(ctx, `
		SELECT id, order_id, product_id, product_name, product_sku, quantity, price_at_purchase, image_url_at_purchase, created_at
		FROM catalog.order_items
		WHERE order_id IN (SELECT id FROM catalog.orders WHERE user_id = $1)
		ORDER BY created_at ASC
	`, userID)
	if err == nil {
		defer itemRows.Close()
		for itemRows.Next() {
			var oi OrderItemResponse
			var orderID string
			var createdAt time.Time
			var prodID *string
			err := itemRows.Scan(
				&oi.ID, &orderID, &prodID, &oi.ProductName, &oi.ProductSKU, &oi.Quantity, &oi.PriceAtPurchase, &oi.ImageUrlAtPurchase, &createdAt,
			)
			if err != nil {
				continue
			}
			if prodID != nil {
				oi.ProductID = *prodID
			}
			oi.CreatedAt = createdAt.Format(time.RFC3339)
			
			if oPtr, ok := orderMap[orderID]; ok {
				oPtr.Items = append(oPtr.Items, oi)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

func (h *OrdersHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orderID := r.PathValue("id")
	if orderID == "" {
		http.Error(w, `{"error":"Order ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	var o OrderResponse
	var createdAt, updatedAt time.Time

	err = db.Pool.QueryRow(ctx, `
		SELECT id, order_number, total_amount, payment_method, order_status, billing_address, delivery_address, created_at, updated_at
		FROM catalog.orders
		WHERE id = $1 AND user_id = $2
	`, orderID, userID).Scan(
		&o.ID, &o.OrderNumber, &o.TotalAmount, &o.PaymentMethod, &o.OrderStatus,
		&o.BillingAddress, &o.DeliveryAddress, &createdAt, &updatedAt,
	)

	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[GET ORDER ERROR] Failed to fetch order: %v", err)
		http.Error(w, `{"error":"Sipariş yüklenemedi"}`, http.StatusInternalServerError)
		return
	}

	o.CreatedAt = createdAt.Format(time.RFC3339)
	o.UpdatedAt = updatedAt.Format(time.RFC3339)
	o.Items = []OrderItemResponse{}

	// Query items
	rows, err := db.Pool.Query(ctx, `
		SELECT id, product_id, product_name, product_sku, quantity, price_at_purchase, image_url_at_purchase, created_at
		FROM catalog.order_items
		WHERE order_id = $1
		ORDER BY created_at ASC
	`, o.ID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var oi OrderItemResponse
			var createdAt time.Time
			var prodID *string
			err := rows.Scan(
				&oi.ID, &prodID, &oi.ProductName, &oi.ProductSKU, &oi.Quantity, &oi.PriceAtPurchase, &oi.ImageUrlAtPurchase, &createdAt,
			)
			if err != nil {
				continue
			}
			if prodID != nil {
				oi.ProductID = *prodID
			}
			oi.CreatedAt = createdAt.Format(time.RFC3339)
			o.Items = append(o.Items, oi)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(o)
}

func (h *OrdersHandler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orderID := r.PathValue("id")
	if orderID == "" {
		http.Error(w, `{"error":"Order ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[CANCEL ORDER ERROR] Failed to begin tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Fetch order status and verify it belongs to user
	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT order_status FROM catalog.orders WHERE id = $1 AND user_id = $2 FOR UPDATE
	`, orderID, userID).Scan(&currentStatus)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[CANCEL ORDER ERROR] Failed to query status: %v", err)
		http.Error(w, `{"error":"Sipariş sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	// Standard users can only cancel when order is in PENDING_PAYMENT or APPROVED states
	if currentStatus != "PENDING_PAYMENT" && currentStatus != "APPROVED" {
		http.Error(w, `{"error":"Bu aşamadaki siparişler iptal edilemez"}`, http.StatusBadRequest)
		return
	}

	// Fetch order items to restore stock
	rows, err := tx.Query(ctx, `
		SELECT product_id, quantity 
		FROM catalog.order_items 
		WHERE order_id = $1
	`, orderID)
	if err != nil {
		log.Printf("[CANCEL ORDER ERROR] Failed to query items: %v", err)
		http.Error(w, `{"error":"Sipariş detayları sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	type stockRestore struct {
		ProductID string
		Quantity  int
	}
	var restItems []stockRestore
	for rows.Next() {
		var sr stockRestore
		var prodID *string
		if err := rows.Scan(&prodID, &sr.Quantity); err == nil && prodID != nil {
			sr.ProductID = *prodID
			restItems = append(restItems, sr)
		}
	}
	rows.Close()

	// Restore stocks
	for _, item := range restItems {
		// Restore main product stock
		_, err = tx.Exec(ctx, `
			UPDATE catalog.products 
			SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, item.Quantity, item.ProductID)
		if err != nil {
			log.Printf("[CANCEL ORDER ERROR] Failed to restore main stock: %v", err)
			http.Error(w, `{"error":"Stok güncellemesi başarısız"}`, http.StatusInternalServerError)
			return
		}

		// Restore variant stocks
		var seriesRatio string
		err = tx.QueryRow(ctx, "SELECT series_ratio FROM catalog.products WHERE id = $1", item.ProductID).Scan(&seriesRatio)
		if err != nil {
			continue // non-critical if product is deleted
		}

		vRows, err := tx.Query(ctx, `
			SELECT id FROM catalog.product_variants 
			WHERE product_id = $1 AND is_active = true 
			ORDER BY is_single ASC, variant_size ASC
		`, item.ProductID)
		if err == nil {
			var vIDs []string
			for vRows.Next() {
				var id string
				if err := vRows.Scan(&id); err == nil {
					vIDs = append(vIDs, id)
				}
			}
			vRows.Close()

			if len(vIDs) > 0 {
				deductions := distributeStockDeduction(item.Quantity, seriesRatio, len(vIDs))
				for i, vID := range vIDs {
					restVal := deductions[i]
					_, err = tx.Exec(ctx, `
						UPDATE catalog.product_variants 
						SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
						WHERE id = $2
					`, restVal, vID)
					if err != nil {
						log.Printf("[CANCEL ORDER ERROR] Failed to restore variant stock: %v", err)
					}
				}
			}
		}
	}

	// Update order status to CANCELLED
	_, err = tx.Exec(ctx, `
		UPDATE catalog.orders 
		SET order_status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
		WHERE id = $1
	`, orderID)
	if err != nil {
		log.Printf("[CANCEL ORDER ERROR] Failed to update order status: %v", err)
		http.Error(w, `{"error":"Sipariş iptal edilemedi"}`, http.StatusInternalServerError)
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[CANCEL ORDER ERROR] Failed to commit: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true,"message":"Sipariş başarıyla iptal edildi."}`))
}

func (h *OrdersHandler) SubmitPaymentNotification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orderID := r.PathValue("id")
	if orderID == "" {
		http.Error(w, `{"error":"Order ID is required"}`, http.StatusBadRequest)
		return
	}

	var req PaymentNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.BankName == "" || req.SenderName == "" || req.Amount <= 0 {
		http.Error(w, `{"error":"Banka adı, gönderen adı ve geçerli tutar zorunludur"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Verify order exists and belongs to the user
	var orderExists bool
	err = db.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM catalog.orders WHERE id = $1 AND user_id = $2)
	`, orderID, userID).Scan(&orderExists)
	if err != nil || !orderExists {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	}

	// Insert payment notification
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO catalog.payment_notifications (order_id, user_id, bank_name, sender_name, amount, notes, notification_status)
		VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
	`, orderID, userID, req.BankName, req.SenderName, req.Amount, req.Notes)

	if err != nil {
		log.Printf("[PAYMENT NOTIFICATION ERROR] Failed to insert: %v", err)
		http.Error(w, `{"error":"Ödeme bildirimi kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true,"message":"Ödeme bildiriminiz başarıyla iletildi."}`))
}

func (h *OrdersHandler) RequestRefund(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orderID := r.PathValue("id")
	if orderID == "" {
		http.Error(w, `{"error":"Order ID is required"}`, http.StatusBadRequest)
		return
	}

	var req RefundRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.RefundType != "FULL" && req.RefundType != "PARTIAL" {
		http.Error(w, `{"error":"İade türü FULL veya PARTIAL olmalıdır"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[REFUND REQUEST ERROR] Failed to begin tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Verify order exists, belongs to user, and is in COMPLETED or APPROVED status
	var orderStatus string
	err = tx.QueryRow(ctx, `
		SELECT order_status FROM catalog.orders WHERE id = $1 AND user_id = $2 FOR UPDATE
	`, orderID, userID).Scan(&orderStatus)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[REFUND REQUEST ERROR] Failed to query order: %v", err)
		http.Error(w, `{"error":"Sipariş sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	if orderStatus != "COMPLETED" && orderStatus != "APPROVED" {
		http.Error(w, `{"error":"Sadece onaylı veya tamamlanmış siparişler için iade talep edilebilir"}`, http.StatusBadRequest)
		return
	}

	// Insert refund request record
	var refundID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.refunds (order_id, user_id, refund_type, refund_status, reason)
		VALUES ($1, $2, $3, 'REQUESTED', $4)
		RETURNING id
	`, orderID, userID, req.RefundType, req.Reason).Scan(&refundID)
	if err != nil {
		log.Printf("[REFUND REQUEST ERROR] Failed to insert refund: %v", err)
		http.Error(w, `{"error":"İade talebi oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	if req.RefundType == "FULL" {
		// Populate all order items for full refund
		rows, err := tx.Query(ctx, "SELECT id, quantity FROM catalog.order_items WHERE order_id = $1", orderID)
		if err != nil {
			log.Printf("[REFUND REQUEST ERROR] Failed to query items: %v", err)
			http.Error(w, `{"error":"Sipariş detayları sorgulanamadı"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type itemInfo struct {
			ID  string
			Qty int
		}
		var items []itemInfo
		for rows.Next() {
			var ii itemInfo
			if err := rows.Scan(&ii.ID, &ii.Qty); err == nil {
				items = append(items, ii)
			}
		}
		rows.Close()

		for _, item := range items {
			_, err = tx.Exec(ctx, `
				INSERT INTO catalog.refund_items (refund_id, order_item_id, quantity)
				VALUES ($1, $2, $3)
			`, refundID, item.ID, item.Qty)
			if err != nil {
				log.Printf("[REFUND REQUEST ERROR] Failed to insert refund item: %v", err)
				http.Error(w, `{"error":"İade kalemleri oluşturulamadı"}`, http.StatusInternalServerError)
				return
			}
		}
	} else {
		// Validate and insert partial refund items
		if len(req.Items) == 0 {
			http.Error(w, `{"error":"Kısmi iade için kalem seçilmelidir"}`, http.StatusBadRequest)
			return
		}

		for _, reqItem := range req.Items {
			var orderQty int
			err = tx.QueryRow(ctx, `
				SELECT quantity FROM catalog.order_items WHERE id = $1 AND order_id = $2
			`, reqItem.OrderItemID, orderID).Scan(&orderQty)
			if err == pgx.ErrNoRows {
				http.Error(w, `{"error":"İade edilmek istenen sipariş kalemi bulunamadı"}`, http.StatusBadRequest)
				return
			} else if err != nil {
				log.Printf("[REFUND REQUEST ERROR] Failed to verify item qty: %v", err)
				http.Error(w, `{"error":"Doğrulama hatası"}`, http.StatusInternalServerError)
				return
			}

			if reqItem.Quantity <= 0 || reqItem.Quantity > orderQty {
				http.Error(w, fmt.Sprintf(`{"error":"Geçersiz iade adeti. Maksimum iade edilebilir adet: %d"}`, orderQty), http.StatusBadRequest)
				return
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO catalog.refund_items (refund_id, order_item_id, quantity)
				VALUES ($1, $2, $3)
			`, refundID, reqItem.OrderItemID, reqItem.Quantity)
			if err != nil {
				log.Printf("[REFUND REQUEST ERROR] Failed to insert partial refund item: %v", err)
				http.Error(w, `{"error":"İade kalemi eklenirken hata"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[REFUND REQUEST ERROR] Failed to commit: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true,"message":"İade talebiniz başarıyla alınmıştır."}`))
}

func (h *OrdersHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orderID := r.PathValue("id")
	if orderID == "" {
		http.Error(w, `{"error":"Order ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// 1. Query order & user details
	type excelData struct {
		OrderNumber     string
		CreatedAt       string
		OrderStatus     string
		UserFullName    string
		UserEmail       string
		DeliveryAddress string
		BillingAddress  string
		PaymentMethod   string
		Currency        string
		TotalAmount     float64
		Items           []struct {
			ProductName     string
			ProductSKU      string
			Quantity        int
			PriceAtPurchase float64
			TotalLineAmount float64
		}
	}

	var d excelData
	var oCreatedAt time.Time
	var firstName, lastName, email string

	err = db.Pool.QueryRow(ctx, `
		SELECT o.order_number, o.created_at, o.order_status, o.total_amount, o.payment_method, o.billing_address, o.delivery_address,
		       u.first_name, u.last_name, u.email
		FROM catalog.orders o
		INNER JOIN identity.users u ON o.user_id = u.id
		WHERE o.id = $1 AND o.user_id = $2
	`, orderID, userID).Scan(
		&d.OrderNumber, &oCreatedAt, &d.OrderStatus, &d.TotalAmount, &d.PaymentMethod, &d.BillingAddress, &d.DeliveryAddress,
		&firstName, &lastName, &email,
	)

	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[EXCEL EXPORT ERROR] Failed to query order: %v", err)
		http.Error(w, `{"error":"Fatura oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	d.CreatedAt = oCreatedAt.Format("02.01.2006 15:04")
	d.UserFullName = firstName + " " + lastName
	d.UserEmail = email
	d.Currency = "TRY"

	// Fetch items
	rows, err := db.Pool.Query(ctx, `
		SELECT product_name, product_sku, quantity, price_at_purchase
		FROM catalog.order_items
		WHERE order_id = $1
		ORDER BY created_at ASC
	`, orderID)
	if err != nil {
		log.Printf("[EXCEL EXPORT ERROR] Failed to query items: %v", err)
		http.Error(w, `{"error":"Sipariş kalemleri okunamadı"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var item struct {
			ProductName     string
			ProductSKU      string
			Quantity        int
			PriceAtPurchase float64
			TotalLineAmount float64
		}
		err := rows.Scan(&item.ProductName, &item.ProductSKU, &item.Quantity, &item.PriceAtPurchase)
		if err != nil {
			continue
		}
		item.TotalLineAmount = float64(item.Quantity) * item.PriceAtPurchase
		d.Items = append(d.Items, item)
	}

	// HTML Excel Template
	tmplStr := `
	<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
		<style>
			body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
			table { border-collapse: collapse; width: 100%; margin-top: 15px; }
			th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
			th { background-color: #f5f5f5; font-weight: bold; }
			.invoice-title { font-size: 20px; font-weight: bold; color: #1e3a8a; margin-bottom: 15px; }
			.section-header { font-size: 14px; font-weight: bold; background-color: #eff6ff; color: #1e40af; }
			.total-row { font-weight: bold; background-color: #f8fafc; color: #0f172a; }
		</style>
	</head>
	<body>
		<div class="invoice-title">Müşteri Sipariş Faturası (B2B Proforma)</div>
		<table>
			<tr class="section-header"><td colspan="2">Sipariş Bilgileri</td></tr>
			<tr><td>Sipariş No:</td><td><b>{{.OrderNumber}}</b></td></tr>
			<tr><td>Sipariş Tarihi:</td><td>{{.CreatedAt}}</td></tr>
			<tr><td>Sipariş Durumu:</td><td>{{.OrderStatus}}</td></tr>
			<tr><td>Ödeme Türü:</td><td>{{.PaymentMethod}}</td></tr>
			<tr class="section-header"><td colspan="2">Müşteri Bilgileri</td></tr>
			<tr><td>Müşteri Adı:</td><td>{{.UserFullName}}</td></tr>
			<tr><td>E-posta:</td><td>{{.UserEmail}}</td></tr>
			<tr><td>Teslimat Adresi:</td><td>{{.DeliveryAddress}}</td></tr>
			<tr><td>Fatura Adresi:</td><td>{{.BillingAddress}}</td></tr>
		</table>
		<br/>
		<table>
			<thead>
				<tr class="section-header">
					<th style="width: 45%;">Ürün Açıklaması</th>
					<th style="width: 20%;">SKU / Kod</th>
					<th style="width: 10%;">Adet</th>
					<th style="width: 10%;">Birim Fiyat</th>
					<th style="width: 15%;">Toplam</th>
				</tr>
			</thead>
			<tbody>
				{{range .Items}}
				<tr>
					<td>{{.ProductName}}</td>
					<td>{{.ProductSKU}}</td>
					<td>{{.Quantity}}</td>
					<td>{{printf "%.2f" .PriceAtPurchase}} {{$.Currency}}</td>
					<td>{{printf "%.2f" .TotalLineAmount}} {{$.Currency}}</td>
				</tr>
				{{end}}
				<tr class="total-row">
					<td colspan="4" style="text-align: right;">Ara Toplam:</td>
					<td>{{printf "%.2f" .TotalAmount}} {{$.Currency}}</td>
				</tr>
				<tr class="total-row">
					<td colspan="4" style="text-align: right;">KDV (%10):</td>
					<td>Dahil</td>
				</tr>
				<tr class="total-row" style="background-color: #cbd5e1;">
					<td colspan="4" style="text-align: right;">Genel Toplam:</td>
					<td>{{printf "%.2f" .TotalAmount}} {{$.Currency}}</td>
				</tr>
			</tbody>
		</table>
	</body>
	</html>`

	tmpl, err := template.New("excel").Parse(tmplStr)
	if err != nil {
		http.Error(w, `{"error":"Fatura şablon yükleme hatası"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/vnd.ms-excel")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=fatura-%s.xls", d.OrderNumber))
	
	err = tmpl.Execute(w, d)
	if err != nil {
		log.Printf("[EXCEL EXPORT ERROR] Failed to execute template: %v", err)
	}
}

func (h *OrdersHandler) DownloadImagesZip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orderID := r.PathValue("id")
	if orderID == "" {
		http.Error(w, `{"error":"Order ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// 1. Fetch order details to check permission
	var orderNumber string
	err = db.Pool.QueryRow(ctx, `
		SELECT order_number FROM catalog.orders WHERE id = $1 AND user_id = $2
	`, orderID, userID).Scan(&orderNumber)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[DOWNLOAD ZIP ERROR] Failed to fetch order: %v", err)
		http.Error(w, `{"error":"Sipariş bilgisi okunamadı"}`, http.StatusInternalServerError)
		return
	}

	// 2. Query items cover images at purchase time
	rows, err := db.Pool.Query(ctx, `
		SELECT product_sku, image_url_at_purchase
		FROM catalog.order_items
		WHERE order_id = $1
	`, orderID)
	if err != nil {
		log.Printf("[DOWNLOAD ZIP ERROR] Failed to query items: %v", err)
		http.Error(w, `{"error":"Görsel bilgileri sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type imgItem struct {
		SKU      string
		ImageURL string
	}
	var images []imgItem
	for rows.Next() {
		var img imgItem
		var sku *string
		var url *string
		if err := rows.Scan(&sku, &url); err == nil {
			if sku != nil {
				img.SKU = *sku
			}
			if url != nil {
				img.ImageURL = *url
			}
			if img.ImageURL != "" {
				images = append(images, img)
			}
		}
	}
	rows.Close()

	if len(images) == 0 {
		http.Error(w, `{"error":"Siparişe ait görsel bulunamadı"}`, http.StatusNotFound)
		return
	}

	// 3. Create ZIP archive in memory
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	addedFiles := make(map[string]int)

	for _, img := range images {
		localPath := getLocalImagePath(img.ImageURL)
		if localPath == "" {
			log.Printf("[DOWNLOAD ZIP WARNING] Could not resolve local image path for: %s", img.ImageURL)
			continue
		}

		file, err := os.Open(localPath)
		if err != nil {
			log.Printf("[DOWNLOAD ZIP WARNING] Failed to open image: %s, err: %v", localPath, err)
			continue
		}

		// Clean name in ZIP: e.g. custom_sku_1.webp, custom_sku_2.webp
		ext := filepath.Ext(localPath)
		if ext == "" {
			ext = ".webp"
		}
		
		nameInZip := img.SKU
		if nameInZip == "" {
			nameInZip = "product"
		}
		
		count := addedFiles[nameInZip]
		addedFiles[nameInZip] = count + 1
		
		if count > 0 {
			nameInZip = fmt.Sprintf("%s_%d%s", nameInZip, count, ext)
		} else {
			nameInZip = fmt.Sprintf("%s%s", nameInZip, ext)
		}

		fWriter, err := zw.Create(nameInZip)
		if err != nil {
			file.Close()
			continue
		}

		_, err = io.Copy(fWriter, file)
		file.Close()
		if err != nil {
			log.Printf("[DOWNLOAD ZIP WARNING] Failed to copy to zip: %v", err)
		}
	}

	err = zw.Close()
	if err != nil {
		log.Printf("[DOWNLOAD ZIP ERROR] Failed to close zip writer: %v", err)
		http.Error(w, `{"error":"Arşiv oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	// 4. Send ZIP stream
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=gorseller-%s.zip", orderNumber))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", buf.Len()))
	
	w.Write(buf.Bytes())
}
