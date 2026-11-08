package handlers

import (
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpx"
)

type QuickProductUpdateRequest struct {
	Price       *float64 `json:"price,omitempty"`
	BuyingPrice *float64 `json:"buying_price,omitempty"`
	IsActive    *bool    `json:"is_active,omitempty"`
	Stock       *int     `json:"stock,omitempty"`
}

func (h *MobileHandler) GetSupplierDashboard(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, errMsgUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	var totalProducts, activeProducts, passiveProducts, totalStock, lowStockCount int
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE is_active = true),
			COUNT(*) FILTER (WHERE is_active = false),
			COALESCE(SUM(stock), 0),
			COUNT(*) FILTER (WHERE is_active = true AND stock <= 12)
		FROM catalog.products
		WHERE brand_id = $1 AND deleted_at IS NULL
	`, claims.BrandID).Scan(&totalProducts, &activeProducts, &passiveProducts, &totalStock, &lowStockCount)

	var pendingOrders, preparingOrders int
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'PENDING'),
			COUNT(*) FILTER (WHERE status IN ('ACCEPTED', 'PREPARING'))
		FROM catalog.supplier_sub_orders
		WHERE brand_id = $1
	`, claims.BrandID).Scan(&pendingOrders, &preparingOrders)

	var unreadChats int
	_ = db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(unread_supplier_count), 0)
		FROM catalog.chat_rooms
		WHERE brand_id = $1
	`, claims.BrandID).Scan(&unreadChats)

	var pendingBal, availBal, withdrawnBal, commRate float64
	_ = db.Pool.QueryRow(ctx, `
		SELECT pending_balance, available_balance, withdrawn_balance, commission_rate
		FROM catalog.supplier_wallets
		WHERE brand_id = $1
	`, claims.BrandID).Scan(&pendingBal, &availBal, &withdrawnBal, &commRate)

	httpx.JSON(w, http.StatusOK, map[string]any{
		"supplier": claims,
		"kpis": map[string]any{
			"total_products":         totalProducts,
			"active_products":        activeProducts,
			"passive_products":       passiveProducts,
			"total_stock":            totalStock,
			"low_stock_count":        lowStockCount,
			"pending_orders_count":   pendingOrders,
			"preparing_orders_count": preparingOrders,
			"unread_chats_count":     unreadChats,
		},
		"wallet": map[string]any{
			"pending_balance":   pendingBal,
			"available_balance": availBal,
			"withdrawn_balance": withdrawnBal,
			"commission_rate":   commRate,
			"currency":          "TRY",
		},
		"recent_orders":      fetchSupplierRecentSubOrders(ctx, claims.BrandID),
		"low_stock_products": fetchSupplierLowStockProducts(ctx, claims.BrandID),
	})
}

func fetchSupplierRecentSubOrders(ctx context.Context, brandID string) []models.SupplierSubOrder {
	orders := make([]models.SupplierSubOrder, 0, 5)
	rows, err := db.Pool.Query(ctx, `
		SELECT so.id, so.order_id, so.brand_id, b.brand_name, so.sub_order_number,
		       so.gross_amount, so.commission_rate, so.commission_amount, so.net_payout_amount,
		       so.currency, so.status, so.tracking_company, so.tracking_number, so.notes,
		       so.created_at, so.updated_at
		FROM catalog.supplier_sub_orders so
		JOIN catalog.brands b ON b.id = so.brand_id
		WHERE so.brand_id = $1
		ORDER BY so.created_at DESC
		LIMIT 5
	`, brandID)
	if err != nil {
		return orders
	}
	defer rows.Close()
	for rows.Next() {
		var o models.SupplierSubOrder
		if err := rows.Scan(
			&o.ID, &o.OrderID, &o.BrandID, &o.BrandName, &o.SubOrderNumber,
			&o.GrossAmount, &o.CommissionRate, &o.CommissionAmount, &o.NetPayoutAmount,
			&o.Currency, &o.Status, &o.TrackingCompany, &o.TrackingNumber, &o.Notes,
			&o.CreatedAt, &o.UpdatedAt,
		); err == nil {
			orders = append(orders, o)
		}
	}
	return orders
}

func fetchSupplierLowStockProducts(ctx context.Context, brandID string) []map[string]any {
	items := make([]map[string]any, 0, 8)
	rows, err := db.Pool.Query(ctx, `
		SELECT p.id::text, p.title, p.custom_sku, p.price, p.currency, p.stock,
		       COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY is_cover DESC, sort_order ASC LIMIT 1), '')
		FROM catalog.products p
		WHERE p.brand_id = $1 AND p.is_active = true AND p.deleted_at IS NULL AND p.stock <= 12
		ORDER BY p.stock ASC, p.updated_at DESC
		LIMIT 8
	`, brandID)
	if err != nil {
		return items
	}
	defer rows.Close()
	for rows.Next() {
		var id, title, sku, currency, img string
		var price float64
		var stock int
		if err := rows.Scan(&id, &title, &sku, &price, &currency, &stock, &img); err == nil {
			items = append(items, map[string]any{
				"id":         id,
				"title":      title,
				"custom_sku": sku,
				"price":      price,
				"currency":   currency,
				"stock":      stock,
				"image_url":  img,
			})
		}
	}
	return items
}

// UploadSupplierImagesBatch accepts multiple camera/gallery photos via injected MediaProcessor.
func (h *MobileHandler) UploadSupplierImagesBatch(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.GetSupplierFromContext(r.Context()); !ok {
		httpx.Error(w, http.StatusUnauthorized, errMsgUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(maxBatchImageBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Görsel paketi çok büyük (Maksimum 50MB).")
		return
	}

	var headers []*multipart.FileHeader
	if r.MultipartForm != nil {
		headers = append(headers, r.MultipartForm.File["images"]...)
		headers = append(headers, r.MultipartForm.File["image"]...)
	}
	if len(headers) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Yüklenecek fotoğraf bulunamadı.")
		return
	}
	if len(headers) > 12 {
		headers = headers[:12]
	}

	uploadedURLs := make([]string, 0, len(headers))
	for _, fh := range headers {
		f, err := fh.Open()
		if err != nil {
			continue
		}
		imgURL, errSave := h.Media.SaveUploadedImage(f, fh.Filename, "products", "cam")
		_ = f.Close()
		if errSave != nil {
			httpx.Error(w, http.StatusBadRequest, errSave.Error())
			return
		}
		uploadedURLs = append(uploadedURLs, imgURL)
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"image_urls": uploadedURLs,
		"count":      len(uploadedURLs),
	})
}

func (h *MobileHandler) QuickUpdateSupplierProduct(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, errMsgUnauthorized)
		return
	}

	productID := strings.TrimSpace(r.PathValue("id"))
	if productID == "" {
		httpx.Error(w, http.StatusBadRequest, "Ürün ID zorunludur.")
		return
	}

	var req QuickProductUpdateRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz veri formatı.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	res, err := db.Pool.Exec(ctx, `
		UPDATE catalog.products
		SET price        = COALESCE($1, price),
		    buying_price = COALESCE($2, buying_price),
		    is_active    = COALESCE($3, is_active),
		    stock        = COALESCE($4, stock),
		    updated_at   = CURRENT_TIMESTAMP
		WHERE id = $5 AND brand_id = $6
	`, req.Price, req.BuyingPrice, req.IsActive, req.Stock, productID, claims.BrandID)
	if err != nil || res.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "Ürün bulunamadı veya yetkiniz yok.")
		return
	}

	if req.Stock != nil && *req.Stock >= 0 {
		distributeVariantStockProportionally(ctx, productID, *req.Stock)
	}

	triggerProductMVRefresh()
	httpx.JSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Ürün hızlıca güncellendi.",
	})
}

func distributeVariantStockProportionally(ctx context.Context, productID string, totalStock int) {
	rows, err := db.Pool.Query(ctx, `SELECT id::text FROM catalog.product_variants WHERE product_id = $1 ORDER BY created_at ASC`, productID)
	if err != nil {
		return
	}
	defer rows.Close()

	var varIDs []string
	for rows.Next() {
		var vid string
		if rows.Scan(&vid) == nil {
			varIDs = append(varIDs, vid)
		}
	}
	if len(varIDs) == 0 {
		return
	}

	perVar := totalStock / len(varIDs)
	remainder := totalStock % len(varIDs)
	for i, vid := range varIDs {
		st := perVar
		if i == 0 {
			st += remainder
		}
		_, _ = db.Pool.Exec(ctx, `UPDATE catalog.product_variants SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, st, vid)
	}
}

