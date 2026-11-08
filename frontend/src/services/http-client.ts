import { getOrInitCustomerChatIdentity } from "@/types/chat";

export interface AuthHeaderStrategy {
  buildHeaders(): Record<string, string>;
}

export class NoAuthHeaderStrategy implements AuthHeaderStrategy {
  buildHeaders(): Record<string, string> {
    return {};
  }
}

export class BearerTokenHeaderStrategy implements AuthHeaderStrategy {
  constructor(private readonly getToken: () => string | null) {}

  buildHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

export class CustomerChatHeaderStrategy implements AuthHeaderStrategy {
  buildHeaders(): Record<string, string> {
    const identity = getOrInitCustomerChatIdentity();
    const headers: Record<string, string> = {
      "X-Chat-Customer-Id": identity.customerId,
      "X-Chat-Customer-Name": encodeURIComponent(identity.customerName),
    };
    if (identity.token) {
      headers.Authorization = `Bearer ${identity.token}`;
    }
    return headers;
  }
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface IHttpClient {
  rawFetch(path: string, options?: RequestInit): Promise<Response>;
  get<T>(path: string, extraHeaders?: Record<string, string>): Promise<T>;
  post<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T>;
  put<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T>;
  delete<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T>;
}

export interface FetchHttpClientOptions {
  readonly baseUrl?: string;
  readonly authStrategy?: AuthHeaderStrategy;
  readonly onUnauthorized?: () => void;
}

export class FetchHttpClient implements IHttpClient {
  private readonly baseUrl: string;
  private readonly authStrategy: AuthHeaderStrategy;
  private readonly onUnauthorized?: () => void;

  constructor(options: FetchHttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.authStrategy = options.authStrategy ?? new NoAuthHeaderStrategy();
    this.onUnauthorized = options.onUnauthorized;
  }

  async rawFetch(path: string, options?: RequestInit): Promise<Response> {
    const headers = new Headers(options?.headers);
    const authHeaders = this.authStrategy.buildHeaders();
    for (const [key, val] of Object.entries(authHeaders)) {
      if (!headers.has(key)) {
        headers.set(key, val);
      }
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && this.onUnauthorized) {
      this.onUnauthorized();
    }

    return res;
  }

  async get<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
    const res = await this.rawFetch(path, {
      method: "GET",
      headers: extraHeaders,
    });
    return this.parseJsonResponse<T>(res);
  }

  async post<T>(
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    return this.sendWithBody<T>("POST", path, body, extraHeaders);
  }

  async put<T>(
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    return this.sendWithBody<T>("PUT", path, body, extraHeaders);
  }

  async delete<T>(
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    return this.sendWithBody<T>("DELETE", path, body, extraHeaders);
  }

  private async sendWithBody<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    };
    const res = await this.rawFetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.parseJsonResponse<T>(res);
  }

  private async parseJsonResponse<T>(res: Response): Promise<T> {
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const message =
        typeof payload.error === "string" && payload.error.trim().length > 0
          ? payload.error
          : `HTTP ${res.status}`;
      throw new ApiError(message, res.status);
    }
    return payload as T;
  }
}

