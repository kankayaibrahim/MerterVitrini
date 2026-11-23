package handlers

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/mailer"
	"mertervitrini/backend/pkg/safe"
	"mertervitrini/backend/services"
)

const (
	storiesMediaFolder        = "stories"
	storiesMediaPrefix        = "story"
	notifTypeNewSupplierProd  = "supplier_new_product"
	defaultStoryBgColor       = "#111111"
	storyLockRevoked          = "revoked_by_admin"
	storyLockPaidRequired     = "paid_plan_required"
	storyLockQuotaExceeded    = "quota_exceeded"
	storyLockDisabled         = "disabled"
	errInvalidBrandID         = "Geçersiz tedarikçi kimliği"
	errInvalidStoryID         = "Geçersiz hikaye kimliği"
	errCustomerAuthRequired   = "Bu işlem için üye girişi yapmanız gerekmektedir."
	storyCTAFallbackLabel     = "Ürünü İncele"
	publicSiteBaseURL         = "https://mertervitrini.com.tr"
)

// StorySettingsDTO mirrors catalog.story_settings.
type StorySettingsDTO struct {
	IsPaidMode           bool      `json:"is_paid_mode"`
	PaidDailyLimit       int       `json:"paid_daily_limit"`
	FreeDailyLimit       int       `json:"free_daily_limit"`
	StoryTTLHours        int       `json:"story_ttl_hours"`
	MonthlyAddonPriceTRY float64   `json:"monthly_addon_price_try"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// StoryEntitlementInput contains subscription inputs used to compute story quota and access.
type StoryEntitlementInput struct {
	PlanCode                string
	Status                  string
	IsComplimentary         bool
	CurrentPeriodEnd        time.Time
	StoryEntitlementOverride *bool
	StoryDailyLimitOverride *int
}

// StoryEntitlementDTO describes whether a supplier can publish stories and remaining 24h quota.
type StoryEntitlementDTO struct {
	CanPublish     bool       `json:"can_publish"`
	IsPaidMode     bool       `json:"is_paid_mode"`
	IsPaidEntitled bool       `json:"is_paid_entitled"`
	PlanCode       string     `json:"plan_code"`
	DailyLimit     int        `json:"daily_limit"`
	UsedLast24h    int        `json:"used_last_24h"`
	Remaining24h   int        `json:"remaining_24h"`
	StoryTTLHours  int        `json:"story_ttl_hours"`
	NextSlotAt     *time.Time `json:"next_slot_at,omitempty"`
	LockReason     string     `json:"lock_reason,omitempty"`
}

// StoryItemDTO represents a single Instagram-style story card.
type StoryItemDTO struct {
	ID              string    `json:"id"`
	BrandID         string    `json:"brand_id"`
	BrandName       string    `json:"brand_name,omitempty"`
	BrandSlug       string    `json:"brand_slug,omitempty"`
	BrandSubdomain  string    `json:"brand_subdomain,omitempty"`
	BrandCoverURL   string    `json:"brand_cover_url,omitempty"`
	BrandVerified   bool      `json:"brand_verified,omitempty"`
	CreatedByRole   string    `json:"created_by_role"`
	MediaURL        string    `json:"media_url"`
	MediaType       string    `json:"media_type"`
	Caption         string    `json:"caption"`
	CTALabel        string    `json:"cta_label"`
	CTAURL          string    `json:"cta_url"`
	LinkedProductID *string   `json:"linked_product_id,omitempty"`
	ProductSlug     string    `json:"product_slug,omitempty"`
	ProductTitle    string    `json:"product_title,omitempty"`
	BgColor         string    `json:"bg_color"`
	IsActive        bool      `json:"is_active"`
	ViewCount       int       `json:"view_count"`
	ClickCount      int       `json:"click_count"`
	ExpiresAt       time.Time `json:"expires_at"`
	CreatedAt       time.Time `json:"created_at"`
}

// PublicStoryGroup groups active stories under one brand ring on the storefront.
type PublicStoryGroup struct {
	BrandID        string         `json:"brand_id"`
	BrandName      string         `json:"brand_name"`
	BrandSlug      string         `json:"brand_slug"`
	BrandSubdomain string         `json:"brand_subdomain,omitempty"`
	BrandCoverURL  string         `json:"brand_cover_url"`
	BrandVerified  bool           `json:"brand_verified"`
	LatestAt       time.Time      `json:"latest_at"`
	Stories        []StoryItemDTO `json:"stories"`
}

// FavoriteSupplierDTO represents a customer's favorited supplier + notification opt-ins.
type FavoriteSupplierDTO struct {
	ID                 string    `json:"id"`
	BrandID            string    `json:"brand_id"`
	BrandName          string    `json:"brand_name"`
	BrandSlug          string    `json:"brand_slug"`
	BrandSubdomain     string    `json:"brand_subdomain,omitempty"`
	BrandCoverURL      string    `json:"brand_cover_url"`
	CompanyType        string    `json:"company_type"`
	IsVerified         bool      `json:"is_verified"`
	ActiveProductCount int       `json:"active_product_count"`
	NotifyNewProducts  bool      `json:"notify_new_products"`
	NotifyViaEmail     bool      `json:"notify_via_email"`
	CreatedAt          time.Time `json:"created_at"`
}

// CustomerNotificationDTO mirrors customer rows in catalog.mobile_notifications.
type CustomerNotificationDTO struct {
	ID               string         `json:"id"`
	Title            string         `json:"title"`
	Body             string         `json:"body"`
	NotificationType string         `json:"notification_type"`
	Metadata         map[string]any `json:"metadata"`
	IsRead           bool           `json:"is_read"`
	CreatedAt        time.Time      `json:"created_at"`
}

// NewProductAlertItem carries newly published product details for follower fan-out.
type NewProductAlertItem struct {
	ID       string
	Slug     string
	Title    string
	ImageURL string
}

// StoriesAndFavoritesHandler manages supplier stories, monetization limits, favorite suppliers, and customer notifications.
type StoriesAndFavoritesHandler struct {
	Cfg      *config.Config
	Media    services.MediaProcessor
	Notifier services.NotificationDispatcher
}

// NewStoriesAndFavoritesHandler builds a configured StoriesAndFavoritesHandler (DIP).
func NewStoriesAndFavoritesHandler(
	cfg *config.Config,
	media services.MediaProcessor,
	notifier services.NotificationDispatcher,
) *StoriesAndFavoritesHandler {
	if media == nil {
		media = services.NewLocalImageMediaService("")
	}
	if notifier == nil {
		notifier = services.NoopNotificationDispatcher{}
	}
	return &StoriesAndFavoritesHandler{
		Cfg:      cfg,
		Media:    media,
		Notifier: notifier,
	}
}

// EvaluateStoryEntitlement deterministically calculates whether a supplier can post stories and remaining 24h quota.
func EvaluateStoryEntitlement(
	settings StorySettingsDTO,
	sub StoryEntitlementInput,
	usedLast24h int,
	oldestInWindow *time.Time,
	now time.Time,
) StoryEntitlementDTO {
	planCode := strings.ToUpper(strings.TrimSpace(sub.PlanCode))
	if planCode == "" {
		planCode = "FREE"
	}

	isPaidSub := strings.EqualFold(strings.TrimSpace(sub.Status), "ACTIVE") &&
		!sub.IsComplimentary &&
		planCode != "FREE" &&
		sub.CurrentPeriodEnd.After(now)

	isPaidEntitled := isPaidSub
	if sub.StoryEntitlementOverride != nil {
		isPaidEntitled = *sub.StoryEntitlementOverride
	}

	canPublish := false
	dailyLimit := 0
	lockReason := ""

	switch {
	case sub.StoryEntitlementOverride != nil && !*sub.StoryEntitlementOverride:
		canPublish = false
		dailyLimit = 0
		lockReason = storyLockRevoked
	case settings.IsPaidMode:
		if !isPaidEntitled {
			canPublish = false
			dailyLimit = 0
			lockReason = storyLockPaidRequired
		} else {
			canPublish = true
			dailyLimit = settings.PaidDailyLimit
			if dailyLimit <= 0 {
				dailyLimit = 8
			}
		}
	default:
		dailyLimit = settings.FreeDailyLimit
		if isPaidEntitled && settings.PaidDailyLimit > dailyLimit {
			dailyLimit = settings.PaidDailyLimit
		}
		if dailyLimit > 0 {
			canPublish = true
		} else {
			lockReason = storyLockDisabled
		}
	}

	if canPublish && sub.StoryDailyLimitOverride != nil && *sub.StoryDailyLimitOverride > 0 {
		dailyLimit = *sub.StoryDailyLimitOverride
	}

	if usedLast24h < 0 {
		usedLast24h = 0
	}
	remaining := dailyLimit - usedLast24h
	if remaining < 0 {
		remaining = 0
	}

	var nextSlotAt *time.Time
	if canPublish && remaining == 0 {
		lockReason = storyLockQuotaExceeded
		if oldestInWindow != nil {
			t := oldestInWindow.Add(24 * time.Hour)
			nextSlotAt = &t
		}
	}

	ttlHours := settings.StoryTTLHours
	if ttlHours <= 0 {
		ttlHours = 24
	}

	return StoryEntitlementDTO{
		CanPublish:     canPublish,
		IsPaidMode:     settings.IsPaidMode,
		IsPaidEntitled: isPaidEntitled,
		PlanCode:       planCode,
		DailyLimit:     dailyLimit,
		UsedLast24h:    usedLast24h,
		Remaining24h:   remaining,
		StoryTTLHours:  ttlHours,
		NextSlotAt:     nextSlotAt,
		LockReason:     lockReason,
	}
}

func validateStoryMediaURL(raw string) (string, error) {
	u := strings.TrimSpace(raw)
	if u == "" {
		return "", errors.New("Hikaye görseli zorunludur")
	}
	if strings.HasPrefix(u, "/uploads/") {
		return u, nil
	}
	parsed, err := url.Parse(u)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "", errors.New("Geçersiz hikaye görsel adresi")
	}
	return u, nil
}

func validateStoryCTAURL(raw string) (string, error) {
	u := strings.TrimSpace(raw)
	if u == "" {
		return "", nil
	}
	if strings.HasPrefix(u, "/") && !strings.HasPrefix(u, "//") {
		return u, nil
	}
	parsed, err := url.Parse(u)
	if err != nil || parsed.Scheme != "https" {
		return "", errors.New("Bağlantı yalnızca site içi (/...) veya https://mertervitrini.com.tr/... olabilir")
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "mertervitrini.com.tr" && host != "www.mertervitrini.com.tr" {
		return "", errors.New("Bağlantı yalnızca mertervitrini.com.tr adresine yönlendirebilir")
	}
	return u, nil
}

func normalizeStoryBgColor(raw string) string {
	s := strings.TrimSpace(raw)
	if len(s) != 7 || s[0] != '#' {
		return defaultStoryBgColor
	}
	if _, err := hex.DecodeString(s[1:]); err != nil {
		return defaultStoryBgColor
	}
	return strings.ToLower(s)
}

func truncateRunes(raw string, maxRunes int) string {
	trimmed := strings.TrimSpace(raw)
	if utf8.RuneCountInString(trimmed) <= maxRunes {
		return trimmed
	}
	return string([]rune(trimmed)[:maxRunes])
}

func loadStorySettingsTxOrPool(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) StorySettingsDTO {
	s := StorySettingsDTO{
		IsPaidMode:           false,
		PaidDailyLimit:       8,
		FreeDailyLimit:       8,
		StoryTTLHours:        24,
		MonthlyAddonPriceTRY: 990,
		UpdatedAt:            time.Now(),
	}
	_ = q.QueryRow(ctx, `
		SELECT is_paid_mode, paid_daily_limit, free_daily_limit, story_ttl_hours,
		       monthly_addon_price_try::float8, updated_at
		FROM catalog.story_settings
		WHERE singleton_guard = true
	`).Scan(
		&s.IsPaidMode,
		&s.PaidDailyLimit,
		&s.FreeDailyLimit,
		&s.StoryTTLHours,
		&s.MonthlyAddonPriceTRY,
		&s.UpdatedAt,
	)
	return s
}

func resolveLinkedProductForBrand(
	ctx context.Context,
	q interface {
		QueryRow(context.Context, string, ...any) pgx.Row
	},
	brandID, rawProductID string,
) (*string, string, error) {
	pid := strings.TrimSpace(rawProductID)
	if pid == "" {
		return nil, "", nil
	}
	if !isValidUUIDString(pid) {
		return nil, "", errors.New("Geçersiz ürün kimliği")
	}
	var slug string
	err := q.QueryRow(ctx, `
		SELECT COALESCE(slug, id::text)
		FROM catalog.products
		WHERE id = $1::uuid AND brand_id = $2::uuid AND COALESCE(is_archived, false) = false
	`, pid, brandID).Scan(&slug)
	if err != nil {
		return nil, "", errors.New("Seçilen ürün mağazanızda bulunamadı")
	}
	return &pid, "/product/" + slug, nil
}

func handleStoryMediaUpload(w http.ResponseWriter, r *http.Request, mediaSvc services.MediaProcessor) {
	if err := r.ParseMultipartForm(25 << 20); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Dosya boyutu çok büyük (Max: 25MB)")
		return
	}
	file, header, err := r.FormFile("image")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Yüklenecek görsel dosyası bulunamadı")
		return
	}
	defer file.Close()

	if mediaSvc == nil {
		mediaSvc = services.NewLocalImageMediaService("")
	}
	mediaURL, saveErr := mediaSvc.SaveUploadedImage(file, header.Filename, storiesMediaFolder, storiesMediaPrefix)
	if saveErr != nil {
		httpx.Error(w, http.StatusBadRequest, saveErr.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"media_url": mediaURL})
}

type createStoryRequest struct {
	BrandID         string `json:"brand_id"`
	MediaURL        string `json:"media_url"`
	Caption         string `json:"caption"`
	CTALabel        string `json:"cta_label"`
	CTAURL          string `json:"cta_url"`
	LinkedProductID string `json:"linked_product_id"`
	BgColor         string `json:"bg_color"`
	TTLHours        int    `json:"ttl_hours"`
}

func prepareStoryInsertFields(
	ctx context.Context,
	q interface {
		QueryRow(context.Context, string, ...any) pgx.Row
	},
	brandID string,
	req *createStoryRequest,
) (mediaURL, caption, ctaLabel, ctaURL, bgColor string, linkedProd *string, err error) {
	mediaURL, err = validateStoryMediaURL(req.MediaURL)
	if err != nil {
		return "", "", "", "", "", nil, err
	}
	caption = truncateRunes(req.Caption, 300)
	ctaLabel = truncateRunes(req.CTALabel, 60)
	bgColor = normalizeStoryBgColor(req.BgColor)

	linkedProd, prodURL, prodErr := resolveLinkedProductForBrand(ctx, q, brandID, req.LinkedProductID)
	if prodErr != nil {
		return "", "", "", "", "", nil, prodErr
	}

	ctaURL, err = validateStoryCTAURL(req.CTAURL)
	if err != nil {
		return "", "", "", "", "", nil, err
	}
	if ctaURL == "" && prodURL != "" {
		ctaURL = prodURL
	}
	if ctaURL != "" && ctaLabel == "" {
		ctaLabel = storyCTAFallbackLabel
	}
	return mediaURL, caption, ctaLabel, ctaURL, bgColor, linkedProd, nil
}

// =========================================================================
// 1. STOREFRONT PUBLIC STORIES ENDPOINTS
// =========================================================================

// ListPublicStories handles GET /api/v1/store/stories
func (h *StoriesAndFavoritesHandler) ListPublicStories(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.JSON(w, http.StatusOK, map[string]any{"groups": []PublicStoryGroup{}, "total_stories": 0})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()

	brandIDFilter := strings.TrimSpace(r.URL.Query().Get("brand_id"))
	brandSlugFilter := strings.TrimSpace(r.URL.Query().Get("brand_slug"))

	rows, err := db.Pool.Query(ctx, `
		SELECT
			s.id::text, s.brand_id::text, b.brand_name, COALESCE(b.slug, b.id::text),
			CASE WHEN COALESCE(b.subdomain_enabled, false) THEN COALESCE(b.subdomain, '') ELSE '' END,
			COALESCE(b.cover_image_url, ''), COALESCE(b.is_verified, true),
			s.created_by_role, s.media_url, s.media_type, s.caption, s.cta_label, s.cta_url,
			s.linked_product_id::text, COALESCE(p.slug, ''), COALESCE(p.title, ''),
			s.bg_color, s.is_active, s.view_count, s.click_count, s.expires_at, s.created_at
		FROM catalog.supplier_stories s
		JOIN catalog.brands b ON b.id = s.brand_id
		LEFT JOIN catalog.products p ON p.id = s.linked_product_id
		WHERE s.deleted_at IS NULL
		  AND s.is_active = true
		  AND s.expires_at > NOW()
		  AND b.is_active = true
		  AND ($1 = '' OR s.brand_id::text = $1)
		  AND ($2 = '' OR b.slug = $2 OR b.id::text = $2 OR (COALESCE(b.subdomain_enabled, false) = true AND COALESCE(b.subdomain, '') <> '' AND LOWER(b.subdomain) = LOWER($2)))
		ORDER BY s.brand_id, s.created_at ASC
	`, brandIDFilter, brandSlugFilter)
	if err != nil {
		log.Printf("[STORIES] ListPublicStories error: %v", err)
		httpx.JSON(w, http.StatusOK, map[string]any{"groups": []PublicStoryGroup{}, "total_stories": 0})
		return
	}
	defer rows.Close()

	groupMap := make(map[string]*PublicStoryGroup)
	orderedIDs := make([]string, 0)
	totalStories := 0

	for rows.Next() {
		var item StoryItemDTO
		var prodID *string
		if scanErr := rows.Scan(
			&item.ID, &item.BrandID, &item.BrandName, &item.BrandSlug, &item.BrandSubdomain,
			&item.BrandCoverURL, &item.BrandVerified,
			&item.CreatedByRole, &item.MediaURL, &item.MediaType, &item.Caption, &item.CTALabel, &item.CTAURL,
			&prodID, &item.ProductSlug, &item.ProductTitle,
			&item.BgColor, &item.IsActive, &item.ViewCount, &item.ClickCount, &item.ExpiresAt, &item.CreatedAt,
		); scanErr != nil {
			continue
		}
		item.LinkedProductID = prodID
		totalStories++

		grp, exists := groupMap[item.BrandID]
		if !exists {
			grp = &PublicStoryGroup{
				BrandID:        item.BrandID,
				BrandName:      item.BrandName,
				BrandSlug:      item.BrandSlug,
				BrandSubdomain: item.BrandSubdomain,
				BrandCoverURL:  item.BrandCoverURL,
				BrandVerified:  item.BrandVerified,
				LatestAt:       item.CreatedAt,
				Stories:        make([]StoryItemDTO, 0, 4),
			}
			groupMap[item.BrandID] = grp
			orderedIDs = append(orderedIDs, item.BrandID)
		}
		if item.CreatedAt.After(grp.LatestAt) {
			grp.LatestAt = item.CreatedAt
		}
		grp.Stories = append(grp.Stories, item)
	}

	groups := make([]PublicStoryGroup, 0, len(orderedIDs))
	for _, id := range orderedIDs {
		groups = append(groups, *groupMap[id])
	}
	// Sort brand rings so freshest story creator appears first
	for i := 0; i < len(groups); i++ {
		for j := i + 1; j < len(groups); j++ {
			if groups[j].LatestAt.After(groups[i].LatestAt) {
				groups[i], groups[j] = groups[j], groups[i]
			}
		}
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"groups":        groups,
		"total_stories": totalStories,
	})
}

// TrackStoryView handles POST /api/v1/store/stories/{id}/view
func (h *StoriesAndFavoritesHandler) TrackStoryView(w http.ResponseWriter, r *http.Request) {
	h.incrementStoryMetric(w, r, "view_count")
}

// TrackStoryClick handles POST /api/v1/store/stories/{id}/click
func (h *StoriesAndFavoritesHandler) TrackStoryClick(w http.ResponseWriter, r *http.Request) {
	h.incrementStoryMetric(w, r, "click_count")
}

func (h *StoriesAndFavoritesHandler) incrementStoryMetric(w http.ResponseWriter, r *http.Request, column string) {
	id := strings.TrimSpace(r.PathValue("id"))
	if !isValidUUIDString(id) {
		httpx.Error(w, http.StatusBadRequest, errInvalidStoryID)
		return
	}
	if db.Pool == nil {
		httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	colExpr := "view_count = view_count + 1"
	if column == "click_count" {
		colExpr = "click_count = click_count + 1"
	}
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	_, _ = db.Pool.Exec(ctx, fmt.Sprintf(`
		UPDATE catalog.supplier_stories
		SET %s
		WHERE id = $1::uuid AND is_active = true AND deleted_at IS NULL AND expires_at > NOW()
	`, colExpr), id)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// =========================================================================
// 2. SUPPLIER PORTAL STORIES ENDPOINTS
// =========================================================================

func loadSupplierEntitlementState(
	ctx context.Context,
	q interface {
		QueryRow(context.Context, string, ...any) pgx.Row
	},
	brandID string,
) (StorySettingsDTO, StoryEntitlementDTO) {
	settings := loadStorySettingsTxOrPool(ctx, q)

	var subInput StoryEntitlementInput
	err := q.QueryRow(ctx, `
		SELECT COALESCE(plan_code, 'FREE'),
		       COALESCE(status, 'ACTIVE'),
		       COALESCE(is_complimentary, true),
		       COALESCE(current_period_end, NOW()),
		       story_entitlement_override,
		       story_daily_limit_override
		FROM catalog.supplier_subscriptions
		WHERE brand_id = $1::uuid
	`, brandID).Scan(
		&subInput.PlanCode,
		&subInput.Status,
		&subInput.IsComplimentary,
		&subInput.CurrentPeriodEnd,
		&subInput.StoryEntitlementOverride,
		&subInput.StoryDailyLimitOverride,
	)
	if err != nil {
		subInput = StoryEntitlementInput{
			PlanCode:        "FREE",
			Status:          "ACTIVE",
			IsComplimentary: true,
		}
	}

	var usedLast24h int
	var oldestInWindow *time.Time
	_ = q.QueryRow(ctx, `
		SELECT COUNT(*)::int, MIN(created_at)
		FROM catalog.supplier_stories
		WHERE brand_id = $1::uuid
		  AND created_by_role = 'supplier'
		  AND created_at >= NOW() - INTERVAL '24 hours'
	`, brandID).Scan(&usedLast24h, &oldestInWindow)

	ent := EvaluateStoryEntitlement(settings, subInput, usedLast24h, oldestInWindow, time.Now())
	return settings, ent
}

// ListSupplierStories handles GET /api/v1/supplier/stories
func (h *StoriesAndFavoritesHandler) ListSupplierStories(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || !isValidUUIDString(claims.BrandID) {
		httpx.Error(w, http.StatusUnauthorized, "Tedarikçi oturumu doğrulanamadı")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	_ = ensureSupplierSubscription(ctx, claims.BrandID)
	settings, entitlement := loadSupplierEntitlementState(ctx, db.Pool, claims.BrandID)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			s.id::text, s.brand_id::text, s.created_by_role,
			s.media_url, s.media_type, s.caption, s.cta_label, s.cta_url,
			s.linked_product_id::text, COALESCE(p.slug, ''), COALESCE(p.title, ''),
			s.bg_color, s.is_active, s.view_count, s.click_count, s.expires_at, s.created_at
		FROM catalog.supplier_stories s
		LEFT JOIN catalog.products p ON p.id = s.linked_product_id
		WHERE s.brand_id = $1::uuid
		  AND s.deleted_at IS NULL
		ORDER BY s.created_at DESC
		LIMIT 50
	`, claims.BrandID)
	activeStories := make([]StoryItemDTO, 0)
	recentStories := make([]StoryItemDTO, 0)
	now := time.Now()
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var item StoryItemDTO
			var prodID *string
			if scanErr := rows.Scan(
				&item.ID, &item.BrandID, &item.CreatedByRole,
				&item.MediaURL, &item.MediaType, &item.Caption, &item.CTALabel, &item.CTAURL,
				&prodID, &item.ProductSlug, &item.ProductTitle,
				&item.BgColor, &item.IsActive, &item.ViewCount, &item.ClickCount, &item.ExpiresAt, &item.CreatedAt,
			); scanErr != nil {
				continue
			}
			item.LinkedProductID = prodID
			if item.IsActive && item.ExpiresAt.After(now) {
				activeStories = append(activeStories, item)
			} else {
				recentStories = append(recentStories, item)
			}
		}
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"entitlement":    entitlement,
		"settings":       settings,
		"active_stories": activeStories,
		"recent_stories": recentStories,
	})
}

