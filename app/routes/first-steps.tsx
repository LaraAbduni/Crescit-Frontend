import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/first-steps";
import { PageTitle, TextField } from "~/components/ui";
import { suggestContribution } from "~/lib/analysis";
import { projection, reservePlan, RESERVE_MONTHS, SIMULATION_RATE } from "~/lib/first-steps";
import { money, parseDecimal, pct } from "~/lib/format";
import { INSTITUTIONS } from "~/lib/institutions";
import { useOnboarding } from "~/lib/onboarding";
import type { PortfolioSummary } from "~/lib/portfolio";
import { INVESTOR_TYPES } from "~/lib/profile";
import { ASSET_TYPE_LABEL, getRecommendations, type Recommendation } from "~/lib/recommendations";
import { useMonthlyGoal } from "~/lib/use-monthly-goal";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Primeiros passos · Crescit" }];
}

// Mesmo verde validado nos gráficos do app
const BAR_COLOR = "#00916f";

const EMPTY_PORTFOLIO: PortfolioSummary = {
  hasMissingPrices: false,
  hasEstimates: false,
  holdings: [],
  totalInvested: 0,
  currentValue: 0,
  gain: 0,
  gainPct: null,
  allocation: [],
  byInstitution: [],
  recentContributions: [],
};

interface PlanInputs {
  expenses: string;
  saved: string;
  hasAccount: boolean;
}

const planKey = (userId: string) => `crescit:primeiros-passos:${userId}`;

/** Gastos, reserva e conta ficam no navegador, para a pessoa não redigitar. */
function usePlanInputs(userId: string, hasAccountFromSignup: boolean) {
  const [inputs, setInputs] = useState<PlanInputs>({ expenses: "", saved: "", hasAccount: hasAccountFromSignup });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(planKey(userId)) ?? "null");
      if (saved) setInputs((i) => ({ ...i, ...saved }));
    } catch {}
  }, [userId]);
  const update = (patch: Partial<PlanInputs>) =>
    setInputs((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(planKey(userId), JSON.stringify(next));
      } catch {}
      return next;
    });
  return [inputs, update] as const;
}

