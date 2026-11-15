package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
)

type AdminOrdersHandler struct {
	Cfg *config.Config
}

func NewAdminOrdersHandler(cfg *config.Config) *AdminOrdersHandler {
	return &AdminOrdersHandler{Cfg: cfg}
}

type UpdateStatusRequest struct {
	Status string `json:"status"`
}

type VerifyRequest struct {
	Status string `json:"status"` // APPROVED or REJECTED
}

type AdminOrderListItem struct {
	ID                  string             `json:"id"`
	OrderNumber         string             `json:"order_number"`
	TotalAmount         float64            `json:"total_amount"`
	Currency            string             `json:"currency"`
	CustomerCurrency    string             `json:"customer_currency"`
	CustomerTotalAmount float64            `json:"customer_total_amount"`
	TotalAmountTRY      float64            `json:"total_amount_try"`
	CurrencyTotals      map[string]float64 `json:"currency_totals"`
	PaymentMethod       string             `json:"payment_method"`
	OrderStatus         string             `json:"order_status"`
	BillingAddress      string             `json:"billing_address"`
	DeliveryAddress     string             `json:"delivery_address"`
	CreatedAt           time.Time          `json:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"`
	UserID              string             `json:"user_id"`
	UserFirstName       string             `json:"user_first_name"`
	UserLastName        string             `json:"user_last_name"`
	UserEmail           string             `json:"user_email"`
}

type AdminOrderListResponse struct {
	Orders []AdminOrderListItem `json:"orders"`
	Total  int                  `json:"total"`
}

func parsePagination(r *http.Request) (limit, offset int) {
	limit = 50
	offset = 0
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	}
	if oStr := r.URL.Query().Get("offset"); oStr != "" {
		if o, err := strconv.Atoi(oStr); err == nil && o >= 0 {
			offset = o
		}
	}
	return limit, offset
}

func buildOrdersFilter(search, status string) (whereClause string, args []any, paramIdx int) {
	whereClause = "WHERE 1=1"
	paramIdx = 1

	if search != "" {
		whereClause += fmt.Sprintf(
			" AND (o.order_number ILIKE $%d OR COALESCE(u.first_name, '') ILIKE $%d OR COALESCE(u.last_name, '') ILIKE $%d OR COALESCE(u.email, '') ILIKE $%d OR COALESCE(o.customer_name, '') ILIKE $%d OR COALESCE(o.customer_email, '') ILIKE $%d OR COALESCE(o.customer_phone, '') ILIKE $%d)",
			paramIdx, paramIdx, paramIdx, paramIdx, paramIdx, paramIdx, paramIdx,
		)
		args = append(args, "%"+search+"%")
		paramIdx++
	}

	if status != "" {
		whereClause += fmt.Sprintf(" AND o.order_status = $%d", paramIdx)
		args = append(args, status)
		paramIdx++
	}
	return whereClause, args, paramIdx
}

