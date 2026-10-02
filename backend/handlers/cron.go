package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/db"
)

type CronHandler struct{}

func NewCronHandler() *CronHandler {
	return &CronHandler{}
}

// Cron database state variables
var (
	cronMutex     sync.Mutex
	cronIsRunning bool
)

// ProvisionCronTables creates cron tables and seeds defaults
func ProvisionCronTables(ctx context.Context) error {
	ddls := []string{
		`CREATE TABLE IF NOT EXISTS integration.cron_settings (
			id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
			is_active BOOLEAN NOT NULL DEFAULT true,
			run_hour INT NOT NULL DEFAULT 23,
			run_minute INT NOT NULL DEFAULT 0,
			last_run_at TIMESTAMP WITH TIME ZONE NULL,
			next_run_at TIMESTAMP WITH TIME ZONE NULL,
			current_status VARCHAR(50) NOT NULL DEFAULT 'idle',
			last_run_status VARCHAR(50) NOT NULL DEFAULT 'never_run',
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			singleton_guard BOOLEAN DEFAULT true UNIQUE CHECK (singleton_guard = true)
		)`,
		`CREATE TABLE IF NOT EXISTS integration.cron_logs (
			id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
			started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			completed_at TIMESTAMP WITH TIME ZONE NULL,
			status VARCHAR(50) NOT NULL,
			summary JSONB NULL
		)`,
		`INSERT INTO integration.cron_settings (is_active, run_hour, run_minute) 
		VALUES (true, 23, 0)
		ON CONFLICT (singleton_guard) DO NOTHING`,
	}

	for _, ddl := range ddls {
		_, err := db.Pool.Exec(ctx, ddl)
		if err != nil {
			return fmt.Errorf("failed to provision DDL: %w", err)
		}
	}
	return nil
}

// StartCronScheduler starts a background ticker to trigger cron job at specified time
func StartCronScheduler() {
	go func() {
		log.Println("[CRON] Background scheduler thread initiated.")
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		var lastCheckedDate string

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			
			// 1. Fetch settings
			var isActive bool
			var runHour, runMinute int
			var currentStatus string
			err := db.Pool.QueryRow(ctx, `
				SELECT is_active, run_hour, run_minute, current_status 
				FROM integration.cron_settings 
				LIMIT 1
			`).Scan(&isActive, &runHour, &runMinute, &currentStatus)
			
			cancel()

			if err != nil {
				continue
			}

			if !isActive {
				continue
			}

			now := time.Now()
			currentDate := now.Format("2006-01-02")

			// Check if we are in the target hour and minute, and haven't run today yet
			if now.Hour() == runHour && now.Minute() == runMinute && lastCheckedDate != currentDate && currentStatus != "running" {
				lastCheckedDate = currentDate
				log.Printf("[CRON] Scheduled time matched (%02d:%02d). Starting cron job pipeline...", runHour, runMinute)
				go runCronPipeline(false)
			}
		}
	}()
}

type SyncedFeedInfo struct {
	FeedID    string `json:"feed_id"`
	FeedName  string `json:"feed_name"`
	SyncRunID string `json:"sync_run_id"`
}

func buildSyncedFeedsDetail(ctx context.Context, runFeeds []SyncedFeedInfo) []map[string]any {
	if len(runFeeds) == 0 {
		return nil
	}
	feedsDetail := []map[string]any{}
	for _, rf := range runFeeds {
		var runStatus string
		var runSummaryBytes []byte
		err := db.Pool.QueryRow(ctx, `
			SELECT status, summary 
			FROM integration.sync_runs 
			WHERE id = $1
		`, rf.SyncRunID).Scan(&runStatus, &runSummaryBytes)

		detail := map[string]any{
			"feed_id":     rf.FeedID,
			"feed_name":   rf.FeedName,
			"sync_run_id": rf.SyncRunID,
			"status":      "unknown",
		}

		if err == nil {
			detail["status"] = runStatus
			if len(runSummaryBytes) > 0 {
				var runSummary map[string]any
				if err := json.Unmarshal(runSummaryBytes, &runSummary); err == nil {
					detail["items_parsed"] = runSummary["items_parsed"]
					detail["items_added"] = runSummary["items_added"]
					detail["items_updated"] = runSummary["items_updated"]
					detail["errors_skipped"] = runSummary["errors_skipped"]
				}
			}
		}
		feedsDetail = append(feedsDetail, detail)
	}
	return feedsDetail
}

