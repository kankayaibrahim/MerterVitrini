package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"mertervitrini/backend/db"
)

// MemberJourneyListItem represents a customer row in the Admin Member Journey Explorer.
type MemberJourneyListItem struct {
	ID                  string  `json:"id"`
	FirstName           string  `json:"first_name"`
	LastName            string  `json:"last_name"`
	Email               string  `json:"email"`
	Phone               string  `json:"phone"`
	EmailVerified       bool    `json:"email_verified"`
	IsBlocked           bool    `json:"is_blocked"`
	CreatedAt           string  `json:"created_at"`
	LastActiveAt        *string `json:"last_active_at"`
	IsOnline            bool    `json:"is_online"`
	TotalEvents         int     `json:"total_events"`
	PagesReadCount      int     `json:"pages_read_count"`
	ProductsViewedCount int     `json:"products_viewed_count"`
	CartActionsCount    int     `json:"cart_actions_count"`
	OrdersCount         int     `json:"orders_count"`
	LastEventTitle      string  `json:"last_event_title"`
	LastEventCategory   string  `json:"last_event_category"`
}

// JourneyFunnelStep represents one milestone on the visual B2B lifecycle map.
type JourneyFunnelStep struct {
	StepKey   string  `json:"step_key"`
	Label     string  `json:"label"`
	Completed bool    `json:"completed"`
	ReachedAt *string `json:"reached_at,omitempty"`
	Detail    string  `json:"detail"`
}

// ViewedProductSummary represents a product inspected by this member.
type ViewedProductSummary struct {
	ProductID        string `json:"product_id"`
	Title            string `json:"title"`
	CustomSKU        string `json:"custom_sku"`
	Slug             string `json:"slug"`
	BrandName        string `json:"brand_name"`
	ImageURL         string `json:"image_url"`
	ViewCount        int    `json:"view_count"`
	TotalDurationSec int    `json:"total_duration_sec"`
	AddedToCart      bool   `json:"added_to_cart"`
	Ordered          bool   `json:"ordered"`
	LastViewedAt     string `json:"last_viewed_at"`
}

// ReadContentSummary represents a corporate/CMS/blog/static page read by this member.
type ReadContentSummary struct {
	Key              string `json:"key"`
	Title            string `json:"title"`
	URLPath          string `json:"url_path"`
	ContentType      string `json:"content_type"`
	ReadCount        int    `json:"read_count"`
	TotalDurationSec int    `json:"total_duration_sec"`
	LastReadAt       string `json:"last_read_at"`
}

// MemberTimelineEvent represents a single chronological step in the member's journey.
type MemberTimelineEvent struct {
	ID            string         `json:"id"`
	EventType     string         `json:"event_type"`
	EventCategory string         `json:"event_category"`
	Title         string         `json:"title"`
	Subtitle      string         `json:"subtitle,omitempty"`
	URLPath       string         `json:"url_path,omitempty"`
	EntityType    string         `json:"entity_type,omitempty"`
	EntityID      string         `json:"entity_id,omitempty"`
	ImageURL      string         `json:"image_url,omitempty"`
	DurationSec   int            `json:"duration_sec,omitempty"`
	DeviceType    string         `json:"device_type,omitempty"`
	Browser       string         `json:"browser,omitempty"`
	OS            string         `json:"os,omitempty"`
	CountryCode   string         `json:"country_code,omitempty"`
	IPAddress     string         `json:"ip_address,omitempty"`
	IsPreSignup   bool           `json:"is_pre_signup"`
	Metadata      map[string]any `json:"metadata,omitempty"`
	CreatedAt     string         `json:"created_at"`
	sortTime      time.Time
}

// MemberJourneyKPIs summarizes quantitative engagement metrics for one member.
type MemberJourneyKPIs struct {
	TotalSessions       int     `json:"total_sessions"`
	TotalEvents         int     `json:"total_events"`
	TotalPagesRead      int     `json:"total_pages_read"`
	CorporatePagesRead  int     `json:"corporate_pages_read"`
	UniqueProducts      int     `json:"unique_products"`
	TotalProductViews   int     `json:"total_product_views"`
	CartAdditions       int     `json:"cart_additions"`
	SupplierContacts    int     `json:"supplier_contacts"`
	OrdersCount         int     `json:"orders_count"`
	OrdersTotalAmount   float64 `json:"orders_total_amount"`
	TotalTimeSpentSec   int     `json:"total_time_spent_sec"`
	FirstSeenAt         *string `json:"first_seen_at,omitempty"`
	LastActiveAt        *string `json:"last_active_at,omitempty"`
	IsOnline            bool    `json:"is_online"`
	AcquisitionSource   string  `json:"acquisition_source"`
	PrimaryDevice       string  `json:"primary_device"`
}

