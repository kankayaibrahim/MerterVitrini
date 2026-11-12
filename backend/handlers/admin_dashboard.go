package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
)

type AdminDashboardHandler struct {
	Cfg *config.Config
}

func NewAdminDashboardHandler(cfg *config.Config) *AdminDashboardHandler {
	return &AdminDashboardHandler{Cfg: cfg}
}

type DashboardFinancials struct {
	TotalRevenue   float64 `json:"total_revenue"`
	TotalOrders    int     `json:"total_orders"`
	PendingOrders  int     `json:"pending_orders"`
	ApprovedOrders int     `json:"approved_orders"`
	ShippedOrders  int     `json:"shipped_orders"`
	AvgOrderValue  float64 `json:"avg_order_value"`
}

type DashboardCatalog struct {
	ActiveProducts  int `json:"active_products"`
	TotalStockUnits int `json:"total_stock_units"`
	ActiveBrands    int `json:"active_brands"`
	PendingApps     int `json:"pending_apps"`
}

type DashboardTraffic struct {
	LiveVisitors15m int `json:"live_visitors_15m"`
	TodayVisitors   int `json:"today_visitors"`
	TodayPageViews  int `json:"today_pageviews"`
}

type DashboardExchangeRate struct {
	CurrencyCode    string  `json:"currency_code"`
	BuyingRate      float64 `json:"buying_rate"`
	SellingRate     float64 `json:"selling_rate"`
	PublicationDate string  `json:"publication_date"`
}

type DashboardOrderSummary struct {
	ID            string    `json:"id"`
	OrderNumber   string    `json:"order_number"`
	CustomerName  string    `json:"customer_name"`
	CustomerEmail string    `json:"customer_email"`
	TotalAmount   float64   `json:"total_amount"`
	Currency      string    `json:"currency"`
	PaymentMethod string    `json:"payment_method"`
	OrderStatus   string    `json:"order_status"`
	CreatedAt     time.Time `json:"created_at"`
}

type DashboardApplicationSummary struct {
	ID          string    `json:"id"`
	CompanyName string    `json:"company_name"`
	ContactName string    `json:"contact_name"`
	Email       string    `json:"email"`
	Phone       string    `json:"phone"`
	City        string    `json:"city"`
	Category    string    `json:"category"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

type ExecutiveDashboardStats struct {
	Financials          DashboardFinancials           `json:"financials"`
	Catalog             DashboardCatalog              `json:"catalog"`
	Traffic             DashboardTraffic              `json:"traffic"`
	ExchangeRates       []DashboardExchangeRate       `json:"exchange_rates"`
	RecentOrders        []DashboardOrderSummary       `json:"recent_orders"`
	PendingApplications []DashboardApplicationSummary `json:"pending_applications"`
}

// GetDashboardStats aggregates all executive KPIs for the admin dashboard.
func (h *AdminDashboardHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	ensureAnalyticsSchema(ctx)

	stats := ExecutiveDashboardStats{
		ExchangeRates:       []DashboardExchangeRate{},
		RecentOrders:        []DashboardOrderSummary{},
		PendingApplications: []DashboardApplicationSummary{},
	}

	h.loadFinancials(ctx, &stats)
	h.loadCatalogAndApps(ctx, &stats)
	h.loadTraffic(ctx, &stats)
	h.loadExchangeRates(ctx, &stats)
	h.loadRecentOrders(ctx, &stats)
	h.loadPendingApplications(ctx, &stats)

	w.Header().Set(headerContentType, "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(stats)
}

func (h *AdminDashboardHandler) loadFinancials(ctx context.Context, stats *ExecutiveDashboardStats) {
	finQuery := `
		WITH latest_rates AS (
			SELECT DISTINCT ON (UPPER(currency_code))
				UPPER(currency_code) AS code,
				buying_rate
			FROM catalog.exchange_rates
			ORDER BY UPPER(currency_code), publication_date DESC
		),
		orders_norm AS (
			SELECT
				o.order_status,
				CASE
					WHEN UPPER(COALESCE(o.order_status, '')) = 'CANCELLED' THEN 0::numeric
					WHEN UPPER(COALESCE(o.currency, 'TRY')) NOT IN ('TRY', 'TL', '') THEN
						o.total_amount * COALESCE((SELECT lr.buying_rate FROM latest_rates lr WHERE lr.code = UPPER(o.currency)), 1.0)
					WHEN EXISTS (SELECT 1 FROM catalog.order_items oi WHERE oi.order_id = o.id) THEN
						COALESCE((
							SELECT SUM(
								oi.price_at_purchase * oi.quantity * CASE
									WHEN UPPER(COALESCE(p.currency, 'TRY')) IN ('TRY', 'TL', '') THEN 1.0
									ELSE COALESCE((SELECT lr2.buying_rate FROM latest_rates lr2 WHERE lr2.code = UPPER(p.currency)), 1.0)
								END
							)
							FROM catalog.order_items oi
							LEFT JOIN catalog.products p ON p.id = oi.product_id
							WHERE oi.order_id = o.id
						), o.total_amount)
					ELSE o.total_amount
				END AS try_revenue
			FROM catalog.orders o
		)
		SELECT
			COUNT(*),
			COALESCE(SUM(try_revenue)::float8, 0),
			COUNT(*) FILTER (WHERE order_status IN ('PENDING', 'PENDING_PAYMENT')),
			COUNT(*) FILTER (WHERE order_status = 'APPROVED'),
			COUNT(*) FILTER (WHERE order_status = 'SHIPPED'),
			COUNT(*) FILTER (WHERE UPPER(COALESCE(order_status, '')) <> 'CANCELLED')
		FROM orders_norm
	`
	var nonCancelledOrders int
	_ = db.Pool.QueryRow(ctx, finQuery).Scan(
		&stats.Financials.TotalOrders,
		&stats.Financials.TotalRevenue,
		&stats.Financials.PendingOrders,
		&stats.Financials.ApprovedOrders,
		&stats.Financials.ShippedOrders,
		&nonCancelledOrders,
	)
	stats.Financials.TotalRevenue = round2(stats.Financials.TotalRevenue)
	if nonCancelledOrders > 0 {
		stats.Financials.AvgOrderValue = round2(stats.Financials.TotalRevenue / float64(nonCancelledOrders))
	}
}

func (h *AdminDashboardHandler) loadCatalogAndApps(ctx context.Context, stats *ExecutiveDashboardStats) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(stock), 0)
		FROM catalog.products
		WHERE is_active = true
	`).Scan(&stats.Catalog.ActiveProducts, &stats.Catalog.TotalStockUnits)

	_ = db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM catalog.brands WHERE is_active = true`).Scan(&stats.Catalog.ActiveBrands)

	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM catalog.supplier_applications 
		WHERE LOWER(status) = 'pending'
	`).Scan(&stats.Catalog.PendingApps)
}

