package main

import (
	"net/http"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/handlers"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/services"
)

// AppHandlers aggregates all domain HTTP handlers and shared infrastructure services (DIP Composition Root).
type AppHandlers struct {
	MediaRootDir string

	StoreCatalog         *handlers.StoreCatalogHandler
	StoreCart            *handlers.CartHandler
	StoreOrders          *handlers.StoreOrdersHandler
	StoreAuth            *handlers.StoreAuthHandler
	StoreInquiry         *handlers.InquiryHandler
	AdminAuth            *handlers.AdminAuthHandler
	AdminCatalog         *handlers.AdminCatalogHandler
	AdminOrders          *handlers.AdminOrdersHandler
	Integration          *handlers.IntegrationHandler
	Suppliers            *handlers.SuppliersHandler
	AdminSupplierUsers   *handlers.AdminSupplierUsersHandler
	SupplierPortal       *handlers.SupplierPortalHandler
	Countries            *handlers.CountriesHandler
	Policies             *handlers.PoliciesHandler
	Translate            *handlers.TranslateHandler
	Pages                *handlers.PagesHandler
	Blog                 *handlers.BlogHandler
	IndexNow             *handlers.IndexNowHandler
	Image                *handlers.ImageHandler
	Cron                 *handlers.CronHandler
	Customers            *handlers.CustomersHandler
	SupplierApplications *handlers.SupplierApplicationsHandler
	Analytics            *handlers.AnalyticsHandler
	AdminDashboard       *handlers.AdminDashboardHandler
	Chat                 *handlers.ChatHandler
	Marketplace          *handlers.MarketplaceHandler
	Mobile               *handlers.MobileHandler
}

// NewAppHandlers wires shared SOLID domain services into all HTTP handlers via constructor injection.
func NewAppHandlers(cfg *config.Config) *AppHandlers {
	mediaSvc := services.NewLocalImageMediaService("")
	notifierSvc := services.NewPostgresNotificationDispatcher(db.Pool)
	tokenSvc := services.NewUnifiedTokenService(cfg.JWTSecret, cfg.KeycloakPublicKey, db.Pool)

	storeAuth := handlers.NewStoreAuthHandler(cfg)
	supplierPortal := handlers.NewSupplierPortalHandler(cfg, mediaSvc)

	return &AppHandlers{
		MediaRootDir:         mediaSvc.RootDir(),
		StoreCatalog:         handlers.NewStoreCatalogHandler(),
		StoreCart:            handlers.NewCartHandler(),
		StoreOrders:          handlers.NewStoreOrdersHandler(),
		StoreAuth:            storeAuth,
		StoreInquiry:         handlers.NewInquiryHandler(),
		AdminAuth:            handlers.NewAdminAuthHandler(cfg),
		AdminCatalog:         handlers.NewAdminCatalogHandler(),
		AdminOrders:          handlers.NewAdminOrdersHandler(cfg),
		Integration:          handlers.NewIntegrationHandler(cfg),
		Suppliers:            handlers.NewSuppliersHandler(),
		AdminSupplierUsers:   handlers.NewAdminSupplierUsersHandler(cfg),
		SupplierPortal:       supplierPortal,
		Countries:            handlers.NewCountriesHandler(),
		Policies:             handlers.NewPoliciesHandler(),
		Translate:            handlers.NewTranslateHandler(),
		Pages:                handlers.NewPagesHandler(),
		Blog:                 handlers.NewBlogHandler(),
		IndexNow:             handlers.NewIndexNowHandler(),
		Image:                handlers.NewImageHandler(),
		Cron:                 handlers.NewCronHandler(),
		Customers:            handlers.NewCustomersHandler(cfg),
		SupplierApplications: handlers.NewSupplierApplicationsHandler(cfg),
		Analytics:            handlers.NewAnalyticsHandler(cfg),
		AdminDashboard:       handlers.NewAdminDashboardHandler(cfg),
		Chat:                 handlers.NewChatHandler(cfg, notifierSvc),
		Marketplace:          handlers.NewMarketplaceHandler(cfg, notifierSvc),
		Mobile: handlers.NewMobileHandler(cfg, storeAuth, supplierPortal, handlers.MobileHandlerDeps{
			Media:  mediaSvc,
			Tokens: tokenSvc,
		}),
	}
}

