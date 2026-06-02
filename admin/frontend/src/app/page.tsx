"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Activity, 
  Database, 
  ShoppingBag, 
  Loader2, 
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  FolderTree,
  Wrench,
  Sparkles,
  LayoutDashboard,
  Globe,
  FileText,
  Languages,
  User,
  Image as ImageIcon
} from "lucide-react";

// Types
import { XmlFeed, SyncRun, CategoryNode, Product, UserInfo, Brand } from "../types/integration";

// Utils
import { getFlatCategoriesList } from "../utils/formatters";

// Components
import Header from "../components/layout/Header";
import MetricCards from "../components/dashboard/MetricCards";
import QuickFeedList from "../components/dashboard/QuickFeedList";
import ActivityLogs from "../components/dashboard/ActivityLogs";
import FeedManager from "../components/integrations/FeedManager";
import SuppliersManager from "../components/integrations/SuppliersManager";
import CatalogFilters from "../components/catalog/CatalogFilters";
import ProductGrid from "../components/catalog/ProductGrid";
import ProductDetailModal from "../components/catalog/ProductDetailModal";
import LoginScreen from "../components/auth/LoginScreen";
import CategoryTreeEditor from "../components/catalog/CategoryTreeEditor";
import GeographyManager from "../components/geography/GeographyManager";
import PoliciesManager from "../components/policies/PoliciesManager";
import TranslationManager from "../components/translate/TranslationManager";
import CustomersManager from "../components/customers/CustomersManager";
import PagesManager from "../components/pages/PagesManager";
import ImageCacheManager from "../components/catalog/ImageCacheManager";
import BlogManager from "../components/catalog/BlogManager";
import IndexNowManager from "../components/catalog/IndexNowManager";

const LABELS = {
  SUB_TAB_PRODUCTS: "Ürün Listesi",
  SUB_TAB_CATEGORIES: "Kategorileri Yönet",
  TAB_DASHBOARD: "Özet Paneli",
  TAB_INTEGRATIONS: "Tedarikçi & XML Entegrasyon Yönetimi",
  TAB_CATALOG: "Ürün Kataloğu",
  SETTINGS_TITLE: "Storefront İletişim ve Sosyal Medya Ayarları",
  SETTINGS_SUBTITLE: "Müşterilerinizin storefront alt bilgi (footer) alanında göreceği adres, telefon, e-posta ve WhatsApp hattını bu panelden gerçek zamanlı olarak güncelleyebilirsiniz.",
  SETTINGS_LOADING: "Ayarlar Yükleniyor...",
  SETTINGS_SUCCESS: "Ayarlar başarıyla kaydedildi! Storefront anında güncellendi.",
  SETTINGS_ADDRESS: "Şirket / Showroom Adresi",
  SETTINGS_PHONE: "Telefon Numarası",
  SETTINGS_WHATSAPP: "WhatsApp Destek Hattı",
  SETTINGS_EMAIL: "E-Posta Adresi",
  SETTINGS_SAVING: "Kaydediliyor...",
  SETTINGS_SAVE: "Ayarları Kaydet",
  
  // Sidebar Internationalization
  SIDEBAR_MV: "MV",
  SIDEBAR_BRAND: "Merter Vitrini",
  SIDEBAR_KATALOG_HEADER: "Katalog & Entegrasyon",
  SIDEBAR_DASHBOARD: "Özet Paneli",
  SIDEBAR_INTEGRATIONS_HEADER: "Entegrasyon Yönetimi",
  SIDEBAR_INTEGRATIONS_SUB: "Tedarikçiler & XML",
  SIDEBAR_CATALOG_HEADER: "Ürün Kataloğu",
  SIDEBAR_CATALOG_PRODUCTS: "Ürün Listesi",
  SIDEBAR_CATALOG_CATEGORIES: "Kategori Ağacı",
  SIDEBAR_CATALOG_IMAGES: "Görsel Önbelleği",
  SIDEBAR_CATALOG_BLOG: "Blog Yazıları",
  SIDEBAR_SETTINGS_HEADER: "Sistem Ayarları",
  SIDEBAR_SETTINGS_FOOTER: "Footer & İletişim",
  SIDEBAR_GEOGRAPHY_HEADER: "Coğrafi Tanımlar",
  SIDEBAR_GEOGRAPHY_SUB: "Ülkeler & Şehirler",
  SIDEBAR_POLICIES_HEADER: "Sözleşme & Politika",
  SIDEBAR_POLICIES_SUB: "Yasal Sözleşmeler",
  SIDEBAR_TRANSLATE_HEADER: "Yapay Zeka Çeviri",
  SIDEBAR_TRANSLATE_SUB: "Çeviri Yönetimi",
  SIDEBAR_CUSTOMERS_HEADER: "Müşteri Yönetimi",
  SIDEBAR_CUSTOMERS_SUB: "Müşteri Listesi",
  SIDEBAR_PAGES_HEADER: "Sayfa Yönetimi",
  SIDEBAR_PAGES_SUB: "Dinamik Sayfalar"
};

