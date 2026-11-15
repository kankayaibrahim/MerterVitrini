package handlers

import (
	"testing"
	"time"
)

func TestNormalizeRuleInput(t *testing.T) {
	item, err := normalizeRuleInput(updateNotificationRuleInput{
		EventKey:       "new_customer",
		Enabled:        true,
		ToEmails:       []string{" KankayaIbrahim@gmail.com ", "carnavaltedarik@gmail.com"},
		CCEmails:       []string{"carnavaltedarik@gmail.com", "cc@example.com"},
		ScheduleHour:   21,
		ScheduleMinute: 0,
	})
	if err != nil {
		t.Fatalf("expected valid rule input, got %v", err)
	}
	if len(item.ToEmails) != 2 {
		t.Fatalf("expected 2 To emails, got %v", item.ToEmails)
	}
	if len(item.CCEmails) != 1 || item.CCEmails[0] != "cc@example.com" {
		t.Fatalf("expected overlapping email removed from CC, got %v", item.CCEmails)
	}

	if _, err := normalizeRuleInput(updateNotificationRuleInput{
		EventKey: "new_order",
		Enabled:  true,
		ToEmails: []string{},
	}); err == nil {
		t.Fatal("expected error when enabled rule has empty To list")
	}

	if _, err := normalizeRuleInput(updateNotificationRuleInput{
		EventKey:     "daily_digest",
		Enabled:      true,
		ToEmails:     []string{"ops@mertervitrini.com.tr"},
		ScheduleHour: 25,
	}); err == nil {
		t.Fatal("expected error for invalid schedule_hour=25")
	}
}

func TestIstanbulDayBoundsAndFormatting(t *testing.T) {
	utcTime := time.Date(2026, 11, 15, 22, 30, 0, 0, time.UTC)
	dayStart, dayEnd, nowIst := istanbulDayBounds(utcTime)
	if nowIst.Format("2006-01-02") != "2026-11-16" {
		t.Fatalf("expected 2026-11-16 in Istanbul for 22:30 UTC, got %s", nowIst.Format("2006-01-02"))
	}
	if dayEnd.Sub(dayStart) != 24*time.Hour {
		t.Fatalf("expected 24h day window, got %v", dayEnd.Sub(dayStart))
	}

	if got := formatTRYAmountReadable(123456.75); got != "123.456,75 TL" {
		t.Fatalf("unexpected formatted TRY amount: %s", got)
	}
}
