package handlers

import (
	"testing"
	"time"
)

func TestEvaluateStoryEntitlement(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	oldest := now.Add(-6 * time.Hour)

	launchSettings := StorySettingsDTO{
		IsPaidMode:     false,
		PaidDailyLimit: 8,
		FreeDailyLimit: 8,
		StoryTTLHours:  24,
	}
	paidSettings := StorySettingsDTO{
		IsPaidMode:     true,
		PaidDailyLimit: 8,
		FreeDailyLimit: 0,
		StoryTTLHours:  24,
	}

	t.Run("launch mode grants configured free daily limit", func(t *testing.T) {
		ent := EvaluateStoryEntitlement(launchSettings, StoryEntitlementInput{
			PlanCode:        "FREE",
			Status:          "ACTIVE",
			IsComplimentary: true,
		}, 3, &oldest, now)
		if !ent.CanPublish || ent.DailyLimit != 8 || ent.Remaining24h != 5 {
			t.Fatalf("unexpected launch entitlement: %+v", ent)
		}
	})

	t.Run("paid mode rejects FREE supplier", func(t *testing.T) {
		ent := EvaluateStoryEntitlement(paidSettings, StoryEntitlementInput{
			PlanCode:        "FREE",
			Status:          "ACTIVE",
			IsComplimentary: true,
		}, 0, nil, now)
		if ent.CanPublish || ent.LockReason != storyLockPaidRequired || ent.DailyLimit != 0 {
			t.Fatalf("expected FREE supplier to be blocked in paid mode, got %+v", ent)
		}
	})

	t.Run("paid mode rejects complimentary PRO supplier without override", func(t *testing.T) {
		ent := EvaluateStoryEntitlement(paidSettings, StoryEntitlementInput{
			PlanCode:         "PRO",
			Status:           "ACTIVE",
			IsComplimentary:  true,
			CurrentPeriodEnd: now.Add(30 * 24 * time.Hour),
		}, 0, nil, now)
		if ent.CanPublish || ent.LockReason != storyLockPaidRequired {
			t.Fatalf("expected complimentary supplier without override to be blocked, got %+v", ent)
		}
	})

	t.Run("paid mode rejects expired paid period", func(t *testing.T) {
		ent := EvaluateStoryEntitlement(paidSettings, StoryEntitlementInput{
			PlanCode:         "PRO",
			Status:           "ACTIVE",
			IsComplimentary:  false,
			CurrentPeriodEnd: now.Add(-1 * time.Hour),
		}, 0, nil, now)
		if ent.CanPublish || ent.LockReason != storyLockPaidRequired {
			t.Fatalf("expected expired paid period to be blocked, got %+v", ent)
		}
	})

	t.Run("paid mode enforces 8 stories per rolling 24h", func(t *testing.T) {
		ent := EvaluateStoryEntitlement(paidSettings, StoryEntitlementInput{
			PlanCode:         "PRO",
			Status:           "ACTIVE",
			IsComplimentary:  false,
			CurrentPeriodEnd: now.Add(20 * 24 * time.Hour),
		}, 8, &oldest, now)
		if !ent.CanPublish || ent.DailyLimit != 8 || ent.Remaining24h != 0 || ent.LockReason != storyLockQuotaExceeded {
			t.Fatalf("expected 8/8 quota reached, got %+v", ent)
		}
		if ent.NextSlotAt == nil || !ent.NextSlotAt.Equal(oldest.Add(24*time.Hour)) {
			t.Fatalf("expected next_slot_at to equal oldest+24h, got %v", ent.NextSlotAt)
		}
	})

	t.Run("admin override grants or revokes story access", func(t *testing.T) {
		grant := true
		customLimit := 12
		entGrant := EvaluateStoryEntitlement(paidSettings, StoryEntitlementInput{
			PlanCode:                 "FREE",
			Status:                   "ACTIVE",
			IsComplimentary:          true,
			StoryEntitlementOverride: &grant,
			StoryDailyLimitOverride:  &customLimit,
		}, 2, &oldest, now)
		if !entGrant.CanPublish || entGrant.DailyLimit != 12 || entGrant.Remaining24h != 10 {
			t.Fatalf("expected admin grant override to allow 12 stories, got %+v", entGrant)
		}

		revoke := false
		entRevoke := EvaluateStoryEntitlement(launchSettings, StoryEntitlementInput{
			PlanCode:                 "PREMIUM",
			Status:                   "ACTIVE",
			IsComplimentary:          false,
			CurrentPeriodEnd:         now.Add(10 * 24 * time.Hour),
			StoryEntitlementOverride: &revoke,
		}, 0, nil, now)
		if entRevoke.CanPublish || entRevoke.LockReason != storyLockRevoked {
			t.Fatalf("expected admin revoke override to block even paid account, got %+v", entRevoke)
		}
	})
}

func TestBuildNewProductNotificationCopy(t *testing.T) {
	single := []NewProductAlertItem{{
		ID:    "11111111-1111-1111-1111-111111111111",
		Slug:  "ikili-keten-takim",
		Title: "İkili Keten Takım",
	}}
	langs := []string{"tr", "en", "ru", "ar", "de", "fr", "pl", "bg"}
	for _, lang := range langs {
		title, body, targetURL := BuildNewProductNotificationCopy(lang, "Lustrin", "lustrin", single)
		if title == "" || body == "" {
			t.Fatalf("empty notification copy for lang=%s", lang)
		}
		if targetURL != "/product/ikili-keten-takim" {
			t.Fatalf("unexpected single target URL for lang=%s: %s", lang, targetURL)
		}
	}

	batch := []NewProductAlertItem{
		{ID: "1", Slug: "p1", Title: "P1"},
		{ID: "2", Slug: "p2", Title: "P2"},
		{ID: "3", Slug: "p3", Title: "P3"},
	}
	title, body, targetURL := BuildNewProductNotificationCopy("en", "Lustrin", "lustrin", batch)
	if title == "" || body == "" || targetURL != "/ureticiler/lustrin" {
		t.Fatalf("unexpected batch notification: title=%q body=%q url=%q", title, body, targetURL)
	}
}

func TestValidateStoryCTAURL(t *testing.T) {
	allowed := []string{
		"",
		"/product/kadin-elbise",
		"/ureticiler/lustrin",
		"https://mertervitrini.com.tr/product/x",
		"https://www.mertervitrini.com.tr/ureticiler/lustrin",
	}
	for _, u := range allowed {
		if _, err := validateStoryCTAURL(u); err != nil {
			t.Fatalf("expected CTA URL %q to be valid, got err=%v", u, err)
		}
	}

	blocked := []string{
		"javascript:alert(1)",
		"//evil.com/phish",
		"https://evil.com/redirect",
		"http://mertervitrini.com.tr/insecure",
	}
	for _, u := range blocked {
		if _, err := validateStoryCTAURL(u); err == nil {
			t.Fatalf("expected CTA URL %q to be rejected", u)
		}
	}
}
