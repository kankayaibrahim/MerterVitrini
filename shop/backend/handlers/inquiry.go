package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"mertervitrini/shop/backend/db"
	"mertervitrini/shop/backend/models"
)

type InquiryHandler struct{}

func NewInquiryHandler() *InquiryHandler {
	return &InquiryHandler{}
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

	// 1. Validations
	if req.FullName == "" || req.Phone == "" || req.Email == "" {
		http.Error(w, `{"error":"Name, Phone and Email are required"}`, http.StatusBadRequest)
		return
	}
	if len(req.Items) == 0 {
		http.Error(w, `{"error":"Inquiry cart cannot be empty"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// 2. Start PostgreSQL Transaction
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to start transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// 3. Insert into catalog.store_inquiries
	inquiryQuery := `
		INSERT INTO catalog.store_inquiries (full_name, company, phone, email, message)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`

	var inquiryID string
	var createdAt time.Time
	err = tx.QueryRow(ctx, inquiryQuery, req.FullName, req.Company, req.Phone, req.Email, req.Message).Scan(&inquiryID, &createdAt)
	if err != nil {
		log.Printf("Failed to insert store inquiry: %v", err)
		http.Error(w, `{"error":"Failed to save inquiry"}`, http.StatusInternalServerError)
		return
	}

	// 4. Insert items
	itemQuery := `
		INSERT INTO catalog.store_inquiry_items (inquiry_id, product_id, title, custom_sku, quantity, price)
		VALUES ($1, $2, $3, $4, $5, $6)`

	totalPrice := 0.0
	for _, item := range req.Items {
		if item.ProductID == "" || item.Title == "" || item.CustomSku == "" || item.Quantity <= 0 {
			http.Error(w, `{"error":"Invalid item payload inside inquiry cart"}`, http.StatusBadRequest)
			return
		}
		_, err = tx.Exec(ctx, itemQuery, inquiryID, item.ProductID, item.Title, item.CustomSku, item.Quantity, item.Price)
		if err != nil {
			log.Printf("Failed to insert store inquiry item: %v", err)
			http.Error(w, `{"error":"Failed to process cart items"}`, http.StatusInternalServerError)
			return
		}
		totalPrice += item.Price * float64(item.Quantity)
	}

	// Commit Transaction
	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Failed to finalize inquiry"}`, http.StatusInternalServerError)
		return
	}

	// 5. Generate a premium formatted WhatsApp message text
	// Perfect for Turkish wholesales!
	var messageLines []string
	messageLines = append(messageLines, "*📦 MERTER VİTRİNİ TOPTAN SİPARİŞ TALEBİ *")
	messageLines = append(messageLines, "-----------------------------------")
	messageLines = append(messageLines, fmt.Sprintf("*Talep No:* #%s", inquiryID[:8]))
	messageLines = append(messageLines, fmt.Sprintf("*Ad Soyad:* %s", req.FullName))
	if req.Company != nil && *req.Company != "" {
		messageLines = append(messageLines, fmt.Sprintf("*Firma:* %s", *req.Company))
	}
	messageLines = append(messageLines, fmt.Sprintf("*Telefon:* %s", req.Phone))
	messageLines = append(messageLines, fmt.Sprintf("*E-posta:* %s", req.Email))
	if req.Message != nil && *req.Message != "" {
		messageLines = append(messageLines, fmt.Sprintf("*Müşteri Notu:* %s", *req.Message))
	}
	messageLines = append(messageLines, "")
	messageLines = append(messageLines, "*🛍️ Sipariş Listesi:*")
	
	for idx, item := range req.Items {
		messageLines = append(messageLines, fmt.Sprintf("%d. *%s* (SKU: %s)", idx+1, item.Title, item.CustomSku))
		messageLines = append(messageLines, fmt.Sprintf("    adet/paket: %d x %.2f TL", item.Quantity, item.Price))
	}
	messageLines = append(messageLines, "-----------------------------------")
	messageLines = append(messageLines, fmt.Sprintf("*Toplam Sipariş Tutarı:* %.2f TL", totalPrice))
	messageLines = append(messageLines, "")
	messageLines = append(messageLines, "_Merter Vitrini dijital showroom üzerinden otomatik oluşturulmuştur._")

	whatsAppMsg := strings.Join(messageLines, "\n")
	
	// Default wholesale WhatsApp number (configured for shop managers)
	shopWhatsAppNumber := "905333551515" 
	whatsAppUrl := fmt.Sprintf("https://api.whatsapp.com/send?phone=%s&text=%s", 
		shopWhatsAppNumber, url.QueryEscape(whatsAppMsg))

	// 6. Return response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"success":      true,
		"id":           inquiryID,
		"total_price":  totalPrice,
		"whatsapp_url": whatsAppUrl,
		"message":      "Inquiry submitted successfully",
	})
}
