// Plano de primeiros passos para quem nunca investiu: reserva de emergência,
// primeiro aporte e uma simulação de onde dá para chegar.

import type { InvestorType } from "./profile";

/** Quantos meses de gastos a reserva de emergência deve cobrir. */
export const RESERVE_MONTHS = 6;

export interface ReservePlan {
  target: number;
  missing: number;
  progress: number;
  /** Meses para completar investindo o valor mensal; 0 se já está completa, null se não há aporte */
  monthsToGoal: number | null;
}

export function reservePlan(monthlyExpenses: number, saved: number, monthly: number): ReservePlan {
  const target = Math.max(monthlyExpenses, 0) * RESERVE_MONTHS;
  const missing = Math.max(target - Math.max(saved, 0), 0);
  return {
    target,
    missing,
    progress: target > 0 ? Math.min(Math.max(saved, 0) / target, 1) : 0,
    monthsToGoal: missing === 0 ? 0 : monthly > 0 ? Math.ceil(missing / monthly) : null,
  };
}

/**
 * Rentabilidade média anual usada só na simulação. Não é promessa de retorno:
 * a tela sempre mostra a taxa usada e avisa que é uma simulação.
 */
export const SIMULATION_RATE: Record<InvestorType, number> = {
  CONSERVATIVE: 0.1,
  MODERATE: 0.11,
  AGGRESSIVE: 0.12,
};

/** Aporte mensal fixo, com juros compostos mês a mês (aporte no fim de cada mês). */
export function projection(monthly: number, years: number, annualRate: number) {
  const months = years * 12;
  const r = (1 + annualRate) ** (1 / 12) - 1;
  const value = r === 0 ? monthly * months : monthly * (((1 + r) ** months - 1) / r);
  return { invested: monthly * months, value };
}
