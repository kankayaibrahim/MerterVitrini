import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import StorefrontLayout from "@/components/store/StorefrontLayout";
import { Category, Product } from "@/types/store";
import {
  SITE_ORIGIN,
  SupportedSeoLang,
  OG_LOCALE_BY_LANG,
  GLOBAL_B2B_SEO_MATRIX,
  isSupportedSeoLang,
  normalizeSeoLang,
  safeJsonLd,
  stripBrandTitleSuffix,
  buildPrefixedAlternates,
  ssrStoreFetch,
  fetchSsrCategories,
  fetchSsrProducts,
} from "@/utils/seoHelpers";
import { fixApostropheCase } from "@/utils/formatters";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{
    readonly categoryPrefix: string;
    readonly slug: string[];
  }>;
  readonly searchParams?: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}

type MetadataProps = PageProps;

export interface Language {
  code: string;
  label: string;
  flag: string;
  categoryPrefix: string;
  dir?: string;
  isActive: boolean;
  sortOrder: number;
}

const FALLBACK_LANGUAGES: Language[] = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷", categoryPrefix: "tr", isActive: true, sortOrder: 0 },
  { code: "en", label: "English", flag: "🇬🇧", categoryPrefix: "en", isActive: true, sortOrder: 1 },
  { code: "pl", label: "Polski", flag: "🇵🇱", categoryPrefix: "pl", isActive: true, sortOrder: 2 },
  { code: "bg", label: "Български", flag: "🇧🇬", categoryPrefix: "bg", isActive: true, sortOrder: 3 },
  { code: "ar", label: "العربية", flag: "🇸🇦", categoryPrefix: "ar", dir: "rtl", isActive: true, sortOrder: 4 },
  { code: "ru", label: "Русский", flag: "🇷🇺", categoryPrefix: "ru", isActive: true, sortOrder: 5 },
  { code: "de", label: "Deutsch", flag: "🇩🇪", categoryPrefix: "de", isActive: true, sortOrder: 6 },
  { code: "fr", label: "Français", flag: "🇫🇷", categoryPrefix: "fr", isActive: true, sortOrder: 7 },
];

async function fetchLanguages(): Promise<Language[]> {
  const data = await ssrStoreFetch<Language[]>("/languages", 3600);
  if (Array.isArray(data) && data.length > 0) {
    return data.map((langItem) => ({
      ...langItem,
      code: normalizeSeoLang(langItem.code, "en"),
    }));
  }
  return FALLBACK_LANGUAGES;
}

const SLUG_ALIASES: Record<string, string> = {
  kadin: "kadin-giyim",
  "kadin-triko": "triko-hirka-kazak",
  "kadin-elbise": "elbise-abiye",
  triko: "triko-hirka-kazak",
  elbise: "elbise-abiye",
  kazak: "triko-hirka-kazak",
  erkek: "erkek-giyim",
  kumas: "kadin-giyim",
};

export function resolveSlugAlias(slug: string): string {
  if (!slug) return "";
  const lower = slug.toLowerCase();
  return SLUG_ALIASES[lower] || lower;
}

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

