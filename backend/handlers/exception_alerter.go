package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/logger"
	"mertervitrini/backend/pkg/mailer"
	"mertervitrini/backend/pkg/safe"
)

// ExceptionAlertConfigDTO stores admin-tunable panic & error-burst email alert thresholds.
type ExceptionAlertConfigDTO struct {
	AlertOnPanic      bool     `json:"alert_on_panic"`
	AlertOnHTTP5xx    bool     `json:"alert_on_http_5xx"`
	AlertOnErrorLogs  bool     `json:"alert_on_error_logs"`
	BurstThreshold    int      `json:"burst_threshold"`
	WindowMinutes     int      `json:"window_minutes"`
	CooldownMinutes   int      `json:"cooldown_minutes"`
	MaxEmailsPerHour  int      `json:"max_emails_per_hour"`
	IgnoredPatterns   []string `json:"ignored_patterns"`
	UpdatedBy         string   `json:"updated_by,omitempty"`
	UpdatedAt         string   `json:"updated_at,omitempty"`
}

// ExceptionAlertEventDTO represents a recent captured severe log/5xx/panic event in memory.
type ExceptionAlertEventDTO struct {
	Timestamp string `json:"timestamp"`
	Severity  string `json:"severity"`
	Source    string `json:"source"`
	Message   string `json:"message"`
}

// ExceptionAlertStatusDTO exposes real-time sliding-window monitor telemetry to the Admin UI.
type ExceptionAlertStatusDTO struct {
	WindowErrorCount   int                      `json:"window_error_count"`
	EmailsSentLastHour int                      `json:"emails_sent_last_hour"`
	TotalCaptured      int64                    `json:"total_captured"`
	TotalSuppressed    int64                    `json:"total_suppressed"`
	LastAlertSentAt    string                   `json:"last_alert_sent_at"`
	RecentEvents       []ExceptionAlertEventDTO `json:"recent_events"`
}

type capturedExceptionEntry struct {
	ts       time.Time
	severity string
	source   string
	message  string
	stack    string
}

// ExceptionAlertMonitor aggregates panics, HTTP 5xx responses, and severe errors cleanly without blocking callers.
type ExceptionAlertMonitor struct {
	mu              sync.Mutex
	nowFn           func() time.Time
	loadCfgFn       func() ExceptionAlertConfigDTO
	onAlert         func(mailer.ExceptionAlertEmailData)
	hostname        string
	windowEvents    []capturedExceptionEntry
	recentRing      []ExceptionAlertEventDTO
	sentTimes       []time.Time
	lastAlertSentAt time.Time
	totalCaptured   int64
	totalSuppressed int64

	cfgCacheMu      sync.Mutex
	cachedCfg       ExceptionAlertConfigDTO
	cfgCachedAt     time.Time
}

var (
	defaultExceptionMonitor     *ExceptionAlertMonitor
	defaultExceptionMonitorOnce sync.Once
)

func defaultExceptionAlertConfig() ExceptionAlertConfigDTO {
	return ExceptionAlertConfigDTO{
		AlertOnPanic:     true,
		AlertOnHTTP5xx:   true,
		AlertOnErrorLogs: true,
		BurstThreshold:   5,
		WindowMinutes:    5,
		CooldownMinutes:  15,
		MaxEmailsPerHour: 6,
		IgnoredPatterns: []string{
			"Failed to find Server Action",
			"context canceled",
			"broken pipe",
			"connection reset by peer",
		},
	}
}

// NewExceptionAlertMonitor creates a monitor instance with deterministic clock and callback hooks.
func NewExceptionAlertMonitor(loader func() ExceptionAlertConfigDTO, onAlert func(mailer.ExceptionAlertEmailData)) *ExceptionAlertMonitor {
	host, _ := os.Hostname()
	if strings.TrimSpace(host) == "" {
		host = "mertervitrini-backend"
	}
	return &ExceptionAlertMonitor{
		nowFn:     time.Now,
		loadCfgFn: loader,
		onAlert:   onAlert,
		hostname:  host,
	}
}

