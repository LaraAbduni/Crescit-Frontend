import { describe, expect, it } from "vitest";
import { evaluateAlert, sortStatuses, triggerPrice, type PriceAlert } from "./price-alerts";

const alert = (partial: Partial<PriceAlert>): PriceAlert => ({
  id: "a", ticker: "BOVA11", assetName: "iShares Ibovespa", assetType: "ETF", direction: "sell-up",
  percent: 0.05, basePrice: 100, createdAt: "2026-10-03", ...partial,
});

describe("avisos de preço", () => {
  it("calcula o preço do gatilho para cima (venda) e para baixo (compra)", () => {
    expect(triggerPrice(alert({ direction: "sell-up", percent: 0.1 }))).toBeCloseTo(110);
    expect(triggerPrice(alert({ direction: "buy-down", percent: 0.1 }))).toBeCloseTo(90);
  });

  it("dispara o lembrete de venda quando sobe a porcentagem pedida, inclusive no valor exato", () => {
    expect(evaluateAlert(alert({}), 106)).toMatchObject({ triggered: true, progress: 1 });
    expect(evaluateAlert(alert({}), 105).triggered).toBe(true);
    const halfway = evaluateAlert(alert({}), 102.5);
    expect(halfway.triggered).toBe(false);
    expect(halfway.progress).toBeCloseTo(0.5);
    expect(halfway.change).toBeCloseTo(0.025);
  });

  it("dispara o aviso de compra só quando cai; subir não conta como progresso", () => {
    const buy = alert({ direction: "buy-down", percent: 0.05 });
    expect(evaluateAlert(buy, 94).triggered).toBe(true);
    expect(evaluateAlert(buy, 98).progress).toBeCloseTo(0.4);
    expect(evaluateAlert(buy, 120)).toMatchObject({ triggered: false, progress: 0 });
  });

  it("sem preço no catálogo, não dispara nem calcula variação", () => {
    const s = evaluateAlert(alert({}), undefined);
    expect(s.triggered).toBe(false);
    expect(s.change).toBeUndefined();
  });

  it("ordena com os disparados primeiro e depois os mais perto do gatilho", () => {
    const statuses = [
      evaluateAlert(alert({ id: "longe" }), 101),
      evaluateAlert(alert({ id: "disparado" }), 107),
      evaluateAlert(alert({ id: "perto" }), 104),
    ];
    expect(sortStatuses(statuses).map((s) => s.alert.id)).toEqual(["disparado", "perto", "longe"]);
  });
});
