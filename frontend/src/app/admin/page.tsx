"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Database, 
  ShoppingBag, 
  Loader2, 
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  X,
  Wrench,
  LayoutDashboard,
  Globe,
  FileText,
  Languages,
  User,
  Clipboard,
  Clock
} from "lucide-react";

// Types
import { XmlFeed, SyncRun, CategoryNode, Product, UserInfo, Brand } from "@/types/integration";

// Utils
import { getFlatCategoriesList } from "@/utils/formatters";

// Components
import dynamic from "next/dynamic";
import Header from "@/components/admin/layout/Header";
import MetricCards from "@/components/admin/dashboard/MetricCards";
import QuickFeedList from "@/components/admin/dashboard/QuickFeedList";
import ActivityLogs from "@/components/admin/dashboard/ActivityLogs";
import CatalogFilters from "@/components/admin/catalog/CatalogFilters";
import ProductGrid from "@/components/admin/catalog/ProductGrid";
import ProductDetailModal from "@/components/admin/catalog/ProductDetailModal";
import LoginScreen from "@/components/admin/auth/LoginScreen";

const AdminModuleLoader = () => (
  <div className="flex flex-col items-center justify-center p-16 text-zinc-400 gap-3 border border-zinc-200/50 rounded-2xl bg-white/50 backdrop-blur-sm animate-pulse">
    <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-semibold text-zinc-500">Modül hazırlanıyor...</span>
  </div>
);

const SuppliersManager = dynamic(() => import("@/components/admin/integrations/SuppliersManager"), { loading: AdminModuleLoader });
const CategoryTreeEditor = dynamic(() => import("@/components/admin/catalog/CategoryTreeEditor"), { loading: AdminModuleLoader });
const GeographyManager = dynamic(() => import("@/components/admin/geography/GeographyManager"), { loading: AdminModuleLoader });
const PoliciesManager = dynamic(() => import("@/components/admin/policies/PoliciesManager"), { loading: AdminModuleLoader });
const TranslationManager = dynamic(() => import("@/components/admin/translate/TranslationManager"), { loading: AdminModuleLoader });
const CustomersManager = dynamic(() => import("@/components/admin/customers/CustomersManager"), { loading: AdminModuleLoader });
const PagesManager = dynamic(() => import("@/components/admin/pages/PagesManager"), { loading: AdminModuleLoader });
const ImageCacheManager = dynamic(() => import("@/components/admin/catalog/ImageCacheManager"), { loading: AdminModuleLoader });
const BlogManager = dynamic(() => import("@/components/admin/catalog/BlogManager"), { loading: AdminModuleLoader });
const IndexNowManager = dynamic(() => import("@/components/admin/catalog/IndexNowManager"), { loading: AdminModuleLoader });
const OrdersManager = dynamic(() => import("@/components/admin/orders/OrdersManager"), { loading: AdminModuleLoader });
const CronManager = dynamic(() => import("@/components/admin/cron/CronManager"), { loading: AdminModuleLoader });