// MemberJourneyCustomerProfile holds member identity details for the journey header.
type MemberJourneyCustomerProfile struct {
	ID                string  `json:"id"`
	FirstName         string  `json:"first_name"`
	LastName          string  `json:"last_name"`
	Email             string  `json:"email"`
	Phone             string  `json:"phone"`
	EmailVerified     bool    `json:"email_verified"`
	IsBlocked         bool    `json:"is_blocked"`
	RegistrationIP    string  `json:"registration_ip"`
	PreferredLang     string  `json:"preferred_lang"`
	PreferredCurrency string  `json:"preferred_currency"`
	InstagramUsername string  `json:"instagram_username"`
	CreatedAt         string  `json:"created_at"`
	createdAtTime     time.Time
}

// MemberJourneyDetailResponse is returned by GET /api/v1/customers/{id}/journey.
type MemberJourneyDetailResponse struct {
	Customer       MemberJourneyCustomerProfile `json:"customer"`
	KPIs           MemberJourneyKPIs            `json:"kpis"`
	FunnelSteps    []JourneyFunnelStep          `json:"funnel_steps"`
	ViewedProducts []ViewedProductSummary       `json:"viewed_products"`
	ReadPages      []ReadContentSummary         `json:"read_pages"`
	TopCategories  []string                     `json:"top_categories"`
	Timeline       []MemberTimelineEvent        `json:"timeline"`
}

