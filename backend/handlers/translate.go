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
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/safe"

	"github.com/jackc/pgx/v5"
)

type TranslationStatus string

const (
	contentTypeHeader = "Content-Type"
	appJSON           = "application/json"
)

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

	format := "text"
	if strings.Contains(text, "<") && strings.Contains(text, ">") {
		format = "html"
	}

	reqPayload := TranslateAPIRequest{
		Q:      text,
		Source: source,
		Target: target,
		Format: format,
	}

	payloadBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set(contentTypeHeader, appJSON)
	req.SetBasicAuth(apiUser, apiPass)

	resp, err := httpclient.DefaultPooledClient.Do(req)
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

func populateLanguageStat(ctx context.Context, s *LanguageStat) {
	// Products missing translations
	if err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM catalog.products p
		LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
		WHERE p.is_active = true AND (pt.product_id IS NULL OR pt.title = '')`, s.Code).Scan(&s.ProductsCount); err != nil {
		log.Printf("Failed to query product translation stats for %s: %v", s.Code, err)
	}

	// Product descriptions missing translations
	if err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM catalog.products p
		LEFT JOIN catalog.product_translations pt ON p.id = pt.product_id AND (pt.language_code = $1 OR pt.language_code = LEFT($1, 2))
		WHERE p.is_active = true AND p.description IS NOT NULL AND p.description != '' AND (pt.product_id IS NULL OR pt.description IS NULL OR pt.description = '')`, s.Code).Scan(&s.ProductDescCount); err != nil {
		log.Printf("Failed to query product description translation stats for %s: %v", s.Code, err)
	}

	// Categories missing translations
	if err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM catalog.categories c
		LEFT JOIN catalog.category_translations ct ON c.id = ct.category_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
		WHERE c.is_active = true AND (ct.category_id IS NULL OR ct.title = '')`, s.Code).Scan(&s.CategoriesCount); err != nil {
		log.Printf("Failed to query category translation stats for %s: %v", s.Code, err)
	}

	// Attributes missing translations (normalized unique values)
	if err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM catalog.attribute_values av
		LEFT JOIN catalog.attribute_value_translations avt ON av.id = avt.attribute_value_id AND (avt.language_code = $1 OR avt.language_code = LEFT($1, 2))
		WHERE avt.attribute_value_id IS NULL`, s.Code).Scan(&s.AttributesCount); err != nil {
		log.Printf("Failed to query attribute translation stats for %s: %v", s.Code, err)
	}

	// Colors missing translations
	if err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM catalog.colors c
		LEFT JOIN catalog.color_translations ct ON c.id = ct.color_id AND (ct.language_code = $1 OR ct.language_code = LEFT($1, 2))
		WHERE ct.color_id IS NULL OR ct.color_name = ''`, s.Code).Scan(&s.ColorsCount); err != nil {
		log.Printf("Failed to query color translation stats for %s: %v", s.Code, err)
	}

	// Fabrics missing translations
	if err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM catalog.fabrics f
		LEFT JOIN catalog.fabric_translations ft ON f.id = ft.fabric_id AND (ft.language_code = $1 OR ft.language_code = LEFT($1, 2))
		WHERE ft.fabric_id IS NULL OR ft.fabric_name = ''`, s.Code).Scan(&s.FabricsCount); err != nil {
		log.Printf("Failed to query fabric translation stats for %s: %v", s.Code, err)
	}
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
		populateLanguageStat(ctx, s)
	}

	w.Header().Set(contentTypeHeader, appJSON)
	json.NewEncoder(w).Encode(stats)
}

func isTranslationManagerRunning() bool {
	globalTranslationManager.mu.RLock()
	defer globalTranslationManager.mu.RUnlock()
	return globalTranslationManager.state.Status == StatusRunning
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

	w.Header().Set(contentTypeHeader, appJSON)
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
	default:
		totalErr = fmt.Errorf("unsupported translation table: %s", req.Table)
	}

	if totalErr != nil {
		globalTranslationManager.mu.Unlock()
		log.Printf("Failed to count missing items for job start: %v", totalErr)
		http.Error(w, `{"error":"Failed to initialize translation pool"}`, http.StatusInternalServerError)
		return
	}

	if totalItems == 0 {
		globalTranslationManager.mu.Unlock()
		w.Header().Set(contentTypeHeader, appJSON)
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
	safe.Go("Translation Execution Job", func() {
		defer globalTranslationManager.wg.Done()
		globalTranslationManager.executeTranslationJob()
	})

	w.Header().Set(contentTypeHeader, appJSON)
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

	w.Header().Set(contentTypeHeader, appJSON)
	json.NewEncoder(w).Encode(globalTranslationManager.state)
}

