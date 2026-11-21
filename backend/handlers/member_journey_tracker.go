package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/safe"
)

var memberJourneySchemaOnce sync.Once

func ensureMemberActivitySchema(ctx context.Context) {
	if db.Pool == nil {
		return
	}
	memberJourneySchemaOnce.Do(func() {
		ddl := `
			CREATE SCHEMA IF NOT EXISTS analytics;

			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS user_id VARCHAR(128);
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS page_title VARCHAR(300);
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS duration_sec INT NOT NULL DEFAULT 0;

			CREATE INDEX IF NOT EXISTS idx_analytics_pv_user_created
				ON analytics.page_views (user_id, created_at DESC)
				WHERE user_id IS NOT NULL;

			CREATE TABLE IF NOT EXISTS analytics.user_visitor_links (
				user_id VARCHAR(128) NOT NULL,
				visitor_id VARCHAR(64) NOT NULL,
				first_linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (user_id, visitor_id)
			);

			CREATE INDEX IF NOT EXISTS idx_analytics_uvl_visitor ON analytics.user_visitor_links (visitor_id);

			CREATE TABLE IF NOT EXISTS analytics.member_events (
				id UUID PRIMARY KEY DEFAULT uuidv7(),
				user_id VARCHAR(128),
				visitor_id VARCHAR(64),
				session_id VARCHAR(64),
				event_type VARCHAR(50) NOT NULL,
				event_category VARCHAR(32) NOT NULL DEFAULT 'navigation',
				title VARCHAR(300) NOT NULL,
				subtitle VARCHAR(500),
				url_path VARCHAR(500),
				entity_type VARCHAR(40),
				entity_id VARCHAR(128),
				image_url TEXT,
				metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
				duration_sec INT NOT NULL DEFAULT 0,
				device_type VARCHAR(20) DEFAULT 'desktop',
				browser VARCHAR(50),
				os VARCHAR(50),
				country_code VARCHAR(10),
				ip_address VARCHAR(64),
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE INDEX IF NOT EXISTS idx_member_events_user_created
				ON analytics.member_events (user_id, created_at DESC)
				WHERE user_id IS NOT NULL;

			CREATE INDEX IF NOT EXISTS idx_member_events_visitor_created
				ON analytics.member_events (visitor_id, created_at DESC)
				WHERE visitor_id IS NOT NULL;

			CREATE INDEX IF NOT EXISTS idx_member_events_category_created
				ON analytics.member_events (event_category, created_at DESC);

			CREATE INDEX IF NOT EXISTS idx_member_events_created_at
				ON analytics.member_events (created_at DESC);
		`
		if _, err := db.Pool.Exec(ctx, ddl); err != nil {
			log.Printf("[MEMBER JOURNEY SCHEMA WARNING] Failed to ensure schema: %v", err)
		}
	})
}

// MemberActivityInput describes a rich member or visitor activity event to persist.
type MemberActivityInput struct {
	UserID        string
	VisitorID     string
	SessionID     string
	EventType     string
	EventCategory string
	Title         string
	Subtitle      string
	URLPath       string
	EntityType    string
	EntityID      string
	ImageURL      string
	Metadata      map[string]any
	DurationSec   int
	DeviceType    string
	Browser       string
	OS            string
	CountryCode   string
	IPAddress     string
}

// TrackMemberEventRequest is sent by storefront/mobile clients for rich actions (cart_add, page_dwell, search_click, etc.).
type TrackMemberEventRequest struct {
	VisitorID        string         `json:"visitor_id"`
	SessionID        string         `json:"session_id"`
	AuthToken        string         `json:"auth_token,omitempty"`
	EventType        string         `json:"event_type"`
	EventCategory    string         `json:"event_category,omitempty"`
	Title            string         `json:"title,omitempty"`
	Subtitle         string         `json:"subtitle,omitempty"`
	URLPath          string         `json:"url_path,omitempty"`
	EntityType       string         `json:"entity_type,omitempty"`
	EntityID         string         `json:"entity_id,omitempty"`
	ImageURL         string         `json:"image_url,omitempty"`
	DurationSec      int            `json:"duration_sec,omitempty"`
	ScrollDepthPct   int            `json:"scroll_depth_pct,omitempty"`
	LCPMs            int            `json:"lcp_ms,omitempty"`
	CLSScore         float64        `json:"cls_score,omitempty"`
	INPMs            int            `json:"inp_ms,omitempty"`
	TTFBMs           int            `json:"ttfb_ms,omitempty"`
	ScreenWidth      int            `json:"screen_width,omitempty"`
	Language         string         `json:"language,omitempty"`
	QueryText        string         `json:"query_text,omitempty"`
	CategorySlug     string         `json:"category_slug,omitempty"`
	ResultsCount     int            `json:"results_count,omitempty"`
	HasFilters       bool           `json:"has_filters,omitempty"`
	ClickedProductID string         `json:"clicked_product_id,omitempty"`
	Metadata         map[string]any `json:"metadata,omitempty"`
}

// TrackSearchEventRequest represents a dedicated search result or search click payload.
type TrackSearchEventRequest struct {
	VisitorID        string `json:"visitor_id"`
	SessionID        string `json:"session_id"`
	AuthToken        string `json:"auth_token,omitempty"`
	EventType        string `json:"event_type,omitempty"` // "search_result" or "search_click"
	QueryText        string `json:"query_text"`
	Language         string `json:"language,omitempty"`
	CountryCode      string `json:"country_code,omitempty"`
	CategorySlug     string `json:"category_slug,omitempty"`
	ResultsCount     int    `json:"results_count,omitempty"`
	HasFilters       bool   `json:"has_filters,omitempty"`
	ClickedProductID string `json:"clicked_product_id,omitempty"`
}

