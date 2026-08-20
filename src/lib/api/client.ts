// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed API fetch client.
//
// A single typed transport every domain client builds on:
//   - unwraps the server `{ data, meta }` success envelope,
//   - parses the `{ error, meta }` failure envelope into `ApiClientError`,
//   - honors `AbortSignal` (React Query cancellation / user navigation),
//   - sends a correlation header and forwards `credentials` for session
//     cookies so no consumer ever calls `fetch` directly.
// ---------------------------------------------------------------------------

import { ApiClientError, parseErrorEnvelope } from "./errors";
import type { ApiClientErrorCode } from "./errors";

export interface ApiRequestInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  correlationId?: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiClientOptions {
  /** Base URL prefix. Defaults to `/api/v1`. */
  basePath?: string;
  /** Correlation id sent as `x-request-id` (validated server-side). */
  correlationId?: string;
  /** Hook invoked when a response is 401/403 so callers can refresh a session. */
  onUnauthorized?: () => void;
  /** Connectivity probe. Defaults to `navigator.onLine`. */
  isOnline?: () => boolean;
}

const CLIENT_CORRELATION_HEADER = "x-request-id";

export class ApiClient {
  readonly basePath: string;
  private readonly correlationId?: string;
  private readonly onUnauthorized?: () => void;
  private readonly isOnline: () => boolean;

  constructor(options: ApiClientOptions = {}) {
    this.basePath = options.basePath ?? "/api/v1";
    this.correlationId = options.correlationId;
    this.onUnauthorized = options.onUnauthorized;
    this.isOnline =
      options.isOnline ??
      (() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  }

  /** Build the request URL, appending a query string when provided. */
  private buildUrl(path: string, query?: ApiRequestInit["query"]): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${this.basePath}${normalizedPath}`;
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  async request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
    if (!this.isOnline()) {
      throw new ApiClientError({
        code: "offline",
        message: "You appear to be offline. Check your connection and retry.",
        status: 0,
        retryable: true,
        retryClassification: "transient",
      });
    }

    const headers = new Headers(init.headers);
    if (init.body !== undefined) {
      headers.set("content-type", "application/json");
    }
    if (this.correlationId) {
      headers.set(CLIENT_CORRELATION_HEADER, this.correlationId);
    }

    const response = await fetch(this.buildUrl(path, init.query), {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      credentials: "same-origin",
    });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const error = parseErrorEnvelope(body, response.status);
      if (error.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw error;
    }

    if (body === null || typeof body !== "object" || !("data" in body)) {
      throw new ApiClientError({
        code: "internal_error",
        message: "Malformed API response",
        status: response.status,
        retryable: false,
        retryClassification: "none",
      });
    }
    return (body as ApiEnvelope<T>).data;
  }

  get<T>(path: string, init?: ApiRequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "GET" });
  }

  post<T>(path: string, body?: unknown, init?: ApiRequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "POST", body });
  }

  put<T>(path: string, body?: unknown, init?: ApiRequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "PUT", body });
  }

  patch<T>(path: string, body?: unknown, init?: ApiRequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "PATCH", body });
  }

  delete<T>(path: string, init?: ApiRequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "DELETE" });
  }
}

export { ApiClientError, type ApiClientErrorCode };
