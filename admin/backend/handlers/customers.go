package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"mertervitrini/admin/backend/db"
)

type CustomersHandler struct{}

func NewCustomersHandler() *CustomersHandler {
	return &CustomersHandler{}
}

type CustomerResponse struct {
	ID          string  `json:"id"`
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	Email       string  `json:"email"`
	Phone       string  `json:"phone"`
	Role        string  `json:"role"`
	IsActive    bool    `json:"is_active"`
	IsBlocked   bool    `json:"is_blocked"`
	BlockReason *string `json:"block_reason"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type ToggleBlockRequest struct {
	IsBlocked   bool   `json:"is_blocked"`
	BlockReason string `json:"block_reason"`
}

func (h *CustomersHandler) ListCustomers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	search := strings.TrimSpace(r.URL.Query().Get("search"))

	query := `
		SELECT id, first_name, last_name, email, COALESCE(phone, ''), user_role, is_active, is_blocked, block_reason, created_at, updated_at
		FROM identity.users
		WHERE user_role = 'customer'
	`
	var args []any
	if search != "" {
		query += " AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)"
		args = append(args, "%"+search+"%")
	}
	query += " ORDER BY created_at DESC"

	rows, err := db.Pool.Query(r.Context(), query, args...)
	if err != nil {
		log.Printf("[ADMIN CUSTOMERS ERROR] Failed to list customers: %v", err)
		http.Error(w, `{"error":"Müşteri listesi alınırken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	customers := []CustomerResponse{}
	for rows.Next() {
		var c CustomerResponse
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&c.ID, &c.FirstName, &c.LastName, &c.Email, &c.Phone, &c.Role, &c.IsActive, &c.IsBlocked, &c.BlockReason, &createdAt, &updatedAt); err != nil {
			log.Printf("[ADMIN CUSTOMERS ERROR] Failed to scan customer: %v", err)
			continue
		}
		
		c.CreatedAt = createdAt.Format(time.RFC3339)
		c.UpdatedAt = updatedAt.Format(time.RFC3339)

		customers = append(customers, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(customers)
}

func (h *CustomersHandler) ToggleBlockCustomer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	customerID := r.PathValue("id")
	if customerID == "" {
		http.Error(w, `{"error":"Müşteri ID bulunamadı"}`, http.StatusBadRequest)
		return
	}

	var req ToggleBlockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek gövdesi"}`, http.StatusBadRequest)
		return
	}

	var blockReasonPtr *string
	if req.IsBlocked && req.BlockReason != "" {
		reason := req.BlockReason
		blockReasonPtr = &reason
	}

	_, err := db.Pool.Exec(r.Context(), `
		UPDATE identity.users
		SET is_blocked = $1, block_reason = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3 AND user_role = 'customer'
	`, req.IsBlocked, blockReasonPtr, customerID)

	if err != nil {
		log.Printf("[ADMIN CUSTOMERS ERROR] Failed to toggle customer block status: %v", err)
		http.Error(w, `{"error":"Müşteri durumu güncellenirken hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true,"message":"Müşteri durumu başarıyla güncellendi"}`))
}
