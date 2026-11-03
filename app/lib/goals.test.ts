import { describe, expect, it } from "vitest";
import { goalProgress, goalRate, monthlyNeeded, monthsUntil } from "./goals";

describe("metas e objetivos", () => {
  it("conta os meses até o prazo, sem ficar negativo", () => {
    expect(monthsUntil("2027-11", "2026-11-03")).toBe(12);
    expect(monthsUntil("2026-12", "2026-11-30")).toBe(1);
    expect(monthsUntil("2026-11", "2026-11-03")).toBe(0);
    expect(monthsUntil("2025-01", "2026-11-03")).toBe(0);
  });

  it("sem rendimento, divide o que falta pelos meses", () => {
    expect(monthlyNeeded({ target: 12000, saved: 0, deadline: "2027-11" }, "2026-11-03", 0)).toBeCloseTo(1000);
  });

  it("com rendimento, precisa guardar menos por mês", () => {
    const need = monthlyNeeded({ target: 12000, saved: 0, deadline: "2027-11" }, "2026-11-03", 0.12);
    expect(need).toBeLessThan(1000);
    // Conferência: 12 depósitos de `need` a ~0,949% ao mês chegam a 12 mil
    const i = 1.12 ** (1 / 12) - 1;
    expect((need * ((1 + i) ** 12 - 1)) / i).toBeCloseTo(12000, 2);
  });

  it("não pede nada se o já guardado alcança sozinho ou se a meta foi batida", () => {
    expect(monthlyNeeded({ target: 1000, saved: 1000, deadline: "2027-01" }, "2026-11-03", 0.1)).toBe(0);
    expect(monthlyNeeded({ target: 1100, saved: 1000, deadline: "2028-11" }, "2026-11-03", 0.1)).toBe(0);
  });

  it("no mês do prazo, falta tudo de uma vez", () => {
    expect(monthlyNeeded({ target: 5000, saved: 2000, deadline: "2026-11" }, "2026-11-03", 0.1)).toBe(3000);
  });

  it("usa renda fixa nos prazos curtos e a média do perfil nos longos", () => {
    expect(goalRate(12, "AGGRESSIVE")).toBeCloseTo(0.14 * 0.825);
    expect(goalRate(36, "AGGRESSIVE")).toBe(0.12);
  });

  it("limita o progresso entre 0 e 100%", () => {
    expect(goalProgress({ target: 100, saved: 150 })).toBe(1);
    expect(goalProgress({ target: 0, saved: 10 })).toBe(0);
  });
});