// StartExceptionAlertMonitor initializes the singleton monitor and hooks it into pkg/logger.
func StartExceptionAlertMonitor(cfg *config.Config) {
	defaultExceptionMonitorOnce.Do(func() {
		mon := NewExceptionAlertMonitor(loadExceptionConfigFromDB, func(data mailer.ExceptionAlertEmailData) {
			dispatchExceptionAlertAsync(cfg, data)
		})
		defaultExceptionMonitor = mon
		logger.RegisterErrorHook(func(severity, source, message, stack string) {
			mon.Observe(severity, source, message, stack)
		})
		log.Println("[EXCEPTION ALERTER] Parametric error & 5xx burst email monitor active.")
	})
}

func loadExceptionConfigFromDB() ExceptionAlertConfigDTO {
	def := defaultExceptionAlertConfig()
	if db.Pool == nil {
		return def
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var rawPatterns []byte
	var updatedAt time.Time
	var updatedBy string
	err := db.Pool.QueryRow(ctx, `
		SELECT alert_on_panic, alert_on_http_5xx, alert_on_error_logs,
		       burst_threshold, window_minutes, cooldown_minutes, max_emails_per_hour,
		       ignored_patterns, COALESCE(updated_by, ''), updated_at
		FROM identity.exception_alert_config
		WHERE id = 1
	`).Scan(
		&def.AlertOnPanic, &def.AlertOnHTTP5xx, &def.AlertOnErrorLogs,
		&def.BurstThreshold, &def.WindowMinutes, &def.CooldownMinutes, &def.MaxEmailsPerHour,
		&rawPatterns, &updatedBy, &updatedAt,
	)
	if err != nil {
		return def
	}
	var patterns []string
	if json.Unmarshal(rawPatterns, &patterns) == nil {
		def.IgnoredPatterns = patterns
	}
	def.UpdatedBy = updatedBy
	def.UpdatedAt = updatedAt.In(istanbulLocation()).Format("02.01.2006 15:04")
	return normalizeExceptionConfigBounds(def)
}

func normalizeExceptionConfigBounds(c ExceptionAlertConfigDTO) ExceptionAlertConfigDTO {
	if c.BurstThreshold < 1 {
		c.BurstThreshold = 1
	} else if c.BurstThreshold > 500 {
		c.BurstThreshold = 500
	}
	if c.WindowMinutes < 1 {
		c.WindowMinutes = 1
	} else if c.WindowMinutes > 60 {
		c.WindowMinutes = 60
	}
	if c.CooldownMinutes < 1 {
		c.CooldownMinutes = 1
	} else if c.CooldownMinutes > 1440 {
		c.CooldownMinutes = 1440
	}
	if c.MaxEmailsPerHour < 1 {
		c.MaxEmailsPerHour = 1
	} else if c.MaxEmailsPerHour > 60 {
		c.MaxEmailsPerHour = 60
	}
	if c.IgnoredPatterns == nil {
		c.IgnoredPatterns = []string{}
	}
	return c
}

func (m *ExceptionAlertMonitor) getCachedConfig(now time.Time) ExceptionAlertConfigDTO {
	m.cfgCacheMu.Lock()
	defer m.cfgCacheMu.Unlock()
	if !m.cfgCachedAt.IsZero() && now.Sub(m.cfgCachedAt) < 30*time.Second {
		return m.cachedCfg
	}
	if m.loadCfgFn != nil {
		m.cachedCfg = normalizeExceptionConfigBounds(m.loadCfgFn())
	} else {
		m.cachedCfg = defaultExceptionAlertConfig()
	}
	m.cfgCachedAt = now
	return m.cachedCfg
}

// InvalidateConfig clears the cached exception config so updated admin rules take effect immediately.
func (m *ExceptionAlertMonitor) InvalidateConfig() {
	m.cfgCacheMu.Lock()
	m.cfgCachedAt = time.Time{}
	m.cfgCacheMu.Unlock()
}

func isRecursiveOrIgnoredException(severity, source, message string, cfg ExceptionAlertConfigDTO) bool {
	combined := severity + " " + source + " " + message
	if strings.Contains(combined, "[MAILER ERROR]") || strings.Contains(combined, "[EXCEPTION ALERTER]") {
		return true
	}
	switch severity {
	case "panic":
		if !cfg.AlertOnPanic {
			return true
		}
	case "http_5xx":
		if !cfg.AlertOnHTTP5xx {
			return true
		}
	default:
		if !cfg.AlertOnErrorLogs {
			return true
		}
	}
	lowerCombined := strings.ToLower(combined)
	for _, pat := range cfg.IgnoredPatterns {
		p := strings.ToLower(strings.TrimSpace(pat))
		if p != "" && strings.Contains(lowerCombined, p) {
			return true
		}
	}
	return false
}

func (m *ExceptionAlertMonitor) pruneWindowsLocked(now time.Time, windowMin int) {
	cutoff := now.Add(-time.Duration(windowMin) * time.Minute)
	keptEvents := m.windowEvents[:0]
	for _, ev := range m.windowEvents {
		if !ev.ts.Before(cutoff) {
			keptEvents = append(keptEvents, ev)
		}
	}
	m.windowEvents = keptEvents

	hourCutoff := now.Add(-1 * time.Hour)
	keptSends := m.sentTimes[:0]
	for _, ts := range m.sentTimes {
		if !ts.Before(hourCutoff) {
			keptSends = append(keptSends, ts)
		}
	}
	m.sentTimes = keptSends
}

func buildGroupedSamples(events []capturedExceptionEntry, loc *time.Location) []mailer.ExceptionAlertSample {
	type bucket struct {
		sample mailer.ExceptionAlertSample
	}
	byKey := make(map[string]*bucket)
	for _, ev := range events {
		shortMsg := ev.message
		if len(shortMsg) > 220 {
			shortMsg = shortMsg[:217] + "..."
		}
		key := ev.severity + "|" + ev.source
		b, ok := byKey[key]
		if !ok {
			byKey[key] = &bucket{
				sample: mailer.ExceptionAlertSample{
					Timestamp: ev.ts.In(loc).Format("15:04:05"),
					Severity:  ev.severity,
					Source:    ev.source,
					Message:   shortMsg,
					Count:     1,
				},
			}
		} else {
			b.sample.Count++
			b.sample.Timestamp = ev.ts.In(loc).Format("15:04:05")
			b.sample.Message = shortMsg
		}
	}

	out := make([]mailer.ExceptionAlertSample, 0, len(byKey))
	for _, b := range byKey {
		out = append(out, b.sample)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Source < out[j].Source
	})
	if len(out) > 10 {
		out = out[:10]
	}
	return out
}

