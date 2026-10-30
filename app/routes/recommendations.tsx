import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/recommendations";
import { PROFILE_TEXT_COLOR } from "~/components/profile-gauge";
import { RecommendationCard } from "~/components/recommendation-card";
import { InvestmentForm } from "~/components/portfolio-forms";
import { Sheet } from "~/components/sheet";
import { useToast } from "~/components/toast";
import { Chip, PageTitle } from "~/components/ui";
import { useOnboarding } from "~/lib/onboarding";
import { apiErrorMessage } from "~/lib/api";
import { rankRecommendations, type RankedRecommendation } from "~/lib/analysis";
import { NO_INSTITUTION } from "~/lib/institutions";
import { addContribution, addInvestment } from "~/lib/portfolio";
import { usePortfolio } from "~/lib/use-portfolio";
import { INVESTOR_TYPES } from "~/lib/profile";
import {
  ASSET_TYPE_LABEL,
  RISK_SCOPE,
  getRecommendations,
  type AssetType,
  type Recommendation,
} from "~/lib/recommendations";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Recomendações · Crescit" }];
}

const FILTERS: (AssetType | "ALL")[] = ["ALL", "STOCK", "FII", "ETF", "FIXED_INCOME"];

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; items: Recommendation[] };

export default function Recommendations() {
  // O layout só renderiza esta tela quando o perfil já existe
  const { profile, context } = useOnboarding();
  const { userId, investorType } = profile!;

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<AssetType | "ALL">("ALL");
  const [adding, setAdding] = useState<Recommendation | null>(null);
  const { load: portfolio, reload: reloadPortfolio } = usePortfolio(userId);
  const toast = useToast();
  // Vindo do Início (?ativo=PETR4), o card do ativo é rolado até a tela e destacado
  const [params] = useSearchParams();
  const focused = params.get("ativo");

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getRecommendations(userId, investorType)
      .then((items) => !cancelled && setLoad({ status: "done", items }))
      .catch((e) => !cancelled && setLoad({ status: "error", message: apiErrorMessage(e, "Não foi possível carregar suas recomendações.") }));
    return () => {
      cancelled = true;
    };
  }, [userId, investorType, attempt]);

  useEffect(() => {
    if (load.status !== "done" || portfolio.status === "loading" || !focused) return;
    document.getElementById(`ativo-${focused}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [load.status, portfolio.status, focused]);

  // Ativos que já estão na carteira aparecem como "Na carteira" e vão para o fim
  const summary = portfolio.status === "done" ? portfolio.summary : null;
  const ownedTickers = summary?.holdings.map((h) => h.ticker) ?? [];
  const preferredInstitutions = [
    ...(summary?.byInstitution.map((i) => i.institution) ?? []),
    ...(context?.banks ?? []),
  ].filter((name) => !["Nenhuma", "Outro", NO_INSTITUTION].includes(name));

  const visible =
    load.status === "done" ? load.items.filter((r) => filter === "ALL" || r.assetType === filter) : [];
  const ranked = rankRecommendations(visible, summary, investorType, ownedTickers);
  const balancing = ranked.filter((r) => r.balances);
  const others = ranked.filter((r) => !r.balances);

  const renderCard = (r: RankedRecommendation<Recommendation>) => (
    <RecommendationCard
      key={r.item.id}
      item={r.item}
      reason={r.reason}
      balances={r.balances}
      highlighted={r.item.ticker === focused}
      addState={r.owned ? "added" : "idle"}
      onAdd={() => setAdding(r.item)}
    />
  );

  return (
    <>
      <PageTitle>Recomendações</PageTitle>
      <p className="mt-1 text-lg text-muted">
        Para o perfil{" "}
        <span className={`font-semibold ${PROFILE_TEXT_COLOR[investorType]}`}>{INVESTOR_TYPES[investorType].label}</span>{" "}
        · {RISK_SCOPE[investorType]}
      </p>

      <p className="mt-2 text-sm text-muted">Preços de referência do catálogo; não são cotações em tempo real.</p>

      <div className="-mx-6 mt-5 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" aria-label="Filtrar por tipo de ativo">
        {FILTERS.map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
            <span className="whitespace-nowrap">{f === "ALL" ? "Todos" : ASSET_TYPE_LABEL[f]}</span>
          </Chip>
        ))}
      </div>

      <section className="mt-6 grid gap-5 md:grid-cols-2" aria-live="polite">
        {(load.status === "loading" || portfolio.status === "loading") && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

        {load.status === "error" && (
          <div className="rounded-3xl border border-line bg-white p-6 text-center md:col-span-2">
            <p className="text-lg text-ink">{load.message}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-4 h-12 rounded-xl border-2 border-brand px-5 text-lg font-semibold text-brand hover:bg-brand-soft"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {load.status === "done" && visible.length === 0 && (
          <p className="rounded-3xl border border-line bg-white p-6 text-center text-muted md:col-span-2">
            {filter === "ALL"
              ? "Ainda não há ativos recomendados para o seu perfil."
              : `Nenhuma recomendação de ${ASSET_TYPE_LABEL[filter]} para o seu perfil.`}
          </p>
        )}

        {portfolio.status !== "loading" && balancing.length > 0 && (
          <>
            <SectionTitle
              title="Para equilibrar sua carteira"
              text="Tipos de ativo abaixo da referência do seu perfil. Veja a comparação completa na Análise."
            />
            {balancing.map(renderCard)}
          </>
        )}

        {portfolio.status !== "loading" && others.length > 0 && (
          <>
            {balancing.length > 0 && <SectionTitle title="Outras opções para o seu perfil" />}
            {others.map(renderCard)}
          </>
        )}
      </section>

      {adding && (
        <Sheet title={`Adicionar ${adding.ticker}`} onClose={() => setAdding(null)}>
          <InvestmentForm
            initialAsset={adding}
            preferredInstitutions={preferredInstitutions}
            onSubmit={async (investment, contribution) => {
              const created = await addInvestment(userId, investment);
              await addContribution(userId, created.id, contribution);
              await reloadPortfolio();
              setAdding(null);
              toast(`${created.ticker} adicionado à carteira`);
            }}
          />
        </Sheet>
      )}
    </>
  );
}

function SectionTitle({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mt-2 md:col-span-2">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {text && <p className="mt-1 text-muted">{text}</p>}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-line bg-white p-6" aria-hidden>
      <div className="h-7 w-32 rounded-lg bg-line/70" />
      <div className="mt-2 h-4 w-44 rounded bg-line/50" />
      <div className="mt-6 h-2 w-full rounded-full bg-line/60" />
      <div className="mt-5 h-4 w-full rounded bg-line/50" />
      <div className="mt-2 h-4 w-2/3 rounded bg-line/50" />
      <div className="mt-5 h-12 w-56 rounded-xl bg-line/50" />
    </div>
  );
}
