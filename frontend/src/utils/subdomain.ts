export const ROOT_DOMAIN = "mertervitrini.com.tr";
export const ROOT_ORIGIN = "https://mertervitrini.com.tr";

const SUBDOMAIN_LABEL_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/;

export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "www",
  "api",
  "admin",
  "adminapi",
  "auth",
  "mail",
  "translateapi",
  "app",
  "web",
  "shop",
  "store",
  "storefront",
  "static",
  "cdn",
  "media",
  "uploads",
  "img",
  "images",
  "assets",
  "files",
  "ftp",
  "sftp",
  "smtp",
  "imap",
  "pop",
  "pop3",
  "mx",
  "ns",
  "ns1",
  "ns2",
  "ns3",
  "ns4",
  "dns",
  "vpn",
  "ssh",
  "proxy",
  "gateway",
  "edge",
  "dev",
  "staging",
  "stage",
  "test",
  "beta",
  "alpha",
  "demo",
  "sandbox",
  "local",
  "localhost",
  "panel",
  "dashboard",
  "portal",
  "supplier",
  "suppliers",
  "tedarikci",
  "tedarikciler",
  "uretici",
  "ureticiler",
  "vendor",
  "seller",
  "merchant",
  "partner",
  "blog",
  "news",
  "help",
  "support",
  "destek",
  "status",
  "health",
  "metrics",
  "docs",
  "swagger",
  "graphql",
  "ws",
  "wss",
  "chat",
  "billing",
  "pay",
  "payment",
  "checkout",
  "cart",
  "order",
  "orders",
  "account",
  "accounts",
  "profile",
  "login",
  "register",
  "signup",
  "signin",
  "oauth",
  "sso",
  "keycloak",
  "iam",
  "root",
  "system",
  "sys",
  "ops",
  "security",
  "abuse",
  "postmaster",
  "webmaster",
  "hostmaster",
  "noreply",
  "info",
  "contact",
  "iletisim",
  "merter",
  "mertervitrini",
  "vitrini",
  "b2b",
  "wholesale",
  "toptan",
  "rfq",
  "mobile",
  "android",
  "ios",
  "apk",
  "sitemap",
  "robots",
]);

export function stripHostnamePort(hostHeader: string): string {
  const first = (hostHeader || "").split(",")[0]?.trim().toLowerCase() || "";
  if (!first) return "";
  if (first.startsWith("[")) {
    const closeIdx = first.indexOf("]");
    return closeIdx >= 0 ? first.slice(0, closeIdx + 1) : first;
  }
  const colonIdx = first.indexOf(":");
  return colonIdx >= 0 ? first.slice(0, colonIdx) : first;
}

export function extractSupplierSubdomainFromHost(hostHeader: string): string | null {
  const host = stripHostnamePort(hostHeader);
  const suffix = `.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) {
    return null;
  }
  const sub = host.slice(0, -suffix.length);
  if (!sub || sub.includes(".") || sub.includes("--")) {
    return null;
  }
  if (!SUBDOMAIN_LABEL_RE.test(sub) || RESERVED_SUBDOMAINS.has(sub)) {
    return null;
  }
  return sub;
}

export function isSupplierSubdomainHostname(hostHeader: string): boolean {
  return extractSupplierSubdomainFromHost(hostHeader) !== null;
}

export function normalizeSubdomainDraft(raw: string): string {
  const map: Record<string, string> = {
    ı: "i",
    İ: "i",
    I: "i",
    ğ: "g",
    Ğ: "g",
    ü: "u",
    Ü: "u",
    ş: "s",
    Ş: "s",
    ö: "o",
    Ö: "o",
    ç: "c",
    Ç: "c",
  };
  return (raw || "")
    .replace(/[ıİIğĞüÜşŞöÖçÇ]/g, (ch) => map[ch] || ch)
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-{2,}/g, "-");
}

export function validateSupplierSubdomainInput(raw: string): string | null {
  const trimmed = (raw || "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length < 3) {
    return "Subdomain en az 3 karakter olmalıdır.";
  }
  if (trimmed.length > 63) {
    return "Subdomain en fazla 63 karakter olabilir.";
  }
  if (trimmed.includes("--")) {
    return "Ardışık tire (--) kullanılamaz.";
  }
  if (!SUBDOMAIN_LABEL_RE.test(trimmed)) {
    return "Yalnızca küçük İngilizce harf (a-z), rakam (0-9) ve kelimeler arası tire (-) kullanılabilir.";
  }
  if (RESERVED_SUBDOMAINS.has(trimmed)) {
    return `"${trimmed}" sistem tarafından rezerve edilmiş bir alt alan adıdır.`;
  }
  return null;
}

export function getSupplierSubdomainUrl(
  brand?: { readonly subdomain?: string | null; readonly subdomain_enabled?: boolean } | null
): string | null {
  if (!brand || brand.subdomain_enabled === false || !brand.subdomain) {
    return null;
  }
  const clean = brand.subdomain.trim().toLowerCase();
  if (!SUBDOMAIN_LABEL_RE.test(clean) || clean.includes("--") || RESERVED_SUBDOMAINS.has(clean)) {
    return null;
  }
  return `https://${clean}.${ROOT_DOMAIN}`;
}

export interface SupplierLinkTarget {
  readonly id?: string;
  readonly slug?: string;
  readonly subdomain?: string | null;
  readonly subdomain_enabled?: boolean;
}

export function getSupplierShowcaseHref(
  brand?: SupplierLinkTarget | null,
  lang = "tr"
): string {
  const safeLang = (lang || "tr").trim().toLowerCase();
  const langSuffix = safeLang && safeLang !== "tr" ? `?lang=${encodeURIComponent(safeLang)}` : "";
  const subdomainUrl = getSupplierSubdomainUrl(brand);
  if (subdomainUrl) {
    return langSuffix ? `${subdomainUrl}/${langSuffix}` : subdomainUrl;
  }
  const fallbackSlug = encodeURIComponent((brand?.slug || brand?.id || "").trim());
  if (!fallbackSlug) {
    return `/ureticiler${langSuffix}`;
  }
  return `/ureticiler/${fallbackSlug}${langSuffix}`;
}

export function getSupplierEditorialHref(
  brand?: SupplierLinkTarget | null,
  lang = "tr"
): string {
  const safeLang = (lang || "tr").trim().toLowerCase();
  const langSuffix = safeLang && safeLang !== "tr" ? `?lang=${encodeURIComponent(safeLang)}` : "";
  const subdomainUrl = getSupplierSubdomainUrl(brand);
  if (subdomainUrl) {
    return `${subdomainUrl}/tanitim${langSuffix}`;
  }
  const fallbackSlug = encodeURIComponent((brand?.slug || brand?.id || "").trim());
  if (!fallbackSlug) {
    return `/ureticiler${langSuffix}`;
  }
  return `/ureticiler/${fallbackSlug}/tanitim${langSuffix}`;
}

export function toRootDomainUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${ROOT_ORIGIN}${normalized}`;
}

export function buildCookieDomainAttribute(hostname: string): string {
  const clean = stripHostnamePort(hostname);
  if (clean === ROOT_DOMAIN || clean.endsWith(`.${ROOT_DOMAIN}`)) {
    return `; Domain=.${ROOT_DOMAIN}`;
  }
  return "";
}
