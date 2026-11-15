package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/safe"
)

const (
	indexNowHost                = "mertervitrini.com.tr"
	indexNowKey                 = "638d6e3eb8a743ec900269823f24ffe6"
	IndexNowKeyVerificationPath = "/" + indexNowKey + ".txt"
	indexNowKeyLocation         = "https://mertervitrini.com.tr" + IndexNowKeyVerificationPath
	indexNowUserAgent           = "MerterVitrini-IndexNow/1.0 (+https://mertervitrini.com.tr)"
	indexNowMaxChunkSize        = 10000
	indexNowSampleURLLimit      = 100
)

// IndexNowEndpoint describes an IndexNow Consortium endpoint used for URL notification and failover.
type IndexNowEndpoint struct {
	Name string
	URL  string
}

var (
	indexNowSEOLangs         = []string{"en", "ru", "ar", "de", "fr", "pl", "bg"}
	defaultIndexNowEndpoints = []IndexNowEndpoint{
		{Name: "yandex.com/indexnow", URL: "https://yandex.com/indexnow"},
		{Name: "search.seznam.cz/indexnow", URL: "https://search.seznam.cz/indexnow"},
		{Name: "api.indexnow.org", URL: "https://api.indexnow.org/IndexNow"},
	}
	indexNowSchemaOnce sync.Once
	indexNowSchemaErr  error
)

// IndexNowHandler serves Admin IndexNow monitoring, logging, and manual triggers.
type IndexNowHandler struct{}

// NewIndexNowHandler constructs an IndexNowHandler.
func NewIndexNowHandler() *IndexNowHandler {
	return &IndexNowHandler{}
}

