package models

import (
	"time"
)

// --- Identity Domain Models ---

type UserRole string

const (
	RoleSuperAdmin   UserRole = "super_admin"
	RoleAdmin        UserRole = "admin"
	RoleEditor       UserRole = "editor"
	RoleSalesManager UserRole = "sales_manager"
	RoleWarehouse    UserRole = "warehouse"
	RoleCustomer     UserRole = "customer"
)

type User struct {
	ID                  string     `json:"id"`
	FirstName           string     `json:"first_name"`
	LastName            string     `json:"last_name"`
	Email               string     `json:"email"`
	PasswordHash        string     `json:"-"`
	Role                UserRole   `json:"role"`
	IsActive            bool       `json:"is_active"`
	IsBlocked           bool       `json:"is_blocked"`
	FailedLoginAttempts int        `json:"failed_login_attempts"`
	BlockReason         *string    `json:"block_reason,omitempty"`
	LastLoginAt         *time.Time `json:"last_login_at,omitempty"`
	LastLoginIP         *string    `json:"last_login_ip,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type UserOtp struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id"`
	OtpCode      string     `json:"otp_code"`
	Purpose      string     `json:"purpose"`
	IsUsed       bool       `json:"is_used"`
	AttemptCount int        `json:"attempt_count"`
	MaxAttempts  int        `json:"max_attempts"`
	ExpiresAt    time.Time  `json:"expires_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UsedAt       *time.Time `json:"used_at,omitempty"`
}

type UserInfo struct {
	ID        string   `json:"id"`
	FirstName string   `json:"first_name"`
	LastName  string   `json:"last_name"`
	Email     string   `json:"email"`
	Role      UserRole `json:"role"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type VerifyOtpRequest struct {
	UserID  string `json:"user_id"`
	OtpCode string `json:"otp_code"`
}

type AuthResponse struct {
	RequireOtp bool      `json:"require_otp"`
	UserID     string    `json:"user_id,omitempty"`
	Token      string    `json:"token,omitempty"`
	IDToken    string    `json:"id_token,omitempty"`
	User       *UserInfo `json:"user,omitempty"`
}

// --- Catalog Domain Models ---

type Category struct {
	ID           string                         `json:"id"`
	ParentID     *string                        `json:"parent_id,omitempty"`
	Title        string                         `json:"title"`
	Slug         string                         `json:"slug"`
	NodePath     string                         `json:"node_path"`
	IsActive     bool                           `json:"is_active"`
	Translations map[string]CategoryTranslation `json:"translations,omitempty"`
	CreatedAt    time.Time                      `json:"created_at"`
	UpdatedAt    time.Time                      `json:"updated_at"`
}

type CategoryTranslation struct {
	CategoryID     string  `json:"category_id"`
	LanguageCode   string  `json:"language_code"`
	Title          string  `json:"title"`
	SeoDescription *string `json:"seo_description,omitempty"`
}

type CategoryNode struct {
	ID             string                         `json:"id"`
	ParentID       *string                        `json:"parent_id,omitempty"`
	Title          string                         `json:"title"`
	Slug           string                         `json:"slug"`
	NodePath       string                         `json:"node_path"`
	IsActive       bool                           `json:"is_active"`
	TotalProducts  int                            `json:"total_products,omitempty"`
	ActiveProducts int                            `json:"active_products,omitempty"`
	Translations   map[string]CategoryTranslation `json:"translations,omitempty"`
	Children       []*CategoryNode                `json:"children"`
}

type Brand struct {
	ID                   string     `json:"id"`
	Name                 string     `json:"name"`
	Slug                 string     `json:"slug"`
	AliasCode            *string    `json:"alias_code,omitempty"`
	CompanyType          string     `json:"company_type"`
	Description             string            `json:"description"`
	DescriptionTranslations map[string]string `json:"description_translations,omitempty"`
	Website                 *string           `json:"website,omitempty"`
	Phone                *string    `json:"phone,omitempty"`
	LandlinePhone        string     `json:"landline_phone"`
	WhatsappPhone        string     `json:"whatsapp_phone"`
	PublicEmail          string     `json:"public_email"`
	InstagramHandle      string     `json:"instagram_handle"`
	City                 string     `json:"city"`
	District             string     `json:"district"`
	LocationAddress      string     `json:"location_address"`
	ExportCountries      string     `json:"export_countries"`
	MinOrderQuantity     int        `json:"min_order_quantity"`
	SupportsPrivateLabel bool       `json:"supports_private_label"`
	SupportsFason        bool       `json:"supports_fason"`
	IsVerified           bool       `json:"is_verified"`
	WhatsappOnlyOrdering bool       `json:"whatsapp_only_ordering"`
	BankName             string     `json:"bank_name"`
	BankAccountHolder    string     `json:"bank_account_holder"`
	IBAN                 string     `json:"iban"`
	ActiveProductCount   int        `json:"active_product_count"`
	Addresses            []any      `json:"addresses,omitempty"`
	IsActive             bool       `json:"is_active"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
	Feeds                []*XmlFeed `json:"feeds,omitempty"`
}

type Product struct {
	ID                   string               `json:"id"`
	FeedID               *string              `json:"feed_id,omitempty"`
	SourceProductID      string               `json:"source_product_id"`
	SourceProductGroupID *string              `json:"source_product_group_id,omitempty"`
	Title                string               `json:"title"`
	Slug                 string               `json:"slug"`
	SlugID               string               `json:"slug_id"`
	CustomSku            string               `json:"custom_sku"`
	ShortDescription     *string              `json:"short_description,omitempty"`
	Description          *string              `json:"description,omitempty"`
	BrandID              *string              `json:"brand_id,omitempty"`
	CategoryID           *string              `json:"category_id,omitempty"`
	ColorID              *string              `json:"color_id,omitempty"`
	FabricID             *string              `json:"fabric_id,omitempty"`
	Gender               *string              `json:"gender,omitempty"`
	Season               *string              `json:"season,omitempty"`
	KumasFabric          *string              `json:"kumas_fabric,omitempty"`
	DesiVolume           float64              `json:"desi_volume"`
	ShippingWeightKg     float64              `json:"shipping_weight_kg"`
	PackingRatio         *string              `json:"packing_ratio,omitempty"`
	SeriesRatio          *string              `json:"series_ratio,omitempty"`
	MinimumOrderQty      int                  `json:"minimum_order_quantity"`
	Price                float64              `json:"price"`
	DiscountedPrice      *float64             `json:"discounted_price,omitempty"`
	SinglePrice          *float64             `json:"single_price,omitempty"`
	BuyingPrice          *float64             `json:"buying_price,omitempty"`
	Currency             string               `json:"currency,omitempty"`
	TaxRate              float64              `json:"tax_rate,omitempty"`
	Color                *string              `json:"color,omitempty"`
	Stock                int                  `json:"stock,omitempty"`
	SeriesStock          int                  `json:"series_stock,omitempty"`
	Sku                  *string              `json:"sku,omitempty"`
	Barcode              *string              `json:"barcode,omitempty"`
	IsActive             bool                 `json:"is_active"`
	LastSyncRunID        *string              `json:"last_sync_run_id,omitempty"`
	CreatedAt            time.Time            `json:"created_at"`
	UpdatedAt            time.Time            `json:"updated_at"`
	MetaAttributes       map[string]any       `json:"meta_attributes,omitempty"`
	Attributes           []*ProductAttribute  `json:"attributes,omitempty"`
	Variants             []*ProductVariant    `json:"variants,omitempty"`
	Images               []*ProductImage      `json:"images,omitempty"`
	BrandName            *string              `json:"brand_name,omitempty"`
	BrandProfile         *Brand               `json:"brand_profile,omitempty"`
	CategoryTitle        *string              `json:"category_title,omitempty"`
	SourceURL            *string              `json:"source_url,omitempty"`
	SeoTitle             *string              `json:"seo_title,omitempty"`
	SeoDescription       *string              `json:"seo_description,omitempty"`
	AiHighlights         []string             `json:"ai_highlights,omitempty"`
	Translations         map[string]any       `json:"translations,omitempty"`
	ColorVariants        []*SiblingProduct    `json:"color_variants,omitempty"`
	SupplierSiblings     []SupplierSiblingItem `json:"supplier_siblings,omitempty"`
	GroupProducts        []*GroupProductColor `json:"group_products,omitempty"`
}

type SiblingProduct struct {
	ID        string `json:"id"`
	CustomSku string `json:"custom_sku"`
	Slug      string `json:"slug"`
	SlugID    string `json:"slug_id"`
	Color     string `json:"color"`
	ImageUrl  string `json:"image_url"`
}

type SupplierColorVariantDraftInput struct {
	ColorID  *string  `json:"color_id,omitempty"`
	Title    string   `json:"title,omitempty"`
	Price    *float64 `json:"price,omitempty"`
	Images   []string `json:"images"`
	IsActive *bool    `json:"is_active,omitempty"`
}

type SupplierSiblingItem struct {
	ID                   string  `json:"id"`
	Title                string  `json:"title"`
	CustomSKU            string  `json:"custom_sku"`
	Slug                 string  `json:"slug"`
	ColorID              *string `json:"color_id,omitempty"`
	Color                string  `json:"color"`
	ImageUrl             string  `json:"image_url"`
	Price                float64 `json:"price"`
	Currency             string  `json:"currency"`
	IsActive             bool    `json:"is_active"`
	SourceProductGroupID string  `json:"source_product_group_id"`
}

type ProductAttribute struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type GroupProductColor struct {
	ID              string  `json:"id"`
	SourceProductID string  `json:"source_product_id"`
	Color           *string `json:"color"`
	CustomSku       string  `json:"custom_sku"`
	Stock           int     `json:"stock"`
	CoverImageUrl   *string `json:"cover_image_url"`
}

type ProductVariant struct {
	ID              string     `json:"id"`
	ProductID       string     `json:"product_id"`
	SourceVariantID string     `json:"source_variant_id"`
	Sku             string     `json:"sku,omitempty"`
	CustomSku       string     `json:"custom_sku"`
	Barcode         *string    `json:"barcode,omitempty"`
	Stock           int        `json:"stock"`
	Price           float64    `json:"price"`
	DiscountedPrice *float64   `json:"discounted_price,omitempty"`
	TaxRate         float64    `json:"tax_rate,omitempty"`
	Currency        string     `json:"currency,omitempty"`
	Color           *string    `json:"color,omitempty"`
	Size            *string    `json:"size,omitempty"`
	VariantSize     *string    `json:"variant_size,omitempty"`
	IsSingle        bool       `json:"is_single"`
	IsActive        bool       `json:"is_active"`
	LastSyncRunID   *string    `json:"last_sync_run_id,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type ProductImage struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	ImageUrl  string    `json:"image_url"`
	SortOrder int       `json:"sort_order"`
	IsCover   bool      `json:"is_cover"`
	CreatedAt time.Time `json:"created_at"`
}

type ProductTranslation struct {
	ProductID        string  `json:"product_id"`
	LanguageCode     string  `json:"language_code"`
	Title            string  `json:"title"`
	ShortDescription *string `json:"short_description,omitempty"`
	Description      *string `json:"description,omitempty"`
}

// --- Integration Domain Models ---

type XmlFeed struct {
	ID              string         `json:"id"`
	BrandID         *string        `json:"brand_id,omitempty"`
	Name            string         `json:"name"`
	AliasCode       string         `json:"alias_code"`
	FeedUrl         *string        `json:"feed_url,omitempty"`
	MappingConfig   map[string]any `json:"mapping_config,omitempty"`
	CategoryMapping map[string]any `json:"category_mapping,omitempty"`
	IsActive        bool           `json:"is_active"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

type SyncRun struct {
	ID          string         `json:"id"`
	FeedID      string         `json:"feed_id"`
	StartedAt   time.Time      `json:"started_at"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`
	Status      string         `json:"status"` // 'running', 'success', 'failed'
	Summary     map[string]any `json:"summary,omitempty"`
}

type B2bInquiry struct {
	ID        string        `json:"id"`
	FullName  string        `json:"full_name"`
	Company   *string       `json:"company,omitempty"`
	Phone     string        `json:"phone"`
	Email     string        `json:"email"`
	Message   *string       `json:"message,omitempty"`
	Items     []InquiryItem `json:"items"`
	CreatedAt time.Time     `json:"created_at"`
}

type InquiryItem struct {
	ProductID string  `json:"product_id"`
	Title     string  `json:"title"`
	CustomSku string  `json:"custom_sku"`
	Quantity  int     `json:"quantity"`
	Price     float64 `json:"price"`
}

type Settings struct {
	ID                 string    `json:"id"`
	Address            string    `json:"address"`
	Phone              string    `json:"phone"`
	Whatsapp           string    `json:"whatsapp"`
	Email              string    `json:"email"`
	ShowSinglePrice    bool      `json:"show_single_price"`
	ShowPricesToGuests bool      `json:"show_prices_to_guests"`
	RecaptchaEnabled   bool      `json:"recaptcha_enabled"`
	RecaptchaSiteKey   string    `json:"recaptcha_site_key,omitempty"`
	RecaptchaHasSecret bool      `json:"recaptcha_has_secret,omitempty"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// --- Geographic & Localization Models ---

type CountryGroup struct {
	ID        string            `json:"id"`
	Code      string            `json:"code"`
	Names     map[string]string `json:"names"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

type Country struct {
	ID        string            `json:"id"`
	Code      string            `json:"code"`
	PhoneCode *int              `json:"phone_code,omitempty"`
	Names     map[string]string `json:"names"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

type CountryState struct {
	ID        string    `json:"id"`
	CountryID string    `json:"country_id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Currency struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Symbol    string    `json:"symbol"`
	FullName  string    `json:"full_name"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Language struct {
	ID             string    `json:"id"`
	Code           string    `json:"code"`
	Label          string    `json:"label"`
	Flag           string    `json:"flag"`
	CategoryPrefix string    `json:"categoryPrefix"`
	Dir            string    `json:"dir"`
	IsActive       bool      `json:"isActive"`
	SortOrder      int       `json:"sortOrder"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ExchangeRate struct {
	ID              string    `json:"id"`
	CurrencyCode    string    `json:"currency_code"`
	BuyingRate      float64   `json:"buying_rate"`
	SellingRate     float64   `json:"selling_rate"`
	PublicationDate time.Time `json:"publication_date"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// --- Legal Policies & CMS Models ---

type LegalPolicy struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Version   int       `json:"version"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	IsActive  bool      `json:"is_active"`
	CreatedBy *string   `json:"created_by,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PolicyAcceptance struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	PolicyID   string    `json:"policy_id"`
	AcceptedAt time.Time `json:"accepted_at"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
}

type PageTranslation struct {
	Title           string  `json:"title"`
	Content         string  `json:"content"`
	MetaTitle       *string `json:"meta_title,omitempty"`
	MetaDescription *string `json:"meta_description,omitempty"`
}

type Page struct {
	ID           string                     `json:"id"`
	Slug         string                     `json:"slug"`
	IsActive     bool                       `json:"is_active"`
	Translations map[string]PageTranslation `json:"translations"`
	CreatedAt    time.Time                  `json:"created_at"`
	UpdatedAt    time.Time                  `json:"updated_at"`
}

type BlogPostTranslation struct {
	Slug            *string `json:"slug,omitempty"`
	Title           string  `json:"title"`
	Summary         *string `json:"summary,omitempty"`
	Content         string  `json:"content,omitempty"`
	MetaTitle       *string `json:"meta_title,omitempty"`
	MetaDescription *string `json:"meta_description,omitempty"`
}

type BlogPost struct {
	ID           string                         `json:"id"`
	Slug         string                         `json:"slug"`
	CoverImage   *string                        `json:"cover_image,omitempty"`
	IsActive     bool                           `json:"is_active"`
	Translations map[string]BlogPostTranslation `json:"translations"`
	CreatedAt    time.Time                      `json:"created_at"`
	UpdatedAt    time.Time                      `json:"updated_at"`
}

// --- Supplier Portal Models ---

type SupplierUser struct {
	ID              string     `json:"id"`
	BrandID         string     `json:"brand_id"`
	BrandName       string     `json:"brand_name,omitempty"`
	AliasCode       string     `json:"alias_code,omitempty"`
	Email           string     `json:"email"`
	ContactName     string     `json:"contact_name"`
	Phone           *string    `json:"phone,omitempty"`
	JobTitle        string     `json:"job_title"`
	SpokenLanguages string     `json:"spoken_languages"`
	IsOwner         bool       `json:"is_owner"`
	KeycloakID      *string    `json:"keycloak_id,omitempty"`
	IsActive        bool       `json:"is_active"`
	LastLoginAt     *time.Time `json:"last_login_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type SupplierLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SupplierLoginResponse struct {
	Token string        `json:"token"`
	User  *SupplierUser `json:"user"`
}

type CreateSupplierUserRequest struct {
	BrandID         string `json:"brand_id"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	ContactName     string `json:"contact_name"`
	Phone           string `json:"phone,omitempty"`
	JobTitle        string `json:"job_title,omitempty"`
	SpokenLanguages string `json:"spoken_languages,omitempty"`
	IsOwner         bool   `json:"is_owner"`
}

type UpdateSupplierUserRequest struct {
	ContactName     string `json:"contact_name"`
	Phone           string `json:"phone,omitempty"`
	JobTitle        string `json:"job_title,omitempty"`
	SpokenLanguages string `json:"spoken_languages,omitempty"`
	IsOwner         bool   `json:"is_owner"`
	Password        string `json:"password,omitempty"`
	IsActive        bool   `json:"is_active"`
}

type SupplierProductVariantInput struct {
	Size     string  `json:"size"`
	Barcode  string  `json:"barcode,omitempty"`
	Stock    int     `json:"stock"`
	IsSingle bool    `json:"is_single"`
	Price    float64 `json:"price,omitempty"`
}

type SupplierTranslationInput struct {
	Title            string `json:"title"`
	ShortDescription string `json:"short_description,omitempty"`
	Description      string `json:"description,omitempty"`
}

type SizeDefinition struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Label     string    `json:"label"`
	SizeGroup string    `json:"size_group"`
	SortOrder int       `json:"sort_order"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}

type SeriesTemplate struct {
	ID             string    `json:"id"`
	TemplateKey    string    `json:"template_key"`
	Name           string    `json:"name"`
	CategoryHint   string    `json:"category_hint"`
	Sizes          []string  `json:"sizes"`
	SeriesRatio    string    `json:"series_ratio"`
	UnitsPerSeries int       `json:"units_per_series"`
	SortOrder      int       `json:"sort_order"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at,omitempty"`
}

type SupplierProductInput struct {
	Title                   string                              `json:"title"`
	SupplierSKU             *string                             `json:"supplier_sku,omitempty"`
	SKU                     *string                             `json:"sku,omitempty"`
	ShortDescription        string                              `json:"short_description,omitempty"`
	Description             string                              `json:"description,omitempty"`
	CategoryID              string                              `json:"category_id"`
	ColorID                 *string                             `json:"color_id,omitempty"`
	FabricID                *string                             `json:"fabric_id,omitempty"`
	Gender                  string                              `json:"gender,omitempty"`
	Season                  string                              `json:"season,omitempty"`
	BuyingPrice             float64                             `json:"buying_price"`
	Price                   float64                             `json:"price"`
	Currency                string                              `json:"currency"`
	PackingRatio            string                              `json:"packing_ratio,omitempty"`
	SeriesRatio             string                              `json:"series_ratio,omitempty"`
	MinimumOrderQuantity    int                                 `json:"minimum_order_quantity"`
	MinOrderSeries          int                                 `json:"min_order_series,omitempty"`
	SeriesStock             int                                 `json:"series_stock,omitempty"`
	SelectedSizes           []string                            `json:"selected_sizes,omitempty"`
	IsActive                    bool                                `json:"is_active"`
	IsDraft                     *bool                               `json:"is_draft,omitempty"`
	ContentResponsibilityAccepted *bool                             `json:"content_responsibility_accepted,omitempty"`
	SourceProductGroupID        *string                             `json:"source_product_group_id,omitempty"`
	LinkWithProductID       *string                             `json:"link_with_product_id,omitempty"`
	Images                  []string                            `json:"images,omitempty"`
	Variants                []SupplierProductVariantInput       `json:"variants,omitempty"`
	AdditionalColorVariants []SupplierColorVariantDraftInput    `json:"additional_color_variants,omitempty"`
	Translations            map[string]SupplierTranslationInput `json:"translations,omitempty"`
}

type SupplierApplication struct {
	ID                    string     `json:"id"`
	CompanyName           string     `json:"company_name"`
	ContactName           string     `json:"contact_name"`
	Email                 string     `json:"email"`
	Phone                 string     `json:"phone"`
	City                  *string    `json:"city,omitempty"`
	District              *string    `json:"district,omitempty"`
	Category              *string    `json:"category,omitempty"`
	Instagram             *string    `json:"instagram,omitempty"`
	Website               *string    `json:"website,omitempty"`
	Notes                 *string    `json:"notes,omitempty"`
	Status                string     `json:"status"` // 'pending', 'reviewed', 'contacted', 'approved', 'rejected'
	AdminNotes            *string    `json:"admin_notes,omitempty"`
	IPAddress             *string    `json:"ip_address,omitempty"`
	EmailVerified         bool       `json:"email_verified"`
	VerifiedAt            *time.Time `json:"verified_at,omitempty"`
	VerificationExpiresAt *time.Time `json:"verification_expires_at,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type CreateSupplierApplicationRequest struct {
	CompanyName        string `json:"company_name"`
	ContactName        string `json:"contact_name"`
	Email              string `json:"email"`
	Phone              string `json:"phone"`
	City               string `json:"city"`
	District           string `json:"district"`
	Category           string `json:"category,omitempty"`
	Instagram          string `json:"instagram,omitempty"`
	Website            string `json:"website,omitempty"`
	Notes              string `json:"notes,omitempty"`
	LegalTermsAccepted *bool  `json:"legal_terms_accepted,omitempty"`
	ReCaptchaToken     string `json:"recaptcha_token,omitempty"`
	ChallengeToken     string `json:"challenge_token,omitempty"`
	FormChallengeToken string `json:"form_challenge_token,omitempty"`
}

type UpdateSupplierApplicationStatusRequest struct {
	Status     string `json:"status"`
	AdminNotes string `json:"admin_notes,omitempty"`
}

type SupplierSetupPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// B2B Multi-Vendor Marketplace Models

type SupplierWallet struct {
	ID                string    `json:"id"`
	BrandID           string    `json:"brand_id"`
	Currency          string    `json:"currency"`
	PendingBalance    float64   `json:"pending_balance"`
	AvailableBalance  float64   `json:"available_balance"`
	WithdrawnBalance  float64   `json:"withdrawn_balance"`
	CommissionRate    float64   `json:"commission_rate"`
	IBAN              *string   `json:"iban,omitempty"`
	BankName          *string   `json:"bank_name,omitempty"`
	BankAccountHolder *string   `json:"bank_account_holder,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type UpdateSupplierWalletIbanRequest struct {
	IBAN              string `json:"iban"`
	BankName          string `json:"bank_name"`
	BankAccountHolder string `json:"bank_account_holder"`
}

type SupplierSubOrderItem struct {
	ID              string  `json:"id"`
	SubOrderID      string  `json:"sub_order_id"`
	ProductID       string  `json:"product_id"`
	ProductName     string  `json:"product_name"`
	ProductSKU      string  `json:"product_sku"`
	SupplierSKU     string  `json:"supplier_sku,omitempty"`
	Quantity        int     `json:"quantity"`
	PriceAtPurchase float64 `json:"price_at_purchase"`
	TotalPrice      float64 `json:"total_price"`
	Currency        string  `json:"currency"`
	ImageURL        *string `json:"image_url,omitempty"`
	SeriesRatio     *string `json:"series_ratio,omitempty"`
}

type SupplierSubOrder struct {
	ID               string                 `json:"id"`
	OrderID          string                 `json:"order_id"`
	BrandID          string                 `json:"brand_id"`
	BrandName        string                 `json:"brand_name,omitempty"`
	SubOrderNumber   string                 `json:"sub_order_number"`
	GrossAmount      float64                `json:"gross_amount"`
	CommissionRate   float64                `json:"commission_rate"`
	CommissionAmount float64                `json:"commission_amount"`
	NetPayoutAmount  float64                `json:"net_payout_amount"`
	Currency         string                 `json:"currency"`
	Status           string                 `json:"status"` // PENDING, ACCEPTED, PREPARING, SENT_TO_HUB, DELIVERED, CANCELLED
	TrackingCompany  *string                `json:"tracking_company,omitempty"`
	TrackingNumber   *string                `json:"tracking_number,omitempty"`
	Notes            *string                `json:"notes,omitempty"`
	CustomerName     string                 `json:"customer_name,omitempty"`
	CustomerCompany  string                 `json:"customer_company,omitempty"`
	CustomerPhone         string                 `json:"customer_phone,omitempty"`
	CustomerEmail         string                 `json:"customer_email,omitempty"`
	CustomerEmailVerified bool                   `json:"customer_email_verified"`
	DeliveryAddress       string                 `json:"delivery_address,omitempty"`
	BillingAddress   string                 `json:"billing_address,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	Items            []SupplierSubOrderItem `json:"items,omitempty"`
}

type SupplierDirectOrderItem struct {
	ProductID       string  `json:"product_id"`
	Title           string  `json:"title"`
	CustomSku       string  `json:"custom_sku"`
	SupplierSku     string  `json:"supplier_sku,omitempty"`
	PackagesQty     int     `json:"packages_qty"`
	PiecesQty       int     `json:"pieces_qty"`
	UnitsPerPackage int     `json:"units_per_package"`
	UnitPrice       float64 `json:"unit_price"`
	TotalPrice      float64 `json:"total_price"`
	Currency        string  `json:"currency"`
}

type SupplierDirectOrderSummary struct {
	SubOrderID        string                    `json:"sub_order_id"`
	SubOrderNumber    string                    `json:"sub_order_number"`
	BrandID           string                    `json:"brand_id"`
	BrandName         string                    `json:"brand_name"`
	BrandSlug         string                    `json:"brand_slug,omitempty"`
	BrandCity         string                    `json:"brand_city,omitempty"`
	BrandDistrict     string                    `json:"brand_district,omitempty"`
	BrandVerified     bool                      `json:"brand_verified"`
	GrossAmount       float64                   `json:"gross_amount"`
	Currency          string                    `json:"currency"`
	WhatsappPhone     string                    `json:"whatsapp_phone"`
	Phone             string                    `json:"phone"`
	PublicEmail       string                    `json:"public_email"`
	LocationAddress   string                    `json:"location_address"`
	BankName          string                    `json:"bank_name"`
	BankAccountHolder string                    `json:"bank_account_holder"`
	IBAN              string                    `json:"iban"`
	WhatsappURL       string                    `json:"whatsapp_url"`
	ItemCount         int                       `json:"item_count"`
	TotalPackages     int                       `json:"total_packages"`
	TotalPieces       int                       `json:"total_pieces"`
	Items             []SupplierDirectOrderItem `json:"items,omitempty"`
}

type UpdateSubOrderStatusRequest struct {
	Status          string `json:"status"`
	TrackingCompany string `json:"tracking_company,omitempty"`
	TrackingNumber  string `json:"tracking_number,omitempty"`
	Notes           string `json:"notes,omitempty"`
}

type SupplierLedgerEntry struct {
	ID              string    `json:"id"`
	BrandID         string    `json:"brand_id"`
	SubOrderID      *string   `json:"sub_order_id,omitempty"`
	PayoutRequestID *string   `json:"payout_request_id,omitempty"`
	TransactionType string    `json:"transaction_type"`
	Amount          float64   `json:"amount"`
	BalanceAfter    float64   `json:"balance_after"`
	Currency        string    `json:"currency"`
	Description     string    `json:"description"`
	CreatedAt       time.Time `json:"created_at"`
}

type SupplierPayoutRequest struct {
	ID            string     `json:"id"`
	BrandID       string     `json:"brand_id"`
	BrandName     string     `json:"brand_name,omitempty"`
	Amount        float64    `json:"amount"`
	Currency      string     `json:"currency"`
	Status        string     `json:"status"` // PENDING, APPROVED, REJECTED, TRANSFERRED
	IBAN          string     `json:"iban"`
	BankName      *string    `json:"bank_name,omitempty"`
	AccountHolder string     `json:"account_holder"`
	AdminNotes    *string    `json:"admin_notes,omitempty"`
	ProcessedAt   *time.Time `json:"processed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type CreatePayoutRequestInput struct {
	Amount float64 `json:"amount"`
}

type ProcessPayoutRequestInput struct {
	Status     string `json:"status"` // APPROVED, REJECTED, TRANSFERRED
	AdminNotes string `json:"admin_notes,omitempty"`
}

type B2BApiKey struct {
	ID                string     `json:"id"`
	ClientName        string     `json:"client_name"`
	APIKey            string     `json:"api_key"`
	MarginRate        float64    `json:"margin_rate"`
	Currency          string     `json:"currency"`
	IsActive          bool       `json:"is_active"`
	AllowedCategories []string   `json:"allowed_categories,omitempty"`
	RateLimitMinute   int        `json:"rate_limit_minute"`
	ExpiresAt         *time.Time `json:"expires_at,omitempty"`
	LastUsedAt        *time.Time `json:"last_used_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type CreateB2BApiKeyRequest struct {
	ClientName        string   `json:"client_name"`
	MarginRate        float64  `json:"margin_rate"`
	Currency          string   `json:"currency"`
	AllowedCategories []string `json:"allowed_categories,omitempty"`
}

