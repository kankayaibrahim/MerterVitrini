// Strict TypeScript contracts, defensive normalizers, and export utilities
// for Merter Vitrini B2B Business Intelligence & Data Mining Center.

export type BiPeriod = "today" | "24h" | "7d" | "30d" | "90d";

export type BiTabId =
  | "overview"
  | "funnel"
  | "search"
  | "geo"
  | "catalog"
  | "tech";

export interface BiOverviewMetrics {
  unique_visitors: number;
  visitors_delta_pct: number;
  total_sessions: number;
  sessions_delta_pct: number;
  total_pageviews: number;
  new_visitors: number;
  returning_visitors: number;
  bounce_rate_pct: number;
  avg_session_duration_sec: number;
  avg_scroll_depth_pct: number;
  product_views: number;
  cart_additions: number;
  b2b_leads: number;
  leads_delta_pct: number;
  orders_count: number;
  gmv_try: number;
  live_visitors_15m: number;
}

export interface BiDailySeriesPoint {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  product_views: number;
  cart_adds: number;
  leads: number;
  orders: number;
}

export interface BiFunnelStep {
  step_key: string;
  label: string;
  visitors_count: number;
  conversion_from_start_pct: number;
  drop_off_from_prev_pct: number;
}

export interface BiTopSearchItem {
  query: string;
  searches: number;
  avg_results: number;
  clicks: number;
  ctr_pct: number;
  top_lang: string;
  top_country: string;
}

export interface BiZeroResultSearchItem {
  query: string;
  searches: number;
  last_searched_at: string;
  top_lang: string;
  top_country: string;
}

export interface BiSearchMining {
  total_searches: number;
  zero_result_rate_pct: number;
  top_searches: BiTopSearchItem[];
  zero_result_searches: BiZeroResultSearchItem[];
}

export interface BiGeoCurrencyRow {
  country_code: string;
  top_language: string;
  top_currency: string;
  visitors: number;
  pageviews: number;
  product_views: number;
  b2b_leads: number;
  conversion_rate_pct: number;
}

export interface BiAttributionRow {
  channel: string;
  source: string;
  medium: string;
  campaign: string;
  has_paid_click_id: boolean;
  visitors: number;
  sessions: number;
  bounce_rate_pct: number;
  product_views: number;
  b2b_leads: number;
  lead_rate_pct: number;
}

export interface BiLandingPageRow {
  path: string;
  sessions: number;
  bounce_rate_pct: number;
  avg_duration_sec: number;
  avg_scroll_pct: number;
}

export interface BiExitPageRow {
  path: string;
  exits: number;
  exit_rate_pct: number;
}

export interface BiPageIntelligence {
  landing_pages: BiLandingPageRow[];
  exit_pages: BiExitPageRow[];
}

export interface BiHotProductRow {
  product_id: string;
  title: string;
  custom_sku: string;
  brand_name: string;
  views: number;
  cart_adds: number;
  inquiries_or_orders: number;
  conversion_pct: number;
  opportunity_flag: string;
}

export interface BiTopBrandRow {
  brand_id: string;
  brand_name: string;
  profile_views: number;
  product_views: number;
  whatsapp_and_leads: number;
  lead_rate_pct: number;
}

export interface BiProductAndBrandVelocity {
  hot_products: BiHotProductRow[];
  top_brands: BiTopBrandRow[];
}

export interface BiHotBuyerLead {
  visitor_id: string;
  user_id?: string;
  customer_name?: string;
  customer_email?: string;
  is_registered: boolean;
  country_code: string;
  language: string;
  currency: string;
  device_type: string;
  referrer_host: string;
  lead_score: number;
  products_viewed: number;
  cart_adds: number;
  lead_actions: number;
  total_dwell_sec: number;
  last_seen_at: string;
  last_action_title: string;
}

export interface BiWebVitalsByDevice {
  device_type: string;
  samples: number;
  avg_lcp_ms: number;
  avg_inp_ms: number;
  avg_cls: number;
  avg_ttfb_ms: number;
  good_lcp_pct: number;
}

