import { MetadataRoute } from "next";

export const revalidate = 3600;

interface Category {
  id: string;
  title: string;
  slug?: string;
  children?: Category[];
}

interface Product {
  id: string;
  slug: string;
  updated_at?: string;
}

interface Language {
  code: string;
  categoryPrefix: string;
}

interface BlogPost {
  id: string;
  slug: string;
  updated_at?: string;
}

// Fetch active languages from DB API with robust fallback
async function fetchActiveLanguages(): Promise<Language[]> {
  try {
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/languages?t=" + Date.now());
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((l: { code: string; categoryPrefix: string }) => {
          let code = l.code;
          if (code.startsWith("en_")) code = "en";
          else if (code.startsWith("tr_")) code = "tr";
          else if (code.startsWith("pl_")) code = "pl";
          else if (code.startsWith("bg_")) code = "bg";
          else if (code.startsWith("de_")) code = "de";
          else if (code.startsWith("fr_")) code = "fr";
          else if (code.startsWith("ru_")) code = "ru";
          else if (code.startsWith("ar_")) code = "ar";
          return { ...l, code };
        });
      }
    }
  } catch (err) {
    console.error("[SITEMAP] Failed to fetch active languages:", err);
  }
  return [
    { code: "tr", categoryPrefix: "tr" },
    { code: "en", categoryPrefix: "en" },
    { code: "pl", categoryPrefix: "pl" },
    { code: "bg", categoryPrefix: "bg" },
    { code: "ar", categoryPrefix: "ar" },
    { code: "ru", categoryPrefix: "ru" },
    { code: "de", categoryPrefix: "de" },
    { code: "fr", categoryPrefix: "fr" },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://mertervitrini.com.tr";
  const sitemapUrls: MetadataRoute.Sitemap = [];

  try {
    // 1. Root Domain Homepage
    sitemapUrls.push({
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    });

    const langs = await fetchActiveLanguages();
    const uniquePrefixes = Array.from(new Set(langs.map((l) => l.categoryPrefix)));

    // 2. Language Root Homepages (e.g. /tr, /en, /ru)
    uniquePrefixes.forEach((prefix) => {
      sitemapUrls.push({
        url: `${baseUrl}/${prefix}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.95,
      });
      // All products landing
      sitemapUrls.push({
        url: `${baseUrl}/${prefix}/tum-urunler`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.85,
      });
    });

    // 3. Fetch Active Categories
    const categoriesResponse = await fetch(`${baseUrl}/api/v1/store/categories?t=${Date.now()}`);
    if (categoriesResponse.ok) {
      const categories: Category[] = await categoriesResponse.json();
      
      const extractCategoryUrls = (nodes: Category[], prefix: string, parentSlugs: string[] = []) => {
        nodes.forEach((n) => {
          if (n.slug) {
            const currentTrail = [...parentSlugs, n.slug];
            const path = currentTrail.join("/");
            sitemapUrls.push({
              url: `${baseUrl}/${prefix}/${path}`,
              lastModified: new Date(),
              changeFrequency: "weekly",
              priority: 0.85,
            });
            if (n.children && n.children.length > 0) {
              extractCategoryUrls(n.children, prefix, currentTrail);
            }
          }
        });
      };

      if (Array.isArray(categories)) {
        uniquePrefixes.forEach((prefix) => {
          extractCategoryUrls(categories, prefix);
        });
      }
    }

    // 4. Fetch All Active Products (handles both array and { products: [...] } dictionary response)
    const productsResponse = await fetch(`${baseUrl}/api/v1/store/products?limit=10000&t=${Date.now()}`);
    if (productsResponse.ok) {
      const prodData = await productsResponse.json();
      let productsList: Product[] = [];
      if (Array.isArray(prodData)) {
        productsList = prodData;
      } else if (prodData && typeof prodData === "object" && Array.isArray(prodData.products)) {
        productsList = prodData.products;
      }

      productsList.forEach((p) => {
        if (p.slug) {
          sitemapUrls.push({
            url: `${baseUrl}/product/${p.slug}`,
            lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
            changeFrequency: "daily",
            priority: 0.9,
          });
        }
      });
    }

    // 5. Fetch Blog Posts and Multi-language Blog Routes
    try {
      const blogResponse = await fetch(`${baseUrl}/api/v1/store/blog?t=${Date.now()}`);
      if (blogResponse.ok) {
        const blogData = await blogResponse.json();
        let blogList: BlogPost[] = [];
        if (Array.isArray(blogData)) {
          blogList = blogData;
        } else if (blogData && typeof blogData === "object" && Array.isArray(blogData.posts)) {
          blogList = blogData.posts;
        }

        uniquePrefixes.forEach((prefix) => {
          // Blog index per language
          sitemapUrls.push({
            url: `${baseUrl}/${prefix}/blog`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.8,
          });

          // Blog articles
          blogList.forEach((post) => {
            if (post.slug) {
              sitemapUrls.push({
                url: `${baseUrl}/${prefix}/blog/${post.slug}`,
                lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
                changeFrequency: "weekly",
                priority: 0.75,
              });
            }
          });
        });
      }
    } catch (blogErr) {
      console.error("[SITEMAP] Blog fetch failed:", blogErr);
    }

  } catch (err) {
    console.error("[SITEMAP] Failed to generate sitemap dynamically:", err);
  }

  return sitemapUrls;
}
