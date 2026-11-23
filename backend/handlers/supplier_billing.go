package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
)

type SubscriptionPlanDTO struct {
	ID           string   `json:"id"`
	Code         string   `json:"code"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	MonthlyPrice float64  `json:"monthly_price"`
	YearlyPrice  float64  `json:"yearly_price"`
	Currency     string   `json:"currency"`
	TaxRate      float64  `json:"tax_rate"`
	MaxProducts  int      `json:"max_products"`
	Features     []string `json:"features"`
	IsActive     bool     `json:"is_active"`
	DisplayOrder int      `json:"display_order"`
}

type SupplierSubscriptionDTO struct {
	ID                  string     `json:"id"`
	BrandID             string     `json:"brand_id"`
	BrandName           string     `json:"brand_name"`
	AliasCode           string     `json:"alias_code"`
	PlanCode            string     `json:"plan_code"`
	PlanName            string     `json:"plan_name"`
	BillingCycle        string     `json:"billing_cycle"`
	Status              string     `json:"status"`
	IsComplimentary     bool       `json:"is_complimentary"`
	AgreedPrice         float64    `json:"agreed_price"`
	Currency            string     `json:"currency"`
	MaxProducts         int        `json:"max_products"`
	ActiveProductsCount int        `json:"active_products_count"`
	CurrentPeriodStart  time.Time  `json:"current_period_start"`
	CurrentPeriodEnd    time.Time  `json:"current_period_end"`
	NextBillingDate     *time.Time `json:"next_billing_date,omitempty"`
	AutoRenew           bool       `json:"auto_renew"`
	TotalPaidAmount     float64    `json:"total_paid_amount"`
	TotalInvoicedAmount float64    `json:"total_invoiced_amount"`
	OutstandingBalance  float64    `json:"outstanding_balance"`
	BillingCompanyTitle string     `json:"billing_company_title"`
	TaxOffice           string     `json:"tax_office"`
	TaxNumber                string     `json:"tax_number"`
	BillingAddress           string     `json:"billing_address"`
	BillingEmail             string     `json:"billing_email"`
	StoryEntitlementOverride *bool      `json:"story_entitlement_override,omitempty"`
	StoryDailyLimitOverride  *int       `json:"story_daily_limit_override,omitempty"`
	Notes                    string     `json:"notes"`
	UpdatedAt                time.Time  `json:"updated_at"`
}

type SupplierInvoiceDTO struct {
	ID                  string     `json:"id"`
	InvoiceNumber       string     `json:"invoice_number"`
	BrandID             string     `json:"brand_id"`
	BrandName           string     `json:"brand_name"`
	InvoiceType         string     `json:"invoice_type"`
	PlanCode            string     `json:"plan_code"`
	PeriodLabel         string     `json:"period_label"`
	SubtotalAmount      float64    `json:"subtotal_amount"`
	TaxRate             float64    `json:"tax_rate"`
	TaxAmount           float64    `json:"tax_amount"`
	DiscountAmount      float64    `json:"discount_amount"`
	TotalAmount         float64    `json:"total_amount"`
	PaidAmount          float64    `json:"paid_amount"`
	Currency            string     `json:"currency"`
	Status              string     `json:"status"`
	BillingCompanyTitle string     `json:"billing_company_title"`
	TaxOffice           string     `json:"tax_office"`
	TaxNumber           string     `json:"tax_number"`
	BillingAddress      string     `json:"billing_address"`
	IssueDate           time.Time  `json:"issue_date"`
	DueDate             time.Time  `json:"due_date"`
	PaidAt              *time.Time `json:"paid_at,omitempty"`
	Notes               string     `json:"notes"`
}

type SupplierPaymentDTO struct {
	ID            string    `json:"id"`
	PaymentNumber string    `json:"payment_number"`
	BrandID       string    `json:"brand_id"`
	BrandName     string    `json:"brand_name"`
	InvoiceID     *string   `json:"invoice_id,omitempty"`
	InvoiceNumber string    `json:"invoice_number,omitempty"`
	PlanCode      string    `json:"plan_code"`
	PeriodMonths  int       `json:"period_months"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	PaymentMethod string    `json:"payment_method"`
	Status        string    `json:"status"`
	SenderName    string    `json:"sender_name"`
	BankReference string    `json:"bank_reference"`
	Notes         string    `json:"notes"`
	ApprovedBy    string    `json:"approved_by"`
	PaidAt        time.Time `json:"paid_at"`
}

type SupplierAccountingLedgerDTO struct {
	ID             string    `json:"id"`
	BrandID        string    `json:"brand_id"`
	BrandName      string    `json:"brand_name"`
	EntryType      string    `json:"entry_type"`
	DebitAmount    float64   `json:"debit_amount"`
	CreditAmount   float64   `json:"credit_amount"`
	RunningBalance float64   `json:"running_balance"`
	Currency       string    `json:"currency"`
	Description    string    `json:"description"`
	CreatedAt      time.Time `json:"created_at"`
}

