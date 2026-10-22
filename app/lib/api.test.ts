import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request, SESSION_EXPIRED_EVENT, setAccessTokenGetter } from "./api";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  setAccessTokenGetter(async () => "access-token");
});
afterEach(() => { setAccessTokenGetter(undefined); vi.unstubAllGlobals(); });

describe("chamadas autenticadas", () => {
  it("envia o access token e os campos do contrato sem cookies", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: "investment" }));
    await request("http://localhost:8083/", "POST", "/portfolios/auth0%7C123/investments", { ticker: "BOVA11" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8083/portfolios/auth0%7C123/investments", expect.objectContaining({
      method: "POST", credentials: "omit", cache: "no-store", body: '{"ticker":"BOVA11"}',
      headers: { Accept: "application/json", Authorization: "Bearer access-token", "Content-Type": "application/json" },
    }));
  });
  it("não envia requisição sem token", async () => {
    setAccessTokenGetter(undefined);
    await expect(request("http://localhost:8081", "GET", "/profiles/me")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("interrompe a chamada quando a renovação da sessão falha", async () => {
    setAccessTokenGetter(async () => { throw new Error("login_required"); });
    await expect(request("http://localhost:8081", "GET", "/profiles/me")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("avisa a interface sobre 401 e não repete uma escrita", async () => {
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(request("http://localhost:8081", "POST", "/profiles/questionnaire", {})).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });
  it("preserva 403 e detalhes de validação", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ errors: { permission: "read:portfolio" } }, { status: 403 }));
    await expect(request("http://localhost:8083", "GET", "/portfolios/me")).rejects.toMatchObject({
      status: 403, details: { permission: "read:portfolio" },
    });
  });
  it("trata respostas sem corpo", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(request("http://localhost:8083", "DELETE", "/investment")).resolves.toBeUndefined();
  });
  it("não simula dados quando falta a URL", async () => {
    await expect(request(undefined, "GET", "/assets")).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("identifica falhas de rede", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(request("http://localhost:8082", "GET", "/assets")).rejects.toMatchObject({ status: 0 });
  });
});