export interface BiScreenResolutionRow {
  resolution: string;
  count: number;
}

export interface BiNamedCountRow {
  name: string;
  count: number;
}

export interface BiHourlyConversionCell {
  day_of_week: number;
  hour_of_day: number;
  visitors: number;
  pageviews: number;
  leads: number;
}

export interface BiWebVitalsAndTech {
  web_vitals_by_device: BiWebVitalsByDevice[];
  screen_resolutions: BiScreenResolutionRow[];
  os_breakdown: BiNamedCountRow[];
  browser_breakdown: BiNamedCountRow[];
  hourly_conversion_heatmap: BiHourlyConversionCell[];
}

export interface BiBotRow {
  bot_name: string;
  hits: number;
  unique_paths: number;
  product_pages_crawled: number;
  last_crawl_at: string;
}

export interface BiCrawledPathRow {
  path: string;
  hits: number;
  top_bot: string;
}

export interface BiBotCrawlMonitor {
  total_bot_hits: number;
  bots: BiBotRow[];
  top_crawled_paths: BiCrawledPathRow[];
}

export interface BiMiningResponse {
  period: string;
  overview: BiOverviewMetrics;
  daily_series: BiDailySeriesPoint[];
  conversion_funnel: BiFunnelStep[];
  search_mining: BiSearchMining;
  geo_currency_matrix: BiGeoCurrencyRow[];
  acquisition_attribution: BiAttributionRow[];
  page_intelligence: BiPageIntelligence;
  product_and_brand_velocity: BiProductAndBrandVelocity;
  hot_buyer_leads: BiHotBuyerLead[];
  web_vitals_and_tech: BiWebVitalsAndTech;
  bot_crawl_monitor: BiBotCrawlMonitor;
}

// Backward-compatible `/api/v1/analytics/stats` interfaces
export interface AnalyticsSummary {
  total_visitors: number;
  total_pageviews: number;
  avg_pages_per_visitor: number;
  today_visitors: number;
  today_pageviews: number;
  live_visitors_last_15m: number;
}

export interface DailyTrendPoint {
  date: string;
  visitors: number;
  pageviews: number;
}

export interface HeatmapCell {
  day: number;
  hour: number;
  views: number;
  visitors: number;
}

export interface TopItemCount {
  name: string;
  views: number;
  visitors: number;
  percentage: number;
}

export interface RecentActivityEvent {
  path: string;
  referrer_host: string;
  device_type: string;
  language: string;
  created_at: string;
}

export interface AnalyticsStatsResponse {
  period: string;
  summary: AnalyticsSummary;
  daily_trend: DailyTrendPoint[];
  heatmap: HeatmapCell[];
  top_referrers: TopItemCount[];
  top_pages: TopItemCount[];
  devices: TopItemCount[];
  languages: TopItemCount[];
  recent_events: RecentActivityEvent[];
}

// ============================================================================
// SAFE PRIMITIVE & RECORD EXTRACTORS (ZERO `any`)
// ============================================================================

type UnknownRecord = Record<string, unknown>;

function asRecord(val: unknown): UnknownRecord {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as UnknownRecord;
  }
  return {};
}

function asNum(val: unknown, fallback = 0): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asStr(val: unknown, fallback = ""): string {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return fallback;
}

function asBool(val: unknown, fallback = false): boolean {
  if (typeof val === "boolean") return val;
  return fallback;
}

function asList<T>(val: unknown, mapper: (item: UnknownRecord) => T): T[] {
  if (!Array.isArray(val)) return [];
  return val.map((raw) => mapper(asRecord(raw)));
}

// ============================================================================
// DEFENSIVE NORMALIZERS
// ============================================================================