const LABELS = {
  SUB_TAB_PRODUCTS: "Ürün Listesi",
  SUB_TAB_CATEGORIES: "Kategorileri Yönet",
  TAB_DASHBOARD: "Özet Paneli",
  TAB_INTEGRATIONS: "Tedarikçi & XML Entegrasyon Yönetimi",
  TAB_CATALOG: "Ürün & Kategori Kataloğu",
  TAB_SETTINGS: "Mağaza İletişim Ayarları",
  TAB_GEOGRAPHY: "Coğrafi Tanımlar (Ülke & Şehir)",
  TAB_POLICIES: "Sözleşme & Hukuki Metinler",
  TAB_TRANSLATE: "Yapay Zeka Otomatik Çeviri",
  TAB_CUSTOMERS: "Müşteri & Bayi Yönetimi",
  TAB_PAGES: "Dinamik Sayfalar (CMS)",
  TAB_ORDERS: "B2B Siparişleri",
  SETTINGS_TITLE: "Mağaza İletişim & Lokasyon Ayarları",
  SETTINGS_SUBTITLE: "Footer, iletişim sayfası ve mobil barda ziyaretçilere gösterilen kurumsal bilgiler.",
  SETTINGS_LOADING: "Ayar verileri yükleniyor...",
  SETTINGS_ADDRESS: "Showroom / Mağaza Adresi",
  SETTINGS_PHONE: "Müşteri Hizmetleri Telefonu",
  SETTINGS_WHATSAPP: "WhatsApp Sipariş Hattı",
  SETTINGS_EMAIL: "Kurumsal E-Posta Adresi",
  SETTINGS_SAVE: "Ayarları Kaydet",
  SETTINGS_SAVING: "Kaydediliyor...",
  SETTINGS_SUCCESS: "Mağaza bilgileri başarıyla güncellendi!",
  SIDEBAR_MV: "MV",
  SIDEBAR_BRAND: "Merter Vitrini",
  SIDEBAR_KATALOG_HEADER: "Yönetim Menüsü",
  SIDEBAR_DASHBOARD: "Özet Paneli",
  SIDEBAR_INTEGRATIONS_HEADER: "Entegrasyonlar",
  SIDEBAR_INTEGRATIONS_SUB: "Tedarikçi & XML",
  SIDEBAR_CATALOG_HEADER: "Katalog",
  SIDEBAR_CATALOG_PRODUCTS: "Ürün Listesi",
  SIDEBAR_CATALOG_CATEGORIES: "Kategoriler",
  SIDEBAR_CATALOG_IMAGES: "Görsel Önbellek",
  SIDEBAR_CATALOG_BLOG: "Blog Yönetimi",
  SIDEBAR_SETTINGS_HEADER: "Site Ayarları",
  SIDEBAR_SETTINGS_FOOTER: "Mağaza Ayarları",
  SIDEBAR_GEOGRAPHY_HEADER: "Coğrafi Tanımlar",
  SIDEBAR_GEOGRAPHY_SUB: "Ülkeler & Şehirler",
  SIDEBAR_POLICIES_HEADER: "Sözleşmeler",
  SIDEBAR_POLICIES_SUB: "Hukuki Metinler",
  SIDEBAR_TRANSLATE_HEADER: "Otomatik Çeviri",
  SIDEBAR_TRANSLATE_SUB: "LibreTranslate",
  SIDEBAR_CUSTOMERS_HEADER: "Müşteriler",
  SIDEBAR_CUSTOMERS_SUB: "Müşteri Listesi",
  SIDEBAR_PAGES_HEADER: "Sayfa Yönetimi",
  SIDEBAR_PAGES_SUB: "Dinamik Sayfalar"
};

type TabType = "dashboard" | "integrations" | "catalog" | "settings" | "geography" | "policies" | "translate" | "customers" | "pages" | "image-cache" | "blog" | "indexnow" | "orders" | "cron";
type SubTabType = "products" | "categories";

const VALID_TABS: readonly TabType[] = [
  "dashboard", "integrations", "catalog", "settings", "geography", "policies",
  "translate", "customers", "pages", "image-cache", "blog", "indexnow", "orders", "cron"
] as const;

const VALID_SUBTABS: readonly SubTabType[] = ["products", "categories"] as const;

// ----------------- SIDEBAR COMPONENT -----------------
interface AdminSidebarProps {
  readonly sidebarOpen: boolean;
  readonly setSidebarOpen: (open: boolean) => void;
  readonly activeTab: TabType;
  readonly catalogSubTab: SubTabType;
  readonly expandedGroups: Record<string, boolean>;
  readonly toggleGroup: (group: string) => void;
  readonly updateNavigation: (tab: TabType, subtab?: SubTabType) => void;
  readonly user: UserInfo | null;
}

interface NavGroupProps {
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}

