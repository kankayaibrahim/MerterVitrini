package handlers

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"mertervitrini/backend/db"
)

// CustomerOverviewKPIs summarizes registration, verification, activity, and geographic metrics.
type CustomerOverviewKPIs struct {
	TotalCustomers     int     `json:"total_customers"`
	TodayCount         int     `json:"today_count"`
	YesterdayCount     int     `json:"yesterday_count"`
	Last7DaysCount     int     `json:"last_7_days_count"`
	Last30DaysCount    int     `json:"last_30_days_count"`
	ThisMonthCount     int     `json:"this_month_count"`
	VerifiedCount      int     `json:"verified_count"`
	BlockedCount       int     `json:"blocked_count"`
	OnlineNowCount     int     `json:"online_now_count"`
	ActiveTodayCount   int     `json:"active_today_count"`
	WithOrdersCount    int     `json:"with_orders_count"`
	WithActiveCart     int     `json:"with_active_cart_count"`
	CountriesCount     int     `json:"countries_count"`
	InternationalCount int     `json:"international_count"`
	InternationalShare float64 `json:"international_share"`
	ResolvedGeoCount   int     `json:"resolved_geo_count"`
}

// DailyRegistrationPoint represents one calendar day (Istanbul TZ) in the registration trend chart.
type DailyRegistrationPoint struct {
	Date               string `json:"date"`
	Count              int    `json:"count"`
	TurkeyCount        int    `json:"turkey_count"`
	InternationalCount int    `json:"international_count"`
}

// CustomerCountryBreakdown aggregates customers, activity, and B2B order revenue per country.
type CustomerCountryBreakdown struct {
	CountryCode   string   `json:"country_code"`
	CountryName   string   `json:"country_name"`
	CustomerCount int      `json:"customer_count"`
	TodayCount    int      `json:"today_count"`
	OnlineCount   int      `json:"online_count"`
	OrdersCount   int      `json:"orders_count"`
	TotalSpend    float64  `json:"total_spend"`
	Share         float64  `json:"share"`
	Lat           *float64 `json:"lat,omitempty"`
	Lon           *float64 `json:"lon,omitempty"`
}

// CustomerMapSample is a lightweight customer summary shown inside an OpenStreetMap marker popup.
type CustomerMapSample struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Email           string `json:"email"`
	RegisteredToday bool   `json:"registered_today"`
	IsOnline        bool   `json:"is_online"`
	OrdersCount     int    `json:"orders_count"`
	CreatedAt       string `json:"created_at"`
}

// CustomerMapPoint represents a geographic cluster pin rendered on OpenStreetMap.
type CustomerMapPoint struct {
	ClusterKey      string              `json:"cluster_key"`
	CountryCode     string              `json:"country_code"`
	CountryName     string              `json:"country_name"`
	City            string              `json:"city"`
	RegionName      string              `json:"region_name"`
	Lat             float64             `json:"lat"`
	Lon             float64             `json:"lon"`
	CustomerCount   int                 `json:"customer_count"`
	TodayCount      int                 `json:"today_count"`
	OnlineCount     int                 `json:"online_count"`
	OrdersCount     int                 `json:"orders_count"`
	TotalSpend      float64             `json:"total_spend"`
	IsCentroid      bool                `json:"is_centroid"`
	SampleCustomers []CustomerMapSample `json:"sample_customers"`
}

// CustomersOverviewResponse is the executive analytics payload for /admin/customers.
type CustomersOverviewResponse struct {
	GeneratedAt        string                     `json:"generated_at"`
	KPIs               CustomerOverviewKPIs       `json:"kpis"`
	DailyRegistrations []DailyRegistrationPoint   `json:"daily_registrations"`
	Countries          []CustomerCountryBreakdown `json:"countries"`
	MapPoints          []CustomerMapPoint         `json:"map_points"`
}

// customerPeriodSQLCondition maps filter period keys onto Istanbul-timezone PostgreSQL predicates.
func customerPeriodSQLCondition(period string, col string) string {
	switch strings.ToLower(strings.TrimSpace(period)) {
	case "today":
		return col + " >= (date_trunc('day', NOW() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')"
	case "yesterday":
		return col + " >= ((date_trunc('day', NOW() AT TIME ZONE 'Europe/Istanbul') - INTERVAL '1 day') AT TIME ZONE 'Europe/Istanbul') AND " +
			col + " < (date_trunc('day', NOW() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')"
	case "7d":
		return col + " >= NOW() - INTERVAL '7 days'"
	case "30d":
		return col + " >= NOW() - INTERVAL '30 days'"
	case "this_month":
		return col + " >= (date_trunc('month', NOW() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')"
	default:
		return ""
	}
}