// Observe inspects a logged error, HTTP 5xx, or panic and fires an email payload if thresholds trigger.
func (m *ExceptionAlertMonitor) Observe(severity, source, message, stack string) {
	now := m.nowFn()
	cfg := m.getCachedConfig(now)
	if isRecursiveOrIgnoredException(severity, source, message, cfg) {
		return
	}

	loc := istanbulLocation()
	entry := capturedExceptionEntry{
		ts:       now,
		severity: severity,
		source:   strings.TrimSpace(source),
		message:  strings.TrimSpace(message),
		stack:    stack,
	}

	m.mu.Lock()
	m.totalCaptured++
	m.pruneWindowsLocked(now, cfg.WindowMinutes)
	m.windowEvents = append(m.windowEvents, entry)

	dto := ExceptionAlertEventDTO{
		Timestamp: now.In(loc).Format("02.01.2006 15:04:05"),
		Severity:  entry.severity,
		Source:    entry.source,
		Message:   entry.message,
	}
	m.recentRing = append(m.recentRing, dto)
	if len(m.recentRing) > 25 {
		m.recentRing = m.recentRing[len(m.recentRing)-25:]
	}

	if len(m.sentTimes) >= cfg.MaxEmailsPerHour {
		m.totalSuppressed++
		m.mu.Unlock()
		return
	}

	isPanic := severity == "panic"
	windowLen := len(m.windowEvents)
	shouldSend := false
	triggerReason := ""

	if isPanic {
		// Wait at least 60s between panic storms so back-to-back panic retries coalesce cleanly
		if m.lastAlertSentAt.IsZero() || now.Sub(m.lastAlertSentAt) >= 60*time.Second {
			shouldSend = true
			triggerReason = "Sunucu panic çökmesi tespit edildi (anında alarm)"
		}
	} else if windowLen >= cfg.BurstThreshold {
		if m.lastAlertSentAt.IsZero() || now.Sub(m.lastAlertSentAt) >= time.Duration(cfg.CooldownMinutes)*time.Minute {
			shouldSend = true
			triggerReason = fmt.Sprintf("Son %d dakikada %d adet hata/5xx (eşik: %d) tespit edildi",
				cfg.WindowMinutes, windowLen, cfg.BurstThreshold)
		}
	}

	if !shouldSend {
		if (!isPanic && windowLen >= cfg.BurstThreshold) || isPanic {
			m.totalSuppressed++
		}
		m.mu.Unlock()
		return
	}

	m.lastAlertSentAt = now
	m.sentTimes = append(m.sentTimes, now)
	snapshotEvents := append([]capturedExceptionEntry(nil), m.windowEvents...)
	m.mu.Unlock()

	if m.onAlert != nil {
		alertData := mailer.ExceptionAlertEmailData{
			Hostname:        m.hostname,
			Severity:        entry.severity,
			TriggerReason:   triggerReason,
			WindowMinutes:   cfg.WindowMinutes,
			BurstThreshold:  cfg.BurstThreshold,
			WindowCount:     len(snapshotEvents),
			CooldownMinutes: cfg.CooldownMinutes,
			GeneratedAt:     now.In(loc).Format("02.01.2006 15:04:05"),
			PrimarySource:   entry.source,
			PrimaryMessage:  entry.message,
			StackTrace:      entry.stack,
			GroupedSamples:  buildGroupedSamples(snapshotEvents, loc),
		}
		m.onAlert(alertData)
	}
}

