package handlers

import (
	"bytes"
	"context"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/safe"
)

const (
	nginxIngestorPollInterval = 15 * time.Second
	nginxIngestorChunkBytes   = 8 << 20 // 8 MiB per batch
	nginxIngestorMaxBatches   = 4
	nginxLogTimeLayout        = "02/Jan/2006:15:04:05 -0700"
)

type nginxParsedLine struct {
	timestamp  time.Time
	method     string
	rawTarget  string
	statusCode int
	userAgent  string
}

type botHourlyAggKey struct {
	bucketHour  time.Time
	botName     string
	path        string
	statusClass string
}

type botHourlyAggVal struct {
	category   string
	hits       int64
	lastSeenAt time.Time
}

type logIngestCursor struct {
	inode  int64
	offset int64
}

var excludedNginxBotPrefixes = []string{
	"/_next/",
	"/admin",
	"/supplier",
	"/uploads/",
	"/banners/",
	"/api/v1/admin/",
	"/api/v1/supplier/",
	"/api/v1/store/track",
	"/api/v1/store/member-events",
	"/api/v1/store/brand-events",
	"/api/v1/store/search-events",
	"/api/v1/store/images/",
	"/api/v1/store/cart",
	"/api/v1/store/auth/",
}

var ignoredStaticAssetExts = map[string]bool{
	".js": true, ".css": true, ".png": true, ".jpg": true, ".jpeg": true,
	".gif": true, ".webp": true, ".avif": true, ".svg": true, ".ico": true,
	".woff": true, ".woff2": true, ".ttf": true, ".eot": true, ".map": true,
}

// StartNginxBotLogIngestor polls the site-isolated Nginx access log and rolls bot hits into analytics.bot_crawl_hourly.
func StartNginxBotLogIngestor(ctx context.Context, cfg *config.Config) {
	if cfg == nil || strings.TrimSpace(cfg.NginxAccessLogPath) == "" {
		return
	}
	logPath := strings.TrimSpace(cfg.NginxAccessLogPath)
	safe.Go("Nginx Bot Crawl Log Ingestor", func() {
		ingestNginxBotLogOnce(ctx, logPath)
		ticker := time.NewTicker(nginxIngestorPollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				ingestNginxBotLogOnce(ctx, logPath)
			}
		}
	})
}

func ingestNginxBotLogOnce(ctx context.Context, logPath string) {
	if db.Pool == nil || ctx.Err() != nil {
		return
	}
	runCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	ensureAnalyticsSchema(runCtx)

	f, err := os.Open(logPath)
	if err != nil {
		return
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return
	}
	inode, hasInode := getFileInode(info)
	sourceKey := "nginx:" + logPath

	cursor := loadLogIngestCursor(runCtx, sourceKey)
	offset := resolveEffectiveLogOffset(cursor, info.Size(), inode, hasInode)
	if offset >= info.Size() {
		return
	}

	for batch := 0; batch < nginxIngestorMaxBatches; batch++ {
		if runCtx.Err() != nil || offset >= info.Size() {
			break
		}
		chunk, nextOffset, readErr := readNginxCompleteLines(f, offset, nginxIngestorChunkBytes)
		if readErr != nil || len(chunk) == 0 || nextOffset <= offset {
			break
		}
		aggs := aggregateNginxLogChunk(chunk)
		if persistErr := commitNginxBotBatch(runCtx, sourceKey, inode, nextOffset, aggs); persistErr != nil {
			log.Printf("[NGINX BOT INGESTOR WARNING] Batch commit failed: %v", persistErr)
			break
		}
		offset = nextOffset
	}
}

func loadLogIngestCursor(ctx context.Context, sourceKey string) logIngestCursor {
	var c logIngestCursor
	_ = db.Pool.QueryRow(ctx, `
		SELECT file_inode, byte_offset
		FROM analytics.log_ingest_cursors
		WHERE source_key = $1
	`, sourceKey).Scan(&c.inode, &c.offset)
	return c
}

func resolveEffectiveLogOffset(cursor logIngestCursor, fileSize, inode int64, hasInode bool) int64 {
	if cursor.offset <= 0 || fileSize < cursor.offset {
		return 0
	}
	if hasInode && cursor.inode > 0 && inode != cursor.inode {
		return 0
	}
	return cursor.offset
}

