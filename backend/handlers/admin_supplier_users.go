package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
)

type AdminSupplierUsersHandler struct {
	Cfg *config.Config
}

func NewAdminSupplierUsersHandler(cfg *config.Config) *AdminSupplierUsersHandler {
	return &AdminSupplierUsersHandler{Cfg: cfg}
}

// ListSupplierUsers returns all registered supplier accounts with brand details
func (h *AdminSupplierUsersHandler) ListSupplierUsers(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	query := `
		SELECT 
			u.id, 
			u.brand_id, 
			b.brand_name, 
			coalesce(b.alias_code, '') as alias_code,
			u.email, 
			u.contact_name, 
			u.phone, 
			u.keycloak_id,
			u.is_active, 
			u.last_login_at, 
			u.created_at, 
			u.updated_at
		FROM catalog.supplier_users u
		JOIN catalog.brands b ON u.brand_id = b.id
		ORDER BY b.brand_name ASC, u.created_at DESC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("[SUPPLIER USERS] List error: %v", err)
		http.Error(w, `{"error":"Tedarikçi kullanıcıları listelenirken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := make([]*models.SupplierUser, 0)
	for rows.Next() {
		var u models.SupplierUser
		if err := rows.Scan(
			&u.ID,
			&u.BrandID,
			&u.BrandName,
			&u.AliasCode,
			&u.Email,
			&u.ContactName,
			&u.Phone,
			&u.KeycloakID,
			&u.IsActive,
			&u.LastLoginAt,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			log.Printf("[SUPPLIER USERS] Scan error: %v", err)
			continue
		}
		users = append(users, &u)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(users)
}

// CreateSupplierUser creates a new supplier login account in both Keycloak and PostgreSQL
func (h *AdminSupplierUsersHandler) CreateSupplierUser(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSupplierUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek gövdesi"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.ContactName = strings.TrimSpace(req.ContactName)
	req.BrandID = strings.TrimSpace(req.BrandID)

	if req.BrandID == "" || req.Email == "" || req.Password == "" || req.ContactName == "" {
		http.Error(w, `{"error":"Tedarikçi firma, e-posta, yetkili kişi ve şifre zorunludur"}`, http.StatusBadRequest)
		return
	}

	if len(req.Password) < 6 {
		http.Error(w, `{"error":"Şifre en az 6 karakter olmalıdır"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	// Check if email already exists in local DB
	var exists bool
	err := db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.supplier_users WHERE lower(email) = $1)", req.Email).Scan(&exists)
	if err != nil {
		http.Error(w, `{"error":"E-posta kontrolü yapılamadı"}`, http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, `{"error":"Bu e-posta adresi ile kayıtlı bir tedarikçi hesabı zaten var"}`, http.StatusConflict)
		return
	}

	// 1. Create or sync user in Keycloak (Authoritative Identity Provider)
	keycloakID, kcErr := createKeycloakSupplierUser(ctx, h.Cfg, req.Email, req.ContactName, req.Password, req.Phone, req.BrandID)
	if kcErr != nil {
		log.Printf("[SUPPLIER USERS KEYCLOAK WARNING] Failed to create in Keycloak: %v", kcErr)
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"Şifre şifrelenemedi"}`, http.StatusInternalServerError)
		return
	}

	var phoneVal *string
	if strings.TrimSpace(req.Phone) != "" {
		p := strings.TrimSpace(req.Phone)
		phoneVal = &p
	}

	var kcIDVal *string
	if keycloakID != "" {
		kcIDVal = &keycloakID
	}

	var newID string
	insertQuery := `
		INSERT INTO catalog.supplier_users (brand_id, email, password_hash, contact_name, phone, is_active, keycloak_id)
		VALUES ($1, $2, $3, $4, $5, true, $6)
		RETURNING id`

	err = db.Pool.QueryRow(ctx, insertQuery, req.BrandID, req.Email, string(hashed), req.ContactName, phoneVal, kcIDVal).Scan(&newID)
	if err != nil {
		log.Printf("[SUPPLIER USERS] Insert error: %v", err)
		http.Error(w, fmt.Sprintf(`{"error":"Kullanıcı oluşturulamadı: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message":     "Tedarikçi kullanıcısı başarıyla oluşturuldu.",
		"id":          newID,
		"keycloak_id": keycloakID,
	})
}

// UpdateSupplierUser updates contact info, active status, or resets password (synced with Keycloak)
func (h *AdminSupplierUsersHandler) UpdateSupplierUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"ID zorunludur"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateSupplierUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek gövdesi"}`, http.StatusBadRequest)
		return
	}

	req.ContactName = strings.TrimSpace(req.ContactName)
	if req.ContactName == "" {
		http.Error(w, `{"error":"Yetkili kişi adı zorunludur"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	// Fetch existing keycloak_id and email
	var existingKC *string
	var existingEmail string
	err := db.Pool.QueryRow(ctx, "SELECT keycloak_id, email FROM catalog.supplier_users WHERE id = $1", id).Scan(&existingKC, &existingEmail)
	if err != nil {
		http.Error(w, `{"error":"Kullanıcı bulunamadı"}`, http.StatusNotFound)
		return
	}

	// 1. Sync update to Keycloak
	if existingKC != nil && *existingKC != "" {
		_ = updateKeycloakSupplierUser(ctx, h.Cfg, *existingKC, req.ContactName, req.Password, req.IsActive)
	} else if existingEmail != "" {
		// If keycloak_id was missing, locate user in Keycloak and sync
		adminToken, tErr := getKeycloakAdminToken(ctx, h.Cfg)
		if tErr == nil {
			foundID, fErr := findKeycloakUserIDByEmail(ctx, h.Cfg, adminToken, existingEmail)
			if fErr == nil && foundID != "" {
				_ = updateKeycloakSupplierUser(ctx, h.Cfg, foundID, req.ContactName, req.Password, req.IsActive)
				_, _ = db.Pool.Exec(ctx, "UPDATE catalog.supplier_users SET keycloak_id = $1 WHERE id = $2", foundID, id)
			}
		}
	}

	var phoneVal *string
	if strings.TrimSpace(req.Phone) != "" {
		p := strings.TrimSpace(req.Phone)
		phoneVal = &p
	}

	if strings.TrimSpace(req.Password) != "" {
		if len(req.Password) < 6 {
			http.Error(w, `{"error":"Şifre en az 6 karakter olmalıdır"}`, http.StatusBadRequest)
			return
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, `{"error":"Şifre şifrelenemedi"}`, http.StatusInternalServerError)
			return
		}

		query := `
			UPDATE catalog.supplier_users 
			SET contact_name = $1, phone = $2, is_active = $3, password_hash = $4, updated_at = CURRENT_TIMESTAMP
			WHERE id = $5`
		_, err = db.Pool.Exec(ctx, query, req.ContactName, phoneVal, req.IsActive, string(hashed), id)
	} else {
		query := `
			UPDATE catalog.supplier_users 
			SET contact_name = $1, phone = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
			WHERE id = $4`
		_, err = db.Pool.Exec(ctx, query, req.ContactName, phoneVal, req.IsActive, id)
	}

	if err != nil {
		log.Printf("[SUPPLIER USERS] Update error: %v", err)
		http.Error(w, `{"error":"Kullanıcı güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Tedarikçi bilgileri güncellendi."})
}

// DeleteSupplierUser deletes a supplier login account from both PostgreSQL and Keycloak
func (h *AdminSupplierUsersHandler) DeleteSupplierUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"ID zorunludur"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var kcID *string
	_ = db.Pool.QueryRow(ctx, "SELECT keycloak_id FROM catalog.supplier_users WHERE id = $1", id).Scan(&kcID)
	if kcID != nil && *kcID != "" {
		_ = deleteKeycloakSupplierUser(ctx, h.Cfg, *kcID)
	}

	_, err := db.Pool.Exec(ctx, "DELETE FROM catalog.supplier_users WHERE id = $1", id)
	if err != nil {
		log.Printf("[SUPPLIER USERS] Delete error: %v", err)
		http.Error(w, `{"error":"Kullanıcı silinemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Tedarikçi hesabı silindi."})
}
