package handlers

import (
	"bufio"
	"bytes"
	"context"
	"crypto/md5"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/safe"

	"github.com/jackc/pgx/v5"
)

type DownloadTask struct {
	URL           string
	LocalFilePath string
	SyncRunID     string
}

type SyncProgress struct {
	mu                sync.RWMutex
	RunID             string
	ItemsParsed       int
	ItemsAdded        int
	ItemsUpdated      int
	VariantsAligned   int
	ErrorsSkipped     int
	ImagesTotal       int
	ImagesDownloaded  int
	ActiveWorkers     int
	DownloadSpeedKbps int
	Percentage        int
	BytesInLastSec    int64
	ParsingDone       bool
	IsCompleted       bool
}

var (
	progressMu  sync.RWMutex
	progressMap = make(map[string]*SyncProgress)

	cancelMap   = make(map[string]context.CancelFunc)
	cancelMapMu sync.Mutex

	// downloadChan buffers download tasks
	downloadChan = make(chan DownloadTask, 50000)

	// Track active workers globally
	activeWorkers int32
)

func init() {
	// Spin up 8 background workers
	for i := 0; i < 8; i++ {
		workerIndex := i
		safe.Go(fmt.Sprintf("Image Download Worker %d", workerIndex), func() {
			downloadWorker(workerIndex)
		})
	}
	// Start progress ticker for live updates
	startProgressTicker()
}

func downloadWorker(workerID int) {
	for task := range downloadChan {
		atomic.AddInt32(&activeWorkers, 1)
		err := downloadImageWithSpeedTracking(task.URL, task.LocalFilePath, task.SyncRunID)
		if err != nil {
			log.Printf("[Worker-%d] Failed to download image %s: %v", workerID, task.URL, err)
		}
		incrementDownloadedImages(task.SyncRunID)
		atomic.AddInt32(&activeWorkers, -1)
	}
}

type progressReader struct {
	io.Reader
	onRead func(int)
}

func (pr *progressReader) Read(p []byte) (n int, err error) {
	n, err = pr.Reader.Read(p)
	if n > 0 {
		pr.onRead(n)
	}
	return n, err
}

func isBlockedInternalIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() {
		return true
	}
	if v4 := ip.To4(); v4 != nil && v4[0] == 169 && v4[1] == 254 {
		return true
	}
	return false
}

func validateSafeExternalFeedURL(rawURL string) error {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return errors.New("feed URL boş olamaz")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return errors.New("geçersiz URL formatı")
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return errors.New("yalnızca http ve https protokollerine izin verilmektedir")
	}
	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if host == "" {
		return errors.New("geçersiz URL sunucu adı")
	}
	if host == "localhost" || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
		return errors.New("yerel veya dahili ağ adreslerine erişim engellendi")
	}

	if ip := net.ParseIP(host); ip != nil {
		if isBlockedInternalIP(ip) {
			return errors.New("dahili veya özel IP adreslerine erişim engellendi")
		}
		return nil
	}

	lookupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	addrs, err := net.DefaultResolver.LookupIPAddr(lookupCtx, host)
	if err != nil || len(addrs) == 0 {
		return errors.New("URL alan adı çözümlenemedi")
	}
	for _, addr := range addrs {
		if isBlockedInternalIP(addr.IP) {
			return errors.New("alan adı dahili veya özel bir IP adresine işaret ediyor")
		}
	}
	return nil
}

func safeExternalHTTPGet(baseClient *http.Client, targetURL string) (*http.Response, error) {
	if err := validateSafeExternalFeedURL(targetURL); err != nil {
		return nil, err
	}
	clientCopy := *baseClient
	clientCopy.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("çok fazla yönlendirme")
		}
		return validateSafeExternalFeedURL(req.URL.String())
	}
	return clientCopy.Get(targetURL)
}

