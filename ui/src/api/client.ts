export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  call<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export interface CreateApiClientOptions {
  /** Базовый URL. По умолчанию "" — тот же origin, что отдал саму страницу
   * (standalone-режим бота). Панель подставит "/gw/<username>". */
  baseUrl?: string;
  getToken: () => string | null;
}

/** Тонкая fetch-обёртка: Bearer-токен на каждый запрос, единый разбор ошибок. */
export function createApiClient({
  baseUrl = "",
  getToken,
}: CreateApiClientOptions): ApiClient {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await res.json().catch(() => undefined)
      : undefined;

    if (!res.ok) {
      const message =
        (payload && typeof payload === "object" && "error" in payload
          ? String((payload as Record<string, unknown>).error)
          : undefined) ?? res.statusText;
      const details =
        payload && typeof payload === "object" && "details" in payload
          ? (payload as Record<string, unknown>).details
          : undefined;
      throw new ApiError(res.status, message, details);
    }

    return payload as T;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
    delete: (path) => request("DELETE", path),
    call: (method, path, body) => request(method.toUpperCase(), path, body),
  };
}
