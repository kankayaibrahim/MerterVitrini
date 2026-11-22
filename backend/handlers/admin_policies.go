package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"

	"github.com/jackc/pgx/v5"
)

type PoliciesHandler struct{}

func NewPoliciesHandler() *PoliciesHandler {
	return &PoliciesHandler{}
}

// =========================================================================
// ENDPOINTS
// =========================================================================

// ListPolicies returns the currently active policy versions for all types
func (h *PoliciesHandler) ListPolicies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, policy_type AS type, policy_version AS version, title, content, is_active, created_by, created_at, updated_at 
		FROM catalog.legal_policies 
		WHERE is_active = true 
		ORDER BY policy_type ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list active policies: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var policies []*models.LegalPolicy
	for rows.Next() {
		var p models.LegalPolicy
		err := rows.Scan(&p.ID, &p.Type, &p.Version, &p.Title, &p.Content, &p.IsActive, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan active policy: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		policies = append(policies, &p)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(policies)
}

// GetPolicyHistory returns all versions (active and inactive) for a specific policy type
func (h *PoliciesHandler) GetPolicyHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	policyType := r.PathValue("type")
	if policyType == "" {
		http.Error(w, `{"error":"Policy type parameter is required"}`, http.StatusBadRequest)
		return
	}

	// Validate enum type
	if !isValidPolicyType(policyType) {
		http.Error(w, `{"error":"Invalid policy type"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, policy_type AS type, policy_version AS version, title, content, is_active, created_by, created_at, updated_at 
		FROM catalog.legal_policies 
		WHERE policy_type = $1 
		ORDER BY policy_version DESC`

	rows, err := db.Pool.Query(ctx, query, policyType)
	if err != nil {
		log.Printf("Failed to fetch policy history for %s: %v", policyType, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var policies []*models.LegalPolicy
	for rows.Next() {
		var p models.LegalPolicy
		err := rows.Scan(&p.ID, &p.Type, &p.Version, &p.Title, &p.Content, &p.IsActive, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan policy history: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		policies = append(policies, &p)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(policies)
}

// CreatePolicyVersion adds a new version for a specific policy type
func (h *PoliciesHandler) CreatePolicyVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Type    string `json:"type"`
		Title   string `json:"title"`
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Type == "" || req.Title == "" || req.Content == "" {
		http.Error(w, `{"error":"Type, Title and Content are required"}`, http.StatusBadRequest)
		return
	}

	if !isValidPolicyType(req.Type) {
		http.Error(w, `{"error":"Invalid policy type"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Extract authenticated user ID from context
	var createdBy *string
	if user, ok := middleware.GetUserFromContext(r.Context()); ok {
		createdBy = &user.ID
	}

	// Begin TX to get max version and insert safely
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Fetch current max version
	var maxVersion int
	err = tx.QueryRow(ctx, "SELECT COALESCE(MAX(policy_version), 0) FROM catalog.legal_policies WHERE policy_type = $1", req.Type).Scan(&maxVersion)
	if err != nil {
		log.Printf("Failed to fetch max policy version: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	nextVersion := maxVersion + 1

	// Insert the new version (defaults to inactive)
	query := `
		INSERT INTO catalog.legal_policies (policy_type, policy_version, title, content, is_active, created_by) 
		VALUES ($1, $2, $3, $4, false, $5) 
		RETURNING id, policy_type AS type, policy_version AS version, title, content, is_active, created_by, created_at, updated_at`

	var p models.LegalPolicy
	err = tx.QueryRow(ctx, query, req.Type, nextVersion, req.Title, req.Content, createdBy).Scan(
		&p.ID, &p.Type, &p.Version, &p.Title, &p.Content, &p.IsActive, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to create policy version: %v", err)
		http.Error(w, `{"error":"Failed to create policy version"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

// ActivatePolicyVersion activates a specific policy version ID and deactivates other versions of the same type
func (h *PoliciesHandler) ActivatePolicyVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Policy ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Begin transactional active switch
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin active-switch transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// 1. Get the policy type for this ID to ensure target deactivation scope
	var policyType string
	err = tx.QueryRow(ctx, "SELECT policy_type FROM catalog.legal_policies WHERE id = $1", id).Scan(&policyType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Policy not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to find policy: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	// 2. Set all versions of this policy type to inactive
	_, err = tx.Exec(ctx, "UPDATE catalog.legal_policies SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE policy_type = $1", policyType)
	if err != nil {
		log.Printf("Failed to deactivate older policies: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	// 3. Set the target policy ID to active
	var p models.LegalPolicy
	query := `
		UPDATE catalog.legal_policies 
		SET is_active = true, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $1 
		RETURNING id, policy_type AS type, policy_version AS version, title, content, is_active, created_by, created_at, updated_at`

	err = tx.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Type, &p.Version, &p.Title, &p.Content, &p.IsActive, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		log.Printf("Failed to activate target policy version: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit active-switch: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(p)
}

func normalizePolicyLang(raw string) string {
	cleaned := strings.ToLower(strings.TrimSpace(raw))
	if cleaned == "" {
		return "tr"
	}
	if idx := strings.IndexAny(cleaned, "_-"); idx > 0 {
		cleaned = cleaned[:idx]
	}
	switch cleaned {
	case "tr", "en", "ru", "ar", "de", "fr", "pl", "bg":
		return cleaned
	default:
		return "tr"
	}
}

func policyTypeToPageSlug(policyType string) string {
	switch strings.TrimSpace(policyType) {
	case "cancellation_and_return":
		return "iptal-iade-kosullari"
	case "terms_of_service":
		return "kullanici-sozlesmesi"
	case "privacy_policy":
		return "gizlilik-politikasi"
	case "supplier_agreement":
		return "tedarikci-sozlesmesi"
	case "copyright_and_takedown":
		return "telif-hakki-ve-uyar-kaldir"
	case "cookie_policy":
		return "cerez-politikasi"
	default:
		return ""
	}
}

func loadLocalizedPolicyFromCMS(ctx context.Context, policyType, lang string) (string, string, bool) {
	if lang == "" || lang == "tr" || db.Pool == nil {
		return "", "", false
	}
	slug := policyTypeToPageSlug(policyType)
	if slug == "" {
		return "", "", false
	}

	var title, content string
	err := db.Pool.QueryRow(ctx, `
		SELECT pt.title, pt.content
		FROM catalog.pages p
		JOIN catalog.page_translations pt ON pt.page_id = p.id
		WHERE p.slug = $1 AND p.is_active = true AND pt.language_code IN ($2, 'en')
		ORDER BY CASE WHEN pt.language_code = $2 THEN 0 ELSE 1 END
		LIMIT 1
	`, slug, lang).Scan(&title, &content)
	if err != nil {
		return "", "", false
	}
	if strings.TrimSpace(title) == "" || strings.TrimSpace(content) == "" {
		return "", "", false
	}
	return title, content, true
}

// GetActivePolicyByType (Public Endpoint) returns the active policy version for a type to be viewed on the storefront
func (h *PoliciesHandler) GetActivePolicyByType(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	policyType := r.PathValue("type")
	if policyType == "" {
		http.Error(w, `{"error":"Policy type is required"}`, http.StatusBadRequest)
		return
	}

	if !isValidPolicyType(policyType) {
		http.Error(w, `{"error":"Invalid policy type"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var p models.LegalPolicy
	query := `
		SELECT id, policy_type AS type, policy_version AS version, title, content, is_active, created_by, created_at, updated_at 
		FROM catalog.legal_policies 
		WHERE policy_type = $1 AND is_active = true 
		LIMIT 1`

	err := db.Pool.QueryRow(ctx, query, policyType).Scan(
		&p.ID, &p.Type, &p.Version, &p.Title, &p.Content, &p.IsActive, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"No active policy found for this type"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to fetch active policy for %s: %v", policyType, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	lang := normalizePolicyLang(r.URL.Query().Get("lang"))
	if lang != "tr" {
		if locTitle, locContent, ok := loadLocalizedPolicyFromCMS(ctx, policyType, lang); ok {
			p.Title = locTitle
			p.Content = locContent
		}
	}

	// Expose header to allow browsers to inspect policy metadata
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Header().Set("X-Policy-Version", fmt.Sprintf("%d", p.Version))
	w.Header().Set("X-Policy-Language", lang)
	w.Header().Set("Access-Control-Expose-Headers", "X-Policy-Version, X-Policy-Language")
	json.NewEncoder(w).Encode(p)
}