function normalizeOverview(raw: UnknownRecord): BiOverviewMetrics {
  return {
    unique_visitors: asNum(raw.unique_visitors),
    visitors_delta_pct: asNum(raw.visitors_delta_pct),
    total_sessions: asNum(raw.total_sessions),
    sessions_delta_pct: asNum(raw.sessions_delta_pct),
    total_pageviews: asNum(raw.total_pageviews),
    new_visitors: asNum(raw.new_visitors),
    returning_visitors: asNum(raw.returning_visitors),
    bounce_rate_pct: asNum(raw.bounce_rate_pct),
    avg_session_duration_sec: asNum(raw.avg_session_duration_sec),
    avg_scroll_depth_pct: asNum(raw.avg_scroll_depth_pct),
    product_views: asNum(raw.product_views),
    cart_additions: asNum(raw.cart_additions),
    b2b_leads: asNum(raw.b2b_leads),
    leads_delta_pct: asNum(raw.leads_delta_pct),
    orders_count: asNum(raw.orders_count),
    gmv_try: asNum(raw.gmv_try),
    live_visitors_15m: asNum(raw.live_visitors_15m),
  };
}

function normalizeSearchMining(raw: UnknownRecord): BiSearchMining {
  return {
    total_searches: asNum(raw.total_searches),
    zero_result_rate_pct: asNum(raw.zero_result_rate_pct),
    top_searches: asList(raw.top_searches, (r) => ({
      query: asStr(r.query),
      searches: asNum(r.searches),
      avg_results: asNum(r.avg_results),
      clicks: asNum(r.clicks),
      ctr_pct: asNum(r.ctr_pct),
      top_lang: asStr(r.top_lang, "tr"),
      top_country: asStr(r.top_country, "TR"),
    })),
    zero_result_searches: asList(raw.zero_result_searches, (r) => ({
      query: asStr(r.query),
      searches: asNum(r.searches),
      last_searched_at: asStr(r.last_searched_at),
      top_lang: asStr(r.top_lang, "tr"),
      top_country: asStr(r.top_country, "TR"),
    })),
  };
}

function normalizePageIntelligence(raw: UnknownRecord): BiPageIntelligence {
  return {
    landing_pages: asList(raw.landing_pages, (r) => ({
      path: asStr(r.path, "/"),
      sessions: asNum(r.sessions),
      bounce_rate_pct: asNum(r.bounce_rate_pct),
      avg_duration_sec: asNum(r.avg_duration_sec),
      avg_scroll_pct: asNum(r.avg_scroll_pct),
    })),
    exit_pages: asList(raw.exit_pages, (r) => ({
      path: asStr(r.path, "/"),
      exits: asNum(r.exits),
      exit_rate_pct: asNum(r.exit_rate_pct),
    })),
  };
}

function normalizeVelocity(raw: UnknownRecord): BiProductAndBrandVelocity {
  return {
    hot_products: asList(raw.hot_products, (r) => ({
      product_id: asStr(r.product_id),
      title: asStr(r.title, "İsimsiz Ürün"),
      custom_sku: asStr(r.custom_sku, "-"),
      brand_name: asStr(r.brand_name, "-"),
      views: asNum(r.views),
      cart_adds: asNum(r.cart_adds),
      inquiries_or_orders: asNum(r.inquiries_or_orders),
      conversion_pct: asNum(r.conversion_pct),
      opportunity_flag: asStr(r.opportunity_flag),
    })),
    top_brands: asList(raw.top_brands, (r) => ({
      brand_id: asStr(r.brand_id),
      brand_name: asStr(r.brand_name, "-"),
      profile_views: asNum(r.profile_views),
      product_views: asNum(r.product_views),
      whatsapp_and_leads: asNum(r.whatsapp_and_leads),
      lead_rate_pct: asNum(r.lead_rate_pct),
    })),
  };
}

