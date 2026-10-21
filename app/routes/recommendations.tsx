import { useEffect, useState } from "react";
import type { Route } from "./+types/recommendations";
import { PROFILE_TEXT_COLOR } from "~/components/profile-gauge";
import { RecommendationCard, type AddState } from "~/components/recommendation-card";
import { Chip, PageTitle } from "~/components/ui";
import { useOnboarding } from "~/lib/onboarding";
import { addInvestment, listInvestments } from "~/lib/portfolio";
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
  | { status: "error" }
  | { status: "done"; items: Recommendation[] };

export default function Recommendations() {
  // O layout só renderiza esta tela quando o perfil já existe
  const { profile } = useOnboarding();
  const { userId, investorType } = profile!;

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<AssetType | "ALL">("ALL");
  const [adding, setAdding] = useState<Record<string, AddState>>({});
  const [ownedTickers, setOwnedTickers] = useState<string[]>([]);

  // Ativos que já estão na carteira aparecem como "Na carteira"
  useEffect(() => {
    listInvestments(userId)
      .then((list) => setOwnedTickers(list.map((i) => i.ticker)))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getRecommendations(userId, investorType)
      .then((items) => !cancelled && setLoad({ status: "done", items }))
      .catch(() => !cancelled && setLoad({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [userId, investorType, attempt]);

  async function handleAdd(item: Recommendation) {
    setAdding((s) => ({ ...s, [item.ticker]: "loading" }));
    try {
      await addInvestment(userId, { ticker: item.ticker, assetName: item.assetName, assetType: item.assetType });
      setOwnedTickers((t) => [...t, item.ticker]);
      setAdding((s) => ({ ...s, [item.ticker]: "idle" }));
    } catch {
      setAdding((s) => ({ ...s, [item.ticker]: "error" }));
    }
  }

  const visible =
    load.status === "done" ? load.items.filter((r) => filter === "ALL" || r.assetType === filter) : [];

  return (
    <>
      <PageTitle>Recomendações</PageTitle>
      <p className="mt-1 text-lg text-muted">
        Para o perfil{" "}
        <span className={`font-semibold ${PROFILE_TEXT_COLOR[investorType]}`}>{INVESTOR_TYPES[investorType].label}</span>{" "}
        · {RISK_SCOPE[investorType]}
      </p>

      <div className="-mx-6 mt-5 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none]" aria-label="Filtrar por tipo de ativo">
        {FILTERS.map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
            <span className="whitespace-nowrap">{f === "ALL" ? "Todos" : ASSET_TYPE_LABEL[f]}</span>
          </Chip>
        ))}
      </div>

      <section className="mt-6 flex flex-col gap-5" aria-live="polite">
        {load.status === "loading" && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

        {load.status === "error" && (
          <div className="rounded-3xl border border-line bg-white p-6 text-center">
            <p className="text-lg text-ink">Não foi possível carregar suas recomendações.</p>
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
          <p className="rounded-3xl border border-line bg-white p-6 text-center text-muted">
            {filter === "ALL"
              ? "Ainda não há ativos recomendados para o seu perfil."
              : `Nenhuma recomendação de ${ASSET_TYPE_LABEL[filter]} para o seu perfil.`}
          </p>
        )}

        {visible.map((item) => (
          <RecommendationCard
            key={item.id}
            item={item}
            addState={ownedTickers.includes(item.ticker) ? "added" : (adding[item.ticker] ?? "idle")}
            onAdd={() => handleAdd(item)}
          />
        ))}
      </section>
    </>
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
