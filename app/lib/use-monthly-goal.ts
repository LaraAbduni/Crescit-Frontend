import { useEffect, useState } from "react";
import { MONTHLY_AMOUNT_DEFAULT } from "./analysis";
import { useOnboarding } from "./onboarding";

const goalKey = (userId: string) => `crescit:meta-mensal:${userId}`;

/**
 * Quanto a pessoa pretende investir por mês. Fica no navegador; até ela
 * definir, usa a faixa escolhida no cadastro (ou R$ 1.000).
 */
export function useMonthlyGoal(userId: string) {
  const { context } = useOnboarding();
  const [goal, setGoal] = useState(MONTHLY_AMOUNT_DEFAULT[context?.monthlyAmount ?? ""] ?? 1000);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(goalKey(userId)));
      if (saved > 0) setGoal(saved);
    } catch {}
  }, [userId]);
  const save = (value: number) => {
    setGoal(value);
    try {
      localStorage.setItem(goalKey(userId), String(value));
    } catch {}
  };
  return [goal, save] as const;
}