func downloadImageWithSpeedTracking(imgURL string, destPath string, runID string) error {
	p := getOrCreateProgress(runID)

	resp, err := safeExternalHTTPGet(httpclient.DefaultPooledClient, imgURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	pr := &progressReader{
		Reader: resp.Body,
		onRead: func(n int) {
			if p != nil {
				atomic.AddInt64(&p.BytesInLastSec, int64(n))
			}
		},
	}

	_, err = io.Copy(out, pr)
	return err
}

func getOrCreateProgress(runID string) *SyncProgress {
	progressMu.Lock()
	defer progressMu.Unlock()
	p, ok := progressMap[runID]
	if !ok {
		p = &SyncProgress{
			RunID: runID,
		}
		progressMap[runID] = p
	}
	return p
}

func incrementItemsParsed(runID string, isNew bool, isUpdate bool, variants int) {
	p := getOrCreateProgress(runID)
	p.mu.Lock()
	defer p.mu.Unlock()
	p.ItemsParsed++
	if isNew {
		p.ItemsAdded++
	}
	if isUpdate {
		p.ItemsUpdated++
	}
	p.VariantsAligned += variants
}

func incrementErrorsSkipped(runID string) {
	p := getOrCreateProgress(runID)
	p.mu.Lock()
	defer p.mu.Unlock()
	p.ErrorsSkipped++
}

func incrementImagesTotal(runID string, count int) {
	p := getOrCreateProgress(runID)
	p.mu.Lock()
	defer p.mu.Unlock()
	p.ImagesTotal += count
	if p.ImagesTotal > 0 {
		p.Percentage = (p.ImagesDownloaded * 100) / p.ImagesTotal
	}
}

func incrementDownloadedImages(runID string) {
	p := getOrCreateProgress(runID)
	p.mu.Lock()
	defer p.mu.Unlock()
	p.ImagesDownloaded++
	if p.ImagesTotal > 0 {
		p.Percentage = (p.ImagesDownloaded * 100) / p.ImagesTotal
	}
}

func enqueueDownloadTask(task DownloadTask) {
	select {
	case downloadChan <- task:
	default:
		log.Printf("[SYNC] Download channel full! Dropping task for %s", task.URL)
	}
}

func startProgressTicker() {
	ticker := time.NewTicker(1 * time.Second)
	safe.Go("Sync Progress Ticker", func() {
		for range ticker.C {
			updateProgressTick()
		}
	})
}

func syncRedisProgress(runID string, p *SyncProgress) {
	if db.RedisClient == nil {
		return
	}
	redisKey := "sync_run:progress:" + runID
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	val, err := db.RedisClient.Get(ctx, redisKey).Result()
	cancel()
	if err != nil || val == "" {
		return
	}

	var redisSummary map[string]any
	if err := json.Unmarshal([]byte(val), &redisSummary); err == nil {
		applyRedisSummaryToProgress(redisSummary, p)
	}
}

func applyRedisSummaryToProgress(redisSummary map[string]any, p *SyncProgress) {
	setMetric := func(key string, target *int) {
		if v, ok := redisSummary[key].(float64); ok {
			*target = int(v)
		}
	}
	setMetric("items_parsed", &p.ItemsParsed)
	setMetric("items_added", &p.ItemsAdded)
	setMetric("items_updated", &p.ItemsUpdated)
	setMetric("variants_aligned", &p.VariantsAligned)
	setMetric("errors_skipped", &p.ErrorsSkipped)
	setMetric("images_total", &p.ImagesTotal)
	setMetric("images_downloaded", &p.ImagesDownloaded)
	setMetric("percentage", &p.Percentage)

	if status, ok := redisSummary["status"].(string); ok && status == "success" {
		p.ParsingDone = true
		p.IsCompleted = true
	}
}

func buildSyncSummary(p *SyncProgress) map[string]any {
	return map[string]any{
		"items_parsed":        p.ItemsParsed,
		"items_added":         p.ItemsAdded,
		"items_updated":       p.ItemsUpdated,
		"variants_aligned":    p.VariantsAligned,
		"errors_skipped":      p.ErrorsSkipped,
		"images_total":        p.ImagesTotal,
		"images_downloaded":   p.ImagesDownloaded,
		"active_workers":      p.ActiveWorkers,
		"download_speed_kbps": p.DownloadSpeedKbps,
		"percentage":          p.Percentage,
	}
}

func processSingleSyncTick(runID string, p *SyncProgress) bool {
	p.mu.Lock()

	syncRedisProgress(runID, p)

	bytesLastSec := atomic.SwapInt64(&p.BytesInLastSec, 0)
	speedKbps := int(bytesLastSec / 1024)
	p.DownloadSpeedKbps = speedKbps
	p.ActiveWorkers = int(atomic.LoadInt32(&activeWorkers))

	if p.ImagesTotal > 0 {
		p.Percentage = (p.ImagesDownloaded * 100) / p.ImagesTotal
	}

	summary := buildSyncSummary(p)

	if p.ParsingDone && p.ImagesDownloaded >= p.ImagesTotal && !p.IsCompleted {
		p.IsCompleted = true
		p.mu.Unlock()

		log.Printf("[SYNC-%s] Complete! Parsing done and all %d images processed.", runID, p.ImagesTotal)
		updateSyncStatus(runID, "success", summary)
		return true
	}

	p.mu.Unlock()
	updateSyncStatusLive(runID, "running", summary)
	return false
}

func updateProgressTick() {
	progressMu.Lock()
	defer progressMu.Unlock()

	for runID, p := range progressMap {
		if processSingleSyncTick(runID, p) {
			delete(progressMap, runID)
		}
	}
}

func updateSyncStatusLive(runID string, status string, summary map[string]any) {
	ctx := context.Background()
	summaryBytes, _ := json.Marshal(summary)
	query := `
		UPDATE integration.sync_runs 
		SET status = $1, summary = $2 
		WHERE id = $3`
	_, err := db.Pool.Exec(ctx, query, status, summaryBytes, runID)
	if err != nil {
		log.Printf("[SYNC-%s] Failed to update live sync status: %v", runID, err)
	}
}

type IntegrationHandler struct {
	Cfg *config.Config
}

var globalConfig *config.Config

func NewIntegrationHandler(cfg *config.Config) *IntegrationHandler {
	globalConfig = cfg
	return &IntegrationHandler{Cfg: cfg}
}

// ListFeeds lists all wholesale integration XML feeds with mapping configurations
func (h *IntegrationHandler) ListFeeds(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, brand_id, feed_name AS name, alias_code, feed_url, mapping_config, category_mapping, is_active, created_at, updated_at 
		FROM integration.xml_feeds 
		ORDER BY id`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to list xml feeds: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var feeds []*models.XmlFeed
	for rows.Next() {
		var f models.XmlFeed
		var mappingBytes, categoryBytes []byte
		err := rows.Scan(&f.ID, &f.BrandID, &f.Name, &f.AliasCode, &f.FeedUrl, &mappingBytes, &categoryBytes, &f.IsActive, &f.CreatedAt, &f.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan feed: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		if len(mappingBytes) > 0 {
			json.Unmarshal(mappingBytes, &f.MappingConfig)
		}
		if len(categoryBytes) > 0 {
			json.Unmarshal(categoryBytes, &f.CategoryMapping)
		}
		feeds = append(feeds, &f)
	}

	w.Header().Set(contentTypeHeader, appJSON)
	json.NewEncoder(w).Encode(feeds)
}

func downloadXMLPreviewBytes(feedURL string) ([]byte, error) {
	resp, err := safeExternalHTTPGet(httpclient.FastClient, feedURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	limitedReader := io.LimitReader(resp.Body, 256*1024)
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, limitedReader); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func recordPreviewCharData(elementPath []string, text string, tagUniqueValues map[string]map[string]bool, previewData map[string]string) {
	fullPath := strings.Join(elementPath, "/")
	if len(text) < 150 {
		if tagUniqueValues[fullPath] == nil {
			tagUniqueValues[fullPath] = make(map[string]bool)
		}
		if len(tagUniqueValues[fullPath]) < 500 {
			tagUniqueValues[fullPath][text] = true
		}
	}
	if _, exists := previewData[fullPath]; !exists {
		previewData[fullPath] = text
	}
}

func sortStringMapKeys(m map[string]bool) []string {
	res := make([]string, 0, len(m))
	for k := range m {
		res = append(res, k)
	}
	sort.Strings(res)
	return res
}

func buildSortedCategories(tagUniqueValues map[string]map[string]bool) map[string][]string {
	uniqueCategoriesMap := make(map[string][]string, len(tagUniqueValues))
	for tag, valuesMap := range tagUniqueValues {
		vals := make([]string, 0, len(valuesMap))
		for val := range valuesMap {
			vals = append(vals, val)
		}
		sort.Strings(vals)
		uniqueCategoriesMap[tag] = vals
	}
	return uniqueCategoriesMap
}

func parseXMLPreviewTokens(data []byte) (tags []string, uniqueCategories map[string][]string, previewData map[string]string) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	tagMap := make(map[string]bool)
	tagUniqueValues := make(map[string]map[string]bool)
	previewData = make(map[string]string)

	var elementPath []string

	for {
		t, err := decoder.Token()
		if err != nil {
			break
		}

		switch se := t.(type) {
		case xml.StartElement:
			elementPath = append(elementPath, se.Name.Local)
			tagMap[strings.Join(elementPath, "/")] = true
		case xml.CharData:
			text := string(bytes.TrimSpace(se))
			if len(text) > 0 && len(elementPath) > 0 {
				recordPreviewCharData(elementPath, text, tagUniqueValues, previewData)
			}
		case xml.EndElement:
			if len(elementPath) > 0 {
				elementPath = elementPath[:len(elementPath)-1]
			}
		}
	}

	tags = sortStringMapKeys(tagMap)
	uniqueCategories = buildSortedCategories(tagUniqueValues)
	return tags, uniqueCategories, previewData
}

// PreviewXML downloads the first 256KB of the XML and returns discovered tags and categories
func (h *IntegrationHandler) PreviewXML(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		FeedUrl string `json:"feed_url"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.FeedUrl == "" {
		http.Error(w, `{"error":"Valid Feed URL is required"}`, http.StatusBadRequest)
		return
	}

	previewBytes, err := downloadXMLPreviewBytes(req.FeedUrl)
	if err != nil {
		log.Printf("Failed to download XML preview from %s: %v", req.FeedUrl, err)
		http.Error(w, `{"error":"Failed to download XML from the provided URL"}`, http.StatusBadRequest)
		return
	}

	tags, uniqueCategoriesMap, previewData := parseXMLPreviewTokens(previewBytes)

	w.Header().Set(contentTypeHeader, appJSON)
	json.NewEncoder(w).Encode(map[string]any{
		"tags":                  tags,
		"unique_categories_map": uniqueCategoriesMap,
		"preview_json":          previewData,
	})
}

// SaveXMLMapping updates dynamic mapping and category maps in DB
func (h *IntegrationHandler) SaveXMLMapping(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	feedID := r.PathValue("id")
	if feedID == "" {
		http.Error(w, `{"error":"Feed ID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		MappingConfig   map[string]any `json:"mapping_config"`
		CategoryMapping map[string]any `json:"category_mapping"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	mappingBytes, _ := json.Marshal(req.MappingConfig)
	categoryBytes, _ := json.Marshal(req.CategoryMapping)

	query := `
		UPDATE integration.xml_feeds 
		SET mapping_config = $1, category_mapping = $2, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $3`

	cmdTag, err := db.Pool.Exec(ctx, query, mappingBytes, categoryBytes, feedID)
	if err != nil {
		log.Printf("Failed to save XML mapping: %v", err)
		http.Error(w, `{"error":"Failed to save configuration"}`, http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, `{"error":"XML Feed not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set(contentTypeHeader, appJSON)
	w.Write([]byte(`{"success":true,"message":"Mapping configuration saved successfully"}`))
}

// TriggerSync creates a running sync_run in DB and starts a simulated background import
func (h *IntegrationHandler) TriggerSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	feedID := r.PathValue("id")
	if feedID == "" {
		http.Error(w, `{"error":"Feed ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Verify feed exists
	var exists bool
	err := db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM integration.xml_feeds WHERE id = $1)", feedID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, `{"error":"XML Feed not found"}`, http.StatusNotFound)
		return
	}

	// Insert sync_run with 'running' status
	query := `
		INSERT INTO integration.sync_runs (feed_id, status) 
		VALUES ($1, 'running') 
		RETURNING id, feed_id, started_at, completed_at, status, summary`

	var run models.SyncRun
	err = db.Pool.QueryRow(ctx, query, feedID).Scan(
		&run.ID, &run.FeedID, &run.StartedAt, &run.CompletedAt, &run.Status, &run.Summary,
	)

	if err != nil {
		log.Printf("Failed to initiate sync_run: %v", err)
		http.Error(w, `{"error":"Failed to trigger sync run"}`, http.StatusInternalServerError)
		return
	}

	// Create a cancelable context for background synchronization
	bgCtx, bgCancel := context.WithCancel(context.Background())
	cancelMapMu.Lock()
	cancelMap[run.ID] = bgCancel
	cancelMapMu.Unlock()

	// Run background XML processing with cancelable context
	safe.Go(fmt.Sprintf("Simulate Background Sync %s", run.ID), func() {
		simulateBackgroundSync(run.ID, bgCtx)
	})

	w.Header().Set(contentTypeHeader, appJSON)
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(run)
}

// CancelSync cancels a running sync_run, stopping the subprocess
func (h *IntegrationHandler) CancelSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	feedID := r.PathValue("id")
	if feedID == "" {
		http.Error(w, `{"error":"Feed ID is required"}`, http.StatusBadRequest)
		return
	}

	// 1. Query if there is an active running sync run for this feed
	dbCtx := r.Context()
	var runID string
	err := db.Pool.QueryRow(dbCtx, "SELECT id FROM integration.sync_runs WHERE feed_id = $1 AND status = 'running' ORDER BY started_at DESC LIMIT 1", feedID).Scan(&runID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Clean up any orphan runs stuck as running
			summaryBytes, _ := json.Marshal(map[string]any{"error": "İşlem durduruldu."})
			_, _ = db.Pool.Exec(dbCtx, "UPDATE integration.sync_runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP, summary = $1 WHERE feed_id = $2 AND status = 'running'", summaryBytes, feedID)

			w.Header().Set(contentTypeHeader, appJSON)
			w.Write([]byte(`{"success":true,"message":"Aktif çalışan senkronizasyon bulunamadı, durdurulacak işlem yok."}`))
			return
		}
		log.Printf("Failed to check active running sync run: %v", err)
		http.Error(w, `{"error":"Internal database error"}`, http.StatusInternalServerError)
		return
	}

	// 2. Invoke cancel function if stored in cancelMap
	cancelMapMu.Lock()
	cancel, ok := cancelMap[runID]
	if ok {
		cancel()
		delete(cancelMap, runID)
	}
	cancelMapMu.Unlock()

	// 3. Update the database status to failed
	summaryBytes, _ := json.Marshal(map[string]any{"error": "İşlem kullanıcı tarafından durduruldu."})
	_, _ = db.Pool.Exec(context.Background(), "UPDATE integration.sync_runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP, summary = $1 WHERE id = $2", summaryBytes, runID)

	// 4. Remove progress tracker
	progressMu.Lock()
	delete(progressMap, runID)
	progressMu.Unlock()

	w.Header().Set(contentTypeHeader, appJSON)
	w.Write([]byte(`{"success":true,"message":"Senkronizasyon işlemi başarıyla durduruldu."}`))
}

// ListSyncHistory fetches recent sync runs for a feed
func (h *IntegrationHandler) ListSyncHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	feedID := r.PathValue("id")
	if feedID == "" {
		http.Error(w, `{"error":"Feed ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, feed_id, started_at, completed_at, status, summary 
		FROM integration.sync_runs 
		WHERE feed_id = $1 
		ORDER BY started_at DESC`

	rows, err := db.Pool.Query(ctx, query, feedID)
	if err != nil {
		log.Printf("Failed to query sync runs: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var runs []*models.SyncRun
	for rows.Next() {
		var run models.SyncRun
		err := rows.Scan(&run.ID, &run.FeedID, &run.StartedAt, &run.CompletedAt, &run.Status, &run.Summary)
		if err != nil {
			log.Printf("Failed to scan sync run: %v", err)
			http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
			return
		}
		runs = append(runs, &run)
	}

	w.Header().Set(contentTypeHeader, appJSON)
	json.NewEncoder(w).Encode(runs)
}

// ClearSyncHistory deletes all completed/failed sync runs for a feed, or all feeds if id is "all"
func (h *IntegrationHandler) ClearSyncHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	feedID := r.PathValue("id")
	if feedID == "" {
		http.Error(w, `{"error":"Feed ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var err error
	if feedID == "all" {
		query := `DELETE FROM integration.sync_runs WHERE status != 'running'`
		_, err = db.Pool.Exec(ctx, query)
	} else {
		query := `DELETE FROM integration.sync_runs WHERE feed_id = $1 AND status != 'running'`
		_, err = db.Pool.Exec(ctx, query, feedID)
	}

	if err != nil {
		log.Printf("Failed to clear sync runs: %v", err)
		http.Error(w, `{"error":"Failed to clear synchronization history"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(contentTypeHeader, appJSON)
	w.Write([]byte(`{"success":true,"message":"Senkronizasyon geçmişi başarıyla temizlendi."}`))
}

// fetchSyncFeedConfig retrieves the feed configuration and parsed mappings
func fetchSyncFeedConfig(ctx context.Context, runID string) (feedID string, brandID *string, feedURL string, mappingConfig, categoryMapping map[string]any, err error) {
	err = db.Pool.QueryRow(ctx, "SELECT feed_id FROM integration.sync_runs WHERE id = $1", runID).Scan(&feedID)
	if err != nil {
		return "", nil, "", nil, nil, fmt.Errorf("failed to fetch feed ID: %w", err)
	}

	var mappingConfigBytes, categoryMappingBytes []byte
	query := `SELECT feed_url, mapping_config, category_mapping, brand_id FROM integration.xml_feeds WHERE id = $1`
	err = db.Pool.QueryRow(ctx, query, feedID).Scan(&feedURL, &mappingConfigBytes, &categoryMappingBytes, &brandID)
	if err != nil {
		return "", nil, "", nil, nil, fmt.Errorf("failed to fetch XML feed config: %w", err)
	}
	if feedURL == "" {
		return "", nil, "", nil, nil, errors.New("XML Feed URL is empty")
	}

	if len(mappingConfigBytes) > 0 {
		_ = json.Unmarshal(mappingConfigBytes, &mappingConfig)
	}
	if len(categoryMappingBytes) > 0 {
		_ = json.Unmarshal(categoryMappingBytes, &categoryMapping)
	}
	return feedID, brandID, feedURL, mappingConfig, categoryMapping, nil
}

func determineVariantRootPath(productRootPath string, mappingConfig map[string]any) string {
	variantRootPath := productRootPath
	candidatePaths := []string{
		getString(mappingConfig, "size"),
		getString(mappingConfig, "color"),
		getString(mappingConfig, "stock"),
		getString(mappingConfig, "price"),
		getString(mappingConfig, "sku"),
	}
	for _, pathStr := range candidatePaths {
		if pathStr != "" {
			parent := getParentPath(pathStr)
			if len(parent) > len(variantRootPath) {
				variantRootPath = parent
			}
		}
	}
	return variantRootPath
}

type syncStreamState struct {
	productRootPath   string
	variantRootPath   string
	currentProductMap map[string][]string
	currentVariantMap map[string]string
	productVariants   []map[string]string
	elementPath       []string
}

func handleXMLStartElement(se xml.StartElement, s *syncStreamState) {
	s.elementPath = append(s.elementPath, se.Name.Local)
	fullPath := strings.Join(s.elementPath, "/")

	if fullPath == s.productRootPath {
		s.currentProductMap = make(map[string][]string)
		s.productVariants = nil
	} else if fullPath == s.variantRootPath && s.variantRootPath != s.productRootPath {
		s.currentVariantMap = make(map[string]string)
	}
}

func handleXMLCharData(se xml.CharData, s *syncStreamState) {
	text := string(bytes.TrimSpace(se))
	if len(text) > 0 && len(s.elementPath) > 0 {
		fullPath := strings.Join(s.elementPath, "/")
		if s.currentProductMap != nil {
			s.currentProductMap[fullPath] = append(s.currentProductMap[fullPath], text)
			if s.currentVariantMap != nil {
				s.currentVariantMap[fullPath] = text
			}
		}
	}
}

func handleXMLEndElement(ctx context.Context, s *syncStreamState, feedID string, brandID *string, runID string, mappingConfig, categoryMapping map[string]any) {
	if len(s.elementPath) == 0 {
		return
	}
	fullPath := strings.Join(s.elementPath, "/")
	s.elementPath = s.elementPath[:len(s.elementPath)-1]

	if fullPath == s.variantRootPath && s.variantRootPath != s.productRootPath {
		if s.currentVariantMap != nil {
			s.productVariants = append(s.productVariants, s.currentVariantMap)
			s.currentVariantMap = nil
		}
		return
	}

	if fullPath == s.productRootPath && s.currentProductMap != nil {
		added, updated, vars, err := importSingleProduct(ctx, SingleProductImportParams{
			FeedID:          feedID,
			BrandID:         brandID,
			SyncRunID:       runID,
			ProductMap:      s.currentProductMap,
			ProductVariants: s.productVariants,
			MappingConfig:   mappingConfig,
			CategoryMapping: categoryMapping,
		})
		if err != nil {
			log.Printf("[SYNC-%s] Failed to import product: %v", runID, err)
			incrementErrorsSkipped(runID)
		} else {
			incrementItemsParsed(runID, added, updated, vars)
		}
		s.currentProductMap = nil
		s.productVariants = nil
	}
}

func parseXMLFeedStream(ctx context.Context, body io.Reader, feedID string, brandID *string, runID string, mappingConfig, categoryMapping map[string]any) {
	decoder := xml.NewDecoder(body)
	productRootPath := getParentPath(getString(mappingConfig, "product_id"))
	variantRootPath := determineVariantRootPath(productRootPath, mappingConfig)

	state := &syncStreamState{
		productRootPath: productRootPath,
		variantRootPath: variantRootPath,
	}

	for {
		t, err := decoder.Token()
		if err != nil {
			break
		}
		switch se := t.(type) {
		case xml.StartElement:
			handleXMLStartElement(se, state)
		case xml.CharData:
			handleXMLCharData(se, state)
		case xml.EndElement:
			handleXMLEndElement(ctx, state, feedID, brandID, runID, mappingConfig, categoryMapping)
		}
	}
}

func markInactiveFeedItems(ctx context.Context, feedID, runID string) {
	inactiveQuery := `
		UPDATE catalog.products 
		SET is_active = false, deactivated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
		WHERE feed_id = $1 AND last_sync_run_id != $2 AND is_active = true`
	_, _ = db.Pool.Exec(ctx, inactiveQuery, feedID, runID)

	inactiveVarsQuery := `
		UPDATE catalog.product_variants 
		SET is_active = false 
		WHERE product_id IN (SELECT id FROM catalog.products WHERE feed_id = $1) AND last_sync_run_id != $2`
	_, _ = db.Pool.Exec(ctx, inactiveVarsQuery, feedID, runID)
}

func finalizeSyncRun(runID string, p *SyncProgress) {
	p.mu.Lock()
	p.ParsingDone = true

	if p.ImagesDownloaded >= p.ImagesTotal {
		p.IsCompleted = true
		p.mu.Unlock()

		summary := buildSyncSummary(p)
		summary["active_workers"] = 0
		summary["download_speed_kbps"] = 0
		summary["percentage"] = 100

		log.Printf("[SYNC-%s] Instant complete! Parsing done and zero pending images.", runID)
		updateSyncStatus(runID, "success", summary)

		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
	} else {
		p.mu.Unlock()
	}
}

// simulateBackgroundSync parses remote XML and syncs products, variants and images in real-time
func simulateBackgroundSync(runID string, ctx context.Context) {
	log.Printf("[SYNC-%s] Real background XML parser thread started...", runID)

	defer func() {
		cancelMapMu.Lock()
		delete(cancelMap, runID)
		cancelMapMu.Unlock()
	}()

	p := getOrCreateProgress(runID)

	feedID, brandID, feedURL, mappingConfig, categoryMapping, err := fetchSyncFeedConfig(ctx, runID)
	if err != nil {
		log.Printf("[SYNC-%s] Config error: %v", runID, err)
		updateSyncStatus(runID, "failed", map[string]any{"error": err.Error()})
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
		return
	}

	if err := validateSafeExternalFeedURL(feedURL); err != nil {
		log.Printf("[SYNC-%s] Unsafe feed URL blocked: %v", runID, err)
		updateSyncStatus(runID, "failed", map[string]any{"error": "Güvenli olmayan XML URL engellendi: " + err.Error()})
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
		return
	}

	if parserType, _ := mappingConfig["parser_type"].(string); parserType == "python_script" {
		script, _ := mappingConfig["python_script"].(string)
		if script == "" {
			script = "parsers/janes.py"
		}
		runPythonParser(ctx, runID, feedID, brandID, feedURL, script, categoryMapping)
		return
	}

	if getString(mappingConfig, "product_id") == "" {
		log.Printf("[SYNC-%s] product_id path mapping is missing", runID)
		updateSyncStatus(runID, "failed", map[string]any{"error": "Zorunlu alan eşleştirmeleri eksik (Tedarikçi Ürün ID)"})
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
		return
	}

	resp, err := safeExternalHTTPGet(httpclient.DefaultPooledClient, feedURL)
	if err != nil {
		log.Printf("[SYNC-%s] Failed to download XML: %v", runID, err)
		updateSyncStatus(runID, "failed", map[string]any{"error": "XML indirme hatası: " + err.Error()})
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
		return
	}
	defer resp.Body.Close()

	parseXMLFeedStream(ctx, resp.Body, feedID, brandID, runID, mappingConfig, categoryMapping)
	markInactiveFeedItems(ctx, feedID, runID)
	finalizeSyncRun(runID, p)
}

type SingleProductImportParams struct {
	FeedID          string
	BrandID         *string
	SyncRunID       string
	ProductMap      map[string][]string
	ProductVariants []map[string]string
	MappingConfig   map[string]any
	CategoryMapping map[string]any
}

type wholesaleProductFields struct {
	SKU          string
	Gender       string
	SeriesRatio  *string
	PackingRatio *string
	Weight       float64
	MinOrderQty  int
	CategoryID   *string
}

func resolveWholesaleCategoryID(ctx context.Context, productMap map[string][]string, mappingConfig, categoryMapping map[string]any, packingRatio string) *string {
	categoryXmlVal := getFirstValue(productMap, getString(mappingConfig, "category_tag"))
	if categoryXmlVal == "" {
		return nil
	}
	catIdVal, ok := categoryMapping[categoryXmlVal]
	if !ok {
		return nil
	}
	catIdStr, ok := catIdVal.(string)
	if !ok || catIdStr == "" {
		return nil
	}
	if packingRatio != "" && isXlOrAboveGo(packingRatio) {
		if plusSizeID := getPlusSizeCategoryEquivalent(ctx, catIdStr); plusSizeID != "" {
			return &plusSizeID
		}
	}
	return &catIdStr
}

func parseWholesaleQuantities(fields *wholesaleProductFields, productMap map[string][]string, mappingConfig map[string]any) {
	if wStr := getFirstValue(productMap, getString(mappingConfig, "shipping_weight_kg")); wStr != "" {
		fields.Weight, _ = strconv.ParseFloat(wStr, 64)
	}
	if moqStr := getFirstValue(productMap, getString(mappingConfig, "minimum_order_quantity")); moqStr != "" {
		if val, err := strconv.Atoi(moqStr); err == nil && val > 0 {
			fields.MinOrderQty = val
		}
	}
}

func extractWholesaleFields(ctx context.Context, productMap map[string][]string, mappingConfig, categoryMapping map[string]any) wholesaleProductFields {
	fields := wholesaleProductFields{
		SKU:         getFirstValue(productMap, getString(mappingConfig, "sku")),
		Gender:      getFirstValue(productMap, getString(mappingConfig, "gender")),
		MinOrderQty: 1,
	}

	seriesRatio := getFirstValue(productMap, getString(mappingConfig, "series_ratio"))
	if seriesRatio != "" {
		fields.SeriesRatio = &seriesRatio
	}
	packingRatio := getFirstValue(productMap, getString(mappingConfig, "packing_ratio"))
	if packingRatio != "" {
		sorted := sortPackingRatioGo(packingRatio)
		fields.PackingRatio = &sorted
	}
	parseWholesaleQuantities(&fields, productMap, mappingConfig)
	fields.CategoryID = resolveWholesaleCategoryID(ctx, productMap, mappingConfig, categoryMapping, packingRatio)
	return fields
}

type variantFinancialInfo struct {
	Price           float64
	DiscountedPrice *float64
	Currency        string
	Color           string
	TaxRate         float64
	SKU             string
	Barcode         string
}

func extractFirstVariantInfo(firstVar map[string]string, productMap map[string][]string, mappingConfig map[string]any, fallbackSKU string) variantFinancialInfo {
	vf := variantFinancialInfo{
		Currency: "TRY",
		TaxRate:  10.00,
		SKU:      fallbackSKU,
	}
	if firstVar == nil {
		return vf
	}

	if vSkuVal := getVariantValue(firstVar, productMap, getString(mappingConfig, "sku")); vSkuVal != "" {
		vf.SKU = vSkuVal
	}
	if vPriceStr := getVariantValue(firstVar, productMap, getString(mappingConfig, "price")); vPriceStr != "" {
		vf.Price, _ = strconv.ParseFloat(vPriceStr, 64)
	}
	if vDiscPriceStr := getVariantValue(firstVar, productMap, getString(mappingConfig, "discounted_price")); vDiscPriceStr != "" {
		if dp, err := strconv.ParseFloat(vDiscPriceStr, 64); err == nil {
			vf.DiscountedPrice = &dp
		}
	}
	if vCurrencyVal := getVariantValue(firstVar, productMap, getString(mappingConfig, "currency")); vCurrencyVal != "" {
		vf.Currency = vCurrencyVal
	}
	vf.Color = getVariantValue(firstVar, productMap, getString(mappingConfig, "color"))
	if vTaxRateStr := getVariantValue(firstVar, productMap, getString(mappingConfig, "tax_rate")); vTaxRateStr != "" {
		if tr, err := strconv.ParseFloat(vTaxRateStr, 64); err == nil {
			vf.TaxRate = tr
			if vf.TaxRate > 0 && vf.TaxRate < 1 {
				vf.TaxRate *= 100
			}
		}
	}
	vf.Barcode = getVariantValue(firstVar, productMap, getString(mappingConfig, "barcode"))
	return vf
}

func calcTotalStock(productVariants []map[string]string, productMap map[string][]string, stockPath string) int {
	totalStock := 0
	for _, vMap := range productVariants {
		vStockStr := getVariantValue(vMap, productMap, stockPath)
		vStock, _ := strconv.Atoi(vStockStr)
		totalStock += vStock
	}
	return totalStock
}

func upsertCatalogProduct(ctx context.Context, p SingleProductImportParams, sourceProductID, title string, fields wholesaleProductFields, vf variantFinancialInfo, totalStock int) (productUUID string, added, updated bool, err error) {
	err = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.products WHERE feed_id = $1 AND source_product_id = $2", p.FeedID, sourceProductID).Scan(&productUUID)

	if errors.Is(err, pgx.ErrNoRows) {
		insertQuery := `
			INSERT INTO catalog.products (
				feed_id, source_product_id, title, category_id, gender, 
				last_sync_run_id, is_active, brand_id, series_ratio, packing_ratio, 
				shipping_weight_kg, minimum_order_quantity,
				buying_price, price, discounted_price, currency, tax_rate, stock, sku, barcode
			) 
			VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11, $12, $12, $13, $14, $15, $16, $17, $18) 
			RETURNING id`
		err = db.Pool.QueryRow(ctx, insertQuery, p.FeedID, sourceProductID, title, fields.CategoryID, fields.Gender, p.SyncRunID, p.BrandID,
			fields.SeriesRatio, fields.PackingRatio, fields.Weight, fields.MinOrderQty,
			vf.Price, vf.DiscountedPrice, vf.Currency, vf.TaxRate, totalStock, vf.SKU, vf.Barcode).Scan(&productUUID)
		if err != nil {
			return "", false, false, fmt.Errorf("failed to insert product: %w", err)
		}
		return productUUID, true, false, nil
	}
	if err != nil {
		return "", false, false, fmt.Errorf("failed to check product existence: %w", err)
	}

	updateQuery := `
		UPDATE catalog.products 
		SET title = $1, category_id = $2, gender = $3, last_sync_run_id = $4, is_active = true, deactivated_at = NULL, brand_id = $5, 
		    series_ratio = $6, packing_ratio = $7, shipping_weight_kg = $8, minimum_order_quantity = $9,
		    buying_price = $10, price = $10, discounted_price = $11, currency = $12, tax_rate = $13, stock = $14, sku = $15, barcode = $16,
		    updated_at = CURRENT_TIMESTAMP 
		WHERE id = $17`
	_, err = db.Pool.Exec(ctx, updateQuery, title, fields.CategoryID, fields.Gender, p.SyncRunID, p.BrandID,
		fields.SeriesRatio, fields.PackingRatio, fields.Weight, fields.MinOrderQty,
		vf.Price, vf.DiscountedPrice, vf.Currency, vf.TaxRate, totalStock, vf.SKU, vf.Barcode, productUUID)
	if err != nil {
		return "", false, false, fmt.Errorf("failed to update product: %w", err)
	}
	return productUUID, false, true, nil
}

func upsertVariantRecord(ctx context.Context, productUUID, sourceVariantId, vSize, vBarcodeVal, syncRunID string, stock int) bool {
	var variantUUID string
	vErr := db.Pool.QueryRow(ctx, "SELECT id FROM catalog.product_variants WHERE product_id = $1 AND source_variant_id = $2", productUUID, sourceVariantId).Scan(&variantUUID)
	if errors.Is(vErr, pgx.ErrNoRows) {
		insertVarQuery := `
			INSERT INTO catalog.product_variants (product_id, source_variant_id, variant_size, barcode, stock, is_single, last_sync_run_id, is_active) 
			VALUES ($1, $2, $3, $4, $5, false, $6, true)`
		_, err := db.Pool.Exec(ctx, insertVarQuery, productUUID, sourceVariantId, vSize, vBarcodeVal, stock, syncRunID)
		return err == nil
	}
	if vErr == nil {
		updateVarQuery := `
			UPDATE catalog.product_variants 
			SET variant_size = $1, barcode = $2, stock = $3, is_single = false, last_sync_run_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP 
			WHERE id = $5`
		_, err := db.Pool.Exec(ctx, updateVarQuery, vSize, vBarcodeVal, stock, syncRunID, variantUUID)
		return err == nil
	}
	return false
}

func getEffectiveVariantsList(variantsList []map[string]string, productMap map[string][]string) []map[string]string {
	if len(variantsList) > 0 {
		return variantsList
	}
	singleVariant := make(map[string]string, len(productMap))
	for k, v := range productMap {
		if len(v) > 0 {
			singleVariant[k] = v[0]
		}
	}
	return []map[string]string{singleVariant}
}

func syncProductVariants(ctx context.Context, p SingleProductImportParams, productUUID, sourceProductID, vColor string) int {
	variantsList := getEffectiveVariantsList(p.ProductVariants, p.ProductMap)

	vSizePath := getString(p.MappingConfig, "size")
	vStockPath := getString(p.MappingConfig, "stock")
	vBarcodePath := getString(p.MappingConfig, "barcode")
	vIdPath := getString(p.MappingConfig, "variant_id")

	variantsCount := 0
	for _, vMap := range variantsList {
		vSize := getVariantValue(vMap, p.ProductMap, vSizePath)
		vStockStr := getVariantValue(vMap, p.ProductMap, vStockPath)
		vBarcodeVal := getVariantValue(vMap, p.ProductMap, vBarcodePath)
		vId := getVariantValue(vMap, p.ProductMap, vIdPath)
		stock, _ := strconv.Atoi(vStockStr)

		sourceVariantId := vId
		if sourceVariantId == "" {
			sourceVariantId = fmt.Sprintf("%s-%s-%s", sourceProductID, slugify(vColor), slugify(vSize))
		}

		if upsertVariantRecord(ctx, productUUID, sourceVariantId, vSize, vBarcodeVal, p.SyncRunID, stock) {
			variantsCount++
		}
	}
	return variantsCount
}

func deduplicateImageURLs(urls []string) []string {
	seen := make(map[string]bool, len(urls))
	unique := make([]string, 0, len(urls))
	for _, u := range urls {
		if !seen[u] && u != "" {
			seen[u] = true
			unique = append(unique, u)
		}
	}
	return unique
}

func collectImagesFromPrefix(productMap map[string][]string, prefix string) []string {
	var urls []string
	for fullPath, vals := range productMap {
		if !strings.HasPrefix(fullPath, prefix) {
			continue
		}
		for _, val := range vals {
			if val != "" {
				urls = append(urls, val)
			}
		}
	}
	return urls
}

func isMatchingImageTag(pathLower string) bool {
	return strings.Contains(pathLower, "resim") || strings.Contains(pathLower, "image")
}

func isHttpUrl(val string) bool {
	return strings.HasPrefix(val, "http://") || strings.HasPrefix(val, "https://")
}

func discoverImagesByAutoDetection(productMap map[string][]string) []string {
	var urls []string
	for fullPath, vals := range productMap {
		if !isMatchingImageTag(strings.ToLower(fullPath)) {
			continue
		}
		for _, val := range vals {
			if val != "" && isHttpUrl(val) {
				urls = append(urls, val)
			}
		}
	}
	return urls
}

func discoverProductImages(productMap map[string][]string, imageUrlPath string) []string {
	var urls []string
	if imageUrlPath != "" {
		urls = collectImagesFromPrefix(productMap, imageUrlPath)
	}
	if len(urls) == 0 {
		urls = discoverImagesByAutoDetection(productMap)
	}
	return deduplicateImageURLs(urls)
}

func resolveSupplierUploadDir(ctx context.Context, feedID string) (uploadDir, supplierFolder string) {
	var supplierAlias string
	_ = db.Pool.QueryRow(ctx, "SELECT alias_code FROM integration.xml_feeds WHERE id = $1", feedID).Scan(&supplierAlias)
	if supplierAlias == "" {
		supplierAlias = feedID
	}
	supplierFolder = strings.ToLower(slugify(supplierAlias))

	uploadDir = filepath.Join("../frontend/uploads/products", supplierFolder)
	if _, err := os.Stat("../../frontend"); err == nil {
		uploadDir = filepath.Join("../../frontend/uploads/products", supplierFolder)
	}
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		uploadDir = filepath.Join("./uploads/products", supplierFolder)
		_ = os.MkdirAll(uploadDir, 0755)
	}
	return uploadDir, supplierFolder
}

func processAndQueueImage(syncRunID, imgUrl, localFilePath string) {
	incrementImagesTotal(syncRunID, 1)
	if _, statErr := os.Stat(localFilePath); statErr == nil {
		incrementDownloadedImages(syncRunID)
		return
	}
	enqueueDownloadTask(DownloadTask{
		URL:           imgUrl,
		LocalFilePath: localFilePath,
		SyncRunID:     syncRunID,
	})
}

// ProductImageSyncContext holds destination parameters for downloading and registering product images
type ProductImageSyncContext struct {
	ProductUUID    string
	SyncRunID      string
	ProductSlug    string
	UploadDir      string
	SupplierFolder string
}

func syncSingleProductImage(ctx context.Context, sCtx ProductImageSyncContext, imgUrl string, idx int) {
	if imgUrl == "" {
		return
	}
	isCover := (idx == 0)
	hashPrefix := getUrlHash(imgUrl)
	localFilename := fmt.Sprintf("%s-%s.jpg", sCtx.ProductSlug, hashPrefix)
	localFilePath := filepath.Join(sCtx.UploadDir, localFilename)
	dbImageUrl := fmt.Sprintf("/uploads/products/%s/%s", sCtx.SupplierFolder, localFilename)

	processAndQueueImage(sCtx.SyncRunID, imgUrl, localFilePath)

	insertImgQuery := `
		INSERT INTO catalog.product_images (product_id, image_url, sort_order, is_cover) 
		VALUES ($1, $2, $3, $4)`
	_, _ = db.Pool.Exec(ctx, insertImgQuery, sCtx.ProductUUID, dbImageUrl, idx, isCover)
}

func syncProductImagesToDiskAndDB(ctx context.Context, feedID, syncRunID, productUUID, title string, imageUrls []string) {
	if len(imageUrls) == 0 {
		return
	}
	uploadDir, supplierFolder := resolveSupplierUploadDir(ctx, feedID)

	var productSlug string
	_ = db.Pool.QueryRow(ctx, "SELECT slug FROM catalog.products WHERE id = $1", productUUID).Scan(&productSlug)
	if productSlug == "" {
		productSlug = slugify(title)
	}

	sCtx := ProductImageSyncContext{
		ProductUUID:    productUUID,
		SyncRunID:      syncRunID,
		ProductSlug:    productSlug,
		UploadDir:      uploadDir,
		SupplierFolder: supplierFolder,
	}

	_, _ = db.Pool.Exec(ctx, "DELETE FROM catalog.product_images WHERE product_id = $1", productUUID)
	for idx, imgUrl := range imageUrls {
		syncSingleProductImage(ctx, sCtx, imgUrl, idx)
	}
}

func importSingleProduct(ctx context.Context, p SingleProductImportParams) (added bool, updated bool, variants int, err error) {
	productIdPath := getString(p.MappingConfig, "product_id")
	titlePath := getString(p.MappingConfig, "title")

	sourceProductId := getFirstValue(p.ProductMap, productIdPath)
	title := getFirstValue(p.ProductMap, titlePath)
	if sourceProductId == "" || title == "" {
		return false, false, 0, fmt.Errorf("missing source product ID or title")
	}

	fields := extractWholesaleFields(ctx, p.ProductMap, p.MappingConfig, p.CategoryMapping)

	var firstVar map[string]string
	if len(p.ProductVariants) > 0 {
		firstVar = p.ProductVariants[0]
	}
	vf := extractFirstVariantInfo(firstVar, p.ProductMap, p.MappingConfig, fields.SKU)
	totalStock := calcTotalStock(p.ProductVariants, p.ProductMap, getString(p.MappingConfig, "stock"))

	productUUID, added, updated, err := upsertCatalogProduct(ctx, p, sourceProductId, title, fields, vf, totalStock)
	if err != nil {
		return false, false, 0, err
	}

	variants = syncProductVariants(ctx, p, productUUID, sourceProductId, vf.Color)

	imageUrls := discoverProductImages(p.ProductMap, getString(p.MappingConfig, "image_url"))
	syncProductImagesToDiskAndDB(ctx, p.FeedID, p.SyncRunID, productUUID, title, imageUrls)

	return added, updated, variants, nil
}

func getUrlHash(url string) string {
	h := md5.Sum([]byte(url))
	return fmt.Sprintf("%x", h)[:8]
}

func getParentPath(path string) string {
	parts := strings.Split(path, "/")
	if len(parts) <= 1 {
		return path
	}
	return strings.Join(parts[:len(parts)-1], "/")
}

func getString(m map[string]any, key string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func getFirstValue(m map[string][]string, key string) string {
	if key == "" {
		return ""
	}
	if val, ok := m[key]; ok && len(val) > 0 {
		return val[0]
	}
	return ""
}

func getVariantValue(vMap map[string]string, pMap map[string][]string, key string) string {
	if key == "" {
		return ""
	}
	if val, ok := vMap[key]; ok && val != "" {
		return val
	}
	return getFirstValue(pMap, key)
}

func slugify(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "-")
	return s
}

func updateSyncStatus(runID string, status string, summary map[string]any) {
	ctx := context.Background()
	summaryBytes, _ := json.Marshal(summary)
	query := `
		UPDATE integration.sync_runs 
		SET completed_at = CURRENT_TIMESTAMP, status = $1, summary = $2 
		WHERE id = $3`
	_, err := db.Pool.Exec(ctx, query, status, summaryBytes, runID)
	if err != nil {
		log.Printf("[SYNC-%s] Failed to update sync status to %s: %v", runID, status, err)
	}

	// Proactively refresh storefront catalog cache first, then run IndexNow so search bots never crawl stale MV cache
	if status == "success" {
		log.Printf("[SYNC-%s] Sync succeeded. Refreshing storefront catalog materialized view before IndexNow ping...", runID)
		safe.Go("Storefront MV Refresh & IndexNow Pipeline", func() {
			refreshCtx, refreshCancel := context.WithTimeout(context.Background(), 45*time.Second)
			_, err := db.Pool.Exec(refreshCtx, "REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products")
			refreshCancel()
			if err != nil {
				log.Printf("[SYNC-%s] Failed to auto-refresh storefront catalog materialized view: %v", runID, err)
			} else {
				log.Printf("[SYNC-%s] Storefront catalog materialized view successfully refreshed!", runID)
			}

			// Trigger autonomous IndexNow ping to Yandex & Bing for newly synced/updated products AFTER MV refresh
			runIndexNowForSyncRun(runID)
		})
	}
}

// runIndexNowForSyncRun queries newly added (or updated) active products in the given sync run,
// expands localized URLs, and submits them to IndexNow with persistent PostgreSQL audit logging.
func runIndexNowForSyncRun(runID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if err := EnsureIndexNowSchema(ctx); err != nil {
		log.Printf("[IndexNow XML Sync] Schema check failed: %v", err)
		return
	}

	var feedID, feedName, brandName string
	var startedAt time.Time
	err := db.Pool.QueryRow(ctx, `
		SELECT sr.feed_id::text, sr.started_at, COALESCE(xf.feed_name, ''), COALESCE(b.name, '')
		FROM integration.sync_runs sr
		LEFT JOIN integration.xml_feeds xf ON xf.id = sr.feed_id
		LEFT JOIN catalog.brands b ON b.id = xf.brand_id
		WHERE sr.id = $1`, runID,
	).Scan(&feedID, &startedAt, &feedName, &brandName)
	if err != nil {
		log.Printf("[IndexNow XML Sync] Failed to query sync metadata for run %s: %v", runID, err)
		return
	}

	feedLabel := strings.TrimSpace(feedName)
	if brandName != "" && !strings.Contains(strings.ToLower(feedLabel), strings.ToLower(brandName)) {
		if feedLabel != "" {
			feedLabel = brandName + " (" + feedLabel + ")"
		} else {
			feedLabel = brandName
		}
	}
	if feedLabel == "" {
		feedLabel = "XML Feed"
	}

	// 1. Prioritize ALL newly inserted active products created during this sync run (no LIMIT 100 truncation)
	newRows, err := db.Pool.Query(ctx, `
		SELECT slug
		FROM catalog.products
		WHERE last_sync_run_id = $1
		  AND is_active = true
		  AND COALESCE(is_archived, false) = false
		  AND slug IS NOT NULL
		  AND slug != ''
		  AND created_at >= ($2 - INTERVAL '2 minutes')
		ORDER BY created_at DESC`, runID, startedAt)
	if err != nil {
		log.Printf("[IndexNow XML Sync] Failed to query new product slugs: %v", err)
		return
	}

	var newSlugs []string
	for newRows.Next() {
		var slug string
		if scanErr := newRows.Scan(&slug); scanErr == nil && strings.TrimSpace(slug) != "" {
			newSlugs = append(newSlugs, slug)
		}
	}
	newRows.Close()

	targetSlugs := newSlugs
	sourceLabel := fmt.Sprintf("XML Senkronizasyon: %s (%d yeni ürün)", feedLabel, len(newSlugs))

	// 2. If no brand-new products were inserted, refresh up to 50 most recently updated active products
	if len(targetSlugs) == 0 {
		freshRows, freshErr := db.Pool.Query(ctx, `
			SELECT slug
			FROM catalog.products
			WHERE last_sync_run_id = $1
			  AND is_active = true
			  AND COALESCE(is_archived, false) = false
			  AND slug IS NOT NULL
			  AND slug != ''
			ORDER BY updated_at DESC
			LIMIT 50`, runID)
		if freshErr != nil {
			log.Printf("[IndexNow XML Sync] Failed to query updated product slugs: %v", freshErr)
			return
		}
		for freshRows.Next() {
			var slug string
			if scanErr := freshRows.Scan(&slug); scanErr == nil && strings.TrimSpace(slug) != "" {
				targetSlugs = append(targetSlugs, slug)
			}
		}
		freshRows.Close()
		sourceLabel = fmt.Sprintf("XML Senkronizasyon: %s (0 yeni, %d güncel ürün tazelendi)", feedLabel, len(targetSlugs))
	}

	urls, productCount := BuildProductIndexNowURLs(targetSlugs)
	if len(urls) == 0 {
		log.Printf("[IndexNow XML Sync] No active product slugs found for sync run %s", runID)
		return
	}

	log.Printf("[IndexNow XML Sync] Submitting %d product(s) (%d localized URLs) for %s [run=%s]", productCount, len(urls), feedLabel, runID)
	if _, submitErr := SubmitIndexNowSync(ctx, IndexNowSubmissionMeta{
		TriggerSource: "xml_sync",
		SourceLabel:   sourceLabel,
		FeedID:        &feedID,
		SyncRunID:     &runID,
		ProductCount:  productCount,
	}, urls); submitErr != nil {
		log.Printf("[IndexNow XML Sync] Submission failed for run %s: %v", runID, submitErr)
	}
}

// --- Standardized B2B Parser Data Transfer Objects ---

type StandardizedProduct struct {
	SourceProductID      string                `json:"source_product_id"`
	SourceProductGroupID string                `json:"source_product_group_id"`
	Title                string                `json:"title"`
	SKU                  string                `json:"sku"`
	Fabric               string                `json:"fabric"`
	Gender               string                `json:"gender"`
	Season               string                `json:"season"`
	CategoryTag          string                `json:"category_tag"`
	CategoryID           *string               `json:"category_id"`
	SeriesRatio          string                `json:"series_ratio"`
	PackingRatio         string                `json:"packing_ratio"`
	ShippingWeightKg     float64               `json:"shipping_weight_kg"`
	MinimumOrderQuantity int                   `json:"minimum_order_quantity"`
	Variants             []StandardizedVariant `json:"variants"`
	Images               []string              `json:"images"`
}

type StandardizedVariant struct {
	SourceVariantID string   `json:"source_variant_id"`
	Sku             string   `json:"sku"`
	Barcode         string   `json:"barcode"`
	Stock           int      `json:"stock"`
	Price           float64  `json:"price"`
	DiscountedPrice *float64 `json:"discounted_price"`
	Currency        string   `json:"currency"`
	Color           string   `json:"color"`
	Size            string   `json:"size"`
	TaxRate         float64  `json:"tax_rate"`
	IsSingle        bool     `json:"is_single"`
}

func resolvePythonScriptPath(scriptPath string) (string, error) {
	exePath, err := os.Executable()
	if err == nil {
		absPath := filepath.Join(filepath.Dir(exePath), scriptPath)
		if _, err := os.Stat(absPath); err == nil {
			return absPath, nil
		}
	}
	absPath := filepath.Join(".", scriptPath)
	if _, err := os.Stat(absPath); err == nil {
		return absPath, nil
	}
	return "", fmt.Errorf("Python script bulunamadı: %s", scriptPath)
}

func startPythonProcess(ctx context.Context, scriptPath, runID string, stderrBuf *bytes.Buffer) (*exec.Cmd, io.ReadCloser, error) {
	pythonCmd := "python3"
	if os.PathSeparator == '\\' {
		pythonCmd = "python"
	}

	buildCmd := func(cmdName string) (*exec.Cmd, io.ReadCloser, error) {
		cmd := exec.CommandContext(ctx, cmdName, scriptPath, "--sync-run-id", runID, "--production")
		cmd.Env = append(os.Environ(), "SYNC_RUN_ID="+runID)
		if globalConfig != nil {
			cmd.Env = append(cmd.Env,
				"DB_HOST="+globalConfig.DBHost,
				"DB_PORT="+globalConfig.DBPort,
				"DB_USER="+globalConfig.DBUser,
				"DB_PASSWORD="+globalConfig.DBPassword,
				"DB_NAME="+globalConfig.DBName,
			)
		}
		cmd.Stderr = stderrBuf
		pipe, err := cmd.StdoutPipe()
		if err != nil {
			return nil, nil, err
		}
		if err := cmd.Start(); err != nil {
			return nil, nil, err
		}
		return cmd, pipe, nil
	}

	cmd, pipe, err := buildCmd(pythonCmd)
	if err == nil {
		return cmd, pipe, nil
	}

	log.Printf("[SYNC-%s] Failed with '%s': %v. Retrying with 'python'...", runID, pythonCmd, err)
	return buildCmd("python")
}

func parsePythonOutputLine(runID, line string) {
	if strings.HasPrefix(line, "-> Parsed ") {
		var parsed, added, updated, errors int
		if _, err := fmt.Sscanf(line, "-> Parsed %d products... (Added: %d, Updated: %d, Errors: %d)", &parsed, &added, &updated, &errors); err == nil {
			p := getOrCreateProgress(runID)
			p.mu.Lock()
			p.ItemsParsed = parsed
			p.ItemsAdded = added
			p.ItemsUpdated = updated
			p.ErrorsSkipped = errors
			p.mu.Unlock()
		}
		return
	}

	if strings.HasPrefix(line, "-> Downloaded ") {
		var downloaded, total, percentage int
		if _, err := fmt.Sscanf(line, "-> Downloaded %d/%d images (%d%%)...", &downloaded, &total, &percentage); err == nil {
			p := getOrCreateProgress(runID)
			p.mu.Lock()
			p.ImagesDownloaded = downloaded
			p.ImagesTotal = total
			p.Percentage = percentage
			p.mu.Unlock()
		}
	}
}

func consumePythonOutput(runID string, stdoutPipe io.Reader) {
	scanner := bufio.NewScanner(stdoutPipe)
	for scanner.Scan() {
		line := scanner.Text()
		log.Printf("[SYNC-%s-OUT] %s", runID, line)
		parsePythonOutputLine(runID, line)
	}
	if err := scanner.Err(); err != nil {
		log.Printf("[SYNC-%s] Scanner error: %v", runID, err)
	}
}

func handlePythonExit(ctx context.Context, runID string, err error, stderrStr string) {
	if err != nil {
		log.Printf("[SYNC-%s] Python script error: %v. Stderr: %s", runID, err, stderrStr)
		var exists bool
		_ = db.Pool.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM integration.sync_runs WHERE id = $1 AND status = 'success')", runID).Scan(&exists)
		if !exists {
			if errors.Is(ctx.Err(), context.Canceled) {
				updateSyncStatus(runID, "failed", map[string]any{"error": "İşlem kullanıcı tarafından durduruldu."})
			} else {
				updateSyncStatus(runID, "failed", map[string]any{"error": "Python hatası: " + stderrStr})
			}
		}
		return
	}

	log.Printf("[SYNC-%s] Python script successfully completed!", runID)
	p := getOrCreateProgress(runID)
	p.mu.Lock()
	p.ParsingDone = true
	p.IsCompleted = true
	p.Percentage = 100
	summary := buildSyncSummary(p)
	summary["active_workers"] = 0
	summary["download_speed_kbps"] = 0
	p.mu.Unlock()

	updateSyncStatus(runID, "success", summary)
}

// runPythonParser runs python script as a subprocess, passing SYNC_RUN_ID via environment
func runPythonParser(ctx context.Context, runID string, feedID string, brandID *string, feedUrl string, scriptPath string, categoryMapping map[string]any) {
	defer func() {
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
	}()

	_ = feedID
	_ = brandID
	_ = feedUrl
	_ = categoryMapping
	log.Printf("[SYNC-%s] Starting autonomous Python script parser: %s", runID, scriptPath)

	absScriptPath, err := resolvePythonScriptPath(scriptPath)
	if err != nil {
		log.Printf("[SYNC-%s] %v", runID, err)
		updateSyncStatus(runID, "failed", map[string]any{"error": err.Error()})
		return
	}

	var stderrBuf bytes.Buffer
	cmd, stdoutPipe, err := startPythonProcess(ctx, absScriptPath, runID, &stderrBuf)
	if err != nil {
		log.Printf("[SYNC-%s] Python command execution failed: %v", runID, err)
		updateSyncStatus(runID, "failed", map[string]any{"error": "Python script başlatılamadı: " + err.Error()})
		return
	}

	if stdoutPipe != nil {
		safe.Go(fmt.Sprintf("Consume Python Output %s", runID), func() {
			consumePythonOutput(runID, stdoutPipe)
		})
	}

	err = cmd.Wait()
	handlePythonExit(ctx, runID, err, stderrBuf.String())
}

func resolveStandardizedCategoryID(ctx context.Context, p *StandardizedProduct, categoryMapping map[string]any) *string {
	var categoryId *string
	if p.CategoryID != nil && *p.CategoryID != "" {
		categoryId = p.CategoryID
	} else if p.CategoryTag != "" {
		if catIdVal, ok := categoryMapping[p.CategoryTag]; ok {
			if catIdStr, ok := catIdVal.(string); ok && catIdStr != "" {
				categoryId = &catIdStr
			}
		}
	}
	if categoryId != nil && *categoryId != "" && p.PackingRatio != "" && isXlOrAboveGo(p.PackingRatio) {
		plusSizeID := getPlusSizeCategoryEquivalent(ctx, *categoryId)
		if plusSizeID != "" {
			categoryId = &plusSizeID
		}
	}
	return categoryId
}

func getStandardizedRatios(p *StandardizedProduct) (seriesRatioPtr, packingRatioPtr *string) {
	if p.SeriesRatio != "" {
		seriesRatioPtr = &p.SeriesRatio
	}
	if p.PackingRatio != "" {
		sortedPackingRatio := sortPackingRatioGo(p.PackingRatio)
		packingRatioPtr = &sortedPackingRatio
	}
	return seriesRatioPtr, packingRatioPtr
}

func summarizeStandardizedVariants(p *StandardizedProduct) (vf variantFinancialInfo, totalStock int) {
	if len(p.Variants) == 0 {
		return variantFinancialInfo{
			Currency: "TRY",
			SKU:      p.SKU,
		}, 0
	}

	firstVar := p.Variants[0]
	vf = variantFinancialInfo{
		Price:           firstVar.Price,
		DiscountedPrice: firstVar.DiscountedPrice,
		Currency:        firstVar.Currency,
		TaxRate:         firstVar.TaxRate,
		SKU:             firstVar.Sku,
		Barcode:         firstVar.Barcode,
		Color:           firstVar.Color,
	}
	if vf.Currency == "" {
		vf.Currency = "TRY"
	}
	if vf.TaxRate > 0 && vf.TaxRate < 1 {
		vf.TaxRate *= 100
	}
	if vf.SKU == "" {
		vf.SKU = p.SKU
	}

	for _, v := range p.Variants {
		totalStock += v.Stock
	}
	return vf, totalStock
}

// StandardizedUpsertParams encapsulates parameters for inserting or updating a standardized product
type StandardizedUpsertParams struct {
	FeedID          string
	BrandID         *string
	SyncRunID       string
	Product         *StandardizedProduct
	CategoryID      *string
	SeriesRatioPtr  *string
	PackingRatioPtr *string
	VF              variantFinancialInfo
	TotalStock      int
}

func upsertStandardizedProductRecord(ctx context.Context, params StandardizedUpsertParams) (productUUID string, added, updated bool, err error) {
	p := params.Product
	err = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.products WHERE feed_id = $1 AND source_product_id = $2", params.FeedID, p.SourceProductID).Scan(&productUUID)

	if errors.Is(err, pgx.ErrNoRows) {
		insertQuery := `
			INSERT INTO catalog.products (
				feed_id, source_product_id, source_product_group_id, title, category_id, gender, 
				last_sync_run_id, is_active, brand_id, series_ratio, packing_ratio, 
				shipping_weight_kg, minimum_order_quantity, season,
				buying_price, price, discounted_price, currency, tax_rate, stock, sku, barcode
			) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $12, $13, $14, $14, $15, $16, $17, $18, $19, $20) 
			RETURNING id`
		err = db.Pool.QueryRow(ctx, insertQuery, params.FeedID, p.SourceProductID, p.SourceProductGroupID, p.Title, params.CategoryID, p.Gender, params.SyncRunID, params.BrandID,
			params.SeriesRatioPtr, params.PackingRatioPtr, p.ShippingWeightKg, p.MinimumOrderQuantity, p.Season,
			params.VF.Price, params.VF.DiscountedPrice, params.VF.Currency, params.VF.TaxRate, params.TotalStock, params.VF.SKU, params.VF.Barcode).Scan(&productUUID)
		if err != nil {
			return "", false, false, fmt.Errorf("failed to insert product: %w", err)
		}
		return productUUID, true, false, nil
	}
	if err != nil {
		return "", false, false, fmt.Errorf("failed to check product existence: %w", err)
	}

	updateQuery := `
		UPDATE catalog.products 
		SET title = $1, category_id = $2, gender = $3, last_sync_run_id = $4, is_active = true, deactivated_at = NULL, brand_id = $5, 
		    series_ratio = $6, packing_ratio = $7, shipping_weight_kg = $8, minimum_order_quantity = $9, season = $10,
		    source_product_group_id = $11, buying_price = $12, price = $12, discounted_price = $13, currency = $14, tax_rate = $15, stock = $16, sku = $17, barcode = $18,
		    updated_at = CURRENT_TIMESTAMP 
		WHERE id = $19`
	_, err = db.Pool.Exec(ctx, updateQuery, p.Title, params.CategoryID, p.Gender, params.SyncRunID, params.BrandID,
		params.SeriesRatioPtr, params.PackingRatioPtr, p.ShippingWeightKg, p.MinimumOrderQuantity, p.Season,
		p.SourceProductGroupID, params.VF.Price, params.VF.DiscountedPrice, params.VF.Currency, params.VF.TaxRate, params.TotalStock, params.VF.SKU, params.VF.Barcode, productUUID)
	if err != nil {
		return "", false, false, fmt.Errorf("failed to update product: %w", err)
	}
	return productUUID, false, true, nil
}

func resolveStandardizedVariantSourceID(v StandardizedVariant, sourceProductID string) string {
	if v.SourceVariantID != "" {
		return v.SourceVariantID
	}
	if v.Sku != "" {
		return v.Sku
	}
	return fmt.Sprintf("%s-%s-%s", sourceProductID, slugify(v.Color), slugify(v.Size))
}

func upsertStandardizedVariantRow(ctx context.Context, productUUID, sourceVariantID, syncRunID string, v StandardizedVariant) bool {
	var variantUUID string
	vErr := db.Pool.QueryRow(ctx, "SELECT id FROM catalog.product_variants WHERE product_id = $1 AND source_variant_id = $2", productUUID, sourceVariantID).Scan(&variantUUID)

	if errors.Is(vErr, pgx.ErrNoRows) {
		insertVarQuery := `
			INSERT INTO catalog.product_variants (product_id, source_variant_id, variant_size, barcode, stock, is_single, last_sync_run_id, is_active) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, true)`
		_, err := db.Pool.Exec(ctx, insertVarQuery, productUUID, sourceVariantID, v.Size, v.Barcode, v.Stock, v.IsSingle, syncRunID)
		return err == nil
	}
	if vErr == nil {
		updateVarQuery := `
			UPDATE catalog.product_variants 
			SET variant_size = $1, barcode = $2, stock = $3, is_single = $4, last_sync_run_id = $5, is_active = true, updated_at = CURRENT_TIMESTAMP 
			WHERE id = $6`
		_, err := db.Pool.Exec(ctx, updateVarQuery, v.Size, v.Barcode, v.Stock, v.IsSingle, syncRunID, variantUUID)
		return err == nil
	}
	return false
}

func syncStandardizedVariantRecords(ctx context.Context, syncRunID, productUUID string, p *StandardizedProduct) int {
	if len(p.Variants) == 0 {
		p.Variants = append(p.Variants, StandardizedVariant{
			Sku:             p.SKU,
			Stock:           99,
			Price:           0.0,
			Currency:        "TRY",
			SourceVariantID: p.SourceProductID,
		})
	}

	variants := 0
	for _, v := range p.Variants {
		sourceVariantID := resolveStandardizedVariantSourceID(v, p.SourceProductID)
		if upsertStandardizedVariantRow(ctx, productUUID, sourceVariantID, syncRunID, v) {
			variants++
		}
	}
	return variants
}

// ImportStandardizedProduct imports a standard DTO representation of B2B product into DB
func ImportStandardizedProduct(ctx context.Context, feedID string, brandID *string, syncRunID string, p *StandardizedProduct, categoryMapping map[string]any) (added bool, updated bool, variants int, err error) {
	if p.SourceProductID == "" || p.Title == "" {
		return false, false, 0, fmt.Errorf("missing source product ID or title")
	}

	seriesRatioPtr, packingRatioPtr := getStandardizedRatios(p)
	categoryId := resolveStandardizedCategoryID(ctx, p, categoryMapping)
	vf, totalStock := summarizeStandardizedVariants(p)

	productUUID, added, updated, err := upsertStandardizedProductRecord(ctx, StandardizedUpsertParams{
		FeedID:          feedID,
		BrandID:         brandID,
		SyncRunID:       syncRunID,
		Product:         p,
		CategoryID:      categoryId,
		SeriesRatioPtr:  seriesRatioPtr,
		PackingRatioPtr: packingRatioPtr,
		VF:              vf,
		TotalStock:      totalStock,
	})
	if err != nil {
		return false, false, 0, err
	}

	variants = syncStandardizedVariantRecords(ctx, syncRunID, productUUID, p)
	syncProductImagesToDiskAndDB(ctx, feedID, syncRunID, productUUID, p.Title, deduplicateImageURLs(p.Images))

	return added, updated, variants, nil
}

// XMLHistoryItem represents a single archived XML file record
type XMLHistoryItem struct {
	Filename      string    `json:"filename"`
	FeedID        string    `json:"feed_id"`
	SupplierName  string    `json:"supplier_name"`
	SizeBytes     int64     `json:"size_bytes"`
	FormattedSize string    `json:"formatted_size"`
	CreatedAt     time.Time `json:"created_at"`
}

func resolveXMLHistoryDir() string {
	xmlDir := "./parsers/downloads/xml_history"
	if _, err := os.Stat(xmlDir); os.IsNotExist(err) {
		xmlDir = "./backend/parsers/downloads/xml_history"
	}
	_ = os.MkdirAll(xmlDir, 0755)
	return xmlDir
}

func parseXMLSupplierName(filename string) (feedID, supplierName string) {
	parts := strings.Split(filename, "-")
	feedID = "unknown"
	supplierName = "Unknown"
	if len(parts) > 0 {
		feedID = parts[0]
		switch feedID {
		case "etika":
			supplierName = "Etika Fashion"
		case "janes":
			supplierName = "Jane's"
		default:
			supplierName = strings.Title(feedID)
		}
	}
	return feedID, supplierName
}

func formatXMLFileSize(size int64) string {
	if size >= 1024*1024 {
		return fmt.Sprintf("%.2f MB", float64(size)/(1024*1024))
	}
	return fmt.Sprintf("%.2f KB", float64(size)/1024)
}

func (h *IntegrationHandler) ListXMLHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	xmlDir := resolveXMLHistoryDir()
	files, err := os.ReadDir(xmlDir)
	if err != nil {
		w.Header().Set(contentTypeHeader, appJSON)
		w.Write([]byte(`[]`))
		return
	}

	history := []XMLHistoryItem{}
	for _, f := range files {
		if f.IsDir() || filepath.Ext(f.Name()) != ".xml" {
			continue
		}
		info, err := f.Info()
		if err != nil {
			continue
		}
		feedID, supplierName := parseXMLSupplierName(f.Name())
		history = append(history, XMLHistoryItem{
			Filename:      f.Name(),
			FeedID:        feedID,
			SupplierName:  supplierName,
			SizeBytes:     info.Size(),
			FormattedSize: formatXMLFileSize(info.Size()),
			CreatedAt:     info.ModTime(),
		})
	}

	sort.Slice(history, func(i, j int) bool {
		return history[i].CreatedAt.After(history[j].CreatedAt)
	})

	w.Header().Set(contentTypeHeader, appJSON)
	json.NewEncoder(w).Encode(history)
}

func deleteXMLHistoryByFeed(xmlDir, feedID string) int {
	files, err := os.ReadDir(xmlDir)
	if err != nil {
		return 0
	}
	count := 0
	for _, f := range files {
		if f.IsDir() || filepath.Ext(f.Name()) != ".xml" {
			continue
		}
		parts := strings.Split(f.Name(), "-")
		if len(parts) > 0 && (feedID == "all" || parts[0] == feedID) {
			if os.Remove(filepath.Join(xmlDir, f.Name())) == nil {
				count++
			}
		}
	}
	return count
}

func deleteXMLHistoryByFilenames(xmlDir string, filenames []string) int {
	count := 0
	for _, fname := range filenames {
		safeFname := filepath.Base(fname)
		if os.Remove(filepath.Join(xmlDir, safeFname)) == nil {
			count++
		}
	}
	return count
}

func (h *IntegrationHandler) DeleteXMLHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Filenames []string `json:"filenames"`
		FeedID    string   `json:"feed_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	xmlDir := resolveXMLHistoryDir()
	deletedCount := 0
	if req.FeedID != "" {
		deletedCount = deleteXMLHistoryByFeed(xmlDir, req.FeedID)
	} else if len(req.Filenames) > 0 {
		deletedCount = deleteXMLHistoryByFilenames(xmlDir, req.Filenames)
	}

	w.Header().Set(contentTypeHeader, appJSON)
	w.Write(fmt.Appendf(nil, `{"success":true,"deleted_count":%d}`, deletedCount))
}

var standardSizesMap = map[string]int{
	"XS": 30, "S": 40, "M": 50, "L": 60, "XL": 70,
	"XXL": 80, "2XL": 80, "XXXL": 90, "3XL": 90,
	"XXXXL": 100, "4XL": 100, "5XL": 110, "6XL": 120,
	"7XL": 130, "8XL": 140, "STANDART": 500, "STANDARD": 500,
	"3XS": 10, "XXXS": 10, "2XS": 20, "XXS": 20,
}

var rangeSplitRegex = regexp.MustCompile(`[-/_]`)

func parseSingleSizeWeightGo(s string) int {
	s = strings.ToUpper(strings.TrimSpace(s))
	if w, ok := standardSizesMap[s]; ok {
		return w
	}
	if val, err := strconv.Atoi(s); err == nil {
		return val
	}

	re := regexp.MustCompile(`^([0-9]+)(XL|XXL|XXXL|XS|XXS|XXXS|L|M|S)$`)
	m := re.FindStringSubmatch(s)
	if len(m) == 3 {
		val, _ := strconv.Atoi(m[1])
		unit := m[2]
		if unit == "XL" || unit == "L" {
			return 70 + (val-1)*10
		}
		if unit == "XS" || unit == "S" {
			return 40 - val*10
		}
	}

	if strings.HasSuffix(s, "XL") {
		xCount := strings.Count(s, "X")
		return 70 + (xCount-1)*10
	}
	if strings.HasSuffix(s, "XS") {
		xCount := strings.Count(s, "X")
		return 40 - xCount*10
	}
	return 999
}

func parseTwoPartRangeWeight(part1, part2 string) int {
	if _, err := strconv.Atoi(part1); err == nil {
		if strings.HasSuffix(part2, "XL") {
			return min(parseSingleSizeWeightGo(part1+"XL"), parseSingleSizeWeightGo(part2))
		}
		if strings.HasSuffix(part2, "XS") {
			return min(parseSingleSizeWeightGo(part1+"XS"), parseSingleSizeWeightGo(part2))
		}
	}
	return min(parseSingleSizeWeightGo(part1), parseSingleSizeWeightGo(part2))
}

func parseRangeWeightGo(token string) int {
	token = strings.ToUpper(strings.TrimSpace(token))
	if w, ok := standardSizesMap[token]; ok {
		return w
	}
	parts := rangeSplitRegex.Split(token, -1)
	if len(parts) == 2 {
		return parseTwoPartRangeWeight(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
	}
	return parseSingleSizeWeightGo(token)
}

type SizeSortItem struct {
	Token    string
	Category int
	Weight   int
}

func sortPackingRatioGo(ratio string) string {
	ratio = strings.TrimSpace(ratio)
	if ratio == "" {
		return ratio
	}

	parts := strings.Split(ratio, ",")
	var items []SizeSortItem
	for _, p := range parts {
		token := strings.TrimSpace(p)
		if token == "" {
			continue
		}
		upper := strings.ToUpper(token)
		category := 1
		weight := 999

		if _, err := strconv.Atoi(upper); err == nil {
			category = 0
			weight, _ = strconv.Atoi(upper)
		} else if w, ok := standardSizesMap[upper]; ok {
			weight = w
		} else {
			weight = parseRangeWeightGo(upper)
		}

		items = append(items, SizeSortItem{
			Token:    token,
			Category: category,
			Weight:   weight,
		})
	}

	if len(items) == 0 {
		return ratio
	}

	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Category != items[j].Category {
			return items[i].Category < items[j].Category
		}
		if items[i].Weight != items[j].Weight {
			return items[i].Weight < items[j].Weight
		}
		return items[i].Token < items[j].Token
	})

	var sortedTokens []string
	for _, item := range items {
		sortedTokens = append(sortedTokens, item.Token)
	}
	return strings.Join(sortedTokens, ",")
}

var plusSizeIndicators = map[string]bool{
	"XL": true, "XXL": true, "2XL": true, "XXXL": true, "3XL": true,
	"XXXXL": true, "4XL": true, "5XL": true, "6XL": true, "7XL": true, "8XL": true,
	"2-3XL": true, "L-XL": true,
}

func isSubpartPlusSize(sp string) bool {
	if plusSizeIndicators[sp] || strings.HasSuffix(sp, "XL") || (strings.HasSuffix(sp, "XS") && sp != "XS") {
		return true
	}
	for ind := range plusSizeIndicators {
		if strings.Contains(sp, ind) {
			return true
		}
	}
	return false
}

func isTokenPlusSize(token string) bool {
	if plusSizeIndicators[token] {
		return true
	}
	for _, sp := range rangeSplitRegex.Split(token, -1) {
		if isSubpartPlusSize(strings.TrimSpace(sp)) {
			return true
		}
	}
	return false
}

func isXlOrAboveGo(ratio string) bool {
	ratio = strings.TrimSpace(ratio)
	if ratio == "" {
		return false
	}
	for _, p := range strings.Split(ratio, ",") {
		token := strings.ToUpper(strings.TrimSpace(p))
		if token != "" && isTokenPlusSize(token) {
			return true
		}
	}
	return false
}

func getPlusSizeCategoryEquivalent(ctx context.Context, stdCategoryID string) string {
	if stdCategoryID == "" {
		return ""
	}

	var slug string
	err := db.Pool.QueryRow(ctx, "SELECT slug FROM catalog.categories WHERE id = $1", stdCategoryID).Scan(&slug)
	if err != nil {
		return stdCategoryID
	}

	if strings.HasPrefix(slug, "buyuk-beden") {
		return stdCategoryID
	}

	targetSlug := "buyuk-beden-" + slug
	var plusSizeID string
	err = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.categories WHERE slug = $1", targetSlug).Scan(&plusSizeID)
	if err == nil && plusSizeID != "" {
		return plusSizeID
	}

	err = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.categories WHERE slug = 'buyuk-beden-diger'").Scan(&plusSizeID)
	if err == nil && plusSizeID != "" {
		return plusSizeID
	}

	err = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.categories WHERE slug = 'buyuk-beden'").Scan(&plusSizeID)
	if err == nil && plusSizeID != "" {
		return plusSizeID
	}

	return stdCategoryID
}
