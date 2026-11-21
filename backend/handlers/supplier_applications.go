package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/mailer"
	"mertervitrini/backend/pkg/phoneutil"
)

var supplierEmailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

func generateSecureToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func generateBrandAlias(name string) string {
	var sb strings.Builder
	for _, r := range strings.ToUpper(name) {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			sb.WriteRune(r)
			if sb.Len() >= 8 {
				break
			}
		}
	}
	res := sb.String()
	if len(res) < 3 {
		res = "SUPP" + strings.ToUpper(generateSecureToken(2))
	}
	return res
}

func getValOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// StartUnverifiedApplicationsCleaner runs every 5 minutes and purges applications unverified after 30 minutes
func StartUnverifiedApplicationsCleaner() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			tag, err := db.Pool.Exec(ctx, `
				DELETE FROM catalog.supplier_applications 
				WHERE email_verified = false AND verification_expires_at < CURRENT_TIMESTAMP
			`)
			_, _ = db.Pool.Exec(ctx, `
				DELETE FROM catalog.service_providers 
				WHERE email_verified = false AND verification_expires_at IS NOT NULL AND verification_expires_at < CURRENT_TIMESTAMP
			`)
			cancel()
			if err != nil {
				log.Printf("[SUPPLIER CLEANER ERROR] Failed to purge unverified applications: %v", err)
			} else if tag.RowsAffected() > 0 {
				log.Printf("[SUPPLIER CLEANER] Purged %d expired unverified supplier applications.", tag.RowsAffected())
			}
		}
	}()
}

type SupplierApplicationsHandler struct {
	Cfg *config.Config
}

func NewSupplierApplicationsHandler(cfg *config.Config) *SupplierApplicationsHandler {
	return &SupplierApplicationsHandler{Cfg: cfg}
}

// verifyReCaptcha validates Google reCAPTCHA v3 token without deadlocking when public site_key is absent.
func (h *SupplierApplicationsHandler) verifyReCaptcha(token, action string) (bool, error) {
	var cfg *config.Config
	if h != nil {
		cfg = h.Cfg
	}
	return verifyPublicFormReCaptcha(cfg, token, action, true)
}

// SubmitApplication handles public prospective supplier submissions with 30-min email verification
func normalizeAndValidateSupplierApplicationRequest(req *models.CreateSupplierApplicationRequest) string {
	req.CompanyName = strings.TrimSpace(req.CompanyName)
	req.ContactName = strings.TrimSpace(req.ContactName)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Phone = strings.TrimSpace(req.Phone)
	req.City = strings.TrimSpace(req.City)
	req.District = strings.TrimSpace(req.District)

	if req.CompanyName == "" || req.ContactName == "" || req.Email == "" || req.Phone == "" || req.City == "" || req.District == "" {
		return "Firma adı, yetkili adı, e-posta, telefon, il ve ilçe alanları zorunludur."
	}

	if !supplierEmailRegex.MatchString(req.Email) {
		return "Lütfen geçerli bir e-posta adresi giriniz."
	}

	normalizedPhone, phoneErr := phoneutil.NormalizeAndValidatePhone(req.Phone)
	if phoneErr != nil {
		return phoneErr.Error()
	}
	if req.LegalTermsAccepted != nil && !*req.LegalTermsAccepted {
		return supplierLegalAgreementMsg
	}
	req.Phone = normalizedPhone
	return ""
}

