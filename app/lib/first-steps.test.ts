import { describe, expect, it } from "vitest";
import { projection, reservePlan } from "./first-steps";

describe("primeiros passos", () => {
  it("calcula a reserva de 6 meses de gastos e quanto tempo leva", () => {
    expect(reservePlan(3000, 4000, 1000)).toEqual({ target: 18000, missing: 14000, progress: 4000 / 18000, monthsToGoal: 14 });
  });

  it("considera a reserva completa sem pedir mais aportes", () => {
    expect(reservePlan(2000, 15000, 500)).toMatchObject({ missing: 0, progress: 1, monthsToGoal: 0 });
  });

  it("não inventa prazo sem aporte mensal", () => {
    expect(reservePlan(2000, 0, 0).monthsToGoal).toBeNull();
  });

  it("simula aportes mensais com juros compostos", () => {
    expect(projection(1000, 1, 0)).toEqual({ invested: 12000, value: 12000 });
    const { invested, value } = projection(1000, 10, 0.1);
    expect(invested).toBe(120000);
    expect(value).toBeGreaterThan(190000);
    expect(value).toBeLessThan(210000);
  });
});