function normalizeWebVitalsAndTech(raw: UnknownRecord): BiWebVitalsAndTech {
  return {
    web_vitals_by_device: asList(raw.web_vitals_by_device, (r) => ({
      device_type: asStr(r.device_type, "desktop"),
      samples: asNum(r.samples),
      avg_lcp_ms: asNum(r.avg_lcp_ms),
      avg_inp_ms: asNum(r.avg_inp_ms),
      avg_cls: asNum(r.avg_cls),
      avg_ttfb_ms: asNum(r.avg_ttfb_ms),
      good_lcp_pct: asNum(r.good_lcp_pct),
    })),
    screen_resolutions: asList(raw.screen_resolutions, (r) => ({
      resolution: asStr(r.resolution, "-"),
      count: asNum(r.count),
    })),
    os_breakdown: asList(raw.os_breakdown, (r) => ({
      name: asStr(r.name, "Diğer"),
      count: asNum(r.count),
    })),
    browser_breakdown: asList(raw.browser_breakdown, (r) => ({
      name: asStr(r.name, "Diğer"),
      count: asNum(r.count),
    })),
    hourly_conversion_heatmap: asList(raw.hourly_conversion_heatmap, (r) => ({
      day_of_week: asNum(r.day_of_week),
      hour_of_day: asNum(r.hour_of_day),
      visitors: asNum(r.visitors),
      pageviews: asNum(r.pageviews),
      leads: asNum(r.leads),
    })),
  };
}

function normalizeBotMonitor(raw: UnknownRecord): BiBotCrawlMonitor {
  return {
    total_bot_hits: asNum(raw.total_bot_hits),
    bots: asList(raw.bots, (r) => ({
      bot_name: asStr(r.bot_name, "Bot"),
      hits: asNum(r.hits),
      unique_paths: asNum(r.unique_paths),
      product_pages_crawled: asNum(r.product_pages_crawled),
      last_crawl_at: asStr(r.last_crawl_at),
    })),
    top_crawled_paths: asList(raw.top_crawled_paths, (r) => ({
      path: asStr(r.path, "/"),
      hits: asNum(r.hits),
      top_bot: asStr(r.top_bot, "-"),
    })),
  };
}

export function normalizeBiMiningResponse(payload: unknown, fallbackPeriod = "7d"): BiMiningResponse {
  const root = asRecord(payload);
  return {
    period: asStr(root.period, fallbackPeriod),
    overview: normalizeOverview(asRecord(root.overview)),
    daily_series: asList(root.daily_series, (r) => ({
      date: asStr(r.date),
      visitors: asNum(r.visitors),
      sessions: asNum(r.sessions),
      pageviews: asNum(r.pageviews),
      product_views: asNum(r.product_views),
      cart_adds: asNum(r.cart_adds),
      leads: asNum(r.leads),
      orders: asNum(r.orders),
    })),
    conversion_funnel: asList(root.conversion_funnel, (r) => ({
      step_key: asStr(r.step_key),
      label: asStr(r.label),
      visitors_count: asNum(r.visitors_count),
      conversion_from_start_pct: asNum(r.conversion_from_start_pct),
      drop_off_from_prev_pct: asNum(r.drop_off_from_prev_pct),
    })),
    search_mining: normalizeSearchMining(asRecord(root.search_mining)),
    geo_currency_matrix: asList(root.geo_currency_matrix, (r) => ({
      country_code: asStr(r.country_code, "TR"),
      top_language: asStr(r.top_language, "tr"),
      top_currency: asStr(r.top_currency, "TRY"),
      visitors: asNum(r.visitors),
      pageviews: asNum(r.pageviews),
      product_views: asNum(r.product_views),
      b2b_leads: asNum(r.b2b_leads),
      conversion_rate_pct: asNum(r.conversion_rate_pct),
    })),
    acquisition_attribution: asList(root.acquisition_attribution, (r) => ({
      channel: asStr(r.channel, "Direct"),
      source: asStr(r.source, "(direct)"),
      medium: asStr(r.medium, "(none)"),
      campaign: asStr(r.campaign, "-"),
      has_paid_click_id: asBool(r.has_paid_click_id),
      visitors: asNum(r.visitors),
      sessions: asNum(r.sessions),
      bounce_rate_pct: asNum(r.bounce_rate_pct),
      product_views: asNum(r.product_views),
      b2b_leads: asNum(r.b2b_leads),
      lead_rate_pct: asNum(r.lead_rate_pct),
    })),
    page_intelligence: normalizePageIntelligence(asRecord(root.page_intelligence)),
    product_and_brand_velocity: normalizeVelocity(asRecord(root.product_and_brand_velocity)),
    hot_buyer_leads: asList(root.hot_buyer_leads, (r) => ({
      visitor_id: asStr(r.visitor_id),
      user_id: r.user_id ? asStr(r.user_id) : undefined,
      customer_name: r.customer_name ? asStr(r.customer_name) : undefined,
      customer_email: r.customer_email ? asStr(r.customer_email) : undefined,
      is_registered: asBool(r.is_registered),
      country_code: asStr(r.country_code, "TR"),
      language: asStr(r.language, "tr"),
      currency: asStr(r.currency, "TRY"),
      device_type: asStr(r.device_type, "desktop"),
      referrer_host: asStr(r.referrer_host, "Doğrudan"),
      lead_score: asNum(r.lead_score),
      products_viewed: asNum(r.products_viewed),
      cart_adds: asNum(r.cart_adds),
      lead_actions: asNum(r.lead_actions),
      total_dwell_sec: asNum(r.total_dwell_sec),
      last_seen_at: asStr(r.last_seen_at),
      last_action_title: asStr(r.last_action_title),
    })),
    web_vitals_and_tech: normalizeWebVitalsAndTech(asRecord(root.web_vitals_and_tech)),
    bot_crawl_monitor: normalizeBotMonitor(asRecord(root.bot_crawl_monitor)),
  };
}

