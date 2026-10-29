import { useEffect, useMemo, useRef, useState } from "react";
import { dateBR, money, todayISO } from "~/lib/format";

// Validadas com scripts/validate_palette.js da skill de dataviz (fundo branco):
// passam em CVD, visão normal e contraste >= 3:1. Não reaproveitam as cores
// dos tipos de ativo do gráfico de distribuição.
const INVESTED_COLOR = "#00916f";
const TODAY_COLOR = "#d97a1f";

const HEIGHT = 240;
const PAD = { top: 16, right: 20, bottom: 30, left: 76 };
const DAY = 86_400_000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "2026-10-08" -> dias desde 1970 (UTC, para não mudar o dia pelo fuso) */
function toDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

function fromDay(day: number) {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

/** Teto "redondo" do eixo e o passo entre as linhas de grade (~4 linhas). */
function niceScale(max: number) {
  if (max <= 0) return { top: 100, step: 25 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { top: Math.ceil(max / step) * step, step };
}

type Position = {
  day: number;
  date: string;
  /** Total investido acumulado até este dia */
  invested: number;
  /** Soma dos aportes feitos neste dia */
  added: number;
  isToday: boolean;
};

/**
 * Evolução do patrimônio: total investido acumulado a cada aporte (degraus) e o
 * valor de mercado de hoje. Não há histórico de cotações, então o valor de
 * mercado só existe para hoje.
 */
export function EvolutionChart({
  contributions,
  currentValue,
}: {
  contributions: { contributionDate: string; amount: number }[];
  currentValue: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const positions = useMemo<Position[]>(() => {
    const byDay = new Map<number, number>();
    for (const c of contributions) {
      const day = toDay(c.contributionDate);
      byDay.set(day, (byDay.get(day) ?? 0) + c.amount);
    }
    const today = toDay(todayISO());
    let invested = 0;
    const list: Position[] = [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, added]) => {
        invested += added;
        return { day, date: fromDay(day), invested, added, isToday: day === today };
      });
    const last = list[list.length - 1];
    if (last && last.day >= today) last.isToday = true;
    else list.push({ day: today, date: fromDay(today), invested, added: 0, isToday: true });
    return list;
  }, [contributions]);

  const totalInvested = positions[positions.length - 1].invested;
  const end = positions[positions.length - 1].day;
  // Pelo menos uma semana no eixo, para um único aporte não virar um ponto solto
  const start = Math.min(positions[0].day, end - 7);
  const { top, step } = niceScale(Math.max(totalInvested, currentValue) * 1.08);

  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (day: number) => PAD.left + ((day - start) / (end - start)) * plotW;
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;

  // Degraus: o total investido só muda no dia de cada aporte
  const first = positions[0];
  let line = `M${x(start)},${y(0)} H${x(first.day)} V${y(first.invested)}`;
  for (const p of positions.slice(1)) line += ` H${x(p.day)} V${y(p.invested)}`;
  const area = `${line} V${y(0)} Z`;

  const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const span = end - start;
  // Menos datas no eixo em telas estreitas, para os rótulos não se sobreporem
  const fractions = plotW < 360 ? [0, 1] : plotW < 560 ? [0, 0.5, 1] : [0, 1 / 3, 2 / 3, 1];
  const xTicks = fractions.map((f) => Math.round(start + f * span));
  const xLabel = (day: number) => {
    const iso = fromDay(day);
    if (span <= 120) return dateBR(iso, false);
    return `${MONTHS[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
  };

  function nearest(px: number) {
    let best = 0;
    positions.forEach((p, i) => {
      if (Math.abs(x(p.day) - px) < Math.abs(x(positions[best].day) - px)) best = i;
    });
    return best;
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const last = positions.length - 1;
    setActive((i) => (i === null ? last : Math.min(Math.max(i + delta, 0), last)));
  }

  const activePos = active !== null ? positions[active] : null;
  const tooltipLeft = activePos ? Math.min(Math.max(x(activePos.day), 90), width - 90) : 0;

  return (
    <div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[0.95rem]">
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: INVESTED_COLOR }} aria-hidden />
          <span className="text-muted">Total investido</span>
          <span className="font-semibold text-ink">{money(totalInvested)}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: TODAY_COLOR }} aria-hidden />
          <span className="text-muted">Valor hoje</span>
          <span className="font-semibold text-ink">{money(currentValue)}</span>
        </li>
      </ul>

      <div ref={containerRef} className="relative mt-4" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Evolução do total investido, de ${money(first.invested)} em ${dateBR(first.date)} até ${money(totalInvested)} hoje. Valor de mercado hoje: ${money(currentValue)}.`}
            tabIndex={0}
            className="overflow-visible outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-brand/40"
            onPointerMove={(e) => setActive(nearest(e.clientX - e.currentTarget.getBoundingClientRect().left))}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(positions.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={handleKey}
          >
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
                <text x={PAD.left - 10} y={y(v)} dy="0.35em" textAnchor="end" className="fill-muted text-xs tabular-nums">
                  {compactMoney.format(v)}
                </text>
              </g>
            ))}
            {xTicks.map((day, i) => (
              <text
                key={i}
                x={x(day)}
                y={HEIGHT - 8}
                textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
                className="fill-muted text-xs tabular-nums"
              >
                {xLabel(day)}
              </text>
            ))}

            <path d={area} fill={INVESTED_COLOR} fillOpacity={0.1} />
            <path d={line} fill="none" stroke={INVESTED_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {activePos && (
              <line
                x1={x(activePos.day)}
                x2={x(activePos.day)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--color-muted)"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            )}
            {activePos && !activePos.isToday && (
              <circle cx={x(activePos.day)} cy={y(activePos.invested)} r={5} fill={INVESTED_COLOR} stroke="white" strokeWidth={2} />
            )}
            <circle cx={x(end)} cy={y(totalInvested)} r={4} fill={INVESTED_COLOR} stroke="white" strokeWidth={2} />
            <circle cx={x(end)} cy={y(currentValue)} r={6} fill={TODAY_COLOR} stroke="white" strokeWidth={2} />
          </svg>
        )}

        {activePos && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm whitespace-nowrap shadow-md"
            style={{ left: tooltipLeft }}
            aria-hidden
          >
            <p className="text-muted">{activePos.isToday ? "Hoje" : dateBR(activePos.date)}</p>
            {activePos.isToday && (
              <TooltipRow color={TODAY_COLOR} dot label="Valor hoje" value={money(currentValue)} />
            )}
            <TooltipRow color={INVESTED_COLOR} label="Total investido" value={money(activePos.invested)} />
            {activePos.added > 0 && <p className="mt-0.5 text-muted">Aporte de {money(activePos.added)} no dia</p>}
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Evolução do patrimônio</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Aportes no dia</th>
            <th scope="col">Total investido</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.day}>
              <th scope="row">{p.isToday ? `Hoje (${dateBR(p.date)})` : dateBR(p.date)}</th>
              <td>{money(p.added)}</td>
              <td>{money(p.invested)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Valor de mercado hoje</th>
            <td />
            <td>{money(currentValue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TooltipRow({ color, dot = false, label, value }: { color: string; dot?: boolean; label: string; value: string }) {
  return (
    <p className="mt-1 flex items-center gap-2">
      <span className={dot ? "size-2 rounded-full" : "h-0.5 w-3 rounded-full"} style={{ background: color }} aria-hidden />
      <span className="font-semibold text-ink tabular-nums">{value}</span>
      <span className="text-muted">{label}</span>
    </p>
  );
}
