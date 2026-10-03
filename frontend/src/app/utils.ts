export function getUnitsFromSeriesRatio(seriesRatio?: string): number {
  if (!seriesRatio) return 1;
  const parts = seriesRatio.split(/[- ,]/);
  let total = 0;
  for (const p of parts) {
    const val = Number.parseInt(p, 10);
    if (!Number.isNaN(val)) total += val;
  }
  return total > 0 ? total : 1;
}

export interface ApiFetchOptions extends RequestInit {
  revalidate?: number | false;
  tags?: string[];
}

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T | null> {
  try {
    // Determine target host base path.
    // On the server (SSR / Metadata generation), we query the backend API.
    // In the browser, we use relative paths mapped via reverse proxy.
    const isServer = typeof window === "undefined";
    const baseUrl = isServer ? (process.env.INTERNAL_API_URL || "https://mertervitrini.com.tr") : "";
    const url = `${baseUrl}/api/v1/store${endpoint}`;

    const { revalidate = 60, tags, ...fetchOptions } = options;
    const nextConfig = isServer && revalidate !== false ? { revalidate, tags } : undefined;

    const response = await fetch(url, {
      ...fetchOptions,
      next: nextConfig,
      headers: {
        Accept: "application/json",
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
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



