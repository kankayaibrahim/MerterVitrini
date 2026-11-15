package handlers

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/mailer"
	"mertervitrini/backend/pkg/safe"
)

func formatTRYAmountReadable(amount float64) string {
	whole := fmt.Sprintf("%.2f", amount)
	dotIdx := strings.Index(whole, ".")
	intPart := whole
	decPart := "00"
	if dotIdx >= 0 {
		intPart = whole[:dotIdx]
		decPart = whole[dotIdx+1:]
	}
	neg := strings.HasPrefix(intPart, "-")
	if neg {
		intPart = intPart[1:]
	}
	var out strings.Builder
	if neg {
		out.WriteByte('-')
	}
	n := len(intPart)
	for i := range n {
		if i > 0 && (n-i)%3 == 0 {
			out.WriteByte('.')
		}
		out.WriteByte(intPart[i])
	}
	out.WriteByte(',')
	out.WriteString(decPart)
	out.WriteString(" TL")
	return out.String()
}

func istanbulDayBounds(now time.Time) (dayStart, dayEnd time.Time, nowIst time.Time) {
	loc := istanbulLocation()
	nowIst = now.In(loc)
	dayStart = time.Date(nowIst.Year(), nowIst.Month(), nowIst.Day(), 0, 0, 0, 0, loc)
	dayEnd = dayStart.Add(24 * time.Hour)
	return dayStart, dayEnd, nowIst
}

func collectDigestCustomerMetrics(ctx context.Context, dayStart, dayEnd time.Time, loc *time.Location, out *mailer.DailyDigestEmailData) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2 AND user_role NOT IN ('super_admin', 'admin', 'editor', 'sales_manager', 'warehouse')),
			COUNT(*) FILTER (WHERE is_active = true AND user_role NOT IN ('super_admin', 'admin', 'editor', 'sales_manager', 'warehouse'))
		FROM identity.users
	`, dayStart, dayEnd).Scan(&out.NewCustomersToday, &out.TotalActiveCustomers)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')),
			COALESCE(u.email, ''),
			COALESCE(NULLIF(u.country_name, ''), NULLIF(u.country_code, ''), 'Belirtilmedi'),
			u.created_at
		FROM identity.users u
		WHERE u.created_at >= $1 AND u.created_at < $2
		  AND u.user_role NOT IN ('super_admin', 'admin', 'editor', 'sales_manager', 'warehouse')
		ORDER BY u.created_at DESC
		LIMIT 6
	`, dayStart, dayEnd)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var m mailer.DigestMemberHighlight
		var createdAt time.Time
		if scanErr := rows.Scan(&m.FullName, &m.Email, &m.Country, &createdAt); scanErr == nil {
			if strings.TrimSpace(m.FullName) == "" {
				m.FullName = "Yeni Müşteri"
			}
			m.CreatedAt = createdAt.In(loc).Format("15:04")
			out.RecentMembers = append(out.RecentMembers, m)
		}
	}
}

