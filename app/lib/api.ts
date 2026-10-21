// URLs dos serviços. Sem a URL de um serviço, o front usa o modo demonstração
// para ele (dados calculados no próprio navegador com as mesmas regras do backend).
const PROFILE_API_URL = import.meta.env.VITE_PROFILE_API_URL as string | undefined;
const RECOMMENDATIONS_API_URL = import.meta.env.VITE_RECOMMENDATIONS_API_URL as string | undefined;
const PORTFOLIO_API_URL = import.meta.env.VITE_PORTFOLIO_API_URL as string | undefined;

export const isMockProfileApi = !PROFILE_API_URL;
export const isMockRecommendationsApi = !RECOMMENDATIONS_API_URL;
export const isMockPortfolioApi = !PORTFOLIO_API_URL;

// O backend exige um access token do Auth0. Quando o login estiver integrado,
// basta registrar aqui a função que devolve o token (ex.: getAccessTokenSilently).
let getAccessToken: () => Promise<string | undefined> = async () => undefined;

export function setAccessTokenGetter(fn: () => Promise<string | undefined>) {
  getAccessToken = fn;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: unknown = undefined,
  ) {
    super(message);
  }
}

export async function request<T>(baseUrl: string | undefined, method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    // Os serviços devolvem { message, ... } nos erros
    const err = await res.json().catch(() => null);
    throw new ApiError(res.status, err?.message ?? res.statusText, err?.details);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const profileApi = <T>(method: string, path: string, body?: unknown) =>
  request<T>(PROFILE_API_URL, method, path, body);
export const recommendationsApi = <T>(method: string, path: string, body?: unknown) =>
  request<T>(RECOMMENDATIONS_API_URL, method, path, body);
export const portfolioApi = <T>(method: string, path: string, body?: unknown) =>
  request<T>(PORTFOLIO_API_URL, method, path, body);
