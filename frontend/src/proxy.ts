import { NextResponse, type NextRequest, type ProxyConfig } from "next/server";
import {
  isSupportedSeoLang,
  normalizeSeoLang,
  type SupportedSeoLang,
} from "@/utils/seoHelpers";

function detectRequestLang(request: NextRequest): SupportedSeoLang {
  const { pathname, searchParams } = request.nextUrl;

  const queryLang = searchParams.get("lang");
  if (queryLang && isSupportedSeoLang(queryLang.trim().toLowerCase())) {
    return normalizeSeoLang(queryLang, "tr");
  }

  if (pathname === "/") {
    return "en";
  }

  const firstSegment = pathname.split("/")[1]?.toLowerCase() || "";
  if (isSupportedSeoLang(firstSegment)) {
    return firstSegment;
  }

  return "tr";
}

export function proxy(request: NextRequest): NextResponse {
  const rawHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const primaryHost = rawHost.split(",")[0]?.trim().toLowerCase() || "";
  if (primaryHost.startsWith("www.mertervitrini.com.tr")) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(
      `https://mertervitrini.com.tr${pathname}${search}`,
      308
    );
  }

  const detectedLang = detectRequestLang(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mv-lang", detectedLang);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config: ProxyConfig = {
  matcher: [
    "/((?!api|_next/static|_next/image|uploads|banners|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
