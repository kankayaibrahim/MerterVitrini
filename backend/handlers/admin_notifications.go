package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/mailer"

	"github.com/jackc/pgx/v5"
)

var (
	notificationSchemaOnce sync.Once
	notificationSchemaErr  error
	notificationHooksOnce  sync.Once
)

// NotificationRuleDTO represents a configurable admin email notification channel.
type NotificationRuleDTO struct {
	EventKey       string   `json:"event_key"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Enabled        bool     `json:"enabled"`
	ToEmails       []string `json:"to_emails"`
	CCEmails       []string `json:"cc_emails"`
	ScheduleHour   int      `json:"schedule_hour"`
	ScheduleMinute int      `json:"schedule_minute"`
	LastSentDate   string   `json:"last_sent_date"`
	UpdatedBy      string   `json:"updated_by"`
	UpdatedAt      string   `json:"updated_at"`
}

// NotificationLogDTO represents an email delivery log record shown in Admin UI.
type NotificationLogDTO struct {
	ID           string   `json:"id"`
	EventKey     string   `json:"event_key"`
	Subject      string   `json:"subject"`
	ToEmails     []string `json:"to_emails"`
	CCEmails     []string `json:"cc_emails"`
	Status       string   `json:"status"`
	ErrorMessage string   `json:"error_message"`
	CreatedAt    string   `json:"created_at"`
}

// AdminNotificationsHandler manages admin email notification rules, To/CC recipients, and daily digests.
type AdminNotificationsHandler struct {
	Cfg *config.Config
}

// NewAdminNotificationsHandler creates a new AdminNotificationsHandler.
func NewAdminNotificationsHandler(cfg *config.Config) *AdminNotificationsHandler {
	registerMailerNotificationHooks()
	return &AdminNotificationsHandler{Cfg: cfg}
}

func registerMailerNotificationHooks() {
	notificationHooksOnce.Do(func() {
		mailer.RegisterNotificationResolver(resolveNotificationRouteFromDB)
		mailer.RegisterNotificationLogger(recordNotificationLogToDB)
	})
}

func resolveNotificationRouteFromDB(ctx context.Context, eventKey string) (mailer.NotificationRoute, error) {
	if db.Pool == nil {
		return mailer.NotificationRoute{}, errors.New("database pool unavailable")
	}
	var enabled bool
	var toEmails, ccEmails []string
	err := db.Pool.QueryRow(ctx, `
		SELECT enabled, COALESCE(to_emails, ARRAY[]::TEXT[]), COALESCE(cc_emails, ARRAY[]::TEXT[])
		FROM identity.notification_settings
		WHERE event_key = $1
	`, eventKey).Scan(&enabled, &toEmails, &ccEmails)
	if err != nil {
		return mailer.NotificationRoute{}, err
	}
	return mailer.NotificationRoute{
		Enabled:  enabled,
		ToEmails: toEmails,
		CCEmails: ccEmails,
	}, nil
}

func recordNotificationLogToDB(ctx context.Context, eventKey, subject string, toList, ccList []string, status, errMsg string, metadata map[string]any) {
	if db.Pool == nil {
		return
	}
	if toList == nil {
		toList = []string{}
	}
	if ccList == nil {
		ccList = []string{}
	}
	metaBytes := []byte("{}")
	if len(metadata) > 0 {
		if encoded, err := json.Marshal(metadata); err == nil {
			metaBytes = encoded
		}
	}
	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO identity.notification_logs (event_key, subject, to_emails, cc_emails, status, error_message, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
	`, eventKey, subject, toList, ccList, status, errMsg, string(metaBytes))
}