func collectDigestOrderMetrics(ctx context.Context, dayStart, dayEnd time.Time, loc *time.Location, out *mailer.DailyDigestEmailData) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE
				WHEN UPPER(COALESCE(order_status, '')) = 'CANCELLED' THEN 0
				WHEN COALESCE(total_amount_try, 0) > 0 THEN total_amount_try
				ELSE total_amount
			END)::float8, 0)
		FROM catalog.orders
		WHERE created_at >= $1 AND created_at < $2
	`, dayStart, dayEnd).Scan(&out.NewOrdersToday, &out.OrdersRevenueTRYToday)

	out.OrdersRevenueFormatted = formatTRYAmountReadable(out.OrdersRevenueTRYToday)

	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT ca.id)
		FROM catalog.carts ca
		INNER JOIN catalog.cart_items ci ON ci.cart_id = ca.id
		WHERE ca.user_id IS NOT NULL
	`).Scan(&out.ActiveUnfinishedCarts)

	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM catalog.store_inquiries WHERE created_at >= $1 AND created_at < $2
	`, dayStart, dayEnd).Scan(&out.InquiriesToday)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			o.order_number,
			COALESCE(NULLIF(TRIM(o.customer_name), ''), 'B2B Müşterisi'),
			o.total_amount,
			COALESCE(NULLIF(UPPER(o.currency), ''), 'TRY'),
			o.order_status,
			o.created_at
		FROM catalog.orders o
		WHERE o.created_at >= $1 AND o.created_at < $2
		ORDER BY o.created_at DESC
		LIMIT 6
	`, dayStart, dayEnd)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var o mailer.DigestOrderHighlight
		var amount float64
		var currency string
		var createdAt time.Time
		if scanErr := rows.Scan(&o.OrderNumber, &o.CustomerName, &amount, &currency, &o.Status, &createdAt); scanErr == nil {
			o.AmountText = fmt.Sprintf("%.2f %s", amount, currency)
			o.CreatedAt = createdAt.In(loc).Format("15:04")
			out.RecentOrders = append(out.RecentOrders, o)
		}
	}
}

func collectDigestCatalogMetrics(ctx context.Context, dayStart, dayEnd time.Time, out *mailer.DailyDigestEmailData) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2 AND deleted_at IS NULL),
			COUNT(*) FILTER (WHERE deactivated_at >= $1 AND deactivated_at < $2 AND is_active = false AND deleted_at IS NULL),
			COUNT(*) FILTER (WHERE archived_at >= $1 AND archived_at < $2 AND COALESCE(is_archived, false) = true AND deleted_at IS NULL),
			COUNT(*) FILTER (WHERE deleted_at >= $1 AND deleted_at < $2),
			COUNT(*) FILTER (WHERE is_active = true AND deleted_at IS NULL)
		FROM catalog.products
	`, dayStart, dayEnd).Scan(
		&out.ProductsAddedToday,
		&out.ProductsDeactivatedToday,
		&out.ProductsArchivedToday,
		&out.ProductsDeletedToday,
		&out.TotalActiveProducts,
	)

	var hardDeletedToday int
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM catalog.product_deletion_logs
		WHERE created_at >= $1 AND created_at < $2
	`, dayStart, dayEnd).Scan(&hardDeletedToday)
	out.ProductsDeletedToday += hardDeletedToday
}

func collectDigestOperationsMetrics(ctx context.Context, dayStart, dayEnd time.Time, out *mailer.DailyDigestEmailData) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE LOWER(status) = 'completed'),
			COUNT(*) FILTER (WHERE LOWER(status) = 'failed')
		FROM integration.sync_runs
		WHERE started_at >= $1 AND started_at < $2
	`, dayStart, dayEnd).Scan(&out.XMLSyncsCompletedToday, &out.XMLSyncsFailedToday)

	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM catalog.supplier_applications
		WHERE created_at >= $1 AND created_at < $2
	`, dayStart, dayEnd).Scan(&out.SupplierApplicationsToday)
}

// CollectDailyDigestMetrics aggregates today's Istanbul-calendar B2B KPIs for digest emails & Admin UI.
func CollectDailyDigestMetrics(ctx context.Context, now time.Time) (mailer.DailyDigestEmailData, error) {
	dayStart, dayEnd, nowIst := istanbulDayBounds(now)
	out := mailer.DailyDigestEmailData{
		ReportDate:          nowIst.Format("2006-01-02"),
		ReportDateFormatted: nowIst.Format("02.01.2006"),
		GeneratedAt:         nowIst.Format("15:04"),
		RecentMembers:       []mailer.DigestMemberHighlight{},
		RecentOrders:        []mailer.DigestOrderHighlight{},
	}
	if db.Pool == nil {
		return out, nil
	}

	loc := istanbulLocation()
	collectDigestCustomerMetrics(ctx, dayStart, dayEnd, loc, &out)
	collectDigestOrderMetrics(ctx, dayStart, dayEnd, loc, &out)
	collectDigestCatalogMetrics(ctx, dayStart, dayEnd, &out)
	collectDigestOperationsMetrics(ctx, dayStart, dayEnd, &out)
	return out, nil
}

