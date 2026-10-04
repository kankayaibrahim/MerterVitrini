package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
)

type SupplierApplicationsHandler struct {
	Cfg *config.Config
}

func NewSupplierApplicationsHandler(cfg *config.Config) *SupplierApplicationsHandler {
	return &SupplierApplicationsHandler{Cfg: cfg}
}

// verifyReCaptcha validates Google reCAPTCHA v3 token
func (h *SupplierApplicationsHandler) verifyReCaptcha(token, action string) (bool, error) {
	if h.Cfg.ReCaptchaSecret == "" {
		return true, nil
	}
	if token == "" {
		return false, fmt.Errorf("reCAPTCHA doğrulaması gereklidir")
	}

	resp, err := http.PostForm("https://www.google.com/recaptcha/api/siteverify",
		url.Values{
			"secret":   {h.Cfg.ReCaptchaSecret},
			"response": {token},
		})
	if err != nil {
		return false, fmt.Errorf("reCAPTCHA servis bağlantı hatası: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Success    bool     `json:"success"`
		Score      float64  `json:"score"`
		Action     string   `json:"action"`
		ErrorCodes []string `json:"error-codes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("reCAPTCHA yanıtı okunamadı: %w", err)
	}

	if !result.Success {
		log.Printf("[RECAPTCHA WARNING] Supplier Application verification failed: %v", result.ErrorCodes)
		return false, nil
	}

	// Verify action matches to prevent cross-action token attacks
	if result.Action != "" && action != "" && result.Action != action {
		log.Printf("[RECAPTCHA WARNING] Action mismatch. Expected: %s, Got: %s", action, result.Action)
		return false, nil
	}

	// Accept scores >= 0.3 for form submissions (to avoid false positives on mobile/slow nets)
	if result.Score < 0.3 {
		log.Printf("[RECAPTCHA WARNING] Supplier Application score too low: %f", result.Score)
		return false, nil
	}

	return true, nil
}

// SubmitApplication handles public prospective supplier submissions
func (h *SupplierApplicationsHandler) SubmitApplication(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSupplierApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek formatı"}`, http.StatusBadRequest)
		return
	}

	req.CompanyName = strings.TrimSpace(req.CompanyName)
	req.ContactName = strings.TrimSpace(req.ContactName)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Phone = strings.TrimSpace(req.Phone)

	if req.CompanyName == "" || req.ContactName == "" || req.Email == "" || req.Phone == "" {
		http.Error(w, `{"error":"Firma adı, yetkili adı, e-posta ve telefon alanları zorunludur."}`, http.StatusBadRequest)
		return
	}

	// Validate reCAPTCHA if configured
	if h.Cfg.ReCaptchaSecret != "" {
		valid, err := h.verifyReCaptcha(req.ReCaptchaToken, "supplier_apply")
		if err != nil || !valid {
			http.Error(w, `{"error":"Güvenlik doğrulaması (reCAPTCHA) başarısız oldu. Lütfen tekrar deneyin."}`, http.StatusBadRequest)
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	ip := getClientIP(r)

	// Clean fields
	cityVal := cleanOptionalString(req.City)
	categoryVal := cleanOptionalString(req.Category)
	instagramVal := cleanOptionalString(req.Instagram)
	websiteVal := cleanOptionalString(req.Website)
	notesVal := cleanOptionalString(req.Notes)

	query := `
		INSERT INTO catalog.supplier_applications 
			(company_name, contact_name, email, phone, city, category, instagram, website, notes, status, ip_address)
		VALUES 
			($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
		RETURNING id, created_at`

	var newID string
	var createdAt time.Time
	err := db.Pool.QueryRow(ctx, query,
		req.CompanyName,
		req.ContactName,
		req.Email,
		req.Phone,
		cityVal,
		categoryVal,
		instagramVal,
		websiteVal,
		notesVal,
		ip,
	).Scan(&newID, &createdAt)

	if err != nil {
		log.Printf("[SUPPLIER APPLICATION ERROR] Insert failed: %v", err)
		http.Error(w, `{"error":"Başvurunuz kaydedilirken bir hata oluştu. Lütfen daha sonra tekrar deneyiniz."}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Tedarikçi başvurunuz başarıyla alındı. Satın alma ve kategori ekibimiz en kısa sürede sizinle iletişime geçecektir.",
		"id":      newID,
	})
}

// ListApplications returns supplier applications with filtering and pagination for admin
func (h *SupplierApplicationsHandler) ListApplications(w http.ResponseWriter, r *http.Request) {
	statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))
	searchQuery := strings.TrimSpace(r.URL.Query().Get("q"))
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 200 {
		limit = l
	}

	offset := 0
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	whereClauses := []string{"1=1"}
	args := []any{}
	argIdx := 1

	if statusFilter != "" && statusFilter != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, statusFilter)
		argIdx++
	}

	if searchQuery != "" {
		likeTerm := "%" + strings.ToLower(searchQuery) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(lower(company_name) LIKE $%d OR lower(contact_name) LIKE $%d OR lower(email) LIKE $%d OR phone LIKE $%d OR lower(coalesce(city, '')) LIKE $%d OR lower(coalesce(category, '')) LIKE $%d OR lower(coalesce(instagram, '')) LIKE $%d)",
			argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx,
		))
		args = append(args, likeTerm)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM catalog.supplier_applications WHERE %s", whereSQL)
	var totalCount int
	if err := db.Pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		log.Printf("[SUPPLIER APPLICATION ERROR] Count query error: %v", err)
		http.Error(w, `{"error":"Kayıt sayısı alınamadı"}`, http.StatusInternalServerError)
		return
	}

	dataQuery := fmt.Sprintf(`
		SELECT 
			id, company_name, contact_name, email, phone, city, category, 
			instagram, website, notes, status, admin_notes, ip_address, created_at, updated_at
		FROM catalog.supplier_applications
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := db.Pool.Query(ctx, dataQuery, args...)
	if err != nil {
		log.Printf("[SUPPLIER APPLICATION ERROR] List query error: %v", err)
		http.Error(w, `{"error":"Başvurular listelenirken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]*models.SupplierApplication, 0)
	for rows.Next() {
		var a models.SupplierApplication
		if err := rows.Scan(
			&a.ID,
			&a.CompanyName,
			&a.ContactName,
			&a.Email,
			&a.Phone,
			&a.City,
			&a.Category,
			&a.Instagram,
			&a.Website,
			&a.Notes,
			&a.Status,
			&a.AdminNotes,
			&a.IPAddress,
			&a.CreatedAt,
			&a.UpdatedAt,
		); err != nil {
			log.Printf("[SUPPLIER APPLICATION ERROR] Scan error: %v", err)
			continue
		}
		items = append(items, &a)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"items":  items,
		"total":  totalCount,
		"limit":  limit,
		"offset": offset,
	})
}

// UpdateStatus updates the review status and optional admin notes
func (h *SupplierApplicationsHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Başvuru ID zorunludur"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateSupplierApplicationStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek formatı"}`, http.StatusBadRequest)
		return
	}

	validStatuses := map[string]bool{
		"pending":   true,
		"reviewed":  true,
		"contacted": true,
		"approved":  true,
		"rejected":  true,
	}

	req.Status = strings.ToLower(strings.TrimSpace(req.Status))
	if !validStatuses[req.Status] {
		http.Error(w, `{"error":"Geçersiz başvuru durumu"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	adminNotesVal := cleanOptionalString(req.AdminNotes)

	query := `
		UPDATE catalog.supplier_applications
		SET status = $1, admin_notes = coalesce($2, admin_notes), updated_at = CURRENT_TIMESTAMP
		WHERE id = $3`

	res, err := db.Pool.Exec(ctx, query, req.Status, adminNotesVal, id)
	if err != nil {
		log.Printf("[SUPPLIER APPLICATION ERROR] Update status error: %v", err)
		http.Error(w, `{"error":"Durum güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	if res.RowsAffected() == 0 {
		http.Error(w, `{"error":"Başvuru bulunamadı"}`, http.StatusNotFound)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Başvuru durumu güncellendi.",
	})
}

// DeleteApplication deletes a supplier application record
func (h *SupplierApplicationsHandler) DeleteApplication(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Başvuru ID zorunludur"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	res, err := db.Pool.Exec(ctx, "DELETE FROM catalog.supplier_applications WHERE id = $1", id)
	if err != nil {
		log.Printf("[SUPPLIER APPLICATION ERROR] Delete error: %v", err)
		http.Error(w, `{"error":"Başvuru silinemedi"}`, http.StatusInternalServerError)
		return
	}

	if res.RowsAffected() == 0 {
		http.Error(w, `{"error":"Başvuru bulunamadı"}`, http.StatusNotFound)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Başvuru kaydı silindi.",
	})
}

func cleanOptionalString(s string) *string {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