// BuildRouter registers all modular route groups and wraps global cross-cutting middlewares.
func BuildRouter(cfg *config.Config, h *AppHandlers) http.Handler {
	mux := http.NewServeMux()
	authMW := middleware.AuthMiddleware(cfg.JWTSecret, cfg.KeycloakPublicKey)
	supplierMW := middleware.SupplierAuthMiddleware(cfg.JWTSecret, cfg.KeycloakPublicKey)

	registerPublicAndDocsRoutes(mux, h)
	registerStorefrontRoutes(mux, h)
	registerAdminRoutes(mux, h, authMW)
	registerSupplierPortalRoutes(mux, h, supplierMW)
	registerMobileRoutes(mux, h, supplierMW)
	registerRealtimeChatRoutes(mux, h, supplierMW)

	var handler http.Handler = mux
	handler = middleware.LoggingMiddleware(cfg.LogFormat)(handler)
	handler = middleware.RateLimitMiddleware(handler)
	handler = middleware.CORSMiddleware(handler)
	handler = middleware.RecoveryMiddleware(handler)
	return handler
}

func registerPublicAndDocsRoutes(mux *http.ServeMux, h *AppHandlers) {
	healthHandler := func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set(headerContentType, "application/json")
		_, _ = w.Write([]byte(`{"status":"healthy","database":"connected","service":"unified-backend"}`))
	}
	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("GET /api/v1/health", healthHandler)

	mux.HandleFunc("GET /swagger.yaml", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set(headerContentType, "text/yaml")
		_, _ = w.Write(swaggerYAML)
	})
	mux.HandleFunc("GET /docs", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set(headerContentType, "text/html; charset=utf-8")
		_, _ = w.Write(swaggerHTML)
	})
	mux.HandleFunc("GET /swagger/", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set(headerContentType, "text/html; charset=utf-8")
		_, _ = w.Write(swaggerHTML)
	})

	mediaRoot := h.MediaRootDir
	if mediaRoot == "" {
		mediaRoot = handlers.MediaRootDir()
	}
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(mediaRoot))))
}

