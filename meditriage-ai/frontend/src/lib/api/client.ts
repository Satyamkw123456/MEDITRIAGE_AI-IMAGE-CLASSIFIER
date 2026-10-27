/**
 * MediTriage AI — Strongly Typed API Client
 * Generated & Type-Safe against Backend OpenAPI Schema (Cycle 8)
 */

import type { paths, components } from "./schema";

export type ApiPaths = paths;
export type Schemas = components["schemas"];

export type User = Schemas["UserOut"];
export type UserProfile = Schemas["PatientProfileOut"];
export type LoginPayload = Schemas["UserLogin"];
export type RegisterPayload = Schemas["UserRegister"];
export type AuthResponse = Schemas["Token"];

export type CaseDetail = Schemas["CaseDetailOut"];
export type ConsentStatusResponse = Schemas["ConsentStatusOut"];
export type RecordConsentPayload = Schemas["ConsentRecordCreate"];
export type ConsentLog = Schemas["ConsentLogOut"];
export type SkinAnalysis = Schemas["SkinAnalysisOut"];
export type SkinStatus = Schemas["SkinStatusOut"];

export interface ApiClientOptions {
  baseUrl?: string;
  getToken?: () => string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: any
  ) {
    super(`API Error ${status} (${statusText}): ${JSON.stringify(data)}`);
    this.name = "ApiError";
  }
}

import { getAuthToken } from "@/lib/auth-token";

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getLocaleFromPath(): string {
  if (typeof window === "undefined") return "en";
  const segments = window.location.pathname.split("/");
  const locale = segments[1];
  return ["en", "hi", "mr"].includes(locale) ? locale : "en";
}

function isAuthPath(path: string): boolean {
  return (
    path.includes("/auth/login") ||
    path.includes("/auth/register") ||
    path.includes("/auth/refresh")
  );
}

let refreshPromise: Promise<string | null> | null = null;

