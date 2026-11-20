// Strict TypeScript contracts and presentation helpers for AI Bot vs. Search Crawler & Traffic Source Analytics.

import type { BiPeriod, BiTopSearchItem } from "./biTypes";

export type CrawlerCategoryId =
  | "ai_bot"
  | "google"
  | "search_engine"
  | "seo_tool"
  | "social_preview"
  | "other_bot";

export type TrafficChannelId =
  | "ai_assistant"
  | "google_search"
  | "other_search"
  | "social"
  | "paid_ads"
  | "campaign"
  | "direct"
  | "referral";

export interface TrafficComparisonHero {
  readonly ai_bot_requests: number;
  readonly google_bot_requests: number;
  readonly other_search_bot_requests: number;
  readonly seo_tool_bot_requests: number;
  readonly social_preview_bot_requests: number;
  readonly other_bot_requests: number;
  readonly total_bot_requests: number;
  readonly ai_visits: number;
  readonly ai_visitors: number;
  readonly chatgpt_visits: number;
  readonly chatgpt_visitors: number;
  readonly google_search_visits: number;
  readonly google_search_visitors: number;
  readonly other_search_visits: number;
  readonly total_human_sessions: number;
  readonly total_human_visitors: number;
  readonly ai_crawl_per_visit_ratio: number;
  readonly google_crawl_per_visit_ratio: number;
  readonly crawler_data_source: string;
}

export interface TrafficCrawlerGroupRow {
  readonly category: CrawlerCategoryId;
  readonly label: string;
  readonly hits: number;
  readonly share_pct: number;
  readonly bot_count: number;
}

export interface TrafficCrawlerBotRow {
  readonly bot_name: string;
  readonly category: CrawlerCategoryId;
  readonly hits: number;
  readonly share_pct: number;
  readonly unique_paths: number;
  readonly product_pages_crawled: number;
  readonly last_crawl_at: string;
}

export interface TrafficCrawledPathRow {
  readonly path: string;
  readonly hits: number;
  readonly top_bot: string;
  readonly top_category: CrawlerCategoryId;
  readonly unique_bots: number;
  readonly last_crawl_at: string;
}

export interface TrafficChannelSummaryRow {
  readonly channel: TrafficChannelId;
  readonly label: string;
  readonly sessions: number;
  readonly visitors: number;
  readonly share_pct: number;
  readonly b2b_leads: number;
}

export interface TrafficSourceRow {
  readonly source_name: string;
  readonly channel: TrafficChannelId;
  readonly sessions: number;
  readonly visitors: number;
  readonly pageviews: number;
  readonly share_pct: number;
  readonly bounce_rate_pct: number;
  readonly b2b_leads: number;
}

export interface TrafficCountryRow {
  readonly country_code: string;
  readonly country_label: string;
  readonly sessions: number;
  readonly visitors: number;
  readonly pageviews: number;
  readonly share_pct: number;
  readonly ai_visits: number;
  readonly google_visits: number;
}

export interface TrafficDailyComparisonPoint {
  readonly date: string;
  readonly ai_bot_hits: number;
  readonly google_bot_hits: number;
  readonly other_bot_hits: number;
  readonly ai_visits: number;
  readonly google_visits: number;
  readonly other_visits: number;
}

export interface TrafficArrivalKeywordRow {
  readonly keyword: string;
  readonly keyword_type: string;
  readonly source_name: string;
  readonly campaign: string;
  readonly sessions: number;
  readonly visitors: number;
  readonly top_landing_path: string;
  readonly last_seen_at: string;
}

export interface TrafficSourceLandingRow {
  readonly source_name: string;
  readonly channel: TrafficChannelId;
  readonly path: string;
  readonly page_title: string;
  readonly inferred_topic: string;
  readonly sessions: number;
  readonly visitors: number;
  readonly product_views: number;
}

