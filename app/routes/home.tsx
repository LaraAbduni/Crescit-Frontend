import { Link } from "react-router";
import type { Route } from "./+types/home";
import { AllocationDonut } from "~/components/allocation-donut";
import { EvolutionChart } from "~/components/evolution-chart";
import { InstitutionBars } from "~/components/institution-bars";
import { Trend } from "~/components/trend";
import { monthlyHistory, monthLabel, portfolioAlerts, suggestContribution } from "~/lib/analysis";
import { money, todayISO } from "~/lib/format";
import { useOnboarding } from "~/lib/onboarding";
import type { PortfolioSummary } from "~/lib/portfolio";
import { INVESTOR_TYPES, type InvestorType } from "~/lib/profile";
import { ASSET_TYPE_LABEL } from "~/lib/recommendations";
import { useMonthlyGoal } from "~/lib/use-monthly-goal";
import { usePortfolio } from "~/lib/use-portfolio";

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
  const [goal] = useMonthlyGoal(userId);

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

      <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
        <section className="rounded-3xl bg-brand p-6 text-white md:col-span-2 lg:p-8">
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
                <span className="text-white/80">
                  Investido {money(summary.totalInvested)}
                  {summary.byInstitution.length > 1 && ` em ${summary.byInstitution.length} instituições`}
                </span>
              </p>
            </>
          )}
        </section>

        {summary && <NextStep summary={summary} investorType={investorType} goal={goal} />}

        {summary && summary.recentContributions.length > 0 && (
          <Card title="Evolução do patrimônio" className="md:col-span-2">
            <p className="mt-1 text-sm text-muted">
              Total investido a cada aporte. O valor de hoje usa os preços atuais do catálogo.
            </p>
            <div className="mt-4">
              <EvolutionChart contributions={summary.recentContributions} currentValue={summary.currentValue} />
            </div>
          </Card>
        )}

        {summary && summary.byInstitution.length > 0 && summary.currentValue > 0 && (
          <Card
            title="Por instituição"
            action={
              <Link to="/carteira" className="shrink-0 font-semibold text-brand hover:underline">
                Ver carteira
              </Link>
            }
          >
            <div className="mt-4">
              <InstitutionBars data={summary.byInstitution.filter((i) => i.value > 0)} />
            </div>
          </Card>
        )}

        {summary && summary.allocation.length > 0 && (
          <Card
            title="Por tipo de ativo"
            action={
              <Link to="/analise" className="shrink-0 font-semibold text-brand hover:underline">
                Comparar
              </Link>
            }
          >
            <div className="mt-4">
              <AllocationDonut data={summary.allocation} />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

/**
 * A coisa mais útil a fazer agora: começar (carteira vazia), resolver um
 * alerta importante ou fazer o aporte do mês.
 */
function NextStep({ summary, investorType, goal }: { summary: PortfolioSummary; investorType: InvestorType; goal: number }) {
  const today = todayISO();

  if (summary.holdings.length === 0) {
    return (
      <NextStepCard
        title="Comece sua carteira"
        text="Nunca investiu? Monte um plano em 4 passos, da reserva de emergência ao primeiro aporte. Já investe? Cadastre o que você tem em cada banco."
        links={[
          { to: "/primeiros-passos", label: "Ver primeiros passos" },
          { to: "/carteira", label: "Cadastrar investimentos" },
        ]}
      />
    );
  }

  const warning = portfolioAlerts(summary, today).find((a) => a.level === "warning");
  if (warning) {
    return <NextStepCard title={warning.title} text={warning.text} links={[{ to: "/analise", label: "Ver análise" }]} />;
  }

  const thisMonth = monthlyHistory(summary, today).find((m) => m.month === today.slice(0, 7));
  const done = thisMonth?.contributed ?? 0;
  const missing = Math.max(goal - done, 0);
  if (missing > 0) {
    const split = suggestContribution(summary, investorType, missing).slice(0, 2);
    return (
      <NextStepCard
        title={`Faltam ${money(missing)} para a meta de ${monthLabel(today.slice(0, 7)).split(" ")[0]}`}
        text={
          split.length > 0
            ? `Para equilibrar a carteira: ${split.map((s) => `${money(s.amount)} em ${ASSET_TYPE_LABEL[s.type]}`).join(" e ")}.`
            : "Sua carteira está na referência do perfil; pode manter a divisão atual."
        }
        links={[
          { to: "/recomendacoes", label: "Ver sugestões" },
          { to: "/analise", label: "Ver análise" },
        ]}
      />
    );
  }

  return (
    <NextStepCard
      title="Meta do mês cumprida"
      text="Seus aportes deste mês já chegaram na meta. Veja como a carteira está em relação ao seu perfil."
      links={[{ to: "/analise", label: "Ver análise" }]}
    />
  );
}

function NextStepCard({ title, text, links }: { title: string; text: string; links: { to: string; label: string }[] }) {
  return (
    <section className="rounded-3xl border-2 border-brand/25 bg-brand-soft p-6 md:col-span-2" aria-label="Próximo passo">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand">Próximo passo</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-ink/80">{text}</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="font-semibold text-brand hover:underline">
            {l.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Card({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl border border-line bg-white p-6 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
