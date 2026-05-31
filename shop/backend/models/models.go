package models

import (
	"time"
)

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
	ID             string                    `json:"id"`
	ParentID       *string                   `json:"parent_id,omitempty"`
	Title          string                    `json:"title"`
	Slug           string                    `json:"slug"`
	NodePath       string                    `json:"node_path"`
	IsActive       bool                      `json:"is_active"`
	TotalProducts  int                       `json:"total_products"`
	ActiveProducts int                       `json:"active_products"`
	Children       []*CategoryNode           `json:"children"`
	Translations   map[string]map[string]any `json:"translations,omitempty"`
}

type Brand struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	AliasCode *string   `json:"alias_code,omitempty"`
	Website   *string   `json:"website,omitempty"`
	Phone     *string   `json:"phone,omitempty"`
	Addresses []any     `json:"addresses,omitempty"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Product struct {
	ID                  string            `json:"id"`
	FeedID              *string           `json:"-"`
	SourceProductID     string            `json:"source_product_id"`
	SourceProductGroupID *string          `json:"source_product_group_id,omitempty"`
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
	Price               float64           `json:"price"`
	DiscountedPrice     *float64          `json:"discounted_price,omitempty"`
	SinglePrice         *float64          `json:"single_price,omitempty"`
	BuyingPrice         *float64          `json:"buying_price,omitempty"`
	Currency            string            `json:"currency"`
	TaxRate             float64           `json:"tax_rate"`
	Color               *string           `json:"color,omitempty"`
	Stock               int               `json:"stock"`
	Sku                 *string           `json:"sku,omitempty"`
	Barcode             *string           `json:"barcode,omitempty"`
	IsActive            bool              `json:"is_active"`
	CreatedAt           time.Time         `json:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at"`
	MetaAttributes      map[string]any    `json:"meta_attributes,omitempty"`
	Attributes          []*ProductAttribute `json:"attributes,omitempty"`
	Variants            []*ProductVariant `json:"variants,omitempty"`
	Images              []*ProductImage   `json:"images,omitempty"`
	BrandName           *string           `json:"brand_name,omitempty"`
	CategoryTitle       *string           `json:"category_title,omitempty"`
	Translations        map[string]any    `json:"translations,omitempty"` // Localized translations mapped
	ColorVariants       []*SiblingProduct `json:"color_variants,omitempty"`
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

type ProductVariant struct {
	ID              string    `json:"id"`
	ProductID       string    `json:"product_id"`
	SourceVariantID string    `json:"source_variant_id"`
	CustomSku       string    `json:"custom_sku"`
	Barcode         *string   `json:"barcode,omitempty"`
	Stock           int       `json:"stock"`
	Size            *string   `json:"size,omitempty"`
	IsSingle        bool      `json:"is_single"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type ProductImage struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	ImageUrl  string    `json:"image_url"`
	SortOrder int       `json:"sort_order"`
	IsCover   bool      `json:"is_cover"`
	CreatedAt time.Time `json:"created_at"`
}

type B2bInquiry struct {
	ID        string         `json:"id"`
	FullName  string         `json:"full_name"`
	Company   *string        `json:"company,omitempty"`
	Phone     string         `json:"phone"`
	Email     string         `json:"email"`
	Message   *string        `json:"message,omitempty"`
	Items     []InquiryItem  `json:"items"`
	CreatedAt time.Time      `json:"created_at"`
}

type InquiryItem struct {
	ProductID   string  `json:"product_id"`
	Title       string  `json:"title"`
	CustomSku   string  `json:"custom_sku"`
	Quantity    int     `json:"quantity"` // Count in pack/boxes
	Price       float64 `json:"price"`
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

type Language struct {
	Code           string `json:"code"`
	Label          string `json:"label"`
	Flag           string `json:"flag"`
	CategoryPrefix string `json:"categoryPrefix"`
	Dir            string `json:"dir,omitempty"`
	IsActive       bool   `json:"isActive"`
	SortOrder      int    `json:"sortOrder"`
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

type ExchangeRate struct {
	ID              string    `json:"id"`
	CurrencyCode    string    `json:"currency_code"`
	BuyingRate      float64   `json:"buying_rate"`
	SellingRate     float64   `json:"selling_rate"`
	PublicationDate time.Time `json:"publication_date"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
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