func fetchSubscriptionPlans(ctx context.Context) ([]SubscriptionPlanDTO, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id::text, code, name, description, monthly_price::float8, yearly_price::float8,
		       currency, tax_rate::float8, max_products, features, is_active, display_order
		FROM catalog.subscription_plans
		WHERE is_active = true
		ORDER BY display_order ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := make([]SubscriptionPlanDTO, 0)
	for rows.Next() {
		var p SubscriptionPlanDTO
		var rawFeatures []byte
		if err := rows.Scan(
			&p.ID, &p.Code, &p.Name, &p.Description, &p.MonthlyPrice, &p.YearlyPrice,
			&p.Currency, &p.TaxRate, &p.MaxProducts, &rawFeatures, &p.IsActive, &p.DisplayOrder,
		); err != nil {
			continue
		}
		_ = json.Unmarshal(rawFeatures, &p.Features)
		if p.Features == nil {
			p.Features = []string{}
		}
		plans = append(plans, p)
	}
	return plans, nil
}

func ensureSupplierSubscription(ctx context.Context, brandID string) error {
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO catalog.supplier_subscriptions (
			brand_id, plan_id, plan_code, billing_cycle, status, is_complimentary, agreed_price,
			billing_company_title, billing_email, billing_address
		)
		SELECT
			b.id,
			(SELECT id FROM catalog.subscription_plans WHERE code = 'FREE' LIMIT 1),
			'FREE',
			'PROMO_FREE',
			'ACTIVE',
			true,
			0.00,
			b.brand_name,
			COALESCE(b.public_email, ''),
			COALESCE(b.location_address, '')
		FROM catalog.brands b
		WHERE b.id = $1::uuid
		ON CONFLICT (brand_id) DO NOTHING
	`, brandID)
	return err
}

func fetchSupplierSubscriptionByBrand(ctx context.Context, brandID string) (*SupplierSubscriptionDTO, error) {
	_ = ensureSupplierSubscription(ctx, brandID)

	var s SupplierSubscriptionDTO
	err := db.Pool.QueryRow(ctx, `
		SELECT
			ss.id::text, ss.brand_id::text, b.brand_name, COALESCE(b.alias_code, ''),
			ss.plan_code, COALESCE(sp.name, 'Ücretsiz Vitrin'),
			ss.billing_cycle, ss.status, ss.is_complimentary,
			ss.agreed_price::float8, ss.currency, COALESCE(sp.max_products, -1),
			(SELECT COUNT(*)::int FROM catalog.products p WHERE p.brand_id = b.id AND p.deleted_at IS NULL),
			ss.current_period_start, ss.current_period_end, ss.next_billing_date, ss.auto_renew,
			ss.total_paid_amount::float8, ss.total_invoiced_amount::float8, ss.outstanding_balance::float8,
			ss.billing_company_title, ss.tax_office, ss.tax_number, ss.billing_address, ss.billing_email,
			ss.story_entitlement_override, ss.story_daily_limit_override, ss.notes, ss.updated_at
		FROM catalog.supplier_subscriptions ss
		JOIN catalog.brands b ON b.id = ss.brand_id
		LEFT JOIN catalog.subscription_plans sp ON sp.code = ss.plan_code
		WHERE ss.brand_id = $1::uuid
	`, brandID).Scan(
		&s.ID, &s.BrandID, &s.BrandName, &s.AliasCode,
		&s.PlanCode, &s.PlanName,
		&s.BillingCycle, &s.Status, &s.IsComplimentary,
		&s.AgreedPrice, &s.Currency, &s.MaxProducts,
		&s.ActiveProductsCount,
		&s.CurrentPeriodStart, &s.CurrentPeriodEnd, &s.NextBillingDate, &s.AutoRenew,
		&s.TotalPaidAmount, &s.TotalInvoicedAmount, &s.OutstandingBalance,
		&s.BillingCompanyTitle, &s.TaxOffice, &s.TaxNumber, &s.BillingAddress, &s.BillingEmail,
		&s.StoryEntitlementOverride, &s.StoryDailyLimitOverride, &s.Notes, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func fetchSupplierInvoices(ctx context.Context, brandID string, limit int) ([]SupplierInvoiceDTO, error) {
	query := `
		SELECT
			i.id::text, i.invoice_number, i.brand_id::text, b.brand_name,
			i.invoice_type, i.plan_code, i.period_label,
			i.subtotal_amount::float8, i.tax_rate::float8, i.tax_amount::float8,
			i.discount_amount::float8, i.total_amount::float8, i.paid_amount::float8,
			i.currency, i.status, i.billing_company_title, i.tax_office, i.tax_number,
			i.billing_address, i.issue_date, i.due_date, i.paid_at, i.notes
		FROM catalog.supplier_invoices i
		JOIN catalog.brands b ON b.id = i.brand_id
	`
	args := []interface{}{}
	if brandID != "" {
		query += ` WHERE i.brand_id = $1::uuid`
		args = append(args, brandID)
	}
	query += fmt.Sprintf(` ORDER BY i.issue_date DESC LIMIT %d`, limit)

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]SupplierInvoiceDTO, 0)
	for rows.Next() {
		var inv SupplierInvoiceDTO
		if err := rows.Scan(
			&inv.ID, &inv.InvoiceNumber, &inv.BrandID, &inv.BrandName,
			&inv.InvoiceType, &inv.PlanCode, &inv.PeriodLabel,
			&inv.SubtotalAmount, &inv.TaxRate, &inv.TaxAmount,
			&inv.DiscountAmount, &inv.TotalAmount, &inv.PaidAmount,
			&inv.Currency, &inv.Status, &inv.BillingCompanyTitle, &inv.TaxOffice, &inv.TaxNumber,
			&inv.BillingAddress, &inv.IssueDate, &inv.DueDate, &inv.PaidAt, &inv.Notes,
		); err == nil {
			list = append(list, inv)
		}
	}
	return list, nil
}

func fetchSupplierPayments(ctx context.Context, brandID string, limit int) ([]SupplierPaymentDTO, error) {
	query := `
		SELECT
			p.id::text, p.payment_number, p.brand_id::text, b.brand_name,
			p.invoice_id::text, COALESCE(inv.invoice_number, ''),
			p.plan_code, p.period_months, p.amount::float8, p.currency,
			p.payment_method, p.status, p.sender_name, p.bank_reference,
			p.notes, p.approved_by, p.paid_at
		FROM catalog.supplier_subscription_payments p
		JOIN catalog.brands b ON b.id = p.brand_id
		LEFT JOIN catalog.supplier_invoices inv ON inv.id = p.invoice_id
	`
	args := []interface{}{}
	if brandID != "" {
		query += ` WHERE p.brand_id = $1::uuid`
		args = append(args, brandID)
	}
	query += fmt.Sprintf(` ORDER BY p.paid_at DESC LIMIT %d`, limit)

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]SupplierPaymentDTO, 0)
	for rows.Next() {
		var pay SupplierPaymentDTO
		if err := rows.Scan(
			&pay.ID, &pay.PaymentNumber, &pay.BrandID, &pay.BrandName,
			&pay.InvoiceID, &pay.InvoiceNumber,
			&pay.PlanCode, &pay.PeriodMonths, &pay.Amount, &pay.Currency,
			&pay.PaymentMethod, &pay.Status, &pay.SenderName, &pay.BankReference,
			&pay.Notes, &pay.ApprovedBy, &pay.PaidAt,
		); err == nil {
			list = append(list, pay)
		}
	}
	return list, nil
}

func fetchSupplierAccountingLedger(ctx context.Context, brandID string, limit int) ([]SupplierAccountingLedgerDTO, error) {
	query := `
		SELECT
			l.id::text, l.brand_id::text, b.brand_name,
			l.entry_type, l.debit_amount::float8, l.credit_amount::float8,
			l.running_balance::float8, l.currency, l.description, l.created_at
		FROM catalog.supplier_accounting_ledger l
		JOIN catalog.brands b ON b.id = l.brand_id
	`
	args := []interface{}{}
	if brandID != "" {
		query += ` WHERE l.brand_id = $1::uuid`
		args = append(args, brandID)
	}
	query += fmt.Sprintf(` ORDER BY l.created_at DESC LIMIT %d`, limit)

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]SupplierAccountingLedgerDTO, 0)
	for rows.Next() {
		var item SupplierAccountingLedgerDTO
		if err := rows.Scan(
			&item.ID, &item.BrandID, &item.BrandName,
			&item.EntryType, &item.DebitAmount, &item.CreditAmount,
			&item.RunningBalance, &item.Currency, &item.Description, &item.CreatedAt,
		); err == nil {
			list = append(list, item)
		}
	}
	return list, nil
}

// GetSupplierBilling returns the authenticated supplier's subscription, plans, invoices, payments, and ledger.
func (h *MarketplaceHandler) GetSupplierBilling(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || claims.BrandID == "" {
		http.Error(w, `{"error":"Tedarikçi oturumu doğrulanamadı"}`, http.StatusUnauthorized)
		return
	}
	brandID := claims.BrandID

	ctx := r.Context()
	sub, err := fetchSupplierSubscriptionByBrand(ctx, brandID)
	if err != nil {
		http.Error(w, `{"error":"Abonelik bilgileri alınamadı"}`, http.StatusInternalServerError)
		return
	}
	plans, _ := fetchSubscriptionPlans(ctx)
	invoices, _ := fetchSupplierInvoices(ctx, brandID, 50)
	payments, _ := fetchSupplierPayments(ctx, brandID, 50)
	ledger, _ := fetchSupplierAccountingLedger(ctx, brandID, 100)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"subscription": sub,
		"plans":        plans,
		"invoices":     invoices,
		"payments":     payments,
		"ledger":       ledger,
	})
}

// UpdateSupplierBillingTaxInfo allows a supplier to update their official tax & invoice address details.
func (h *MarketplaceHandler) UpdateSupplierBillingTaxInfo(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || claims.BrandID == "" {
		http.Error(w, `{"error":"Tedarikçi oturumu doğrulanamadı"}`, http.StatusUnauthorized)
		return
	}
	brandID := claims.BrandID

	var req struct {
		BillingCompanyTitle string `json:"billing_company_title"`
		TaxOffice           string `json:"tax_office"`
		TaxNumber           string `json:"tax_number"`
		BillingAddress      string `json:"billing_address"`
		BillingEmail        string `json:"billing_email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek formatı"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	_ = ensureSupplierSubscription(ctx, brandID)
	_, err := db.Pool.Exec(ctx, `
		UPDATE catalog.supplier_subscriptions
		SET billing_company_title = $1,
		    tax_office = $2,
		    tax_number = $3,
		    billing_address = $4,
		    billing_email = $5,
		    updated_at = NOW()
		WHERE brand_id = $6::uuid
	`,
		strings.TrimSpace(req.BillingCompanyTitle),
		strings.TrimSpace(req.TaxOffice),
		strings.TrimSpace(req.TaxNumber),
		strings.TrimSpace(req.BillingAddress),
		strings.TrimSpace(req.BillingEmail),
		brandID,
	)
	if err != nil {
		http.Error(w, `{"error":"Fatura bilgileri kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Resmi fatura ve vergi bilgileriniz güncellendi."})
}

// CreateSupplierSubscriptionPayment allows a supplier to submit a monthly subscription / ad payment notification.
func (h *MarketplaceHandler) CreateSupplierSubscriptionPayment(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || claims.BrandID == "" {
		http.Error(w, `{"error":"Tedarikçi oturumu doğrulanamadı"}`, http.StatusUnauthorized)
		return
	}
	brandID := claims.BrandID

	var req struct {
		PlanCode      string  `json:"plan_code"`
		PeriodMonths  int     `json:"period_months"`
		Amount        float64 `json:"amount"`
		PaymentMethod string  `json:"payment_method"`
		SenderName    string  `json:"sender_name"`
		BankReference string  `json:"bank_reference"`
		Notes         string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz ödeme bildirimi verisi"}`, http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 {
		http.Error(w, `{"error":"Ödeme tutarı 0'dan büyük olmalıdır"}`, http.StatusBadRequest)
		return
	}
	if req.PeriodMonths <= 0 {
		req.PeriodMonths = 1
	}
	if req.PlanCode == "" {
		req.PlanCode = "PRO"
	}
	if req.PaymentMethod == "" {
		req.PaymentMethod = "BANK_TRANSFER"
	}

	payNum := fmt.Sprintf("MV-THS-%s-%d", time.Now().Format("20060102"), time.Now().Unix()%100000)
	var id string
	err := db.Pool.QueryRow(r.Context(), `
		INSERT INTO catalog.supplier_subscription_payments (
			payment_number, brand_id, plan_code, period_months, amount, currency,
			payment_method, status, sender_name, bank_reference, notes, paid_at
		) VALUES ($1, $2::uuid, $3, $4, $5, 'TRY', $6, 'PENDING_APPROVAL', $7, $8, $9, NOW())
		RETURNING id::text
	`,
		payNum, brandID, req.PlanCode, req.PeriodMonths, req.Amount,
		req.PaymentMethod, strings.TrimSpace(req.SenderName), strings.TrimSpace(req.BankReference), strings.TrimSpace(req.Notes),
	).Scan(&id)
	if err != nil {
		http.Error(w, `{"error":"Ödeme bildirimi kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"id":             id,
		"payment_number": payNum,
		"message":        "Ödeme bildiriminiz alındı. Muhasebe onayından sonra faturanız ve paketiniz aktifleşecektir.",
	})
}

// GetAdminBillingOverview returns the complete accounting, subscriptions, invoices, and payments overview for Admin.
func (h *MarketplaceHandler) GetAdminBillingOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Ensure all brands have a subscription record
	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO catalog.supplier_subscriptions (
			brand_id, plan_id, plan_code, billing_cycle, status, is_complimentary, agreed_price,
			billing_company_title, billing_email, billing_address
		)
		SELECT
			b.id,
			(SELECT id FROM catalog.subscription_plans WHERE code = 'FREE' LIMIT 1),
			'FREE', 'PROMO_FREE', 'ACTIVE', true, 0.00,
			b.brand_name, COALESCE(b.public_email, ''), COALESCE(b.location_address, '')
		FROM catalog.brands b
		ON CONFLICT (brand_id) DO NOTHING
	`)

	plans, _ := fetchSubscriptionPlans(ctx)
	invoices, _ := fetchSupplierInvoices(ctx, "", 100)
	payments, _ := fetchSupplierPayments(ctx, "", 100)
	ledger, _ := fetchSupplierAccountingLedger(ctx, "", 100)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			ss.id::text, ss.brand_id::text, b.brand_name, COALESCE(b.alias_code, ''),
			ss.plan_code, COALESCE(sp.name, 'Ücretsiz Vitrin'),
			ss.billing_cycle, ss.status, ss.is_complimentary,
			ss.agreed_price::float8, ss.currency, COALESCE(sp.max_products, -1),
			(SELECT COUNT(*)::int FROM catalog.products p WHERE p.brand_id = b.id AND p.deleted_at IS NULL),
			ss.current_period_start, ss.current_period_end, ss.next_billing_date, ss.auto_renew,
			ss.total_paid_amount::float8, ss.total_invoiced_amount::float8, ss.outstanding_balance::float8,
			ss.billing_company_title, ss.tax_office, ss.tax_number, ss.billing_address, ss.billing_email,
			ss.story_entitlement_override, ss.story_daily_limit_override, ss.notes, ss.updated_at
		FROM catalog.supplier_subscriptions ss
		JOIN catalog.brands b ON b.id = ss.brand_id
		LEFT JOIN catalog.subscription_plans sp ON sp.code = ss.plan_code
		ORDER BY ss.total_paid_amount DESC, b.brand_name ASC
	`)
	subscriptions := make([]SupplierSubscriptionDTO, 0)
	var totalCollected, totalInvoiced, totalOutstanding float64
	var paidCount, freeCount int
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s SupplierSubscriptionDTO
			if scanErr := rows.Scan(
				&s.ID, &s.BrandID, &s.BrandName, &s.AliasCode,
				&s.PlanCode, &s.PlanName,
				&s.BillingCycle, &s.Status, &s.IsComplimentary,
				&s.AgreedPrice, &s.Currency, &s.MaxProducts,
				&s.ActiveProductsCount,
				&s.CurrentPeriodStart, &s.CurrentPeriodEnd, &s.NextBillingDate, &s.AutoRenew,
				&s.TotalPaidAmount, &s.TotalInvoicedAmount, &s.OutstandingBalance,
				&s.BillingCompanyTitle, &s.TaxOffice, &s.TaxNumber, &s.BillingAddress, &s.BillingEmail,
				&s.StoryEntitlementOverride, &s.StoryDailyLimitOverride, &s.Notes, &s.UpdatedAt,
			); scanErr == nil {
				subscriptions = append(subscriptions, s)
				totalCollected += s.TotalPaidAmount
				totalInvoiced += s.TotalInvoicedAmount
				totalOutstanding += s.OutstandingBalance
				if !s.IsComplimentary && s.PlanCode != "FREE" {
					paidCount++
				} else {
					freeCount++
				}
			}
		}
	}

	var pendingPaymentsCount int
	_ = db.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM catalog.supplier_subscription_payments WHERE status = 'PENDING_APPROVAL'`).Scan(&pendingPaymentsCount)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"summary": map[string]interface{}{
			"total_collected_amount":   totalCollected,
			"total_invoiced_amount":    totalInvoiced,
			"total_outstanding_amount": totalOutstanding,
			"pending_payments_count":   pendingPaymentsCount,
			"total_suppliers_count":    len(subscriptions),
			"paid_suppliers_count":     paidCount,
			"free_suppliers_count":     freeCount,
		},
		"plans":         plans,
		"subscriptions": subscriptions,
		"invoices":      invoices,
		"payments":      payments,
		"ledger":        ledger,
	})
}

