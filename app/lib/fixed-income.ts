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
