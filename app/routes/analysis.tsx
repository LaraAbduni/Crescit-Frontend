import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/analysis";
import { useToast } from "~/components/toast";
import { PageTitle, TextField } from "~/components/ui";
import {
  compareAllocation,
  monthlyHistory,
  monthLabel,
  MONTHLY_AMOUNT_DEFAULT,
  portfolioAlerts,
  suggestContribution,
  TARGET_ALLOCATION,
  type PortfolioAlert,
} from "~/lib/analysis";
import { money, parseDecimal, pct, todayISO } from "~/lib/format";
import { useOnboarding } from "~/lib/onboarding";
import type { PortfolioSummary } from "~/lib/portfolio";
import { INVESTOR_TYPES, type InvestorType } from "~/lib/profile";
import { ASSET_TYPE_LABEL, getRecommendations, type AssetType, type Recommendation } from "~/lib/recommendations";
import { exportSpreadsheet } from "~/lib/spreadsheet";
import { usePortfolio } from "~/lib/use-portfolio";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Análise · Crescit" }];
}

// Mesmo verde validado nos outros gráficos (série única, contraste >= 3:1 no branco)
const BAR_COLOR = "#00916f";

const goalKey = (userId: string) => `crescit:meta-mensal:${userId}`;

/** Meta de aporte mensal: fica no navegador, com a faixa do cadastro como sugestão inicial. */
function useMonthlyGoal(userId: string, fallback: number) {
  const [goal, setGoal] = useState(fallback);
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

export default function Analysis() {
  const { profile, context } = useOnboarding();
  const { userId, investorType } = profile!;
  const { load, retry } = usePortfolio(userId);
  const [goal, setGoal] = useMonthlyGoal(userId, MONTHLY_AMOUNT_DEFAULT[context?.monthlyAmount ?? ""] ?? 1000);
  const [recommended, setRecommended] = useState<Recommendation[]>([]);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();
  const today = todayISO();

  useEffect(() => {
    getRecommendations(userId, investorType)
      .then(setRecommended)
      .catch(() => {});
  }, [userId, investorType]);

  async function handleExport(summary: PortfolioSummary) {
    setExporting(true);
    try {
      await exportSpreadsheet(summary, investorType, today);
      toast("Planilha baixada");
    } catch {
      toast("Não foi possível gerar a planilha");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageTitle>Análise</PageTitle>
          <p className="mt-1 text-lg text-muted">
            Sua carteira comparada com a referência para o perfil{" "}
            <span className="font-semibold text-ink">{INVESTOR_TYPES[investorType].label}</span>
          </p>
        </div>
        {load.status === "done" && load.summary.holdings.length > 0 && (
          <button
            type="button"
            onClick={() => handleExport(load.summary)}
            disabled={exporting}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl border-2 border-brand bg-white px-5 text-lg font-semibold text-brand hover:bg-brand-soft disabled:opacity-60"
          >
            <DownloadIcon /> {exporting ? "Gerando..." : "Baixar planilha"}
          </button>
        )}
      </div>

      {load.status === "loading" && <div className="mt-6 h-64 animate-pulse rounded-3xl border border-line bg-white" aria-hidden />}

      {load.status === "error" && (
        <div className="mt-6 rounded-3xl border border-line bg-white p-6 text-center">
          <p className="text-lg text-ink">{load.message}</p>
          <button type="button" onClick={retry} className="mt-4 h-12 rounded-xl border-2 border-brand px-5 text-lg font-semibold text-brand hover:bg-brand-soft">
            Tentar de novo
          </button>
        </div>
      )}

      {load.status === "done" && (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
          <AllocationCard summary={load.summary} investorType={investorType} />
          <SuggestionCard summary={load.summary} investorType={investorType} goal={goal} recommended={recommended} />
          <AlertsCard alerts={portfolioAlerts(load.summary, today)} empty={load.summary.holdings.length === 0} />
          <MonthlyCard summary={load.summary} goal={goal} onGoalChange={setGoal} today={today} />
        </div>
      )}
    </>
  );
}

function Card({ title, subtitle, className = "", children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-3xl border border-line bg-white p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      {children}
    </section>
  );
}

function AllocationCard({ summary, investorType }: { summary: PortfolioSummary; investorType: InvestorType }) {
  const rows = compareAllocation(summary, investorType);
  const empty = summary.currentValue <= 0;
  return (
    <Card
      title="Carteira atual × referência"
      subtitle="A referência é um ponto de partida educativo do Crescit para o seu perfil, não uma recomendação individual."
    >
      <ul className="mt-4 flex gap-x-5 text-sm text-muted" aria-hidden>
        <li className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-full" style={{ background: BAR_COLOR }} /> Sua carteira
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-0.5 rounded-full bg-ink" /> Referência
        </li>
      </ul>
      <ul className="mt-4 flex flex-col gap-4">
        {rows.map((r) => {
          const diff = r.currentShare - r.targetShare;
          const status = empty ? "" : Math.abs(diff) < 0.05 ? "No alvo" : diff > 0 ? "Acima" : "Abaixo";
          return (
            <li key={r.type}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink">{ASSET_TYPE_LABEL[r.type]}</span>
                <span className="text-sm tabular-nums text-muted">
                  <span className="font-semibold text-ink">{pct(r.currentShare)}</span> de {pct(r.targetShare)}
                  {status && <span className="ml-2">· {status}</span>}
                </span>
              </div>
              <div
                className="relative mt-1.5 h-2 rounded-full bg-line/60"
                role="img"
                aria-label={`${ASSET_TYPE_LABEL[r.type]}: ${pct(r.currentShare)} da carteira, referência ${pct(r.targetShare)}`}
              >
                <div className="h-full rounded-full" style={{ width: `${Math.min(r.currentShare, 1) * 100}%`, background: BAR_COLOR }} />
                <span
                  className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-ink"
                  style={{ left: `${r.targetShare * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function SuggestionCard({
  summary,
  investorType,
  goal,
  recommended,
}: {
  summary: PortfolioSummary;
  investorType: InvestorType;
  goal: number;
  recommended: Recommendation[];
}) {
  const [input, setInput] = useState(String(goal));
  useEffect(() => setInput(String(goal)), [goal]);
  const amount = parseDecimal(input);
  const split = suggestContribution(summary, investorType, amount);
  const examples = (type: AssetType) => recommended.filter((r) => r.assetType === type).slice(0, 2);

  return (
    <Card title="Onde colocar o próximo aporte" subtitle="Dividimos o valor entre o que está abaixo da referência, sem precisar vender nada.">
      <div className="mt-4 max-w-56">
        <TextField label="Valor do aporte" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      {split.length === 0 ? (
        <p className="mt-4 text-muted">
          {amount > 0 ? "Sua carteira já está na referência do perfil. Pode manter a divisão atual." : "Informe um valor para ver a sugestão."}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line">
          {split.map((s) => (
            <li key={s.type} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
              <span>
                <span className="block text-lg font-semibold text-ink">{ASSET_TYPE_LABEL[s.type]}</span>
                <span className="block text-sm text-muted">
                  {s.type === "FUND" ? (
                    "Um fundo do seu banco ou corretora"
                  ) : examples(s.type).length > 0 ? (
                    <>
                      Ex.:{" "}
                      {examples(s.type).map((r, i) => (
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
              <span className="text-lg font-bold text-ink tabular-nums">{money(s.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {TARGET_ALLOCATION[investorType].STOCK === 0 && (
        <p className="mt-4 text-sm text-muted">No perfil conservador, a referência não inclui ações individuais.</p>
      )}
    </Card>
  );
}

function AlertsCard({ alerts, empty }: { alerts: PortfolioAlert[]; empty: boolean }) {
  return (
    <Card title="Pontos de atenção">
      {alerts.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-muted">
          <CheckIcon />
          {empty ? "Adicione investimentos para ver os pontos de atenção." : "Nada preocupante na sua carteira agora."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`flex gap-3 rounded-2xl p-4 ${a.level === "warning" ? "bg-moderate-soft" : "bg-brand-soft"}`}
            >
              <span className={`mt-0.5 shrink-0 ${a.level === "warning" ? "text-moderate-text" : "text-brand"}`}>
                {a.level === "warning" ? <WarningIcon /> : <InfoIcon />}
              </span>
              <span>
                <span className="sr-only">{a.level === "warning" ? "Atenção: " : "Aviso: "}</span>
                <span className="block font-semibold text-ink">{a.title}</span>
                <span className="block text-[0.95rem] text-ink/80">{a.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MonthlyCard({
  summary,
  goal,
  onGoalChange,
  today,
}: {
  summary: PortfolioSummary;
  goal: number;
  onGoalChange: (value: number) => void;
  today: string;
}) {
  const rows = monthlyHistory(summary, today).slice(-12).reverse();
  const thisMonth = rows[0]?.month === today.slice(0, 7) ? rows[0] : undefined;
  const done = thisMonth?.contributed ?? 0;
  const progress = goal > 0 ? Math.min(done / goal, 1) : 0;
  const maxContributed = Math.max(goal, ...rows.map((r) => r.contributed), 1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal));

  return (
    <Card title="Mês a mês">
      <div className="mt-4 rounded-2xl bg-cream p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-ink">
            <span className="font-semibold">{money(done)}</span>
            <span className="text-muted"> aportados em {monthLabel(today.slice(0, 7))}</span>
          </p>
          {editing ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const value = parseDecimal(draft);
                if (value > 0) onGoalChange(value);
                setEditing(false);
              }}
            >
              <label className="sr-only" htmlFor="meta-mensal">Meta mensal</label>
              <input
                id="meta-mensal"
                inputMode="decimal"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-10 w-28 rounded-xl border-2 border-line bg-white px-3 text-ink outline-none focus:border-brand"
              />
              <button type="submit" className="h-10 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-dark">
                Salvar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(String(goal));
                setEditing(true);
              }}
              className="text-sm text-muted hover:text-ink"
            >
              Meta: <span className="font-semibold text-ink">{money(goal)}</span> <span className="text-brand underline">alterar</span>
            </button>
          )}
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-white"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Meta de aporte do mês"
        >
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: BAR_COLOR }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {done >= goal ? "Meta do mês cumprida." : `Faltam ${money(goal - done)} para a meta do mês.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-muted">Os seus aportes aparecem aqui, mês a mês.</p>
      ) : (
        <table className="mt-4 w-full text-[0.95rem]">
          <thead>
            <tr className="text-left text-sm text-muted">
              <th scope="col" className="pb-2 font-normal">Mês</th>
              <th scope="col" className="pb-2 font-normal">Aportes</th>
              <th scope="col" className="pb-2 text-right font-normal">Total investido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-t border-line">
                <th scope="row" className="py-2.5 pr-3 text-left font-normal whitespace-nowrap text-ink">
                  {monthLabel(r.month, true)}
                </th>
                <td className="w-full py-2.5 pr-3">
                  <span className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-right whitespace-nowrap tabular-nums text-ink">
                      {r.contributed > 0 ? money(r.contributed) : "—"}
                    </span>
                    <span className="hidden h-2 flex-1 sm:block" aria-hidden>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(r.contributed / maxContributed) * 100}%`, background: BAR_COLOR }}
                      />
                    </span>
                  </span>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap tabular-nums text-ink">{money(r.invested)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function DownloadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 4 2.5 20h19z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...iconProps} className="text-brand">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
