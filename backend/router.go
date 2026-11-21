package main

import (
	"net/http"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/handlers"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
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
	AdminNotifications   *handlers.AdminNotificationsHandler
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
	supplierApps := handlers.NewSupplierApplicationsHandler(cfg)
	marketplace := handlers.NewMarketplaceHandler(cfg, notifierSvc)

	return &AppHandlers{
		MediaRootDir:         mediaSvc.RootDir(),
		StoreCatalog:         handlers.NewStoreCatalogHandler(cfg),
		StoreCart:            handlers.NewCartHandler(),
		StoreOrders:          handlers.NewStoreOrdersHandler(cfg),
		StoreAuth:            storeAuth,
		StoreInquiry:         handlers.NewInquiryHandler(cfg),
		AdminAuth:            handlers.NewAdminAuthHandler(cfg),
		AdminCatalog:         handlers.NewAdminCatalogHandler(cfg),
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
		SupplierApplications: supplierApps,
		Analytics:            handlers.NewAnalyticsHandler(cfg),
		AdminDashboard:       handlers.NewAdminDashboardHandler(cfg),
		AdminNotifications:   handlers.NewAdminNotificationsHandler(cfg),
		Chat:                 handlers.NewChatHandler(cfg, notifierSvc),
		Marketplace:          marketplace,
		Mobile: handlers.NewMobileHandler(cfg, storeAuth, supplierPortal, handlers.MobileHandlerDeps{
			Media:        mediaSvc,
			Tokens:       tokenSvc,
			SupplierApps: supplierApps,
			Marketplace:  marketplace,
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
	handler = handlers.BotCrawlLoggingMiddleware(handler)
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
	mux.HandleFunc("GET "+handlers.IndexNowKeyVerificationPath, h.IndexNow.ServeKeyFile)

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
	mux.HandleFunc("GET /api/v1/store/auth/verify-email", h.StoreAuth.VerifyEmail)
	mux.HandleFunc("POST /api/v1/store/auth/resend-verification", h.StoreAuth.ResendVerificationEmail)
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
	mux.HandleFunc("GET /api/v1/store/brands/{slug}", h.StoreCatalog.GetBrandBySlug)
	mux.HandleFunc("GET /api/v1/store/attributes", h.StoreCatalog.ListAttributes)
	mux.HandleFunc("GET /api/v1/store/settings", h.StoreCatalog.GetStoreSettings)
	mux.HandleFunc("GET /api/v1/store/languages", h.StoreCatalog.ListLanguages)
	mux.HandleFunc("GET /api/v1/store/exchange-rates", h.StoreCatalog.GetExchangeRates)
	mux.HandleFunc("GET /api/v1/store/policies/{type}/active", h.Policies.GetActivePolicyByType)
	mux.HandleFunc("GET /api/v1/store/pages/{slug}", h.StoreCatalog.GetPageBySlug)
	mux.HandleFunc("GET /api/v1/store/pages", h.StoreCatalog.ListPages)
	mux.HandleFunc("POST /api/v1/store/track", h.Analytics.TrackPageView)
	mux.HandleFunc("OPTIONS /api/v1/store/track", h.Analytics.TrackPageView)
	mux.HandleFunc("POST /api/v1/store/member-events", h.Analytics.TrackMemberEvent)
	mux.HandleFunc("OPTIONS /api/v1/store/member-events", h.Analytics.TrackMemberEvent)
	mux.HandleFunc("POST /api/v1/store/brand-events", h.Analytics.TrackBrandEvent)
	mux.HandleFunc("OPTIONS /api/v1/store/brand-events", h.Analytics.TrackBrandEvent)
	mux.HandleFunc("POST /api/v1/store/search-events", h.Analytics.TrackSearchClick)
	mux.HandleFunc("OPTIONS /api/v1/store/search-events", h.Analytics.TrackSearchClick)
	mux.HandleFunc("GET /api/v1/store/blog", h.StoreCatalog.ListBlogPosts)
	mux.HandleFunc("GET /api/v1/store/blog/{slug}", h.StoreCatalog.GetBlogPostBySlug)
	mux.HandleFunc("GET /api/v1/store/feeds/google-merchant.xml", h.StoreCatalog.GoogleMerchantFeed)
	mux.HandleFunc("GET /api/v1/store/feeds/yandex-market.xml", h.StoreCatalog.YandexMarketFeed)
	mux.HandleFunc("GET /api/v1/store/sitemap/products", h.StoreCatalog.GetProductsSitemapData)
	mux.HandleFunc("POST /api/v1/store/inquiries", h.StoreInquiry.SubmitInquiry)
	mux.HandleFunc("GET /api/v1/store/rfqs", h.Marketplace.ListPublicRfqs)
	mux.HandleFunc("POST /api/v1/store/rfqs", h.Marketplace.CreatePublicRfq)
	mux.HandleFunc("GET /api/v1/store/sponsored-slots", h.Marketplace.ListPublicSponsoredSlots)
	mux.HandleFunc("POST /api/v1/store/sponsored-slots/{id}/click", h.Marketplace.TrackSponsoredSlotClick)
	mux.HandleFunc("POST /api/v1/store/newsletter/subscribe", h.Marketplace.SubscribeNewsletter)
	mux.HandleFunc("GET /api/v1/store/service-providers", h.Marketplace.ListPublicServiceProviders)
	mux.HandleFunc("POST /api/v1/store/service-providers", h.Marketplace.CreatePublicServiceProviderApplication)
	mux.HandleFunc("GET /api/v1/store/service-providers/verify", h.Marketplace.VerifyServiceProviderEmail)
	mux.HandleFunc("POST /api/v1/store/service-providers/{id}/click", h.Marketplace.TrackServiceProviderClick)

	// Dynamic WebP Image Resizing (public read-only on-the-fly resize; bulk admin ops live in registerAdminRoutes)
	mux.HandleFunc("GET /api/v1/store/images/resize", h.Image.ResizeImage)
}

func registerAdminRoutes(mux *http.ServeMux, h *AppHandlers, authMW func(http.Handler) http.Handler) {
	adminRoleMW := middleware.RequireRole(models.RoleAdmin, models.RoleEditor, models.RoleSalesManager, models.RoleWarehouse)
	protect := func(fn http.HandlerFunc) http.Handler {
		return authMW(adminRoleMW(fn))
	}

	mux.HandleFunc("POST /api/v1/auth/login", h.AdminAuth.Login)
	mux.HandleFunc("POST /api/v1/auth/verify-otp", h.AdminAuth.VerifyOTP)
	mux.HandleFunc("POST /api/v1/auth/keycloak-callback", h.AdminAuth.KeycloakCallback)

	// Admin Bulk Image Operations
	mux.Handle("POST /api/v1/store/images/bulk-resize", protect(h.Image.StartBulkResize))
	mux.Handle("GET /api/v1/store/images/bulk-status", protect(h.Image.GetBulkStatus))
	mux.Handle("GET /api/v1/store/images/scan-missing", protect(h.Image.ScanMissingImages))
	mux.Handle("POST /api/v1/store/images/bulk-stop", protect(h.Image.StopBulkResize))

	// Catalog & Settings
	mux.Handle("GET /api/v1/categories", protect(h.AdminCatalog.ListCategories))
	mux.Handle("POST /api/v1/categories", protect(h.AdminCatalog.CreateCategory))
	mux.Handle("PUT /api/v1/categories/{id}", protect(h.AdminCatalog.UpdateCategory))
	mux.Handle("DELETE /api/v1/categories/{id}", protect(h.AdminCatalog.DeleteCategory))
	mux.Handle("GET /api/v1/products", protect(h.AdminCatalog.ListProducts))
	mux.Handle("POST /api/v1/products/bulk-action", protect(h.AdminCatalog.BulkProductAction))
	mux.Handle("GET /api/v1/products/{id}", protect(h.AdminCatalog.GetProductByID))
	mux.Handle("POST /api/v1/products/refresh-cache", protect(h.AdminCatalog.RefreshProductCache))
	mux.Handle("GET /api/v1/settings", protect(h.AdminCatalog.GetSettings))
	mux.Handle("PUT /api/v1/settings", protect(h.AdminCatalog.UpdateSettings))
	mux.Handle("GET /api/v1/size-definitions", protect(h.AdminCatalog.ListSizeDefinitions))
	mux.Handle("POST /api/v1/size-definitions", protect(h.AdminCatalog.CreateSizeDefinition))
	mux.Handle("DELETE /api/v1/size-definitions/{id}", protect(h.AdminCatalog.DeleteSizeDefinition))
	mux.Handle("GET /api/v1/series-templates", protect(h.AdminCatalog.ListSeriesTemplates))
	mux.Handle("POST /api/v1/series-templates", protect(h.AdminCatalog.CreateSeriesTemplate))
	mux.Handle("DELETE /api/v1/series-templates/{id}", protect(h.AdminCatalog.DeleteSeriesTemplate))

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
	mux.Handle("POST /api/v1/suppliers/{id}/products/activate", protect(h.Suppliers.ActivateSupplierProducts))
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
	mux.Handle("DELETE /api/v1/orders/{id}", protect(h.AdminOrders.DeleteOrder))
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

	mux.Handle("GET /api/v1/indexnow/logs", protect(h.IndexNow.ListLogs))
	mux.Handle("DELETE /api/v1/indexnow/logs", protect(h.IndexNow.ClearLogs))
	mux.Handle("POST /api/v1/indexnow/logs/{id}/retry", protect(h.IndexNow.RetryLog))
	mux.Handle("POST /api/v1/indexnow/submit", protect(h.IndexNow.SubmitManual))
	mux.Handle("POST /api/v1/indexnow/submit-recent-products", protect(h.IndexNow.SubmitRecentProducts))
	mux.Handle("POST /api/v1/indexnow/submit-unnotified", protect(h.IndexNow.SubmitUnnotifiedCatalog))
	mux.Handle("GET /api/v1/translate/stats", protect(h.Translate.ListStats))
	mux.Handle("GET /api/v1/translate/status", protect(h.Translate.GetStatus))
	mux.Handle("POST /api/v1/translate/start", protect(h.Translate.StartJob))
	mux.Handle("POST /api/v1/translate/pause", protect(h.Translate.PauseJob))

	mux.Handle("GET /api/v1/cron/settings", protect(h.Cron.GetSettings))
	mux.Handle("PUT /api/v1/cron/settings", protect(h.Cron.UpdateSettings))
	mux.Handle("POST /api/v1/cron/trigger", protect(h.Cron.TriggerCron))
	mux.Handle("GET /api/v1/cron/logs", protect(h.Cron.GetLogs))

	mux.Handle("GET /api/v1/customers", protect(h.Customers.ListCustomers))
	mux.Handle("GET /api/v1/customers/overview", protect(h.Customers.GetCustomersOverview))
	mux.Handle("POST /api/v1/customers/sync-geo", protect(h.Customers.SyncCustomerGeo))
	mux.Handle("GET /api/v1/customers/{id}/journey", protect(h.Customers.GetCustomerJourney))
	mux.Handle("GET /api/v1/customers/{id}/cart", protect(h.Customers.GetCustomerCart))
	impersonateMW := middleware.RequireRole(models.RoleAdmin, models.RoleSalesManager)
	mux.Handle("POST /api/v1/customers/{id}/impersonate", authMW(impersonateMW(http.HandlerFunc(h.Customers.ImpersonateCustomer))))
	mux.Handle("PUT /api/v1/customers/{id}/block", protect(h.Customers.ToggleBlockCustomer))
	mux.Handle("DELETE /api/v1/customers/{id}", protect(h.Customers.DeleteCustomer))
	mux.Handle("GET /api/v1/admin/member-journeys", protect(h.Customers.ListMemberJourneys))
	mux.Handle("GET /api/v1/analytics/stats", protect(h.Analytics.GetAnalyticsStats))
	mux.Handle("GET /api/v1/admin/analytics/stats", protect(h.Analytics.GetAnalyticsStats))
	mux.Handle("GET /api/v1/analytics/bi-mining", protect(h.Analytics.GetBIMiningReport))
	mux.Handle("GET /api/v1/admin/analytics/bi-mining", protect(h.Analytics.GetBIMiningReport))
	mux.Handle("GET /api/v1/analytics/whatsapp-clicks", protect(h.Analytics.GetAdminWhatsappClicks))
	mux.Handle("GET /api/v1/admin/analytics/whatsapp-clicks", protect(h.Analytics.GetAdminWhatsappClicks))
	mux.Handle("GET /api/v1/analytics/traffic-sources", protect(h.Analytics.GetTrafficSourcesReport))
	mux.Handle("GET /api/v1/admin/analytics/traffic-sources", protect(h.Analytics.GetTrafficSourcesReport))
	mux.Handle("GET /api/v1/admin/dashboard/stats", protect(h.AdminDashboard.GetDashboardStats))

	mux.Handle("GET /api/v1/admin/notifications/settings", protect(h.AdminNotifications.GetSettings))
	mux.Handle("PUT /api/v1/admin/notifications/settings", protect(h.AdminNotifications.UpdateSettings))
	mux.Handle("GET /api/v1/admin/notifications/digest-preview", protect(h.AdminNotifications.GetDigestPreview))
	mux.Handle("POST /api/v1/admin/notifications/send-digest-now", protect(h.AdminNotifications.SendDigestNow))
	mux.Handle("POST /api/v1/admin/notifications/test", protect(h.AdminNotifications.SendTestNotification))

	mux.Handle("GET /api/v1/admin/marketplace/sub-orders", protect(h.Marketplace.ListAdminSubOrders))
	mux.Handle("GET /api/v1/admin/marketplace/payouts", protect(h.Marketplace.ListAdminPayoutRequests))
	mux.Handle("PUT /api/v1/admin/marketplace/payouts/{id}", protect(h.Marketplace.ProcessAdminPayoutRequest))
	mux.Handle("GET /api/v1/admin/marketplace/api-keys", protect(h.Marketplace.ListB2BApiKeys))
	mux.Handle("POST /api/v1/admin/marketplace/api-keys", protect(h.Marketplace.CreateB2BApiKey))
	mux.Handle("DELETE /api/v1/admin/marketplace/api-keys/{id}", protect(h.Marketplace.RevokeB2BApiKey))
	mux.Handle("GET /api/v1/admin/billing/overview", protect(h.Marketplace.GetAdminBillingOverview))
	mux.Handle("PUT /api/v1/admin/billing/subscriptions/{brand_id}", protect(h.Marketplace.UpdateAdminSupplierSubscription))
	mux.Handle("POST /api/v1/admin/billing/invoices", protect(h.Marketplace.CreateAdminSupplierInvoice))
	mux.Handle("POST /api/v1/admin/billing/payments", protect(h.Marketplace.RecordAdminSupplierPayment))
	mux.Handle("PUT /api/v1/admin/billing/payments/{id}/status", protect(h.Marketplace.ProcessAdminSupplierPayment))
	mux.Handle("GET /api/v1/admin/rfqs", protect(h.Marketplace.ListAdminRfqs))
	mux.Handle("PUT /api/v1/admin/rfqs/{id}/status", protect(h.Marketplace.UpdateAdminRfqStatus))
	mux.Handle("DELETE /api/v1/admin/rfqs/{id}", protect(h.Marketplace.DeleteAdminRfq))
	mux.Handle("GET /api/v1/admin/sponsored-slots", protect(h.Marketplace.ListAdminSponsoredSlots))
	mux.Handle("POST /api/v1/admin/sponsored-slots", protect(h.Marketplace.CreateAdminSponsoredSlot))
	mux.Handle("PUT /api/v1/admin/sponsored-slots/{id}", protect(h.Marketplace.UpdateAdminSponsoredSlot))
	mux.Handle("DELETE /api/v1/admin/sponsored-slots/{id}", protect(h.Marketplace.DeleteAdminSponsoredSlot))
	mux.Handle("GET /api/v1/admin/newsletter/overview", protect(h.Marketplace.GetAdminNewsletterOverview))
	mux.Handle("DELETE /api/v1/admin/newsletter/subscribers/{id}", protect(h.Marketplace.DeleteAdminNewsletterSubscriber))
	mux.Handle("POST /api/v1/admin/newsletter/campaigns", protect(h.Marketplace.CreateAdminNewsletterCampaign))
	mux.Handle("GET /api/v1/admin/service-providers", protect(h.Marketplace.ListAdminServiceProviders))
	mux.Handle("PUT /api/v1/admin/service-providers/{id}", protect(h.Marketplace.UpdateAdminServiceProvider))
	mux.Handle("DELETE /api/v1/admin/service-providers/{id}", protect(h.Marketplace.DeleteAdminServiceProvider))
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
	mux.Handle("PUT /api/v1/supplier/profile", protect(h.SupplierPortal.UpdateProfile))
	mux.Handle("PATCH /api/v1/supplier/profile", protect(h.SupplierPortal.UpdateProfile))
	mux.Handle("GET /api/v1/supplier/products", protect(h.SupplierPortal.ListProducts))
	mux.Handle("GET /api/v1/supplier/products/excel-template", protect(h.SupplierPortal.DownloadExcelTemplate))
	mux.Handle("POST /api/v1/supplier/products/import-excel", protect(h.SupplierPortal.ImportProductsFromExcel))
	mux.Handle("POST /api/v1/supplier/products/batch-drafts", protect(h.SupplierPortal.BatchCreateDraftProducts))
	mux.Handle("POST /api/v1/supplier/products/bulk-archive", protect(h.SupplierPortal.BulkArchiveProducts))
	mux.Handle("POST /api/v1/supplier/products/{id}/archive", protect(h.SupplierPortal.ToggleArchiveProduct))
	mux.Handle("GET /api/v1/supplier/products/{id}/siblings", protect(h.SupplierPortal.ListProductSiblings))
	mux.Handle("POST /api/v1/supplier/products/{id}/siblings", protect(h.SupplierPortal.LinkProductSiblings))
	mux.Handle("DELETE /api/v1/supplier/products/{id}/siblings/{targetId}", protect(h.SupplierPortal.UnlinkProductSibling))
	mux.Handle("GET /api/v1/supplier/products/{id}", protect(h.SupplierPortal.GetProduct))
	mux.Handle("GET /api/v1/supplier/products/{id}/translations", protect(h.SupplierPortal.GetProductTranslations))
	mux.Handle("PUT /api/v1/supplier/products/{id}/translations", protect(h.SupplierPortal.UpdateProductTranslations))
	mux.Handle("POST /api/v1/supplier/translate", protect(h.SupplierPortal.AutoTranslateFields))
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
	mux.Handle("GET /api/v1/supplier/billing", protect(h.Marketplace.GetSupplierBilling))
	mux.Handle("PUT /api/v1/supplier/billing/tax-info", protect(h.Marketplace.UpdateSupplierBillingTaxInfo))
	mux.Handle("POST /api/v1/supplier/billing/payments", protect(h.Marketplace.CreateSupplierSubscriptionPayment))
	mux.Handle("GET /api/v1/supplier/analytics", protect(h.Analytics.GetSupplierBrandAnalytics))
	mux.Handle("GET /api/v1/supplier/rfqs", protect(h.Marketplace.ListSupplierRfqs))
	mux.Handle("POST /api/v1/supplier/rfqs/{id}/offers", protect(h.Marketplace.SubmitSupplierRfqOffer))
}

func registerMobileRoutes(mux *http.ServeMux, h *AppHandlers, supplierMW func(http.Handler) http.Handler) {
	protectSupplier := func(fn http.HandlerFunc) http.Handler {
		return supplierMW(fn)
	}
	challengeLimiter := middleware.StrictRateLimitMiddleware("mobile_challenge", 30)
	mobileFormLimiter := middleware.StrictRateLimitMiddleware("mobile_public_forms", 8)

	mux.HandleFunc("GET /api/v1/mobile/bootstrap", h.Mobile.Bootstrap)
	mux.Handle("GET /api/v1/mobile/challenge", challengeLimiter(http.HandlerFunc(h.Mobile.GetChallenge)))
	mux.HandleFunc("GET /api/v1/mobile/version", h.Mobile.GetVersion)
	mux.HandleFunc("GET /api/v1/mobile/apk", h.Mobile.DownloadApk)
	mux.HandleFunc("HEAD /api/v1/mobile/apk", h.Mobile.DownloadApk)
	mux.HandleFunc("GET /api/v1/mobile/apk/download", h.Mobile.DownloadApk)
	mux.HandleFunc("HEAD /api/v1/mobile/apk/download", h.Mobile.DownloadApk)
	mux.HandleFunc("POST /api/v1/mobile/auth/login", h.Mobile.Login)
	mux.Handle("POST /api/v1/mobile/auth/register", mobileFormLimiter(http.HandlerFunc(h.Mobile.Register)))
	mux.Handle("POST /api/v1/mobile/supplier-applications", mobileFormLimiter(http.HandlerFunc(h.Mobile.SubmitSupplierApplication)))
	mux.Handle("POST /api/v1/mobile/service-providers", mobileFormLimiter(http.HandlerFunc(h.Mobile.CreateServiceProviderApplication)))
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

