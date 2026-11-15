import {
  Brand,
  CategoryNode,
  Product,
  SyncRun,
  UserInfo,
  XmlFeed,
} from "@/types/integration";
import { IHttpClient } from "./http-client";

export interface StoreSettingsDTO {
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  show_single_price: boolean;
  show_prices_to_guests: boolean;
  recaptcha_enabled: boolean;
  recaptcha_site_key: string;
  recaptcha_secret_key?: string;
  recaptcha_has_secret?: boolean;
  clear_recaptcha_secret?: boolean;
}

export interface AdminProductsPage {
  products: Product[];
  total: number;
}

export interface KeycloakCallbackResult {
  token: string;
  id_token?: string;
  user: UserInfo;
}

export interface IAdminSessionService {
  resolveApiBaseUrl(): string;
  readSavedTheme(): "light" | "dark";
  saveTheme(theme: "light" | "dark"): void;
  readSavedSession(): { token: string; user: UserInfo; idToken?: string } | null;
  readIdToken(): string | null;
  saveSession(token: string, user: UserInfo, idToken?: string): void;
  clearSession(): void;
  buildKeycloakLogoutUrl(postLogoutRedirectUri: string): string;
  exchangeKeycloakCode(code: string, redirectUri: string): Promise<KeycloakCallbackResult>;
  checkHealth(): Promise<boolean>;
}

export interface IAdminFeedService {
  listFeeds(): Promise<XmlFeed[]>;
  listFeedHistory(feedId: string): Promise<SyncRun[]>;
  triggerSync(feedId: string): Promise<string>;
  cancelSync(feedId: string): Promise<boolean>;
  clearFeedHistory(feedId: string): Promise<boolean>;
}

export interface IAdminCatalogService {
  listCategories(): Promise<CategoryNode[]>;
  listSuppliers(): Promise<Brand[]>;
  listProducts(params: {
    limit?: number;
    offset?: number;
    categoryId?: string;
    search?: string;
  }): Promise<AdminProductsPage>;
}

export interface IAdminSettingsService {
  getStoreSettings(): Promise<StoreSettingsDTO>;
  updateStoreSettings(settings: StoreSettingsDTO): Promise<StoreSettingsDTO>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function normalizeCanonicalAdminUrl(url: string): string {
  return url.replace("://www.mertervitrini.com.tr", "://mertervitrini.com.tr");
}

function extractProductsListFromRecord(record: Record<string, unknown>): Product[] {
  if (Array.isArray(record.products)) return record.products as Product[];
  if (Array.isArray(record.items)) return record.items as Product[];
  if (Array.isArray(record.data)) return record.data as Product[];
  return [];
}

function extractTotalFromRecord(record: Record<string, unknown>): number | undefined {
  if (typeof record.total === "number" && Number.isFinite(record.total)) {
    return record.total;
  }
  if (typeof record.total_count === "number" && Number.isFinite(record.total_count)) {
    return record.total_count;
  }
  return undefined;
}

function normalizeProductsPayload(
  payload: unknown,
  headerTotalRaw: string | null,
  limit: number,
  offset: number
): AdminProductsPage {
  let products: Product[] = [];
  let bodyTotal: number | undefined;

  if (Array.isArray(payload)) {
    products = payload as Product[];
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    products = extractProductsListFromRecord(record);
    bodyTotal = extractTotalFromRecord(record);
  }

  const parsedHeader = headerTotalRaw ? Number.parseInt(headerTotalRaw, 10) : Number.NaN;
  if (Number.isFinite(parsedHeader) && parsedHeader >= 0) {
    return { products, total: parsedHeader };
  }

  if (bodyTotal !== undefined) {
    return { products, total: bodyTotal };
  }

  const fallbackTotal =
    products.length > 0
      ? offset + products.length + (products.length >= limit ? 1 : 0)
      : 0;

  return { products, total: fallbackTotal };
}

function normalizeSyncRunsPayload(payload: unknown): SyncRun[] {
  if (Array.isArray(payload)) {
    return payload as SyncRun[];
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.syncs)) return record.syncs as SyncRun[];
    if (Array.isArray(record.items)) return record.items as SyncRun[];
  }
  return [];
}