func registerStorefrontRoutes(mux *http.ServeMux, h *AppHandlers) {
	// Shopping Cart
	mux.HandleFunc("GET /api/v1/store/cart", h.StoreCart.GetCart)
	mux.HandleFunc("POST /api/v1/store/cart", h.StoreCart.AddToCart)
	mux.HandleFunc("POST /api/v1/store/cart/sync", h.StoreCart.SyncCart)
	mux.HandleFunc("PUT /api/v1/store/cart/items/{item_id}", h.StoreCart.UpdateCartItem)
	mux.HandleFunc("DELETE /api/v1/store/cart/items/{item_id}", h.StoreCart.DeleteCartItem)
	mux.HandleFunc("DELETE /api/v1/store/cart", h.StoreCart.ClearCart)
	mux.HandleFunc("POST /api/v1/store/cart/export-excel", h.StoreCart.ExportExcel)

	// B2B Store Orders
	mux.HandleFunc("GET /api/v1/store/orders", h.StoreOrders.ListOrders)
	mux.HandleFunc("GET /api/v1/store/orders/{id}", h.StoreOrders.GetOrder)
	mux.HandleFunc("POST /api/v1/store/orders", h.StoreOrders.CreateOrder)
	mux.HandleFunc("POST /api/v1/store/orders/{id}/cancel", h.StoreOrders.CancelOrder)
	mux.HandleFunc("POST /api/v1/store/orders/{id}/payment-notification", h.StoreOrders.SubmitPaymentNotification)
	mux.HandleFunc("POST /api/v1/store/orders/{id}/refund", h.StoreOrders.RequestRefund)
	mux.HandleFunc("GET /api/v1/store/orders/{id}/excel", h.StoreOrders.ExportExcel)
	mux.HandleFunc("GET /api/v1/store/orders/{id}/images", h.StoreOrders.DownloadImagesZip)

	// Storefront Auth, Profile & Locations
	mux.HandleFunc("POST /api/v1/store/auth/register", h.StoreAuth.Register)
	mux.HandleFunc("POST /api/v1/store/auth/login", h.StoreAuth.Login)
	mux.HandleFunc("GET /api/v1/store/auth/google-callback", h.StoreAuth.GoogleCallback)
	mux.HandleFunc("GET /api/v1/store/profile", h.StoreAuth.GetProfile)
	mux.HandleFunc("PUT /api/v1/store/profile", h.StoreAuth.UpdateProfile)
	mux.HandleFunc("GET /api/v1/store/auth/profile", h.StoreAuth.GetProfile)
	mux.HandleFunc("PUT /api/v1/store/auth/profile", h.StoreAuth.UpdateProfile)
	mux.HandleFunc("GET /api/v1/store/profile/addresses", h.StoreAuth.ListAddresses)
	mux.HandleFunc("POST /api/v1/store/profile/addresses", h.StoreAuth.CreateAddress)
	mux.HandleFunc("PUT /api/v1/store/profile/addresses/{id}", h.StoreAuth.UpdateAddress)
	mux.HandleFunc("DELETE /api/v1/store/profile/addresses/{id}", h.StoreAuth.DeleteAddress)
	mux.HandleFunc("GET /api/v1/store/locations/countries", h.StoreAuth.ListCountries)
	mux.HandleFunc("GET /api/v1/store/locations/countries/{country_id}/states", h.StoreAuth.ListStatesByCountry)
	mux.HandleFunc("GET /api/v1/store/locations/states/{state_id}/cities", h.StoreAuth.ListCitiesByState)

	// Catalog, CMS, Policies & SEO Feeds
	mux.HandleFunc("GET /api/v1/store/products", h.StoreCatalog.ListProducts)
	mux.HandleFunc("GET /api/v1/store/catalog/delta", h.StoreCatalog.CatalogDelta)
	mux.HandleFunc("POST /api/v1/store/supplier-applications", h.SupplierApplications.SubmitApplication)
	mux.HandleFunc("GET /api/v1/store/supplier-applications/verify", h.SupplierApplications.VerifyApplicationEmail)
	mux.HandleFunc("GET /api/v1/store/products/{id}", h.StoreCatalog.GetProductByID)
	mux.HandleFunc("GET /api/v1/store/categories", h.StoreCatalog.ListCategories)
	mux.HandleFunc("GET /api/v1/store/brands", h.StoreCatalog.ListBrands)
	mux.HandleFunc("GET /api/v1/store/attributes", h.StoreCatalog.ListAttributes)
	mux.HandleFunc("GET /api/v1/store/settings", h.StoreCatalog.GetStoreSettings)
	mux.HandleFunc("GET /api/v1/store/languages", h.StoreCatalog.ListLanguages)
	mux.HandleFunc("GET /api/v1/store/exchange-rates", h.StoreCatalog.GetExchangeRates)
	mux.HandleFunc("GET /api/v1/store/policies/{type}/active", h.Policies.GetActivePolicyByType)
	mux.HandleFunc("GET /api/v1/store/pages/{slug}", h.StoreCatalog.GetPageBySlug)
	mux.HandleFunc("GET /api/v1/store/pages", h.StoreCatalog.ListPages)
	mux.HandleFunc("POST /api/v1/store/track", h.Analytics.TrackPageView)
	mux.HandleFunc("OPTIONS /api/v1/store/track", h.Analytics.TrackPageView)
	mux.HandleFunc("GET /api/v1/store/blog", h.StoreCatalog.ListBlogPosts)
	mux.HandleFunc("GET /api/v1/store/blog/{slug}", h.StoreCatalog.GetBlogPostBySlug)
	mux.HandleFunc("GET /api/v1/store/feeds/google-merchant.xml", h.StoreCatalog.GoogleMerchantFeed)
	mux.HandleFunc("POST /api/v1/store/inquiries", h.StoreInquiry.SubmitInquiry)

	// Dynamic WebP Image Resizing
	mux.HandleFunc("GET /api/v1/store/images/resize", h.Image.ResizeImage)
	mux.HandleFunc("POST /api/v1/store/images/bulk-resize", h.Image.StartBulkResize)
	mux.HandleFunc("GET /api/v1/store/images/bulk-status", h.Image.GetBulkStatus)
	mux.HandleFunc("GET /api/v1/store/images/scan-missing", h.Image.ScanMissingImages)
	mux.HandleFunc("POST /api/v1/store/images/bulk-stop", h.Image.StopBulkResize)
}