// =========================================================================
// ENGINE IMPLEMENTATION (CONCURRENT WORKER POOL)
// =========================================================================

type TranslationItem struct {
	ID     string
	Value1 string // products: title, categories: title, attributes: name
	Value2 string // products: description, attributes: value
}

func fetchMissingTranslationItems(ctx context.Context, table, language string) ([]TranslationItem, error) {
	dbCtx, dbCancel := context.WithTimeout(ctx, 30*time.Second)
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
	default:
		return nil, fmt.Errorf("unsupported translation table: %s", table)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []TranslationItem
	for rows.Next() {
		var item TranslationItem
		if err := rows.Scan(&item.ID, &item.Value1, &item.Value2); err == nil {
			items = append(items, item)
		}
	}
	return items, rows.Err()
}

func (m *TranslationManager) runWorkerPool(ctx context.Context, table, language string, items []TranslationItem) {
	itemsChan := make(chan TranslationItem, len(items))
	for _, item := range items {
		itemsChan <- item
	}
	close(itemsChan)

	numWorkers := 4
	var workerWg sync.WaitGroup

	for i := 0; i < numWorkers; i++ {
		workerWg.Add(1)
		workerIdx := i + 1
		safe.Go(fmt.Sprintf("Translation Worker Thread %d", workerIdx), func() {
			defer workerWg.Done()

			for {
				select {
				case <-ctx.Done():
					return
				case item, ok := <-itemsChan:
					if !ok {
						return
					}

					success := m.translateAndSaveItem(ctx, table, language, item)

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
		})
	}

	workerWg.Wait()
}

func (m *TranslationManager) executeTranslationJob() {
	m.mu.RLock()
	table := m.state.Table
	language := m.state.Language
	ctx := m.activeCtx
	m.mu.RUnlock()

	items, err := fetchMissingTranslationItems(context.Background(), table, language)
	if err != nil {
		log.Printf("Translation Job DB Query failed: %v", err)
		m.mu.Lock()
		m.state.Status = StatusFailed
		m.state.ErrorMsg = "Database query failed to fetch translation pool."
		m.mu.Unlock()
		return
	}

	if len(items) == 0 {
		m.mu.Lock()
		m.state.Status = StatusCompleted
		m.mu.Unlock()
		return
	}

	m.mu.Lock()
	m.state.TotalItems = len(items)
	m.mu.Unlock()

	m.runWorkerPool(ctx, table, language, items)

	m.mu.Lock()
	var completedTable, completedLang string
	var completedSuccess int
	shouldNotify := false
	if ctx.Err() != nil {
		m.state.Status = StatusPaused
	} else {
		m.state.Status = StatusCompleted
		m.state.Speed = 0
		completedTable = m.state.Table
		completedLang = m.state.Language
		completedSuccess = m.state.SuccessCount
		shouldNotify = completedSuccess > 0 && (completedTable == "products" || completedTable == "product_descriptions")
	}
	m.mu.Unlock()

	if shouldNotify && !isCronPipelineRunning() {
		safe.Go("Post-Translation MV Refresh & IndexNow", func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
			defer cancel()
			if mvErr := refreshCatalogMV(bgCtx); mvErr != nil {
				log.Printf("[TRANSLATE-INDEXNOW] MV refresh warning: %v", mvErr)
			}
			_, _ = FlushReadyUnnotifiedProductsToIndexNow(
				bgCtx,
				"translation_complete",
				fmt.Sprintf("Çeviri Tamamlandı (%s / %s)", completedTable, completedLang),
			)
		})
	}
}

func (m *TranslationManager) translateProduct(ctx context.Context, source, target string, item TranslationItem) bool {
	translatedTitle, err := translateText(ctx, item.Value1, source, target)
	if err != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to translate product title %s to %s: %v", item.ID, target, err)
		m.addLog("error", item.Value1, "", err.Error())
		return false
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO catalog.product_translations (product_id, language_code, title, short_description, description)
		VALUES ($1, $2, $3, '', COALESCE((SELECT description FROM catalog.product_translations WHERE product_id = $1 AND language_code = $2::varchar), ''))
		ON CONFLICT (product_id, language_code) 
		DO UPDATE SET title = EXCLUDED.title`

	if _, dbErr := db.Pool.Exec(dbCtx, query, item.ID, target, translatedTitle); dbErr != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to write product translation to DB: %v", dbErr)
		m.addLog("error", item.Value1, "", dbErr.Error())
		return false
	}

	m.addLog("success", item.Value1, translatedTitle, "")
	return true
}

func (m *TranslationManager) translateProductDescription(ctx context.Context, source, target string, item TranslationItem) bool {
	translatedDesc, err := translateText(ctx, item.Value1, source, target)
	if err != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to translate product description %s to %s: %v", item.ID, target, err)
		m.addLog("error", fmt.Sprintf("Açıklama (%s)", item.Value2), "", err.Error())
		return false
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO catalog.product_translations (product_id, language_code, title, short_description, description)
		VALUES ($1, $2, COALESCE((SELECT title FROM catalog.product_translations WHERE product_id = $1 AND language_code = $2::varchar), (SELECT title FROM catalog.products WHERE id = $1)), '', $3)
		ON CONFLICT (product_id, language_code) 
		DO UPDATE SET description = EXCLUDED.description`

	if _, dbErr := db.Pool.Exec(dbCtx, query, item.ID, target, translatedDesc); dbErr != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to write product description translation to DB: %v", dbErr)
		m.addLog("error", fmt.Sprintf("Açıklama (%s)", item.Value2), "", dbErr.Error())
		return false
	}

	m.addLog("success", fmt.Sprintf("Açıklama (%s)", item.Value2), truncatedText(translatedDesc, 30), "")
	return true
}

