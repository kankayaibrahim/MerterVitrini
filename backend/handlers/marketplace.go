package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
	"mertervitrini/backend/services"
)

type MarketplaceHandler struct {
	Cfg      *config.Config
	Notifier services.NotificationDispatcher
}

func NewMarketplaceHandler(cfg *config.Config, notifiers ...services.NotificationDispatcher) *MarketplaceHandler {
	var notifier services.NotificationDispatcher
	if len(notifiers) > 0 && notifiers[0] != nil {
		notifier = notifiers[0]
	} else {
		notifier = services.NewPostgresNotificationDispatcher(db.Pool)
	}
	return &MarketplaceHandler{Cfg: cfg, Notifier: notifier}
}

func splitOrderIntoSupplierSubOrdersWithSummary(ctx context.Context, tx pgx.Tx, orderID, orderNumber string, items []orderCartItem) ([]models.SupplierDirectOrderSummary, error) {
	brandGroups := groupOrderItemsByBrand(items)

	var summaries []models.SupplierDirectOrderSummary
	subOrderIdx := 1
	for brandID, brandItems := range brandGroups {
		summary, err := processSupplierSubOrder(ctx, tx, orderID, orderNumber, brandID, subOrderIdx, brandItems)
		if err != nil {
			return nil, err
		}
		if summary != nil {
			summaries = append(summaries, *summary)
		}
		subOrderIdx++
	}

	return summaries, nil
}

func groupOrderItemsByBrand(items []orderCartItem) map[string][]orderCartItem {
	brandGroups := make(map[string][]orderCartItem)
	for _, item := range items {
		if item.BrandID != "" {
			brandGroups[item.BrandID] = append(brandGroups[item.BrandID], item)
		}
	}
	return brandGroups
}

func getEffectiveItemPrice(bi orderCartItem) float64 {
	if bi.DiscountedPrice != nil && *bi.DiscountedPrice > 0 && *bi.DiscountedPrice < bi.Price {
		return *bi.DiscountedPrice
	}
	return bi.Price
}

func calculateBrandGrossAmount(brandItems []orderCartItem) float64 {
	var gross float64
	for _, bi := range brandItems {
		gross += getEffectiveItemPrice(bi) * float64(bi.Quantity)
	}
	return gross
}

func getSupplierCommissionRate(ctx context.Context, tx pgx.Tx, brandID string) float64 {
	var commissionRate float64 = 0.00
	err := tx.QueryRow(ctx, `
		INSERT INTO catalog.supplier_wallets (brand_id, commission_rate)
		VALUES ($1, 0.00)
		ON CONFLICT (brand_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING commission_rate
	`, brandID).Scan(&commissionRate)
	if err != nil {
		log.Printf("[MARKETPLACE] Failed to get/create supplier wallet: %v", err)
	}
	return commissionRate
}

func normalizeWhatsappDigits(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	if strings.HasPrefix(digits, "00") {
		digits = digits[2:]
	} else if strings.HasPrefix(digits, "0") && len(digits) == 11 {
		digits = "90" + digits[1:]
	} else if len(digits) == 10 && strings.HasPrefix(digits, "5") {
		digits = "90" + digits
	}
	return digits
}