func registerAdminRoutes(mux *http.ServeMux, h *AppHandlers, authMW func(http.Handler) http.Handler) {
	protect := func(fn http.HandlerFunc) http.Handler {
		return authMW(fn)
	}

	mux.HandleFunc("POST /api/v1/auth/login", h.AdminAuth.Login)
	mux.HandleFunc("POST /api/v1/auth/verify-otp", h.AdminAuth.VerifyOTP)
	mux.HandleFunc("POST /api/v1/auth/keycloak-callback", h.AdminAuth.KeycloakCallback)

	// Catalog & Settings
	mux.Handle("GET /api/v1/categories", protect(h.AdminCatalog.ListCategories))
	mux.Handle("POST /api/v1/categories", protect(h.AdminCatalog.CreateCategory))
	mux.Handle("PUT /api/v1/categories/{id}", protect(h.AdminCatalog.UpdateCategory))
	mux.Handle("DELETE /api/v1/categories/{id}", protect(h.AdminCatalog.DeleteCategory))
	mux.Handle("GET /api/v1/products", protect(h.AdminCatalog.ListProducts))
	mux.Handle("GET /api/v1/products/{id}", protect(h.AdminCatalog.GetProductByID))
	mux.Handle("POST /api/v1/products/refresh-cache", protect(h.AdminCatalog.RefreshProductCache))
	mux.Handle("GET /api/v1/settings", protect(h.AdminCatalog.GetSettings))
	mux.Handle("PUT /api/v1/settings", protect(h.AdminCatalog.UpdateSettings))

	// XML Feeds & Suppliers
	mux.Handle("GET /api/v1/feeds", protect(h.Integration.ListFeeds))
	mux.Handle("POST /api/v1/feeds/{id}/sync", protect(h.Integration.TriggerSync))
	mux.Handle("POST /api/v1/feeds/{id}/sync/cancel", protect(h.Integration.CancelSync))
	mux.Handle("GET /api/v1/feeds/{id}/syncs", protect(h.Integration.ListSyncHistory))
	mux.Handle("DELETE /api/v1/feeds/{id}/syncs", protect(h.Integration.ClearSyncHistory))
	mux.Handle("POST /api/v1/feeds/preview", protect(h.Integration.PreviewXML))
	mux.Handle("POST /api/v1/feeds/{id}/mapping", protect(h.Integration.SaveXMLMapping))
	mux.Handle("GET /api/v1/xml-history", protect(h.Integration.ListXMLHistory))
	mux.Handle("DELETE /api/v1/xml-history", protect(h.Integration.DeleteXMLHistory))

	mux.Handle("GET /api/v1/suppliers", protect(h.Suppliers.ListSuppliers))
	mux.Handle("POST /api/v1/suppliers", protect(h.Suppliers.CreateSupplier))
	mux.Handle("PUT /api/v1/suppliers/{id}", protect(h.Suppliers.UpdateSupplier))
	mux.Handle("DELETE /api/v1/suppliers/{id}", protect(h.Suppliers.DeleteSupplier))
	mux.Handle("POST /api/v1/suppliers/{id}/feeds", protect(h.Suppliers.AddFeedToSupplier))
	mux.Handle("DELETE /api/v1/feeds/{feed_id}", protect(h.Suppliers.DeleteFeed))
	mux.Handle("POST /api/v1/suppliers/{id}/products/deactivate", protect(h.Suppliers.DeactivateSupplierProducts))
	mux.Handle("DELETE /api/v1/suppliers/{id}/products", protect(h.Suppliers.DeleteSupplierProducts))

	// Supplier Accounts, Applications & Chat Audit
	mux.Handle("GET /api/v1/admin/supplier-users", protect(h.AdminSupplierUsers.ListSupplierUsers))
	mux.Handle("POST /api/v1/admin/supplier-users", protect(h.AdminSupplierUsers.CreateSupplierUser))
	mux.Handle("PUT /api/v1/admin/supplier-users/{id}", protect(h.AdminSupplierUsers.UpdateSupplierUser))
	mux.Handle("DELETE /api/v1/admin/supplier-users/{id}", protect(h.AdminSupplierUsers.DeleteSupplierUser))
	mux.Handle("GET /api/v1/admin/chat/rooms", protect(h.Chat.ListAdminRooms))
	mux.Handle("GET /api/v1/admin/chat/rooms/{room_id}/messages", protect(h.Chat.ListAdminMessages))
	mux.Handle("GET /api/v1/admin/supplier-applications", protect(h.SupplierApplications.ListApplications))
	mux.Handle("PATCH /api/v1/admin/supplier-applications/{id}/status", protect(h.SupplierApplications.UpdateStatus))
	mux.Handle("DELETE /api/v1/admin/supplier-applications/{id}", protect(h.SupplierApplications.DeleteApplication))

	// Geography, Currencies & Languages
	mux.Handle("GET /api/v1/countries", protect(h.Countries.ListCountries))
	mux.Handle("POST /api/v1/countries", protect(h.Countries.CreateCountry))
	mux.Handle("PUT /api/v1/countries/{id}", protect(h.Countries.UpdateCountry))
	mux.Handle("DELETE /api/v1/countries/{id}", protect(h.Countries.DeleteCountry))
	mux.Handle("GET /api/v1/countries/{id}/states", protect(h.Countries.ListCountryStates))
	mux.Handle("POST /api/v1/countries/states", protect(h.Countries.CreateCountryState))
	mux.Handle("PUT /api/v1/countries/states/{id}", protect(h.Countries.UpdateCountryState))
	mux.Handle("DELETE /api/v1/countries/states/{id}", protect(h.Countries.DeleteCountryState))
	mux.Handle("GET /api/v1/country-groups", protect(h.Countries.ListCountryGroups))
	mux.Handle("POST /api/v1/country-groups", protect(h.Countries.CreateCountryGroup))
	mux.Handle("PUT /api/v1/country-groups/{id}", protect(h.Countries.UpdateCountryGroup))
	mux.Handle("DELETE /api/v1/country-groups/{id}", protect(h.Countries.DeleteCountryGroup))
	mux.Handle("GET /api/v1/currencies", protect(h.Countries.ListCurrencies))
	mux.Handle("POST /api/v1/currencies", protect(h.Countries.CreateCurrency))
	mux.Handle("PUT /api/v1/currencies/{id}", protect(h.Countries.UpdateCurrency))
	mux.Handle("DELETE /api/v1/currencies/{id}", protect(h.Countries.DeleteCurrency))
	mux.Handle("GET /api/v1/languages", protect(h.Countries.ListLanguages))
	mux.Handle("POST /api/v1/languages", protect(h.Countries.CreateLanguage))
	mux.Handle("PUT /api/v1/languages/{id}", protect(h.Countries.UpdateLanguage))
	mux.Handle("DELETE /api/v1/languages/{id}", protect(h.Countries.DeleteLanguage))

	// Legal Policies, Orders, CMS, Translation, Cron, Customers & Marketplace
	mux.Handle("GET /api/v1/policies", protect(h.Policies.ListPolicies))
	mux.Handle("GET /api/v1/policies/{type}/history", protect(h.Policies.GetPolicyHistory))
	mux.Handle("POST /api/v1/policies", protect(h.Policies.CreatePolicyVersion))
	mux.Handle("POST /api/v1/policies/{id}/activate", protect(h.Policies.ActivatePolicyVersion))

	mux.Handle("GET /api/v1/orders", protect(h.AdminOrders.ListOrders))
	mux.Handle("GET /api/v1/orders/{id}", protect(h.AdminOrders.GetOrder))
	mux.Handle("PUT /api/v1/orders/{id}/status", protect(h.AdminOrders.UpdateOrderStatus))
	mux.Handle("PUT /api/v1/payment-notifications/{id}", protect(h.AdminOrders.VerifyPaymentNotification))
	mux.Handle("PUT /api/v1/refunds/{id}", protect(h.AdminOrders.VerifyRefund))

	mux.Handle("GET /api/v1/pages", protect(h.Pages.ListPages))
	mux.Handle("GET /api/v1/pages/{id}", protect(h.Pages.GetPageByID))
	mux.Handle("POST /api/v1/pages", protect(h.Pages.CreatePage))
	mux.Handle("PUT /api/v1/pages/{id}", protect(h.Pages.UpdatePage))
	mux.Handle("DELETE /api/v1/pages/{id}", protect(h.Pages.DeletePage))
	mux.Handle("GET /api/v1/pages/check-slug", protect(h.Pages.CheckSlugUniqueness))
	mux.Handle("GET /api/v1/blog", protect(h.Blog.ListBlogPosts))
	mux.Handle("GET /api/v1/blog/{id}", protect(h.Blog.GetBlogPostByID))
	mux.Handle("POST /api/v1/blog", protect(h.Blog.CreateBlogPost))
	mux.Handle("PUT /api/v1/blog/{id}", protect(h.Blog.UpdateBlogPost))
	mux.Handle("DELETE /api/v1/blog/{id}", protect(h.Blog.DeleteBlogPost))
	mux.Handle("GET /api/v1/blog/check-slug", protect(h.Blog.CheckSlugUniqueness))

	mux.Handle("POST /api/v1/indexnow/submit", protect(h.IndexNow.SubmitManual))
	mux.Handle("GET /api/v1/translate/stats", protect(h.Translate.ListStats))
	mux.Handle("GET /api/v1/translate/status", protect(h.Translate.GetStatus))
	mux.Handle("POST /api/v1/translate/start", protect(h.Translate.StartJob))
	mux.Handle("POST /api/v1/translate/pause", protect(h.Translate.PauseJob))

	mux.Handle("GET /api/v1/cron/settings", protect(h.Cron.GetSettings))
	mux.Handle("PUT /api/v1/cron/settings", protect(h.Cron.UpdateSettings))
	mux.Handle("POST /api/v1/cron/trigger", protect(h.Cron.TriggerCron))
	mux.Handle("GET /api/v1/cron/logs", protect(h.Cron.GetLogs))

	mux.Handle("GET /api/v1/customers", protect(h.Customers.ListCustomers))
	mux.Handle("PUT /api/v1/customers/{id}/block", protect(h.Customers.ToggleBlockCustomer))
	mux.Handle("DELETE /api/v1/customers/{id}", protect(h.Customers.DeleteCustomer))
	mux.Handle("GET /api/v1/admin/analytics/stats", protect(h.Analytics.GetAnalyticsStats))
	mux.Handle("GET /api/v1/admin/dashboard/stats", protect(h.AdminDashboard.GetDashboardStats))

	mux.Handle("GET /api/v1/admin/marketplace/sub-orders", protect(h.Marketplace.ListAdminSubOrders))
	mux.Handle("GET /api/v1/admin/marketplace/payouts", protect(h.Marketplace.ListAdminPayoutRequests))
	mux.Handle("PUT /api/v1/admin/marketplace/payouts/{id}", protect(h.Marketplace.ProcessAdminPayoutRequest))
	mux.Handle("GET /api/v1/admin/marketplace/api-keys", protect(h.Marketplace.ListB2BApiKeys))
	mux.Handle("POST /api/v1/admin/marketplace/api-keys", protect(h.Marketplace.CreateB2BApiKey))
	mux.Handle("DELETE /api/v1/admin/marketplace/api-keys/{id}", protect(h.Marketplace.RevokeB2BApiKey))
	mux.HandleFunc("GET /api/v1/feeds/b2b.xml", h.Marketplace.ExportB2BXmlFeed)
	mux.HandleFunc("GET /api/v1/feeds/b2b.json", h.Marketplace.ExportB2BJsonFeed)
}

