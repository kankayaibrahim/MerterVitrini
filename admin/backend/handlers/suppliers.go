package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/admin/backend/db"
	"mertervitrini/admin/backend/models"
)

type SuppliersHandler struct{}

func NewSuppliersHandler() *SuppliersHandler {
	return &SuppliersHandler{}
}

// ListSuppliers fetches all suppliers (brands) with their XML feeds embedded
func (h *SuppliersHandler) ListSuppliers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// 1. Fetch all brands/suppliers
	brandQuery := `
		SELECT id, brand_name AS name, slug, alias_code, website, phone, addresses, is_active, created_at, updated_at 
		FROM catalog.brands 
		ORDER BY brand_name`

	bRows, err := db.Pool.Query(ctx, brandQuery)
	if err != nil {
		log.Printf("Failed to query suppliers: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer bRows.Close()

	var suppliers []*models.Brand
	supplierMap := make(map[string]*models.Brand)

	for bRows.Next() {
		var s models.Brand
		err := bRows.Scan(&s.ID, &s.Name, &s.Slug, &s.AliasCode, &s.Website, &s.Phone, &s.Addresses, &s.IsActive, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan supplier: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		s.Feeds = make([]*models.XmlFeed, 0)
		suppliers = append(suppliers, &s)
		supplierMap[s.ID] = &s
	}

	// 2. Fetch all XML feeds and map them to their corresponding brands
	feedQuery := `
		SELECT id, brand_id, feed_name AS name, alias_code, feed_url, mapping_config, category_mapping, is_active, created_at, updated_at 
		FROM integration.xml_feeds 
		ORDER BY id`

	fRows, err := db.Pool.Query(ctx, feedQuery)
	if err == nil {
		defer fRows.Close()
		for fRows.Next() {
			var f models.XmlFeed
			var mappingBytes, categoryBytes []byte
			err := fRows.Scan(&f.ID, &f.BrandID, &f.Name, &f.AliasCode, &f.FeedUrl, &mappingBytes, &categoryBytes, &f.IsActive, &f.CreatedAt, &f.UpdatedAt)
			if err == nil && f.BrandID != nil {
				if len(mappingBytes) > 0 {
					json.Unmarshal(mappingBytes, &f.MappingConfig)
				}
				if len(categoryBytes) > 0 {
					json.Unmarshal(categoryBytes, &f.CategoryMapping)
				}
				if supplier, exists := supplierMap[*f.BrandID]; exists {
					supplier.Feeds = append(supplier.Feeds, &f)
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suppliers)
}

// CreateSupplier adds a new brand/supplier
func (h *SuppliersHandler) CreateSupplier(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name      string  `json:"name"`
		AliasCode *string `json:"alias_code"`
		Website   *string `json:"website"`
		Phone     *string `json:"phone"`
		Addresses []any   `json:"addresses"`
		IsActive  bool    `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"Supplier name is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// 1. Generate slug
	var slug string
	err := db.Pool.QueryRow(ctx, "SELECT catalog.fn_slugify($1)", req.Name).Scan(&slug)
	if err != nil {
		log.Printf("Failed to generate slug: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	// 2. Set default alias_code if not provided
	aliasCode := req.AliasCode
	if aliasCode == nil || *aliasCode == "" {
		upperAlias := req.Name
		if len(upperAlias) > 8 {
			upperAlias = upperAlias[:8]
		}
		upperAliasStr := upperAlias
		aliasCode = &upperAliasStr
	}

	addressesJSON, _ := json.Marshal(req.Addresses)

	query := `
		INSERT INTO catalog.brands (brand_name, slug, alias_code, website, phone, addresses, is_active) 
		VALUES ($1, $2, UPPER($3), $4, $5, $6, $7) 
		RETURNING id, brand_name AS name, slug, alias_code, website, phone, addresses, is_active, created_at, updated_at`

	var s models.Brand
	err = db.Pool.QueryRow(ctx, query, req.Name, slug, *aliasCode, req.Website, req.Phone, addressesJSON, req.IsActive).Scan(
		&s.ID, &s.Name, &s.Slug, &s.AliasCode, &s.Website, &s.Phone, &s.Addresses, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to create supplier: %v", err)
		http.Error(w, `{"error":"Supplier name or alias code already exists"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(s)
}

// UpdateSupplier updates existing brand/supplier fields
func (h *SuppliersHandler) UpdateSupplier(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Supplier ID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Name      string  `json:"name"`
		AliasCode *string `json:"alias_code"`
		Website   *string `json:"website"`
		Phone     *string `json:"phone"`
		Addresses []any   `json:"addresses"`
		IsActive  bool    `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"Supplier name is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Generate slug
	var slug string
	err := db.Pool.QueryRow(ctx, "SELECT catalog.fn_slugify($1)", req.Name).Scan(&slug)
	if err != nil {
		log.Printf("Failed to generate slug: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	addressesJSON, _ := json.Marshal(req.Addresses)

	query := `
		UPDATE catalog.brands 
		SET brand_name = $1, slug = $2, alias_code = UPPER($3), website = $4, phone = $5, addresses = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
		WHERE id = $8
		RETURNING id, brand_name AS name, slug, alias_code, website, phone, addresses, is_active, created_at, updated_at`

	var s models.Brand
	err = db.Pool.QueryRow(ctx, query, req.Name, slug, req.AliasCode, req.Website, req.Phone, addressesJSON, req.IsActive, id).Scan(
		&s.ID, &s.Name, &s.Slug, &s.AliasCode, &s.Website, &s.Phone, &s.Addresses, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Supplier not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update supplier %s: %v", id, err)
		http.Error(w, `{"error":"Supplier name or alias code already exists"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

// DeleteSupplier deletes supplier (brand) by UUID (automatically cascades to feeds)
func (h *SuppliersHandler) DeleteSupplier(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Supplier ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM catalog.brands WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete supplier %s: %v", id, err)
		http.Error(w, `{"error":"Failed to delete supplier"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"Supplier not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// AddFeedToSupplier adds a new XML feed to a supplier
func (h *SuppliersHandler) AddFeedToSupplier(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	brandID := r.PathValue("id")
	if brandID == "" {
		http.Error(w, `{"error":"Supplier ID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		ID        string  `json:"id"` // Unique custom feed ID (e.g. 'janes_dress')
		Name      string  `json:"name"`
		AliasCode string  `json:"alias_code"`
		FeedUrl   *string `json:"feed_url"`
		IsActive  bool    `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.ID == "" || req.Name == "" || req.AliasCode == "" {
		http.Error(w, `{"error":"Feed ID, Name and Alias Code are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Verify supplier exists
	var exists bool
	err := db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.brands WHERE id = $1)", brandID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, `{"error":"Supplier not found"}`, http.StatusNotFound)
		return
	}

	// Clean up any other feeds that are assigned to the same brand_id or same alias_code but have a DIFFERENT id,
	// to avoid duplicate key conflicts (e.g. unique_alias_code_key)
	deleteQuery := `DELETE FROM integration.xml_feeds WHERE (brand_id = $1 OR alias_code = UPPER($2)) AND id != $3`
	_, err = db.Pool.Exec(ctx, deleteQuery, brandID, req.AliasCode, req.ID)
	if err != nil {
		log.Printf("Failed to delete conflicting feeds: %v", err)
	}

	query := `
		INSERT INTO integration.xml_feeds (id, brand_id, feed_name, alias_code, feed_url, is_active) 
		VALUES ($1, $2, $3, UPPER($4), $5, $6) 
		ON CONFLICT (id) DO UPDATE SET 
			brand_id = EXCLUDED.brand_id,
			feed_name = EXCLUDED.feed_name,
			alias_code = EXCLUDED.alias_code,
			feed_url = EXCLUDED.feed_url,
			is_active = EXCLUDED.is_active,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id, brand_id, feed_name AS name, alias_code, feed_url, is_active, created_at, updated_at`

	var f models.XmlFeed
	err = db.Pool.QueryRow(ctx, query, req.ID, brandID, req.Name, req.AliasCode, req.FeedUrl, req.IsActive).Scan(
		&f.ID, &f.BrandID, &f.Name, &f.AliasCode, &f.FeedUrl, &f.IsActive, &f.CreatedAt, &f.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to create/upsert feed (ID: %s, BrandID: %s): %v", req.ID, brandID, err)
		errMsg := strings.ReplaceAll(err.Error(), `"`, `\"`)
		errMsg = strings.ReplaceAll(errMsg, "\n", " ")
		http.Error(w, fmt.Sprintf(`{"error":"Veritabanı Hatası: %s"}`, errMsg), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(f)
}

// DeleteFeed deletes an XML feed by ID
func (h *SuppliersHandler) DeleteFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	feedID := r.PathValue("feed_id")
	if feedID == "" {
		http.Error(w, `{"error":"Feed ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM integration.xml_feeds WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, feedID)
	if err != nil {
		log.Printf("Failed to delete feed %s: %v", feedID, err)
		http.Error(w, `{"error":"Failed to delete feed"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"Feed not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DeactivateSupplierProducts sets is_active = false for all products of this supplier/brand
func (h *SuppliersHandler) DeactivateSupplierProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Supplier ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Update all products under this brand (or associated feeds) to be inactive
	prodQuery := `
		UPDATE catalog.products 
		SET is_active = false 
		WHERE brand_id = $1 OR feed_id IN (SELECT id FROM integration.xml_feeds WHERE brand_id = $1)`
	_, err := db.Pool.Exec(ctx, prodQuery, id)
	if err != nil {
		log.Printf("Failed to deactivate products for supplier %s: %v", id, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	// Update all variants of these products to be inactive
	varQuery := `
		UPDATE catalog.product_variants 
		SET is_active = false 
		WHERE product_id IN (
			SELECT id FROM catalog.products 
			WHERE brand_id = $1 OR feed_id IN (SELECT id FROM integration.xml_feeds WHERE brand_id = $1)
		)`
	_, _ = db.Pool.Exec(ctx, varQuery, id)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true,"message":"All products of the supplier deactivated successfully"}`))
}

// DeleteSupplierProducts deletes all products (and variants/images via cascade) of this supplier/brand
func (h *SuppliersHandler) DeleteSupplierProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Supplier ID is required"}`, http.StatusBadRequest)
		return
	}

	deleteImagesQuery := r.URL.Query().Get("delete_images")
	deleteImages := deleteImagesQuery == "true"

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var imageURLs []string
	if deleteImages {
		// Fetch all image URLs for products under this supplier before deleting them
		queryImages := `
			SELECT DISTINCT image_url 
			FROM catalog.product_images 
			WHERE product_id IN (
				SELECT id FROM catalog.products 
				WHERE brand_id = $1 OR feed_id IN (SELECT id FROM integration.xml_feeds WHERE brand_id = $1)
			)`
		rows, err := db.Pool.Query(ctx, queryImages, id)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var imgURL string
				if err := rows.Scan(&imgURL); err == nil && imgURL != "" {
					imageURLs = append(imageURLs, imgURL)
				}
			}
		}
	}

	// Deletion of catalog.products cascades to product_variants and product_images automatically due to ON DELETE CASCADE
	query := `
		DELETE FROM catalog.products 
		WHERE brand_id = $1 OR feed_id IN (SELECT id FROM integration.xml_feeds WHERE brand_id = $1)`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete products for supplier %s: %v", id, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	if deleteImages && len(imageURLs) > 0 {
		// Run physical image files cleanup in background goroutine to prevent request timeouts
		go func(urls []string) {
			log.Printf("[IMAGE-CLEANUP] Starting background physical image files deletion for %d images...", len(urls))
			
			// Potential base paths for both production (Linux) and dev (Windows) environments
			bases := []string{
				"/var/www/admin.mertervitrini.com.tr/frontend",
				"../frontend",
				"./frontend",
				"admin/frontend",
				"c:\\Projects\\mertervitrini.com.tr\\admin\\frontend",
			}
			
			deletedCount := 0
			for _, imgURL := range urls {
				if imgURL == "" {
					continue
				}
				cleanURL := strings.TrimPrefix(imgURL, "/")
				
				// Clean URL if it's dynamic relative prefix e.g. "./downloads/products/edusa"
				if strings.HasPrefix(cleanURL, "downloads/") {
					cleanURL = "parsers/" + cleanURL // Relative to admin/backend
				}
				
				for _, base := range bases {
					fullPath := filepath.Join(base, cleanURL)
					fullPath = filepath.Clean(fullPath)
					
					if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
						if err := os.Remove(fullPath); err == nil {
							deletedCount++
						} else {
							log.Printf("[IMAGE-CLEANUP] Failed to delete file %s: %v", fullPath, err)
						}
						break
					}
				}
				
				// Also handle standard Windows relative paths
				if strings.HasPrefix(imgURL, "./downloads/") {
					// Local development downloads folder relative to backend/parsers
					localPath := filepath.Clean(filepath.Join("parsers", imgURL))
					if info, err := os.Stat(localPath); err == nil && !info.IsDir() {
						if err := os.Remove(localPath); err == nil {
							deletedCount++
						}
					}
				}
			}
			log.Printf("[IMAGE-CLEANUP] Background task completed. Deleted %d physical files from disk.", deletedCount)
		}(imageURLs)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"success":true,"message":"Deleted %d products and all associated variants/images successfully"}`, cmdTag.RowsAffected())))
}