// UploadSupplierStoryMedia handles POST /api/v1/supplier/stories/upload
func (h *StoriesAndFavoritesHandler) UploadSupplierStoryMedia(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || !isValidUUIDString(claims.BrandID) {
		httpx.Error(w, http.StatusUnauthorized, "Tedarikçi oturumu doğrulanamadı")
		return
	}
	handleStoryMediaUpload(w, r, h.Media)
}

// CreateSupplierStory handles POST /api/v1/supplier/stories
func (h *StoriesAndFavoritesHandler) CreateSupplierStory(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || !isValidUUIDString(claims.BrandID) {
		httpx.Error(w, http.StatusUnauthorized, "Tedarikçi oturumu doğrulanamadı")
		return
	}

	var req createStoryRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz hikaye verisi")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	_ = ensureSupplierSubscription(ctx, claims.BrandID)

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "İşlem başlatılamadı")
		return
	}
	defer tx.Rollback(ctx)

	if _, lockErr := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('story_quota:' || $1))`, claims.BrandID); lockErr != nil {
		httpx.Error(w, http.StatusInternalServerError, "Kota kilidi alınamadı")
		return
	}

	settings, entitlement := loadSupplierEntitlementState(ctx, tx, claims.BrandID)
	if !entitlement.CanPublish {
		msg := "Hikaye yayınlama özelliği şu an yalnızca ücretli paket sahipleri için aktiftir."
		if entitlement.LockReason == storyLockRevoked {
			msg = "Mağazanızın hikaye yayınlama yetkisi yönetici tarafından kapatılmıştır."
		}
		httpx.JSON(w, http.StatusPaymentRequired, map[string]any{
			"error":       msg,
			"code":        "STORY_PAID_REQUIRED",
			"entitlement": entitlement,
		})
		return
	}
	if entitlement.Remaining24h <= 0 {
		httpx.JSON(w, http.StatusTooManyRequests, map[string]any{
			"error":       fmt.Sprintf("Son 24 saatteki maksimum %d hikaye limitinize ulaştınız.", entitlement.DailyLimit),
			"code":        "STORY_QUOTA_EXCEEDED",
			"entitlement": entitlement,
		})
		return
	}

	mediaURL, caption, ctaLabel, ctaURL, bgColor, linkedProd, prepErr := prepareStoryInsertFields(ctx, tx, claims.BrandID, &req)
	if prepErr != nil {
		httpx.Error(w, http.StatusBadRequest, prepErr.Error())
		return
	}

	ttlHours := settings.StoryTTLHours
	if ttlHours <= 0 {
		ttlHours = 24
	}

	var story StoryItemDTO
	var prodOut *string
	insErr := tx.QueryRow(ctx, `
		INSERT INTO catalog.supplier_stories (
			brand_id, created_by_role, created_by_user_id, media_url, media_type,
			caption, cta_label, cta_url, linked_product_id, bg_color, is_active, expires_at
		) VALUES (
			$1::uuid, 'supplier', $2, $3, 'image',
			$4, $5, $6, $7::uuid, $8, true, NOW() + make_interval(hours => $9)
		)
		RETURNING id::text, brand_id::text, created_by_role, media_url, media_type,
		          caption, cta_label, cta_url, linked_product_id::text, bg_color,
		          is_active, view_count, click_count, expires_at, created_at
	`,
		claims.BrandID, claims.UserID, mediaURL,
		caption, ctaLabel, ctaURL, linkedProd, bgColor, ttlHours,
	).Scan(
		&story.ID, &story.BrandID, &story.CreatedByRole, &story.MediaURL, &story.MediaType,
		&story.Caption, &story.CTALabel, &story.CTAURL, &prodOut, &story.BgColor,
		&story.IsActive, &story.ViewCount, &story.ClickCount, &story.ExpiresAt, &story.CreatedAt,
	)
	if insErr != nil {
		log.Printf("[STORIES] CreateSupplierStory insert error: %v", insErr)
		httpx.Error(w, http.StatusInternalServerError, "Hikaye kaydedilemedi")
		return
	}
	story.LinkedProductID = prodOut

	if commitErr := tx.Commit(ctx); commitErr != nil {
		httpx.Error(w, http.StatusInternalServerError, "Hikaye onaylanamadı")
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"story":   story,
		"message": "Hikayeniz 24 saat boyunca vitrinde yayına alındı.",
	})
}

// DeleteSupplierStory handles DELETE /api/v1/supplier/stories/{id}
func (h *StoriesAndFavoritesHandler) DeleteSupplierStory(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || !isValidUUIDString(claims.BrandID) {
		httpx.Error(w, http.StatusUnauthorized, "Tedarikçi oturumu doğrulanamadı")
		return
	}
	storyID := strings.TrimSpace(r.PathValue("id"))
	if !isValidUUIDString(storyID) {
		httpx.Error(w, http.StatusBadRequest, errInvalidStoryID)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	tag, err := db.Pool.Exec(ctx, `
		UPDATE catalog.supplier_stories
		SET deleted_at = NOW(), is_active = false
		WHERE id = $1::uuid AND brand_id = $2::uuid AND deleted_at IS NULL
	`, storyID, claims.BrandID)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "Hikaye bulunamadı veya silme yetkiniz yok")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Hikaye kaldırıldı.",
	})
}

// =========================================================================
// 3. ADMIN STORIES & PAID MODE SETTINGS ENDPOINTS
// =========================================================================

// GetAdminStoriesOverview handles GET /api/v1/admin/stories/overview
func (h *StoriesAndFavoritesHandler) GetAdminStoriesOverview(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	settings := loadStorySettingsTxOrPool(ctx, db.Pool)

	var activeCount, totalViews, totalClicks, activeBrands int
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(COUNT(*) FILTER (WHERE is_active = true AND deleted_at IS NULL AND expires_at > NOW()), 0)::int,
			COALESCE(SUM(view_count) FILTER (WHERE deleted_at IS NULL), 0)::int,
			COALESCE(SUM(click_count) FILTER (WHERE deleted_at IS NULL), 0)::int,
			COALESCE(COUNT(DISTINCT brand_id) FILTER (WHERE is_active = true AND deleted_at IS NULL AND expires_at > NOW()), 0)::int
		FROM catalog.supplier_stories
	`).Scan(&activeCount, &totalViews, &totalClicks, &activeBrands)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			s.id::text, s.brand_id::text, b.brand_name, COALESCE(b.slug, b.id::text),
			CASE WHEN COALESCE(b.subdomain_enabled, false) THEN COALESCE(b.subdomain, '') ELSE '' END,
			COALESCE(b.cover_image_url, ''), COALESCE(b.is_verified, true),
			s.created_by_role, s.media_url, s.media_type, s.caption, s.cta_label, s.cta_url,
			s.linked_product_id::text, COALESCE(p.slug, ''), COALESCE(p.title, ''),
			s.bg_color, s.is_active, s.view_count, s.click_count, s.expires_at, s.created_at
		FROM catalog.supplier_stories s
		JOIN catalog.brands b ON b.id = s.brand_id
		LEFT JOIN catalog.products p ON p.id = s.linked_product_id
		WHERE s.deleted_at IS NULL
		ORDER BY s.created_at DESC
		LIMIT 100
	`)
	stories := make([]StoryItemDTO, 0)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var item StoryItemDTO
			var prodID *string
			if scanErr := rows.Scan(
				&item.ID, &item.BrandID, &item.BrandName, &item.BrandSlug,
				&item.BrandCoverURL, &item.BrandVerified,
				&item.CreatedByRole, &item.MediaURL, &item.MediaType, &item.Caption, &item.CTALabel, &item.CTAURL,
				&prodID, &item.ProductSlug, &item.ProductTitle,
				&item.BgColor, &item.IsActive, &item.ViewCount, &item.ClickCount, &item.ExpiresAt, &item.CreatedAt,
			); scanErr == nil {
				item.LinkedProductID = prodID
				stories = append(stories, item)
			}
		}
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"settings": settings,
		"summary": map[string]int{
			"active_count":        activeCount,
			"total_views":         totalViews,
			"total_clicks":        totalClicks,
			"active_brands_count": activeBrands,
		},
		"stories": stories,
	})
}

// UpdateAdminStorySettings handles PUT /api/v1/admin/stories/settings
func (h *StoriesAndFavoritesHandler) UpdateAdminStorySettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IsPaidMode           bool    `json:"is_paid_mode"`
		PaidDailyLimit       int     `json:"paid_daily_limit"`
		FreeDailyLimit       int     `json:"free_daily_limit"`
		StoryTTLHours        int     `json:"story_ttl_hours"`
		MonthlyAddonPriceTRY float64 `json:"monthly_addon_price_try"`
	}
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz ayar verisi")
		return
	}
	if req.PaidDailyLimit < 1 || req.PaidDailyLimit > 50 {
		httpx.Error(w, http.StatusBadRequest, "Ücretli 24 saatlik hikaye limiti 1 ile 50 arasında olmalıdır")
		return
	}
	if req.FreeDailyLimit < 0 || req.FreeDailyLimit > 50 {
		httpx.Error(w, http.StatusBadRequest, "Ücretsiz 24 saatlik hikaye limiti 0 ile 50 arasında olmalıdır")
		return
	}
	if req.StoryTTLHours < 1 || req.StoryTTLHours > 168 {
		httpx.Error(w, http.StatusBadRequest, "Hikaye yayın süresi 1 ile 168 saat arasında olmalıdır")
		return
	}
	if req.MonthlyAddonPriceTRY < 0 {
		req.MonthlyAddonPriceTRY = 0
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO catalog.story_settings (
			singleton_guard, is_paid_mode, paid_daily_limit, free_daily_limit,
			story_ttl_hours, monthly_addon_price_try, updated_at
		) VALUES (true, $1, $2, $3, $4, $5, NOW())
		ON CONFLICT (singleton_guard) DO UPDATE SET
			is_paid_mode = EXCLUDED.is_paid_mode,
			paid_daily_limit = EXCLUDED.paid_daily_limit,
			free_daily_limit = EXCLUDED.free_daily_limit,
			story_ttl_hours = EXCLUDED.story_ttl_hours,
			monthly_addon_price_try = EXCLUDED.monthly_addon_price_try,
			updated_at = NOW()
	`, req.IsPaidMode, req.PaidDailyLimit, req.FreeDailyLimit, req.StoryTTLHours, req.MonthlyAddonPriceTRY)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Hikaye ayarları güncellenemedi")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"settings": loadStorySettingsTxOrPool(ctx, db.Pool),
		"message":  "Hikaye ücretlendirme ve limit ayarları güncellendi.",
	})
}

