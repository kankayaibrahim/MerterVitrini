package main

import (
	"context"
	"encoding/json"
	_ "embed"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"mertervitrini/admin/backend/config"
	"mertervitrini/admin/backend/db"
	"mertervitrini/admin/backend/handlers"
	"mertervitrini/admin/backend/middleware"
)

//go:embed docs/swagger.yaml
var swaggerYAML []byte

//go:embed docs/swagger.html
var swaggerHTML []byte

// DailyLogWriter handles thread-safe daily rotating logging to files named after the date (YYYY-MM-DD.log)
type DailyLogWriter struct {
	mu          sync.Mutex
	logDir      string
	currentFile *os.File
	currentDate string
}

func NewDailyLogWriter(logDir string) (*DailyLogWriter, error) {
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, err
	}
	return &DailyLogWriter{logDir: logDir}, nil
}

func (w *DailyLogWriter) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Format current date as YYYY-MM-DD
	dateStr := time.Now().Format("2006-01-02")

	if dateStr != w.currentDate {
		// Close previous file if it was open
		if w.currentFile != nil {
			w.currentFile.Close()
		}

		// Open/Create new file for the current date
		logPath := filepath.Join(w.logDir, dateStr+".log")
		file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return 0, err
		}
		w.currentFile = file
		w.currentDate = dateStr
	}

	return w.currentFile.Write(p)
}

func (w *DailyLogWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.currentFile != nil {
		err := w.currentFile.Close()
		w.currentFile = nil
		return err
	}
	return nil
}

