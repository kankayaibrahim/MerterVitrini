import React from "react";
import { Metadata } from "next";
import StorefrontLayout from "@/components/store/StorefrontLayout";

interface PageProps {
  params: Promise<{
    categoryPrefix: string;
    slug: string[];
  }>;
}

export interface Language {
  code: string;
  label: string;
  flag: string;
  categoryPrefix: string;
  dir?: string;
  isActive: boolean;
  sortOrder: number;
}

// Fetch active languages from database with static fallback
async function fetchLanguages(): Promise<Language[]> {
  try {
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/languages?t=" + Date.now());
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((l: any) => {
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
    console.error("[SEO] Failed to fetch active languages, using fallback:", err);
  }
  
  // ==========================================================================
  // [TR] STATİK YEDEK PLANI (FALLBACK SYSTEM):
  // Bu yedek dizi, veritabanına kaydedilmiş dillerin aynısıdır. Next.js static build 
  // (derleme) sırasında veritabanı veya API bağlantısı koparsa derleme işleminin 
  // çökmesini (crash) önlemek ve SEO sayfalarının hatasız oluşmasını sağlamak amacıyla 
  // buraya yerleştirilmiştir.
  // 
  // [EN] STATIC FALLBACK SYSTEM:
  // This backup array represents the exact active languages stored in the DB.
  // It is placed here to prevent Next.js build crashes during static production 
  // builds (npm run build) if the database or API connection is temporarily offline, 
  // ensuring the storefront builds successfully under any circumstances.
  // ==========================================================================
  return [
    { code: "tr", label: "Türkçe", flag: "🇹🇷", categoryPrefix: "tr", isActive: true, sortOrder: 0 },
    { code: "en", label: "English", flag: "🇬🇧", categoryPrefix: "en", isActive: true, sortOrder: 1 },
    { code: "pl", label: "Polski", flag: "🇵🇱", categoryPrefix: "pl", isActive: true, sortOrder: 2 },
    { code: "bg", label: "Български", flag: "🇧🇬", categoryPrefix: "bg", isActive: true, sortOrder: 3 },
    { code: "ar", label: "العربية", flag: "🇸🇦", categoryPrefix: "ar", dir: "rtl", isActive: true, sortOrder: 4 },
    { code: "ru", label: "Русский", flag: "🇷🇺", categoryPrefix: "ru", isActive: true, sortOrder: 5 },
    { code: "de", label: "Deutsch", flag: "🇩🇪", categoryPrefix: "de", isActive: true, sortOrder: 6 },
    { code: "fr", label: "Français", flag: "🇫🇷", categoryPrefix: "fr", isActive: true, sortOrder: 7 },
  ];
}

// Generate static routes for all category prefixes and nested category slugs at compilation time
export async function generateStaticParams() {
  if (process.env.NEXT_BUILD_SSR === "true") return [];
  try {
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/categories?t=" + Date.now());
    const activeLangs = await fetchLanguages();
    if (response.ok) {
      const categories = await response.json();
      const params: { categoryPrefix: string; slug: string[] }[] = [];

      const extractSlugsForPrefix = (nodes: any[], prefix: string, parentSlugs: string[] = []) => {
        nodes.forEach((n) => {
          if (n.slug) {
            const currentTrail = [...parentSlugs, String(n.slug)];
            params.push({ categoryPrefix: prefix, slug: currentTrail });
            if (n.children && n.children.length > 0) {
              extractSlugsForPrefix(n.children, prefix, currentTrail);
            }
          }
        });
      };

      if (Array.isArray(categories)) {
        const uniquePrefixes = Array.from(new Set(activeLangs.map((l) => l.categoryPrefix)));
        uniquePrefixes.forEach((prefix) => {
          extractSlugsForPrefix(categories, prefix);
        });
      }
      return params;
    }
  } catch (err) {
    console.error("[SEO] Unified generateStaticParams failed:", err);
  }
  return [];
}

// Helper to find a category recursively in a tree by slug
function findCategoryBySlug(tree: any[], slug: string): any | null {
  for (const cat of tree) {
    if (cat.slug === slug) return cat;
    if (cat.children && cat.children.length > 0) {
      const found = findCategoryBySlug(cat.children, slug);
      if (found) return found;
    }
  }
  return null;
}

// Helper to get the full slug trail list of a category
function getCategorySlugPath(tree: any[], targetSlug: string, path: string[] = []): string[] | null {
  for (const cat of tree) {
    if (cat.slug === targetSlug) {
      return [...path, cat.slug];
    }
    if (cat.children && cat.children.length > 0) {
      const found = getCategorySlugPath(cat.children, targetSlug, [...path, cat.slug]);
      if (found) return found;
    }
  }
  return null;
}

// Generate dynamic SEO metadata on the server side using prefix and category slug
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix, slug: slugArr } = await params;
  const slug = Array.isArray(slugArr) && slugArr.length > 0 ? slugArr.slice(-1)[0] : (slugArr as unknown as string);
  
  const activeLangs = await fetchLanguages();
  const prefixToLangMap = new Map<string, string>();
  activeLangs.forEach((l) => {
    if (!prefixToLangMap.has(l.categoryPrefix) || l.code === "tr" || l.code === "en") {
      prefixToLangMap.set(l.categoryPrefix, l.code);
    }
  });
  
  const lang = prefixToLangMap.get(categoryPrefix) || "en";
  
  try {
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/categories?t=" + Date.now());
    if (response.ok) {
      const categories = await response.json();
      if (Array.isArray(categories)) {
        const catObj = findCategoryBySlug(categories, slug);
        const slugPathArr = getCategorySlugPath(categories, slug);
        
        if (catObj && slugPathArr) {
          const nestedPath = slugPathArr.join("/");
          const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/${nestedPath}/`;
          
          // Build Hreflang Alternate Mappings
          const alternatesLanguages = Object.fromEntries(
            activeLangs
              .filter((l) => l.code !== "__proto__" && l.code !== "constructor")
              .map((l) => [l.code, `https://mertervitrini.com.tr/${l.categoryPrefix}/${nestedPath}/`])
          );

          // Dynamic SEO translation fallbacks
          let title = catObj.title;
          if (catObj.translations && catObj.translations[lang]?.title) {
            title = catObj.translations[lang].title;
          }
          
          let titleSuffix = "Toptan B2B";
          let descTemplate = `Toptan ${title} serili ve asortili sipariş imkanları. En kaliteli Merter toptan giyim ürünleri.`;
          
          if (lang === "en") {
            titleSuffix = "Wholesale B2B";
            descTemplate = `Wholesale ${title} series and assorted order options. High quality Merter wholesale apparel.`;
          } else if (lang === "pl") {
            titleSuffix = "Hurt B2B";
            descTemplate = `Zamówienia hurtowe ${title} w seriach i pakietach. Najwyższej jakości odzież hurtowa z Merter.`;
          } else if (lang === "de") {
            titleSuffix = "Großhandel B2B";
            descTemplate = `Großhandel ${title} in Serien und Sortimenten. Hochwertige Großhandelskleidung aus Merter.`;
          } else if (lang === "ru") {
            titleSuffix = "Оптом B2B";
            descTemplate = `Оптовые заказы ${title} сериями и пакетами. Высококачественная оптовая одежда из Мертер.`;
          } else if (lang === "fr") {
            titleSuffix = "Vente en Gros B2B";
            descTemplate = `Vente en gros ${title} en séries et assortiments. Vêtements en gros de Merter de haute qualité.`;
          }

          // Localized Custom SEO Overrides based on B2B Keyword Sourcing Strategy
          const cleanSlug = String(slug).toLowerCase();
          let isCustomSEO = false;
          
          if (cleanSlug === "yaz-koleksiyonu" || cleanSlug.includes("boho") || cleanSlug.includes("bohem")) {
            isCustomSEO = true;
            const bohoTitles: Record<string, string> = {
              tr: "Toptan Bohem Giyim Tarzı - Butik Elbiseler Türkiye",
              en: "Wholesale Boho Chic Fashion Style - Boutique Outfits Turkey",
              ru: "Оптом Богемный Стиль Одежды (Бохо-Шик) - Бутик Турция",
              de: "Großhandel Boho Chic Modestil - Boutique Kleidung Türkei",
              pl: "Hurt Boho Chic Moda Styl - Butikowe Ubrania Turcja",
              bg: "Бохо Шик Стил Дрехи на Едро - Бутикови Облекла Турция",
              ar: "ملابس بوهو شيك بالجملة - أزياء بوتيك تركيا",
              fr: "Mode Bohème en Gros - Vêtements Chic de Boutique Turquie"
            };
            const bohoDescs: Record<string, string> = {
              tr: "En trend toptan bohem giyim ve boho chic butik ürünleri. Türkiye'nin lider üreticilerinden doğrudan toptan sipariş.",
              en: "Discover the best wholesale boho chic fashion styles and boutique outfits directly from Turkey manufacturers.",
              ru: "Покупайте оптом стильную богемную одежду и бохо-шик платья напрямую от производителей в Турции.",
              de: "Kaufen Sie Boho-Chic-Kleidung im Großhandel direkt bei den besten Herstellern in der Türkei.",
              pl: "Hurtownia mody boho chic i odzieży butikowej bezpośrednio od producentów z Turcji.",
              bg: "Купете бохо шик дрехи на едро директно от най-добрите производители в Турция.",
              ar: "اكتشف أفضل ملابس بوهو شيك بالجملة وأزياء البوتيك الفاخرة مباشرة من المصانع التركية.",
              fr: "Découvrez la mode bohème chic en gros et les vêtements de boutique en direct des fabricants turcs."
            };
            title = bohoTitles[lang] || bohoTitles.en;
            descTemplate = bohoDescs[lang] || bohoDescs.en;
          } else if (cleanSlug === "vintage-retro" || cleanSlug.includes("vintage") || cleanSlug.includes("retro")) {
            isCustomSEO = true;
            const vintageTitles: Record<string, string> = {
              tr: "Toptan Vintage ve Retro Giyim Türkiye - Merter Tekstil",
              en: "Wholesale Vintage Clothing Turkey - Retro Boutique Sourcing",
              ru: "Винтажная Одежда Оптом Турция - Ретро Стиль Мертер",
              de: "Wholesale Vintage Kleidung Türkei - Retro Stil Großhandel",
              pl: "Hurtownia Odzieży Vintage Turcja - Retro Styl Stambuł",
              bg: "Ретро и Винтидж Дрехи на Едро Турция - Мертер Текстил",
              ar: "ملابس عتيقة (فينتاج) ورترو بالجملة تركيا - مارتر اسطنبول",
              fr: "Vêtements Vintage en Gros Turquie - Vêtements Rétro Boutique Merter"
            };
            const vintageDescs: Record<string, string> = {
              tr: "Türkiye'nin en seçkin retro ve vintage giyim ürünleri serili ve asortili toptan alım imkanlarıyla.",
              en: "Premium wholesale vintage & retro apparel from Turkey's top boutique suppliers and factories.",
              ru: "Высококачественная винтажная и ретро одежда оптом от лучших фабрик Турции.",
              de: "Hochwertige Vintage- und Retro-Bekleidung im Großhandel von den besten türkischen Lieferanten.",
              pl: "Najwyższej jakości odzież retro i vintage w hurcie bezpośrednio od tureckich dostawców.",
              bg: "Висококачествени ретро и винтидж дрехи на едро от най-добрите доставчици в Турция.",
              ar: "أفضل ملابس عتيقة ورترو بالجملة مباشرة من المصانع والموردين في تركيا.",
              fr: "Vêtements vintage et rétro de qualité supérieure en gros provenant des meilleurs fabricants turcs."
            };
            title = vintageTitles[lang] || vintageTitles.en;
            descTemplate = vintageDescs[lang] || vintageDescs.en;
          } else if (cleanSlug === "abiye" || cleanSlug === "gece-elbesi" || cleanSlug === "elbise-abiye" || cleanSlug.includes("night-dress")) {
            isCustomSEO = true;
            const nightTitles: Record<string, string> = {
              tr: "Toptan Abiye ve Gece Elbisesi Türkiye - İstanbul İmalat",
              en: "Wholesale Night Dress Turkey - Evening Gowns Istanbul",
              ru: "Вечерние Платья Оптом Турция - Выпускные и Вечерние Наряды",
              de: "Großhandel Abendkleider Türkei - Abendmode Istanbul",
              pl: "Hurt Sukienek Wieczorowych Turcja - Suknie Balowe Stambuł",
              bg: "Абитуриентски и Вечерни Рокли на Едро Турция - Истанбул",
              ar: "فساتين سهرة وسواريه بالجملة تركيا - مصانع اسطنبول",
              fr: "Robes de Soirée en Gros Turquie - Robes de Bal Istanbul Importer"
            };
            const nightDescs: Record<string, string> = {
              tr: "İstanbul abiye imalatçılarından doğrudan toptan gece elbisesi, şifon abiyeler ve balo kıyafetleri sipariş edin.",
              en: "Order premium wholesale night dresses and evening gowns directly from Istanbul manufacturers.",
              ru: "Вечерние платья оптом от стамбульских производителей. Прямые поставки без посредников.",
              de: "Bestellen Sie Abendkleider und festliche Mode im Großhandel direkt bei den Herstellern in Istanbul.",
              pl: "Zamawiaj suknie wieczorowe i wizytowe w hurcie bezpośrednio od producentów ze Stambułu.",
              bg: "Поръчайте вечерни и официални рокли на едро директно от производители в Истанбул.",
              ar: "اطلب فساتين السهرة والسواريه بالجملة مباشرة من المصانع والمصممين في اسطنبول.",
              fr: "Commandez des robes de soirée de qualité supérieure en gros directement des fabricants d'Istanbul."
            };
            title = nightTitles[lang] || nightTitles.en;
            descTemplate = nightDescs[lang] || nightDescs.en;
          } else if (cleanSlug === "kumas" || cleanSlug.includes("fabric") || cleanSlug.includes("tekstil")) {
            isCustomSEO = true;
            const fabricTitles: Record<string, string> = {
              tr: "Toptan Türk Kumaşları ve Tekstil Tedariği - İstanbul",
              en: "Turkish Fabric Wholesale - Premium Textile Sourcing",
              ru: "Турецкие Ткани Оптом - Премиальный Текстиль и Сырье",
              de: "Türkische Stoffe Großhandel - Premium Textilbeschaffung",
              pl: "Tureckie Tkaniny Hurt - Zaopatrzenie Tekstylne Stambuł",
              bg: "Турски Плат на Едро - Текстилни Материали Истанбул",
              ar: "أقمشة تركية بالجملة - توريد المنسوجات الفاخرة اسطنبول",
              fr: "Tissus Turcs en Gros - Approvisionnement Textile Premium Istanbul"
            };
            const fabricDescs: Record<string, string> = {
              tr: "En kaliteli Türk kumaşları, örme, dokuma ve iplik çeşitleriyle doğrudan toptan tedarik kanalları.",
              en: "Source high-quality Turkish fabrics, knitted, woven textiles directly from Istanbul premium suppliers.",
              ru: "Оптовые закупки турецких тканей и текстильного сырья напрямую от фабрик-производителей.",
              de: "Direkter Bezug von hochwertigen türkischen Stoffen und Geweben bei führenden Webereien.",
              pl: "Bezpośrednie zaopatrzenie w wysokiej jakości tkaniny tureckie od czołowych producentów.",
              bg: "Директна доставка на висококачествени турски платове от водещи текстилни фабрики.",
              ar: "احصل على أفضل الأقمشة والمنسوجات التركية الفاخرة مباشرة من المصانع والموردين في اسطنبول.",
              fr: "Achetez des tissus turcs de haute qualité, tricotés ou tissés directement des fournisseurs premium d'Istanbul."
            };
            title = fabricTitles[lang] || fabricTitles.en;
            descTemplate = fabricDescs[lang] || fabricDescs.en;
          } else if (cleanSlug === "surdurulebilir" || cleanSlug.includes("organotex") || cleanSlug.includes("organic")) {
            isCustomSEO = true;
            const organicTitles: Record<string, string> = {
              tr: "Sürdürülebilir Tekstil Tedariği: Organotex ve Sertifikalı Kumaşlar",
              en: "Sustainable Textile Sourcing: Organotex & Certified Fabrics",
              ru: "Экологичный Текстиль: Organotex и Сертифицированные Ткани",
              de: "Nachhaltige Textilien: Organotex & Zertifizierte Stoffe",
              pl: "Zrównoważone Tekstylia: Organotex i Certyfikowane Tkaniny",
              bg: "Устойчив Текстил: Organotex и Сертифицирани Тъкани",
              ar: "توريد المنسوجات المستدامة: أورغانوتكس والأقمشة المعتمدة",
              fr: "Approvisionnement Textile Durable : Organotex et Tissus Certifiés"
            };
            const organicDescs: Record<string, string> = {
              tr: "Organotex sertifikalı sürdürülebilir, ekolojik kumaş ve tekstil ürünleri toptan tedarik rehberi.",
              en: "Eco-friendly, certified fabrics and sustainable textile sourcing including Organotex materials in Turkey.",
              ru: "Поставки экологически чистых сертифицированных тканей и материалов Organotex оптом из Турции.",
              de: "Bezug von umweltfreundlichen, zertifizierten Stoffen und nachhaltigen Textilien (Organotex) in der Türkei.",
              pl: "Hurtowe zaopatrzenie w ekologiczne, certyfikowane tkaniny i materiały Organotex z Turcji.",
              bg: "Доставка на екологични сертифицирани платове и устойчиви текстилни материали Organotex на едро.",
              ar: "دليل توريد المنسوجات المستدامة والأقمشة العضوية المعتمدة بما في ذلك أورغانوتكس في تركيا.",
              fr: "Guide d'achat de tissus durables et biologiques certifiés Organotex en gros en Turquie."
            };
            title = organicTitles[lang] || organicTitles.en;
            descTemplate = organicDescs[lang] || organicDescs.en;
          }
          
          const fullTitle = isCustomSEO ? title : `${title} | Merter Vitrini ${titleSuffix}`;
          
          return {
            title: fullTitle,
            description: descTemplate,
            alternates: {
              canonical: canonicalUrl,
              languages: alternatesLanguages,
            },
            openGraph: {
              title: fullTitle,
              description: descTemplate,
              url: canonicalUrl,
              siteName: "Merter Vitrini",
              images: [
                {
                  url: "https://mertervitrini.com.tr/placeholder.png",
                  width: 800,
                  height: 600,
                  alt: title,
                }
              ],
              locale: lang === "tr" ? "tr_TR" : "en_US",
              type: "website",
            }
          };
        }
      }
    }
  } catch (err) {
    console.error("[SEO] Unified generateMetadata failed:", err);
  }

  // Fallback metadata
  return {
    title: "Toptan Kategori | Merter Vitrini Toptan B2B",
    description: "Merter Vitrini toptan giyim kategorisi.",
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { categoryPrefix, slug: slugArr } = await params;
  const slug = Array.isArray(slugArr) && slugArr.length > 0 ? slugArr.slice(-1)[0] : (slugArr as unknown as string);
  
  const activeLangs = await fetchLanguages();
  const prefixToLangMap = new Map<string, string>();
  activeLangs.forEach((l) => {
    if (!prefixToLangMap.has(l.categoryPrefix) || l.code === "tr" || l.code === "en") {
      prefixToLangMap.set(l.categoryPrefix, l.code);
    }
  });
  
  const defaultLang = prefixToLangMap.get(categoryPrefix) || "tr";
  
  let preFetchedCategories = [];
  try {
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/categories?t=" + Date.now());
    if (response.ok) {
      preFetchedCategories = await response.json();
    }
  } catch (err) {
    console.error("Failed to pre-fetch categories:", err);
  }

  return <StorefrontLayout mode="catalog" initialCategorySlug={slug} preFetchedCategories={preFetchedCategories} defaultLang={defaultLang} />;
}