type dwellUpdateInput struct {
	VisitorID      string
	UserID         string
	URLPath        string
	DurationSec    int
	ScrollDepthPct int
	LCPMs          int
	CLSScore       float64
	INPMs          int
	TTFBMs         int
}

type searchLogEntry struct {
	VisitorID        string
	SessionID        string
	UserID           string
	QueryText        string
	LanguageCode     string
	CountryCode      string
	CategorySlug     string
	ResultsCount     int
	HasFilters       bool
	ClickedProductID string
}

var supportedLangSegments = map[string]bool{
	"tr": true, "en": true, "ru": true, "ar": true,
	"de": true, "fr": true, "pl": true, "bg": true,
}

const (
	labelAboutUsPage       = "Hakkımızda"
	labelPrivacyPolicyPage = "Gizlilik Politikası"
	eventTypeSearchClick   = "search_click"
	eventTypeSearchResult  = "search_result"
)

var knownPageSlugLabels = map[string]string{
	"hakkimizda":                labelAboutUsPage,
	"about":                     labelAboutUsPage,
	"about-us":                  labelAboutUsPage,
	"kurumsal":                  "Kurumsal Tanıtım",
	"vizyon-misyon":             "Vizyon & Misyon",
	"kvkk":                      "KVKK Aydınlatma Metni",
	"gizlilik-politikasi":       labelPrivacyPolicyPage,
	"privacy-policy":            labelPrivacyPolicyPage,
	"kullanim-kosullari":        "Kullanım Koşulları",
	"mesafeli-satis-sozlesmesi": "Mesafeli Satış Sözleşmesi",
	"iade-degisim":              "İade & Değişim Koşulları",
	"kargo-teslimat":            "Kargo & Uluslararası Teslimat",
	"toptan-satis-rehberi":      "Toptan Satış Rehberi",
	"ihracat-rehberi":           "İhracat & Gümrük Rehberi",
}

func writeAnalyticsIgnoredJSON(w http.ResponseWriter) {
	w.Header().Set(headerContentType, mimeApplicationJSON)
	_, _ = w.Write([]byte(jsonIgnoredOK))
}

func isImpersonatedAnalyticsRequest(r *http.Request, bodyAuthToken string) bool {
	if r != nil {
		if authHdr := strings.TrimSpace(r.Header.Get("Authorization")); authHdr != "" {
			if imp, _ := isImpersonatedToken(authHdr); imp {
				return true
			}
		}
	}
	tok := strings.TrimSpace(bodyAuthToken)
	if tok != "" {
		if !strings.HasPrefix(tok, authBearerPrefix) {
			tok = authBearerPrefix + tok
		}
		if imp, _ := isImpersonatedToken(tok); imp {
			return true
		}
	}
	return false
}

func resolveAuthenticatedMemberID(r *http.Request, bodyAuthToken string) string {
	if isImpersonatedAnalyticsRequest(r, bodyAuthToken) {
		return ""
	}
	if r != nil {
		if authHdr := strings.TrimSpace(r.Header.Get("Authorization")); authHdr != "" {
			if uid, err := verifyTokenAndGetUserID(authHdr); err == nil && uid != "" {
				return uid
			}
		}
	}
	bodyAuthToken = strings.TrimSpace(bodyAuthToken)
	if bodyAuthToken != "" {
		if !strings.HasPrefix(bodyAuthToken, authBearerPrefix) {
			bodyAuthToken = authBearerPrefix + bodyAuthToken
		}
		if uid, err := verifyTokenAndGetUserID(bodyAuthToken); err == nil && uid != "" {
			return uid
		}
	}
	return ""
}