function getCategorySlugPath(
  tree: Category[],
  targetSlug: string,
  path: string[] = []
): string[] | null {
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

interface CustomCategorySeoRule {
  readonly matches: (slug: string) => boolean;
  readonly titles: Record<SupportedSeoLang, string>;
  readonly descriptions: Record<SupportedSeoLang, string>;
}

const CUSTOM_CATEGORY_SEO_RULES: readonly CustomCategorySeoRule[] = [
  {
    matches: (s) => s === "kadin-giyim" || s === "kadin",
    titles: {
      tr: "Merter Toptan Kadın Giyim | İmalatçıdan Yeni Sezon Ürünler",
      en: "Merter Wholesale Women's Clothing | Factory Direct New Season",
      ru: "Женская Одежда Оптом из Мертера | Напрямую от Фабрик Стамбула",
      ar: "ملابس نسائية بالجملة من مصانع مارتر إسطنبول | Merter Vitrini",
      de: "Merter Großhandel Damenmode | Direkt vom Hersteller Istanbul",
      fr: "Vêtements Femme en Gros Merter | En Direct des Fabricants",
      pl: "Hurtownia Odzieży Damskiej Merter | Bezpośrednio od Producenta",
      bg: "Дамски Дрехи на Едро от Мертер | Директно от Производител",
    },
    descriptions: {
      tr: "Doğrudan Merter tekstil imalatçılarından en yeni sezon toptan kadın giyim ürünleri. Aracısız fabrika fiyatları, butikler için serili paketler ve hızlı teslimat.",
      en: "Buy new season wholesale women's apparel directly from Merter Istanbul manufacturers. No middlemen, factory prices, size-run boutique packs, and express global shipping.",
      ru: "Женская одежда оптом напрямую от фабрик и производителей Мертер (Стамбул). Новые коллекции размерными рядами без посредников, фабричные цены и быстрая доставка карго.",
      ar: "تسوق ملابس نسائية بالجملة مباشرة من مصانع مارتر في إسطنبول بدون وسطاء. أحدث موديلات الموسم بأسعار المصنع المباشرة بنظام الباكيدج مع شحن جوي سريع.",
      de: "Damenmode im Großhandel direkt von Herstellern aus Merter Istanbul kaufen. Ohne Zwischenhändler, Fabrikpreise, Serienpakete für Boutiquen und schneller EU-Versand.",
      fr: "Achetez la nouvelle collection de vêtements femme en gros directement auprès des fabricants de Merter Istanbul. Prix d'usine, lots par séries et livraison rapide.",
      pl: "Hurt damskiej odzieży nowej kolekcji bezpośrednio od producentów z Merter Stambuł. Ceny fabryczne bez pośredników, pakiety rozmiarowe dla butików i szybka dostawa.",
      bg: "Дамска мода нова колекция на едро директно от производители в Мертер, Истанбул. Фабрични цени без посредници, размерни серии за бутици и бърз транспорт.",
    },
  },
  {
    matches: (s) => s === "yaz-koleksiyonu" || s.includes("boho") || s.includes("bohem"),
    titles: {
      tr: "Toptan Bohem Giyim Tarzı — Butik Elbiseler Türkiye",
      en: "Wholesale Boho Chic Fashion Style — Boutique Outfits Turkey",
      ru: "Оптом Богемный Стиль Одежды (Бохо-Шик) — Бутик Турция",
      ar: "ملابس بوهو شيك بالجملة — أزياء بوتيك تركيا",
      de: "Großhandel Boho Chic Modestil — Boutique Kleidung Türkei",
      fr: "Mode Bohème en Gros — Vêtements Chic de Boutique Turquie",
      pl: "Hurt Boho Chic Moda Styl — Butikowe Ubrania Turcja",
      bg: "Бохо Шик Стил Дрехи на Едро — Бутикови Облекла Турция",
    },
    descriptions: {
      tr: "En trend toptan bohem giyim ve boho chic butik ürünleri. Türkiye'nin lider üreticilerinden doğrudan serili toptan sipariş.",
      en: "Discover wholesale boho chic fashion styles and boutique size-run outfits directly from Merter Istanbul manufacturers.",
      ru: "Покупайте оптом стильную богемную одежду и бохо-шик платья размерными рядами напрямую от производителей в Турции.",
      ar: "اكتشف أفضل ملابس بوهو شيك بالجملة وأزياء البوتيك الفاخرة مباشرة من المصانع التركية بنظام الباكيدج.",
      de: "Kaufen Sie Boho-Chic-Kleidung im Großhandel in Serienpaketen direkt bei den besten Herstellern in der Türkei.",
      fr: "Découvrez la mode bohème chic en gros et les vêtements de boutique en direct des fabricants turcs.",
      pl: "Hurtownia mody boho chic i odzieży butikowej w paczkach bezpośrednio od producentów z Turcji.",
      bg: "Купете бохо шик дрехи на едро на серии директно от най-добрите производители в Турция.",
    },
  },
  {
    matches: (s) => s === "vintage-retro" || s.includes("vintage") || s.includes("retro"),
    titles: {
      tr: "Toptan Vintage ve Retro Giyim Türkiye — Merter Tekstil",
      en: "Wholesale Vintage Clothing Turkey — Retro Boutique Sourcing",
      ru: "Винтажная Одежда Оптом Турция — Ретро Стиль Мертер",
      ar: "ملابس فينتاج ورترو بالجملة تركيا — مارتر إسطنبول",
      de: "Großhandel Vintage Kleidung Türkei — Retro Stil Merter",
      fr: "Vêtements Vintage en Gros Turquie — Boutique Rétro Merter",
      pl: "Hurtownia Odzieży Vintage Turcja — Retro Styl Stambuł",
      bg: "Ретро и Винтидж Дрехи на Едро Турция — Мертер Текстил",
    },
    descriptions: {
      tr: "Türkiye'nin en seçkin retro ve vintage giyim ürünleri serili ve asortili toptan alım imkanlarıyla Merter Vitrini'nde.",
      en: "Premium wholesale vintage and retro apparel packs from Turkey's top boutique suppliers and Merter factories.",
      ru: "Высококачественная винтажная и ретро одежда оптом сериями от лучших фабрик Турции.",
      ar: "أفضل ملابس عتيقة ورترو بالجملة مباشرة من المصانع والموردين في مارتر إسطنبول.",
      de: "Hochwertige Vintage- und Retro-Bekleidung im Großhandel von führenden türkischen Herstellern.",
      fr: "Vêtements vintage et rétro de qualité supérieure en gros provenant des meilleurs fabricants turcs.",
      pl: "Najwyższej jakości odzież retro i vintage w hurcie bezpośrednio od tureckich producentów.",
      bg: "Висококачествени ретро и винтидж дрехи на едро от най-добрите производители в Турция.",
    },
  },
  {
    matches: (s) => s === "elbise-abiye" || s === "elbise",
    titles: {
      tr: "Toptan Kadın Elbise Modelleri & Fiyatları | Merter Vitrini",
      en: "Wholesale Women's Dresses from Turkey | Factory Direct Packs",
      ru: "Женские Платья Оптом из Турции | Каталог Фабрик Стамбул",
      ar: "فساتين نسائية بالجملة من تركيا | تصاميم راقية وأسعار المصنع",
      de: "Großhandel Damenkleider Türkei | Trendige Kleider B2B Istanbul",
      fr: "Robes Femme en Gros Turquie | Fournisseur Prêt-à-Porter Merter",
      pl: "Hurtownia Sukienek Damskich Turcja | Sukienki z Merter Stambuł",
      bg: "Дамски Рокли на Едро от Турция | Модели и Фабрични Цени",
    },
    descriptions: {
      tr: "En şık toptan kadın elbise modelleri Merter Vitrini'nde. Günlük, şifon, mini, midi ve maxi boy elbiseler doğrudan üretici fiyatlarıyla serili toptan satışta.",
      en: "Discover wholesale women's dresses direct from Istanbul Merter manufacturers. Casual, floral, midi and maxi dress packs with low MOQ and worldwide cargo.",
      ru: "Купить женские платья оптом размерными рядами напрямую от турецких фабрик Мертера. Повседневные, шифоновые и вечерние платья по ценам производителя.",
      ar: "أجمل تشكيلة فساتين نسائية بالجملة مباشرة من مصانع مارتر تركيا بنظام الباكيدج. فساتين يومية وماكسي وميدي للبوتيكات مع شحن جوي سريع.",
      de: "Damenkleider im Großhandel in Serienpaketen direkt aus Istanbul Merter bestellen. Alltags-, Midi- und Maxikleider zu Werkspreisen mit schnellem EU-Versand.",
      fr: "Achetez des robes femme tendance en gros par séries auprès des fabricants textiles de Merter Istanbul avec expédition rapide en Europe.",
      pl: "Modne sukienki damskie w hurcie w paczkach prosto od tureckich producentów z Merter Stambuł.",
      bg: "Богат избор на дамски рокли на едро на серии от производители в Мертер Истанбул с бърза доставка до България.",
    },
  },
  {
    matches: (s) => s === "abiye" || s === "gece-elbesi" || s.includes("night-dress"),
    titles: {
      tr: "Toptan Abiye & Gece Elbisesi Modelleri | Merter İmalatçı",
      en: "Wholesale Evening Dresses & Gowns | Istanbul Fashion Direct",
      ru: "Вечерние Платья Оптом из Турции | Праздничная Мода Мертер",
      ar: "فساتين سهرة وأعراس بالجملة تركيا | تصاميم فخمة وأسعار المصنع",
      de: "Großhandel Abendkleider Türkei | Elegante Festmode Istanbul",
      fr: "Robes de Soirée en Gros Turquie | Robes de Fête Istanbul B2B",
      pl: "Hurt Sukienek Wieczorowych Turcja | Suknie Balowe Stambuł",
      bg: "Официални и Вечерни Рокли на Едро | Бални Тоалети Турция",
    },
    descriptions: {
      tr: "Özel günler ve davetler için toptan abiye ve gece elbiseleri. Saten, şifon ve işlemeli abiyeler İstanbul üreticilerinden doğrudan serili toptan satışta.",
      en: "Premium wholesale evening dresses, prom gowns, and cocktail outfits from Istanbul Merter manufacturers at factory prices.",
      ru: "Элегантные вечерние платья оптом сериями от ведущих стамбульских фабрик. Атласные и шифоновые наряды по фабричным ценам.",
      ar: "أرقى موديلات فساتين السهرة والأعراس بالجملة من مصانع إسطنبول مباشرة بأسعار المصنع وشحن دولي سريع.",
      de: "Exklusive Abendkleider und Cocktailkleider im Großhandel aus Istanbul zu Fabrikpreisen für Boutiquen.",
      fr: "Collection de robes de soirée chic et robes de cocktail en gros en direct des fabricants turcs d'Istanbul.",
      pl: "Eleganckie suknie wieczorowe i balowe w hurcie bezpośrednio ze Stambułu w cenach fabrycznych.",
      bg: "Елегантни вечерни и бални рокли на едро от производители в Истанбул с директна доставка.",
    },
  },
  {
    matches: (s) =>
      s === "triko-hirka-kazak" || s === "triko" || s === "kazak-suveter" || s === "hirka",
    titles: {
      tr: "Toptan Kadın Triko Modelleri | Merter İmalatçı Kazak & Hırka",
      en: "Wholesale Women's Knitwear from Turkey | Sweaters & Cardigans",
      ru: "Женский Трикотаж Оптом из Турции | Свитера и Кардиганы Мертер",
      ar: "تريكو نسائي بالجملة من تركيا | كنزات وكارديجان مصانع مارتر",
      de: "Großhandel Damenstrickwaren Türkei | Pullover & Strickjacken",
      fr: "Tricots Femme en Gros Turquie | Pulls et Gilets Merter B2B",
      pl: "Hurtownia Dzianin Damskich Turcja | Swetry i Kardigany Merter",
      bg: "Дамски Трикотаж и Плетиво на Едро | Пуловери и Жилетки Турция",
    },
    descriptions: {
      tr: "Merter triko imalatçılarından kaliteli kadın kazak, hırka ve triko takımlar. Yeni sezon örgü modelleri serili fabrika fiyatlarıyla.",
      en: "High-quality wholesale women's knitwear, pullovers, and cardigans from Merter Istanbul manufacturers in low-MOQ packs.",
      ru: "Качественный турецкий женский трикотаж оптом напрямую с фабрик Мертера: вязаные свитера, джемперы и кардиганы.",
      ar: "أفخم تشكيلات التريكو النسائي والكنزات الشتوية بالجملة من مصانع مارتر إسطنبول بأسعار المصنع.",
      de: "Erstklassige Damen-Strickwaren, Pullover und Cardigans im Großhandel direkt ab Werk aus Istanbul Merter.",
      fr: "Maille et tricots femme de qualité supérieure en gros directement des fabricants turcs de Merter.",
      pl: "Wysokogatunkowa dzianina damska, modne swetry i kardigany w hurcie w paczkach ze Stambułu.",
      bg: "Качествено дамско плетиво, жилетки и пуловери на едро на серии директно от Мертер, Истанбул.",
    },
  },
  {
    matches: (s) => s === "buyuk-beden" || s.startsWith("buyuk-beden"),
    titles: {
      tr: "Toptan Büyük Beden Kadın Giyim Modelleri & Fiyatları | Merter",
      en: "Wholesale Plus Size Women's Apparel Turkey | Curvy Fashion B2B",
      ru: "Женская Одежда Больших Размеров Оптом | Батал из Турции",
      ar: "ملابس نسائية مقاسات كبيرة بالجملة تركيا | بلس سايز مارتر",
      de: "Großhandel Plus Size Damenmode Türkei | Große Größen B2B Merter",
      fr: "Vêtements Grande Taille Femme en Gros | Mode Curvy Istanbul B2B",
      pl: "Hurtownia Odzieży Plus Size Turcja | Duże Rozmiary Damskie Merter",
      bg: "Дамски Дрехи Големи Размери на Едро | Плюс Сайз и Макси Мода",
    },
    descriptions: {
      tr: "Türkiye'nin lider üreticilerinden toptan büyük beden kadın kıyafetleri. 44-58 beden aralığında şık modeller serili imalatçı fiyatlarıyla.",
      en: "Source wholesale plus-size women's clothing from Istanbul Merter. EU sizes 44-58 size-run packs with worldwide cargo.",
      ru: "Стильная женская одежда больших размеров (батал, plus size) оптом размерными рядами от производителей Стамбула.",
      ar: "أفضل تشكيلة ملابس نسائية مقاسات كبيرة (بلس سايز) بالجملة من مصانع مارتر إسطنبول بأسعار الجملة.",
      de: "Modische Übergrößen-Damenbekleidung (Größen 44-58) im Großhandel direkt aus Istanbul Merter.",
      fr: "Collection prêt-à-porter grande taille femme (du 44 au 58) en gros à prix direct fabricant.",
      pl: "Modna odzież damska w dużych rozmiarach (Plus Size 44-58) w hurcie w seriach ze Stambułu.",
      bg: "Дамска макси мода и големи размери (44-58) на едро директно от турски производители.",
    },
  },
  {
    matches: (s) => s === "dis-giyim" || s === "kaban-palto" || s === "trenckot",
    titles: {
      tr: "Toptan Kadın Dış Giyim Modelleri | Kaban, Mont & Trençkot",
      en: "Wholesale Women's Outerwear Turkey | Coats, Jackets & Trench",
      ru: "Женская Верхняя Одежда Оптом из Турции | Пальто, Куртки, Тренчи",
      ar: "ملابس خارجية نسائية بالجملة تركيا | معاطف وجاكيتات وترنشكوت",
      de: "Großhandel Damen-Oberbekleidung Türkei | Mäntel, Jacken & Trench",
      fr: "Vêtements d'Extérieur Femme en Gros | Manteaux et Vestes Merter",
      pl: "Hurtownia Odzieży Wierzchniej Damskiej | Płaszcze i Kurtki Merter",
      bg: "Дамски Връхни Дрехи на Едро | Палта, Якета и Тренчкоти Турция",
    },
    descriptions: {
      tr: "En yeni sezon toptan kadın dış giyim ürünleri Merter Vitrini'nde. Kaşe kaban, şişme mont, trençkot ve ceketler doğrudan üreticiden serili satışta.",
      en: "Source wholesale women's outerwear from Istanbul Merter manufacturers: woolen coats, puffer jackets, trenches, and blazers.",
      ru: "Широкий выбор женской верхней одежды оптом из Стамбула (Мертер): пальто, тренчи, пуховики и куртки от производителей.",
      ar: "أحدث تشكيلات الملابس الخارجية النسائية بالجملة من مصانع مارتر إسطنبول بأفضل أسعار المصنع.",
      de: "Hochwertige Damen-Oberbekleidung im Großhandel aus Merter Istanbul: Wollmäntel, Pufferjacken und Trenchcoats zu Werkspreisen.",
      fr: "Grossiste en manteaux, vestes matelassées, doudounes et trench-coats pour femmes fabriqués à Istanbul.",
      pl: "Ciepłe płaszcze, kurtki puchowe i trencze damskie w hurcie w paczkach bezpośrednio z Turcji.",
      bg: "Богат асортимент от дамски връхни дрехи на едро от Мертер, Истанбул на фабрични цени.",
    },
  },
  {
    matches: (s) => s === "ikili-takim" || s === "takim-tulum",
    titles: {
      tr: "Toptan Kadın İkili Takım Modelleri | Şık & Günlük Kombinler",
      en: "Wholesale Women's Two-Piece Co-ord Sets | Merter Factory Direct",
      ru: "Женские Костюмы-Двойки Оптом из Турции | Стильные Комплекты",
      ar: "أطقم نسائية قطعتين بالجملة تركيا | ملابس كاجوال ورسمية مارتر",
      de: "Großhandel Zweiteiler Damen-Sets | Trendige Co-Ord Ensembles",
      fr: "Ensembles Coordonnés Femme 2 Pièces en Gros | Mode Istanbul",
      pl: "Komplety Dwuczęściowe Damskie Hurt | Modne Zestawy ze Stambułu",
      bg: "Дамски Комплекти от Две Части на Едро | Ежедневни и Елегантни",
    },
    descriptions: {
      tr: "En popüler kadın ikili takım modelleri toptan satışta. Gömlek-pantolon, bluz-etek ve spor-şık takımlar Merter Vitrini imalatçı fiyatlarıyla.",
      en: "Wholesale women's two-piece matching sets and co-ord outfits sold in size-run packs directly from Merter Istanbul factories.",
      ru: "Широкий выбор женских костюмов-двоек оптом размерными рядами по фабричным ценам из Стамбула.",
      ar: "تشكيلة أطقم نسائية قطعتين بالجملة بنظام الباكيدج من مصانع مارتر إسطنبول.",
      de: "Moderne zweiteilige Damen-Sets im Großhandel in Serienpaketen direkt aus Merter Istanbul.",
      fr: "Grossiste d'ensembles coordonnés 2 pièces pour femmes en direct des ateliers de Merter Istanbul.",
      pl: "Modne komplety dwuczęściowe damskie w hurcie w seriach bezpośrednio z Turcji.",
      bg: "Дамски сетове от две части на едро на серии от Мертер, Истанбул на фабрични цени.",
    },
  },
];

function getCustomSeoOverride(
  cleanSlug: string,
  lang: SupportedSeoLang
): { title: string; description: string } | null {
  const matched = CUSTOM_CATEGORY_SEO_RULES.find((rule) => rule.matches(cleanSlug));
  if (!matched) return null;
  return {
    title: matched.titles[lang],
    description: matched.descriptions[lang],
  };
}

function getCategorySuffixAndDesc(
  title: string,
  lang: SupportedSeoLang
): { titleSuffix: string; descTemplate: string } {
  const templates: Record<SupportedSeoLang, { titleSuffix: string; descTemplate: string }> = {
    tr: {
      titleSuffix: "Toptan B2B",
      descTemplate: `Toptan ${title} serili ve asortili sipariş imkanları. Doğrudan Merter İstanbul üretici fabrikalarından B2B toptan giyim tedariği.`,
    },
    en: {
      titleSuffix: "Wholesale B2B",
      descTemplate: `Wholesale ${title} size-run packs and direct factory orders from verified Merter Istanbul clothing manufacturers.`,
    },
    ru: {
      titleSuffix: "Оптом B2B",
      descTemplate: `${title} оптом размерными рядами (сериями) напрямую от фабрик Мертера (Стамбул) без посредников с карго доставкой.`,
    },
    ar: {
      titleSuffix: "بالجملة B2B",
      descTemplate: `${title} بالجملة بنظام السيري والباكيدج مباشرة من مصانع مارتر إسطنبول بدون وسطاء مع شحن دولي سريع.`,
    },
    de: {
      titleSuffix: "Großhandel B2B",
      descTemplate: `${title} im Großhandel in sortierten Serienpaketen direkt ab Werk von Herstellern aus Merter Istanbul.`,
    },
    fr: {
      titleSuffix: "Vente en Gros B2B",
      descTemplate: `Vente en gros ${title} par séries assorties directement auprès des fabricants textiles de Merter Istanbul.`,
    },
    pl: {
      titleSuffix: "Hurt B2B",
      descTemplate: `${title} hurt w pełnych seriach rozmiarowych (paczkach) bezpośrednio od producentów z Merter Stambuł.`,
    },
    bg: {
      titleSuffix: "На Едро B2B",
      descTemplate: `${title} на едро на размерни серии директно от турски фабрики в Мертер Истанбул без посредници.`,
    },
  };
  return templates[lang];
}

function trimSeoMetaDescription(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length <= 165) return cleaned;
  return `${cleaned.slice(0, 162).trimEnd()}...`;
}

