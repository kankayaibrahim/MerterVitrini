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

func validateInquiryRequest(req *models.B2bInquiry) error {
	if req.FullName == "" || req.Phone == "" || req.Email == "" {
		return errors.New("Name, Phone and Email are required")
	}
	if len(req.Items) == 0 {
		return errors.New("Inquiry cart cannot be empty")
	}
	for _, item := range req.Items {
		if item.ProductID == "" || item.Title == "" || item.CustomSku == "" || item.Quantity <= 0 {
			return errors.New("Invalid item payload inside inquiry cart")
		}
	}
	return nil
}

func saveInquiryRecord(ctx context.Context, req *models.B2bInquiry) (string, float64, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return "", 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	inquiryQuery := `
		INSERT INTO catalog.store_inquiries (full_name, company, phone, email, message)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`

	var inquiryID string
	err = tx.QueryRow(ctx, inquiryQuery, req.FullName, req.Company, req.Phone, req.Email, req.Message).Scan(&inquiryID)
	if err != nil {
		return "", 0, fmt.Errorf("insert inquiry: %w", err)
	}

	itemQuery := `
		INSERT INTO catalog.store_inquiry_items (inquiry_id, product_id, title, custom_sku, quantity, price)
		VALUES ($1, $2, $3, $4, $5, $6)`

	totalPrice := 0.0
	for _, item := range req.Items {
		_, err = tx.Exec(ctx, itemQuery, inquiryID, item.ProductID, item.Title, item.CustomSku, item.Quantity, item.Price)
		if err != nil {
			return "", 0, fmt.Errorf("insert item: %w", err)
		}
		totalPrice += item.Price * float64(item.Quantity)
	}

	if err = tx.Commit(ctx); err != nil {
		return "", 0, fmt.Errorf("commit transaction: %w", err)
	}

	return inquiryID, totalPrice, nil
}

func buildInquiryWhatsAppURL(inquiryID string, req *models.B2bInquiry, totalPrice float64) string {
	var messageLines []string
	messageLines = append(messageLines, "*📦 MERTER VİTRİNİ TOPTAN SİPARİŞ TALEBİ *")
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
		messageLines = append(messageLines, fmt.Sprintf("    adet/paket: %d x %.2f TL", item.Quantity, item.Price))
	}
	messageLines = append(messageLines, "-----------------------------------")
	messageLines = append(messageLines, fmt.Sprintf("*Toplam Sipariş Tutarı:* %.2f TL", totalPrice))
	messageLines = append(messageLines, "", "_Merter Vitrini dijital showroom üzerinden otomatik oluşturulmuştur._")

	whatsAppMsg := strings.Join(messageLines, "\n")
	shopWhatsAppNumber := "905333551515"
	return fmt.Sprintf("https://api.whatsapp.com/send?phone=%s&text=%s", shopWhatsAppNumber, url.QueryEscape(whatsAppMsg))
}

// SubmitInquiry saves a B2B quote/order inquiry in the DB and returns a formatted WhatsApp redirect string
func (h *InquiryHandler) SubmitInquiry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req models.B2bInquiry
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if err := validateInquiryRequest(&req); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inquiryID, totalPrice, err := saveInquiryRecord(ctx, &req)
	if err != nil {
		log.Printf("[STORE INQUIRY ERROR] %v", err)
		http.Error(w, `{"error":"Failed to process inquiry"}`, http.StatusInternalServerError)
		return
	}

	whatsAppURL := buildInquiryWhatsAppURL(inquiryID, &req, totalPrice)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"success":      true,
		"id":           inquiryID,
		"total_price":  totalPrice,
		"whatsapp_url": whatsAppURL,
		"message":      "Inquiry submitted successfully",
	})
}