func readNginxCompleteLines(f *os.File, offset int64, maxBytes int) ([]byte, int64, error) {
	if _, err := f.Seek(offset, io.SeekStart); err != nil {
		return nil, offset, err
	}
	buf := make([]byte, maxBytes)
	n, err := f.Read(buf)
	if n <= 0 {
		return nil, offset, err
	}
	data := buf[:n]
	lastNL := bytes.LastIndexByte(data, '\n')
	if lastNL < 0 {
		return nil, offset, nil
	}
	return data[:lastNL+1], offset + int64(lastNL+1), nil
}

func aggregateNginxLogChunk(chunk []byte) map[botHourlyAggKey]*botHourlyAggVal {
	aggs := make(map[botHourlyAggKey]*botHourlyAggVal)
	for len(chunk) > 0 {
		var lineBytes []byte
		if idx := bytes.IndexByte(chunk, '\n'); idx >= 0 {
			lineBytes = chunk[:idx]
			chunk = chunk[idx+1:]
		} else {
			lineBytes = chunk
			chunk = nil
		}
		line := strings.TrimSpace(string(lineBytes))
		if line == "" {
			continue
		}
		parsed, ok := parseNginxMainLogLine(line)
		if !ok {
			continue
		}
		cleanPath, botName, botCategory, ingest := shouldIngestNginxBotHit(parsed.method, parsed.rawTarget, parsed.userAgent)
		if !ingest {
			continue
		}
		key := botHourlyAggKey{
			bucketHour:  parsed.timestamp.UTC().Truncate(time.Hour),
			botName:     truncateStr(botName, 60),
			path:        cleanPath,
			statusClass: statusCodeClass(parsed.statusCode),
		}
		existing := aggs[key]
		if existing == nil {
			aggs[key] = &botHourlyAggVal{
				category:   botCategory,
				hits:       1,
				lastSeenAt: parsed.timestamp.UTC(),
			}
			continue
		}
		existing.hits++
		if parsed.timestamp.After(existing.lastSeenAt) {
			existing.lastSeenAt = parsed.timestamp.UTC()
		}
	}
	return aggs
}