// StitchVisitorToMember links a browser visitor_id to a registered user_id and backfills pre-signup events.
func StitchVisitorToMember(ctx context.Context, userID, visitorID string) {
	userID = strings.TrimSpace(userID)
	visitorID = strings.TrimSpace(visitorID)
	if db.Pool == nil || userID == "" || visitorID == "" {
		return
	}
	ensureAnalyticsSchema(ctx)

	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO analytics.user_visitor_links (user_id, visitor_id, first_linked_at, last_seen_at)
		VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id, visitor_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP
	`, userID, visitorID)

	_, _ = db.Pool.Exec(ctx, `
		UPDATE analytics.page_views
		SET user_id = $1
		WHERE visitor_id = $2 AND (user_id IS NULL OR user_id = '')
	`, userID, visitorID)

	_, _ = db.Pool.Exec(ctx, `
		UPDATE analytics.member_events
		SET user_id = $1
		WHERE visitor_id = $2 AND (user_id IS NULL OR user_id = '')
	`, userID, visitorID)

	_, _ = db.Pool.Exec(ctx, `
		UPDATE analytics.search_logs
		SET user_id = $1
		WHERE visitor_id = $2 AND (user_id IS NULL OR user_id = '')
	`, userID, visitorID)

	_, _ = db.Pool.Exec(ctx, `
		UPDATE analytics.whatsapp_clicks
		SET user_id = $1
		WHERE visitor_id = $2 AND (user_id IS NULL OR user_id = '')
	`, userID, visitorID)
}

func lookupLinkedUserByVisitor(ctx context.Context, visitorID string) string {
	visitorID = strings.TrimSpace(visitorID)
	if db.Pool == nil || visitorID == "" {
		return ""
	}
	var uid string
	_ = db.Pool.QueryRow(ctx, `
		SELECT user_id FROM analytics.user_visitor_links
		WHERE visitor_id = $1
		ORDER BY last_seen_at DESC
		LIMIT 1
	`, visitorID).Scan(&uid)
	return uid
}

// RecordMemberActivityAsync enriches request metadata and writes a member activity event asynchronously.
func RecordMemberActivityAsync(r *http.Request, input MemberActivityInput) {
	if isSSRPrefetchRequest(r) || isImpersonatedAnalyticsRequest(r, "") {
		return
	}
	var ua, ip, countryCode, visitorHeader string
	if r != nil {
		ua = r.UserAgent()
		if isBot, _ := classifyVisitorBot(r, ua); isBot {
			return
		}
		ip = getClientIP(r)
		countryCode, _ = resolveVisitorCountryAndLang(r, input.CountryCode, "")
		visitorHeader = strings.TrimSpace(r.Header.Get(headerVisitorID))
	}
	if input.VisitorID == "" && visitorHeader != "" {
		input.VisitorID = visitorHeader
	}
	if input.IPAddress == "" {
		input.IPAddress = ip
	}
	if input.CountryCode == "" {
		input.CountryCode = countryCode
	}
	if ua != "" {
		dev, br, osName := parseDeviceAndBrowser(ua, 0)
		if input.DeviceType == "" {
			input.DeviceType = dev
		}
		if input.Browser == "" {
			input.Browser = br
		}
		if input.OS == "" {
			input.OS = osName
		}
	}

	safe.Go("Record Member Activity", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		persistMemberActivity(ctx, input)
	})
}

func persistMemberActivity(ctx context.Context, in MemberActivityInput) {
	if db.Pool == nil || strings.TrimSpace(in.EventType) == "" || strings.TrimSpace(in.Title) == "" {
		return
	}
	ensureMemberActivitySchema(ctx)

	if in.UserID != "" && in.VisitorID != "" {
		StitchVisitorToMember(ctx, in.UserID, in.VisitorID)
	} else if in.UserID == "" && in.VisitorID != "" {
		in.UserID = lookupLinkedUserByVisitor(ctx, in.VisitorID)
	}

	cat := strings.TrimSpace(in.EventCategory)
	if cat == "" {
		cat = defaultCategoryForEventType(in.EventType)
	}

	metaBytes := []byte("{}")
	if len(in.Metadata) > 0 {
		if b, err := json.Marshal(in.Metadata); err == nil {
			metaBytes = b
		}
	}

	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO analytics.member_events (
			user_id, visitor_id, session_id, event_type, event_category,
			title, subtitle, url_path, entity_type, entity_id, image_url,
			metadata, duration_sec, device_type, browser, os, country_code, ip_address
		) VALUES (
			NULLIF($1, ''), NULLIF($2, ''), NULLIF($3, ''), $4, $5,
			$6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''),
			$12::jsonb, $13, COALESCE(NULLIF($14, ''), 'desktop'), NULLIF($15, ''), NULLIF($16, ''), NULLIF($17, ''), NULLIF($18, '')
		)
	`,
		truncateStr(in.UserID, 128),
		truncateStr(in.VisitorID, 64),
		truncateStr(in.SessionID, 64),
		truncateStr(in.EventType, 50),
		truncateStr(cat, 32),
		truncateStr(in.Title, 300),
		truncateStr(in.Subtitle, 500),
		truncateStr(in.URLPath, 500),
		truncateStr(in.EntityType, 40),
		truncateStr(in.EntityID, 128),
		in.ImageURL,
		string(metaBytes),
		in.DurationSec,
		truncateStr(in.DeviceType, 20),
		truncateStr(in.Browser, 50),
		truncateStr(in.OS, 50),
		truncateStr(in.CountryCode, 10),
		truncateStr(in.IPAddress, 64),
	)
}

func truncateStr(val string, maxLen int) string {
	val = strings.TrimSpace(val)
	if len(val) > maxLen {
		return val[:maxLen]
	}
	return val
}

func defaultCategoryForEventType(eventType string) string {
	switch eventType {
	case "register", "login", "email_verified", "profile_update", "address_update":
		return "auth"
	case "cms_read", "blog_read", "faq_read", "contact_view", "b2b_guide_read":
		return "content"
	case "product_view", "brand_view", "category_view", "search_query", "wishlist_add", "wishlist_remove":
		return "catalog"
	case "whatsapp_click", "phone_click", "email_click", "website_click", "chat_start", "chat_message", "rfq_create":
		return "engagement"
	case "cart_add", "cart_remove", "cart_excel_export", "inquiry_submit", "order_create", "payment_notify", "pack_calc", "price_unlock":
		return "commerce"
	default:
		return "navigation"
	}
}

type resolvedPathActivity struct {
	EventType     string
	EventCategory string
	Title         string
	Subtitle      string
	EntityType    string
	EntityID      string
	ImageURL      string
}

func stripLangPrefixSegments(rawPath string) []string {
	cleanPath := rawPath
	if idx := strings.Index(cleanPath, "?"); idx >= 0 {
		cleanPath = cleanPath[:idx]
	}
	rawSegs := strings.Split(strings.Trim(cleanPath, "/"), "/")
	var segs []string
	for _, s := range rawSegs {
		if s != "" {
			segs = append(segs, s)
		}
	}
	if len(segs) > 0 && supportedLangSegments[strings.ToLower(segs[0])] {
		segs = segs[1:]
	}
	return segs
}

func extractSearchTermFromPath(rawPath, rawURL string) string {
	for _, candidate := range []string{rawPath, rawURL} {
		if u, err := url.Parse(candidate); err == nil {
			q := u.Query()
			for _, key := range []string{"q", "search", "query", "s"} {
				if v := strings.TrimSpace(q.Get(key)); v != "" {
					return v
				}
			}
		}
	}
	return ""
}

