// Análise da carteira: comparação com uma carteira de referência por perfil,
// sugestão de onde colocar o próximo aporte, alertas e evolução mês a mês.
// Tudo calculado no front a partir do resumo da carteira (loadPortfolio).

import { NO_INSTITUTION } from "./institutions";
import { displayName, ALLOCATION_ORDER, type PortfolioSummary } from "./portfolio";
import type { InvestorType } from "./profile";
import type { AssetType } from "./recommendations";

/**
 * Carteira de referência do Crescit para cada perfil, em fração do patrimônio.
 * É um ponto de partida educativo (não uma recomendação individual), alinhado
 * aos níveis de risco que cada perfil aceita.
 */
export const TARGET_ALLOCATION: Record<InvestorType, Record<AssetType, number>> = {
  CONSERVATIVE: { FIXED_INCOME: 0.8, FUND: 0.1, FII: 0.05, ETF: 0.05, STOCK: 0 },
  MODERATE: { FIXED_INCOME: 0.5, FUND: 0.1, FII: 0.15, ETF: 0.15, STOCK: 0.1 },
  AGGRESSIVE: { FIXED_INCOME: 0.25, FUND: 0.1, FII: 0.15, ETF: 0.25, STOCK: 0.25 },
};

export interface AllocationGap {
  type: AssetType;
  current: number;
  currentShare: number;
  targetShare: number;
  /** Positivo: falta; negativo: sobra (em R$, para chegar à referência hoje) */
  gap: number;
}

/** Quanto cada tipo de ativo representa hoje e quanto deveria representar. */
export function compareAllocation(summary: PortfolioSummary, investorType: InvestorType): AllocationGap[] {
  const target = TARGET_ALLOCATION[investorType];
  const total = summary.currentValue;
  return ALLOCATION_ORDER.map((type) => {
    const current = summary.allocation.find((a) => a.type === type)?.value ?? 0;
    return {
      type,
      current,
      currentShare: total > 0 ? current / total : 0,
      targetShare: target[type],
      gap: total * target[type] - current,
    };
  }).filter((g) => g.targetShare > 0 || g.current > 0);
}

/**
 * Divide um novo aporte entre os tipos que estão abaixo da referência, na
 * proporção do que falta para cada um chegar lá (considerando o aporte).
 * Nunca sugere vender: quem está acima da referência só não recebe aporte.
 */
export function suggestContribution(
  summary: PortfolioSummary,
  investorType: InvestorType,
  amount: number,
): { type: AssetType; amount: number }[] {
  if (!(amount > 0)) return [];
  const target = TARGET_ALLOCATION[investorType];
  const totalAfter = summary.currentValue + amount;
  const deficits = ALLOCATION_ORDER.map((type) => {
    const current = summary.allocation.find((a) => a.type === type)?.value ?? 0;
    return { type, deficit: Math.max(totalAfter * target[type] - current, 0) };
  }).filter((d) => d.deficit > 0);
  const totalDeficit = deficits.reduce((acc, d) => acc + d.deficit, 0);
  if (totalDeficit === 0) return [];
  // Arredonda para múltiplos de R$ 10 e joga a diferença no maior pedaço
  const split = deficits.map((d) => ({ type: d.type, amount: Math.floor((amount * d.deficit) / totalDeficit / 10) * 10 }));
  const rest = amount - split.reduce((acc, s) => acc + s.amount, 0);
  const largest = split.reduce((a, b) => (b.amount > a.amount ? b : a));
  largest.amount += rest;
  return split.filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount);
}

export type AlertLevel = "warning" | "info";

export interface PortfolioAlert {
  id: string;
  level: AlertLevel;
  title: string;
  text: string;
}

/** Limite de garantia do FGC por CPF e por instituição. */
export const FGC_LIMIT = 250_000;

