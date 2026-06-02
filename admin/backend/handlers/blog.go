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

type BlogHandler struct{}

func NewBlogHandler() *BlogHandler {
	return &BlogHandler{}
}

// Slug validation regex (same as pages)
var blogSlugRegex = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func isValidBlogSlug(slug string) bool {
	return blogSlugRegex.MatchString(slug)
}

// ListBlogPosts returns all blog posts with their translations
func (h *BlogHandler) ListBlogPosts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT b.id, b.slug, b.cover_image, b.is_active, b.created_at, b.updated_at,
		       t.language_code, t.title, t.summary, t.content, t.meta_title, t.meta_description
		FROM catalog.blog_posts b
		LEFT JOIN catalog.blog_post_translations t ON b.id = t.post_id
		ORDER BY b.updated_at DESC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to query blog posts: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	blogMap := make(map[string]*models.BlogPost)
	var blogList []*models.BlogPost

	for rows.Next() {
		var (
			id, slug                      string
			coverImage                    *string
			isActive                      bool
			createdAt, updatedAt          time.Time
			langCode, title, summary      *string
			content, metaTitle, metaDesc *string
		)

		err := rows.Scan(
			&id, &slug, &coverImage, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &summary, &content, &metaTitle, &metaDesc,
		)
		if err != nil {
			log.Printf("Failed to scan blog row: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}

		b, exists := blogMap[id]
		if !exists {
			b = &models.BlogPost{
				ID:           id,
				Slug:         slug,
				CoverImage:   coverImage,
				IsActive:     isActive,
				Translations: make(map[string]models.BlogPostTranslation),
				CreatedAt:    createdAt,
				UpdatedAt:    updatedAt,
			}
			blogMap[id] = b
			blogList = append(blogList, b)
		}

		if langCode != nil && title != nil && content != nil {
			b.Translations[*langCode] = models.BlogPostTranslation{
				Title:           *title,
				Summary:         summary,
				Content:         *content,
				MetaTitle:       metaTitle,
				MetaDescription: metaDesc,
			}
		}
	}

	if len(blogList) == 0 {
		blogList = []*models.BlogPost{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(blogList)
}

// GetBlogPostByID fetches a single blog post
func (h *BlogHandler) GetBlogPostByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Blog Post ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT b.id, b.slug, b.cover_image, b.is_active, b.created_at, b.updated_at,
		       t.language_code, t.title, t.summary, t.content, t.meta_title, t.meta_description
		FROM catalog.blog_posts b
		LEFT JOIN catalog.blog_post_translations t ON b.id = t.post_id
		WHERE b.id = $1`

	rows, err := db.Pool.Query(ctx, query, id)
	if err != nil {
		log.Printf("Failed to get blog post %s: %v", id, err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var post *models.BlogPost

	for rows.Next() {
		var (
			postID, slug                  string
			coverImage                    *string
			isActive                      bool
			createdAt, updatedAt          time.Time
			langCode, title, summary      *string
			content, metaTitle, metaDesc *string
		)

		err := rows.Scan(
			&postID, &slug, &coverImage, &isActive, &createdAt, &updatedAt,
			&langCode, &title, &summary, &content, &metaTitle, &metaDesc,
		)
		if err != nil {
			log.Printf("Failed to scan blog details: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}

		if post == nil {
			post = &models.BlogPost{
				ID:           postID,
				Slug:         slug,
				CoverImage:   coverImage,
				IsActive:     isActive,
				Translations: make(map[string]models.BlogPostTranslation),
				CreatedAt:    createdAt,
				UpdatedAt:    updatedAt,
			}
		}

		if langCode != nil && title != nil && content != nil {
			post.Translations[*langCode] = models.BlogPostTranslation{
				Title:           *title,
				Summary:         summary,
				Content:         *content,
				MetaTitle:       metaTitle,
				MetaDescription: metaDesc,
			}
		}
	}

	if post == nil {
		http.Error(w, `{"error":"Blog post not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

// CreateBlogPost adds a new blog post
type CreateBlogRequest struct {
	Slug         string                                   `json:"slug"`
	CoverImage   *string                                  `json:"cover_image"`
	IsActive     bool                                     `json:"is_active"`
	Translations map[string]models.BlogPostTranslation   `json:"translations"`
}

func (h *BlogHandler) CreateBlogPost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req CreateBlogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	if req.Slug == "" {
		http.Error(w, `{"error":"URL (slug) alanı boş olamaz"}`, http.StatusBadRequest)
		return
	}

	if !isValidBlogSlug(req.Slug) {
		http.Error(w, `{"error":"URL (slug) sadece küçük harf, rakam ve tire (-) içerebilir"}`, http.StatusBadRequest)
		return
	}

	if len(req.Translations) == 0 {
		http.Error(w, `{"error":"En az bir dil için başlık ve içerik girilmelidir"}`, http.StatusBadRequest)
		return
	}

	for lang, t := range req.Translations {
		if strings.TrimSpace(t.Title) == "" || strings.TrimSpace(t.Content) == "" {
			http.Error(w, `{"error":"`+lang+` dili için başlık ve içerik doldurulmalıdır"}`, http.StatusBadRequest)
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var exists bool
	err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.blog_posts WHERE slug = $1)", req.Slug).Scan(&exists)
	if err != nil {
		log.Printf("Failed to check slug uniqueness: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, `{"error":"Bu URL (slug) zaten başka bir blog yazısı tarafından kullanılıyor"}`, http.StatusConflict)
		return
	}

	var post models.BlogPost
	insertQuery := `
		INSERT INTO catalog.blog_posts (slug, cover_image, is_active) 
		VALUES ($1, $2, $3) 
		RETURNING id, slug, cover_image, is_active, created_at, updated_at`

	err = tx.QueryRow(ctx, insertQuery, req.Slug, req.CoverImage, req.IsActive).Scan(
		&post.ID, &post.Slug, &post.CoverImage, &post.IsActive, &post.CreatedAt, &post.UpdatedAt,
	)
	if err != nil {
		log.Printf("Failed to insert blog post: %v", err)
		http.Error(w, `{"error":"Failed to create blog post"}`, http.StatusInternalServerError)
		return
	}

	post.Translations = make(map[string]models.BlogPostTranslation)

	insertTranslationQuery := `
		INSERT INTO catalog.blog_post_translations (post_id, language_code, title, summary, content, meta_title, meta_description)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	for lang, t := range req.Translations {
		title := strings.TrimSpace(t.Title)
		content := strings.TrimSpace(t.Content)
		var summary *string
		if t.Summary != nil && strings.TrimSpace(*t.Summary) != "" {
			trimmed := strings.TrimSpace(*t.Summary)
			summary = &trimmed
		}
		var metaTitle, metaDesc *string
		if t.MetaTitle != nil && strings.TrimSpace(*t.MetaTitle) != "" {
			trimmed := strings.TrimSpace(*t.MetaTitle)
			metaTitle = &trimmed
		}
		if t.MetaDescription != nil && strings.TrimSpace(*t.MetaDescription) != "" {
			trimmed := strings.TrimSpace(*t.MetaDescription)
			metaDesc = &trimmed
		}

		_, err = tx.Exec(ctx, insertTranslationQuery, post.ID, lang, title, summary, content, metaTitle, metaDesc)
		if err != nil {
			log.Printf("Failed to insert blog translation for %s: %v", lang, err)
			http.Error(w, `{"error":"Failed to save blog translations"}`, http.StatusInternalServerError)
			return
		}

		post.Translations[lang] = models.BlogPostTranslation{
			Title:           title,
			Summary:         summary,
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(post)
}

// UpdateBlogPost updates an existing post
func (h *BlogHandler) UpdateBlogPost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Blog Post ID is required"}`, http.StatusBadRequest)
		return
	}

	var req CreateBlogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	if req.Slug == "" {
		http.Error(w, `{"error":"URL (slug) alanı boş olamaz"}`, http.StatusBadRequest)
		return
	}

	if !isValidBlogSlug(req.Slug) {
		http.Error(w, `{"error":"URL (slug) sadece küçük harf, rakam ve tire (-) içerebilir"}`, http.StatusBadRequest)
		return
	}

	if len(req.Translations) == 0 {
		http.Error(w, `{"error":"En az bir dil için başlık ve içerik girilmelidir"}`, http.StatusBadRequest)
		return
	}

	for lang, t := range req.Translations {
		if strings.TrimSpace(t.Title) == "" || strings.TrimSpace(t.Content) == "" {
			http.Error(w, `{"error":"`+lang+` dili için başlık ve içerik doldurulmalıdır"}`, http.StatusBadRequest)
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var exists bool
	err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.blog_posts WHERE slug = $1 AND id != $2)", req.Slug, id).Scan(&exists)
	if err != nil {
		log.Printf("Failed to check slug uniqueness: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, `{"error":"Bu URL (slug) zaten başka bir blog yazısı tarafından kullanılıyor"}`, http.StatusConflict)
		return
	}

	var post models.BlogPost
	updateQuery := `
		UPDATE catalog.blog_posts 
		SET slug = $1, cover_image = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $4 
		RETURNING id, slug, cover_image, is_active, created_at, updated_at`

	err = tx.QueryRow(ctx, updateQuery, req.Slug, req.CoverImage, req.IsActive, id).Scan(
		&post.ID, &post.Slug, &post.CoverImage, &post.IsActive, &post.CreatedAt, &post.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"Blog yazısı bulunamadı"}`, http.StatusNotFound)
			return
		}
		log.Printf("Failed to update blog post: %v", err)
		http.Error(w, `{"error":"Failed to update blog post"}`, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(ctx, "DELETE FROM catalog.blog_post_translations WHERE post_id = $1", id)
	if err != nil {
		log.Printf("Failed to clear old translations: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	post.Translations = make(map[string]models.BlogPostTranslation)

	insertTranslationQuery := `
		INSERT INTO catalog.blog_post_translations (post_id, language_code, title, summary, content, meta_title, meta_description)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	for lang, t := range req.Translations {
		title := strings.TrimSpace(t.Title)
		content := strings.TrimSpace(t.Content)
		var summary *string
		if t.Summary != nil && strings.TrimSpace(*t.Summary) != "" {
			trimmed := strings.TrimSpace(*t.Summary)
			summary = &trimmed
		}
		var metaTitle, metaDesc *string
		if t.MetaTitle != nil && strings.TrimSpace(*t.MetaTitle) != "" {
			trimmed := strings.TrimSpace(*t.MetaTitle)
			metaTitle = &trimmed
		}
		if t.MetaDescription != nil && strings.TrimSpace(*t.MetaDescription) != "" {
			trimmed := strings.TrimSpace(*t.MetaDescription)
			metaDesc = &trimmed
		}

		_, err = tx.Exec(ctx, insertTranslationQuery, post.ID, lang, title, summary, content, metaTitle, metaDesc)
		if err != nil {
			log.Printf("Failed to insert blog translation for %s: %v", lang, err)
			http.Error(w, `{"error":"Failed to save blog translations"}`, http.StatusInternalServerError)
			return
		}

		post.Translations[lang] = models.BlogPostTranslation{
			Title:           title,
			Summary:         summary,
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

// DeleteBlogPost deletes a post and its cascade translations
func (h *BlogHandler) DeleteBlogPost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Blog Post ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `DELETE FROM catalog.blog_posts WHERE id = $1`
	cmdTag, err := db.Pool.Exec(ctx, query, id)
	if err != nil {
		log.Printf("Failed to delete blog post %s: %v", id, err)
		http.Error(w, `{"error":"Failed to delete blog post"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"Blog yazısı bulunamadı"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// CheckSlugUniqueness verifies if a slug is available
func (h *BlogHandler) CheckSlugUniqueness(w http.ResponseWriter, r *http.Request) {
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
		query = "SELECT EXISTS(SELECT 1 FROM catalog.blog_posts WHERE slug = $1 AND id != $2)"
		err = db.Pool.QueryRow(ctx, query, slug, excludeID).Scan(&exists)
	} else {
		query = "SELECT EXISTS(SELECT 1 FROM catalog.blog_posts WHERE slug = $1)"
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