func updateCronPipelineLog(ctx context.Context, logID string, status string, errStr string, summary map[string]any, runFeeds []SyncedFeedInfo) {
	if errStr != "" {
		summary["error"] = errStr
	}

	if feedsDetail := buildSyncedFeedsDetail(ctx, runFeeds); feedsDetail != nil {
		summary["synced_feeds"] = feedsDetail
	}

	summaryBytes, _ := json.Marshal(summary)
	_, _ = db.Pool.Exec(ctx, `
		UPDATE integration.cron_logs 
		SET completed_at = CURRENT_TIMESTAMP, status = $1, summary = $2 
		WHERE id = $3
	`, status, summaryBytes, logID)

	_, _ = db.Pool.Exec(ctx, `
		UPDATE integration.cron_settings 
		SET current_status = 'idle', last_run_status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE singleton_guard = true
	`, status)
}

func syncActiveCronFeeds(ctx context.Context) ([]SyncedFeedInfo, error) {
	feedsRows, err := db.Pool.Query(ctx, "SELECT id, feed_name FROM integration.xml_feeds WHERE is_active = true")
	if err != nil {
		return nil, err
	}
	defer feedsRows.Close()

	var activeFeeds []struct {
		ID   string
		Name string
	}
	for feedsRows.Next() {
		var f struct {
			ID   string
			Name string
		}
		if err := feedsRows.Scan(&f.ID, &f.Name); err == nil {
			activeFeeds = append(activeFeeds, f)
		}
	}

	var runFeeds []SyncedFeedInfo
	for _, feed := range activeFeeds {
		log.Printf("[CRON] Running sync for feed: %s (%s)", feed.Name, feed.ID)

		var runID string
		err = db.Pool.QueryRow(ctx, `
			INSERT INTO integration.sync_runs (feed_id, status) 
			VALUES ($1, 'running') 
			RETURNING id
		`, feed.ID).Scan(&runID)
		if err != nil {
			log.Printf("[CRON ERROR] Failed to create sync run for feed %s: %v", feed.ID, err)
			continue
		}

		runFeeds = append(runFeeds, SyncedFeedInfo{
			FeedID:    feed.ID,
			FeedName:  feed.Name,
			SyncRunID: runID,
		})

		simulateBackgroundSync(runID, ctx)
		log.Printf("[CRON] Completed sync for feed %s", feed.ID)
	}
	return runFeeds, nil
}

