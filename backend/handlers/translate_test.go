package handlers

import (
	"fmt"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func resetAutoTranslateTrackerForTest() {
	autoTranslateBreakerMu.Lock()
	autoTranslateCooldownUntil = time.Time{}
	autoTranslateBreakerMu.Unlock()

	autoTranslateStateMu.Lock()
	autoTranslateState = AutoTranslateState{Status: string(StatusIdle)}
	autoTranslateLogSeq = 0
	autoTranslateStateMu.Unlock()
}

func seedAutoTranslateLogsForTest(total int) {
	for i := 0; i < total; i++ {
		if i%2 == 0 {
			recordAutoTranslateLog("success", fmt.Sprintf("Ürün %d", i), fmt.Sprintf("[RU] Item %d", i), "")
			continue
		}
		recordAutoTranslateLog("error", fmt.Sprintf("Ürün %d", i), "", "[AR] timeout")
	}
}

func assertRunningAutoTranslateSnapshot(t *testing.T, snap *AutoTranslateState) {
	t.Helper()
	if snap.Status != string(StatusRunning) {
		t.Fatalf("expected running status, got %q", snap.Status)
	}
	if snap.TotalProducts != 3 || snap.ProcessedProducts != 1 {
		t.Fatalf("unexpected product counts: total=%d processed=%d", snap.TotalProducts, snap.ProcessedProducts)
	}
	if snap.TranslatedCount != 18 || snap.FailedCount != 17 {
		t.Fatalf("unexpected translation counts: ok=%d err=%d", snap.TranslatedCount, snap.FailedCount)
	}
	if len(snap.Logs) != autoTranslateMaxLogs {
		t.Fatalf("expected logs capped at %d, got %d", autoTranslateMaxLogs, len(snap.Logs))
	}
	if snap.CurrentLanguage != "RU" || snap.CurrentProductTitle != "Kadın Viskon Bluz" {
		t.Fatalf("unexpected cursor: lang=%q title=%q", snap.CurrentLanguage, snap.CurrentProductTitle)
	}
}

func TestAutoTranslateStateLifecycleAndSnapshotIsolation(t *testing.T) {
	resetAutoTranslateTrackerForTest()
	defer resetAutoTranslateTrackerForTest()

	beginAutoTranslateRun(3)
	updateAutoTranslateCursor("Kadın Viskon Bluz", "ru")
	seedAutoTranslateLogsForTest(35)
	markAutoTranslateProductDone()

	runningSnap := getAutoTranslateStateSnapshot()
	assertRunningAutoTranslateSnapshot(t, runningSnap)

	// Mutating returned snapshot slice must not mutate global tracker logs
	runningSnap.Logs[0].TextIn = "mutated"
	finishAutoTranslateRun()

	idleSnap := getAutoTranslateStateSnapshot()
	if idleSnap.Status != string(StatusIdle) {
		t.Fatalf("expected idle status after finish, got %q", idleSnap.Status)
	}
	if idleSnap.CurrentProductTitle != "" || idleSnap.CurrentLanguage != "" {
		t.Fatalf("expected cursor cleared on finish, got title=%q lang=%q", idleSnap.CurrentProductTitle, idleSnap.CurrentLanguage)
	}
	if idleSnap.Logs[0].TextIn == "mutated" {
		t.Fatalf("snapshot log slice was not isolated from internal state")
	}
}

func TestAutoTranslateCooldownNormalization(t *testing.T) {
	resetAutoTranslateTrackerForTest()
	defer resetAutoTranslateTrackerForTest()

	future := time.Now().Add(5 * time.Minute)
	autoTranslateBreakerMu.Lock()
	autoTranslateCooldownUntil = future
	autoTranslateBreakerMu.Unlock()
	markAutoTranslateCooldown(future, "3 timeouts")
	finishAutoTranslateRun()

	coolingSnap := getAutoTranslateStateSnapshot()
	if coolingSnap.Status != "cooldown" || coolingSnap.CooldownUntil == nil {
		t.Fatalf("expected active cooldown status, got %+v", coolingSnap)
	}

	// Simulate expired breaker window
	autoTranslateBreakerMu.Lock()
	autoTranslateCooldownUntil = time.Now().Add(-1 * time.Second)
	autoTranslateBreakerMu.Unlock()

	expiredSnap := getAutoTranslateStateSnapshot()
	if expiredSnap.Status != string(StatusIdle) || expiredSnap.CooldownUntil != nil {
		t.Fatalf("expected expired cooldown to normalize to idle, got status=%q until=%v", expiredSnap.Status, expiredSnap.CooldownUntil)
	}
}

func TestAutoTranslateSplitChunksMaxRunes(t *testing.T) {
	if autoTranslateMaxChunkRunes != 350 {
		t.Fatalf("expected autoTranslateMaxChunkRunes=350, got %d", autoTranslateMaxChunkRunes)
	}
	paragraph := strings.Repeat("Pamuklu toptan kadın bluz kaliteli kumaş. ", 25)
	chunks := splitTextIntoTranslateChunks(paragraph, autoTranslateMaxChunkRunes)
	if len(chunks) < 2 {
		t.Fatalf("expected multiple chunks for long text, got %d", len(chunks))
	}
	for idx, ch := range chunks {
		if utf8.RuneCountInString(ch) > autoTranslateMaxChunkRunes {
			t.Fatalf("chunk %d exceeded max runes (%d > %d)", idx, utf8.RuneCountInString(ch), autoTranslateMaxChunkRunes)
		}
	}
}