function getCategoryB2BFAQ(
  catTitle: string,
  lang: SupportedSeoLang
): { q: string; a: string }[] {
  const faqData: Record<SupportedSeoLang, { q: string; a: string }[]> = {
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
        a: "Yes! Merter Vitrini consolidates all your items from multiple Turkish textile manufacturers into one combined parcel to minimize international freight costs.",
      },
    ],
    ru: [
      {
        q: `Каков минимальный объем заказа (MOQ) на ${catTitle} оптом?`,
        a: `Все модели ${catTitle} поставляются фабричными сериями/пакетами (обычно 4-6 единиц одного цвета во всех размерах). Минимальный заказ — от 1 серии.`,
      },
      {
        q: "Сколько времени занимает доставка из Стамбула в Россию и СНГ?",
        a: "Отправка осуществляется проверенными карго-компаниями или авиапочтой. Сроки доставки карго составляют от 4 до 9 дней.",
      },
    ],
    ar: [
      {
        q: `ما هو الحد الأدنى للطلب (MOQ) لمنتجات ${catTitle} بالجملة؟`,
        a: `تباع منتجات ${catTitle} بالجملة بنظام السيري والباكيدج المقاسات المتنوعة، ويبدأ الحد الأدنى للطلب من باكت واحد فقط (4-6 قطع).`,
      },
      {
        q: "كم تستغرق مدة شحن الطلبات من إسطنبول إلى الدول العربية؟",
        a: "يتم تجهيز الشحنات خلال 1-3 أيام عمل وشحنها عبر الشحن الجوي السريع أو شركات الكارجو لتصل خلال 3-6 أيام إلى الخليج والشرق الأوسط.",
      },
    ],
    de: [
      {
        q: `Was ist die Mindestbestellmenge (MOQ) für ${catTitle} im Großhandel?`,
        a: `Unsere ${catTitle}-Kollektionen werden in Serienpacks (größenassortiert, üblicherweise 4-6 Stück) verkauft. Mindestbestellmenge ist 1 Pack.`,
      },
      {
        q: "Wie läuft der Versand aus der Türkei nach Deutschland und Europa?",
        a: "Lieferungen nach Deutschland und EU-Länder dauern per Express-Kurier oder Spedition ca. 3-5 Werktage inklusive ATR-Zolldokumenten.",
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
        a: `Продуктите ${catTitle} се продават в размерни серии/пакети (обикновено 4-6 броя). Минималната поръчка започва от 1 серия.`,
      },
      {
        q: "Какви са сроковете за доставка от Истанбул до България?",
        a: "Доставката до България отнема само 1-3 работни дни с директен сухопътен или карго транспорт.",
      },
    ],
  };

  return faqData[lang];
}