// ListMemberJourneys handles GET /api/v1/admin/member-journeys for the Admin Journey Explorer.
func (h *CustomersHandler) ListMemberJourneys(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	ensureMemberActivitySchema(ctx)

	search := strings.TrimSpace(r.URL.Query().Get("search"))
	var args []any
	whereSearch := ""
	if search != "" {
		whereSearch = " AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1)"
		args = append(args, "%"+search+"%")
	}

	query := `
		SELECT
			u.id,
			u.first_name,
			u.last_name,
			u.email,
			COALESCE(u.phone, ''),
			COALESCE(u.email_verified, false),
			u.is_blocked,
			u.created_at,
			GREATEST(
				u.created_at,
				COALESCE((SELECT MAX(me.created_at) FROM analytics.member_events me WHERE me.user_id = u.id), u.created_at),
				COALESCE((SELECT MAX(lh.login_at) FROM identity.user_login_history lh WHERE lh.user_id = u.id), u.created_at)
			) AS last_active_at,
			COALESCE((SELECT COUNT(*) FROM analytics.member_events me WHERE me.user_id = u.id), 0) AS raw_events,
			COALESCE((SELECT COUNT(*) FROM analytics.member_events me WHERE me.user_id = u.id AND me.event_category IN ('content', 'navigation')), 0) AS pages_read,
			COALESCE((SELECT COUNT(DISTINCT me.entity_id) FROM analytics.member_events me WHERE me.user_id = u.id AND me.event_type = 'product_view' AND me.entity_id IS NOT NULL), 0) AS products_viewed,
			COALESCE((SELECT COUNT(*) FROM analytics.member_events me WHERE me.user_id = u.id AND me.event_type = 'cart_add'), 0) AS cart_actions,
			(
				COALESCE((SELECT COUNT(*) FROM catalog.orders o WHERE o.user_id = u.id), 0) +
				COALESCE((SELECT COUNT(*) FROM catalog.store_inquiries si WHERE LOWER(si.email) = LOWER(u.email)), 0)
			) AS orders_count,
			COALESCE((SELECT me.title FROM analytics.member_events me WHERE me.user_id = u.id ORDER BY me.created_at DESC LIMIT 1), '') AS last_event_title,
			COALESCE((SELECT me.event_category FROM analytics.member_events me WHERE me.user_id = u.id ORDER BY me.created_at DESC LIMIT 1), 'auth') AS last_event_category
		FROM identity.users u
		WHERE u.user_role = 'customer'
	` + whereSearch + `
		ORDER BY last_active_at DESC, u.created_at DESC
		LIMIT 200
	`

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, `{"error":"Üye yolculuk listesi alınamadı"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	now := time.Now()
	list := make([]MemberJourneyListItem, 0, 32)
	for rows.Next() {
		var item MemberJourneyListItem
		var createdAt, lastActive time.Time
		if scanErr := rows.Scan(
			&item.ID, &item.FirstName, &item.LastName, &item.Email, &item.Phone,
			&item.EmailVerified, &item.IsBlocked, &createdAt, &lastActive,
			&item.TotalEvents, &item.PagesReadCount, &item.ProductsViewedCount,
			&item.CartActionsCount, &item.OrdersCount, &item.LastEventTitle, &item.LastEventCategory,
		); scanErr != nil {
			continue
		}
		item.CreatedAt = createdAt.Format(time.RFC3339)
		laStr := lastActive.Format(time.RFC3339)
		item.LastActiveAt = &laStr
		item.IsOnline = now.Sub(lastActive) <= 15*time.Minute
		if item.TotalEvents == 0 {
			item.TotalEvents = 1 + item.OrdersCount
		}
		if item.LastEventTitle == "" {
			item.LastEventTitle = "Üye kaydı oluşturuldu"
		}
		list = append(list, item)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(list)
}

// GetCustomerJourney handles GET /api/v1/customers/{id}/journey returning the full map & timeline.
func (h *CustomersHandler) GetCustomerJourney(w http.ResponseWriter, r *http.Request) {
	customerID := strings.TrimSpace(r.PathValue("id"))
	if customerID == "" {
		http.Error(w, `{"error":"Müşteri ID zorunludur"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	ensureMemberActivitySchema(ctx)

	profile, ok := loadCustomerJourneyProfile(ctx, customerID)
	if !ok {
		http.Error(w, `{"error":"Müşteri bulunamadı"}`, http.StatusNotFound)
		return
	}

	bundle := loadTrackedMemberEvents(ctx, profile)
	bundle.events = mergeHistoricalMilestones(ctx, profile, bundle.events)

	sort.SliceStable(bundle.events, func(i, j int) bool {
		return bundle.events[i].sortTime.After(bundle.events[j].sortTime)
	})
	if len(bundle.events) > 300 {
		bundle.events = bundle.events[:300]
	}

	viewedProducts := buildViewedProductsSummary(ctx, profile, bundle.events)
	readPages, topCategories := buildReadContentAndCategories(bundle.events)
	kpis := computeMemberJourneyKPIs(ctx, profile, bundle, viewedProducts, readPages)
	funnel := buildJourneyFunnelSteps(profile, bundle.events, viewedProducts, readPages, kpis)

	resp := MemberJourneyDetailResponse{
		Customer:       profile,
		KPIs:           kpis,
		FunnelSteps:    funnel,
		ViewedProducts: viewedProducts,
		ReadPages:      readPages,
		TopCategories:  topCategories,
		Timeline:       bundle.events,
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(resp)
}

func loadCustomerJourneyProfile(ctx context.Context, customerID string) (MemberJourneyCustomerProfile, bool) {
	var p MemberJourneyCustomerProfile
	err := db.Pool.QueryRow(ctx, `
		SELECT
			id, first_name, last_name, email, COALESCE(phone, ''),
			COALESCE(email_verified, false), is_blocked,
			COALESCE(registration_ip, ''), COALESCE(preferred_lang, 'tr'),
			COALESCE(preferred_currency, 'TRY'), COALESCE(instagram_username, ''),
			created_at
		FROM identity.users
		WHERE id = $1
		LIMIT 1
	`, customerID).Scan(
		&p.ID, &p.FirstName, &p.LastName, &p.Email, &p.Phone,
		&p.EmailVerified, &p.IsBlocked,
		&p.RegistrationIP, &p.PreferredLang,
		&p.PreferredCurrency, &p.InstagramUsername,
		&p.createdAtTime,
	)
	if err != nil {
		return p, false
	}
	p.CreatedAt = p.createdAtTime.Format(time.RFC3339)
	return p, true
}

type trackedEventsBundle struct {
	events        []MemberTimelineEvent
	sessionCount  int
	acqSource     string
	primaryDevice string
}

func loadTrackedMemberEvents(ctx context.Context, profile MemberJourneyCustomerProfile) trackedEventsBundle {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			id::text,
			COALESCE(session_id, ''),
			event_type,
			event_category,
			title,
			COALESCE(subtitle, ''),
			COALESCE(url_path, ''),
			COALESCE(entity_type, ''),
			COALESCE(entity_id, ''),
			COALESCE(image_url, ''),
			duration_sec,
			COALESCE(device_type, 'desktop'),
			COALESCE(browser, ''),
			COALESCE(os, ''),
			COALESCE(country_code, ''),
			COALESCE(ip_address, ''),
			metadata,
			created_at
		FROM analytics.member_events
		WHERE user_id = $1
		   OR visitor_id IN (SELECT visitor_id FROM analytics.user_visitor_links WHERE user_id = $1)
		ORDER BY created_at DESC
		LIMIT 300
	`, profile.ID)
	if err != nil {
		return trackedEventsBundle{
			events:        []MemberTimelineEvent{},
			acqSource:     directReferrerLabel,
			primaryDevice: "desktop",
		}
	}
	defer rows.Close()

	events := make([]MemberTimelineEvent, 0, 64)
	sessions := map[string]bool{}
	deviceCounts := map[string]int{}
	acqSource := directReferrerLabel

	for rows.Next() {
		var ev MemberTimelineEvent
		var sessionID string
		var rawMeta []byte
		var createdAt time.Time
		if scanErr := rows.Scan(
			&ev.ID, &sessionID, &ev.EventType, &ev.EventCategory,
			&ev.Title, &ev.Subtitle, &ev.URLPath, &ev.EntityType, &ev.EntityID,
			&ev.ImageURL, &ev.DurationSec, &ev.DeviceType, &ev.Browser, &ev.OS,
			&ev.CountryCode, &ev.IPAddress, &rawMeta, &createdAt,
		); scanErr != nil {
			continue
		}
		recordTrackedEventStats(sessionID, ev.DeviceType, sessions, deviceCounts)
		acqSource = extractEventReferrerHost(rawMeta, &ev, acqSource)
		ev.IsPreSignup = createdAt.Before(profile.createdAtTime.Add(-2 * time.Second))
		ev.CreatedAt = createdAt.Format(time.RFC3339)
		ev.sortTime = createdAt
		events = append(events, ev)
	}

	return trackedEventsBundle{
		events:        events,
		sessionCount:  len(sessions),
		acqSource:     acqSource,
		primaryDevice: mostFrequentDevice(deviceCounts),
	}
}

func recordTrackedEventStats(sessionID string, deviceType string, sessions map[string]bool, deviceCounts map[string]int) {
	if sessionID != "" {
		sessions[sessionID] = true
	}
	if deviceType != "" {
		deviceCounts[deviceType]++
	}
}

func extractEventReferrerHost(rawMeta []byte, ev *MemberTimelineEvent, fallback string) string {
	if len(rawMeta) == 0 {
		return fallback
	}
	_ = json.Unmarshal(rawMeta, &ev.Metadata)
	if ref, ok := ev.Metadata["referrer_host"].(string); ok && ref != "" && ref != directReferrerLabel {
		return ref
	}
	return fallback
}

func mostFrequentDevice(deviceCounts map[string]int) string {
	primaryDev := "desktop"
	maxDevCount := 0
	for dev, cnt := range deviceCounts {
		if cnt > maxDevCount {
			maxDevCount = cnt
			primaryDev = dev
		}
	}
	return primaryDev
}

func mergeHistoricalMilestones(ctx context.Context, profile MemberJourneyCustomerProfile, events []MemberTimelineEvent) []MemberTimelineEvent {
	hasRegister := false
	loginTimestamps := make([]time.Time, 0, 8)
	trackedOrderIDs := map[string]bool{}
	trackedInquiryIDs := map[string]bool{}

	for _, ev := range events {
		switch ev.EventType {
		case "register":
			hasRegister = true
		case "login":
			loginTimestamps = append(loginTimestamps, ev.sortTime)
		case "order_create":
			if ev.EntityID != "" {
				trackedOrderIDs[ev.EntityID] = true
			}
		case "inquiry_submit":
			if ev.EntityID != "" {
				trackedInquiryIDs[ev.EntityID] = true
			}
		}
	}

	if !hasRegister {
		sub := profile.Email
		if profile.RegistrationIP != "" {
			sub += " • Kayıt IP: " + profile.RegistrationIP
		}
		events = append(events, MemberTimelineEvent{
			ID:            "hist-reg-" + profile.ID,
			EventType:     "register",
			EventCategory: "auth",
			Title:         "Üye oldu (B2B müşteri kaydı oluşturuldu)",
			Subtitle:      sub,
			EntityType:    "user",
			EntityID:      profile.ID,
			IPAddress:     profile.RegistrationIP,
			CreatedAt:     profile.CreatedAt,
			sortTime:      profile.createdAtTime,
		})
	}

	events = appendHistoricalLogins(ctx, profile.ID, loginTimestamps, events)
	events = appendHistoricalOrders(ctx, profile.ID, trackedOrderIDs, events)
	events = appendHistoricalInquiries(ctx, profile.Email, trackedInquiryIDs, events)
	events = appendHistoricalChatsAndRfqs(ctx, profile, events)
	return events
}

func appendHistoricalLogins(ctx context.Context, userID string, existing []time.Time, events []MemberTimelineEvent) []MemberTimelineEvent {
	rows, err := db.Pool.Query(ctx, `
		SELECT login_at, COALESCE(ip_address, '')
		FROM identity.user_login_history
		WHERE user_id = $1
		ORDER BY login_at DESC
		LIMIT 30
	`, userID)
	if err != nil {
		return events
	}
	defer rows.Close()

	idx := 0
	for rows.Next() {
		var loginAt time.Time
		var ip string
		if rows.Scan(&loginAt, &ip) != nil {
			continue
		}
		if hasTimestampNear(existing, loginAt, 10*time.Second) {
			continue
		}
		idx++
		events = append(events, MemberTimelineEvent{
			ID:            fmt.Sprintf("hist-login-%d", idx),
			EventType:     "login",
			EventCategory: "auth",
			Title:         "Sisteme giriş yaptı",
			Subtitle:      firstNonEmptyStr("IP: "+ip, ""),
			IPAddress:     ip,
			CreatedAt:     loginAt.Format(time.RFC3339),
			sortTime:      loginAt,
		})
	}
	return events
}

func appendHistoricalOrders(ctx context.Context, userID string, tracked map[string]bool, events []MemberTimelineEvent) []MemberTimelineEvent {
	rows, err := db.Pool.Query(ctx, `
		SELECT o.id::text, o.order_number, o.total_amount, o.order_status, o.created_at,
		       COALESCE((SELECT oi.image_url_at_purchase FROM catalog.order_items oi WHERE oi.order_id = o.id LIMIT 1), '')
		FROM catalog.orders o
		WHERE o.user_id = $1
		ORDER BY o.created_at DESC
		LIMIT 30
	`, userID)
	if err != nil {
		return events
	}
	defer rows.Close()

	for rows.Next() {
		var id, orderNum, status, img string
		var total float64
		var createdAt time.Time
		if rows.Scan(&id, &orderNum, &total, &status, &createdAt, &img) != nil || tracked[id] {
			continue
		}
		events = append(events, MemberTimelineEvent{
			ID:            "hist-order-" + id,
			EventType:     "order_create",
			EventCategory: "commerce",
			Title:         fmt.Sprintf("#%s numaralı B2B siparişi oluşturdu", orderNum),
			Subtitle:      fmt.Sprintf("Tutar: %.2f TL • Durum: %s", total, status),
			EntityType:    "order",
			EntityID:      id,
			ImageURL:      img,
			CreatedAt:     createdAt.Format(time.RFC3339),
			sortTime:      createdAt,
		})
	}
	return events
}

func appendHistoricalInquiries(ctx context.Context, email string, tracked map[string]bool, events []MemberTimelineEvent) []MemberTimelineEvent {
	if email == "" {
		return events
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT si.id::text, si.created_at,
		       COALESCE((SELECT COUNT(*) FROM catalog.store_inquiry_items ii WHERE ii.inquiry_id = si.id), 0),
		       COALESCE((SELECT SUM(ii.quantity * ii.price) FROM catalog.store_inquiry_items ii WHERE ii.inquiry_id = si.id), 0)
		FROM catalog.store_inquiries si
		WHERE LOWER(si.email) = LOWER($1)
		ORDER BY si.created_at DESC
		LIMIT 20
	`, email)
	if err != nil {
		return events
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var createdAt time.Time
		var itemCnt int
		var total float64
		if rows.Scan(&id, &createdAt, &itemCnt, &total) != nil || tracked[id] {
			continue
		}
		events = append(events, MemberTimelineEvent{
			ID:            "hist-inq-" + id,
			EventType:     "inquiry_submit",
			EventCategory: "commerce",
			Title:         fmt.Sprintf("Toptan sipariş / teklif formu gönderdi (%d ürün)", itemCnt),
			Subtitle:      fmt.Sprintf("Yaklaşık Tutar: %.2f TL", total),
			EntityType:    "inquiry",
			EntityID:      id,
			CreatedAt:     createdAt.Format(time.RFC3339),
			sortTime:      createdAt,
		})
	}
	return events
}

func appendHistoricalChatsAndRfqs(ctx context.Context, profile MemberJourneyCustomerProfile, events []MemberTimelineEvent) []MemberTimelineEvent {
	cRows, err := db.Pool.Query(ctx, `
		SELECT cr.id::text, COALESCE(b.brand_name, 'Tedarikçi'), cr.created_at
		FROM catalog.chat_rooms cr
		LEFT JOIN catalog.brands b ON cr.brand_id = b.id
		WHERE cr.customer_user_id = $1
		ORDER BY cr.created_at DESC
		LIMIT 15
	`, profile.ID)
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var id, brandName string
			var createdAt time.Time
			if cRows.Scan(&id, &brandName, &createdAt) == nil {
				events = append(events, MemberTimelineEvent{
					ID:            "hist-chat-" + id,
					EventType:     "chat_start",
					EventCategory: "engagement",
					Title:         fmt.Sprintf("“%s” ile canlı sohbet başlattı", brandName),
					EntityType:    "chat_room",
					EntityID:      id,
					CreatedAt:     createdAt.Format(time.RFC3339),
					sortTime:      createdAt,
				})
			}
		}
	}

	rRows, rErr := db.Pool.Query(ctx, `
		SELECT id::text, title, target_quantity, created_at
		FROM catalog.buyer_rfqs
		WHERE customer_user_id = $1 OR LOWER(buyer_email) = LOWER($2)
		ORDER BY created_at DESC
		LIMIT 15
	`, profile.ID, profile.Email)
	if rErr == nil {
		defer rRows.Close()
		for rRows.Next() {
			var id, title string
			var qty int
			var createdAt time.Time
			if rRows.Scan(&id, &title, &qty, &createdAt) == nil {
				events = append(events, MemberTimelineEvent{
					ID:            "hist-rfq-" + id,
					EventType:     "rfq_create",
					EventCategory: "engagement",
					Title:         fmt.Sprintf("“%s” başlıklı toptan alım talebi (RFQ) açtı", title),
					Subtitle:      fmt.Sprintf("Hedef Adet: %d", qty),
					EntityType:    "rfq",
					EntityID:      id,
					CreatedAt:     createdAt.Format(time.RFC3339),
					sortTime:      createdAt,
				})
			}
		}
	}
	return events
}

