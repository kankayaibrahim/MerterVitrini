package handlers

import (
	"archive/zip"
	"bytes"
	"context"
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
	"mertervitrini/backend/db"
)

type StoreOrdersHandler struct{}

func NewStoreOrdersHandler() *StoreOrdersHandler {
	return &StoreOrdersHandler{}
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
	ID                 string  `json:"id"`
	ProductID          string  `json:"product_id"`
	ProductName        string  `json:"product_name"`
	ProductSKU         string  `json:"product_sku"`
	Quantity           int     `json:"quantity"`
	PriceAtPurchase    float64 `json:"price_at_purchase"`
	ImageUrlAtPurchase string  `json:"image_url_at_purchase"`
	CreatedAt          string  `json:"created_at"`
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

	if strings.HasPrefix(imgURL, "http://") || strings.HasPrefix(imgURL, "https://") {
		parts := strings.SplitN(imgURL, "/", 4)
		if len(parts) >= 4 {
			imgURL = "/" + parts[3]
		}
	}

	mediaDir := getMediaDir()

	if strings.HasPrefix(imgURL, "/uploads/") {
		rel := strings.TrimPrefix(imgURL, "/uploads/")
		path := filepath.Join(mediaDir, rel)
		if fileExists(path) {
			return path
		}
	}

	if fileExists(imgURL) {
		return imgURL
	}

	if strings.HasPrefix(imgURL, "./downloads/") {
		rel := strings.TrimPrefix(imgURL, "./downloads/")
		path := filepath.Join("..", "admin", "backend", "parsers", "downloads", rel)
		if fileExists(path) {
			return path
		}
	}

	path := filepath.Join(mediaDir, imgURL)
	if fileExists(path) {
		return path
	}

	return ""
}

type orderCartItem struct {
	ProductID       string
	BrandID         string
	Quantity        int
	Title           string
	CustomSku       string
	Price           float64
	DiscountedPrice *float64
	SeriesRatio     string
	CurrentStock    int
	ImageUrl        string
}

type variantStockUpdate struct {
	VariantID string
	Deduction int
}