func (h *MobileHandler) FindSupplierProductByBarcode(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, errMsgUnauthorized)
		return
	}

	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if code == "" {
		httpx.Error(w, http.StatusBadRequest, "Barkod veya SKU kodu giriniz.")
		return
	}

	var productID string
	err := db.Pool.QueryRow(r.Context(), `
		SELECT p.id::text
		FROM catalog.products p
		LEFT JOIN catalog.product_variants v ON v.product_id = p.id
		WHERE p.brand_id = $1
		  AND (p.barcode = $2 OR p.custom_sku ILIKE $2 OR p.sku ILIKE $2 OR v.barcode = $2)
		LIMIT 1
	`, claims.BrandID, code).Scan(&productID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "Bu barkod/SKU ile eşleşen ürün bulunamadı.")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Sorgulama hatası.")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"product_id": productID})
}

func (h *MobileHandler) UploadChatImage(w http.ResponseWriter, r *http.Request) {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	guestCustID := strings.TrimSpace(r.Header.Get("X-Chat-Customer-Id"))
	if authHeader == "" && guestCustID == "" {
		httpx.Error(w, http.StatusUnauthorized, "Sohbet görseli yüklemek için oturum bilgisi gereklidir.")
		return
	}
	if authHeader != "" {
		if _, err := h.Tokens.ResolvePrincipal(r.Context(), authHeader); err != nil && guestCustID == "" {
			httpx.Error(w, http.StatusUnauthorized, err.Error())
			return
		}
	}

	if err := r.ParseMultipartForm(maxSingleImageBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Görsel boyutu çok büyük (Maksimum 25MB).")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Yüklenecek fotoğraf dosyası bulunamadı.")
		return
	}
	defer file.Close()

	imageURL, err := h.Media.SaveUploadedImage(file, header.Filename, "chat", "chat")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"image_url": imageURL,
	})
}

