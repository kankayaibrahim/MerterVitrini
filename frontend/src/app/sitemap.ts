import type { MetadataRoute } from "next";
import {
  buildPrefixedAlternates,
  buildQueryLangAlternates,
  SITE_ORIGIN,
  ssrStoreFetch,
  SUPPORTED_SEO_LANGS,
} from "@/utils/seoHelpers";

export const revalidate = 3600;

interface SitemapCategory {
  id: string;
  slug?: string;
  children?: SitemapCategory[];
}

interface SitemapProduct {
  id: string;
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
    { subPath: "b2b", freq: "weekly", priority: 0.85 },
    { subPath: "faq", freq: "weekly", priority: 0.8 },
    { subPath: "contact", freq: "monthly", priority: 0.8 },
    { subPath: "tedarikci-basvuru", freq: "monthly", priority: 0.8 },
    { subPath: "site-haritasi", freq: "weekly", priority: 0.7 },
    { subPath: "blog", freq: "daily", priority: 0.8 },
  ];

  for (const route of subRoutes) {
    for (const lang of SUPPORTED_SEO_LANGS) {
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
    const showcaseAlt = buildQueryLangAlternates(
      `/ureticiler/${brand.slug}`,
      "tr"
    );
    const editorialAlt = buildQueryLangAlternates(
      `/ureticiler/${brand.slug}/tanitim`,
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

    for (const lang of SUPPORTED_SEO_LANGS) {
      const targetUrl = languages[lang];
      if (!targetUrl) continue;
      entries.push({
        url: targetUrl,
        lastModified: modDate,
        changeFrequency: "weekly",
        priority: 0.75,
        alternates: { languages },
      });
    }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const sitemapUrls: MetadataRoute.Sitemap = [];

  const rootAlternates = buildPrefixedAlternates("", "en");
  sitemapUrls.push({
    url: SITE_ORIGIN,
    lastModified: now,
    changeFrequency: "daily",
    priority: 1,
    alternates: {
      languages: {
        ...rootAlternates.languages,
        "x-default": SITE_ORIGIN,
      },
    },
  });

  appendPrefixedStaticRoutes(sitemapUrls, now);

  const [categoriesRaw, productsRaw, blogRaw, brandsRaw, pagesRaw] =
    await Promise.all([
      ssrStoreFetch<SitemapCategory[]>("/categories", 3600),
      ssrStoreFetch<unknown>("/products?limit=10000", 3600),
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

  const products = parseProductsPayload(productsRaw);
  for (const prod of products) {
    if (!prod.slug) continue;
    const alt = buildQueryLangAlternates(`/product/${prod.slug}`, "tr");
    sitemapUrls.push({
      url: alt.canonical,
      lastModified: prod.updated_at ? new Date(prod.updated_at) : now,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: { languages: alt.languages },
    });
  }

  appendBlogPosts(sitemapUrls, parseBlogPayload(blogRaw), now);

  return sitemapUrls;
}