export function normalizeStatsResponse(payload: unknown, fallbackPeriod = "7d"): AnalyticsStatsResponse {
  const root = asRecord(payload);
  const sum = asRecord(root.summary);
  const mapTopItem = (r: UnknownRecord): TopItemCount => ({
    name: asStr(r.name),
    views: asNum(r.views),
    visitors: asNum(r.visitors),
    percentage: asNum(r.percentage),
  });

  return {
    period: asStr(root.period, fallbackPeriod),
    summary: {
      total_visitors: asNum(sum.total_visitors),
      total_pageviews: asNum(sum.total_pageviews),
      avg_pages_per_visitor: asNum(sum.avg_pages_per_visitor),
      today_visitors: asNum(sum.today_visitors),
      today_pageviews: asNum(sum.today_pageviews),
      live_visitors_last_15m: asNum(sum.live_visitors_last_15m),
    },
    daily_trend: asList(root.daily_trend, (r) => ({
      date: asStr(r.date),
      visitors: asNum(r.visitors),
      pageviews: asNum(r.pageviews),
    })),
    heatmap: asList(root.heatmap, (r) => ({
      day: asNum(r.day),
      hour: asNum(r.hour),
      views: asNum(r.views),
      visitors: asNum(r.visitors),
    })),
    top_referrers: asList(root.top_referrers, mapTopItem),
    top_pages: asList(root.top_pages, mapTopItem),
    devices: asList(root.devices, mapTopItem),
    languages: asList(root.languages, mapTopItem),
    recent_events: asList(root.recent_events, (r) => ({
      path: asStr(r.path, "/"),
      referrer_host: asStr(r.referrer_host, "Doğrudan"),
      device_type: asStr(r.device_type, "desktop"),
      language: asStr(r.language, "tr"),
      created_at: asStr(r.created_at),
    })),
  };
}

// ============================================================================
// PRESENTATION & FORMATTING UTILITIES
// ============================================================================

