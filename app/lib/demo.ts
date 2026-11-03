// Carteiras de exemplo para a apresentação. Tudo passa pela API de verdade:
// o modo demonstração só cadastra, na conta logada, o que a pessoa cadastraria à mão.

import { planStorageKey } from "./first-steps";
import { goalsStorageKey, type Goal } from "./goals";
import { writeAlerts, type PriceAlert } from "./price-alerts";
import type { RateType } from "./fixed-income";
import type { FinancialContext } from "./onboarding";
import {
  addContribution,
  addInvestment,
  deleteInvestment,
  generatedTicker,
  listInvestments,
  type InvestmentRequest,
} from "./portfolio";
import type { InvestorType } from "./profile";
import type { AssetType } from "./recommendations";

export type PersonaId = "tres-bancos" | "iniciante";

interface DemoInvestment {
  institution: string;
  /** Ticker do catálogo; sem ele, é renda fixa ou fundo cadastrado por valor */
  ticker?: string;
  assetName: string;
  assetType: AssetType;
  rate?: { type: RateType; value: number };
  /** Vencimento, em dias a partir de hoje */
  maturityInDays?: number;
  /** monthsAgo: 0 = hoje. Para ativos da bolsa, quantity × unitPrice; para os demais, amount. */
  contributions: { monthsAgo: number; quantity?: number; unitPrice?: number; amount?: number }[];
}

export interface Persona {
  id: PersonaId;
  title: string;
  description: string;
  /** Perfil que o questionário deve dar para a história fazer sentido */
  expectedProfile: InvestorType;
  context: FinancialContext;
  monthlyGoal: number;
  firstSteps?: { expenses: string; saved: string; hasAccount: boolean };
  /** Objetivos da página Metas; o prazo é em meses a partir de hoje */
  goals: (Omit<Goal, "id" | "deadline"> & { monthsAhead: number })[];
  /** Avisos de preço (o id e a data são preenchidos na hora) */
  priceAlerts: Omit<PriceAlert, "id" | "createdAt">[];
  investments: DemoInvestment[];
}