// ServeKeyFile serves the IndexNow ownership verification key from the backend as defense-in-depth.
func (h *IndexNowHandler) ServeKeyFile(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set(headerContentType, "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, indexNowKey)
}

// IndexNowRequest defines the IndexNow batch submission JSON payload.
type IndexNowRequest struct {
	Host        string   `json:"host"`
	Key         string   `json:"key"`
	KeyLocation string   `json:"keyLocation"`
	URLList     []string `json:"urlList"`
}

// IndexNowSubmissionMeta carries provenance details persisted alongside every IndexNow log record.
type IndexNowSubmissionMeta struct {
	TriggerSource string
	SourceLabel   string
	FeedID        *string
	SyncRunID     *string
	ProductCount  int
}

// IndexNowLogEntry represents a persisted row in catalog.indexnow_logs.
type IndexNowLogEntry struct {
	ID              string    `json:"id"`
	TriggerSource   string    `json:"trigger_source"`
	SourceLabel     string    `json:"source_label"`
	FeedID          *string   `json:"feed_id,omitempty"`
	SyncRunID       *string   `json:"sync_run_id,omitempty"`
	Host            string    `json:"host"`
	ProductCount    int       `json:"product_count"`
	URLCount        int       `json:"url_count"`
	SampleURLs      []string  `json:"sample_urls"`
	Status          string    `json:"status"`
	HTTPStatus      int       `json:"http_status"`
	ResponseMessage string    `json:"response_message"`
	DurationMs      int       `json:"duration_ms"`
	CreatedAt       time.Time `json:"created_at"`
}

// IndexNowKpiSummary holds aggregate telemetry for the Admin IndexNow dashboard.
type IndexNowKpiSummary struct {
	TotalSubmissions      int        `json:"total_submissions"`
	TotalURLsSubmitted    int        `json:"total_urls_submitted"`
	TotalProductsNotified int        `json:"total_products_notified"`
	TodaySubmissions      int        `json:"today_submissions"`
	TodayURLsSubmitted    int        `json:"today_urls_submitted"`
	XMLSyncSubmissions    int        `json:"xml_sync_submissions"`
	SupplierSubmissions   int        `json:"supplier_submissions"`
	SuccessCount          int        `json:"success_count"`
	FailedCount           int        `json:"failed_count"`
	SkippedDevCount       int        `json:"skipped_dev_count"`
	SuccessRate           float64    `json:"success_rate"`
	LastSubmittedAt       *time.Time `json:"last_submitted_at"`
	Host                  string     `json:"host"`
	KeyLocation           string     `json:"key_location"`
}

// EnsureIndexNowSchema idempotently creates catalog.indexnow_logs and supporting indexes.
func EnsureIndexNowSchema(ctx context.Context) error {
	if db.Pool == nil {
		return nil
	}
	ensureProductArchiveSchema(ctx)
	indexNowSchemaOnce.Do(func() {
		ddl := `
		CREATE SCHEMA IF NOT EXISTS catalog;
		CREATE TABLE IF NOT EXISTS catalog.indexnow_logs (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			trigger_source VARCHAR(40) NOT NULL DEFAULT 'manual',
			source_label VARCHAR(240) NOT NULL DEFAULT '',
			feed_id UUID NULL,
			sync_run_id UUID NULL,
			host VARCHAR(120) NOT NULL DEFAULT 'mertervitrini.com.tr',
			product_count INT NOT NULL DEFAULT 0,
			url_count INT NOT NULL DEFAULT 0,
			sample_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
			status VARCHAR(24) NOT NULL DEFAULT 'pending',
			http_status INT NOT NULL DEFAULT 0,
			response_message TEXT NOT NULL DEFAULT '',
			duration_ms INT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_indexnow_logs_created_at
			ON catalog.indexnow_logs (created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_indexnow_logs_source_created
			ON catalog.indexnow_logs (trigger_source, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_indexnow_logs_status_created
			ON catalog.indexnow_logs (status, created_at DESC);`
		_, indexNowSchemaErr = db.Pool.Exec(ctx, ddl)
	})
	return indexNowSchemaErr
}

func isIndexNowLocalOrDev() bool {
	if strings.TrimSpace(os.Getenv("ENABLE_INDEXNOW")) == "1" {
		return false
	}
	if strings.TrimSpace(os.Getenv("DISABLE_INDEXNOW")) == "1" || runtime.GOOS == "windows" {
		return true
	}
	for _, envKey := range []string{"APP_ENV", "GO_ENV", "ENV"} {
		val := strings.ToLower(strings.TrimSpace(os.Getenv(envKey)))
		if val == "dev" || val == "development" || val == "local" || val == "test" {
			return true
		}
	}
	siteEnv := strings.ToLower(strings.TrimSpace(os.Getenv("SITE_URL")))
	return strings.Contains(siteEnv, "localhost") || strings.Contains(siteEnv, "127.0.0.1")
}

// BuildProductIndexNowURLs expands unique active product slugs into all 8 multilingual storefront URLs.
func BuildProductIndexNowURLs(slugs []string) ([]string, int) {
	if len(slugs) == 0 {
		return nil, 0
	}
	seenSlugs := make(map[string]bool, len(slugs))
	urls := make([]string, 0, len(slugs)*(1+len(indexNowSEOLangs)))
	productCount := 0

	for _, rawSlug := range slugs {
		cleanSlug := strings.Trim(strings.TrimSpace(rawSlug), "/")
		if cleanSlug == "" || seenSlugs[cleanSlug] {
			continue
		}
		seenSlugs[cleanSlug] = true
		productCount++

		escaped := url.PathEscape(cleanSlug)
		baseProductURL := fmt.Sprintf("%s/product/%s", siteBaseURL, escaped)
		urls = append(urls, baseProductURL)
		for _, lang := range indexNowSEOLangs {
			urls = append(urls, baseProductURL+"?lang="+lang)
		}
	}
	return urls, productCount
}

// NormalizeAndChunkIndexNowURLs validates, deduplicates, and partitions URLs into IndexNow batch chunks.
func NormalizeAndChunkIndexNowURLs(rawURLs []string, maxChunkSize int) [][]string {
	if maxChunkSize <= 0 {
		maxChunkSize = indexNowMaxChunkSize
	}

	cleanURLs := make([]string, 0, len(rawURLs))
	seen := make(map[string]bool, len(rawURLs))
	for _, raw := range rawURLs {
		u := strings.TrimSpace(raw)
		if u == "" || seen[u] {
			continue
		}
		lower := strings.ToLower(u)
		if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
			continue
		}
		seen[u] = true
		cleanURLs = append(cleanURLs, u)
	}

	if len(cleanURLs) == 0 {
		return nil
	}

	var chunks [][]string
	for start := 0; start < len(cleanURLs); start += maxChunkSize {
		end := start + maxChunkSize
		if end > len(cleanURLs) {
			end = len(cleanURLs)
		}
		chunks = append(chunks, cleanURLs[start:end])
	}
	return chunks
}

func truncateIndexNowRunes(s string, maxLen int) string {
	trimmed := strings.TrimSpace(s)
	if maxLen <= 0 || trimmed == "" {
		return ""
	}
	runes := []rune(trimmed)
	if len(runes) <= maxLen {
		return trimmed
	}
	return string(runes[:maxLen-1]) + "…"
}

