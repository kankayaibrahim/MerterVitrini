package handlers

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/logger"
)

const (
	logSourceExceptions    = "exceptions"
	logSourceBackendErrors = "backend_errors"
	logSourceBackendAll    = "backend_all"
	logSourceFrontendSSR   = "frontend_ssr"
	logSourceNginxError    = "nginx_error"
	logSourceNginxAccess   = "nginx_access"
	logSourcePostgresql    = "postgresql"

	severityPanic = "panic"
	severityFatal = "fatal"
	severityError = "error"
	severityWarn  = "warn"
	severityInfo  = "info"

	defaultNginxLogDir = "/var/log/nginx"
	defaultPGLogDir    = "/var/lib/pgsql/18/data/log"
	defaultTailBytes   = int64(512 * 1024)
	maxTailBytes       = int64(1024 * 1024)
)

var (
	reGoLogLine     = regexp.MustCompile(`^(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(.*)$`)
	reNginxErrLine  = regexp.MustCompile(`^(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})\s+\[([a-zA-Z]+)\]\s+(.*)$`)
	reNginxAccLine  = regexp.MustCompile(`^\S+\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d{3})\s+`)
	rePGLogLine     = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([+\-]?\d{2,4}|[A-Za-z/_+-]+)\s+\[(\d+)\]\s+([A-Z]+):\s*(.*)$`)
	reJournalLine   = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*)\s+(.*)$`)
	reBearerSecret  = regexp.MustCompile(`(?i)(authorization["':=\s]+bearer\s+|bearer\s+)[A-Za-z0-9\-._~+/]+=*`)
	reKVSecret      = regexp.MustCompile(`(?i)\b(password|passwd|jwt_secret|secret|api_key|apikey|token|db_password|smtp_password)\b(\s*[:=]\s*["']?)([^\s"',;}{]+)`)
)

// SystemLogFileDTO represents one readable log file inside an allowed directory.
type SystemLogFileDTO struct {
	Name      string    `json:"name"`
	SizeBytes int64     `json:"size_bytes"`
	ModTime   time.Time `json:"mod_time"`
	IsActive  bool      `json:"is_active"`
}

// SystemLogEntryDTO provides a unified view of entries across DB, Go, Nginx, PostgreSQL, and Next.js SSR.
type SystemLogEntryDTO struct {
	ID              string `json:"id"`
	Source          string `json:"source"`
	SourceLabel     string `json:"source_label"`
	Severity        string `json:"severity"`
	Timestamp       string `json:"timestamp"`
	TimestampUnix   int64  `json:"timestamp_unix"`
	Message         string `json:"message"`
	StackTrace      string `json:"stack_trace,omitempty"`
	FileName        string `json:"file_name,omitempty"`
	OccurrenceCount int    `json:"occurrence_count"`
	IsResolved      bool   `json:"is_resolved"`
	CanDeleteRow    bool   `json:"can_delete_row"`
}

// LogSourceSummaryDTO exposes health, counts, and available files per log source.
type LogSourceSummaryDTO struct {
	Source       string             `json:"source"`
	Label        string             `json:"label"`
	Available    bool               `json:"available"`
	ErrorCount   int                `json:"error_count"`
	WarnCount    int                `json:"warn_count"`
	TotalBytes   int64              `json:"total_bytes"`
	FileCount    int                `json:"file_count"`
	Files        []SystemLogFileDTO `json:"files,omitempty"`
	ClearedAfter string             `json:"cleared_after,omitempty"`
}

// ServiceHealthDTO captures live systemd / DB / Redis operational state.
type ServiceHealthDTO struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Status    string `json:"status"`
	LatencyMS int64  `json:"latency_ms,omitempty"`
	Detail    string `json:"detail,omitempty"`
}

// HealthCounts holds aggregate counts used for overall verdict classification.
type HealthCounts struct {
	UnresolvedCritical int
	UnresolvedErrors   int
	SourceErrors       int
	SourceWarnings     int
	RedisDown          bool
}

// AdminSystemLogsHandler powers Admin observability, stacktrace review, and safe log cleanup.
type AdminSystemLogsHandler struct {
	Cfg *config.Config
}

// NewAdminSystemLogsHandler builds an AdminSystemLogsHandler.
func NewAdminSystemLogsHandler(cfg *config.Config) *AdminSystemLogsHandler {
	return &AdminSystemLogsHandler{Cfg: cfg}
}

func sourceDisplayLabel(source string) string {
	switch source {
	case logSourceExceptions:
		return "Yakalanan Hatalar & Stacktrace"
	case logSourceBackendErrors:
		return "Backend Hata Dosyaları"
	case logSourceBackendAll:
		return "Backend Tüm Loglar"
	case logSourceFrontendSSR:
		return "Frontend SSR (Next.js)"
	case logSourceNginxError:
		return "Nginx Hata Logu"
	case logSourceNginxAccess:
		return "Nginx Erişim Logu"
	case logSourcePostgresql:
		return "PostgreSQL 18 Logları"
	default:
		return source
	}
}

func stableEntryID(source, ts, msg string, idx int) string {
	h := sha1.Sum(fmt.Appendf(nil, "%s|%s|%d|%s", source, ts, idx, msg))
	return hex.EncodeToString(h[:8])
}

// RedactSensitiveLogText masks tokens, passwords, and secrets before sending log text to Admin UI.
func RedactSensitiveLogText(raw string) string {
	if raw == "" {
		return ""
	}
	masked := reBearerSecret.ReplaceAllString(raw, "${1}[REDACTED]")
	return reKVSecret.ReplaceAllString(masked, "${1}${2}[REDACTED]")
}

func isSafeLogFilename(name string) bool {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" || strings.Contains(trimmed, "..") || strings.ContainsAny(trimmed, "/\\") {
		return false
	}
	return filepath.Base(trimmed) == trimmed
}