const COUNTRY_NAMES_TR: Record<string, string> = {
  TR: "Türkiye",
  RU: "Rusya",
  DE: "Almanya",
  FR: "Fransa",
  IQ: "Irak",
  SA: "Suudi Arabistan",
  AE: "BAE (Dubai)",
  KZ: "Kazakistan",
  UZ: "Özbekistan",
  AZ: "Azerbaycan",
  PL: "Polonya",
  RO: "Romanya",
  BG: "Bulgaristan",
  NL: "Hollanda",
  GB: "Birleşik Krallık",
  US: "ABD",
  DZ: "Cezayir",
  MA: "Fas",
  LY: "Libya",
  EG: "Mısır",
  IL: "İsrail",
  GR: "Yunanistan",
  IT: "İtalya",
  ES: "İspanya",
  UA: "Ukrayna",
};

export function getCountryFlagEmoji(countryCode: string): string {
  const clean = (countryCode || "").trim().toUpperCase();
  if (clean.length !== 2) return "🌐";
  const codeA = clean.codePointAt(0) ?? 0;
  const codeB = clean.codePointAt(1) ?? 0;
  if (codeA < 65 || codeA > 90 || codeB < 65 || codeB > 90) return "🌐";
  return String.fromCodePoint(127397 + codeA, 127397 + codeB);
}

export function getCountryLabelTr(countryCode: string): string {
  const clean = (countryCode || "").trim().toUpperCase();
  if (!clean || clean === "XX" || clean === "UNKNOWN") return "Bilinmeyen Ülke";
  return COUNTRY_NAMES_TR[clean] || clean;
}

const CHANNEL_LABELS_TR: Record<string, string> = {
  direct: "Doğrudan Trafik",
  "(direct)": "Doğrudan Trafik",
  "organic search": "Organik Arama",
  organic: "Organik Arama",
  "campaign / utm": "Kampanya / UTM",
  campaign: "Kampanya / UTM",
  "paid search": "Ücretli Arama (Ads)",
  "paid social": "Ücretli Sosyal Medya",
  "paid media": "Dijital Reklam",
  referral: "Yönlendirme",
  social: "Sosyal Medya",
  "social media": "Sosyal Medya",
  email: "E-Bülten",
  "ai assistant": "Yapay Zeka Asistanı",
  ai: "Yapay Zeka Asistanı",
};

export function translateChannelTr(channel: string): string {
  const trimmed = (channel || "").trim();
  if (!trimmed) return "Doğrudan Trafik";
  const mapped = CHANNEL_LABELS_TR[trimmed.toLowerCase()];
  return mapped || trimmed;
}

function normalizeAttributionToken(token: string): string {
  const raw = (token || "").trim();
  const lower = raw.toLowerCase();
  if (!raw || lower === "(none)" || lower === "none" || lower === "(not set)" || lower === "-") {
    return "";
  }
  if (lower === "(direct)" || lower === "direct") {
    return "Doğrudan";
  }
  if (lower === "organic") {
    return "Organik";
  }
  if (lower === "referral") {
    return "Yönlendirme";
  }
  if (lower === "social") {
    return "Sosyal Medya";
  }
  if (lower === "cpc" || lower === "ppc" || lower === "paid") {
    return "Ücretli Tıklama (CPC)";
  }
  if (lower === "email") {
    return "E-Bülten";
  }
  return raw;
}

export function formatSourceMediumTr(source: string, medium: string): string {
  const cleanSource = normalizeAttributionToken(source);
  const cleanMedium = normalizeAttributionToken(medium);
  if (!cleanSource && !cleanMedium) return "Doğrudan";
  if (cleanSource && (!cleanMedium || cleanSource === cleanMedium)) return cleanSource;
  if (!cleanSource) return cleanMedium;
  return `${cleanSource} / ${cleanMedium}`;
}

export function translateReferrerHostTr(referrer: string): string {
  const trimmed = (referrer || "").trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed || lower === "direct" || lower === "(direct)" || lower === "(none)" || lower === "none") {
    return "Doğrudan Trafik";
  }
  return trimmed;
}

