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
  updateStoreSettings(settings: StoreSettingsDTO): Promise<void>;
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
      const saved = localStorage.getItem("merter_admin_theme");
      if (saved === "light" || saved === "dark") {
        return saved;
      }
    }
    return "light";
  }

  saveTheme(theme: "light" | "dark"): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("merter_admin_theme", theme);
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
      post_logout_redirect_uri: postLogoutRedirectUri,
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
      { code, redirect_uri: redirectUri }
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
    const data = (await res.json()) as XmlFeed[] | null;
    return Array.isArray(data) ? data : [];
  }

  async listFeedHistory(feedId: string): Promise<SyncRun[]> {
    const res = await this.http.rawFetch(`/api/v1/feeds/${feedId}/history`);
    if (!res.ok) return [];
    const runs = (await res.json()) as SyncRun[] | null;
    return Array.isArray(runs) ? runs : [];
  }

  async triggerSync(feedId: string): Promise<string> {
    const data = await this.http.post<{ sync_run_id?: string }>(
      `/api/v1/feeds/${feedId}/sync`
    );
    return data.sync_run_id || "running";
  }

  async cancelSync(feedId: string): Promise<boolean> {
    const res = await this.http.rawFetch(`/api/v1/feeds/${feedId}/cancel`, {
      method: "POST",
    });
    return res.ok;
  }

  async clearFeedHistory(feedId: string): Promise<boolean> {
    const res = await this.http.rawFetch(`/api/v1/feeds/${feedId}/history`, {
      method: "DELETE",
    });
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
    const data = (await res.json()) as { products?: Product[]; total?: number };
    return {
      products: data.products ?? [],
      total: data.total ?? 0,
    };
  }

  async getStoreSettings(): Promise<StoreSettingsDTO> {
    const data = await this.http.get<Partial<StoreSettingsDTO>>("/api/v1/settings");
    return {
      address: data.address ?? "",
      phone: data.phone ?? "",
      whatsapp: data.whatsapp ?? "",
      email: data.email ?? "",
      show_single_price: Boolean(data.show_single_price),
      show_prices_to_guests: Boolean(data.show_prices_to_guests),
    };
  }

  async updateStoreSettings(settings: StoreSettingsDTO): Promise<void> {
    await this.http.put<Record<string, unknown>>("/api/v1/settings", settings);
  }
}

