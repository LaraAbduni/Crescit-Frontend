import { money, pct } from "~/lib/format";

// Mesmo verde validado no gráfico de evolução (série única, contraste >= 3:1 no branco)
const BAR_COLOR = "#00916f";

/** Quanto do patrimônio está em cada banco ou corretora. */
export function InstitutionBars({
  data,
}: {
  data: { institution: string; value: number; share: number; count: number }[];
}) {
  return (
    <ul className="flex flex-col gap-4">
      {data.map((d) => (
        <li key={d.institution}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ink">
              {d.institution}{" "}
              <span className="text-sm text-muted">
                · {d.count} {d.count === 1 ? "ativo" : "ativos"}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold text-ink">{money(d.value)}</span>
              <span className="ml-2 text-sm text-muted">{pct(d.share)}</span>
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-line/60"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(d.share * 100)}
            aria-label={`${d.institution}: ${pct(d.share)} do patrimônio`}
          >
            <div className="h-full rounded-full" style={{ width: `${d.share * 100}%`, background: BAR_COLOR }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
