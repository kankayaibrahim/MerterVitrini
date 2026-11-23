import type { MetadataRoute } from "next";
import {
  buildPrefixedAlternates,
  buildQueryLangAlternates,
  SITE_ORIGIN,
  ssrStoreFetch,
  SUPPORTED_SEO_LANGS,
} from "@/utils/seoHelpers";
import { getSupplierSubdomainUrl } from "@/utils/subdomain";

export const revalidate = 3600;

const PRODUCTS_PER_SITEMAP = 1500;

interface SitemapCategory {
  id: string;
  slug?: string;
  children?: SitemapCategory[];
}

interface SitemapProduct {
  id?: string;
  slug?: string;
  updated_at?: string;
}

interface SitemapBlogPost {
  id: string;
  slug?: string;
  translations?: Record<string, { slug?: string; title?: string }>;
  updated_at?: string;
}

interface SitemapStaticPage {
  slug?: string;
  updated_at?: string;
}

interface SitemapBrand {
  id: string;
  slug?: string;
  subdomain?: string;
  subdomain_enabled?: boolean;
  is_active?: boolean;
  updated_at?: string;
}

function parseProductsPayload(raw: unknown): SitemapProduct[] {
  if (Array.isArray(raw)) return raw as SitemapProduct[];
  if (raw && typeof raw === "object" && "products" in raw) {
    const list = (raw as { products?: unknown }).products;
    if (Array.isArray(list)) return list as SitemapProduct[];
  }
  return [];
}

function parseBlogPayload(raw: unknown): SitemapBlogPost[] {
  if (Array.isArray(raw)) return raw as SitemapBlogPost[];
  if (raw && typeof raw === "object" && "posts" in raw) {
    const list = (raw as { posts?: unknown }).posts;
    if (Array.isArray(list)) return list as SitemapBlogPost[];
  }
  return [];
}

function collectCategoryPaths(
  nodes: readonly SitemapCategory[],
  parentSlugs: readonly string[] = []
): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (!node.slug) continue;
    const trail = [...parentSlugs, node.slug];
    paths.push(trail.join("/"));
    if (node.children && node.children.length > 0) {
      paths.push(...collectCategoryPaths(node.children, trail));
    }
  }
  return paths;
}

function appendPrefixedStaticRoutes(
  entries: MetadataRoute.Sitemap,
  now: Date
): void {
  const subRoutes: ReadonlyArray<{
    subPath: string;
    freq: "daily" | "weekly" | "monthly";
    priority: number;
  }> = [
      { subPath: "", freq: "daily", priority: 0.95 },
      { subPath: "tum-urunler", freq: "daily", priority: 0.9 },
      { subPath: "yeni-urunler", freq: "daily", priority: 0.92 },
      { subPath: "b2b", freq: "weekly", priority: 0.85 },
      { subPath: "faq", freq: "weekly", priority: 0.8 },
      { subPath: "contact", freq: "monthly", priority: 0.8 },
      { subPath: "tedarikci-basvuru", freq: "monthly", priority: 0.8 },
      { subPath: "site-haritasi", freq: "weekly", priority: 0.7 },
      { subPath: "blog", freq: "daily", priority: 0.8 },
    ];

  for (const route of subRoutes) {
    for (const lang of SUPPORTED_SEO_LANGS) {
      if (route.subPath === "" && lang === "tr") {
        continue;
      }
      const alt = buildPrefixedAlternates(route.subPath, lang);
      entries.push({
        url: alt.canonical,
        lastModified: now,
        changeFrequency: route.freq,
        priority: route.priority,
        alternates: { languages: alt.languages },
      });
    }
  }
}

