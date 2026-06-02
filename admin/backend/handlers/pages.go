package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/admin/backend/db"
	"mertervitrini/admin/backend/models"
)

type PagesHandler struct{}

func NewPagesHandler() *PagesHandler {
	return &PagesHandler{}
}

// Slug validation regex: lowercase letters, numbers, and hyphens only
var slugRegex = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func isValidSlug(slug string) bool {
	return slugRegex.MatchString(slug)
}

// ListPages returns all custom pages with their translations
func (h *PagesHandler) ListPages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Query to select all pages and join translations
	query := `
		SELECT p.id, p.slug, p.is_active, p.created_at, p.updated_at,
		       t.language_code, t.title, t.content, t.meta_title, t.meta_description
		FROM catalog.pages p
		LEFT JOIN catalog.page_translations t ON p.id = t.page_id
		ORDER BY p.updated_at DESC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to query pages: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Parse rows into structure
	pagesMap := make(map[string]*models.Page)
	var pagesList []*models.Page

	for rows.Next() {
		var (
			id, slug                      string
			isActive                      bool
			createdAt, updatedAt          time.Time
			langCode, title, content      *string
			metaTitle, metaDescription    *string
		)

		err := rows.Scan(
			&id, &slug, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &content, &metaTitle, &metaDescription,
		)
		if err != nil {
			log.Printf("Failed to scan page row: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}

		p, exists := pagesMap[id]
		if !exists {
			p = &models.Page{
				ID:           id,
				Slug:         slug,
				IsActive:     isActive,
				Translations: make(map[string]models.PageTranslation),
				CreatedAt:    createdAt,
				UpdatedAt:    updatedAt,
			}
			pagesMap[id] = p
			pagesList = append(pagesList, p)
		}

		// Add translation if it exists
		if langCode != nil && title != nil && content != nil {
			p.Translations[*langCode] = models.PageTranslation{
				Title:           *title,
				Content:         *content,
				MetaTitle:       metaTitle,
				MetaDescription: metaDescription,
			}
		}
	}

	// If no pages were found, return empty array instead of nil
	if len(pagesList) == 0 {
		pagesList = []*models.Page{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pagesList)
}

// GetPageByID fetches a single page with all translations
func (h *PagesHandler) GetPageByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Page ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT p.id, p.slug, p.is_active, p.created_at, p.updated_at,
		       t.language_code, t.title, t.content, t.meta_title, t.meta_description
		FROM catalog.pages p
		LEFT JOIN catalog.page_translations t ON p.id = t.page_id
		WHERE p.id = $1`

	rows, err := db.Pool.Query(ctx, query, id)
	if err != nil {
		log.Printf("Failed to get page %s: %v", id, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var page *models.Page

	for rows.Next() {
		var (
			pageID, slug                  string
			isActive                      bool
			createdAt, updatedAt          time.Time
			langCode, title, content      *string
			metaTitle, metaDescription    *string
		)

		err := rows.Scan(
			&pageID, &slug, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &content, &metaTitle, &metaDescription,
		)
		if err != nil {
			log.Printf("Failed to scan page details: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}

		if page == nil {
			page = &models.Page{
				ID:           pageID,
				Slug:         slug,
				IsActive:     isActive,
				Translations: make(map[string]models.PageTranslation),
				CreatedAt:    createdAt,
				UpdatedAt:    updatedAt,
			}
		}

		if langCode != nil && title != nil && content != nil {
			page.Translations[*langCode] = models.PageTranslation{
				Title:           *title,
				Content:         *content,
				MetaTitle:       metaTitle,
				MetaDescription: metaDescription,
			}
		}
	}

	if page == nil {
		http.Error(w, `{"error":"Page not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(page)
}

// CreatePage adds a new page and its translations
type CreatePageRequest struct {
	Slug         string                             `json:"slug"`
	IsActive     bool                               `json:"is_active"`
	Translations map[string]models.PageTranslation  `json:"translations"`
}

func (h *PagesHandler) CreatePage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req CreatePageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	if req.Slug == "" {
		http.Error(w, `{"error":"URL (slug) alanı boş olamaz"}`, http.StatusBadRequest)
		return
	}

	if !isValidSlug(req.Slug) {
		http.Error(w, `{"error":"URL (slug) sadece küçük harf, rakam ve tire (-) içerebilir"}`, http.StatusBadRequest)
		return
	}

	if len(req.Translations) == 0 {
		http.Error(w, `{"error":"En az bir dil için başlık ve içerik girilmelidir"}`, http.StatusBadRequest)
		return
	}

	// Validate translations have at least title and content
	for lang, t := range req.Translations {
		if strings.TrimSpace(t.Title) == "" || strings.TrimSpace(t.Content) == "" {
			http.Error(w, `{"error":"`+lang+` dili için başlık ve içerik doldurulmalıdır"}`, http.StatusBadRequest)
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Begin TX
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Check if slug already exists
	var exists bool
	err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.pages WHERE slug = $1)", req.Slug).Scan(&exists)
	if err != nil {
		log.Printf("Failed to check slug uniqueness: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, `{"error":"Bu URL (slug) zaten başka bir sayfa tarafından kullanılıyor"}`, http.StatusConflict)
		return
	}

	// Insert Page
	var page models.Page
	insertPageQuery := `
		INSERT INTO catalog.pages (slug, is_active) 
		VALUES ($1, $2) 
		RETURNING id, slug, is_active, created_at, updated_at`

	err = tx.QueryRow(ctx, insertPageQuery, req.Slug, req.IsActive).Scan(
		&page.ID, &page.Slug, &page.IsActive, &page.CreatedAt, &page.UpdatedAt,
	)
	if err != nil {
		log.Printf("Failed to insert page: %v", err)
		http.Error(w, `{"error":"Failed to create page"}`, http.StatusInternalServerError)
		return
	}

	page.Translations = make(map[string]models.PageTranslation)

	// Insert Page Translations
	insertTranslationQuery := `
		INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
		VALUES ($1, $2, $3, $4, $5, $6)`

	for lang, t := range req.Translations {
		title := strings.TrimSpace(t.Title)
		content := strings.TrimSpace(t.Content)
		var metaTitle, metaDesc *string
		if t.MetaTitle != nil && strings.TrimSpace(*t.MetaTitle) != "" {
			trimmed := strings.TrimSpace(*t.MetaTitle)
			metaTitle = &trimmed
		}
		if t.MetaDescription != nil && strings.TrimSpace(*t.MetaDescription) != "" {
			trimmed := strings.TrimSpace(*t.MetaDescription)
			metaDesc = &trimmed
		}

		_, err = tx.Exec(ctx, insertTranslationQuery, page.ID, lang, title, content, metaTitle, metaDesc)
		if err != nil {
			log.Printf("Failed to insert page translation for %s: %v", lang, err)
			http.Error(w, `{"error":"Failed to save page translations"}`, http.StatusInternalServerError)
			return
		}

		page.Translations[lang] = models.PageTranslation{
			Title:           title,
			Content:         content,
			MetaTitle:       metaTitle,
			MetaDescription: metaDesc,
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	if page.IsActive {
		prefixes := []string{"tr", "en", "pl", "bg", "ar", "ru", "de", "fr"}
		var urls []string
		for _, prefix := range prefixes {
			urls = append(urls, "https://mertervitrini.com.tr/"+prefix+"/pages/"+page.Slug)
		}
		NotifyIndexNow(urls)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(page)
}

// UpdatePage updates an existing page and replaces its translations
func (h *PagesHandler) UpdatePage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Page ID is required"}`, http.StatusBadRequest)
		return
	}

	var req CreatePageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	if req.Slug == "" {
		http.Error(w, `{"error":"URL (slug) alanı boş olamaz"}`, http.StatusBadRequest)
		return
	}

	if !isValidSlug(req.Slug) {
		http.Error(w, `{"error":"URL (slug) sadece küçük harf, rakam ve tire (-) içerebilir"}`, http.StatusBadRequest)
		return
	}

	if len(req.Translations) == 0 {
		http.Error(w, `{"error":"En az bir dil için başlık ve içerik girilmelidir"}`, http.StatusBadRequest)
		return
	}

	// Validate translations
	for lang, t := range req.Translations {
		if strings.TrimSpace(t.Title) == "" || strings.TrimSpace(t.Content) == "" {
			http.Error(w, `{"error":"`+lang+` dili için başlık ve içerik doldurulmalıdır"}`, http.StatusBadRequest)
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Begin TX
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Check if slug is taken by another page
	var exists bool
	err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.pages WHERE slug = $1 AND id != $2)", req.Slug, id).Scan(&exists)
	if err != nil {
		log.Printf("Failed to check slug uniqueness: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, `{"error":"Bu URL (slug) zaten başka bir sayfa tarafından kullanılıyor"}`, http.StatusConflict)
		return
	}

	// Update page root
	var page models.Page
	updatePageQuery := `
		UPDATE catalog.pages 
		SET slug = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $3 
		RETURNING id, slug, is_active, created_at, updated_at`

	err = tx.QueryRow(ctx, updatePageQuery, req.Slug, req.IsActive, id).Scan(
		&page.ID, &page.Slug, &page.IsActive, &page.CreatedAt, &page.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Sayfa bulunamadı"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update page: %v", err)
		http.Error(w, `{"error":"Failed to update page"}`, http.StatusInternalServerError)
		return
	}

	// Delete old translations
	_, err = tx.Exec(ctx, "DELETE FROM catalog.page_translations WHERE page_id = $1", id)
	if err != nil {
		log.Printf("Failed to clear old translations: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	page.Translations = make(map[string]models.PageTranslation)

	// Insert new translations
	insertTranslationQuery := `
		INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
		VALUES ($1, $2, $3, $4, $5, $6)`

	for lang, t := range req.Translations {
		title := strings.TrimSpace(t.Title)
		content := strings.TrimSpace(t.Content)
		var metaTitle, metaDesc *string
		if t.MetaTitle != nil && strings.TrimSpace(*t.MetaTitle) != "" {
			trimmed := strings.TrimSpace(*t.MetaTitle)
			metaTitle = &trimmed
		}
		if t.MetaDescription != nil && strings.TrimSpace(*t.MetaDescription) != "" {
			trimmed := strings.TrimSpace(*t.MetaDescription)
			metaDesc = &trimmed
		}

		_, err = tx.Exec(ctx, insertTranslationQuery, page.ID, lang, title, content, metaTitle, metaDesc)
		if err != nil {
			log.Printf("Failed to insert page translation for %s: %v", lang, err)
			http.Error(w, `{"error":"Failed to save page translations"}`, http.StatusInternalServerError)
			return
		}

		page.Translations[lang] = models.PageTranslation{
			Title:           title,
			Content:         content,
			MetaTitle:       metaTitle,
			MetaDescription: metaDesc,
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	if page.IsActive {
		prefixes := []string{"tr", "en", "pl", "bg", "ar", "ru", "de", "fr"}
		var urls []string
		for _, prefix := range prefixes {
			urls = append(urls, "https://mertervitrini.com.tr/"+prefix+"/pages/"+page.Slug)
		}
		NotifyIndexNow(urls)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(page)
}

// DeletePage deletes a page and its cascade translations
func (h *PagesHandler) DeletePage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Page ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM catalog.pages WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete page %s: %v", id, err)
		http.Error(w, `{"error":"Failed to delete page"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"Sayfa bulunamadı"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// CheckSlugUniqueness verifies if a slug is available for use
func (h *PagesHandler) CheckSlugUniqueness(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	slug := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("slug")))
	excludeID := r.URL.Query().Get("exclude_id")

	if slug == "" {
		http.Error(w, `{"error":"Slug is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var exists bool
	var query string
	var err error

	if excludeID != "" {
		query = "SELECT EXISTS(SELECT 1 FROM catalog.pages WHERE slug = $1 AND id != $2)"
		err = db.Pool.QueryRow(ctx, query, slug, excludeID).Scan(&exists)
	} else {
		query = "SELECT EXISTS(SELECT 1 FROM catalog.pages WHERE slug = $1)"
		err = db.Pool.QueryRow(ctx, query, slug).Scan(&exists)
	}

	if err != nil {
		log.Printf("Failed to check slug uniqueness: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"unique": !exists})
}
