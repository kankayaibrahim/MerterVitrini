export interface LoginHistoryRecord {
  login_at: string;
  ip_address: string;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  email_verified: boolean;
  is_verified: boolean;
  is_active: boolean;
  is_blocked: boolean;
  block_reason?: string | null;
  created_at: string;
  updated_at: string;
  registration_ip?: string | null;
  billing_address?: string | null;
  delivery_address?: string | null;
  tax_no_tckn?: string | null;
  instagram_username?: string | null;
  preferred_lang?: string | null;
  preferred_currency?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  city?: string | null;
  region_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geo_source?: string | null;
  last_login_at?: string | null;
  last_active_at?: string | null;
  is_online?: boolean;
  orders_count: number;
  orders_total_amount: number;
  cart_items_count: number;
  pages_read: number;
  products_viewed: number;
  last_event_title?: string;
  last_event_category?: string;
  login_history: LoginHistoryRecord[];
}

export interface CustomerOverviewKPIs {
  total_customers: number;
  today_count: number;
  yesterday_count: number;
  last_7_days_count: number;
  last_30_days_count: number;
  this_month_count: number;
  verified_count: number;
  blocked_count: number;
  online_now_count: number;
  active_today_count: number;
  with_orders_count: number;
  with_active_cart_count: number;
  countries_count: number;
  international_count: number;
  international_share: number;
  resolved_geo_count: number;
}

export interface DailyRegistrationPoint {
  date: string;
  count: number;
  turkey_count: number;
  international_count: number;
}

export interface CustomerCountryBreakdown {
  country_code: string;
  country_name: string;
  customer_count: number;
  today_count: number;
  online_count: number;
  orders_count: number;
  total_spend: number;
  share: number;
  lat?: number | null;
  lon?: number | null;
}

export interface CustomerMapSample {
  id: string;
  name: string;
  email: string;
  registered_today: boolean;
  is_online: boolean;
  orders_count: number;
  created_at: string;
}

export interface CustomerMapPoint {
  cluster_key: string;
  country_code: string;
  country_name: string;
  city: string;
  region_name: string;
  lat: number;
  lon: number;
  customer_count: number;
  today_count: number;
  online_count: number;
  orders_count: number;
  total_spend: number;
  is_centroid: boolean;
  sample_customers: CustomerMapSample[];
}

export interface CustomersOverviewResponse {
  generated_at: string;
  kpis: CustomerOverviewKPIs;
  daily_registrations: DailyRegistrationPoint[];
  countries: CustomerCountryBreakdown[];
  map_points: CustomerMapPoint[];
}

export type CustomerPeriodFilter = "" | "today" | "yesterday" | "7d" | "30d" | "this_month";

export type CustomerStatusFilter =
  | ""
  | "active"
  | "blocked"
  | "verified"
  | "unverified"
  | "online"
  | "with_orders"
  | "with_cart";

export type CustomerSortOption =
  | "newest"
  | "oldest"
  | "last_active"
  | "most_orders"
  | "highest_spend"
  | "most_engaged";

export interface CustomerFiltersState {
  search: string;
  country: string;
  period: CustomerPeriodFilter;
  status: CustomerStatusFilter;
  sort: CustomerSortOption;
}

export function formatCurrencyTry(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDateTimeTr(isoDate?: string | null): string {
  if (!isoDate) return "-";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTimeTr(isoDate?: string | null): string {
  if (!isoDate) return "-";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "-";
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return "Az önce";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} sa önce`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} gün önce`;
  return formatDateTimeTr(isoDate);
}

export function isRegisteredTodayIstanbul(isoDate?: string | null): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d) === fmt.format(new Date());
}

export function geoSourceLabelTr(source?: string | null): string {
  switch ((source || "").toLowerCase()) {
    case "ip_api":
      return "IP Konumu";
    case "cf_header":
      return "Edge Ülke Başlığı";
    case "analytics_event":
      return "Oturum Telemetrisi";
    case "phone_prefix":
      return "Telefon Alan Kodu";
    case "country_centroid":
      return "Ülke Merkezi";
    default:
      return "Çözümlenmedi";
  }
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCustomersCsv(customers: Customer[]): void {
  const headers = [
    "ID",
    "Ad",
    "Soyad",
    "E-Posta",
    "Telefon",
    "Ülke Kodu",
    "Ülke",
    "Şehir",
    "Doğrulandı",
    "Blokeli",
    "Kayıt Tarihi",
    "Son Aktiflik",
    "Sipariş Sayısı",
    "Toplam Harcama (TRY)",
    "Aktif Sepet",
    "Sayfa Görüntüleme",
    "Ürün İnceleme",
    "Dil",
    "Para Birimi",
    "Kayıt IP",
  ];

  const rows = customers.map((c) =>
    [
      c.id,
      c.first_name,
      c.last_name,
      c.email,
      c.phone,
      c.country_code || "",
      c.country_name || "",
      c.city || "",
      c.email_verified ? "Evet" : "Hayır",
      c.is_blocked ? "Blokeli" : "Aktif",
      formatDateTimeTr(c.created_at),
      formatDateTimeTr(c.last_active_at || c.last_login_at),
      c.orders_count,
      c.orders_total_amount,
      c.cart_items_count,
      c.pages_read,
      c.products_viewed,
      c.preferred_lang || "tr",
      c.preferred_currency || "TRY",
      c.registration_ip || "",
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  const csvContent = `\uFEFF${headers.map(escapeCsvCell).join(",")}\r\n${rows.join("\r\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `merter-vitrini-musteriler-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