export default function Home() {
  // Authentication State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<"dashboard" | "integrations" | "catalog" | "settings" | "geography" | "policies" | "translate" | "customers" | "pages" | "image-cache" | "blog" | "indexnow">("dashboard");
  const [catalogSubTab, setCatalogSubTab] = useState<"products" | "categories">("products");
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    integrations: true,
    catalog: true,
    settings: true,
    geography: true,
    policies: true,
    translate: true,
    customers: true,
    pages: true
  });

  const updateNavigation = (tab: "dashboard" | "integrations" | "catalog" | "settings" | "geography" | "policies" | "translate" | "customers" | "pages" | "image-cache" | "blog" | "indexnow", subtab?: "products" | "categories") => {
    setActiveTab(tab);
    if (subtab) {
      setCatalogSubTab(subtab);
    }

    
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", tab);
      if (tab === "catalog" && subtab) {
        params.set("subtab", subtab);
      } else {
        params.delete("subtab");
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
    }
  };

  const updateCatalogSubTab = (subtab: "products" | "categories") => {
    setCatalogSubTab(subtab);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "catalog");
      params.set("subtab", subtab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
    }
  };

  // Sync state with URL search params on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab") as "dashboard" | "integrations" | "catalog" | "settings" | "geography" | "policies" | "translate" | "customers" | "pages" | "image-cache" | "blog" | "indexnow" | null;
      const urlSubTab = params.get("subtab") as "products" | "categories" | null;
      
      if (urlTab && ["dashboard", "integrations", "catalog", "settings", "geography", "policies", "translate", "customers", "pages", "image-cache", "blog", "indexnow"].includes(urlTab)) {
        setActiveTab(urlTab);
      }
      if (urlSubTab && ["products", "categories"].includes(urlSubTab)) {
        setCatalogSubTab(urlSubTab);
      }
    }
  }, []);

  // Handle browser back and forward button clicks
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get("tab") as "dashboard" | "integrations" | "catalog" | "settings" | "geography" | "policies" | "translate" | "customers" | "pages" | "image-cache" | "blog" | "indexnow" | null;
        const urlSubTab = params.get("subtab") as "products" | "categories" | null;
        
        if (urlTab && ["dashboard", "integrations", "catalog", "settings", "geography", "policies", "translate", "customers", "pages", "image-cache", "blog", "indexnow"].includes(urlTab)) {
          setActiveTab(urlTab);
        }
        if (urlSubTab && ["products", "categories"].includes(urlSubTab)) {
          setCatalogSubTab(urlSubTab);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const toggleGroup = (group: string) => {
    if (group === "integrations") {
      setExpandedGroups(prev => ({ ...prev, integrations: !prev.integrations }));
    } else if (group === "catalog") {
      setExpandedGroups(prev => ({ ...prev, catalog: !prev.catalog }));
    } else if (group === "settings") {
      setExpandedGroups(prev => ({ ...prev, settings: !prev.settings }));
    } else if (group === "geography") {
      setExpandedGroups(prev => ({ ...prev, geography: !prev.geography }));
    } else if (group === "policies") {
      setExpandedGroups(prev => ({ ...prev, policies: !prev.policies }));
    } else if (group === "translate") {
      setExpandedGroups(prev => ({ ...prev, translate: !prev.translate }));
    } else if (group === "pages") {
      setExpandedGroups(prev => ({ ...prev, pages: !prev.pages }));
    }
  };


  // Storefront Contact Settings State
  const [storeSettings, setStoreSettings] = useState({
    address: "",
    phone: "",
    whatsapp: "",
    email: "",
    show_single_price: false
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState(false);



  const [apiUrl, setApiUrl] = useState(() => {
    if (typeof window !== "undefined") {
      if (window.location.hostname === "admin.mertervitrini.com.tr") {
        return "https://adminapi.mertervitrini.com.tr";
      }
    }
    return "http://localhost:8080";
  });

  // Core Data State
  const [feeds, setFeeds] = useState<XmlFeed[]>([]);
  const [syncHistory, setSyncHistory] = useState<Record<string, SyncRun[]>>({});
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [suppliers, setSuppliers] = useState<Brand[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  
  // Catalog Filter/Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [limit] = useState(24);
  const [offset, setOffset] = useState(0);

  // UI Interactive States
  const [activeSyncing, setActiveSyncing] = useState<Record<string, string>>({}); // feed_id -> sync_run_id
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [dbStatus, setDbStatus] = useState<"connected" | "disconnected" | "checking">("checking");

  // Load saved session and handle Keycloak OIDC Callback on mount
  useEffect(() => {
    const initSession = async () => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        // We have an OIDC authorization code! Let's show loader and exchange it.
        setIsInitialized(false); // keep loader active
        try {
          const redirectUri = window.location.origin + "/";
          const res = await fetch(`${apiUrl}/api/v1/auth/keycloak-callback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, redirect_uri: redirectUri })
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Oturum doğrulama başarısız oldu.");
          }

          const data = await res.json();
          // Save session
          setToken(data.token);
          setUser(data.user);
          localStorage.setItem("admin_token", data.token);
          localStorage.setItem("admin_user", JSON.stringify(data.user));

          // Clean up the URL search params so the code doesn't remain in the address bar
          params.delete("code");
          // Maintain other search params if any (like tab)
          const newSearch = params.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
          window.history.replaceState({}, "", newUrl);
        } catch (err: unknown) {
          console.error("Keycloak OIDC callback error:", err);
          alert((err as Error).message || "Oturum doğrulanırken bir hata oluştu.");
          // Clear any corrupted local session
          setToken(null);
          setUser(null);
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_user");
        } finally {
          setIsInitialized(true);
        }
      } else {
        // Standard session restoration from localStorage
        const savedToken = localStorage.getItem("admin_token");
        const savedUser = localStorage.getItem("admin_user");
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser) as UserInfo);
        }
        setIsInitialized(true);
      }
    };

    const timer = setTimeout(() => {
      initSession();
    }, 0);
    return () => clearTimeout(timer);
  }, [apiUrl]);

  // Handle successful login from LoginScreen
  const handleLoginSuccess = (newToken: string, newUser: UserInfo) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("admin_token", newToken);
    localStorage.setItem("admin_user", JSON.stringify(newUser));
  };

  // Handle logout
  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
  }, []);

  // Load backend data helper (automatically signs all requests with JWT Bearer Token)
  const fetchWithConfig = useCallback(async (path: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers
    });

    // Auto-logout when API returns 401 Unauthorized (expired/invalid session)
    if (res.status === 401 && path !== "/health" && !path.includes("/auth/")) {
      handleLogout();
      throw new Error("Oturum süresi doldu. Lütfen tekrar giriş yapın.");
    }

    if (!res.ok) {
      throw new Error(`API Error: ${res.statusText}`);
    }
    return res;
  }, [apiUrl, token, handleLogout]);

  // Check Database connection (Public endpoint)
  const checkDbConnection = useCallback(async () => {
    setTimeout(() => setDbStatus("checking"), 0);
    try {
      const res = await fetchWithConfig("/health");
      const data = await res.json();
      if (data.status === "healthy" && data.database === "connected") {
        setDbStatus("connected");
      } else {
        setDbStatus("disconnected");
      }
    } catch {
      setDbStatus("disconnected");
    }
  }, [fetchWithConfig]);

  // Load Sync History for a Feed
  const loadSyncHistory = useCallback(async (feedId: string) => {
    try {
      const res = await fetchWithConfig(`/api/v1/feeds/${feedId}/syncs`);
      const data = await res.json();
      setSyncHistory(prev => {
        const next = { ...prev };
        Reflect.set(next, feedId, data || []);
        return next;
      });
      
      // If there is an active running sync, register it in activeSyncing
      const activeRun = data?.find((run: SyncRun) => run.status === "running");
      if (activeRun) {
        setActiveSyncing(prev => {
          const next = { ...prev };
          Reflect.set(next, feedId, activeRun.id);
          return next;
        });
      }
    } catch (err) {
      console.error(`Failed to load sync history for ${feedId}`, err);
    }
  }, [fetchWithConfig]);

  // Load Feeds
  const loadFeeds = useCallback(async () => {
    setTimeout(() => setLoadingFeeds(true), 0);
    try {
      const res = await fetchWithConfig("/api/v1/feeds");
      const data = await res.json();
      setFeeds(data || []);
      
      // Load sync history for each feed
      if (data && data.length > 0) {
        data.forEach((feed: XmlFeed) => {
          loadSyncHistory(feed.id);
        });
      }
    } catch (err) {
      console.error("Failed to load xml feeds", err);
    } finally {
      setLoadingFeeds(false);
    }
  }, [fetchWithConfig, loadSyncHistory]);

  // Load Categories
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetchWithConfig("/api/v1/categories");
      const data = await res.json();
      setCategories(data || []);
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  }, [fetchWithConfig]);

  // Load Suppliers
  const loadSuppliers = useCallback(async () => {
    setTimeout(() => setLoadingSuppliers(true), 0);
    try {
      const res = await fetchWithConfig("/api/v1/suppliers");
      const data = await res.json();
      setSuppliers(data || []);
    } catch (err) {
      console.error("Failed to load suppliers", err);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [fetchWithConfig]);

  // Load Products
  const loadProducts = useCallback(async () => {
    setTimeout(() => setLoadingProducts(true), 0);
    try {
      let url = `/api/v1/products?limit=${limit}&offset=${offset}`;
      if (searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }
      if (selectedCategory) {
        url += `&category_id=${encodeURIComponent(selectedCategory)}`;
      }
      
      const res = await fetchWithConfig(url);
      const totalHeader = res.headers.get("X-Total-Count");
      if (totalHeader) {
        setTotalProductsCount(Number(totalHeader));
      } else {
        setTotalProductsCount(0);
      }
      const data = await res.json();
      setProducts(data || []);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setLoadingProducts(false);
    }
  }, [fetchWithConfig, searchQuery, selectedCategory, limit, offset]);

  // Load storefront settings
  const loadSettings = useCallback(async () => {
    setTimeout(() => setLoadingSettings(true), 0);
    setSettingsError("");
    try {
      const res = await fetchWithConfig("/api/v1/settings");
      const data = await res.json();
      if (data) {
        setStoreSettings({
          address: data.address || "",
          phone: data.phone || "",
          whatsapp: data.whatsapp || "",
          email: data.email || "",
          show_single_price: false,
        });
      }
    } catch (err) {
      console.error("Failed to load storefront settings", err);
      setSettingsError("Ayar verileri yüklenemedi. Lütfen DB ve API bağlantınızı kontrol edin.");
    } finally {
      setLoadingSettings(false);
    }
  }, [fetchWithConfig]);

  // Update storefront settings
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsError("");
    setSettingsSuccess(false);

    try {
      const res = await fetchWithConfig("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storeSettings),
      });

      const updated = await res.json();
      if (updated) {
        setStoreSettings({
          address: updated.address || "",
          phone: updated.phone || "",
          whatsapp: updated.whatsapp || "",
          email: updated.email || "",
          show_single_price: false,
        });
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 4000);
      }
    } catch (err) {
      console.error("Failed to save settings", err);
      setSettingsError("Kaydetme işlemi başarısız oldu. API hatası.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Load Product Details (with Variants and Images)
  const viewProductDetails = async (productId: string) => {
    try {
      const res = await fetchWithConfig(`/api/v1/products/${productId}`);
      const data = await res.json();
      setSelectedProduct(data);
    } catch (err) {
      console.error(`Failed to load product details for ${productId}`, err);
    }
  };

  // Safety guard against prototype pollution
  const getSafeKey = (key: string): string => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error("Dangerous key detected");
    }
    return key;
  };

  // Trigger Feed Sync
  const triggerSync = async (feedId: string) => {
    const safeFeedId = getSafeKey(feedId);
    if (Reflect.get(activeSyncing, safeFeedId)) return;

    try {
      const res = await fetchWithConfig(`/api/v1/feeds/${safeFeedId}/sync`, {
        method: "POST"
      });
      const newRun: SyncRun = await res.json();
      
      // Add running status
      setActiveSyncing(prev => {
        const next = { ...prev };
        Reflect.set(next, safeFeedId, newRun.id);
        return next;
      });
      setSyncHistory(prev => {
        const next = { ...prev };
        const existing = Reflect.get(prev, safeFeedId) as SyncRun[] | undefined;
        Reflect.set(next, safeFeedId, [newRun, ...(existing || [])]);
        return next;
      });
    } catch (err) {
      console.error(`Failed to trigger sync for ${feedId}`, err);
    }
  };

  // Cancel Feed Sync
  const cancelSync = async (feedId: string) => {
    const safeFeedId = getSafeKey(feedId);
    try {
      await fetchWithConfig(`/api/v1/feeds/${safeFeedId}/sync/cancel`, {
        method: "POST"
      });
      // Remove running status locally immediately
      setActiveSyncing(prev => {
        const next = { ...prev };
        Reflect.deleteProperty(next, safeFeedId);
        return next;
      });
      // Refresh sync runs list from DB to show the updated cancel/fail status
      const res = await fetchWithConfig(`/api/v1/feeds/${safeFeedId}/syncs`);
      const data: SyncRun[] = await res.json();
      setSyncHistory(prev => {
        const next = { ...prev };
        Reflect.set(next, safeFeedId, data || []);
        return next;
      });
    } catch (err) {
      console.error(`Failed to cancel sync for ${feedId}`, err);
    }
  };

  // Clear Sync History for all feeds
  const handleClearHistory = async () => {
    try {
      await fetchWithConfig("/api/v1/feeds/all/syncs", {
        method: "DELETE"
      });
      // Reload feeds and history
      loadFeeds();
    } catch (err) {
      console.error("Failed to clear sync history:", err);
    }
  };

  // Poll for Active Sync Progress
  useEffect(() => {
    if (!token) return; // Only poll if authenticated
    const activeFeedIds = Object.keys(activeSyncing);
    if (activeFeedIds.length === 0) return;

    const interval = setInterval(() => {
      activeFeedIds.forEach(async (feedId) => {
        const safeFeedId = getSafeKey(feedId);
        const activeRunId = Reflect.get(activeSyncing, safeFeedId);
        try {
          const res = await fetchWithConfig(`/api/v1/feeds/${safeFeedId}/syncs`);
          const data: SyncRun[] = await res.json();
          setSyncHistory(prev => {
            const next = { ...prev };
            Reflect.set(next, safeFeedId, data || []);
            return next;
          });
          
          const currentRun = data.find(run => run.id === activeRunId);
          if (currentRun && currentRun.status !== "running") {
            // Sync completed (success or failed)
            setActiveSyncing(prev => {
              const updated = { ...prev };
              Reflect.deleteProperty(updated, safeFeedId);
              return updated;
            });
            // Reload products in case sync added/updated items
            if (activeTab === "catalog" || activeTab === "dashboard") {
              loadProducts();
            }
          }
        } catch (err) {
          console.error("Error polling sync status", err);
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [activeSyncing, fetchWithConfig, activeTab, loadProducts, token]);

  // Initial Load & Triggers (Triggered only when logged in)
  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      checkDbConnection();
      loadFeeds();
      loadCategories();
      loadSuppliers();
      loadSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, [checkDbConnection, loadFeeds, loadCategories, loadSuppliers, loadSettings, token]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      loadProducts();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProducts, token]);

  // Trigger public DB connection check even before login
  useEffect(() => {
    const timer = setTimeout(() => {
      checkDbConnection();
    }, 0);
    return () => clearTimeout(timer);
  }, [checkDbConnection]);

  // Flat Categories list helper for filters
  const flatCategories = getFlatCategoriesList(categories);

  const applySettingsAndRefresh = () => {
    checkDbConnection();
    if (token) {
      loadFeeds();
      loadCategories();
      loadSuppliers();
      loadProducts();
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setOffset(0);
  };

  // 1. Loading State during initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 size={36} className="text-violet-500 animate-spin" />
      </div>
    );
  }

  // 2. Unauthenticated State -> Render beautiful Login Screen
  if (!token) {
    return (
      <LoginScreen 
        apiUrl={apiUrl} 
      />
    );
  }

  // 3. Authenticated State -> Render Full Dashboard
  return (
    <div className="flex min-h-screen bg-zinc-50/60 text-zinc-900 antialiased font-sans">
      
      {/* ----------------- LEFT SIDEBAR NAVIGATION (OPENCART STYLE) ----------------- */}
      
      {/* Sidebar overlay backdrop for mobile view */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar container */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 text-zinc-300 flex flex-col shrink-0 transition-transform duration-300 lg:translate-x-0 lg:static lg:h-auto ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Brand Logo & Close button for mobile */}
        <div className="h-16 px-6 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-950">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-base shadow shadow-violet-500/20">
              {LABELS.SIDEBAR_MV}
            </div>
            <span className="font-extrabold text-white text-sm tracking-tight">{LABELS.SIDEBAR_BRAND}</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 select-none">
          
          {/* Main Menu Label */}
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">{LABELS.SIDEBAR_KATALOG_HEADER}</span>

          <div className="flex flex-col gap-1.5">
            {/* Dashboard Button */}
            <button
              onClick={() => {
                updateNavigation("dashboard");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-violet-600 text-white font-extrabold shadow-md shadow-violet-600/10"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <LayoutDashboard size={16} />
              {LABELS.SIDEBAR_DASHBOARD}
            </button>

            {/* Accordion Group 1: Entegrasyonlar */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleGroup("integrations")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Database size={16} />
                  {LABELS.SIDEBAR_INTEGRATIONS_HEADER}
                </div>
                {expandedGroups.integrations ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedGroups.integrations && (
                <div className="pl-6 pr-2 py-1 flex flex-col gap-1 border-l border-zinc-800 ml-5 mt-1 animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      updateNavigation("integrations");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "integrations"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_INTEGRATIONS_SUB}
                  </button>
                </div>
              )}
            </div>

            {/* Accordion Group 2: Katalog */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleGroup("catalog")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag size={16} />
                  {LABELS.SIDEBAR_CATALOG_HEADER}
                </div>
                {expandedGroups.catalog ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedGroups.catalog && (
                <div className="pl-6 pr-2 py-1 flex flex-col gap-1 border-l border-zinc-800 ml-5 mt-1 animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      updateNavigation("catalog", "products");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "catalog" && catalogSubTab === "products"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_CATALOG_PRODUCTS}
                  </button>
                  <button
                    onClick={() => {
                      updateNavigation("catalog", "categories");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "catalog" && catalogSubTab === "categories"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_CATALOG_CATEGORIES}
                  </button>
                  <button
                    onClick={() => {
                      updateNavigation("image-cache");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "image-cache"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_CATALOG_IMAGES}
                  </button>
                  <button
                    onClick={() => {
                      updateNavigation("blog");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "blog"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_CATALOG_BLOG}
                  </button>
                </div>
              )}
            </div>

            {/* Accordion Group 3: Site Ayarları */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleGroup("settings")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Wrench size={16} />
                  {LABELS.SIDEBAR_SETTINGS_HEADER}
                </div>
                {expandedGroups.settings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedGroups.settings && (
                <div className="pl-6 pr-2 py-1 flex flex-col gap-1 border-l border-zinc-800 ml-5 mt-1 animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      updateNavigation("settings");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "settings"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_SETTINGS_FOOTER}
                  </button>
                  <button
                    onClick={() => {
                      updateNavigation("indexnow");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "indexnow"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    IndexNow Gönderimi
                  </button>
                </div>
              )}
            </div>

            {/* Accordion Group 4: Coğrafi Tanımlar */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleGroup("geography")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Globe size={16} />
                  {LABELS.SIDEBAR_GEOGRAPHY_HEADER}
                </div>
                {expandedGroups.geography ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedGroups.geography && (
                <div className="pl-6 pr-2 py-1 flex flex-col gap-1 border-l border-zinc-800 ml-5 mt-1 animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      updateNavigation("geography");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "geography"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_GEOGRAPHY_SUB}
                  </button>
                </div>
              )}
            </div>

            {/* Accordion Group 5: Sözleşme & Politikalar */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleGroup("policies")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} />
                  {LABELS.SIDEBAR_POLICIES_HEADER}
                </div>
                {expandedGroups.policies ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedGroups.policies && (
                <div className="pl-6 pr-2 py-1 flex flex-col gap-1 border-l border-zinc-800 ml-5 mt-1 animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      updateNavigation("policies");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "policies"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_POLICIES_SUB}
                  </button>
                </div>
              )}
            </div>

            {/* Accordion Group 6: Yapay Zeka Çeviri */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleGroup("translate")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Languages size={16} />
                  {LABELS.SIDEBAR_TRANSLATE_HEADER}
                </div>
                {expandedGroups.translate ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedGroups.translate && (
                <div className="pl-6 pr-2 py-1 flex flex-col gap-1 border-l border-zinc-800 ml-5 mt-1 animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      updateNavigation("translate");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "translate"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_TRANSLATE_SUB}
                  </button>
                </div>
              )}
            </div>

            {/* Accordion Group 7: Müşteri Listesi */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleGroup("customers")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <User size={16} />
                  {LABELS.SIDEBAR_CUSTOMERS_HEADER}
                </div>
                {expandedGroups.customers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedGroups.customers && (
                <div className="pl-6 pr-2 py-1 flex flex-col gap-1 border-l border-zinc-800 ml-5 mt-1 animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      updateNavigation("customers");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "customers"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_CUSTOMERS_SUB}
                  </button>
                </div>
              )}
            </div>

            {/* Accordion Group 8: Sayfa Yönetimi */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleGroup("pages")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} />
                  {LABELS.SIDEBAR_PAGES_HEADER}
                </div>
                {expandedGroups.pages ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedGroups.pages && (
                <div className="pl-6 pr-2 py-1 flex flex-col gap-1 border-l border-zinc-800 ml-5 mt-1 animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      updateNavigation("pages");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "pages"
                        ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {LABELS.SIDEBAR_PAGES_SUB}
                  </button>
                </div>
              )}
            </div>

          </div>
        </nav>

        {/* User Card at Bottom of Sidebar */}
        {user && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0 font-bold text-xs uppercase">
              {user.first_name[0]}{user.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-white block truncate leading-tight">
                {user.first_name} {user.last_name}
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 block leading-none uppercase tracking-wider mt-0.5">
                {user.role}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* ----------------- RIGHT COLUMN CONTENT AREA ----------------- */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* Header (Top Navigation & Info bar) */}
        <Header 
          dbStatus={dbStatus}
          checkDbConnection={checkDbConnection}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          apiUrl={apiUrl}
          setApiUrl={setApiUrl}
          onApplySettings={applySettingsAndRefresh}
          user={user}
          onLogout={handleLogout}
          onMenuToggle={() => setSidebarOpen(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-6 flex flex-col gap-6 w-full mx-auto">
          
          {/* Tab 1: Dashboard */}
          {activeTab === "dashboard" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              {/* Quick Metrics */}
              <MetricCards 
                feedsCount={feeds.length}
                productsCount={totalProductsCount}
                categoriesCount={flatCategories.length}
                activeSyncingCount={Object.keys(activeSyncing).length}
                loadingProducts={loadingProducts}
              />

              {/* Quick Overview Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Feeds status list */}
                <QuickFeedList 
                  feeds={feeds}
                  syncHistory={syncHistory}
                  activeSyncing={activeSyncing}
                  triggerSync={triggerSync}
                  cancelSync={cancelSync}
                  onNavigateToIntegrations={() => updateNavigation("integrations")}
                />

                {/* Recent sync activity logs */}
                <ActivityLogs 
                  feeds={feeds}
                  syncHistory={syncHistory}
                  onClearHistory={handleClearHistory}
                />
              </div>
            </div>
          )}

          {/* Tab 2: Suppliers & XML Management */}
          {activeTab === "integrations" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              <SuppliersManager 
                suppliers={suppliers}
                categories={categories}
                onRefresh={loadSuppliers}
                apiUrl={apiUrl}
                token={token}
                activeSyncing={activeSyncing}
                triggerSync={triggerSync}
              />
            </div>
          )}

          {/* Tab 3: Products Catalog */}
          {activeTab === "catalog" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              {/* Sub-tab navigation */}
              <div className="flex border-b border-zinc-200/40 gap-6 pb-2">
                <button 
                  onClick={() => updateCatalogSubTab("products")}
                  className={`pb-2 text-sm font-bold transition-all relative cursor-pointer ${
                    catalogSubTab === "products" 
                      ? "text-violet-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-violet-600" 
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {LABELS.SUB_TAB_PRODUCTS}
                </button>
                <button 
                  onClick={() => updateCatalogSubTab("categories")}
                  className={`pb-2 text-sm font-bold transition-all relative cursor-pointer ${
                    catalogSubTab === "categories" 
                      ? "text-violet-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-violet-600" 
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {LABELS.SUB_TAB_CATEGORIES}
                </button>
              </div>

              {catalogSubTab === "products" ? (
                <>
                  {/* Filter Toolbar */}
                  <CatalogFilters 
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    flatCategories={flatCategories}
                    onReset={handleResetFilters}
                  />

                  {/* Catalog Grid */}
                  <ProductGrid 
                    products={products}
                    feeds={feeds}
                    loadingProducts={loadingProducts}
                    limit={limit}
                    offset={offset}
                    setOffset={setOffset}
                    onViewDetails={viewProductDetails}
                  />
                </>
              ) : (
                <CategoryTreeEditor 
                  categories={categories}
                  onRefresh={loadCategories}
                  apiUrl={apiUrl}
                  token={token}
                />
              )}
            </div>
          )}

          {/* Tab 4: Site Settings */}
          {activeTab === "settings" && (
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-8 animate-in fade-in duration-200">
              
              {/* Site Settings Form Card */}
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-sm flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
                    <SettingsIcon size={20} className="text-violet-600 animate-spin-slow" />
                    {LABELS.SETTINGS_TITLE}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1 font-medium">
                    {LABELS.SETTINGS_SUBTITLE}
                  </p>
                </div>

                {loadingSettings ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 size={32} className="text-violet-600 animate-spin" />
                    <span className="text-xs font-semibold text-zinc-400">{LABELS.SETTINGS_LOADING}</span>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateSettings} className="space-y-6">
                    {settingsError && (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-600 leading-relaxed">
                        ⚠️ {settingsError}
                      </div>
                    )}

                    {settingsSuccess && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 leading-relaxed flex items-center gap-2 animate-bounce">
                        {LABELS.SETTINGS_SUCCESS}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          {LABELS.SETTINGS_ADDRESS}
                        </label>
                        <textarea
                          value={storeSettings.address}
                          onChange={(e) => setStoreSettings(prev => ({ ...prev, address: e.target.value }))}
                          rows={3}
                          className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed"
                          placeholder="Showroom adresini buraya girin..."
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            {LABELS.SETTINGS_PHONE}
                          </label>
                          <input
                            type="text"
                            value={storeSettings.phone}
                            onChange={(e) => setStoreSettings(prev => ({ ...prev, phone: e.target.value }))}
                            className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                            placeholder="+90 533 703 08 83"
                            required
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            {LABELS.SETTINGS_WHATSAPP}
                          </label>
                          <input
                            type="text"
                            value={storeSettings.whatsapp}
                            onChange={(e) => setStoreSettings(prev => ({ ...prev, whatsapp: e.target.value }))}
                            className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                            placeholder="+90 533 703 08 83"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          {LABELS.SETTINGS_EMAIL}
                        </label>
                        <input
                          type="email"
                          value={storeSettings.email}
                          onChange={(e) => setStoreSettings(prev => ({ ...prev, email: e.target.value }))}
                          className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          placeholder="info@toptanmoda.net"
                          required
                        />
                      </div>

                    </div>

                    <div className="flex justify-end pt-4 border-t border-zinc-100">
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white rounded-xl text-sm font-semibold shadow-md shadow-violet-500/10 hover:shadow-violet-500/20 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        {savingSettings && <Loader2 size={16} className="animate-spin" />}
                        {savingSettings ? LABELS.SETTINGS_SAVING : LABELS.SETTINGS_SAVE}
                      </button>
                    </div>
                  </form>
                )}
              </div>

            </div>
          )}

          {/* Tab 10: Görsel Önbellek & Boyutlandırma Yönetimi */}
          {activeTab === "image-cache" && (
            <ImageCacheManager apiUrl={apiUrl} token={token} />
          )}

          {/* Tab 11: Çok Dilli Blog Yazıları Yönetimi */}
          {activeTab === "blog" && (
            <BlogManager apiUrl={apiUrl} token={token} />
          )}

          {/* Tab 12: IndexNow Manuel URL İndeksleme Paneli */}
          {activeTab === "indexnow" && (
            <IndexNowManager apiUrl={apiUrl} token={token} />
          )}

          {/* Tab 5: Coğrafi Tanımlar (Ülkeler & Şehirler) */}
          {activeTab === "geography" && (
            <GeographyManager apiUrl={apiUrl} token={token} />
          )}

          {/* Tab 6: Sözleşme & Politika Yönetimi */}
          {activeTab === "policies" && (
            <PoliciesManager apiUrl={apiUrl} token={token} />
          )}

          {/* Tab 7: Otomatik Yapay Zeka Çeviri Paneli */}
          {activeTab === "translate" && (
            <TranslationManager apiUrl={apiUrl} token={token} />
          )}

          {/* Tab 8: Müşteri Listesi & Yönetimi */}
          {activeTab === "customers" && (
            <CustomersManager apiUrl={apiUrl} token={token} />
          )}

          {/* Tab 9: Dinamik Sayfa Yönetimi (CMS) */}
          {activeTab === "pages" && (
            <PagesManager apiUrl={apiUrl} token={token} />
          )}

        </main>

        {/* Product Variant Details Modal */}
        <ProductDetailModal 
          product={selectedProduct}
          feeds={feeds}
          onClose={() => setSelectedProduct(null)}
          onViewProduct={viewProductDetails}
        />

        {/* Footer */}
        <footer className="w-full py-6 mt-12 bg-white border-t border-zinc-200/50 text-center text-xs text-zinc-500 font-medium shrink-0">
          <p>© {new Date().getFullYear()} Merter Vitrini - XML Entegrasyon ve Toptan Katalog Yönetim Paneli</p>
        </footer>

      </div>

    </div>
  );
}