func (m *TranslationManager) translateColor(ctx context.Context, source, target string, item TranslationItem) bool {
	translatedColor, err := translateText(ctx, item.Value1, source, target)
	if err != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to translate color %s to %s: %v", item.ID, target, err)
		m.addLog("error", item.Value1, "", err.Error())
		return false
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO catalog.color_translations (color_id, language_code, color_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (color_id, language_code) 
		DO UPDATE SET color_name = EXCLUDED.color_name`

	if _, dbErr := db.Pool.Exec(dbCtx, query, item.ID, target, translatedColor); dbErr != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to write color translation to DB: %v", dbErr)
		m.addLog("error", item.Value1, "", dbErr.Error())
		return false
	}

	m.addLog("success", item.Value1, translatedColor, "")
	return true
}

func (m *TranslationManager) translateFabric(ctx context.Context, source, target string, item TranslationItem) bool {
	translatedFabric, err := translateText(ctx, item.Value1, source, target)
	if err != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to translate fabric %s to %s: %v", item.ID, target, err)
		m.addLog("error", item.Value1, "", err.Error())
		return false
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO catalog.fabric_translations (fabric_id, language_code, fabric_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (fabric_id, language_code) 
		DO UPDATE SET fabric_name = EXCLUDED.fabric_name`

	if _, dbErr := db.Pool.Exec(dbCtx, query, item.ID, target, translatedFabric); dbErr != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to write fabric translation to DB: %v", dbErr)
		m.addLog("error", item.Value1, "", dbErr.Error())
		return false
	}

	m.addLog("success", item.Value1, translatedFabric, "")
	return true
}

