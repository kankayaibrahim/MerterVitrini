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
	"net/http"
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

	"github.com/jackc/pgx/v5"
	"mertervitrini/admin/backend/db"
	"mertervitrini/admin/backend/models"
)

type DownloadTask struct {
	URL           string
	LocalFilePath string
	SyncRunID     string
}

type SyncProgress struct {
	mu                 sync.RWMutex
	RunID              string
	ItemsParsed        int
	ItemsAdded         int
	ItemsUpdated       int
	VariantsAligned    int
	ErrorsSkipped      int
	ImagesTotal        int
	ImagesDownloaded   int
	ActiveWorkers      int
	DownloadSpeedKbps  int
	Percentage         int
	BytesInLastSec     int64
	ParsingDone        bool
	IsCompleted        bool
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
		go downloadWorker(i)
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

func downloadImageWithSpeedTracking(url string, destPath string, runID string) error {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
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
			progressMu.Lock()
			if p, ok := progressMap[runID]; ok {
				p.mu.Lock()
				p.BytesInLastSec += int64(n)
				p.mu.Unlock()
			}
			progressMu.Unlock()
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
	go func() {
		for range ticker.C {
			updateProgressTick()
		}
	}()
}

func updateProgressTick() {
	progressMu.Lock()
	defer progressMu.Unlock()

	for runID, p := range progressMap {
		p.mu.Lock()

		// Fetch progress from Redis if Redis client is available
		if db.RedisClient != nil {
			redisKey := "sync_run:progress:" + runID
			ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
			val, err := db.RedisClient.Get(ctx, redisKey).Result()
			cancel()
			if err == nil && val != "" {
				var redisSummary map[string]any
				if err := json.Unmarshal([]byte(val), &redisSummary); err == nil {
					// Update memory tracker state based on Redis
					if v, ok := redisSummary["items_parsed"].(float64); ok { p.ItemsParsed = int(v) }
					if v, ok := redisSummary["items_added"].(float64); ok { p.ItemsAdded = int(v) }
					if v, ok := redisSummary["items_updated"].(float64); ok { p.ItemsUpdated = int(v) }
					if v, ok := redisSummary["variants_aligned"].(float64); ok { p.VariantsAligned = int(v) }
					if v, ok := redisSummary["errors_skipped"].(float64); ok { p.ErrorsSkipped = int(v) }
					if v, ok := redisSummary["images_total"].(float64); ok { p.ImagesTotal = int(v) }
					if v, ok := redisSummary["images_downloaded"].(float64); ok { p.ImagesDownloaded = int(v) }
					if v, ok := redisSummary["percentage"].(float64); ok { p.Percentage = int(v) }
					
					if status, ok := redisSummary["status"].(string); ok && status == "success" {
						p.ParsingDone = true
						p.IsCompleted = true
					}
				}
			}
		}

		// Calculate speed
		speedKbps := int(p.BytesInLastSec / 1024)
		p.BytesInLastSec = 0
		p.DownloadSpeedKbps = speedKbps

		// Fetch current active workers
		p.ActiveWorkers = int(atomic.LoadInt32(&activeWorkers))

		// Calculate percentage
		if p.ImagesTotal > 0 {
			p.Percentage = (p.ImagesDownloaded * 100) / p.ImagesTotal
		}

		summary := map[string]any{
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

		// If XML parsing is done AND all images are downloaded, mark as success
		if p.ParsingDone && p.ImagesDownloaded >= p.ImagesTotal && !p.IsCompleted {
			p.IsCompleted = true
			p.mu.Unlock()

			log.Printf("[SYNC-%s] Complete! Parsing done and all %d images processed.", runID, p.ImagesTotal)
			updateSyncStatus(runID, "success", summary)

			// Remove from map
			delete(progressMap, runID)
			continue
		}

		p.mu.Unlock()

		// Otherwise, update live statistics in DB for polling
		updateSyncStatusLive(runID, "running", summary)
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

type IntegrationHandler struct{}

func NewIntegrationHandler() *IntegrationHandler {
	return &IntegrationHandler{}
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(feeds)
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

	// 1. Download XML stream (timeout 10s)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(req.FeedUrl)
	if err != nil {
		log.Printf("Failed to download XML preview from %s: %v", req.FeedUrl, err)
		http.Error(w, `{"error":"Failed to download XML from the provided URL"}`, http.StatusBadRequest)
		return
	}
	defer resp.Body.Close()

	// 2. Read only first 256KB to avoid memory bloat
	limitedReader := io.LimitReader(resp.Body, 256*1024)
	var buf bytes.Buffer
	_, _ = io.Copy(&buf, limitedReader)

	// 3. Parse XML tokens
	decoder := xml.NewDecoder(bytes.NewReader(buf.Bytes()))
	tagMap := make(map[string]bool)
	tagUniqueValues := make(map[string]map[string]bool)
	previewData := make(map[string]string)

	var elementPath []string

	for {
		t, err := decoder.Token()
		if err != nil {
			break
		}

		switch se := t.(type) {
		case xml.StartElement:
			name := se.Name.Local
			elementPath = append(elementPath, name)
			fullPath := strings.Join(elementPath, "/")
			tagMap[fullPath] = true

		case xml.CharData:
			text := string(bytes.TrimSpace(se))
			if len(text) > 0 && len(elementPath) > 0 {
				fullPath := strings.Join(elementPath, "/")

				// Collect unique values for this tag path (limit length and count to prevent memory bloat)
				if len(text) < 150 {
					if tagUniqueValues[fullPath] == nil {
						tagUniqueValues[fullPath] = make(map[string]bool)
					}
					if len(tagUniqueValues[fullPath]) < 500 {
						tagUniqueValues[fullPath][text] = true
					}
				}

				// Populate preview data (first value encountered)
				if _, exists := previewData[fullPath]; !exists {
					previewData[fullPath] = text
				}
			}

		case xml.EndElement:
			if len(elementPath) > 0 {
				elementPath = elementPath[:len(elementPath)-1]
			}
		}
	}

	var tags []string
	for tag := range tagMap {
		tags = append(tags, tag)
	}
	sort.Strings(tags)

	uniqueCategoriesMap := make(map[string][]string)
	for tag, valuesMap := range tagUniqueValues {
		var vals []string
		for val := range valuesMap {
			vals = append(vals, val)
		}
		sort.Strings(vals)
		uniqueCategoriesMap[tag] = vals
	}

	w.Header().Set("Content-Type", "application/json")
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

	w.Header().Set("Content-Type", "application/json")
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
	go simulateBackgroundSync(run.ID, bgCtx)

	w.Header().Set("Content-Type", "application/json")
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
			
			w.Header().Set("Content-Type", "application/json")
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

	w.Header().Set("Content-Type", "application/json")
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

	w.Header().Set("Content-Type", "application/json")
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

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true,"message":"Senkronizasyon geçmişi başarıyla temizlendi."}`))
}
// simulateBackgroundSync parses remote XML and syncs products, variants and images in real-time
func simulateBackgroundSync(runID string, ctx context.Context) {
	log.Printf("[SYNC-%s] Real background XML parser thread started...", runID)
	
	defer func() {
		cancelMapMu.Lock()
		delete(cancelMap, runID)
		cancelMapMu.Unlock()
	}()

	// Initialize progress
	p := getOrCreateProgress(runID)

	// 1. Fetch Feed details
	var feedID string
	err := db.Pool.QueryRow(ctx, "SELECT feed_id FROM integration.sync_runs WHERE id = $1", runID).Scan(&feedID)
	if err != nil {
		log.Printf("[SYNC-%s] Failed to fetch feed ID: %v", runID, err)
		updateSyncStatus(runID, "failed", map[string]any{"error": "Failed to fetch sync run Details"})
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
		return
	}

	var feedUrl string
	var mappingConfigBytes []byte
	var categoryMappingBytes []byte
	var brandID *string

	query := `
		SELECT feed_url, mapping_config, category_mapping, brand_id 
		FROM integration.xml_feeds 
		WHERE id = $1`

	err = db.Pool.QueryRow(ctx, query, feedID).Scan(&feedUrl, &mappingConfigBytes, &categoryMappingBytes, &brandID)
	if err != nil {
		log.Printf("[SYNC-%s] Failed to fetch XML feed config: %v", runID, err)
		updateSyncStatus(runID, "failed", map[string]any{"error": "Failed to fetch XML Feed configuration"})
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
		return
	}

	if feedUrl == "" {
		log.Printf("[SYNC-%s] XML feed URL is empty", runID)
		updateSyncStatus(runID, "failed", map[string]any{"error": "XML Feed URL is empty"})
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
		return
	}

	var mappingConfig map[string]any
	var categoryMapping map[string]any

	if len(mappingConfigBytes) > 0 {
		json.Unmarshal(mappingConfigBytes, &mappingConfig)
	}
	if len(categoryMappingBytes) > 0 {
		json.Unmarshal(categoryMappingBytes, &categoryMapping)
	}

	parserType, _ := mappingConfig["parser_type"].(string)
	if parserType == "python_script" {
		pythonScript, _ := mappingConfig["python_script"].(string)
		if pythonScript == "" {
			pythonScript = "parsers/janes.py"
		}
		runPythonParser(ctx, runID, feedID, brandID, feedUrl, pythonScript, categoryMapping)
		return
	}

	productIdPath := getString(mappingConfig, "product_id")
	if productIdPath == "" {
		log.Printf("[SYNC-%s] product_id path mapping is missing", runID)
		updateSyncStatus(runID, "failed", map[string]any{"error": "Zorunlu alan eşleştirmeleri eksik (Tedarikçi Ürün ID)"})
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
		return
	}

	// 2. Download XML stream
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(feedUrl)
	if err != nil {
		log.Printf("[SYNC-%s] Failed to download XML: %v", runID, err)
		updateSyncStatus(runID, "failed", map[string]any{"error": "XML indirme hatası: " + err.Error()})
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
		return
	}
	defer resp.Body.Close()

	// 3. Parse XML
	decoder := xml.NewDecoder(resp.Body)
	var elementPath []string

	productRootPath := getParentPath(productIdPath)
	
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

	var currentProductMap map[string][]string
	var currentVariantMap map[string]string
	var productVariants []map[string]string

	for {
		t, err := decoder.Token()
		if err != nil {
			break
		}

		switch se := t.(type) {
		case xml.StartElement:
			name := se.Name.Local
			elementPath = append(elementPath, name)
			fullPath := strings.Join(elementPath, "/")

			if fullPath == productRootPath {
				currentProductMap = make(map[string][]string)
				productVariants = nil
			} else if fullPath == variantRootPath && variantRootPath != productRootPath {
				currentVariantMap = make(map[string]string)
			}

		case xml.CharData:
			text := string(bytes.TrimSpace(se))
			if len(text) > 0 && len(elementPath) > 0 {
				fullPath := strings.Join(elementPath, "/")
				if currentProductMap != nil {
					currentProductMap[fullPath] = append(currentProductMap[fullPath], text)
					if currentVariantMap != nil {
						currentVariantMap[fullPath] = text
					}
				}
			}

		case xml.EndElement:
			if len(elementPath) > 0 {
				fullPath := strings.Join(elementPath, "/")
				elementPath = elementPath[:len(elementPath)-1]

				if fullPath == variantRootPath && variantRootPath != productRootPath {
					if currentVariantMap != nil {
						productVariants = append(productVariants, currentVariantMap)
						currentVariantMap = nil
					}
				} else if fullPath == productRootPath {
					if currentProductMap != nil {
						added, updated, vars, err := importSingleProduct(ctx, feedID, brandID, runID, currentProductMap, productVariants, mappingConfig, categoryMapping)
						if err != nil {
							log.Printf("[SYNC-%s] Failed to import product: %v", runID, err)
							incrementErrorsSkipped(runID)
						} else {
							incrementItemsParsed(runID, added, updated, vars)
						}
						currentProductMap = nil
						productVariants = nil
					}
				}
			}
		}
	}

	// 4. Mark all other products from this feed NOT seen in this sync run as INACTIVE
	inactiveQuery := `
		UPDATE catalog.products 
		SET is_active = false 
		WHERE feed_id = $1 AND last_sync_run_id != $2`
	_, _ = db.Pool.Exec(ctx, inactiveQuery, feedID, runID)

	inactiveVarsQuery := `
		UPDATE catalog.product_variants 
		SET is_active = false 
		WHERE product_id IN (SELECT id FROM catalog.products WHERE feed_id = $1) AND last_sync_run_id != $2`
	_, _ = db.Pool.Exec(ctx, inactiveVarsQuery, feedID, runID)

	p.mu.Lock()
	p.ParsingDone = true

	// If all images are already downloaded (or there were none), complete immediately
	if p.ImagesDownloaded >= p.ImagesTotal {
		p.IsCompleted = true
		p.mu.Unlock()

		summary := map[string]any{
			"items_parsed":        p.ItemsParsed,
			"items_added":         p.ItemsAdded,
			"items_updated":       p.ItemsUpdated,
			"variants_aligned":    p.VariantsAligned,
			"errors_skipped":      p.ErrorsSkipped,
			"images_total":        p.ImagesTotal,
			"images_downloaded":   p.ImagesDownloaded,
			"active_workers":      0,
			"download_speed_kbps": 0,
			"percentage":          100,
		}
		log.Printf("[SYNC-%s] Instant complete! Parsing done and zero pending images.", runID)
		updateSyncStatus(runID, "success", summary)

		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
	} else {
		p.mu.Unlock()
	}
}


func importSingleProduct(ctx context.Context, feedID string, brandID *string, syncRunID string, productMap map[string][]string, productVariants []map[string]string, mappingConfig map[string]any, categoryMapping map[string]any) (added bool, updated bool, variants int, err error) {
	productIdPath := getString(mappingConfig, "product_id")
	titlePath := getString(mappingConfig, "title")
	skuPath := getString(mappingConfig, "sku")
	fabricPath := getString(mappingConfig, "fabric")
	genderPath := getString(mappingConfig, "gender")
	categoryTagPath := getString(mappingConfig, "category_tag")

	// Wholesale B2B fields
	seriesRatioPath := getString(mappingConfig, "series_ratio")
	packingRatioPath := getString(mappingConfig, "packing_ratio")
	weightPath := getString(mappingConfig, "shipping_weight_kg")
	minOrderQtyPath := getString(mappingConfig, "minimum_order_quantity")

	sourceProductId := getFirstValue(productMap, productIdPath)
	title := getFirstValue(productMap, titlePath)

	if sourceProductId == "" || title == "" {
		return false, false, 0, fmt.Errorf("missing source product ID or title")
	}

	sku := getFirstValue(productMap, skuPath)
	fabric := getFirstValue(productMap, fabricPath)
	_ = fabric
	gender := getFirstValue(productMap, genderPath)
	categoryXmlVal := getFirstValue(productMap, categoryTagPath)

	// Retrieve wholesale values
	seriesRatio := getFirstValue(productMap, seriesRatioPath)
	packingRatio := getFirstValue(productMap, packingRatioPath)
	weightStr := getFirstValue(productMap, weightPath)
	minOrderQtyStr := getFirstValue(productMap, minOrderQtyPath)

	var weight float64
	if weightStr != "" {
		weight, _ = strconv.ParseFloat(weightStr, 64)
	}

	minOrderQty := 1
	if minOrderQtyStr != "" {
		if val, err := strconv.Atoi(minOrderQtyStr); err == nil && val > 0 {
			minOrderQty = val
		}
	}

	var seriesRatioPtr *string
	if seriesRatio != "" {
		seriesRatioPtr = &seriesRatio
	}
	var packingRatioPtr *string
	if packingRatio != "" {
		sortedPackingRatio := sortPackingRatioGo(packingRatio)
		packingRatioPtr = &sortedPackingRatio
	}

	var categoryId *string
	if categoryXmlVal != "" {
		if catIdVal, ok := categoryMapping[categoryXmlVal]; ok {
			if catIdStr, ok := catIdVal.(string); ok && catIdStr != "" {
				categoryId = &catIdStr
			}
		}
	}

	// Automatically redirect to plus-size category hierarchy if product size is XL or above
	if categoryId != nil && *categoryId != "" && packingRatio != "" && isXlOrAboveGo(packingRatio) {
		plusSizeID := getPlusSizeCategoryEquivalent(ctx, *categoryId)
		if plusSizeID != "" {
			categoryId = &plusSizeID
		}
	}

	// Calculate total stock and extract color-level attributes from first variant
	var firstVar map[string]string
	if len(productVariants) > 0 {
		firstVar = productVariants[0]
	}

	var totalStock int
	for _, vMap := range productVariants {
		vStockPath := getString(mappingConfig, "stock")
		vStockStr := getVariantValue(vMap, productMap, vStockPath)
		vStock, _ := strconv.Atoi(vStockStr)
		totalStock += vStock
	}

	vPrice := 0.0
	var vDiscountedPrice *float64
	vCurrency := "TRY"
	vColor := ""
	vTaxRate := 10.00
	vSku := sku
	var vBarcode string

	if firstVar != nil {
		vSkuPath := getString(mappingConfig, "sku")
		vPricePath := getString(mappingConfig, "price")
		vDiscPricePath := getString(mappingConfig, "discounted_price")
		vCurrencyPath := getString(mappingConfig, "currency")
		vColorPath := getString(mappingConfig, "color")
		vTaxRatePath := getString(mappingConfig, "tax_rate")
		vBarcodePath := getString(mappingConfig, "barcode")

		vSkuVal := getVariantValue(firstVar, productMap, vSkuPath)
		if vSkuVal != "" {
			vSku = vSkuVal
		}
		vPriceStr := getVariantValue(firstVar, productMap, vPricePath)
		vPrice, _ = strconv.ParseFloat(vPriceStr, 64)

		vDiscPriceStr := getVariantValue(firstVar, productMap, vDiscPricePath)
		if vDiscPriceStr != "" {
			if dp, err := strconv.ParseFloat(vDiscPriceStr, 64); err == nil {
				vDiscountedPrice = &dp
			}
		}

		vCurrencyVal := getVariantValue(firstVar, productMap, vCurrencyPath)
		if vCurrencyVal != "" {
			vCurrency = vCurrencyVal
		}

		vColorVal := getVariantValue(firstVar, productMap, vColorPath)
		if vColorVal != "" {
			vColor = vColorVal
		}

		vTaxRateStr := getVariantValue(firstVar, productMap, vTaxRatePath)
		if vTaxRateStr != "" {
			if tr, err := strconv.ParseFloat(vTaxRateStr, 64); err == nil {
				vTaxRate = tr
				if vTaxRate > 0 && vTaxRate < 1 {
					vTaxRate = vTaxRate * 100
				}
			}
		}

		vBarcodePathVal := getVariantValue(firstVar, productMap, vBarcodePath)
		if vBarcodePathVal != "" {
			vBarcode = vBarcodePathVal
		}
	}

	// Determine if product exists
	var productUUID string
	err = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.products WHERE feed_id = $1 AND source_product_id = $2", feedID, sourceProductId).Scan(&productUUID)

	isNew := false
	if errors.Is(err, pgx.ErrNoRows) {
		isNew = true
		insertQuery := `
			INSERT INTO catalog.products (
				feed_id, source_product_id, title, category_id, gender, 
				last_sync_run_id, is_active, brand_id, series_ratio, packing_ratio, 
				shipping_weight_kg, minimum_order_quantity,
				price, discounted_price, currency, tax_rate, stock, sku, barcode
			) 
			VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
			RETURNING id`
		err = db.Pool.QueryRow(ctx, insertQuery, feedID, sourceProductId, title, categoryId, gender, syncRunID, brandID, 
			seriesRatioPtr, packingRatioPtr, weight, minOrderQty,
			vPrice, vDiscountedPrice, vCurrency, vTaxRate, totalStock, vSku, vBarcode).Scan(&productUUID)
		if err != nil {
			return false, false, 0, fmt.Errorf("failed to insert product: %w", err)
		}
		added = true
	} else if err != nil {
		return false, false, 0, fmt.Errorf("failed to check product existence: %w", err)
	} else {
		updateQuery := `
			UPDATE catalog.products 
			SET title = $1, category_id = $2, gender = $3, last_sync_run_id = $4, is_active = true, brand_id = $5, 
			    series_ratio = $6, packing_ratio = $7, shipping_weight_kg = $8, minimum_order_quantity = $9,
			    price = $10, discounted_price = $11, currency = $12, tax_rate = $13, stock = $14, sku = $15, barcode = $16,
			    updated_at = CURRENT_TIMESTAMP 
			WHERE id = $17`
		_, err = db.Pool.Exec(ctx, updateQuery, title, categoryId, gender, syncRunID, brandID, 
			seriesRatioPtr, packingRatioPtr, weight, minOrderQty,
			vPrice, vDiscountedPrice, vCurrency, vTaxRate, totalStock, vSku, vBarcode, productUUID)
		if err != nil {
			return false, false, 0, fmt.Errorf("failed to update product: %w", err)
		}
		updated = true
	}

	// Normalize variants: if none exist, treat product as single variant
	if len(productVariants) == 0 {
		singleVariant := make(map[string]string)
		for k, v := range productMap {
			if len(v) > 0 {
				singleVariant[k] = v[0]
			}
		}
		productVariants = append(productVariants, singleVariant)
	}

	// Loop variants
	for _, vMap := range productVariants {
		vSizePath := getString(mappingConfig, "size")
		vStockPath := getString(mappingConfig, "stock")
		vBarcodePath := getString(mappingConfig, "barcode")

		// New variant specific paths
		vIdPath := getString(mappingConfig, "variant_id")

		vSize := getVariantValue(vMap, productMap, vSizePath)
		vStockStr := getVariantValue(vMap, productMap, vStockPath)
		vBarcodeVal := getVariantValue(vMap, productMap, vBarcodePath)

		vId := getVariantValue(vMap, productMap, vIdPath)

		stock, _ := strconv.Atoi(vStockStr)

		// Determine unique source_variant_id
		sourceVariantId := vId
		if sourceVariantId == "" {
			sourceVariantId = fmt.Sprintf("%s-%s-%s", sourceProductId, slugify(vColor), slugify(vSize))
		}

		var variantUUID string
		vErr := db.Pool.QueryRow(ctx, "SELECT id FROM catalog.product_variants WHERE product_id = $1 AND source_variant_id = $2", productUUID, sourceVariantId).Scan(&variantUUID)

		if errors.Is(vErr, pgx.ErrNoRows) {
			insertVarQuery := `
				INSERT INTO catalog.product_variants (product_id, source_variant_id, variant_size, barcode, stock, is_single, last_sync_run_id, is_active) 
				VALUES ($1, $2, $3, $4, $5, false, $6, true)`
			_, err = db.Pool.Exec(ctx, insertVarQuery, productUUID, sourceVariantId, vSize, vBarcodeVal, stock, syncRunID)
			if err != nil {
				log.Printf("Failed to insert variant %s: %v", sourceVariantId, err)
			} else {
				variants++
			}
		} else if vErr == nil {
			updateVarQuery := `
				UPDATE catalog.product_variants 
				SET variant_size = $1, barcode = $2, stock = $3, is_single = false, last_sync_run_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP 
				WHERE id = $5`
			_, err = db.Pool.Exec(ctx, updateVarQuery, vSize, vBarcodeVal, stock, syncRunID, variantUUID)
			if err != nil {
				log.Printf("Failed to update variant %s: %v", sourceVariantId, err)
			} else {
				variants++
			}
		}
	}

	// 5. Handle Images
	imageUrlPath := getString(mappingConfig, "image_url")
	var imageUrls []string
	if imageUrlPath != "" {
		// Collect all values matching/prefixing image_url path to support parents/containers
		for fullPath, vals := range productMap {
			if strings.HasPrefix(fullPath, imageUrlPath) {
				for _, val := range vals {
					if val != "" {
						imageUrls = append(imageUrls, val)
					}
				}
			}
		}
	}

	// Fallback auto-discovery for images inside XML
	if len(imageUrls) == 0 {
		for fullPath, vals := range productMap {
			lowerPath := strings.ToLower(fullPath)
			if strings.Contains(lowerPath, "resim") || strings.Contains(lowerPath, "image") {
				for _, val := range vals {
					if val != "" && (strings.HasPrefix(val, "http://") || strings.HasPrefix(val, "https://")) {
						imageUrls = append(imageUrls, val)
					}
				}
			}
		}
	}

	// Deduplicate imageUrls
	seenImages := make(map[string]bool)
	var uniqueImages []string
	for _, imgUrl := range imageUrls {
		if !seenImages[imgUrl] {
			seenImages[imgUrl] = true
			uniqueImages = append(uniqueImages, imgUrl)
		}
	}
	imageUrls = uniqueImages

	if len(imageUrls) > 0 {
		// Fetch supplier alias code for subfolder creation
		var supplierAlias string
		_ = db.Pool.QueryRow(ctx, "SELECT alias_code FROM integration.xml_feeds WHERE id = $1", feedID).Scan(&supplierAlias)
		if supplierAlias == "" {
			supplierAlias = feedID
		}
		supplierFolder := strings.ToLower(slugify(supplierAlias))

		// Determine correct upload directory path based on environment
		uploadDir := filepath.Join("../frontend/uploads/products", supplierFolder)
		if _, err := os.Stat("../../frontend"); err == nil {
			uploadDir = filepath.Join("../../frontend/uploads/products", supplierFolder)
		}

		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			uploadDir = filepath.Join("./uploads/products", supplierFolder)
			_ = os.MkdirAll(uploadDir, 0755)
		}

		// Fetch product slug for SEO-friendly filename
		var productSlug string
		_ = db.Pool.QueryRow(ctx, "SELECT slug FROM catalog.products WHERE id = $1", productUUID).Scan(&productSlug)
		if productSlug == "" {
			productSlug = slugify(title)
		}

		_, _ = db.Pool.Exec(ctx, "DELETE FROM catalog.product_images WHERE product_id = $1", productUUID)
		for idx, imgUrl := range imageUrls {
			if imgUrl != "" {
				isCover := (idx == 0)

				// Generate local SEO-friendly path
				hashPrefix := getUrlHash(imgUrl)
				localFilename := fmt.Sprintf("%s-%s.jpg", productSlug, hashPrefix)
				localFilePath := filepath.Join(uploadDir, localFilename)
				dbImageUrl := fmt.Sprintf("/uploads/products/%s/%s", supplierFolder, localFilename)

				// Check if not already exists
				if _, statErr := os.Stat(localFilePath); statErr == nil {
					// Already downloaded, just record progress
					incrementImagesTotal(syncRunID, 1)
					incrementDownloadedImages(syncRunID)
				} else {
					// Needs download
					incrementImagesTotal(syncRunID, 1)
					enqueueDownloadTask(DownloadTask{
						URL:           imgUrl,
						LocalFilePath: localFilePath,
						SyncRunID:     syncRunID,
					})
				}

				insertImgQuery := `
					INSERT INTO catalog.product_images (product_id, image_url, sort_order, is_cover) 
					VALUES ($1, $2, $3, $4)`
				_, _ = db.Pool.Exec(ctx, insertImgQuery, productUUID, dbImageUrl, idx, isCover)
			}
		}
	}

	return isNew, !isNew, variants, nil
}

func getUrlHash(url string) string {
	h := md5.Sum([]byte(url))
	return fmt.Sprintf("%x", h)[:8]
}

func downloadImage(url string, destPath string) error {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
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

	_, err = io.Copy(out, resp.Body)
	return err
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

	// Proactively refresh storefront catalog cache if sync run completes successfully
	if status == "success" {
		log.Printf("[SYNC-%s] Sync succeeded. Triggering concurrent refresh of storefront catalog materialized view...", runID)
		go func() {
			refreshCtx, refreshCancel := context.WithTimeout(context.Background(), 45*time.Second)
			defer refreshCancel()
			_, err := db.Pool.Exec(refreshCtx, "REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products")
			if err != nil {
				log.Printf("[SYNC] Failed to auto-refresh storefront catalog materialized view: %v", err)
			} else {
				log.Println("[SYNC] Storefront catalog materialized view successfully refreshed!")
			}
		}()
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
	
	// Resolve absolute path to the script
	exePath, err := os.Executable()
	if err != nil {
		log.Printf("[SYNC-%s] Failed to get executable path: %v", runID, err)
		updateSyncStatus(runID, "failed", map[string]any{"error": "Failed to get executable path: " + err.Error()})
		return
	}
	exeDir := filepath.Dir(exePath)
	absScriptPath := filepath.Join(exeDir, scriptPath)
	
	// Ensure parser script exists, fallback to local path if not found beside bin
	if _, err := os.Stat(absScriptPath); os.IsNotExist(err) {
		absScriptPath = filepath.Join(".", scriptPath)
		if _, err := os.Stat(absScriptPath); os.IsNotExist(err) {
			log.Printf("[SYNC-%s] Python script not found at %s", runID, scriptPath)
			updateSyncStatus(runID, "failed", map[string]any{"error": "Python script bulunamadı: " + scriptPath})
			return
		}
	}
	
	pythonCmd := "python3"
	if os.PathSeparator == '\\' {
		pythonCmd = "python"
	}
	
	var stderrBuf bytes.Buffer
	cmd := exec.CommandContext(ctx, pythonCmd, absScriptPath, "--sync-run-id", runID, "--production")
	cmd.Env = append(os.Environ(), "SYNC_RUN_ID="+runID)
	cmd.Stderr = &stderrBuf
	
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("[SYNC-%s] Failed to get stdout pipe: %v", runID, err)
	}
	
	if err := cmd.Start(); err != nil {
		log.Printf("[SYNC-%s] Failed to start python cmd: %v. Retrying with 'python'...", runID, err)
		cmd = exec.CommandContext(ctx, "python", absScriptPath, "--sync-run-id", runID, "--production")
		cmd.Env = append(os.Environ(), "SYNC_RUN_ID="+runID)
		cmd.Stderr = &stderrBuf
		stdoutPipe, err = cmd.StdoutPipe()
		if err != nil {
			log.Printf("[SYNC-%s] Failed to get stdout pipe on retry: %v", runID, err)
		}
		if err := cmd.Start(); err != nil {
			log.Printf("[SYNC-%s] Python command execution failed completely: %v", runID, err)
			updateSyncStatus(runID, "failed", map[string]any{"error": "Python script başlatılamadı. Python kurulu olduğundan emin olun."})
			return
		}
	}
	
	if stdoutPipe != nil {
		go func() {
			scanner := bufio.NewScanner(stdoutPipe)
			for scanner.Scan() {
				line := scanner.Text()
				log.Printf("[SYNC-%s-OUT] %s", runID, line)

				// Parse progress: "-> Parsed 100 products... (Added: 10, Updated: 90, Errors: 0)"
				if strings.HasPrefix(line, "-> Parsed ") {
					var parsed, added, updated, errors int
					_, err := fmt.Sscanf(line, "-> Parsed %d products... (Added: %d, Updated: %d, Errors: %d)", &parsed, &added, &updated, &errors)
					if err == nil {
						p := getOrCreateProgress(runID)
						p.mu.Lock()
						p.ItemsParsed = parsed
						p.ItemsAdded = added
						p.ItemsUpdated = updated
						p.ErrorsSkipped = errors
						p.mu.Unlock()
					}
				}

				// Parse download: "-> Downloaded 10/100 images (10%)..."
				if strings.HasPrefix(line, "-> Downloaded ") {
					var downloaded, total, percentage int
					_, err := fmt.Sscanf(line, "-> Downloaded %d/%d images (%d%%)...", &downloaded, &total, &percentage)
					if err == nil {
						p := getOrCreateProgress(runID)
						p.mu.Lock()
						p.ImagesDownloaded = downloaded
						p.ImagesTotal = total
						p.Percentage = percentage
						p.mu.Unlock()
					}
				}
			}
			if err := scanner.Err(); err != nil {
				log.Printf("[SYNC-%s] Scanner error: %v", runID, err)
			}
		}()
	}
	
	// Wait for process to finish
	err = cmd.Wait()
	if err != nil {
		stderrStr := stderrBuf.String()
		log.Printf("[SYNC-%s] Python script exited with error: %v. Stderr: %s", runID, err, stderrStr)
		
		// If the process failed, check if the script recorded success before exiting. If not, mark as failed.
		dbCtx := context.Background() // Use a fresh context since ctx might be canceled
		var exists bool
		_ = db.Pool.QueryRow(dbCtx, "SELECT EXISTS(SELECT 1 FROM integration.sync_runs WHERE id = $1 AND status = 'success')", runID).Scan(&exists)
		if !exists {
			if errors.Is(ctx.Err(), context.Canceled) {
				updateSyncStatus(runID, "failed", map[string]any{"error": "İşlem kullanıcı tarafından durduruldu."})
			} else {
				updateSyncStatus(runID, "failed", map[string]any{"error": "Python hatası: " + stderrStr})
			}
		}
	} else {
		log.Printf("[SYNC-%s] Python script successfully completed!", runID)
		p := getOrCreateProgress(runID)
		p.mu.Lock()
		p.ParsingDone = true
		p.IsCompleted = true
		p.Percentage = 100
		
		summary := map[string]any{
			"items_parsed":        p.ItemsParsed,
			"items_added":         p.ItemsAdded,
			"items_updated":       p.ItemsUpdated,
			"variants_aligned":    p.VariantsAligned,
			"errors_skipped":      p.ErrorsSkipped,
			"images_total":        p.ImagesTotal,
			"images_downloaded":   p.ImagesDownloaded,
			"active_workers":      0,
			"download_speed_kbps": 0,
			"percentage":          100,
		}
		p.mu.Unlock()

		updateSyncStatus(runID, "success", summary)

		// Clean up memory progress map
		progressMu.Lock()
		delete(progressMap, runID)
		progressMu.Unlock()
	}
}

// importStandardizedProduct imports a standard DTO representation of B2B product into DB
func importStandardizedProduct(ctx context.Context, feedID string, brandID *string, syncRunID string, p *StandardizedProduct, categoryMapping map[string]any) (added bool, updated bool, variants int, err error) {
	if p.SourceProductID == "" || p.Title == "" {
		return false, false, 0, fmt.Errorf("missing source product ID or title")
	}

	var seriesRatioPtr *string
	if p.SeriesRatio != "" {
		seriesRatioPtr = &p.SeriesRatio
	}
	var packingRatioPtr *string
	if p.PackingRatio != "" {
		sortedPackingRatio := sortPackingRatioGo(p.PackingRatio)
		packingRatioPtr = &sortedPackingRatio
	}

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

	// Automatically redirect to plus-size category hierarchy if product size is XL or above
	if categoryId != nil && *categoryId != "" && p.PackingRatio != "" && isXlOrAboveGo(p.PackingRatio) {
		plusSizeID := getPlusSizeCategoryEquivalent(ctx, *categoryId)
		if plusSizeID != "" {
			categoryId = &plusSizeID
		}
	}

	// Calculate total stock and extract color-level attributes from first variant
	var firstVar StandardizedVariant
	if len(p.Variants) > 0 {
		firstVar = p.Variants[0]
	}

	var totalStock int
	for _, v := range p.Variants {
		totalStock += v.Stock
	}

	vPrice := firstVar.Price
	vDiscountedPrice := firstVar.DiscountedPrice
	vCurrency := firstVar.Currency
	if vCurrency == "" {
		vCurrency = "TRY"
	}
	vColor := firstVar.Color
	_ = vColor
	vTaxRate := firstVar.TaxRate
	if vTaxRate > 0 && vTaxRate < 1 {
		vTaxRate = vTaxRate * 100
	}
	vSku := firstVar.Sku
	if vSku == "" {
		vSku = p.SKU
	}
	vBarcode := firstVar.Barcode

	// Determine if product exists
	var productUUID string
	err = db.Pool.QueryRow(ctx, "SELECT id FROM catalog.products WHERE feed_id = $1 AND source_product_id = $2", feedID, p.SourceProductID).Scan(&productUUID)

	isNew := false
	if errors.Is(err, pgx.ErrNoRows) {
		isNew = true
		insertQuery := `
			INSERT INTO catalog.products (
				feed_id, source_product_id, source_product_group_id, title, category_id, gender, 
				last_sync_run_id, is_active, brand_id, series_ratio, packing_ratio, 
				shipping_weight_kg, minimum_order_quantity, season,
				price, discounted_price, currency, tax_rate, stock, sku, barcode
			) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) 
			RETURNING id`
		err = db.Pool.QueryRow(ctx, insertQuery, feedID, p.SourceProductID, p.SourceProductGroupID, p.Title, categoryId, p.Gender, syncRunID, brandID, 
			seriesRatioPtr, packingRatioPtr, p.ShippingWeightKg, p.MinimumOrderQuantity, p.Season,
			vPrice, vDiscountedPrice, vCurrency, vTaxRate, totalStock, vSku, vBarcode).Scan(&productUUID)
		if err != nil {
			return false, false, 0, fmt.Errorf("failed to insert product: %w", err)
		}
		added = true
	} else if err != nil {
		return false, false, 0, fmt.Errorf("failed to check product existence: %w", err)
	} else {
		updateQuery := `
			UPDATE catalog.products 
			SET title = $1, category_id = $2, gender = $3, last_sync_run_id = $4, is_active = true, brand_id = $5, 
			    series_ratio = $6, packing_ratio = $7, shipping_weight_kg = $8, minimum_order_quantity = $9, season = $10,
			    source_product_group_id = $11, price = $12, discounted_price = $13, currency = $14, tax_rate = $15, stock = $16, sku = $17, barcode = $18,
			    updated_at = CURRENT_TIMESTAMP 
			WHERE id = $19`
		_, err = db.Pool.Exec(ctx, updateQuery, p.Title, categoryId, p.Gender, syncRunID, brandID, 
			seriesRatioPtr, packingRatioPtr, p.ShippingWeightKg, p.MinimumOrderQuantity, p.Season,
			p.SourceProductGroupID, vPrice, vDiscountedPrice, vCurrency, vTaxRate, totalStock, vSku, vBarcode, productUUID)
		if err != nil {
			return false, false, 0, fmt.Errorf("failed to update product: %w", err)
		}
		updated = true
	}

	// Normalize variants: if none exist, treat product as single variant
	if len(p.Variants) == 0 {
		p.Variants = append(p.Variants, StandardizedVariant{
			Sku:             p.SKU,
			Stock:           99,
			Price:           0.0,
			Currency:        "TRY",
			SourceVariantID: p.SourceProductID,
		})
	}

	// Loop variants
	for _, v := range p.Variants {
		sourceVariantID := v.SourceVariantID
		if sourceVariantID == "" {
			sourceVariantID = v.Sku
			if sourceVariantID == "" {
				sourceVariantID = fmt.Sprintf("%s-%s-%s", p.SourceProductID, slugify(v.Color), slugify(v.Size))
			}
		}

		var variantUUID string
		vErr := db.Pool.QueryRow(ctx, "SELECT id FROM catalog.product_variants WHERE product_id = $1 AND source_variant_id = $2", productUUID, sourceVariantID).Scan(&variantUUID)

		if errors.Is(vErr, pgx.ErrNoRows) {
			insertVarQuery := `
				INSERT INTO catalog.product_variants (product_id, source_variant_id, variant_size, barcode, stock, is_single, last_sync_run_id, is_active) 
				VALUES ($1, $2, $3, $4, $5, $6, $7, true)`
			_, err = db.Pool.Exec(ctx, insertVarQuery, productUUID, sourceVariantID, v.Size, v.Barcode, v.Stock, v.IsSingle, syncRunID)
			if err != nil {
				log.Printf("Failed to insert variant %s: %v", sourceVariantID, err)
			} else {
				variants++
			}
		} else if vErr == nil {
			updateVarQuery := `
				UPDATE catalog.product_variants 
				SET variant_size = $1, barcode = $2, stock = $3, is_single = $4, last_sync_run_id = $5, is_active = true, updated_at = CURRENT_TIMESTAMP 
				WHERE id = $6`
			_, err = db.Pool.Exec(ctx, updateVarQuery, v.Size, v.Barcode, v.Stock, v.IsSingle, syncRunID, variantUUID)
			if err != nil {
				log.Printf("Failed to update variant %s: %v", sourceVariantID, err)
			} else {
				variants++
			}
		}
	}

	// Image downloads
	if len(p.Images) > 0 {
		var supplierAlias string
		_ = db.Pool.QueryRow(ctx, "SELECT alias_code FROM integration.xml_feeds WHERE id = $1", feedID).Scan(&supplierAlias)
		if supplierAlias == "" {
			supplierAlias = feedID
		}
		supplierFolder := strings.ToLower(slugify(supplierAlias))

		uploadDir := filepath.Join("../frontend/uploads/products", supplierFolder)
		if _, err := os.Stat("../../frontend"); err == nil {
			uploadDir = filepath.Join("../../frontend/uploads/products", supplierFolder)
		}

		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			uploadDir = filepath.Join("./uploads/products", supplierFolder)
			_ = os.MkdirAll(uploadDir, 0755)
		}

		var productSlug string
		_ = db.Pool.QueryRow(ctx, "SELECT slug FROM catalog.products WHERE id = $1", productUUID).Scan(&productSlug)
		if productSlug == "" {
			productSlug = slugify(p.Title)
		}

		_, _ = db.Pool.Exec(ctx, "DELETE FROM catalog.product_images WHERE product_id = $1", productUUID)
		for idx, imgUrl := range p.Images {
			if imgUrl != "" {
				isCover := (idx == 0)

				hashPrefix := getUrlHash(imgUrl)
				localFilename := fmt.Sprintf("%s-%s.jpg", productSlug, hashPrefix)
				localFilePath := filepath.Join(uploadDir, localFilename)
				dbImageUrl := fmt.Sprintf("/uploads/products/%s/%s", supplierFolder, localFilename)

				if _, statErr := os.Stat(localFilePath); statErr == nil {
					incrementImagesTotal(syncRunID, 1)
					incrementDownloadedImages(syncRunID)
				} else {
					incrementImagesTotal(syncRunID, 1)
					enqueueDownloadTask(DownloadTask{
						URL:           imgUrl,
						LocalFilePath: localFilePath,
						SyncRunID:     syncRunID,
					})
				}

				insertImgQuery := `
					INSERT INTO catalog.product_images (product_id, image_url, sort_order, is_cover) 
					VALUES ($1, $2, $3, $4)`
				_, _ = db.Pool.Exec(ctx, insertImgQuery, productUUID, dbImageUrl, idx, isCover)
			}
		}
	}

	return isNew, !isNew, variants, nil
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

func (h *IntegrationHandler) ListXMLHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	xmlDir := "./parsers/downloads/xml_history"
	// check if directory exists, if not create it
	if _, err := os.Stat(xmlDir); os.IsNotExist(err) {
		xmlDir = "../admin/backend/parsers/downloads/xml_history"
		if _, err := os.Stat(xmlDir); os.IsNotExist(err) {
			xmlDir = "./admin/backend/parsers/downloads/xml_history"
			if _, err := os.Stat(xmlDir); os.IsNotExist(err) {
				xmlDir = "./backend/parsers/downloads/xml_history"
			}
		}
	}

	_ = os.MkdirAll(xmlDir, 0755)

	files, err := os.ReadDir(xmlDir)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
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

		// parse supplier name from filename (e.g. etika-2026-05-28.xml)
		parts := strings.Split(f.Name(), "-")
		feedID := "unknown"
		supplierName := "Unknown"
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

		// format size
		size := info.Size()
		var formattedSize string
		if size >= 1024*1024 {
			formattedSize = fmt.Sprintf("%.2f MB", float64(size)/(1024*1024))
		} else {
			formattedSize = fmt.Sprintf("%.2f KB", float64(size)/1024)
		}

		history = append(history, XMLHistoryItem{
			Filename:      f.Name(),
			FeedID:        feedID,
			SupplierName:  supplierName,
			SizeBytes:     size,
			FormattedSize: formattedSize,
			CreatedAt:     info.ModTime(),
		})
	}

	// Sort by CreatedAt descending (newest first)
	sort.Slice(history, func(i, j int) bool {
		return history[i].CreatedAt.After(history[j].CreatedAt)
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
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

	xmlDir := "./parsers/downloads/xml_history"
	// check if directory exists
	if _, err := os.Stat(xmlDir); os.IsNotExist(err) {
		xmlDir = "../admin/backend/parsers/downloads/xml_history"
		if _, err := os.Stat(xmlDir); os.IsNotExist(err) {
			xmlDir = "./admin/backend/parsers/downloads/xml_history"
			if _, err := os.Stat(xmlDir); os.IsNotExist(err) {
				xmlDir = "./backend/parsers/downloads/xml_history"
			}
		}
	}

	deletedCount := 0

	// 1. Delete by feed_id
	if req.FeedID != "" {
		files, err := os.ReadDir(xmlDir)
		if err == nil {
			for _, f := range files {
				if f.IsDir() || filepath.Ext(f.Name()) != ".xml" {
					continue
				}
				parts := strings.Split(f.Name(), "-")
				if len(parts) > 0 && (req.FeedID == "all" || parts[0] == req.FeedID) {
					err := os.Remove(filepath.Join(xmlDir, f.Name()))
					if err == nil {
						deletedCount++
					}
				}
			}
		}
	} else if len(req.Filenames) > 0 {
		// 2. Delete specific filenames
		for _, fname := range req.Filenames {
			// secure path traversal
			safeFname := filepath.Base(fname)
			err := os.Remove(filepath.Join(xmlDir, safeFname))
			if err == nil {
				deletedCount++
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"success":true,"deleted_count":%d}`, deletedCount)))
}