func sanitizeIndexNowMeta(meta IndexNowSubmissionMeta) IndexNowSubmissionMeta {
	src := strings.TrimSpace(meta.TriggerSource)
	if src == "" {
		src = "manual"
	}
	label := truncateIndexNowRunes(meta.SourceLabel, 240)
	if label == "" {
		label = "Manuel IndexNow Bildirimi"
	}
	return IndexNowSubmissionMeta{
		TriggerSource: src,
		SourceLabel:   label,
		FeedID:        normalizeOptionalUUIDString(meta.FeedID),
		SyncRunID:     normalizeOptionalUUIDString(meta.SyncRunID),
		ProductCount:  meta.ProductCount,
	}
}

func normalizeOptionalUUIDString(ptr *string) *string {
	if ptr == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*ptr)
	if len(trimmed) != 36 {
		return nil
	}
	return &trimmed
}

func parseIndexNowEndpoint(rawPart string) (IndexNowEndpoint, bool) {
	trimmed := strings.TrimSpace(rawPart)
	if trimmed == "" {
		return IndexNowEndpoint{}, false
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return IndexNowEndpoint{}, false
	}
	if !strings.EqualFold(parsed.Scheme, "http") && !strings.EqualFold(parsed.Scheme, "https") {
		return IndexNowEndpoint{}, false
	}
	name := strings.TrimSuffix(parsed.Host+strings.TrimSuffix(parsed.Path, "/"), "/")
	if name == "" {
		name = parsed.Host
	}
	return IndexNowEndpoint{Name: name, URL: trimmed}, true
}

func resolveIndexNowEndpoints() []IndexNowEndpoint {
	raw := strings.TrimSpace(os.Getenv("INDEXNOW_ENDPOINTS"))
	if raw == "" {
		return defaultIndexNowEndpoints
	}

	parts := strings.Split(raw, ",")
	endpoints := make([]IndexNowEndpoint, 0, len(parts))
	for _, part := range parts {
		if ep, ok := parseIndexNowEndpoint(part); ok {
			endpoints = append(endpoints, ep)
		}
	}
	if len(endpoints) == 0 {
		return defaultIndexNowEndpoints
	}
	return endpoints
}

func postIndexNowChunk(ctx context.Context, urls []string) (int, string, error) {
	return postIndexNowChunkWithEndpoints(ctx, urls, resolveIndexNowEndpoints(), httpclient.DefaultPooledClient)
}

func postIndexNowSingleEndpoint(ctx context.Context, client *http.Client, ep IndexNowEndpoint, jsonData []byte) (int, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, ep.URL, bytes.NewReader(jsonData))
	if err != nil {
		return 0, fmt.Sprintf("İstek oluşturma hatası: %v", err), err
	}
	req.Header.Set(headerContentType, "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("User-Agent", indexNowUserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Sprintf("Bağlantı hatası: %v", err), err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	bodyText := truncateIndexNowRunes(string(bodyBytes), 350)

	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusAccepted {
		return resp.StatusCode, fmt.Sprintf(
			"HTTP %d (%s) — %s üzerinden IndexNow ortak ağına (Bing + Yandex) iletildi",
			resp.StatusCode, http.StatusText(resp.StatusCode), ep.Name,
		), nil
	}

	msg := fmt.Sprintf("HTTP %d (%s)", resp.StatusCode, http.StatusText(resp.StatusCode))
	if bodyText != "" {
		msg = fmt.Sprintf("%s: %s", msg, bodyText)
	}
	return resp.StatusCode, msg, fmt.Errorf("indexnow %s returned HTTP %d", ep.Name, resp.StatusCode)
}