func fetchUserCartItems(ctx context.Context, cartID string) ([]orderCartItem, float64, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT ci.product_id, COALESCE(p.brand_id::text, ''), ci.quantity, p.title, p.custom_sku, p.price, COALESCE(ci.custom_unit_price, p.discounted_price), p.series_ratio, p.stock,
		       COALESCE(
		           (SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1),
		           '/placeholder.png'
		       ) as image_url
		FROM catalog.cart_items ci
		INNER JOIN catalog.products p ON ci.product_id = p.id
		WHERE ci.cart_id = $1 AND p.deleted_at IS NULL
	`, cartID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []orderCartItem
	var totalAmount float64

	for rows.Next() {
		var item orderCartItem
		err := rows.Scan(
			&item.ProductID, &item.BrandID, &item.Quantity, &item.Title, &item.CustomSku, &item.Price, &item.DiscountedPrice,
			&item.SeriesRatio, &item.CurrentStock, &item.ImageUrl,
		)
		if err != nil {
			continue
		}
		items = append(items, item)

		unitPrice := item.Price
		if item.DiscountedPrice != nil && *item.DiscountedPrice > 0 && *item.DiscountedPrice < item.Price {
			unitPrice = *item.DiscountedPrice
		}
		totalAmount += unitPrice * float64(item.Quantity)
	}

	return items, totalAmount, nil
}

type variantInfo struct {
	ID    string
	Stock int
	Size  string
}

func fetchProductVariantsForStock(ctx context.Context, tx pgx.Tx, productID string) ([]variantInfo, error) {
	vRows, err := tx.Query(ctx, `
		SELECT id, stock, variant_size 
		FROM catalog.product_variants 
		WHERE product_id = $1 AND is_active = true 
		ORDER BY is_single ASC, variant_size ASC
		FOR UPDATE
	`, productID)
	if err != nil {
		return nil, err
	}
	defer vRows.Close()

	var variants []variantInfo
	for vRows.Next() {
		var v variantInfo
		if err := vRows.Scan(&v.ID, &v.Stock, &v.Size); err == nil {
			variants = append(variants, v)
		}
	}
	return variants, nil
}

func calculateItemVariantUpdates(item orderCartItem, variants []variantInfo) ([]variantStockUpdate, error) {
	if len(variants) == 0 {
		return nil, nil
	}
	deductions := distributeStockDeduction(item.Quantity, item.SeriesRatio, len(variants))
	updates := make([]variantStockUpdate, len(variants))
	for i, v := range variants {
		ded := deductions[i]
		if v.Stock < ded {
			return nil, fmt.Errorf("Yetersiz varyant stoku: %s (%s beden)", item.Title, v.Size)
		}
		updates[i] = variantStockUpdate{
			VariantID: v.ID,
			Deduction: ded,
		}
	}
	return updates, nil
}

func validateStockAndPrepareVariants(ctx context.Context, tx pgx.Tx, items []orderCartItem) ([]variantStockUpdate, error) {
	var variantUpdates []variantStockUpdate

	for _, item := range items {
		if item.CurrentStock < item.Quantity {
			return nil, fmt.Errorf("Yetersiz stok: %s (Mevcut: %d, İstenen: %d)", item.Title, item.CurrentStock, item.Quantity)
		}

		variants, err := fetchProductVariantsForStock(ctx, tx, item.ProductID)
		if err != nil {
			return nil, err
		}

		updates, err := calculateItemVariantUpdates(item, variants)
		if err != nil {
			return nil, err
		}
		variantUpdates = append(variantUpdates, updates...)
	}
	return variantUpdates, nil
}

func generateNextOrderNumber(ctx context.Context, tx pgx.Tx) (string, error) {
	datePrefix := time.Now().Format("20060102")
	var seqVal int64
	err := tx.QueryRow(ctx, `SELECT nextval('catalog.order_number_seq')`).Scan(&seqVal)
	if err != nil {
		return "", fmt.Errorf("failed to get next order sequence: %w", err)
	}
	return fmt.Sprintf("%s-%05d", datePrefix, seqVal), nil
}

func executeStockDeductionAndOrderItems(ctx context.Context, tx pgx.Tx, orderID, cartID string, items []orderCartItem, variantUpdates []variantStockUpdate) error {
	for _, item := range items {
		_, err := tx.Exec(ctx, `
			UPDATE catalog.products 
			SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, item.Quantity, item.ProductID)
		if err != nil {
			return err
		}

		unitPrice := item.Price
		if item.DiscountedPrice != nil && *item.DiscountedPrice > 0 && *item.DiscountedPrice < item.Price {
			unitPrice = *item.DiscountedPrice
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO catalog.order_items (order_id, product_id, product_name, product_sku, quantity, price_at_purchase, image_url_at_purchase)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, orderID, item.ProductID, item.Title, item.CustomSku, item.Quantity, unitPrice, item.ImageUrl)
		if err != nil {
			return err
		}
	}

	for _, vu := range variantUpdates {
		_, err := tx.Exec(ctx, `
			UPDATE catalog.product_variants
			SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, vu.Deduction, vu.VariantID)
		if err != nil {
			return err
		}
	}

	_, err := tx.Exec(ctx, "DELETE FROM catalog.cart_items WHERE cart_id = $1", cartID)
	return err
}

func (h *StoreOrdersHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
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

	var cartID string
	err = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.carts WHERE user_id = $1", userID).Scan(&cartID)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sepet bulunamadı"}`, http.StatusBadRequest)
		return
	} else if err != nil {
		http.Error(w, `{"error":"İşlem sırasında hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	items, totalAmount, err := fetchUserCartItems(ctx, cartID)
	if err != nil || len(items) == 0 {
		http.Error(w, `{"error":"Sepetiniz boş"}`, http.StatusBadRequest)
		return
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	variantUpdates, err := validateStockAndPrepareVariants(ctx, tx, items)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	orderNumber, err := generateNextOrderNumber(ctx, tx)
	if err != nil {
		http.Error(w, `{"error":"Sipariş numarası üretilemedi"}`, http.StatusInternalServerError)
		return
	}

	var custName, custPhone, custEmail string
	_ = tx.QueryRow(ctx, `
		SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), COALESCE(phone, ''), COALESCE(email, '')
		FROM identity.users WHERE id = $1
	`, userID).Scan(&custName, &custPhone, &custEmail)

	var orderID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.orders (
			order_number, user_id, total_amount, payment_method, order_status,
			billing_address, delivery_address, customer_name, customer_phone, customer_email
		)
		VALUES ($1, $2, $3, $4, 'PENDING_PAYMENT', $5, $6, $7, $8, $9)
		RETURNING id
	`, orderNumber, userID, totalAmount, req.PaymentMethod, req.BillingAddress, req.DeliveryAddress, custName, custPhone, custEmail).Scan(&orderID)
	if err != nil {
		http.Error(w, `{"error":"Sipariş oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	if err := executeStockDeductionAndOrderItems(ctx, tx, orderID, cartID, items, variantUpdates); err != nil {
		http.Error(w, `{"error":"Stok düşümü başarısız"}`, http.StatusInternalServerError)
		return
	}

	// Split order items to supplier sub-orders and allocate pending balances
	supplierOrders, err := splitOrderIntoSupplierSubOrdersWithSummary(ctx, tx, orderID, orderNumber, items)
	if err != nil {
		log.Printf("[ORDER_SPLIT_WARNING] Failed to split sub-orders: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"Sipariş tamamlanamadı"}`, http.StatusInternalServerError)
		return
	}

	var firstImg string
	if len(items) > 0 {
		firstImg = items[0].ImageUrl
	}
	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        userID,
		EventType:     "order_create",
		EventCategory: "commerce",
		Title:         fmt.Sprintf("#%s numaralı B2B siparişi oluşturdu", orderNumber),
		Subtitle:      fmt.Sprintf("%d kalem ürün • Toplam: %.2f TL", len(items), totalAmount),
		EntityType:    "order",
		EntityID:      orderID,
		ImageURL:      firstImg,
		Metadata: map[string]any{
			"order_number": orderNumber,
			"total_amount": totalAmount,
			"items_count":  len(items),
		},
	})

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"success":         true,
		"order_id":        orderID,
		"order_number":    orderNumber,
		"supplier_orders": supplierOrders,
	})
}

