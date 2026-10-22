const PROFILE_API_URL = import.meta.env.VITE_PROFILE_API_URL as string | undefined;
const RECOMMENDATIONS_API_URL = import.meta.env.VITE_RECOMMENDATIONS_API_URL as string | undefined;
const PORTFOLIO_API_URL = import.meta.env.VITE_PORTFOLIO_API_URL as string | undefined;

export const SESSION_EXPIRED_EVENT = "crescit:session-expired";

// O SDK fornece access tokens em memória. Nenhum token é salvo pelo app.
let getAccessToken: (() => Promise<string | undefined>) | undefined;

export function setAccessTokenGetter(fn: (() => Promise<string | undefined>) | undefined) {
  getAccessToken = fn;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: unknown = undefined,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function sessionExpired(): never {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
}

export async function request<T>(baseUrl: string | undefined, method: string, path: string, body?: unknown): Promise<T> {
  if (!baseUrl?.trim()) throw new ApiError(503, "A URL deste serviço não foi configurada.");
  let token: string | undefined;
  try {
    token = await getAccessToken?.();
  } catch {
    return sessionExpired();
  }
  if (!token) return sessionExpired();
  let res: Response;
  try {
    res = await fetch(`${baseUrl.trim().replace(/\/+$/, "")}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      credentials: "omit",
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.");
  }
  if (res.status === 401) return sessionExpired();
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new ApiError(res.status,
      res.status === 403 ? "Sua conta não tem permissão para esta ação." : err?.message || "Não foi possível concluir a solicitação.",
      err?.details ?? err?.errors);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export const profileApi = <T>(method: string, path: string, body?: unknown) =>
  request<T>(PROFILE_API_URL, method, path, body);
export const recommendationsApi = <T>(method: string, path: string, body?: unknown) =>
  request<T>(RECOMMENDATIONS_API_URL, method, path, body);
export const portfolioApi = <T>(method: string, path: string, body?: unknown) =>
  request<T>(PORTFOLIO_API_URL, method, path, body);
