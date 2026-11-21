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
	"mertervitrini/backend/models"

	"github.com/jackc/pgx/v5"
)

type SuppliersHandler struct{}

func NewSuppliersHandler() *SuppliersHandler {
	return &SuppliersHandler{}
}

func fetchSuppliers(ctx context.Context) ([]*models.Brand, map[string]*models.Brand, error) {
	brandQuery := `
		SELECT 
			b.id, b.brand_name AS name, b.slug, b.alias_code,
			COALESCE(b.company_type, 'uretici_toptanci'),
			COALESCE(b.description, ''),
			b.website, b.phone,
			COALESCE(b.landline_phone, ''),
			COALESCE(
				NULLIF(b.whatsapp_phone, ''),
				NULLIF(b.phone, ''),
				(SELECT COALESCE(NULLIF(su.phone, ''), '') FROM catalog.supplier_users su WHERE su.brand_id = b.id AND su.phone IS NOT NULL AND su.phone <> '' ORDER BY su.is_owner DESC, su.created_at ASC LIMIT 1),
				''
			) AS whatsapp_phone,
			COALESCE(b.public_email, ''),
			COALESCE(b.instagram_handle, ''),
			COALESCE(b.city, ''),
			COALESCE(b.district, ''),
			COALESCE(b.location_address, ''),
			COALESCE(b.export_countries, ''),
			COALESCE(b.min_order_quantity, 1),
			COALESCE(b.supports_private_label, false),
			COALESCE(b.supports_fason, false),
			COALESCE(b.is_verified, true),
			COALESCE(b.whatsapp_only_ordering, false),
			COALESCE(b.bank_name, ''),
			COALESCE(b.bank_account_holder, ''),
			COALESCE(b.iban, ''),
			b.addresses, b.is_active, b.created_at, b.updated_at 
		FROM catalog.brands b
		ORDER BY b.brand_name`

	bRows, err := db.Pool.Query(ctx, brandQuery)
	if err != nil {
		return nil, nil, err
	}
	defer bRows.Close()

	var suppliers []*models.Brand
	supplierMap := make(map[string]*models.Brand)

	for bRows.Next() {
		var s models.Brand
		if err := bRows.Scan(
			&s.ID, &s.Name, &s.Slug, &s.AliasCode,
			&s.CompanyType, &s.Description,
			&s.Website, &s.Phone, &s.LandlinePhone,
			&s.WhatsappPhone, &s.PublicEmail, &s.InstagramHandle,
			&s.City, &s.District, &s.LocationAddress, &s.ExportCountries, &s.MinOrderQuantity,
			&s.SupportsPrivateLabel, &s.SupportsFason, &s.IsVerified, &s.WhatsappOnlyOrdering,
			&s.BankName, &s.BankAccountHolder, &s.IBAN,
			&s.Addresses, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, nil, err
		}
		s.Feeds = make([]*models.XmlFeed, 0)
		suppliers = append(suppliers, &s)
		supplierMap[s.ID] = &s
	}
	return suppliers, supplierMap, nil
}

func mapFeedRow(rows pgx.Rows, supplierMap map[string]*models.Brand) {
	var f models.XmlFeed
	var mappingBytes, categoryBytes []byte
	if err := rows.Scan(&f.ID, &f.BrandID, &f.Name, &f.AliasCode, &f.FeedUrl, &mappingBytes, &categoryBytes, &f.IsActive, &f.CreatedAt, &f.UpdatedAt); err != nil {
		return
	}
	if f.BrandID == nil {
		return
	}
	if len(mappingBytes) > 0 {
		_ = json.Unmarshal(mappingBytes, &f.MappingConfig)
	}
	if len(categoryBytes) > 0 {
		_ = json.Unmarshal(categoryBytes, &f.CategoryMapping)
	}
	if supplier, exists := supplierMap[*f.BrandID]; exists {
		supplier.Feeds = append(supplier.Feeds, &f)
	}
}

func attachSupplierFeeds(ctx context.Context, supplierMap map[string]*models.Brand) {
	feedQuery := `
		SELECT id, brand_id, feed_name AS name, alias_code, feed_url, mapping_config, category_mapping, is_active, created_at, updated_at 
		FROM integration.xml_feeds 
		ORDER BY id`

	fRows, err := db.Pool.Query(ctx, feedQuery)
	if err != nil {
		return
	}
	defer fRows.Close()

	for fRows.Next() {
		mapFeedRow(fRows, supplierMap)
	}
}