// SnapshotStatus returns current sliding-window metrics and recent captured errors for Admin UI.
func (m *ExceptionAlertMonitor) SnapshotStatus() ExceptionAlertStatusDTO {
	now := m.nowFn()
	cfg := m.getCachedConfig(now)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pruneWindowsLocked(now, cfg.WindowMinutes)

	lastSent := ""
	if !m.lastAlertSentAt.IsZero() {
		lastSent = m.lastAlertSentAt.In(istanbulLocation()).Format("02.01.2006 15:04:05")
	}
	recentCopy := make([]ExceptionAlertEventDTO, len(m.recentRing))
	for i := range m.recentRing {
		recentCopy[i] = m.recentRing[len(m.recentRing)-1-i]
	}
	return ExceptionAlertStatusDTO{
		WindowErrorCount:   len(m.windowEvents),
		EmailsSentLastHour: len(m.sentTimes),
		TotalCaptured:      m.totalCaptured,
		TotalSuppressed:    m.totalSuppressed,
		LastAlertSentAt:    lastSent,
		RecentEvents:       recentCopy,
	}
}

func dispatchExceptionAlertAsync(cfg *config.Config, data mailer.ExceptionAlertEmailData) {
	safe.Go("Send Exception Burst Alert Email", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		route := mailer.ResolveAdminNotificationRoute(ctx, cfg, mailer.EventSystemExceptionAlert)
		if !route.Enabled || len(route.ToEmails) == 0 {
			return
		}

		subject, htmlBody, textBody := mailer.BuildExceptionAlertEmailBodies(data)
		meta := map[string]any{
			"severity":        data.Severity,
			"window_count":    data.WindowCount,
			"burst_threshold": data.BurstThreshold,
			"primary_source":  data.PrimarySource,
		}
		if err := mailer.SendMailEnvelope(cfg, route.ToEmails, route.CCEmails, subject, htmlBody, textBody); err != nil {
			log.Printf("[EXCEPTION ALERTER] Failed to deliver exception alert email: %v", err)
			recordNotificationLogToDB(ctx, mailer.EventSystemExceptionAlert, subject, route.ToEmails, route.CCEmails, "failed", err.Error(), meta)
			return
		}
		recordNotificationLogToDB(ctx, mailer.EventSystemExceptionAlert, subject, route.ToEmails, route.CCEmails, "sent", "", meta)
	})
}

