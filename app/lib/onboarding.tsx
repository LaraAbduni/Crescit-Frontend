import { createContext, useContext, useEffect, useState } from "react";
import type { InvestorProfileResponse, Responses } from "./profile";

export interface Account {
  name: string;
  email: string;
}

/** Contexto financeiro coletado no cadastro (ainda não é enviado ao backend). */
export interface FinancialContext {
  banks: string[];
  monthlyAmount?: string;
}

interface OnboardingState {
  account?: Account;
  context?: FinancialContext;
  answers: Responses;
  profile?: InvestorProfileResponse;
}

interface OnboardingValue extends OnboardingState {
  /** false até o estado salvo ser lido do sessionStorage (no cliente). */
  ready: boolean;
  setAccount: (account: Account) => void;
  setContext: (context: FinancialContext) => void;
  setAnswers: (answers: Responses) => void;
  setProfile: (profile: InvestorProfileResponse) => void;
}

// v2: formato das respostas mudou com o questionário de suitability
const STORAGE_KEY = "crescit:onboarding:v2";
const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>({ answers: {} });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved));
    } catch {
      // sessionStorage indisponível: segue com o estado em memória
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // idem
    }
  }, [state, ready]);

  const value: OnboardingValue = {
    ...state,
    ready,
    setAccount: (account) => setState((s) => ({ ...s, account })),
    setContext: (context) => setState((s) => ({ ...s, context })),
    setAnswers: (answers) => setState((s) => ({ ...s, answers })),
    setProfile: (profile) => setState((s) => ({ ...s, profile })),
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding precisa estar dentro de OnboardingProvider");
  return ctx;
}