async function executeRefresh(baseUrl: string): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const csrfToken = getCsrfToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
        }

        const refreshUrl = `${baseUrl}/api/v1/auth/refresh`;
        const res = await fetch(refreshUrl, {
          method: "POST",
          headers,
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Refresh failed with status ${res.status}`);
        }

        const data = await res.json();
        const newToken: string | undefined = data?.access_token;
        if (newToken && typeof window !== "undefined") {
          localStorage.setItem("meditriage_token", newToken);
        }
        return newToken || null;
      } catch {
        if (typeof window !== "undefined") {
          localStorage.removeItem("meditriage_token");
          const locale = getLocaleFromPath();
          const target = `/${locale}/login?expired=1`;
          if (!window.location.href.includes("expired=1")) {
            window.location.href = target;
          }
        }
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export class TypedApiClient {
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      (typeof window !== "undefined"
        ? ""
        : process.env.BACKEND_URL || "http://127.0.0.1:8000");
    this.getToken = options.getToken || (() => getAuthToken());
  }

  public async fetch<
    Path extends keyof paths,
    Method extends keyof paths[Path] & ("get" | "post" | "put" | "delete" | "patch")
  >(
    path: Path,
    method: Method,
    options: {
      params?: paths[Path][Method] extends { parameters: { query?: infer Q } } ? Q : never;
      pathParams?: paths[Path][Method] extends { parameters: { path?: infer P } } ? P : never;
      body?: paths[Path][Method] extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;
      headers?: Record<string, string>;
      _isRetry?: boolean;
    } = {}
  ): Promise<
    paths[Path][Method] extends { responses: { 200: { content: { "application/json": infer R } } } }
      ? R
      : paths[Path][Method] extends { responses: { 201: { content: { "application/json": infer R2 } } } }
      ? R2
      : any
  > {
    let resolvedPath: string = path as string;

    // Substitute path parameters (e.g. {case_id} -> 123)
    if (options.pathParams) {
      Object.entries(options.pathParams as Record<string, any>).forEach(([key, val]) => {
        resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(String(val)));
      });
    }

    // Build query string
    let url = `${this.baseUrl}${resolvedPath}`;
    if (options.params) {
      const q = new URLSearchParams();
      Object.entries(options.params as Record<string, any>).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          q.append(k, String(v));
        }
      });
      const qStr = q.toString();
      if (qStr) {
        url += (url.includes("?") ? "&" : "?") + qStr;
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const fetchConfig: RequestInit = {
      method: method.toUpperCase(),
      headers,
      credentials: "include",
    };

    if (options.body && method !== "get") {
      fetchConfig.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchConfig);

    // Single-flight refresh on 401 for non-auth paths
    if (response.status === 401 && !isAuthPath(path as string) && !options._isRetry) {
      const newToken = await executeRefresh(this.baseUrl);
      if (newToken) {
        return this.fetch(path, method, {
          ...options,
          _isRetry: true,
        });
      }
    }

    if (!response.ok) {
      let errData: any = null;
      try {
        errData = await response.json();
      } catch {
        errData = await response.text();
      }
      throw new ApiError(response.status, response.statusText, errData);
    }

    if (response.status === 204) {
      return null as any;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && (contentType.includes("application/pdf") || contentType.includes("application/octet-stream"))) {
      return (await response.blob()) as any;
    }

    return (await response.json()) as any;
  }

  // --- Authenticated raw requests (multipart upload / binary) with single-flight refresh ---
  private async authed(url: string, init: RequestInit, retry = true): Promise<Response> {
    const headers = new Headers(init.headers);
    const token = this.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${this.baseUrl}${url}`, { ...init, headers, credentials: "include" });
    if (res.status === 401 && retry && !isAuthPath(url)) {
      const fresh = await executeRefresh(this.baseUrl);
      if (fresh) return this.authed(url, init, false);
    }
    return res;
  }

  private async asJson<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }
      throw new ApiError(res.status, res.statusText, data);
    }
    return (await res.json()) as T;
  }

  /** Skin & wound image triage (Triage Flow module). */
  public skin = {
    status: () => this.fetch("/api/v1/skin-triage/status", "get"),
    list: (caseId: number) =>
      this.fetch("/api/v1/cases/{case_id}/skin-analysis", "get", { pathParams: { case_id: caseId } }),
    analyze: async (caseId: number, file: File, bodyPart?: string): Promise<SkinAnalysis> => {
      const form = new FormData();
      form.append("image", file);
      if (bodyPart) form.append("body_part", bodyPart);
      // No Content-Type header: the browser sets the multipart boundary.
      return this.asJson<SkinAnalysis>(
        await this.authed(`/api/v1/cases/${caseId}/skin-analysis`, { method: "POST", body: form })
      );
    },
    imageBlobUrl: async (caseId: number, analysisId: number): Promise<string> => {
      const res = await this.authed(`/api/v1/cases/${caseId}/skin-analysis/${analysisId}/image`, { method: "GET" });
      if (!res.ok) throw new ApiError(res.status, res.statusText, null);
      return URL.createObjectURL(await res.blob());
    },
  };

  // --- Common High-Level Domain Helpers ---
  public auth = {
    me: () => this.fetch("/api/v1/auth/me", "get"),
    login: (body: any) => this.fetch("/api/v1/auth/login", "post", { body }),
    register: (body: any) => this.fetch("/api/v1/auth/register", "post", { body }),
  };

  public cases = {
    intake: (body: any) => this.fetch("/api/v1/cases/intake", "post", { body }),
    get: (caseId: number) => this.fetch("/api/v1/cases/{case_id}", "get", { pathParams: { case_id: caseId } }),
    myCases: () => this.fetch("/api/v1/cases/my", "get"),
    accessHistory: (caseId: number) =>
      this.fetch("/api/v1/cases/{case_id}/access-history", "get", { pathParams: { case_id: caseId } }),
  };

  public admin = {
    needsAttention: () => this.fetch("/api/v1/admin/needs-attention", "get"),
    listUsers: (params?: any) => this.fetch("/api/v1/admin/users", "get", { params }),
    startImpersonation: (body: any) => this.fetch("/api/v1/admin/support/impersonate", "post", { body }),
    stopImpersonation: (sessionId: number) =>
      this.fetch("/api/v1/admin/support/impersonate/{session_id}/stop", "post", { pathParams: { session_id: sessionId } }),
    breakGlass: (caseId: number, body: any) =>
      this.fetch("/api/v1/admin/support/cases/{case_id}/break-glass", "post", { pathParams: { case_id: caseId }, body }),
    getI18nStrings: () =>
      this.fetch("/api/v1/admin/content/i18n", "get"),
    exportAuditTrail: (params?: any) =>
      this.fetch("/api/v1/admin/audit/export", "get", { params }),
  };
}

export const apiClient = new TypedApiClient();
export default apiClient;
