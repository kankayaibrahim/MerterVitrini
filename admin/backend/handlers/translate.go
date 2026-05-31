package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/admin/backend/db"
)

type TranslationStatus string

const (
	StatusIdle      TranslationStatus = "idle"
	StatusRunning   TranslationStatus = "running"
	StatusPaused    TranslationStatus = "paused"
	StatusCompleted TranslationStatus = "completed"
	StatusFailed    TranslationStatus = "failed"
)

type TranslationLog struct {
	ID        int64     `json:"id"`
	Status    string    `json:"status"` // "success" or "error"
	TextIn    string    `json:"text_in"`
	TextOut   string    `json:"text_out,omitempty"`
	ErrorMsg  string    `json:"error_msg,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

type TranslationJobState struct {
	Status       TranslationStatus `json:"status"`
	Table        string            `json:"table"`
	Language     string            `json:"language"`
	TotalItems   int               `json:"total_items"`
	Processed    int               `json:"processed"`
	SuccessCount int               `json:"success_count"`
	FailedCount  int               `json:"failed_count"`
	StartTime    time.Time         `json:"start_time"`
	Speed        float64           `json:"speed"` // items/sec
	ErrorMsg     string            `json:"error_msg,omitempty"`
	Logs         []TranslationLog  `json:"logs,omitempty"`
}

type TranslationManager struct {
	mu         sync.RWMutex
	state      TranslationJobState
	logs       []TranslationLog
	logIDSeq   int64
	cancelFunc context.CancelFunc
	activeCtx  context.Context
	wg         sync.WaitGroup
}

var globalTranslationManager = &TranslationManager{
	state: TranslationJobState{
		Status: StatusIdle,
	},
}

func (m *TranslationManager) addLog(status, textIn, textOut, errMsg string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logIDSeq++
	newLog := TranslationLog{
		ID:        m.logIDSeq,
		Status:    status,
		TextIn:    textIn,
		TextOut:   textOut,
		ErrorMsg:  errMsg,
		Timestamp: time.Now(),
	}

	m.logs = append([]TranslationLog{newLog}, m.logs...) // prepend so latest is first
	if len(m.logs) > 50 {
		m.logs = m.logs[:50] // cap to 50
	}
}

func truncatedText(s string, limit int) string {
	runes := []rune(s)
	if len(runes) > limit {
		return string(runes[:limit]) + "..."
	}
	return s
}

type TranslateHandler struct{}

func NewTranslateHandler() *TranslateHandler {
	return &TranslateHandler{}
}

// =========================================================================
// TRANSLATION API HELPERS
// =========================================================================

type TranslateAPIRequest struct {
	Q      string `json:"q"`
	Source string `json:"source"`
	Target string `json:"target"`
	Format string `json:"format"`
}

type TranslateAPIResponse struct {
	TranslatedText string `json:"translatedText"`
}

func getTranslateAPIConfig() (string, string, string) {
	apiURL := os.Getenv("TRANSLATE_API_URL")
	if apiURL == "" {
		apiURL = "http://localhost:5001/v1/translate"
	}
	apiUser := os.Getenv("TRANSLATE_API_USER")
	if apiUser == "" {
		apiUser = "admin"
	}
	apiPass := os.Getenv("TRANSLATE_API_PASS")
	if apiPass == "" {
		apiPass = "changeme"
	}
	return apiURL, apiUser, apiPass
}

func translateText(ctx context.Context, text, source, target string) (string, error) {
	if text == "" {
		return "", nil
	}

	apiURL, apiUser, apiPass := getTranslateAPIConfig()

	reqPayload := TranslateAPIRequest{
		Q:      text,
		Source: source,
		Target: target,
		Format: "text",
	}

	payloadBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(apiUser, apiPass)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("translate API returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var apiResp TranslateAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return "", err
	}

	return apiResp.TranslatedText, nil
}

// =========================================================================
// HANDLERS
// =========================================================================

type LanguageStat struct {
	Code             string `json:"code"`
	Label            string `json:"label"`
	Flag             string `json:"flag"`
	ProductsCount    int    `json:"products_count"`
	ProductDescCount int    `json:"product_desc_count"`
	CategoriesCount  int    `json:"categories_count"`
	AttributesCount  int    `json:"attributes_count"`
	ColorsCount      int    `json:"colors_count"`
	FabricsCount     int    `json:"fabrics_count"`
}

// ListStats returns the count of missing translations for all active languages
func (h *TranslateHandler) ListStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	// 1. Fetch active languages (except Turkish)
	langQuery := `
		SELECT code, label, flag 
		FROM catalog.languages 
		WHERE is_active = true AND code != 'tr' AND code != 'tr_TR' 
		ORDER BY sort_order ASC, code ASC`

	rows, err := db.Pool.Query(ctx, langQuery)
	if err != nil {
		log.Printf("Failed to query languages for stats: %v", err)
		http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var stats []*LanguageStat
	for rows.Next() {
		var s LanguageStat
		if err := rows.Scan(&s.Code, &s.Label, &s.Flag); err == nil {
			stats = append(stats, &s)
		}
	}

	// 2. Fetch missing translation counts for each active language
	for _, s := range stats {
		// Products missing translations
		prodErr := db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) 
			FROM catalog.products p
			LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
			WHERE p.is_active = true AND (pt.product_id IS NULL OR pt.title = '')`, s.Code).Scan(&s.ProductsCount)
		if prodErr != nil {
			log.Printf("Failed to query product translation stats for %s: %v", s.Code, prodErr)
		}

		// Product descriptions missing translations
		prodDescErr := db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) 
			FROM catalog.products p
			LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
			WHERE p.is_active = true AND p.description IS NOT NULL AND p.description != '' AND (pt.product_id IS NULL OR pt.description IS NULL OR pt.description = '')`, s.Code).Scan(&s.ProductDescCount)
		if prodDescErr != nil {
			log.Printf("Failed to query product description translation stats for %s: %v", s.Code, prodDescErr)
		}

		// Categories missing translations
		catErr := db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) 
			FROM catalog.categories c
			LEFT JOIN catalog.category_translations ct ON c.id = ct.category_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
			WHERE c.is_active = true AND (ct.category_id IS NULL OR ct.title = '')`, s.Code).Scan(&s.CategoriesCount)
		if catErr != nil {
			log.Printf("Failed to query category translation stats for %s: %v", s.Code, catErr)
		}

		// Attributes missing translations (normalized unique values)
		attrErr := db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) 
			FROM catalog.attribute_values av
			LEFT JOIN catalog.attribute_value_translations avt ON av.id = avt.attribute_value_id AND (avt.language_code = $1 OR avt.language_code = LEFT($1, 2))
			WHERE avt.attribute_value_id IS NULL`, s.Code).Scan(&s.AttributesCount)
		if attrErr != nil {
			log.Printf("Failed to query attribute translation stats for %s: %v", s.Code, attrErr)
		}

		// Colors missing translations
		colorErr := db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) 
			FROM catalog.colors c
			LEFT JOIN catalog.color_translations ct ON c.id = ct.color_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
			WHERE ct.color_id IS NULL OR ct.color_name = ''`, s.Code).Scan(&s.ColorsCount)
		if colorErr != nil {
			log.Printf("Failed to query color translation stats for %s: %v", s.Code, colorErr)
		}

		// Fabrics missing translations
		fabricErr := db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) 
			FROM catalog.fabrics f
			LEFT JOIN catalog.fabric_translations ft ON f.id = ft.fabric_id AND (ft.language_code = $1 OR ft.language_code = LEFT($1, 2))
			WHERE ft.fabric_id IS NULL OR ft.fabric_name = ''`, s.Code).Scan(&s.FabricsCount)
		if fabricErr != nil {
			log.Printf("Failed to query fabric translation stats for %s: %v", s.Code, fabricErr)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// GetStatus returns the current active translation job progress
func (h *TranslateHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	globalTranslationManager.mu.Lock()
	defer globalTranslationManager.mu.Unlock()

	// Update speed if job is running
	if globalTranslationManager.state.Status == StatusRunning {
		elapsed := time.Since(globalTranslationManager.state.StartTime).Seconds()
		if elapsed > 0.5 {
			globalTranslationManager.state.Speed = float64(globalTranslationManager.state.Processed) / elapsed
		}
	}

	// Copy and attach logs
	jobStateCopy := globalTranslationManager.state
	jobStateCopy.Logs = globalTranslationManager.logs

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(jobStateCopy)
}

type StartJobRequest struct {
	Table    string `json:"table"`
	Language string `json:"language"`
}

// StartJob spawns the background concurrent translation engine
func (h *TranslateHandler) StartJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req StartJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.Table != "products" && req.Table != "product_descriptions" && req.Table != "categories" && req.Table != "attributes" && req.Table != "colors" && req.Table != "fabrics" {
		http.Error(w, `{"error":"Invalid table parameter. Must be 'products', 'product_descriptions', 'categories', 'attributes', 'colors', or 'fabrics'"}`, http.StatusBadRequest)
		return
	}

	if req.Language == "" || req.Language == "tr" || req.Language == "tr_TR" {
		http.Error(w, `{"error":"Invalid language parameter. Cannot translate to source language 'tr' / 'tr_TR'"}`, http.StatusBadRequest)
		return
	}

	globalTranslationManager.mu.Lock()
	if globalTranslationManager.state.Status == StatusRunning {
		globalTranslationManager.mu.Unlock()
		http.Error(w, `{"error":"A translation job is already running"}`, http.StatusConflict)
		return
	}

	// 1. Fetch missing translation items to compute total size
	dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer dbCancel()

	totalItems := 0
	var totalErr error

	switch req.Table {
	case "products":
		totalErr = db.Pool.QueryRow(dbCtx, `
			SELECT COUNT(*) FROM catalog.products p
			LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
			WHERE p.is_active = true AND (pt.product_id IS NULL OR pt.title = '')`, req.Language).Scan(&totalItems)
	case "product_descriptions":
		totalErr = db.Pool.QueryRow(dbCtx, `
			SELECT COUNT(*) FROM catalog.products p
			LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
			WHERE p.is_active = true AND p.description IS NOT NULL AND p.description != '' AND (pt.product_id IS NULL OR pt.description IS NULL OR pt.description = '')`, req.Language).Scan(&totalItems)
	case "categories":
		totalErr = db.Pool.QueryRow(dbCtx, `
			SELECT COUNT(*) FROM catalog.categories c
			LEFT JOIN catalog.category_translations ct ON c.id = ct.category_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
			WHERE c.is_active = true AND (ct.category_id IS NULL OR ct.title = '')`, req.Language).Scan(&totalItems)
	case "attributes":
		totalErr = db.Pool.QueryRow(dbCtx, `
			SELECT COUNT(*) FROM catalog.attribute_values av
			LEFT JOIN catalog.attribute_value_translations avt ON av.id = avt.attribute_value_id AND (avt.language_code = $1 OR avt.language_code = LEFT($1, 2))
			WHERE avt.attribute_value_id IS NULL`, req.Language).Scan(&totalItems)
	case "colors":
		totalErr = db.Pool.QueryRow(dbCtx, `
			SELECT COUNT(*) FROM catalog.colors c
			LEFT JOIN catalog.color_translations ct ON c.id = ct.color_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
			WHERE ct.color_id IS NULL OR ct.color_name = ''`, req.Language).Scan(&totalItems)
	case "fabrics":
		totalErr = db.Pool.QueryRow(dbCtx, `
			SELECT COUNT(*) FROM catalog.fabrics f
			LEFT JOIN catalog.fabric_translations ft ON f.id = ft.fabric_id AND (ft.language_code = $1 OR ft.language_code = LEFT($1, 2))
			WHERE ft.fabric_id IS NULL OR ft.fabric_name = ''`, req.Language).Scan(&totalItems)
	}

	if totalErr != nil {
		globalTranslationManager.mu.Unlock()
		log.Printf("Failed to count missing items for job start: %v", totalErr)
		http.Error(w, `{"error":"Failed to initialize translation pool"}`, http.StatusInternalServerError)
		return
	}

	if totalItems == 0 {
		globalTranslationManager.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"message":"No missing translations found for this target. Job completed instantly."}`))
		return
	}

	// Initialize thread context and job state
	ctx, cancel := context.WithCancel(context.Background())
	globalTranslationManager.cancelFunc = cancel
	globalTranslationManager.activeCtx = ctx

	globalTranslationManager.state = TranslationJobState{
		Status:       StatusRunning,
		Table:        req.Table,
		Language:     req.Language,
		TotalItems:   totalItems,
		Processed:    0,
		SuccessCount: 0,
		FailedCount:  0,
		StartTime:    time.Now(),
		Speed:        0,
	}
	globalTranslationManager.logs = []TranslationLog{} // Reset logs
	globalTranslationManager.logIDSeq = 0              // Reset sequence ID

	globalTranslationManager.mu.Unlock()

	// 2. Trigger concurrent background translating process
	globalTranslationManager.wg.Add(1)
	go func() {
		defer globalTranslationManager.wg.Done()
		globalTranslationManager.executeTranslationJob()
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(globalTranslationManager.state)
}