var standardSizesMap = map[string]int{
	"XS": 30, "S": 40, "M": 50, "L": 60, "XL": 70, 
	"XXL": 80, "2XL": 80, "XXXL": 90, "3XL": 90, 
	"XXXXL": 100, "4XL": 100, "5XL": 110, "6XL": 120,
	"7XL": 130, "8XL": 140, "STANDART": 500, "STANDARD": 500,
	"3XS": 10, "XXXS": 10, "2XS": 20, "XXS": 20,
}

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

func parseRangeWeightGo(token string) int {
	token = strings.ToUpper(strings.TrimSpace(token))
	if w, ok := standardSizesMap[token]; ok {
		return w
	}
	
	parts := regexp.MustCompile(`[-/_]`).Split(token, -1)
	if len(parts) == 2 {
		part1 := strings.TrimSpace(parts[0])
		part2 := strings.TrimSpace(parts[1])
		
		_, err1 := strconv.Atoi(part1)
		if err1 == nil && strings.HasSuffix(part2, "XL") {
			w1 := parseSingleSizeWeightGo(part1 + "XL")
			w2 := parseSingleSizeWeightGo(part2)
			if w1 < w2 {
				return w1
			}
			return w2
		}
		if err1 == nil && strings.HasSuffix(part2, "XS") {
			w1 := parseSingleSizeWeightGo(part1 + "XS")
			w2 := parseSingleSizeWeightGo(part2)
			if w1 < w2 {
				return w1
			}
			return w2
		}
		
		w1 := parseSingleSizeWeightGo(part1)
		w2 := parseSingleSizeWeightGo(part2)
		if w1 < w2 {
			return w1
		}
		return w2
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

func isXlOrAboveGo(ratio string) bool {
	ratio = strings.TrimSpace(ratio)
	if ratio == "" {
		return false
	}
	
	plusSizeIndicators := map[string]bool{
		"XL": true, "XXL": true, "2XL": true, "XXXL": true, "3XL": true, 
		"XXXXL": true, "4XL": true, "5XL": true, "6XL": true, "7XL": true, "8XL": true,
		"2-3XL": true, "L-XL": true,
	}
	
	parts := strings.Split(ratio, ",")
	for _, p := range parts {
		token := strings.ToUpper(strings.TrimSpace(p))
		if token == "" {
			continue
		}
		if plusSizeIndicators[token] {
			return true
		}
		
		// Split by delimiters to check ranges like S-M,L-XL,2XL-3XL
		subparts := regexp.MustCompile(`[-/_]`).Split(token, -1)
		for _, sp := range subparts {
			sp = strings.TrimSpace(sp)
			if plusSizeIndicators[sp] || strings.HasSuffix(sp, "XL") || (strings.HasSuffix(sp, "XS") && sp != "XS") {
				return true
			}
			for ind := range plusSizeIndicators {
				if strings.Contains(sp, ind) {
					return true
				}
			}
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