// EnsureNotificationSettingsSchema provisions notification & product-deletion tracking tables idempotently.
func EnsureNotificationSettingsSchema(ctx context.Context) error {
	registerMailerNotificationHooks()
	if db.Pool == nil {
		return nil
	}
	notificationSchemaOnce.Do(func() {
		ddl := `
		CREATE SCHEMA IF NOT EXISTS identity;
		CREATE TABLE IF NOT EXISTS identity.notification_settings (
			event_key VARCHAR(50) PRIMARY KEY,
			title VARCHAR(150) NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			enabled BOOLEAN NOT NULL DEFAULT true,
			to_emails TEXT[] NOT NULL DEFAULT ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'],
			cc_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
			schedule_hour SMALLINT NOT NULL DEFAULT 21,
			schedule_minute SMALLINT NOT NULL DEFAULT 0,
			last_sent_date VARCHAR(10) NULL,
			updated_by VARCHAR(150) NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		INSERT INTO identity.notification_settings (
			event_key, title, description, enabled, to_emails, cc_emails, schedule_hour, schedule_minute
		)
		VALUES
			('new_customer', 'Yeni Müşteri Kaydı Bildirimi', 'Vitrin veya mobil uygulama üzerinden yeni B2B müşteri kaydı oluştuğunda To/CC listelerine anında e-posta gönderir.', true, ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'], ARRAY[]::TEXT[], 21, 0),
			('new_order', 'Yeni Sipariş & Doğrudan Talep Bildirimi', 'Müşteri sepetinden sipariş onaylandığında veya doğrudan toptan teklif/sipariş talebi oluşturulduğunda bildirim gönderir.', true, ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'], ARRAY[]::TEXT[], 21, 0),
			('daily_digest', 'Günlük B2B Operasyon Özet Raporu', 'Belirlenen saatte (İstanbul saati) o gün kaydolan üyeler, siparişler, eklenen/kapatılan/arşivlenen/silinen ürünler hakkında özet rapor gönderir.', true, ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'], ARRAY[]::TEXT[], 21, 0),
			('supplier_onboarding', 'Tedarikçi & Hizmet Sağlayıcı Başvuru Bildirimi', 'Yeni tedarikçi hesabı açıldığında, tedarikçi başvurusu veya hizmet sağlayıcı başvurusu doğrulandığında yönetici ekibe mail gönderir.', true, ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'], ARRAY[]::TEXT[], 21, 0),
			('system_exception_alert', 'Kritik Sistem Hatası & Yoğun 5xx Alarmı', 'Sunucu panic çökmelerinde anında, yoğun HTTP 500 veya kritik hata patlamalarında parametrik eşik ve bekleme süresiyle yönetici ekibe teknik exception maili gönderir.', true, ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'], ARRAY[]::TEXT[], 21, 0)
		ON CONFLICT (event_key) DO NOTHING;

		CREATE TABLE IF NOT EXISTS identity.exception_alert_config (
			id                  INTEGER PRIMARY KEY CHECK (id = 1),
			alert_on_panic      BOOLEAN NOT NULL DEFAULT true,
			alert_on_http_5xx   BOOLEAN NOT NULL DEFAULT true,
			alert_on_error_logs BOOLEAN NOT NULL DEFAULT true,
			burst_threshold     INTEGER NOT NULL DEFAULT 5,
			window_minutes      INTEGER NOT NULL DEFAULT 5,
			cooldown_minutes    INTEGER NOT NULL DEFAULT 15,
			max_emails_per_hour INTEGER NOT NULL DEFAULT 6,
			ignored_patterns    JSONB NOT NULL DEFAULT '["Failed to find Server Action", "context canceled", "broken pipe", "connection reset by peer"]'::jsonb,
			updated_by          VARCHAR(150) NULL,
			updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		INSERT INTO identity.exception_alert_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

		UPDATE identity.notification_settings
		SET title = 'Yeni Müşteri Kaydı Bildirimi'
		WHERE event_key = 'new_customer' AND title = 'Yeni Müşteri / Bayi Kaydı Bildirimi';

		CREATE TABLE IF NOT EXISTS identity.notification_logs (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			event_key VARCHAR(50) NOT NULL,
			subject VARCHAR(300) NOT NULL,
			to_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
			cc_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
			status VARCHAR(20) NOT NULL,
			error_message TEXT NOT NULL DEFAULT '',
			metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON identity.notification_logs (created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_notification_logs_event_key ON identity.notification_logs (event_key, created_at DESC);

		ALTER TABLE catalog.products
			ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL;
		CREATE INDEX IF NOT EXISTS idx_products_created_at ON catalog.products (created_at);
		CREATE INDEX IF NOT EXISTS idx_products_deactivated_at ON catalog.products (deactivated_at) WHERE deactivated_at IS NOT NULL;
		CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON catalog.products (deleted_at) WHERE deleted_at IS NOT NULL;

		CREATE TABLE IF NOT EXISTS catalog.product_deletion_logs (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			product_id UUID NULL,
			brand_id UUID NULL,
			sku VARCHAR(120) NOT NULL DEFAULT '',
			title VARCHAR(300) NOT NULL DEFAULT '',
			deletion_mode VARCHAR(20) NOT NULL DEFAULT 'hard',
			actor_type VARCHAR(30) NOT NULL DEFAULT 'supplier',
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_product_deletion_logs_created_at ON catalog.product_deletion_logs (created_at DESC);`
		_, notificationSchemaErr = db.Pool.Exec(ctx, ddl)
	})
	return notificationSchemaErr
}