// UpdateAdminSupplierSubscription updates a supplier's subscription tier, complimentary flag, agreed price, and tax info.
func (h *MarketplaceHandler) UpdateAdminSupplierSubscription(w http.ResponseWriter, r *http.Request) {
	brandID := r.PathValue("brand_id")
	if brandID == "" {
		http.Error(w, `{"error":"brand_id gerekli"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		PlanCode                 string  `json:"plan_code"`
		BillingCycle             string  `json:"billing_cycle"`
		Status                   string  `json:"status"`
		IsComplimentary          bool    `json:"is_complimentary"`
		AgreedPrice              float64 `json:"agreed_price"`
		ExtendMonths             int     `json:"extend_months"`
		BillingCompanyTitle      string  `json:"billing_company_title"`
		TaxOffice                string  `json:"tax_office"`
		TaxNumber                string  `json:"tax_number"`
		BillingAddress           string  `json:"billing_address"`
		BillingEmail             string  `json:"billing_email"`
		StoryEntitlementOverride *bool   `json:"story_entitlement_override"`
		StoryDailyLimitOverride  *int    `json:"story_daily_limit_override"`
		Notes                    string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz veri"}`, http.StatusBadRequest)
		return
	}
	if req.StoryDailyLimitOverride != nil && (*req.StoryDailyLimitOverride < 1 || *req.StoryDailyLimitOverride > 50) {
		http.Error(w, `{"error":"Özel hikaye limiti 1 ile 50 arasında olmalıdır"}`, http.StatusBadRequest)
		return
	}
	if req.PlanCode == "" {
		req.PlanCode = "FREE"
	}
	if req.BillingCycle == "" {
		req.BillingCycle = "MONTHLY"
	}
	if req.Status == "" {
		req.Status = "ACTIVE"
	}

	ctx := r.Context()
	_ = ensureSupplierSubscription(ctx, brandID)

	periodEndSQL := "current_period_end"
	if req.ExtendMonths > 0 {
		periodEndSQL = fmt.Sprintf("GREATEST(current_period_end, NOW()) + INTERVAL '%d months'", req.ExtendMonths)
	}

	query := fmt.Sprintf(`
		UPDATE catalog.supplier_subscriptions
		SET plan_code = $1,
		    plan_id = (SELECT id FROM catalog.subscription_plans WHERE code = $1 LIMIT 1),
		    billing_cycle = $2,
		    status = $3,
		    is_complimentary = $4,
		    agreed_price = $5,
		    billing_company_title = $6,
		    tax_office = $7,
		    tax_number = $8,
		    billing_address = $9,
		    billing_email = $10,
		    story_entitlement_override = $11,
		    story_daily_limit_override = $12,
		    notes = $13,
		    current_period_end = %s,
		    updated_at = NOW()
		WHERE brand_id = $14::uuid
	`, periodEndSQL)

	_, err := db.Pool.Exec(ctx, query,
		req.PlanCode, req.BillingCycle, req.Status, req.IsComplimentary, req.AgreedPrice,
		strings.TrimSpace(req.BillingCompanyTitle), strings.TrimSpace(req.TaxOffice),
		strings.TrimSpace(req.TaxNumber), strings.TrimSpace(req.BillingAddress),
		strings.TrimSpace(req.BillingEmail), req.StoryEntitlementOverride, req.StoryDailyLimitOverride,
		strings.TrimSpace(req.Notes), brandID,
	)
	if err != nil {
		http.Error(w, `{"error":"Abonelik güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Tedarikçi abonelik ve muhasebe kartı güncellendi."})
}

func appendAccountingLedgerEntry(ctx context.Context, tx pgx.Tx, brandID string, invoiceID, paymentID *string, entryType string, debit, credit float64, desc string) error {
	var currentBalance float64
	_ = tx.QueryRow(ctx, `
		SELECT COALESCE(outstanding_balance, 0)::float8
		FROM catalog.supplier_subscriptions
		WHERE brand_id = $1::uuid
	`, brandID).Scan(&currentBalance)

	nextBalance := math.Round((currentBalance+debit-credit)*100) / 100
	_, err := tx.Exec(ctx, `
		INSERT INTO catalog.supplier_accounting_ledger (
			brand_id, invoice_id, payment_id, entry_type, debit_amount, credit_amount, running_balance, currency, description
		) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, 'TRY', $8)
	`, brandID, invoiceID, paymentID, entryType, debit, credit, nextBalance, desc)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		UPDATE catalog.supplier_subscriptions
		SET total_invoiced_amount = total_invoiced_amount + $1,
		    total_paid_amount = total_paid_amount + $2,
		    outstanding_balance = $3,
		    updated_at = NOW()
		WHERE brand_id = $4::uuid
	`, debit, credit, nextBalance, brandID)
	return err
}

