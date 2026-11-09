import {
  LayoutDashboard,
  Building2,
  Package,
  FolderTree,
  SlidersHorizontal,
  ImageIcon,
  BookOpen,
  SearchCheck,
  Users,
  ShoppingBag,
  Clock,
  Store,
  Webhook,
  Globe2,
  Languages,
  ShieldAlert,
  FileCode2,
  BarChart3,
  FileText,
  Sparkles,
  LucideIcon
} from "lucide-react";

export interface NavigationItem {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: "amber" | "emerald" | "violet" | "blue" | "zinc";
  description?: string;
}

export interface NavigationGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  defaultExpanded?: boolean;
  items: NavigationItem[];
}

export const ADMIN_NAVIGATION: NavigationGroup[] = [
  {
    id: "overview",
    title: "Özet & Raporlar",
    icon: LayoutDashboard,
    defaultExpanded: true,
    items: [
      {
        id: "dashboard",
        title: "Genel Bakış (KPI)",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
        description: "Entegrasyon durumu, ürün metrikleri ve sistem akışı"
      },
      {
        id: "analytics",
        title: "Ziyaretçi & Trafik Analitiği",
        href: "/admin/analytics",
        icon: BarChart3,
        badge: "Canlı",
        badgeColor: "emerald",
        description: "Günlük tekil ziyaretçiler, yönlendiren URL'ler ve 7x24 ısı haritası"
      }
    ]
  },
  {
    id: "catalog",
    title: "Katalog & Tedarik",
    icon: Package,
    defaultExpanded: true,
    items: [
      {
        id: "suppliers",
        title: "Tedarikçiler & XML",
        href: "/admin/suppliers",
        icon: Building2,
        badge: "Portal",
        badgeColor: "violet",
        description: "Toptancı firmalar, XML feed eşlemeleri ve portal hesapları"
      },
      {
        id: "supplier-applications",
        title: "Tedarikçi Başvuruları",
        href: "/admin/supplier-applications",
        icon: FileText,
        badge: "Yeni",
        badgeColor: "amber",
        description: "Vitrinden gelen yeni toptancı ve üretici adayları"
      },
      {
        id: "products",
        title: "Ürün Yönetimi",
        href: "/admin/catalog/products",
        icon: Package,
        description: "Tüm toptan ürünler, fiyatlandırma ve stok listesi"
      },
      {
        id: "categories",
        title: "Kategori Ağacı",
        href: "/admin/catalog/categories",
        icon: FolderTree,
        description: "Hiyerarşik kategori ağacı ve ltree yapılandırması"
      },
      {
        id: "variants",
        title: "Varyant & Bedenler",
        href: "/admin/catalog/variants",
        icon: SlidersHorizontal,
        description: "Beden serileri, renk eşlemeleri ve stok matrisi"
      },
      {
        id: "media",
        title: "Görsel & Medya",
        href: "/admin/catalog/media",
        icon: ImageIcon,
        description: "WebP görsel önbelleği ve sunucu disk optimizasyonu"
      },
      {
        id: "blog",
        title: "B2B Blog & İçerik",
        href: "/admin/catalog/blog",
        icon: BookOpen,
        description: "Çok dilli toptan tekstil rehberleri ve SEO makaleleri"
      },
      {
        id: "indexnow",
        title: "IndexNow (Arama Motoru)",
        href: "/admin/catalog/indexnow",
        icon: SearchCheck,
        badge: "SEO",
        badgeColor: "emerald",
        description: "Bing, Yandex ve Naver anlık URL indeksleme"
      }
    ]
  },
  {
    id: "operations",
    title: "Operasyon & Müşteri",
    icon: ShoppingBag,
    defaultExpanded: true,
    items: [
      {
        id: "orders",
        title: "B2B Siparişleri",
        href: "/admin/orders",
        icon: ShoppingBag,
        badge: "Canlı",
        badgeColor: "amber",
        description: "Toptan sipariş akışı, sevkiyat ve fatura takibi"
      },
      {
        id: "customers",
        title: "Müşteriler & Bayiler",
        href: "/admin/customers",
        icon: Users,
        description: "Kurumsal B2B müşteri hesapları ve onay talepleri"
      },
      {
        id: "rfq",
        title: "Alıcı Talep Panosu (RFQ)",
        href: "/admin/rfq",
        icon: FileText,
        badge: "B2B",
        badgeColor: "emerald",
        description: "Alıcıların oluşturduğu toptan alım ve üretim ilanları"
      },
      {
        id: "marketing",
        title: "Sponsorlu Vitrin & E-Bülten",
        href: "/admin/marketing",
        icon: Sparkles,
        badge: "Gelir",
        badgeColor: "amber",
        description: "Öne çıkan üreticiler, kategori sponsorlukları ve izinli e-bülten"
      },
      {
        id: "service-providers",
        title: "Sektörel Hizmet Sağlayıcılar",
        href: "/admin/service-providers",
        icon: Building2,
        badge: "Rehber",
        badgeColor: "blue",
        description: "Kargo/Lojistik, Fotoğraf Stüdyosu, Etiket, Modelhane ve İhracat rehberi"
      }
    ]
  },
  {
    id: "settings",
    title: "Sistem & Ayarlar",
    icon: Store,
    defaultExpanded: false,
    items: [
      {
        id: "site-settings",
        title: "Mağaza & İletişim",
        href: "/admin/settings/site",
        icon: Store,
        description: "Showroom adresi, telefon, WhatsApp ve tek fiyat ayarları"
      },
      {
        id: "integrations",
        title: "Dış Entegrasyonlar",
        href: "/admin/settings/integrations",
        icon: Webhook,
        description: "API anahtarları, Keycloak IAM ve webhook tanımları"
      },
      {
        id: "geography",
        title: "Coğrafi Tanımlar",
        href: "/admin/settings/geo",
        icon: Globe2,
        description: "Ülkeler, şehirler, para birimleri ve kargo bölgeleri"
      },
      {
        id: "translations",
        title: "Yapay Zeka Çeviri",
        href: "/admin/settings/translations",
        icon: Languages,
        description: "LibreTranslate çok dilli katalog ve içerik çevirileri"
      },
      {
        id: "cron",
        title: "Zamanlanmış Görevler",
        href: "/admin/cron",
        icon: Clock,
        description: "XML otomatik senkronizasyon ve arka plan cron worker'ları"
      },
      {
        id: "policies",
        title: "Hukuki & Sözleşmeler",
        href: "/admin/settings/policies",
        icon: ShieldAlert,
        description: "Gizlilik politikası, KVKK, iade ve mesafeli satış sözleşmeleri"
      },
      {
        id: "cms",
        title: "Dinamik CMS Sayfaları",
        href: "/admin/settings/cms",
        icon: FileCode2,
        description: "Hakkımızda, B2B rehberi ve özel içerik sayfaları"
      }
    ]
  }
];

export function findActiveNavigationItem(pathname: string): NavigationItem | null {
  for (const group of ADMIN_NAVIGATION) {
    for (const item of group.items) {
      if (pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin")) {
        return item;
      }
    }
  }
  return null;
}

export function getBreadcrumbsForPath(pathname: string): Array<{ title: string; href?: string }> {
  const crumbs: Array<{ title: string; href?: string }> = [
    { title: "Yönetim Paneli", href: "/admin/dashboard" }
  ];

  for (const group of ADMIN_NAVIGATION) {
    for (const item of group.items) {
      if (pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin")) {
        crumbs.push(
          { title: group.title },
          { title: item.title, href: item.href }
        );
        return crumbs;
      }
    }
  }

  // Fallback for custom or direct paths
  const parts = pathname.replace("/admin", "").split("/").filter(Boolean);
  let currentPath = "/admin";
  for (const part of parts) {
    currentPath += `/${part}`;
    const capitalized = part.charAt(0).toUpperCase() + part.slice(1);
    crumbs.push({ title: capitalized, href: currentPath });
  }

  return crumbs;
}