func fetchNotificationRulesList(ctx context.Context) ([]NotificationRuleDTO, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			event_key, title, description, enabled,
			COALESCE(to_emails, ARRAY[]::TEXT[]),
			COALESCE(cc_emails, ARRAY[]::TEXT[]),
			schedule_hour, schedule_minute,
			COALESCE(last_sent_date, ''),
			COALESCE(updated_by, ''),
			updated_at
		FROM identity.notification_settings
		ORDER BY CASE event_key
			WHEN 'new_customer' THEN 1
			WHEN 'new_order' THEN 2
			WHEN 'daily_digest' THEN 3
			WHEN 'supplier_onboarding' THEN 4
			WHEN 'system_exception_alert' THEN 5
			ELSE 99
		END, event_key ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules := make([]NotificationRuleDTO, 0, 4)
	for rows.Next() {
		var r NotificationRuleDTO
		var updatedAt time.Time
		if scanErr := rows.Scan(
			&r.EventKey, &r.Title, &r.Description, &r.Enabled,
			&r.ToEmails, &r.CCEmails, &r.ScheduleHour, &r.ScheduleMinute,
			&r.LastSentDate, &r.UpdatedBy, &updatedAt,
		); scanErr != nil {
			continue
		}
		if r.ToEmails == nil {
			r.ToEmails = []string{}
		}
		if r.CCEmails == nil {
			r.CCEmails = []string{}
		}
		r.UpdatedAt = updatedAt.In(istanbulLocation()).Format("02.01.2006 15:04")
		rules = append(rules, r)
	}
	return rules, nil
}

func fetchRecentNotificationLogs(ctx context.Context, limit int) []NotificationLogDTO {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			id::text, event_key, subject,
			COALESCE(to_emails, ARRAY[]::TEXT[]),
			COALESCE(cc_emails, ARRAY[]::TEXT[]),
			status, COALESCE(error_message, ''), created_at
		FROM identity.notification_logs
		ORDER BY created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return []NotificationLogDTO{}
	}
	defer rows.Close()

	logs := make([]NotificationLogDTO, 0, limit)
	loc := istanbulLocation()
	for rows.Next() {
		var entry NotificationLogDTO
		var createdAt time.Time
		if scanErr := rows.Scan(
			&entry.ID, &entry.EventKey, &entry.Subject,
			&entry.ToEmails, &entry.CCEmails,
			&entry.Status, &entry.ErrorMessage, &createdAt,
		); scanErr != nil {
			continue
		}
		if entry.ToEmails == nil {
			entry.ToEmails = []string{}
		}
		if entry.CCEmails == nil {
			entry.CCEmails = []string{}
		}
		entry.CreatedAt = createdAt.In(loc).Format("02.01.2006 15:04:05")
		logs = append(logs, entry)
	}
	return logs
}