// GetExceptionAlertConfig returns the parametric error/5xx threshold config and live telemetry status.
func (h *AdminNotificationsHandler) GetExceptionAlertConfig(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	if err := EnsureNotificationSettingsSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Hata alarm tabloları hazırlanamadı")
		return
	}

	cfgDTO := loadExceptionConfigFromDB()
	status := ExceptionAlertStatusDTO{RecentEvents: []ExceptionAlertEventDTO{}}
	if defaultExceptionMonitor != nil {
		status = defaultExceptionMonitor.SnapshotStatus()
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"config": cfgDTO,
		"status": status,
	})
}

func cleanIgnoredPatterns(raw []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, len(raw))
	for _, pat := range raw {
		trimmed := strings.TrimSpace(pat)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, trimmed)
	}
	return out
}

func validateExceptionConfigInput(in ExceptionAlertConfigDTO) (ExceptionAlertConfigDTO, error) {
	if in.BurstThreshold < 1 || in.BurstThreshold > 500 {
		return in, errors.New("hata eşiği (burst_threshold) 1 ile 500 arasında olmalıdır")
	}
	if in.WindowMinutes < 1 || in.WindowMinutes > 60 {
		return in, errors.New("zaman penceresi 1 ile 60 dakika arasında olmalıdır")
	}
	if in.CooldownMinutes < 1 || in.CooldownMinutes > 1440 {
		return in, errors.New("bekleme süresi (cooldown) 1 ile 1440 dakika arasında olmalıdır")
	}
	if in.MaxEmailsPerHour < 1 || in.MaxEmailsPerHour > 60 {
		return in, errors.New("saatlik maksimum mail limiti 1 ile 60 arasında olmalıdır")
	}
	in.IgnoredPatterns = cleanIgnoredPatterns(in.IgnoredPatterns)
	return in, nil
}

// UpdateExceptionAlertConfig persists admin-defined panic/5xx thresholds and refreshes the live monitor.
func (h *AdminNotificationsHandler) UpdateExceptionAlertConfig(w http.ResponseWriter, r *http.Request) {
	var body ExceptionAlertConfigDTO
	if err := httpx.DecodeJSON(r, &body, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz hata alarmı yapılandırma verisi")
		return
	}

	cleaned, err := validateExceptionConfigInput(body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	if err := EnsureNotificationSettingsSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Hata alarm tabloları doğrulanamadı")
		return
	}

	actorEmail := ""
	if actor, ok := middleware.GetUserFromContext(r.Context()); ok && actor != nil {
		actorEmail = strings.TrimSpace(actor.Email)
	}
	patternsJSON, _ := json.Marshal(cleaned.IgnoredPatterns)

	_, err = db.Pool.Exec(ctx, `
		UPDATE identity.exception_alert_config
		SET alert_on_panic = $1,
		    alert_on_http_5xx = $2,
		    alert_on_error_logs = $3,
		    burst_threshold = $4,
		    window_minutes = $5,
		    cooldown_minutes = $6,
		    max_emails_per_hour = $7,
		    ignored_patterns = $8::jsonb,
		    updated_by = $9,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = 1
	`, cleaned.AlertOnPanic, cleaned.AlertOnHTTP5xx, cleaned.AlertOnErrorLogs,
		cleaned.BurstThreshold, cleaned.WindowMinutes, cleaned.CooldownMinutes,
		cleaned.MaxEmailsPerHour, string(patternsJSON), actorEmail)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Hata alarm ayarları kaydedilemedi")
		return
	}

	if defaultExceptionMonitor != nil {
		defaultExceptionMonitor.InvalidateConfig()
	}

	updated := loadExceptionConfigFromDB()
	status := ExceptionAlertStatusDTO{RecentEvents: []ExceptionAlertEventDTO{}}
	if defaultExceptionMonitor != nil {
		status = defaultExceptionMonitor.SnapshotStatus()
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Kritik hata ve 5xx alarm parametreleri güncellendi.",
		"config":  updated,
		"status":  status,
	})
}
