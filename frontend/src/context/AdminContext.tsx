"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { 
  XmlFeed, 
  SyncRun, 
  CategoryNode, 
  Product, 
  UserInfo, 
  Brand 
} from "@/types/integration";
import { getFlatCategoriesList } from "@/utils/formatters";

export interface StoreSettingsData {
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  show_single_price: boolean;
}

export interface AdminContextType {
  // Auth & Connection
  apiUrl: string;
  token: string | null;
  user: UserInfo | null;
  isInitialized: boolean;
  dbStatus: "connected" | "disconnected" | "checking";
  login: (token: string, user: UserInfo) => void;
  handleLogout: () => void;
  fetchWithConfig: (path: string, options?: RequestInit) => Promise<Response>;

  // Sidebar Layout State
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;

  // Feeds & Sync
  feeds: XmlFeed[];
  setFeeds: React.Dispatch<React.SetStateAction<XmlFeed[]>>;
  syncHistory: Record<string, SyncRun[]>;
  setSyncHistory: React.Dispatch<React.SetStateAction<Record<string, SyncRun[]>>>;
  activeSyncing: Record<string, string>;
  triggerSync: (feedId: string) => Promise<void>;
  cancelSync: (feedId: string) => Promise<void>;
  handleClearHistory: (feedId: string) => Promise<void>;
  loadFeedsAndHistory: () => Promise<void>;

  // Suppliers & Categories
  suppliers: Brand[];
  setSuppliers: React.Dispatch<React.SetStateAction<Brand[]>>;
  categories: CategoryNode[];
  setCategories: React.Dispatch<React.SetStateAction<CategoryNode[]>>;
  flatCategories: Array<{ id: string; title: string; depth: number; node_path: string }>;
  loadSuppliers: () => Promise<void>;
  loadCategories: () => Promise<void>;

  // Products
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  totalProductsCount: number;
  setTotalProductsCount: React.Dispatch<React.SetStateAction<number>>;
  loadingProducts: boolean;
  setLoadingProducts: React.Dispatch<React.SetStateAction<boolean>>;
  loadProducts: (limit?: number, offset?: number, categoryId?: string, search?: string) => Promise<void>;

