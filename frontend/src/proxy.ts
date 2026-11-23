import { NextResponse, type NextRequest, type ProxyConfig } from "next/server";
import {
  isSupportedSeoLang,
  normalizeSeoLang,
  type SupportedSeoLang,
} from "@/utils/seoHelpers";
import {
  ROOT_DOMAIN,
  ROOT_ORIGIN,
  extractSupplierSubdomainFromHost,
} from "@/utils/subdomain";

interface ResolvedTenant {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  subdomain_enabled: boolean;
}

interface TenantCacheEntry {
  tenant: ResolvedTenant | null;
  expiresAt: number;
}

const TENANT_CACHE_TTL_HIT_MS = 60_000;
const TENANT_CACHE_TTL_MISS_MS = 15_000;
const TENANT_CACHE_MAX_ENTRIES = 500;
const tenantCache = new Map<string, TenantCacheEntry>();
const slugTenantCache = new Map<string, TenantCacheEntry>();
const SUPPLIER_SLUG_ROUTE_RE = /^\/ureticiler\/([^/]+)(\/tanitim)?\/?$/i;

const CENTRAL_PLATFORM_PREFIXES = [
  "/admin",
  "/supplier",
  "/tedarikci",
  "/google-callback",
  "/profile",
  "/alim-talepleri",
  "/hizmet-saglayicilar",
  "/mobil-uygulama",
  "/tedarikci-basvuru",
  "/toptan-hazir-giyim",
  "/blog",
  "/account-deletion",
  "/site-haritasi",
  "/faq",
  "/contact",
  "/b2b",
  "/cart",
  "/checkout",
  "/tum-urunler",
  "/yeni-urunler",
] as const;

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 47) {
    end--;
  }
  return value.slice(0, end);
}

function getInternalBackendBase(): string {
  return trimTrailingSlashes(process.env.INTERNAL_API_URL || "http://127.0.0.1:8080");
}

function setBoundedCacheEntry(
  cache: Map<string, TenantCacheEntry>,
  key: string,
  tenant: ResolvedTenant | null,
  ttlMs: number
): void {
  if (cache.size >= TENANT_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, {
    tenant,
    expiresAt: Date.now() + ttlMs,
  });
}

