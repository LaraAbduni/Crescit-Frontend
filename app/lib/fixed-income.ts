import { qty } from "./format";

/** Valores do enum RateType do Serviço de Portfólio. */
export type RateType = "CDI_PERCENT" | "PREFIXED" | "IPCA_PLUS";

export const RATE_TYPE_LABEL: Record<RateType, string> = {
  CDI_PERCENT: "% do CDI",
  PREFIXED: "Prefixado",
  IPCA_PLUS: "IPCA +",
};

// Taxas de referência usadas só para ESTIMAR o valor atual da renda fixa.
// Não são cotações em tempo real; a tela sempre diz que o valor é estimado.
export const CDI_REFERENCE = 0.14;
export const IPCA_REFERENCE = 0.045;

/** Taxa anual equivalente, como fração (0.154 = 15,4% a.a.). */
export function annualRate(type: RateType, value: number) {
  if (type === "CDI_PERCENT") return CDI_REFERENCE * (value / 100);
  if (type === "PREFIXED") return value / 100;
  return (1 + IPCA_REFERENCE) * (1 + value / 100) - 1;
}

/** "110% do CDI", "12,5% a.a.", "IPCA + 6% a.a." */
export function rateLabel(type: RateType, value: number) {
  if (type === "CDI_PERCENT") return `${qty(value)}% do CDI`;
  if (type === "PREFIXED") return `${qty(value)}% a.a.`;
  return `IPCA + ${qty(value)}% a.a.`;
}

const DAY = 86_400_000;
const toTime = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/**
 * Valor bruto estimado hoje (sem IR): cada aplicação rende pela taxa desde a
 * própria data, com juros compostos em dias corridos.
 */
export function estimateValue(
  contributions: { amount: number; contributionDate: string }[],
  type: RateType,
  value: number,
  todayISO: string,
) {
  const rate = annualRate(type, value);
  const today = toTime(todayISO);
  return contributions.reduce((acc, c) => {
    const days = Math.max((today - toTime(c.contributionDate)) / DAY, 0);
    return acc + c.amount * (1 + rate) ** (days / 365);
  }, 0);
}

/** Alíquota de IR da tabela regressiva da renda fixa, pelo prazo em dias. */
export function incomeTaxRate(days: number) {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

/** LCI, LCA, CRI e CRA são isentos de IR para pessoa física; reconhecidos pelo nome. */
export const isTaxExempt = (name: string) => /\b(LCI|LCA|CRI|CRA)\b/i.test(name);

/**
 * Valor líquido estimado hoje: o IR incide só sobre o rendimento de cada
 * aplicação, com a alíquota do prazo dela. Isentos não pagam IR.
 */
export function estimateNetValue(
  contributions: { amount: number; contributionDate: string }[],
  type: RateType,
  value: number,
  todayISO: string,
  exempt: boolean,
) {
  const today = toTime(todayISO);
  return contributions.reduce((acc, c) => {
    const gross = estimateValue([c], type, value, todayISO);
    const days = Math.max((today - toTime(c.contributionDate)) / DAY, 0);
    const tax = exempt ? 0 : (gross - c.amount) * incomeTaxRate(days);
    return acc + gross - tax;
  }, 0);
}

export interface FixedIncomeOption {
  rateType: RateType;
  rateValue: number;
  exempt: boolean;
}

export interface Simulation {
  gross: number;
  tax: number;
  net: number;
  /** Rentabilidade líquida equivalente ao ano */
  netAnnual: number;
  taxRate: number;
}

/** Quanto um valor aplicado hoje vira no fim do prazo, antes e depois do IR. */
export function simulate(option: FixedIncomeOption, amount: number, months: number): Simulation {
  const years = months / 12;
  const gross = amount * (1 + annualRate(option.rateType, option.rateValue)) ** years;
  const taxRate = option.exempt ? 0 : incomeTaxRate(Math.round(years * 365));
  const tax = (gross - amount) * taxRate;
  const net = gross - tax;
  return { gross, tax, net, taxRate, netAnnual: amount > 0 && years > 0 ? (net / amount) ** (1 / years) - 1 : 0 };
}

/**
 * Percentual do CDI que um CDB (tributado) precisa pagar para empatar com uma
 * aplicação isenta de X% do CDI no mesmo prazo.
 */
export function taxedEquivalentCdiPercent(exemptCdiPercent: number, months: number) {
  return exemptCdiPercent / (1 - incomeTaxRate(Math.round((months / 12) * 365)));
}