func readFileTail(filePath string, maxBytes int64) (string, error) {
	if maxBytes <= 0 {
		maxBytes = defaultTailBytes
	}
	if maxBytes > maxTailBytes {
		maxBytes = maxTailBytes
	}
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return "", err
	}
	size := info.Size()
	if size == 0 {
		return "", nil
	}

	offset := int64(0)
	if size > maxBytes {
		offset = size - maxBytes
	}
	if offset > 0 {
		if _, seekErr := f.Seek(offset, io.SeekStart); seekErr != nil {
			return "", seekErr
		}
	}

	buf, err := io.ReadAll(f)
	if err != nil {
		return "", err
	}
	text := string(buf)
	if offset > 0 {
		if nl := strings.IndexByte(text, '\n'); nl >= 0 {
			text = text[nl+1:]
		}
	}
	return text, nil
}

func classifyBackendSeverity(body string) string {
	upper := strings.ToUpper(body)
	switch {
	case strings.Contains(upper, "[PANIC]") || strings.Contains(upper, "CRITICAL PANIC") || strings.Contains(upper, "[ERROR/PANIC]"):
		return severityPanic
	case strings.Contains(upper, "[FATAL]"):
		return severityFatal
	case strings.Contains(upper, "[ERROR]") || strings.Contains(upper, "STATUS: 5") || strings.Contains(upper, "STATUS:5"):
		return severityError
	case strings.Contains(upper, "[WARN]") || strings.Contains(upper, "[WARNING]") || strings.Contains(upper, "STATUS: 4") || strings.Contains(upper, "STATUS:4"):
		return severityWarn
	default:
		return severityInfo
	}
}

func parseTimestampInIstanbul(layout, raw string) time.Time {
	loc := istanbulLocation()
	if t, err := time.ParseInLocation(layout, raw, loc); err == nil {
		return t
	}
	return time.Now().In(loc)
}

func appendStackLine(entries []SystemLogEntryDTO, line string) {
	if len(entries) == 0 {
		return
	}
	last := &entries[len(entries)-1]
	trimmedRight := strings.TrimRight(line, "\r")
	if strings.TrimSpace(trimmedRight) == "" {
		return
	}
	if last.StackTrace == "" {
		last.StackTrace = trimmedRight
		return
	}
	last.StackTrace += "\n" + trimmedRight
}

// ParseBackendLogEntries parses Go daily logs and groups multi-line panic stacktraces cleanly.
func ParseBackendLogEntries(raw, source, fileName string) []SystemLogEntryDTO {
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")
	entries := make([]SystemLogEntryDTO, 0, 64)
	loc := istanbulLocation()

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "==========") {
			continue
		}
		if match := reGoLogLine.FindStringSubmatch(line); match != nil {
			tsStr := match[1]
			body := strings.TrimSpace(match[2])
			layout := "2006/01/02 15:04:05"
			if strings.Contains(tsStr, ".") {
				layout = "2006/01/02 15:04:05.000000"
			}
			ts := parseTimestampInIstanbul(layout, tsStr)
			sev := classifyBackendSeverity(body)
			entries = append(entries, SystemLogEntryDTO{
				ID:              stableEntryID(source, tsStr, body, i),
				Source:          source,
				SourceLabel:     sourceDisplayLabel(source),
				Severity:        sev,
				Timestamp:       ts.In(loc).Format(time.RFC3339),
				TimestampUnix:   ts.UnixNano(),
				Message:         RedactSensitiveLogText(body),
				FileName:        fileName,
				OccurrenceCount: 1,
			})
			continue
		}
		appendStackLine(entries, RedactSensitiveLogText(line))
	}
	return entries
}

// ParseNginxErrorEntries parses /var/log/nginx/error.log lines.
func ParseNginxErrorEntries(raw, fileName string) []SystemLogEntryDTO {
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")
	entries := make([]SystemLogEntryDTO, 0, 64)
	loc := istanbulLocation()

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if match := reNginxErrLine.FindStringSubmatch(trimmed); match != nil {
			ts := parseTimestampInIstanbul("2006/01/02 15:04:05", match[1])
			lvl := strings.ToLower(match[2])
			sev := severityInfo
			switch lvl {
			case "emerg", "alert", "crit":
				sev = severityFatal
			case "error":
				sev = severityError
			case "warn":
				sev = severityWarn
			}
			msg := RedactSensitiveLogText(strings.TrimSpace(match[3]))
			entries = append(entries, SystemLogEntryDTO{
				ID:              stableEntryID(logSourceNginxError, match[1], msg, i),
				Source:          logSourceNginxError,
				SourceLabel:     sourceDisplayLabel(logSourceNginxError),
				Severity:        sev,
				Timestamp:       ts.In(loc).Format(time.RFC3339),
				TimestampUnix:   ts.UnixNano(),
				Message:         msg,
				FileName:        fileName,
				OccurrenceCount: 1,
			})
		}
	}
	return entries
}

// ParseNginxAccessEntries parses Nginx combined access log lines and maps 4xx/5xx statuses.
func ParseNginxAccessEntries(raw, fileName string) []SystemLogEntryDTO {
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")
	entries := make([]SystemLogEntryDTO, 0, 128)
	loc := istanbulLocation()

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		match := reNginxAccLine.FindStringSubmatch(trimmed)
		if match == nil {
			continue
		}
		ts, err := time.Parse("02/Jan/2006:15:04:05 -0700", match[1])
		if err != nil {
			ts = time.Now().In(loc)
		}
		statusCode, _ := strconv.Atoi(match[3])
		sev := severityInfo
		if statusCode >= 500 {
			sev = severityError
		} else if statusCode >= 400 {
			sev = severityWarn
		}
		msg := RedactSensitiveLogText(trimmed)
		entries = append(entries, SystemLogEntryDTO{
			ID:              stableEntryID(logSourceNginxAccess, match[1], match[2], i),
			Source:          logSourceNginxAccess,
			SourceLabel:     sourceDisplayLabel(logSourceNginxAccess),
			Severity:        sev,
			Timestamp:       ts.In(loc).Format(time.RFC3339),
			TimestampUnix:   ts.UnixNano(),
			Message:         msg,
			FileName:        fileName,
			OccurrenceCount: 1,
		})
	}
	return entries
}