func (m *TranslationManager) translateCategory(ctx context.Context, source, target string, item TranslationItem) bool {
	translatedTitle, err := translateText(ctx, item.Value1, source, target)
	if err != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to translate category %s to %s: %v", item.ID, target, err)
		m.addLog("error", item.Value1, "", err.Error())
		return false
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO catalog.category_translations (category_id, language_code, title)
		VALUES ($1, $2, $3)
		ON CONFLICT (category_id, language_code) 
		DO UPDATE SET title = EXCLUDED.title`

	if _, dbErr := db.Pool.Exec(dbCtx, query, item.ID, target, translatedTitle); dbErr != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to write category translation to DB: %v", dbErr)
		m.addLog("error", item.Value1, "", dbErr.Error())
		return false
	}

	m.addLog("success", item.Value1, translatedTitle, "")
	return true
}

func (m *TranslationManager) translateAttribute(ctx context.Context, source, language, target string, item TranslationItem) bool {
	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Check if the attribute name is already translated to target language
	var translatedName string
	nameQuery := `
		SELECT attribute_name FROM catalog.attribute_translations 
		WHERE attribute_id = (SELECT attribute_id FROM catalog.attribute_values WHERE id = $1) AND language_code = $2`
	errName := db.Pool.QueryRow(dbCtx, nameQuery, item.ID, target).Scan(&translatedName)

	if errName != nil || translatedName == "" {
		var err error
		translatedName, err = translateText(ctx, item.Value1, source, target)
		if err != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to translate attribute name '%s' to %s: %v", item.Value1, language, err)
			m.addLog("error", item.Value1, "", err.Error())
			return false
		}

		// Save attribute name translation
		query := `
			INSERT INTO catalog.attribute_translations (attribute_id, language_code, attribute_name)
			VALUES ((SELECT attribute_id FROM catalog.attribute_values WHERE id = $1), $2, $3)
			ON CONFLICT (attribute_id, language_code) DO UPDATE SET attribute_name = EXCLUDED.attribute_name`
		if _, dbErr := db.Pool.Exec(dbCtx, query, item.ID, target, translatedName); dbErr != nil {
			log.Printf("[TRANS WORKER ERROR] Failed to write attribute name translation to DB: %v", dbErr)
			m.addLog("error", item.Value1, "", dbErr.Error())
			return false
		}
	}

	// 2. Translate dynamic attribute value
	translatedVal, err := translateText(ctx, item.Value2, source, target)
	if err != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to translate attribute value '%s' to %s: %v", item.Value2, language, err)
		m.addLog("error", fmt.Sprintf("%s: %s", item.Value1, item.Value2), "", err.Error())
		return false
	}

	// 3. Save to catalog.attribute_value_translations
	query := `
		INSERT INTO catalog.attribute_value_translations (attribute_value_id, language_code, attribute_value)
		VALUES ($1, $2, $3)
		ON CONFLICT (attribute_value_id, language_code) 
		DO UPDATE SET attribute_value = EXCLUDED.attribute_value`

	if _, dbErr := db.Pool.Exec(dbCtx, query, item.ID, target, translatedVal); dbErr != nil {
		log.Printf("[TRANS WORKER ERROR] Failed to write attribute value translation to DB: %v", dbErr)
		m.addLog("error", fmt.Sprintf("%s: %s", item.Value1, item.Value2), "", dbErr.Error())
		return false
	}
	m.addLog("success", fmt.Sprintf("%s: %s", item.Value1, item.Value2), fmt.Sprintf("%s: %s", translatedName, translatedVal), "")
	return true
}

func (m *TranslationManager) translateAndSaveItem(ctx context.Context, table, language string, item TranslationItem) bool {
	source := "tr"
	apiTargetLang := language
	if len(apiTargetLang) > 2 {
		apiTargetLang = apiTargetLang[:2]
	}

	switch table {
	case "products":
		return m.translateProduct(ctx, source, apiTargetLang, item)
	case "product_descriptions":
		return m.translateProductDescription(ctx, source, apiTargetLang, item)
	case "colors":
		return m.translateColor(ctx, source, apiTargetLang, item)
	case "fabrics":
		return m.translateFabric(ctx, source, apiTargetLang, item)
	case "categories":
		return m.translateCategory(ctx, source, apiTargetLang, item)
	case "attributes":
		return m.translateAttribute(ctx, source, language, apiTargetLang, item)
	default:
		return false
	}
}

type autoTranslateProductRow struct {
	ID               string
	Title            string
	ShortDescription string
	Description      string
}

type existingProductTranslationRow struct {
	Title            string
	ShortDescription string
	Description      string
}

func normalizeLangCode2(code string) string {
	trimmed := strings.ToLower(strings.TrimSpace(code))
	if trimmed == "" {
		return ""
	}
	if idx := strings.IndexAny(trimmed, "_-"); idx > 0 {
		trimmed = trimmed[:idx]
	}
	if len(trimmed) > 2 {
		trimmed = trimmed[:2]
	}
	return trimmed
}

func dedupeNonEmptyStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(values))
	result := make([]string, 0, len(values))
	for _, v := range values {
		trimmed := strings.TrimSpace(v)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		result = append(result, trimmed)
	}
	return result
}

func loadActiveTargetLanguages2(ctx context.Context) ([]string, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT code
		FROM catalog.languages
		WHERE is_active = true
		  AND code NOT IN ('tr', 'tr_TR')
		ORDER BY sort_order ASC, code ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var raw []string
	for rows.Next() {
		var code string
		if scanErr := rows.Scan(&code); scanErr == nil {
			if lang2 := normalizeLangCode2(code); lang2 != "" && lang2 != "tr" {
				raw = append(raw, lang2)
			}
		}
	}
	return dedupeNonEmptyStrings(raw), rows.Err()
}

func loadAutoTranslateProducts(ctx context.Context, productIDs []string) ([]autoTranslateProductRow, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id::text, title, COALESCE(short_description, ''), COALESCE(description, '')
		FROM catalog.products
		WHERE id = ANY($1::uuid[])
		  AND is_active = true
		  AND COALESCE(is_archived, false) = false`, productIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []autoTranslateProductRow
	for rows.Next() {
		var p autoTranslateProductRow
		if scanErr := rows.Scan(&p.ID, &p.Title, &p.ShortDescription, &p.Description); scanErr == nil {
			products = append(products, p)
		}
	}
	return products, rows.Err()
}