// UploadAdminStoryMedia handles POST /api/v1/admin/stories/upload
func (h *StoriesAndFavoritesHandler) UploadAdminStoryMedia(w http.ResponseWriter, r *http.Request) {
	handleStoryMediaUpload(w, r, h.Media)
}

// CreateAdminStory handles POST /api/v1/admin/stories
func (h *StoriesAndFavoritesHandler) CreateAdminStory(w http.ResponseWriter, r *http.Request) {
	var req createStoryRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz hikaye verisi")
		return
	}
	if !isValidUUIDString(req.BrandID) {
		httpx.Error(w, http.StatusBadRequest, "Lütfen geçerli bir üretici firma seçin")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	var brandExists bool
	_ = db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM catalog.brands WHERE id = $1::uuid AND is_active = true)`, req.BrandID).Scan(&brandExists)
	if !brandExists {
		httpx.Error(w, http.StatusNotFound, "Seçilen firma aktif değil veya bulunamadı")
		return
	}

	mediaURL, caption, ctaLabel, ctaURL, bgColor, linkedProd, prepErr := prepareStoryInsertFields(ctx, db.Pool, req.BrandID, &req)
	if prepErr != nil {
		httpx.Error(w, http.StatusBadRequest, prepErr.Error())
		return
	}

	settings := loadStorySettingsTxOrPool(ctx, db.Pool)
	ttlHours := req.TTLHours
	if ttlHours < 1 || ttlHours > 168 {
		ttlHours = settings.StoryTTLHours
	}
	if ttlHours <= 0 {
		ttlHours = 24
	}

	var storyID string
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.supplier_stories (
			brand_id, created_by_role, media_url, media_type,
			caption, cta_label, cta_url, linked_product_id, bg_color, is_active, expires_at
		) VALUES (
			$1::uuid, 'admin', $2, 'image',
			$3, $4, $5, $6::uuid, $7, true, NOW() + make_interval(hours => $8)
		)
		RETURNING id::text
	`, req.BrandID, mediaURL, caption, ctaLabel, ctaURL, linkedProd, bgColor, ttlHours).Scan(&storyID)
	if err != nil {
		log.Printf("[STORIES] CreateAdminStory error: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "Hikaye oluşturulamadı")
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"id":      storyID,
		"message": "Hikaye vitrinde yayına alındı.",
	})
}

