package handlers

import (
	"sync"
	"testing"
	"time"

	"mertervitrini/backend/pkg/mailer"
)

func TestExceptionAlertMonitorBurstCooldownAndPanic(t *testing.T) {
	now := time.Date(2026, 11, 22, 17, 0, 0, 0, time.UTC)
	cfg := ExceptionAlertConfigDTO{
		AlertOnPanic:     true,
		AlertOnHTTP5xx:   true,
		AlertOnErrorLogs: true,
		BurstThreshold:   3,
		WindowMinutes:    5,
		CooldownMinutes:  15,
		MaxEmailsPerHour: 2,
		IgnoredPatterns:  []string{"Failed to find Server Action", "context canceled"},
	}

	var mu sync.Mutex
	var alerts []mailer.ExceptionAlertEmailData

	mon := NewExceptionAlertMonitor(
		func() ExceptionAlertConfigDTO { return cfg },
		func(d mailer.ExceptionAlertEmailData) {
			mu.Lock()
			alerts = append(alerts, d)
			mu.Unlock()
		},
	)
	mon.nowFn = func() time.Time { return now }

	// Ignored & recursive messages must never increment or trigger alerts
	mon.Observe("error", "next", "Error: Failed to find Server Action 'x'", "")
	mon.Observe("error", "mailer", "[MAILER ERROR] SMTP refused", "")
	mon.Observe("http_5xx", "GET /x", "context canceled", "")
	if st := mon.SnapshotStatus(); st.TotalCaptured != 0 {
		t.Fatalf("expected 0 captured after ignored/recursive errors, got %d", st.TotalCaptured)
	}

	// Below threshold (2 < 3) should not trigger alert
	mon.Observe("http_5xx", "GET /api/v1/store/products", "HTTP 500 timeout", "")
	mon.Observe("http_5xx", "GET /api/v1/store/products", "HTTP 500 timeout", "")
	if len(alerts) != 0 {
		t.Fatalf("expected 0 alerts below burst threshold, got %d", len(alerts))
	}

	// Third event hits burst_threshold=3 -> triggers 1 alert
	mon.Observe("http_5xx", "GET /api/v1/store/products", "HTTP 500 timeout", "")
	if len(alerts) != 1 || alerts[0].WindowCount != 3 {
		t.Fatalf("expected 1 alert with WindowCount=3, got count=%d", len(alerts))
	}

	// Inside 15m cooldown -> fourth 500 must be suppressed
	now = now.Add(2 * time.Minute)
	mon.Observe("http_5xx", "GET /api/v1/store/products", "HTTP 500 timeout", "")
	if len(alerts) != 1 {
		t.Fatalf("expected alert to stay suppressed inside cooldown, got %d", len(alerts))
	}

	// Panic event triggers immediately after 60s spacing and uses max_emails_per_hour=2 slot
	mon.Observe("panic", "POST /api/v1/store/orders", "nil pointer dereference", "goroutine 1 [running]:")
	if len(alerts) != 2 || alerts[1].Severity != "panic" {
		t.Fatalf("expected panic alert #2 immediately, got len=%d", len(alerts))
	}

	// Hourly cap (max_emails_per_hour=2) blocks further alerts even after cooldown expires
	now = now.Add(20 * time.Minute)
	mon.Observe("panic", "POST /api/v1/store/orders", "another panic", "stack")
	if len(alerts) != 2 {
		t.Fatalf("expected hourly cap to block 3rd email within same hour, got %d", len(alerts))
	}
}
