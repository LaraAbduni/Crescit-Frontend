import { describe, expect, it } from "vitest";
import type { PortfolioSummary } from "./portfolio";
import { buildWorkbook } from "./spreadsheet";

const summary: PortfolioSummary = {
  hasMissingPrices: false,
  hasEstimates: true,
  totalInvested: 2000,
  currentValue: 2100,
  gain: 100,
  gainPct: 0.05,
  allocation: [{ type: "FIXED_INCOME", value: 2100, share: 1 }],
  byInstitution: [{ institution: "Inter", value: 2100, share: 1, count: 1 }],
  holdings: [
    {
      id: "cdb", portfolioId: "p", ticker: "RF-ABC123", assetName: "CDB Inter", assetType: "FIXED_INCOME", institution: "Inter",
      rateType: "CDI_PERCENT", rateValue: 110, maturityDate: "2028-07-01", totalQuantity: 2, totalInvested: 2000, averagePrice: 1000,
      createdAt: "", updatedAt: "", contributions: [], currentValue: 2100, valuation: "estimated", amountBased: true, gain: 100, gainPct: 0.05,
    },
  ],
  recentContributions: [
    { id: "c", investmentId: "cdb", quantity: 1, unitPrice: 2000, amount: 2000, contributionDate: "2026-09-10", createdAt: "", ticker: "RF-ABC123", assetName: "CDB Inter", assetType: "FIXED_INCOME", amountBased: true },
  ],
};

describe("planilha da carteira", () => {
  const sheets = buildWorkbook(summary, "MODERATE", "2026-10-30");

  it("tem as abas de resumo, investimentos, aportes e mês a mês", () => {
    expect(sheets.map((s) => s.sheet)).toEqual(["Resumo", "Investimentos", "Aportes", "Mensal"]);
  });

  it("mostra renda fixa pelo nome, com taxa e sem quantidade", () => {
    const [, row] = sheets[1].data;
    expect(row.slice(0, 7)).toEqual(["CDB Inter", null, "Renda fixa", "Inter", "110% do CDI", expect.objectContaining({ format: "dd/mm/yyyy" }), null]);
  });

  it("guarda datas ao meio-dia UTC para não mudar o dia", () => {
    const [, row] = sheets[2].data;
    expect((row[0] as { value: Date }).value.toISOString()).toBe("2026-09-10T12:00:00.000Z");
  });

  it("inclui os meses sem aporte no histórico", () => {
    expect(sheets[3].data.slice(1).map((r) => r[0])).toEqual(["setembro de 2026", "outubro de 2026"]);
  });
});
