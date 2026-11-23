export interface StorySettings {
  is_paid_mode: boolean;
  paid_daily_limit: number;
  free_daily_limit: number;
  story_ttl_hours: number;
  monthly_addon_price_try: number;
  updated_at?: string;
}

export interface StoryEntitlement {
  can_publish: boolean;
  is_paid_mode: boolean;
  is_paid_entitled: boolean;
  plan_code: string;
  daily_limit: number;
  used_last_24h: number;
  remaining_24h: number;
  story_ttl_hours: number;
  next_slot_at?: string | null;
  lock_reason?: string;
}

export interface PublicStoryItem {
  id: string;
  brand_id: string;
  brand_name?: string;
  brand_slug?: string;
  brand_subdomain?: string;
  brand_cover_url?: string;
  brand_verified?: boolean;
  created_by_role: "supplier" | "admin" | string;
  media_url: string;
  media_type: string;
  caption: string;
  cta_label: string;
  cta_url: string;
  linked_product_id?: string | null;
  product_slug?: string;
  product_title?: string;
  bg_color: string;
  is_active: boolean;
  view_count: number;
  click_count: number;
  expires_at: string;
  created_at: string;
}

export type SupplierStoryItem = PublicStoryItem;

export interface PublicStoryGroup {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_subdomain?: string;
  brand_cover_url: string;
  brand_verified: boolean;
  latest_at: string;
  stories: PublicStoryItem[];
}

export interface FavoriteSupplierItem {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_subdomain?: string;
  brand_cover_url: string;
  company_type: string;
  is_verified: boolean;
  active_product_count: number;
  notify_new_products: boolean;
  notify_via_email: boolean;
  created_at: string;
}

export interface CustomerNotificationItem {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  metadata?: {
    brand_id?: string;
    brand_name?: string;
    brand_slug?: string;
    product_id?: string;
    product_slug?: string;
    product_title?: string;
    image_url?: string;
    product_count?: number;
    target_url?: string;
    [key: string]: unknown;
  };
  is_read: boolean;
  created_at: string;
}