func hasTimestampNear(list []time.Time, target time.Time, tolerance time.Duration) bool {
	for _, t := range list {
		diff := t.Sub(target)
		if diff < 0 {
			diff = -diff
		}
		if diff <= tolerance {
			return true
		}
	}
	return false
}

func buildViewedProductsSummary(ctx context.Context, profile MemberJourneyCustomerProfile, events []MemberTimelineEvent) []ViewedProductSummary {
	aggMap := map[string]*ViewedProductSummary{}
	cartProductIDs := map[string]bool{}
	orderedProductIDs := loadOrderedProductIDsForCustomer(ctx, profile)

	for _, ev := range events {
		if ev.EventType == "cart_add" && ev.EntityID != "" {
			cartProductIDs[ev.EntityID] = true
		}
		if ev.EventType != "product_view" || ev.EntityID == "" {
			continue
		}
		existing, exists := aggMap[ev.EntityID]
		if !exists {
			existing = &ViewedProductSummary{
				ProductID:    ev.EntityID,
				Title:        strings.Trim(strings.TrimSuffix(ev.Title, " ürününe göz attı"), "“”\" "),
				ImageURL:     ev.ImageURL,
				LastViewedAt: ev.CreatedAt,
			}
			aggMap[ev.EntityID] = existing
		}
		existing.ViewCount++
		existing.TotalDurationSec += ev.DurationSec
	}

	if len(aggMap) == 0 {
		return []ViewedProductSummary{}
	}

	ids := make([]string, 0, len(aggMap))
	for pid := range aggMap {
		ids = append(ids, pid)
	}
	enrichViewedProductsFromCatalog(ctx, ids, aggMap)

	out := make([]ViewedProductSummary, 0, len(aggMap))
	for pid, item := range aggMap {
		item.AddedToCart = cartProductIDs[pid]
		item.Ordered = orderedProductIDs[pid]
		out = append(out, *item)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].ViewCount != out[j].ViewCount {
			return out[i].ViewCount > out[j].ViewCount
		}
		return out[i].LastViewedAt > out[j].LastViewedAt
	})
	return out
}