func postIndexNowChunkWithEndpoints(ctx context.Context, urls []string, endpoints []IndexNowEndpoint, client *http.Client) (int, string, error) {
	if len(endpoints) == 0 {
		endpoints = defaultIndexNowEndpoints
	}
	if client == nil {
		client = httpclient.DefaultPooledClient
	}

	reqBody := IndexNowRequest{
		Host:        indexNowHost,
		Key:         indexNowKey,
		KeyLocation: indexNowKeyLocation,
		URLList:     urls,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return 0, fmt.Sprintf("Payload serileştirme hatası: %v", err), err
	}

	var attemptErrors []string
	lastStatus := 0

	for _, ep := range endpoints {
		statusCode, msg, attemptErr := postIndexNowSingleEndpoint(ctx, client, ep, jsonData)
		if attemptErr == nil {
			return statusCode, msg, nil
		}
		if statusCode > 0 {
			lastStatus = statusCode
		}
		if statusCode == http.StatusBadRequest || statusCode == http.StatusUnprocessableEntity {
			return statusCode, fmt.Sprintf("%s -> %s", ep.Name, msg), attemptErr
		}
		attemptErrors = append(attemptErrors, fmt.Sprintf("%s -> %s", ep.Name, msg))
	}

	return lastStatus, strings.Join(attemptErrors, " ; "), fmt.Errorf("all indexnow endpoints failed (last HTTP %d)", lastStatus)
}