// PauseJob stops the background concurrent translation engine gracefully
func (h *TranslateHandler) PauseJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	globalTranslationManager.mu.Lock()
	if globalTranslationManager.state.Status != StatusRunning {
		globalTranslationManager.mu.Unlock()
		http.Error(w, `{"error":"No translation job is currently running"}`, http.StatusBadRequest)
		return
	}

	// Trigger cancellation context to workers
	if globalTranslationManager.cancelFunc != nil {
		globalTranslationManager.cancelFunc()
	}
	globalTranslationManager.state.Status = StatusPaused
	globalTranslationManager.mu.Unlock()

	// Wait for background threads to terminate gracefully
	globalTranslationManager.wg.Wait()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(globalTranslationManager.state)
}

// =========================================================================
// ENGINE IMPLEMENTATION (CONCURRENT WORKER POOL)
// =========================================================================

type TranslationItem struct {
	ID        string
	Value1    string // products: title, categories: title, attributes: name
	Value2    string // products: description, attributes: value
}

func (m *TranslationManager) executeTranslationJob() {
	m.mu.RLock()
	table := m.state.Table
	language := m.state.Language
	ctx := m.activeCtx
	m.mu.RUnlock()

	// 1. Fetch all missing items from the database
	dbCtx, dbCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer dbCancel()

	var rows pgx.Rows
	var err error

	switch table {
	case "products":
		rows, err = db.Pool.Query(dbCtx, `
			SELECT p.id, p.title, ''
			FROM catalog.products p
			LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
			WHERE p.is_active = true AND (pt.product_id IS NULL OR pt.title = '')`, language)
	case "product_descriptions":
		rows, err = db.Pool.Query(dbCtx, `
			SELECT p.id, p.description, p.title
			FROM catalog.products p
			LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
			WHERE p.is_active = true AND p.description IS NOT NULL AND p.description != '' AND (pt.product_id IS NULL OR pt.description IS NULL OR pt.description = '')`, language)
	case "categories":
		rows, err = db.Pool.Query(dbCtx, `
			SELECT c.id, c.title, ''
			FROM catalog.categories c
			LEFT JOIN catalog.category_translations ct ON c.id = ct.category_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
			WHERE c.is_active = true AND (ct.category_id IS NULL OR ct.title = '')`, language)
	case "attributes":
		rows, err = db.Pool.Query(dbCtx, `
			SELECT av.id, a.attribute_name, av.attribute_value
			FROM catalog.attribute_values av
			JOIN catalog.attributes a ON av.attribute_id = a.id
			LEFT JOIN catalog.attribute_value_translations avt ON av.id = avt.attribute_value_id AND (avt.language_code = $1 OR avt.language_code = LEFT($1, 2))
			WHERE avt.attribute_value_id IS NULL`, language)
	case "colors":
		rows, err = db.Pool.Query(dbCtx, `
			SELECT c.id, c.color_name, ''
			FROM catalog.colors c
			LEFT JOIN catalog.color_translations ct ON c.id = ct.color_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
			WHERE ct.color_id IS NULL OR ct.color_name = ''`, language)
	case "fabrics":
		rows, err = db.Pool.Query(dbCtx, `
			SELECT f.id, f.fabric_name, ''
			FROM catalog.fabrics f
			LEFT JOIN catalog.fabric_translations ft ON f.id = ft.fabric_id AND (ft.language_code = $1 OR ft.language_code = LEFT($1, 2))
			WHERE ft.fabric_id IS NULL OR ft.fabric_name = ''`, language)
	}

	if err != nil {
		log.Printf("Translation Job DB Query failed: %v", err)
		m.mu.Lock()
		m.state.Status = StatusFailed
		m.state.ErrorMsg = "Database query failed to fetch translation pool."
		m.mu.Unlock()
		return
	}
	defer rows.Close()

	// Parse items into slice
	var items []TranslationItem
	for rows.Next() {
		var item TranslationItem
		if err := rows.Scan(&item.ID, &item.Value1, &item.Value2); err == nil {
			items = append(items, item)
		}
	}

	if len(items) == 0 {
		m.mu.Lock()
		m.state.Status = StatusCompleted
		m.mu.Unlock()
		return
	}

	// Double-check total count in case of DB sync discrepancy
	m.mu.Lock()
	m.state.TotalItems = len(items)
	m.mu.Unlock()

	// 2. Setup channel and worker pool of exactly 4 goroutines (threads)
	itemsChan := make(chan TranslationItem, len(items))
	for _, item := range items {
		itemsChan <- item
	}
	close(itemsChan)

	numWorkers := 4
	var workerWg sync.WaitGroup

	for i := 0; i < numWorkers; i++ {
		workerWg.Add(1)
		go func() {
			defer workerWg.Done()

			for {
				select {
				case <-ctx.Done():
					// Pause or cancellation requested, exit worker thread gracefully
					return
				case item, ok := <-itemsChan:
					if !ok {
						return // Channel empty, task finished
					}

					// Perform translation & DB commit
					success := m.translateAndSaveItem(ctx, table, language, item)

					// Update thread-safe status stats
					m.mu.Lock()
					m.state.Processed++
					if success {
						m.state.SuccessCount++
					} else {
						m.state.FailedCount++
					}
					m.mu.Unlock()
				}
			}
		}()
	}

	// Wait for all 4 worker threads to terminate
	workerWg.Wait()

	// 3. Finalize Job Status
	m.mu.Lock()
	// If context was canceled, job is Paused. Otherwise, it is Completed!
	if ctx.Err() != nil {
		m.state.Status = StatusPaused
	} else {
		m.state.Status = StatusCompleted
		m.state.Speed = 0
	}
	m.mu.Unlock()
}