func resolveProductPathActivity(ctx context.Context, slug string) (resolvedPathActivity, bool) {
	var id, title, customSKU, brandName, imgURL, currency string
	var price float64
	err := db.Pool.QueryRow(ctx, `
		SELECT p.id::text, p.title, COALESCE(p.custom_sku, ''), COALESCE(b.brand_name, ''),
		       p.price, COALESCE(p.currency, 'TRY'),
		       COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1), '')
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON p.brand_id = b.id
		WHERE p.id::text = $1 OR p.slug_id = $1 OR p.slug = $1
		LIMIT 1
	`, slug).Scan(&id, &title, &customSKU, &brandName, &price, &currency, &imgURL)
	if err != nil || id == "" {
		return resolvedPathActivity{}, false
	}
	subParts := []string{}
	if customSKU != "" {
		subParts = append(subParts, "SKU: "+customSKU)
	}
	if brandName != "" {
		subParts = append(subParts, "Üretici: "+brandName)
	}
	if price > 0 {
		subParts = append(subParts, fmt.Sprintf("%.2f %s", price, currency))
	}
	return resolvedPathActivity{
		EventType:     "product_view",
		EventCategory: "catalog",
		Title:         fmt.Sprintf("“%s” ürününe göz attı", title),
		Subtitle:      strings.Join(subParts, " • "),
		EntityType:    "product",
		EntityID:      id,
		ImageURL:      imgURL,
	}, true
}

func resolveBrandPathActivity(ctx context.Context, slug string, isIntro bool) (resolvedPathActivity, bool) {
	var id, brandName string
	err := db.Pool.QueryRow(ctx, `
		SELECT id::text, brand_name FROM catalog.brands
		WHERE slug = $1 OR id::text = $1
		LIMIT 1
	`, slug).Scan(&id, &brandName)
	if err != nil || id == "" {
		return resolvedPathActivity{}, false
	}
	actionLabel := "üretici vitrinini inceledi"
	if isIntro {
		actionLabel = "firma tanıtım & hakkımızda sayfasını okudu"
	}
	return resolvedPathActivity{
		EventType:     "brand_view",
		EventCategory: "catalog",
		Title:         fmt.Sprintf("“%s” %s", brandName, actionLabel),
		Subtitle:      "Tedarikçi Mağazası",
		EntityType:    "brand",
		EntityID:      id,
	}, true
}

func resolveCmsPagePathActivity(ctx context.Context, slug string) resolvedPathActivity {
	cleanSlug := strings.ToLower(strings.TrimSpace(slug))
	var pageID, pageTitle string
	_ = db.Pool.QueryRow(ctx, `
		SELECT p.id::text,
		       COALESCE(
		           (SELECT pt.title FROM catalog.page_translations pt WHERE pt.page_id = p.id AND pt.language_code = 'tr' LIMIT 1),
		           (SELECT pt.title FROM catalog.page_translations pt WHERE pt.page_id = p.id LIMIT 1),
		           ''
		       )
		FROM catalog.pages p
		WHERE LOWER(p.slug) = $1
		LIMIT 1
	`, cleanSlug).Scan(&pageID, &pageTitle)

	if pageTitle == "" {
		if known, ok := knownPageSlugLabels[cleanSlug]; ok {
			pageTitle = known
		} else {
			pageTitle = humanizeSlug(cleanSlug)
		}
	}
	return resolvedPathActivity{
		EventType:     "cms_read",
		EventCategory: "content",
		Title:         fmt.Sprintf("“%s” sayfasını okudu", pageTitle),
		Subtitle:      "Kurumsal & Bilgilendirme Sayfası",
		EntityType:    "page",
		EntityID:      firstNonEmptyStr(pageID, cleanSlug),
	}
}

func resolveBlogPathActivity(ctx context.Context, slug string) resolvedPathActivity {
	cleanSlug := strings.ToLower(strings.TrimSpace(slug))
	var postID, postTitle, coverImg string
	_ = db.Pool.QueryRow(ctx, `
		SELECT bp.id::text,
		       COALESCE(
		           (SELECT bt.title FROM catalog.blog_post_translations bt WHERE bt.post_id = bp.id AND bt.language_code = 'tr' LIMIT 1),
		           (SELECT bt.title FROM catalog.blog_post_translations bt WHERE bt.post_id = bp.id LIMIT 1),
		           ''
		       ),
		       COALESCE(bp.cover_image, '')
		FROM catalog.blog_posts bp
		WHERE LOWER(bp.slug) = $1
		LIMIT 1
	`, cleanSlug).Scan(&postID, &postTitle, &coverImg)

	if postTitle == "" {
		postTitle = humanizeSlug(cleanSlug)
	}
	return resolvedPathActivity{
		EventType:     "blog_read",
		EventCategory: "content",
		Title:         fmt.Sprintf("“%s” blog yazısını okudu", postTitle),
		Subtitle:      "B2B Rehber & Blog Makalesi",
		EntityType:    "blog",
		EntityID:      firstNonEmptyStr(postID, cleanSlug),
		ImageURL:      coverImg,
	}
}