func loadExistingProductTranslationsByLang(ctx context.Context, productID string) (map[string]existingProductTranslationRow, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT language_code, COALESCE(title, ''), COALESCE(short_description, ''), COALESCE(description, '')
		FROM catalog.product_translations
		WHERE product_id = $1::uuid`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byLang := make(map[string]existingProductTranslationRow)
	for rows.Next() {
		var rawCode, t, sd, d string
		if scanErr := rows.Scan(&rawCode, &t, &sd, &d); scanErr != nil {
			continue
		}
		lang2 := normalizeLangCode2(rawCode)
		if lang2 == "" {
			continue
		}
		curr := byLang[lang2]
		if curr.Title == "" && strings.TrimSpace(t) != "" {
			curr.Title = strings.TrimSpace(t)
		}
		if curr.ShortDescription == "" && strings.TrimSpace(sd) != "" {
			curr.ShortDescription = strings.TrimSpace(sd)
		}
		if curr.Description == "" && strings.TrimSpace(d) != "" {
			curr.Description = strings.TrimSpace(d)
		}
		byLang[lang2] = curr
	}
	return byLang, rows.Err()
}

const (
	autoTranslateMaxChunkRunes  = 900
	autoTranslateCallTimeout    = 35 * time.Second
	autoTranslateBreakerLimit   = 3
	autoTranslateBreakerCoolOff = 10 * time.Minute
)

var (
	autoTranslateRunMu         sync.Mutex
	autoTranslateBreakerMu     sync.Mutex
	autoTranslateCooldownUntil time.Time
)

type translateChunkAccumulator struct {
	maxRunes int
	chunks   []string
	cur      strings.Builder
	curRunes int
}

func (a *translateChunkAccumulator) flush() {
	if part := strings.TrimSpace(a.cur.String()); part != "" {
		a.chunks = append(a.chunks, part)
	}
	a.cur.Reset()
	a.curRunes = 0
}

func (a *translateChunkAccumulator) appendOversized(piece string) {
	a.flush()
	runes := []rune(piece)
	for i := 0; i < len(runes); i += a.maxRunes {
		end := min(i+a.maxRunes, len(runes))
		if seg := strings.TrimSpace(string(runes[i:end])); seg != "" {
			a.chunks = append(a.chunks, seg)
		}
	}
}

func (a *translateChunkAccumulator) appendPiece(piece string) {
	pRunes := utf8.RuneCountInString(piece)
	if pRunes > a.maxRunes {
		a.appendOversized(piece)
		return
	}
	if a.curRunes > 0 && a.curRunes+1+pRunes > a.maxRunes {
		a.flush()
	}
	if a.curRunes > 0 {
		a.cur.WriteByte(' ')
		a.curRunes++
	}
	a.cur.WriteString(piece)
	a.curRunes += pRunes
}

func (a *translateChunkAccumulator) appendLine(rawLine string) {
	line := strings.TrimSpace(rawLine)
	if line == "" {
		return
	}
	if utf8.RuneCountInString(line) <= a.maxRunes {
		a.appendPiece(line)
		return
	}
	for _, sent := range strings.SplitAfter(line, ". ") {
		if cleanSent := strings.TrimSpace(sent); cleanSent != "" {
			a.appendPiece(cleanSent)
		}
	}
}

func splitTextIntoTranslateChunks(raw string, maxRunes int) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	if maxRunes <= 0 || utf8.RuneCountInString(trimmed) <= maxRunes {
		return []string{trimmed}
	}

	// Prefer natural paragraph, list, newline, or sentence boundaries
	normalized := strings.ReplaceAll(trimmed, "</p>", "</p>\n")
	normalized = strings.ReplaceAll(normalized, "</li>", "</li>\n")

	acc := &translateChunkAccumulator{maxRunes: maxRunes}
	for _, line := range strings.Split(normalized, "\n") {
		acc.appendLine(line)
	}
	acc.flush()
	return acc.chunks
}

func translateTextChunked(ctx context.Context, text, source, target string) (string, error) {
	chunks := splitTextIntoTranslateChunks(text, autoTranslateMaxChunkRunes)
	if len(chunks) == 0 {
		return "", nil
	}
	if len(chunks) == 1 {
		callCtx, cancel := context.WithTimeout(ctx, autoTranslateCallTimeout)
		defer cancel()
		return translateText(callCtx, chunks[0], source, target)
	}

	var out []string
	for idx, chunk := range chunks {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		if idx > 0 {
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(150 * time.Millisecond):
			}
		}
		callCtx, cancel := context.WithTimeout(ctx, autoTranslateCallTimeout)
		part, err := translateText(callCtx, chunk, source, target)
		cancel()
		if err != nil {
			return "", err
		}
		if cleanPart := strings.TrimSpace(part); cleanPart != "" {
			out = append(out, cleanPart)
		}
	}
	return strings.Join(out, " "), nil
}

func translateFieldIfMissing(ctx context.Context, sourceText, existingTarget, targetLang string) (string, bool) {
	if strings.TrimSpace(existingTarget) != "" {
		return existingTarget, false
	}
	trimmedSrc := strings.TrimSpace(sourceText)
	if trimmedSrc == "" {
		return "", false
	}
	translated, err := translateTextChunked(ctx, trimmedSrc, "tr", targetLang)
	if err != nil {
		log.Printf("[AUTO-TRANSLATE] Translate '%s'->'%s' warning: %v", "tr", targetLang, err)
		return "", true
	}
	return strings.TrimSpace(translated), false
}

func upsertSingleProductTranslation(ctx context.Context, productID, lang2, title, shortDesc, desc string) error {
	dbCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(dbCtx, `
		INSERT INTO catalog.product_translations (product_id, language_code, title, short_description, description)
		VALUES ($1::uuid, $2, $3, $4, $5)
		ON CONFLICT (product_id, language_code) DO UPDATE SET
			title = CASE WHEN COALESCE(EXCLUDED.title, '') != '' THEN EXCLUDED.title ELSE catalog.product_translations.title END,
			short_description = CASE WHEN COALESCE(EXCLUDED.short_description, '') != '' THEN EXCLUDED.short_description ELSE catalog.product_translations.short_description END,
			description = CASE WHEN COALESCE(EXCLUDED.description, '') != '' THEN EXCLUDED.description ELSE catalog.product_translations.description END`,
		productID, lang2, title, shortDesc, desc)
	return err
}

func translateSingleProductLang(
	ctx context.Context,
	prod autoTranslateProductRow,
	lang2 string,
	existingMap map[string]existingProductTranslationRow,
) (int, bool) {
	existing := existingMap[lang2]
	nextTitle, errTitle := translateFieldIfMissing(ctx, prod.Title, existing.Title, lang2)
	if errTitle {
		return 0, true
	}
	nextDesc, errDesc := translateFieldIfMissing(ctx, prod.Description, existing.Description, lang2)
	nextShort, errShort := translateFieldIfMissing(ctx, prod.ShortDescription, existing.ShortDescription, lang2)

	if nextTitle == "" {
		return 0, errDesc || errShort
	}
	if nextTitle == existing.Title && nextDesc == existing.Description && nextShort == existing.ShortDescription {
		return 0, false
	}
	if err := upsertSingleProductTranslation(ctx, prod.ID, lang2, nextTitle, nextShort, nextDesc); err != nil {
		log.Printf("[AUTO-TRANSLATE ERROR] Failed to write %s/%s: %v", prod.ID, lang2, err)
		return 0, false
	}
	return 1, errDesc || errShort
}

func isAutoTranslateCoolingDown() bool {
	autoTranslateBreakerMu.Lock()
	cooldownUntil := autoTranslateCooldownUntil
	autoTranslateBreakerMu.Unlock()
	return time.Now().Before(cooldownUntil)
}

func tripAutoTranslateCircuitBreaker(consecutiveFailures int) {
	autoTranslateBreakerMu.Lock()
	autoTranslateCooldownUntil = time.Now().Add(autoTranslateBreakerCoolOff)
	autoTranslateBreakerMu.Unlock()
	log.Printf("[AUTO-TRANSLATE] Circuit breaker opened for %v after %d consecutive translate timeouts.", autoTranslateBreakerCoolOff, consecutiveFailures)
}

func translateProductTargetLangs(ctx context.Context, prod autoTranslateProductRow, targetLangs []string, consecutiveFailures *int) (int, bool, error) {
	existingMap, mapErr := loadExistingProductTranslationsByLang(ctx, prod.ID)
	if mapErr != nil {
		log.Printf("[AUTO-TRANSLATE] Existing map error for %s: %v", prod.ID, mapErr)
		return 0, false, nil
	}

	translatedCount := 0
	for _, lang2 := range targetLangs {
		if ctx.Err() != nil {
			return translatedCount, false, ctx.Err()
		}
		written, hadFailure := translateSingleProductLang(ctx, prod, lang2, existingMap)
		translatedCount += written
		if hadFailure {
			*consecutiveFailures++
			if *consecutiveFailures >= autoTranslateBreakerLimit {
				tripAutoTranslateCircuitBreaker(*consecutiveFailures)
				return translatedCount, true, nil
			}
		} else if written > 0 {
			*consecutiveFailures = 0
		}
	}
	return translatedCount, false, nil
}

// AutoTranslateProductsByIDs translates missing title/short_description/description fields into all active target languages.
func AutoTranslateProductsByIDs(ctx context.Context, productIDs []string) (int, error) {
	if db.Pool == nil {
		return 0, nil
	}
	cleanIDs := dedupeNonEmptyStrings(productIDs)
	if len(cleanIDs) == 0 || isAutoTranslateCoolingDown() {
		return 0, nil
	}
	if !autoTranslateRunMu.TryLock() {
		return 0, nil
	}
	defer autoTranslateRunMu.Unlock()

	targetLangs, err := loadActiveTargetLanguages2(ctx)
	if err != nil || len(targetLangs) == 0 {
		return 0, err
	}

	products, err := loadAutoTranslateProducts(ctx, cleanIDs)
	if err != nil {
		return 0, err
	}

	translatedCount := 0
	consecutiveFailures := 0
	for _, prod := range products {
		if ctx.Err() != nil {
			return translatedCount, ctx.Err()
		}
		written, tripped, prodErr := translateProductTargetLangs(ctx, prod, targetLangs, &consecutiveFailures)
		translatedCount += written
		if prodErr != nil {
			return translatedCount, prodErr
		}
		if tripped {
			return translatedCount, nil
		}
	}
	return translatedCount, nil
}