export function translateDeviceShortTr(deviceType: string): string {
  const lower = (deviceType || "").trim().toLowerCase();
  if (lower === "mobile") return "Mobil";
  if (lower === "tablet") return "Tablet";
  if (lower === "desktop") return "Masaüstü";
  return deviceType || "Masaüstü";
}

export type OpportunityBadgeTone = "warning" | "danger" | "success" | "info" | "neutral";

export interface OpportunityDiagnosis {
  readonly label: string;
  readonly tone: OpportunityBadgeTone;
  readonly isWarning: boolean;
}

const OPPORTUNITY_FLAG_MAP: Record<string, OpportunityDiagnosis> = {
  high_views_low_cart: {
    label: "Yüksek İnceleme • Düşük Sepet",
    tone: "warning",
    isWarning: true,
  },
  cart_abandonment: {
    label: "Sepet Terk Riski",
    tone: "danger",
    isWarning: true,
  },
  low_conversion: {
    label: "Düşük Dönüşüm • Fiyat/Seri Kontrolü",
    tone: "warning",
    isWarning: true,
  },
  price_or_pack_friction: {
    label: "Fiyat / Asorti Darboğazı",
    tone: "warning",
    isWarning: true,
  },
  zero_cart: {
    label: "Sepete Eklenmedi • İnceleme Var",
    tone: "warning",
    isWarning: true,
  },
  low_discovery: {
    label: "Düşük Keşif • Vitrin Fırsatı",
    tone: "info",
    isWarning: true,
  },
  top_performer: {
    label: "Lider Model • Yüksek Dönüşüm",
    tone: "success",
    isWarning: false,
  },
  strong_converter: {
    label: "Güçlü Dönüşüm",
    tone: "success",
    isWarning: false,
  },
  healthy: {
    label: "Dengeli Dönüşüm",
    tone: "neutral",
    isWarning: false,
  },
  balanced: {
    label: "Dengeli Dönüşüm",
    tone: "neutral",
    isWarning: false,
  },
  normal: {
    label: "Dengeli Dönüşüm",
    tone: "neutral",
    isWarning: false,
  },
};

export function resolveOpportunityDiagnosis(product: BiHotProductRow): OpportunityDiagnosis {
  const rawFlag = (product.opportunity_flag || "").trim();
  const normalizedKey = rawFlag.toLowerCase().replaceAll("-", "_").replaceAll(/\s+/g, "_");

  if (normalizedKey && OPPORTUNITY_FLAG_MAP[normalizedKey]) {
    return OPPORTUNITY_FLAG_MAP[normalizedKey];
  }

  if (rawFlag && !rawFlag.includes("_")) {
    return {
      label: rawFlag,
      tone: "warning",
      isWarning: true,
    };
  }

  if (rawFlag.includes("_")) {
    if (normalizedKey.includes("abandon")) {
      return OPPORTUNITY_FLAG_MAP.cart_abandonment;
    }
    if (normalizedKey.includes("low_cart") || normalizedKey.includes("high_view")) {
      return OPPORTUNITY_FLAG_MAP.high_views_low_cart;
    }
    if (normalizedKey.includes("top") || normalizedKey.includes("strong")) {
      return OPPORTUNITY_FLAG_MAP.strong_converter;
    }
    if (normalizedKey.includes("low")) {
      return OPPORTUNITY_FLAG_MAP.low_discovery;
    }
    return {
      label: "Performans İncelemesi Önerilir",
      tone: "warning",
      isWarning: true,
    };
  }

  if (product.views >= 15 && product.cart_adds === 0) {
    return OPPORTUNITY_FLAG_MAP.high_views_low_cart;
  }

  if (product.cart_adds >= 3 && product.inquiries_or_orders === 0) {
    return OPPORTUNITY_FLAG_MAP.cart_abandonment;
  }

  if (product.inquiries_or_orders > 0 || product.conversion_pct >= 10) {
    return OPPORTUNITY_FLAG_MAP.strong_converter;
  }

  return OPPORTUNITY_FLAG_MAP.healthy;
}