function normalizeStoreSettingsDTO(data: Partial<StoreSettingsDTO>): StoreSettingsDTO {
  return {
    address: data.address ?? "",
    phone: data.phone ?? "",
    whatsapp: data.whatsapp ?? "",
    email: data.email ?? "",
    show_single_price: Boolean(data.show_single_price),
    show_prices_to_guests: Boolean(data.show_prices_to_guests),
    recaptcha_enabled: data.recaptcha_enabled ?? true,
    recaptcha_site_key: data.recaptcha_site_key ?? "",
    recaptcha_has_secret: Boolean(data.recaptcha_has_secret),
    recaptcha_secret_key: "",
    clear_recaptcha_secret: false,
  };
}

export class AdminApiService
  implements
    IAdminSessionService,
    IAdminFeedService,
    IAdminCatalogService,
    IAdminSettingsService
{
  constructor(private readonly http: IHttpClient) {}

  static resolveDefaultApiUrl(): string {
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
  }

  resolveApiBaseUrl(): string {
    return AdminApiService.resolveDefaultApiUrl();
  }

  readSavedTheme(): "light" | "dark" {
    if (typeof window !== "undefined") {
      localStorage.setItem("merter_admin_theme", "light");
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
    return "light";
  }

  saveTheme(theme: "light" | "dark"): void {
    const normalized: "light" = theme === "dark" ? "light" : "light";
    if (typeof window !== "undefined") {
      localStorage.setItem("merter_admin_theme", normalized);
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }

  readSavedSession(): { token: string; user: UserInfo; idToken?: string } | null {
    if (typeof window === "undefined") {
      return null;
    }
    const savedToken = localStorage.getItem("admin_token");
    const savedUser = localStorage.getItem("admin_user");
    const savedIdToken = localStorage.getItem("admin_id_token") || undefined;
    if (!savedToken || !savedUser) {
      return null;
    }
    try {
      return {
        token: savedToken,
        user: JSON.parse(savedUser) as UserInfo,
        idToken: savedIdToken,
      };
    } catch {
      return null;
    }
  }

  readIdToken(): string | null {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem("admin_id_token");
  }

  saveSession(token: string, user: UserInfo, idToken?: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_user", JSON.stringify(user));
      if (idToken) {
        localStorage.setItem("admin_id_token", idToken);
      }
    }
  }

  clearSession(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      localStorage.removeItem("admin_id_token");
    }
  }

  buildKeycloakLogoutUrl(postLogoutRedirectUri: string): string {
    const kcUrl =
      process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.mertervitrini.com.tr";
    const kcRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "merter";
    const kcClientId =
      process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "admin-client";
    const idToken = this.readIdToken();

    const params = new URLSearchParams({
      client_id: kcClientId,
      post_logout_redirect_uri: normalizeCanonicalAdminUrl(postLogoutRedirectUri),
    });
    if (idToken) {
      params.set("id_token_hint", idToken);
    }

    return `${kcUrl}/realms/${kcRealm}/protocol/openid-connect/logout?${params.toString()}`;
  }

  async exchangeKeycloakCode(
    code: string,
    redirectUri: string
  ): Promise<KeycloakCallbackResult> {
    return this.http.post<KeycloakCallbackResult>(
      "/api/v1/auth/keycloak-callback",
      { code, redirect_uri: normalizeCanonicalAdminUrl(redirectUri) }
    );
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.http.rawFetch("/api/v1/health");
      return res.ok;
    } catch {
      return false;
    }
  }

  async listFeeds(): Promise<XmlFeed[]> {
    const res = await this.http.rawFetch("/api/v1/feeds");
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (Array.isArray(data)) {
      return data as XmlFeed[];
    }
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      if (Array.isArray(record.feeds)) return record.feeds as XmlFeed[];
      if (Array.isArray(record.items)) return record.items as XmlFeed[];
    }
    return [];
  }

  async listFeedHistory(feedId: string): Promise<SyncRun[]> {
    if (!isValidUuid(feedId)) {
      return [];
    }
    const res = await this.http.rawFetch(
      `/api/v1/feeds/${encodeURIComponent(feedId)}/syncs`
    );
    if (!res.ok) return [];
    const payload: unknown = await res.json();
    return normalizeSyncRunsPayload(payload);
  }

  async triggerSync(feedId: string): Promise<string> {
    const data = await this.http.post<{ sync_run_id?: string }>(
      `/api/v1/feeds/${encodeURIComponent(feedId)}/sync`
    );
    return data.sync_run_id || "running";
  }

  async cancelSync(feedId: string): Promise<boolean> {
    const res = await this.http.rawFetch(
      `/api/v1/feeds/${encodeURIComponent(feedId)}/cancel`,
      {
        method: "POST",
      }
    );
    return res.ok;
  }

  async clearFeedHistory(feedId: string): Promise<boolean> {
    if (!isValidUuid(feedId)) {
      return true;
    }
    const res = await this.http.rawFetch(
      `/api/v1/feeds/${encodeURIComponent(feedId)}/syncs`,
      {
        method: "DELETE",
      }
    );
    return res.ok;
  }

  async listCategories(): Promise<CategoryNode[]> {
    const res = await this.http.rawFetch("/api/v1/categories");
    if (!res.ok) return [];
    const data = (await res.json()) as CategoryNode[] | null;
    return Array.isArray(data) ? data : [];
  }

  async listSuppliers(): Promise<Brand[]> {
    const res = await this.http.rawFetch("/api/v1/suppliers");
    if (!res.ok) return [];
    const data = (await res.json()) as Brand[] | null;
    return Array.isArray(data) ? data : [];
  }

  async listProducts({
    limit = 24,
    offset = 0,
    categoryId = "",
    search = "",
  }: {
    limit?: number;
    offset?: number;
    categoryId?: string;
    search?: string;
  }): Promise<AdminProductsPage> {
    const params = new URLSearchParams();
    params.set("limit", limit.toString());
    params.set("offset", offset.toString());
    if (categoryId) params.set("category_id", categoryId);
    if (search) params.set("search", search);

    const res = await this.http.rawFetch(`/api/v1/products?${params.toString()}`);
    if (!res.ok) {
      return { products: [], total: 0 };
    }
    const headerTotal =
      res.headers.get("X-Total-Count") ?? res.headers.get("x-total-count");
    const payload: unknown = await res.json();
    return normalizeProductsPayload(payload, headerTotal, limit, offset);
  }

  async getStoreSettings(): Promise<StoreSettingsDTO> {
    const data = await this.http.get<Partial<StoreSettingsDTO>>("/api/v1/settings");
    return normalizeStoreSettingsDTO(data);
  }

  async updateStoreSettings(settings: StoreSettingsDTO): Promise<StoreSettingsDTO> {
    const payload = {
      address: settings.address,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      email: settings.email,
      show_single_price: settings.show_single_price,
      show_prices_to_guests: settings.show_prices_to_guests,
      recaptcha_enabled: settings.recaptcha_enabled,
      recaptcha_site_key: (settings.recaptcha_site_key || "").trim(),
      ...(settings.recaptcha_secret_key?.trim()
        ? { recaptcha_secret_key: settings.recaptcha_secret_key.trim() }
        : {}),
      ...(settings.clear_recaptcha_secret ? { clear_recaptcha_secret: true } : {}),
    };
    const data = await this.http.put<Partial<StoreSettingsDTO>>("/api/v1/settings", payload);
    return normalizeStoreSettingsDTO(data);
  }
}

