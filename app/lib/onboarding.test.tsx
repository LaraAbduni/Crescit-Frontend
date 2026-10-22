import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingProvider, useOnboarding } from "./onboarding";
import { getProfile } from "./profile-api";
import { ApiError } from "./api";
import type { InvestorProfileResponse } from "./profile";

const auth = vi.hoisted(() => ({ isAuthenticated: true, user: { sub: "auth0|a", name: "Ana", email: "ana@example.com" } }));
vi.mock("@auth0/auth0-react", () => ({ useAuth0: () => auth }));
vi.mock("./profile-api", () => ({ getProfile: vi.fn() }));
const profile = (userId: string): InvestorProfileResponse => ({ id: "profile", userId, investorType: "MODERATE", score: 6, createdAt: "", updatedAt: "" });

function Probe() {
  const state = useOnboarding();
  return <><output>{state.ready ? `${state.account?.email}:${state.profile?.userId || "novo"}:${state.answers.goal || "vazio"}` : state.error || "carregando"}</output><button onClick={state.retry}>Recarregar</button></>;
}
function App() { return <OnboardingProvider><Probe /></OnboardingProvider>; }
beforeEach(() => {
  sessionStorage.clear();
  auth.isAuthenticated = true;
  auth.user = { sub: "auth0|a", name: "Ana", email: "ana@example.com" };
});
afterEach(cleanup);

describe("sessão e recuperação de perfil", () => {
  it("não busca dados de visitantes", async () => {
    auth.isAuthenticated = false;
    render(<App />);
    await screen.findByText("undefined:novo:vazio");
    expect(getProfile).not.toHaveBeenCalled();
  });
  it("recupera o perfil do backend e só armazena o rascunho", async () => {
    vi.mocked(getProfile).mockResolvedValueOnce(profile("auth0|a"));
    render(<App />);
    await screen.findByText("ana@example.com:auth0|a:vazio");
    const saved = JSON.parse(sessionStorage.getItem("crescit:onboarding:v3:auth0|a")!);
    expect(saved).toEqual({ answers: {} });
    expect(saved.profile).toBeUndefined();
  });
  it("não reutiliza o rascunho ou perfil de outra conta", async () => {
    sessionStorage.setItem("crescit:onboarding:v3:auth0|a", JSON.stringify({ answers: { goal: "BUILD_WEALTH" } }));
    vi.mocked(getProfile).mockResolvedValueOnce(profile("auth0|a")).mockResolvedValueOnce(undefined);
    const view = render(<App />);
    await screen.findByText("ana@example.com:auth0|a:BUILD_WEALTH");
    auth.user = { sub: "auth0|b", name: "Bia", email: "bia@example.com" };
    view.rerender(<App />);
    await screen.findByText("bia@example.com:novo:vazio");
    expect(screen.queryByText(/ana@example/)).toBeNull();
  });
  it("ignora respostas antigas que chegam depois de uma troca de conta", async () => {
    let resolveA!: (p: InvestorProfileResponse) => void;
    vi.mocked(getProfile).mockReturnValueOnce(new Promise((resolve) => { resolveA = resolve; })).mockResolvedValueOnce(profile("auth0|b"));
    const view = render(<App />);
    auth.user = { sub: "auth0|b", name: "Bia", email: "bia@example.com" };
    view.rerender(<App />);
    await screen.findByText("bia@example.com:auth0|b:vazio");
    await act(async () => resolveA(profile("auth0|a")));
    expect(screen.queryByText(/ana@example/)).toBeNull();
  });
  it("mostra erros de permissão e permite tentar novamente", async () => {
    vi.mocked(getProfile).mockRejectedValueOnce(new ApiError(403, "Sem permissão")).mockResolvedValueOnce(profile("auth0|a"));
    render(<App />);
    await screen.findByText("Sem permissão");
    act(() => screen.getByText("Recarregar").click());
    await waitFor(() => expect(screen.getByText("ana@example.com:auth0|a:vazio")).toBeTruthy());
  });
});