function NavGroup({
  label,
  icon,
  isExpanded,
  onToggle,
  children
}: NavGroupProps) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {icon}
          {label}
        </div>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {isExpanded && (
        <div className="pl-6 pr-2 py-1 flex flex-col gap-1 border-l border-zinc-800 ml-5 mt-1 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

interface NavSubItemProps {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon?: React.ReactNode;
}

function NavSubItem({ label, active, onClick, icon }: NavSubItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
        active
          ? "bg-violet-500/10 text-violet-400 font-extrabold border-l-2 border-violet-500 pl-3"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function UserCard({ user }: { readonly user: UserInfo }) {
  return (
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
  );
}

function AdminSidebar({
  sidebarOpen,
  setSidebarOpen,
  activeTab,
  catalogSubTab,
  expandedGroups,
  toggleGroup,
  updateNavigation,
  user
}: AdminSidebarProps) {
  return (
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
          aria-label="Menüyü kapat"
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
            type="button"
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
          <NavGroup
            label={LABELS.SIDEBAR_INTEGRATIONS_HEADER}
            icon={<Database size={16} />}
            isExpanded={Boolean(expandedGroups.integrations)}
            onToggle={() => toggleGroup("integrations")}
          >
            <NavSubItem
              label={LABELS.SIDEBAR_INTEGRATIONS_SUB}
              active={activeTab === "integrations"}
              onClick={() => {
                updateNavigation("integrations");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Accordion Group 2: Katalog */}
          <NavGroup
            label={LABELS.SIDEBAR_CATALOG_HEADER}
            icon={<ShoppingBag size={16} />}
            isExpanded={Boolean(expandedGroups.catalog)}
            onToggle={() => toggleGroup("catalog")}
          >
            <NavSubItem
              label={LABELS.SIDEBAR_CATALOG_PRODUCTS}
              active={activeTab === "catalog" && catalogSubTab === "products"}
              onClick={() => {
                updateNavigation("catalog", "products");
                setSidebarOpen(false);
              }}
            />
            <NavSubItem
              label={LABELS.SIDEBAR_CATALOG_CATEGORIES}
              active={activeTab === "catalog" && catalogSubTab === "categories"}
              onClick={() => {
                updateNavigation("catalog", "categories");
                setSidebarOpen(false);
              }}
            />
            <NavSubItem
              label={LABELS.SIDEBAR_CATALOG_IMAGES}
              active={activeTab === "image-cache"}
              onClick={() => {
                updateNavigation("image-cache");
                setSidebarOpen(false);
              }}
            />
            <NavSubItem
              label={LABELS.SIDEBAR_CATALOG_BLOG}
              active={activeTab === "blog"}
              onClick={() => {
                updateNavigation("blog");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Accordion Group 3: Site Ayarları */}
          <NavGroup
            label={LABELS.SIDEBAR_SETTINGS_HEADER}
            icon={<Wrench size={16} />}
            isExpanded={Boolean(expandedGroups.settings)}
            onToggle={() => toggleGroup("settings")}
          >
            <NavSubItem
              label={LABELS.SIDEBAR_SETTINGS_FOOTER}
              active={activeTab === "settings"}
              onClick={() => {
                updateNavigation("settings");
                setSidebarOpen(false);
              }}
            />
            <NavSubItem
              label="IndexNow Gönderimi"
              active={activeTab === "indexnow"}
              onClick={() => {
                updateNavigation("indexnow");
                setSidebarOpen(false);
              }}
            />
            <NavSubItem
              label="Zamanlanmış Görevler"
              icon={<Clock size={12} />}
              active={activeTab === "cron"}
              onClick={() => {
                updateNavigation("cron");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Accordion Group 4: Coğrafi Tanımlar */}
          <NavGroup
            label={LABELS.SIDEBAR_GEOGRAPHY_HEADER}
            icon={<Globe size={16} />}
            isExpanded={Boolean(expandedGroups.geography)}
            onToggle={() => toggleGroup("geography")}
          >
            <NavSubItem
              label={LABELS.SIDEBAR_GEOGRAPHY_SUB}
              active={activeTab === "geography"}
              onClick={() => {
                updateNavigation("geography");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Accordion Group 5: Sözleşme & Politikalar */}
          <NavGroup
            label={LABELS.SIDEBAR_POLICIES_HEADER}
            icon={<FileText size={16} />}
            isExpanded={Boolean(expandedGroups.policies)}
            onToggle={() => toggleGroup("policies")}
          >
            <NavSubItem
              label={LABELS.SIDEBAR_POLICIES_SUB}
              active={activeTab === "policies"}
              onClick={() => {
                updateNavigation("policies");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Accordion Group 6: Yapay Zeka Çeviri */}
          <NavGroup
            label={LABELS.SIDEBAR_TRANSLATE_HEADER}
            icon={<Languages size={16} />}
            isExpanded={Boolean(expandedGroups.translate)}
            onToggle={() => toggleGroup("translate")}
          >
            <NavSubItem
              label={LABELS.SIDEBAR_TRANSLATE_SUB}
              active={activeTab === "translate"}
              onClick={() => {
                updateNavigation("translate");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Accordion Group 7: Müşteri Listesi */}
          <NavGroup
            label={LABELS.SIDEBAR_CUSTOMERS_HEADER}
            icon={<User size={16} />}
            isExpanded={Boolean(expandedGroups.customers)}
            onToggle={() => toggleGroup("customers")}
          >
            <NavSubItem
              label={LABELS.SIDEBAR_CUSTOMERS_SUB}
              active={activeTab === "customers"}
              onClick={() => {
                updateNavigation("customers");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Accordion Group 8: Sayfa Yönetimi */}
          <NavGroup
            label={LABELS.SIDEBAR_PAGES_HEADER}
            icon={<FileText size={16} />}
            isExpanded={Boolean(expandedGroups.pages)}
            onToggle={() => toggleGroup("pages")}
          >
            <NavSubItem
              label={LABELS.SIDEBAR_PAGES_SUB}
              active={activeTab === "pages"}
              onClick={() => {
                updateNavigation("pages");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Accordion Group 9: Sipariş Yönetimi */}
          <NavGroup
            label="Sipariş Yönetimi"
            icon={<Clipboard size={16} />}
            isExpanded={Boolean(expandedGroups.orders)}
            onToggle={() => toggleGroup("orders")}
          >
            <NavSubItem
              label="B2B Siparişleri"
              active={activeTab === "orders"}
              onClick={() => {
                updateNavigation("orders");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>
        </div>
      </nav>

      {/* User Card at Bottom of Sidebar */}
      {user && <UserCard user={user} />}
    </aside>
  );
}

// ----------------- SITE SETTINGS TAB COMPONENT -----------------
interface SiteSettingsTabProps {
  readonly storeSettings: {
    address: string;
    phone: string;
    whatsapp: string;
    email: string;
    show_single_price: boolean;
  };
  readonly setStoreSettings: React.Dispatch<React.SetStateAction<{
    address: string;
    phone: string;
    whatsapp: string;
    email: string;
    show_single_price: boolean;
  }>>;
  readonly loadingSettings: boolean;
  readonly savingSettings: boolean;
  readonly settingsError: string;
  readonly settingsSuccess: boolean;
  readonly handleUpdateSettings: (e: React.FormEvent) => Promise<void>;
}

function SiteSettingsTab({
  storeSettings,
  setStoreSettings,
  loadingSettings,
  savingSettings,
  settingsError,
  settingsSuccess,
  handleUpdateSettings
}: SiteSettingsTabProps) {
  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-8 animate-in fade-in duration-200">
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
  );
}

// ----------------- TAB CONTENT CONTAINER COMPONENT -----------------
interface AdminTabContentProps {
  readonly activeTab: TabType;
  readonly feeds: XmlFeed[];
  readonly totalProductsCount: number;
  readonly flatCategories: ReturnType<typeof getFlatCategoriesList>;
  readonly activeSyncing: Record<string, string>;
  readonly loadingProducts: boolean;
  readonly syncHistory: Record<string, SyncRun[]>;
  readonly triggerSync: (feedId: string) => Promise<void>;
  readonly cancelSync: (feedId: string) => Promise<void>;
  readonly updateNavigation: (tab: TabType, subtab?: SubTabType) => void;
  readonly handleClearHistory: () => Promise<void>;
  readonly suppliers: Brand[];
  readonly categories: CategoryNode[];
  readonly loadSuppliers: () => Promise<void>;
  readonly apiUrl: string;
  readonly token: string;
  readonly catalogSubTab: SubTabType;
  readonly updateCatalogSubTab: (subtab: SubTabType) => void;
  readonly searchQuery: string;
  readonly setSearchQuery: (q: string) => void;
  readonly selectedCategory: string;
  readonly setSelectedCategory: (c: string) => void;
  readonly handleResetFilters: () => void;
  readonly products: Product[];
  readonly limit: number;
  readonly offset: number;
  readonly setOffset: React.Dispatch<React.SetStateAction<number>>;
  readonly viewProductDetails: (id: string) => Promise<void>;
  readonly loadCategories: () => Promise<void>;
  readonly storeSettings: {
    address: string;
    phone: string;
    whatsapp: string;
    email: string;
    show_single_price: boolean;
  };
  readonly setStoreSettings: React.Dispatch<React.SetStateAction<{
    address: string;
    phone: string;
    whatsapp: string;
    email: string;
    show_single_price: boolean;
  }>>;
  readonly loadingSettings: boolean;
  readonly savingSettings: boolean;
  readonly settingsError: string;
  readonly settingsSuccess: boolean;
  readonly handleUpdateSettings: (e: React.FormEvent) => Promise<void>;
}

function AdminTabContent(props: AdminTabContentProps) {
  switch (props.activeTab) {
    case "dashboard":
      return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <MetricCards 
            feedsCount={props.feeds.length}
            productsCount={props.totalProductsCount}
            categoriesCount={props.flatCategories.length}
            activeSyncingCount={Object.keys(props.activeSyncing).length}
            loadingProducts={props.loadingProducts}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <QuickFeedList 
              feeds={props.feeds}
              syncHistory={props.syncHistory}
              activeSyncing={props.activeSyncing}
              triggerSync={props.triggerSync}
              cancelSync={props.cancelSync}
              onNavigateToIntegrations={() => props.updateNavigation("integrations")}
            />
            <ActivityLogs 
              feeds={props.feeds}
              syncHistory={props.syncHistory}
              onClearHistory={props.handleClearHistory}
            />
          </div>
        </div>
      );
    case "integrations":
      return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <SuppliersManager 
            suppliers={props.suppliers}
            categories={props.categories}
            onRefresh={props.loadSuppliers}
            apiUrl={props.apiUrl}
            token={props.token}
            activeSyncing={props.activeSyncing}
            triggerSync={props.triggerSync}
          />
        </div>
      );
    case "catalog":
      return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex border-b border-zinc-200/40 gap-6 pb-2">
            <button 
              type="button"
              onClick={() => props.updateCatalogSubTab("products")}
              className={`pb-2 text-sm font-bold transition-all relative cursor-pointer ${
                props.catalogSubTab === "products" 
                  ? "text-violet-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-violet-600" 
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {LABELS.SUB_TAB_PRODUCTS}
            </button>
            <button 
              type="button"
              onClick={() => props.updateCatalogSubTab("categories")}
              className={`pb-2 text-sm font-bold transition-all relative cursor-pointer ${
                props.catalogSubTab === "categories" 
                  ? "text-violet-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-violet-600" 
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {LABELS.SUB_TAB_CATEGORIES}
            </button>
          </div>

          {props.catalogSubTab === "products" ? (
            <>
              <CatalogFilters 
                searchQuery={props.searchQuery}
                setSearchQuery={props.setSearchQuery}
                selectedCategory={props.selectedCategory}
                setSelectedCategory={props.setSelectedCategory}
                flatCategories={props.flatCategories}
                onReset={props.handleResetFilters}
              />
              <ProductGrid 
                products={props.products}
                feeds={props.feeds}
                loadingProducts={props.loadingProducts}
                limit={props.limit}
                offset={props.offset}
                setOffset={props.setOffset}
                onViewDetails={props.viewProductDetails}
              />
            </>
          ) : (
            <CategoryTreeEditor 
              categories={props.categories}
              onRefresh={props.loadCategories}
              apiUrl={props.apiUrl}
              token={props.token}
            />
          )}
        </div>
      );
    case "settings":
      return (
        <SiteSettingsTab 
          storeSettings={props.storeSettings}
          setStoreSettings={props.setStoreSettings}
          loadingSettings={props.loadingSettings}
          savingSettings={props.savingSettings}
          settingsError={props.settingsError}
          settingsSuccess={props.settingsSuccess}
          handleUpdateSettings={props.handleUpdateSettings}
        />
      );
    case "image-cache":
      return <ImageCacheManager apiUrl={props.apiUrl} token={props.token} />;
    case "blog":
      return <BlogManager apiUrl={props.apiUrl} token={props.token} />;
    case "indexnow":
      return <IndexNowManager apiUrl={props.apiUrl} token={props.token} />;
    case "cron":
      return <CronManager apiUrl={props.apiUrl} token={props.token} />;
    case "geography":
      return <GeographyManager apiUrl={props.apiUrl} token={props.token} />;
    case "policies":
      return <PoliciesManager apiUrl={props.apiUrl} token={props.token} />;
    case "translate":
      return <TranslationManager apiUrl={props.apiUrl} token={props.token} />;
    case "customers":
      return <CustomersManager apiUrl={props.apiUrl} token={props.token} />;
    case "pages":
      return <PagesManager apiUrl={props.apiUrl} token={props.token} />;
    case "orders":
      return <OrdersManager apiUrl={props.apiUrl} token={props.token} />;
    default:
      return null;
  }
}

// ----------------- MAIN ADMIN PAGE -----------------
export default function Home() {
  // Authentication State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [catalogSubTab, setCatalogSubTab] = useState<SubTabType>("products");
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
    pages: true,
    orders: true
  });

  const updateNavigation = (tab: TabType, subtab?: SubTabType) => {
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

  const updateCatalogSubTab = (subtab: SubTabType) => {
    setCatalogSubTab(subtab);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "catalog");
      params.set("subtab", subtab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
    }
  };

  // Sync state with URL search params on mount (avoiding synchronous setState in effect)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get("tab") as TabType | null;
        const urlSubTab = params.get("subtab") as SubTabType | null;
        
        if (urlTab && VALID_TABS.includes(urlTab)) {
          setActiveTab(urlTab);
        }
        if (urlSubTab && VALID_SUBTABS.includes(urlSubTab)) {
          setCatalogSubTab(urlSubTab);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Handle browser back and forward button clicks
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get("tab") as TabType | null;
        const urlSubTab = params.get("subtab") as SubTabType | null;
        
        if (urlTab && VALID_TABS.includes(urlTab)) {
          setActiveTab(urlTab);
        }
        if (urlSubTab && VALID_SUBTABS.includes(urlSubTab)) {
          setCatalogSubTab(urlSubTab);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
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

  // Default API URL (Server-side Next.js rewrites or direct port 8080 backend access)
  const [apiUrl, setApiUrl] = useState(() => {
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

  // Core Data State
  const [feeds, setFeeds] = useState<XmlFeed[]>([]);
  const [syncHistory, setSyncHistory] = useState<Record<string, SyncRun[]>>({});
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [suppliers, setSuppliers] = useState<Brand[]>([]);
  
  // Catalog Filter/Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [limit] = useState(24);
  const [offset, setOffset] = useState(0);

  // UI Interactive States
  const [activeSyncing, setActiveSyncing] = useState<Record<string, string>>({}); // feed_id -> sync_run_id
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [dbStatus, setDbStatus] = useState<"connected" | "disconnected" | "checking">("checking");

  // Load saved session and handle Keycloak OIDC Callback on mount
  useEffect(() => {
    const initSession = async () => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        setIsInitialized(false);
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
          setToken(data.token);
          setUser(data.user);
          localStorage.setItem("admin_token", data.token);
          localStorage.setItem("admin_user", JSON.stringify(data.user));

          params.delete("code");
          const newSearch = params.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
          window.history.replaceState({}, "", newUrl);
        } catch (err: unknown) {
          console.error("Keycloak OIDC callback error:", err);
          alert((err as Error).message || "Oturum doğrulanırken bir hata oluştu.");
          setToken(null);
          setUser(null);
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_user");
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
  }, [apiUrl]);

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
    try {
      const res = await fetchWithConfig("/api/v1/feeds");
      const data = await res.json();
      setFeeds(data || []);
      
      if (data && data.length > 0) {
        data.forEach((feed: XmlFeed) => {
          void loadSyncHistory(feed.id);
        });
      }
    } catch (err) {
      console.error("Failed to load xml feeds", err);
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
    try {
      const res = await fetchWithConfig("/api/v1/suppliers");
      const data = await res.json();
      setSuppliers(data || []);
    } catch (err) {
      console.error("Failed to load suppliers", err);
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
      setActiveSyncing(prev => {
        const next = { ...prev };
        Reflect.deleteProperty(next, safeFeedId);
        return next;
      });
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
      void loadFeeds();
    } catch (err) {
      console.error("Failed to clear sync history:", err);
    }
  };

  // Poll for Active Sync Progress
  useEffect(() => {
    if (!token) return;
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
            setActiveSyncing(prev => {
              const updated = { ...prev };
              Reflect.deleteProperty(updated, safeFeedId);
              return updated;
            });
            if (activeTab === "catalog" || activeTab === "dashboard") {
              void loadProducts();
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
      void checkDbConnection();
      void loadFeeds();
      void loadCategories();
      void loadSuppliers();
      void loadSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, [checkDbConnection, loadFeeds, loadCategories, loadSuppliers, loadSettings, token]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProducts, token]);

  // Trigger public DB connection check even before login
  useEffect(() => {
    const timer = setTimeout(() => {
      void checkDbConnection();
    }, 0);
    return () => clearTimeout(timer);
  }, [checkDbConnection]);

  // Flat Categories list helper for filters
  const flatCategories = getFlatCategoriesList(categories);

  const applySettingsAndRefresh = () => {
    void checkDbConnection();
    if (token) {
      void loadFeeds();
      void loadCategories();
      void loadSuppliers();
      void loadProducts();
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
      <main className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 size={36} className="text-violet-500 animate-spin" />
      </main>
    );
  }

  // 2. Unauthenticated State -> Render beautiful Login Screen
  if (!token) {
    return (
      <LoginScreen />
    );
  }

  // 3. Authenticated State -> Render Full Dashboard
  return (
    <div className="flex min-h-screen bg-zinc-50/60 text-zinc-900 antialiased font-sans">
      
      {/* Sidebar overlay backdrop for mobile view */}
      {sidebarOpen && (
        <button 
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-xs lg:hidden animate-in fade-in duration-200 cursor-default border-none p-0"
        />
      )}

      {/* Extracted Sidebar */}
      <AdminSidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeTab={activeTab}
        catalogSubTab={catalogSubTab}
        expandedGroups={expandedGroups}
        toggleGroup={toggleGroup}
        updateNavigation={updateNavigation}
        user={user}
      />

      {/* Right Column Content Area */}
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
          <AdminTabContent 
            activeTab={activeTab}
            feeds={feeds}
            totalProductsCount={totalProductsCount}
            flatCategories={flatCategories}
            activeSyncing={activeSyncing}
            loadingProducts={loadingProducts}
            syncHistory={syncHistory}
            triggerSync={triggerSync}
            cancelSync={cancelSync}
            updateNavigation={updateNavigation}
            handleClearHistory={handleClearHistory}
            suppliers={suppliers}
            categories={categories}
            loadSuppliers={loadSuppliers}
            apiUrl={apiUrl}
            token={token}
            catalogSubTab={catalogSubTab}
            updateCatalogSubTab={updateCatalogSubTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            handleResetFilters={handleResetFilters}
            products={products}
            limit={limit}
            offset={offset}
            setOffset={setOffset}
            viewProductDetails={viewProductDetails}
            loadCategories={loadCategories}
            storeSettings={storeSettings}
            setStoreSettings={setStoreSettings}
            loadingSettings={loadingSettings}
            savingSettings={savingSettings}
            settingsError={settingsError}
            settingsSuccess={settingsSuccess}
            handleUpdateSettings={handleUpdateSettings}
          />
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