func insertIndexNowLog(ctx context.Context, meta IndexNowSubmissionMeta, totalURLs int, sampleURLs []string, status string, httpStatus int, responseMsg string, durationMs int) (*IndexNowLogEntry, error) {
	if db.Pool == nil {
		return nil, nil
	}
	if err := EnsureIndexNowSchema(ctx); err != nil {
		return nil, err
	}
	if sampleURLs == nil {
		sampleURLs = []string{}
	}
	sampleJSON, err := json.Marshal(sampleURLs)
	if err != nil {
		sampleJSON = []byte("[]")
	}

	var entry IndexNowLogEntry
	var rawSamples []byte
	insertSQL := `
		INSERT INTO catalog.indexnow_logs (
			trigger_source, source_label, feed_id, sync_run_id, host,
			product_count, url_count, sample_urls, status, http_status,
			response_message, duration_ms
		)
		VALUES (
			$1, $2, $3::uuid, $4::uuid, $5,
			$6, $7, $8::jsonb, $9, $10,
			$11, $12
		)
		RETURNING id::text, trigger_source, source_label, feed_id::text, sync_run_id::text,
		          host, product_count, url_count, sample_urls, status, http_status,
		          response_message, duration_ms, created_at`

	err = db.Pool.QueryRow(
		ctx, insertSQL,
		meta.TriggerSource, meta.SourceLabel, meta.FeedID, meta.SyncRunID, indexNowHost,
		meta.ProductCount, totalURLs, string(sampleJSON), status, httpStatus,
		truncateIndexNowRunes(responseMsg, 1000), durationMs,
	).Scan(
		&entry.ID, &entry.TriggerSource, &entry.SourceLabel, &entry.FeedID, &entry.SyncRunID,
		&entry.Host, &entry.ProductCount, &entry.URLCount, &rawSamples, &entry.Status,
		&entry.HTTPStatus, &entry.ResponseMessage, &entry.DurationMs, &entry.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(rawSamples, &entry.SampleURLs); err != nil || entry.SampleURLs == nil {
		entry.SampleURLs = []string{}
	}
	return &entry, nil
}

func collectIndexNowSamples(chunks [][]string) (int, []string) {
	totalURLs := 0
	sampleURLs := make([]string, 0, indexNowSampleURLLimit)
	for _, chunk := range chunks {
		totalURLs += len(chunk)
		for _, u := range chunk {
			if len(sampleURLs) < indexNowSampleURLLimit {
				sampleURLs = append(sampleURLs, u)
			}
		}
	}
	return totalURLs, sampleURLs
}

func handleIndexNowDevSkip(ctx context.Context, cleanMeta IndexNowSubmissionMeta, totalURLs int, sampleURLs []string) (*IndexNowLogEntry, error) {
	msg := "Yerel/geliştirme ortamında dış IndexNow çağrısı atlandı (canlı Linux sunucuda otomatik gönderilir)."
	log.Printf("[IndexNow Dev-Skip] source=%s urls=%d label=%q", cleanMeta.TriggerSource, totalURLs, cleanMeta.SourceLabel)
	entry, err := insertIndexNowLog(ctx, cleanMeta, totalURLs, sampleURLs, "skipped_dev", 0, msg, 0)
	if err != nil {
		log.Printf("[IndexNow Log Error] Failed to persist dev-skip log: %v", err)
	}
	if entry == nil {
		entry = &IndexNowLogEntry{
			TriggerSource:   cleanMeta.TriggerSource,
			SourceLabel:     cleanMeta.SourceLabel,
			FeedID:          cleanMeta.FeedID,
			SyncRunID:       cleanMeta.SyncRunID,
			Host:            indexNowHost,
			ProductCount:    cleanMeta.ProductCount,
			URLCount:        totalURLs,
			SampleURLs:      sampleURLs,
			Status:          "skipped_dev",
			HTTPStatus:      0,
			ResponseMessage: msg,
			DurationMs:      0,
			CreatedAt:       time.Now(),
		}
	}
	return entry, err
}

func sendAllIndexNowChunks(ctx context.Context, chunks [][]string) (string, int, string) {
	finalHTTPStatus := http.StatusOK
	finalStatus := "success"
	messages := make([]string, 0, len(chunks))

	for idx, chunk := range chunks {
		code, msg, postErr := postIndexNowChunk(ctx, chunk)
		if code > 0 {
			finalHTTPStatus = code
		}
		if postErr != nil {
			finalStatus = "failed"
			if code == 0 {
				finalHTTPStatus = 0
			}
		}
		if len(chunks) > 1 {
			messages = append(messages, fmt.Sprintf("Parça %d/%d (%d URL): %s", idx+1, len(chunks), len(chunk), msg))
		} else {
			messages = append(messages, msg)
		}
	}
	return finalStatus, finalHTTPStatus, strings.Join(messages, " | ")
}

// SubmitIndexNowSync validates, sends in 10k-URL chunks, and records the result in catalog.indexnow_logs.
func SubmitIndexNowSync(ctx context.Context, meta IndexNowSubmissionMeta, rawURLs []string) (*IndexNowLogEntry, error) {
	cleanMeta := sanitizeIndexNowMeta(meta)
	chunks := NormalizeAndChunkIndexNowURLs(rawURLs, indexNowMaxChunkSize)
	if len(chunks) == 0 {
		return nil, errors.New("geçerli http/https URL adresi bulunamadı")
	}

	totalURLs, sampleURLs := collectIndexNowSamples(chunks)
	if isIndexNowLocalOrDev() {
		return handleIndexNowDevSkip(ctx, cleanMeta, totalURLs, sampleURLs)
	}

	startedAt := time.Now()
	finalStatus, finalHTTPStatus, combinedMsg := sendAllIndexNowChunks(ctx, chunks)
	durationMs := max(int(time.Since(startedAt).Milliseconds()), 0)

	if finalStatus == "success" {
		log.Printf("[IndexNow Success] source=%s urls=%d http=%d ms=%d label=%q", cleanMeta.TriggerSource, totalURLs, finalHTTPStatus, durationMs, cleanMeta.SourceLabel)
	} else {
		log.Printf("[IndexNow Warning] source=%s urls=%d http=%d err=%s label=%q", cleanMeta.TriggerSource, totalURLs, finalHTTPStatus, combinedMsg, cleanMeta.SourceLabel)
	}

	entry, logErr := insertIndexNowLog(ctx, cleanMeta, totalURLs, sampleURLs, finalStatus, finalHTTPStatus, combinedMsg, durationMs)
	if logErr != nil {
		log.Printf("[IndexNow Log Error] Failed to persist log entry: %v", logErr)
		return &IndexNowLogEntry{
			TriggerSource:   cleanMeta.TriggerSource,
			SourceLabel:     cleanMeta.SourceLabel,
			FeedID:          cleanMeta.FeedID,
			SyncRunID:       cleanMeta.SyncRunID,
			Host:            indexNowHost,
			ProductCount:    cleanMeta.ProductCount,
			URLCount:        totalURLs,
			SampleURLs:      sampleURLs,
			Status:          finalStatus,
			HTTPStatus:      finalHTTPStatus,
			ResponseMessage: combinedMsg,
			DurationMs:      durationMs,
			CreatedAt:       time.Now(),
		}, logErr
	}
	return entry, nil
}

// NotifyIndexNowWithMeta submits URLs asynchronously to IndexNow and writes a structured DB log.
func NotifyIndexNowWithMeta(meta IndexNowSubmissionMeta, urls []string) {
	if len(urls) == 0 {
		return
	}
	cleanMeta := sanitizeIndexNowMeta(meta)
	urlsCopy := append([]string(nil), urls...)

	safe.Go("IndexNow URL Submission", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if _, err := SubmitIndexNowSync(ctx, cleanMeta, urlsCopy); err != nil {
			log.Printf("[IndexNow Background Error] source=%s err=%v", cleanMeta.TriggerSource, err)
		}
	})
}

