import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { AllocationDonut } from "~/components/allocation-donut";
import { Trend } from "~/components/trend";
import { dateBR, money, qty } from "~/lib/format";
import { useOnboarding } from "~/lib/onboarding";
import { unitLabel } from "~/lib/portfolio";
import { INVESTOR_TYPES, type InvestorType } from "~/lib/profile";
import { ASSET_TYPE_LABEL, getRecommendations, RISK_LABEL, type Recommendation } from "~/lib/recommendations";
import { usePortfolio } from "~/lib/use-portfolio";
import { apiErrorMessage } from "~/lib/api";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Início · Crescit" }];
}

const PROFILE_PILL: Record<InvestorType, { bg: string; dot: string; text: string }> = {
  CONSERVATIVE: { bg: "bg-conservative/15", dot: "bg-conservative", text: "text-brand" },
  MODERATE: { bg: "bg-moderate-soft", dot: "bg-moderate", text: "text-moderate-text" },
  AGGRESSIVE: { bg: "bg-aggressive/15", dot: "bg-aggressive", text: "text-[#b4472f]" },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function Home() {
  const { account, profile } = useOnboarding();
  const { userId, investorType } = profile!;
  const { load, retry } = usePortfolio(userId);
  const [recommended, setRecommended] = useState<Recommendation[] | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<string>();
  const [recommendationsAttempt, setRecommendationsAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRecommendationsError(undefined);
    getRecommendations(userId, investorType)
      .then((list) => { if (!cancelled) setRecommended(list.slice(0, 2)); })
      .catch((e) => { if (!cancelled) setRecommendationsError(apiErrorMessage(e, "Não foi possível carregar suas recomendações.")); });
    return () => { cancelled = true; };
  }, [userId, investorType, recommendationsAttempt]);

  const pill = PROFILE_PILL[investorType];
  const firstName = account?.name.split(" ")[0];
  const summary = load.status === "done" ? load.summary : null;

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg text-muted">{greeting()},</p>
          <h1 className="font-serif text-[2.4rem] leading-tight font-bold text-ink">{firstName ?? "investidor"}</h1>
        </div>
        <Link
          to="/perfil/resultado"
          className={`mt-1 inline-flex items-center gap-2 rounded-full px-5 py-3 text-lg font-semibold ${pill.bg} ${pill.text}`}
        >
          <span className={`size-3 rounded-full ${pill.dot}`} aria-hidden />
          {INVESTOR_TYPES[investorType].label}
        </Link>
      </header>

      <section className="mt-6 rounded-3xl bg-brand p-6 text-white">
        <p className="text-white/80">Patrimônio</p>
        {load.status === "loading" && <div className="mt-2 h-12 w-56 animate-pulse rounded-lg bg-white/15" />}
        {load.status === "error" && (
          <p className="mt-2">
            {load.message}{" "}
            <button type="button" onClick={retry} className="font-semibold underline">
              Tentar de novo
            </button>
          </p>
        )}
        {summary && (
          <>
            <p className="mt-1 font-serif text-[2.6rem] leading-tight font-bold">{money(summary.currentValue)}</p>
            <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[1.05rem]">
              <Trend gain={summary.gain} gainPct={summary.gainPct} onDark />
              <span className="text-white/80">Investido {money(summary.totalInvested)}</span>
            </p>
          </>
        )}
      </section>

      {summary && summary.allocation.length > 0 && (
        <Card title="Distribuição por tipo">
          <div className="mt-4">
            <AllocationDonut data={summary.allocation} />
          </div>
        </Card>
      )}

      {summary && summary.holdings.length === 0 && (
        <Card title="Comece sua carteira">
          <p className="mt-2 text-muted">
            Veja os ativos recomendados para o seu perfil e adicione os primeiros à carteira.
          </p>
        </Card>
      )}

      {recommended && recommended.length > 0 && (
        <Card
          title="Recomendados para você"
          action={
            <Link to="/recomendacoes" className="shrink-0 font-semibold text-brand hover:underline">
              Ver todos
            </Link>
          }
        >
          <ul className="mt-2 divide-y divide-line">
            {recommended.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-4 last:pb-0">
                <span className="min-w-0">
                  <span className="block text-lg font-bold break-words text-ink">{r.ticker}</span>
                  <span className="block text-muted">
                    {ASSET_TYPE_LABEL[r.assetType]} · {RISK_LABEL[r.riskLevel].toLowerCase()}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-bold text-brand">{r.compatibilityScore}%</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {recommendationsError && <Card title="Recomendados para você"><p role="alert" className="mt-2 text-muted">{recommendationsError}</p><button type="button" className="mt-3 font-semibold text-brand underline" onClick={() => setRecommendationsAttempt((n) => n + 1)}>Tentar novamente</button></Card>}

      {summary && summary.recentContributions.length > 0 && (
        <Card title="Últimos aportes">
          <ul className="mt-3 flex flex-col gap-3">
            {summary.recentContributions.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-baseline gap-2.5 text-[0.95rem]">
                <span className="w-10 shrink-0 text-muted tabular-nums">{dateBR(c.contributionDate, false)}</span>
                <span className="min-w-0 flex-1 text-ink">
                  {c.ticker} · {qty(c.quantity)} {unitLabel(c.assetType, c.quantity)}
                </span>
                <span className="shrink-0 font-semibold text-ink tabular-nums">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-3xl border border-line bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