func resolveStaticStoreRoute(firstSeg string) (resolvedPathActivity, bool) {
	switch strings.ToLower(firstSeg) {
	case "contact", "iletisim":
		return resolvedPathActivity{EventType: "contact_view", EventCategory: "content", Title: "İletişim & Showroom adres sayfasını inceledi", Subtitle: "Kurumsal İletişim", EntityType: "page", EntityID: "contact"}, true
	case "faq", "sss":
		return resolvedPathActivity{EventType: "faq_read", EventCategory: "content", Title: "Sıkça Sorulan Sorular (SSS) sayfasını okudu", Subtitle: "Yardım & B2B SSS", EntityType: "page", EntityID: "faq"}, true
	case "b2b":
		return resolvedPathActivity{EventType: "b2b_guide_read", EventCategory: "content", Title: "Toptan Alım & B2B Çalışma Modeli sayfasını okudu", Subtitle: "B2B Bilgilendirme", EntityType: "page", EntityID: "b2b"}, true
	case "cart", "sepet":
		return resolvedPathActivity{EventType: "page_view", EventCategory: "commerce", Title: "Sepet & Sipariş Özeti sayfasını açtı", Subtitle: "Toptan Sepet", EntityType: "cart", EntityID: "cart"}, true
	case "profile":
		return resolvedPathActivity{EventType: "page_view", EventCategory: "auth", Title: "Hesabım & Siparişlerim sayfasında gezindi", Subtitle: "Üye Paneli", EntityType: "profile", EntityID: "profile"}, true
	case "ureticiler":
		return resolvedPathActivity{EventType: "page_view", EventCategory: "catalog", Title: "Üretici & Toptancı Firmalar dizinini inceledi", Subtitle: "Açık Firma Vitrini", EntityType: "brand_directory", EntityID: "ureticiler"}, true
	case "alim-talepleri":
		return resolvedPathActivity{EventType: "page_view", EventCategory: "engagement", Title: "Alıcı Talep Panosu (RFQ) ilanlarını inceledi", Subtitle: "Toptan Alım Talepleri", EntityType: "rfq_board", EntityID: "alim-talepleri"}, true
	case "hizmet-saglayicilar":
		return resolvedPathActivity{EventType: "page_view", EventCategory: "content", Title: "Sektörel Hizmet Sağlayıcılar (Kargo/Gümrük) rehberini okudu", Subtitle: "Lojistik & Hizmet Rehberi", EntityType: "page", EntityID: "hizmet-saglayicilar"}, true
	case "tedarikci-basvuru":
		return resolvedPathActivity{EventType: "page_view", EventCategory: "content", Title: "Tedarikçi Başvuru sayfasını inceledi", Subtitle: "Üretici Katılım Formu", EntityType: "page", EntityID: "tedarikci-basvuru"}, true
	case "mobil-uygulama", "apk":
		return resolvedPathActivity{EventType: "page_view", EventCategory: "content", Title: "Mobil Uygulama tanıtım & indirme sayfasını inceledi", Subtitle: "Merter Vitrini Mobil", EntityType: "page", EntityID: "mobil-uygulama"}, true
	case "tum-urunler":
		return resolvedPathActivity{EventType: "category_view", EventCategory: "catalog", Title: "Tüm Ürünler kataloğunda gezindi", Subtitle: "Genel Toptan Katalog", EntityType: "category", EntityID: "tum-urunler"}, true
	case "yeni-urunler":
		return resolvedPathActivity{EventType: "category_view", EventCategory: "catalog", Title: "Yeni Ürünler (Son 7 Gün) bölümünde gezindi", Subtitle: "Son 7 Gün Yeni Eklenenler", EntityType: "category", EntityID: "yeni-urunler"}, true
	case "blog":
		return resolvedPathActivity{EventType: "blog_read", EventCategory: "content", Title: "B2B Blog & Tekstil Rehberleri listesine göz attı", Subtitle: "Blog Dizini", EntityType: "blog", EntityID: "blog-index"}, true
	case "site-haritasi":
		return resolvedPathActivity{EventType: "page_view", EventCategory: "navigation", Title: "Site Haritası sayfasına göz attı", EntityType: "page", EntityID: "site-haritasi"}, true
	}
	return resolvedPathActivity{}, false
}

func resolveCategoryPathActivity(ctx context.Context, segs []string, fallbackTitle string) resolvedPathActivity {
	lastSlug := strings.ToLower(segs[len(segs)-1])
	var catID, catTitle string
	_ = db.Pool.QueryRow(ctx, `
		SELECT c.id::text, c.title
		FROM catalog.categories c
		WHERE LOWER(c.slug) = $1
		LIMIT 1
	`, lastSlug).Scan(&catID, &catTitle)

	if catTitle != "" {
		return resolvedPathActivity{
			EventType:     "category_view",
			EventCategory: "catalog",
			Title:         fmt.Sprintf("“%s” kategorisinde gezindi", catTitle),
			Subtitle:      "/" + strings.Join(segs, "/"),
			EntityType:    "category",
			EntityID:      catID,
		}
	}
	if known, ok := knownPageSlugLabels[lastSlug]; ok {
		return resolvedPathActivity{
			EventType:     "cms_read",
			EventCategory: "content",
			Title:         fmt.Sprintf("“%s” sayfasını okudu", known),
			Subtitle:      "Kurumsal Sayfa",
			EntityType:    "page",
			EntityID:      lastSlug,
		}
	}
	cleanTitle := cleanDocumentTitle(fallbackTitle)
	if cleanTitle != "" {
		return resolvedPathActivity{
			EventType:     "page_view",
			EventCategory: "navigation",
			Title:         fmt.Sprintf("“%s” sayfasında gezindi", cleanTitle),
			Subtitle:      "/" + strings.Join(segs, "/"),
		}
	}
	return resolvedPathActivity{
		EventType:     "page_view",
		EventCategory: "navigation",
		Title:         fmt.Sprintf("/%s sayfasında gezindi", strings.Join(segs, "/")),
	}
}

func humanizeSlug(slug string) string {
	words := strings.Fields(strings.ReplaceAll(slug, "-", " "))
	for i, w := range words {
		runes := []rune(w)
		if len(runes) > 0 {
			first := strings.ToUpper(string(runes[0]))
			words[i] = first + string(runes[1:])
		}
	}
	return strings.Join(words, " ")
}

func cleanDocumentTitle(raw string) string {
	raw = strings.TrimSpace(raw)
	if idx := strings.Index(raw, "|"); idx > 0 {
		raw = strings.TrimSpace(raw[:idx])
	}
	return raw
}

