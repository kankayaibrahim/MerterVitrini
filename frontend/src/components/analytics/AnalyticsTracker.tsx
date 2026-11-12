"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30-minute sliding session window
const ATTR_STORAGE_KEY = "mv_session_attribution";
const SCROLL_THROTTLE_MS = 180;

type GtagFunction = (
  command: "event",
  eventName: string,
  eventParams?: Record<string, unknown>
) => void;

interface WindowWithGtag extends Window {
  gtag?: GtagFunction;
}

interface SessionAttribution {
  session_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  click_id: string;
}

interface WebVitalsSnapshot {
  lcpMs: number;
  clsScore: number;
  inpMs: number;
  ttfbMs: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface EventTimingEntry extends PerformanceEntry {
  interactionId?: number;
}

function generateUUID(): string {
  const now = Date.now().toString(36);
  const part1 = Math.floor(Date.now() / 1000).toString(16);
  const part2 = ("000000" + Math.floor(performance.now() * 1000).toString(16)).slice(-6);
  return `mv-${now}-${part1}-${part2}`;
}

export function getOrSetVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let vid = localStorage.getItem("mv_vid");
    if (!vid) {
      vid = generateUUID();
      localStorage.setItem("mv_vid", vid);
    }
    return vid;
  } catch {
    return generateUUID();
  }
}

export function getOrSetSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = Date.now();
    const existingSid = sessionStorage.getItem("mv_sid");
    const rawLastTs = sessionStorage.getItem("mv_sid_last_ts");
    const lastTs = rawLastTs ? Number(rawLastTs) : 0;
    const isExpired = !Number.isFinite(lastTs) || lastTs <= 0 || now - lastTs > SESSION_TIMEOUT_MS;

    let sid = existingSid;
    if (!sid || isExpired) {
      sid = generateUUID();
      sessionStorage.setItem("mv_sid", sid);
      sessionStorage.removeItem(ATTR_STORAGE_KEY);
    }
    sessionStorage.setItem("mv_sid_last_ts", String(now));
    return sid;
  } catch {
    return generateUUID();
  }
}

function readLocalStorageItem(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function readStoreAuthToken(): string {
  return readLocalStorageItem("store_user_token", "");
}

function readPreferredCurrency(): string {
  return readLocalStorageItem("merter_preferred_currency", "TRY").toUpperCase();
}

function resolveActiveLanguage(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && segments[0].length === 2) {
    return segments[0].toLowerCase();
  }
  return readLocalStorageItem("preferred_lang", "tr").toLowerCase();
}

function isNonStorefrontPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/supplier") ||
    pathname.startsWith("/api")
  );
}

function extractClickIdFromParams(params: URLSearchParams): {
  clickId: string;
  inferredSource: string;
  inferredMedium: string;
} {
  const gclid = params.get("gclid");
  if (gclid) {
    return { clickId: `gclid:${gclid}`, inferredSource: "google", inferredMedium: "cpc" };
  }
  const fbclid = params.get("fbclid");
  if (fbclid) {
    return { clickId: `fbclid:${fbclid}`, inferredSource: "facebook", inferredMedium: "paid_social" };
  }
  const yclid = params.get("yclid");
  if (yclid) {
    return { clickId: `yclid:${yclid}`, inferredSource: "yandex", inferredMedium: "cpc" };
  }
  const ttclid = params.get("ttclid");
  if (ttclid) {
    return { clickId: `ttclid:${ttclid}`, inferredSource: "tiktok", inferredMedium: "paid_social" };
  }
  return { clickId: "", inferredSource: "", inferredMedium: "" };
}