func loadOrderedProductIDsForCustomer(ctx context.Context, profile MemberJourneyCustomerProfile) map[string]bool {
	out := map[string]bool{}
	rows, err := db.Pool.Query(ctx, `
		SELECT DISTINCT oi.product_id::text
		FROM catalog.order_items oi
		INNER JOIN catalog.orders o ON oi.order_id = o.id
		WHERE o.user_id = $1
		UNION
		SELECT DISTINCT ii.product_id::text
		FROM catalog.store_inquiry_items ii
		INNER JOIN catalog.store_inquiries si ON ii.inquiry_id = si.id
		WHERE LOWER(si.email) = LOWER($2)
	`, profile.ID, profile.Email)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var pid string
		if rows.Scan(&pid) == nil && pid != "" {
			out[pid] = true
		}
	}
	return out
}

func enrichViewedProductsFromCatalog(ctx context.Context, ids []string, aggMap map[string]*ViewedProductSummary) {
	rows, err := db.Pool.Query(ctx, `
		SELECT p.id::text, p.title, COALESCE(p.custom_sku, ''), COALESCE(p.slug, ''),
		       COALESCE(b.brand_name, ''),
		       COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1), '')
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON p.brand_id = b.id
		WHERE p.id::text = ANY($1)
	`, ids)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id, title, sku, slug, brandName, img string
		if rows.Scan(&id, &title, &sku, &slug, &brandName, &img) == nil {
			if target, ok := aggMap[id]; ok {
				target.Title = title
				target.CustomSKU = sku
				target.Slug = slug
				target.BrandName = brandName
				if img != "" {
					target.ImageURL = img
				}
			}
		}
	}
}

