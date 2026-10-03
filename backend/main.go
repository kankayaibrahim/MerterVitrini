package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/handlers"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/pkg/logger"
	"mertervitrini/backend/pkg/safe"
)

//go:embed docs/swagger.yaml
var swaggerYAML []byte

//go:embed docs/swagger.html
var swaggerHTML []byte

const headerContentType = "Content-Type"

func main() {
	// 1. Initialize centralized daily rotating file logger (both main log and error log)
	logDir, err := logger.Init("")
	if err != nil {
		log.Printf("Warning: Failed to initialize file logger: %v\n", err)
	}
	defer logger.Close()

	log.Println("==================================================")
	log.Println("Merter Vitrini Unified Backend Service Starting...")
	log.Printf("Active File Log Directory: %s\n", logDir)
	log.Println("==================================================")

	// 3. Load Configurations
	cfg := config.LoadConfig()

	// 4. Connect to PostgreSQL Database
	dbPool, err := db.ConnectDB(cfg)
	if err != nil {
		log.Fatalf("CRITICAL: Failed to connect to PostgreSQL database: %v", err)
	}
	defer db.CloseDB()
	log.Println("Database connection pool established successfully!")

	// 4a. Connect to Redis (optional shared synchronization & caching)
	if cfg.RedisURL != "" {
		_, err = db.ConnectRedis(cfg)
		if err != nil {
			log.Printf("[WARNING] Redis connection failed: %v. Synchronization progress tracking will fall back to Go processes.", err)
		} else {
			defer db.CloseRedis()
		}
	}

	// 4b. Provision Cron Tables and Start Scheduler
	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()

	cronInitCtx, cronInitCancel := context.WithTimeout(context.Background(), 10*time.Second)
	if err := handlers.ProvisionCronTables(cronInitCtx); err != nil {
		log.Printf("[WARNING] Failed to provision cron tables: %v\n", err)
	} else {
		log.Println("Cron scheduler database tables successfully provisioned/verified!")
		handlers.StartCronScheduler(appCtx)
	}
	cronInitCancel()

	// 4c. Clean up any stuck 'running' sync runs from database on server startup
	cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
	summaryBytes, _ := json.Marshal(map[string]any{"error": "Sunucu yeniden başlatıldığı için işlem kesintiye uğradı."})
	cleanupRes, cleanupErr := dbPool.Exec(cleanupCtx, "UPDATE integration.sync_runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP, summary = $1 WHERE status = 'running'", summaryBytes)
	if cleanupErr == nil && cleanupRes.RowsAffected() > 0 {
		log.Printf("[CLEANUP] Automatically released %d stuck running sync runs to failed status.\n", cleanupRes.RowsAffected())
	}
	cleanupCancel()

	// 4d. Start background TCMB daily exchange rates worker
	db.StartRatesWorker(appCtx)

	// 5. Initialize Route Handlers
	// Storefront Handlers
	storeCatalogHandler := handlers.NewStoreCatalogHandler()
	storeCartHandler := handlers.NewCartHandler()
	storeOrdersHandler := handlers.NewStoreOrdersHandler()
	storeAuthHandler := handlers.NewStoreAuthHandler(cfg)
	storeInquiryHandler := handlers.NewInquiryHandler()

	// Admin Handlers
	adminAuthHandler := handlers.NewAdminAuthHandler(cfg)
	adminCatalogHandler := handlers.NewAdminCatalogHandler()
	adminOrdersHandler := handlers.NewAdminOrdersHandler(cfg)
	integrationHandler := handlers.NewIntegrationHandler()
	suppliersHandler := handlers.NewSuppliersHandler()
	countriesHandler := handlers.NewCountriesHandler()
	policiesHandler := handlers.NewPoliciesHandler()
	translateHandler := handlers.NewTranslateHandler()
	pagesHandler := handlers.NewPagesHandler()
	blogHandler := handlers.NewBlogHandler()
	indexNowHandler := handlers.NewIndexNowHandler()
	imageHandler := handlers.NewImageHandler()
	cronHandler := handlers.NewCronHandler()
	customersHandler := handlers.NewCustomersHandler(cfg)

	// 6. Register HTTP Router using Go 1.22+ ServeMux
	mux := http.NewServeMux()

	// Health Check (Public)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(headerContentType, "application/json")
		w.Write([]byte(`{"status":"healthy","database":"connected","service":"unified-backend"}`))
	})

	// Swagger UI Endpoints (Public)
	mux.HandleFunc("GET /swagger.yaml", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(headerContentType, "text/yaml")
		w.Write(swaggerYAML)
	})
	mux.HandleFunc("GET /docs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(headerContentType, "text/html; charset=utf-8")
		w.Write(swaggerHTML)
	})
	mux.HandleFunc("GET /swagger/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(headerContentType, "text/html; charset=utf-8")
		w.Write(swaggerHTML)
	})

	// ==========================================
	// STOREFRONT ROUTES (/api/v1/store/...)
	// ==========================================

	// Shopping Cart Routes (Authenticated Storefront)
	mux.HandleFunc("GET /api/v1/store/cart", storeCartHandler.GetCart)
	mux.HandleFunc("POST /api/v1/store/cart", storeCartHandler.AddToCart)
	mux.HandleFunc("POST /api/v1/store/cart/sync", storeCartHandler.SyncCart)
	mux.HandleFunc("PUT /api/v1/store/cart/items/{item_id}", storeCartHandler.UpdateCartItem)
	mux.HandleFunc("DELETE /api/v1/store/cart/items/{item_id}", storeCartHandler.DeleteCartItem)
	mux.HandleFunc("DELETE /api/v1/store/cart", storeCartHandler.ClearCart)
	mux.HandleFunc("POST /api/v1/store/cart/export-excel", storeCartHandler.ExportExcel)

	// B2B Store Orders (Authenticated Storefront)
	mux.HandleFunc("GET /api/v1/store/orders", storeOrdersHandler.ListOrders)
	mux.HandleFunc("GET /api/v1/store/orders/{id}", storeOrdersHandler.GetOrder)
	mux.HandleFunc("POST /api/v1/store/orders", storeOrdersHandler.CreateOrder)
	mux.HandleFunc("POST /api/v1/store/orders/{id}/cancel", storeOrdersHandler.CancelOrder)
	mux.HandleFunc("POST /api/v1/store/orders/{id}/payment-notification", storeOrdersHandler.SubmitPaymentNotification)
	mux.HandleFunc("POST /api/v1/store/orders/{id}/refund", storeOrdersHandler.RequestRefund)
	mux.HandleFunc("GET /api/v1/store/orders/{id}/excel", storeOrdersHandler.ExportExcel)
	mux.HandleFunc("GET /api/v1/store/orders/{id}/images", storeOrdersHandler.DownloadImagesZip)

	// Storefront Authentication & Profile
	mux.HandleFunc("POST /api/v1/store/auth/register", storeAuthHandler.Register)
	mux.HandleFunc("POST /api/v1/store/auth/login", storeAuthHandler.Login)
	mux.HandleFunc("GET /api/v1/store/auth/google-callback", storeAuthHandler.GoogleCallback)
	mux.HandleFunc("GET /api/v1/store/profile", storeAuthHandler.GetProfile)
	mux.HandleFunc("PUT /api/v1/store/profile", storeAuthHandler.UpdateProfile)
	mux.HandleFunc("GET /api/v1/store/profile/addresses", storeAuthHandler.ListAddresses)
	mux.HandleFunc("POST /api/v1/store/profile/addresses", storeAuthHandler.CreateAddress)
	mux.HandleFunc("PUT /api/v1/store/profile/addresses/{id}", storeAuthHandler.UpdateAddress)
	mux.HandleFunc("DELETE /api/v1/store/profile/addresses/{id}", storeAuthHandler.DeleteAddress)

	// Location Lookups
	mux.HandleFunc("GET /api/v1/store/locations/countries", storeAuthHandler.ListCountries)
	mux.HandleFunc("GET /api/v1/store/locations/countries/{country_id}/states", storeAuthHandler.ListStatesByCountry)
	mux.HandleFunc("GET /api/v1/store/locations/states/{state_id}/cities", storeAuthHandler.ListCitiesByState)

	// Catalog Storefront Endpoints (Public)
	mux.HandleFunc("GET /api/v1/store/products", storeCatalogHandler.ListProducts)
	mux.HandleFunc("GET /api/v1/store/products/{id}", storeCatalogHandler.GetProductByID)
	mux.HandleFunc("GET /api/v1/store/categories", storeCatalogHandler.ListCategories)
	mux.HandleFunc("GET /api/v1/store/brands", storeCatalogHandler.ListBrands)
	mux.HandleFunc("GET /api/v1/store/attributes", storeCatalogHandler.ListAttributes)
	mux.HandleFunc("GET /api/v1/store/settings", storeCatalogHandler.GetStoreSettings)
	mux.HandleFunc("GET /api/v1/store/languages", storeCatalogHandler.ListLanguages)
	mux.HandleFunc("GET /api/v1/store/exchange-rates", storeCatalogHandler.GetExchangeRates)
	mux.HandleFunc("GET /api/v1/store/policies/{type}/active", policiesHandler.GetActivePolicyByType)
	mux.HandleFunc("GET /api/v1/store/pages/{slug}", storeCatalogHandler.GetPageBySlug)
	mux.HandleFunc("GET /api/v1/store/pages", storeCatalogHandler.ListPages)
	mux.HandleFunc("GET /api/v1/store/blog", storeCatalogHandler.ListBlogPosts)
	mux.HandleFunc("GET /api/v1/store/blog/{slug}", storeCatalogHandler.GetBlogPostBySlug)
	mux.HandleFunc("GET /api/v1/store/feeds/google-merchant.xml", storeCatalogHandler.GoogleMerchantFeed)

	// B2B Cart Quote Inquiries
	mux.HandleFunc("POST /api/v1/store/inquiries", storeInquiryHandler.SubmitInquiry)

	// Image Resizing & Pre-generation
	mux.HandleFunc("GET /api/v1/store/images/resize", imageHandler.ResizeImage)
	mux.HandleFunc("POST /api/v1/store/images/bulk-resize", imageHandler.StartBulkResize)
	mux.HandleFunc("GET /api/v1/store/images/bulk-status", imageHandler.GetBulkStatus)
	mux.HandleFunc("GET /api/v1/store/images/scan-missing", imageHandler.ScanMissingImages)
	mux.HandleFunc("POST /api/v1/store/images/bulk-stop", imageHandler.StopBulkResize)

	// ==========================================
	// ADMIN ROUTES (/api/v1/...)
	// ==========================================

	// Admin Identity / Auth Endpoints (Public)
	mux.HandleFunc("POST /api/v1/auth/login", adminAuthHandler.Login)
	mux.HandleFunc("POST /api/v1/auth/verify-otp", adminAuthHandler.VerifyOTP)
	mux.HandleFunc("POST /api/v1/auth/keycloak-callback", adminAuthHandler.KeycloakCallback)

	// Protected Admin Endpoints (AuthMiddleware required)
	authMiddleware := middleware.AuthMiddleware(cfg.JWTSecret, cfg.KeycloakPublicKey)

	// Admin Catalog
	mux.Handle("GET /api/v1/categories", authMiddleware(http.HandlerFunc(adminCatalogHandler.ListCategories)))
	mux.Handle("POST /api/v1/categories", authMiddleware(http.HandlerFunc(adminCatalogHandler.CreateCategory)))
	mux.Handle("PUT /api/v1/categories/{id}", authMiddleware(http.HandlerFunc(adminCatalogHandler.UpdateCategory)))
	mux.Handle("DELETE /api/v1/categories/{id}", authMiddleware(http.HandlerFunc(adminCatalogHandler.DeleteCategory)))
	mux.Handle("GET /api/v1/products", authMiddleware(http.HandlerFunc(adminCatalogHandler.ListProducts)))
	mux.Handle("GET /api/v1/products/{id}", authMiddleware(http.HandlerFunc(adminCatalogHandler.GetProductByID)))
	mux.Handle("POST /api/v1/products/refresh-cache", authMiddleware(http.HandlerFunc(adminCatalogHandler.RefreshProductCache)))
	mux.Handle("GET /api/v1/settings", authMiddleware(http.HandlerFunc(adminCatalogHandler.GetSettings)))
	mux.Handle("PUT /api/v1/settings", authMiddleware(http.HandlerFunc(adminCatalogHandler.UpdateSettings)))

	// Admin Integration / XML Feeds
	mux.Handle("GET /api/v1/feeds", authMiddleware(http.HandlerFunc(integrationHandler.ListFeeds)))
	mux.Handle("POST /api/v1/feeds/{id}/sync", authMiddleware(http.HandlerFunc(integrationHandler.TriggerSync)))
	mux.Handle("POST /api/v1/feeds/{id}/sync/cancel", authMiddleware(http.HandlerFunc(integrationHandler.CancelSync)))
	mux.Handle("GET /api/v1/feeds/{id}/syncs", authMiddleware(http.HandlerFunc(integrationHandler.ListSyncHistory)))
	mux.Handle("DELETE /api/v1/feeds/{id}/syncs", authMiddleware(http.HandlerFunc(integrationHandler.ClearSyncHistory)))
	mux.Handle("POST /api/v1/feeds/preview", authMiddleware(http.HandlerFunc(integrationHandler.PreviewXML)))
	mux.Handle("POST /api/v1/feeds/{id}/mapping", authMiddleware(http.HandlerFunc(integrationHandler.SaveXMLMapping)))
	mux.Handle("GET /api/v1/xml-history", authMiddleware(http.HandlerFunc(integrationHandler.ListXMLHistory)))
	mux.Handle("DELETE /api/v1/xml-history", authMiddleware(http.HandlerFunc(integrationHandler.DeleteXMLHistory)))

	// Admin Suppliers / Brands
	mux.Handle("GET /api/v1/suppliers", authMiddleware(http.HandlerFunc(suppliersHandler.ListSuppliers)))
	mux.Handle("POST /api/v1/suppliers", authMiddleware(http.HandlerFunc(suppliersHandler.CreateSupplier)))
	mux.Handle("PUT /api/v1/suppliers/{id}", authMiddleware(http.HandlerFunc(suppliersHandler.UpdateSupplier)))
	mux.Handle("DELETE /api/v1/suppliers/{id}", authMiddleware(http.HandlerFunc(suppliersHandler.DeleteSupplier)))
	mux.Handle("POST /api/v1/suppliers/{id}/feeds", authMiddleware(http.HandlerFunc(suppliersHandler.AddFeedToSupplier)))
	mux.Handle("DELETE /api/v1/feeds/{feed_id}", authMiddleware(http.HandlerFunc(suppliersHandler.DeleteFeed)))
	mux.Handle("POST /api/v1/suppliers/{id}/products/deactivate", authMiddleware(http.HandlerFunc(suppliersHandler.DeactivateSupplierProducts)))
	mux.Handle("DELETE /api/v1/suppliers/{id}/products", authMiddleware(http.HandlerFunc(suppliersHandler.DeleteSupplierProducts)))

	// Admin Geography / Localization
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
	mux.Handle("GET /api/v1/currencies", authMiddleware(http.HandlerFunc(countriesHandler.ListCurrencies)))
	mux.Handle("POST /api/v1/currencies", authMiddleware(http.HandlerFunc(countriesHandler.CreateCurrency)))
	mux.Handle("PUT /api/v1/currencies/{id}", authMiddleware(http.HandlerFunc(countriesHandler.UpdateCurrency)))
	mux.Handle("DELETE /api/v1/currencies/{id}", authMiddleware(http.HandlerFunc(countriesHandler.DeleteCurrency)))
	mux.Handle("GET /api/v1/languages", authMiddleware(http.HandlerFunc(countriesHandler.ListLanguages)))
	mux.Handle("POST /api/v1/languages", authMiddleware(http.HandlerFunc(countriesHandler.CreateLanguage)))
	mux.Handle("PUT /api/v1/languages/{id}", authMiddleware(http.HandlerFunc(countriesHandler.UpdateLanguage)))
	mux.Handle("DELETE /api/v1/languages/{id}", authMiddleware(http.HandlerFunc(countriesHandler.DeleteLanguage)))

	// Admin Legal Policies
	mux.Handle("GET /api/v1/policies", authMiddleware(http.HandlerFunc(policiesHandler.ListPolicies)))
	mux.Handle("GET /api/v1/policies/{type}/history", authMiddleware(http.HandlerFunc(policiesHandler.GetPolicyHistory)))
	mux.Handle("POST /api/v1/policies", authMiddleware(http.HandlerFunc(policiesHandler.CreatePolicyVersion)))
	mux.Handle("POST /api/v1/policies/{id}/activate", authMiddleware(http.HandlerFunc(policiesHandler.ActivatePolicyVersion)))

	// Admin Orders & Payments
	mux.Handle("GET /api/v1/orders", authMiddleware(http.HandlerFunc(adminOrdersHandler.ListOrders)))
	mux.Handle("GET /api/v1/orders/{id}", authMiddleware(http.HandlerFunc(adminOrdersHandler.GetOrder)))
	mux.Handle("PUT /api/v1/orders/{id}/status", authMiddleware(http.HandlerFunc(adminOrdersHandler.UpdateOrderStatus)))
	mux.Handle("PUT /api/v1/payment-notifications/{id}", authMiddleware(http.HandlerFunc(adminOrdersHandler.VerifyPaymentNotification)))
	mux.Handle("PUT /api/v1/refunds/{id}", authMiddleware(http.HandlerFunc(adminOrdersHandler.VerifyRefund)))

	// Admin CMS (Pages & Blog)
	mux.Handle("GET /api/v1/pages", authMiddleware(http.HandlerFunc(pagesHandler.ListPages)))
	mux.Handle("GET /api/v1/pages/{id}", authMiddleware(http.HandlerFunc(pagesHandler.GetPageByID)))
	mux.Handle("POST /api/v1/pages", authMiddleware(http.HandlerFunc(pagesHandler.CreatePage)))
	mux.Handle("PUT /api/v1/pages/{id}", authMiddleware(http.HandlerFunc(pagesHandler.UpdatePage)))
	mux.Handle("DELETE /api/v1/pages/{id}", authMiddleware(http.HandlerFunc(pagesHandler.DeletePage)))
	mux.Handle("GET /api/v1/pages/check-slug", authMiddleware(http.HandlerFunc(pagesHandler.CheckSlugUniqueness)))
	mux.Handle("GET /api/v1/blog", authMiddleware(http.HandlerFunc(blogHandler.ListBlogPosts)))
	mux.Handle("GET /api/v1/blog/{id}", authMiddleware(http.HandlerFunc(blogHandler.GetBlogPostByID)))
	mux.Handle("POST /api/v1/blog", authMiddleware(http.HandlerFunc(blogHandler.CreateBlogPost)))
	mux.Handle("PUT /api/v1/blog/{id}", authMiddleware(http.HandlerFunc(blogHandler.UpdateBlogPost)))
	mux.Handle("DELETE /api/v1/blog/{id}", authMiddleware(http.HandlerFunc(blogHandler.DeleteBlogPost)))
	mux.Handle("GET /api/v1/blog/check-slug", authMiddleware(http.HandlerFunc(blogHandler.CheckSlugUniqueness)))

	// IndexNow & Translation
	mux.Handle("POST /api/v1/indexnow/submit", authMiddleware(http.HandlerFunc(indexNowHandler.SubmitManual)))
	mux.Handle("GET /api/v1/translate/stats", authMiddleware(http.HandlerFunc(translateHandler.ListStats)))
	mux.Handle("GET /api/v1/translate/status", authMiddleware(http.HandlerFunc(translateHandler.GetStatus)))
	mux.Handle("POST /api/v1/translate/start", authMiddleware(http.HandlerFunc(translateHandler.StartJob)))
	mux.Handle("POST /api/v1/translate/pause", authMiddleware(http.HandlerFunc(translateHandler.PauseJob)))

	// Cron Management
	mux.Handle("GET /api/v1/cron/settings", authMiddleware(http.HandlerFunc(cronHandler.GetSettings)))
	mux.Handle("PUT /api/v1/cron/settings", authMiddleware(http.HandlerFunc(cronHandler.UpdateSettings)))
	mux.Handle("POST /api/v1/cron/trigger", authMiddleware(http.HandlerFunc(cronHandler.TriggerCron)))
	mux.Handle("GET /api/v1/cron/logs", authMiddleware(http.HandlerFunc(cronHandler.GetLogs)))

	// Customer Management
	mux.Handle("GET /api/v1/customers", authMiddleware(http.HandlerFunc(customersHandler.ListCustomers)))
	mux.Handle("PUT /api/v1/customers/{id}/block", authMiddleware(http.HandlerFunc(customersHandler.ToggleBlockCustomer)))
	mux.Handle("DELETE /api/v1/customers/{id}", authMiddleware(http.HandlerFunc(customersHandler.DeleteCustomer)))

	// 7. Wrap global middlewares (Recovery, Logging, RateLimit, CORS)
	var handler http.Handler = mux
	handler = middleware.LoggingMiddleware(cfg.LogFormat)(handler)
	handler = middleware.RateLimitMiddleware(handler)
	handler = middleware.CORSMiddleware(handler)
	handler = middleware.RecoveryMiddleware(handler)

	// 8. Graceful Shutdown & Server Init
	server := &http.Server{
		Addr:         ":" + cfg.ServerPort,
		Handler:      handler,
		ReadTimeout:  20 * time.Second,
		WriteTimeout: 20 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	safe.Go("HTTP Server Listener", func() {
		log.Printf("[SERVER] Unified Backend API successfully listening on port :%s\n", cfg.ServerPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server failed: %v", err)
		}
	})

	<-stopChan
	log.Println("Shutting down unified backend service gracefully...")
	appCancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	dbPool.Close()
	db.CloseRedis()
	log.Println("Server stopped. Good bye!")
}