func (h *SupplierApplicationsHandler) createSupplierApplication(w http.ResponseWriter, r *http.Request, req models.CreateSupplierApplicationRequest) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	ip := getClientIP(r)

	// Clean fields
	cityVal := cleanOptionalString(req.City)
	districtVal := cleanOptionalString(req.District)
	categoryVal := cleanOptionalString(req.Category)
	instagramVal := cleanOptionalString(req.Instagram)
	websiteVal := cleanOptionalString(req.Website)
	notesVal := cleanOptionalString(req.Notes)

	// 30-minute verification token
	verificationToken := generateSecureToken(32)
	verificationExpires := time.Now().Add(30 * time.Minute)

	policyVer := resolveActivePolicyVersion(ctx, "supplier_agreement")
	legalAccepted := isExplicitlyAccepted(req.LegalTermsAccepted)

	query := `
		INSERT INTO catalog.supplier_applications 
			(company_name, contact_name, email, phone, city, district, category, instagram, website, notes, status, ip_address, verification_token, verification_expires_at, email_verified, legal_terms_accepted, legal_terms_accepted_at, legal_terms_version)
		VALUES 
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12, $13, false, $14, CASE WHEN $14 THEN CURRENT_TIMESTAMP ELSE NULL END, CASE WHEN $14 THEN $15 ELSE NULL END)
		RETURNING id, created_at`

	var newID string
	var createdAt time.Time
	err := db.Pool.QueryRow(ctx, query,
		req.CompanyName,
		req.ContactName,
		req.Email,
		req.Phone,
		cityVal,
		districtVal,
		categoryVal,
		instagramVal,
		websiteVal,
		notesVal,
		ip,
		verificationToken,
		verificationExpires,
		legalAccepted,
		policyVer,
	).Scan(&newID, &createdAt)

	if err != nil {
		log.Printf("[SUPPLIER APPLICATION ERROR] Insert failed: %v", err)
		http.Error(w, `{"error":"Başvurunuz kaydedilirken bir hata oluştu. Lütfen daha sonra tekrar deneyiniz."}`, http.StatusInternalServerError)
		return
	}

	if req.LegalTermsAccepted != nil && *req.LegalTermsAccepted {
		recordLegalConsentAsync(legalConsentLogEntry{
			ConsentType:  "supplier_application",
			PolicyType:   "supplier_agreement",
			ActorRole:    "supplier_applicant",
			EntityType:   "supplier_application",
			EntityID:     newID,
			Email:        req.Email,
			IPAddress:    ip,
			UserAgent:    r.UserAgent(),
			AcceptedText: supplierLegalAgreementMsg,
			Metadata:     map[string]any{"company_name": req.CompanyName},
		})
	}

	// Send verification email to applicant (valid for 30 minutes)
	verifyURL := fmt.Sprintf("https://mertervitrini.com.tr/supplier/verify?token=%s", verificationToken)
	mailer.SendSupplierApplicationVerificationEmail(h.Cfg, req.CompanyName, req.ContactName, req.Email, verifyURL)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": fmt.Sprintf("Başvurunuz başarıyla oluşturuldu. Güvenlik politikamız gereğince lütfen 30 dakika içinde %s adresinize gönderdiğimiz doğrulama bağlantısına tıklayarak e-posta adresinizi onaylayınız.", req.Email),
		"id":      newID,
		"expires_in_minutes": 30,
	})
}

func (h *SupplierApplicationsHandler) SubmitApplication(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSupplierApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek formatı"}`, http.StatusBadRequest)
		return
	}

	if errMsg := normalizeAndValidateSupplierApplicationRequest(&req); errMsg != "" {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, errMsg), http.StatusBadRequest)
		return
	}

	// Validate reCAPTCHA when pair is configured (or when client supplied a token)
	if valid, err := h.verifyReCaptcha(req.ReCaptchaToken, "supplier_apply"); err != nil || !valid {
		http.Error(w, `{"error":"Güvenlik doğrulaması (reCAPTCHA) başarısız oldu. Lütfen tekrar deneyin."}`, http.StatusBadRequest)
		return
	}

	h.createSupplierApplication(w, r, req)
}