func commitNginxBotBatch(
	ctx context.Context,
	sourceKey string,
	inode int64,
	nextOffset int64,
	aggs map[botHourlyAggKey]*botHourlyAggVal,
) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if len(aggs) > 0 {
		batch := &pgx.Batch{}
		const upsertSQL = `
			INSERT INTO analytics.bot_crawl_hourly (
				bucket_hour, bot_name, bot_category, path, status_class, hits, last_seen_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (bucket_hour, bot_name, path, status_class)
			DO UPDATE SET
				hits = analytics.bot_crawl_hourly.hits + EXCLUDED.hits,
				bot_category = EXCLUDED.bot_category,
				last_seen_at = GREATEST(analytics.bot_crawl_hourly.last_seen_at, EXCLUDED.last_seen_at)
		`
		for k, v := range aggs {
			batch.Queue(upsertSQL, k.bucketHour, k.botName, v.category, k.path, k.statusClass, v.hits, v.lastSeenAt)
		}
		br := tx.SendBatch(ctx, batch)
		for range len(aggs) {
			if _, execErr := br.Exec(); execErr != nil {
				_ = br.Close()
				return execErr
			}
		}
		if closeErr := br.Close(); closeErr != nil {
			return closeErr
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO analytics.log_ingest_cursors (source_key, file_inode, byte_offset, updated_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
		ON CONFLICT (source_key) DO UPDATE SET
			file_inode = EXCLUDED.file_inode,
			byte_offset = EXCLUDED.byte_offset,
			updated_at = CURRENT_TIMESTAMP
	`, sourceKey, inode, nextOffset)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func parseNginxMainLogLine(line string) (nginxParsedLine, bool) {
	var out nginxParsedLine
	openBracket := strings.IndexByte(line, '[')
	closeBracket := -1
	if openBracket >= 0 {
		if rel := strings.IndexByte(line[openBracket+1:], ']'); rel >= 0 {
			closeBracket = openBracket + 1 + rel
		}
	}
	if closeBracket < 0 {
		return out, false
	}
	ts, err := time.Parse(nginxLogTimeLayout, line[openBracket+1:closeBracket])
	if err != nil {
		return out, false
	}
	out.timestamp = ts

	pos := closeBracket + 1
	reqLine, nextPos, ok := readNginxQuotedField(line, pos)
	if !ok {
		return out, false
	}
	method, target, ok := splitNginxRequestLine(reqLine)
	if !ok {
		return out, false
	}
	out.method = method
	out.rawTarget = target

	status, nextPos, ok := readNginxIntField(line, nextPos)
	if !ok {
		return out, false
	}
	out.statusCode = status

	_, nextPos, ok = readNginxIntField(line, nextPos)
	if !ok {
		return out, false
	}

	_, nextPos, ok = readNginxQuotedField(line, nextPos)
	if !ok {
		return out, false
	}

	ua, _, ok := readNginxQuotedField(line, nextPos)
	if !ok {
		return out, false
	}
	out.userAgent = ua
	return out, true
}

func readNginxQuotedField(line string, start int) (string, int, bool) {
	i := skipSpaces(line, start)
	if i >= len(line) || line[i] != '"' {
		return "", start, false
	}
	i++
	var b strings.Builder
	for i < len(line) {
		ch := line[i]
		if ch == '\\' && i+1 < len(line) {
			b.WriteByte(line[i+1])
			i += 2
			continue
		}
		if ch == '"' {
			return b.String(), i + 1, true
		}
		b.WriteByte(ch)
		i++
	}
	return "", start, false
}

func readNginxIntField(line string, start int) (int, int, bool) {
	i := skipSpaces(line, start)
	end := i
	for end < len(line) && line[end] != ' ' && line[end] != '\t' {
		end++
	}
	if end == i {
		return 0, start, false
	}
	val, err := strconv.Atoi(line[i:end])
	if err != nil {
		return 0, start, false
	}
	return val, end, true
}

func skipSpaces(s string, pos int) int {
	for pos < len(s) && (s[pos] == ' ' || s[pos] == '\t') {
		pos++
	}
	return pos
}

func splitNginxRequestLine(req string) (string, string, bool) {
	fields := strings.Fields(req)
	if len(fields) < 2 {
		return "", "", false
	}
	return strings.ToUpper(fields[0]), fields[1], true
}

func shouldIngestNginxBotHit(method, rawTarget, userAgent string) (string, string, string, bool) {
	if method != http.MethodGet && method != http.MethodHead {
		return "", "", "", false
	}
	botName, botCategory, isBot := classifyNginxUserAgent(userAgent)
	if !isBot {
		return "", "", "", false
	}
	cleanPath, ok := normalizeNginxBotPath(rawTarget)
	if !ok {
		return "", "", "", false
	}
	return cleanPath, botName, botCategory, true
}

func classifyNginxUserAgent(userAgent string) (string, string, bool) {
	trimmed := strings.TrimSpace(userAgent)
	if trimmed == "" || trimmed == "-" {
		return "", "", false
	}
	uaLower := strings.ToLower(trimmed)
	if uaLower == "node" || strings.HasPrefix(uaLower, "undici") {
		return "", "", false
	}
	if ok, botName, category := ClassifyBotUserAgent(trimmed); ok {
		return botName, category, true
	}
	if strings.Contains(uaLower, "bot/") || strings.Contains(uaLower, "crawler") ||
		strings.Contains(uaLower, "spider") || strings.Contains(uaLower, "headlesschrome") ||
		strings.Contains(uaLower, "lighthouse") {
		return "OtherBot", BotCategoryOther, true
	}
	return "", "", false
}

func normalizeNginxBotPath(rawTarget string) (string, bool) {
	cleanPath := strings.TrimSpace(rawTarget)
	if idx := strings.IndexByte(cleanPath, '?'); idx >= 0 {
		cleanPath = cleanPath[:idx]
	}
	if !strings.HasPrefix(cleanPath, "/") {
		return "", false
	}
	for _, prefix := range excludedNginxBotPrefixes {
		if strings.HasPrefix(cleanPath, prefix) {
			return "", false
		}
	}
	ext := strings.ToLower(filepath.Ext(cleanPath))
	if ignoredStaticAssetExts[ext] {
		return "", false
	}
	return truncateStr(cleanPath, 500), true
}

func statusCodeClass(code int) string {
	switch {
	case code >= 200 && code < 300:
		return "2xx"
	case code >= 300 && code < 400:
		return "3xx"
	case code >= 400 && code < 500:
		return "4xx"
	default:
		return "5xx"
	}
}