// NotifyIndexNowProductSlugsWithMeta expands product slugs to 8 languages and submits them asynchronously.
func NotifyIndexNowProductSlugsWithMeta(meta IndexNowSubmissionMeta, slugs []string) {
	urls, productCount := BuildProductIndexNowURLs(slugs)
	if len(urls) == 0 {
		return
	}
	if meta.ProductCount <= 0 {
		meta.ProductCount = productCount
	}
	NotifyIndexNowWithMeta(meta, urls)
}

// NotifyIndexNowProductSlug proactively notifies Bing & Yandex IndexNow for a single product slug.
func NotifyIndexNowProductSlug(slug string) {
	cleanSlug := strings.Trim(strings.TrimSpace(slug), "/")
	if cleanSlug == "" {
		return
	}
	NotifyIndexNowProductSlugsWithMeta(IndexNowSubmissionMeta{
		TriggerSource: "supplier_portal",
		SourceLabel:   "Ürün Bildirimi: " + cleanSlug,
		ProductCount:  1,
	}, []string{cleanSlug})
}

// NotifyIndexNow sends a background POST request to IndexNow API with generic logging metadata.
func NotifyIndexNow(urls []string) {
	if len(urls) == 0 {
		return
	}
	NotifyIndexNowWithMeta(IndexNowSubmissionMeta{
		TriggerSource: "manual",
		SourceLabel:   fmt.Sprintf("Otomatik URL Bildirimi (%d URL)", len(urls)),
	}, urls)
}

// SubmitManual triggers synchronous IndexNow submission for custom paths from the Admin Panel.
func (h *IndexNowHandler) SubmitManual(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		URLs []string `json:"urls"`
	}
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz istek verisi")
		return
	}
	if len(req.URLs) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Gönderilecek en az bir URL belirtmelisiniz.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	entry, err := SubmitIndexNowSync(ctx, IndexNowSubmissionMeta{
		TriggerSource: "manual",
		SourceLabel:   fmt.Sprintf("Manuel Admin Gönderimi (%d URL)", len(req.URLs)),
	}, req.URLs)
	if err != nil && entry == nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	message := "URL'ler IndexNow motorlarına gönderildi ve loglandı."
	if entry != nil {
		switch entry.Status {
		case "skipped_dev":
			message = entry.ResponseMessage
		case "failed":
			message = "IndexNow yanıt hatası alındı: " + entry.ResponseMessage
		default:
			message = fmt.Sprintf("%d URL başarıyla IndexNow motorlarına bildirildi (HTTP %d).", entry.URLCount, entry.HTTPStatus)
		}
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"status":  entry.Status,
		"message": message,
		"log":     entry,
	})
}

