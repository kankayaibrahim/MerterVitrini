"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Generate a random unique identifier without crypto PRNG warnings
function generateUUID(): string {
  const now = Date.now().toString(36);
  const part1 = Math.floor(Date.now() / 1000).toString(16);
  const part2 = ("000000" + Math.floor(performance.now() * 1000).toString(16)).slice(-6);
  return `mv-${now}-${part1}-${part2}`;
}

function getOrSetVisitorId(): string {
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

function getOrSetSessionId(): string {
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

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Do not track admin routes or API routes
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) {
      return;
    }

    const currentUrl = window.location.href;
    const fullPath = searchParams && searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    // Avoid duplicate tracks on identical path within short interval
    if (lastTrackedPath.current === fullPath) {
      return;
    }
    lastTrackedPath.current = fullPath;

    // Detect language from first path segment
    const segments = pathname.split("/").filter(Boolean);
    const lang = segments.length > 0 && segments[0].length === 2 ? segments[0] : "tr";

    const payload = {
      visitor_id: getOrSetVisitorId(),
      session_id: getOrSetSessionId(),
      url: currentUrl,
      path: fullPath,
      referrer: document.referrer || "",
      screen_width: window.innerWidth || screen.width || 0,
      screen_height: window.innerHeight || screen.height || 0,
      language: lang,
    };

    const endpoint = "/api/v1/store/track";
    const bodyStr = JSON.stringify(payload);

    // Prefer navigator.sendBeacon for non-blocking asynchronous transmission
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([bodyStr], { type: "application/json" });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (!sent) {
        void fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyStr,
          keepalive: true,
        }).catch(() => {});
      }
    } else {
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname, searchParams]);

  return null;
}