func parsePostgresTimestamp(datePart, tzPart string) time.Time {
	loc := istanbulLocation()
	layout := "2006-01-02 15:04:05"
	if strings.Contains(datePart, ".") {
		layout = "2006-01-02 15:04:05.000"
	}
	normTZ := strings.TrimSpace(tzPart)
	if len(normTZ) == 3 && (normTZ[0] == '+' || normTZ[0] == '-') {
		normTZ += ":00"
	}
	if strings.HasPrefix(normTZ, "+") || strings.HasPrefix(normTZ, "-") {
		if t, err := time.Parse(layout+" -07:00", datePart+" "+normTZ); err == nil {
			return t
		}
	}
	if normTZ == "UTC" || normTZ == "GMT" {
		if t, err := time.ParseInLocation(layout, datePart, time.UTC); err == nil {
			return t
		}
	}
	if t, err := time.ParseInLocation(layout, datePart, loc); err == nil {
		return t
	}
	return time.Now().In(loc)
}

func isPostgresDetailLevel(level string) bool {
	switch strings.ToUpper(level) {
	case "STATEMENT", "DETAIL", "HINT", "CONTEXT", "QUERY", "LOCATION":
		return true
	default:
		return false
	}
}

func mapPostgresSeverity(level string) string {
	switch strings.ToUpper(level) {
	case "PANIC":
		return severityPanic
	case "FATAL":
		return severityFatal
	case "ERROR":
		return severityError
	case "WARNING":
		return severityWarn
	default:
		return severityInfo
	}
}

// ParsePostgresLogEntries parses PostgreSQL 18 logs and attaches DETAIL/STATEMENT/CONTEXT lines to the parent log.
func ParsePostgresLogEntries(raw, fileName string) []SystemLogEntryDTO {
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")
	entries := make([]SystemLogEntryDTO, 0, 64)
	loc := istanbulLocation()

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		match := rePGLogLine.FindStringSubmatch(trimmed)
		if match == nil {
			appendStackLine(entries, RedactSensitiveLogText(line))
			continue
		}
		level := strings.ToUpper(match[4])
		msg := RedactSensitiveLogText(strings.TrimSpace(match[5]))
		if isPostgresDetailLevel(level) {
			appendStackLine(entries, level+": "+msg)
			continue
		}
		ts := parsePostgresTimestamp(match[1], match[2])
		entries = append(entries, SystemLogEntryDTO{
			ID:              stableEntryID(logSourcePostgresql, match[1], level+"|"+msg, i),
			Source:          logSourcePostgresql,
			SourceLabel:     sourceDisplayLabel(logSourcePostgresql),
			Severity:        mapPostgresSeverity(level),
			Timestamp:       ts.In(loc).Format(time.RFC3339),
			TimestampUnix:   ts.UnixNano(),
			Message:         fmt.Sprintf("[%s] %s", level, msg),
			FileName:        fileName,
			OccurrenceCount: 1,
		})
	}
	return entries
}

func parseJournalTimestamp(rawTS string) time.Time {
	loc := istanbulLocation()
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05-0700", "2006-01-02T15:04:05.000000-0700"} {
		if t, err := time.Parse(layout, rawTS); err == nil {
			return t
		}
	}
	return time.Now().In(loc)
}

func classifyJournalSeverity(body string) string {
	lower := strings.ToLower(body)
	switch {
	case strings.Contains(lower, "fatal") || strings.Contains(lower, "unhandledrejection"):
		return severityFatal
	case strings.Contains(lower, "error") || strings.Contains(lower, "exception") ||
		strings.Contains(lower, "typeerror") || strings.Contains(lower, "referenceerror") ||
		strings.Contains(lower, "econnrefused") || strings.Contains(lower, "status=5"):
		return severityError
	case strings.Contains(lower, "warn") || strings.Contains(lower, "deprecated") || strings.Contains(lower, "timeout"):
		return severityWarn
	default:
		return severityInfo
	}
}

func isJournalStackContinuation(body string) bool {
	trimmed := strings.TrimSpace(body)
	return strings.HasPrefix(body, "    at ") ||
		strings.HasPrefix(body, "\tat ") ||
		strings.HasPrefix(trimmed, "at ") ||
		strings.HasPrefix(trimmed, "Caused by:") ||
		strings.HasPrefix(trimmed, "digest:")
}

// ParseJournalctlEntries parses systemd journalctl short-iso output and groups Node/Next.js stacktrace frames.
func ParseJournalctlEntries(raw, source string) []SystemLogEntryDTO {
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")
	entries := make([]SystemLogEntryDTO, 0, 64)
	loc := istanbulLocation()

	for i, line := range lines {
		if strings.TrimSpace(line) == "" || strings.HasPrefix(line, "-- ") {
			continue
		}
		match := reJournalLine.FindStringSubmatch(line)
		if match == nil {
			appendStackLine(entries, RedactSensitiveLogText(line))
			continue
		}
		ts := parseJournalTimestamp(match[1])
		rest := match[2]
		if colon := strings.Index(rest, ": "); colon > 0 && colon < 80 {
			rest = rest[colon+2:]
		}
		if len(entries) > 0 && isJournalStackContinuation(rest) {
			appendStackLine(entries, RedactSensitiveLogText(rest))
			continue
		}
		msg := RedactSensitiveLogText(strings.TrimSpace(rest))
		entries = append(entries, SystemLogEntryDTO{
			ID:              stableEntryID(source, match[1], msg, i),
			Source:          source,
			SourceLabel:     sourceDisplayLabel(source),
			Severity:        classifyJournalSeverity(msg),
			Timestamp:       ts.In(loc).Format(time.RFC3339),
			TimestampUnix:   ts.UnixNano(),
			Message:         msg,
			OccurrenceCount: 1,
		})
	}
	return entries
}

