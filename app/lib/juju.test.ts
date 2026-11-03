import { describe, expect, it } from "vitest";
import { answer as rawAnswer, SUGGESTED_QUESTIONS, type JujuContext } from "./juju";
import type { Holding, PortfolioSummary } from "./portfolio";

function holding(partial: Partial<Holding>): Holding {
  return {
    id: "h", portfolioId: "p", ticker: "X", assetName: "X", assetType: "STOCK", totalQuantity: 1, totalInvested: 0,
    averagePrice: 0, createdAt: "", updatedAt: "", contributions: [], currentValue: 0, valuation: "market",
    amountBased: false, gain: 0, gainPct: null, ...partial,
  };
}

const cdb = holding({ id: "cdb", ticker: "RF-ABC123", assetName: "CDB Itaú", assetType: "FIXED_INCOME", institution: "Itaú", currentValue: 6000, totalInvested: 6000, amountBased: true });
const bova = holding({ id: "bova", ticker: "BOVA11", assetType: "ETF", institution: "BTG Pactual", currentValue: 4000, totalInvested: 3600 });

const summary: PortfolioSummary = {
  hasMissingPrices: false, hasEstimates: false, holdings: [cdb, bova], totalInvested: 9600, currentValue: 10000, gain: 400, gainPct: 400 / 9600,
  allocation: [{ type: "FIXED_INCOME", value: 6000, share: 0.6 }, { type: "ETF", value: 4000, share: 0.4 }],
  byInstitution: [{ institution: "Itaú", value: 6000, share: 0.6, count: 1 }, { institution: "BTG Pactual", value: 4000, share: 0.4, count: 1 }],
  recentContributions: [
    { id: "c1", investmentId: "bova", quantity: 3, unitPrice: 100, amount: 300, contributionDate: "2026-11-02", createdAt: "", ticker: "BOVA11", assetName: "BOVA11", assetType: "ETF", amountBased: false },
    { id: "c2", investmentId: "cdb", quantity: 1, unitPrice: 6000, amount: 6000, contributionDate: "2026-06-10", createdAt: "", ticker: "RF-ABC123", assetName: "CDB Itaú", assetType: "FIXED_INCOME", amountBased: true },
  ],
};

// O formato de moeda usa espaço não separável; nos testes comparamos com espaço comum
const answer = (q: string, c: JujuContext) => {
  const a = rawAnswer(q, c);
  return { ...a, text: a.text.replace(/\u00a0/g, " ") };
};

const ctx: JujuContext = { summary, investorType: "MODERATE", goal: 1000, today: "2026-11-03" };

describe("Juju (prévia com respostas prontas)", () => {
  it("resume a carteira com os números dela", () => {
    const { text } = answer("Como está minha carteira?", ctx);
    expect(text).toContain("R$ 10.000,00 em 2 investimentos");
    expect(text).toContain("2 instituições");
    expect(text).toContain("CDB Itaú");
  });

  it("calcula o que falta da meta do mês e sugere a divisão pelo perfil", () => {
    const { text, links } = answer("quanto aportar este mês?", ctx);
    expect(text).toContain("Faltam R$ 700,00");
    expect(text).toMatch(/em (FII|Fundo|Ação)/);
    expect(links?.[0].to).toBe("/recomendacoes");
  });

  it("reconhece a pergunta sem acento e em maiúsculas", () => {
    expect(answer("O QUE E FII", ctx).text).toContain("fundo imobiliário");
    expect(answer("lci ou cdb", ctx).text).toContain("isentas");
  });

  it("avisa quando a carteira ainda não carregou ou está vazia", () => {
    expect(answer("minha carteira", { ...ctx, summary: undefined }).text).toContain("carregando");
    const empty = { ...summary, holdings: [], currentValue: 0 };
    expect(answer("minha carteira", { ...ctx, summary: empty }).links?.map((l) => l.to)).toContain("/primeiros-passos");
  });

  it("tem uma resposta para cada pergunta sugerida e um fallback honesto", () => {
    for (const q of SUGGESTED_QUESTIONS) expect(answer(q, ctx).text).not.toContain("Ainda não sei");
    expect(answer("qual o melhor time de futebol?", ctx).text).toContain("Ainda não sei");
  });
});