// CreateAdminSupplierInvoice issues a new subscription or advertising invoice for a supplier and updates the accounting ledger.
func (h *MarketplaceHandler) CreateAdminSupplierInvoice(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BrandID        string  `json:"brand_id"`
		InvoiceType    string  `json:"invoice_type"`
		PlanCode       string  `json:"plan_code"`
		PeriodLabel    string  `json:"period_label"`
		SubtotalAmount float64 `json:"subtotal_amount"`
		TaxRate        float64 `json:"tax_rate"`
		DiscountAmount float64 `json:"discount_amount"`
		MarkAsPaid     bool    `json:"mark_as_paid"`
		PaymentMethod  string  `json:"payment_method"`
		Notes          string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.BrandID == "" {
		http.Error(w, `{"error":"brand_id ve fatura bilgileri gereklidir"}`, http.StatusBadRequest)
		return
	}
	if req.InvoiceType == "" {
		req.InvoiceType = "SUBSCRIPTION"
	}
	if req.PlanCode == "" {
		req.PlanCode = "PRO"
	}
	if req.TaxRate <= 0 {
		req.TaxRate = 20.0
	}

	ctx := r.Context()
	_ = ensureSupplierSubscription(ctx, req.BrandID)
	sub, err := fetchSupplierSubscriptionByBrand(ctx, req.BrandID)
	if err != nil {
		http.Error(w, `{"error":"Tedarikçi bulunamadı"}`, http.StatusNotFound)
		return
	}

	netBase := math.Max(0, req.SubtotalAmount-req.DiscountAmount)
	taxAmount := math.Round((netBase*req.TaxRate/100.0)*100) / 100
	totalAmount := math.Round((netBase+taxAmount)*100) / 100
	invNum := fmt.Sprintf("MV-FAT-%s-%d", time.Now().Format("20060102"), time.Now().Unix()%100000)

	status := "PENDING"
	var paidAmount float64
	var paidAt *time.Time
	if req.MarkAsPaid {
		status = "PAID"
		paidAmount = totalAmount
		now := time.Now()
		paidAt = &now
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"Veritabanı işlemi başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var invoiceID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.supplier_invoices (
			invoice_number, brand_id, subscription_id, invoice_type, plan_code, period_label,
			subtotal_amount, tax_rate, tax_amount, discount_amount, total_amount, paid_amount,
			currency, status, billing_company_title, tax_office, tax_number, billing_address,
			issue_date, due_date, paid_at, notes
		) VALUES (
			$1, $2::uuid, $3::uuid, $4, $5, $6,
			$7, $8, $9, $10, $11, $12,
			'TRY', $13, $14, $15, $16, $17,
			NOW(), NOW() + INTERVAL '7 days', $18, $19
		) RETURNING id::text
	`,
		invNum, req.BrandID, sub.ID, req.InvoiceType, req.PlanCode, strings.TrimSpace(req.PeriodLabel),
		req.SubtotalAmount, req.TaxRate, taxAmount, req.DiscountAmount, totalAmount, paidAmount,
		status, sub.BillingCompanyTitle, sub.TaxOffice, sub.TaxNumber, sub.BillingAddress,
		paidAt, strings.TrimSpace(req.Notes),
	).Scan(&invoiceID)
	if err != nil {
		http.Error(w, `{"error":"Fatura oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	ledgerDesc := fmt.Sprintf("Fatura Tahakkuku (%s - %s)", invNum, req.PeriodLabel)
	if err := appendAccountingLedgerEntry(ctx, tx, req.BrandID, &invoiceID, nil, "INVOICE_DEBIT", totalAmount, 0, ledgerDesc); err != nil {
		http.Error(w, `{"error":"Muhasebe defter kaydı oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	if req.MarkAsPaid && totalAmount > 0 {
		payMethod := req.PaymentMethod
		if payMethod == "" {
			payMethod = "BANK_TRANSFER"
		}
		payNum := fmt.Sprintf("MV-THS-%s-%d", time.Now().Format("20060102"), (time.Now().Unix()+1)%100000)
		var paymentID string
		if err := tx.QueryRow(ctx, `
			INSERT INTO catalog.supplier_subscription_payments (
				payment_number, brand_id, invoice_id, plan_code, period_months, amount, currency,
				payment_method, status, sender_name, notes, approved_by, paid_at
			) VALUES ($1, $2::uuid, $3::uuid, $4, 1, $5, 'TRY', $6, 'COMPLETED', $7, $8, 'Admin', NOW())
			RETURNING id::text
		`, payNum, req.BrandID, invoiceID, req.PlanCode, totalAmount, payMethod, sub.BillingCompanyTitle, req.Notes).Scan(&paymentID); err == nil {
			payDesc := fmt.Sprintf("Tahsilat Kaydı (%s - Fatura: %s)", payNum, invNum)
			_ = appendAccountingLedgerEntry(ctx, tx, req.BrandID, &invoiceID, &paymentID, "PAYMENT_CREDIT", 0, totalAmount, payDesc)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"Fatura işlemi tamamlanamadı"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"id":             invoiceID,
		"invoice_number": invNum,
		"message":        "Fatura başarıyla kesildi ve cari muhasebe defterine işlendi.",
	})
}

// RecordAdminSupplierPayment records a direct payment received from a supplier and optionally generates its paid invoice.
func (h *MarketplaceHandler) RecordAdminSupplierPayment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BrandID           string  `json:"brand_id"`
		InvoiceID         string  `json:"invoice_id"`
		PlanCode          string  `json:"plan_code"`
		PeriodMonths      int     `json:"period_months"`
		Amount            float64 `json:"amount"`
		PaymentMethod     string  `json:"payment_method"`
		SenderName        string  `json:"sender_name"`
		BankReference     string  `json:"bank_reference"`
		AutoCreateInvoice bool    `json:"auto_create_invoice"`
		Notes             string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.BrandID == "" || req.Amount <= 0 {
		http.Error(w, `{"error":"brand_id ve geçerli ödeme tutarı gereklidir"}`, http.StatusBadRequest)
		return
	}
	if req.PeriodMonths <= 0 {
		req.PeriodMonths = 1
	}
	if req.PlanCode == "" {
		req.PlanCode = "PRO"
	}
	if req.PaymentMethod == "" {
		req.PaymentMethod = "BANK_TRANSFER"
	}

	ctx := r.Context()
	_ = ensureSupplierSubscription(ctx, req.BrandID)
	sub, err := fetchSupplierSubscriptionByBrand(ctx, req.BrandID)
	if err != nil {
		http.Error(w, `{"error":"Tedarikçi bulunamadı"}`, http.StatusNotFound)
		return
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"Veritabanı işlemi başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var linkedInvID *string
	if strings.TrimSpace(req.InvoiceID) != "" {
		invID := strings.TrimSpace(req.InvoiceID)
		linkedInvID = &invID
		_, _ = tx.Exec(ctx, `
			UPDATE catalog.supplier_invoices
			SET paid_amount = total_amount, status = 'PAID', paid_at = NOW(), updated_at = NOW()
			WHERE id = $1::uuid
		`, invID)
	} else if req.AutoCreateInvoice {
		invNum := fmt.Sprintf("MV-FAT-%s-%d", time.Now().Format("20060102"), time.Now().Unix()%100000)
		subtotal := math.Round((req.Amount/1.20)*100) / 100
		taxAmt := math.Round((req.Amount-subtotal)*100) / 100
		periodLabel := fmt.Sprintf("%s Paketi (%d Aylık Abonelik)", req.PlanCode, req.PeriodMonths)
		var newInvID string
		if err := tx.QueryRow(ctx, `
			INSERT INTO catalog.supplier_invoices (
				invoice_number, brand_id, subscription_id, invoice_type, plan_code, period_label,
				subtotal_amount, tax_rate, tax_amount, discount_amount, total_amount, paid_amount,
				currency, status, billing_company_title, tax_office, tax_number, billing_address,
				issue_date, due_date, paid_at, notes
			) VALUES (
				$1, $2::uuid, $3::uuid, 'SUBSCRIPTION', $4, $5,
				$6, 20.00, $7, 0.00, $8, $8,
				'TRY', 'PAID', $9, $10, $11, $12,
				NOW(), NOW(), NOW(), $13
			) RETURNING id::text
		`, invNum, req.BrandID, sub.ID, req.PlanCode, periodLabel, subtotal, taxAmt, req.Amount,
			sub.BillingCompanyTitle, sub.TaxOffice, sub.TaxNumber, sub.BillingAddress, req.Notes).Scan(&newInvID); err == nil {
			linkedInvID = &newInvID
			_ = appendAccountingLedgerEntry(ctx, tx, req.BrandID, linkedInvID, nil, "INVOICE_DEBIT", req.Amount, 0, fmt.Sprintf("Fatura Tahakkuku (%s)", invNum))
		}
	}

	payNum := fmt.Sprintf("MV-THS-%s-%d", time.Now().Format("20060102"), (time.Now().Unix()+2)%100000)
	var paymentID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.supplier_subscription_payments (
			payment_number, brand_id, invoice_id, plan_code, period_months, amount, currency,
			payment_method, status, sender_name, bank_reference, notes, approved_by, paid_at
		) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, 'TRY', $7, 'COMPLETED', $8, $9, $10, 'Admin', NOW())
		RETURNING id::text
	`, payNum, req.BrandID, linkedInvID, req.PlanCode, req.PeriodMonths, req.Amount,
		req.PaymentMethod, strings.TrimSpace(req.SenderName), strings.TrimSpace(req.BankReference), strings.TrimSpace(req.Notes)).Scan(&paymentID)
	if err != nil {
		http.Error(w, `{"error":"Tahsilat kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	if err := appendAccountingLedgerEntry(ctx, tx, req.BrandID, linkedInvID, &paymentID, "PAYMENT_CREDIT", 0, req.Amount, fmt.Sprintf("Tedarikçi Ödemesi (%s)", payNum)); err != nil {
		http.Error(w, `{"error":"Cari defter güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	// Update supplier subscription active period and plan
	_, _ = tx.Exec(ctx, fmt.Sprintf(`
		UPDATE catalog.supplier_subscriptions
		SET plan_code = $1,
		    plan_id = (SELECT id FROM catalog.subscription_plans WHERE code = $1 LIMIT 1),
		    is_complimentary = false,
		    status = 'ACTIVE',
		    current_period_end = GREATEST(current_period_end, NOW()) + INTERVAL '%d months',
		    updated_at = NOW()
		WHERE brand_id = $2::uuid
	`, req.PeriodMonths), req.PlanCode, req.BrandID)

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"Tahsilat işlemi tamamlanamadı"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"id":             paymentID,
		"payment_number": payNum,
		"message":        "Tedarikçi ödemesi kaydedildi ve muhasebe ekstresine işlendi.",
	})
}

// ProcessAdminSupplierPayment approves or rejects a supplier's pending payment notification.
func (h *MarketplaceHandler) ProcessAdminSupplierPayment(w http.ResponseWriter, r *http.Request) {
	paymentID := r.PathValue("id")
	if paymentID == "" {
		http.Error(w, `{"error":"Ödeme ID gerekli"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"` // COMPLETED or REJECTED
		Notes  string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var brandID, planCode, payNum string
	var periodMonths int
	var amount float64
	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT brand_id::text, plan_code, period_months, amount::float8, status, payment_number
		FROM catalog.supplier_subscription_payments
		WHERE id = $1::uuid
	`, paymentID).Scan(&brandID, &planCode, &periodMonths, &amount, &currentStatus, &payNum)
	if err != nil {
		http.Error(w, `{"error":"Ödeme kaydı bulunamadı"}`, http.StatusNotFound)
		return
	}

	if req.Status == "REJECTED" {
		_, _ = tx.Exec(ctx, `
			UPDATE catalog.supplier_subscription_payments
			SET status = 'REJECTED', notes = COALESCE($1, notes), approved_by = 'Admin', updated_at = NOW()
			WHERE id = $2::uuid
		`, req.Notes, paymentID)
		_ = tx.Commit(ctx)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "Ödeme bildirimi reddedildi."})
		return
	}

	if currentStatus == "COMPLETED" {
		http.Error(w, `{"error":"Bu ödeme zaten onaylanmış"}`, http.StatusBadRequest)
		return
	}

	sub, _ := fetchSupplierSubscriptionByBrand(ctx, brandID)
	invNum := fmt.Sprintf("MV-FAT-%s-%d", time.Now().Format("20060102"), time.Now().Unix()%100000)
	subtotal := math.Round((amount/1.20)*100) / 100
	taxAmt := math.Round((amount-subtotal)*100) / 100
	periodLabel := fmt.Sprintf("%s Paketi (%d Aylık Abonelik)", planCode, periodMonths)

	var newInvID string
	var subID *string
	var title, taxOff, taxNo, addr string
	if sub != nil {
		subID = &sub.ID
		title = sub.BillingCompanyTitle
		taxOff = sub.TaxOffice
		taxNo = sub.TaxNumber
		addr = sub.BillingAddress
	}
	_ = tx.QueryRow(ctx, `
		INSERT INTO catalog.supplier_invoices (
			invoice_number, brand_id, subscription_id, invoice_type, plan_code, period_label,
			subtotal_amount, tax_rate, tax_amount, discount_amount, total_amount, paid_amount,
			currency, status, billing_company_title, tax_office, tax_number, billing_address,
			issue_date, due_date, paid_at, notes
		) VALUES (
			$1, $2::uuid, $3::uuid, 'SUBSCRIPTION', $4, $5,
			$6, 20.00, $7, 0.00, $8, $8,
			'TRY', 'PAID', $9, $10, $11, $12,
			NOW(), NOW(), NOW(), $13
		) RETURNING id::text
	`, invNum, brandID, subID, planCode, periodLabel, subtotal, taxAmt, amount, title, taxOff, taxNo, addr, req.Notes).Scan(&newInvID)

	var invPtr *string
	if newInvID != "" {
		invPtr = &newInvID
		_ = appendAccountingLedgerEntry(ctx, tx, brandID, invPtr, nil, "INVOICE_DEBIT", amount, 0, fmt.Sprintf("Fatura Tahakkuku (%s)", invNum))
	}

	_, _ = tx.Exec(ctx, `
		UPDATE catalog.supplier_subscription_payments
		SET status = 'COMPLETED', invoice_id = $1::uuid, approved_by = 'Admin', updated_at = NOW()
		WHERE id = $2::uuid
	`, invPtr, paymentID)

	_ = appendAccountingLedgerEntry(ctx, tx, brandID, invPtr, &paymentID, "PAYMENT_CREDIT", 0, amount, fmt.Sprintf("Onaylanan Tedarikçi Ödemesi (%s)", payNum))

	_, _ = tx.Exec(ctx, fmt.Sprintf(`
		UPDATE catalog.supplier_subscriptions
		SET plan_code = $1,
		    plan_id = (SELECT id FROM catalog.subscription_plans WHERE code = $1 LIMIT 1),
		    is_complimentary = false,
		    status = 'ACTIVE',
		    current_period_end = GREATEST(current_period_end, NOW()) + INTERVAL '%d months',
		    updated_at = NOW()
		WHERE brand_id = $2::uuid
	`, periodMonths), planCode, brandID)

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"Ödeme onaylanamadı"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Ödeme onaylandı, fatura kesildi ve abonelik aktifleştirildi."})
}
