package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
)

type InquiryHandler struct{}

func NewInquiryHandler() *InquiryHandler {
	return &InquiryHandler{}
}

type inquiryPayload struct {
	FullName        string               `json:"full_name"`
	Company         *string              `json:"company"`
	CompanyName     *string              `json:"company_name"`
	Phone           string               `json:"phone"`
	PhoneNumber     string               `json:"phone_number"`
	Email           string               `json:"email"`
	EmailAddress    string               `json:"email_address"`
	Message         *string              `json:"message"`
	CustomerMessage *string              `json:"customer_message"`
	DeliveryAddress string               `json:"delivery_address"`
	Items           []models.InquiryItem `json:"items"`
	CartItems       []models.InquiryItem `json:"cart_items"`
}

func normalizeInquiryPayload(raw *inquiryPayload) models.B2bInquiry {
	req := models.B2bInquiry{
		FullName: strings.TrimSpace(raw.FullName),
		Company:  raw.Company,
		Phone:    strings.TrimSpace(raw.Phone),
		Email:    strings.TrimSpace(raw.Email),
		Message:  raw.Message,
		Items:    raw.Items,
	}
	if (req.Company == nil || strings.TrimSpace(*req.Company) == "") && raw.CompanyName != nil {
		req.Company = raw.CompanyName
	}
	if req.Phone == "" && raw.PhoneNumber != "" {
		req.Phone = strings.TrimSpace(raw.PhoneNumber)
	}
	if req.Email == "" && raw.EmailAddress != "" {
		req.Email = strings.TrimSpace(raw.EmailAddress)
	}
	if (req.Message == nil || strings.TrimSpace(*req.Message) == "") && raw.CustomerMessage != nil {
		req.Message = raw.CustomerMessage
	}
	if len(req.Items) == 0 && len(raw.CartItems) > 0 {
		req.Items = raw.CartItems
	}
	return req
}

func validateInquiryRequest(req *models.B2bInquiry) error {
	if req.FullName == "" || req.Phone == "" {
		return errors.New("Ad Soyad ve Telefon (WhatsApp) alanları zorunludur")
	}
	if len(req.Items) == 0 {
		return errors.New("Sipariş / iletişim kalemi boş olamaz")
	}
	for _, item := range req.Items {
		if item.ProductID == "" || item.Title == "" || item.CustomSku == "" || item.Quantity <= 0 {
			return errors.New("Geçersiz ürün kalemi bulunuyor")
		}
	}
	return nil
}

func saveInquiryAndDirectSupplierOrders(ctx context.Context, req *models.B2bInquiry, deliveryAddr string) (string, string, float64, []models.SupplierDirectOrderSummary, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return "", "", 0, nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	inquiryQuery := `
		INSERT INTO catalog.store_inquiries (full_name, company, phone, email, message)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`

	var inquiryID string
	err = tx.QueryRow(ctx, inquiryQuery, req.FullName, req.Company, req.Phone, req.Email, req.Message).Scan(&inquiryID)
	if err != nil {
		return "", "", 0, nil, fmt.Errorf("insert inquiry: %w", err)
	}

	itemQuery := `
		INSERT INTO catalog.store_inquiry_items (inquiry_id, product_id, title, custom_sku, quantity, price)
		VALUES ($1, $2, $3, $4, $5, $6)`

	totalPrice := 0.0
	var orderItems []orderCartItem
	for _, item := range req.Items {
		var brandID, seriesRatio, imgURL string
		var dbPrice float64
		_ = tx.QueryRow(ctx, `
			SELECT 
				COALESCE(p.brand_id::text, ''),
				COALESCE(p.series_ratio, ''),
				p.price,
				COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1), '/placeholder.png')
			FROM catalog.products p
			WHERE p.id = $1
		`, item.ProductID).Scan(&brandID, &seriesRatio, &dbPrice, &imgURL)

		effectivePrice := item.Price
		if effectivePrice <= 0 {
			effectivePrice = dbPrice
		}

		_, err = tx.Exec(ctx, itemQuery, inquiryID, item.ProductID, item.Title, item.CustomSku, item.Quantity, effectivePrice)
		if err != nil {
			return "", "", 0, nil, fmt.Errorf("insert inquiry item: %w", err)
		}
		totalPrice += effectivePrice * float64(item.Quantity)

		orderItems = append(orderItems, orderCartItem{
			ProductID:   item.ProductID,
			BrandID:     brandID,
			Quantity:    item.Quantity,
			Title:       item.Title,
			CustomSku:   item.CustomSku,
			Price:       effectivePrice,
			SeriesRatio: seriesRatio,
			ImageUrl:    imgURL,
		})
	}

	// Create a direct B2B order record and route directly to the supplier(s)
	orderNumber, err := generateNextOrderNumber(ctx, tx)
	if err != nil {
		orderNumber = fmt.Sprintf("INQ-%s", time.Now().Format("20060102-150405"))
	}

	companyStr := ""
	if req.Company != nil {
		companyStr = strings.TrimSpace(*req.Company)
	}
	notesStr := ""
	if req.Message != nil {
		notesStr = strings.TrimSpace(*req.Message)
	}
	addrStr := strings.TrimSpace(deliveryAddr)
	if addrStr == "" && notesStr != "" {
		addrStr = notesStr
	}

	var orderID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.orders (
			order_number, user_id, total_amount, payment_method, order_status,
			billing_address, delivery_address, customer_name, customer_company, customer_phone, customer_email, notes
		)
		VALUES ($1, NULL, $2, 'DIRECT_SUPPLIER', 'PENDING_PAYMENT', $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`, orderNumber, totalPrice, addrStr, addrStr, req.FullName, companyStr, req.Phone, req.Email, notesStr).Scan(&orderID)

	var supplierOrders []models.SupplierDirectOrderSummary
	if err == nil && orderID != "" {
		for _, oi := range orderItems {
			_, _ = tx.Exec(ctx, `
				INSERT INTO catalog.order_items (order_id, product_id, product_name, product_sku, quantity, price_at_purchase, image_url_at_purchase)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, orderID, oi.ProductID, oi.Title, oi.CustomSku, oi.Quantity, oi.Price, oi.ImageUrl)
		}
		supplierOrders, _ = splitOrderIntoSupplierSubOrdersWithSummary(ctx, tx, orderID, orderNumber, orderItems)
	} else if err != nil {
		log.Printf("[STORE INQUIRY] Direct order creation warning: %v", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return "", "", 0, nil, fmt.Errorf("commit transaction: %w", err)
	}

	return inquiryID, orderNumber, totalPrice, supplierOrders, nil
}