func firstNonEmptyStr(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func resolveStorePathActivity(ctx context.Context, rawPath, rawURL, pageTitle, referrerHost string) resolvedPathActivity {
	if searchTerm := extractSearchTermFromPath(rawPath, rawURL); searchTerm != "" {
		return resolvedPathActivity{
			EventType:     "search_query",
			EventCategory: "catalog",
			Title:         fmt.Sprintf("“%s” için ürün araması yaptı", searchTerm),
			Subtitle:      rawPath,
			EntityType:    "search",
			EntityID:      searchTerm,
		}
	}

	segs := stripLangPrefixSegments(rawPath)
	if len(segs) == 0 {
		return buildHomePageActivity(referrerHost)
	}
	if len(segs) >= 2 {
		if act, ok := resolveSegmentedStoreRoute(ctx, segs); ok {
			return act
		}
	}
	if len(segs) == 1 {
		if staticAct, ok := resolveStaticStoreRoute(segs[0]); ok {
			return staticAct
		}
	}

	return resolveCategoryPathActivity(ctx, segs, pageTitle)
}

func buildHomePageActivity(referrerHost string) resolvedPathActivity {
	sub := ""
	if referrerHost != "" && referrerHost != directReferrerLabel {
		sub = "Kaynak: " + referrerHost
	}
	return resolvedPathActivity{
		EventType:     "page_view",
		EventCategory: "navigation",
		Title:         "Ana Sayfa vitrininde gezindi",
		Subtitle:      sub,
		EntityType:    "page",
		EntityID:      "home",
	}
}

func resolveSegmentedStoreRoute(ctx context.Context, segs []string) (resolvedPathActivity, bool) {
	switch strings.ToLower(segs[0]) {
	case "product":
		return resolveProductPathActivity(ctx, segs[1])
	case "ureticiler":
		isIntro := len(segs) >= 3 && strings.EqualFold(segs[2], "tanitim")
		return resolveBrandPathActivity(ctx, segs[1], isIntro)
	case "pages":
		return resolveCmsPagePathActivity(ctx, segs[1]), true
	case "blog":
		return resolveBlogPathActivity(ctx, segs[1]), true
	default:
		return resolvedPathActivity{}, false
	}
}

func hasDwellOrVitalsPayload(req *TrackMemberEventRequest) bool {
	return req.DurationSec > 0 ||
		req.ScrollDepthPct > 0 ||
		req.LCPMs > 0 ||
		req.CLSScore > 0 ||
		req.INPMs > 0 ||
		req.TTFBMs > 0
}

// TrackMemberEvent handles POST /api/v1/store/member-events for rich storefront actions (cart_add, page_dwell, search_click, etc.).
func (h *AnalyticsHandler) TrackMemberEvent(w http.ResponseWriter, r *http.Request) {
	setAnalyticsCORSHeaders(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if isSSRPrefetchRequest(r) {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_, _ = w.Write([]byte(jsonIgnoredOK))
		return
	}
	if isBot, _ := classifyVisitorBot(r, r.UserAgent()); isBot {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_, _ = w.Write([]byte(jsonIgnoredOK))
		return
	}

	var req TrackMemberEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, errJSONInvalidJSON, http.StatusBadRequest)
		return
	}

	if isImpersonatedAnalyticsRequest(r, req.AuthToken) {
		writeAnalyticsIgnoredJSON(w)
		return
	}

	userID := resolveAuthenticatedMemberID(r, req.AuthToken)
	ip := getClientIP(r)
	visitorID := firstNonEmptyStr(req.VisitorID, r.Header.Get(headerVisitorID), hashIP(ip))
	sessionID := firstNonEmptyStr(req.SessionID, visitorID)
	countryCode, langCode := resolveVisitorCountryAndLang(r, "", req.Language)

	if req.EventType == "page_dwell" || req.EventType == "web_vitals" {
		if req.URLPath != "" && hasDwellOrVitalsPayload(&req) {
			in := dwellUpdateInput{
				VisitorID:      visitorID,
				UserID:         userID,
				URLPath:        req.URLPath,
				DurationSec:    req.DurationSec,
				ScrollDepthPct: req.ScrollDepthPct,
				LCPMs:          req.LCPMs,
				CLSScore:       req.CLSScore,
				INPMs:          req.INPMs,
				TTFBMs:         req.TTFBMs,
			}
			safe.Go("Update Page Dwell & Web Vitals", func() {
				updateLatestPageDwell(in)
			})
		}
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_, _ = w.Write([]byte(jsonOK))
		return
	}

	if req.EventType == eventTypeSearchResult || req.EventType == eventTypeSearchClick {
		dispatchMemberSearchEvent(&req, visitorID, sessionID, userID, langCode, countryCode)
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_, _ = w.Write([]byte(jsonOK))
		return
	}

	deviceType, browser, osName := parseDeviceAndBrowser(r.UserAgent(), req.ScreenWidth)
	title := firstNonEmptyStr(req.Title, fallbackEventTitle(req.EventType, req.Subtitle))

	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        userID,
		VisitorID:     visitorID,
		SessionID:     sessionID,
		EventType:     req.EventType,
		EventCategory: req.EventCategory,
		Title:         title,
		Subtitle:      req.Subtitle,
		URLPath:       req.URLPath,
		EntityType:    req.EntityType,
		EntityID:      req.EntityID,
		ImageURL:      req.ImageURL,
		Metadata:      req.Metadata,
		DurationSec:   req.DurationSec,
		DeviceType:    deviceType,
		Browser:       browser,
		OS:            osName,
		CountryCode:   countryCode,
		IPAddress:     ip,
	})

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_, _ = w.Write([]byte(jsonOK))
}

