import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./portfolio", async (original) => ({
  ...(await original<typeof import("./portfolio")>()),
  listInvestments: vi.fn(async () => [{ id: "old-1" }, { id: "old-2" }]),
  deleteInvestment: vi.fn(async () => undefined),
  addInvestment: vi.fn(async (_userId: string, req: { ticker: string }) => ({ id: `inv-${req.ticker}`, ticker: req.ticker })),
  addContribution: vi.fn(async () => ({})),
}));

import { applyPersona, monthsAgoISO, PERSONAS, toInvestmentRequest } from "./demo";
import { addContribution, addInvestment, deleteInvestment } from "./portfolio";

describe("modo demonstração", () => {
  afterEach(() => localStorage.clear());

  it("calcula datas no passado sem cair em dia inexistente", () => {
    const today = new Date(2026, 2, 31); // 31/03/2026
    expect(monthsAgoISO(0, today)).toBe("2026-03-31");
    expect(monthsAgoISO(1, today)).toBe("2026-02-28");
    expect(monthsAgoISO(4, today)).toBe("2025-11-28");
  });

  it("monta renda fixa com taxa e vencimento, e ativos da bolsa com o ticker do catálogo", () => {
    const today = new Date(2026, 10, 3);
    const [cdb, itub] = PERSONAS["tres-bancos"].investments;
    expect(toInvestmentRequest(cdb, today)).toMatchObject({
      assetType: "FIXED_INCOME", institution: "Itaú", rateType: "CDI_PERCENT", rateValue: 102, maturityDate: "2028-11-02",
    });
    expect(toInvestmentRequest(cdb, today).ticker).toMatch(/^RF-[A-Z0-9]{6}$/);
    expect(toInvestmentRequest(itub, today)).toEqual({ ticker: "ITUB4", assetName: "Itaú Unibanco PN", assetType: "STOCK", institution: "Itaú" });
  });

  it("apaga a carteira atual, cadastra a da persona e salva meta e contexto", async () => {
    const persona = PERSONAS["tres-bancos"];
    const setContext = vi.fn();
    const setGoal = vi.fn();
    const progress: number[] = [];

    await applyPersona("user-1", persona, setContext, setGoal, (p) => progress.push(p));

    expect(deleteInvestment).toHaveBeenCalledTimes(2);
    expect(addInvestment).toHaveBeenCalledTimes(persona.investments.length);
    const contributions = persona.investments.reduce((n, i) => n + i.contributions.length, 0);
    expect(addContribution).toHaveBeenCalledTimes(contributions);
    // Renda fixa e fundo vão como quantidade 1 × valor, igual ao formulário
    expect(vi.mocked(addContribution).mock.calls[0][2]).toMatchObject({ quantity: 1, unitPrice: 5000 });
    expect(setContext).toHaveBeenCalledWith(persona.context);
    expect(setGoal).toHaveBeenCalledWith(1500);
    expect(progress.at(-1)).toBe(1);
    const goals = JSON.parse(localStorage.getItem("crescit:objetivos:user-1")!);
    expect(goals).toHaveLength(3);
    expect(goals[1]).toMatchObject({ name: "Viagem para a Europa", target: 25000 });
    expect(goals[1].deadline).toMatch(/^\d{4}-\d{2}$/);
    const alerts = JSON.parse(localStorage.getItem("crescit:avisos:user-1")!);
    expect(alerts.map((a: { ticker: string }) => a.ticker)).toEqual(["BOVA11", "HGLG11", "WEGE3", "IVVB11"]);
  });

  it("a persona iniciante fica com a carteira vazia e o plano de primeiros passos preenchido", async () => {
    await applyPersona("user-2", PERSONAS.iniciante, vi.fn(), vi.fn());
    expect(addInvestment).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("crescit:primeiros-passos:user-2")!)).toMatchObject({ expenses: "2500", hasAccount: false });
  });
});