// ListSuppliers fetches all suppliers (brands) with their XML feeds embedded
func (h *SuppliersHandler) ListSuppliers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	suppliers, supplierMap, err := fetchSuppliers(ctx)
	if err != nil {
		log.Printf("Failed to query suppliers: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	attachSupplierFeeds(ctx, supplierMap)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(suppliers)
}

type adminSupplierUpsertRequest struct {
	Name                 string  `json:"name"`
	AliasCode            *string `json:"alias_code"`
	Website              *string `json:"website"`
	Phone                *string `json:"phone"`
	LandlinePhone        *string `json:"landline_phone"`
	WhatsappPhone        *string `json:"whatsapp_phone"`
	PublicEmail          *string `json:"public_email"`
	InstagramHandle      *string `json:"instagram_handle"`
	City                 *string `json:"city"`
	District             *string `json:"district"`
	LocationAddress      *string `json:"location_address"`
	BankName             *string `json:"bank_name"`
	BankAccountHolder    *string `json:"bank_account_holder"`
	IBAN                 *string `json:"iban"`
	WhatsappOnlyOrdering *bool   `json:"whatsapp_only_ordering"`
	Addresses            []any   `json:"addresses"`
	IsActive             bool    `json:"is_active"`
}

func scanAdminSupplierRow(row pgx.Row) (models.Brand, error) {
	var s models.Brand
	err := row.Scan(
		&s.ID, &s.Name, &s.Slug, &s.AliasCode, &s.Website, &s.Phone, &s.LandlinePhone,
		&s.WhatsappPhone, &s.PublicEmail, &s.InstagramHandle,
		&s.City, &s.District, &s.LocationAddress,
		&s.BankName, &s.BankAccountHolder, &s.IBAN,
		&s.WhatsappOnlyOrdering, &s.Addresses, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
	)
	return s, err
}

const adminSupplierReturningCols = `id, brand_name AS name, slug, alias_code, website, phone, COALESCE(landline_phone, ''), COALESCE(whatsapp_phone, ''), COALESCE(public_email, ''), COALESCE(instagram_handle, ''), COALESCE(city, ''), COALESCE(district, ''), COALESCE(location_address, ''), COALESCE(bank_name, ''), COALESCE(bank_account_holder, ''), COALESCE(iban, ''), COALESCE(whatsapp_only_ordering, false), addresses, is_active, created_at, updated_at`

func resolveAliasForCreate(reqAlias *string, name string) string {
	if reqAlias != nil && strings.TrimSpace(*reqAlias) != "" {
		return strings.TrimSpace(*reqAlias)
	}
	if len(name) > 8 {
		return name[:8]
	}
	return name
}

// CreateSupplier adds a new brand/supplier
func (h *SuppliersHandler) CreateSupplier(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req adminSupplierUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		http.Error(w, `{"error":"Supplier name is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var slug string
	if err := db.Pool.QueryRow(ctx, "SELECT catalog.fn_slugify($1)", req.Name).Scan(&slug); err != nil {
		log.Printf("Failed to generate slug: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	aliasCode := resolveAliasForCreate(req.AliasCode, req.Name)
	var websitePtr *string
	if req.Website != nil {
		websitePtr = normalizeBrandWebsite(*req.Website)
	}
	phonePtr := normalizeOptionalStringPtr(req.Phone, 50)
	if phonePtr != nil && *phonePtr == "" {
		phonePtr = nil
	}
	landlineStr := truncateStr(derefTrimmed(req.LandlinePhone), 50)
	waStr := derefTrimmed(req.WhatsappPhone)
	if waStr == "" {
		waStr = derefTrimmed(req.Phone)
	}
	instagramStr := normalizeBrandInstagramHandle(derefTrimmed(req.InstagramHandle))

	fbCity, fbDistrict, fbText := extractPrimaryAddressFallback(req.Addresses)
	cityStr := firstNonEmptyStr(derefTrimmed(req.City), fbCity)
	districtStr := firstNonEmptyStr(derefTrimmed(req.District), fbDistrict)
	locStr := firstNonEmptyStr(derefTrimmed(req.LocationAddress), fbText)

	ibanStr := strings.ToUpper(strings.ReplaceAll(derefTrimmed(req.IBAN), " ", ""))
	addressesJSON, _ := json.Marshal(req.Addresses)
	whatsappOnly := req.WhatsappOnlyOrdering != nil && *req.WhatsappOnlyOrdering

	query := `
		INSERT INTO catalog.brands (
			brand_name, slug, alias_code, website, phone, landline_phone, whatsapp_phone,
			public_email, instagram_handle, city, district, location_address,
			bank_name, bank_account_holder, iban, whatsapp_only_ordering, addresses, is_active
		)
		VALUES ($1, $2, UPPER($3), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
		RETURNING ` + adminSupplierReturningCols

	s, err := scanAdminSupplierRow(db.Pool.QueryRow(ctx, query,
		strings.TrimSpace(req.Name), slug, aliasCode, websitePtr, phonePtr, landlineStr, waStr,
		derefTrimmed(req.PublicEmail), instagramStr, truncateStr(cityStr, 100), truncateStr(districtStr, 100), locStr,
		derefTrimmed(req.BankName), derefTrimmed(req.BankAccountHolder), ibanStr, whatsappOnly, addressesJSON, req.IsActive,
	))
	if err != nil {
		log.Printf("Failed to create supplier: %v", err)
		http.Error(w, `{"error":"Supplier name or alias code already exists"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
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

	var req adminSupplierUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		http.Error(w, `{"error":"Supplier name is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var slug string
	if err := db.Pool.QueryRow(ctx, "SELECT catalog.fn_slugify($1)", req.Name).Scan(&slug); err != nil {
		log.Printf("Failed to generate slug: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	var websitePtr *string
	if req.Website != nil {
		websitePtr = normalizeBrandWebsite(*req.Website)
	}
	phonePtr := normalizeOptionalStringPtr(req.Phone, 50)
	if phonePtr != nil && *phonePtr == "" {
		phonePtr = nil
	}
	var instagramPtr *string
	if req.InstagramHandle != nil {
		normIG := normalizeBrandInstagramHandle(*req.InstagramHandle)
		instagramPtr = &normIG
	}
	var ibanPtr *string
	if req.IBAN != nil {
		cleanIBAN := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(*req.IBAN), " ", ""))
		ibanPtr = &cleanIBAN
	}

	var addressesJSONPtr *string
	if req.Addresses != nil {
		if b, marshalErr := json.Marshal(req.Addresses); marshalErr == nil {
			s := string(b)
			addressesJSONPtr = &s
		}
	}

	query := `
		UPDATE catalog.brands
		SET brand_name = $1,
		    slug = $2,
		    alias_code = COALESCE(NULLIF(UPPER($3), ''), alias_code),
		    website = $4,
		    phone = $5,
		    landline_phone = COALESCE($6, landline_phone, ''),
		    whatsapp_phone = COALESCE($7, whatsapp_phone, ''),
		    public_email = COALESCE($8, public_email, ''),
		    instagram_handle = COALESCE($9, instagram_handle, ''),
		    city = COALESCE($10, city, ''),
		    district = COALESCE($11, district, ''),
		    location_address = COALESCE($12, location_address, ''),
		    bank_name = COALESCE($13, bank_name, ''),
		    bank_account_holder = COALESCE($14, bank_account_holder, ''),
		    iban = COALESCE($15, iban, ''),
		    whatsapp_only_ordering = COALESCE($16, whatsapp_only_ordering, false),
		    addresses = COALESCE($17::jsonb, addresses),
		    is_active = $18,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $19
		RETURNING ` + adminSupplierReturningCols

	s, err := scanAdminSupplierRow(db.Pool.QueryRow(ctx, query,
		strings.TrimSpace(req.Name), slug, req.AliasCode, websitePtr, phonePtr,
		normalizeOptionalStringPtr(req.LandlinePhone, 50),
		normalizeOptionalStringPtr(req.WhatsappPhone, 50),
		normalizeOptionalStringPtr(req.PublicEmail, 150),
		instagramPtr,
		normalizeOptionalStringPtr(req.City, 100),
		normalizeOptionalStringPtr(req.District, 100),
		normalizeOptionalStringPtr(req.LocationAddress, 1000),
		normalizeOptionalStringPtr(req.BankName, 150),
		normalizeOptionalStringPtr(req.BankAccountHolder, 200),
		ibanPtr,
		req.WhatsappOnlyOrdering,
		addressesJSONPtr,
		req.IsActive, id,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Supplier not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update supplier %s: %v", id, err)
		http.Error(w, `{"error":"Supplier name or alias code already exists"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
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
		SET is_active = false, deactivated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
		WHERE (brand_id = $1 OR feed_id IN (SELECT id FROM integration.xml_feeds WHERE brand_id = $1))
		  AND is_active = true`
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
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

	// Soft-delete: update is_active to false and deleted_at to current timestamp
	query := `
		UPDATE catalog.products 
		SET is_active = false, deactivated_at = COALESCE(deactivated_at, CURRENT_TIMESTAMP), deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE (brand_id = $1 OR feed_id IN (SELECT id FROM integration.xml_feeds WHERE brand_id = $1))
		  AND deleted_at IS NULL`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to soft-delete products for supplier %s: %v", id, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write(fmt.Appendf(nil, `{"success":true,"message":"Soft-deleted %d products successfully"}`, cmdTag.RowsAffected()))
}