export interface TrafficSourcesReportResponse {
  readonly period: string;
  readonly date_range_label: string;
  readonly generated_at: string;
  readonly hero: TrafficComparisonHero;
  readonly crawler_groups: TrafficCrawlerGroupRow[];
  readonly top_crawlers: TrafficCrawlerBotRow[];
  readonly top_crawled_paths: TrafficCrawledPathRow[];
  readonly visit_channels: TrafficChannelSummaryRow[];
  readonly top_sources: TrafficSourceRow[];
  readonly top_countries: TrafficCountryRow[];
  readonly daily_comparison: TrafficDailyComparisonPoint[];
  readonly arrival_keywords: TrafficArrivalKeywordRow[];
  readonly landing_intents: TrafficSourceLandingRow[];
  readonly internal_keywords: BiTopSearchItem[];
}

type UnknownRecord = Record<string, unknown>;

function asRecord(val: unknown): UnknownRecord {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as UnknownRecord;
  }
  return {};
}

function asStr(val: unknown, fallback = ""): string {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return fallback;
}

function asNum(val: unknown, fallback = 0): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asList<T>(val: unknown, mapper: (item: UnknownRecord) => T): T[] {
  if (!Array.isArray(val)) return [];
  return val.map((entry) => mapper(asRecord(entry)));
}

const VALID_CRAWLER_CATEGORIES = new Set<CrawlerCategoryId>([
  "ai_bot",
  "google",
  "search_engine",
  "seo_tool",
  "social_preview",
  "other_bot",
]);

function normalizeCrawlerCategory(raw: unknown): CrawlerCategoryId {
  const s = asStr(raw, "other_bot") as CrawlerCategoryId;
  return VALID_CRAWLER_CATEGORIES.has(s) ? s : "other_bot";
}

const VALID_CHANNELS = new Set<TrafficChannelId>([
  "ai_assistant",
  "google_search",
  "other_search",
  "social",
  "paid_ads",
  "campaign",
  "direct",
  "referral",
]);

function normalizeChannel(raw: unknown): TrafficChannelId {
  const s = asStr(raw, "referral") as TrafficChannelId;
  return VALID_CHANNELS.has(s) ? s : "referral";
}