// ComputeOverallHealthVerdict summarizes system status ("healthy" | "warning" | "critical") and Turkish banner copy.
func ComputeOverallHealthVerdict(services []ServiceHealthDTO, counts HealthCounts) (verdict, headline, detail string) {
	for _, svc := range services {
		if svc.Status == "inactive" || svc.Status == "failed" || svc.Status == "down" {
			return "critical",
				"Kritik Servis Sorunu Tespit Edildi",
				fmt.Sprintf("%s servisi şu anda çalışmıyor (%s). Acil inceleme önerilir.", svc.Label, svc.Status)
		}
	}
	if counts.UnresolvedCritical > 0 {
		return "critical",
			"Kritik Hata / Panic Tespit Edildi",
			fmt.Sprintf("%d adet çözülmemiş panic/fatal exception kaydı bulunuyor.", counts.UnresolvedCritical)
	}
	totalErrors := counts.UnresolvedErrors + counts.SourceErrors
	if totalErrors > 0 || counts.RedisDown {
		return "warning",
			"Sistem Çalışıyor — İncelenmesi Gereken Hatalar Var",
			fmt.Sprintf("Aktif servisler ayakta; ancak toplam %d hata ve %d uyarı kaydı tespit edildi.", totalErrors, counts.SourceWarnings)
	}
	if counts.SourceWarnings > 0 {
		return "warning",
			"Sistem Sağlıklı (Düşük Seviyeli Uyarılar Mevcut)",
			fmt.Sprintf("Tüm çekirdek servisler çalışıyor. İsteğe bağlı incelenebilecek %d uyarı bulunuyor.", counts.SourceWarnings)
	}
	return "healthy",
		"Tüm Sistemler Sağlıklı",
		"Backend, Next.js SSR, Nginx ve PostgreSQL üzerinde çözümlenmemiş kritik hata tespit edilmedi."
}

func checkSystemdUnit(ctx context.Context, key, label, unit string) ServiceHealthDTO {
	if runtime.GOOS != "linux" {
		return ServiceHealthDTO{Key: key, Label: label, Status: "n/a", Detail: "Geliştirme ortamı"}
	}
	out, err := exec.CommandContext(ctx, "systemctl", "is-active", unit).Output()
	state := strings.TrimSpace(string(out))
	if state == "" && err != nil {
		state = "inactive"
	}
	return ServiceHealthDTO{Key: key, Label: label, Status: state}
}

func resolveNginxLogDir() string {
	if _, err := os.Stat(defaultNginxLogDir); err == nil {
		return defaultNginxLogDir
	}
	return ""
}

func resolvePostgresLogDir(ctx context.Context) string {
	if db.Pool != nil {
		var dataDir, logDir string
		_ = db.Pool.QueryRow(ctx, "SHOW data_directory").Scan(&dataDir)
		_ = db.Pool.QueryRow(ctx, "SHOW log_directory").Scan(&logDir)
		if logDir != "" {
			if filepath.IsAbs(logDir) {
				if _, err := os.Stat(logDir); err == nil {
					return logDir
				}
			} else if dataDir != "" {
				joined := filepath.Join(dataDir, logDir)
				if _, err := os.Stat(joined); err == nil {
					return joined
				}
			}
		}
	}
	if _, err := os.Stat(defaultPGLogDir); err == nil {
		return defaultPGLogDir
	}
	return ""
}