export function getCategoryB2BDefaultDesc(categoryTitle: string, lang: string): string {
  const safeLang = normalizeSeoLang(lang, "en");
  const descMap: Record<SupportedSeoLang, string> = {
    tr: `Merter Vitrini toptan ${categoryTitle} kategorisi, İstanbul Merter ve Güngören tekstil imalatçılarının en güncel butik ve mağaza koleksiyonlarını bir araya getirmektedir. Ürünlerimiz toptan seri ve paketler halinde satılmakta olup, paket içi asortili beden dağılımı sayesinde butiğinizin tüm beden taleplerini karşılar. Doğrudan üretici fiyatlarıyla minimum sipariş (MOQ) avantajından yararlanabilir, siparişlerinizi tek bir konsolide kargo ile dünya geneline güvenle ulaştırabilirsiniz.`,
    en: `The Merter Vitrini wholesale ${categoryTitle} catalog brings together the latest boutique collections from Istanbul Merter and Gungoren textile manufacturers. All products are supplied in wholesale packs and size runs with full ratio distribution, ensuring balanced inventory for your fashion retail business. Benefit from direct factory pricing, low MOQ, and worldwide express delivery with combined international shipments.`,
    ru: `Каталог ${categoryTitle} оптом на платформе Merter Vitrini объединяет новейшие коллекции ведущих фабрик Стамбула (Мертер, Гюнгёрен). Все товары поставляются фабричными сериями и размерными пакетами с пропорциональной разбивкой размеров. Покупайте напрямую от турецких производителей по оптовым ценам с минимальным объемом заказа (от 1 серии) и быстрой доставкой карго по всей России и СНГ.`,
    ar: `يوفر قسم ${categoryTitle} بالجملة على منصة مارتر فيتريني أحدث تشكيلات أزياء البوتيك والمتاجر من مصانع النسيج في إسطنبول (مارتر وجونغوران). تباع جميع المنتجات بنظام السيري والباكت المقاسات المتنوعة. استفد من أسعار المصنع المباشرة والحد الأدنى المرن للطلب مع شحن دولي موحد وسريع إلى كافة الدول العربية.`,
    de: `Die Großhandelskategorie ${categoryTitle} von Merter Vitrini vereint die neuesten Boutique- und Einzelhandelskollektionen führender Textilhersteller aus Istanbul Merter. Unsere Produkte werden in Großhandelserien und Größenpacks mit ausgewogener Größenverteilung angeboten. Profitieren Sie von direkten Herstellerpreisen, niedrigen Mindestbestellmengen (ab 1 Pack) und sicherem weltweiten Expressversand.`,
    fr: `Le catalogue de gros ${categoryTitle} de Merter Vitrini rassemble les dernières collections de prêt-à-porter des fabricants textiles d'Istanbul (Merter, Güngören). Tous les articles sont vendus en séries et packs assortis de tailles. Profitez des prix direct fabricant, d'un MOQ réduit et d'une expédition express consolidée vers la France et le monde entier.`,
    pl: `Kategoria hurtowa ${categoryTitle} na Merter Vitrini łączy najnowsze kolekcje odzieży butikowej od renomowanych producentów ze Stambułu (Merter). Wszystkie produkty sprzedawane są w seriach rozmiarowych z pełną asortymentacją. Skorzystaj z bezpośrednich cen fabrycznych, niskiego MOQ i szybkiej konsolidowanej wysyłki międzynarodowej do Polski.`,
    bg: `Категорията ${categoryTitle} на едро в Merter Vitrini събира най-актуалните бутикови колекции от текстилни производители в Истанбул (Мертер). Продуктите се предлагат в размерни серии с пълно разпределение на размерите. Възползвайте се от директни фабрични цени, минимални количества за поръчка (от 1 серия) и бърза доставка до България.`,
  };
  return descMap[safeLang];
}

