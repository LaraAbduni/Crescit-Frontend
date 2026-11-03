import { describe, expect, it } from "vitest";
import { buildJujuFacts } from "./juju-context";
import type { Holding, PortfolioSummary } from "./portfolio";

function holding(partial: Partial<Holding>): Holding {
  return {
    id: "h", portfolioId: "p", ticker: "X", assetName: "X", assetType: "STOCK", totalQuantity: 1, totalInvested: 0,
    averagePrice: 0, createdAt: "", updatedAt: "", contributions: [], currentValue: 0, valuation: "market",
    amountBased: false, gain: 0, gainPct: null, ...partial,
  };
}

const cdb = holding({ id: "cdb", ticker: "RF-ABC123", assetName: "CDB Itaú", assetType: "FIXED_INCOME", institution: "Itaú", currentValue: 6000, totalInvested: 6000, amountBased: true });
const bova = holding({ id: "bova", ticker: "BOVA11", assetType: "ETF", institution: "BTG Pactual", currentValue: 4000, totalInvested: 3600, gain: 400, gainPct: 400 / 3600 });

const summary: PortfolioSummary = {
  hasMissingPrices: false, hasEstimates: false, holdings: [cdb, bova], totalInvested: 9600, currentValue: 10000, gain: 400, gainPct: 400 / 9600,
  allocation: [{ type: "FIXED_INCOME", value: 6000, share: 0.6 }, { type: "ETF", value: 4000, share: 0.4 }],
  byInstitution: [{ institution: "Itaú", value: 6000, share: 0.6, count: 1 }, { institution: "BTG Pactual", value: 4000, share: 0.4, count: 1 }],
  recentContributions: [
    { id: "c1", investmentId: "bova", quantity: 3, unitPrice: 100, amount: 300, contributionDate: "2026-11-02", createdAt: "", ticker: "BOVA11", assetName: "BOVA11", assetType: "ETF", amountBased: false },
  ],
};

describe("Resumo da carteira para a Juju com IA", () => {
  it("traz perfil, carteira, aporte do mês e instituições com os números do app", () => {
    const facts = buildJujuFacts({ summary, investorType: "MODERATE", goal: 1000, today: "2026-11-03" });
    expect(facts).toContain("Data de hoje: 2026-11-03");
    expect(facts).toContain("Perfil do investidor: Moderado");
    expect(facts).toContain("Carteira: R$ 10.000,00 hoje, R$ 9.600,00 investidos");
    expect(facts).toContain("CDB Itaú (Renda fixa, Itaú)");
    expect(facts).toContain("Aportado neste mês: R$ 300,00; falta para a meta: R$ 700,00");
    expect(facts).toContain("Por instituição: Itaú");
    expect(facts).not.toContain(" ");
  });

  it("deixa claro quando a carteira ainda não carregou ou está vazia", () => {
    expect(buildJujuFacts({ investorType: "CONSERVATIVE", goal: 500, today: "2026-11-03" })).toContain("Carteira: ainda carregando");
    const empty = { ...summary, holdings: [], currentValue: 0, totalInvested: 0 };
    expect(buildJujuFacts({ summary: empty, investorType: "CONSERVATIVE", goal: 500, today: "2026-11-03" })).toContain("Carteira: vazia");
  });
});
