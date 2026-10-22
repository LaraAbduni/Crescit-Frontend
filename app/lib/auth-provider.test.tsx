import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "./auth";

const sdk = vi.hoisted(() => ({ provider: vi.fn(), getToken: vi.fn() }));
vi.mock("@auth0/auth0-react", () => ({
  Auth0Provider: (props: { children: React.ReactNode }) => { sdk.provider(props); return props.children; },
  useAuth0: () => ({ isLoading: false, isAuthenticated: false, getAccessTokenSilently: sdk.getToken }),
}));
afterEach(cleanup);

it("configura audience e os escopos solicitados, com cache em memória", async () => {
  render(<MemoryRouter><AuthProvider><p>Aplicação pronta</p></AuthProvider></MemoryRouter>);
  await screen.findByText("Aplicação pronta");
  expect(sdk.provider).toHaveBeenCalledWith(expect.objectContaining({
    domain: "test.auth0.com", clientId: "test-client", cacheLocation: "memory",
    authorizationParams: { redirect_uri: window.location.origin, audience: "https://api.example.test", scope: "openid profile email" },
  }));
  expect(sdk.getToken).not.toHaveBeenCalled();
});
