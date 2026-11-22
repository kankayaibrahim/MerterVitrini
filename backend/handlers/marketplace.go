package handlers

import (
	"bytes"
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

type supplierSubOrderGroup struct {
	BrandID  string
	Currency string
	Items    []orderCartItem
}

func splitOrderIntoSupplierSubOrdersWithSummary(ctx context.Context, tx pgx.Tx, orderID, orderNumber string, items []orderCartItem) ([]models.SupplierDirectOrderSummary, error) {
	groups := groupOrderItemsByBrandAndCurrency(items)
	rates := loadLatestExchangeRatesMap(ctx)

	var summaries []models.SupplierDirectOrderSummary
	for idx, grp := range groups {
		summary, err := processSupplierSubOrder(ctx, tx, supplierSubOrderInput{
			OrderID:     orderID,
			OrderNumber: orderNumber,
			BrandID:     grp.BrandID,
			Currency:    grp.Currency,
			SubOrderIdx: idx + 1,
			Items:       grp.Items,
			Rates:       rates,
		})
		if err != nil {
			return nil, err
		}
		if summary != nil {
			summaries = append(summaries, *summary)
		}
	}

	return summaries, nil
}

func groupOrderItemsByBrandAndCurrency(items []orderCartItem) []supplierSubOrderGroup {
	var groups []supplierSubOrderGroup
	indexByKey := make(map[string]int)
	for _, item := range items {
		if item.BrandID == "" {
			continue
		}
		curr := normalizeOrderCurrencyCode(item.Currency)
		key := item.BrandID + "|" + curr
		if pos, exists := indexByKey[key]; exists {
			groups[pos].Items = append(groups[pos].Items, item)
			continue
		}
		indexByKey[key] = len(groups)
		groups = append(groups, supplierSubOrderGroup{
			BrandID:  item.BrandID,
			Currency: curr,
			Items:    []orderCartItem{item},
		})
	}
	return groups
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
	return math.Round(gross*100) / 100
}

func getSupplierWalletCommissionAndCurrency(ctx context.Context, tx pgx.Tx, brandID string) (float64, string) {
	var commissionRate float64 = 0.00
	var walletCurrency string = "TRY"
	err := tx.QueryRow(ctx, `
		INSERT INTO catalog.supplier_wallets (brand_id, commission_rate)
		VALUES ($1, 0.00)
		ON CONFLICT (brand_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING commission_rate, COALESCE(NULLIF(UPPER(TRIM(currency)), ''), 'TRY')
	`, brandID).Scan(&commissionRate, &walletCurrency)
	if err != nil {
		log.Printf("[MARKETPLACE] Failed to get/create supplier wallet: %v", err)
	}
	return commissionRate, normalizeOrderCurrencyCode(walletCurrency)
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
		itemTotal := math.Round(unitPrice*float64(bi.Quantity)*100) / 100
		itemCurrency := normalizeOrderCurrencyCode(bi.Currency)
		_, err := tx.Exec(ctx, `
			INSERT INTO catalog.supplier_sub_order_items (
				sub_order_id, product_id, product_name, product_sku, quantity, price_at_purchase, total_price, currency, image_url, series_ratio
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, subOrderID, bi.ProductID, bi.Title, bi.CustomSku, bi.Quantity, unitPrice, itemTotal, itemCurrency, bi.ImageUrl, bi.SeriesRatio)
		if err != nil {
			return fmt.Errorf("failed to insert sub order item: %w", err)
		}
	}
	return nil
}

func formatDualOrderSKU(customSKU, supplierSKU string) string {
	c := strings.TrimSpace(customSKU)
	s := strings.TrimSpace(supplierSKU)
	if s == "" || strings.EqualFold(c, s) {
		return c
	}
	if c == "" {
		return s
	}
	return fmt.Sprintf("%s | Model: %s", c, s)
}

func formatSupplierSubOrderLineText(bi orderCartItem, subOrderCurrency string) (string, models.SupplierDirectOrderItem) {
	unitsPerPkg := getUnitsFromSeriesRatio(bi.SeriesRatio)
	pkgs := bi.Quantity / unitsPerPkg
	if pkgs <= 0 {
		pkgs = 1
	}
	unitPrice := getEffectiveItemPrice(bi)
	lineTotal := math.Round(unitPrice*float64(bi.Quantity)*100) / 100
	displaySKU := formatDualOrderSKU(bi.CustomSku, bi.SupplierSku)

	var line string
	if unitsPerPkg > 1 && bi.Quantity >= unitsPerPkg {
		if unitPrice <= 0 {
			line = fmt.Sprintf("• %s (%s) x %d Seri (%d Adet)\n", bi.Title, displaySKU, pkgs, bi.Quantity)
		} else {
			line = fmt.Sprintf("• %s (%s) x %d Seri (%d Adet) = %s\n", bi.Title, displaySKU, pkgs, bi.Quantity, formatOrderMoney(lineTotal, subOrderCurrency))
		}
	} else {
		if unitPrice <= 0 {
			line = fmt.Sprintf("• %s (%s) x %d Adet\n", bi.Title, displaySKU, bi.Quantity)
		} else {
			line = fmt.Sprintf("• %s (%s) x %d Adet = %s\n", bi.Title, displaySKU, bi.Quantity, formatOrderMoney(lineTotal, subOrderCurrency))
		}
	}

	return line, models.SupplierDirectOrderItem{
		ProductID:       bi.ProductID,
		Title:           bi.Title,
		CustomSku:       bi.CustomSku,
		SupplierSku:     strings.TrimSpace(bi.SupplierSku),
		PackagesQty:     pkgs,
		PiecesQty:       bi.Quantity,
		UnitsPerPackage: unitsPerPkg,
		UnitPrice:       unitPrice,
		TotalPrice:      lineTotal,
		Currency:        subOrderCurrency,
	}
}

type supplierSubOrderInput struct {
	OrderID     string
	OrderNumber string
	BrandID     string
	Currency    string
	SubOrderIdx int
	Items       []orderCartItem
	Rates       map[string]float64
}

func processSupplierSubOrder(ctx context.Context, tx pgx.Tx, in supplierSubOrderInput) (*models.SupplierDirectOrderSummary, error) {
	orderID := in.OrderID
	brandID := in.BrandID
	brandItems := in.Items
	rates := in.Rates
	subOrderCurrency := normalizeOrderCurrencyCode(in.Currency)
	grossAmount := calculateBrandGrossAmount(brandItems)
	commissionRate, walletCurrency := getSupplierWalletCommissionAndCurrency(ctx, tx, brandID)
	commissionAmount := math.Round((grossAmount*commissionRate/100.0)*100) / 100
	netPayoutAmount := math.Round((grossAmount-commissionAmount)*100) / 100
	subOrderNumber := fmt.Sprintf("%s-S%d", in.OrderNumber, in.SubOrderIdx)

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
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $10, $11, $12, $13, $14, $15)
		RETURNING id
	`, orderID, brandID, subOrderNumber, grossAmount, commissionRate, commissionAmount, netPayoutAmount, subOrderCurrency,
		notesPtr, custName, custCompany, custPhone, custEmail, delivAddr, billAddr).Scan(&subOrderID)
	if err != nil {
		return nil, fmt.Errorf("failed to create sub order: %w", err)
	}

	if err := insertSupplierSubOrderItems(ctx, tx, subOrderID, brandItems); err != nil {
		return nil, err
	}

	// Update supplier wallet pending balance in the wallet's currency
	walletDelta := convertOrderAmount(grossAmount, subOrderCurrency, walletCurrency, rates)
	var updatedPending float64
	err = tx.QueryRow(ctx, `
		UPDATE catalog.supplier_wallets
		SET pending_balance = pending_balance + $1, updated_at = CURRENT_TIMESTAMP
		WHERE brand_id = $2
		RETURNING pending_balance
	`, walletDelta, brandID).Scan(&updatedPending)
	if err != nil {
		return nil, fmt.Errorf("failed to update supplier wallet: %w", err)
	}

	// Add audit ledger entry
	desc := fmt.Sprintf("Doğrudan Tedarikçi Siparişi (%s - %s) - Müşteri: %s", subOrderNumber, formatOrderMoney(grossAmount, subOrderCurrency), custName)
	_, _ = tx.Exec(ctx, `
		INSERT INTO catalog.supplier_ledger (
			brand_id, sub_order_id, transaction_type, amount, balance_after, currency, description
		) VALUES ($1, $2, 'PENDING_ORDER_INCOME', $3, $4, $5, $6)
	`, brandID, subOrderID, grossAmount, updatedPending, subOrderCurrency, desc)

	var brandName, brandSlug, brandCity, brandDistrict, whatsappPhone, phone, publicEmail, locationAddr, bankName, bankHolder, iban string
	brandVerified := true
	_ = tx.QueryRow(ctx, `
		SELECT 
			b.brand_name,
			COALESCE(b.slug, ''),
			COALESCE(b.city, ''),
			COALESCE(b.district, ''),
			COALESCE(b.is_verified, true),
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
	`, brandID).Scan(&brandName, &brandSlug, &brandCity, &brandDistrict, &brandVerified, &whatsappPhone, &phone, &publicEmail, &locationAddr, &bankName, &bankHolder, &iban)

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

	summaryItems := make([]models.SupplierDirectOrderItem, 0, len(brandItems))
	totalPackages := 0
	totalPieces := 0
	for _, bi := range brandItems {
		lineText, itemSummary := formatSupplierSubOrderLineText(bi, subOrderCurrency)
		msgBuilder.WriteString(lineText)
		summaryItems = append(summaryItems, itemSummary)
		totalPackages += itemSummary.PackagesQty
		totalPieces += itemSummary.PiecesQty
	}
	fmt.Fprintf(&msgBuilder, "\n*Toplam Tutar:* %s", formatOrderMoney(grossAmount, subOrderCurrency))

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
		fmt.Sprintf("%s numaralı doğrudan siparişiniz geldi (%s - %s).", subOrderNumber, custName, formatOrderMoney(grossAmount, subOrderCurrency)),
		"sub_order",
		map[string]any{"sub_order_id": subOrderID, "sub_order_number": subOrderNumber, "customer_name": custName, "currency": subOrderCurrency},
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
		BrandSlug:         brandSlug,
		BrandCity:         brandCity,
		BrandDistrict:     brandDistrict,
		BrandVerified:     brandVerified,
		GrossAmount:       grossAmount,
		Currency:          subOrderCurrency,
		WhatsappPhone:     whatsappPhone,
		Phone:             phone,
		PublicEmail:       publicEmail,
		LocationAddress:   locationAddr,
		BankName:          bankName,
		BankAccountHolder: bankHolder,
		IBAN:              iban,
		WhatsappURL:       waURL,
		ItemCount:         len(summaryItems),
		TotalPackages:     totalPackages,
		TotalPieces:       totalPieces,
		Items:             summaryItems,
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
	if len(orders) == 0 || db.Pool == nil {
		return
	}
	subOrderIDs := make([]string, len(orders))
	indexByID := make(map[string]int, len(orders))
	for idx := range orders {
		subOrderIDs[idx] = orders[idx].ID
		indexByID[orders[idx].ID] = idx
	}

	itemRows, err := db.Pool.Query(ctx, `
		SELECT soi.id, soi.sub_order_id, soi.product_id, soi.product_name, soi.product_sku, COALESCE(p.sku, ''), soi.quantity,
		       soi.price_at_purchase, soi.total_price,
		       COALESCE(NULLIF(UPPER(TRIM(soi.currency)), ''), NULLIF(UPPER(TRIM(p.currency)), ''), 'TRY') as currency,
		       soi.image_url, soi.series_ratio
		FROM catalog.supplier_sub_order_items soi
		LEFT JOIN catalog.products p ON p.id = soi.product_id
		WHERE soi.sub_order_id = ANY($1)
		ORDER BY soi.created_at ASC
	`, subOrderIDs)
	if err != nil {
		return
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var it models.SupplierSubOrderItem
		if err := itemRows.Scan(&it.ID, &it.SubOrderID, &it.ProductID, &it.ProductName, &it.ProductSKU, &it.SupplierSKU, &it.Quantity, &it.PriceAtPurchase, &it.TotalPrice, &it.Currency, &it.ImageURL, &it.SeriesRatio); err == nil {
			it.Currency = normalizeOrderCurrencyCode(it.Currency)
			if pos, exists := indexByID[it.SubOrderID]; exists {
				orders[pos].Items = append(orders[pos].Items, it)
			}
		}
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
		SELECT soi.id, soi.sub_order_id, soi.product_id, soi.product_name, soi.product_sku, COALESCE(p.sku, ''), soi.quantity,
		       soi.price_at_purchase, soi.total_price,
		       COALESCE(NULLIF(UPPER(TRIM(soi.currency)), ''), NULLIF(UPPER(TRIM(p.currency)), ''), 'TRY') as currency,
		       soi.image_url, soi.series_ratio
		FROM catalog.supplier_sub_order_items soi
		LEFT JOIN catalog.products p ON p.id = soi.product_id
		WHERE soi.sub_order_id = $1
		ORDER BY soi.created_at ASC
	`, subOrderID)
	if err == nil {
		defer itemRows.Close()
		for itemRows.Next() {
			var it models.SupplierSubOrderItem
			if err := itemRows.Scan(&it.ID, &it.SubOrderID, &it.ProductID, &it.ProductName, &it.ProductSKU, &it.SupplierSKU, &it.Quantity, &it.PriceAtPurchase, &it.TotalPrice, &it.Currency, &it.ImageURL, &it.SeriesRatio); err == nil {
				it.Currency = normalizeOrderCurrencyCode(it.Currency)
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

	var currentStatus, subOrderCurrency string
	var grossAmount, commissionAmount, netPayout float64
	var subOrderNumber string
	err = tx.QueryRow(ctx, `
		SELECT status, COALESCE(NULLIF(UPPER(TRIM(currency)), ''), 'TRY'), gross_amount, commission_amount, net_payout_amount, sub_order_number
		FROM catalog.supplier_sub_orders
		WHERE id = $1 AND brand_id = $2
		FOR UPDATE
	`, subOrderID, claims.BrandID).Scan(&currentStatus, &subOrderCurrency, &grossAmount, &commissionAmount, &netPayout, &subOrderNumber)
	if err != nil {
		http.Error(w, `{"error":"Sipariş bulunamadı"}`, http.StatusNotFound)
		return
	}
	subOrderCurrency = normalizeOrderCurrencyCode(subOrderCurrency)
	_, walletCurrency := getSupplierWalletCommissionAndCurrency(ctx, tx, claims.BrandID)
	rates := loadLatestExchangeRatesMap(ctx)
	grossWallet := convertOrderAmount(grossAmount, subOrderCurrency, walletCurrency, rates)
	netWallet := convertOrderAmount(netPayout, subOrderCurrency, walletCurrency, rates)

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
		`, grossWallet, netWallet, claims.BrandID).Scan(&newAvail)
		if err != nil {
			http.Error(w, `{"error":"Bakiye aktarımı başarısız"}`, http.StatusInternalServerError)
			return
		}

		desc := fmt.Sprintf("Teslim Edilen Sipariş (%s - %s) Hakediş Aktarımı (Komisyon Kesintisi: %s)", subOrderNumber, formatOrderMoney(netPayout, subOrderCurrency), formatOrderMoney(commissionAmount, subOrderCurrency))
		_, _ = tx.Exec(ctx, `
			INSERT INTO catalog.supplier_ledger (
				brand_id, sub_order_id, transaction_type, amount, balance_after, currency, description
			) VALUES ($1, $2, 'COMPLETED_ORDER_PAYOUT', $3, $4, $5, $6)
		`, claims.BrandID, subOrderID, netPayout, newAvail, subOrderCurrency, desc)
	}

	// If cancelled: deduct from pending_balance
	if currentStatus != "CANCELLED" && req.Status == "CANCELLED" {
		_, _ = tx.Exec(ctx, `
			UPDATE catalog.supplier_wallets
			SET pending_balance = GREATEST(0.00, pending_balance - $1), updated_at = CURRENT_TIMESTAMP
			WHERE brand_id = $2
		`, grossWallet, claims.BrandID)
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

type cancelableSubOrder struct {
	id             string
	brandID        string
	subOrderNumber string
	status         string
	currency       string
	grossAmount    float64
}

func loadSubOrdersForCancel(ctx context.Context, tx pgx.Tx, orderID string) ([]cancelableSubOrder, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, brand_id, sub_order_number, status,
		       COALESCE(NULLIF(UPPER(TRIM(currency)), ''), 'TRY'),
		       gross_amount
		FROM catalog.supplier_sub_orders
		WHERE order_id = $1
		FOR UPDATE
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("query supplier sub-orders for cancel: %w", err)
	}

	var subs []cancelableSubOrder
	for rows.Next() {
		var sub cancelableSubOrder
		if scanErr := rows.Scan(&sub.id, &sub.brandID, &sub.subOrderNumber, &sub.status, &sub.currency, &sub.grossAmount); scanErr != nil {
			rows.Close()
			return nil, fmt.Errorf("scan supplier sub-order for cancel: %w", scanErr)
		}
		subs = append(subs, sub)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate supplier sub-orders for cancel: %w", err)
	}
	return subs, nil
}

func cancelSingleSupplierSubOrder(ctx context.Context, tx pgx.Tx, sub cancelableSubOrder, reasonNote string, rates map[string]float64) error {
	prevStatus := strings.ToUpper(strings.TrimSpace(sub.status))
	if prevStatus == "CANCELLED" {
		return nil
	}

	_, err := tx.Exec(ctx, `
		UPDATE catalog.supplier_sub_orders
		SET status = 'CANCELLED',
		    notes = CASE
		        WHEN $2 = '' THEN notes
		        WHEN COALESCE(notes, '') = '' THEN $2
		        ELSE notes || ' | ' || $2
		    END,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, sub.id, reasonNote)
	if err != nil {
		return fmt.Errorf("cancel supplier sub-order %s: %w", sub.id, err)
	}

	if prevStatus == "DELIVERED" {
		return nil
	}

	subCurrency := normalizeOrderCurrencyCode(sub.currency)
	_, walletCurrency := getSupplierWalletCommissionAndCurrency(ctx, tx, sub.brandID)
	grossWallet := convertOrderAmount(sub.grossAmount, subCurrency, walletCurrency, rates)

	var newPending float64
	err = tx.QueryRow(ctx, `
		UPDATE catalog.supplier_wallets
		SET pending_balance = GREATEST(0.00, pending_balance - $1),
		    updated_at = CURRENT_TIMESTAMP
		WHERE brand_id = $2
		RETURNING pending_balance
	`, grossWallet, sub.brandID).Scan(&newPending)
	if err != nil {
		return fmt.Errorf("deduct supplier pending balance for brand %s: %w", sub.brandID, err)
	}

	desc := fmt.Sprintf("İptal Edilen Sipariş (%s - %s)", sub.subOrderNumber, formatOrderMoney(sub.grossAmount, subCurrency))
	if reasonNote != "" {
		desc = desc + " — " + reasonNote
	}
	_, _ = tx.Exec(ctx, `
		INSERT INTO catalog.supplier_ledger (
			brand_id, sub_order_id, transaction_type, amount, balance_after, currency, description
		) VALUES ($1, $2, 'ORDER_CANCELLED_REVERSAL', $3, $4, $5, $6)
	`, sub.brandID, sub.id, grossWallet, newPending, walletCurrency, desc)
	return nil
}

// cancelSupplierSubOrdersForOrder cancels all non-cancelled supplier sub-orders belonging to a master order
// and reverses pending supplier wallet balances for sub-orders not yet delivered.
func cancelSupplierSubOrdersForOrder(ctx context.Context, tx pgx.Tx, orderID, reason string) error {
	subs, err := loadSubOrdersForCancel(ctx, tx, orderID)
	if err != nil {
		return err
	}
	if len(subs) == 0 {
		return nil
	}

	rates := loadLatestExchangeRatesMap(ctx)
	reasonNote := strings.TrimSpace(reason)
	for _, sub := range subs {
		if err := cancelSingleSupplierSubOrder(ctx, tx, sub, reasonNote, rates); err != nil {
			return err
		}
	}
	return nil
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
		http.Error(w, `{"error":"Müşteri veya firma adı zorunludur"}`, http.StatusBadRequest)
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

func writeFeedXMLError(w http.ResponseWriter, status int, msg string) {
	var buf bytes.Buffer
	_ = xml.EscapeText(&buf, []byte(msg))
	w.Header().Set(headerContentType, mimeApplicationXMLUTF8)
	w.WriteHeader(status)
	_, _ = w.Write([]byte(xml.Header + "<error>" + buf.String() + "</error>"))
}

// ExportB2BXmlFeed streams XML feed for external B2B partners
func (h *MarketplaceHandler) ExportB2BXmlFeed(w http.ResponseWriter, r *http.Request) {
	marginRate, err := validateFeedAPIKey(r)
	if err != nil {
		writeFeedXMLError(w, http.StatusUnauthorized, err.Error())
		return
	}

	ctx := r.Context()
	rows, err := db.Pool.Query(ctx, `
		SELECT 
			p.id, p.custom_sku, p.title, coalesce(p.description, ''),
			coalesce(NULLIF(b.brand_name, ''), b.alias_code, 'Merter Vitrini') as brand_alias,
			coalesce(c.title, 'Tekstil') as cat_name,
			p.price, p.currency, p.stock, coalesce(p.series_ratio, '1'), coalesce(p.packing_ratio, '1'),
			COALESCE((
				SELECT array_agg(
					CASE WHEN pi.image_url LIKE 'http%' THEN pi.image_url ELSE 'https://mertervitrini.com.tr' || pi.image_url END
					ORDER BY pi.is_cover DESC, pi.sort_order ASC
				)
				FROM catalog.product_images pi
				WHERE pi.product_id = p.id
			), ARRAY[]::text[])
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON b.id = p.brand_id
		LEFT JOIN catalog.categories c ON c.id = p.category_id
		WHERE p.is_active = true AND p.deleted_at IS NULL AND p.stock > 0
		ORDER BY p.created_at DESC
		LIMIT 2000
	`)
	if err != nil {
		writeFeedXMLError(w, http.StatusInternalServerError, "Katalog alınamadı")
		return
	}
	defer rows.Close()

	var feedProducts []FeedProductXML
	for rows.Next() {
		var p FeedProductXML
		var rawPrice float64
		if err := rows.Scan(
			&p.ID, &p.SKU, &p.Title, &p.Description, &p.Brand, &p.Category,
			&rawPrice, &p.Currency, &p.Stock, &p.SeriesRatio, &p.PackingRatio, &p.Images,
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
		writeSupplierJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
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