func extractMetaStr(meta map[string]any, key string) string {
	if meta == nil {
		return ""
	}
	if raw, ok := meta[key]; ok {
		if s, okStr := raw.(string); okStr {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func dispatchMemberSearchEvent(req *TrackMemberEventRequest, visitorID, sessionID, userID, langCode, countryCode string) {
	queryText := firstNonEmptyStr(req.QueryText, extractMetaStr(req.Metadata, "query"), req.Subtitle)
	clickedProd := firstNonEmptyStr(req.ClickedProductID, extractMetaStr(req.Metadata, "product_id"), req.EntityID)
	catSlug := firstNonEmptyStr(req.CategorySlug, extractMetaStr(req.Metadata, "category_slug"))

	entry := searchLogEntry{
		VisitorID:        visitorID,
		SessionID:        sessionID,
		UserID:           userID,
		QueryText:        queryText,
		LanguageCode:     langCode,
		CountryCode:      countryCode,
		CategorySlug:     catSlug,
		ResultsCount:     req.ResultsCount,
		HasFilters:       req.HasFilters,
		ClickedProductID: clickedProd,
	}

	if req.EventType == eventTypeSearchClick {
		safe.Go("Persist Search Click", func() {
			persistSearchClick(entry)
		})
		return
	}
	safe.Go("Persist Search Log", func() {
		persistSearchLogEntry(entry)
	})
}

// TrackSearchClick handles POST /api/v1/store/search-events for storefront search result & click telemetry.
func (h *AnalyticsHandler) TrackSearchClick(w http.ResponseWriter, r *http.Request) {
	setAnalyticsCORSHeaders(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}
	if isSSRPrefetchRequest(r) {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_, _ = w.Write([]byte(jsonIgnoredOK))
		return
	}
	if isBot, _ := classifyVisitorBot(r, r.UserAgent()); isBot {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_, _ = w.Write([]byte(jsonIgnoredOK))
		return
	}

	var req TrackSearchEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, errJSONInvalidJSON, http.StatusBadRequest)
		return
	}

	ip := getClientIP(r)
	userID := resolveAuthenticatedMemberID(r, req.AuthToken)
	visitorID := firstNonEmptyStr(req.VisitorID, r.Header.Get(headerVisitorID), hashIP(ip))
	sessionID := firstNonEmptyStr(req.SessionID, visitorID)
	countryCode, langCode := resolveVisitorCountryAndLang(r, req.CountryCode, req.Language)

	entry := searchLogEntry{
		VisitorID:        visitorID,
		SessionID:        sessionID,
		UserID:           userID,
		QueryText:        req.QueryText,
		LanguageCode:     langCode,
		CountryCode:      countryCode,
		CategorySlug:     req.CategorySlug,
		ResultsCount:     req.ResultsCount,
		HasFilters:       req.HasFilters,
		ClickedProductID: req.ClickedProductID,
	}

	if req.EventType == eventTypeSearchClick || strings.TrimSpace(req.ClickedProductID) != "" {
		safe.Go("Persist Search Click Endpoint", func() {
			persistSearchClick(entry)
		})
	} else {
		safe.Go("Persist Search Result Endpoint", func() {
			persistSearchLogEntry(entry)
		})
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_, _ = w.Write([]byte(jsonOK))
}

func normalizeSearchQuery(raw string) string {
	fields := strings.Fields(strings.ToLower(strings.TrimSpace(raw)))
	return truncateStr(strings.Join(fields, " "), 250)
}

func recordStoreSearchLogAsync(r *http.Request, entry searchLogEntry) {
	if isSSRPrefetchRequest(r) {
		return
	}
	if r != nil {
		if isBot, _ := classifyVisitorBot(r, r.UserAgent()); isBot {
			return
		}
		if entry.VisitorID == "" {
			entry.VisitorID = firstNonEmptyStr(r.Header.Get(headerVisitorID), hashIP(getClientIP(r)))
		}
		if entry.SessionID == "" {
			entry.SessionID = entry.VisitorID
		}
		if entry.UserID == "" {
			entry.UserID = resolveAuthenticatedMemberID(r, "")
		}
		country, lang := resolveVisitorCountryAndLang(r, entry.CountryCode, entry.LanguageCode)
		entry.CountryCode = country
		entry.LanguageCode = lang
	}

	safe.Go("Record Storefront Search Log", func() {
		persistSearchLogEntry(entry)
	})
}

func persistSearchLogEntry(entry searchLogEntry) {
	if db.Pool == nil {
		return
	}
	norm := normalizeSearchQuery(entry.QueryText)
	if len(norm) < 2 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	ensureAnalyticsSchema(ctx)

	effectiveUserID := entry.UserID
	if effectiveUserID == "" && entry.VisitorID != "" {
		effectiveUserID = lookupLinkedUserByVisitor(ctx, entry.VisitorID)
	}

	var recentDuplicate bool
	_ = db.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM analytics.search_logs
			WHERE visitor_id = $1 AND normalized_query = $2
			  AND created_at >= NOW() - INTERVAL '5 seconds'
		)
	`, truncateStr(entry.VisitorID, 64), norm).Scan(&recentDuplicate)
	if recentDuplicate {
		return
	}

	resultsCount := entry.ResultsCount
	if resultsCount < 0 {
		resultsCount = 0
	}
	isZeroResult := resultsCount == 0

	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO analytics.search_logs (
			visitor_id, session_id, user_id, query_text, normalized_query,
			language_code, country_code, category_slug, results_count, is_zero_result, has_filters, clicked_product_id
		) VALUES (
			$1, $2, NULLIF($3, ''), $4, $5,
			$6, $7, $8, $9, $10, $11, NULLIF($12, '')
		)
	`,
		truncateStr(entry.VisitorID, 64),
		truncateStr(entry.SessionID, 64),
		truncateStr(effectiveUserID, 128),
		truncateStr(entry.QueryText, 250),
		norm,
		firstNonEmptyStr(truncateStr(entry.LanguageCode, 10), defaultLangTR),
		truncateStr(entry.CountryCode, 10),
		truncateStr(entry.CategorySlug, 160),
		resultsCount,
		isZeroResult,
		entry.HasFilters,
		truncateStr(entry.ClickedProductID, 64),
	)
}