// SubmitRecentProducts submits the newest active catalog products to IndexNow in one batch.
func (h *IndexNowHandler) SubmitRecentProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Limit int `json:"limit"`
	}
	_ = httpx.DecodeJSON(r, &req, 4096)
	limit := req.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}

	ctx, cancel := context.WithTimeout(r.Context(), 35*time.Second)
	defer cancel()
	if err := EnsureIndexNowSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "IndexNow şeması hazırlanamadı")
		return
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT slug
		FROM catalog.products
		WHERE is_active = true
		  AND COALESCE(is_archived, false) = false
		  AND slug IS NOT NULL
		  AND slug != ''
		ORDER BY created_at DESC, updated_at DESC
		LIMIT $1`, limit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Son ürünler sorgulanamadı")
		return
	}
	defer rows.Close()

	var slugs []string
	for rows.Next() {
		var s string
		if scanErr := rows.Scan(&s); scanErr == nil && strings.TrimSpace(s) != "" {
			slugs = append(slugs, s)
		}
	}

	urls, productCount := BuildProductIndexNowURLs(slugs)
	if len(urls) == 0 {
		httpx.Error(w, http.StatusNotFound, "Bildirilecek aktif ve geçerli slug değerine sahip ürün bulunamadı.")
		return
	}

	entry, submitErr := SubmitIndexNowSync(ctx, IndexNowSubmissionMeta{
		TriggerSource: "bulk_recent",
		SourceLabel:   fmt.Sprintf("Son %d Aktif Ürün Toplu Bildirimi", productCount),
		ProductCount:  productCount,
	}, urls)
	if submitErr != nil && entry == nil {
		httpx.Error(w, http.StatusInternalServerError, "IndexNow gönderimi başarısız oldu: "+submitErr.Error())
		return
	}

	message := fmt.Sprintf("%d ürün (%d çok dilli URL) IndexNow'a bildirildi.", productCount, entry.URLCount)
	if entry.Status == "skipped_dev" {
		message = fmt.Sprintf("%d ürün (%d URL) yerel geliştirme modunda simülasyon olarak loglandı.", productCount, entry.URLCount)
	} else if entry.Status == "failed" {
		message = fmt.Sprintf("Gönderim denendi ancak IndexNow hata döndürdü: %s", entry.ResponseMessage)
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"status":  entry.Status,
		"message": message,
		"log":     entry,
	})
}

func fetchIndexNowKpiSummary(ctx context.Context) (IndexNowKpiSummary, error) {
	kpi := IndexNowKpiSummary{
		Host:        indexNowHost,
		KeyLocation: indexNowKeyLocation,
	}
	err := db.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(COUNT(*), 0),
			COALESCE(SUM(url_count), 0),
			COALESCE(SUM(product_count), 0),
			COALESCE(COUNT(*) FILTER (WHERE date_trunc('day', timezone('Europe/Istanbul', created_at)) = date_trunc('day', timezone('Europe/Istanbul', NOW()))), 0),
			COALESCE(SUM(url_count) FILTER (WHERE date_trunc('day', timezone('Europe/Istanbul', created_at)) = date_trunc('day', timezone('Europe/Istanbul', NOW()))), 0),
			COALESCE(COUNT(*) FILTER (WHERE trigger_source = 'xml_sync'), 0),
			COALESCE(COUNT(*) FILTER (WHERE trigger_source IN ('supplier_portal', 'supplier_excel', 'mobile_supplier')), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'success'), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'failed'), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'skipped_dev'), 0),
			MAX(created_at)
		FROM catalog.indexnow_logs`).Scan(
		&kpi.TotalSubmissions,
		&kpi.TotalURLsSubmitted,
		&kpi.TotalProductsNotified,
		&kpi.TodaySubmissions,
		&kpi.TodayURLsSubmitted,
		&kpi.XMLSyncSubmissions,
		&kpi.SupplierSubmissions,
		&kpi.SuccessCount,
		&kpi.FailedCount,
		&kpi.SkippedDevCount,
		&kpi.LastSubmittedAt,
	)
	if err != nil {
		return kpi, err
	}

	attempted := kpi.SuccessCount + kpi.FailedCount
	if attempted > 0 {
		kpi.SuccessRate = float64(kpi.SuccessCount) * 100 / float64(attempted)
	}
	return kpi, nil
}

func parseIndexNowListParams(r *http.Request) (source, status, search string, limit, offset int) {
	q := r.URL.Query()
	source = strings.TrimSpace(q.Get("source"))
	if source == "all" {
		source = ""
	}
	status = strings.TrimSpace(q.Get("status"))
	if status == "all" {
		status = ""
	}
	search = strings.TrimSpace(q.Get("q"))

	limit = 25
	if raw := strings.TrimSpace(q.Get("limit")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			if n > 100 {
				n = 100
			}
			limit = n
		}
	}

	offset = 0
	if raw := strings.TrimSpace(q.Get("offset")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n >= 0 {
			offset = n
		}
	}
	return source, status, search, limit, offset
}