func buildReadContentAndCategories(events []MemberTimelineEvent) ([]ReadContentSummary, []string) {
	pageMap := map[string]*ReadContentSummary{}
	catCounts := map[string]int{}

	for _, ev := range events {
		if ev.EventType == "category_view" {
			catLabel := strings.Trim(strings.TrimSuffix(ev.Title, " kategorisinde gezindi"), "“”\" ")
			if catLabel != "" {
				catCounts[catLabel]++
			}
		}
		if ev.EventCategory != "content" {
			continue
		}
		key := firstNonEmptyStr(ev.EntityID, ev.URLPath, ev.Title)
		item, exists := pageMap[key]
		if !exists {
			item = &ReadContentSummary{
				Key:         key,
				Title:       ev.Title,
				URLPath:     ev.URLPath,
				ContentType: ev.EventType,
				LastReadAt:  ev.CreatedAt,
			}
			pageMap[key] = item
		}
		item.ReadCount++
		item.TotalDurationSec += ev.DurationSec
	}

	pages := make([]ReadContentSummary, 0, len(pageMap))
	for _, p := range pageMap {
		pages = append(pages, *p)
	}
	sort.Slice(pages, func(i, j int) bool {
		return pages[i].LastReadAt > pages[j].LastReadAt
	})

	type catPair struct {
		Name  string
		Count int
	}
	pairs := make([]catPair, 0, len(catCounts))
	for k, v := range catCounts {
		pairs = append(pairs, catPair{Name: k, Count: v})
	}
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].Count > pairs[j].Count
	})
	topCats := make([]string, 0, 8)
	for idx, cp := range pairs {
		if idx >= 8 {
			break
		}
		topCats = append(topCats, cp.Name)
	}

	return pages, topCats
}

