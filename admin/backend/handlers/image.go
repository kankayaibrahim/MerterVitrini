package handlers

import (
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/deepteams/webp"
	"golang.org/x/image/draw"

	"mertervitrini/admin/backend/db"
)

type ImageHandler struct{}

func NewImageHandler() *ImageHandler {
	return &ImageHandler{}
}

// Allowed dimensions for security (prevents DDoS/resource exhaustion)
var allowedDimensions = map[string]bool{
	"288x385": true,
	"80x106":  true,
	"600x800": true,
}

// Resolve upload/media root directory
func getMediaDir() string {
	if runtime.GOOS == "windows" {
		return "./uploads"
	}
	return "/var/www/media"
}

// ResizeImage handles dynamic, on-the-fly resizing requests
func (h *ImageHandler) ResizeImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	wStr := r.URL.Query().Get("w")
	hStr := r.URL.Query().Get("h")
	relPath := r.URL.Query().Get("path")

	if wStr == "" || hStr == "" || relPath == "" {
		http.Error(w, `{"error":"Missing parameters"}`, http.StatusBadRequest)
		return
	}

	// Clean path to prevent directory traversal
	relPath = filepath.Clean(relPath)
	if strings.Contains(relPath, "..") || strings.HasPrefix(relPath, "/") {
		http.Error(w, `{"error":"Invalid path"}`, http.StatusBadRequest)
		return
	}

	dimensionKey := fmt.Sprintf("%sx%s", wStr, hStr)
	if !allowedDimensions[dimensionKey] {
		http.Error(w, `{"error":"Dimension not allowed"}`, http.StatusBadRequest)
		return
	}

	width, err := strconv.Atoi(wStr)
	if err != nil || width <= 0 {
		http.Error(w, `{"error":"Invalid width"}`, http.StatusBadRequest)
		return
	}

	height, err := strconv.Atoi(hStr)
	if err != nil || height <= 0 {
		http.Error(w, `{"error":"Invalid height"}`, http.StatusBadRequest)
		return
	}

	mediaRoot := getMediaDir()
	originalPath := filepath.Join(mediaRoot, relPath)
	cachePath := filepath.Join(mediaRoot, "cache", dimensionKey, relPath)

	// Check if cached image already exists
	if _, err := os.Stat(cachePath); err == nil {
		w.Header().Set("Content-Type", "image/webp")
		http.ServeFile(w, r, cachePath)
		return
	}

	// Check if original image exists
	if _, err := os.Stat(originalPath); os.IsNotExist(err) {
		http.Error(w, `{"error":"Original image not found"}`, http.StatusNotFound)
		return
	}

	// Resize and save
	err = resizeAndSaveImage(originalPath, cachePath, width, height)
	if err != nil {
		log.Printf("[IMAGE ERROR] Failed to resize image: %v", err)
		http.Error(w, `{"error":"Failed to process image"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "image/webp")
	http.ServeFile(w, r, cachePath)
}

// Atomically resizes image and writes it to path
func resizeAndSaveImage(srcPath, dstPath string, width, height int) error {
	// Open original
	file, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer file.Close()

	// Decode source
	srcImg, _, err := image.Decode(file)
	if err != nil {
		return err
	}

	// Create canvas
	rect := image.Rect(0, 0, width, height)
	dstImg := image.NewRGBA(rect)

	// High-performance scale (assembly-optimized CatmullRom)
	draw.CatmullRom.Scale(dstImg, rect, srcImg, srcImg.Bounds(), draw.Over, nil)

	// Ensure cache directory exists
	err = os.MkdirAll(filepath.Dir(dstPath), 0755)
	if err != nil {
		return err
	}

	// Save to temp file first to make it atomic
	tmpPath := dstPath + ".tmp"
	tmpFile, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer func() {
		tmpFile.Close()
		os.Remove(tmpPath) // Cleanup if not renamed
	}()

	// Encode to WebP
	err = webp.Encode(tmpFile, dstImg, &webp.EncoderOptions{
		Quality: 80,
		Method:  4,
	})
	if err != nil {
		return err
	}

	err = tmpFile.Close()
	if err != nil {
		return err
	}

	// Atomic replace
	return os.Rename(tmpPath, dstPath)
}

// --- Bulk Resize Background Worker ---

type ResizeJob struct {
	OriginalPath string
	CachePath    string
	Width        int
	Height       int
}

var (
	jobQueue   = make(chan ResizeJob, 100000)
	workerOnce sync.Once
	bulkStatus = struct {
		sync.Mutex
		IsRunning   bool      `json:"is_running"`
		TotalJobs   int       `json:"total_jobs"`
		Completed   int       `json:"completed"`
		Failed      int       `json:"failed"`
		StartTime   time.Time `json:"start_time,omitempty"`
		ElapsedTime string    `json:"elapsed_time,omitempty"`
	}{}
)

// Start worker pool (Exactly 4 Goroutines)
func startWorkerPool() {
	workerOnce.Do(func() {
		for i := 0; i < 4; i++ {
			go func(workerID int) {
				for job := range jobQueue {
					bulkStatus.Lock()
					running := bulkStatus.IsRunning
					bulkStatus.Unlock()
					if !running {
						continue
					}

					// Check if already processed
					if _, err := os.Stat(job.CachePath); err == nil {
						bulkStatus.Lock()
						bulkStatus.Completed++
						bulkStatus.Unlock()
						continue
					}

					// Process
					err := resizeAndSaveImage(job.OriginalPath, job.CachePath, job.Width, job.Height)
					bulkStatus.Lock()
					if !bulkStatus.IsRunning {
						bulkStatus.Unlock()
						continue
					}
					if err != nil {
						bulkStatus.Failed++
					} else {
						bulkStatus.Completed++
					}
					// Auto finish status if queue is done
					if bulkStatus.Completed+bulkStatus.Failed >= bulkStatus.TotalJobs {
						bulkStatus.IsRunning = false
					}
					bulkStatus.Unlock()
				}
			}(i)
		}
	})
}

// StartBulkResize scans database and queues missing resized images
func (h *ImageHandler) StartBulkResize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	bulkStatus.Lock()
	if bulkStatus.IsRunning {
		bulkStatus.Unlock()
		http.Error(w, `{"error":"Bulk resize job is already running"}`, http.StatusConflict)
		return
	}

	// Reset status
	bulkStatus.IsRunning = true
	bulkStatus.TotalJobs = 0
	bulkStatus.Completed = 0
	bulkStatus.Failed = 0
	bulkStatus.StartTime = time.Now()
	bulkStatus.ElapsedTime = ""
	bulkStatus.Unlock()

	// Start 4 worker threads
	startWorkerPool()

	// Drain current queue if any
	for len(jobQueue) > 0 {
		<-jobQueue
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
		defer cancel()

		// Fetch all image URLs from catalog
		query := `SELECT DISTINCT image_url FROM catalog.product_images`
		rows, err := db.Pool.Query(ctx, query)
		if err != nil {
			log.Printf("[BULK IMAGE ERROR] Failed to fetch image list: %v", err)
			bulkStatus.Lock()
			bulkStatus.IsRunning = false
			bulkStatus.Unlock()
			return
		}
		defer rows.Close()

		var urls []string
		for rows.Next() {
			var url string
			if err := rows.Scan(&url); err == nil {
				urls = append(urls, url)
			}
		}

		mediaRoot := getMediaDir()
		var jobs []ResizeJob

		// Target dimensions to generate
		targets := []struct {
			width, height int
			key           string
		}{
			{288, 385, "288x385"},
			{80, 106, "80x106"},
			{600, 800, "600x800"},
		}

		for _, urlPath := range urls {
			// e.g. /uploads/products/edusa/...
			if !strings.HasPrefix(urlPath, "/uploads/") {
				continue
			}
			relPath := strings.TrimPrefix(urlPath, "/uploads/")

			originalPath := filepath.Join(mediaRoot, relPath)

			// Verify original exists
			if _, err := os.Stat(originalPath); os.IsNotExist(err) {
				continue
			}

			// Queue for each target size if not already cached
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

		bulkStatus.Lock()
		bulkStatus.TotalJobs = len(jobs)
		if len(jobs) == 0 {
			bulkStatus.IsRunning = false
			bulkStatus.Unlock()
			return
		}
		bulkStatus.Unlock()

		for _, job := range jobs {
			bulkStatus.Lock()
			running := bulkStatus.IsRunning
			bulkStatus.Unlock()
			if !running {
				break
			}
			jobQueue <- job
		}

		log.Printf("[BULK IMAGE] Enqueued %d resizing jobs", len(jobs))
	}()

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"started","message":"Bulk resize task initiated"}`))
}

