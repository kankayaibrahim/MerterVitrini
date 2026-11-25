import { isVideoMediaUrl } from "@/utils/media";

export function getUnitsFromSeriesRatio(seriesRatio?: string): number {
  if (!seriesRatio) return 1;
  const parts = seriesRatio.split(/[- ,]/).filter(Boolean);
  let total = 0;
  for (const p of parts) {
    const rawNum = p.includes("=") ? p.split("=")[1] : p;
    const val = Number.parseInt(rawNum, 10);
    if (!Number.isNaN(val) && val > 0) total += val;
  }
  return total > 0 ? total : 1;
}

export function parseProductSeriesBreakdown(
  packingRatio?: string,
  seriesRatio?: string,
  variantSizes?: Array<string | undefined>
): { sizes: string[]; ratios: string[] } {
  const seriesParts = (seriesRatio || "").split("-").map((s) => s.trim()).filter(Boolean);
  if (seriesParts.some((p) => p.includes("="))) {
    return {
      sizes: seriesParts.map((p) => p.split("=")[0] || p),
      ratios: seriesParts.map((p) => p.split("=")[1] || "1"),
    };
  }

  const packedSizes = (packingRatio || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cleanVariantSizes = (variantSizes || [])
    .map((s) => (s || "").trim())
    .filter(Boolean);
  const resolvedSizes = packedSizes.length > 0 ? packedSizes : cleanVariantSizes;

  if (resolvedSizes.length > 0) {
    const ratios = resolvedSizes.map((_, idx) => seriesParts[idx] || "1");
    return { sizes: resolvedSizes, ratios };
  }

  return {
    sizes: seriesParts,
    ratios: seriesParts.map(() => "1"),
  };
}

export interface ApiFetchOptions extends RequestInit {
  revalidate?: number | false;
  tags?: string[];
}

export const SSR_PREFETCH_HEADERS: Record<string, string> = {
  "X-SSR-Prefetch": "1",
};

import { getValidStoreBearerToken } from "@/app/storeAuth";
import {
  sanitizePublicStoreAddress,
  sanitizePublicStoreEmail,
} from "@/utils/formatters";

export interface CachedStorePublicSettings {
  id?: string;
  site_title?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram_url?: string;
  facebook_url?: string;
  twitter_url?: string;
  youtube_url?: string;
  tiktok_url?: string;
  linkedin_url?: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_iban_try?: string;
  bank_iban_usd?: string;
  bank_iban_eur?: string;
  bank_swift?: string;
  show_single_price?: boolean;
  show_prices_to_guests?: boolean;
  recaptcha_enabled?: boolean;
  recaptcha_site_key?: string;
  updated_at?: string;
}

const SETTINGS_CACHE_TTL_MS = 15_000;
let cachedStoreSettingsValue: CachedStorePublicSettings | null = null;
let cachedStoreSettingsAt = 0;
let inflightStoreSettingsPromise: Promise<CachedStorePublicSettings | null> | null = null;

export function invalidateStoreSettingsCache(): void {
  cachedStoreSettingsValue = null;
  cachedStoreSettingsAt = 0;
  inflightStoreSettingsPromise = null;
}

export function sanitizeStoreSettingsPayload<T extends Record<string, unknown>>(
  raw: T
): T {
  const next: Record<string, unknown> = { ...raw };
  if ("email" in raw || raw.email === undefined) {
    next.email = sanitizePublicStoreEmail(raw.email as string | undefined);
  }
  if ("address" in raw || raw.address === undefined) {
    next.address = sanitizePublicStoreAddress(raw.address as string | undefined);
  }
  return next as T;
}

export async function fetchStoreSettingsCached(): Promise<CachedStorePublicSettings | null> {
  const now = Date.now();
  if (
    cachedStoreSettingsValue &&
    now - cachedStoreSettingsAt < SETTINGS_CACHE_TTL_MS
  ) {
    return cachedStoreSettingsValue;
  }
  if (inflightStoreSettingsPromise) {
    return inflightStoreSettingsPromise;
  }

  inflightStoreSettingsPromise = (async () => {
    try {
      const res = await fetch("/api/v1/store/settings", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as Record<string, unknown>;
      const sanitized = sanitizeStoreSettingsPayload(
        json
      ) as unknown as CachedStorePublicSettings;
      cachedStoreSettingsValue = sanitized;
      cachedStoreSettingsAt = Date.now();
      return sanitized;
    } catch {
      return null;
    } finally {
      inflightStoreSettingsPromise = null;
    }
  })();

  return inflightStoreSettingsPromise;
}

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T | null> {
  const isClientDefaultSettingsGet =
    typeof window !== "undefined" &&
    endpoint === "/settings" &&
    (!options.method || options.method === "GET");

  if (isClientDefaultSettingsGet) {
    const cached = await fetchStoreSettingsCached();
    return (cached as unknown as T) ?? null;
  }

  try {
    // Determine target host base path.
    // On the server (SSR / Metadata generation), we query the backend API.
    // In the browser, we use relative paths mapped via reverse proxy.
    const isServer = typeof window === "undefined";
    const storeToken = !isServer ? getValidStoreBearerToken() : null;
    const defaultInternalUrl =
      process.env.NODE_ENV === "development"
        ? "http://127.0.0.1:8080"
        : "https://mertervitrini.com.tr";
    const baseUrl = isServer ? (process.env.INTERNAL_API_URL || defaultInternalUrl) : "";
    const url = `${baseUrl}/api/v1/store${endpoint}`;

    const { revalidate = 60, tags, ...fetchOptions } = options;
    const nextConfig = isServer && revalidate !== false ? { revalidate, tags } : undefined;

    const response = await fetch(url, {
      ...fetchOptions,
      cache: fetchOptions.cache ?? (!isServer && storeToken ? "no-store" : undefined),
      next: nextConfig,
      headers: {
        Accept: "application/json",
        ...(isServer ? SSR_PREFETCH_HEADERS : {}),
        ...(storeToken ? { Authorization: `Bearer ${storeToken}` } : {}),
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const parsed = (await response.json()) as T;
    if (endpoint === "/settings" && parsed && typeof parsed === "object") {
      return sanitizeStoreSettingsPayload(
        parsed as unknown as Record<string, unknown>
      ) as unknown as T;
    }
    return parsed;
  } catch (e) {
    console.error("API Fetch failed for endpoint", endpoint, e);
    return null;
  }
}

export interface ExchangeRate {
  currency_code: string;
  buying_rate: number;
  selling_rate: number;
  publication_date?: string;
}

export function convertPrice(
  price: number | null | undefined,
  baseCurrency: string | undefined,
  targetCurrency: string,
  rates: readonly ExchangeRate[]
): number {
  const numeric = typeof price === "number" ? price : Number(price);
  const safePrice = Number.isFinite(numeric) ? numeric : 0;
  const base = (baseCurrency || "TRY").toUpperCase();
  const target = targetCurrency.toUpperCase();
  if (base === target) return safePrice;

  // 1. Convert base to TRY
  let priceInTRY = safePrice;
  if (base !== "TRY" && base !== "TL") {
    const baseRate = rates.find(r => r.currency_code.toUpperCase() === base);
    if (baseRate && baseRate.buying_rate > 0) {
      priceInTRY = safePrice * baseRate.buying_rate;
    }
  }

  // 2. Convert TRY to target
  if (target === "TRY" || target === "TL") {
    return priceInTRY;
  }

  const targetRate = rates.find(r => r.currency_code.toUpperCase() === target);
  if (targetRate && targetRate.buying_rate > 0) {
    return priceInTRY / targetRate.buying_rate;
  }

  return safePrice;
}

export function getResizedImageUrl(url?: string, width: number = 288, height: number = 385): string {
  if (!url) return "/placeholder.png";
  if (isVideoMediaUrl(url)) return url;
  if (url.startsWith("/uploads/") && !url.includes("/uploads/cache/")) {
    return url.replace("/uploads/", `/uploads/cache/${width}x${height}/`);
  }
  return url;
}

export function showToast(message: string): void {
  if (typeof window !== "undefined") {
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${performance.now()}`;
    window.dispatchEvent(
      new CustomEvent("merter-show-toast", {
        detail: {
          id,
          message,
        },
      })
    );
  }
}

export interface BrandEventExtra {
  readonly source_surface?: string;
  readonly target_phone?: string;
  readonly page_path?: string;
}

export function normalizeWhatsappDigits(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) {
    return "90" + digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith("5")) {
    return "90" + digits;
  }
  return digits;
}

export function trackBrandEvent(
  brandId?: string,
  eventType?: string,
  productId?: string,
  extra?: BrandEventExtra
): void {
  const cleanBrand = (brandId || "").trim();
  const cleanType = (eventType || "").trim();
  if (typeof window === "undefined" || !cleanType) return;
  if (!cleanBrand && cleanType !== "whatsapp_click") return;
  const lang = localStorage.getItem("preferred_lang") || "tr";
  const visitorId = localStorage.getItem("mv_vid") || "";
  const authToken = getValidStoreBearerToken() || localStorage.getItem("store_user_token") || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  fetch("/api/v1/store/brand-events", {
    method: "POST",
    headers,
    body: JSON.stringify({
      brand_id: cleanBrand,
      product_id: productId || "",
      event_type: cleanType,
      visitor_id: visitorId,
      auth_token: authToken,
      language: lang,
      source_surface: extra?.source_surface || "",
      target_phone: extra?.target_phone || "",
      page_path: extra?.page_path || window.location.pathname,
    }),
    keepalive: true,
  }).catch(() => {
    // Non-blocking telemetry
  });
}

export function trackWhatsappClick(params: {
  readonly brandId?: string;
  readonly productId?: string;
  readonly sourceSurface: string;
  readonly targetPhone?: string;
  readonly pagePath?: string;
}): void {
  trackBrandEvent(params.brandId || "", "whatsapp_click", params.productId || "", {
    source_surface: params.sourceSurface,
    target_phone: params.targetPhone || "",
    page_path: params.pagePath,
  });
}



