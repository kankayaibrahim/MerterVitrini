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

// --- Catalog Domain Models ---

type Category struct {
	ID        string    `json:"id"`
	ParentID  *string   `json:"parent_id,omitempty"`
	Title     string    `json:"title"`
	Slug      string    `json:"slug"`
	NodePath  string    `json:"node_path"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CategoryNode struct {
	ID       string          `json:"id"`
	ParentID *string         `json:"parent_id,omitempty"`
	Title    string          `json:"title"`
	Slug     string          `json:"slug"`
	NodePath string          `json:"node_path"`
	IsActive bool            `json:"is_active"`
	Children []*CategoryNode `json:"children"`
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
	ID                  string            `json:"id"`
	FeedID              *string           `json:"feed_id,omitempty"`
	SourceProductID     string            `json:"source_product_id"`
	Title               string            `json:"title"`
	Slug                string            `json:"slug"`
	SlugID              string            `json:"slug_id"`
	CustomSku           string            `json:"custom_sku"`
	ShortDescription    *string           `json:"short_description,omitempty"`
	Description         *string           `json:"description,omitempty"`
	BrandID             *string           `json:"brand_id,omitempty"`
	CategoryID          *string           `json:"category_id,omitempty"`
	Gender              *string           `json:"gender,omitempty"`
	Season              *string           `json:"season,omitempty"`
	KumasFabric         *string           `json:"kumas_fabric,omitempty"`
	DesiVolume          float64           `json:"desi_volume"`
	ShippingWeightKg    float64           `json:"shipping_weight_kg"`
	PackingRatio        *string           `json:"packing_ratio,omitempty"`
	SeriesRatio         *string           `json:"series_ratio,omitempty"`
	MinimumOrderQty     int               `json:"minimum_order_quantity"`
	IsActive            bool              `json:"is_active"`
	LastSyncRunID       *string           `json:"last_sync_run_id,omitempty"`
	CreatedAt           time.Time         `json:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at"`
	MetaAttributes      map[string]any    `json:"meta_attributes,omitempty"`
	Variants            []*ProductVariant `json:"variants,omitempty"`
	Images              []*ProductImage   `json:"images,omitempty"`
	BrandName           *string           `json:"brand_name,omitempty"`
	CategoryTitle       *string           `json:"category_title,omitempty"`
	SourceURL           *string           `json:"source_url,omitempty"`
	SourceProductGroupID string            `json:"source_product_group_id,omitempty"`
	GroupProducts       []*GroupProductColor `json:"group_products,omitempty"`
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
	Sku             string     `json:"sku"`
	CustomSku       string     `json:"custom_sku"`
	Barcode         *string    `json:"barcode,omitempty"`
	Stock           int        `json:"stock"`
	Price           float64    `json:"price"`
	DiscountedPrice *float64   `json:"discounted_price,omitempty"`
	TaxRate         float64    `json:"tax_rate"`
	Currency        string     `json:"currency"`
	Color           *string    `json:"color,omitempty"`
	Size            *string    `json:"size,omitempty"`
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

// --- API Request/Response Structs ---

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

type UserInfo struct {
	ID        string   `json:"id"`
	FirstName string   `json:"first_name"`
	LastName  string   `json:"last_name"`
	Email     string   `json:"email"`
	Role      UserRole `json:"role"`
}

type CategoryTranslation struct {
	CategoryID   string `json:"category_id"`
	LanguageCode string `json:"language_code"`
	Title        string `json:"title"`
}

type ProductTranslation struct {
	ProductID        string  `json:"product_id"`
	LanguageCode     string  `json:"language_code"`
	Title            string  `json:"title"`
	ShortDescription *string `json:"short_description,omitempty"`
	Description      *string `json:"description,omitempty"`
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

// --- Geographic / Localization Models ---

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