// GetSettings returns all configurable email rules and recent delivery logs.
func (h *AdminNotificationsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	if err := EnsureNotificationSettingsSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Bildirim tabloları hazırlanırken hata oluştu")
		return
	}

	rules, err := fetchNotificationRulesList(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Bildirim kuralları okunamadı")
		return
	}

	nowIst := time.Now().In(istanbulLocation())
	httpx.JSON(w, http.StatusOK, map[string]any{
		"settings":             rules,
		"recent_logs":          fetchRecentNotificationLogs(ctx, 25),
		"default_recipients":   mailer.DefaultAdminRecipients,
		"server_time_istanbul": nowIst.Format("02.01.2006 15:04:05"),
		"today_date":           nowIst.Format("2006-01-02"),
	})
}

type updateNotificationRuleInput struct {
	EventKey       string   `json:"event_key"`
	Enabled        bool     `json:"enabled"`
	ToEmails       []string `json:"to_emails"`
	CCEmails       []string `json:"cc_emails"`
	ScheduleHour   int      `json:"schedule_hour"`
	ScheduleMinute int      `json:"schedule_minute"`
}

func isAllowedNotificationEventKey(eventKey string) bool {
	switch eventKey {
	case mailer.EventNewCustomer, mailer.EventNewOrder, mailer.EventDailyDigest, mailer.EventSupplierOnboarding, mailer.EventSystemExceptionAlert:
		return true
	default:
		return false
	}
}

func normalizeRuleInput(in updateNotificationRuleInput) (updateNotificationRuleInput, error) {
	key := strings.TrimSpace(in.EventKey)
	if !isAllowedNotificationEventKey(key) {
		return in, fmt.Errorf("tanımsız bildirim anahtarı: %s", in.EventKey)
	}
	cleanTo, err := mailer.NormalizeEmailList(in.ToEmails)
	if err != nil {
		return in, fmt.Errorf("%s To listesi hatası: %w", key, err)
	}
	cleanCCRaw, err := mailer.NormalizeEmailList(in.CCEmails)
	if err != nil {
		return in, fmt.Errorf("%s CC listesi hatası: %w", key, err)
	}
	cleanCC := removeOverlapEmails(cleanTo, cleanCCRaw)
	if in.Enabled && len(cleanTo) == 0 {
		return in, fmt.Errorf("%s aktifken en az bir To alıcı e-posta adresi girmelisiniz", key)
	}
	if in.ScheduleHour < 0 || in.ScheduleHour > 23 || in.ScheduleMinute < 0 || in.ScheduleMinute > 59 {
		return in, errors.New("günlük özet saati 00:00 ile 23:59 arasında olmalıdır")
	}

	in.EventKey = key
	in.ToEmails = cleanTo
	in.CCEmails = cleanCC
	return in, nil
}

func removeOverlapEmails(toList, ccList []string) []string {
	toSet := make(map[string]struct{}, len(toList))
	for _, e := range toList {
		toSet[e] = struct{}{}
	}
	out := make([]string, 0, len(ccList))
	for _, e := range ccList {
		if _, dup := toSet[e]; !dup {
			out = append(out, e)
		}
	}
	return out
}

