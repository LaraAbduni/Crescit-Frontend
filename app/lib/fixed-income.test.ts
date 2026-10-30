import { describe, expect, it } from "vitest";
import {
  annualRate,
  CDI_REFERENCE,
  estimateNetValue,
  estimateValue,
  incomeTaxRate,
  isTaxExempt,
  rateLabel,
  simulate,
  taxedEquivalentCdiPercent,
} from "./fixed-income";

describe("renda fixa", () => {
  it("converte cada forma de rentabilidade em taxa anual", () => {
    expect(annualRate("CDI_PERCENT", 100)).toBeCloseTo(CDI_REFERENCE);
    expect(annualRate("CDI_PERCENT", 110)).toBeCloseTo(CDI_REFERENCE * 1.1);
    expect(annualRate("PREFIXED", 12.5)).toBeCloseTo(0.125);
    expect(annualRate("IPCA_PLUS", 6)).toBeCloseTo(1.045 * 1.06 - 1);
  });

  it("rende cada aplicação desde a própria data, com juros compostos", () => {
    const value = estimateValue(
      [
        { amount: 1000, contributionDate: "2025-01-01" },
        { amount: 500, contributionDate: "2026-01-01" },
      ],
      "PREFIXED",
      10,
      "2026-01-01",
    );
    expect(value).toBeCloseTo(1000 * 1.1 + 500, 1);
  });

  it("não rende aplicações feitas hoje nem com data futura", () => {
    expect(estimateValue([{ amount: 1000, contributionDate: "2026-10-30" }], "CDI_PERCENT", 100, "2026-10-29")).toBe(1000);
  });

  it("escreve a taxa como no extrato do banco", () => {
    expect(rateLabel("CDI_PERCENT", 110)).toBe("110% do CDI");
    expect(rateLabel("PREFIXED", 12.5)).toBe("12,5% a.a.");
    expect(rateLabel("IPCA_PLUS", 6)).toBe("IPCA + 6% a.a.");
  });
});

describe("imposto e comparação de renda fixa", () => {
  it("usa a tabela regressiva do IR", () => {
    expect([100, 200, 500, 1000].map(incomeTaxRate)).toEqual([0.225, 0.2, 0.175, 0.15]);
  });

  it("reconhece LCI e LCA como isentas pelo nome", () => {
    expect(isTaxExempt("LCA Banco Inter 92% CDI")).toBe(true);
    expect(isTaxExempt("CDB Itaú 110%")).toBe(false);
  });

  it("desconta o IR só do rendimento", () => {
    const contributions = [{ amount: 1000, contributionDate: "2025-01-01" }];
    const gross = estimateValue(contributions, "PREFIXED", 10, "2026-01-01");
    expect(estimateNetValue(contributions, "PREFIXED", 10, "2026-01-01", false)).toBeCloseTo(1000 + (gross - 1000) * (1 - 0.175), 2);
    expect(estimateNetValue(contributions, "PREFIXED", 10, "2026-01-01", true)).toBeCloseTo(gross, 2);
  });

  it("compara um CDB tributado com uma LCI isenta no mesmo prazo", () => {
    const cdb = simulate({ rateType: "CDI_PERCENT", rateValue: 110, exempt: false }, 10000, 24);
    const lci = simulate({ rateType: "CDI_PERCENT", rateValue: 92, exempt: true }, 10000, 24);
    expect(cdb.taxRate).toBe(0.15);
    expect(lci.tax).toBe(0);
    expect(cdb.net).toBeCloseTo(cdb.gross - (cdb.gross - 10000) * 0.15, 2);
    // 92% isento em 2 anos equivale a 92 / 0,85 ≈ 108,2% do CDI tributado
    expect(taxedEquivalentCdiPercent(92, 24)).toBeCloseTo(108.24, 1);
  });
});
