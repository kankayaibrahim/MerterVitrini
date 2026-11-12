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

const SETTINGS_CACHE_TTL_MS = 60_000;
let cachedStoreSettingsValue: CachedStorePublicSettings | null = null;
let cachedStoreSettingsAt = 0;
let inflightStoreSettingsPromise: Promise<CachedStorePublicSettings | null> | null = null;

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
      next: nextConfig,
      headers: {
        Accept: "application/json",
        ...(isServer ? SSR_PREFETCH_HEADERS : {}),
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
  price: number,
  baseCurrency: string | undefined,
  targetCurrency: string,
  rates: ExchangeRate[]
): number {
  const base = (baseCurrency || "TRY").toUpperCase();
  const target = targetCurrency.toUpperCase();
  if (base === target) return price;

  // 1. Convert base to TRY
  let priceInTRY = price;
  if (base !== "TRY" && base !== "TL") {
    const baseRate = rates.find(r => r.currency_code.toUpperCase() === base);
    if (baseRate && baseRate.buying_rate > 0) {
      priceInTRY = price * baseRate.buying_rate;
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

  return price;
}

export function getResizedImageUrl(url?: string, width: number = 288, height: number = 385): string {
  if (!url) return "/placeholder.png";
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

export function trackBrandEvent(
  brandId?: string,
  eventType?: string,
  productId?: string
): void {
  if (typeof window === "undefined" || !brandId || !eventType) return;
  const lang = localStorage.getItem("preferred_lang") || "tr";
  const visitorId = localStorage.getItem("mv_vid") || "";
  const authToken = localStorage.getItem("store_user_token") || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  fetch("/api/v1/store/brand-events", {
    method: "POST",
    headers,
    body: JSON.stringify({
      brand_id: brandId,
      product_id: productId || "",
      event_type: eventType,
      visitor_id: visitorId,
      auth_token: authToken,
      language: lang,
    }),
    keepalive: true,
  }).catch(() => {
    // Non-blocking telemetry
  });
}