// ToggleAdminStoryActive handles PATCH /api/v1/admin/stories/{id}
func (h *StoriesAndFavoritesHandler) ToggleAdminStoryActive(w http.ResponseWriter, r *http.Request) {
	storyID := strings.TrimSpace(r.PathValue("id"))
	if !isValidUUIDString(storyID) {
		httpx.Error(w, http.StatusBadRequest, errInvalidStoryID)
		return
	}
	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz durum bilgisi")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	tag, err := db.Pool.Exec(ctx, `
		UPDATE catalog.supplier_stories
		SET is_active = $2
		WHERE id = $1::uuid AND deleted_at IS NULL
	`, storyID, req.IsActive)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "Hikaye bulunamadı")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "is_active": req.IsActive})
}

// DeleteAdminStory handles DELETE /api/v1/admin/stories/{id}
func (h *StoriesAndFavoritesHandler) DeleteAdminStory(w http.ResponseWriter, r *http.Request) {
	storyID := strings.TrimSpace(r.PathValue("id"))
	if !isValidUUIDString(storyID) {
		httpx.Error(w, http.StatusBadRequest, errInvalidStoryID)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	tag, err := db.Pool.Exec(ctx, `
		UPDATE catalog.supplier_stories
		SET deleted_at = NOW(), is_active = false
		WHERE id = $1::uuid AND deleted_at IS NULL
	`, storyID)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "Hikaye bulunamadı")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

// =========================================================================
// 4. CUSTOMER FAVORITE SUPPLIERS & STOREFRONT NOTIFICATIONS
// =========================================================================

// ListFavoriteSuppliers handles GET /api/v1/store/favorite-suppliers
func (h *StoriesAndFavoritesHandler) ListFavoriteSuppliers(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errCustomerAuthRequired)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT
			f.id::text, f.brand_id::text, b.brand_name, COALESCE(b.slug, b.id::text),
			CASE WHEN COALESCE(b.subdomain_enabled, false) THEN COALESCE(b.subdomain, '') ELSE '' END,
			COALESCE(b.cover_image_url, ''), COALESCE(b.company_type, 'uretici_toptanci'),
			COALESCE(b.is_verified, true),
			(SELECT COUNT(*)::int FROM catalog.products p WHERE p.brand_id = b.id AND p.is_active = true AND COALESCE(p.is_archived, false) = false),
			f.notify_new_products, f.notify_via_email, f.created_at
		FROM catalog.customer_favorite_suppliers f
		JOIN catalog.brands b ON b.id = f.brand_id
		WHERE f.user_id = $1
		  AND b.is_active = true
		ORDER BY f.created_at DESC
	`, userID)
	if err != nil {
		log.Printf("[FAVORITES] ListFavoriteSuppliers error: %v", err)
		httpx.JSON(w, http.StatusOK, map[string]any{
			"items":     []FavoriteSupplierDTO{},
			"brand_ids": []string{},
			"count":     0,
		})
		return
	}
	defer rows.Close()

	items := make([]FavoriteSupplierDTO, 0)
	brandIDs := make([]string, 0)
	for rows.Next() {
		var item FavoriteSupplierDTO
		if scanErr := rows.Scan(
			&item.ID, &item.BrandID, &item.BrandName, &item.BrandSlug, &item.BrandSubdomain,
			&item.BrandCoverURL, &item.CompanyType, &item.IsVerified,
			&item.ActiveProductCount, &item.NotifyNewProducts, &item.NotifyViaEmail, &item.CreatedAt,
		); scanErr == nil {
			items = append(items, item)
			brandIDs = append(brandIDs, item.BrandID)
		}
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"items":     items,
		"brand_ids": brandIDs,
		"count":     len(items),
	})
}

