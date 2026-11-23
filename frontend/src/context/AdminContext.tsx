"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  XmlFeed,
  SyncRun,
  CategoryNode,
  Product,
  UserInfo,
  Brand,
} from "@/types/integration";
import { getFlatCategoriesList } from "@/utils/formatters";
import { invalidateStoreSettingsCache } from "@/app/utils";
import {
  BearerTokenHeaderStrategy,
  FetchHttpClient,
} from "@/services/http-client";
import {
  AdminApiService,
  AdminProductFilterParams,
  BulkProductActionResult,
  BulkProductActionType,
  StoreSettingsDTO,
  normalizeCanonicalAdminUrl,
} from "@/services/admin-api.service";

export type StoreSettingsData = StoreSettingsDTO;

// ============================================================================
// SEGREGATED DOMAIN INTERFACES (ISP)
// ============================================================================

export interface AdminAuthSlice {
  apiUrl: string;
  token: string | null;
  user: UserInfo | null;
  authError: string | null;
  clearAuthError: () => void;
  isInitialized: boolean;
  dbStatus: "connected" | "disconnected" | "checking";
  login: (token: string, user: UserInfo, idToken?: string) => void;
  handleLogout: () => void;
  fetchWithConfig: (path: string, options?: RequestInit) => Promise<Response>;
}

export interface AdminShellSlice {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
}

export interface AdminFeedsSlice {
  feeds: XmlFeed[];
  setFeeds: React.Dispatch<React.SetStateAction<XmlFeed[]>>;
  syncHistory: Record<string, SyncRun[]>;
  setSyncHistory: React.Dispatch<React.SetStateAction<Record<string, SyncRun[]>>>;
  activeSyncing: Record<string, string>;
  triggerSync: (feedId: string) => Promise<void>;
  cancelSync: (feedId: string) => Promise<void>;
  handleClearHistory: (feedId: string) => Promise<void>;
  loadFeedsAndHistory: () => Promise<void>;
}

export interface AdminCatalogSlice {
  suppliers: Brand[];
  setSuppliers: React.Dispatch<React.SetStateAction<Brand[]>>;
  categories: CategoryNode[];
  setCategories: React.Dispatch<React.SetStateAction<CategoryNode[]>>;
  flatCategories: Array<{
    id: string;
    title: string;
    depth: number;
    node_path: string;
  }>;
  loadSuppliers: () => Promise<void>;
  loadCategories: () => Promise<void>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  totalProductsCount: number;
  setTotalProductsCount: React.Dispatch<React.SetStateAction<number>>;
  loadingProducts: boolean;
  setLoadingProducts: React.Dispatch<React.SetStateAction<boolean>>;
  loadProducts: (params?: AdminProductFilterParams) => Promise<void>;
  activateSupplierProducts: (brandId: string) => Promise<BulkProductActionResult>;
  deactivateSupplierProducts: (brandId: string) => Promise<BulkProductActionResult>;
  deleteSupplierProducts: (
    brandId: string,
    deleteImages: boolean
  ) => Promise<BulkProductActionResult>;
  bulkProductAction: (
    action: BulkProductActionType,
    productIds: string[],
    deleteImages?: boolean
  ) => Promise<BulkProductActionResult>;
}

export interface AdminSettingsSlice {
  storeSettings: StoreSettingsData;
  setStoreSettings: React.Dispatch<React.SetStateAction<StoreSettingsData>>;
  loadingSettings: boolean;
  savingSettings: boolean;
  settingsError: string;
  settingsSuccess: boolean;
  handleUpdateSettings: (e: React.FormEvent) => Promise<void>;
  loadStoreSettings: () => Promise<void>;
}