func main() {
	// 1. Resolve executable directory to place config and logs beside the exe
	exePath, err := os.Executable()
	if err != nil {
		log.Fatalf("Failed to resolve executable path: %v", err)
	}
	exeDir := filepath.Dir(exePath)

	// 2. Initialize daily rotating log writer beside the exe
	logDir := filepath.Join(exeDir, "logs")
	dailyWriter, err := NewDailyLogWriter(logDir)
	if err != nil {
		log.Fatalf("Failed to initialize daily log writer: %v", err)
	}
	defer dailyWriter.Close()

	// Redirect all log prints to standard output and today's daily log file
	log.SetOutput(io.MultiWriter(os.Stdout, dailyWriter))

	log.Println("==================================================")
	log.Println("Merter Vitrini Admin Backend Service Starting...")
	log.Println("==================================================")

	// 3. Load Configurations (automatically looks for config.json beside the exe)
	cfg := config.LoadConfig()

	// 4. Connect to Database
	dbPool, err := db.ConnectDB(cfg)
	if err != nil {
		log.Fatalf("CRITICAL: Failed to connect to PostgreSQL database: %v", err)
	}
	defer db.CloseDB()
	log.Println("Database connection pool established successfully!")

	// 4a. Clean up any stuck 'running' sync runs from database on server startup
	cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cleanupCancel()
	summaryBytes, _ := json.Marshal(map[string]any{"error": "Sunucu yeniden başlatıldığı veya yeni güncelleme yüklendiği için işlem kesintiye uğradı."})
	cleanupRes, cleanupErr := dbPool.Exec(cleanupCtx, "UPDATE integration.sync_runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP, summary = $1 WHERE status = 'running'", summaryBytes)
	if cleanupErr == nil && cleanupRes.RowsAffected() > 0 {
		log.Printf("[CLEANUP] Automatically released %d stuck running sync runs to failed status.\n", cleanupRes.RowsAffected())
	}

	// 4b. Connect to Redis (used for shared live synchronization tracking)
	if cfg.RedisURL != "" {
		_, err = db.ConnectRedis(cfg)
		if err != nil {
			log.Printf("[WARNING] Redis connection failed: %v. Synchronization progress tracking will fall back to Go processes.", err)
		} else {
			defer db.CloseRedis()
		}
	}

	// 5. Initialize Route Handlers
	authHandler := handlers.NewAuthHandler(cfg)
	catalogHandler := handlers.NewCatalogHandler()
	integrationHandler := handlers.NewIntegrationHandler()
	suppliersHandler := handlers.NewSuppliersHandler()
	countriesHandler := handlers.NewCountriesHandler()
	policiesHandler := handlers.NewPoliciesHandler()
	translateHandler := handlers.NewTranslateHandler()
	pagesHandler := handlers.NewPagesHandler()
	blogHandler := handlers.NewBlogHandler()
	indexNowHandler := handlers.NewIndexNowHandler()
	imageHandler := handlers.NewImageHandler()

	// 6. Register HTTP Router using Go 1.22+ enhanced ServeMux pattern
	mux := http.NewServeMux()

	// Health check (Public)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","database":"connected"}`))
	})

	// Identity/Auth Endpoints (Public - v1 Versioned)
	mux.HandleFunc("POST /api/v1/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/v1/auth/verify-otp", authHandler.VerifyOTP)
	mux.HandleFunc("POST /api/v1/auth/keycloak-callback", authHandler.KeycloakCallback)

	// Swagger UI Endpoints (Public)
	mux.HandleFunc("GET /swagger.yaml", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/yaml")
		w.Write(swaggerYAML)
	})
	mux.HandleFunc("GET /docs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(swaggerHTML)
	})
	mux.HandleFunc("GET /swagger/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(swaggerHTML)
	})

	// Protected endpoints (AuthMiddleware required - v1 Versioned)
	authMiddleware := middleware.AuthMiddleware(cfg.JWTSecret, cfg.KeycloakPublicKey)

	// Catalog Endpoints (Protected - v1 Versioned)
	mux.Handle("GET /api/v1/categories", authMiddleware(http.HandlerFunc(catalogHandler.ListCategories)))
	mux.Handle("POST /api/v1/categories", authMiddleware(http.HandlerFunc(catalogHandler.CreateCategory)))
	mux.Handle("PUT /api/v1/categories/{id}", authMiddleware(http.HandlerFunc(catalogHandler.UpdateCategory)))
	mux.Handle("DELETE /api/v1/categories/{id}", authMiddleware(http.HandlerFunc(catalogHandler.DeleteCategory)))
	mux.Handle("GET /api/v1/products", authMiddleware(http.HandlerFunc(catalogHandler.ListProducts)))
	mux.Handle("GET /api/v1/products/{id}", authMiddleware(http.HandlerFunc(catalogHandler.GetProductByID)))
	mux.Handle("POST /api/v1/products/refresh-cache", authMiddleware(http.HandlerFunc(catalogHandler.RefreshProductCache)))
	mux.Handle("GET /api/v1/settings", authMiddleware(http.HandlerFunc(catalogHandler.GetSettings)))
	mux.Handle("PUT /api/v1/settings", authMiddleware(http.HandlerFunc(catalogHandler.UpdateSettings)))

	// Image Cache Management Endpoints (Protected - v1 Versioned)
	mux.Handle("POST /api/v1/store/images/bulk-resize", authMiddleware(http.HandlerFunc(imageHandler.StartBulkResize)))
	mux.Handle("GET /api/v1/store/images/bulk-status", authMiddleware(http.HandlerFunc(imageHandler.GetBulkStatus)))

	// Integration/XML Sync Endpoints (Protected - v1 Versioned)
	mux.Handle("GET /api/v1/feeds", authMiddleware(http.HandlerFunc(integrationHandler.ListFeeds)))
	mux.Handle("POST /api/v1/feeds/{id}/sync", authMiddleware(http.HandlerFunc(integrationHandler.TriggerSync)))
	mux.Handle("POST /api/v1/feeds/{id}/sync/cancel", authMiddleware(http.HandlerFunc(integrationHandler.CancelSync)))
	mux.Handle("GET /api/v1/feeds/{id}/syncs", authMiddleware(http.HandlerFunc(integrationHandler.ListSyncHistory)))
	mux.Handle("DELETE /api/v1/feeds/{id}/syncs", authMiddleware(http.HandlerFunc(integrationHandler.ClearSyncHistory)))
	mux.Handle("POST /api/v1/feeds/preview", authMiddleware(http.HandlerFunc(integrationHandler.PreviewXML)))
	mux.Handle("POST /api/v1/feeds/{id}/mapping", authMiddleware(http.HandlerFunc(integrationHandler.SaveXMLMapping)))
	mux.Handle("GET /api/v1/xml-history", authMiddleware(http.HandlerFunc(integrationHandler.ListXMLHistory)))
	mux.Handle("DELETE /api/v1/xml-history", authMiddleware(http.HandlerFunc(integrationHandler.DeleteXMLHistory)))

	// Supplier/Brand Endpoints (Protected - v1 Versioned)
	mux.Handle("GET /api/v1/suppliers", authMiddleware(http.HandlerFunc(suppliersHandler.ListSuppliers)))
	mux.Handle("POST /api/v1/suppliers", authMiddleware(http.HandlerFunc(suppliersHandler.CreateSupplier)))
	mux.Handle("PUT /api/v1/suppliers/{id}", authMiddleware(http.HandlerFunc(suppliersHandler.UpdateSupplier)))
	mux.Handle("DELETE /api/v1/suppliers/{id}", authMiddleware(http.HandlerFunc(suppliersHandler.DeleteSupplier)))
	mux.Handle("POST /api/v1/suppliers/{id}/feeds", authMiddleware(http.HandlerFunc(suppliersHandler.AddFeedToSupplier)))
	mux.Handle("DELETE /api/v1/feeds/{feed_id}", authMiddleware(http.HandlerFunc(suppliersHandler.DeleteFeed)))
	mux.Handle("POST /api/v1/suppliers/{id}/products/deactivate", authMiddleware(http.HandlerFunc(suppliersHandler.DeactivateSupplierProducts)))
	mux.Handle("DELETE /api/v1/suppliers/{id}/products", authMiddleware(http.HandlerFunc(suppliersHandler.DeleteSupplierProducts)))

	// Geography / Localization Endpoints (Protected - v1 Versioned)
	mux.Handle("GET /api/v1/countries", authMiddleware(http.HandlerFunc(countriesHandler.ListCountries)))
	mux.Handle("POST /api/v1/countries", authMiddleware(http.HandlerFunc(countriesHandler.CreateCountry)))
	mux.Handle("PUT /api/v1/countries/{id}", authMiddleware(http.HandlerFunc(countriesHandler.UpdateCountry)))
	mux.Handle("DELETE /api/v1/countries/{id}", authMiddleware(http.HandlerFunc(countriesHandler.DeleteCountry)))

	mux.Handle("GET /api/v1/countries/{id}/states", authMiddleware(http.HandlerFunc(countriesHandler.ListCountryStates)))
	mux.Handle("POST /api/v1/countries/states", authMiddleware(http.HandlerFunc(countriesHandler.CreateCountryState)))
	mux.Handle("PUT /api/v1/countries/states/{id}", authMiddleware(http.HandlerFunc(countriesHandler.UpdateCountryState)))
	mux.Handle("DELETE /api/v1/countries/states/{id}", authMiddleware(http.HandlerFunc(countriesHandler.DeleteCountryState)))

	mux.Handle("GET /api/v1/country-groups", authMiddleware(http.HandlerFunc(countriesHandler.ListCountryGroups)))
	mux.Handle("POST /api/v1/country-groups", authMiddleware(http.HandlerFunc(countriesHandler.CreateCountryGroup)))
	mux.Handle("PUT /api/v1/country-groups/{id}", authMiddleware(http.HandlerFunc(countriesHandler.UpdateCountryGroup)))
	mux.Handle("DELETE /api/v1/country-groups/{id}", authMiddleware(http.HandlerFunc(countriesHandler.DeleteCountryGroup)))

	// Currencies API routes
	mux.Handle("GET /api/v1/currencies", authMiddleware(http.HandlerFunc(countriesHandler.ListCurrencies)))
	mux.Handle("POST /api/v1/currencies", authMiddleware(http.HandlerFunc(countriesHandler.CreateCurrency)))
	mux.Handle("PUT /api/v1/currencies/{id}", authMiddleware(http.HandlerFunc(countriesHandler.UpdateCurrency)))
	mux.Handle("DELETE /api/v1/currencies/{id}", authMiddleware(http.HandlerFunc(countriesHandler.DeleteCurrency)))

	// Languages API routes
	mux.Handle("GET /api/v1/languages", authMiddleware(http.HandlerFunc(countriesHandler.ListLanguages)))
	mux.Handle("POST /api/v1/languages", authMiddleware(http.HandlerFunc(countriesHandler.CreateLanguage)))
	mux.Handle("PUT /api/v1/languages/{id}", authMiddleware(http.HandlerFunc(countriesHandler.UpdateLanguage)))
	mux.Handle("DELETE /api/v1/languages/{id}", authMiddleware(http.HandlerFunc(countriesHandler.DeleteLanguage)))

	// Legal Policies API routes (Secure Admin & Public Storefront)
	mux.Handle("GET /api/v1/policies", authMiddleware(http.HandlerFunc(policiesHandler.ListPolicies)))
	mux.Handle("GET /api/v1/policies/{type}/history", authMiddleware(http.HandlerFunc(policiesHandler.GetPolicyHistory)))
	mux.Handle("POST /api/v1/policies", authMiddleware(http.HandlerFunc(policiesHandler.CreatePolicyVersion)))
	mux.Handle("POST /api/v1/policies/{id}/activate", authMiddleware(http.HandlerFunc(policiesHandler.ActivatePolicyVersion)))
	mux.HandleFunc("GET /api/v1/store/policies/{type}/active", policiesHandler.GetActivePolicyByType)

	// Custom Pages CMS API routes (Secure Admin)
	mux.Handle("GET /api/v1/pages", authMiddleware(http.HandlerFunc(pagesHandler.ListPages)))
	mux.Handle("GET /api/v1/pages/{id}", authMiddleware(http.HandlerFunc(pagesHandler.GetPageByID)))
	mux.Handle("POST /api/v1/pages", authMiddleware(http.HandlerFunc(pagesHandler.CreatePage)))
	mux.Handle("PUT /api/v1/pages/{id}", authMiddleware(http.HandlerFunc(pagesHandler.UpdatePage)))
	mux.Handle("DELETE /api/v1/pages/{id}", authMiddleware(http.HandlerFunc(pagesHandler.DeletePage)))
	mux.Handle("GET /api/v1/pages/check-slug", authMiddleware(http.HandlerFunc(pagesHandler.CheckSlugUniqueness)))

	// Multilingual Blog API routes (Secure Admin)
	mux.Handle("GET /api/v1/blog", authMiddleware(http.HandlerFunc(blogHandler.ListBlogPosts)))
	mux.Handle("GET /api/v1/blog/{id}", authMiddleware(http.HandlerFunc(blogHandler.GetBlogPostByID)))
	mux.Handle("POST /api/v1/blog", authMiddleware(http.HandlerFunc(blogHandler.CreateBlogPost)))
	mux.Handle("PUT /api/v1/blog/{id}", authMiddleware(http.HandlerFunc(blogHandler.UpdateBlogPost)))
	mux.Handle("DELETE /api/v1/blog/{id}", authMiddleware(http.HandlerFunc(blogHandler.DeleteBlogPost)))
	mux.Handle("GET /api/v1/blog/check-slug", authMiddleware(http.HandlerFunc(blogHandler.CheckSlugUniqueness)))

	// IndexNow API routes (Secure Admin)
	mux.Handle("POST /api/v1/indexnow/submit", authMiddleware(http.HandlerFunc(indexNowHandler.SubmitManual)))

	// Auto-Translation Engine API routes
	mux.Handle("GET /api/v1/translate/stats", authMiddleware(http.HandlerFunc(translateHandler.ListStats)))
	mux.Handle("GET /api/v1/translate/status", authMiddleware(http.HandlerFunc(translateHandler.GetStatus)))
	mux.Handle("POST /api/v1/translate/start", authMiddleware(http.HandlerFunc(translateHandler.StartJob)))
	mux.Handle("POST /api/v1/translate/pause", authMiddleware(http.HandlerFunc(translateHandler.PauseJob)))

	// Customer Management API routes
	customersHandler := handlers.NewCustomersHandler()
	mux.Handle("GET /api/v1/customers", authMiddleware(http.HandlerFunc(customersHandler.ListCustomers)))
	mux.Handle("PUT /api/v1/customers/{id}/block", authMiddleware(http.HandlerFunc(customersHandler.ToggleBlockCustomer)))




	// 7. Wrap global middlewares (CORS & Logging)
	var handler http.Handler = mux
	handler = middleware.LoggingMiddleware(cfg.LogFormat)(handler)
	handler = middleware.CORSMiddleware(handler)

	// 8. Graceful Shutdown & Server Init
	server := &http.Server{
		Addr:         ":" + cfg.ServerPort,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Channel to catch interrupt signals
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Server successfully started on port :%s\n", cfg.ServerPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server failed: %v", err)
		}
	}()

	// Block until signal is received
	<-stopChan
	log.Println("Shutting down admin backend service gracefully...")

	// Context with timeout to give outstanding operations 10s to complete
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	dbPool.Close()
	db.CloseRedis()
	log.Println("Server stopped. Good bye!")
}