// ListLogs returns KPI summary cards and filterable, paginated IndexNow submission logs.
func (h *IndexNowHandler) ListLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := EnsureIndexNowSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "IndexNow log tablosu hazırlanamadı")
		return
	}

	source, status, search, limit, offset := parseIndexNowListParams(r)

	kpi, kpiErr := fetchIndexNowKpiSummary(ctx)
	if kpiErr != nil {
		log.Printf("[IndexNow] KPI summary error: %v", kpiErr)
		httpx.Error(w, http.StatusInternalServerError, "IndexNow özet verileri alınamadı")
		return
	}

	var total int
	err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM catalog.indexnow_logs
		WHERE ($1 = '' OR trigger_source = $1)
		  AND ($2 = '' OR status = $2)
		  AND ($3 = '' OR source_label ILIKE '%' || $3 || '%' OR response_message ILIKE '%' || $3 || '%' OR sample_urls::text ILIKE '%' || $3 || '%')`,
		source, status, search,
	).Scan(&total)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "IndexNow log sayısı hesaplanamadı")
		return
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT id::text, trigger_source, source_label, feed_id::text, sync_run_id::text,
		       host, product_count, url_count, sample_urls, status, http_status,
		       response_message, duration_ms, created_at
		FROM catalog.indexnow_logs
		WHERE ($1 = '' OR trigger_source = $1)
		  AND ($2 = '' OR status = $2)
		  AND ($3 = '' OR source_label ILIKE '%' || $3 || '%' OR response_message ILIKE '%' || $3 || '%' OR sample_urls::text ILIKE '%' || $3 || '%')
		ORDER BY created_at DESC
		LIMIT $4 OFFSET $5`,
		source, status, search, limit, offset,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "IndexNow logları sorgulanamadı")
		return
	}
	defer rows.Close()

	logs := make([]IndexNowLogEntry, 0, limit)
	for rows.Next() {
		var entry IndexNowLogEntry
		var rawSamples []byte
		if scanErr := rows.Scan(
			&entry.ID, &entry.TriggerSource, &entry.SourceLabel, &entry.FeedID, &entry.SyncRunID,
			&entry.Host, &entry.ProductCount, &entry.URLCount, &rawSamples, &entry.Status,
			&entry.HTTPStatus, &entry.ResponseMessage, &entry.DurationMs, &entry.CreatedAt,
		); scanErr != nil {
			continue
		}
		if err := json.Unmarshal(rawSamples, &entry.SampleURLs); err != nil || entry.SampleURLs == nil {
			entry.SampleURLs = []string{}
		}
		logs = append(logs, entry)
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"kpi":    kpi,
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// RetryLog re-submits URLs stored in a previous log entry and writes a fresh log row.
func (h *IndexNowHandler) RetryLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "Log ID zorunludur")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	if err := EnsureIndexNowSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "IndexNow şeması hazırlanamadı")
		return
	}

	var prev IndexNowLogEntry
	var rawSamples []byte
	err := db.Pool.QueryRow(ctx, `
		SELECT id::text, trigger_source, source_label, feed_id::text, sync_run_id::text,
		       product_count, sample_urls
		FROM catalog.indexnow_logs
		WHERE id::text = $1`, id,
	).Scan(
		&prev.ID, &prev.TriggerSource, &prev.SourceLabel, &prev.FeedID, &prev.SyncRunID,
		&prev.ProductCount, &rawSamples,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "Tekrar gönderilecek IndexNow logu bulunamadı")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Log kaydı okunamadı")
		return
	}

	_ = json.Unmarshal(rawSamples, &prev.SampleURLs)
	if len(prev.SampleURLs) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Bu log kaydında tekrar gönderilecek URL örneği bulunmuyor")
		return
	}

	entry, submitErr := SubmitIndexNowSync(ctx, IndexNowSubmissionMeta{
		TriggerSource: prev.TriggerSource,
		SourceLabel:   "Tekrar Gönderim — " + prev.SourceLabel,
		FeedID:        prev.FeedID,
		SyncRunID:     prev.SyncRunID,
		ProductCount:  prev.ProductCount,
	}, prev.SampleURLs)
	if submitErr != nil && entry == nil {
		httpx.Error(w, http.StatusInternalServerError, "Tekrar gönderim başarısız: "+submitErr.Error())
		return
	}

	message := "URL'ler tekrar IndexNow motorlarına gönderildi."
	if entry.Status == "skipped_dev" {
		message = entry.ResponseMessage
	} else if entry.Status == "failed" {
		message = "Tekrar gönderim IndexNow hatasıyla sonuçlandı: " + entry.ResponseMessage
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"status":  entry.Status,
		"message": message,
		"log":     entry,
	})
}

// ClearLogs removes stored IndexNow submission logs (all or filtered by ?status=).
func (h *IndexNowHandler) ClearLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := EnsureIndexNowSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "IndexNow şeması hazırlanamadı")
		return
	}

	statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))
	var deleted int64
	if statusFilter != "" && statusFilter != "all" {
		tag, err := db.Pool.Exec(ctx, "DELETE FROM catalog.indexnow_logs WHERE status = $1", statusFilter)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "Loglar temizlenemedi")
			return
		}
		deleted = tag.RowsAffected()
	} else {
		tag, err := db.Pool.Exec(ctx, "DELETE FROM catalog.indexnow_logs")
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "Loglar temizlenemedi")
			return
		}
		deleted = tag.RowsAffected()
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"success":       true,
		"deleted_count": deleted,
		"message":       fmt.Sprintf("%d adet IndexNow log kaydı temizlendi.", deleted),
	})
}