func buildInquiryWhatsAppURL(inquiryID string, req *models.B2bInquiry, totalPrice float64, targetPhone string) string {
	var messageLines []string
	messageLines = append(messageLines, "*📦 MERTER VİTRİNİ DOĞRUDAN TOPTAN SİPARİŞ TALEBİ*")
	messageLines = append(messageLines, "-----------------------------------")
	shortID := inquiryID
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}
	messageLines = append(messageLines, fmt.Sprintf("*Talep No:* #%s", shortID))
	messageLines = append(messageLines, fmt.Sprintf("*Ad Soyad:* %s", req.FullName))
	if req.Company != nil && *req.Company != "" {
		messageLines = append(messageLines, fmt.Sprintf("*Firma:* %s", *req.Company))
	}
	messageLines = append(messageLines, fmt.Sprintf("*Telefon:* %s", req.Phone))
	messageLines = append(messageLines, fmt.Sprintf("*E-posta:* %s", req.Email))
	if req.Message != nil && *req.Message != "" {
		messageLines = append(messageLines, fmt.Sprintf("*Müşteri Notu:* %s", *req.Message))
	}
	messageLines = append(messageLines, "", "*🛍️ Sipariş Listesi:*")

	for idx, item := range req.Items {
		messageLines = append(messageLines, fmt.Sprintf("%d. *%s* (SKU: %s)", idx+1, item.Title, item.CustomSku))
		messageLines = append(messageLines, fmt.Sprintf("    adet/seri: %d x %.2f TL", item.Quantity, item.Price))
	}
	messageLines = append(messageLines, "-----------------------------------")
	messageLines = append(messageLines, fmt.Sprintf("*Toplam Sipariş Tutarı:* %.2f TL", totalPrice))
	messageLines = append(messageLines, "", "_Merter Vitrini üzerinden doğrudan üretici/tedarikçi firmaya oluşturulmuştur._")

	whatsAppMsg := strings.Join(messageLines, "\n")
	digits := normalizeWhatsappDigits(targetPhone)
	if digits == "" {
		digits = "905333551515"
	}
	return fmt.Sprintf("https://wa.me/%s?text=%s", digits, url.QueryEscape(whatsAppMsg))
}

// SubmitInquiry saves a B2B quote/order inquiry, routes direct sub-orders to suppliers, and returns direct supplier WhatsApp & IBAN details
func (h *InquiryHandler) SubmitInquiry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var raw inquiryPayload
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	req := normalizeInquiryPayload(&raw)
	if err := validateInquiryRequest(&req); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inquiryID, orderNumber, totalPrice, supplierOrders, err := saveInquiryAndDirectSupplierOrders(ctx, &req, raw.DeliveryAddress)
	if err != nil {
		log.Printf("[STORE INQUIRY ERROR] %v", err)
		http.Error(w, `{"error":"Failed to process inquiry"}`, http.StatusInternalServerError)
		return
	}

	inquiryUserID := resolveAuthenticatedMemberID(r, "")
	if inquiryUserID == "" && req.Email != "" {
		_ = db.Pool.QueryRow(ctx, `SELECT id FROM identity.users WHERE LOWER(email) = LOWER($1) LIMIT 1`, req.Email).Scan(&inquiryUserID)
	}
	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        inquiryUserID,
		EventType:     "inquiry_submit",
		EventCategory: "commerce",
		Title:         fmt.Sprintf("Toptan sipariş / teklif talebi gönderdi (%d kalem)", len(req.Items)),
		Subtitle:      fmt.Sprintf("Toplam: %.2f TL • %s", totalPrice, req.FullName),
		EntityType:    "inquiry",
		EntityID:      inquiryID,
		Metadata: map[string]any{
			"order_number": orderNumber,
			"total_price":  totalPrice,
			"items_count":  len(req.Items),
		},
	})

	var whatsAppURL string
	if len(supplierOrders) > 0 && supplierOrders[0].WhatsappURL != "" {
		whatsAppURL = supplierOrders[0].WhatsappURL
	} else {
		whatsAppURL = buildInquiryWhatsAppURL(inquiryID, &req, totalPrice, "")
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"success":         true,
		"id":              inquiryID,
		"order_number":    orderNumber,
		"total_price":     totalPrice,
		"whatsapp_url":    whatsAppURL,
		"supplier_orders": supplierOrders,
		"message":         "Siparişiniz doğrudan tedarikçi firmaya iletildi.",
	})
}
