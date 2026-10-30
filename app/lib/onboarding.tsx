import { useAuth0 } from "@auth0/auth0-react";
import { createContext, useContext, useEffect, useState } from "react";
import { apiErrorMessage } from "./api";
import { getProfile } from "./profile-api";
import type { InvestorProfileResponse, Responses } from "./profile";

export interface Account { name: string; email: string; }
/** Bancos e valor mensal do cadastro. Ficam neste navegador (não fazem parte do contrato das APIs). */
export interface FinancialContext { banks: string[]; monthlyAmount?: string; }
interface OnboardingState {
  userId?: string;
  account?: Account;
  context?: FinancialContext;
  answers: Responses;
  profile?: InvestorProfileResponse;
}
interface OnboardingValue extends OnboardingState {
  ready: boolean;
  error?: string;
  retry: () => void;
  clearDraft: () => void;
  setContext: (context: FinancialContext) => void;
  setAnswers: (answers: Responses) => void;
  setProfile: (profile: InvestorProfileResponse) => void;
}

const storageKey = (id: string) => `crescit:onboarding:v3:${id}`;
// O contexto fica salvo entre sessões: Análise, Carteira e Primeiros passos dependem dele
const contextKey = (id: string) => `crescit:contexto:v1:${id}`;
const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth0();
  const userId = isAuthenticated ? user?.sub : undefined;
  const [state, setState] = useState<OnboardingState>({ answers: {} });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(undefined);
    setState({ userId, answers: {} });
    if (!userId) {
      setLoaded(true);
      return;
    }
    let draft: Pick<OnboardingState, "answers" | "context"> = { answers: {} };
    try {
      const saved = sessionStorage.getItem(storageKey(userId));
      if (saved) {
        const parsed = JSON.parse(saved);
        draft = { answers: parsed.answers ?? {}, context: parsed.context };
      }
    } catch { /* O rascunho é opcional. */ }
    try {
      const savedContext = localStorage.getItem(contextKey(userId));
      if (savedContext) draft.context = JSON.parse(savedContext);
    } catch { /* Opcional também. */ }

    const account = { name: user?.name || user?.nickname || "investidor", email: user?.email || "" };
    getProfile(userId)
      .then((profile) => {
        if (!cancelled) {
          setState({ ...draft, userId, account, profile });
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e, "Não foi possível carregar seu perfil. Tente novamente."));
      });
    return () => { cancelled = true; };
  }, [userId, user?.name, user?.nickname, user?.email, attempt]);

  const ready = loaded && state.userId === userId;
  useEffect(() => {
    if (!ready || !userId) return;
    try {
      // O perfil sempre vem do backend. Tokens nunca passam por este armazenamento.
      sessionStorage.setItem(storageKey(userId), JSON.stringify({ answers: state.answers, context: state.context }));
      if (state.context) localStorage.setItem(contextKey(userId), JSON.stringify(state.context));
    } catch { /* Segue em memória se o navegador bloquear o armazenamento. */ }
  }, [state, ready, userId]);

  const value: OnboardingValue = {
    ...(state.userId === userId ? state : { userId, answers: {} }),
    ready,
    error,
    retry: () => setAttempt((n) => n + 1),
    clearDraft: () => {
      if (userId) {
        try { sessionStorage.removeItem(storageKey(userId)); } catch { /* opcional */ }
      }
      setState({ userId, answers: {} });
      setLoaded(false);
    },
    setContext: (context) => setState((s) => ({ ...s, context })),
    setAnswers: (answers) => setState((s) => ({ ...s, answers })),
    setProfile: (profile) => {
      if (profile.userId !== userId) throw new Error("O perfil não pertence à sua conta.");
      setState((s) => ({ ...s, profile }));
    },
  };
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding precisa estar dentro de OnboardingProvider");
  return ctx;
}