  // Storefront Settings
  storeSettings: StoreSettingsData;
  setStoreSettings: React.Dispatch<React.SetStateAction<StoreSettingsData>>;
  loadingSettings: boolean;
  savingSettings: boolean;
  settingsError: string;
  settingsSuccess: boolean;
  handleUpdateSettings: (e: React.FormEvent) => Promise<void>;
  loadStoreSettings: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { readonly children: React.ReactNode }) {
  // Shell Layout State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // API URL
  const [apiUrl] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("merter_api_url");
      if (saved) return saved;
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:8080";
      }
      return `${window.location.protocol}//${window.location.host}`;
    }
    return "http://localhost:8080";
  });

  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [dbStatus, setDbStatus] = useState<"connected" | "disconnected" | "checking">("checking");

  const login = useCallback((newToken: string, newUser: UserInfo) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("admin_token", newToken);
    localStorage.setItem("admin_user", JSON.stringify(newUser));
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
  }, []);

  const fetchWithConfig = useCallback(async (path: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      handleLogout();
    }
    return res;
  }, [apiUrl, token, handleLogout]);

  // Core Data
  const [feeds, setFeeds] = useState<XmlFeed[]>([]);
  const [syncHistory, setSyncHistory] = useState<Record<string, SyncRun[]>>({});
  const [suppliers, setSuppliers] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeSyncing, setActiveSyncing] = useState<Record<string, string>>({});

  // Storefront Settings
  const [storeSettings, setStoreSettings] = useState<StoreSettingsData>({
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

  const flatCategories = useMemo(() => getFlatCategoriesList(categories), [categories]);

  // Load Session and handle Keycloak callback
  useEffect(() => {
    const initSession = async () => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        setIsInitialized(false);
        try {
          const redirectUri = window.location.origin + "/admin";
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
          login(data.token, data.user);

          params.delete("code");
          params.delete("session_state");
          params.delete("iss");
          const newSearch = params.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
          window.history.replaceState({}, "", newUrl);
        } catch (err: unknown) {
          console.error("Keycloak OIDC callback error:", err);
          handleLogout();
        } finally {
          setIsInitialized(true);
        }
      } else {
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
      void initSession();
    }, 0);
    return () => clearTimeout(timer);
  }, [apiUrl, login, handleLogout]);

  // Load Feeds & History
  const loadFeedsAndHistory = useCallback(async () => {
    try {
      const res = await fetchWithConfig("/api/v1/feeds");
      if (res.ok) {
        const data = await res.json();
        setFeeds(data || []);

        // Load sync history for feeds
        if (Array.isArray(data)) {
          const historyMap: Record<string, SyncRun[]> = {};
          await Promise.all(
            data.map(async (f: XmlFeed) => {
              try {
                const hRes = await fetchWithConfig(`/api/v1/feeds/${f.id}/history`);
                if (hRes.ok) {
                  const runs = await hRes.json();
                  historyMap[f.id] = runs || [];
                }
              } catch {
                historyMap[f.id] = [];
              }
            })
          );
          setSyncHistory(historyMap);
        }
      }
    } catch (e) {
      console.error("Feeds loading error:", e);
    }
  }, [fetchWithConfig]);

  // Load Categories
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetchWithConfig("/api/v1/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      }
    } catch (e) {
      console.error("Categories loading error:", e);
    }
  }, [fetchWithConfig]);

  // Load Suppliers
  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetchWithConfig("/api/v1/suppliers");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data || []);
      }
    } catch (e) {
      console.error("Suppliers loading error:", e);
    }
  }, [fetchWithConfig]);

  // Load Products
  const loadProducts = useCallback(async (limit = 24, offset = 0, categoryId = "", search = "") => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", limit.toString());
      params.set("offset", offset.toString());
      if (categoryId) params.set("category_id", categoryId);
      if (search) params.set("search", search);

      const res = await fetchWithConfig(`/api/v1/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalProductsCount(data.total || 0);
      }
    } catch (e) {
      console.error("Products loading error:", e);
    } finally {
      setLoadingProducts(false);
    }
  }, [fetchWithConfig]);

  // Load Settings
  const loadStoreSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await fetchWithConfig("/api/v1/settings");
      if (res.ok) {
        const data = await res.json();
        setStoreSettings({
          address: data.address || "",
          phone: data.phone || "",
          whatsapp: data.whatsapp || "",
          email: data.email || "",
          show_single_price: Boolean(data.show_single_price)
        });
      }
    } catch (e) {
      console.error("Settings loading error:", e);
    } finally {
      setLoadingSettings(false);
    }
  }, [fetchWithConfig]);

  // Update Settings
  const handleUpdateSettings = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsError("");
    setSettingsSuccess(false);

    try {
      const res = await fetchWithConfig("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storeSettings)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Ayarlar kaydedilemedi.");
      }

      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 4000);
    } catch (err: unknown) {
      setSettingsError((err as Error).message || "Beklenmedik bir hata oluştu.");
    } finally {
      setSavingSettings(false);
    }
  }, [fetchWithConfig, storeSettings]);

  // Trigger Feed Sync
  const triggerSync = useCallback(async (feedId: string) => {
    try {
      const res = await fetchWithConfig(`/api/v1/feeds/${feedId}/sync`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setActiveSyncing(prev => ({ ...prev, [feedId]: data.sync_run_id || "running" }));
        void loadFeedsAndHistory();
      }
    } catch (e) {
      console.error("Sync trigger error:", e);
    }
  }, [fetchWithConfig, loadFeedsAndHistory]);

  // Cancel Feed Sync
  const cancelSync = useCallback(async (feedId: string) => {
    try {
      const res = await fetchWithConfig(`/api/v1/feeds/${feedId}/cancel`, { method: "POST" });
      if (res.ok) {
        setActiveSyncing(prev => {
          const next = { ...prev };
          delete next[feedId];
          return next;
        });
        void loadFeedsAndHistory();
      }
    } catch (e) {
      console.error("Sync cancel error:", e);
    }
  }, [fetchWithConfig, loadFeedsAndHistory]);

  // Clear History
  const handleClearHistory = useCallback(async (feedId: string) => {
    try {
      const res = await fetchWithConfig(`/api/v1/feeds/${feedId}/history`, { method: "DELETE" });
      if (res.ok) {
        setSyncHistory(prev => ({ ...prev, [feedId]: [] }));
      }
    } catch (e) {
      console.error("Clear history error:", e);
    }
  }, [fetchWithConfig]);

  // Check DB status and preload initial data when token is valid
  useEffect(() => {
    if (!token) return;

    const checkHealth = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/v1/health`);
        if (res.ok) {
          setDbStatus("connected");
        } else {
          setDbStatus("disconnected");
        }
      } catch {
        setDbStatus("disconnected");
      }
    };

    const timer = setTimeout(() => {
      void checkHealth();
      void loadFeedsAndHistory();
      void loadSuppliers();
      void loadCategories();
    }, 0);
    return () => clearTimeout(timer);
  }, [token, apiUrl, loadFeedsAndHistory, loadSuppliers, loadCategories]);

  const value = useMemo<AdminContextType>(() => ({
    apiUrl,
    token,
    user,
    isInitialized,
    dbStatus,
    login,
    handleLogout,
    fetchWithConfig,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    toggleSidebar,
    feeds,
    setFeeds,
    syncHistory,
    setSyncHistory,
    activeSyncing,
    triggerSync,
    cancelSync,
    handleClearHistory,
    loadFeedsAndHistory,
    suppliers,
    setSuppliers,
    categories,
    setCategories,
    flatCategories,
    loadSuppliers,
    loadCategories,
    products,
    setProducts,
    totalProductsCount,
    setTotalProductsCount,
    loadingProducts,
    setLoadingProducts,
    loadProducts,
    storeSettings,
    setStoreSettings,
    loadingSettings,
    savingSettings,
    settingsError,
    settingsSuccess,
    handleUpdateSettings,
    loadStoreSettings
  }), [
    apiUrl,
    token,
    user,
    isInitialized,
    dbStatus,
    login,
    handleLogout,
    fetchWithConfig,
    sidebarCollapsed,
    mobileSidebarOpen,
    toggleSidebar,
    feeds,
    syncHistory,
    activeSyncing,
    triggerSync,
    cancelSync,
    handleClearHistory,
    loadFeedsAndHistory,
    suppliers,
    categories,
    flatCategories,
    loadSuppliers,
    loadCategories,
    products,
    totalProductsCount,
    loadingProducts,
    loadProducts,
    storeSettings,
    loadingSettings,
    savingSettings,
    settingsError,
    settingsSuccess,
    handleUpdateSettings,
    loadStoreSettings
  ]);

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextType {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
