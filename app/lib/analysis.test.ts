import { describe, expect, it } from "vitest";
import { compareAllocation, monthlyHistory, portfolioAlerts, suggestContribution } from "./analysis";
import type { Holding, PortfolioSummary } from "./portfolio";

function holding(partial: Partial<Holding>): Holding {
  return {
    id: "h", portfolioId: "p", ticker: "X", assetName: "X", assetType: "STOCK", totalQuantity: 1, totalInvested: 0,
    averagePrice: 0, createdAt: "", updatedAt: "", contributions: [], currentValue: 0, valuation: "market",
    amountBased: false, gain: 0, gainPct: null, ...partial,
  };
}

function summary(holdings: Holding[], extra: Partial<PortfolioSummary> = {}): PortfolioSummary {
  const currentValue = holdings.reduce((a, h) => a + h.currentValue, 0);
  const types = ["FIXED_INCOME", "FUND", "ETF", "FII", "STOCK"] as const;
  return {
    hasMissingPrices: false, hasEstimates: false, holdings, totalInvested: currentValue, currentValue, gain: 0, gainPct: null,
    allocation: types
      .map((type) => ({ type, value: holdings.filter((h) => h.assetType === type).reduce((a, h) => a + h.currentValue, 0) }))
      .filter((a) => a.value > 0)
      .map((a) => ({ ...a, share: a.value / currentValue })),
    byInstitution: [], recentContributions: [], ...extra,
  };
}

describe("análise da carteira", () => {
  const onlyFixed = summary([holding({ id: "cdb", assetType: "FIXED_INCOME", currentValue: 10000 })]);

  it("compara a carteira com a referência do perfil", () => {
    const gaps = compareAllocation(onlyFixed, "MODERATE");
    expect(gaps.find((g) => g.type === "FIXED_INCOME")).toMatchObject({ currentShare: 1, targetShare: 0.5, gap: -5000 });
    expect(gaps.find((g) => g.type === "FII")).toMatchObject({ currentShare: 0, targetShare: 0.15, gap: 1500 });
    // Conservador não tem ações na referência, então elas nem aparecem se a carteira não tiver
    expect(compareAllocation(onlyFixed, "CONSERVATIVE").some((g) => g.type === "STOCK")).toBe(false);
  });

  it("sugere o aporte só para o que está abaixo da referência, sem sobras", () => {
    const split = suggestContribution(onlyFixed, "MODERATE", 1000);
    expect(split.some((s) => s.type === "FIXED_INCOME")).toBe(false);
    expect(split.reduce((a, s) => a + s.amount, 0)).toBe(1000);
    expect(split.every((s) => s.amount % 10 === 0)).toBe(true);
  });

  it("começa do zero seguindo a referência do perfil", () => {
    const split = suggestContribution(summary([]), "CONSERVATIVE", 1000);
    expect(split).toEqual([
      { type: "FIXED_INCOME", amount: 800 },
      { type: "FUND", amount: 100 },
      { type: "ETF", amount: 50 },
      { type: "FII", amount: 50 },
    ]);
  });

  it("avisa sobre FGC, vencimento próximo e concentração", () => {
    const s = summary(
      [
        holding({ id: "cdb", assetName: "CDB Itaú", ticker: "RF-AAAAAA", assetType: "FIXED_INCOME", amountBased: true, institution: "Itaú", currentValue: 300000, totalInvested: 290000, maturityDate: "2026-11-20" }),
        holding({ id: "petr", ticker: "PETR4", assetType: "STOCK", currentValue: 200000 }),
      ],
      { byInstitution: [{ institution: "Itaú", value: 300000, share: 0.6, count: 1 }, { institution: "XP", value: 200000, share: 0.4, count: 1 }] },
    );
    const alerts = portfolioAlerts(s, "2026-10-30");
    expect(alerts.map((a) => a.id)).toEqual(["fgc-Itaú", "concentracao-petr", "vencimento-cdb"]);
    expect(alerts.find((a) => a.id === "vencimento-cdb")?.text).toContain("Faltam 21 dias");
  });

  it("monta o histórico mensal com os meses sem aporte", () => {
    const s = summary([], {
      recentContributions: [
        { id: "2", investmentId: "i", quantity: 1, unitPrice: 300, amount: 300, contributionDate: "2026-10-05", createdAt: "", ticker: "X", assetName: "X", assetType: "STOCK", amountBased: false },
        { id: "1", investmentId: "i", quantity: 1, unitPrice: 1000, amount: 1000, contributionDate: "2026-08-15", createdAt: "", ticker: "X", assetName: "X", assetType: "STOCK", amountBased: false },
      ],
    });
    expect(monthlyHistory(s, "2026-10-30")).toEqual([
      { month: "2026-08", contributed: 1000, invested: 1000, count: 1 },
      { month: "2026-09", contributed: 0, invested: 1000, count: 0 },
      { month: "2026-10", contributed: 300, invested: 1300, count: 1 },
    ]);
  });
});