type customerOverviewRow struct {
	ID          string
	Name        string
	Email       string
	CreatedAt   time.Time
	Verified    bool
	Blocked     bool
	CountryCode string
	CountryName string
	City        string
	RegionName  string
	Lat         *float64
	Lon         *float64
	GeoSource   string
	LastActive  time.Time
	OrdersCount int
	TotalSpend  float64
	CartItems   int
}

type clusterAccumulator struct {
	point CustomerMapPoint
}

func roundCoord(v float64, decimals int) float64 {
	factor := math.Pow10(decimals)
	return math.Round(v*factor) / factor
}

// aggregateCustomerOverview builds KPIs, country breakdown, and clustered OSM map points from customer rows.
func aggregateCustomerOverview(rows []customerOverviewRow, now time.Time) CustomersOverviewResponse {
	istanbulLoc, err := time.LoadLocation("Europe/Istanbul")
	if err != nil {
		istanbulLoc = time.FixedZone("TRT", 3*3600)
	}
	nowIst := now.In(istanbulLoc)
	todayStart := time.Date(nowIst.Year(), nowIst.Month(), nowIst.Day(), 0, 0, 0, 0, istanbulLoc)
	yesterdayStart := todayStart.AddDate(0, 0, -1)
	monthStart := time.Date(nowIst.Year(), nowIst.Month(), 1, 0, 0, 0, 0, istanbulLoc)
	sevenDaysAgo := now.Add(-7 * 24 * time.Hour)
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)
	onlineCutoff := now.Add(-10 * time.Minute)

	kpis := CustomerOverviewKPIs{
		TotalCustomers: len(rows),
	}

	// Pre-populate 30 daily buckets in Europe/Istanbul calendar dates.
	dailyIndex := make(map[string]int, 30)
	daily := make([]DailyRegistrationPoint, 30)
	for i := 0; i < 30; i++ {
		dayDate := todayStart.AddDate(0, 0, i-29).Format("2006-01-02")
		daily[i] = DailyRegistrationPoint{Date: dayDate}
		dailyIndex[dayDate] = i
	}

	countryMap := make(map[string]*CustomerCountryBreakdown)
	distinctCountries := make(map[string]struct{})
	clusterMap := make(map[string]*clusterAccumulator)

	for _, r := range rows {
		createdIst := r.CreatedAt.In(istanbulLoc)
		isToday := !createdIst.Before(todayStart)
		isYesterday := !createdIst.Before(yesterdayStart) && createdIst.Before(todayStart)
		isThisMonth := !createdIst.Before(monthStart)
		isOnline := !r.LastActive.Before(onlineCutoff)
		isActiveToday := !r.LastActive.In(istanbulLoc).Before(todayStart)

		if isToday {
			kpis.TodayCount++
		}
		if isYesterday {
			kpis.YesterdayCount++
		}
		if !r.CreatedAt.Before(sevenDaysAgo) {
			kpis.Last7DaysCount++
		}
		if !r.CreatedAt.Before(thirtyDaysAgo) {
			kpis.Last30DaysCount++
		}
		if isThisMonth {
			kpis.ThisMonthCount++
		}
		if r.Verified {
			kpis.VerifiedCount++
		}
		if r.Blocked {
			kpis.BlockedCount++
		}
		if isOnline {
			kpis.OnlineNowCount++
		}
		if isActiveToday {
			kpis.ActiveTodayCount++
		}
		if r.OrdersCount > 0 {
			kpis.WithOrdersCount++
		}
		if r.CartItems > 0 {
			kpis.WithActiveCart++
		}

		cc := NormalizeISO2(r.CountryCode)
		if cc != "" {
			kpis.ResolvedGeoCount++
			distinctCountries[cc] = struct{}{}
			if cc != "TR" {
				kpis.InternationalCount++
			}
		}

		dateKey := createdIst.Format("2006-01-02")
		if idx, ok := dailyIndex[dateKey]; ok {
			daily[idx].Count++
			if cc == "TR" {
				daily[idx].TurkeyCount++
			} else if cc != "" {
				daily[idx].InternationalCount++
			}
		}

		// Country breakdown aggregation
		bucketCode := cc
		bucketName := cleanGeoLabel(r.CountryName)
		if bucketCode == "" {
			bucketCode = "UNKNOWN"
			bucketName = "Konum Bekleniyor"
		} else if bucketName == "" {
			if cmeta, ok := LookupCountryMeta(bucketCode); ok {
				bucketName = cmeta.Name
			} else {
				bucketName = bucketCode
			}
		}

		cb, exists := countryMap[bucketCode]
		if !exists {
			cb = &CustomerCountryBreakdown{
				CountryCode: bucketCode,
				CountryName: bucketName,
			}
			if cmeta, ok := LookupCountryMeta(bucketCode); ok {
				lat, lon := cmeta.Lat, cmeta.Lon
				cb.Lat = &lat
				cb.Lon = &lon
			} else if r.Lat != nil && r.Lon != nil {
				lat, lon := *r.Lat, *r.Lon
				cb.Lat = &lat
				cb.Lon = &lon
			}
			countryMap[bucketCode] = cb
		}
		cb.CustomerCount++
		if isToday {
			cb.TodayCount++
		}
		if isOnline {
			cb.OnlineCount++
		}
		cb.OrdersCount += r.OrdersCount
		cb.TotalSpend += r.TotalSpend

		// Map marker clustering (only customers with valid coordinates)
		lat, lon, hasCoords := resolveDisplayCoords(r, cc)
		if !hasCoords {
			continue
		}

		city := cleanGeoLabel(r.City)
		region := cleanGeoLabel(r.RegionName)
		isCentroid := r.GeoSource != "ip_api" || city == ""

		clusterLat := roundCoord(lat, 2)
		clusterLon := roundCoord(lon, 2)
		clusterKey := cc + "|" + strings.ToLower(city)
		if city == "" {
			clusterKey = cc + "|centroid"
		}

		acc, found := clusterMap[clusterKey]
		if !found {
			acc = &clusterAccumulator{
				point: CustomerMapPoint{
					ClusterKey:      clusterKey,
					CountryCode:     cc,
					CountryName:     bucketName,
					City:            city,
					RegionName:      region,
					Lat:             clusterLat,
					Lon:             clusterLon,
					IsCentroid:      isCentroid,
					SampleCustomers: make([]CustomerMapSample, 0, 6),
				},
			}
			clusterMap[clusterKey] = acc
		}
		if !isCentroid {
			acc.point.IsCentroid = false
		}
		acc.point.CustomerCount++
		if isToday {
			acc.point.TodayCount++
		}
		if isOnline {
			acc.point.OnlineCount++
		}
		acc.point.OrdersCount += r.OrdersCount
		acc.point.TotalSpend += r.TotalSpend
		if len(acc.point.SampleCustomers) < 6 {
			acc.point.SampleCustomers = append(acc.point.SampleCustomers, CustomerMapSample{
				ID:              r.ID,
				Name:            r.Name,
				Email:           r.Email,
				RegisteredToday: isToday,
				IsOnline:        isOnline,
				OrdersCount:     r.OrdersCount,
				CreatedAt:       r.CreatedAt.Format(time.RFC3339),
			})
		}
	}

	kpis.CountriesCount = len(distinctCountries)
	if kpis.ResolvedGeoCount > 0 {
		kpis.InternationalShare = math.Round((float64(kpis.InternationalCount)/float64(kpis.ResolvedGeoCount))*1000) / 10
	}

	countries := make([]CustomerCountryBreakdown, 0, len(countryMap))
	totalFloat := float64(max(kpis.TotalCustomers, 1))
	for _, cb := range countryMap {
		cb.TotalSpend = math.Round(cb.TotalSpend*100) / 100
		cb.Share = math.Round((float64(cb.CustomerCount)/totalFloat)*1000) / 10
		countries = append(countries, *cb)
	}
	sort.Slice(countries, func(i, j int) bool {
		if countries[i].CountryCode == "UNKNOWN" && countries[j].CountryCode != "UNKNOWN" {
			return false
		}
		if countries[j].CountryCode == "UNKNOWN" && countries[i].CountryCode != "UNKNOWN" {
			return true
		}
		if countries[i].CustomerCount != countries[j].CustomerCount {
			return countries[i].CustomerCount > countries[j].CustomerCount
		}
		return countries[i].CountryName < countries[j].CountryName
	})

	mapPoints := make([]CustomerMapPoint, 0, len(clusterMap))
	for _, acc := range clusterMap {
		acc.point.TotalSpend = math.Round(acc.point.TotalSpend*100) / 100
		mapPoints = append(mapPoints, acc.point)
	}
	sort.Slice(mapPoints, func(i, j int) bool {
		if mapPoints[i].CustomerCount != mapPoints[j].CustomerCount {
			return mapPoints[i].CustomerCount > mapPoints[j].CustomerCount
		}
		return mapPoints[i].CountryName < mapPoints[j].CountryName
	})

	return CustomersOverviewResponse{
		GeneratedAt:        now.UTC().Format(time.RFC3339),
		KPIs:               kpis,
		DailyRegistrations: daily,
		Countries:          countries,
		MapPoints:          mapPoints,
	}
}