func insertSupplierSubOrderItems(ctx context.Context, tx pgx.Tx, subOrderID string, brandItems []orderCartItem) error {
	for _, bi := range brandItems {
		unitPrice := getEffectiveItemPrice(bi)
		itemTotal := unitPrice * float64(bi.Quantity)
		_, err := tx.Exec(ctx, `
			INSERT INTO catalog.supplier_sub_order_items (
				sub_order_id, product_id, product_name, product_sku, quantity, price_at_purchase, total_price, image_url, series_ratio
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, subOrderID, bi.ProductID, bi.Title, bi.CustomSku, bi.Quantity, unitPrice, itemTotal, bi.ImageUrl, bi.SeriesRatio)
		if err != nil {
			return fmt.Errorf("failed to insert sub order item: %w", err)
		}
	}
	return nil
}

func processSupplierSubOrder(ctx context.Context, tx pgx.Tx, orderID, orderNumber, brandID string, subOrderIdx int, brandItems []orderCartItem) (*models.SupplierDirectOrderSummary, error) {
	grossAmount := calculateBrandGrossAmount(brandItems)
	commissionRate := getSupplierCommissionRate(ctx, tx, brandID)
	commissionAmount := math.Round((grossAmount*commissionRate/100.0)*100) / 100
	netPayoutAmount := math.Round((grossAmount-commissionAmount)*100) / 100
	subOrderNumber := fmt.Sprintf("%s-S%d", orderNumber, subOrderIdx)

	var custName, custCompany, custPhone, custEmail, delivAddr, billAddr, orderNotes string
	_ = tx.QueryRow(ctx, `
		SELECT 
			COALESCE(NULLIF(o.customer_name, ''), TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))),
			COALESCE(o.customer_company, ''),
			COALESCE(NULLIF(o.customer_phone, ''), COALESCE(u.phone, '')),
			COALESCE(NULLIF(o.customer_email, ''), COALESCE(u.email, '')),
			COALESCE(o.delivery_address::text, ''),
			COALESCE(o.billing_address::text, ''),
			COALESCE(o.notes, '')
		FROM catalog.orders o
		LEFT JOIN identity.users u ON u.id = o.user_id
		WHERE o.id = $1
	`, orderID).Scan(&custName, &custCompany, &custPhone, &custEmail, &delivAddr, &billAddr, &orderNotes)

	var notesPtr *string
	if strings.TrimSpace(orderNotes) != "" {
		n := strings.TrimSpace(orderNotes)
		notesPtr = &n
	}

	var subOrderID string
	err := tx.QueryRow(ctx, `
		INSERT INTO catalog.supplier_sub_orders (
			order_id, brand_id, sub_order_number, gross_amount, commission_rate, 
			commission_amount, net_payout_amount, currency, status, notes,
			customer_name, customer_company, customer_phone, customer_email, delivery_address, billing_address
		) VALUES ($1, $2, $3, $4, $5, $6, $7, 'TRY', 'PENDING', $8, $9, $10, $11, $12, $13, $14)
		RETURNING id
	`, orderID, brandID, subOrderNumber, grossAmount, commissionRate, commissionAmount, netPayoutAmount,
		notesPtr, custName, custCompany, custPhone, custEmail, delivAddr, billAddr).Scan(&subOrderID)
	if err != nil {
		return nil, fmt.Errorf("failed to create sub order: %w", err)
	}

	if err := insertSupplierSubOrderItems(ctx, tx, subOrderID, brandItems); err != nil {
		return nil, err
	}

	// Update supplier wallet pending balance
	var updatedPending float64
	err = tx.QueryRow(ctx, `
		UPDATE catalog.supplier_wallets
		SET pending_balance = pending_balance + $1, updated_at = CURRENT_TIMESTAMP
		WHERE brand_id = $2
		RETURNING pending_balance
	`, grossAmount, brandID).Scan(&updatedPending)
	if err != nil {
		return nil, fmt.Errorf("failed to update supplier wallet: %w", err)
	}

	// Add audit ledger entry
	desc := fmt.Sprintf("Doğrudan Tedarikçi Siparişi (%s) - Müşteri: %s", subOrderNumber, custName)
	_, _ = tx.Exec(ctx, `
		INSERT INTO catalog.supplier_ledger (
			brand_id, sub_order_id, transaction_type, amount, balance_after, currency, description
		) VALUES ($1, $2, 'PENDING_ORDER_INCOME', $3, $4, 'TRY', $5)
	`, brandID, subOrderID, grossAmount, updatedPending, desc)

	var brandName, whatsappPhone, phone, publicEmail, locationAddr, bankName, bankHolder, iban string
	_ = tx.QueryRow(ctx, `
		SELECT 
			b.brand_name,
			COALESCE(
				NULLIF(b.whatsapp_phone, ''),
				NULLIF(b.phone, ''),
				(SELECT COALESCE(NULLIF(su.phone, ''), '') FROM catalog.supplier_users su WHERE su.brand_id = b.id AND su.phone IS NOT NULL AND su.phone <> '' ORDER BY su.is_owner DESC, su.created_at ASC LIMIT 1),
				''
			),
			COALESCE(b.phone, ''),
			COALESCE(b.public_email, ''),
			COALESCE(b.location_address, ''),
			COALESCE(NULLIF(b.bank_name, ''), COALESCE(w.bank_name, '')),
			COALESCE(NULLIF(b.bank_account_holder, ''), COALESCE(w.bank_account_holder, '')),
			COALESCE(NULLIF(b.iban, ''), COALESCE(w.iban, ''))
		FROM catalog.brands b
		LEFT JOIN catalog.supplier_wallets w ON w.brand_id = b.id
		WHERE b.id = $1
	`, brandID).Scan(&brandName, &whatsappPhone, &phone, &publicEmail, &locationAddr, &bankName, &bankHolder, &iban)

	var msgBuilder strings.Builder
	fmt.Fprintf(&msgBuilder, "Merhaba *%s*,\n*Merter Vitrini* üzerinden doğrudan firmanıza toptan sipariş oluşturdum.\n\n", brandName)
	fmt.Fprintf(&msgBuilder, "*Sipariş No:* %s\n", subOrderNumber)
	fmt.Fprintf(&msgBuilder, "*Alıcı:* %s", custName)
	if custCompany != "" {
		fmt.Fprintf(&msgBuilder, " (%s)", custCompany)
	}
	msgBuilder.WriteString("\n")
	if custPhone != "" {
		fmt.Fprintf(&msgBuilder, "*Telefon:* %s\n", custPhone)
	}
	msgBuilder.WriteString("\n*Sipariş Kalemleri:*\n")
	for _, bi := range brandItems {
		unitPrice := getEffectiveItemPrice(bi)
		fmt.Fprintf(&msgBuilder, "• %s (%s) x %d Seri = %.2f TL\n", bi.Title, bi.CustomSku, bi.Quantity, unitPrice*float64(bi.Quantity))
	}
	fmt.Fprintf(&msgBuilder, "\n*Toplam Tutar:* %.2f TL", grossAmount)

	waDigits := normalizeWhatsappDigits(whatsappPhone)
	var waURL string
	if waDigits != "" {
		waURL = fmt.Sprintf("https://wa.me/%s?text=%s", waDigits, url.QueryEscape(msgBuilder.String()))
	} else {
		waURL = fmt.Sprintf("https://wa.me/?text=%s", url.QueryEscape(msgBuilder.String()))
	}

	services.NewPostgresNotificationDispatcher(db.Pool).NotifySupplierBrandAsync(
		brandID,
		"Yeni Doğrudan Toptan Sipariş!",
		fmt.Sprintf("%s numaralı doğrudan siparişiniz geldi (%s - ₺%.2f).", subOrderNumber, custName, grossAmount),
		"sub_order",
		map[string]any{"sub_order_id": subOrderID, "sub_order_number": subOrderNumber, "customer_name": custName},
	)

	firstProdID := ""
	if len(brandItems) > 0 {
		firstProdID = brandItems[0].ProductID
	}
	RecordBrandAnalyticsEvent(brandID, firstProdID, "inquiry_submit", nil)

	return &models.SupplierDirectOrderSummary{
		SubOrderID:        subOrderID,
		SubOrderNumber:    subOrderNumber,
		BrandID:           brandID,
		BrandName:         brandName,
		GrossAmount:       grossAmount,
		Currency:          "TRY",
		WhatsappPhone:     whatsappPhone,
		Phone:             phone,
		PublicEmail:       publicEmail,
		LocationAddress:   locationAddr,
		BankName:          bankName,
		BankAccountHolder: bankHolder,
		IBAN:              iban,
		WhatsappURL:       waURL,
	}, nil
}

// -----------------------------------------------------------------------------
// SUPPLIER PORTAL HANDLERS
// -----------------------------------------------------------------------------

func buildSupplierOrdersQuery(brandID, status string, limit, offset int) (string, []any) {
	query := `
		SELECT 
			so.id, so.order_id, so.brand_id, b.brand_name, so.sub_order_number, 
			so.gross_amount, so.commission_rate, so.commission_amount, so.net_payout_amount, 
			so.currency, so.status, so.tracking_company, so.tracking_number, so.notes,
			COALESCE(NULLIF(so.customer_name, ''), COALESCE(o.customer_name, '')),
			COALESCE(NULLIF(so.customer_company, ''), COALESCE(o.customer_company, '')),
			COALESCE(NULLIF(so.customer_phone, ''), COALESCE(o.customer_phone, '')),
			COALESCE(NULLIF(so.customer_email, ''), COALESCE(o.customer_email, '')),
			COALESCE(NULLIF(so.delivery_address, ''), COALESCE(o.delivery_address::text, '')),
			COALESCE(NULLIF(so.billing_address, ''), COALESCE(o.billing_address::text, '')),
			COALESCE(u.email_verified, false) AS customer_email_verified,
			so.created_at, so.updated_at
		FROM catalog.supplier_sub_orders so
		JOIN catalog.brands b ON b.id = so.brand_id
		LEFT JOIN catalog.orders o ON o.id = so.order_id
		LEFT JOIN identity.users u ON (LOWER(u.email) = LOWER(COALESCE(NULLIF(so.customer_email, ''), o.customer_email)) OR (o.user_id IS NOT NULL AND u.id = o.user_id))
		WHERE so.brand_id = $1
	`
	args := []any{brandID}
	argIdx := 2

	if status != "" && status != "ALL" {
		query += fmt.Sprintf(" AND so.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY so.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)
	return query, args
}

func scanSupplierSubOrders(rows pgx.Rows) []models.SupplierSubOrder {
	orders := []models.SupplierSubOrder{}
	for rows.Next() {
		var o models.SupplierSubOrder
		if err := rows.Scan(
			&o.ID, &o.OrderID, &o.BrandID, &o.BrandName, &o.SubOrderNumber,
			&o.GrossAmount, &o.CommissionRate, &o.CommissionAmount, &o.NetPayoutAmount,
			&o.Currency, &o.Status, &o.TrackingCompany, &o.TrackingNumber, &o.Notes,
			&o.CustomerName, &o.CustomerCompany, &o.CustomerPhone, &o.CustomerEmail,
			&o.DeliveryAddress, &o.BillingAddress,
			&o.CustomerEmailVerified,
			&o.CreatedAt, &o.UpdatedAt,
		); err == nil {
			orders = append(orders, o)
		}
	}
	return orders
}

func preloadSupplierSubOrderItems(ctx context.Context, orders []models.SupplierSubOrder) {
	for idx := range orders {
		itemRows, err := db.Pool.Query(ctx, `
			SELECT id, sub_order_id, product_id, product_name, product_sku, quantity, price_at_purchase, total_price, image_url, series_ratio
			FROM catalog.supplier_sub_order_items
			WHERE sub_order_id = $1
			ORDER BY created_at ASC
		`, orders[idx].ID)
		if err != nil {
			continue
		}
		for itemRows.Next() {
			var it models.SupplierSubOrderItem
			if err := itemRows.Scan(&it.ID, &it.SubOrderID, &it.ProductID, &it.ProductName, &it.ProductSKU, &it.Quantity, &it.PriceAtPurchase, &it.TotalPrice, &it.ImageURL, &it.SeriesRatio); err == nil {
				orders[idx].Items = append(orders[idx].Items, it)
			}
		}
		itemRows.Close()
	}
}

// ListSupplierOrders lists sub-orders belonging to the authenticated supplier
func (h *MarketplaceHandler) ListSupplierOrders(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	status := r.URL.Query().Get("status")
	limit, offset := parseSupplierPagination(r)
	query, args := buildSupplierOrdersQuery(claims.BrandID, status, limit, offset)

	rows, err := db.Pool.Query(r.Context(), query, args...)
	if err != nil {
		log.Printf("[MARKETPLACE] Failed to query supplier orders: %v", err)
		http.Error(w, `{"error":"Siparişler yüklenemedi"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	orders := scanSupplierSubOrders(rows)
	rows.Close()

	preloadSupplierSubOrderItems(r.Context(), orders)

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"orders": orders,
		"total":  len(orders),
	})
}