func (h *AdminOrdersHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	search := strings.TrimSpace(r.URL.Query().Get("search"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	limit, offset := parsePagination(r)
	ctx := r.Context()

	whereClause, args, paramIdx := buildOrdersFilter(search, status)

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM catalog.orders o
		LEFT JOIN identity.users u ON o.user_id = u.id
		%s
	`, whereClause)

	var total int
	err := db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Failed to count orders: %v", err)
		http.Error(w, `{"error":"Sipariş adeti sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	selectQuery := fmt.Sprintf(`
		SELECT o.id, o.order_number, o.total_amount,
		       COALESCE(NULLIF(UPPER(TRIM(o.currency)), ''), 'TRY') as currency,
		       COALESCE(NULLIF(UPPER(TRIM(o.customer_currency)), ''), '') as customer_currency,
		       COALESCE(o.customer_total_amount, 0) as customer_total_amount,
		       COALESCE(o.total_amount_try, 0) as total_amount_try,
		       COALESCE(o.currency_totals, '{}'::jsonb) as currency_totals,
		       o.payment_method, o.order_status, 
		       COALESCE(o.billing_address, '') as billing_address, COALESCE(o.delivery_address, '') as delivery_address, 
		       o.created_at, o.updated_at,
		       COALESCE(u.id::text, '') as user_id,
		       COALESCE(NULLIF(TRIM(u.first_name), ''), NULLIF(TRIM(o.customer_name), ''), 'Misafir Müşteri') as first_name,
		       COALESCE(u.last_name, '') as last_name,
		       COALESCE(NULLIF(TRIM(u.email), ''), COALESCE(o.customer_email, '')) as email
		FROM catalog.orders o
		LEFT JOIN identity.users u ON o.user_id = u.id
		%s
		ORDER BY o.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, paramIdx, paramIdx+1)

	args = append(args, limit, offset)

	rows, err := db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Failed to query orders: %v", err)
		http.Error(w, `{"error":"Siparişler sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	orders := []AdminOrderListItem{}
	for rows.Next() {
		var o AdminOrderListItem
		var rawTotals []byte
		err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.TotalAmount,
			&o.Currency, &o.CustomerCurrency, &o.CustomerTotalAmount, &o.TotalAmountTRY, &rawTotals,
			&o.PaymentMethod, &o.OrderStatus,
			&o.BillingAddress, &o.DeliveryAddress, &o.CreatedAt, &o.UpdatedAt,
			&o.UserID, &o.UserFirstName, &o.UserLastName, &o.UserEmail,
		)
		if err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Scan row failed: %v", err)
			continue
		}
		o.Currency = normalizeOrderCurrencyCode(o.Currency)
		if o.CustomerCurrency != "" {
			o.CustomerCurrency = normalizeOrderCurrencyCode(o.CustomerCurrency)
		}
		o.CurrencyTotals = parseCurrencyTotalsJSON(rawTotals, o.Currency, o.TotalAmount)
		orders = append(orders, o)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(AdminOrderListResponse{
		Orders: orders,
		Total:  total,
	})
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

func fetchOrderItems(ctx context.Context, orderID string) []map[string]any {
	rows, err := db.Pool.Query(ctx, `
		SELECT oi.id, oi.product_id, oi.product_name, oi.product_sku, oi.quantity, oi.price_at_purchase,
		       COALESCE(NULLIF(UPPER(TRIM(oi.currency)), ''), NULLIF(UPPER(TRIM(p.currency)), ''), 'TRY') as currency,
		       oi.image_url_at_purchase, oi.created_at
		FROM catalog.order_items oi
		LEFT JOIN catalog.products p ON p.id = oi.product_id
		WHERE oi.order_id = $1
		ORDER BY oi.created_at ASC
	`, orderID)
	if err != nil {
		return []map[string]any{}
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, name, sku, curr, img string
		var quantity int
		var price float64
		var created time.Time
		var prodID *string
		if err := rows.Scan(&id, &prodID, &name, &sku, &quantity, &price, &curr, &img, &created); err == nil {
			item := map[string]any{
				"id":                    id,
				"product_name":          name,
				"product_sku":           sku,
				"quantity":              quantity,
				"price_at_purchase":     price,
				"currency":              normalizeOrderCurrencyCode(curr),
				"image_url_at_purchase": img,
				"created_at":            created,
			}
			if prodID != nil {
				item["product_id"] = *prodID
			}
			items = append(items, item)
		}
	}
	return items
}

func fetchOrderPaymentNotifications(ctx context.Context, orderID string) []map[string]any {
	pRows, err := db.Pool.Query(ctx, `
		SELECT id, bank_name, sender_name, amount,
		       COALESCE(NULLIF(UPPER(TRIM(currency)), ''), 'TRY') as currency,
		       notification_status, COALESCE(notes, '') as notes, created_at
		FROM catalog.payment_notifications
		WHERE order_id = $1
		ORDER BY created_at DESC
	`, orderID)
	if err != nil {
		return []map[string]any{}
	}
	defer pRows.Close()

	notifications := []map[string]any{}
	for pRows.Next() {
		var id, bank, sender, curr, status, notes string
		var amount float64
		var created time.Time
		if err := pRows.Scan(&id, &bank, &sender, &amount, &curr, &status, &notes, &created); err == nil {
			notifications = append(notifications, map[string]any{
				"id":                  id,
				"bank_name":           bank,
				"sender_name":         sender,
				"amount":              amount,
				"currency":            normalizeOrderCurrencyCode(curr),
				"notification_status": status,
				"notes":               notes,
				"created_at":          created,
			})
		}
	}
	return notifications
}

func fetchRefundItems(ctx context.Context, refundID string) []map[string]any {
	riRows, riErr := db.Pool.Query(ctx, `
		SELECT ri.id, ri.order_item_id, ri.quantity, oi.product_name, oi.product_sku
		FROM catalog.refund_items ri
		JOIN catalog.order_items oi ON ri.order_item_id = oi.id
		WHERE ri.refund_id = $1
	`, refundID)
	if riErr != nil {
		return []map[string]any{}
	}
	defer riRows.Close()

	refItems := []map[string]any{}
	for riRows.Next() {
		var riID, oiID, pName, pSku string
		var qty int
		if err := riRows.Scan(&riID, &oiID, &qty, &pName, &pSku); err == nil {
			refItems = append(refItems, map[string]any{
				"id":            riID,
				"order_item_id": oiID,
				"quantity":      qty,
				"product_name":  pName,
				"product_sku":   pSku,
			})
		}
	}
	return refItems
}

func fetchOrderRefunds(ctx context.Context, orderID string) []map[string]any {
	rRows, err := db.Pool.Query(ctx, `
		SELECT id, refund_type, refund_status, COALESCE(reason, '') as reason, created_at
		FROM catalog.refunds
		WHERE order_id = $1
		ORDER BY created_at DESC
	`, orderID)
	if err != nil {
		return []map[string]any{}
	}
	defer rRows.Close()

	refunds := []map[string]any{}
	for rRows.Next() {
		var id, refType, status, reason string
		var created time.Time
		if err := rRows.Scan(&id, &refType, &status, &reason, &created); err == nil {
			refunds = append(refunds, map[string]any{
				"id":            id,
				"refund_type":   refType,
				"refund_status": status,
				"reason":        reason,
				"created_at":    created,
				"items":         fetchRefundItems(ctx, id),
			})
		}
	}
	return refunds
}

func restoreRefundStock(ctx context.Context, tx pgx.Tx, refundID string) error {
	rows, err := tx.Query(ctx, `
		SELECT ri.quantity, oi.product_id 
		FROM catalog.refund_items ri
		JOIN catalog.order_items oi ON ri.order_item_id = oi.id
		WHERE ri.refund_id = $1
	`, refundID)
	if err != nil {
		return err
	}
	defer rows.Close()

	type restItem struct {
		prodID string
		qty    int
	}
	var restList []restItem
	for rows.Next() {
		var ri restItem
		var prodID *string
		if err := rows.Scan(&ri.qty, &prodID); err == nil && prodID != nil {
			ri.prodID = *prodID
			restList = append(restList, ri)
		}
	}

	for _, item := range restList {
		_ = restoreProductAndVariantStock(ctx, tx, item.prodID, item.qty)
	}
	return nil
}

func updateRefundedOrderStatus(ctx context.Context, tx pgx.Tx, orderID string) {
	var originalTotalQty, refundedTotalQty int
	_ = tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(quantity), 0) FROM catalog.order_items WHERE order_id = $1
	`, orderID).Scan(&originalTotalQty)

	_ = tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(ri.quantity), 0)
		FROM catalog.refund_items ri
		JOIN catalog.refunds r ON ri.refund_id = r.id
		WHERE r.order_id = $1 AND r.refund_status = 'APPROVED'
	`, orderID).Scan(&refundedTotalQty)

	targetOrderStatus := "PARTIALLY_REFUNDED"
	if refundedTotalQty >= originalTotalQty && originalTotalQty > 0 {
		targetOrderStatus = "REFUNDED"
	}

	_, _ = tx.Exec(ctx, `
		UPDATE catalog.orders 
		SET order_status = $1, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $2
	`, targetOrderStatus, orderID)
}

func (h *AdminOrdersHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	orderID := r.PathValue("id")
	if orderID == "" {
		http.Error(w, `{"error":"Order ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	type orderDetail struct {
		ID                  string             `json:"id"`
		OrderNumber         string             `json:"order_number"`
		TotalAmount         float64            `json:"total_amount"`
		Currency            string             `json:"currency"`
		CustomerCurrency    string             `json:"customer_currency"`
		CustomerTotalAmount float64            `json:"customer_total_amount"`
		TotalAmountTRY      float64            `json:"total_amount_try"`
		CurrencyTotals      map[string]float64 `json:"currency_totals"`
		PaymentMethod       string             `json:"payment_method"`
		OrderStatus         string             `json:"order_status"`
		BillingAddress      string             `json:"billing_address"`
		DeliveryAddress     string             `json:"delivery_address"`
		CreatedAt           time.Time          `json:"created_at"`
		UpdatedAt           time.Time          `json:"updated_at"`
		User                struct {
			ID        string `json:"id"`
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Email     string `json:"email"`
			Phone     string `json:"phone"`
		} `json:"user"`
		Items                []map[string]any `json:"items"`
		PaymentNotifications []map[string]any `json:"payment_notifications"`
		Refunds              []map[string]any `json:"refunds"`
	}

	var d orderDetail
	var rawTotals []byte

	err := db.Pool.QueryRow(ctx, `
		SELECT o.id, o.order_number, o.total_amount,
		       COALESCE(NULLIF(UPPER(TRIM(o.currency)), ''), 'TRY'),
		       COALESCE(NULLIF(UPPER(TRIM(o.customer_currency)), ''), ''),
		       COALESCE(o.customer_total_amount, 0),
		       COALESCE(o.total_amount_try, 0),
		       COALESCE(o.currency_totals, '{}'::jsonb),
		       o.payment_method, o.order_status, 
		       COALESCE(o.billing_address, '') as billing_address, COALESCE(o.delivery_address, '') as delivery_address, 
		       o.created_at, o.updated_at,
		       COALESCE(u.id::text, ''),
		       COALESCE(NULLIF(TRIM(u.first_name), ''), NULLIF(TRIM(o.customer_name), ''), 'Misafir Müşteri'),
		       COALESCE(u.last_name, ''),
		       COALESCE(NULLIF(TRIM(u.email), ''), COALESCE(o.customer_email, '')),
		       COALESCE(NULLIF(TRIM(u.phone), ''), COALESCE(o.customer_phone, '')) as phone
		FROM catalog.orders o
		LEFT JOIN identity.users u ON o.user_id = u.id
		WHERE o.id = $1
	`, orderID).Scan(
		&d.ID, &d.OrderNumber, &d.TotalAmount,
		&d.Currency, &d.CustomerCurrency, &d.CustomerTotalAmount, &d.TotalAmountTRY, &rawTotals,
		&d.PaymentMethod, &d.OrderStatus,
		&d.BillingAddress, &d.DeliveryAddress, &d.CreatedAt, &d.UpdatedAt,
		&d.User.ID, &d.User.FirstName, &d.User.LastName, &d.User.Email, &d.User.Phone,
	)
	if err == nil {
		d.Currency = normalizeOrderCurrencyCode(d.Currency)
		if d.CustomerCurrency != "" {
			d.CustomerCurrency = normalizeOrderCurrencyCode(d.CustomerCurrency)
		}
		d.CurrencyTotals = parseCurrencyTotalsJSON(rawTotals, d.Currency, d.TotalAmount)
	}

	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] GetOrder failed: %v", err)
		http.Error(w, `{"error":"Sipariş detayları alınamadı"}`, http.StatusInternalServerError)
		return
	}

	d.Items = fetchOrderItems(ctx, orderID)
	d.PaymentNotifications = fetchOrderPaymentNotifications(ctx, orderID)
	d.Refunds = fetchOrderRefunds(ctx, orderID)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(d)
}

