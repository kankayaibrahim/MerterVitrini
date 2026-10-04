import React from "react";
import { Metadata } from "next";
import StorefrontLayout from "@/components/store/StorefrontLayout";
import { Category } from "@/types/store";

export const revalidate = 300;

interface PageProps {
  readonly params: Promise<{
    readonly categoryPrefix: string;
    readonly slug: string[];
  }>;
}

interface MetadataProps extends PageProps {
  readonly searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
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
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/languages", { next: { revalidate: 3600 } });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((l: Language) => {
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
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/categories", { next: { revalidate: 3600 } });
    const activeLangs = await fetchLanguages();
    if (response.ok) {
      const categories = await response.json();
      const params: { categoryPrefix: string; slug: string[] }[] = [];

      const extractSlugsForPrefix = (nodes: Category[], prefix: string, parentSlugs: string[] = []) => {
        if (!Array.isArray(nodes)) return;
        nodes.forEach((n) => {
          if (n?.slug) {
            const currentTrail = [...parentSlugs, String(n.slug)];
            params.push({ categoryPrefix: prefix, slug: currentTrail });
            if (Array.isArray(n.children) && n.children.length > 0) {
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
function findCategoryBySlug(tree: Category[], slug: string): Category | null {
  if (!Array.isArray(tree) || !slug) return null;
  for (const cat of tree) {
    if (!cat) continue;
    if (cat.slug === slug) return cat;
    if (Array.isArray(cat.children) && cat.children.length > 0) {
      const found = findCategoryBySlug(cat.children, slug);
      if (found) return found;
    }
  }
  return null;
}

// Helper to get the full slug trail list of a category
function getCategorySlugPath(tree: Category[], targetSlug: string, path: string[] = []): string[] | null {
  if (!Array.isArray(tree) || !targetSlug) return null;
  for (const cat of tree) {
    if (!cat?.slug) continue;
    const currentTrail = [...path, cat.slug];
    if (cat.slug === targetSlug) {
      return currentTrail;
    }
    if (Array.isArray(cat.children)) {
      const found = getCategorySlugPath(cat.children, targetSlug, currentTrail);
      if (found) return found;
    }
  }
  return null;
}

function getCustomSeoOverride(cleanSlug: string, lang: string): { title: string; description: string } | null {
  if (cleanSlug === "yaz-koleksiyonu" || cleanSlug.includes("boho") || cleanSlug.includes("bohem")) {
    const bohoTitles: Record<string, string> = {
      tr: "Toptan Bohem Giyim Tarzı - Butik Elbiseler Türkiye",
      en: "Wholesale Boho Chic Fashion Style - Boutique Outfits Turkey",
      ru: "Оптом Богемный Стиль Одежды (Бохо-Шик) - Бутик Турция",
      de: "Großhandel Boho Chic Modestil - Boutique Kleidung Türkei",
      pl: "Hurt Boho Chic Moda Styl - Butikowe Ubrania Turcja",
      bg: "Бохо Шик Стил Дрехи на Едро - Бутикови Облекла Турция",
      ar: "ملابس بوهو شيك بالجملة - أزياء بوتيك تركيا",
      fr: "Mode Bohème en Gros - Vêtements Chic de Boutique Turquie",
    };
    const bohoDescs: Record<string, string> = {
      tr: "En trend toptan bohem giyim ve boho chic butik ürünleri. Türkiye'nin lider üreticilerinden doğrudan toptan sipariş.",
      en: "Discover the best wholesale boho chic fashion styles and boutique outfits directly from Turkey manufacturers.",
      ru: "Покупайте оптом стильную богемную одежду и бохо-шик платья напрямую от производителей в Турции.",
      de: "Kaufen Sie Boho-Chic-Kleidung im Großhandel direkt bei den besten Herstellern in der Türkei.",
      pl: "Hurtownia mody boho chic i odzieży butikowej bezpośrednio od producentów z Turcji.",
      bg: "Купете бохо шик дрехи на едро директно от най-добрите производители в Турция.",
      ar: "اكتشف أفضل ملابس بوهو شيك بالجملة وأزياء البوتيك الفاخرة مباشرة من المصانع التركية.",
      fr: "Découvrez la mode bohème chic en gros et les vêtements de boutique en direct des fabricants turcs.",
    };
    return { title: bohoTitles[lang] || bohoTitles.en, description: bohoDescs[lang] || bohoDescs.en };
  }
  if (cleanSlug === "vintage-retro" || cleanSlug.includes("vintage") || cleanSlug.includes("retro")) {
    const vintageTitles: Record<string, string> = {
      tr: "Toptan Vintage ve Retro Giyim Türkiye - Merter Tekstil",
      en: "Wholesale Vintage Clothing Turkey - Retro Boutique Sourcing",
      ru: "Винтажная Одежда Оптом Турция - Ретро Стиль Мертер",
      de: "Wholesale Vintage Kleidung Türkei - Retro Stil Großhandel",
      pl: "Hurtownia Odzieży Vintage Turcja - Retro Styl Stambuł",
      bg: "Ретро и Винтидж Дрехи на Едро Турция - Мертер Текстил",
      ar: "ملابس عتيقة (فينتاج) ورترو بالجملة تركيا - مارتر اسطنبول",
      fr: "Vêtements Vintage en Gros Turquie - Vêtements Rétro Boutique Merter",
    };
    const vintageDescs: Record<string, string> = {
      tr: "Türkiye'nin en seçkin retro ve vintage giyim ürünleri serili ve asortili toptan alım imkanlarıyla.",
      en: "Premium wholesale vintage & retro apparel from Turkey's top boutique suppliers and factories.",
      ru: "Высококачественная винтажная и ретро одежда оптом от лучших фабрик Турции.",
      de: "Hochwertige Vintage- und Retro-Bekleidung im Großhandel von den besten türkischen Lieferanten.",
      pl: "Najwyższej jakości odzież retro i vintage w hurcie bezpośrednio od tureckich dostawców.",
      bg: "Висококачествени ретро и винтидж дрехи на едро от най-добрите доставчици в Турция.",
      ar: "أفضل ملابس عتيقة ورترو بالجملة مباشرة من المصانع والموردين في تركيا.",
      fr: "Vêtements vintage et rétro de qualité supérieure en gros provenant des meilleurs fabricants turcs.",
    };
    return { title: vintageTitles[lang] || vintageTitles.en, description: vintageDescs[lang] || vintageDescs.en };
  }
  if (cleanSlug === "abiye" || cleanSlug === "gece-elbesi" || cleanSlug === "elbise-abiye" || cleanSlug.includes("night-dress")) {
    const nightTitles: Record<string, string> = {
      tr: "Toptan Abiye ve Gece Elbisesi Türkiye - İstanbul İmalat",
      en: "Wholesale Night Dress Turkey - Evening Gowns Istanbul",
      ru: "Вечерние Платья Оптом Турция - Выпускные и Вечерние Наряды",
      de: "Großhandel Abendkleider Türkei - Abendmode Istanbul",
      pl: "Hurt Sukienek Wieczorowych Turcja - Suknie Balowe Stambuł",
      bg: "Абитуриентски и Вечерни Рокли на Едро Турция - Истанбул",
      ar: "فساتين سهرة وسواريه بالجملة تركيا - مصانع اسطنبول",
      fr: "Robes de Soirée en Gros Turquie - Robes de Bal Istanbul Importer",
    };
    const nightDescs: Record<string, string> = {
      tr: "İstanbul abiye imalatçılarından doğrudan toptan gece elbisesi, şifon abiyeler ve balo kıyafetleri sipariş edin.",
      en: "Order premium wholesale night dresses and evening gowns directly from Istanbul manufacturers.",
      ru: "Вечерние платья оптом от стамбульских производителей. Прямые поставки без посредников.",
      de: "Bestellen Sie Abendkleider und festliche Mode im Großhandel direkt bei den Herstellern in Istanbul.",
      pl: "Zamawiaj suknie wieczorowe i wizytowe w hurcie bezpośrednio od producentów ze Stambułu.",
      bg: "Поръчайте вечерни и официални рокли на едро директно от производители в Истанбул.",
      ar: "اطلب فساتين السهرة والسواريه بالجملة مباشرة من المصانع والمصممين في اسطنبول.",
      fr: "Commandez des robes de soirée de qualité supérieure en gros directement des fabricants d'Istanbul.",
    };
    return { title: nightTitles[lang] || nightTitles.en, description: nightDescs[lang] || nightDescs.en };
  }
  if (cleanSlug === "kumas" || cleanSlug.includes("fabric") || cleanSlug.includes("tekstil")) {
    const fabricTitles: Record<string, string> = {
      tr: "Toptan Türk Kumaşları ve Tekstil Tedariği - İstanbul",
      en: "Turkish Fabric Wholesale - Premium Textile Sourcing",
      ru: "Турецкие Ткани Оптом - Премиальный Текстиль и Сырье",
      de: "Türkische Stoffe Großhandel - Premium Textilbeschaffung",
      pl: "Tureckie Tkaniny Hurt - Zaopatrzenie Tekstylne Stambuł",
      bg: "Турски Плат на Едро - Текстилни Материали Истанбул",
      ar: "أقمشة تركية بالجملة - توريد المنسوجات الفاخرة اسطنبول",
      fr: "Tissus Turcs en Gros - Approvisionnement Textile Premium Istanbul",
    };
    const fabricDescs: Record<string, string> = {
      tr: "En kaliteli Türk kumaşları, örme, dokuma ve iplik çeşitleriyle doğrudan toptan tedarik kanalları.",
      en: "Source high-quality Turkish fabrics, knitted, woven textiles directly from Istanbul premium suppliers.",
      ru: "Оптовые закупки турецких тканей и текстильного сырья напрямую от фабрик-производителей.",
      de: "Direkter Bezug von hochwertigen türkischen Stoffen und Geweben bei führenden Webereien.",
      pl: "Bezpośrednie zaopatrzenie w wysokiej jakości tkaniny tureckie od czołowych producentów.",
      bg: "Директна доставка на висококачествени турски платове от водещи текстилни фабрики.",
      ar: "احصل على أفضل الأقمشة والمنسوجات التركية الفاخرة مباشرة من المصانع والموردين في اسطنبول.",
      fr: "Achetez des tissus turcs de haute qualité, tricotés ou tissés directement des fournisseurs premium d'Istanbul.",
    };
    return { title: fabricTitles[lang] || fabricTitles.en, description: fabricDescs[lang] || fabricDescs.en };
  }
  if (cleanSlug === "surdurulebilir" || cleanSlug.includes("organotex") || cleanSlug.includes("organic")) {
    const organicTitles: Record<string, string> = {
      tr: "Sürdürülebilir Tekstil Tedariği: Organotex ve Sertifikalı Kumaşlar",
      en: "Sustainable Textile Sourcing: Organotex & Certified Fabrics",
      ru: "Экологичный Текстиль: Organotex и Сертифицированные Ткани",
      de: "Nachhaltige Textilien: Organotex & Zertifizierte Stoffe",
      pl: "Zrównoważone Tekstylia: Organotex i Certyfikowane Tkaniny",
      bg: "Устойчив Текстил: Organotex и Сертифицирани Тъкани",
      ar: "توريد المنسوجات المستدامة: أورغانوتكس والأقمشة المعتمدة",
      fr: "Approvisionnement Textile Durable : Organotex et Tissus Certifiés",
    };
    const organicDescs: Record<string, string> = {
      tr: "Organotex sertifikalı sürdürülebilir, ekolojik kumaş ve tekstil ürünleri toptan tedarik rehberi.",
      en: "Eco-friendly, certified fabrics and sustainable textile sourcing including Organotex materials in Turkey.",
      ru: "Поставки экологически чистых сертифицированных тканей и материалов Organotex оптом из Турции.",
      de: "Bezug von umweltfreundlichen, zertifizierten Stoffen und nachhaltigen Textilien (Organotex) in der Türkei.",
      pl: "Hurtowe zaopatrzenie w ekologiczne, certyfikowane tkaniny i materiały Organotex z Turcji.",
      bg: "Доставка на екологични сертифицирани платове и устойчиви текстилни материали Organotex на едро.",
      ar: "دليل توريد المنسوجات المستدامة والأقمشة العضوية المعتمدة بما في ذلك أورغانوتكس في تركيا.",
      fr: "Guide d'achat de tissus durables et biologiques certifiés Organotex en gros en Turquie.",
    };
    return { title: organicTitles[lang] || organicTitles.en, description: organicDescs[lang] || organicDescs.en };
  }
  return null;
}

function getCategorySuffixAndDesc(title: string, lang: string): { titleSuffix: string; descTemplate: string } {
  switch (lang) {
    case "en":
      return {
        titleSuffix: "Wholesale B2B",
        descTemplate: `Wholesale ${title} series and assorted order options. High quality Merter wholesale apparel.`,
      };
    case "pl":
      return {
        titleSuffix: "Hurt B2B",
        descTemplate: `Zamówienia hurtowe ${title} w seriach i pakietach. Najwyższej jakości odzież hurtowa z Merter.`,
      };
    case "de":
      return {
        titleSuffix: "Großhandel B2B",
        descTemplate: `Großhandel ${title} in Serien und Sortimenten. Hochwertige Großhandelskleidung aus Merter.`,
      };
    case "ru":
      return {
        titleSuffix: "Оптом B2B",
        descTemplate: `Оптовые заказы ${title} сериями и пакетами. Высококачественная оптовая одежда из Мертер.`,
      };
    case "fr":
      return {
        titleSuffix: "Vente en Gros B2B",
        descTemplate: `Vente en gros ${title} en séries et assortiments. Vêtements en gros de Merter de haute qualité.`,
      };
    default:
      return {
        titleSuffix: "Toptan B2B",
        descTemplate: `Toptan ${title} serili ve asortili sipariş imkanları. En kaliteli Merter toptan giyim ürünleri.`,
      };
  }
}

function getCategoryB2BFAQ(catTitle: string, lang: string): { q: string; a: string }[] {
  const faqData: Record<string, { q: string; a: string }[]> = {
    tr: [
      {
        q: `${catTitle} toptan siparişlerinde minimum alım miktarı (MOQ) nedir?`,
        a: `${catTitle} modellerimiz toptan seri ve paketler halinde satılmaktadır. Genellikle 1 paket/seri (4-6 adet asortili beden) ile sipariş oluşturabilirsiniz.`,
      },
      {
        q: "Merter toptan tekstil siparişleri kaç günde kargoya teslim edilir?",
        a: "Siparişleriniz Merter ve üretici depolarımızdan 1-3 iş günü içinde hazırlanarak anlaşmalı uluslararası kargo veya lojistik firmanıza teslim edilir.",
      },
      {
        q: "Yurtdışı ihracat ve gümrükleme işlemleri nasıl yürütülüyor?",
        a: "Tüm toptan hazır giyim siparişlerinizde ATR, EUR.1, Menşe Şahadetnamesi ve ihracat beyannamesi işlemleri kurumsal ihracat departmanımız tarafından düzenlenmektedir.",
      },
    ],
    en: [
      {
        q: `What is the Minimum Order Quantity (MOQ) for wholesale ${catTitle}?`,
        a: `Our wholesale ${catTitle} collections are sold in size packs/series. Minimum order starts from just 1 pack (typically 4-6 pieces with full size ratio).`,
      },
      {
        q: "How fast is shipping from Istanbul Merter to international destinations?",
        a: "Orders are prepared within 1-3 business days and dispatched via air express (DHL, UPS, FedEx) or freight cargo arriving in 3-7 days worldwide.",
      },
      {
        q: "Can I order multiple brands and categories in a single combined shipment?",
        a: "Yes! Merter Vitrini consolidates all your items from multiple Turkish textile manufacturers into one consolidated parcel to minimize international freight costs.",
      },
    ],
    ru: [
      {
        q: `Каков минимальный объем заказа (MOQ) на ${catTitle} оптом?`,
        a: `Все модели ${catTitle} поставляются фабричными сериями/пакетами (обычно 4-6 единиц одного цвета во всех размерах). Минимальный заказ — от 1 серии.`,
      },
      {
        q: "Сколько времени занимает доставка из Стамбула в Россию и СНГ?",
        a: "Отправка осуществляется карго-компаниями или авиапочтой. Сроки доставки карго в Москву и регионы составляют от 4 до 9 дней.",
      },
    ],
    ar: [
      {
        q: `ما هو الحد الأدنى للطلب (MOQ) لمنتجات ${catTitle} بالجملة؟`,
        a: `تباع منتجاتنا بالجملة بنظام السيري / الباكت المقاسات المتنوعة. الحد الأدنى للطلب يبدأ من باكت واحد فقط (4-6 قطع).`,
      },
      {
        q: "كم تستغرق مدة شحن الطلبات من إسطنبول إلى الدول العربية؟",
        a: "يتم تجهيز الشحنات خلال 1-3 أيام عمل وشحنها عبر الشحن الجوي السريع أو شركات الكارجو لتصل خلال 3-6 أيام إلى دول الخليج والشرق الأوسط.",
      },
    ],
    de: [
      {
        q: `Was ist die Mindestbestellmenge (MOQ) für ${catTitle} im Großhandel?`,
        a: `Unsere ${catTitle}-Kollektionen werden in Serienpacks (Größenassortiert, üblicherweise 4-6 Stück) verkauft. Mindestbestellmenge ist 1 Pack.`,
      },
      {
        q: "Wie läuft der Versand aus der Türkei nach Deutschland und Europa?",
        a: "Lieferungen nach Deutschland und EU-Länder dauern per Express-Kurier oder Spedition ca. 3-5 Werktage mit vollständigen Zollpapieren.",
      },
    ],
    fr: [
      {
        q: `Quelle est la quantité minimale de commande (MOQ) pour ${catTitle} en gros ?`,
        a: `Nos collections de ${catTitle} sont vendues en séries/packs assortis de tailles (4-6 pièces par pack). Minimum de commande : 1 pack.`,
      },
      {
        q: "Quels sont les délais d'expédition d'Istanbul vers la France et l'Europe ?",
        a: "Les commandes sont expédiées en 1 à 3 jours ouvrables et livrées en France en 3 à 5 jours via transporteur express ou cargo.",
      },
    ],
    pl: [
      {
        q: `Jakie jest minimalne zamówienie (MOQ) na ${catTitle} w hurcie?`,
        a: `Produkty ${catTitle} sprzedawane są w pakietach rozmiarowych (zazwyczaj 4-6 sztuk). Minimalne zamówienie to zaledwie 1 seria.`,
      },
      {
        q: "Jak długo trwa wysyłka ze Stambułu do Polski?",
        a: "Czas dostawy kurierem ekspresowym lub transportem drobnicowym wynosi zazwyczaj 3-5 dni roboczych.",
      },
    ],
    bg: [
      {
        q: `Какво е минималното количество за поръчка (MOQ) за ${catTitle} на едро?`,
        a: `Продуктите се продават в размерни серии/пакети (обикновено 4-6 броя). Минималната поръчка започва от 1 серия.`,
      },
      {
        q: "Какви са сроковете за доставка от Истанбул до България?",
        a: "Доставката до България отнема само 1-3 работни дни с директен сухопътен или карго транспорт.",
      },
    ],
  };

  return faqData[lang] || faqData.en;
}

export function getCategoryB2BDefaultDesc(categoryTitle: string, lang: string): string {
  const descMap: Record<string, string> = {
    tr: `Merter Vitrini toptan ${categoryTitle} kategorisi, İstanbul Merter ve Güngören tekstil imalatçılarının en güncel butik ve mağaza koleksiyonlarını bir araya getirmektedir. Ürünlerimiz toptan seri ve paketler halinde satılmakta olup, paket içi asortili beden dağılımı sayesinde butiğinizin tüm beden taleplerini karşılar. Doğrudan üretici fiyatlarıyla minimum sipariş (MOQ) avantajından yararlanabilir, siparişlerinizi tek bir konsolide kargo ile dünya geneline güvenle ulaştırabilirsiniz.`,
    en: `The Merter Vitrini wholesale ${categoryTitle} catalog brings together the latest boutique collections from Istanbul Merter and Gungoren textile manufacturers. All products are supplied in wholesale packs and size runs with full ratio distribution, ensuring balanced inventory for your fashion retail business. Benefit from direct factory pricing, low MOQ, and worldwide express delivery with combined international shipments.`,
    ru: `Каталог ${categoryTitle} оптом на платформе Merter Vitrini объединяет новейшие коллекции ведущих фабрик Стамбула (Мертер, Гюнгёрен). Все товары поставляются фабричными сериями и размерными пакетами с пропорциональной разбивкой размеров. Покупайте напрямую от турецких производителей по оптовым ценам с минимальным объемом заказа (от 1 серии) и быстрой доставкой карго по всей России и СНГ.`,
    ar: `يوفر قسم ${categoryTitle} بالجملة على منصة مارتر فيتريني أحدث تشكيلات أزياء البوتيك والمتاجر من مصانع النسيج في إسطنبول (مارتر وجونغوران). تباع جميع المنتجات بنظام السيري والباكت المقاسات المتنوعة. استفد من أسعار المصنع المباشرة والحد الأدنى المرن للطلب مع شحن دولي موحد وسريع إلى كافة الدول العربية.`,
    de: `Die Großhandelskategorie ${categoryTitle} von Merter Vitrini vereint die neuesten Boutique- und Einzelhandelskollektionen führender Textilhersteller aus Istanbul Merter. Unsere Produkte werden in Großhandelserien und Größenpacks mit ausgewogener Größenverteilung angeboten. Profitieren Sie von direkten Herstellerpreisen, niedrigen Mindestbestellmengen (ab 1 Pack) und sicherem weltweiten Expressversand.`,
    fr: `Le catalogue de gros ${categoryTitle} de Merter Vitrini rassemble les dernières collections de prêt-à-porter des fabricants textiles d'Istanbul (Merter, Güngören). Tous les articles sont vendus en séries et packs assortis de tailles. Profitez des prix direct fabricant, d'un MOQ réduit et d'une expédition express consolidée vers la France et le monde entier.`,
    pl: `Kategoria hurtowa ${categoryTitle} na Merter Vitrini łączy najnowsze kolekcje odzieży butikowej od renomowanych producentów ze Stambułu (Merter). Wszystkie produkty sprzedawane są w seriach rozmiarowych z pełną asortymentacją. Skorzystaj z bezpośrednich cen fabrycznych, niskiego MOQ i szybkiej konsolidowanej wysyłki międzynarodowej do Polski.`,
    bg: `Категорията ${categoryTitle} на едро в Merter Vitrini събира най-актуалните бутикови колекции от текстилни производители в Истанбул (Мертер). Продуктите се предлагат в размерни серии с пълно разпределение на размерите. Възползвайте се от директни фабрични цени, минимални количества за поръчка (от 1 серия) и бърза доставка до България.`,
  };
  return descMap[lang] || descMap.en;
}

const FILTER_KEYS = new Set([
  "color", "size", "brand", "brand_id", "gender", "season",
  "min_price", "max_price", "sort_by", "q", "page"
]);

async function checkHasFilterParams(searchParamsPromise?: Promise<{ [key: string]: string | string[] | undefined }>): Promise<boolean> {
  if (!searchParamsPromise) return false;
  const search = await searchParamsPromise;
  if (!search) return false;
  return Object.keys(search).some((k) => FILTER_KEYS.has(k));
}

function resolveLangForPrefix(prefix: string, activeLangs: Language[]): string {
  const matched = activeLangs.find((l) => l.categoryPrefix === prefix);
  return matched?.code || "en";
}

function buildAlternatesLanguages(nestedPath: string, activeLangs: Language[]): Record<string, string> {
  const alternatesLanguages: Record<string, string> = {
    "x-default": `https://mertervitrini.com.tr/en/${nestedPath}`,
  };
  activeLangs.forEach((l) => {
    alternatesLanguages[l.code] = `https://mertervitrini.com.tr/${l.categoryPrefix}/${nestedPath}`;
  });
  return alternatesLanguages;
}

function createCategoryMetadata({
  fullTitle,
  finalDesc,
  canonicalUrl,
  alternatesLanguages,
  hasFilterParams,
  categoryTitle,
  lang,
}: {
  fullTitle: string;
  finalDesc: string;
  canonicalUrl: string;
  alternatesLanguages: Record<string, string>;
  hasFilterParams: boolean;
  categoryTitle: string;
  lang: string;
}): Metadata {
  return {
    title: fullTitle,
    description: finalDesc,
    robots: hasFilterParams
      ? { index: false, follow: true }
      : { index: true, follow: true },
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title: fullTitle,
      description: finalDesc,
      url: canonicalUrl,
      siteName: "Merter Vitrini",
      images: [
        {
          url: "https://mertervitrini.com.tr/placeholder.png",
          width: 800,
          height: 600,
          alt: categoryTitle,
        }
      ],
      locale: lang === "tr" ? "tr_TR" : "en_US",
      type: "website",
    }
  };
}

// Generate dynamic SEO metadata on the server side using prefix and category slug
export async function generateMetadata({ params, searchParams }: MetadataProps): Promise<Metadata> {
  const { categoryPrefix, slug: slugArr } = await params;
  const slug = (Array.isArray(slugArr) && slugArr.length > 0 ? slugArr.at(-1) : slugArr) as string;
  
  const hasFilterParams = await checkHasFilterParams(searchParams);
  const activeLangs = await fetchLanguages();
  const lang = resolveLangForPrefix(categoryPrefix, activeLangs);
  
  try {
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/categories", { next: { revalidate: 300 } });
    if (response.ok) {
      const categories = await response.json();
      const catObj = findCategoryBySlug(categories, slug);
      const slugPathArr = getCategorySlugPath(categories, slug);
      
      if (catObj && slugPathArr) {
        const nestedPath = slugPathArr.join("/");
        const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/${nestedPath}`;
        const alternatesLanguages = buildAlternatesLanguages(nestedPath, activeLangs);

        const categoryTitle = catObj.translations?.[lang]?.title || catObj.title;
        const { titleSuffix, descTemplate: defaultDesc } = getCategorySuffixAndDesc(categoryTitle, lang);
        const customSeo = getCustomSeoOverride(String(slug).toLowerCase(), lang);

        const fullTitle = customSeo ? customSeo.title : `${categoryTitle} | Merter Vitrini ${titleSuffix}`;
        const finalDesc = customSeo ? customSeo.description : defaultDesc;

        return createCategoryMetadata({
          fullTitle,
          finalDesc,
          canonicalUrl,
          alternatesLanguages,
          hasFilterParams,
          categoryTitle,
          lang,
        });
      }
    }
  } catch (err) {
    console.error("[SEO] Unified generateMetadata failed:", err);
  }

  // Dynamic fallback metadata based on requested slug
  const cleanTitle = String(slug).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `Toptan ${cleanTitle} Modelleri ve İmalatçı Fiyatları | Merter Vitrini B2B`,
    description: `Toptan ${cleanTitle} serili ve asortili butik sipariş imkanları. Doğrudan Merter tekstil üreticilerinden en uygun toptan hazır giyim fiyatları. Minimum paket alımı.`,
    robots: hasFilterParams
      ? { index: false, follow: true }
      : { index: true, follow: true },
    alternates: {
      canonical: `https://mertervitrini.com.tr/${categoryPrefix}/${slug}`,
      languages: {
        "x-default": `https://mertervitrini.com.tr/en/${slug}`,
        tr: `https://mertervitrini.com.tr/tr/${slug}`,
        en: `https://mertervitrini.com.tr/en/${slug}`,
        ru: `https://mertervitrini.com.tr/ru/${slug}`,
        ar: `https://mertervitrini.com.tr/ar/${slug}`,
        de: `https://mertervitrini.com.tr/de/${slug}`,
        pl: `https://mertervitrini.com.tr/pl/${slug}`,
        fr: `https://mertervitrini.com.tr/fr/${slug}`,
        bg: `https://mertervitrini.com.tr/bg/${slug}`,
      },
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { categoryPrefix, slug: slugArr } = await params;
  const slug = (Array.isArray(slugArr) && slugArr.length > 0 ? slugArr.at(-1) : slugArr) as string;
  
  const activeLangs = await fetchLanguages();
  const prefixToLangMap = new Map<string, string>();
  activeLangs.forEach((l) => {
    if (!prefixToLangMap.has(l.categoryPrefix) || l.code === "tr" || l.code === "en") {
      prefixToLangMap.set(l.categoryPrefix, l.code);
    }
  });
  
  const defaultLang = prefixToLangMap.get(categoryPrefix) || "tr";
  
  const cleanCategoryTitle = String(slug).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  let preFetchedCategories: Category[] = [];
  try {
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/categories", { next: { revalidate: 300 } });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        preFetchedCategories = data;
      }
    }
  } catch (err) {
    console.error("Failed to pre-fetch categories:", err);
  }

  // Schema.org JSON-LD BreadcrumbList
  const slugPathArr = getCategorySlugPath(preFetchedCategories, slug) || [slug];
  const catObj = findCategoryBySlug(preFetchedCategories, slug);
  const breadcrumbElements = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Ana Sayfa",
      "item": `https://mertervitrini.com.tr/${categoryPrefix}`,
    },
  ];

  let cumulativePath = "";
  slugPathArr.forEach((s, idx) => {
    cumulativePath += `/${s}`;
    const matchedNode = findCategoryBySlug(preFetchedCategories, s);
    const nodeTitle = matchedNode ? (matchedNode.translations?.[defaultLang]?.title || matchedNode.title) : s;
    breadcrumbElements.push({
      "@type": "ListItem",
      "position": idx + 2,
      "name": nodeTitle,
      "item": `https://mertervitrini.com.tr/${categoryPrefix}${cumulativePath}`,
    });
  });

  const categoryTitle = catObj ? (catObj.translations?.[defaultLang]?.title || catObj.title) : cleanCategoryTitle;
  const faqs = getCategoryB2BFAQ(categoryTitle, defaultLang);

  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "name": categoryTitle,
        "url": `https://mertervitrini.com.tr/${categoryPrefix}/${slugPathArr.join("/")}`,
        "description": `Toptan ${categoryTitle} modelleri ve serili sipariş imkanları. Merter B2B toptan hazır giyim tedarik platformu.`,
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": breadcrumbElements,
        },
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbElements,
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqs.map((f) => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.a,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
      />
      <StorefrontLayout mode="catalog" initialCategorySlug={slug} preFetchedCategories={preFetchedCategories} defaultLang={defaultLang} />
    </>
  );
}
