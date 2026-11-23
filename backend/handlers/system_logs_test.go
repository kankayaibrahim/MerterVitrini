package handlers

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseBackendLogEntriesAndStackTrace(t *testing.T) {
	raw := `==================================================
2026/11/23 02:10:00.123456 [ERROR/PANIC]
CRITICAL PANIC: HTTP Request Panic: GET /api/v1/store/products (Client IP: 1.2.3.4): runtime error: invalid memory address
Stack Trace:
goroutine 42 [running]:
runtime/debug.Stack()
	/usr/local/go/src/runtime/debug/stack.go:26 +0x5e
mertervitrini/backend/handlers.ListProducts(...)
	/app/handlers/store_catalog.go:102
==================================================

2026/11/23 02:11:00.000000 [WARN] [API] 1.2.3.4 - GET /missing | Status: 404 | Duration: 2.00ms
`
	entries := ParseBackendLogEntries(raw, logSourceBackendErrors, "error-2026-11-23.log")
	if len(entries) != 2 {
		t.Fatalf("expected 2 parsed entries, got %d", len(entries))
	}
	if entries[0].Severity != severityPanic {
		t.Fatalf("expected panic severity, got %s", entries[0].Severity)
	}
	if !strings.Contains(entries[0].StackTrace, "runtime/debug/stack.go:26") {
		t.Fatalf("expected stacktrace attached to panic entry, got %q", entries[0].StackTrace)
	}
	if entries[1].Severity != severityWarn {
		t.Fatalf("expected warn severity on second entry, got %s", entries[1].Severity)
	}
}

func TestParsePostgresLogEntriesGroupsStatementAndDetail(t *testing.T) {
	raw := `2026-11-23 02:20:07.935 +03 [1775] ERROR:  must be owner of table feedback_items
2026-11-23 02:20:07.935 +03 [1775] DETAIL:  Only owner can alter schema
2026-11-23 02:20:07.935 +03 [1775] STATEMENT:  ALTER TABLE core.feedback_items ADD COLUMN author_email VARCHAR(255);
2026-11-23 02:21:00.000 +03 [1776] WARNING:  there is no transaction in progress
2026-11-23 02:22:00.000 +03 [1777] LOG:  checkpoint complete
`
	entries := ParsePostgresLogEntries(raw, "postgresql-Mon.log")
	if len(entries) != 3 {
		t.Fatalf("expected 3 grouped PG entries, got %d", len(entries))
	}
	if entries[0].Severity != severityError {
		t.Fatalf("expected ERROR mapped to error, got %s", entries[0].Severity)
	}
	if !strings.Contains(entries[0].StackTrace, "DETAIL:") || !strings.Contains(entries[0].StackTrace, "STATEMENT:") {
		t.Fatalf("expected DETAIL and STATEMENT attached to PG error, got %q", entries[0].StackTrace)
	}
	if entries[1].Severity != severityWarn || entries[2].Severity != severityInfo {
		t.Fatalf("unexpected PG severity mapping: %s, %s", entries[1].Severity, entries[2].Severity)
	}
}