export const PERSONAS: Record<PersonaId, Persona> = {
  "tres-bancos": {
    id: "tres-bancos",
    title: "Investe em três bancos",
    description: "CDB, LCI, fundo, ações, ETF e FIIs espalhados entre Itaú, BTG Pactual e Nubank, com aportes nos últimos 7 meses.",
    expectedProfile: "MODERATE",
    context: { banks: ["Itaú", "BTG Pactual", "Nubank"], monthlyAmount: "500_2000" },
    monthlyGoal: 1500,
    goals: [
      { kind: "reserva", name: "Reserva de emergência", target: 15000, saved: 15000, monthsAhead: 2 },
      { kind: "viagem", name: "Viagem para a Europa", target: 25000, saved: 8000, monthsAhead: 14 },
      { kind: "casa", name: "Entrada do apartamento", target: 80000, saved: 7000, monthsAhead: 48 },
    ],
    priceAlerts: [
      // Preço médio de BOVA11 nos aportes abaixo: R$ 123,80; no catálogo, R$ 131,20 (+6%): dispara
      { ticker: "BOVA11", assetName: "iShares Ibovespa", assetType: "ETF", direction: "sell-up", percent: 0.05, basePrice: 123.8 },
      { ticker: "HGLG11", assetName: "CSHG Logística", assetType: "FII", direction: "sell-up", percent: 0.1, basePrice: 151.3 },
      // Criado quando WEGE3 valia R$ 43,50; no catálogo, R$ 41,20 (−5,3%): dispara
      { ticker: "WEGE3", assetName: "WEG ON", assetType: "STOCK", direction: "buy-down", percent: 0.05, basePrice: 43.5 },
      { ticker: "IVVB11", assetName: "iShares S&P 500", assetType: "ETF", direction: "buy-down", percent: 0.08, basePrice: 342.5 },
    ],
    investments: [
      {
        institution: "Itaú",
        assetName: "CDB Itaú 102% CDI",
        assetType: "FIXED_INCOME",
        rate: { type: "CDI_PERCENT", value: 102 },
        maturityInDays: 730,
        contributions: [{ monthsAgo: 6, amount: 5000 }, { monthsAgo: 3, amount: 3000 }],
      },
      {
        institution: "Itaú",
        ticker: "ITUB4",
        assetName: "Itaú Unibanco PN",
        assetType: "STOCK",
        contributions: [{ monthsAgo: 4, quantity: 100, unitPrice: 34.2 }],
      },
      {
        institution: "BTG Pactual",
        assetName: "CDB BTG Prefixado",
        assetType: "FIXED_INCOME",
        rate: { type: "PREFIXED", value: 13 },
        // Vence em menos de 60 dias: aparece nos pontos de atenção
        maturityInDays: 45,
        contributions: [{ monthsAgo: 7, amount: 4000 }],
      },
      {
        institution: "BTG Pactual",
        ticker: "BOVA11",
        assetName: "iShares Ibovespa",
        assetType: "ETF",
        contributions: [{ monthsAgo: 6, quantity: 30, unitPrice: 122.4 }, { monthsAgo: 2, quantity: 10, unitPrice: 128 }],
      },
      {
        institution: "BTG Pactual",
        ticker: "PETR4",
        assetName: "Petrobras PN",
        assetType: "STOCK",
        // Comprada mais cara que o preço atual: mostra um ativo no prejuízo
        contributions: [{ monthsAgo: 5, quantity: 80, unitPrice: 38.9 }],
      },
      {
        institution: "BTG Pactual",
        ticker: "HGLG11",
        assetName: "CSHG Logística",
        assetType: "FII",
        contributions: [{ monthsAgo: 3, quantity: 15, unitPrice: 151.3 }],
      },
      {
        institution: "Nubank",
        assetName: "LCI Nubank 94% CDI",
        assetType: "FIXED_INCOME",
        rate: { type: "CDI_PERCENT", value: 94 },
        maturityInDays: 365,
        contributions: [{ monthsAgo: 2, amount: 3000 }],
      },
      {
        institution: "Nubank",
        assetName: "Nu Reserva Planejada",
        assetType: "FUND",
        contributions: [{ monthsAgo: 5, amount: 2000 }, { monthsAgo: 1, amount: 1000 }],
      },
      {
        institution: "Nubank",
        ticker: "MXRF11",
        assetName: "Maxi Renda",
        assetType: "FII",
        // Aporte deste mês: a meta mensal aparece parcialmente cumprida
        contributions: [{ monthsAgo: 0, quantity: 50, unitPrice: 9.4 }],
      },
    ],
  },
  iniciante: {
    id: "iniciante",
    title: "Nunca investiu",
    description: "Carteira vazia, sem conta em banco ou corretora, R$ 300 por mês e uma reserva de emergência começando.",
    expectedProfile: "CONSERVATIVE",
    context: { banks: ["Nenhuma"], monthlyAmount: "ATE_500" },
    monthlyGoal: 300,
    firstSteps: { expenses: "2500", saved: "2000", hasAccount: false },
    goals: [{ kind: "reserva", name: "Reserva de emergência", target: 15000, saved: 2000, monthsAhead: 36 }],
    priceAlerts: [],
    investments: [],
  },
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Mesma data de hoje, N meses atrás (dia limitado a 28 para existir em todo mês). */
export function monthsAgoISO(monthsAgo: number, today = new Date()) {
  if (monthsAgo === 0) return iso(today);
  return iso(new Date(today.getFullYear(), today.getMonth() - monthsAgo, Math.min(today.getDate(), 28)));
}

export function daysFromTodayISO(days: number, today = new Date()) {
  return iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
}

/** yyyy-mm daqui a N meses */
export function monthsAheadISO(months: number, today = new Date()) {
  return iso(new Date(today.getFullYear(), today.getMonth() + months, 1)).slice(0, 7);
}

export function toInvestmentRequest(inv: DemoInvestment, today = new Date()): InvestmentRequest {
  return {
    ticker: inv.ticker ?? generatedTicker(inv.assetType),
    assetName: inv.assetName,
    assetType: inv.assetType,
    institution: inv.institution,
    ...(inv.rate ? { rateType: inv.rate.type, rateValue: inv.rate.value } : {}),
    ...(inv.maturityInDays !== undefined ? { maturityDate: daysFromTodayISO(inv.maturityInDays, today) } : {}),
  };
}

/** Remove todos os investimentos (e aportes) da conta logada. */
export async function clearPortfolio(userId: string) {
  const investments = await listInvestments(userId);
  for (const inv of investments) await deleteInvestment(userId, inv.id);
}

/**
 * Troca a carteira da conta logada pela da persona e salva meta, objetivos,
 * contexto e primeiros passos neste navegador. `onProgress` recebe de 0 a 1.
 */
export async function applyPersona(
  userId: string,
  persona: Persona,
  setContext: (context: FinancialContext) => void,
  setGoal: (value: number) => void,
  onProgress: (done: number) => void = () => {},
) {
  await clearPortfolio(userId);
  const today = new Date();
  const steps = persona.investments.reduce((n, i) => n + 1 + i.contributions.length, 0) || 1;
  let done = 0;
  const step = () => onProgress(++done / steps);

  for (const inv of persona.investments) {
    const created = await addInvestment(userId, toInvestmentRequest(inv, today));
    step();
    for (const c of inv.contributions) {
      const byAmount = c.amount !== undefined;
      await addContribution(userId, created.id, {
        quantity: byAmount ? 1 : c.quantity!,
        unitPrice: byAmount ? c.amount! : c.unitPrice!,
        contributionDate: monthsAgoISO(c.monthsAgo, today),
      });
      step();
    }
  }

  setContext(persona.context);
  setGoal(persona.monthlyGoal);
  try {
    if (persona.firstSteps) localStorage.setItem(planStorageKey(userId), JSON.stringify(persona.firstSteps));
    else localStorage.removeItem(planStorageKey(userId));
    const goals: Goal[] = persona.goals.map(({ monthsAhead, ...g }, i) => ({ ...g, id: `demo-${i}`, deadline: monthsAheadISO(monthsAhead, today) }));
    localStorage.setItem(goalsStorageKey(userId), JSON.stringify(goals));
  } catch {}
  writeAlerts(userId, persona.priceAlerts.map((a, i) => ({ ...a, id: `demo-${i}`, createdAt: monthsAgoISO(1, today) })));
  onProgress(1);
}
