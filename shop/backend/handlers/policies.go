package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/shop/backend/db"
	"mertervitrini/shop/backend/models"
)

type PoliciesHandler struct{}

func NewPoliciesHandler() *PoliciesHandler {
	return &PoliciesHandler{}
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

	if policyType != "cancellation_and_return" && policyType != "terms_of_service" && policyType != "privacy_policy" {
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

	// Expose header to allow storefront clients to inspect policy metadata
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Policy-Version", fmt.Sprintf("%d", p.Version))
	w.Header().Set("Access-Control-Expose-Headers", "X-Policy-Version")
	json.NewEncoder(w).Encode(p)
}
