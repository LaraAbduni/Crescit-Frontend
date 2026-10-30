import { compareAllocation } from "~/lib/analysis";
import { pct } from "~/lib/format";
import type { PortfolioSummary } from "~/lib/portfolio";
import type { InvestorType } from "~/lib/profile";
import { ASSET_TYPE_LABEL } from "~/lib/recommendations";

// Mesmo verde validado nos outros gráficos (série única, contraste >= 3:1 no branco)
const BAR_COLOR = "#00916f";

/** Barras da carteira atual por tipo de ativo, com a marca da referência do perfil. */
export function AllocationComparison({ summary, investorType }: { summary: PortfolioSummary; investorType: InvestorType }) {
  const rows = compareAllocation(summary, investorType);
  const empty = summary.currentValue <= 0;
  return (
    <>
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
    </>
  );
}