func (m *TranslationManager) translateAndSaveItem(ctx context.Context, table, language string, item TranslationItem) bool {
	// Source is always Turkish "tr"
	source := "tr"

	apiTargetLang := language
	if len(apiTargetLang) > 2 {
		apiTargetLang = apiTargetLang[:2]
	}

	switch table {
	case "products":
		// Translate Product Title
		translatedTitle, err := translateText(ctx, item.Value1, source, apiTargetLang)
		if err != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to translate product title %s to %s (API target: %s): %v", item.ID, language, apiTargetLang, err)
			m.addLog("error", item.Value1, "", err.Error())
			return false
		}

		// Save to catalog.product_translations (preserve description)
		dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `
			INSERT INTO catalog.product_translations (product_id, language_code, title, short_description, description)
			VALUES ($1, $2, $3, '', COALESCE((SELECT description FROM catalog.product_translations WHERE product_id = $1 AND language_code = $2::varchar), ''))
			ON CONFLICT (product_id, language_code) 
			DO UPDATE SET title = EXCLUDED.title`
		
		_, dbErr := db.Pool.Exec(dbCtx, query, item.ID, apiTargetLang, translatedTitle)
		if dbErr != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to write product translation to DB: %v", dbErr)
			m.addLog("error", item.Value1, "", dbErr.Error())
			return false
		}

		m.addLog("success", item.Value1, translatedTitle, "")
		return true

	case "product_descriptions":
		// Translate Product Description
		translatedDesc, err := translateText(ctx, item.Value1, source, apiTargetLang)
		if err != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to translate product description %s to %s (API target: %s): %v", item.ID, language, apiTargetLang, err)
			m.addLog("error", fmt.Sprintf("Açıklama (%s)", item.Value2), "", err.Error())
			return false
		}

		// Save to catalog.product_translations (preserve title, fallback to original title if missing translation)
		dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `
			INSERT INTO catalog.product_translations (product_id, language_code, title, short_description, description)
			VALUES ($1, $2, COALESCE((SELECT title FROM catalog.product_translations WHERE product_id = $1 AND language_code = $2::varchar), (SELECT title FROM catalog.products WHERE id = $1)), '', $3)
			ON CONFLICT (product_id, language_code) 
			DO UPDATE SET description = EXCLUDED.description`
		
		_, dbErr := db.Pool.Exec(dbCtx, query, item.ID, apiTargetLang, translatedDesc)
		if dbErr != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to write product description translation to DB: %v", dbErr)
			m.addLog("error", fmt.Sprintf("Açıklama (%s)", item.Value2), "", dbErr.Error())
			return false
		}

		m.addLog("success", fmt.Sprintf("Açıklama (%s)", item.Value2), truncatedText(translatedDesc, 30), "")
		return true

	case "colors":
		// Translate Color Name
		translatedColor, err := translateText(ctx, item.Value1, source, apiTargetLang)
		if err != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to translate color %s to %s (API target: %s): %v", item.ID, language, apiTargetLang, err)
			m.addLog("error", item.Value1, "", err.Error())
			return false
		}

		// Save to catalog.color_translations
		dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `
			INSERT INTO catalog.color_translations (color_id, language_code, color_name)
			VALUES ($1, $2, $3)
			ON CONFLICT (color_id, language_code) 
			DO UPDATE SET color_name = EXCLUDED.color_name`

		_, dbErr := db.Pool.Exec(dbCtx, query, item.ID, apiTargetLang, translatedColor)
		if dbErr != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to write color translation to DB: %v", dbErr)
			m.addLog("error", item.Value1, "", dbErr.Error())
			return false
		}

		m.addLog("success", item.Value1, translatedColor, "")
		return true

	case "fabrics":
		// Translate Fabric Name
		translatedFabric, err := translateText(ctx, item.Value1, source, apiTargetLang)
		if err != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to translate fabric %s to %s (API target: %s): %v", item.ID, language, apiTargetLang, err)
			m.addLog("error", item.Value1, "", err.Error())
			return false
		}

		// Save to catalog.fabric_translations
		dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `
			INSERT INTO catalog.fabric_translations (fabric_id, language_code, fabric_name)
			VALUES ($1, $2, $3)
			ON CONFLICT (fabric_id, language_code) 
			DO UPDATE SET fabric_name = EXCLUDED.fabric_name`

		_, dbErr := db.Pool.Exec(dbCtx, query, item.ID, apiTargetLang, translatedFabric)
		if dbErr != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to write fabric translation to DB: %v", dbErr)
			m.addLog("error", item.Value1, "", dbErr.Error())
			return false
		}

		m.addLog("success", item.Value1, translatedFabric, "")
		return true

	case "categories":
		// Translate Category Title
		translatedTitle, err := translateText(ctx, item.Value1, source, apiTargetLang)
		if err != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to translate category %s to %s (API target: %s): %v", item.ID, language, apiTargetLang, err)
			m.addLog("error", item.Value1, "", err.Error())
			return false
		}

		// Save to catalog.category_translations
		dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `
			INSERT INTO catalog.category_translations (category_id, language_code, title)
			VALUES ($1, $2, $3)
			ON CONFLICT (category_id, language_code) 
			DO UPDATE SET title = EXCLUDED.title`

		_, dbErr := db.Pool.Exec(dbCtx, query, item.ID, apiTargetLang, translatedTitle)
		if dbErr != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to write category translation to DB: %v", dbErr)
			m.addLog("error", item.Value1, "", dbErr.Error())
			return false
		}
		m.addLog("success", item.Value1, translatedTitle, "")
		return true

	case "attributes":
		dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// 1. Check if the attribute name is already translated to target language
		var translatedName string
		nameQuery := `
			SELECT attribute_name FROM catalog.attribute_translations 
			WHERE attribute_id = (SELECT attribute_id FROM catalog.attribute_values WHERE id = $1) AND language_code = $2`
		errName := db.Pool.QueryRow(dbCtx, nameQuery, item.ID, apiTargetLang).Scan(&translatedName)

		if errName != nil || translatedName == "" {
			var err error
			translatedName, err = translateText(ctx, item.Value1, source, apiTargetLang)
			if err != nil {
				log.Printf("[TRANS WORKER ERROR] Failed to translate attribute name '%s' to %s (API target: %s): %v", item.Value1, language, apiTargetLang, err)
				m.addLog("error", item.Value1, "", err.Error())
				return false
			}

			// Save attribute name translation
			_, dbErr := db.Pool.Exec(dbCtx, `
				INSERT INTO catalog.attribute_translations (attribute_id, language_code, attribute_name)
				VALUES ((SELECT attribute_id FROM catalog.attribute_values WHERE id = $1), $2, $3)
				ON CONFLICT (attribute_id, language_code) DO UPDATE SET attribute_name = EXCLUDED.attribute_name`, item.ID, apiTargetLang, translatedName)
			if dbErr != nil {
				log.Printf("[TRANS WORKER ERROR] Failed to write attribute name translation to DB: %v", dbErr)
				m.addLog("error", item.Value1, "", dbErr.Error())
				return false
			}
		}

		// 2. Translate dynamic attribute value
		translatedVal, err := translateText(ctx, item.Value2, source, apiTargetLang)
		if err != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to translate attribute value '%s' to %s (API target: %s): %v", item.Value2, language, apiTargetLang, err)
			m.addLog("error", fmt.Sprintf("%s: %s", item.Value1, item.Value2), "", err.Error())
			return false
		}

		// 3. Save to catalog.attribute_value_translations
		query := `
			INSERT INTO catalog.attribute_value_translations (attribute_value_id, language_code, attribute_value)
			VALUES ($1, $2, $3)
			ON CONFLICT (attribute_value_id, language_code) 
			DO UPDATE SET attribute_value = EXCLUDED.attribute_value`

		_, dbErr := db.Pool.Exec(dbCtx, query, item.ID, apiTargetLang, translatedVal)
		if dbErr != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to write attribute value translation to DB: %v", dbErr)
			m.addLog("error", fmt.Sprintf("%s: %s", item.Value1, item.Value2), "", dbErr.Error())
			return false
		}
		m.addLog("success", fmt.Sprintf("%s: %s", item.Value1, item.Value2), fmt.Sprintf("%s: %s", translatedName, translatedVal), "")
		return true
	}

	return false
}