// GetSupplierOrder fetches a specific sub-order along with its line items
func (h *MarketplaceHandler) GetSupplierOrder(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	subOrderID := r.PathValue("id")
	if subOrderID == "" {
		http.Error(w, `{"error":"Sipariş ID gerekli"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var o models.SupplierSubOrder
	err := db.Pool.QueryRow(ctx, `
		SELECT 
			so.id, so.order_id, so.brand_id, b.brand_name, so.sub_order_number, 
			so.gross_amount, so.commission_rate, so.commission_amount, so.net_payout_amount, 
			so.currency, so.status, so.tracking_company, so.tracking_number, so.notes,
			COALESCE(NULLIF(so.customer_name, ''), COALESCE(ord.customer_name, '')),
			COALESCE(NULLIF(so.customer_company, ''), COALESCE(ord.customer_company, '')),
			COALESCE(NULLIF(so.customer_phone, ''), COALESCE(ord.customer_phone, '')),
			COALESCE(NULLIF(so.customer_email, ''), COALESCE(ord.customer_email, '')),
			COALESCE(NULLIF(so.delivery_address, ''), COALESCE(ord.delivery_address::text, '')),
			COALESCE(NULLIF(so.billing_address, ''), COALESCE(ord.billing_address::text, '')),
			COALESCE(u.email_verified, false) AS customer_email_verified,
			so.created_at, so.updated_at
		FROM catalog.supplier_sub_orders so
		JOIN catalog.brands b ON b.id = so.brand_id
		LEFT JOIN catalog.orders ord ON ord.id = so.order_id
		LEFT JOIN identity.users u ON (LOWER(u.email) = LOWER(COALESCE(NULLIF(so.customer_email, ''), ord.customer_email)) OR (ord.user_id IS NOT NULL AND u.id = ord.user_id))
		WHERE so.id = $1 AND so.brand_id = $2
	`, subOrderID, claims.BrandID).Scan(
		&o.ID, &o.OrderID, &o.BrandID, &o.BrandName, &o.SubOrderNumber,
		&o.GrossAmount, &o.CommissionRate, &o.CommissionAmount, &o.NetPayoutAmount,
		&o.Currency, &o.Status, &o.TrackingCompany, &o.TrackingNumber, &o.Notes,
		&o.CustomerName, &o.CustomerCompany, &o.CustomerPhone, &o.CustomerEmail,
		&o.DeliveryAddress, &o.BillingAddress,
		&o.CustomerEmailVerified,
		&o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	}

	// Fetch items
	itemRows, err := db.Pool.Query(ctx, `
		SELECT id, sub_order_id, product_id, product_name, product_sku, quantity, price_at_purchase, total_price, image_url, series_ratio
		FROM catalog.supplier_sub_order_items
		WHERE sub_order_id = $1
		ORDER BY created_at ASC
	`, subOrderID)
	if err == nil {
		defer itemRows.Close()
		for itemRows.Next() {
			var it models.SupplierSubOrderItem
			if err := itemRows.Scan(&it.ID, &it.SubOrderID, &it.ProductID, &it.ProductName, &it.ProductSKU, &it.Quantity, &it.PriceAtPurchase, &it.TotalPrice, &it.ImageURL, &it.SeriesRatio); err == nil {
				o.Items = append(o.Items, it)
			}
		}
	}

	writeSupplierJSON(w, http.StatusOK, o)
}

// UpdateSupplierOrderStatus updates status and tracking info
func (h *MarketplaceHandler) UpdateSupplierOrderStatus(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	subOrderID := r.PathValue("id")
	var req models.UpdateSubOrderStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, errJSONInvalidPayload, http.StatusBadRequest)
		return
	}

	validStatuses := map[string]bool{
		"ACCEPTED":    true,
		"PREPARING":   true,
		"SENT_TO_HUB": true,
		"DELIVERED":   true,
		"CANCELLED":   true,
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if !validStatuses[req.Status] {
		http.Error(w, `{"error":"Geçersiz statü"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, errJSONTxBeginFailed, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	var grossAmount, commissionAmount, netPayout float64
	var subOrderNumber string
	err = tx.QueryRow(ctx, `
		SELECT status, gross_amount, commission_amount, net_payout_amount, sub_order_number
		FROM catalog.supplier_sub_orders
		WHERE id = $1 AND brand_id = $2
		FOR UPDATE
	`, subOrderID, claims.BrandID).Scan(&currentStatus, &grossAmount, &commissionAmount, &netPayout, &subOrderNumber)
	if err != nil {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	}

	_, err = tx.Exec(ctx, `
		UPDATE catalog.supplier_sub_orders
		SET status = $1, tracking_company = coalesce(nullif($2, ''), tracking_company),
		    tracking_number = coalesce(nullif($3, ''), tracking_number),
		    notes = coalesce(nullif($4, ''), notes), updated_at = CURRENT_TIMESTAMP
		WHERE id = $5
	`, req.Status, req.TrackingCompany, req.TrackingNumber, req.Notes, subOrderID)
	if err != nil {
		http.Error(w, `{"error":"Güncelleme başarısız"}`, http.StatusInternalServerError)
		return
	}

	// Status transition: If transitioning to DELIVERED, release funds from pending to available balance!
	if currentStatus != "DELIVERED" && req.Status == "DELIVERED" {
		var newAvail float64
		err = tx.QueryRow(ctx, `
			UPDATE catalog.supplier_wallets
			SET pending_balance = GREATEST(0.00, pending_balance - $1),
			    available_balance = available_balance + $2,
			    updated_at = CURRENT_TIMESTAMP
			WHERE brand_id = $3
			RETURNING available_balance
		`, grossAmount, netPayout, claims.BrandID).Scan(&newAvail)
		if err != nil {
			http.Error(w, `{"error":"Bakiye aktarımı başarısız"}`, http.StatusInternalServerError)
			return
		}

		desc := fmt.Sprintf("Teslim Edilen Sipariş (%s) Hakediş Aktarımı (Komisyon Kesintisi: ₺%.2f)", subOrderNumber, commissionAmount)
		_, _ = tx.Exec(ctx, `
			INSERT INTO catalog.supplier_ledger (
				brand_id, sub_order_id, transaction_type, amount, balance_after, currency, description
			) VALUES ($1, $2, 'COMPLETED_ORDER_PAYOUT', $3, $4, 'TRY', $5)
		`, claims.BrandID, subOrderID, netPayout, newAvail, desc)
	}

	// If cancelled: deduct from pending_balance
	if currentStatus != "CANCELLED" && req.Status == "CANCELLED" {
		_, _ = tx.Exec(ctx, `
			UPDATE catalog.supplier_wallets
			SET pending_balance = GREATEST(0.00, pending_balance - $1), updated_at = CURRENT_TIMESTAMP
			WHERE brand_id = $2
		`, grossAmount, claims.BrandID)
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"İşlem kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Sipariş statüsü güncellendi",
		"status":  req.Status,
	})
}

// GetSupplierWallet retrieves current wallet balances and recent ledger activity
func (h *MarketplaceHandler) GetSupplierWallet(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	var wallet models.SupplierWallet
	err := db.Pool.QueryRow(ctx, `
		SELECT id, brand_id, currency, pending_balance, available_balance, withdrawn_balance,
		       commission_rate, iban, bank_name, bank_account_holder, created_at, updated_at
		FROM catalog.supplier_wallets
		WHERE brand_id = $1
	`, claims.BrandID).Scan(
		&wallet.ID, &wallet.BrandID, &wallet.Currency, &wallet.PendingBalance, &wallet.AvailableBalance,
		&wallet.WithdrawnBalance, &wallet.CommissionRate, &wallet.IBAN, &wallet.BankName,
		&wallet.BankAccountHolder, &wallet.CreatedAt, &wallet.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		// Initialize wallet if not present
		err = db.Pool.QueryRow(ctx, `
			INSERT INTO catalog.supplier_wallets (brand_id, commission_rate)
			VALUES ($1, 0.00)
			RETURNING id, brand_id, currency, pending_balance, available_balance, withdrawn_balance,
			          commission_rate, iban, bank_name, bank_account_holder, created_at, updated_at
		`, claims.BrandID).Scan(
			&wallet.ID, &wallet.BrandID, &wallet.Currency, &wallet.PendingBalance, &wallet.AvailableBalance,
			&wallet.WithdrawnBalance, &wallet.CommissionRate, &wallet.IBAN, &wallet.BankName,
			&wallet.BankAccountHolder, &wallet.CreatedAt, &wallet.UpdatedAt,
		)
	}

	if err != nil {
		http.Error(w, `{"error":"Cüzdan bilgisi alınamadı"}`, http.StatusInternalServerError)
		return
	}

	// Fetch recent 20 ledger entries
	ledgerRows, _ := db.Pool.Query(ctx, `
		SELECT id, brand_id, sub_order_id, payout_request_id, transaction_type, amount, balance_after, currency, description, created_at
		FROM catalog.supplier_ledger
		WHERE brand_id = $1
		ORDER BY created_at DESC
		LIMIT 20
	`, claims.BrandID)
	var ledger []models.SupplierLedgerEntry
	if ledgerRows != nil {
		defer ledgerRows.Close()
		for ledgerRows.Next() {
			var le models.SupplierLedgerEntry
			if err := ledgerRows.Scan(&le.ID, &le.BrandID, &le.SubOrderID, &le.PayoutRequestID, &le.TransactionType, &le.Amount, &le.BalanceAfter, &le.Currency, &le.Description, &le.CreatedAt); err == nil {
				ledger = append(ledger, le)
			}
		}
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"wallet": wallet,
		"ledger": ledger,
	})
}

// UpdateSupplierWalletIban updates the payout bank account details
func (h *MarketplaceHandler) UpdateSupplierWalletIban(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	var req models.UpdateSupplierWalletIbanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, errJSONInvalidPayload, http.StatusBadRequest)
		return
	}

	req.IBAN = strings.ReplaceAll(strings.ToUpper(strings.TrimSpace(req.IBAN)), " ", "")
	if len(req.IBAN) < 15 {
		http.Error(w, `{"error":"Geçerli bir IBAN giriniz"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.BankAccountHolder) == "" {
		http.Error(w, `{"error":"Hesap sahibi adı zorunludur"}`, http.StatusBadRequest)
		return
	}

	_, err := db.Pool.Exec(r.Context(), `
		UPDATE catalog.supplier_wallets
		SET iban = $1, bank_name = $2, bank_account_holder = $3, updated_at = CURRENT_TIMESTAMP
		WHERE brand_id = $4
	`, req.IBAN, req.BankName, req.BankAccountHolder, claims.BrandID)
	if err != nil {
		http.Error(w, `{"error":"IBAN güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	_, _ = db.Pool.Exec(r.Context(), `
		UPDATE catalog.brands
		SET iban = $1, bank_name = $2, bank_account_holder = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`, req.IBAN, req.BankName, req.BankAccountHolder, claims.BrandID)

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Banka ve IBAN bilgileri kaydedildi",
	})
}

// CreateSupplierPayoutRequest requests payout from available balance
func (h *MarketplaceHandler) CreateSupplierPayoutRequest(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	var req models.CreatePayoutRequestInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
		http.Error(w, `{"error":"Geçerli bir çekim tutarı giriniz"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, errJSONTxBeginFailed, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var avail float64
	var iban, bankName, holder *string
	err = tx.QueryRow(ctx, `
		SELECT available_balance, iban, bank_name, bank_account_holder
		FROM catalog.supplier_wallets
		WHERE brand_id = $1
		FOR UPDATE
	`, claims.BrandID).Scan(&avail, &iban, &bankName, &holder)
	if err != nil {
		http.Error(w, `{"error":"Cüzdan bulunamadı"}`, http.StatusBadRequest)
		return
	}

	if iban == nil || *iban == "" || holder == nil || *holder == "" {
		http.Error(w, `{"error":"Para çekebilmek için lütfen önce profilinizden IBAN ve hesap sahibi bilgilerini kaydedin"}`, http.StatusBadRequest)
		return
	}

	if req.Amount > avail {
		http.Error(w, fmt.Sprintf(`{"error":"Yetersiz bakiye. Çekilebilir tutar: ₺%.2f"}`, avail), http.StatusBadRequest)
		return
	}

	// Deduct from available balance
	var balanceAfter float64
	err = tx.QueryRow(ctx, `
		UPDATE catalog.supplier_wallets
		SET available_balance = available_balance - $1, updated_at = CURRENT_TIMESTAMP
		WHERE brand_id = $2
		RETURNING available_balance
	`, req.Amount, claims.BrandID).Scan(&balanceAfter)
	if err != nil {
		http.Error(w, `{"error":"Bakiye düşümü başarısız"}`, http.StatusInternalServerError)
		return
	}

	var payoutID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.supplier_payout_requests (
			brand_id, amount, currency, status, iban, bank_name, account_holder
		) VALUES ($1, $2, 'TRY', 'PENDING', $3, $4, $5)
		RETURNING id
	`, claims.BrandID, req.Amount, *iban, bankName, *holder).Scan(&payoutID)
	if err != nil {
		http.Error(w, `{"error":"Talep oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	desc := fmt.Sprintf("Banka Hakediş Çekim Talebi (%s)", *iban)
	_, _ = tx.Exec(ctx, `
		INSERT INTO catalog.supplier_ledger (
			brand_id, payout_request_id, transaction_type, amount, balance_after, currency, description
		) VALUES ($1, $2, 'PAYOUT_WITHDRAWAL', $3, $4, 'TRY', $5)
	`, claims.BrandID, payoutID, req.Amount, balanceAfter, desc)

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"İşlem tamamlanamadı"}`, http.StatusInternalServerError)
		return
	}

	writeSupplierJSON(w, http.StatusCreated, map[string]any{
		"success":   true,
		"message":   "Ödeme talebiniz muhasebe birimine iletildi.",
		"payout_id": payoutID,
	})
}

// ListSupplierPayoutRequests lists past payout requests of the logged-in supplier
func (h *MarketplaceHandler) ListSupplierPayoutRequests(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		http.Error(w, errJSONUnauthorized, http.StatusUnauthorized)
		return
	}

	rows, err := db.Pool.Query(r.Context(), `
		SELECT id, brand_id, amount, currency, status, iban, bank_name, account_holder, admin_notes, processed_at, created_at, updated_at
		FROM catalog.supplier_payout_requests
		WHERE brand_id = $1
		ORDER BY created_at DESC
	`, claims.BrandID)
	if err != nil {
		http.Error(w, `{"error":"Talepler alınamadı"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	requests := []models.SupplierPayoutRequest{}
	for rows.Next() {
		var pr models.SupplierPayoutRequest
		if err := rows.Scan(
			&pr.ID, &pr.BrandID, &pr.Amount, &pr.Currency, &pr.Status, &pr.IBAN,
			&pr.BankName, &pr.AccountHolder, &pr.AdminNotes, &pr.ProcessedAt,
			&pr.CreatedAt, &pr.UpdatedAt,
		); err == nil {
			requests = append(requests, pr)
		}
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"payout_requests": requests,
	})
}

// -----------------------------------------------------------------------------
// ADMIN MARKETPLACE HANDLERS
// -----------------------------------------------------------------------------

// ListAdminSubOrders lists all marketplace sub orders across all brands
func (h *MarketplaceHandler) ListAdminSubOrders(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	brandID := r.URL.Query().Get("brand_id")
	limit, offset := parseSupplierPagination(r)

	query := `
		SELECT 
			so.id, so.order_id, so.brand_id, b.brand_name, so.sub_order_number, 
			so.gross_amount, so.commission_rate, so.commission_amount, so.net_payout_amount, 
			so.currency, so.status, so.tracking_company, so.tracking_number, so.notes,
			COALESCE(NULLIF(so.customer_name, ''), COALESCE(o.customer_name, '')),
			COALESCE(NULLIF(so.customer_company, ''), COALESCE(o.customer_company, '')),
			COALESCE(NULLIF(so.customer_phone, ''), COALESCE(o.customer_phone, '')),
			COALESCE(NULLIF(so.customer_email, ''), COALESCE(o.customer_email, '')),
			COALESCE(NULLIF(so.delivery_address, ''), COALESCE(o.delivery_address::text, '')),
			COALESCE(NULLIF(so.billing_address, ''), COALESCE(o.billing_address::text, '')),
			so.created_at, so.updated_at
		FROM catalog.supplier_sub_orders so
		JOIN catalog.brands b ON b.id = so.brand_id
		LEFT JOIN catalog.orders o ON o.id = so.order_id
		WHERE 1=1
	`
	var args []any
	argIdx := 1

	if status != "" && status != "ALL" {
		query += fmt.Sprintf(" AND so.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if brandID != "" {
		query += fmt.Sprintf(" AND so.brand_id = $%d", argIdx)
		args = append(args, brandID)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY so.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := db.Pool.Query(r.Context(), query, args...)
	if err != nil {
		http.Error(w, `{"error":"Alt siparişler listelenemedi"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	orders := []models.SupplierSubOrder{}
	for rows.Next() {
		var o models.SupplierSubOrder
		if err := rows.Scan(
			&o.ID, &o.OrderID, &o.BrandID, &o.BrandName, &o.SubOrderNumber,
			&o.GrossAmount, &o.CommissionRate, &o.CommissionAmount, &o.NetPayoutAmount,
			&o.Currency, &o.Status, &o.TrackingCompany, &o.TrackingNumber, &o.Notes,
			&o.CustomerName, &o.CustomerCompany, &o.CustomerPhone, &o.CustomerEmail,
			&o.DeliveryAddress, &o.BillingAddress,
			&o.CreatedAt, &o.UpdatedAt,
		); err == nil {
			orders = append(orders, o)
		}
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"sub_orders": orders,
		"total":      len(orders),
	})
}

// ListAdminPayoutRequests lists all pending/approved supplier payouts
func (h *MarketplaceHandler) ListAdminPayoutRequests(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")

	query := `
		SELECT pr.id, pr.brand_id, b.brand_name, pr.amount, pr.currency, pr.status, 
		       pr.iban, pr.bank_name, pr.account_holder, pr.admin_notes, pr.processed_at, 
		       pr.created_at, pr.updated_at
		FROM catalog.supplier_payout_requests pr
		JOIN catalog.brands b ON b.id = pr.brand_id
	`
	var args []any
	if status != "" && status != "ALL" {
		query += " WHERE pr.status = $1"
		args = append(args, status)
	}
	query += " ORDER BY pr.created_at DESC"

	rows, err := db.Pool.Query(r.Context(), query, args...)
	if err != nil {
		http.Error(w, `{"error":"Hakediş talepleri alınamadı"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	requests := []models.SupplierPayoutRequest{}
	for rows.Next() {
		var pr models.SupplierPayoutRequest
		if err := rows.Scan(
			&pr.ID, &pr.BrandID, &pr.BrandName, &pr.Amount, &pr.Currency, &pr.Status,
			&pr.IBAN, &pr.BankName, &pr.AccountHolder, &pr.AdminNotes, &pr.ProcessedAt,
			&pr.CreatedAt, &pr.UpdatedAt,
		); err == nil {
			requests = append(requests, pr)
		}
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"payout_requests": requests,
	})
}

// ProcessAdminPayoutRequest approves, marks transferred or rejects a payout
func (h *MarketplaceHandler) ProcessAdminPayoutRequest(w http.ResponseWriter, r *http.Request) {
	payoutID := r.PathValue("id")
	var req models.ProcessPayoutRequestInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, errJSONInvalidPayload, http.StatusBadRequest)
		return
	}

	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status != "TRANSFERRED" && req.Status != "REJECTED" && req.Status != "APPROVED" {
		http.Error(w, `{"error":"Geçersiz işlem statüsü"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, errJSONTxBeginFailed, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var currentStatus, brandID string
	var amount float64
	err = tx.QueryRow(ctx, `
		SELECT status, brand_id, amount
		FROM catalog.supplier_payout_requests
		WHERE id = $1
		FOR UPDATE
	`, payoutID).Scan(&currentStatus, &brandID, &amount)
	if err != nil {
		http.Error(w, `{"error":"Talep bulunamadı"}`, http.StatusNotFound)
		return
	}

	if currentStatus == "TRANSFERRED" || currentStatus == "REJECTED" {
		http.Error(w, `{"error":"Bu talep zaten sonuçlandırılmıştır"}`, http.StatusBadRequest)
		return
	}

	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE catalog.supplier_payout_requests
		SET status = $1, admin_notes = $2, processed_at = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`, req.Status, req.AdminNotes, now, payoutID)
	if err != nil {
		http.Error(w, `{"error":"Talep güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	switch req.Status {
	case "TRANSFERRED":
		// Increase withdrawn balance
		_, _ = tx.Exec(ctx, `
			UPDATE catalog.supplier_wallets
			SET withdrawn_balance = withdrawn_balance + $1, updated_at = CURRENT_TIMESTAMP
			WHERE brand_id = $2
		`, amount, brandID)
	case "REJECTED":
		// Refund back to available balance!
		var newAvail float64
		_ = tx.QueryRow(ctx, `
			UPDATE catalog.supplier_wallets
			SET available_balance = available_balance + $1, updated_at = CURRENT_TIMESTAMP
			WHERE brand_id = $2
			RETURNING available_balance
		`, amount, brandID).Scan(&newAvail)

		desc := fmt.Sprintf("Reddedilen Hakediş İadesi: %s", req.AdminNotes)
		_, _ = tx.Exec(ctx, `
			INSERT INTO catalog.supplier_ledger (
				brand_id, payout_request_id, transaction_type, amount, balance_after, currency, description
			) VALUES ($1, $2, 'REFUND_REVERSAL', $3, $4, 'TRY', $5)
		`, brandID, payoutID, amount, newAvail, desc)
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"İşlem tamamlanamadı"}`, http.StatusInternalServerError)
		return
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Ödeme talebi güncellendi",
		"status":  req.Status,
	})
}

// -----------------------------------------------------------------------------
// B2B OUTBOUND FEEDS & API KEYS
// -----------------------------------------------------------------------------

func generateSecureAPIKey() string {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("mv_%d", time.Now().UnixNano())
	}
	return "mv_" + hex.EncodeToString(bytes)
}

// ListB2BApiKeys lists outbound API keys
func (h *MarketplaceHandler) ListB2BApiKeys(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(r.Context(), `
		SELECT id, client_name, api_key, margin_rate, currency, is_active, 
		       rate_limit_minute, expires_at, last_used_at, created_at, updated_at
		FROM catalog.b2b_api_keys
		ORDER BY created_at DESC
	`)
	if err != nil {
		http.Error(w, `{"error":"API anahtarları listelenemedi"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	keys := []models.B2BApiKey{}
	for rows.Next() {
		var k models.B2BApiKey
		if err := rows.Scan(
			&k.ID, &k.ClientName, &k.APIKey, &k.MarginRate, &k.Currency, &k.IsActive,
			&k.RateLimitMinute, &k.ExpiresAt, &k.LastUsedAt, &k.CreatedAt, &k.UpdatedAt,
		); err == nil {
			keys = append(keys, k)
		}
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{"keys": keys})
}

// CreateB2BApiKey generates a new B2B API Key with custom margin
func (h *MarketplaceHandler) CreateB2BApiKey(w http.ResponseWriter, r *http.Request) {
	var req models.CreateB2BApiKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.ClientName) == "" {
		http.Error(w, `{"error":"Bayi veya Müşteri adı zorunludur"}`, http.StatusBadRequest)
		return
	}

	if req.MarginRate <= 0 {
		req.MarginRate = 1.00 // Default 0% margin (exact supplier price)
	}
	if req.Currency == "" {
		req.Currency = "TRY"
	}

	apiKey := generateSecureAPIKey()
	var newKey models.B2BApiKey
	err := db.Pool.QueryRow(r.Context(), `
		INSERT INTO catalog.b2b_api_keys (client_name, api_key, margin_rate, currency)
		VALUES ($1, $2, $3, $4)
		RETURNING id, client_name, api_key, margin_rate, currency, is_active, created_at
	`, req.ClientName, apiKey, req.MarginRate, req.Currency).Scan(
		&newKey.ID, &newKey.ClientName, &newKey.APIKey, &newKey.MarginRate, &newKey.Currency, &newKey.IsActive, &newKey.CreatedAt,
	)
	if err != nil {
		http.Error(w, `{"error":"API anahtarı oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	writeSupplierJSON(w, http.StatusCreated, newKey)
}

// RevokeB2BApiKey revokes or toggles an API key
func (h *MarketplaceHandler) RevokeB2BApiKey(w http.ResponseWriter, r *http.Request) {
	keyID := r.PathValue("id")
	_, err := db.Pool.Exec(r.Context(), `
		UPDATE catalog.b2b_api_keys
		SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, keyID)
	if err != nil {
		http.Error(w, `{"error":"İşlem başarısız"}`, http.StatusInternalServerError)
		return
	}
	writeSupplierJSON(w, http.StatusOK, map[string]any{"success": true})
}

// validateFeedAPIKey verifies the API key and returns margin_rate
func validateFeedAPIKey(r *http.Request) (float64, error) {
	apiKey := r.URL.Query().Get("api_key")
	if apiKey == "" {
		apiKey = strings.TrimPrefix(r.Header.Get("Authorization"), authBearerPrefix)
	}
	if apiKey == "" {
		return 0, fmt.Errorf("API anahtarı gereklidir")
	}

	var marginRate float64
	var isActive bool
	err := db.Pool.QueryRow(r.Context(), `
		UPDATE catalog.b2b_api_keys
		SET last_used_at = CURRENT_TIMESTAMP
		WHERE api_key = $1
		RETURNING margin_rate, is_active
	`, apiKey).Scan(&marginRate, &isActive)
	if err != nil || !isActive {
		return 0, fmt.Errorf("geçersiz veya askıya alınmış API anahtarı")
	}

	// Custom margin parameter override if provided
	if m := r.URL.Query().Get("margin"); m != "" {
		if parsedM, err := strconv.ParseFloat(m, 64); err == nil && parsedM >= 1.0 {
			marginRate = parsedM
		}
	}

	return marginRate, nil
}

type FeedProductXML struct {
	ID             string   `xml:"id"`
	SKU            string   `xml:"sku"`
	Title          string   `xml:"title"`
	Description    string   `xml:"description"`
	Brand          string   `xml:"brand"`
	Category       string   `xml:"category"`
	Price          float64  `xml:"price"`
	Currency       string   `xml:"currency"`
	Stock          int      `xml:"stock"`
	SeriesRatio    string   `xml:"series_ratio"`
	PackingRatio   string   `xml:"packing_ratio"`
	Images         []string `xml:"images>image"`
}

type FeedRootXML struct {
	XMLName     xml.Name         `xml:"merter_vitrini_b2b_feed"`
	GeneratedAt string           `xml:"generated_at,attr"`
	Products    []FeedProductXML `xml:"products>product"`
}

// ExportB2BXmlFeed streams XML feed for external B2B partners
func (h *MarketplaceHandler) ExportB2BXmlFeed(w http.ResponseWriter, r *http.Request) {
	marginRate, err := validateFeedAPIKey(r)
	if err != nil {
		http.Error(w, fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?><error>%s</error>`, err.Error()), http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	rows, err := db.Pool.Query(ctx, `
		SELECT 
			p.id, p.custom_sku, p.title, coalesce(p.description, ''),
			coalesce(NULLIF(b.brand_name, ''), b.alias_code, 'Merter Vitrini') as brand_alias,
			coalesce(c.title, 'Tekstil') as cat_name,
			p.price, p.currency, p.stock, coalesce(p.series_ratio, '1'), coalesce(p.packing_ratio, '1')
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON b.id = p.brand_id
		LEFT JOIN catalog.categories c ON c.id = p.category_id
		WHERE p.is_active = true AND p.deleted_at IS NULL AND p.stock > 0
		ORDER BY p.created_at DESC
		LIMIT 2000
	`)
	if err != nil {
		http.Error(w, `<?xml version="1.0" encoding="UTF-8"?><error>Katalog alınamadı</error>`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var feedProducts []FeedProductXML
	for rows.Next() {
		var p FeedProductXML
		var rawPrice float64
		if err := rows.Scan(
			&p.ID, &p.SKU, &p.Title, &p.Description, &p.Brand, &p.Category,
			&rawPrice, &p.Currency, &p.Stock, &p.SeriesRatio, &p.PackingRatio,
		); err == nil {
			p.Price = math.Round(rawPrice*marginRate*100) / 100
			feedProducts = append(feedProducts, p)
		}
	}

	root := FeedRootXML{
		GeneratedAt: time.Now().Format(time.RFC3339),
		Products:    feedProducts,
	}

	w.Header().Set(headerContentType, mimeApplicationXMLUTF8)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	_ = enc.Encode(root)
}

// ExportB2BJsonFeed streams JSON catalog feed
func (h *MarketplaceHandler) ExportB2BJsonFeed(w http.ResponseWriter, r *http.Request) {
	marginRate, err := validateFeedAPIKey(r)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	rows, err := db.Pool.Query(ctx, `
		SELECT 
			p.id, p.custom_sku, p.title, coalesce(p.description, ''),
			coalesce(NULLIF(b.brand_name, ''), b.alias_code, 'Merter Vitrini') as brand_alias,
			coalesce(c.title, 'Tekstil') as cat_name,
			p.price, p.currency, p.stock, coalesce(p.series_ratio, '1'), coalesce(p.packing_ratio, '1')
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON b.id = p.brand_id
		LEFT JOIN catalog.categories c ON c.id = p.category_id
		WHERE p.is_active = true AND p.deleted_at IS NULL AND p.stock > 0
		ORDER BY p.created_at DESC
		LIMIT 2000
	`)
	if err != nil {
		http.Error(w, `{"error":"Katalog alınamadı"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type JsonFeedProduct struct {
		ID           string  `json:"id"`
		SKU          string  `json:"sku"`
		Title        string  `json:"title"`
		Brand        string  `json:"brand"`
		Category     string  `json:"category"`
		Price        float64 `json:"price"`
		Currency     string  `json:"currency"`
		Stock        int     `json:"stock"`
		SeriesRatio  string  `json:"series_ratio"`
		PackingRatio string  `json:"packing_ratio"`
	}

	var items []JsonFeedProduct
	for rows.Next() {
		var p JsonFeedProduct
		var rawPrice float64
		var desc string
		if err := rows.Scan(
			&p.ID, &p.SKU, &p.Title, &desc, &p.Brand, &p.Category,
			&rawPrice, &p.Currency, &p.Stock, &p.SeriesRatio, &p.PackingRatio,
		); err == nil {
			p.Price = math.Round(rawPrice*marginRate*100) / 100
			items = append(items, p)
		}
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"generated_at": time.Now().Format(time.RFC3339),
		"margin_rate":  marginRate,
		"total_count":  len(items),
		"products":     items,
	})
}