func updateSingleRuleTx(ctx context.Context, tx pgx.Tx, rule updateNotificationRuleInput, actorEmail string, nowIst time.Time) error {
	nowMinutes := nowIst.Hour()*60 + nowIst.Minute()
	targetMinutes := rule.ScheduleHour*60 + rule.ScheduleMinute
	clearLastSent := rule.EventKey == mailer.EventDailyDigest && rule.Enabled && targetMinutes > nowMinutes

	if clearLastSent {
		_, err := tx.Exec(ctx, `
			UPDATE identity.notification_settings
			SET enabled = $2, to_emails = $3, cc_emails = $4,
			    schedule_hour = $5, schedule_minute = $6,
			    last_sent_date = NULL, updated_by = $7, updated_at = CURRENT_TIMESTAMP
			WHERE event_key = $1
		`, rule.EventKey, rule.Enabled, rule.ToEmails, rule.CCEmails, rule.ScheduleHour, rule.ScheduleMinute, actorEmail)
		return err
	}

	_, err := tx.Exec(ctx, `
		UPDATE identity.notification_settings
		SET enabled = $2, to_emails = $3, cc_emails = $4,
		    schedule_hour = $5, schedule_minute = $6,
		    updated_by = $7, updated_at = CURRENT_TIMESTAMP
		WHERE event_key = $1
	`, rule.EventKey, rule.Enabled, rule.ToEmails, rule.CCEmails, rule.ScheduleHour, rule.ScheduleMinute, actorEmail)
	return err
}

// UpdateSettings validates and persists all admin email notification rules.
func (h *AdminNotificationsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Settings []updateNotificationRuleInput `json:"settings"`
	}
	if err := httpx.DecodeJSON(r, &body, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz istek formatı")
		return
	}
	if len(body.Settings) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Güncellenecek bildirim ayarı gönderilmedi")
		return
	}

	normalized := make([]updateNotificationRuleInput, 0, len(body.Settings))
	for _, rawRule := range body.Settings {
		item, err := normalizeRuleInput(rawRule)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		normalized = append(normalized, item)
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := EnsureNotificationSettingsSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Bildirim tabloları doğrulanamadı")
		return
	}

	actorEmail := ""
	if actor, ok := middleware.GetUserFromContext(r.Context()); ok && actor != nil {
		actorEmail = strings.TrimSpace(actor.Email)
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Veritabanı işlemi başlatılamadı")
		return
	}
	defer tx.Rollback(ctx)

	nowIst := time.Now().In(istanbulLocation())
	for _, item := range normalized {
		if err := updateSingleRuleTx(ctx, tx, item, actorEmail, nowIst); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "Bildirim ayarı güncellenemedi")
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Bildirim ayarları kaydedilemedi")
		return
	}

	rules, _ := fetchNotificationRulesList(ctx)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"message":  "E-posta ve bildirim ayarları başarıyla kaydedildi.",
		"settings": rules,
	})
}

func (h *AdminNotificationsHandler) resolveOverrideRecipients(ctx context.Context, eventKey string, toOverride, ccOverride []string) ([]string, []string, error) {
	route := mailer.ResolveAdminNotificationRoute(ctx, h.Cfg, eventKey)
	toList := route.ToEmails
	ccList := route.CCEmails

	if len(toOverride) > 0 {
		cleanTo, err := mailer.NormalizeEmailList(toOverride)
		if err != nil {
			return nil, nil, err
		}
		toList = cleanTo
	}
	if ccOverride != nil {
		cleanCC, err := mailer.NormalizeEmailList(ccOverride)
		if err != nil {
			return nil, nil, err
		}
		ccList = removeOverlapEmails(toList, cleanCC)
	}
	if len(toList) == 0 {
		toList = append([]string(nil), mailer.DefaultAdminRecipients...)
	}
	return toList, ccList, nil
}

// GetDigestPreview returns today's live operational summary numbers for the Admin UI.
func (h *AdminNotificationsHandler) GetDigestPreview(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if err := EnsureNotificationSettingsSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Veritabanı şeması doğrulanamadı")
		return
	}

	data, err := CollectDailyDigestMetrics(ctx, time.Now())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Günlük özet metrikleri hesaplanamadı")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"digest": data})
}