const FILTER_KEYS = new Set([
  "color",
  "size",
  "brand",
  "brand_id",
  "gender",
  "season",
  "min_price",
  "max_price",
  "sort_by",
  "q",
]);

async function checkHasFilterParams(
  searchParamsPromise?: Promise<{ [key: string]: string | string[] | undefined }>
): Promise<boolean> {
  if (!searchParamsPromise) return false;
  const search = await searchParamsPromise;
  if (!search) return false;
  return Object.keys(search).some((k) => FILTER_KEYS.has(k));
}

function resolveLangForPrefix(prefix: string, activeLangs: Language[]): SupportedSeoLang {
  const matched = activeLangs.find((l) => l.categoryPrefix === prefix);
  return normalizeSeoLang(matched?.code || prefix, "tr");
}

function resolveRawSlug(slugArr: string[] | string): string {
  if (Array.isArray(slugArr) && slugArr.length > 0) {
    return slugArr.at(-1) || "";
  }
  return typeof slugArr === "string" ? slugArr : "";
}

function humanizeSlug(slug: string): string {
  const spaced = slug
    .replace(/-/g, " ")
    .replace(/(^|\s)(\p{L})/gu, (_m, prefix: string, ch: string) => `${prefix}${ch.toUpperCase()}`);
  return fixApostropheCase(spaced);
}