func registerSupplierPortalRoutes(mux *http.ServeMux, h *AppHandlers, supplierMW func(http.Handler) http.Handler) {
	protect := func(fn http.HandlerFunc) http.Handler {
		return supplierMW(fn)
	}

	mux.HandleFunc("POST /api/v1/supplier/auth/login", h.SupplierPortal.Login)
	mux.HandleFunc("GET /api/v1/supplier/auth/verify-setup-token", h.SupplierPortal.VerifySetupToken)
	mux.HandleFunc("POST /api/v1/supplier/auth/setup-password", h.SupplierPortal.SetupPassword)
	mux.Handle("GET /api/v1/supplier/profile", protect(h.SupplierPortal.GetProfile))
	mux.Handle("GET /api/v1/supplier/products", protect(h.SupplierPortal.ListProducts))
	mux.Handle("GET /api/v1/supplier/products/{id}", protect(h.SupplierPortal.GetProduct))
	mux.Handle("POST /api/v1/supplier/products", protect(h.SupplierPortal.CreateProduct))
	mux.Handle("PUT /api/v1/supplier/products/{id}", protect(h.SupplierPortal.UpdateProduct))
	mux.Handle("DELETE /api/v1/supplier/products/{id}", protect(h.SupplierPortal.DeleteProduct))
	mux.Handle("POST /api/v1/supplier/upload-image", protect(h.SupplierPortal.UploadImage))
	mux.Handle("GET /api/v1/supplier/categories", protect(h.SupplierPortal.ListCategories))
	mux.Handle("GET /api/v1/supplier/attributes", protect(h.SupplierPortal.ListAttributes))

	mux.Handle("GET /api/v1/supplier/orders", protect(h.Marketplace.ListSupplierOrders))
	mux.Handle("GET /api/v1/supplier/orders/{id}", protect(h.Marketplace.GetSupplierOrder))
	mux.Handle("PUT /api/v1/supplier/orders/{id}/status", protect(h.Marketplace.UpdateSupplierOrderStatus))
	mux.Handle("PATCH /api/v1/supplier/orders/{id}/status", protect(h.Marketplace.UpdateSupplierOrderStatus))
	mux.Handle("GET /api/v1/supplier/wallet", protect(h.Marketplace.GetSupplierWallet))
	mux.Handle("PUT /api/v1/supplier/wallet/iban", protect(h.Marketplace.UpdateSupplierWalletIban))
	mux.Handle("GET /api/v1/supplier/payouts", protect(h.Marketplace.ListSupplierPayoutRequests))
	mux.Handle("POST /api/v1/supplier/payouts", protect(h.Marketplace.CreateSupplierPayoutRequest))
}

