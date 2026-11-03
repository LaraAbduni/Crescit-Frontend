import { useEffect, useState } from "react";

/**
 * Taxas de mercado usadas para estimar e simular a renda fixa. Vêm da API
 * pública do Banco Central (SGS); se ela não responder, ficam os valores padrão.
 */
export interface MarketRates {
  /** CDI anualizado (fração: 0.1365 = 13,65% a.a.) */
  cdi: number;
  /** Meta da Selic definida pelo Copom */
  selic: number;
  /** IPCA acumulado em 12 meses */
  ipca: number;
  source: "bcb" | "fallback";
  /** Data da última taxa do CDI, dd/mm/aaaa */
  date?: string;
}

export const FALLBACK_RATES: MarketRates = { cdi: 0.14, selic: 0.14, ipca: 0.045, source: "fallback" };

// Séries do SGS: 4389 = CDI anualizado (base 252), 432 = meta Selic, 13522 = IPCA em 12 meses
const SERIES = { cdi: 4389, selic: 432, ipca: 13522 } as const;
const sgsUrl = (serie: number) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;

let current: MarketRates = FALLBACK_RATES;
let settled = false;
let pending: Promise<MarketRates> | undefined;

/** Taxas em uso agora (as do Banco Central, depois de carregadas). */
export const marketRates = () => current;

async function fetchSeries(serie: number): Promise<{ value: number; date: string } | null> {
  try {
    const res = await fetch(sgsUrl(serie), { signal: AbortSignal.timeout(5000), credentials: "omit" });
    if (!res.ok) return null;
    const [last] = (await res.json()) as { data: string; valor: string }[];
    const value = Number(last?.valor);
    return Number.isFinite(value) ? { value: value / 100, date: last.data } : null;
  } catch {
    return null;
  }
}

/** Busca as taxas uma vez por sessão. Nunca falha: sem resposta, mantém as padrão. */
export function loadMarketRates(): Promise<MarketRates> {
  if (typeof window === "undefined") return Promise.resolve(current);
  pending ??= Promise.all([fetchSeries(SERIES.cdi), fetchSeries(SERIES.selic), fetchSeries(SERIES.ipca)]).then(
    ([cdi, selic, ipca]) => {
      const cdiOk = cdi && cdi.value > 0 ? cdi : null;
      current = {
        cdi: cdiOk?.value ?? FALLBACK_RATES.cdi,
        selic: selic && selic.value > 0 ? selic.value : FALLBACK_RATES.selic,
        ipca: ipca?.value ?? FALLBACK_RATES.ipca,
        source: cdiOk ? "bcb" : "fallback",
        date: cdiOk?.date,
      };
      settled = true;
      return current;
    },
  );
  return pending;
}

/** Taxas para a tela; `ready` vira true quando a busca termina (com ou sem sucesso). */
export function useMarketRates() {
  const [state, setState] = useState({ rates: current, ready: settled });
  useEffect(() => {
    if (settled) return;
    let active = true;
    void loadMarketRates().then((rates) => active && setState({ rates, ready: true }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}

const precise = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "CDI de 13,65% ao ano (Banco Central, 30/10/2026)" ou, sem a API, "CDI de referência de 14,00% ao ano". */
export function cdiText(rates: MarketRates = current) {
  return rates.source === "bcb"
    ? `CDI de ${precise.format(rates.cdi)} ao ano (Banco Central, ${rates.date})`
    : `CDI de referência de ${precise.format(rates.cdi)} ao ano`;
}

export const ratePct = (fraction: number) => precise.format(fraction);