// VerifyApplicationEmail validates applicant's 30-min verification token and notifies admin
func (h *SupplierApplicationsHandler) VerifyApplicationEmail(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		http.Error(w, `{"error":"Doğrulama belirteci (token) eksik"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var app models.SupplierApplication
	var expiresAt time.Time
	var emailVerified bool

	query := `
		SELECT id, company_name, contact_name, email, phone, city, district, category, 
		       instagram, website, notes, email_verified, verification_expires_at
		FROM catalog.supplier_applications
		WHERE verification_token = $1`

	err := db.Pool.QueryRow(ctx, query, token).Scan(
		&app.ID,
		&app.CompanyName,
		&app.ContactName,
		&app.Email,
		&app.Phone,
		&app.City,
		&app.District,
		&app.Category,
		&app.Instagram,
		&app.Website,
		&app.Notes,
		&emailVerified,
		&expiresAt,
	)

	if err != nil {
		http.Error(w, `{"error":"Geçersiz veya süresi dolmuş doğrulama bağlantısı. Güvenlik politikamız gereği 30 dakika içinde doğrulanmayan başvurular silinmektedir."}`, http.StatusNotFound)
		return
	}

	if emailVerified {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success":          true,
			"already_verified": true,
			"message":          "E-posta adresiniz daha önce başarıyla doğrulanmıştır. Başvurunuz inceleme aşamasındadır.",
			"company_name":     app.CompanyName,
		})
		return
	}

	// Check 30-minute expiry
	if time.Now().After(expiresAt) {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM catalog.supplier_applications WHERE id = $1", app.ID)
		http.Error(w, `{"error":"Doğrulama bağlantısının 30 dakikalık süresi dolmuştur. Başvurunuz güvenlik politikası gereğince silinmiştir, lütfen tekrar başvuru yapınız."}`, http.StatusGone)
		return
	}

	// Mark as verified
	_, err = db.Pool.Exec(ctx, `
		UPDATE catalog.supplier_applications 
		SET email_verified = true, verified_at = CURRENT_TIMESTAMP, verification_token = NULL, status = 'pending', updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`, app.ID)
	if err != nil {
		log.Printf("[SUPPLIER VERIFY ERROR] Update failed: %v", err)
		http.Error(w, `{"error":"Doğrulama kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	// NOW notify Admin that this is a confirmed, verified real applicant!
	meta := mailer.ExtractClientMeta(r)
	mailer.SendSupplierApplicationNotification(h.Cfg, mailer.SupplierApplicationData{
		CompanyName: app.CompanyName,
		ContactName: app.ContactName,
		Email:       app.Email,
		Phone:       app.Phone,
		City:        getValOrEmpty(app.City),
		District:    getValOrEmpty(app.District),
		Category:    getValOrEmpty(app.Category),
		Instagram:   getValOrEmpty(app.Instagram),
		Website:     getValOrEmpty(app.Website),
		Notes:       getValOrEmpty(app.Notes),
	}, meta)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success":      true,
		"message":      "E-posta adresiniz başarıyla doğrulandı. Başvurunuz satın alma ve kategori ekibimize iletilmiştir.",
		"company_name": app.CompanyName,
		"contact_name": app.ContactName,
	})
}