export function normalizeTrafficSourcesResponse(
  payload: unknown,
  fallbackPeriod: BiPeriod = "7d"
): TrafficSourcesReportResponse {
  const root = asRecord(payload);
  const hero = asRecord(root.hero);

  return {
    period: asStr(root.period, fallbackPeriod),
    date_range_label: asStr(root.date_range_label, "-"),
    generated_at: asStr(root.generated_at),
    hero: {
      ai_bot_requests: asNum(hero.ai_bot_requests),
      google_bot_requests: asNum(hero.google_bot_requests),
      other_search_bot_requests: asNum(hero.other_search_bot_requests),
      seo_tool_bot_requests: asNum(hero.seo_tool_bot_requests),
      social_preview_bot_requests: asNum(hero.social_preview_bot_requests),
      other_bot_requests: asNum(hero.other_bot_requests),
      total_bot_requests: asNum(hero.total_bot_requests),
      ai_visits: asNum(hero.ai_visits),
      ai_visitors: asNum(hero.ai_visitors),
      chatgpt_visits: asNum(hero.chatgpt_visits),
      chatgpt_visitors: asNum(hero.chatgpt_visitors),
      google_search_visits: asNum(hero.google_search_visits),
      google_search_visitors: asNum(hero.google_search_visitors),
      other_search_visits: asNum(hero.other_search_visits),
      total_human_sessions: asNum(hero.total_human_sessions),
      total_human_visitors: asNum(hero.total_human_visitors),
      ai_crawl_per_visit_ratio: asNum(hero.ai_crawl_per_visit_ratio),
      google_crawl_per_visit_ratio: asNum(hero.google_crawl_per_visit_ratio),
      crawler_data_source: asStr(hero.crawler_data_source, "middleware_fallback"),
    },
    crawler_groups: asList(root.crawler_groups, (r) => ({
      category: normalizeCrawlerCategory(r.category),
      label: asStr(r.label, "Diğer Botlar"),
      hits: asNum(r.hits),
      share_pct: asNum(r.share_pct),
      bot_count: asNum(r.bot_count),
    })),
    top_crawlers: asList(root.top_crawlers, (r) => ({
      bot_name: asStr(r.bot_name, "UnknownBot"),
      category: normalizeCrawlerCategory(r.category),
      hits: asNum(r.hits),
      share_pct: asNum(r.share_pct),
      unique_paths: asNum(r.unique_paths),
      product_pages_crawled: asNum(r.product_pages_crawled),
      last_crawl_at: asStr(r.last_crawl_at),
    })),
    top_crawled_paths: asList(root.top_crawled_paths, (r) => ({
      path: asStr(r.path, "/"),
      hits: asNum(r.hits),
      top_bot: asStr(r.top_bot, "-"),
      top_category: normalizeCrawlerCategory(r.top_category),
      unique_bots: asNum(r.unique_bots),
      last_crawl_at: asStr(r.last_crawl_at),
    })),
    visit_channels: asList(root.visit_channels, (r) => ({
      channel: normalizeChannel(r.channel),
      label: asStr(r.label, "Yönlendirme"),
      sessions: asNum(r.sessions),
      visitors: asNum(r.visitors),
      share_pct: asNum(r.share_pct),
      b2b_leads: asNum(r.b2b_leads),
    })),
    top_sources: asList(root.top_sources, (r) => ({
      source_name: asStr(r.source_name, "Doğrudan (Direct)"),
      channel: normalizeChannel(r.channel),
      sessions: asNum(r.sessions),
      visitors: asNum(r.visitors),
      pageviews: asNum(r.pageviews),
      share_pct: asNum(r.share_pct),
      bounce_rate_pct: asNum(r.bounce_rate_pct),
      b2b_leads: asNum(r.b2b_leads),
    })),
    top_countries: asList(root.top_countries, (r) => ({
      country_code: asStr(r.country_code, "TR"),
      country_label: asStr(r.country_label, "Türkiye"),
      sessions: asNum(r.sessions),
      visitors: asNum(r.visitors),
      pageviews: asNum(r.pageviews),
      share_pct: asNum(r.share_pct),
      ai_visits: asNum(r.ai_visits),
      google_visits: asNum(r.google_visits),
    })),
    daily_comparison: asList(root.daily_comparison, (r) => ({
      date: asStr(r.date),
      ai_bot_hits: asNum(r.ai_bot_hits),
      google_bot_hits: asNum(r.google_bot_hits),
      other_bot_hits: asNum(r.other_bot_hits),
      ai_visits: asNum(r.ai_visits),
      google_visits: asNum(r.google_visits),
      other_visits: asNum(r.other_visits),
    })),
    arrival_keywords: asList(root.arrival_keywords, (r) => ({
      keyword: asStr(r.keyword),
      keyword_type: asStr(r.keyword_type, "paid_utm_term"),
      source_name: asStr(r.source_name),
      campaign: asStr(r.campaign, "-"),
      sessions: asNum(r.sessions),
      visitors: asNum(r.visitors),
      top_landing_path: asStr(r.top_landing_path, "/"),
      last_seen_at: asStr(r.last_seen_at),
    })),
    landing_intents: asList(root.landing_intents, (r) => ({
      source_name: asStr(r.source_name),
      channel: normalizeChannel(r.channel),
      path: asStr(r.path, "/"),
      page_title: asStr(r.page_title),
      inferred_topic: asStr(r.inferred_topic),
      sessions: asNum(r.sessions),
      visitors: asNum(r.visitors),
      product_views: asNum(r.product_views),
    })),
    internal_keywords: asList(root.internal_keywords, (r) => ({
      query: asStr(r.query),
      searches: asNum(r.searches),
      avg_results: asNum(r.avg_results),
      clicks: asNum(r.clicks),
      ctr_pct: asNum(r.ctr_pct),
      top_lang: asStr(r.top_lang, "TR"),
      top_country: asStr(r.top_country, "TR"),
    })),
  };
}

export const CRAWLER_CATEGORY_META: Record<
  CrawlerCategoryId,
  { readonly label: string; readonly badgeClass: string; readonly barClass: string }
