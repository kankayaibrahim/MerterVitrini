package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(post)
}

// CreateBlogPost adds a new blog post
type CreateBlogRequest struct {
	Slug         string                                 `json:"slug"`
	CoverImage   *string                                `json:"cover_image"`
	IsActive     bool                                   `json:"is_active"`
	Translations map[string]models.BlogPostTranslation `json:"translations"`
}

func cleanBlogMetaField(meta *string) *string {
	if meta != nil && strings.TrimSpace(*meta) != "" {
		trimmed := strings.TrimSpace(*meta)
		return &trimmed
	}
	return nil
}

func validateBlogRequest(req *CreateBlogRequest) error {
	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	if req.Slug == "" {
		return errors.New("URL (slug) alanı boş olamaz")
	}
	if !isValidBlogSlug(req.Slug) {
		return errors.New("URL (slug) sadece küçük harf, rakam ve tire (-) içerebilir")
	}
	if len(req.Translations) == 0 {
		return errors.New("En az bir dil için başlık ve içerik girilmelidir")
	}
	for lang, t := range req.Translations {
		if strings.TrimSpace(t.Title) == "" || strings.TrimSpace(t.Content) == "" {
			return fmt.Errorf("%s dili için başlık ve içerik doldurulmalıdır", lang)
		}
	}
	return nil
}

func saveBlogPostTranslations(ctx context.Context, tx pgx.Tx, postID string, translations map[string]models.BlogPostTranslation) (map[string]models.BlogPostTranslation, error) {
	result := make(map[string]models.BlogPostTranslation, len(translations))
	insertTranslationQuery := `
		INSERT INTO catalog.blog_post_translations (post_id, language_code, title, summary, content, meta_title, meta_description)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	for lang, t := range translations {
		title := strings.TrimSpace(t.Title)
		content := strings.TrimSpace(t.Content)
		summary := cleanBlogMetaField(t.Summary)
		metaTitle := cleanBlogMetaField(t.MetaTitle)
		metaDesc := cleanBlogMetaField(t.MetaDescription)

		_, err := tx.Exec(ctx, insertTranslationQuery, postID, lang, title, summary, content, metaTitle, metaDesc)
		if err != nil {
			return nil, fmt.Errorf("failed to insert blog translation for %s: %w", lang, err)
		}

		result[lang] = models.BlogPostTranslation{
			Title:           title,
			Summary:         summary,
			Content:         content,
			MetaTitle:       metaTitle,
			MetaDescription: metaDesc,
		}
	}
	return result, nil
}

func notifyBlogPostIndexNow(slug string) {
	prefixes := []string{"tr", "en", "pl", "bg", "ar", "ru", "de", "fr"}
	var urls []string
	for _, prefix := range prefixes {
		urls = append(urls, "https://mertervitrini.com.tr/"+prefix+"/blog/"+slug)
	}
	NotifyIndexNow(urls)
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

	if err := validateBlogRequest(&req); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusBadRequest)
		return
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

	post.Translations, err = saveBlogPostTranslations(ctx, tx, post.ID, req.Translations)
	if err != nil {
		log.Printf("Failed to save blog translations: %v", err)
		http.Error(w, `{"error":"Failed to save blog translations"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	if post.IsActive {
		notifyBlogPostIndexNow(post.Slug)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
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

	if err := validateBlogRequest(&req); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusBadRequest)
		return
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

	post.Translations, err = saveBlogPostTranslations(ctx, tx, post.ID, req.Translations)
	if err != nil {
		log.Printf("Failed to save blog translations: %v", err)
		http.Error(w, `{"error":"Failed to save blog translations"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	if post.IsActive {
		notifyBlogPostIndexNow(post.Slug)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
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

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(map[string]bool{"unique": !exists})
}