function resolveSessionAttribution(
  sessionId: string,
  searchParams: URLSearchParams | null
): SessionAttribution {
  const emptyAttr: SessionAttribution = {
    session_id: sessionId,
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
    click_id: "",
  };
  if (typeof window === "undefined") return emptyAttr;

  let stored: SessionAttribution | null = null;
  try {
    const raw = sessionStorage.getItem(ATTR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SessionAttribution>;
      if (parsed.session_id === sessionId) {
        stored = {
          session_id: sessionId,
          utm_source: parsed.utm_source || "",
          utm_medium: parsed.utm_medium || "",
          utm_campaign: parsed.utm_campaign || "",
          utm_term: parsed.utm_term || "",
          utm_content: parsed.utm_content || "",
          click_id: parsed.click_id || "",
        };
      }
    }
  } catch {
    stored = null;
  }

  if (!searchParams) {
    return stored || emptyAttr;
  }

  const { clickId, inferredSource, inferredMedium } = extractClickIdFromParams(searchParams);
  const utmSource = searchParams.get("utm_source") || inferredSource;
  const utmMedium = searchParams.get("utm_medium") || inferredMedium;
  const utmCampaign = searchParams.get("utm_campaign") || "";
  const utmTerm = searchParams.get("utm_term") || "";
  const utmContent = searchParams.get("utm_content") || "";

  const hasFreshParams = Boolean(
    utmSource || utmMedium || utmCampaign || utmTerm || utmContent || clickId
  );

  if (!hasFreshParams) {
    return stored || emptyAttr;
  }

  const merged: SessionAttribution = {
    session_id: sessionId,
    utm_source: utmSource || stored?.utm_source || "",
    utm_medium: utmMedium || stored?.utm_medium || "",
    utm_campaign: utmCampaign || stored?.utm_campaign || "",
    utm_term: utmTerm || stored?.utm_term || "",
    utm_content: utmContent || stored?.utm_content || "",
    click_id: clickId || stored?.click_id || "",
  };

  try {
    sessionStorage.setItem(ATTR_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage quota errors
  }
  return merged;
}

function readNavigationTtfbMs(): number {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return 0;
  }
  try {
    const entries = performance.getEntriesByType("navigation");
    if (!entries || entries.length === 0) return 0;
    const nav = entries[0] as PerformanceNavigationTiming;
    if (typeof nav.responseStart !== "number" || nav.responseStart <= 0) return 0;
    const reqStart = typeof nav.requestStart === "number" && nav.requestStart > 0 ? nav.requestStart : 0;
    return Math.max(0, Math.round(nav.responseStart - reqStart));
  } catch {
    return 0;
  }
}

function computeCurrentScrollDepthPct(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const docEl = document.documentElement;
  const body = document.body;
  const docHeight = Math.max(
    docEl?.scrollHeight || 0,
    body?.scrollHeight || 0,
    docEl?.offsetHeight || 0
  );
  const winHeight = window.innerHeight || docEl?.clientHeight || 0;
  if (docHeight <= 0) return 0;
  if (docHeight <= winHeight) return 100;
  const scrollTop = window.scrollY || docEl?.scrollTop || 0;
  const rawPct = Math.round(((scrollTop + winHeight) / docHeight) * 100);
  return Math.max(0, Math.min(100, rawPct));
}