// AddFavoriteSupplier handles POST /api/v1/store/favorite-suppliers/{brand_id}
func (h *StoriesAndFavoritesHandler) AddFavoriteSupplier(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errCustomerAuthRequired)
		return
	}
	brandID := strings.TrimSpace(r.PathValue("brand_id"))
	if !isValidUUIDString(brandID) {
		httpx.Error(w, http.StatusBadRequest, errInvalidBrandID)
		return
	}

	var req struct {
		NotifyNewProducts *bool `json:"notify_new_products"`
		NotifyViaEmail    *bool `json:"notify_via_email"`
	}
	if r.ContentLength > 0 {
		if decErr := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); decErr != nil {
			httpx.Error(w, http.StatusBadRequest, "Geçersiz tercih verisi")
			return
		}
	}

	notifyNew := true
	if req.NotifyNewProducts != nil {
		notifyNew = *req.NotifyNewProducts
	}
	notifyEmail := false
	if req.NotifyViaEmail != nil {
		notifyEmail = *req.NotifyViaEmail
	}

	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()

	var brandName string
	if bErr := db.Pool.QueryRow(ctx, `
		SELECT brand_name FROM catalog.brands WHERE id = $1::uuid AND is_active = true
	`, brandID).Scan(&brandName); bErr != nil {
		httpx.Error(w, http.StatusNotFound, "Tedarikçi firma bulunamadı")
		return
	}

	_, err = db.Pool.Exec(ctx, `
		INSERT INTO catalog.customer_favorite_suppliers (
			user_id, brand_id, notify_new_products, notify_via_email
		) VALUES ($1, $2::uuid, $3, $4)
		ON CONFLICT (user_id, brand_id) DO UPDATE SET
			notify_new_products = CASE WHEN $5 THEN EXCLUDED.notify_new_products ELSE catalog.customer_favorite_suppliers.notify_new_products END,
			notify_via_email = CASE WHEN $6 THEN EXCLUDED.notify_via_email ELSE catalog.customer_favorite_suppliers.notify_via_email END,
			updated_at = NOW()
	`, userID, brandID, notifyNew, notifyEmail, req.NotifyNewProducts != nil, req.NotifyViaEmail != nil)
	if err != nil {
		log.Printf("[FAVORITES] AddFavoriteSupplier upsert error: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "Favori tedarikçi eklenemedi")
		return
	}

	var actualNotifyNew, actualNotifyEmail bool
	var favCount int
	_ = db.Pool.QueryRow(ctx, `
		SELECT notify_new_products, notify_via_email
		FROM catalog.customer_favorite_suppliers
		WHERE user_id = $1 AND brand_id = $2::uuid
	`, userID, brandID).Scan(&actualNotifyNew, &actualNotifyEmail)
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM catalog.customer_favorite_suppliers WHERE user_id = $1
	`, userID).Scan(&favCount)

	httpx.JSON(w, http.StatusOK, map[string]any{
		"is_favorite":         true,
		"brand_id":            brandID,
		"brand_name":          brandName,
		"notify_new_products": actualNotifyNew,
		"notify_via_email":    actualNotifyEmail,
		"favorite_count":      favCount,
	})
}

// UpdateFavoriteSupplierPrefs handles PATCH /api/v1/store/favorite-suppliers/{brand_id}
func (h *StoriesAndFavoritesHandler) UpdateFavoriteSupplierPrefs(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errCustomerAuthRequired)
		return
	}
	brandID := strings.TrimSpace(r.PathValue("brand_id"))
	if !isValidUUIDString(brandID) {
		httpx.Error(w, http.StatusBadRequest, errInvalidBrandID)
		return
	}

	var req struct {
		NotifyNewProducts *bool `json:"notify_new_products"`
		NotifyViaEmail    *bool `json:"notify_via_email"`
	}
	if decErr := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); decErr != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz bildirim tercihi")
		return
	}
	if req.NotifyNewProducts == nil && req.NotifyViaEmail == nil {
		httpx.Error(w, http.StatusBadRequest, "En az bir bildirim ayarı gönderilmelidir")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var notifyNew, notifyEmail bool
	err = db.Pool.QueryRow(ctx, `
		UPDATE catalog.customer_favorite_suppliers
		SET notify_new_products = COALESCE($3, notify_new_products),
		    notify_via_email = COALESCE($4, notify_via_email),
		    updated_at = NOW()
		WHERE user_id = $1 AND brand_id = $2::uuid
		RETURNING notify_new_products, notify_via_email
	`, userID, brandID, req.NotifyNewProducts, req.NotifyViaEmail).Scan(&notifyNew, &notifyEmail)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "Bu tedarikçi favorilerinizde bulunamadı")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"is_favorite":         true,
		"brand_id":            brandID,
		"notify_new_products": notifyNew,
		"notify_via_email":    notifyEmail,
	})
}

// RemoveFavoriteSupplier handles DELETE /api/v1/store/favorite-suppliers/{brand_id}
func (h *StoriesAndFavoritesHandler) RemoveFavoriteSupplier(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errCustomerAuthRequired)
		return
	}
	brandID := strings.TrimSpace(r.PathValue("brand_id"))
	if !isValidUUIDString(brandID) {
		httpx.Error(w, http.StatusBadRequest, errInvalidBrandID)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, _ = db.Pool.Exec(ctx, `
		DELETE FROM catalog.customer_favorite_suppliers
		WHERE user_id = $1 AND brand_id = $2::uuid
	`, userID, brandID)

	var favCount int
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM catalog.customer_favorite_suppliers WHERE user_id = $1
	`, userID).Scan(&favCount)

	httpx.JSON(w, http.StatusOK, map[string]any{
		"is_favorite":    false,
		"brand_id":       brandID,
		"favorite_count": favCount,
	})
}