func registerMobileRoutes(mux *http.ServeMux, h *AppHandlers, supplierMW func(http.Handler) http.Handler) {
	protectSupplier := func(fn http.HandlerFunc) http.Handler {
		return supplierMW(fn)
	}

	mux.HandleFunc("GET /api/v1/mobile/bootstrap", h.Mobile.Bootstrap)
	mux.HandleFunc("GET /api/v1/mobile/version", h.Mobile.GetVersion)
	mux.HandleFunc("GET /api/v1/mobile/apk", h.Mobile.DownloadApk)
	mux.HandleFunc("HEAD /api/v1/mobile/apk", h.Mobile.DownloadApk)
	mux.HandleFunc("GET /api/v1/mobile/apk/download", h.Mobile.DownloadApk)
	mux.HandleFunc("HEAD /api/v1/mobile/apk/download", h.Mobile.DownloadApk)
	mux.HandleFunc("POST /api/v1/mobile/auth/login", h.Mobile.Login)
	mux.HandleFunc("POST /api/v1/mobile/auth/refresh", h.Mobile.RefreshToken)
	mux.HandleFunc("DELETE /api/v1/mobile/auth/account", h.Mobile.DeleteAccount)
	mux.HandleFunc("POST /api/v1/mobile/auth/delete-account", h.Mobile.DeleteAccount)
	mux.HandleFunc("POST /api/v1/mobile/devices", h.Mobile.RegisterDevice)
	mux.HandleFunc("DELETE /api/v1/mobile/devices", h.Mobile.UnregisterDevice)
	mux.HandleFunc("GET /api/v1/mobile/notifications", h.Mobile.ListNotifications)
	mux.HandleFunc("POST /api/v1/mobile/notifications/read-all", h.Mobile.MarkNotificationsReadAll)
	mux.HandleFunc("GET /api/v1/mobile/wishlist", h.Mobile.ListWishlist)
	mux.HandleFunc("POST /api/v1/mobile/wishlist/{product_id}", h.Mobile.AddWishlistItem)
	mux.HandleFunc("DELETE /api/v1/mobile/wishlist/{product_id}", h.Mobile.RemoveWishlistItem)
	mux.HandleFunc("POST /api/v1/mobile/chat/upload-image", h.Mobile.UploadChatImage)

	mux.Handle("GET /api/v1/mobile/supplier/dashboard", protectSupplier(h.Mobile.GetSupplierDashboard))
	mux.Handle("POST /api/v1/mobile/supplier/upload-images", protectSupplier(h.Mobile.UploadSupplierImagesBatch))
	mux.Handle("PATCH /api/v1/mobile/supplier/products/{id}/quick-update", protectSupplier(h.Mobile.QuickUpdateSupplierProduct))
	mux.Handle("GET /api/v1/mobile/supplier/products/by-barcode", protectSupplier(h.Mobile.FindSupplierProductByBarcode))
}

