package main

import (
	"context"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"mertervitrini/shop/backend/config"
	"mertervitrini/shop/backend/db"
	"mertervitrini/shop/backend/handlers"
	"mertervitrini/shop/backend/middleware"
)

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

	dateStr := time.Now().Format("2006-01-02")

	if dateStr != w.currentDate {
		if w.currentFile != nil {
			w.currentFile.Close()
		}

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

	log.SetOutput(io.MultiWriter(os.Stdout, dailyWriter))

	log.Println("==================================================")
	log.Println("Merter Vitrini Storefront Backend Service Starting...")
	log.Println("==================================================")

	// 3. Load Configurations
	cfg := config.LoadConfig()

	// 4. Connect to Database
	dbPool, err := db.ConnectDB(cfg)
	if err != nil {
		log.Fatalf("CRITICAL: Failed to connect to PostgreSQL database: %v", err)
	}
	defer db.CloseDB()
	log.Println("Database connection pool established successfully!")

	// Start background TCMB daily exchange rates worker
	db.StartRatesWorker(context.Background())

		// 5. Initialize Route Handlers
	catalogHandler := handlers.NewCatalogHandler()
	inquiryHandler := handlers.NewInquiryHandler()
	policiesHandler := handlers.NewPoliciesHandler()
	authHandler := handlers.NewAuthHandler(cfg)
	imageHandler := handlers.NewImageHandler()
	cartHandler := handlers.NewCartHandler()
	ordersHandler := handlers.NewOrdersHandler()

	// 6. Register HTTP Router using Go ServeMux
	mux := http.NewServeMux()

	// Shopping Cart Routes (Authenticated)
	mux.HandleFunc("GET /api/v1/store/cart", cartHandler.GetCart)
	mux.HandleFunc("POST /api/v1/store/cart", cartHandler.AddToCart)
	mux.HandleFunc("POST /api/v1/store/cart/sync", cartHandler.SyncCart)
	mux.HandleFunc("PUT /api/v1/store/cart/items/{item_id}", cartHandler.UpdateCartItem)
	mux.HandleFunc("DELETE /api/v1/store/cart/items/{item_id}", cartHandler.DeleteCartItem)
	mux.HandleFunc("DELETE /api/v1/store/cart", cartHandler.ClearCart)
	mux.HandleFunc("POST /api/v1/store/cart/export-excel", cartHandler.ExportExcel)

	// B2B Order Management Routes (Authenticated)
	mux.HandleFunc("GET /api/v1/store/orders", ordersHandler.ListOrders)
	mux.HandleFunc("GET /api/v1/store/orders/{id}", ordersHandler.GetOrder)
	mux.HandleFunc("POST /api/v1/store/orders", ordersHandler.CreateOrder)
	mux.HandleFunc("POST /api/v1/store/orders/{id}/cancel", ordersHandler.CancelOrder)
	mux.HandleFunc("POST /api/v1/store/orders/{id}/payment-notification", ordersHandler.SubmitPaymentNotification)
	mux.HandleFunc("POST /api/v1/store/orders/{id}/refund", ordersHandler.RequestRefund)
	mux.HandleFunc("GET /api/v1/store/orders/{id}/excel", ordersHandler.ExportExcel)
	mux.HandleFunc("GET /api/v1/store/orders/{id}/images", ordersHandler.DownloadImagesZip)

	// Health Check (Public)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","database":"connected","service":"storefront"}`))
	})

	// Storefront Authentication (Keycloak OIDC Proxy)
	mux.HandleFunc("POST /api/v1/store/auth/register", authHandler.Register)
	mux.HandleFunc("POST /api/v1/store/auth/login", authHandler.Login)
	mux.HandleFunc("GET /api/v1/store/auth/google-callback", authHandler.GoogleCallback)
	mux.HandleFunc("GET /api/v1/store/profile", authHandler.GetProfile)
	mux.HandleFunc("PUT /api/v1/store/profile", authHandler.UpdateProfile)

	// Profile Address Book Management (Authenticated)
	mux.HandleFunc("GET /api/v1/store/profile/addresses", authHandler.ListAddresses)
	mux.HandleFunc("POST /api/v1/store/profile/addresses", authHandler.CreateAddress)
	mux.HandleFunc("PUT /api/v1/store/profile/addresses/{id}", authHandler.UpdateAddress)
	mux.HandleFunc("DELETE /api/v1/store/profile/addresses/{id}", authHandler.DeleteAddress)

	// Location Lookups
	mux.HandleFunc("GET /api/v1/store/locations/countries", authHandler.ListCountries)
	mux.HandleFunc("GET /api/v1/store/locations/countries/{country_id}/states", authHandler.ListStatesByCountry)
	mux.HandleFunc("GET /api/v1/store/locations/states/{state_id}/cities", authHandler.ListCitiesByState)


	// Catalog Storefront Endpoints (Public - v1)
	mux.HandleFunc("GET /api/v1/store/products", catalogHandler.ListProducts)
	mux.HandleFunc("GET /api/v1/store/products/{id}", catalogHandler.GetProductByID)
	mux.HandleFunc("GET /api/v1/store/categories", catalogHandler.ListCategories)
	mux.HandleFunc("GET /api/v1/store/brands", catalogHandler.ListBrands)
	mux.HandleFunc("GET /api/v1/store/attributes", catalogHandler.ListAttributes)
	mux.HandleFunc("GET /api/v1/store/settings", catalogHandler.GetStoreSettings)
	mux.HandleFunc("GET /api/v1/store/languages", catalogHandler.ListLanguages)
	mux.HandleFunc("GET /api/v1/store/exchange-rates", catalogHandler.GetExchangeRates)
	mux.HandleFunc("GET /api/v1/store/policies/{type}/active", policiesHandler.GetActivePolicyByType)
	mux.HandleFunc("GET /api/v1/store/pages/{slug}", catalogHandler.GetPageBySlug)
	mux.HandleFunc("GET /api/v1/store/pages", catalogHandler.ListPages)

	// Multilingual Blog Storefront endpoints
	mux.HandleFunc("GET /api/v1/store/blog", catalogHandler.ListBlogPosts)
	mux.HandleFunc("GET /api/v1/store/blog/{slug}", catalogHandler.GetBlogPostBySlug)

	// Google Merchant Product XML Feed
	mux.HandleFunc("GET /api/v1/store/feeds/google-merchant.xml", catalogHandler.GoogleMerchantFeed)

	// B2B Cart Quote Inquiries (Public - v1)
	mux.HandleFunc("POST /api/v1/store/inquiries", inquiryHandler.SubmitInquiry)

	// Image Resizing & Bulk Pre-generation
	mux.HandleFunc("GET /api/v1/store/images/resize", imageHandler.ResizeImage)
	mux.HandleFunc("POST /api/v1/store/images/bulk-resize", imageHandler.StartBulkResize)
	mux.HandleFunc("GET /api/v1/store/images/bulk-status", imageHandler.GetBulkStatus)
	mux.HandleFunc("GET /api/v1/store/images/scan-missing", imageHandler.ScanMissingImages)
	mux.HandleFunc("POST /api/v1/store/images/bulk-stop", imageHandler.StopBulkResize)

	// 7. Wrap global middlewares (CORS, Rate Limiting & Logging)
	var handler http.Handler = mux
	handler = middleware.LoggingMiddleware(cfg.LogFormat)(handler)
	handler = middleware.RateLimitMiddleware(handler)
	handler = middleware.CORSMiddleware(handler)

	// 8. Graceful Shutdown & Server Init
	server := &http.Server{
		Addr:         ":" + cfg.ServerPort,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Storefront API server successfully started on port :%s\n", cfg.ServerPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server failed: %v", err)
		}
	}()

	<-stopChan
	log.Println("Shutting down storefront backend service gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	dbPool.Close()
	log.Println("Storefront API server stopped. Good bye!")
}
