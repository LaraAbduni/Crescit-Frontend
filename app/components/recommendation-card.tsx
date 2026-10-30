import {
  ASSET_TYPE_DESCRIPTION,
  ASSET_TYPE_LABEL,
  RISK_LABEL,
  type Asset,
  type Recommendation,
  type RiskLevel,
} from "~/lib/recommendations";
import { rateLabel } from "~/lib/fixed-income";
import { money } from "~/lib/format";

const RISK_BADGE: Record<RiskLevel, string> = {
  LOW: "bg-conservative/15 text-brand",
  MEDIUM: "bg-moderate-soft text-moderate-text",
  HIGH: "bg-aggressive/15 text-[#b4472f]",
};

export type AddState = "idle" | "loading" | "added" | "error";

export function RecommendationCard({
  item,
  addState,
  reason,
  balances = false,
  highlighted = false,
  asset,
  onAdd,
  onDetails,
}: {
  item: Recommendation;
  /** Dados do catálogo: taxa, liquidez e descrição */
  asset?: Asset;
  onDetails?: () => void;
  addState: AddState;
  /** Por que este ativo para esta pessoa (carteira e perfil) */
  reason?: string;
  /** Ajuda a carteira a chegar na referência do perfil */
  balances?: boolean;
  highlighted?: boolean;
  onAdd: () => void;
}) {
  return (
    <article
      id={`ativo-${item.ticker}`}
      className={`flex scroll-mt-8 flex-col rounded-3xl border bg-white p-6 transition ${
        highlighted ? "border-brand ring-2 ring-brand/30" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-[40%] flex-1">
          {/* Produtos de renda fixa por taxa não têm ticker de bolsa: o título é o nome */}
          <h2 className="text-2xl leading-tight font-bold break-words text-ink">{asset?.rateType ? item.assetName : item.ticker}</h2>
          <p className="mt-1 text-muted">{asset?.rateType ? "Produto de referência, disponível em vários bancos" : item.assetName}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-start justify-end gap-2">
          <Badge className="bg-line/60 text-ink">{ASSET_TYPE_LABEL[item.assetType]}</Badge>
          <Badge className={RISK_BADGE[item.riskLevel]}>{RISK_LABEL[item.riskLevel]}</Badge>
        </div>
      </div>

      {reason && (
        <div className={`mt-5 rounded-2xl px-4 py-3 ${balances ? "bg-brand-soft" : "bg-cream"}`}>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {balances ? "Equilibra sua carteira" : "Por que para você"}
          </p>
          <p className="mt-1 text-ink">{reason}</p>
        </div>
      )}

      <p className="mt-4 text-[1.05rem] leading-relaxed text-ink/80">{ASSET_TYPE_DESCRIPTION[item.assetType]}</p>
      <p className="mt-2 text-sm text-muted">
        {asset?.rateType && asset.rateValue
          ? [
              rateLabel(asset.rateType, asset.rateValue),
              asset.taxExempt ? "isento de IR" : null,
              asset.liquidity ? `resgate: ${asset.liquidity.toLowerCase()}` : null,
              asset.minimumInvestment ? `mínimo ${money(asset.minimumInvestment)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : `Preço de referência: ${money(item.currentPrice)}`}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-x-5">
        <AddButton state={addState} onClick={onAdd} />
        {onDetails && (
          <button type="button" onClick={onDetails} className="mt-5 h-12 font-semibold text-brand hover:underline">
            Ver detalhes
          </button>
        )}
        {addState === "error" && (
          <p role="alert" className="mt-2 w-full text-sm text-aggressive">
            Não foi possível adicionar. Tente de novo.
          </p>
        )}
      </div>
    </article>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-lg px-2.5 py-1 text-sm font-medium whitespace-nowrap ${className}`}>{children}</span>;
}

function AddButton({ state, onClick }: { state: AddState; onClick: () => void }) {
  if (state === "added") {
    return (
      <span className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-soft px-5 text-lg font-semibold text-brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Na carteira
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "loading"}
      className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl border-2 border-brand px-5 text-lg font-semibold text-brand transition hover:bg-brand-soft disabled:opacity-60"
    >
      {state === "loading" ? (
        "Adicionando..."
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          Adicionar à carteira
        </>
      )}
    </button>
  );
}