func listMatchingDirFiles(dir string, matcher func(string) bool, includeCompressed bool) []SystemLogFileDTO {
	if dir == "" {
		return nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	out := make([]SystemLogFileDTO, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !includeCompressed && strings.HasSuffix(name, ".gz") {
			continue
		}
		if !matcher(name) {
			continue
		}
		info, statErr := entry.Info()
		if statErr != nil {
			continue
		}
		out = append(out, SystemLogFileDTO{
			Name:      name,
			SizeBytes: info.Size(),
			ModTime:   info.ModTime(),
			IsActive:  strings.HasSuffix(name, ".log"),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].ModTime.Equal(out[j].ModTime) {
			return out[i].ModTime.After(out[j].ModTime)
		}
		return out[i].Name > out[j].Name
	})
	return out
}

func listFilesForSource(ctx context.Context, source string, includeCompressed bool) (string, []SystemLogFileDTO) {
	switch source {
	case logSourceBackendErrors:
		raw := logger.ListLogFilesByPrefix("error")
		return logger.GetLogDir(), mapLoggerFiles(raw)
	case logSourceBackendAll:
		raw := logger.ListLogFilesByPrefix("backend")
		return logger.GetLogDir(), mapLoggerFiles(raw)
	case logSourceNginxError:
		dir := resolveNginxLogDir()
		return dir, listMatchingDirFiles(dir, func(name string) bool {
			return strings.HasPrefix(name, "error.log")
		}, includeCompressed)
	case logSourceNginxAccess:
		dir := resolveNginxLogDir()
		return dir, listMatchingDirFiles(dir, func(name string) bool {
			return name == "access.log" || strings.HasPrefix(name, "access.log-") ||
				name == "mertervitrini_access.log" || strings.HasPrefix(name, "mertervitrini_access.log-")
		}, includeCompressed)
	case logSourcePostgresql:
		dir := resolvePostgresLogDir(ctx)
		return dir, listMatchingDirFiles(dir, func(name string) bool {
			return strings.HasPrefix(name, "postgresql-") && strings.Contains(name, ".log")
		}, includeCompressed)
	default:
		return "", nil
	}
}

func mapLoggerFiles(in []logger.LogFileInfo) []SystemLogFileDTO {
	out := make([]SystemLogFileDTO, 0, len(in))
	for _, f := range in {
		out = append(out, SystemLogFileDTO{
			Name:      f.Name,
			SizeBytes: f.SizeBytes,
			ModTime:   f.ModTime,
			IsActive:  f.IsActive,
		})
	}
	return out
}

func loadLogWatermark(ctx context.Context, source string) *time.Time {
	if db.Pool == nil {
		return nil
	}
	var ts time.Time
	err := db.Pool.QueryRow(ctx, `
		SELECT cleared_after FROM identity.system_log_watermarks WHERE source = $1
	`, source).Scan(&ts)
	if err != nil {
		return nil
	}
	return &ts
}

func readJournalForUnit(ctx context.Context, unit, source string, linesLimit int) ([]SystemLogEntryDTO, bool) {
	if runtime.GOOS != "linux" {
		return nil, false
	}
	args := []string{"-u", unit, "--output=short-iso", "--no-pager", "-n", strconv.Itoa(linesLimit)}
	if wm := loadLogWatermark(ctx, source); wm != nil {
		args = append(args, "--since", wm.Local().Format("2006-01-02 15:04:05"))
	}
	out, err := exec.CommandContext(ctx, "journalctl", args...).Output()
	if err != nil {
		return nil, false
	}
	return ParseJournalctlEntries(string(out), source), true
}

func countSeverities(entries []SystemLogEntryDTO) (errCnt, warnCnt int) {
	for _, e := range entries {
		switch e.Severity {
		case severityPanic, severityFatal, severityError:
			errCnt++
		case severityWarn:
			warnCnt++
		}
	}
	return errCnt, warnCnt
}

func readSourceEntries(
	ctx context.Context,
	source string,
	selectedFile string,
	unresolvedOnly bool,
) ([]SystemLogEntryDTO, []SystemLogFileDTO, bool) {
	switch source {
	case logSourceExceptions:
		return queryExceptionRows(ctx, unresolvedOnly), nil, db.Pool != nil
	case logSourceFrontendSSR:
		entries, ok := readJournalForUnit(ctx, "merter-frontend", logSourceFrontendSSR, 350)
		return entries, nil, ok
	case logSourceBackendErrors, logSourceBackendAll, logSourceNginxError, logSourceNginxAccess, logSourcePostgresql:
		dir, files := listFilesForSource(ctx, source, false)
		if dir == "" || len(files) == 0 {
			return nil, files, dir != ""
		}
		targets := selectReadableFiles(files, selectedFile)
		all := make([]SystemLogEntryDTO, 0, 128)
		for _, f := range targets {
			raw, readErr := readFileTail(filepath.Join(dir, f.Name), defaultTailBytes)
			if readErr != nil {
				continue
			}
			all = append(all, parseEntriesBySource(raw, source, f.Name)...)
		}
		return all, files, true
	default:
		return nil, nil, false
	}
}

func selectReadableFiles(files []SystemLogFileDTO, requested string) []SystemLogFileDTO {
	if len(files) == 0 {
		return nil
	}
	if requested != "" && isSafeLogFilename(requested) {
		for _, f := range files {
			if f.Name == requested {
				return []SystemLogFileDTO{f}
			}
		}
	}
	// Read newest active/modified file (or newest file first) to stay crisp and fast
	return files[:1]
}

func parseEntriesBySource(raw, source, fileName string) []SystemLogEntryDTO {
	switch source {
	case logSourceBackendErrors, logSourceBackendAll:
		return ParseBackendLogEntries(raw, source, fileName)
	case logSourceNginxError:
		return ParseNginxErrorEntries(raw, fileName)
	case logSourceNginxAccess:
		return ParseNginxAccessEntries(raw, fileName)
	case logSourcePostgresql:
		return ParsePostgresLogEntries(raw, fileName)
	default:
		return nil
	}
}

func queryExceptionRows(ctx context.Context, unresolvedOnly bool) []SystemLogEntryDTO {
	if db.Pool == nil {
		return nil
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT id::text, severity, source, message, stack_trace,
		       occurrence_count, is_resolved, last_seen_at
		FROM identity.system_exception_logs
		WHERE ($1 = false OR is_resolved = false)
		ORDER BY last_seen_at DESC
		LIMIT 300
	`, unresolvedOnly)
	if err != nil {
		return nil
	}
	defer rows.Close()

	loc := istanbulLocation()
	out := make([]SystemLogEntryDTO, 0, 32)
	for rows.Next() {
		var e SystemLogEntryDTO
		var ts time.Time
		if scanErr := rows.Scan(
			&e.ID, &e.Severity, &e.Source, &e.Message, &e.StackTrace,
			&e.OccurrenceCount, &e.IsResolved, &ts,
		); scanErr != nil {
			continue
		}
		e.Source = logSourceExceptions
		e.SourceLabel = sourceDisplayLabel(logSourceExceptions)
		e.Message = RedactSensitiveLogText(e.Message)
		e.StackTrace = RedactSensitiveLogText(e.StackTrace)
		if e.Severity == "http_5xx" {
			e.Severity = severityError
		}
		e.Timestamp = ts.In(loc).Format(time.RFC3339)
		e.TimestampUnix = ts.UnixNano()
		e.CanDeleteRow = true
		out = append(out, e)
	}
	return out
}

// GetSystemHealth handles GET /api/v1/admin/system-logs/health
func (h *AdminSystemLogsHandler) GetSystemHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	services := make([]ServiceHealthDTO, 0, 5)
	services = append(services, ServiceHealthDTO{
		Key:    "backend",
		Label:  "Go Backend API",
		Status: "active",
		Detail: "Port 8080 • Çalışıyor",
	})
	services = append(services, checkSystemdUnit(ctx, "frontend", "Next.js SSR", "merter-frontend.service"))
	services = append(services, checkSystemdUnit(ctx, "nginx", "Nginx Proxy", "nginx.service"))

	pgSvc := ServiceHealthDTO{Key: "postgresql", Label: "PostgreSQL 18", Status: "down"}
	if db.Pool != nil {
		start := time.Now()
		if pingErr := db.Pool.Ping(ctx); pingErr == nil {
			var activeConns int
			_ = db.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM pg_stat_activity WHERE state IS NOT NULL`).Scan(&activeConns)
			pgSvc.Status = "active"
			pgSvc.LatencyMS = time.Since(start).Milliseconds()
			pgSvc.Detail = fmt.Sprintf("%d aktif bağlantı • %dms", activeConns, pgSvc.LatencyMS)
		} else {
			pgSvc.Detail = pingErr.Error()
		}
	}
	services = append(services, pgSvc)

	redisSvc := ServiceHealthDTO{Key: "redis", Label: "Redis Cache", Status: "not_configured", Detail: "Yapılandırılmamış"}
	redisDown := false
	if db.RedisClient != nil {
		start := time.Now()
		if err := db.RedisClient.Ping(ctx).Err(); err == nil {
			redisSvc.Status = "active"
			redisSvc.LatencyMS = time.Since(start).Milliseconds()
			redisSvc.Detail = fmt.Sprintf("%dms", redisSvc.LatencyMS)
		} else {
			redisSvc.Status = "down"
			redisSvc.Detail = err.Error()
			redisDown = true
		}
	}
	services = append(services, redisSvc)

	summaries, counts := h.buildAllSourceSummaries(ctx)
	counts.RedisDown = redisDown
	verdict, headline, detail := ComputeOverallHealthVerdict(services, counts)

	var totalDiskBytes int64
	for _, s := range summaries {
		totalDiskBytes += s.TotalBytes
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"verdict":              verdict,
		"headline":             headline,
		"detail":               detail,
		"checked_at":           time.Now().In(istanbulLocation()).Format(time.RFC3339),
		"total_disk_bytes":     totalDiskBytes,
		"unresolved_critical":  counts.UnresolvedCritical,
		"unresolved_errors":    counts.UnresolvedErrors,
		"source_errors":        counts.SourceErrors,
		"source_warnings":      counts.SourceWarnings,
		"services":             services,
		"sources":              summaries,
	})
}