func persistSearchClick(entry searchLogEntry) {
	clickedID := truncateStr(entry.ClickedProductID, 64)
	if db.Pool == nil || clickedID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	ensureAnalyticsSchema(ctx)

	norm := normalizeSearchQuery(entry.QueryText)
	visitorID := truncateStr(entry.VisitorID, 64)
	sessionID := truncateStr(entry.SessionID, 64)

	tag, err := db.Pool.Exec(ctx, `
		UPDATE analytics.search_logs
		SET clicked_product_id = $1
		WHERE id = (
			SELECT id FROM analytics.search_logs
			WHERE (visitor_id = $2 OR ($3 <> '' AND session_id = $3))
			  AND ($4 = '' OR normalized_query = $4)
			  AND created_at >= NOW() - INTERVAL '30 minutes'
			ORDER BY created_at DESC
			LIMIT 1
		)
	`, clickedID, visitorID, sessionID, norm)
	if err == nil && tag.RowsAffected() > 0 {
		return
	}
	if norm != "" {
		persistSearchLogEntry(entry)
	}
}

func clampIntRange(val, minVal, maxVal int) int {
	if val < minVal {
		return minVal
	}
	if val > maxVal {
		return maxVal
	}
	return val
}

const (
	maxValidLCPMs    = 30000
	maxValidINPMs    = 5000
	maxValidTTFBMs   = 15000
	maxValidCLSScore = 5.0
)

func sanitizeVitalMs(val, maxAllowed int) int {
	if val <= 0 || val > maxAllowed {
		return 0
	}
	return val
}

func sanitizeVitalFloat(val, maxAllowed float64) float64 {
	if val <= 0 || val > maxAllowed {
		return 0
	}
	return val
}

func updateLatestPageDwell(in dwellUpdateInput) {
	if db.Pool == nil || strings.TrimSpace(in.URLPath) == "" {
		return
	}
	durationSec := clampIntRange(in.DurationSec, 0, 3600)
	scrollPct := clampIntRange(in.ScrollDepthPct, 0, 100)
	lcpMs := sanitizeVitalMs(in.LCPMs, maxValidLCPMs)
	inpMs := sanitizeVitalMs(in.INPMs, maxValidINPMs)
	ttfbMs := sanitizeVitalMs(in.TTFBMs, maxValidTTFBMs)
	clsScore := sanitizeVitalFloat(in.CLSScore, maxValidCLSScore)

	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	ensureAnalyticsSchema(ctx)

	if in.UserID != "" && in.VisitorID != "" {
		StitchVisitorToMember(ctx, in.UserID, in.VisitorID)
	}

	if durationSec > 0 {
		_, _ = db.Pool.Exec(ctx, `
			UPDATE analytics.member_events
			SET duration_sec = GREATEST(duration_sec, $1)
			WHERE id = (
				SELECT id FROM analytics.member_events
				WHERE (visitor_id = $2 OR ($3 <> '' AND user_id = $3))
				  AND url_path = $4
				  AND created_at >= NOW() - INTERVAL '2 hours'
				ORDER BY created_at DESC
				LIMIT 1
			)
		`, durationSec, in.VisitorID, in.UserID, in.URLPath)
	}

	_, _ = db.Pool.Exec(ctx, `
		UPDATE analytics.page_views
		SET duration_sec = GREATEST(duration_sec, $1),
		    scroll_depth_pct = GREATEST(scroll_depth_pct, $2::smallint),
		    lcp_ms = CASE WHEN $3 > 0 THEN $3 ELSE lcp_ms END,
		    cls_score = CASE WHEN $4 > 0 THEN $4 ELSE cls_score END,
		    inp_ms = CASE WHEN $5 > 0 THEN $5 ELSE inp_ms END,
		    ttfb_ms = CASE WHEN $6 > 0 THEN $6 ELSE ttfb_ms END
		WHERE id = (
			SELECT id FROM analytics.page_views
			WHERE (visitor_id = $7 OR ($8 <> '' AND user_id = $8))
			  AND path = $9
			  AND created_at >= NOW() - INTERVAL '2 hours'
			ORDER BY created_at DESC
			LIMIT 1
		)
	`, durationSec, scrollPct, lcpMs, clsScore, inpMs, ttfbMs, in.VisitorID, in.UserID, in.URLPath)
}

func fallbackEventTitle(eventType, subtitle string) string {
	switch eventType {
	case "cart_add":
		if subtitle != "" {
			return fmt.Sprintf("Sepete ürün ekledi: %s", subtitle)
		}
		return "Sepete ürün ekledi"
	case "cart_remove":
		return "Sepetten ürün çıkardı"
	case "cart_excel_export":
		return "Sepet listesini Excel teklifi olarak indirdi"
	case "whatsapp_click":
		return "Tedarikçi WhatsApp iletişimine tıkladı"
	case "phone_click":
		return "Tedarikçi telefon numarasına tıkladı"
	case "pack_calc":
		return "Toptan seri / paket maliyet hesaplayıcısını kullandı"
	case "price_unlock":
		return "Toptan üye fiyat kilidini açmak için giriş modalını açtı"
	default:
		return "Mağaza etkileşimi gerçekleştirdi"
	}
}