export function formatDurationSec(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe} sn`;
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  if (mins < 60) return `${mins} dk ${rem} sn`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} sa ${mins % 60} dk`;
}

export function formatCurrencyTry(amount: number): string {
  return `₺${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatRelativeTimeTr(isoDate: string): string {
  if (!isoDate) return "-";
  const ts = new Date(isoDate).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return "-";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Az önce";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} gün önce`;
  return new Date(ts).toLocaleDateString("tr-TR");
}

function escapeCsvCell(val: string | number | boolean): string {
  const text = String(val ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function triggerBrowserDownload(filename: string, content: string, mimeType: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportBiSummaryJson(bi: BiMiningResponse, period: BiPeriod): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonText = JSON.stringify(bi, null, 2);
  triggerBrowserDownload(
    `merter-bi-mining-${period}-${stamp}.json`,
    jsonText,
    "application/json;charset=utf-8"
  );
}

export function exportBiSummaryCsv(bi: BiMiningResponse, period: BiPeriod): void {
  const ov = bi.overview;
  const lines: string[] = [
    "BOLUM,METRIK_VEYA_ANAHTAR,DEGER_1,DEGER_2,DEGER_3,DEGER_4",
    ["OZET", "Tekil Ziyaretci", ov.unique_visitors, `Delta %${ov.visitors_delta_pct.toFixed(1)}`, "", ""].map(escapeCsvCell).join(","),
    ["OZET", "Toplam Oturum", ov.total_sessions, `Delta %${ov.sessions_delta_pct.toFixed(1)}`, "", ""].map(escapeCsvCell).join(","),
    ["OZET", "Sayfa Goruntuleme", ov.total_pageviews, `Hemen Cikma %${ov.bounce_rate_pct.toFixed(1)}`, "", ""].map(escapeCsvCell).join(","),
    ["OZET", "Urun Inceleme & Sepet", ov.product_views, ov.cart_additions, "", ""].map(escapeCsvCell).join(","),
    ["OZET", "B2B Talep & Siparis", ov.b2b_leads, ov.orders_count, `GMV TRY: ${ov.gmv_try.toFixed(2)}`, ""].map(escapeCsvCell).join(","),
  ];

  for (const step of bi.conversion_funnel) {
    lines.push(
      [
        "DONUSUM_HUNISI",
        step.label,
        step.visitors_count,
        `Baslangictan %${step.conversion_from_start_pct.toFixed(1)}`,
        `Kayip %${step.drop_off_from_prev_pct.toFixed(1)}`,
        "",
      ].map(escapeCsvCell).join(",")
    );
  }

  for (const z of bi.search_mining.zero_result_searches) {
    lines.push(
      ["SIFIR_SONUCLU_ARAMA", z.query, z.searches, z.top_country, z.top_lang, z.last_searched_at]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  for (const g of bi.geo_currency_matrix) {
    lines.push(
      [
        "IHRACAT_MATRISI",
        g.country_code,
        `${g.top_language}/${g.top_currency}`,
        `Ziyaretci: ${g.visitors}`,
        `Lead: ${g.b2b_leads}`,
        `Donusum %${g.conversion_rate_pct.toFixed(1)}`,
      ].map(escapeCsvCell).join(",")
    );
  }

  for (const lead of bi.hot_buyer_leads) {
    lines.push(
      [
        "SICAK_ALICI",
        lead.customer_name || lead.customer_email || lead.visitor_id,
        `Skor: ${lead.lead_score}`,
        `${lead.country_code}/${lead.currency}`,
        `Urun: ${lead.products_viewed} Sepet: ${lead.cart_adds}`,
        lead.last_action_title,
      ].map(escapeCsvCell).join(",")
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  // Prepend UTF-8 BOM so Excel renders Turkish characters cleanly
  triggerBrowserDownload(
    `merter-bi-mining-${period}-${stamp}.csv`,
    `\uFEFF${lines.join("\n")}`,
    "text/csv;charset=utf-8"
  );
}