func fetchUserOrders(ctx context.Context, userID string) ([]OrderResponse, map[string]*OrderResponse, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, order_number, total_amount, payment_method, order_status, billing_address, delivery_address, created_at, updated_at
		FROM catalog.orders
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var orders []OrderResponse
	orderMap := make(map[string]*OrderResponse)

	for rows.Next() {
		var o OrderResponse
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.TotalAmount, &o.PaymentMethod, &o.OrderStatus,
			&o.BillingAddress, &o.DeliveryAddress, &createdAt, &updatedAt,
		); err != nil {
			continue
		}
		o.CreatedAt = createdAt.Format(time.RFC3339)
		o.UpdatedAt = updatedAt.Format(time.RFC3339)
		o.Items = []OrderItemResponse{}
		orders = append(orders, o)
	}

	for i := range orders {
		orderMap[orders[i].ID] = &orders[i]
	}
	return orders, orderMap, nil
}

func populateOrderItems(ctx context.Context, userID string, orderMap map[string]*OrderResponse) {
	itemRows, err := db.Pool.Query(ctx, `
		SELECT id, order_id, product_id, product_name, product_sku, quantity, price_at_purchase, image_url_at_purchase, created_at
		FROM catalog.order_items
		WHERE order_id IN (SELECT id FROM catalog.orders WHERE user_id = $1)
		ORDER BY created_at ASC
	`, userID)
	if err != nil {
		return
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var oi OrderItemResponse
		var orderID string
		var createdAt time.Time
		var prodID *string
		if err := itemRows.Scan(
			&oi.ID, &orderID, &prodID, &oi.ProductName, &oi.ProductSKU, &oi.Quantity, &oi.PriceAtPurchase, &oi.ImageUrlAtPurchase, &createdAt,
		); err != nil {
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

func (h *StoreOrdersHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
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
	orders, orderMap, err := fetchUserOrders(ctx, userID)
	if err != nil {
		log.Printf("[LIST ORDERS ERROR] Failed to query orders: %v", err)
		http.Error(w, `{"error":"Sipariş geçmişi yüklenemedi"}`, http.StatusInternalServerError)
		return
	}

	populateOrderItems(ctx, userID, orderMap)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(orders)
}

func (h *StoreOrdersHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
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
		log.Printf("[GET ORDER ERROR] Failed to query order: %v", err)
		http.Error(w, `{"error":"Sipariş sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	o.CreatedAt = createdAt.Format(time.RFC3339)
	o.UpdatedAt = updatedAt.Format(time.RFC3339)
	o.Items = []OrderItemResponse{}

	orderMap := map[string]*OrderResponse{o.ID: &o}
	populateOrderItems(ctx, userID, orderMap)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(o)
}

type stockRestore struct {
	ProductID string
	Quantity  int
}

func fetchOrderItemsForStockRestore(ctx context.Context, tx pgx.Tx, orderID string) ([]stockRestore, error) {
	rows, err := tx.Query(ctx, `
		SELECT product_id, quantity 
		FROM catalog.order_items 
		WHERE order_id = $1
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var restItems []stockRestore
	for rows.Next() {
		var sr stockRestore
		var prodID *string
		if err := rows.Scan(&prodID, &sr.Quantity); err == nil && prodID != nil {
			sr.ProductID = *prodID
			restItems = append(restItems, sr)
		}
	}
	return restItems, nil
}

func restoreProductAndVariantStock(ctx context.Context, tx pgx.Tx, productID string, quantity int) error {
	_, err := tx.Exec(ctx, `
		UPDATE catalog.products 
		SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`, quantity, productID)
	if err != nil {
		return err
	}

	var seriesRatio string
	if err := tx.QueryRow(ctx, "SELECT series_ratio FROM catalog.products WHERE id = $1", productID).Scan(&seriesRatio); err != nil {
		return nil
	}

	vRows, err := tx.Query(ctx, `
		SELECT id FROM catalog.product_variants 
		WHERE product_id = $1 AND is_active = true 
		ORDER BY is_single ASC, variant_size ASC
	`, productID)
	if err != nil {
		return nil
	}
	defer vRows.Close()

	var vIDs []string
	for vRows.Next() {
		var id string
		if err := vRows.Scan(&id); err == nil {
			vIDs = append(vIDs, id)
		}
	}

	if len(vIDs) > 0 {
		deductions := distributeStockDeduction(quantity, seriesRatio, len(vIDs))
		for i, vID := range vIDs {
			_, _ = tx.Exec(ctx, `
				UPDATE catalog.product_variants 
				SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
				WHERE id = $2
			`, deductions[i], vID)
		}
	}
	return nil
}

func restoreOrderStock(ctx context.Context, tx pgx.Tx, orderID string) error {
	restItems, err := fetchOrderItemsForStockRestore(ctx, tx, orderID)
	if err != nil {
		return err
	}

	for _, item := range restItems {
		if err := restoreProductAndVariantStock(ctx, tx, item.ProductID, item.Quantity); err != nil {
			return err
		}
	}
	return nil
}

func (h *StoreOrdersHandler) CancelOrder(w http.ResponseWriter, r *http.Request) {
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
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT order_status FROM catalog.orders WHERE id = $1 AND user_id = $2 FOR UPDATE
	`, orderID, userID).Scan(&currentStatus)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"Sipariş sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	if currentStatus != "PENDING_PAYMENT" && currentStatus != "APPROVED" {
		http.Error(w, `{"error":"Bu aşamadaki siparişler iptal edilemez"}`, http.StatusBadRequest)
		return
	}

	if err := restoreOrderStock(ctx, tx, orderID); err != nil {
		http.Error(w, `{"error":"Stok güncellemesi başarısız"}`, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(ctx, `
		UPDATE catalog.orders 
		SET order_status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, orderID)
	if err != nil {
		http.Error(w, `{"error":"Sipariş iptal edilemedi"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"İşlem kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true,"message":"Siparişiniz başarıyla iptal edildi."}`))
}

func (h *StoreOrdersHandler) SubmitPaymentNotification(w http.ResponseWriter, r *http.Request) {
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
		http.Error(w, `{"error":"Banka adı, gönderen kişi adı ve geçerli bir tutar zorunludur"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	var exists bool
	err = db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.orders WHERE id = $1 AND user_id = $2)", orderID, userID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	}

	query := `
		INSERT INTO catalog.payment_notifications (order_id, user_id, bank_name, sender_name, amount, notes, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
	`
	_, err = db.Pool.Exec(ctx, query, orderID, userID, req.BankName, req.SenderName, req.Amount, req.Notes)
	if err != nil {
		log.Printf("[PAYMENT NOTIFICATION ERROR] Failed to insert: %v", err)
		http.Error(w, `{"error":"Ödeme bildirimi kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true,"message":"Ödeme bildiriminiz başarıyla iletildi."}`))
}

func insertFullRefundItems(ctx context.Context, tx pgx.Tx, refundID, orderID string) error {
	rows, err := tx.Query(ctx, "SELECT id, quantity FROM catalog.order_items WHERE order_id = $1", orderID)
	if err != nil {
		return err
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
			return err
		}
	}
	return nil
}

func insertPartialRefundItems(ctx context.Context, tx pgx.Tx, refundID, orderID string, items []RefundRequestItem) error {
	if len(items) == 0 {
		return fmt.Errorf("Kısmi iade için kalem seçilmelidir")
	}

	for _, reqItem := range items {
		var orderQty int
		err := tx.QueryRow(ctx, `
			SELECT quantity FROM catalog.order_items WHERE id = $1 AND order_id = $2
		`, reqItem.OrderItemID, orderID).Scan(&orderQty)
		if err == pgx.ErrNoRows {
			return fmt.Errorf("İade edilmek istenen sipariş kalemi bulunamadı")
		} else if err != nil {
			return err
		}

		if reqItem.Quantity <= 0 || reqItem.Quantity > orderQty {
			return fmt.Errorf("Geçersiz iade adeti. Maksimum iade edilebilir adet: %d", orderQty)
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO catalog.refund_items (refund_id, order_item_id, quantity)
			VALUES ($1, $2, $3)
		`, refundID, reqItem.OrderItemID, reqItem.Quantity)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *StoreOrdersHandler) RequestRefund(w http.ResponseWriter, r *http.Request) {
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
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var orderStatus string
	err = tx.QueryRow(ctx, `
		SELECT order_status FROM catalog.orders WHERE id = $1 AND user_id = $2 FOR UPDATE
	`, orderID, userID).Scan(&orderStatus)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"Sipariş sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	if orderStatus != "COMPLETED" && orderStatus != "APPROVED" {
		http.Error(w, `{"error":"Sadece onaylı veya tamamlanmış siparişler için iade talep edilebilir"}`, http.StatusBadRequest)
		return
	}

	var refundID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.refunds (order_id, user_id, refund_type, refund_status, reason)
		VALUES ($1, $2, $3, 'REQUESTED', $4)
		RETURNING id
	`, orderID, userID, req.RefundType, req.Reason).Scan(&refundID)
	if err != nil {
		http.Error(w, `{"error":"İade talebi oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	if req.RefundType == "FULL" {
		if err := insertFullRefundItems(ctx, tx, refundID, orderID); err != nil {
			http.Error(w, `{"error":"İade kalemleri oluşturulamadı"}`, http.StatusInternalServerError)
			return
		}
	} else {
		if err := insertPartialRefundItems(ctx, tx, refundID, orderID, req.Items); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true,"message":"İade talebiniz başarıyla alınmıştır."}`))
}

type excelItem struct {
	ProductName     string
	ProductSKU      string
	Quantity        int
	PriceAtPurchase float64
	TotalLineAmount float64
}

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
	Items           []excelItem
}

func fetchOrderExcelData(ctx context.Context, orderID, userID string) (*excelData, error) {
	var d excelData
	var oCreatedAt time.Time
	var firstName, lastName, email string

	err := db.Pool.QueryRow(ctx, `
		SELECT o.order_number, o.created_at, o.order_status, o.total_amount, o.payment_method, o.billing_address, o.delivery_address,
		       u.first_name, u.last_name, u.email
		FROM catalog.orders o
		INNER JOIN identity.users u ON o.user_id = u.id
		WHERE o.id = $1 AND o.user_id = $2
	`, orderID, userID).Scan(
		&d.OrderNumber, &oCreatedAt, &d.OrderStatus, &d.TotalAmount, &d.PaymentMethod, &d.BillingAddress, &d.DeliveryAddress,
		&firstName, &lastName, &email,
	)
	if err != nil {
		return nil, err
	}

	d.CreatedAt = oCreatedAt.Format("02.01.2006 15:04")
	d.UserFullName = firstName + " " + lastName
	d.UserEmail = email
	d.Currency = "TL"

	rows, err := db.Pool.Query(ctx, `
		SELECT product_name, product_sku, quantity, price_at_purchase
		FROM catalog.order_items
		WHERE order_id = $1
		ORDER BY created_at ASC
	`, orderID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var item excelItem
			var sku *string
			if err := rows.Scan(&item.ProductName, &sku, &item.Quantity, &item.PriceAtPurchase); err == nil {
				if sku != nil {
					item.ProductSKU = *sku
				}
				item.TotalLineAmount = item.PriceAtPurchase * float64(item.Quantity)
				d.Items = append(d.Items, item)
			}
		}
	}

	return &d, nil
}

func (h *StoreOrdersHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
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

	d, err := fetchOrderExcelData(r.Context(), orderID, userID)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"Fatura oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	tmplContent := `
	<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
	<head><meta charset="utf-8"/></head>
	<body>
		<table border="1">
			<tr><th colspan="4" style="font-size:16px; font-weight:bold; background-color:#f2f2f2;">MERTER VITRINI - SIPARIS DETAY FORMU</th></tr>
			<tr><td><b>Sipariş No:</b></td><td>{{.OrderNumber}}</td><td><b>Tarih:</b></td><td>{{.CreatedAt}}</td></tr>
			<tr><td><b>Müşteri:</b></td><td>{{.UserFullName}} ({{.UserEmail}})</td><td><b>Ödeme Yöntemi:</b></td><td>{{.PaymentMethod}}</td></tr>
			<tr><td><b>Fatura Adresi:</b></td><td colspan="3">{{.BillingAddress}}</td></tr>
			<tr><td><b>Teslimat Adresi:</b></td><td colspan="3">{{.DeliveryAddress}}</td></tr>
			<tr><td colspan="4"></td></tr>
			<tr style="background-color:#eaeaea; font-weight:bold;">
				<th>Ürün Adı</th><th>SKU / Kod</th><th>Adet</th><th>Birim Fiyat</th>
			</tr>
			{{range .Items}}
			<tr>
				<td>{{.ProductName}}</td>
				<td>{{.ProductSKU}}</td>
				<td>{{.Quantity}}</td>
				<td>{{printf "%.2f" .PriceAtPurchase}} TL</td>
			</tr>
			{{end}}
			<tr style="font-weight:bold;">
				<td colspan="3" align="right">Toplam Tutar:</td>
				<td>{{printf "%.2f" .TotalAmount}} {{.Currency}}</td>
			</tr>
		</table>
	</body>
	</html>`

	tmpl, err := template.New("excel").Parse(tmplContent)
	if err != nil {
		http.Error(w, `{"error":"Şablon hatası"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, "application/vnd.ms-excel; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=siparis-%s.xls", d.OrderNumber))
	_ = tmpl.Execute(w, d)
}

type imgItem struct {
	SKU      string
	ImageURL string
}

func buildZipArchive(images []imgItem) (*bytes.Buffer, error) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)
	addedFiles := make(map[string]int)

	for _, img := range images {
		localPath := getLocalImagePath(img.ImageURL)
		if localPath == "" {
			continue
		}

		file, err := os.Open(localPath)
		if err != nil {
			continue
		}

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

		_, _ = io.Copy(fWriter, file)
		file.Close()
	}

	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf, nil
}

func fetchOrderNumber(ctx context.Context, orderID, userID string) (string, error) {
	var orderNumber string
	err := db.Pool.QueryRow(ctx, `
		SELECT order_number FROM catalog.orders WHERE id = $1 AND user_id = $2
	`, orderID, userID).Scan(&orderNumber)
	return orderNumber, err
}

func fetchOrderImages(ctx context.Context, orderID string) ([]imgItem, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT product_sku, image_url_at_purchase
		FROM catalog.order_items
		WHERE order_id = $1
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var images []imgItem
	for rows.Next() {
		var img imgItem
		var sku, url *string
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
	return images, nil
}

func (h *StoreOrdersHandler) DownloadImagesZip(w http.ResponseWriter, r *http.Request) {
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

	orderNumber, err := fetchOrderNumber(r.Context(), orderID, userID)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"Sipariş bilgisi okunamadı"}`, http.StatusInternalServerError)
		return
	}

	images, err := fetchOrderImages(r.Context(), orderID)
	if err != nil {
		http.Error(w, `{"error":"Görsel bilgileri sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	if len(images) == 0 {
		http.Error(w, `{"error":"Siparişe ait görsel bulunamadı"}`, http.StatusNotFound)
		return
	}

	buf, err := buildZipArchive(images)
	if err != nil {
		http.Error(w, `{"error":"Arşiv oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=gorseller-%s.zip", orderNumber))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", buf.Len()))
	w.Write(buf.Bytes())
}