async function fetchTenantWithCache(
  cache: Map<string, TenantCacheEntry>,
  cacheKey: string,
  apiPath: string
): Promise<ResolvedTenant | null> {
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached) {
    if (cached.expiresAt > now) {
      return cached.tenant;
    }
    cache.delete(cacheKey);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${getInternalBackendBase()}${apiPath}`, {
      headers: {
        Accept: "application/json",
        "X-SSR-Prefetch": "1",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.ok) {
      const data = (await res.json()) as Partial<ResolvedTenant>;
      if (data && typeof data.slug === "string" && data.slug.trim() !== "") {
        const tenant: ResolvedTenant = {
          id: String(data.id || ""),
          name: String(data.name || ""),
          slug: data.slug.trim(),
          subdomain: String(data.subdomain || ""),
          subdomain_enabled: Boolean(data.subdomain_enabled),
        };
        setBoundedCacheEntry(cache, cacheKey, tenant, TENANT_CACHE_TTL_HIT_MS);
        return tenant;
      }
    }
    if (res.status >= 400 && res.status < 500) {
      setBoundedCacheEntry(cache, cacheKey, null, TENANT_CACHE_TTL_MISS_MS);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveTenantBySubdomain(subdomain: string): Promise<ResolvedTenant | null> {
  return fetchTenantWithCache(
    tenantCache,
    subdomain,
    `/api/v1/store/tenant/${encodeURIComponent(subdomain)}`
  );
}

function resolveTenantBySlug(slug: string): Promise<ResolvedTenant | null> {
  return fetchTenantWithCache(
    slugTenantCache,
    slug.toLowerCase(),
    `/api/v1/store/tenant/by-slug/${encodeURIComponent(slug)}`
  );
}

function isCentralPlatformPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (lower === "/ureticiler" || lower === "/ureticiler/") {
    return true;
  }
  for (const prefix of CENTRAL_PLATFORM_PREFIXES) {
    if (lower === prefix || lower.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  const firstSegment = lower.split("/").at(1) || "";
  if (isSupportedSeoLang(firstSegment)) {
    return true;
  }
  return false;
}

function detectRequestLang(request: NextRequest): SupportedSeoLang {
  const { pathname, searchParams } = request.nextUrl;

  const queryLang = searchParams.get("lang");
  if (queryLang && isSupportedSeoLang(queryLang.trim().toLowerCase())) {
    return normalizeSeoLang(queryLang, "tr");
  }

  if (pathname === "/" || pathname === "/toptan-hazir-giyim") {
    return "tr";
  }

  const firstSegment = pathname.split("/")[1]?.toLowerCase() || "";
  if (isSupportedSeoLang(firstSegment)) {
    return firstSegment;
  }

  return "tr";
}

function detectSubdomainRequestLang(request: NextRequest): SupportedSeoLang {
  const queryLang = request.nextUrl.searchParams.get("lang");
  if (queryLang && isSupportedSeoLang(queryLang.trim().toLowerCase())) {
    return normalizeSeoLang(queryLang, "tr");
  }
  const cookieLang = request.cookies.get("mv_pref_lang")?.value?.trim().toLowerCase();
  if (cookieLang && isSupportedSeoLang(cookieLang)) {
    return normalizeSeoLang(cookieLang, "tr");
  }
  return "tr";
}

function stripTrailingSlashExceptRoot(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isAllowedSubdomainCorsOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || extractSupplierSubdomainFromHost(host) !== null;
  } catch {
    return false;
  }
}

function applyCrossSubdomainCorsHeaders(
  response: NextResponse,
  origin: string | null,
  requestHeaders?: string | null
): NextResponse {
  if (!isAllowedSubdomainCorsOrigin(origin)) {
    return response;
  }
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
  if (requestHeaders !== undefined) {
    response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      requestHeaders || "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Url, Content-Type"
    );
    response.headers.set("Access-Control-Max-Age", "86400");
  }
  return response;
}

async function handleTenantSubdomainRequest(
  request: NextRequest,
  tenantSubdomain: string,
  origin: string | null
): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (isCentralPlatformPath(pathname)) {
    return applyCrossSubdomainCorsHeaders(
      NextResponse.redirect(`${ROOT_ORIGIN}${pathname}${search}`, 308),
      origin
    );
  }

  const tenant = await resolveTenantBySubdomain(tenantSubdomain);
  if (!tenant) {
    return NextResponse.rewrite(
      new URL("/ureticiler/__subdomain_not_found__", request.url)
    );
  }

  const detectedLang = detectSubdomainRequestLang(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mv-lang", detectedLang);
  requestHeaders.set("x-mv-tenant-subdomain", tenant.subdomain);
  requestHeaders.set("x-mv-tenant-slug", tenant.slug);

  const normalizedPath = stripTrailingSlashExceptRoot(pathname);
  const slugLower = tenant.slug.toLowerCase();
  const subLower = tenant.subdomain.toLowerCase();
  const normLower = normalizedPath.toLowerCase();

  if (
    normLower === `/ureticiler/${slugLower}` ||
    normLower === `/ureticiler/${subLower}`
  ) {
    return NextResponse.redirect(new URL(`/${search}`, request.url), 308);
  }
  if (
    normLower === `/ureticiler/${slugLower}/tanitim` ||
    normLower === `/ureticiler/${subLower}/tanitim`
  ) {
    return NextResponse.redirect(new URL(`/tanitim${search}`, request.url), 308);
  }

  if (normalizedPath === "/") {
    return NextResponse.rewrite(
      new URL(`/ureticiler/${encodeURIComponent(tenant.slug)}${search}`, request.url),
      { request: { headers: requestHeaders } }
    );
  }

  if (normLower === "/tanitim") {
    return NextResponse.rewrite(
      new URL(
        `/ureticiler/${encodeURIComponent(tenant.slug)}/tanitim${search}`,
        request.url
      ),
      { request: { headers: requestHeaders } }
    );
  }

  if (normLower.startsWith("/product/")) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return applyCrossSubdomainCorsHeaders(
    NextResponse.redirect(`${ROOT_ORIGIN}${pathname}${search}`, 308),
    origin
  );
}

async function maybeRedirectSupplierSlugToSubdomain(
  pathname: string,
  search: string,
  origin: string | null
): Promise<NextResponse | null> {
  const slugMatch = SUPPLIER_SLUG_ROUTE_RE.exec(pathname);
  if (!slugMatch?.[1]) {
    return null;
  }

  let rawSlug = slugMatch[1];
  try {
    rawSlug = decodeURIComponent(rawSlug).trim();
  } catch {
    rawSlug = rawSlug.trim();
  }
  if (!rawSlug || rawSlug.startsWith("__")) {
    return null;
  }

  const tenant = await resolveTenantBySlug(rawSlug);
  if (tenant?.subdomain && tenant.subdomain_enabled) {
    const subPath = slugMatch[2] ? "/tanitim" : "/";
    return applyCrossSubdomainCorsHeaders(
      NextResponse.redirect(
        `https://${tenant.subdomain}.${ROOT_DOMAIN}${subPath}${search}`,
        301
      ),
      origin
    );
  }
  return null;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (isAllowedSubdomainCorsOrigin(origin)) {
      return applyCrossSubdomainCorsHeaders(
        new NextResponse(null, { status: 204 }),
        origin,
        request.headers.get("access-control-request-headers")
      );
    }
    return new NextResponse(null, { status: 204 });
  }

  const rawHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const primaryHost = rawHost.split(",")[0]?.trim().toLowerCase() || "";
  const { pathname, search } = request.nextUrl;

  if (primaryHost.startsWith("www.mertervitrini.com.tr")) {
    return applyCrossSubdomainCorsHeaders(
      NextResponse.redirect(`${ROOT_ORIGIN}${pathname}${search}`, 308),
      origin
    );
  }

  const tenantSubdomain = extractSupplierSubdomainFromHost(primaryHost);
  if (tenantSubdomain) {
    return handleTenantSubdomainRequest(request, tenantSubdomain, origin);
  }

  if (pathname === "/tr" || pathname === "/tr/") {
    return applyCrossSubdomainCorsHeaders(
      NextResponse.redirect(`${ROOT_ORIGIN}/${search}`, 301),
      origin
    );
  }

  const supplierRedirect = await maybeRedirectSupplierSlugToSubdomain(
    pathname,
    search,
    origin
  );
  if (supplierRedirect) {
    return supplierRedirect;
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
    "/((?!api|_next/static|_next/image|uploads|banners|favicon[.]ico|robots[.]txt|sitemap[.]xml).*)",
  ],
};