function sendAnalyticsPayload(
  endpoint: string,
  payload: Record<string, unknown>,
  authToken: string
): void {
  const bodyStr = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([bodyStr], { type: "application/json" });
    if (navigator.sendBeacon(endpoint, blob)) {
      return;
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  void fetch(endpoint, {
    method: "POST",
    headers,
    body: bodyStr,
    keepalive: true,
  }).catch(() => {});
}

export function bridgeB2BEventToGtag(
  gaEventName: "search" | "add_to_cart" | "generate_lead",
  params: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  if (isNonStorefrontPath(window.location.pathname)) return;
  const win = window as WindowWithGtag;
  if (typeof win.gtag !== "function") return;
  try {
    win.gtag("event", gaEventName, params);
  } catch {
    // Prevent third-party analytics blockers from interrupting storefront UX
  }
}

function forwardMemberEventToGtag(payload: MemberEventPayload): void {
  const evType = payload.event_type.toLowerCase();
  const currency = readPreferredCurrency();

  if (evType === "search" || evType === "catalog_search") {
    const term =
      (typeof payload.metadata?.query === "string" && payload.metadata.query) ||
      payload.title ||
      "";
    if (term) {
      bridgeB2BEventToGtag("search", { search_term: term });
    }
    return;
  }

  if (evType === "cart_add" || evType === "add_to_cart") {
    bridgeB2BEventToGtag("add_to_cart", {
      currency,
      item_id: payload.entity_id || "",
      item_name: payload.title || "",
      item_category: payload.entity_type || "product",
    });
    return;
  }

  const leadEvents = new Set([
    "generate_lead",
    "lead",
    "whatsapp_click",
    "brand_whatsapp_click",
    "inquiry_submit",
    "rfq_submit",
    "chat_start",
    "offer_request",
    "order_create",
  ]);
  if (leadEvents.has(evType)) {
    bridgeB2BEventToGtag("generate_lead", {
      currency,
      event_category: payload.event_category || "b2b_lead",
      event_label: payload.title || evType,
      entity_id: payload.entity_id || "",
    });
  }
}

export interface MemberEventPayload {
  event_type: string;
  event_category?: string;
  title?: string;
  subtitle?: string;
  url_path?: string;
  entity_type?: string;
  entity_id?: string;
  image_url?: string;
  duration_sec?: number;
  scroll_depth_pct?: number;
  lcp_ms?: number;
  cls_score?: number;
  inp_ms?: number;
  ttfb_ms?: number;
  screen_width?: number;
  language?: string;
  metadata?: Record<string, unknown>;
}

export function trackMemberEvent(payload: MemberEventPayload): void {
  if (typeof window === "undefined") return;

  const authToken = readStoreAuthToken();
  const currentPath = payload.url_path || window.location.pathname;
  const bodyObj: Record<string, unknown> = {
    visitor_id: getOrSetVisitorId(),
    session_id: getOrSetSessionId(),
    auth_token: authToken,
    url_path: currentPath,
    screen_width: payload.screen_width ?? (window.innerWidth || screen.width || 0),
    language: payload.language || resolveActiveLanguage(window.location.pathname),
    ...payload,
  };

  sendAnalyticsPayload("/api/v1/store/member-events", bodyObj, authToken);
  forwardMemberEventToGtag(payload);
}

function observePerformanceType(
  entryType: string,
  extraOptions: Record<string, unknown>,
  onEntries: (entries: PerformanceEntry[]) => void
): PerformanceObserver | null {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return null;
  }
  try {
    const observer = new PerformanceObserver((list) => {
      onEntries(list.getEntries());
    });
    observer.observe({ type: entryType, buffered: true, ...extraOptions } as PerformanceObserverInit);
    return observer;
  } catch {
    return null;
  }
}

