// Objetivos com prazo (viagem, reserva, entrada da casa…): quanto falta e
// quanto guardar por mês para chegar lá. Ficam salvos neste navegador.

import { useEffect, useState } from "react";
import { SIMULATION_RATE } from "./first-steps";
import { marketRates } from "./market-rates";
import type { InvestorType } from "./profile";

export type GoalKind = "reserva" | "viagem" | "casa" | "carro" | "estudos" | "aposentadoria" | "outro";

export interface Goal {
  id: string;
  kind: GoalKind;
  name: string;
  target: number;
  /** Quanto já está guardado para este objetivo */
  saved: number;
  /** yyyy-mm */
  deadline: string;
}

export const GOAL_KINDS: { kind: GoalKind; label: string; emoji: string }[] = [
  { kind: "reserva", label: "Reserva de emergência", emoji: "🛟" },
  { kind: "viagem", label: "Viagem", emoji: "✈️" },
  { kind: "casa", label: "Entrada da casa", emoji: "🏠" },
  { kind: "carro", label: "Carro", emoji: "🚗" },
  { kind: "estudos", label: "Estudos", emoji: "🎓" },
  { kind: "aposentadoria", label: "Aposentadoria", emoji: "🌴" },
  { kind: "outro", label: "Outro", emoji: "⭐" },
];

export const goalEmoji = (kind: GoalKind) => GOAL_KINDS.find((k) => k.kind === kind)?.emoji ?? "⭐";

export const goalsStorageKey = (userId: string) => `crescit:objetivos:${userId}`;

/** Meses inteiros entre o mês de hoje e o mês do prazo (0 se o prazo é este mês ou já passou). */
export function monthsUntil(deadline: string, today: string) {
  const [ty, tm] = today.split("-").map(Number);
  const [dy, dm] = deadline.split("-").map(Number);
  return Math.max((dy - ty) * 12 + (dm - tm), 0);
}

/**
 * Rentabilidade usada na conta: prazos de até 2 anos ficam na renda fixa
 * (100% do CDI, já descontado IR de 17,5%); prazos maiores usam a média
 * ilustrativa do perfil, a mesma dos Primeiros passos.
 */
export function goalRate(months: number, investorType: InvestorType) {
  return months <= 24 ? marketRates().cdi * (1 - 0.175) : SIMULATION_RATE[investorType];
}

/** Quanto guardar por mês, a partir de agora, para chegar ao valor no prazo. */
export function monthlyNeeded(goal: Pick<Goal, "target" | "saved" | "deadline">, today: string, annualRate: number) {
  const missing = goal.target - goal.saved;
  if (missing <= 0) return 0;
  const n = monthsUntil(goal.deadline, today);
  if (n === 0) return missing;
  const i = (1 + annualRate) ** (1 / 12) - 1;
  if (i === 0) return missing / n;
  const growth = (1 + i) ** n;
  const futureSaved = goal.saved * growth;
  if (futureSaved >= goal.target) return 0;
  return ((goal.target - futureSaved) * i) / (growth - 1);
}

export const goalProgress = (goal: Pick<Goal, "target" | "saved">) => (goal.target > 0 ? Math.min(Math.max(goal.saved / goal.target, 0), 1) : 0);

export function newGoalId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Objetivos da pessoa, guardados no navegador. */
export function useGoals(userId: string) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(goalsStorageKey(userId)) ?? "[]");
      setGoals(Array.isArray(saved) ? saved : []);
    } catch {
      setGoals([]);
    }
    setLoaded(true);
  }, [userId]);
  const save = (next: Goal[]) => {
    setGoals(next);
    try {
      localStorage.setItem(goalsStorageKey(userId), JSON.stringify(next));
    } catch {}
  };
  return { goals, loaded, save };
}
