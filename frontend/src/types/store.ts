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

export interface Brand {
  id: string;
  name: string;
  slug?: string;
  alias_code?: string;
  company_type?: string;
  description?: string;
  website?: string;
  phone?: string;
  whatsapp_phone?: string;
  public_email?: string;
  instagram_handle?: string;
  location_address?: string;
  export_countries?: string;
  min_order_quantity?: number;
  supports_private_label?: boolean;
  supports_fason?: boolean;
  is_verified?: boolean;
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
}