function registerWebVitalsObservers(vitalsRef: { current: WebVitalsSnapshot }): () => void {
  const observers: PerformanceObserver[] = [];

  const lcpObs = observePerformanceType("largest-contentful-paint", {}, (entries) => {
    const last = entries.at(-1);
    if (last && last.startTime > 0) {
      vitalsRef.current.lcpMs = Math.round(last.startTime);
    }
  });
  if (lcpObs) observers.push(lcpObs);

  const clsObs = observePerformanceType("layout-shift", {}, (entries) => {
    for (const entry of entries) {
      const shift = entry as LayoutShiftEntry;
      if (!shift.hadRecentInput && typeof shift.value === "number") {
        vitalsRef.current.clsScore = Number((vitalsRef.current.clsScore + shift.value).toFixed(4));
      }
    }
  });
  if (clsObs) observers.push(clsObs);

  const inpObs = observePerformanceType("event", { durationThreshold: 16 }, (entries) => {
    for (const entry of entries) {
      const ev = entry as EventTimingEntry;
      const dur = Math.round(ev.duration || 0);
      if (dur > vitalsRef.current.inpMs) {
        vitalsRef.current.inpMs = dur;
      }
    }
  });
  if (inpObs) observers.push(inpObs);

  return () => {
    for (const obs of observers) {
      try {
        obs.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  };
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);
  const pageEnteredAt = useRef<number>(0);
  const lastFlushedDurationSec = useRef<number>(0);
  const maxScrollDepthPct = useRef<number>(0);
  const vitalsRef = useRef<WebVitalsSnapshot>({
    lcpMs: 0,
    clsScore: 0,
    inpMs: 0,
    ttfbMs: 0,
  });

  // Collect Core Web Vitals once across client navigation lifecycle
  useEffect(() => {
    if (typeof window === "undefined" || isNonStorefrontPath(pathname)) return;
    vitalsRef.current.ttfbMs = readNavigationTtfbMs();
    return registerWebVitalsObservers(vitalsRef);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || isNonStorefrontPath(pathname)) {
      return;
    }

    const flushPageDwell = () => {
      if (!lastTrackedPath.current || pageEnteredAt.current <= 0) return;
      const totalSec = Math.min(3600, Math.round((Date.now() - pageEnteredAt.current) / 1000));
      if (totalSec < 2 || totalSec <= lastFlushedDurationSec.current) return;
      lastFlushedDurationSec.current = totalSec;

      const finalScrollPct = Math.max(maxScrollDepthPct.current, computeCurrentScrollDepthPct());
      const vitals = vitalsRef.current;

      trackMemberEvent({
        event_type: "page_dwell",
        event_category: "engagement",
        url_path: lastTrackedPath.current,
        duration_sec: totalSec,
        scroll_depth_pct: finalScrollPct,
        lcp_ms: vitals.lcpMs,
        cls_score: vitals.clsScore,
        inp_ms: vitals.inpMs,
        ttfb_ms: vitals.ttfbMs || readNavigationTtfbMs(),
      });
    };

    const queryStr = searchParams?.toString() || "";
    const fullPath = queryStr ? `${pathname}?${queryStr}` : pathname;

    if (lastTrackedPath.current && lastTrackedPath.current !== fullPath) {
      flushPageDwell();
    }

    if (lastTrackedPath.current !== fullPath) {
      lastTrackedPath.current = fullPath;
      pageEnteredAt.current = Date.now();
      lastFlushedDurationSec.current = 0;
      maxScrollDepthPct.current = computeCurrentScrollDepthPct();
    }

    let lastScrollHandledAt = 0;
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollHandledAt < SCROLL_THROTTLE_MS) return;
      lastScrollHandledAt = now;
      const pct = computeCurrentScrollDepthPct();
      if (pct > maxScrollDepthPct.current) {
        maxScrollDepthPct.current = pct;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPageDwell();
      }
    };

    const handlePageHide = () => {
      flushPageDwell();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    const searchKeyword = searchParams?.get("q") || searchParams?.get("search") || "";
    if (searchKeyword.trim()) {
      bridgeB2BEventToGtag("search", { search_term: searchKeyword.trim() });
    }

    // Slight micro-delay so client components (e.g., ProductDetailClient) can update document.title
    const timer = window.setTimeout(() => {
      const visitorId = getOrSetVisitorId();
      const sessionId = getOrSetSessionId();
      const authToken = readStoreAuthToken();
      const attribution = resolveSessionAttribution(sessionId, searchParams);
      const ttfbMs = vitalsRef.current.ttfbMs || readNavigationTtfbMs();

      const payload: Record<string, unknown> = {
        visitor_id: visitorId,
        session_id: sessionId,
        auth_token: authToken,
        page_title: document.title || "",
        url: window.location.href,
        path: fullPath,
        referrer: document.referrer || "",
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        utm_term: attribution.utm_term,
        utm_content: attribution.utm_content,
        click_id: attribution.click_id,
        currency: readPreferredCurrency(),
        language: resolveActiveLanguage(pathname),
        screen_width: window.innerWidth || screen.width || 0,
        screen_height: window.innerHeight || screen.height || 0,
        ttfb_ms: ttfbMs,
      };

      sendAnalyticsPayload("/api/v1/store/track", payload, authToken);
    }, 120);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [pathname, searchParams]);

  return null;
}