function appendStandaloneDirectoryRoutes(
  entries: MetadataRoute.Sitemap,
  brands: readonly SitemapBrand[],
  now: Date
): void {
  const standalonePaths: ReadonlyArray<{
    path: string;
    freq: "daily" | "weekly" | "monthly";
    priority: number;
  }> = [
      { path: "/toptan-hazir-giyim", freq: "daily", priority: 0.98 },
      { path: "/ureticiler", freq: "daily", priority: 0.9 },
      { path: "/alim-talepleri", freq: "daily", priority: 0.85 },
      { path: "/hizmet-saglayicilar", freq: "weekly", priority: 0.8 },
      { path: "/mobil-uygulama", freq: "weekly", priority: 0.75 },
      { path: "/account-deletion", freq: "monthly", priority: 0.4 },
    ];

  for (const item of standalonePaths) {
    const alt = buildQueryLangAlternates(item.path, "tr");
    entries.push({
      url: alt.canonical,
      lastModified: now,
      changeFrequency: item.freq,
      priority: item.priority,
      alternates: { languages: alt.languages },
    });
  }

  for (const brand of brands) {
    if (!brand.slug || brand.is_active === false) continue;
    const modDate = brand.updated_at ? new Date(brand.updated_at) : now;
    const subUrl = getSupplierSubdomainUrl(brand);
    const showcaseAlt = buildQueryLangAlternates(
      subUrl || `/ureticiler/${brand.slug}`,
      "tr"
    );
    const editorialAlt = buildQueryLangAlternates(
      subUrl ? `${subUrl}/tanitim` : `/ureticiler/${brand.slug}/tanitim`,
      "tr"
    );
    entries.push(
      {
        url: showcaseAlt.canonical,
        lastModified: modDate,
        changeFrequency: "daily",
        priority: 0.85,
        alternates: { languages: showcaseAlt.languages },
      },
      {
        url: editorialAlt.canonical,
        lastModified: modDate,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: { languages: editorialAlt.languages },
      }
    );
  }
}

function appendCmsPages(
  entries: MetadataRoute.Sitemap,
  pages: readonly SitemapStaticPage[],
  now: Date
): void {
  const defaultSlugs = [
    "hakkimizda",
    "gizlilik-politikasi",
    "kullanici-sozlesmesi",
    "tedarikci-sozlesmesi",
    "yer-saglayici-bildirimi",
    "telif-hakki-ve-uyar-kaldir",
    "mesafeli-satis-sozlesmesi",
    "iptal-iade-kosullari",
  ];
  const slugMap = new Map<string, Date>();
  for (const s of defaultSlugs) {
    slugMap.set(s, now);
  }
  for (const p of pages) {
    if (p.slug) {
      slugMap.set(p.slug, p.updated_at ? new Date(p.updated_at) : now);
    }
  }

  for (const [slug, modDate] of slugMap.entries()) {
    for (const lang of SUPPORTED_SEO_LANGS) {
      const alt = buildPrefixedAlternates(`pages/${slug}`, lang);
      entries.push({
        url: alt.canonical,
        lastModified: modDate,
        changeFrequency: "monthly",
        priority: 0.65,
        alternates: { languages: alt.languages },
      });
    }
  }
}

function appendBlogPosts(
  entries: MetadataRoute.Sitemap,
  posts: readonly SitemapBlogPost[],
  now: Date
): void {
  for (const post of posts) {
    const trTitle = (post.translations?.tr?.title || "").toLowerCase();
    if (trTitle.includes("merter toptan kadın giyim & tekstil üreticisi")) {
      continue;
    }
    const modDate = post.updated_at ? new Date(post.updated_at) : now;
    const languages: Record<string, string> = {};

    for (const lang of SUPPORTED_SEO_LANGS) {
      const localizedSlug =
        post.translations?.[lang]?.slug ||
        post.translations?.en?.slug ||
        post.translations?.tr?.slug ||
        post.slug;
      if (localizedSlug) {
        languages[lang] = `${SITE_ORIGIN}/${lang}/blog/${localizedSlug}`;
      }
    }
    if (!languages.en && !languages.tr) continue;
    languages["x-default"] = languages.en || languages.tr;

    const primaryUrl = languages.tr || languages.en;
    entries.push({
      url: primaryUrl,
      lastModified: modDate,
      changeFrequency: "weekly",
      priority: 0.75,
      alternates: { languages },
    });
  }
}

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const productsRaw = await ssrStoreFetch<SitemapProduct[]>("/sitemap/products", 3600);
  const products = parseProductsPayload(productsRaw);
  const count = products.length > 0 ? products.length : 6000;
  const chunkCount = Math.max(1, Math.ceil(count / PRODUCTS_PER_SITEMAP));
  const sitemaps: Array<{ id: number }> = [{ id: 0 }];
  for (let i = 1; i <= chunkCount; i++) {
    sitemaps.push({ id: i });
  }
  return sitemaps;
}