export default function FirstSteps() {
  const { profile, context } = useOnboarding();
  const { userId, investorType } = profile!;
  const [goal, setGoal] = useMonthlyGoal(userId);
  const hasAccountFromSignup = (context?.banks ?? []).some((b) => b !== "Nenhuma");
  const [inputs, update] = usePlanInputs(userId, hasAccountFromSignup);
  const [monthlyInput, setMonthlyInput] = useState(String(goal));
  const [recommended, setRecommended] = useState<Recommendation[]>([]);

  useEffect(() => setMonthlyInput(String(goal)), [goal]);
  useEffect(() => {
    getRecommendations(userId, investorType)
      .then(setRecommended)
      .catch(() => {});
  }, [userId, investorType]);

  const monthly = parseDecimal(monthlyInput) || 0;
  const expenses = parseDecimal(inputs.expenses) || 0;
  const saved = parseDecimal(inputs.saved) || 0;
  const reserve = reservePlan(expenses, saved, monthly);
  const reserveDone = expenses > 0 && reserve.missing === 0;
  const split = suggestContribution(EMPTY_PORTFOLIO, investorType, monthly);
  const rate = SIMULATION_RATE[investorType];

  return (
    <>
      <PageTitle>Primeiros passos</PageTitle>
      <p className="mt-1 max-w-2xl text-lg text-muted">
        Um plano simples para começar do zero, com o seu perfil{" "}
        <span className="font-semibold text-ink">{INVESTOR_TYPES[investorType].label}</span> e o quanto você pode investir.
      </p>

      <div className="mt-6 max-w-xs">
        <TextField
          label="Quanto você pode investir por mês?"
          inputMode="decimal"
          value={monthlyInput}
          onChange={(e) => setMonthlyInput(e.target.value)}
          onBlur={() => monthly > 0 && setGoal(monthly)}
        />
      </div>

      <ol className="mt-8 flex flex-col gap-5">
        <Step number={1} done={reserveDone} title="Monte sua reserva de emergência">
          <p className="text-ink/80">
            Antes de buscar rendimento, guarde o equivalente a {RESERVE_MONTHS} meses dos seus gastos. É o dinheiro para
            imprevistos, então precisa render com segurança e poder ser resgatado a qualquer dia.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Seus gastos por mês"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={inputs.expenses}
              onChange={(e) => update({ expenses: e.target.value })}
            />
            <TextField
              label="Quanto já tem guardado"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={inputs.saved}
              onChange={(e) => update({ saved: e.target.value })}
            />
          </div>
          {expenses > 0 && (
            <div className="mt-5 rounded-2xl bg-cream p-4">
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-ink">
                <span>
                  Meta da reserva: <span className="font-semibold">{money(reserve.target)}</span>
                </span>
                <span className="text-sm text-muted tabular-nums">{pct(reserve.progress)} guardado</span>
              </p>
              <div
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-white"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(reserve.progress * 100)}
                aria-label="Progresso da reserva de emergência"
              >
                <div className="h-full rounded-full" style={{ width: `${reserve.progress * 100}%`, background: BAR_COLOR }} />
              </div>
              <p className="mt-2 text-sm text-muted">
                {reserveDone
                  ? "Reserva completa. Agora os aportes podem ir para a carteira do seu perfil."
                  : reserve.monthsToGoal === null
                    ? `Faltam ${money(reserve.missing)}.`
                    : `Faltam ${money(reserve.missing)}: investindo ${money(monthly)} por mês, você completa em ${monthsText(reserve.monthsToGoal)}.`}
              </p>
            </div>
          )}
          <p className="mt-4 text-sm text-muted">
            <span className="font-semibold text-ink">Onde guardar:</span> Tesouro Selic ou CDB com liquidez diária que
            renda pelo menos 100% do CDI.
          </p>
        </Step>

        <Step number={2} done={inputs.hasAccount} title="Escolha onde investir">
          <p className="text-ink/80">
            Para investir, você precisa de conta em um banco ou corretora. Muitos oferecem Tesouro Direto, CDBs e fundos
            sem taxa de manutenção. Compare as opções antes de escolher.
          </p>
          <p className="mt-3 text-sm text-muted">Exemplos: {INSTITUTIONS.slice(0, 11).join(", ")}.</p>
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-ink">
            <input
              type="checkbox"
              className="size-5 accent-brand"
              checked={inputs.hasAccount}
              onChange={(e) => update({ hasAccount: e.target.checked })}
            />
            Já tenho conta em um banco ou corretora
          </label>
        </Step>

        <Step number={3} done={false} title="Seu primeiro aporte na carteira">
          <p className="text-ink/80">
            {reserveDone
              ? `Com a reserva pronta, este é um jeito de dividir os ${money(monthly)} do mês para o seu perfil:`
              : `Enquanto monta a reserva, todo aporte vai para ela. Depois, este é um jeito de dividir os ${money(monthly)} do mês para o seu perfil:`}
          </p>
          {split.length === 0 ? (
            <p className="mt-3 text-muted">Informe quanto pode investir por mês para ver a divisão.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {split.map((s) => {
                const examples = recommended.filter((r) => r.assetType === s.type).slice(0, 2);
                return (
                  <li key={s.type} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                    <span>
                      <span className="block font-semibold text-ink">{ASSET_TYPE_LABEL[s.type]}</span>
                      <span className="block text-sm text-muted">
                        {s.type === "FUND" ? (
                          "Um fundo do seu banco ou corretora"
                        ) : examples.length > 0 ? (
                          <>
                            Ex.:{" "}
                            {examples.map((r, i) => (
                              <span key={r.id}>
                                {i > 0 && ", "}
                                <Link to={`/recomendacoes?ativo=${encodeURIComponent(r.ticker)}`} className="font-semibold text-brand hover:underline">
                                  {r.ticker}
                                </Link>
                              </span>
                            ))}
                          </>
                        ) : s.type === "FIXED_INCOME" ? (
                          "CDB, LCI, LCA ou Tesouro Direto"
                        ) : (
                          "Veja as recomendações para o seu perfil"
                        )}
                      </span>
                    </span>
                    <span className="font-bold text-ink tabular-nums">{money(s.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-sm text-muted">
            Fez um aporte? Registre na{" "}
            <Link to="/carteira" className="font-semibold text-brand hover:underline">
              Carteira
            </Link>{" "}
            para acompanhar a evolução.
          </p>
        </Step>

        <Step number={4} done={false} title="Onde você pode chegar">
          <p className="text-ink/80">
            Investindo {money(monthly)} todo mês, com rentabilidade média de {pct(rate)} ao ano:
          </p>
          {monthly > 0 && (
            <table className="mt-4 w-full max-w-lg">
              <thead>
                <tr className="text-left text-sm text-muted">
                  <th scope="col" className="pb-2 font-normal">Prazo</th>
                  <th scope="col" className="pb-2 text-right font-normal">Você investe</th>
                  <th scope="col" className="pb-2 text-right font-normal">Com rendimento</th>
                </tr>
              </thead>
              <tbody>
                {[1, 5, 10].map((years) => {
                  const p = projection(monthly, years, rate);
                  return (
                    <tr key={years} className="border-t border-line">
                      <th scope="row" className="py-2.5 text-left font-normal text-ink">
                        {years} {years === 1 ? "ano" : "anos"}
                      </th>
                      <td className="py-2.5 text-right text-ink tabular-nums">{money(p.invested)}</td>
                      <td className="py-2.5 text-right font-semibold text-ink tabular-nums">{money(p.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-sm text-muted">Simulação ilustrativa, antes de impostos. Rentabilidade passada ou estimada não é garantia.</p>
        </Step>
      </ol>
    </>
  );
}

function Step({ number, done, title, children }: { number: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-3xl border border-line bg-white p-6">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full font-semibold ${done ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}
        aria-hidden
      >
        {done ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          number
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold text-ink">
          <span className="sr-only">{`Passo ${number}${done ? " (concluído)" : ""}: `}</span>
          {title}
        </h2>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  );
}

function monthsText(months: number) {
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 1 ? "1 ano" : `${years} anos`;
  return rest === 0 ? y : `${y} e ${rest === 1 ? "1 mês" : `${rest} meses`}`;
}