// GetBulkStatus returns current execution statistics
func (h *ImageHandler) GetBulkStatus(w http.ResponseWriter, r *http.Request) {
	bulkStatus.Lock()
	defer bulkStatus.Unlock()

	if bulkStatus.IsRunning {
		bulkStatus.ElapsedTime = time.Since(bulkStatus.StartTime).Round(time.Second).String()
	}

	w.Header().Set("Content-Type", "application/json")
	jsonBytes := []byte(fmt.Sprintf(
		`{"is_running":%t,"total_jobs":%d,"completed":%d,"failed":%d,"elapsed_time":"%s"}`,
		bulkStatus.IsRunning,
		bulkStatus.TotalJobs,
		bulkStatus.Completed,
		bulkStatus.Failed,
		bulkStatus.ElapsedTime,
	))
	w.Write(jsonBytes)
}

// ScanMissingImages scans the database catalog and checks the file system for missing cached WebP images
func (h *ImageHandler) ScanMissingImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Fetch all image URLs from catalog
	query := `SELECT DISTINCT image_url FROM catalog.product_images`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("[BULK IMAGE ERROR] Failed to fetch image list for scanning: %v", err)
		http.Error(w, `{"error":"Failed to fetch image list"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var urls []string
	for rows.Next() {
		var url string
		if err := rows.Scan(&url); err == nil {
			urls = append(urls, url)
		}
	}

	mediaRoot := getMediaDir()
	missingCount := 0

	// Target dimensions to check
	targets := []string{
		"288x385",
		"80x106",
		"600x800",
	}

	for _, urlPath := range urls {
		if !strings.HasPrefix(urlPath, "/uploads/") {
			continue
		}
		relPath := strings.TrimPrefix(urlPath, "/uploads/")
		originalPath := filepath.Join(mediaRoot, relPath)

		// Verify original exists
		if _, err := os.Stat(originalPath); os.IsNotExist(err) {
			continue
		}

		// Check if resized WebP files exist for each target dimension
		for _, target := range targets {
			cachePath := filepath.Join(mediaRoot, "cache", target, relPath)
			if _, err := os.Stat(cachePath); os.IsNotExist(err) {
				missingCount++
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"missing_count":%d}`, missingCount)))
}

// StopBulkResize stops the active bulk resizing job and drains the job queue
func (h *ImageHandler) StopBulkResize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	bulkStatus.Lock()
	if !bulkStatus.IsRunning {
		bulkStatus.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"not_running","message":"No bulk resize job is currently running"}`))
		return
	}

	// Mark as stopped
	bulkStatus.IsRunning = false
	bulkStatus.Unlock()

	// Drain current queue
	drainedCount := 0
	for len(jobQueue) > 0 {
		select {
		case <-jobQueue:
			drainedCount++
		default:
		}
	}

	log.Printf("[BULK IMAGE] Stopped bulk resizing. Drained %d queued jobs.", drainedCount)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"stopped","message":"Bulk resize task stopped successfully"}`))
}