func TestParseNginxAndJournalctlEntries(t *testing.T) {
	nginxErr := `2026/11/23 02:30:26 [error] 9386#9386: *125 connect() failed (111: Connection refused) while connecting to upstream
2026/11/23 02:30:47 [warn] 10567#10567: conflicting server name "admin.mertervitrini.com.tr"
`
	errEntries := ParseNginxErrorEntries(nginxErr, "error.log")
	if len(errEntries) != 2 || errEntries[0].Severity != severityError || errEntries[1].Severity != severityWarn {
		t.Fatalf("unexpected nginx error entries: %+v", errEntries)
	}

	nginxAcc := `172.71.160.68 - - [23/Nov/2026:02:30:52 +0300] "GET /api/v1/store/brands HTTP/2.0" 200 1234 "-" "Mozilla/5.0"
172.71.160.68 - - [23/Nov/2026:02:31:00 +0300] "GET /bad HTTP/2.0" 502 150 "-" "Mozilla/5.0"
172.71.160.68 - - [23/Nov/2026:02:31:02 +0300] "GET /missing HTTP/2.0" 404 150 "-" "Mozilla/5.0"
`
	accEntries := ParseNginxAccessEntries(nginxAcc, "mertervitrini_access.log")
	if len(accEntries) != 3 || accEntries[0].Severity != severityInfo || accEntries[1].Severity != severityError || accEntries[2].Severity != severityWarn {
		t.Fatalf("unexpected nginx access entries: %+v", accEntries)
	}

	journalRaw := `2026-11-23T02:30:48+0300 host npm[10525]: TypeError: Cannot read properties of undefined
2026-11-23T02:30:48+0300 host npm[10525]:     at renderPage (/app/.next/server/page.js:12:4)
2026-11-23T02:30:48+0300 host npm[10525]:     at processTicksAndRejections (node:internal/process/task_queues:95:5)
`
	jEntries := ParseJournalctlEntries(journalRaw, logSourceFrontendSSR)
	if len(jEntries) != 1 || jEntries[0].Severity != severityError {
		t.Fatalf("expected 1 grouped JS error entry, got %+v", jEntries)
	}
	if !strings.Contains(jEntries[0].StackTrace, "renderPage") {
		t.Fatalf("expected JS stack frame attached, got %q", jEntries[0].StackTrace)
	}
}

func TestRedactSensitiveLogText(t *testing.T) {
	in := `Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def password=SuperSecret123! jwt_secret="top-secret"`
	out := RedactSensitiveLogText(in)
	if strings.Contains(out, "eyJhbGciOi") || strings.Contains(out, "SuperSecret123") || strings.Contains(out, "top-secret") {
		t.Fatalf("sensitive tokens leaked in redacted output: %s", out)
	}
}

func TestReadFileTailSkipsPartialFirstLine(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "sample.log")
	content := strings.Repeat("line-padding-0123456789\n", 10) + "FINAL_LINE_1\nFINAL_LINE_2\n"
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	tail, err := readFileTail(path, 35)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(tail, "FINAL_LINE_2") || strings.HasPrefix(tail, "line-padding") {
		t.Fatalf("unexpected tail output: %q", tail)
	}
}

func TestComputeOverallHealthVerdict(t *testing.T) {
	active := []ServiceHealthDTO{
		{Key: "backend", Label: "Go Backend", Status: "active"},
		{Key: "postgresql", Label: "PostgreSQL", Status: "active"},
	}
	v, _, _ := ComputeOverallHealthVerdict(active, HealthCounts{})
	if v != "healthy" {
		t.Fatalf("expected healthy, got %s", v)
	}
	vWarn, _, _ := ComputeOverallHealthVerdict(active, HealthCounts{SourceErrors: 2})
	if vWarn != "warning" {
		t.Fatalf("expected warning, got %s", vWarn)
	}
	vCrit, _, _ := ComputeOverallHealthVerdict(active, HealthCounts{UnresolvedCritical: 1})
	if vCrit != "critical" {
		t.Fatalf("expected critical on panic, got %s", vCrit)
	}
	downSvc := []ServiceHealthDTO{
		{Key: "postgresql", Label: "PostgreSQL", Status: "inactive"},
	}
	vDown, _, _ := ComputeOverallHealthVerdict(downSvc, HealthCounts{})
	if vDown != "critical" {
		t.Fatalf("expected critical when DB down, got %s", vDown)
	}
	unconfiguredRedis := append(append([]ServiceHealthDTO(nil), active...), ServiceHealthDTO{
		Key: "redis", Label: "Redis Cache", Status: "not_configured",
	})
	vUnconf, _, _ := ComputeOverallHealthVerdict(unconfiguredRedis, HealthCounts{})
	if vUnconf != "healthy" {
		t.Fatalf("expected healthy when Redis is not_configured, got %s", vUnconf)
	}
	downRedis := append(append([]ServiceHealthDTO(nil), active...), ServiceHealthDTO{
		Key: "redis", Label: "Redis Cache", Status: "down",
	})
	vRedisDown, _, _ := ComputeOverallHealthVerdict(downRedis, HealthCounts{})
	if vRedisDown != "critical" {
		t.Fatalf("expected critical when Redis is down, got %s", vRedisDown)
	}
}