async function resolveSitemapPartitionId(
  rawId?: Promise<string | number | undefined> | string | number
): Promise<number> {
  const resolvedId =
    typeof rawId === "object" && rawId !== null && "then" in rawId
      ? await rawId
      : rawId;
  const numericId =
    typeof resolvedId === "number"
      ? resolvedId
      : Number.parseInt(String(resolvedId ?? "0"), 10);
  return Number.isNaN(numericId) ? 0 : numericId;
}

async function buildCoreSitemapPartition(now: Date): Promise<MetadataRoute.Sitemap> {
  const sitemapUrls: MetadataRoute.Sitemap = [];

  const rootAlternates = buildPrefixedAlternates("", "tr");
  sitemapUrls.push({
    url: SITE_ORIGIN,
    lastModified: now,
    changeFrequency: "daily",
    priority: 1,
    alternates: {
      languages: rootAlternates.languages,
    },
  });

  appendPrefixedStaticRoutes(sitemapUrls, now);

  const [categoriesRaw, blogRaw, brandsRaw, pagesRaw] = await Promise.all([
    ssrStoreFetch<SitemapCategory[]>("/categories", 3600),
    ssrStoreFetch<unknown>("/blog", 3600),
    ssrStoreFetch<SitemapBrand[]>("/brands", 3600),
    ssrStoreFetch<SitemapStaticPage[]>("/pages", 3600),
  ]);

  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : [];
  const categoryPaths = collectCategoryPaths(categories);
  for (const catPath of categoryPaths) {
    for (const lang of SUPPORTED_SEO_LANGS) {
      const alt = buildPrefixedAlternates(catPath, lang);
      sitemapUrls.push({
        url: alt.canonical,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.85,
        alternates: { languages: alt.languages },
      });
    }
  }

  appendStandaloneDirectoryRoutes(
    sitemapUrls,
    Array.isArray(brandsRaw) ? brandsRaw : [],
    now
  );

  appendCmsPages(sitemapUrls, Array.isArray(pagesRaw) ? pagesRaw : [], now);
  appendBlogPosts(sitemapUrls, parseBlogPayload(blogRaw), now);

  return sitemapUrls;
}

async function buildProductSitemapPartition(
  safeId: number,
  now: Date
): Promise<MetadataRoute.Sitemap> {
  const productsRaw = await ssrStoreFetch<SitemapProduct[]>("/sitemap/products", 3600);
  const products = parseProductsPayload(productsRaw);
  const startIndex = (safeId - 1) * PRODUCTS_PER_SITEMAP;
  const chunk = products.slice(startIndex, startIndex + PRODUCTS_PER_SITEMAP);

  const productUrls: MetadataRoute.Sitemap = [];
  for (const prod of chunk) {
    if (!prod.slug) continue;
    const modDate = prod.updated_at ? new Date(prod.updated_at) : now;
    const alt = buildQueryLangAlternates(`/product/${prod.slug}`, "tr");

    productUrls.push({
      url: alt.canonical,
      lastModified: modDate,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: { languages: alt.languages },
    });
  }

  return productUrls;
}

export default async function sitemap(props?: {
  id?: Promise<string | number | undefined> | string | number;
}): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const safeId = await resolveSitemapPartitionId(props?.id);

  if (safeId === 0) {
    return buildCoreSitemapPartition(now);
  }
  return buildProductSitemapPartition(safeId, now);
}
