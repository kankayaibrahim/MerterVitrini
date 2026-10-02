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
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Slug      string     `json:"slug"`
	AliasCode *string    `json:"alias_code,omitempty"`
	Website   *string    `json:"website,omitempty"`
	Phone     *string    `json:"phone,omitempty"`
	Addresses []any      `json:"addresses,omitempty"`
	IsActive  bool       `json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	Feeds     []*XmlFeed `json:"feeds,omitempty"`
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
	Gender               *string              `json:"gender,omitempty"`
	Season               *string              `json:"season,omitempty"`
	KumasFabric          *string              `json:"kumas_fabric,omitempty"`
	DesiVolume           float64              `json:"desi_volume"`
	ShippingWeightKg     float64              `json:"shipping_weight_kg"`
	PackingRatio         *string              `json:"packing_ratio,omitempty"`
	SeriesRatio          *string              `json:"series_ratio,omitempty"`
	MinimumOrderQty      int                  `json:"minimum_order_quantity"`
	Price                float64              `json:"price,omitempty"`
	DiscountedPrice      *float64             `json:"discounted_price,omitempty"`
	SinglePrice          *float64             `json:"single_price,omitempty"`
	BuyingPrice          *float64             `json:"buying_price,omitempty"`
	Currency             string               `json:"currency,omitempty"`
	TaxRate              float64              `json:"tax_rate,omitempty"`
	Color                *string              `json:"color,omitempty"`
	Stock                int                  `json:"stock,omitempty"`
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
	CategoryTitle        *string              `json:"category_title,omitempty"`
	SourceURL            *string              `json:"source_url,omitempty"`
	Translations         map[string]any       `json:"translations,omitempty"`
	ColorVariants        []*SiblingProduct    `json:"color_variants,omitempty"`
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
	Price           float64    `json:"price,omitempty"`
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
	ID              string    `json:"id"`
	Address         string    `json:"address"`
	Phone           string    `json:"phone"`
	Whatsapp        string    `json:"whatsapp"`
	Email           string    `json:"email"`
	ShowSinglePrice bool      `json:"show_single_price"`
	UpdatedAt       time.Time `json:"updated_at"`
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
	Title           string  `json:"title"`
	Summary         *string `json:"summary,omitempty"`
	Content         string  `json:"content"`
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