export interface AdminContextType
  extends AdminAuthSlice,
    AdminShellSlice,
    AdminFeedsSlice,
    AdminCatalogSlice,
    AdminSettingsSlice {}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const apiUrl = useMemo(() => AdminApiService.resolveDefaultApiUrl(), []);

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);
  const [dbStatus, setDbStatus] = useState<
    "connected" | "disconnected" | "checking"
  >("checking");

  const sessionBootstrapService = useMemo(
    () => new AdminApiService(new FetchHttpClient({ baseUrl: apiUrl })),
    [apiUrl]
  );

  const clearLocalSession = useCallback(() => {
    setToken(null);
    setUser(null);
    sessionBootstrapService.clearSession();
  }, [sessionBootstrapService]);

  const handleLogout = useCallback(() => {
    if (typeof window !== "undefined") {
      const logoutUrl = sessionBootstrapService.buildKeycloakLogoutUrl(
        normalizeCanonicalAdminUrl(`${window.location.origin}/admin`)
      );
      clearLocalSession();
      window.location.href = logoutUrl;
      return;
    }
    clearLocalSession();
  }, [sessionBootstrapService, clearLocalSession]);

  const { httpClient, adminService } = useMemo(() => {
    const client = new FetchHttpClient({
      baseUrl: apiUrl,
      authStrategy: new BearerTokenHeaderStrategy(() => token),
      onUnauthorized: clearLocalSession,
    });
    return {
      httpClient: client,
      adminService: new AdminApiService(client),
    };
  }, [apiUrl, token, clearLocalSession]);

  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    sessionBootstrapService.saveTheme("light");
  }, [sessionBootstrapService]);

  const setTheme = useCallback(
    () => {
      setThemeState("light");
      sessionBootstrapService.saveTheme("light");
    },
    [sessionBootstrapService]
  );

  const toggleTheme = useCallback(() => {
    setThemeState("light");
    sessionBootstrapService.saveTheme("light");
  }, [sessionBootstrapService]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const login = useCallback(
    (newToken: string, newUser: UserInfo, idToken?: string) => {
      setAuthError(null);
      setToken(newToken);
      setUser(newUser);
      sessionBootstrapService.saveSession(newToken, newUser, idToken);
    },
    [sessionBootstrapService]
  );

  const fetchWithConfig = useCallback(
    (path: string, options?: RequestInit) => httpClient.rawFetch(path, options),
    [httpClient]
  );

  const [feeds, setFeeds] = useState<XmlFeed[]>([]);
  const [syncHistory, setSyncHistory] = useState<Record<string, SyncRun[]>>({});
  const [suppliers, setSuppliers] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeSyncing, setActiveSyncing] = useState<Record<string, string>>(
    {}
  );

  const [storeSettings, setStoreSettings] = useState<StoreSettingsData>({
    address: "",
    phone: "",
    whatsapp: "",
    email: "",
    show_single_price: false,
    show_prices_to_guests: false,
    recaptcha_enabled: true,
    recaptcha_site_key: "",
    recaptcha_secret_key: "",
    recaptcha_has_secret: false,
    clear_recaptcha_secret: false,
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const flatCategories = useMemo(
    () => getFlatCategoriesList(categories),
    [categories]
  );

  useEffect(() => {
    const initSession = async () => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        setIsInitialized(false);
        try {
          const redirectUri = normalizeCanonicalAdminUrl(
            `${window.location.origin}/admin`
          );
          const data = await sessionBootstrapService.exchangeKeycloakCode(
            code,
            redirectUri
          );
          login(data.token, data.user, data.id_token);
        } catch (err: unknown) {
          console.error("Keycloak OIDC callback error:", err);
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Kurumsal kimlik doğrulama tamamlanamadı. Lütfen tekrar deneyin.";
          setAuthError(message);
          clearLocalSession();
        } finally {
          params.delete("code");
          params.delete("session_state");
          params.delete("iss");
          const newSearch = params.toString();
          const newUrl =
            window.location.pathname + (newSearch ? `?${newSearch}` : "");
          window.history.replaceState({}, "", newUrl);
          setIsInitialized(true);
        }
      } else {
        const saved = sessionBootstrapService.readSavedSession();
        if (saved) {
          setToken(saved.token);
          setUser(saved.user);
        }
        setIsInitialized(true);
      }
    };

    const timer = setTimeout(() => {
      void initSession();
    }, 0);
    return () => clearTimeout(timer);
  }, [sessionBootstrapService, login, clearLocalSession]);

  const loadFeedsAndHistory = useCallback(async () => {
    try {
      const feedList = await adminService.listFeeds();
      setFeeds(feedList);

      const historyMap: Record<string, SyncRun[]> = {};
      await Promise.all(
        feedList.map(async (f) => {
          try {
            historyMap[f.id] = await adminService.listFeedHistory(f.id);
          } catch {
            historyMap[f.id] = [];
          }
        })
      );
      setSyncHistory(historyMap);
    } catch (e) {
      console.error("Feeds loading error:", e);
    }
  }, [adminService]);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await adminService.listCategories());
    } catch (e) {
      console.error("Categories loading error:", e);
    }
  }, [adminService]);

  const loadSuppliers = useCallback(async () => {
    try {
      setSuppliers(await adminService.listSuppliers());
    } catch (e) {
      console.error("Suppliers loading error:", e);
    }
  }, [adminService]);

  const loadProducts = useCallback(
    async (params: AdminProductFilterParams = {}) => {
      setLoadingProducts(true);
      try {
        const page = await adminService.listProducts({
          limit: params.limit ?? 24,
          offset: params.offset ?? 0,
          ...params,
        });
        setProducts(page.products);
        setTotalProductsCount(page.total);
      } catch (e) {
        console.error("Products loading error:", e);
      } finally {
        setLoadingProducts(false);
      }
    },
    [adminService]
  );

  const activateSupplierProducts = useCallback(
    (brandId: string) => adminService.activateSupplierProducts(brandId),
    [adminService]
  );

  const deactivateSupplierProducts = useCallback(
    (brandId: string) => adminService.deactivateSupplierProducts(brandId),
    [adminService]
  );

  const deleteSupplierProducts = useCallback(
    (brandId: string, deleteImages: boolean) =>
      adminService.deleteSupplierProducts(brandId, deleteImages),
    [adminService]
  );

  const bulkProductAction = useCallback(
    (action: BulkProductActionType, productIds: string[], deleteImages = false) =>
      adminService.bulkProductAction(action, productIds, deleteImages),
    [adminService]
  );

  const loadStoreSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      setStoreSettings(await adminService.getStoreSettings());
    } catch (e) {
      console.error("Settings loading error:", e);
    } finally {
      setLoadingSettings(false);
    }
  }, [adminService]);

  const handleUpdateSettings = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingSettings(true);
      setSettingsError("");
      setSettingsSuccess(false);

      try {
        const savedSettings = await adminService.updateStoreSettings(storeSettings);
        setStoreSettings(savedSettings);
        invalidateStoreSettingsCache();
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "merter_show_prices_to_guests",
            storeSettings.show_prices_to_guests ? "1" : "0"
          );
          localStorage.setItem("merter_settings_updated_at", String(Date.now()));
          window.dispatchEvent(new Event("auth-change"));
          window.dispatchEvent(new Event("store-settings-updated"));
        }
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 4000);
      } catch (err: unknown) {
        setSettingsError(
          err instanceof Error
            ? err.message
            : "Beklenmedik bir hata oluştu."
        );
      } finally {
        setSavingSettings(false);
      }
    },
    [adminService, storeSettings]
  );

  const triggerSync = useCallback(
    async (feedId: string) => {
      try {
        const runId = await adminService.triggerSync(feedId);
        setActiveSyncing((prev) => ({ ...prev, [feedId]: runId }));
        void loadFeedsAndHistory();
      } catch (e) {
        console.error("Sync trigger error:", e);
      }
    },
    [adminService, loadFeedsAndHistory]
  );

  const cancelSync = useCallback(
    async (feedId: string) => {
      try {
        const ok = await adminService.cancelSync(feedId);
        if (ok) {
          setActiveSyncing((prev) => {
            const next = { ...prev };
            delete next[feedId];
            return next;
          });
          void loadFeedsAndHistory();
        }
      } catch (e) {
        console.error("Sync cancel error:", e);
      }
    },
    [adminService, loadFeedsAndHistory]
  );

  const handleClearHistory = useCallback(
    async (feedId: string) => {
      try {
        const ok = await adminService.clearFeedHistory(feedId);
        if (ok) {
          setSyncHistory((prev) => ({ ...prev, [feedId]: [] }));
        }
      } catch (e) {
        console.error("Clear history error:", e);
      }
    },
    [adminService]
  );

  useEffect(() => {
    if (!token) return;

    const timer = setTimeout(() => {
      void adminService
        .checkHealth()
        .then((healthy) => setDbStatus(healthy ? "connected" : "disconnected"));
      void loadFeedsAndHistory();
      void loadSuppliers();
      void loadCategories();
    }, 0);
    return () => clearTimeout(timer);
  }, [token, adminService, loadFeedsAndHistory, loadSuppliers, loadCategories]);

  const value = useMemo<AdminContextType>(
    () => ({
      apiUrl,
      token,
      user,
      authError,
      clearAuthError,
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
      activateSupplierProducts,
      deactivateSupplierProducts,
      deleteSupplierProducts,
      bulkProductAction,
      storeSettings,
      setStoreSettings,
      loadingSettings,
      savingSettings,
      settingsError,
      settingsSuccess,
      handleUpdateSettings,
      loadStoreSettings,
      theme,
      setTheme,
      toggleTheme,
    }),
    [
      apiUrl,
      token,
      user,
      authError,
      clearAuthError,
      isInitialized,
      dbStatus,
      login,
      handleLogout,
      fetchWithConfig,
      sidebarCollapsed,
      mobileSidebarOpen,
      toggleSidebar,
      theme,
      setTheme,
      toggleTheme,
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
      activateSupplierProducts,
      deactivateSupplierProducts,
      deleteSupplierProducts,
      bulkProductAction,
      storeSettings,
      loadingSettings,
      savingSettings,
      settingsError,
      settingsSuccess,
      handleUpdateSettings,
      loadStoreSettings,
    ]
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextType {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}

// ============================================================================
// SEGREGATED DOMAIN HOOKS (ISP)
// ============================================================================

export function useAdminAuth(): AdminAuthSlice {
  const ctx = useAdmin();
  return {
    apiUrl: ctx.apiUrl,
    token: ctx.token,
    user: ctx.user,
    authError: ctx.authError,
    clearAuthError: ctx.clearAuthError,
    isInitialized: ctx.isInitialized,
    dbStatus: ctx.dbStatus,
    login: ctx.login,
    handleLogout: ctx.handleLogout,
    fetchWithConfig: ctx.fetchWithConfig,
  };
}

export function useAdminShell(): AdminShellSlice {
  const ctx = useAdmin();
  return {
    sidebarCollapsed: ctx.sidebarCollapsed,
    setSidebarCollapsed: ctx.setSidebarCollapsed,
    mobileSidebarOpen: ctx.mobileSidebarOpen,
    setMobileSidebarOpen: ctx.setMobileSidebarOpen,
    toggleSidebar: ctx.toggleSidebar,
    theme: ctx.theme,
    setTheme: ctx.setTheme,
    toggleTheme: ctx.toggleTheme,
  };
}

export function useAdminFeeds(): AdminFeedsSlice {
  const ctx = useAdmin();
  return {
    feeds: ctx.feeds,
    setFeeds: ctx.setFeeds,
    syncHistory: ctx.syncHistory,
    setSyncHistory: ctx.setSyncHistory,
    activeSyncing: ctx.activeSyncing,
    triggerSync: ctx.triggerSync,
    cancelSync: ctx.cancelSync,
    handleClearHistory: ctx.handleClearHistory,
    loadFeedsAndHistory: ctx.loadFeedsAndHistory,
  };
}

export function useAdminCatalog(): AdminCatalogSlice {
  const ctx = useAdmin();
  return {
    suppliers: ctx.suppliers,
    setSuppliers: ctx.setSuppliers,
    categories: ctx.categories,
    setCategories: ctx.setCategories,
    flatCategories: ctx.flatCategories,
    loadSuppliers: ctx.loadSuppliers,
    loadCategories: ctx.loadCategories,
    products: ctx.products,
    setProducts: ctx.setProducts,
    totalProductsCount: ctx.totalProductsCount,
    setTotalProductsCount: ctx.setTotalProductsCount,
    loadingProducts: ctx.loadingProducts,
    setLoadingProducts: ctx.setLoadingProducts,
    loadProducts: ctx.loadProducts,
    activateSupplierProducts: ctx.activateSupplierProducts,
    deactivateSupplierProducts: ctx.deactivateSupplierProducts,
    deleteSupplierProducts: ctx.deleteSupplierProducts,
    bulkProductAction: ctx.bulkProductAction,
  };
}

export function useAdminStoreSettings(): AdminSettingsSlice {
  const ctx = useAdmin();
  return {
    storeSettings: ctx.storeSettings,
    setStoreSettings: ctx.setStoreSettings,
    loadingSettings: ctx.loadingSettings,
    savingSettings: ctx.savingSettings,
    settingsError: ctx.settingsError,
    settingsSuccess: ctx.settingsSuccess,
    handleUpdateSettings: ctx.handleUpdateSettings,
    loadStoreSettings: ctx.loadStoreSettings,
  };
}