// runCronPipeline runs the sequence: XML Parser -> Thumbs Image Resizer -> Translations
func runCronPipeline(manual bool) {
	cronMutex.Lock()
	if cronIsRunning {
		cronMutex.Unlock()
		log.Println("[CRON] Pipeline is already running. Skipping trigger.")
		return
	}
	cronIsRunning = true
	cronMutex.Unlock()

	defer func() {
		cronMutex.Lock()
		cronIsRunning = false
		cronMutex.Unlock()
	}()

	ctx := context.Background()

	// 1. Insert log record & Update settings status to 'running'
	var logID string
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO integration.cron_logs (status) 
		VALUES ('running') 
		RETURNING id
	`).Scan(&logID)
	if err != nil {
		log.Printf("[CRON ERROR] Failed to create cron log record: %v", err)
		return
	}

	_, _ = db.Pool.Exec(ctx, `
		UPDATE integration.cron_settings 
		SET current_status = 'running', last_run_at = CURRENT_TIMESTAMP
	`)

	log.Printf("[CRON-%s] Job pipeline started (Manual: %t).", logID, manual)
	startTime := time.Now()

	var runFeeds []SyncedFeedInfo
	summary := map[string]any{
		"manual_trigger":   manual,
		"xml_status":       "pending",
		"image_status":     "pending",
		"translate_status": "pending",
	}

	saveLogs := func(status string, errStr string) {
		updateCronPipelineLog(ctx, logID, status, errStr, summary, runFeeds)
	}

	// ----------------------------------------------------
	// STEP 1: XML PARSER (FEED SYNCHRONIZATION)
	// ----------------------------------------------------
	log.Println("[CRON] STEP 1: Synchronizing active XML feeds...")
	summary["xml_status"] = "running"
	saveLogs("running", "")

	feeds, err := syncActiveCronFeeds(ctx)
	if err != nil {
		log.Printf("[CRON ERROR] Failed to query active feeds: %v", err)
		summary["xml_status"] = "failed"
		saveLogs("failed", "Failed to query active XML feeds")
		return
	}
	runFeeds = feeds
	summary["xml_status"] = "success"
	summary["synced_feeds_count"] = len(runFeeds)

	// ----------------------------------------------------
	// STEP 2: IMAGE THUMBNAIL RESIZING (BULK RESIZER)
	// ----------------------------------------------------
	log.Println("[CRON] STEP 2: Generating missing image thumbnails...")
	summary["image_status"] = "running"
	saveLogs("running", "")

	err = runCronImageResize(ctx)
	if err != nil {
		log.Printf("[CRON ERROR] Image resizing failed: %v", err)
		summary["image_status"] = "failed"
		saveLogs("failed", "Image resizing step failed: "+err.Error())
		return
	}
	summary["image_status"] = "success"

	// ----------------------------------------------------
	// STEP 3: CONCURRENT MULTILINGUAL AI TRANSLATION
	// ----------------------------------------------------
	log.Println("[CRON] STEP 3: Executing pending translations...")
	summary["translate_status"] = "running"
	saveLogs("running", "")

	err = runCronTranslations(ctx)
	if err != nil {
		log.Printf("[CRON ERROR] Translation step failed: %v", err)
		summary["translate_status"] = "failed"
		saveLogs("failed", "Translation step failed: "+err.Error())
		return
	}
	summary["translate_status"] = "success"

	// ----------------------------------------------------
	// FINALIZATION
	// ----------------------------------------------------
	elapsed := time.Since(startTime).Round(time.Second).String()
	summary["elapsed_time"] = elapsed
	log.Printf("[CRON-%s] Job pipeline successfully finished in %s.", logID, elapsed)
	saveLogs("success", "")
}

func collectImageResizeJobs(urls []string, mediaRoot string) []ResizeJob {
	targets := []struct {
		width, height int
		key           string
	}{
		{288, 385, "288x385"},
		{80, 106, "80x106"},
		{600, 800, "600x800"},
	}

	var jobs []ResizeJob
	for _, urlPath := range urls {
		if !strings.HasPrefix(urlPath, "/uploads/") {
			continue
		}
		relPath := strings.TrimPrefix(urlPath, "/uploads/")
		originalPath := filepath.Join(mediaRoot, relPath)

		if _, err := os.Stat(originalPath); os.IsNotExist(err) {
			continue
		}

		for _, target := range targets {
			cachePath := filepath.Join(mediaRoot, "cache", target.key, relPath)
			if _, err := os.Stat(cachePath); os.IsNotExist(err) {
				jobs = append(jobs, ResizeJob{
					OriginalPath: originalPath,
					CachePath:    cachePath,
					Width:        target.width,
					Height:       target.height,
				})
			}
		}
	}
	return jobs
}

func waitForImageResizing() {
	for {
		time.Sleep(3 * time.Second)
		bulkStatus.Lock()
		running := bulkStatus.IsRunning
		completed := bulkStatus.Completed
		failed := bulkStatus.Failed
		total := bulkStatus.TotalJobs
		bulkStatus.Unlock()

		if !running || completed+failed >= total {
			break
		}
	}
}

// runCronImageResize scans and enqueues missing resized sizes, blocking until complete
func runCronImageResize(ctx context.Context) error {
	bulkStatus.Lock()
	if bulkStatus.IsRunning {
		bulkStatus.Unlock()
		return fmt.Errorf("bulk image resizer is already busy")
	}
	bulkStatus.IsRunning = true
	bulkStatus.TotalJobs = 0
	bulkStatus.Completed = 0
	bulkStatus.Failed = 0
	bulkStatus.StartTime = time.Now()
	bulkStatus.ElapsedTime = ""
	bulkStatus.Unlock()

	startWorkerPool()

	for len(jobQueue) > 0 {
		<-jobQueue
	}

	rows, err := db.Pool.Query(ctx, `SELECT DISTINCT image_url FROM catalog.product_images`)
	if err != nil {
		bulkStatus.Lock()
		bulkStatus.IsRunning = false
		bulkStatus.Unlock()
		return err
	}
	defer rows.Close()

	var urls []string
	for rows.Next() {
		var url string
		if err := rows.Scan(&url); err == nil {
			urls = append(urls, url)
		}
	}

	jobs := collectImageResizeJobs(urls, getMediaDir())

	bulkStatus.Lock()
	bulkStatus.TotalJobs = len(jobs)
	if len(jobs) == 0 {
		bulkStatus.IsRunning = false
		bulkStatus.Unlock()
		log.Println("[CRON] No missing images to resize.")
		return nil
	}
	bulkStatus.Unlock()

	for _, job := range jobs {
		jobQueue <- job
	}

	log.Printf("[CRON] Enqueued %d image resizing jobs. Waiting for completion...", len(jobs))
	waitForImageResizing()

	log.Println("[CRON] Bulk image resizing completed successfully!")
	return nil
}

func getTranslationPendingCount(ctx context.Context, table, lang string) (int, error) {
	var totalItems int
	var totalErr error

	switch table {
	case "products":
		totalErr = db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM catalog.products p
			LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
			WHERE p.is_active = true AND (pt.product_id IS NULL OR pt.title = '')`, lang).Scan(&totalItems)
	case "product_descriptions":
		totalErr = db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM catalog.products p
			LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
			WHERE p.is_active = true AND p.description IS NOT NULL AND p.description != '' AND (pt.product_id IS NULL OR pt.description IS NULL OR pt.description = '')`, lang).Scan(&totalItems)
	case "categories":
		totalErr = db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM catalog.categories c
			LEFT JOIN catalog.category_translations ct ON c.id = ct.category_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
			WHERE c.is_active = true AND (ct.category_id IS NULL OR ct.title = '')`, lang).Scan(&totalItems)
	case "attributes":
		totalErr = db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM catalog.attribute_values av
			LEFT JOIN catalog.attribute_value_translations avt ON av.id = avt.attribute_value_id AND (avt.language_code = $1 OR avt.language_code = LEFT($1, 2))
			WHERE avt.attribute_value_id IS NULL`, lang).Scan(&totalItems)
	case "colors":
		totalErr = db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM catalog.colors c
			LEFT JOIN catalog.color_translations ct ON c.id = ct.color_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
			WHERE ct.color_id IS NULL OR ct.color_name = ''`, lang).Scan(&totalItems)
	case "fabrics":
		totalErr = db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM catalog.fabrics f
			LEFT JOIN catalog.fabric_translations ft ON f.id = ft.fabric_id AND (ft.language_code = $1 OR ft.language_code = LEFT($1, 2))
			WHERE ft.fabric_id IS NULL OR ft.fabric_name = ''`, lang).Scan(&totalItems)
	}

	return totalItems, totalErr
}

func runTableTranslation(ctx context.Context, table, lang string, totalItems int) {
	log.Printf("[CRON] Translating table %s for language %s (%d items)...", table, lang, totalItems)

	globalTranslationManager.mu.Lock()
	if globalTranslationManager.state.Status == StatusRunning {
		globalTranslationManager.mu.Unlock()
		log.Printf("[CRON WARNING] Translation manager is busy. Skipping table %s for language %s.", table, lang)
		return
	}

	transCtx, transCancel := context.WithCancel(ctx)
	globalTranslationManager.cancelFunc = transCancel
	globalTranslationManager.activeCtx = transCtx
	globalTranslationManager.state = TranslationJobState{
		Status:       StatusRunning,
		Table:        table,
		Language:     lang,
		TotalItems:   totalItems,
		Processed:    0,
		SuccessCount: 0,
		FailedCount:  0,
		StartTime:    time.Now(),
		Speed:        0,
	}
	globalTranslationManager.logs = []TranslationLog{}
	globalTranslationManager.logIDSeq = 0
	globalTranslationManager.mu.Unlock()

	globalTranslationManager.executeTranslationJob()
	log.Printf("[CRON] Finished translating table %s for language %s", table, lang)
}

// runCronTranslations sequentially translates all tables for active target languages
func runCronTranslations(ctx context.Context) error {
	rows, err := db.Pool.Query(ctx, "SELECT code FROM catalog.languages WHERE is_active = true AND code != 'tr' AND code != 'tr_TR'")
	if err != nil {
		return err
	}
	defer rows.Close()

	var languages []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err == nil {
			languages = append(languages, code)
		}
	}

	tables := []string{"colors", "fabrics", "categories", "attributes", "products", "product_descriptions"}

	for _, lang := range languages {
		for _, table := range tables {
			totalItems, totalErr := getTranslationPendingCount(ctx, table, lang)
			if totalErr != nil {
				log.Printf("[CRON ERROR] Failed to query translation stats for %s/%s: %v", lang, table, totalErr)
				continue
			}

			if totalItems > 0 {
				runTableTranslation(ctx, table, lang, totalItems)
			}
		}
	}
	return nil
}

// GetSettings fetches current cron settings
func (h *CronHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var settings struct {
		ID            string     `json:"id"`
		IsActive      bool       `json:"is_active"`
		RunHour       int        `json:"run_hour"`
		RunMinute     int        `json:"run_minute"`
		LastRunAt     *time.Time `json:"last_run_at"`
		NextRunAt     *time.Time `json:"next_run_at"`
		CurrentStatus string     `json:"current_status"`
		LastRunStatus string     `json:"last_run_status"`
	}

	err := db.Pool.QueryRow(ctx, `
		SELECT id, is_active, run_hour, run_minute, last_run_at, next_run_at, current_status, last_run_status 
		FROM integration.cron_settings 
		LIMIT 1
	`).Scan(
		&settings.ID, &settings.IsActive, &settings.RunHour, &settings.RunMinute,
		&settings.LastRunAt, &settings.NextRunAt, &settings.CurrentStatus, &settings.LastRunStatus,
	)

	if err != nil {
		log.Printf("[CRON ERROR] Failed to fetch cron settings: %v", err)
		http.Error(w, `{"error":"Settings not initialized"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(settings)
}