// ListApplications returns supplier applications with filtering and pagination for admin
func (h *SupplierApplicationsHandler) ListApplications(w http.ResponseWriter, r *http.Request) {
	statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))
	searchQuery := strings.TrimSpace(r.URL.Query().Get("q"))
	allVerification := r.URL.Query().Get("all_verification") == "true"
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

	// By default, only show verified applications to admin (unless explicit request)
	if !allVerification {
		whereClauses = append(whereClauses, "email_verified = true")
	}

	if statusFilter != "" && statusFilter != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, statusFilter)
		argIdx++
	}

	if searchQuery != "" {
		likeTerm := "%" + strings.ToLower(searchQuery) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(lower(company_name) LIKE $%d OR lower(contact_name) LIKE $%d OR lower(email) LIKE $%d OR phone LIKE $%d OR lower(coalesce(city, '')) LIKE $%d OR lower(coalesce(district, '')) LIKE $%d OR lower(coalesce(category, '')) LIKE $%d OR lower(coalesce(instagram, '')) LIKE $%d)",
			argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx,
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
			id, company_name, contact_name, email, phone, city, district, category, 
			instagram, website, notes, status, admin_notes, ip_address, 
			email_verified, verified_at, verification_expires_at, created_at, updated_at
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
			&a.District,
			&a.Category,
			&a.Instagram,
			&a.Website,
			&a.Notes,
			&a.Status,
			&a.AdminNotes,
			&a.IPAddress,
			&a.EmailVerified,
			&a.VerifiedAt,
			&a.VerificationExpiresAt,
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

// UpdateStatus updates the review status and handles brand & account provisioning on approval
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

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	// 1. Fetch existing application
	var app models.SupplierApplication
	appQuery := `
		SELECT company_name, contact_name, email, phone, city, district, category, website, email_verified
		FROM catalog.supplier_applications
		WHERE id = $1`
	err := db.Pool.QueryRow(ctx, appQuery, id).Scan(
		&app.CompanyName, &app.ContactName, &app.Email, &app.Phone, &app.City, &app.District, &app.Category, &app.Website, &app.EmailVerified,
	)
	if err != nil {
		http.Error(w, `{"error":"Başvuru bulunamadı"}`, http.StatusNotFound)
		return
	}

	adminNotesVal := cleanOptionalString(req.AdminNotes)

	// 2. If approving, provision Brand and Supplier User with Setup Token
	if req.Status == "approved" {
		if err := h.handleApplicationApproval(ctx, &app); err != nil {
			log.Printf("[SUPPLIER APPROVAL ERROR] %v", err)
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
			return
		}
	}

	// 3. Update application status
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

	respMsg := "Başvuru durumu güncellendi."
	if req.Status == "approved" {
		respMsg = "Başvuru onaylandı. Tedarikçi markası ve hesabı oluşturuldu, şifre belirleme daveti e-posta ile iletildi."
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": respMsg,
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

func (h *SupplierApplicationsHandler) getOrCreateBrand(ctx context.Context, app *models.SupplierApplication) (string, error) {
	var brandID string
	var brandAlias string
	err := db.Pool.QueryRow(ctx, "SELECT id, coalesce(alias_code, '') FROM catalog.brands WHERE lower(brand_name) = lower($1) LIMIT 1", app.CompanyName).Scan(&brandID, &brandAlias)
	if err == nil {
		return brandID, nil
	}

	brandSlug := slugify(app.CompanyName)
	brandAlias = generateBrandAlias(app.CompanyName)
	var aliasExists bool
	_ = db.Pool.QueryRow(ctx, "SELECT true FROM catalog.brands WHERE alias_code = $1", brandAlias).Scan(&aliasExists)
	if aliasExists {
		brandAlias = fmt.Sprintf("%s%s", brandAlias, strings.ToUpper(generateSecureToken(2)))
	}

	cityStr := truncateStr(derefTrimmed(app.City), 100)
	districtStr := truncateStr(derefTrimmed(app.District), 100)
	instagramStr := normalizeBrandInstagramHandle(derefTrimmed(app.Instagram))
	websitePtr := normalizeBrandWebsite(derefTrimmed(app.Website))
	waStr := truncateStr(strings.TrimSpace(app.Phone), 50)
	emailStr := truncateStr(strings.TrimSpace(app.Email), 150)

	insErr := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.brands (
			brand_name, slug, alias_code, is_active, phone, whatsapp_phone,
			public_email, website, instagram_handle, city, district
		)
		VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id`,
		app.CompanyName, brandSlug, brandAlias, app.Phone, waStr,
		emailStr, websitePtr, instagramStr, cityStr, districtStr,
	).Scan(&brandID)
	if insErr != nil {
		return "", fmt.Errorf("marka oluşturulamadı: %w", insErr)
	}
	return brandID, nil
}

func (h *SupplierApplicationsHandler) upsertSupplierUser(ctx context.Context, brandID string, app *models.SupplierApplication) (string, error) {
	setupToken := generateSecureToken(32)
	setupExpires := time.Now().Add(48 * time.Hour)
	phoneVal := cleanOptionalString(app.Phone)

	var existingUserID string
	_ = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.supplier_users WHERE lower(email) = lower($1)", app.Email).Scan(&existingUserID)

	var err error
	if existingUserID != "" {
		_, err = db.Pool.Exec(ctx, `
			UPDATE catalog.supplier_users 
			SET brand_id = $1, setup_token = $2, setup_token_expires_at = $3, is_active = true, updated_at = CURRENT_TIMESTAMP
			WHERE id = $4`, brandID, setupToken, setupExpires, existingUserID)
	} else {
		_, err = db.Pool.Exec(ctx, `
			INSERT INTO catalog.supplier_users (brand_id, email, contact_name, phone, is_owner, is_active, setup_token, setup_token_expires_at)
			VALUES ($1, $2, $3, $4, true, true, $5, $6)`, brandID, app.Email, app.ContactName, phoneVal, setupToken, setupExpires)
	}
	if err != nil {
		return "", fmt.Errorf("kullanıcı oluşturulamadı: %w", err)
	}
	return setupToken, nil
}

func (h *SupplierApplicationsHandler) handleApplicationApproval(ctx context.Context, app *models.SupplierApplication) error {
	brandID, err := h.getOrCreateBrand(ctx, app)
	if err != nil {
		return err
	}

	setupToken, err := h.upsertSupplierUser(ctx, brandID, app)
	if err != nil {
		return err
	}

	setupURL := fmt.Sprintf("https://mertervitrini.com.tr/supplier/set-password?token=%s", setupToken)
	mailer.SendSupplierApplicationApprovedEmail(h.Cfg, app.CompanyName, app.ContactName, app.Email, setupURL)
	return nil
}

func cleanOptionalString(s string) *string {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

