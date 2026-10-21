import { money, signedPct } from "~/lib/format";

/**
 * ▲ R$ 576,00 (+3,1%) em verde ou ▼ em vermelho. A seta acompanha a cor,
 * para a direção não depender só dela.
 */
export function Trend({
  gain,
  gainPct,
  showAmount = true,
  onDark = false,
  className = "",
}: {
  gain: number;
  gainPct: number | null;
  showAmount?: boolean;
  onDark?: boolean;
  className?: string;
}) {
  if (gainPct === null) return null;
  const up = gain >= 0;
  const color = onDark ? "text-white" : up ? "text-[#1f7a4d]" : "text-[#c0392b]";
  const pctText = signedPct(gainPct);
  return (
    <span className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap ${color} ${className}`}>
      <span aria-hidden className="text-[0.8em]">{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "Alta de" : "Queda de"}</span>
      {showAmount ? `${money(Math.abs(gain))} (${pctText})` : pctText}
    </span>
  );
}