var allLogSources = []string{
	logSourceExceptions,
	logSourceBackendErrors,
	logSourceBackendAll,
	logSourceFrontendSSR,
	logSourceNginxError,
	logSourceNginxAccess,
	logSourcePostgresql,
}

func isHealthCountedLogSource(src string) bool {
	switch src {
	case logSourceBackendErrors, logSourceNginxError, logSourcePostgresql, logSourceFrontendSSR:
		return true
	default:
		return false
	}
}

func buildExceptionSourceSummary(ctx context.Context, summary LogSourceSummaryDTO, counts *HealthCounts) LogSourceSummaryDTO {
	if db.Pool == nil {
		return summary
	}
	summary.Available = true
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(COUNT(*) FILTER (WHERE is_resolved = false AND severity IN ('panic','fatal')), 0)::int,
			COALESCE(COUNT(*) FILTER (WHERE is_resolved = false AND severity NOT IN ('panic','fatal','warn','info')), 0)::int
		FROM identity.system_exception_logs
	`).Scan(&counts.UnresolvedCritical, &counts.UnresolvedErrors)
	summary.ErrorCount = counts.UnresolvedCritical + counts.UnresolvedErrors
	return summary
}

func buildFileOrStreamSourceSummary(ctx context.Context, src string, summary LogSourceSummaryDTO, counts *HealthCounts) LogSourceSummaryDTO {
	entries, files, avail := readSourceEntries(ctx, src, "", false)
	summary.Available = avail
	summary.Files = files
	summary.FileCount = len(files)
	for _, f := range files {
		summary.TotalBytes += f.SizeBytes
	}
	if src == logSourceFrontendSSR {
		if wm := loadLogWatermark(ctx, src); wm != nil {
			summary.ClearedAfter = wm.In(istanbulLocation()).Format(time.RFC3339)
		}
	}
	errCnt, warnCnt := countSeverities(entries)
	summary.ErrorCount = errCnt
	summary.WarnCount = warnCnt
	if isHealthCountedLogSource(src) {
		counts.SourceErrors += errCnt
		counts.SourceWarnings += warnCnt
	}
	return summary
}

func (h *AdminSystemLogsHandler) buildAllSourceSummaries(ctx context.Context) ([]LogSourceSummaryDTO, HealthCounts) {
	summaries := make([]LogSourceSummaryDTO, 0, len(allLogSources))
	var counts HealthCounts

	for _, src := range allLogSources {
		summary := LogSourceSummaryDTO{
			Source: src,
			Label:  sourceDisplayLabel(src),
		}
		if src == logSourceExceptions {
			summaries = append(summaries, buildExceptionSourceSummary(ctx, summary, &counts))
			continue
		}
		summaries = append(summaries, buildFileOrStreamSourceSummary(ctx, src, summary, &counts))
	}
	return summaries, counts
}

func parseRequestedSources(raw string) []string {
	valid := map[string]bool{
		logSourceExceptions:    true,
		logSourceBackendErrors: true,
		logSourceBackendAll:    true,
		logSourceFrontendSSR:   true,
		logSourceNginxError:    true,
		logSourceNginxAccess:   true,
		logSourcePostgresql:    true,
	}
	if strings.TrimSpace(raw) == "" {
		return []string{logSourceExceptions, logSourceBackendErrors, logSourceNginxError, logSourcePostgresql}
	}
	seen := make(map[string]bool)
	out := make([]string, 0, 7)
	for _, p := range strings.Split(raw, ",") {
		key := strings.TrimSpace(p)
		if valid[key] && !seen[key] {
			seen[key] = true
			out = append(out, key)
		}
	}
	if len(out) == 0 {
		return []string{logSourceExceptions}
	}
	return out
}

func matchesSeverityFilter(entrySeverity, filter string) bool {
	switch filter {
	case "", "all":
		return true
	case "critical":
		return entrySeverity == severityPanic || entrySeverity == severityFatal
	case "error":
		return entrySeverity == severityPanic || entrySeverity == severityFatal || entrySeverity == severityError
	case "warn":
		return entrySeverity == severityWarn
	case "info":
		return entrySeverity == severityInfo
	default:
		return entrySeverity == filter
	}
}

func parseLogQueryLimit(raw string) int {
	rawLim, err := strconv.Atoi(raw)
	if err != nil || rawLim <= 0 {
		return 200
	}
	if rawLim > 1000 {
		return 1000
	}
	return rawLim
}

func matchesLogEntryFilters(item SystemLogEntryDTO, severityFilter, search string) bool {
	if !matchesSeverityFilter(item.Severity, severityFilter) {
		return false
	}
	if search == "" {
		return true
	}
	haystack := strings.ToLower(item.Message + "\n" + item.StackTrace + "\n" + item.FileName)
	return strings.Contains(haystack, search)
}

func appendFilteredLogEntries(
	collected, rawEntries []SystemLogEntryDTO,
	src, severityFilter, search string,
	countsBySeverity, countsBySource map[string]int,
) []SystemLogEntryDTO {
	for _, item := range rawEntries {
		if !matchesLogEntryFilters(item, severityFilter, search) {
			continue
		}
		countsBySeverity[item.Severity]++
		countsBySource[src]++
		collected = append(collected, item)
	}
	return collected
}

// QuerySystemLogs handles GET /api/v1/admin/system-logs
func (h *AdminSystemLogsHandler) QuerySystemLogs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()

	q := r.URL.Query()
	sources := parseRequestedSources(q.Get("sources"))
	severityFilter := strings.ToLower(strings.TrimSpace(q.Get("severity")))
	search := strings.ToLower(strings.TrimSpace(q.Get("q")))
	selectedFile := strings.TrimSpace(q.Get("file"))
	unresolvedOnly := q.Get("unresolved_only") == "true"
	limit := parseLogQueryLimit(q.Get("limit"))

	collected := make([]SystemLogEntryDTO, 0, 256)
	countsBySeverity := map[string]int{
		severityPanic: 0,
		severityFatal: 0,
		severityError: 0,
		severityWarn:  0,
		severityInfo:  0,
	}
	countsBySource := make(map[string]int, len(sources))
	availableFiles := make([]SystemLogFileDTO, 0)
	singleSource := len(sources) == 1

	for _, src := range sources {
		fileArg := ""
		if singleSource {
			fileArg = selectedFile
		}
		rawEntries, files, _ := readSourceEntries(ctx, src, fileArg, unresolvedOnly)
		if singleSource && len(files) > 0 {
			availableFiles = files
		}
		collected = appendFilteredLogEntries(collected, rawEntries, src, severityFilter, search, countsBySeverity, countsBySource)
	}

	sort.Slice(collected, func(i, j int) bool {
		return collected[i].TimestampUnix > collected[j].TimestampUnix
	})

	totalMatched := len(collected)
	if len(collected) > limit {
		collected = collected[:limit]
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"entries":            collected,
		"total_matched":      totalMatched,
		"counts_by_severity": countsBySeverity,
		"counts_by_source":   countsBySource,
		"available_files":    availableFiles,
	})
}

func filterValidUUIDs(ids []string) []string {
	validIDs := make([]string, 0, len(ids))
	for _, id := range ids {
		if isValidUUIDString(id) {
			validIDs = append(validIDs, id)
		}
	}
	return validIDs
}

// ResolveExceptions handles POST /api/v1/admin/system-logs/resolve
func (h *AdminSystemLogsHandler) ResolveExceptions(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs      []string `json:"ids"`
		Resolved bool     `json:"resolved"`
	}
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz istek verisi")
		return
	}
	validIDs := filterValidUUIDs(req.IDs)
	if len(validIDs) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Geçerli hata kaydı seçilmedi")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()

	tag, err := db.Pool.Exec(ctx, `
		UPDATE identity.system_exception_logs
		SET is_resolved = $2
		WHERE id = ANY($1::uuid[])
	`, validIDs, req.Resolved)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Kayıtlar güncellenemedi")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"affected": tag.RowsAffected(),
	})
}

type clearFileTarget struct {
	Source   string `json:"source"`
	Filename string `json:"filename"`
}

type clearLogsRequest struct {
	Mode           string            `json:"mode"`
	IDs            []string          `json:"ids"`
	Sources        []string          `json:"sources"`
	Files          []clearFileTarget `json:"files"`
	IncludeRotated bool              `json:"include_rotated"`
}

type clearLogsResult struct {
	ClearedSources []string
	ClearedEntries int
	ClearedFiles   int
	FreedBytes     int64
}

func selectSpecificLogFiles(files []SystemLogFileDTO, specific []string) []SystemLogFileDTO {
	allowed := make(map[string]SystemLogFileDTO, len(files))
	for _, f := range files {
		allowed[f.Name] = f
	}
	targets := make([]SystemLogFileDTO, 0, len(specific))
	for _, raw := range specific {
		if !isSafeLogFilename(raw) {
			continue
		}
		if info, ok := allowed[strings.TrimSpace(raw)]; ok {
			targets = append(targets, info)
		}
	}
	return targets
}

func selectClearTargetFiles(files []SystemLogFileDTO, specific []string, includeRotated bool) []SystemLogFileDTO {
	if len(specific) > 0 {
		return selectSpecificLogFiles(files, specific)
	}
	targets := make([]SystemLogFileDTO, 0, len(files))
	for _, f := range files {
		if f.IsActive || includeRotated {
			targets = append(targets, f)
		}
	}
	return targets
}

func clearSingleDirFile(dir string, target SystemLogFileDTO) (bool, int64, error) {
	fullPath := filepath.Join(dir, target.Name)
	if strings.HasSuffix(target.Name, ".gz") {
		if err := os.Remove(fullPath); err == nil {
			return true, target.SizeBytes, nil
		}
		return false, 0, nil
	}
	if err := os.Truncate(fullPath, 0); err != nil {
		return false, 0, err
	}
	return true, target.SizeBytes, nil
}

func truncateOrRemoveDirFiles(dir string, files []SystemLogFileDTO, specific []string, includeRotated bool) (int, int64, error) {
	if dir == "" || len(files) == 0 {
		return 0, 0, nil
	}
	targets := selectClearTargetFiles(files, specific, includeRotated)
	clearedCount := 0
	var freed int64
	for _, t := range targets {
		cleared, delta, err := clearSingleDirFile(dir, t)
		if err != nil {
			return clearedCount, freed, err
		}
		if cleared {
			clearedCount++
			freed += delta
		}
	}
	return clearedCount, freed, nil
}

func clearSingleLogSource(ctx context.Context, source string, specificFiles []string, includeRotated bool, actorEmail string) (int, int64, error) {
	switch source {
	case logSourceExceptions:
		if db.Pool == nil {
			return 0, 0, nil
		}
		tag, err := db.Pool.Exec(ctx, `DELETE FROM identity.system_exception_logs`)
		ResetDefaultExceptionMonitorRing()
		if err != nil {
			return 0, 0, err
		}
		return int(tag.RowsAffected()), 0, nil
	case logSourceBackendErrors:
		_, freed, err := logger.ClearLogFilesByPrefix("error", specificFiles, includeRotated)
		return 1, freed, err
	case logSourceBackendAll:
		_, freed, err := logger.ClearLogFilesByPrefix("backend", specificFiles, includeRotated)
		return 1, freed, err
	case logSourceFrontendSSR:
		if db.Pool == nil {
			return 0, 0, errors.New("veritabanı bağlantısı yok")
		}
		_, err := db.Pool.Exec(ctx, `
			INSERT INTO identity.system_log_watermarks (source, cleared_after, cleared_by, updated_at)
			VALUES ($1, NOW(), $2, NOW())
			ON CONFLICT (source) DO UPDATE SET
				cleared_after = NOW(),
				cleared_by = EXCLUDED.cleared_by,
				updated_at = NOW()
		`, logSourceFrontendSSR, actorEmail)
		return 1, 0, err
	case logSourceNginxError, logSourceNginxAccess, logSourcePostgresql:
		dir, files := listFilesForSource(ctx, source, includeRotated || len(specificFiles) > 0)
		_, freed, err := truncateOrRemoveDirFiles(dir, files, specificFiles, includeRotated)
		return 1, freed, err
	default:
		return 0, 0, fmt.Errorf("bilinmeyen log kaynağı: %s", source)
	}
}

func extractActorEmail(ctx context.Context) string {
	actor, ok := middleware.GetUserFromContext(ctx)
	if ok && actor != nil && strings.TrimSpace(actor.Email) != "" {
		return strings.TrimSpace(actor.Email)
	}
	return "admin"
}

func clearSelectedExceptionIDs(ctx context.Context, ids []string) (clearLogsResult, int, string) {
	res := clearLogsResult{ClearedSources: make([]string, 0)}
	validIDs := filterValidUUIDs(ids)
	if len(validIDs) == 0 {
		return res, http.StatusBadRequest, "Silinecek geçerli kayıt seçilmedi"
	}
	tag, err := db.Pool.Exec(ctx, `DELETE FROM identity.system_exception_logs WHERE id = ANY($1::uuid[])`, validIDs)
	if err != nil {
		return res, http.StatusInternalServerError, "Seçili exception kayıtları silinemedi"
	}
	res.ClearedEntries = int(tag.RowsAffected())
	res.ClearedSources = append(res.ClearedSources, logSourceExceptions)
	return res, 0, ""
}

func clearSelectedLogFiles(ctx context.Context, files []clearFileTarget, actorEmail string) (clearLogsResult, int, string) {
	res := clearLogsResult{ClearedSources: make([]string, 0)}
	bySource := make(map[string][]string)
	for _, f := range files {
		if isSafeLogFilename(f.Filename) {
			bySource[f.Source] = append(bySource[f.Source], f.Filename)
		}
	}
	for src, fileList := range bySource {
		_, freed, err := clearSingleLogSource(ctx, src, fileList, true, actorEmail)
		if err != nil {
			return res, http.StatusInternalServerError, fmt.Sprintf("%s temizlenemedi: %v", src, err)
		}
		res.ClearedFiles += len(fileList)
		res.FreedBytes += freed
		res.ClearedSources = append(res.ClearedSources, src)
	}
	return res, 0, ""
}

func clearRequestedLogSources(ctx context.Context, req clearLogsRequest, actorEmail string) (clearLogsResult, int, string) {
	res := clearLogsResult{ClearedSources: make([]string, 0)}
	targetSources := req.Sources
	if req.Mode == "all" {
		targetSources = allLogSources
	}
	for _, src := range parseRequestedSources(strings.Join(targetSources, ",")) {
		cnt, freed, err := clearSingleLogSource(ctx, src, nil, req.IncludeRotated, actorEmail)
		if err != nil {
			return res, http.StatusInternalServerError, fmt.Sprintf("%s temizlenemedi: %v", src, err)
		}
		if src == logSourceExceptions {
			res.ClearedEntries += cnt
		} else {
			res.ClearedFiles += cnt
		}
		res.FreedBytes += freed
		res.ClearedSources = append(res.ClearedSources, src)
	}
	return res, 0, ""
}

// ClearSystemLogs handles POST /api/v1/admin/system-logs/clear
func (h *AdminSystemLogsHandler) ClearSystemLogs(w http.ResponseWriter, r *http.Request) {
	var req clearLogsRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz temizleme isteği")
		return
	}

	actorEmail := extractActorEmail(r.Context())
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var (
		res       clearLogsResult
		errStatus int
		errMsg    string
	)
	switch req.Mode {
	case "selected_ids":
		res, errStatus, errMsg = clearSelectedExceptionIDs(ctx, req.IDs)
	case "selected_files":
		res, errStatus, errMsg = clearSelectedLogFiles(ctx, req.Files, actorEmail)
	case "selected_sources", "all":
		res, errStatus, errMsg = clearRequestedLogSources(ctx, req, actorEmail)
	default:
		httpx.Error(w, http.StatusBadRequest, "Geçersiz temizleme modu")
		return
	}
	if errStatus != 0 {
		httpx.Error(w, errStatus, errMsg)
		return
	}

	logger.Infof("[ADMIN LOGS] %s cleared logs (mode=%s, sources=%v, entries=%d, freed=%dB)",
		actorEmail, req.Mode, res.ClearedSources, res.ClearedEntries, res.FreedBytes)

	httpx.JSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"cleared_sources": res.ClearedSources,
		"cleared_entries": res.ClearedEntries,
		"cleared_files":   res.ClearedFiles,
		"freed_bytes":     res.FreedBytes,
		"message":         "Seçilen log kayıtları ve dosyaları güvenli şekilde temizlendi.",
	})
}
