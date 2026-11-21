export interface XmlFeed {
  id: string;
  brand_id?: string | null;
  name: string;
  alias_code: string;
  feed_url: string | null;
  mapping_config?: Record<string, string> | null;
  category_mapping?: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncRun {
  id: string;
  feed_id: string;
  started_at: string;
  completed_at: string | null;
  status: string; // 'running', 'success', 'failed'
  summary: {
    error?: string;
    items_parsed?: number;
    items_added?: number;
    items_updated?: number;
    variants_aligned?: number;
    errors_skipped?: number;
    images_total?: number;
    images_downloaded?: number;
    download_speed_kbps?: number;
    active_workers?: number;
    percentage?: number;
  } | null;
}

export interface CategoryNode {
  id: string;
  parent_id: string | null;
  title: string;
  slug: string;
  node_path: string;
  is_active: boolean;
  children: CategoryNode[];
  translations?: Record<string, Record<string, unknown>>;
}

export interface Product {
  id: string;
  feed_id: string;
  source_product_id: string;
  title: string;
  slug: string;
  slug_id: string;
  custom_sku: string;
  short_description: string | null;
  description: string | null;
  brand_id: string | null;
  category_id: string | null;
  gender: string | null;
  season: string | null;
  kumas_fabric: string | null;
  desi_volume: number;
  shipping_weight_kg: number;
  packing_ratio: string | null;
  series_ratio: string | null;
  minimum_order_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  brand_name?: string;
  category_title?: string;
  source_url?: string | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
  source_product_group_id?: string;
  group_products?: GroupProductColor[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  source_variant_id: string;
  sku: string;
  custom_sku: string;
  barcode: string | null;
  stock: number;
  price: number;
  discounted_price: number | null;
  tax_rate: number;
  currency: string;
  color: string | null;
  size: string | null;
  is_active: boolean;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  is_cover: boolean;
}

export interface GroupProductColor {
  id: string;
  source_product_id: string;
  color: string | null;
  custom_sku: string;
  stock: number;
  cover_image_url: string | null;
}

export interface UserInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export interface SupplierAddress {
  id?: string;
  title: string;
  city?: string;
  district?: string;
  text: string;
  coordinates: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  alias_code: string | null;
  company_type?: string;
  description?: string;
  website?: string | null;
  phone?: string | null;
  landline_phone?: string | null;
  whatsapp_phone?: string | null;
  public_email?: string | null;
  instagram_handle?: string | null;
  city?: string | null;
  district?: string | null;
  location_address?: string | null;
  bank_name?: string | null;
  bank_account_holder?: string | null;
  iban?: string | null;
  whatsapp_only_ordering?: boolean;
  addresses?: SupplierAddress[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  feeds?: XmlFeed[];
}

export interface SupplierUser {
  id: string;
  brand_id: string;
  brand_name?: string;
  alias_code?: string;
  email: string;
  contact_name: string;
  phone?: string | null;
  job_title?: string;
  spoken_languages?: string;
  is_owner?: boolean;
  keycloak_id?: string | null;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SizeDefinitionDTO {
  id: string;
  code: string;
  label: string;
  size_group: string;
  sort_order: number;
  is_active: boolean;
}

export interface SeriesTemplateDTO {
  id: string;
  template_key: string;
  name: string;
  category_hint: string;
  sizes: string[];
  series_ratio: string;
  units_per_series: number;
  sort_order: number;
  is_active: boolean;
}

export interface SupplierProductRow {
  id: string;
  title: string;
  custom_sku: string;
  category_id?: string;
  category_title: string;
  color_id?: string | null;
  color?: string;
  source_product_group_id?: string | null;
  sibling_count?: number;
  buying_price: number;
  price: number;
  currency: string;
  packing_ratio?: string | null;
  series_ratio?: string;
  series_stock?: number;
  minimum_order_quantity: number;
  is_active: boolean;
  is_archived?: boolean;
  season?: string;
  created_at: string;
  updated_at: string;
  cover_image: string;
  total_stock: number;
  variants_count: number;
}

export interface SupplierSiblingItemDTO {
  id: string;
  title: string;
  custom_sku: string;
  slug: string;
  color_id?: string | null;
  color: string;
  image_url: string;
  price: number;
  currency: string;
  is_active: boolean;
  source_product_group_id: string;
}

export interface InlineColorVariantDraft {
  localId: string;
  colorId: string;
  title: string;
  price: number;
  images: string[];
}

export interface CountryGroup {
  id: string;
  code: string;
  names: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Country {
  id: string;
  code: string;
  phone_code?: number | null;
  names: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface CountryState {
  id: string;
  country_id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Currency {
  id: string;
  name: string;
  symbol: string;
  full_name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Language {
  id: string;
  code: string;
  label: string;
  flag: string;
  categoryPrefix: string;
  dir: string;
  isActive: boolean;
  sortOrder: number;
  created_at: string;
  updated_at: string;
}

export interface LegalPolicy {
  id: string;
  type: 'cancellation_and_return' | 'terms_of_service' | 'privacy_policy';
  version: number;
  title: string;
  content: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageTranslation {
  title: string;
  content: string;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface Page {
  id: string;
  slug: string;
  is_active: boolean;
  translations: Record<string, PageTranslation>;
  created_at: string;
  updated_at: string;
}

export interface SupplierApplication {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city?: string | null;
  district?: string | null;
  category?: string | null;
  instagram?: string | null;
  website?: string | null;
  notes?: string | null;
  status: "pending" | "reviewed" | "contacted" | "approved" | "rejected";
  admin_notes?: string | null;
  ip_address?: string | null;
  created_at: string;
  updated_at: string;
}



