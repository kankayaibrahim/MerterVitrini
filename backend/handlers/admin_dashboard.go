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

// GetDashboardStats aggregates all executive KPIs for the admin dashboard
func (h *AdminDashboardHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

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

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(stats)
}

func (h *AdminDashboardHandler) loadFinancials(ctx context.Context, stats *ExecutiveDashboardStats) {
	finQuery := `
		SELECT 
			COUNT(*),
			COALESCE(SUM(total_amount), 0),
			COUNT(*) FILTER (WHERE order_status = 'PENDING'),
			COUNT(*) FILTER (WHERE order_status = 'APPROVED'),
			COUNT(*) FILTER (WHERE order_status = 'SHIPPED')
		FROM catalog.orders
	`
	_ = db.Pool.QueryRow(ctx, finQuery).Scan(
		&stats.Financials.TotalOrders,
		&stats.Financials.TotalRevenue,
		&stats.Financials.PendingOrders,
		&stats.Financials.ApprovedOrders,
		&stats.Financials.ShippedOrders,
	)
	if stats.Financials.TotalOrders > 0 {
		stats.Financials.AvgOrderValue = stats.Financials.TotalRevenue / float64(stats.Financials.TotalOrders)
	}
}

func (h *AdminDashboardHandler) loadCatalogAndApps(ctx context.Context, stats *ExecutiveDashboardStats) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(total_stock), 0)
		FROM catalog.products
		WHERE is_active = true
	`).Scan(&stats.Catalog.ActiveProducts, &stats.Catalog.TotalStockUnits)

	_ = db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM catalog.brands`).Scan(&stats.Catalog.ActiveBrands)

	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM catalog.supplier_applications 
		WHERE LOWER(status) = 'pending'
	`).Scan(&stats.Catalog.PendingApps)
}

func (h *AdminDashboardHandler) loadTraffic(ctx context.Context, stats *ExecutiveDashboardStats) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT session_id) 
		FROM analytics.page_views 
		WHERE created_at >= NOW() - INTERVAL '15 minutes'
	`).Scan(&stats.Traffic.LiveVisitors15m)

	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT session_id), COUNT(*) 
		FROM analytics.page_views 
		WHERE created_at >= CURRENT_DATE
	`).Scan(&stats.Traffic.TodayVisitors, &stats.Traffic.TodayPageViews)
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
			COALESCE(TRIM(CONCAT(u.first_name, ' ', u.last_name)), 'B2B Müşterisi') as customer_name,
			COALESCE(u.email, '') as customer_email,
			o.total_amount,
			'TRY' as currency,
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
			COALESCE(city, '') as city,
			COALESCE(category, '') as category,
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