// SendDigestNow immediately collects today's metrics and delivers the daily digest email.
func (h *AdminNotificationsHandler) SendDigestNow(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ToEmails []string `json:"to_emails"`
		CCEmails []string `json:"cc_emails"`
	}
	if r.Body != nil {
		_ = httpx.DecodeJSON(r, &body, httpx.DefaultMaxJSONBytes)
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()
	if err := EnsureNotificationSettingsSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Veritabanı şeması doğrulanamadı")
		return
	}

	toList, ccList, err := h.resolveOverrideRecipients(ctx, mailer.EventDailyDigest, body.ToEmails, body.CCEmails)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	data, err := CollectDailyDigestMetrics(ctx, time.Now())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Günlük özet verileri derlenemedi")
		return
	}

	subject, htmlBody, textBody := mailer.BuildDailyDigestEmailBodies(data)
	meta := map[string]any{"trigger": "manual", "report_date": data.ReportDate}

	if sendErr := mailer.SendMailEnvelope(h.Cfg, toList, ccList, subject, htmlBody, textBody); sendErr != nil {
		recordNotificationLogToDB(ctx, mailer.EventDailyDigest, subject, toList, ccList, "failed", sendErr.Error(), meta)
		httpx.Error(w, http.StatusBadGateway, fmt.Sprintf("Özet e-postası gönderilemedi: %v", sendErr))
		return
	}

	recordNotificationLogToDB(ctx, mailer.EventDailyDigest, subject, toList, ccList, "sent", "", meta)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"success":   true,
		"message":   fmt.Sprintf("Günlük özet raporu %d To ve %d CC alıcısına başarıyla gönderildi.", len(toList), len(ccList)),
		"subject":   subject,
		"to_emails": toList,
		"cc_emails": ccList,
		"digest":    data,
	})
}

// SendTestNotification sends a test email for any configured notification channel.
func (h *AdminNotificationsHandler) SendTestNotification(w http.ResponseWriter, r *http.Request) {
	var body struct {
		EventKey string   `json:"event_key"`
		ToEmails []string `json:"to_emails"`
		CCEmails []string `json:"cc_emails"`
	}
	if err := httpx.DecodeJSON(r, &body, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz istek formatı")
		return
	}

	eventKey := strings.TrimSpace(body.EventKey)
	if !isAllowedNotificationEventKey(eventKey) {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz bildirim tipi")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()
	if err := EnsureNotificationSettingsSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Veritabanı şeması doğrulanamadı")
		return
	}

	toList, ccList, err := h.resolveOverrideRecipients(ctx, eventKey, body.ToEmails, body.CCEmails)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	var subject, htmlBody, textBody string
	if eventKey == mailer.EventDailyDigest {
		data, digestErr := CollectDailyDigestMetrics(ctx, time.Now())
		if digestErr != nil {
			httpx.Error(w, http.StatusInternalServerError, "Özet test verileri derlenemedi")
			return
		}
		subject, htmlBody, textBody = mailer.BuildDailyDigestEmailBodies(data)
		subject = "[TEST] " + subject
	} else {
		subject, htmlBody, textBody = mailer.BuildTestEventEmailBodies(eventKey)
	}

	meta := map[string]any{"trigger": "test"}
	if sendErr := mailer.SendMailEnvelope(h.Cfg, toList, ccList, subject, htmlBody, textBody); sendErr != nil {
		recordNotificationLogToDB(ctx, eventKey, subject, toList, ccList, "failed", sendErr.Error(), meta)
		httpx.Error(w, http.StatusBadGateway, fmt.Sprintf("Test e-postası gönderilemedi: %v", sendErr))
		return
	}

	recordNotificationLogToDB(ctx, eventKey, subject, toList, ccList, "sent", "", meta)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"success":   true,
		"message":   fmt.Sprintf("Test maili (%s) %d To ve %d CC alıcısına gönderildi.", eventKey, len(toList), len(ccList)),
		"subject":   subject,
		"to_emails": toList,
		"cc_emails": ccList,
	})
}
