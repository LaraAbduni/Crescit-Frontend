import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "./auth";
import { request, SESSION_EXPIRED_EVENT } from "./api";

const sdk = vi.hoisted(() => ({ provider: vi.fn(), getToken: vi.fn(), isLoading: false, isAuthenticated: false }));
vi.mock("@auth0/auth0-react", () => ({
  Auth0Provider: (props: { children: React.ReactNode }) => { sdk.provider(props); return props.children; },
  useAuth0: () => ({ isLoading: sdk.isLoading, isAuthenticated: sdk.isAuthenticated, getAccessTokenSilently: sdk.getToken }),
}));
beforeEach(() => {
  sdk.isLoading = false;
  sdk.isAuthenticated = false;
  sdk.getToken.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("configura audience e os escopos solicitados, com cache em memória", async () => {
  render(<MemoryRouter><AuthProvider><p>Aplicação pronta</p></AuthProvider></MemoryRouter>);
  await screen.findByText("Aplicação pronta");
  expect(sdk.provider).toHaveBeenCalledWith(expect.objectContaining({
    domain: "test.auth0.com", clientId: "test-client", cacheLocation: "memory",
    authorizationParams: { redirect_uri: window.location.origin, audience: "https://api.example.test", scope: "openid profile email" },
  }));
  expect(sdk.getToken).not.toHaveBeenCalled();
});

it("disponibiliza o token antes de os filhos buscarem o perfil após o retorno do login", async () => {
  sdk.isLoading = true;
  sdk.getToken.mockResolvedValue("access-token");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ userId: "auth0|account" }));
  vi.stubGlobal("fetch", fetchMock);
  const expired = vi.fn();
  window.addEventListener(SESSION_EXPIRED_EVENT, expired);
  const loaded = vi.fn();
  const failed = vi.fn();
  function ProfileLoader() {
    useEffect(() => {
      void request("http://localhost:8081", "GET", "/profiles/auth0%7Caccount").then(loaded, failed);
    }, []);
    return <p>Carregando perfil da conta</p>;
  }
  const app = () => <MemoryRouter><AuthProvider><ProfileLoader /></AuthProvider></MemoryRouter>;
  try {
    const view = render(app());
    expect(screen.getByRole("status").textContent).toContain("Carregando sua sessão");
    await act(async () => {
      sdk.isLoading = false;
      sdk.isAuthenticated = true;
      view.rerender(app());
    });
    expect(sdk.getToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
    }));
    expect(loaded).toHaveBeenCalledWith({ userId: "auth0|account" });
    expect(failed).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
    expect(screen.queryByText("Entre novamente")).toBeNull();
  } finally {
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }
});