func computeMemberJourneyKPIs(
	ctx context.Context,
	profile MemberJourneyCustomerProfile,
	bundle trackedEventsBundle,
	viewedProducts []ViewedProductSummary,
	readPages []ReadContentSummary,
) MemberJourneyKPIs {
	kpis := MemberJourneyKPIs{
		TotalSessions:      maxInt(bundle.sessionCount, 1),
		TotalEvents:        len(bundle.events),
		UniqueProducts:     len(viewedProducts),
		CorporatePagesRead: len(readPages),
		AcquisitionSource:  bundle.acqSource,
		PrimaryDevice:      bundle.primaryDevice,
	}

	for _, ev := range bundle.events {
		kpis.TotalTimeSpentSec += ev.DurationSec
		switch ev.EventCategory {
		case "navigation", "content":
			kpis.TotalPagesRead++
		}
		switch ev.EventType {
		case "product_view":
			kpis.TotalProductViews++
		case "cart_add":
			kpis.CartAdditions++
		case "whatsapp_click", "phone_click", "email_click", "chat_start", "chat_message", "rfq_create":
			kpis.SupplierContacts++
		}
	}

	_ = db.Pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM catalog.orders WHERE user_id = $1) +
			(SELECT COUNT(*) FROM catalog.store_inquiries WHERE LOWER(email) = LOWER($2)),
			COALESCE((SELECT SUM(total_amount) FROM catalog.orders WHERE user_id = $1), 0) +
			COALESCE((SELECT SUM(ii.quantity * ii.price) FROM catalog.store_inquiry_items ii INNER JOIN catalog.store_inquiries si ON ii.inquiry_id = si.id WHERE LOWER(si.email) = LOWER($2)), 0)
	`, profile.ID, profile.Email).Scan(&kpis.OrdersCount, &kpis.OrdersTotalAmount)

	if len(bundle.events) > 0 {
		newest := bundle.events[0].CreatedAt
		oldest := bundle.events[len(bundle.events)-1].CreatedAt
		kpis.LastActiveAt = &newest
		kpis.FirstSeenAt = &oldest
		kpis.IsOnline = time.Since(bundle.events[0].sortTime) <= 15*time.Minute
	}
	return kpis
}

type funnelMilestones struct {
	firstVisitAt *string
	contentAt    *string
	productAt    *string
	engageAt     *string
	orderAt      *string
}

func buildJourneyFunnelSteps(
	profile MemberJourneyCustomerProfile,
	events []MemberTimelineEvent,
	viewedProducts []ViewedProductSummary,
	readPages []ReadContentSummary,
	kpis MemberJourneyKPIs,
) []JourneyFunnelStep {
	milestones := collectFunnelMilestones(events)
	regTs := profile.CreatedAt

	return []JourneyFunnelStep{
		{
			StepKey:   "first_visit",
			Label:     "1. İlk Site Ziyareti",
			Completed: milestones.firstVisitAt != nil,
			ReachedAt: milestones.firstVisitAt,
			Detail:    kpis.AcquisitionSource,
		},
		{
			StepKey:   "registered",
			Label:     "2. Üyelik Kaydı",
			Completed: true,
			ReachedAt: &regTs,
			Detail:    ternaryStr(profile.EmailVerified, "E-Posta Doğrulandı", "Kayıt Tamamlandı"),
		},
		{
			StepKey:   "content_exploration",
			Label:     "3. Sayfa & Kurumsal Okuma",
			Completed: len(readPages) > 0 || kpis.TotalPagesRead > 0,
			ReachedAt: milestones.contentAt,
			Detail:    fmt.Sprintf("%d sayfa / içerik okudu", maxInt(len(readPages), kpis.TotalPagesRead)),
		},
		{
			StepKey:   "product_discovery",
			Label:     "4. Ürün & Vitrin İnceleme",
			Completed: len(viewedProducts) > 0 || milestones.productAt != nil,
			ReachedAt: milestones.productAt,
			Detail:    fmt.Sprintf("%d farklı ürün (%d görüntüleme)", len(viewedProducts), kpis.TotalProductViews),
		},
		{
			StepKey:   "cart_or_contact",
			Label:     "5. Sepet / Üretici İletişimi",
			Completed: kpis.CartAdditions > 0 || kpis.SupplierContacts > 0,
			ReachedAt: milestones.engageAt,
			Detail:    fmt.Sprintf("%d sepet • %d iletişim", kpis.CartAdditions, kpis.SupplierContacts),
		},
		{
			StepKey:   "b2b_order",
			Label:     "6. Toptan Sipariş / Talep",
			Completed: kpis.OrdersCount > 0,
			ReachedAt: milestones.orderAt,
			Detail:    fmt.Sprintf("%d sipariş / talep", kpis.OrdersCount),
		},
	}
}

func collectFunnelMilestones(events []MemberTimelineEvent) funnelMilestones {
	var m funnelMilestones
	for i := len(events) - 1; i >= 0; i-- {
		ev := events[i]
		recordMilestoneIfEmpty(&m.firstVisitAt, ev.CreatedAt, true)
		recordMilestoneIfEmpty(&m.contentAt, ev.CreatedAt, isContentMilestone(ev))
		recordMilestoneIfEmpty(&m.productAt, ev.CreatedAt, isProductMilestone(ev))
		recordMilestoneIfEmpty(&m.engageAt, ev.CreatedAt, isEngagementMilestone(ev))
		recordMilestoneIfEmpty(&m.orderAt, ev.CreatedAt, isOrderMilestone(ev))
	}
	return m
}

func recordMilestoneIfEmpty(target **string, ts string, matched bool) {
	if *target == nil && matched {
		val := ts
		*target = &val
	}
}

func isContentMilestone(ev MemberTimelineEvent) bool {
	return ev.EventCategory == "content" || ev.EventType == "category_view"
}

func isProductMilestone(ev MemberTimelineEvent) bool {
	return ev.EventType == "product_view" || ev.EventType == "brand_view"
}

func isEngagementMilestone(ev MemberTimelineEvent) bool {
	return ev.EventType == "cart_add" || ev.EventCategory == "engagement"
}

func isOrderMilestone(ev MemberTimelineEvent) bool {
	return ev.EventType == "order_create" || ev.EventType == "inquiry_submit"
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func ternaryStr(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}

