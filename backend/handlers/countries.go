package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
)

type CountriesHandler struct{}

func NewCountriesHandler() *CountriesHandler {
	return &CountriesHandler{}
}

// =========================================================================
// COUNTRIES ENDPOINTS
// =========================================================================

// ListCountries fetches all countries, optionally filtered by code or name
func (h *CountriesHandler) ListCountries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, code, phone_code, localized_names AS names, created_at, updated_at 
		FROM catalog.countries 
		ORDER BY localized_names->>'tr_TR' ASC, localized_names->>'en_US' ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list countries: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var countries []*models.Country
	for rows.Next() {
		var c models.Country
		var namesJSON []byte
		err := rows.Scan(&c.ID, &c.Code, &c.PhoneCode, &namesJSON, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan country: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		c.Names = make(map[string]string)
		if len(namesJSON) > 0 {
			_ = json.Unmarshal(namesJSON, &c.Names)
		}
		countries = append(countries, &c)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(countries)
}

// CreateCountry adds a new country record
func (h *CountriesHandler) CreateCountry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Code      string            `json:"code"`
		PhoneCode *int              `json:"phone_code"`
		Names     map[string]string `json:"names"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" || len(req.Names) == 0 {
		http.Error(w, `{"error":"Country code and multilingual names are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	namesJSON, _ := json.Marshal(req.Names)

	query := `
		INSERT INTO catalog.countries (code, phone_code, localized_names) 
		VALUES (UPPER($1), $2, $3) 
		RETURNING id, code, phone_code, localized_names AS names, created_at, updated_at`

	var c models.Country
	var respNamesJSON []byte
	err := db.Pool.QueryRow(ctx, query, req.Code, req.PhoneCode, namesJSON).Scan(
		&c.ID, &c.Code, &c.PhoneCode, &respNamesJSON, &c.CreatedAt, &c.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to create country: %v", err)
		http.Error(w, `{"error":"Country code already exists"}`, http.StatusBadRequest)
		return
	}

	c.Names = make(map[string]string)
	if len(respNamesJSON) > 0 {
		_ = json.Unmarshal(respNamesJSON, &c.Names)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

// UpdateCountry edits an existing country record
func (h *CountriesHandler) UpdateCountry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Country ID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Code      string            `json:"code"`
		PhoneCode *int              `json:"phone_code"`
		Names     map[string]string `json:"names"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" || len(req.Names) == 0 {
		http.Error(w, `{"error":"Country code and multilingual names are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	namesJSON, _ := json.Marshal(req.Names)

	query := `
		UPDATE catalog.countries 
		SET code = UPPER($1), phone_code = $2, localized_names = $3, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $4 
		RETURNING id, code, phone_code, localized_names AS names, created_at, updated_at`

	var c models.Country
	var respNamesJSON []byte
	err := db.Pool.QueryRow(ctx, query, req.Code, req.PhoneCode, namesJSON, id).Scan(
		&c.ID, &c.Code, &c.PhoneCode, &respNamesJSON, &c.CreatedAt, &c.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Country not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update country %s: %v", id, err)
		http.Error(w, `{"error":"Country code already exists"}`, http.StatusBadRequest)
		return
	}

	c.Names = make(map[string]string)
	if len(respNamesJSON) > 0 {
		_ = json.Unmarshal(respNamesJSON, &c.Names)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(c)
}

// DeleteCountry deletes an existing country record
func (h *CountriesHandler) DeleteCountry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Country ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM catalog.countries WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete country %s: %v", id, err)
		http.Error(w, `{"error":"Failed to delete country"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"Country not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// =========================================================================
// COUNTRY STATES ENDPOINTS
// =========================================================================

// ListCountryStates fetches all states for a specific country
func (h *CountriesHandler) ListCountryStates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	countryID := r.PathValue("id")
	if countryID == "" {
		http.Error(w, `{"error":"Country ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, country_id, code, state_name AS name, created_at, updated_at 
		FROM catalog.country_states 
		WHERE country_id = $1 
		ORDER BY state_name ASC`

	rows, err := db.Pool.Query(ctx, query, countryID)
	if err != nil {
		log.Printf("Failed to list country states: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var states []*models.CountryState
	for rows.Next() {
		var s models.CountryState
		err := rows.Scan(&s.ID, &s.CountryID, &s.Code, &s.Name, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan state: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		states = append(states, &s)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(states)
}

// CreateCountryState adds a new state/province record
func (h *CountriesHandler) CreateCountryState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CountryID string `json:"country_id"`
		Code      string `json:"code"`
		Name      string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.CountryID == "" || req.Code == "" || req.Name == "" {
		http.Error(w, `{"error":"Country ID, state code and name are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO catalog.country_states (country_id, code, state_name) 
		VALUES ($1, UPPER($2), $3) 
		RETURNING id, country_id, code, state_name AS name, created_at, updated_at`

	var s models.CountryState
	err := db.Pool.QueryRow(ctx, query, req.CountryID, req.Code, req.Name).Scan(
		&s.ID, &s.CountryID, &s.Code, &s.Name, &s.CreatedAt, &s.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to create country state: %v", err)
		http.Error(w, `{"error":"Failed to create country state"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(s)
}

// UpdateCountryState edits an existing state/province record
func (h *CountriesHandler) UpdateCountryState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"State ID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Code string `json:"code"`
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" || req.Name == "" {
		http.Error(w, `{"error":"State code and name are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		UPDATE catalog.country_states 
		SET code = UPPER($1), state_name = $2, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $3 
		RETURNING id, country_id, code, state_name AS name, created_at, updated_at`

	var s models.CountryState
	err := db.Pool.QueryRow(ctx, query, req.Code, req.Name, id).Scan(
		&s.ID, &s.CountryID, &s.Code, &s.Name, &s.CreatedAt, &s.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"State not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update country state %s: %v", id, err)
		http.Error(w, `{"error":"Failed to update country state"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(s)
}

// DeleteCountryState deletes an existing state/province record
func (h *CountriesHandler) DeleteCountryState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"State ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM catalog.country_states WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete country state %s: %v", id, err)
		http.Error(w, `{"error":"Failed to delete country state"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"State not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// =========================================================================
// COUNTRY GROUPS ENDPOINTS
// =========================================================================

// ListCountryGroups fetches all country groups
func (h *CountriesHandler) ListCountryGroups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, code, localized_names AS names, created_at, updated_at 
		FROM catalog.country_groups 
		ORDER BY localized_names->>'tr_TR' ASC, localized_names->>'en_US' ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list country groups: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var groups []*models.CountryGroup
	for rows.Next() {
		var g models.CountryGroup
		var namesJSON []byte
		err := rows.Scan(&g.ID, &g.Code, &namesJSON, &g.CreatedAt, &g.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan group: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		g.Names = make(map[string]string)
		if len(namesJSON) > 0 {
			_ = json.Unmarshal(namesJSON, &g.Names)
		}
		groups = append(groups, &g)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(groups)
}

// CreateCountryGroup adds a new country group record
func (h *CountriesHandler) CreateCountryGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Code  string            `json:"code"`
		Names map[string]string `json:"names"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" || len(req.Names) == 0 {
		http.Error(w, `{"error":"Group code and multilingual names are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	namesJSON, _ := json.Marshal(req.Names)

	query := `
		INSERT INTO catalog.country_groups (code, localized_names) 
		VALUES (UPPER($1), $2) 
		RETURNING id, code, localized_names AS names, created_at, updated_at`

	var g models.CountryGroup
	var respNamesJSON []byte
	err := db.Pool.QueryRow(ctx, query, req.Code, namesJSON).Scan(
		&g.ID, &g.Code, &respNamesJSON, &g.CreatedAt, &g.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to create country group: %v", err)
		http.Error(w, `{"error":"Group code already exists"}`, http.StatusBadRequest)
		return
	}

	g.Names = make(map[string]string)
	if len(respNamesJSON) > 0 {
		_ = json.Unmarshal(respNamesJSON, &g.Names)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(g)
}

// UpdateCountryGroup edits an existing country group record
func (h *CountriesHandler) UpdateCountryGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Group ID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Code  string            `json:"code"`
		Names map[string]string `json:"names"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" || len(req.Names) == 0 {
		http.Error(w, `{"error":"Group code and multilingual names are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	namesJSON, _ := json.Marshal(req.Names)

	query := `
		UPDATE catalog.country_groups 
		SET code = UPPER($1), localized_names = $2, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $3 
		RETURNING id, code, localized_names AS names, created_at, updated_at`

	var g models.CountryGroup
	var respNamesJSON []byte
	err := db.Pool.QueryRow(ctx, query, req.Code, namesJSON, id).Scan(
		&g.ID, &g.Code, &respNamesJSON, &g.CreatedAt, &g.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Group not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update country group %s: %v", id, err)
		http.Error(w, `{"error":"Group code already exists"}`, http.StatusBadRequest)
		return
	}

	g.Names = make(map[string]string)
	if len(respNamesJSON) > 0 {
		_ = json.Unmarshal(respNamesJSON, &g.Names)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(g)
}

// DeleteCountryGroup deletes an existing country group record
func (h *CountriesHandler) DeleteCountryGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Group ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM catalog.country_groups WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete country group %s: %v", id, err)
		http.Error(w, `{"error":"Failed to delete country group"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"Group not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// =========================================================================
// CURRENCIES ENDPOINTS
// =========================================================================

// ListCurrencies fetches all currencies
func (h *CountriesHandler) ListCurrencies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, currency_code AS name, symbol, full_name, is_active AS active, created_at, updated_at 
		FROM catalog.currencies 
		ORDER BY currency_code ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list currencies: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var currencies []*models.Currency
	for rows.Next() {
		var c models.Currency
		err := rows.Scan(&c.ID, &c.Name, &c.Symbol, &c.FullName, &c.Active, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan currency: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		currencies = append(currencies, &c)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(currencies)
}

// CreateCurrency adds a new currency record
func (h *CountriesHandler) CreateCurrency(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name     string `json:"name"`
		Symbol   string `json:"symbol"`
		FullName string `json:"full_name"`
		Active   bool   `json:"active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Symbol == "" || req.FullName == "" {
		http.Error(w, `{"error":"Name, Symbol and Full Name are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO catalog.currencies (currency_code, symbol, full_name, is_active) 
		VALUES (UPPER($1), $2, $3, $4) 
		RETURNING id, currency_code AS name, symbol, full_name, is_active AS active, created_at, updated_at`

	var c models.Currency
	err := db.Pool.QueryRow(ctx, query, req.Name, req.Symbol, req.FullName, req.Active).Scan(
		&c.ID, &c.Name, &c.Symbol, &c.FullName, &c.Active, &c.CreatedAt, &c.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to create currency: %v", err)
		http.Error(w, `{"error":"Currency name already exists"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

// UpdateCurrency edits an existing currency record
func (h *CountriesHandler) UpdateCurrency(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Currency ID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Name     string `json:"name"`
		Symbol   string `json:"symbol"`
		FullName string `json:"full_name"`
		Active   bool   `json:"active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Symbol == "" || req.FullName == "" {
		http.Error(w, `{"error":"Name, Symbol and Full Name are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		UPDATE catalog.currencies 
		SET currency_code = UPPER($1), symbol = $2, full_name = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $5 
		RETURNING id, currency_code AS name, symbol, full_name, is_active AS active, created_at, updated_at`

	var c models.Currency
	err := db.Pool.QueryRow(ctx, query, req.Name, req.Symbol, req.FullName, req.Active, id).Scan(
		&c.ID, &c.Name, &c.Symbol, &c.FullName, &c.Active, &c.CreatedAt, &c.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Currency not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update currency %s: %v", id, err)
		http.Error(w, `{"error":"Currency name already exists"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(c)
}

// DeleteCurrency deletes an existing currency record
func (h *CountriesHandler) DeleteCurrency(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Currency ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM catalog.currencies WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete currency %s: %v", id, err)
		http.Error(w, `{"error":"Failed to delete currency"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"Currency not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// =========================================================================
// LANGUAGES ENDPOINTS
// =========================================================================

// ListLanguages fetches all languages
func (h *CountriesHandler) ListLanguages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, code, label, flag, category_prefix, text_direction AS dir, is_active, sort_order, created_at, updated_at 
		FROM catalog.languages 
		ORDER BY sort_order ASC, code ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list languages: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var languages []*models.Language
	for rows.Next() {
		var l models.Language
		err := rows.Scan(&l.ID, &l.Code, &l.Label, &l.Flag, &l.CategoryPrefix, &l.Dir, &l.IsActive, &l.SortOrder, &l.CreatedAt, &l.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan language: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		languages = append(languages, &l)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(languages)
}

// CreateLanguage adds a new language record
func (h *CountriesHandler) CreateLanguage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Code           string `json:"code"`
		Label          string `json:"label"`
		Flag           string `json:"flag"`
		CategoryPrefix string `json:"categoryPrefix"`
		Dir            string `json:"dir"`
		IsActive       bool   `json:"isActive"`
		SortOrder      int    `json:"sortOrder"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" || req.Label == "" || req.Flag == "" || req.CategoryPrefix == "" {
		http.Error(w, `{"error":"Code, Label, Flag and CategoryPrefix are required"}`, http.StatusBadRequest)
		return
	}

	// Default values
	if req.Dir == "" {
		req.Dir = "ltr"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO catalog.languages (code, label, flag, category_prefix, text_direction, is_active, sort_order) 
		VALUES ($1, $2, $3, $4, $5, $6, $7) 
		RETURNING id, code, label, flag, category_prefix, text_direction AS dir, is_active, sort_order, created_at, updated_at`

	var l models.Language
	err := db.Pool.QueryRow(ctx, query, req.Code, req.Label, req.Flag, req.CategoryPrefix, req.Dir, req.IsActive, req.SortOrder).Scan(
		&l.ID, &l.Code, &l.Label, &l.Flag, &l.CategoryPrefix, &l.Dir, &l.IsActive, &l.SortOrder, &l.CreatedAt, &l.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to create language: %v", err)
		http.Error(w, `{"error":"Language code already exists"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(l)
}

// UpdateLanguage edits an existing language record
func (h *CountriesHandler) UpdateLanguage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Language ID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Code           string `json:"code"`
		Label          string `json:"label"`
		Flag           string `json:"flag"`
		CategoryPrefix string `json:"categoryPrefix"`
		Dir            string `json:"dir"`
		IsActive       bool   `json:"isActive"`
		SortOrder      int    `json:"sortOrder"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" || req.Label == "" || req.Flag == "" || req.CategoryPrefix == "" {
		http.Error(w, `{"error":"Code, Label, Flag and CategoryPrefix are required"}`, http.StatusBadRequest)
		return
	}

	if req.Dir == "" {
		req.Dir = "ltr"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		UPDATE catalog.languages 
		SET code = $1, label = $2, flag = $3, category_prefix = $4, text_direction = $5, is_active = $6, sort_order = $7, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $8 
		RETURNING id, code, label, flag, category_prefix, text_direction AS dir, is_active, sort_order, created_at, updated_at`

	var l models.Language
	err := db.Pool.QueryRow(ctx, query, req.Code, req.Label, req.Flag, req.CategoryPrefix, req.Dir, req.IsActive, req.SortOrder, id).Scan(
		&l.ID, &l.Code, &l.Label, &l.Flag, &l.CategoryPrefix, &l.Dir, &l.IsActive, &l.SortOrder, &l.CreatedAt, &l.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Language not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update language %s: %v", id, err)
		http.Error(w, `{"error":"Language code already exists"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(l)
}

// DeleteLanguage deletes an existing language record
func (h *CountriesHandler) DeleteLanguage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Language ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM catalog.languages WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete language %s: %v", id, err)
		http.Error(w, `{"error":"Failed to delete language"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"Language not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}