func TestStableEntryIDDeterministic(t *testing.T) {
	a := stableEntryID(logSourceNginxError, "2026-11-23T02:00:00Z", "connect refused", 3)
	b := stableEntryID(logSourceNginxError, "2026-11-23T02:00:00Z", "connect refused", 3)
	c := stableEntryID(logSourceNginxError, "2026-11-23T02:00:00Z", "connect refused", 4)
	if len(a) != 16 || a != b || a == c {
		t.Fatalf("unexpected stableEntryID values: a=%s b=%s c=%s", a, b, c)
	}
}

func TestLogQueryHelpers(t *testing.T) {
	if got := parseLogQueryLimit(""); got != 200 {
		t.Fatalf("expected default limit 200, got %d", got)
	}
	if got := parseLogQueryLimit("-5"); got != 200 {
		t.Fatalf("expected default limit 200 for negative input, got %d", got)
	}
	if got := parseLogQueryLimit("5000"); got != 1000 {
		t.Fatalf("expected clamped limit 1000, got %d", got)
	}
	if got := parseLogQueryLimit("150"); got != 150 {
		t.Fatalf("expected limit 150, got %d", got)
	}

	entry := SystemLogEntryDTO{
		Severity:   severityError,
		Message:    "Database timeout while syncing",
		StackTrace: "goroutine 1: handlers/sync.go:44",
		FileName:   "error-2026-11-23.log",
	}
	if !matchesLogEntryFilters(entry, "error", "sync.go:44") {
		t.Fatal("expected entry to match severity=error and stacktrace query")
	}
	if matchesLogEntryFilters(entry, "warn", "") {
		t.Fatal("did not expect error entry to match warn severity filter")
	}
	if matchesLogEntryFilters(entry, "all", "nonexistent-needle") {
		t.Fatal("did not expect entry to match missing search needle")
	}
}

func TestTruncateOrRemoveDirFiles(t *testing.T) {
	tmpDir := t.TempDir()
	activePath := filepath.Join(tmpDir, "error.log")
	gzPath := filepath.Join(tmpDir, "error.log.1.gz")
	otherRotated := filepath.Join(tmpDir, "error.log.2")
	for _, p := range []string{activePath, gzPath, otherRotated} {
		if err := os.WriteFile(p, []byte("log payload data"), 0600); err != nil {
			t.Fatal(err)
		}
	}

	files := []SystemLogFileDTO{
		{Name: "error.log", SizeBytes: 16, IsActive: true},
		{Name: "error.log.1.gz", SizeBytes: 16, IsActive: false},
		{Name: "error.log.2", SizeBytes: 16, IsActive: false},
	}

	cleared, freed, err := truncateOrRemoveDirFiles(tmpDir, files, []string{"../escape.log", "error.log", "error.log.1.gz"}, false)
	if err != nil {
		t.Fatalf("truncateOrRemoveDirFiles failed: %v", err)
	}
	if cleared != 2 || freed != 32 {
		t.Fatalf("expected cleared=2 freed=32, got cleared=%d freed=%d", cleared, freed)
	}
	if info, statErr := os.Stat(activePath); statErr != nil || info.Size() != 0 {
		t.Fatalf("expected active log truncated to 0, err=%v size=%v", statErr, info)
	}
	if _, statErr := os.Stat(gzPath); !os.IsNotExist(statErr) {
		t.Fatalf("expected .gz file removed, statErr=%v", statErr)
	}
	if info, statErr := os.Stat(otherRotated); statErr != nil || info.Size() != 16 {
		t.Fatalf("expected unselected rotated file untouched, err=%v", statErr)
	}
}
