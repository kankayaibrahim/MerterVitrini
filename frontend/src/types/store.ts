export interface ProductImage {
  id: string;
  image_url: string;
  is_cover: boolean;
}

export interface ProductVariant {
  id: string;
  size?: string;
  barcode?: string;
  stock?: number;
  is_single: boolean;
  custom_sku?: string;
}

export interface ProductAttribute {
  name: string;
  value: string;
}

export interface Translation {
  title?: string;
  description?: string;
  attributes?: ProductAttribute[];
}

export interface ProductTranslations {
  [lang: string]: Translation;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  short_description?: string;
  brand_id: string;
  category_id?: string;
  brand_name?: string;
  brand_profile?: Brand;
  source_product_id?: string;
  source_product_group_id?: string;
  custom_sku?: string;
  packing_ratio?: string;
  series_ratio?: string;
  minimum_order_quantity: number;
  shipping_weight_kg?: number;
  desi_volume?: number;
  gender?: string;
  season?: string;
  kumas_fabric?: string;
  price: number;
  discounted_price: number;
  single_price?: number;
  buying_price?: number;
  currency?: string;
  tax_rate?: number;
  color?: string;
  stock?: number;
  sku?: string;
  barcode?: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  attributes?: ProductAttribute[];
  translations?: ProductTranslations;
  color_variants?: SiblingProduct[];
  slug?: string;
  slug_id?: string;
}

export interface SiblingProduct {
  id: string;
  custom_sku: string;
  slug: string;
  slug_id: string;
  color: string;
  image_url: string;
}

export interface BrandAddress {
  id?: string;
  title?: string;
  city?: string;
  district?: string;
  text?: string;
  coordinates?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug?: string;
  alias_code?: string;
  company_type?: string;
  description?: string;
  website?: string;
  phone?: string;
  landline_phone?: string;
  whatsapp_phone?: string;
  public_email?: string;
  instagram_handle?: string;
  city?: string;
  district?: string;
  location_address?: string;
  addresses?: BrandAddress[];
  export_countries?: string;
  min_order_quantity?: number;
  supports_private_label?: boolean;
  supports_fason?: boolean;
  is_verified?: boolean;
  whatsapp_only_ordering?: boolean;
  bank_name?: string;
  bank_account_holder?: string;
  iban?: string;
  active_product_count?: number;
}

export interface CategoryTranslation {
  title?: string;
  seo_description?: string;
}

export interface CategoryTranslations {
  [lang: string]: CategoryTranslation;
}

export interface Category {
  id: string;
  title: string;
  slug?: string;
  parent_id?: string;
  total_products?: number;
  active_products?: number;
  children?: Category[];
  translations?: CategoryTranslations;
}

export interface CartItem {
  product_id: string;
  title: string;
  custom_sku: string;
  color: string;
  packages_qty: number;
  units_per_package: number;
  price_per_unit: number;
  weight_per_unit: number;
  image_url: string;
  currency?: string;
  title_translations?: Record<string, string>;
  slug?: string;
  brand_id?: string;
  brand_name?: string;
  brand_slug?: string;
  brand_whatsapp?: string;
  brand_phone?: string;
  brand_city?: string;
  brand_district?: string;
  brand_location_address?: string;
  brand_verified?: boolean;
}

export interface SupplierDirectOrderItem {
  product_id: string;
  title: string;
  custom_sku: string;
  packages_qty: number;
  pieces_qty: number;
  units_per_package: number;
  unit_price: number;
  total_price: number;
  currency: string;
}

export interface SupplierDirectOrderSummary {
  sub_order_id: string;
  sub_order_number: string;
  brand_id: string;
  brand_name: string;
  brand_slug?: string;
  brand_city?: string;
  brand_district?: string;
  brand_verified?: boolean;
  gross_amount: number;
  currency: string;
  whatsapp_phone?: string;
  phone?: string;
  public_email?: string;
  location_address?: string;
  bank_name?: string;
  bank_account_holder?: string;
  iban?: string;
  whatsapp_url: string;
  item_count?: number;
  total_packages?: number;
  total_pieces?: number;
  items?: SupplierDirectOrderItem[];
}
