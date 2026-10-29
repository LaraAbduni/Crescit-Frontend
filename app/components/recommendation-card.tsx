import {
  ASSET_TYPE_DESCRIPTION,
  ASSET_TYPE_LABEL,
  RISK_LABEL,
  type Recommendation,
  type RiskLevel,
} from "~/lib/recommendations";

const RISK_BADGE: Record<RiskLevel, string> = {
  LOW: "bg-conservative/15 text-brand",
  MEDIUM: "bg-moderate-soft text-moderate-text",
  HIGH: "bg-aggressive/15 text-[#b4472f]",
};

export type AddState = "idle" | "loading" | "added" | "error";

export function RecommendationCard({
  item,
  addState,
  highlighted = false,
  onAdd,
}: {
  item: Recommendation;
  addState: AddState;
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
          <h2 className="text-2xl leading-tight font-bold break-words text-ink">{item.ticker}</h2>
          <p className="mt-1 text-muted">{item.assetName}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-start justify-end gap-2">
          <Badge className="bg-line/60 text-ink">{ASSET_TYPE_LABEL[item.assetType]}</Badge>
          <Badge className={RISK_BADGE[item.riskLevel]}>{RISK_LABEL[item.riskLevel]}</Badge>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-line/60"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={item.compatibilityScore}
          aria-label="Compatibilidade com o seu perfil"
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${item.compatibilityScore}%` }} />
        </div>
        <span className="shrink-0 text-lg font-bold text-ink">{item.compatibilityScore}% compatível</span>
      </div>

      <p className="mt-4 text-[1.05rem] leading-relaxed text-ink/80">{ASSET_TYPE_DESCRIPTION[item.assetType]}</p>

      <div className="mt-auto">
        <AddButton state={addState} onClick={onAdd} />
        {addState === "error" && (
          <p role="alert" className="mt-2 text-sm text-aggressive">
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