func executeScheduledDailyDigestTick(appCtx context.Context, cfg *config.Config) {
	if db.Pool == nil {
		return
	}
	tickCtx, cancel := context.WithTimeout(appCtx, 30*time.Second)
	defer cancel()

	var enabled bool
	var schedHour, schedMinute int
	var lastSentDate string
	var toEmails, ccEmails []string
	err := db.Pool.QueryRow(tickCtx, `
		SELECT enabled, schedule_hour, schedule_minute, COALESCE(last_sent_date, ''),
		       COALESCE(to_emails, ARRAY[]::TEXT[]), COALESCE(cc_emails, ARRAY[]::TEXT[])
		FROM identity.notification_settings
		WHERE event_key = $1
	`, mailer.EventDailyDigest).Scan(&enabled, &schedHour, &schedMinute, &lastSentDate, &toEmails, &ccEmails)
	if err != nil || !enabled {
		return
	}

	nowIst := time.Now().In(istanbulLocation())
	todayStr := nowIst.Format("2006-01-02")
	if lastSentDate == todayStr {
		return
	}

	nowMinutes := nowIst.Hour()*60 + nowIst.Minute()
	targetMinutes := schedHour*60 + schedMinute
	if nowMinutes < targetMinutes || nowMinutes >= targetMinutes+20 {
		return
	}

	cleanTo, err := mailer.NormalizeEmailList(toEmails)
	if err != nil || len(cleanTo) == 0 {
		cleanTo = append([]string(nil), mailer.DefaultAdminRecipients...)
	}
	cleanCC, _ := mailer.NormalizeEmailList(ccEmails)

	tag, err := db.Pool.Exec(tickCtx, `
		UPDATE identity.notification_settings
		SET last_sent_date = $1, updated_at = CURRENT_TIMESTAMP
		WHERE event_key = $2 AND enabled = true AND COALESCE(last_sent_date, '') <> $1
	`, todayStr, mailer.EventDailyDigest)
	if err != nil || tag.RowsAffected() == 0 {
		return
	}

	data, digestErr := CollectDailyDigestMetrics(tickCtx, nowIst)
	if digestErr != nil {
		log.Printf("[DAILY DIGEST] Failed collecting daily metrics: %v", digestErr)
		return
	}
	subject, htmlBody, textBody := mailer.BuildDailyDigestEmailBodies(data)
	meta := map[string]any{"trigger": "scheduled", "report_date": todayStr}

	if sendErr := mailer.SendMailEnvelope(cfg, cleanTo, cleanCC, subject, htmlBody, textBody); sendErr != nil {
		log.Printf("[DAILY DIGEST ERROR] SMTP delivery failed: %v", sendErr)
		recordNotificationLogToDB(tickCtx, mailer.EventDailyDigest, subject, cleanTo, cleanCC, "failed", sendErr.Error(), meta)
		return
	}
	recordNotificationLogToDB(tickCtx, mailer.EventDailyDigest, subject, cleanTo, cleanCC, "sent", "", meta)
	log.Printf("[DAILY DIGEST] Sent operational summary for %s to %d To / %d CC recipients.", todayStr, len(cleanTo), len(cleanCC))
}

// StartDailyDigestScheduler runs a 30s background ticker that dispatches daily summary emails at the configured Istanbul time.
func StartDailyDigestScheduler(appCtx context.Context, cfg *config.Config) {
	safe.Go("Daily Digest Scheduler", func() {
		log.Println("[DAILY DIGEST] Scheduler started (Europe/Istanbul timezone).")
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-appCtx.Done():
				log.Println("[DAILY DIGEST] Scheduler gracefully stopped.")
				return
			case <-ticker.C:
				executeScheduledDailyDigestTick(appCtx, cfg)
			}
		}
	})
}