func registerRealtimeChatRoutes(mux *http.ServeMux, h *AppHandlers, supplierMW func(http.Handler) http.Handler) {
	protectSupplier := func(fn http.HandlerFunc) http.Handler {
		return supplierMW(fn)
	}

	mux.Handle("/api/v1/chat/ws", h.Chat.WebsocketHandler())
	mux.HandleFunc("GET /api/v1/store/chat/brands/{brand_id}/agents", h.Chat.ListBrandAgents)
	mux.HandleFunc("POST /api/v1/store/chat/rooms", h.Chat.InitOrGetRoom)
	mux.HandleFunc("GET /api/v1/store/chat/rooms", h.Chat.ListCustomerRooms)
	mux.HandleFunc("GET /api/v1/store/chat/rooms/{room_id}/messages", h.Chat.ListCustomerMessages)
	mux.HandleFunc("POST /api/v1/store/chat/rooms/{room_id}/messages", h.Chat.SendCustomerMessage)
	mux.HandleFunc("POST /api/v1/store/chat/messages/{message_id}/accept-offer", h.Chat.AcceptCustomOffer)

	mux.Handle("GET /api/v1/supplier/chat/rooms", protectSupplier(h.Chat.ListSupplierRooms))
	mux.Handle("GET /api/v1/supplier/chat/rooms/{room_id}/messages", protectSupplier(h.Chat.ListSupplierMessages))
	mux.Handle("POST /api/v1/supplier/chat/rooms/{room_id}/messages", protectSupplier(h.Chat.SendSupplierMessage))
	mux.Handle("GET /api/v1/supplier/team", protectSupplier(h.Chat.ListSupplierTeam))
	mux.Handle("POST /api/v1/supplier/team", protectSupplier(h.Chat.CreateSupplierTeamMember))
	mux.Handle("DELETE /api/v1/supplier/team/{id}", protectSupplier(h.Chat.DeleteSupplierTeamMember))
}

