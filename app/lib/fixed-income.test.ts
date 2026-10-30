import { describe, expect, it } from "vitest";
import { annualRate, CDI_REFERENCE, estimateValue, rateLabel } from "./fixed-income";

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