func resolveDisplayCoords(r customerOverviewRow, cc string) (float64, float64, bool) {
	if r.Lat != nil && r.Lon != nil && (*r.Lat != 0 || *r.Lon != 0) {
		return *r.Lat, *r.Lon, true
	}
	if cmeta, ok := LookupCountryMeta(cc); ok {
		return cmeta.Lat, cmeta.Lon, true
	}
	return 0, 0, false
}

// GetCustomersOverview returns executive KPIs, 30-day registration series, country stats, and OSM clusters.
func (h *CustomersHandler) GetCustomersOverview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ensureCustomerGeoColumns(r.Context())

	rows, err := db.Pool.Query(r.Context(), `
		SELECT
			u.id,
			TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS full_name,
			u.email,
			u.created_at,
			COALESCE(u.email_verified, false),
			COALESCE(u.is_blocked, false),
			COALESCE(u.country_code, ''),
			COALESCE(u.country_name, ''),
			COALESCE(u.city, ''),
			COALESCE(u.region_name, ''),
			u.latitude,
			u.longitude,
			COALESCE(u.geo_source, ''),
			GREATEST(
				u.created_at,
				COALESCE((SELECT MAX(lh.login_at) FROM identity.user_login_history lh WHERE lh.user_id = u.id), u.created_at),
				COALESCE((
					SELECT MAX(me.created_at)
					FROM analytics.member_events me
					WHERE me.user_id = u.id
					   OR me.visitor_id IN (SELECT uvl.visitor_id FROM analytics.user_visitor_links uvl WHERE uvl.user_id = u.id)
				), u.created_at),
				COALESCE((
					SELECT MAX(pv.created_at)
					FROM analytics.page_views pv
					WHERE COALESCE(pv.is_bot, false) = false
					  AND (
						pv.user_id = u.id
						OR pv.visitor_id IN (SELECT uvl2.visitor_id FROM analytics.user_visitor_links uvl2 WHERE uvl2.user_id = u.id)
					  )
				), u.created_at)
			) AS last_active_at,
			(
				COALESCE((SELECT COUNT(*) FROM catalog.orders o WHERE o.user_id = u.id), 0) +
				COALESCE((SELECT COUNT(*) FROM catalog.store_inquiries si WHERE LOWER(si.email) = LOWER(u.email)), 0)
			)::int AS orders_count,
			(
				COALESCE((SELECT SUM(CASE WHEN COALESCE(o.total_amount_try, 0) > 0 THEN o.total_amount_try ELSE o.total_amount END) FROM catalog.orders o WHERE o.user_id = u.id), 0) +
				COALESCE((SELECT SUM(ii.quantity * ii.price) FROM catalog.store_inquiry_items ii INNER JOIN catalog.store_inquiries si ON ii.inquiry_id = si.id WHERE LOWER(si.email) = LOWER(u.email)), 0)
			)::double precision AS orders_total_amount,
			COALESCE((SELECT SUM(ci.quantity)::int FROM catalog.cart_items ci INNER JOIN catalog.carts ca ON ci.cart_id = ca.id WHERE ca.user_id = u.id), 0) AS cart_items_count
		FROM identity.users u
		WHERE u.user_role = 'customer'
		ORDER BY u.created_at DESC
	`)
	if err != nil {
		log.Printf("[ADMIN CUSTOMERS OVERVIEW ERROR] Query failed: %v", err)
		http.Error(w, `{"error":"Müşteri özeti alınırken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	list := make([]customerOverviewRow, 0, 128)
	hasUnresolved := false

	for rows.Next() {
		var row customerOverviewRow
		if scanErr := rows.Scan(
			&row.ID, &row.Name, &row.Email, &row.CreatedAt, &row.Verified, &row.Blocked,
			&row.CountryCode, &row.CountryName, &row.City, &row.RegionName, &row.Lat, &row.Lon, &row.GeoSource,
			&row.LastActive, &row.OrdersCount, &row.TotalSpend, &row.CartItems,
		); scanErr != nil {
			log.Printf("[ADMIN CUSTOMERS OVERVIEW ERROR] Row scan failed: %v", scanErr)
			continue
		}
		if row.Name == "" {
			row.Name = row.Email
		}
		if NormalizeISO2(row.CountryCode) == "" || row.Lat == nil || row.Lon == nil || cleanGeoLabel(row.City) == "" {
			hasUnresolved = true
		}
		list = append(list, row)
	}

	if hasUnresolved {
		TriggerCustomerGeoBackfillAsync()
	}

	overview := aggregateCustomerOverview(list, time.Now())

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(overview)
}

// SyncCustomerGeo runs an immediate synchronous GeoIP/phone backfill pass for unresolved customers.
func (h *CustomersHandler) SyncCustomerGeo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	updated, err := BackfillUnresolvedCustomerGeo(ctx)
	if err != nil {
		log.Printf("[ADMIN CUSTOMERS GEO SYNC ERROR] Failed: %v", err)
		http.Error(w, `{"error":"Müşteri konum senkronizasyonu başarısız oldu"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success":          true,
		"updated_count":    updated,
		"resolved_at":      time.Now().UTC().Format(time.RFC3339),
	})
}
