import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessTokenGetter } from "./api";
import { addInvestment, loadPortfolio, updateInvestment } from "./portfolio";
import { getRecommendations } from "./recommendations";

const fetchMock = vi.fn();
const userId = "auth0|test";
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); setAccessTokenGetter(async () => "access-token"); });
afterEach(() => { vi.unstubAllGlobals(); setAccessTokenGetter(undefined); });

describe("contratos entre telas e serviços", () => {
  it("gera recomendações quando o perfil salvo mudou", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ investorType: "CONSERVATIVE" }]))
      .mockResolvedValueOnce(Response.json([{ id: "r", investorType: "MODERATE", ticker: "BOVA11", compatibilityScore: 80 }]));
    const items = await getRecommendations(userId, "MODERATE");
    expect(items[0].ticker).toBe("BOVA11");
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method, options.headers.Authorization])).toEqual([
      ["http://localhost:8082/recommendations/auth0%7Ctest", "GET", "Bearer access-token"],
      ["http://localhost:8082/recommendations/auth0%7Ctest/generate", "POST", "Bearer access-token"],
    ]);
  });
  it("reaproveita um investimento existente após conflito sem repetir a escrita", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: "exists" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json([{ id: "investment", ticker: "BOVA11" }]));
    await expect(addInvestment(userId, { ticker: "BOVA11", assetName: "Índice", assetType: "ETF" }))
      .resolves.toMatchObject({ id: "investment" });
    expect(fetchMock.mock.calls.map(([, options]) => options.method)).toEqual(["POST", "GET"]);
  });
  it("calcula a carteira usando investimentos, aportes e catálogo das APIs", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/assets")) return Response.json([{ ticker: "BOVA11", currentPrice: 120 }]);
      if (url.endsWith("/contributions")) return Response.json([{ id: "c", quantity: 2, unitPrice: 100, amount: 200, contributionDate: "2026-10-21", createdAt: "2026-10-21T12:00:00" }]);
      return Response.json([{ id: "i", ticker: "BOVA11", assetType: "ETF", totalQuantity: 2, totalInvested: 200, averagePrice: 100 }]);
    });
    const summary = await loadPortfolio(userId);
    expect(summary).toMatchObject({ totalInvested: 200, currentValue: 240, gain: 40, gainPct: 0.2, hasMissingPrices: false });
    expect(summary.recentContributions[0]).toMatchObject({ ticker: "BOVA11", amount: 200 });
    expect(fetchMock.mock.calls.every(([, options]) => options.headers.Authorization === "Bearer access-token")).toBe(true);
  });
  it("edita o investimento com PUT enviando instituição e taxa", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: "i", institution: "Itaú" }));
    await updateInvestment(userId, "i", { ticker: "RF-ABC123", assetName: "CDB Itaú", assetType: "FIXED_INCOME", institution: "Itaú", rateType: "CDI_PERCENT", rateValue: 105 });
    const [url, options] = fetchMock.mock.calls[0];
    expect([url, options.method]).toEqual(["http://localhost:8083/portfolios/auth0%7Ctest/investments/i", "PUT"]);
    expect(JSON.parse(options.body)).toMatchObject({ institution: "Itaú", rateType: "CDI_PERCENT", rateValue: 105 });
  });
  it("agrupa por instituição e estima a renda fixa pela taxa contratada", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/assets")) return Response.json([{ ticker: "BOVA11", currentPrice: 100 }]);
      if (url.includes("/investments/cdb/contributions")) return Response.json([{ id: "c1", quantity: 1, unitPrice: 1000, amount: 1000, contributionDate: "2026-10-01", createdAt: "2026-10-01T12:00:00" }]);
      if (url.endsWith("/contributions")) return Response.json([]);
      return Response.json([
        { id: "cdb", ticker: "RF-ABC123", assetName: "CDB Inter", assetType: "FIXED_INCOME", institution: "Inter", rateType: "PREFIXED", rateValue: 12, totalQuantity: 1, totalInvested: 1000 },
        { id: "fundo", ticker: "FD-XYZ789", assetName: "Fundo XP", assetType: "FUND", institution: "XP", totalQuantity: 1, totalInvested: 3000 },
        { id: "bova", ticker: "BOVA11", assetName: "Índice", assetType: "ETF", institution: "XP", totalQuantity: 10, totalInvested: 900 },
        { id: "antigo", ticker: "ITUB4", assetName: "Itaú", assetType: "STOCK", totalQuantity: 0, totalInvested: 0 },
      ]);
    });
    const summary = await loadPortfolio(userId);
    const cdb = summary.holdings.find((h) => h.id === "cdb")!;
    expect(cdb).toMatchObject({ valuation: "estimated", amountBased: true });
    expect(cdb.currentValue).toBeGreaterThan(1000);
    expect(summary.holdings.find((h) => h.id === "fundo")).toMatchObject({ valuation: "invested", amountBased: true, currentValue: 3000 });
    expect(summary.holdings.find((h) => h.id === "bova")).toMatchObject({ valuation: "market", amountBased: false, currentValue: 1000 });
    expect(summary.byInstitution.map((i) => [i.institution, i.value, i.count])).toEqual([
      ["XP", 4000, 2],
      ["Inter", cdb.currentValue, 1],
      ["Sem instituição", 0, 1],
    ]);
    expect(summary).toMatchObject({ hasEstimates: true, hasMissingPrices: true });
    expect(summary.allocation.map((a) => a.type)).toEqual(["FIXED_INCOME", "FUND", "ETF"]);
  });
  it("não apresenta rendimento fictício quando o catálogo está indisponível", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/assets")) throw new TypeError("offline");
      if (url.endsWith("/contributions")) return Response.json([]);
      return Response.json([{ id: "i", ticker: "BOVA11", assetType: "ETF", totalQuantity: 2, totalInvested: 200 }]);
    });
    expect(await loadPortfolio(userId)).toMatchObject({ currentValue: 200, gainPct: null, hasMissingPrices: true });
  });
});
