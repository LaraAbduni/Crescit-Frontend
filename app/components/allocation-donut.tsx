import { useState } from "react";
import { money, pct } from "~/lib/format";
import { ASSET_TYPE_LABEL, type AssetType } from "~/lib/recommendations";

// Paleta categórica validada (scripts/validate_palette.js da skill de dataviz):
// passa em CVD e visão normal para todos os vizinhos do anel, inclusive
// último↔primeiro. Ordem do anel = ALLOCATION_ORDER (Renda Fixa, ETF, FII, Ação).
// Aqua e amarelo têm contraste < 3:1 com o fundo, por isso a legenda com os
// percentuais fica sempre visível.
export const ASSET_TYPE_COLOR: Record<AssetType, string> = {
  FIXED_INCOME: "#1baf7a",
  ETF: "#eb6834",
  FII: "#2a78d6",
  STOCK: "#eda100",
};

const R = 42;
const STROKE = 18;
const C = 2 * Math.PI * R;
const GAP = 2; // respiro entre os segmentos, na cor do fundo

export function AllocationDonut({ data }: { data: { type: AssetType; value: number; share: number }[] }) {
  const [active, setActive] = useState<AssetType | null>(null);
  const activeItem = data.find((d) => d.type === active);

  let offset = 0;
  const segments = data.map((d) => {
    const length = d.share * C;
    const seg = { ...d, length, offset };
    offset += length;
    return seg;
  });
  const gap = segments.length > 1 ? GAP : 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-28 shrink-0">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label="Distribuição da carteira por tipo de ativo">
          {segments.map((s) => (
            <circle
              key={s.type}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={ASSET_TYPE_COLOR[s.type]}
              strokeWidth={STROKE}
              strokeDasharray={`${Math.max(s.length - gap, 0)} ${C - Math.max(s.length - gap, 0)}`}
              strokeDashoffset={-s.offset}
              opacity={active && active !== s.type ? 0.3 : 1}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setActive(s.type)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${ASSET_TYPE_LABEL[s.type]}: ${pct(s.share)} · ${money(s.value)}`}</title>
            </circle>
          ))}
        </svg>
        {activeItem && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-xs text-muted">{ASSET_TYPE_LABEL[activeItem.type]}</span>
            <span className="text-sm font-bold text-ink">{pct(activeItem.share)}</span>
          </div>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {data.map((d) => (
          <li key={d.type}>
            <button
              type="button"
              className={`flex w-full items-center gap-2.5 rounded-lg text-left whitespace-nowrap transition-opacity ${
                active && active !== d.type ? "opacity-40" : ""
              }`}
              onMouseEnter={() => setActive(d.type)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(d.type)}
              onBlur={() => setActive(null)}
              aria-label={`${ASSET_TYPE_LABEL[d.type]}: ${pct(d.share)}, ${money(d.value)}`}
            >
              <span className="size-3.5 shrink-0 rounded" style={{ background: ASSET_TYPE_COLOR[d.type] }} aria-hidden />
              <span className="flex-1 text-ink">{ASSET_TYPE_LABEL[d.type]}</span>
              <span className="font-semibold text-ink">{pct(d.share)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