// ListCustomerNotifications handles GET /api/v1/store/notifications
func (h *StoriesAndFavoritesHandler) ListCustomerNotifications(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errCustomerAuthRequired)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()

	var unreadCount int
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM catalog.mobile_notifications
		WHERE ((user_id = $1 AND user_role = 'customer') OR (recipient_id = $1 AND recipient_type = 'customer'))
		  AND is_read = false
	`, userID).Scan(&unreadCount)

	rows, qErr := db.Pool.Query(ctx, `
		SELECT id::text, title, body, notification_type,
		       COALESCE(NULLIF(metadata, '{}'::jsonb), payload, '{}'::jsonb),
		       is_read, created_at
		FROM catalog.mobile_notifications
		WHERE (user_id = $1 AND user_role = 'customer')
		   OR (recipient_id = $1 AND recipient_type = 'customer')
		ORDER BY created_at DESC
		LIMIT 40
	`, userID)
	list := make([]CustomerNotificationDTO, 0)
	if qErr == nil {
		defer rows.Close()
		for rows.Next() {
			var item CustomerNotificationDTO
			var rawMeta []byte
			if scanErr := rows.Scan(
				&item.ID, &item.Title, &item.Body, &item.NotificationType,
				&rawMeta, &item.IsRead, &item.CreatedAt,
			); scanErr == nil {
				item.Metadata = make(map[string]any)
				if len(rawMeta) > 0 {
					_ = json.Unmarshal(rawMeta, &item.Metadata)
				}
				list = append(list, item)
			}
		}
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"notifications": list,
		"unread_count":  unreadCount,
	})
}

// MarkAllCustomerNotificationsRead handles POST /api/v1/store/notifications/read-all
func (h *StoriesAndFavoritesHandler) MarkAllCustomerNotificationsRead(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errCustomerAuthRequired)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, _ = db.Pool.Exec(ctx, `
		UPDATE catalog.mobile_notifications
		SET is_read = true
		WHERE ((user_id = $1 AND user_role = 'customer') OR (recipient_id = $1 AND recipient_type = 'customer'))
		  AND is_read = false
	`, userID)

	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

// MarkCustomerNotificationRead handles POST /api/v1/store/notifications/{id}/read
func (h *StoriesAndFavoritesHandler) MarkCustomerNotificationRead(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errCustomerAuthRequired)
		return
	}
	notifID := strings.TrimSpace(r.PathValue("id"))
	if !isValidUUIDString(notifID) {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz bildirim kimliği")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, _ = db.Pool.Exec(ctx, `
		UPDATE catalog.mobile_notifications
		SET is_read = true
		WHERE id = $1::uuid
		  AND ((user_id = $2 AND user_role = 'customer') OR (recipient_id = $2 AND recipient_type = 'customer'))
	`, notifID, userID)

	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

// =========================================================================
// 5. FAVORITE SUPPLIER NEW-PRODUCT NOTIFICATION FAN-OUT
// =========================================================================

type notifLangCopy struct {
	singleTitle string
	singleBody  string
	multiTitle  string
	multiBody   string
}

var newProductNotifTemplates = map[string]notifLangCopy{
	"tr": {
		singleTitle: "✨ %s yeni bir ürün yayınladı",
		singleBody:  "%s modelini toptan vitrininde hemen inceleyebilirsiniz.",
		multiTitle:  "✨ %s %d yeni ürün yayınladı",
		multiBody:   "Favori tedarikçiniz %s kataloğuna %d yeni toptan ürün ekledi.",
	},
	"en": {
		singleTitle: "✨ %s published a new product",
		singleBody:  "Check out %s now in their wholesale showroom.",
		multiTitle:  "✨ %s published %d new products",
		multiBody:   "Your favorite supplier %s added %d new wholesale items.",
	},
	"ru": {
		singleTitle: "✨ %s опубликовала новинку",
		singleBody:  "Модель %s уже доступна в оптовой витрине поставщика.",
		multiTitle:  "✨ %s опубликовала %d новых моделей",
		multiBody:   "Ваш избранный поставщик %s добавил %d новых оптовых товаров.",
	},
	"ar": {
		singleTitle: "✨ نشر %s منتجاً جديداً",
		singleBody:  "يمكنك الآن معاينة موديل %s في صالة عرض الجملة.",
		multiTitle:  "✨ نشر %s %d منتجات جديدة",
		multiBody:   "أضاف المورد المفضل %s %d موديلات جملة جديدة.",
	},
	"de": {
		singleTitle: "✨ %s hat ein neues Modell veröffentlicht",
		singleBody:  "Entdecken Sie %s jetzt im Großhandels-Showroom.",
		multiTitle:  "✨ %s hat %d neue Modelle veröffentlicht",
		multiBody:   "Ihr favorisierter Hersteller %s hat %d neue Artikel hinzugefügt.",
	},
	"fr": {
		singleTitle: "✨ %s a publié un nouveau modèle",
		singleBody:  "Découvrez %s dès maintenant dans le showroom grossiste.",
		multiTitle:  "✨ %s a publié %d nouveaux modèles",
		multiBody:   "Votre fournisseur favori %s a ajouté %d nouveaux articles de gros.",
	},
	"pl": {
		singleTitle: "✨ %s opublikował nowy produkt",
		singleBody:  "Sprawdź model %s w hurtowym showroomie dostawcy.",
		multiTitle:  "✨ %s opublikował %d nowych produktów",
		multiBody:   "Twój ulubiony dostawca %s dodał %d nowych artykułów hurtowych.",
	},
	"bg": {
		singleTitle: "✨ %s публикува нов продукт",
		singleBody:  "Разгледайте модел %s в шоурума на едро сега.",
		multiTitle:  "✨ %s публикува %d нови продукта",
		multiBody:   "Любимият ви доставчик %s добави %d нови артикула на едро.",
	},
}

// BuildNewProductNotificationCopy produces localized title, body, and target URL for single or batch product alerts.
func BuildNewProductNotificationCopy(
	lang, brandName, brandSlug string,
	items []NewProductAlertItem,
) (title, body, targetURL string) {
	code := strings.ToLower(strings.TrimSpace(lang))
	if len(code) > 2 {
		code = code[:2]
	}
	tpl, ok := newProductNotifTemplates[code]
	if !ok {
		tpl = newProductNotifTemplates["tr"]
	}

	if len(items) == 1 {
		item := items[0]
		prodTitle := strings.TrimSpace(item.Title)
		if prodTitle == "" {
			prodTitle = "Yeni Koleksiyon Ürünü"
		}
		targetSlug := strings.TrimSpace(item.Slug)
		if targetSlug == "" {
			targetSlug = item.ID
		}
		return fmt.Sprintf(tpl.singleTitle, brandName),
			fmt.Sprintf(tpl.singleBody, prodTitle),
			"/product/" + targetSlug
	}

	targetSlug := strings.TrimSpace(brandSlug)
	if targetSlug == "" {
		targetSlug = "ureticiler"
		return fmt.Sprintf(tpl.multiTitle, brandName, len(items)),
			fmt.Sprintf(tpl.multiBody, brandName, len(items)),
			"/ureticiler"
	}
	return fmt.Sprintf(tpl.multiTitle, brandName, len(items)),
		fmt.Sprintf(tpl.multiBody, brandName, len(items)),
		"/ureticiler/" + targetSlug
}

type favoriteFollowerRow struct {
	userID         string
	preferredLang  string
	email          string
	emailVerified  bool
	notifyViaEmail bool
}

// NotifyFavoriteSupplierFollowersAsync notifies opted-in followers when a supplier publishes active products.
func NotifyFavoriteSupplierFollowersAsync(
	cfg *config.Config,
	notifier services.NotificationDispatcher,
	brandID string,
	items []NewProductAlertItem,
) {
	if db.Pool == nil || !isValidUUIDString(brandID) || len(items) == 0 {
		return
	}
	if notifier == nil {
		notifier = services.NewPostgresNotificationDispatcher(db.Pool)
	}

	copied := append([]NewProductAlertItem(nil), items...)
	safe.Go("Favorite Supplier New Product Notify", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		var brandName, brandSlug string
		if bErr := db.Pool.QueryRow(ctx, `
			SELECT brand_name, COALESCE(slug, id::text)
			FROM catalog.brands
			WHERE id = $1::uuid AND is_active = true
		`, brandID).Scan(&brandName, &brandSlug); bErr != nil {
			return
		}

		rows, err := db.Pool.Query(ctx, `
			SELECT f.user_id,
			       COALESCE(NULLIF(u.preferred_lang, ''), 'tr'),
			       COALESCE(u.email, ''),
			       COALESCE(u.email_verified, false),
			       f.notify_via_email
			FROM catalog.customer_favorite_suppliers f
			JOIN identity.users u ON u.id = f.user_id
			WHERE f.brand_id = $1::uuid
			  AND f.notify_new_products = true
			  AND COALESCE(u.is_active, true) = true
			  AND COALESCE(u.is_blocked, false) = false
		`, brandID)
		if err != nil {
			log.Printf("[FAVORITES NOTIFY] Query followers failed (brand=%s): %v", brandID, err)
			return
		}
		defer rows.Close()

		followers := make([]favoriteFollowerRow, 0)
		for rows.Next() {
			var f favoriteFollowerRow
			if scanErr := rows.Scan(&f.userID, &f.preferredLang, &f.email, &f.emailVerified, &f.notifyViaEmail); scanErr == nil {
				followers = append(followers, f)
			}
		}
		if len(followers) == 0 {
			return
		}

		first := copied[0]
		for _, follower := range followers {
			title, body, targetURL := BuildNewProductNotificationCopy(follower.preferredLang, brandName, brandSlug, copied)
			meta := map[string]any{
				"brand_id":      brandID,
				"brand_name":    brandName,
				"brand_slug":    brandSlug,
				"product_id":    first.ID,
				"product_slug":  first.Slug,
				"product_title": first.Title,
				"image_url":     first.ImageURL,
				"product_count": len(copied),
				"target_url":    targetURL,
			}
			notifier.NotifyUserAsync(follower.userID, "customer", title, body, notifTypeNewSupplierProd, meta)

			if follower.notifyViaEmail && follower.emailVerified && follower.email != "" && cfg != nil && cfg.SMTPHost != "" {
				fullLink := publicSiteBaseURL + targetURL
				htmlBody := fmt.Sprintf(
					`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e5e5;border-radius:12px;">
					<h2 style="margin:0 0 12px;color:#111111;">%s</h2>
					<p style="color:#444444;font-size:14px;line-height:1.5;">%s</p>
					<p style="margin-top:20px;"><a href="%s" style="display:inline-block;background:#111111;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Vitrinde İncele</a></p>
					</div>`,
					html.EscapeString(title),
					html.EscapeString(body),
					html.EscapeString(fullLink),
				)
				textBody := fmt.Sprintf("%s\n\n%s\n\n%s", title, body, fullLink)
				_ = mailer.SendRawMail(cfg, follower.email, title, htmlBody, textBody)
			}
		}
	})
}
