"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

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
    let sid = sessionStorage.getItem("mv_sid");
    if (!sid) {
      sid = generateUUID();
      sessionStorage.setItem("mv_sid", sid);
    }
    return sid;
  } catch {
    return generateUUID();
  }
}

function readStoreAuthToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("store_user_token") || "";
  } catch {
    return "";
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
  metadata?: Record<string, unknown>;
}

export function trackMemberEvent(payload: MemberEventPayload): void {
  if (typeof window === "undefined") return;

  const authToken = readStoreAuthToken();
  const bodyObj = {
    visitor_id: getOrSetVisitorId(),
    session_id: getOrSetSessionId(),
    auth_token: authToken,
    url_path: payload.url_path || window.location.pathname,
    screen_width: window.innerWidth || screen.width || 0,
    language: localStorage.getItem("preferred_lang") || "tr",
    ...payload,
  };

  const endpoint = "/api/v1/store/member-events";
  const bodyStr = JSON.stringify(bodyObj);

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

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);
  const pageEnteredAt = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/supplier") ||
      pathname.startsWith("/api")
    ) {
      return;
    }

    const flushPreviousPageDwell = () => {
      if (!lastTrackedPath.current || pageEnteredAt.current <= 0) return;
      const sec = Math.round((Date.now() - pageEnteredAt.current) / 1000);
      if (sec >= 3) {
        trackMemberEvent({
          event_type: "page_dwell",
          url_path: lastTrackedPath.current,
          duration_sec: Math.min(sec, 3600),
        });
      }
    };

    const fullPath = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    if (lastTrackedPath.current && lastTrackedPath.current !== fullPath) {
      flushPreviousPageDwell();
    }

    if (lastTrackedPath.current === fullPath) {
      return;
    }
    lastTrackedPath.current = fullPath;
    pageEnteredAt.current = Date.now();

    const segments = pathname.split("/").filter(Boolean);
    const lang = segments.length > 0 && segments[0].length === 2 ? segments[0] : "tr";

    // Slight micro-delay so client components (e.g., ProductDetailClient) can update document.title
    const timer = window.setTimeout(() => {
      const authToken = readStoreAuthToken();
      const payload = {
        visitor_id: getOrSetVisitorId(),
        session_id: getOrSetSessionId(),
        auth_token: authToken,
        page_title: document.title || "",
        url: window.location.href,
        path: fullPath,
        referrer: document.referrer || "",
        screen_width: window.innerWidth || screen.width || 0,
        screen_height: window.innerHeight || screen.height || 0,
        language: lang,
      };

      const endpoint = "/api/v1/store/track";
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
    }, 120);

    const handlePageHide = () => {
      flushPreviousPageDwell();
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [pathname, searchParams]);

  return null;
}