// UpdateSettings updates cron configuration
func (h *CronHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		IsActive  bool `json:"is_active"`
		RunHour   int  `json:"run_hour"`
		RunMinute int  `json:"run_minute"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.RunHour < 0 || req.RunHour > 23 || req.RunMinute < 0 || req.RunMinute > 59 {
		http.Error(w, `{"error":"Invalid hour/minute parameters"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, `
		UPDATE integration.cron_settings 
		SET is_active = $1, run_hour = $2, run_minute = $3, updated_at = CURRENT_TIMESTAMP
		WHERE singleton_guard = true
	`, req.IsActive, req.RunHour, req.RunMinute)

	if err != nil {
		log.Printf("[CRON ERROR] Failed to update cron settings: %v", err)
		http.Error(w, `{"error":"Database update failed"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true,"message":"Cron settings updated successfully"}`))
}

// TriggerCron manual trigger API
func (h *CronHandler) TriggerCron(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	cronMutex.Lock()
	running := cronIsRunning
	cronMutex.Unlock()

	if running {
		http.Error(w, `{"error":"Cron pipeline is already running"}`, http.StatusConflict)
		return
	}

	go runCronPipeline(true)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true,"message":"Cron pipeline triggered manually in background"}`))
}

// GetLogs fetches past cron job runs
func (h *CronHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT id, started_at, completed_at, status, summary 
		FROM integration.cron_logs 
		ORDER BY started_at DESC 
		LIMIT 50
	`)
	if err != nil {
		log.Printf("[CRON ERROR] Failed to query cron logs: %v", err)
		http.Error(w, `{"error":"Database query failed"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type CronLogItem struct {
		ID          string     `json:"id"`
		StartedAt   time.Time  `json:"started_at"`
		CompletedAt *time.Time `json:"completed_at"`
		Status      string     `json:"status"`
		Summary     any        `json:"summary"`
	}

	var logs []CronLogItem
	for rows.Next() {
		var item CronLogItem
		var summaryBytes []byte
		err := rows.Scan(&item.ID, &item.StartedAt, &item.CompletedAt, &item.Status, &summaryBytes)
		if err == nil {
			if len(summaryBytes) > 0 {
				json.Unmarshal(summaryBytes, &item.Summary)
			}
			logs = append(logs, item)
		}
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(logs)
}