const DAY = 86_400_000;
const toTime = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Pontos de atenção na carteira, do mais importante para o menos. */
export function portfolioAlerts(summary: PortfolioSummary, today: string): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];
  const total = summary.currentValue;
  if (total <= 0) return alerts;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // FGC: CDB, LCI e LCA de um mesmo banco acima de R$ 250 mil ficam sem garantia
  const fixedByInstitution = new Map<string, number>();
  for (const h of summary.holdings) {
    if (h.assetType !== "FIXED_INCOME" || !h.amountBased || !h.institution) continue;
    fixedByInstitution.set(h.institution, (fixedByInstitution.get(h.institution) ?? 0) + h.currentValue);
  }
  for (const [institution, value] of fixedByInstitution) {
    if (value > FGC_LIMIT) {
      alerts.push({
        id: `fgc-${institution}`,
        level: "warning",
        title: `Renda fixa acima do FGC no ${institution}`,
        text: `São ${brl(value)} em renda fixa nesse banco. O FGC garante até ${brl(FGC_LIMIT)} por instituição; vale distribuir o excedente em outro emissor.`,
      });
    }
  }

  // Vencimentos nos próximos 60 dias
  const now = toTime(today);
  for (const h of summary.holdings) {
    if (!h.maturityDate || h.totalInvested <= 0) continue;
    const days = Math.round((toTime(h.maturityDate) - now) / DAY);
    if (days >= 0 && days <= 60) {
      const [y, m, d] = h.maturityDate.split("-");
      alerts.push({
        id: `vencimento-${h.id}`,
        level: "info",
        title: `${displayName(h)} vence em ${d}/${m}/${y}`,
        text: days === 0 ? "Vence hoje. Planeje onde reinvestir o valor resgatado." : `Faltam ${days} dias. Planeje onde reinvestir o valor resgatado.`,
      });
    }
  }

  // Concentração em uma instituição (só faz sentido com patrimônio relevante)
  const institutions = summary.byInstitution.filter((i) => i.value > 0);
  const top = institutions[0];
  if (top && top.institution !== NO_INSTITUTION && top.share > 0.7 && summary.holdings.length > 1) {
    alerts.push({
      id: "concentracao-instituicao",
      level: "info",
      title: `${Math.round(top.share * 100)}% do patrimônio está no ${top.institution}`,
      text: "Ter mais de uma instituição reduz o risco de depender de um único banco ou corretora.",
    });
  }

  // Concentração em um único ativo de renda variável
  for (const h of summary.holdings) {
    if (h.assetType === "FIXED_INCOME" || h.assetType === "FUND") continue;
    const share = h.currentValue / total;
    if (share > 0.3) {
      alerts.push({
        id: `concentracao-${h.id}`,
        level: "warning",
        title: `${displayName(h)} é ${Math.round(share * 100)}% da carteira`,
        text: "Um único ativo de renda variável com esse peso deixa a carteira muito exposta às oscilações dele.",
      });
    }
  }

  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "warning" ? -1 : 1));
}

export interface MonthRow {
  /** yyyy-mm */
  month: string;
  /** Soma dos aportes no mês */
  contributed: number;
  /** Total investido acumulado até o fim do mês */
  invested: number;
  count: number;
}

/** Aportes e total investido mês a mês, do primeiro aporte até o mês atual. */
export function monthlyHistory(summary: PortfolioSummary, today: string): MonthRow[] {
  const contributions = summary.recentContributions;
  if (contributions.length === 0) return [];
  const byMonth = new Map<string, { contributed: number; count: number }>();
  for (const c of contributions) {
    const month = c.contributionDate.slice(0, 7);
    const entry = byMonth.get(month) ?? { contributed: 0, count: 0 };
    byMonth.set(month, { contributed: entry.contributed + c.amount, count: entry.count + 1 });
  }
  const first = [...byMonth.keys()].sort()[0];
  const last = today.slice(0, 7);
  const rows: MonthRow[] = [];
  let invested = 0;
  for (let month = first; month <= last; month = nextMonth(month)) {
    const entry = byMonth.get(month) ?? { contributed: 0, count: 0 };
    invested += entry.contributed;
    rows.push({ month, contributed: entry.contributed, invested, count: entry.count });
  }
  return rows;
}

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10" -> "outubro de 2026" (ou "out/26" no formato curto) */
export function monthLabel(month: string, short = false) {
  const [y, m] = month.split("-");
  const name = MONTH_NAMES[Number(m) - 1];
  return short ? `${name.slice(0, 3)}/${y.slice(2)}` : `${name} de ${y}`;
}

/** Valor sugerido para a meta mensal a partir da faixa escolhida no cadastro. */
export const MONTHLY_AMOUNT_DEFAULT: Record<string, number> = {
  ATE_500: 300,
  "500_2000": 1000,
  "2000_5000": 3000,
  ACIMA_5000: 5000,
};