> = {
  ai_bot: {
    label: "Yapay Zeka Botu",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    barClass: "bg-rose-500",
  },
  google: {
    label: "Google Tarayıcısı",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    barClass: "bg-sky-600",
  },
  search_engine: {
    label: "Arama Motoru",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
    barClass: "bg-indigo-500",
  },
  seo_tool: {
    label: "SEO / Analiz Botu",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    barClass: "bg-amber-500",
  },
  social_preview: {
    label: "Sosyal Önizleme",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    barClass: "bg-emerald-500",
  },
  other_bot: {
    label: "Diğer Bot",
    badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    barClass: "bg-zinc-500",
  },
};

export const TRAFFIC_CHANNEL_META: Record<
  TrafficChannelId,
  { readonly label: string; readonly badgeClass: string; readonly barClass: string }
> = {
  ai_assistant: {
    label: "Yapay Zeka",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    barClass: "bg-rose-500",
  },
  google_search: {
    label: "Google Arama",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    barClass: "bg-sky-600",
  },
  other_search: {
    label: "Diğer Arama",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
    barClass: "bg-indigo-500",
  },
  social: {
    label: "Sosyal & Mesajlaşma",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
    barClass: "bg-violet-500",
  },
  paid_ads: {
    label: "Ücretli Reklam",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    barClass: "bg-amber-500",
  },
  campaign: {
    label: "Kampanya (UTM)",
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
    barClass: "bg-teal-500",
  },
  direct: {
    label: "Doğrudan",
    badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    barClass: "bg-zinc-500",
  },
  referral: {
    label: "Yönlendirme",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    barClass: "bg-emerald-500",
  },
};

export function formatCompactCountTr(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} milyon`;
  }
  if (value >= 100_000) {
    return `${Math.round(value / 1_000).toLocaleString("tr-TR")} bin`;
  }
  return Math.round(value).toLocaleString("tr-TR");
}

function escapeCsvCell(val: string | number | boolean): string {
  const text = String(val ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadBlob(filename: string, content: string, mimeType: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportTrafficSourcesJson(report: TrafficSourcesReportResponse): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    `merter-ai-trafik-kaynaklari-${report.period}-${stamp}.json`,
    JSON.stringify(report, null, 2),
    "application/json;charset=utf-8"
  );
}

export function exportTrafficSourcesCsv(report: TrafficSourcesReportResponse): void {
  const h = report.hero;
  const lines: string[] = [
    "BOLUM,KAYNAK_VEYA_BOT,ALT_TIP,DEGER_1,DEGER_2,DEGER_3",
    ["OZET", "Yapay Zeka Botlari", "Tarama Istegi", h.ai_bot_requests, "", ""].map(escapeCsvCell).join(","),
    ["OZET", "Google Tarayicilari", "Tarama Istegi", h.google_bot_requests, "", ""].map(escapeCsvCell).join(","),
    ["OZET", "Yapay Zeka Ziyaretleri", `ChatGPT: ${h.chatgpt_visits}`, h.ai_visits, `${h.ai_visitors} tekil`, ""].map(escapeCsvCell).join(","),
    ["OZET", "Google Arama Ziyaretleri", "Organik Ziyaret", h.google_search_visits, `${h.google_search_visitors} tekil`, ""].map(escapeCsvCell).join(","),
  ];

  for (const s of report.top_sources) {
    lines.push(
      ["TRAFIK_KAYNAGI", s.source_name, s.channel, s.sessions, s.visitors, `B2B Lead: ${s.b2b_leads}`]
        .map(escapeCsvCell)
        .join(",")
    );
  }
  for (const b of report.top_crawlers) {
    lines.push(
      ["BOT_TARAYICI", b.bot_name, b.category, b.hits, b.unique_paths, b.product_pages_crawled]
        .map(escapeCsvCell)
        .join(",")
    );
  }
  for (const l of report.landing_intents) {
    lines.push(
      ["GIRIS_SAYFASI_NIYETI", l.source_name, l.path, l.inferred_topic, l.sessions, l.visitors]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    `merter-ai-trafik-kaynaklari-${report.period}-${stamp}.csv`,
    `\uFEFF${lines.join("\n")}`,
    "text/csv;charset=utf-8"
  );
}