function buildCategoryItemListElements(products: Product[], lang: SupportedSeoLang) {
  return products.slice(0, 12).map((prod, idx) => {
    const prodSlug = prod.slug || prod.id;
    const prodUrl =
      lang === "tr"
        ? `${SITE_ORIGIN}/product/${prodSlug}`
        : `${SITE_ORIGIN}/product/${prodSlug}?lang=${lang}`;
    const prodTitle = prod.translations?.[lang]?.title || prod.title;
    return {
      "@type": "ListItem",
      position: idx + 1,
      name: prodTitle,
      url: prodUrl,
    };
  });
}

export async function generateMetadata({
  params,
  searchParams,
}: MetadataProps): Promise<Metadata> {
  const { categoryPrefix, slug: slugArr } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }

  const slug = resolveSlugAlias(resolveRawSlug(slugArr));
  const [hasFilterParams, activeLangs, categories] = await Promise.all([
    checkHasFilterParams(searchParams),
    fetchLanguages(),
    fetchSsrCategories(),
  ]);

  const catObj = findCategoryBySlug(categories, slug);
  if (!catObj) {
    notFound();
  }

  const lang = resolveLangForPrefix(categoryPrefix, activeLangs);
  const slugPathArr = getCategorySlugPath(categories, slug);
  const nestedPath = slugPathArr ? slugPathArr.join("/") : slug;
  const alternates = buildPrefixedAlternates(nestedPath, lang);

  const fallbackTitle = humanizeSlug(slug);
  const categoryTitle = fixApostropheCase(
    catObj ? catObj.translations?.[lang]?.title || catObj.title : fallbackTitle
  );

  const { titleSuffix, descTemplate } = getCategorySuffixAndDesc(categoryTitle, lang);
  const customSeo = getCustomSeoOverride(slug.toLowerCase(), lang);
  const dbSeoDesc = trimSeoMetaDescription(catObj?.translations?.[lang]?.seo_description);

  const fullTitle = customSeo
    ? customSeo.title
    : `${categoryTitle} — ${titleSuffix}`;
  const cleanTitle = stripBrandTitleSuffix(fullTitle);
  const finalDesc = dbSeoDesc || customSeo?.description || descTemplate;

  return {
    title: cleanTitle,
    description: finalDesc,
    keywords: `${categoryTitle}, ${GLOBAL_B2B_SEO_MATRIX[lang].keywords}`,
    robots: hasFilterParams
      ? { index: false, follow: true }
      : { index: true, follow: true },
    alternates,
    openGraph: {
      title: fullTitle,
      description: finalDesc,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      images: [
        {
          url: `${SITE_ORIGIN}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: categoryTitle,
        },
      ],
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: finalDesc,
      images: [`${SITE_ORIGIN}/og-image.jpg`],
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { categoryPrefix, slug: slugArr } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }

  const slug = resolveSlugAlias(resolveRawSlug(slugArr));

  const [activeLangs, preFetchedCategories] = await Promise.all([
    fetchLanguages(),
    fetchSsrCategories(),
  ]);

  const catObj = findCategoryBySlug(preFetchedCategories, slug);
  if (!catObj) {
    notFound();
  }

  const resolvedSearch = searchParams ? await searchParams : undefined;
  const pageRaw = Array.isArray(resolvedSearch?.page)
    ? resolvedSearch.page[0]
    : resolvedSearch?.page;
  const pageNum = Math.max(1, parseInt(pageRaw || "1", 10));
  const offset = (pageNum - 1) * 24;

  const defaultLang = resolveLangForPrefix(categoryPrefix, activeLangs);
  const slugPathArr = getCategorySlugPath(preFetchedCategories, slug) || [slug];

  const initialProductsPayload = await fetchSsrProducts(
    `?limit=24&offset=${offset}&sort_by=newest&category_id=${encodeURIComponent(catObj.id)}`
  );

  const breadcrumbElements = [
    {
      "@type": "ListItem",
      position: 1,
      name: GLOBAL_B2B_SEO_MATRIX[defaultLang].homeLabel,
      item: `${SITE_ORIGIN}/${defaultLang}`,
    },
  ];

  let cumulativePath = "";
  slugPathArr.forEach((segment, idx) => {
    cumulativePath += `/${segment}`;
    const matchedNode = findCategoryBySlug(preFetchedCategories, segment);
    const nodeTitle = matchedNode
      ? matchedNode.translations?.[defaultLang]?.title || matchedNode.title
      : humanizeSlug(segment);
    breadcrumbElements.push({
      "@type": "ListItem",
      position: idx + 2,
      name: nodeTitle,
      item: `${SITE_ORIGIN}/${defaultLang}${cumulativePath}`,
    });
  });

  const categoryTitle = catObj
    ? catObj.translations?.[defaultLang]?.title || catObj.title
    : humanizeSlug(slug);
  const faqs = getCategoryB2BFAQ(categoryTitle, defaultLang);
  const { descTemplate } = getCategorySuffixAndDesc(categoryTitle, defaultLang);
  const dbSeoDesc = trimSeoMetaDescription(
    catObj?.translations?.[defaultLang]?.seo_description
  );
  const itemListElements = buildCategoryItemListElements(
    initialProductsPayload.products,
    defaultLang
  );

  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: categoryTitle,
        url: `${SITE_ORIGIN}/${defaultLang}/${slugPathArr.join("/")}`,
        inLanguage: defaultLang,
        description: dbSeoDesc || descTemplate,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbElements,
        },
        ...(itemListElements.length > 0
          ? {
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: initialProductsPayload.total || itemListElements.length,
                itemListElement: itemListElements,
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbElements,
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: f.a,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(categoryJsonLd) }}
      />
      <StorefrontLayout
        mode="catalog"
        initialCategorySlug={slug}
        preFetchedCategories={preFetchedCategories}
        defaultLang={defaultLang}
        initialProducts={initialProductsPayload.products}
        initialTotalProducts={initialProductsPayload.total}
        categoryFaqs={faqs}
      />
    </>
  );
}