func (h *AdminOrdersHandler) UpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	orderID := r.PathValue("id")
	if orderID == "" {
		http.Error(w, `{"error":"Order ID is required"}`, http.StatusBadRequest)
		return
	}

	var req UpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	newStatus := strings.TrimSpace(req.Status)
	if newStatus == "" {
		http.Error(w, `{"error":"Status is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Fail begin tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	err = tx.QueryRow(ctx, "SELECT order_status FROM catalog.orders WHERE id = $1 FOR UPDATE", orderID).Scan(&currentStatus)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Get order status failed: %v", err)
		http.Error(w, `{"error":"Sipariş sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	if currentStatus == newStatus {
		_ = tx.Commit(ctx)
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.Write([]byte(`{"success":true,"message":"Order status is already set to target status."}`))
		return
	}

	// Stock & sub-order cancellation restoration if transitioning to CANCELLED from a non-cancelled status
	if newStatus == "CANCELLED" && currentStatus != "CANCELLED" {
		if err := restoreOrderStock(ctx, tx, orderID); err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Failed to restore stock: %v", err)
			http.Error(w, `{"error":"Stok güncellemesi başarısız"}`, http.StatusInternalServerError)
			return
		}
		if err := cancelSupplierSubOrdersForOrder(ctx, tx, orderID, "Yönetici tarafından sipariş iptal edildi"); err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Failed to cancel supplier sub-orders: %v", err)
			http.Error(w, `{"error":"Tedarikçi alt siparişleri iptal edilemedi"}`, http.StatusInternalServerError)
			return
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE catalog.orders 
		SET order_status = $1, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $2
	`, newStatus, orderID)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Failed to update status: %v", err)
		http.Error(w, `{"error":"Sipariş durumu güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(ctx); err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Failed to commit: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true,"message":"Sipariş durumu başarıyla güncellendi."}`))
}

func (h *AdminOrdersHandler) VerifyPaymentNotification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	notifID := r.PathValue("id")
	if notifID == "" {
		http.Error(w, `{"error":"Notification ID is required"}`, http.StatusBadRequest)
		return
	}

	var req VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	targetStatus := strings.ToUpper(strings.TrimSpace(req.Status))
	if targetStatus != "APPROVED" && targetStatus != "REJECTED" {
		http.Error(w, `{"error":"Status APPROVED or REJECTED required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Fail begin tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var orderID, currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT order_id, notification_status 
		FROM catalog.payment_notifications 
		WHERE id = $1 FOR UPDATE
	`, notifID).Scan(&orderID, &currentStatus)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Ödeme bildirimi bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Query notification failed: %v", err)
		http.Error(w, `{"error":"Ödeme bildirimi sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	if currentStatus != "PENDING" {
		http.Error(w, `{"error":"Bu ödeme bildirimi zaten karara bağlanmıştır"}`, http.StatusBadRequest)
		return
	}

	_, err = tx.Exec(ctx, `
		UPDATE catalog.payment_notifications 
		SET notification_status = $1 
		WHERE id = $2
	`, targetStatus, notifID)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Update notification failed: %v", err)
		http.Error(w, `{"error":"Ödeme bildirimi güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	if targetStatus == "APPROVED" {
		_, err = tx.Exec(ctx, `
			UPDATE catalog.orders 
			SET order_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP 
			WHERE id = $1
		`, orderID)
		if err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Update order status failed: %v", err)
			http.Error(w, `{"error":"Sipariş durumu onaylanamadı"}`, http.StatusInternalServerError)
			return
		}
	}

	if err = tx.Commit(ctx); err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Commit failed: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write(fmt.Appendf(nil, `{"success":true,"message":"Ödeme bildirimi başarıyla %s durumuna getirildi."}`, targetStatus))
}

func (h *AdminOrdersHandler) VerifyRefund(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	refundID := r.PathValue("id")
	if refundID == "" {
		http.Error(w, `{"error":"Refund ID is required"}`, http.StatusBadRequest)
		return
	}

	var req VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	targetStatus := strings.ToUpper(strings.TrimSpace(req.Status))
	if targetStatus != "APPROVED" && targetStatus != "REJECTED" {
		http.Error(w, `{"error":"Status APPROVED or REJECTED required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Fail begin tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var orderID, currentStatus, refundType string
	err = tx.QueryRow(ctx, `
		SELECT order_id, refund_status, refund_type 
		FROM catalog.refunds 
		WHERE id = $1 FOR UPDATE
	`, refundID).Scan(&orderID, &currentStatus, &refundType)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"İade talebi bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Query refund failed: %v", err)
		http.Error(w, `{"error":"İade talebi sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	if currentStatus != "REQUESTED" {
		http.Error(w, `{"error":"Bu iade talebi zaten karara bağlanmıştır"}`, http.StatusBadRequest)
		return
	}

	_, err = tx.Exec(ctx, `
		UPDATE catalog.refunds 
		SET refund_status = $1 
		WHERE id = $2
	`, targetStatus, refundID)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Update refund status failed: %v", err)
		http.Error(w, `{"error":"İade talebi güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	if targetStatus == "APPROVED" {
		if err := restoreRefundStock(ctx, tx, refundID); err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Query refund items failed: %v", err)
			http.Error(w, `{"error":"İade kalemleri okunamadı"}`, http.StatusInternalServerError)
			return
		}
		updateRefundedOrderStatus(ctx, tx, orderID)
	}

	if err = tx.Commit(ctx); err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Commit failed: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write(fmt.Appendf(nil, `{"success":true,"message":"İade talebi başarıyla %s olarak güncellendi."}`, targetStatus))
}

// DeleteOrder permanently removes a CANCELLED or PENDING_PAYMENT test/fake order after safely restoring stock and supplier balances.
func (h *AdminOrdersHandler) DeleteOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	orderID := strings.TrimSpace(r.PathValue("id"))
	if orderID == "" {
		http.Error(w, `{"error":"Order ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] DeleteOrder begin tx failed: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var orderNumber, orderStatus string
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(order_number, ''), order_status
		FROM catalog.orders
		WHERE id = $1
		FOR UPDATE
	`, orderID).Scan(&orderNumber, &orderStatus)
	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] DeleteOrder query order failed: %v", err)
		http.Error(w, `{"error":"Sipariş sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	statusUpper := strings.ToUpper(strings.TrimSpace(orderStatus))
	if statusUpper != "CANCELLED" && statusUpper != "PENDING_PAYMENT" {
		http.Error(w, `{"error":"Yalnızca 'Ödeme Bekliyor' veya 'İptal Edildi' durumundaki test/sahte siparişler kalıcı olarak silinebilir. Önce siparişi iptal edin."}`, http.StatusBadRequest)
		return
	}

	if statusUpper != "CANCELLED" {
		if err := restoreOrderStock(ctx, tx, orderID); err != nil {
			log.Printf("[ADMIN ORDERS ERROR] DeleteOrder restore stock failed: %v", err)
			http.Error(w, `{"error":"Stok güncellemesi başarısız"}`, http.StatusInternalServerError)
			return
		}
		if err := cancelSupplierSubOrdersForOrder(ctx, tx, orderID, "Test/sahte sipariş kalıcı olarak silindi"); err != nil {
			log.Printf("[ADMIN ORDERS ERROR] DeleteOrder cancel sub-orders failed: %v", err)
			http.Error(w, `{"error":"Tedarikçi alt siparişleri iptal edilemedi"}`, http.StatusInternalServerError)
			return
		}
	}

	cleanupQueries := []string{
		`DELETE FROM catalog.refund_items WHERE refund_id IN (SELECT id FROM catalog.refunds WHERE order_id = $1)`,
		`DELETE FROM catalog.refunds WHERE order_id = $1`,
		`DELETE FROM catalog.payment_notifications WHERE order_id = $1`,
		`DELETE FROM catalog.supplier_sub_orders WHERE order_id = $1`,
		`DELETE FROM catalog.order_items WHERE order_id = $1`,
		`DELETE FROM catalog.orders WHERE id = $1`,
	}
	for _, q := range cleanupQueries {
		if _, err := tx.Exec(ctx, q, orderID); err != nil {
			log.Printf("[ADMIN ORDERS ERROR] DeleteOrder cleanup failed (%s): %v", q, err)
			http.Error(w, `{"error":"Sipariş kayıtları silinemedi"}`, http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("[ADMIN ORDERS ERROR] DeleteOrder commit failed: %v", err)
		http.Error(w, `{"error":"Sipariş silme işlemi tamamlanamadı"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("[ADMIN ORDERS] Permanently deleted test/fake order %s (id=%s)", orderNumber, orderID)
	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Sipariş kalıcı olarak silindi.",
	})
}

