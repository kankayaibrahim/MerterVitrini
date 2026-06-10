package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/admin/backend/config"
	"mertervitrini/admin/backend/db"
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
	ID              string    `json:"id"`
	OrderNumber     string    `json:"order_number"`
	TotalAmount     float64   `json:"total_amount"`
	PaymentMethod   string    `json:"payment_method"`
	OrderStatus     string    `json:"order_status"`
	BillingAddress  string    `json:"billing_address"`
	DeliveryAddress string    `json:"delivery_address"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	UserID          string    `json:"user_id"`
	UserFirstName   string    `json:"user_first_name"`
	UserLastName    string    `json:"user_last_name"`
	UserEmail       string    `json:"user_email"`
}

type AdminOrderListResponse struct {
	Orders []AdminOrderListItem `json:"orders"`
	Total  int                  `json:"total"`
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

func (h *AdminOrdersHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	search := strings.TrimSpace(r.URL.Query().Get("search"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))

	limit := 50
	offset := 0

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

	ctx := r.Context()

	// Build filter queries
	whereClause := "WHERE 1=1"
	var args []any
	paramIdx := 1

	if search != "" {
		whereClause += fmt.Sprintf(" AND (o.order_number ILIKE $%d OR u.first_name ILIKE $%d OR u.last_name ILIKE $%d OR u.email ILIKE $%d)", paramIdx, paramIdx, paramIdx, paramIdx)
		args = append(args, "%"+search+"%")
		paramIdx++
	}

	if status != "" {
		whereClause += fmt.Sprintf(" AND o.order_status = $%d", paramIdx)
		args = append(args, status)
		paramIdx++
	}

	// Count total query
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM catalog.orders o
		INNER JOIN identity.users u ON o.user_id = u.id
		%s
	`, whereClause)

	var total int
	err := db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Failed to count orders: %v", err)
		http.Error(w, `{"error":"Sipariş adeti sorgulanamadı"}`, http.StatusInternalServerError)
		return
	}

	// Select query with pagination
	selectQuery := fmt.Sprintf(`
		SELECT o.id, o.order_number, o.total_amount, o.payment_method, o.order_status, 
		       COALESCE(o.billing_address, '') as billing_address, COALESCE(o.delivery_address, '') as delivery_address, 
		       o.created_at, o.updated_at,
		       u.id as user_id, u.first_name, u.last_name, u.email
		FROM catalog.orders o
		INNER JOIN identity.users u ON o.user_id = u.id
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
		err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.TotalAmount, &o.PaymentMethod, &o.OrderStatus,
			&o.BillingAddress, &o.DeliveryAddress, &o.CreatedAt, &o.UpdatedAt,
			&o.UserID, &o.UserFirstName, &o.UserLastName, &o.UserEmail,
		)
		if err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Scan row failed: %v", err)
			continue
		}
		orders = append(orders, o)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AdminOrderListResponse{
		Orders: orders,
		Total:  total,
	})
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
		ID              string    `json:"id"`
		OrderNumber     string    `json:"order_number"`
		TotalAmount     float64   `json:"total_amount"`
		PaymentMethod   string    `json:"payment_method"`
		OrderStatus     string    `json:"order_status"`
		BillingAddress  string    `json:"billing_address"`
		DeliveryAddress string    `json:"delivery_address"`
		CreatedAt       time.Time `json:"created_at"`
		UpdatedAt       time.Time `json:"updated_at"`
		User            struct {
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

	err := db.Pool.QueryRow(ctx, `
		SELECT o.id, o.order_number, o.total_amount, o.payment_method, o.order_status, 
		       COALESCE(o.billing_address, '') as billing_address, COALESCE(o.delivery_address, '') as delivery_address, 
		       o.created_at, o.updated_at,
		       u.id, u.first_name, u.last_name, u.email, COALESCE(u.phone, '') as phone
		FROM catalog.orders o
		INNER JOIN identity.users u ON o.user_id = u.id
		WHERE o.id = $1
	`, orderID).Scan(
		&d.ID, &d.OrderNumber, &d.TotalAmount, &d.PaymentMethod, &d.OrderStatus,
		&d.BillingAddress, &d.DeliveryAddress, &d.CreatedAt, &d.UpdatedAt,
		&d.User.ID, &d.User.FirstName, &d.User.LastName, &d.User.Email, &d.User.Phone,
	)

	if err == pgx.ErrNoRows {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] GetOrder failed: %v", err)
		http.Error(w, `{"error":"Sipariş detayları alınamadı"}`, http.StatusInternalServerError)
		return
	}

	d.Items = []map[string]any{}
	d.PaymentNotifications = []map[string]any{}
	d.Refunds = []map[string]any{}

	// Query items
	rows, err := db.Pool.Query(ctx, `
		SELECT id, product_id, product_name, product_sku, quantity, price_at_purchase, image_url_at_purchase, created_at
		FROM catalog.order_items
		WHERE order_id = $1
		ORDER BY created_at ASC
	`, orderID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, name, sku, img string
			var quantity int
			var price float64
			var created time.Time
			var prodID *string
			if err := rows.Scan(&id, &prodID, &name, &sku, &quantity, &price, &img, &created); err == nil {
				item := map[string]any{
					"id":                     id,
					"product_name":           name,
					"product_sku":            sku,
					"quantity":               quantity,
					"price_at_purchase":      price,
					"image_url_at_purchase":  img,
					"created_at":             created,
				}
				if prodID != nil {
					item["product_id"] = *prodID
				}
				d.Items = append(d.Items, item)
			}
		}
	}

	// Query payment notifications
	pRows, err := db.Pool.Query(ctx, `
		SELECT id, bank_name, sender_name, amount, notification_status, COALESCE(notes, '') as notes, created_at
		FROM catalog.payment_notifications
		WHERE order_id = $1
		ORDER BY created_at DESC
	`, orderID)
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var id, bank, sender, status, notes string
			var amount float64
			var created time.Time
			if err := pRows.Scan(&id, &bank, &sender, &amount, &status, &notes, &created); err == nil {
				d.PaymentNotifications = append(d.PaymentNotifications, map[string]any{
					"id":                  id,
					"bank_name":           bank,
					"sender_name":         sender,
					"amount":              amount,
					"notification_status": status,
					"notes":               notes,
					"created_at":          created,
				})
			}
		}
	}

	// Query refunds
	rRows, err := db.Pool.Query(ctx, `
		SELECT id, refund_type, refund_status, COALESCE(reason, '') as reason, created_at
		FROM catalog.refunds
		WHERE order_id = $1
		ORDER BY created_at DESC
	`, orderID)
	if err == nil {
		defer rRows.Close()
		for rRows.Next() {
			var id, refType, status, reason string
			var created time.Time
			if err := rRows.Scan(&id, &refType, &status, &reason, &created); err == nil {
				// Query items for this refund
				refItems := []map[string]any{}
				riRows, riErr := db.Pool.Query(ctx, `
					SELECT ri.id, ri.order_item_id, ri.quantity, oi.product_name, oi.product_sku
					FROM catalog.refund_items ri
					JOIN catalog.order_items oi ON ri.order_item_id = oi.id
					WHERE ri.refund_id = $1
				`, id)
				if riErr == nil {
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
					riRows.Close()
				}

				d.Refunds = append(d.Refunds, map[string]any{
					"id":            id,
					"refund_type":   refType,
					"refund_status": status,
					"reason":        reason,
					"created_at":    created,
					"items":         refItems,
				})
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
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
		tx.Commit(ctx)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true,"message":"Order status is already set to target status."}`))
		return
	}

	// Stock restoration if transitioning to CANCELLED from a non-cancelled status
	if newStatus == "CANCELLED" && currentStatus != "CANCELLED" {
		rows, err := tx.Query(ctx, `
			SELECT product_id, quantity 
			FROM catalog.order_items 
			WHERE order_id = $1
		`, orderID)
		if err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Failed to query items: %v", err)
			http.Error(w, `{"error":"Sipariş kalemleri sorgulanamadı"}`, http.StatusInternalServerError)
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

		for _, item := range restItems {
			// Restore product stock
			_, err = tx.Exec(ctx, `
				UPDATE catalog.products 
				SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
				WHERE id = $2
			`, item.Quantity, item.ProductID)
			if err != nil {
				log.Printf("[ADMIN ORDERS ERROR] Failed to restore stock: %v", err)
				http.Error(w, `{"error":"Stok güncellemesi başarısız"}`, http.StatusInternalServerError)
				return
			}

			// Restore variant stock
			var seriesRatio string
			err = tx.QueryRow(ctx, "SELECT series_ratio FROM catalog.products WHERE id = $1", item.ProductID).Scan(&seriesRatio)
			if err != nil {
				continue
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
							log.Printf("[ADMIN ORDERS ERROR] Failed to restore variant stock: %v", err)
						}
					}
				}
			}
		}
	}

	// Update order status
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

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Failed to commit: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
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

	// Update notification status
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

	// If approved, set order status to APPROVED
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

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Commit failed: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"success":true,"message":"Ödeme bildirimi başarıyla %s durumuna getirildi."}`, targetStatus)))
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

	// Update refund status
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
		// Restock inventory for items in this refund request
		rows, err := tx.Query(ctx, `
			SELECT ri.quantity, oi.product_id 
			FROM catalog.refund_items ri
			JOIN catalog.order_items oi ON ri.order_item_id = oi.id
			WHERE ri.refund_id = $1
		`, refundID)
		if err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Query refund items failed: %v", err)
			http.Error(w, `{"error":"İade kalemleri okunamadı"}`, http.StatusInternalServerError)
			return
		}

		type restItem struct {
			ProductID string
			Quantity  int
		}
		var restList []restItem
		for rows.Next() {
			var ri restItem
			var prodID *string
			if err := rows.Scan(&ri.Quantity, &prodID); err == nil && prodID != nil {
				ri.ProductID = *prodID
				restList = append(restList, ri)
			}
		}
		rows.Close()

		for _, item := range restList {
			// Restore product stock
			_, err = tx.Exec(ctx, `
				UPDATE catalog.products 
				SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
				WHERE id = $2
			`, item.Quantity, item.ProductID)
			if err != nil {
				log.Printf("[ADMIN ORDERS ERROR] Restock product stock failed: %v", err)
			}

			// Restore variant stocks
			var seriesRatio string
			err = tx.QueryRow(ctx, "SELECT series_ratio FROM catalog.products WHERE id = $1", item.ProductID).Scan(&seriesRatio)
			if err != nil {
				continue
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
							log.Printf("[ADMIN ORDERS ERROR] Restock variant stock failed: %v", err)
						}
					}
				}
			}
		}

		// Check if order is fully or partially refunded
		var originalTotalQty, refundedTotalQty int
		
		err = tx.QueryRow(ctx, `
			SELECT COALESCE(SUM(quantity), 0) FROM catalog.order_items WHERE order_id = $1
		`, orderID).Scan(&originalTotalQty)
		if err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Query sum order items failed: %v", err)
		}

		err = tx.QueryRow(ctx, `
			SELECT COALESCE(SUM(ri.quantity), 0)
			FROM catalog.refund_items ri
			JOIN catalog.refunds r ON ri.refund_id = r.id
			WHERE r.order_id = $1 AND r.refund_status = 'APPROVED'
		`, orderID).Scan(&refundedTotalQty)
		if err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Query sum refunded items failed: %v", err)
		}

		targetOrderStatus := "PARTIALLY_REFUNDED"
		if refundedTotalQty >= originalTotalQty && originalTotalQty > 0 {
			targetOrderStatus = "REFUNDED"
		}

		_, err = tx.Exec(ctx, `
			UPDATE catalog.orders 
			SET order_status = $1, updated_at = CURRENT_TIMESTAMP 
			WHERE id = $2
		`, targetOrderStatus, orderID)
		if err != nil {
			log.Printf("[ADMIN ORDERS ERROR] Update order status to refunded failed: %v", err)
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[ADMIN ORDERS ERROR] Commit failed: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"success":true,"message":"İade talebi başarıyla %s olarak güncellendi."}`, targetStatus)))
}
