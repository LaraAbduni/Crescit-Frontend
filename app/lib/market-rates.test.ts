import { afterEach, describe, expect, it, vi } from "vitest";

// O módulo guarda as taxas da sessão: cada teste carrega uma cópia nova
async function freshModules() {
  vi.resetModules();
  return { rates: await import("./market-rates"), fixed: await import("./fixed-income") };
}

const sgs = (valor: string, data = "30/10/2026") => new Response(JSON.stringify([{ data, valor }]), { status: 200 });

describe("taxas do Banco Central", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("usa CDI, Selic e IPCA da API e passa a estimar a renda fixa com eles", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(url.includes("sgs.4389") ? sgs("13.65") : url.includes("sgs.432") ? sgs("13.75") : sgs("4.58")),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { rates, fixed } = await freshModules();

    expect(fixed.annualRate("CDI_PERCENT", 100)).toBeCloseTo(0.14);
    const loaded = await rates.loadMarketRates();
    expect(loaded).toMatchObject({ cdi: 0.1365, selic: 0.1375, ipca: 0.0458, source: "bcb", date: "30/10/2026" });
    expect(fixed.annualRate("CDI_PERCENT", 100)).toBeCloseTo(0.1365);
    expect(fixed.annualRate("IPCA_PLUS", 6)).toBeCloseTo(1.0458 * 1.06 - 1);
    expect(rates.cdiText()).toBe("CDI de 13,65% ao ano (Banco Central, 30/10/2026)");

    // Uma busca por sessão
    await rates.loadMarketRates();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("sem resposta da API, mantém as taxas padrão e avisa que são de referência", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    const { rates, fixed } = await freshModules();

    expect(await rates.loadMarketRates()).toEqual(rates.FALLBACK_RATES);
    expect(fixed.annualRate("CDI_PERCENT", 100)).toBeCloseTo(0.14);
    expect(rates.cdiText()).toBe("CDI de referência de 14,00% ao ano");
  });

  it("ignora um CDI inválido mesmo se as outras séries responderem", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("sgs.4389") ? sgs("abc") : sgs("13.75"))));
    const { rates } = await freshModules();

    const loaded = await rates.loadMarketRates();
    expect(loaded.cdi).toBe(0.14);
    expect(loaded.source).toBe("fallback");
    expect(loaded.selic).toBeCloseTo(0.1375);
  });
});