func (h *AdminDashboardHandler) loadTraffic(ctx context.Context, stats *ExecutiveDashboardStats) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '15 minutes' THEN visitor_id END), 0),
			COALESCE(COUNT(DISTINCT CASE WHEN (created_at AT TIME ZONE 'Europe/Istanbul')::date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN visitor_id END), 0),
			COALESCE(COUNT(CASE WHEN (created_at AT TIME ZONE 'Europe/Istanbul')::date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN 1 END), 0)
		FROM analytics.page_views
		WHERE COALESCE(is_bot, false) = false
		  AND created_at >= LEAST(
		      NOW() - INTERVAL '15 minutes',
		      (DATE_TRUNC('day', NOW() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')
		  )
	`).Scan(
		&stats.Traffic.LiveVisitors15m,
		&stats.Traffic.TodayVisitors,
		&stats.Traffic.TodayPageViews,
	)
}

func (h *AdminDashboardHandler) loadExchangeRates(ctx context.Context, stats *ExecutiveDashboardStats) {
	ratesQuery := `
		SELECT currency_code, buying_rate, selling_rate, TO_CHAR(publication_date, 'YYYY-MM-DD')
		FROM catalog.exchange_rates
		WHERE publication_date = (SELECT MAX(publication_date) FROM catalog.exchange_rates)
		  AND currency_code IN ('USD', 'EUR', 'GBP', 'RUB', 'CHF')
		ORDER BY currency_code
	`
	rows, err := db.Pool.Query(ctx, ratesQuery)
	if err != nil {
		log.Printf("[DASHBOARD] Exchange rates query error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var r DashboardExchangeRate
		if scanErr := rows.Scan(&r.CurrencyCode, &r.BuyingRate, &r.SellingRate, &r.PublicationDate); scanErr == nil {
			stats.ExchangeRates = append(stats.ExchangeRates, r)
		}
	}
}

func (h *AdminDashboardHandler) loadRecentOrders(ctx context.Context, stats *ExecutiveDashboardStats) {
	ordersQuery := `
		SELECT 
			o.id,
			o.order_number,
			COALESCE(NULLIF(TRIM(o.customer_name), ''), NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), 'B2B Müşterisi') AS customer_name,
			COALESCE(NULLIF(o.customer_email, ''), COALESCE(u.email, '')) AS customer_email,
			o.total_amount,
			COALESCE(
				NULLIF(UPPER(o.currency), 'TRY'),
				(
					SELECT UPPER(p.currency)
					FROM catalog.order_items oi
					JOIN catalog.products p ON p.id = oi.product_id
					WHERE oi.order_id = o.id AND p.currency IS NOT NULL AND p.currency <> ''
					LIMIT 1
				),
				'TRY'
			) AS currency,
			o.payment_method,
			o.order_status,
			o.created_at
		FROM catalog.orders o
		LEFT JOIN identity.users u ON o.user_id = u.id
		ORDER BY o.created_at DESC
		LIMIT 6
	`
	rows, err := db.Pool.Query(ctx, ordersQuery)
	if err != nil {
		log.Printf("[DASHBOARD] Recent orders query error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var o DashboardOrderSummary
		if scanErr := rows.Scan(
			&o.ID,
			&o.OrderNumber,
			&o.CustomerName,
			&o.CustomerEmail,
			&o.TotalAmount,
			&o.Currency,
			&o.PaymentMethod,
			&o.OrderStatus,
			&o.CreatedAt,
		); scanErr == nil {
			stats.RecentOrders = append(stats.RecentOrders, o)
		}
	}
}

func (h *AdminDashboardHandler) loadPendingApplications(ctx context.Context, stats *ExecutiveDashboardStats) {
	appsQuery := `
		SELECT 
			id,
			company_name,
			contact_name,
			email,
			phone,
			COALESCE(city, '') AS city,
			COALESCE(category, '') AS category,
			status,
			created_at
		FROM catalog.supplier_applications
		ORDER BY created_at DESC
		LIMIT 5
	`
	rows, err := db.Pool.Query(ctx, appsQuery)
	if err != nil {
		log.Printf("[DASHBOARD] Pending apps query error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var a DashboardApplicationSummary
		if scanErr := rows.Scan(
			&a.ID,
			&a.CompanyName,
			&a.ContactName,
			&a.Email,
			&a.Phone,
			&a.City,
			&a.Category,
			&a.Status,
			&a.CreatedAt,
		); scanErr == nil {
			stats.PendingApplications = append(stats.PendingApplications, a)
		}
	}
}
