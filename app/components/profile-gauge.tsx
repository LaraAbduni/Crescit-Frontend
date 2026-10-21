import { useEffect, useState } from "react";
import { INVESTOR_TYPES, type InvestorType } from "~/lib/profile";

const TYPES: InvestorType[] = ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"];
const COLORS: Record<InvestorType, string> = {
  CONSERVATIVE: "var(--color-conservative)",
  MODERATE: "var(--color-moderate)",
  AGGRESSIVE: "var(--color-aggressive)",
};

const CX = 150;
const CY = 150;
const R = 118;
const GAP = 0.012;

// f vai de 0 (esquerda) a 1 (direita) ao longo do semicírculo
function point(f: number, r = R) {
  const angle = Math.PI * (1 - f);
  return { x: CX + r * Math.cos(angle), y: CY - r * Math.sin(angle) };
}

function arc(f0: number, f1: number) {
  const a = point(f0);
  const b = point(f1);
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
}

/**
 * Cada perfil ocupa um terço do medidor; dentro do terço, o ponteiro fica
 * proporcional à posição do score na faixa daquele perfil.
 */
function needleFraction(type: InvestorType, score: number) {
  const i = TYPES.indexOf(type);
  const [lo, hi] = INVESTOR_TYPES[type].range;
  const t = Math.min(Math.max((score - lo + 0.5) / (hi - lo + 1), 0), 1);
  return (i + t) / 3;
}

export function ProfileGauge({ type, score }: { type: InvestorType; score: number }) {
  // Começa no zero e anima até a posição final
  const [fraction, setFraction] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFraction(needleFraction(type, score)));
    return () => cancelAnimationFrame(id);
  }, [type, score]);

  const rotation = fraction * 180 - 90; // -90° = esquerda, 90° = direita

  return (
    <div className="w-full">
      <svg viewBox="0 0 300 170" className="mx-auto w-full max-w-[300px]" role="img" aria-label={`Medidor: perfil ${INVESTOR_TYPES[type].label}`}>
        {TYPES.map((t, i) => (
          <path
            key={t}
            d={arc(i / 3 + (i ? GAP : 0), (i + 1) / 3 - (i < 2 ? GAP : 0))}
            stroke={COLORS[t]}
            strokeWidth={30}
            fill="none"
          />
        ))}
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: "transform 900ms cubic-bezier(.2,.8,.2,1)",
          }}
        >
          <line x1={CX} y1={CY} x2={CX} y2={CY - 102} stroke="var(--color-ink)" strokeWidth={5} strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r={11} fill="var(--color-ink)" />
        <circle cx={CX} cy={CY} r={4.5} fill="var(--color-cream)" />
      </svg>
      <div className="mt-3 grid grid-cols-3 text-[0.95rem] text-muted">
        <span className="text-left">Conservador</span>
        <span className="text-center">Moderado</span>
        <span className="text-right">Sofisticado</span>
      </div>
    </div>
  );
}

export const PROFILE_TEXT_COLOR: Record<InvestorType, string> = {
  CONSERVATIVE: "text-conservative",
  MODERATE: "text-moderate-text",
  AGGRESSIVE: "text-aggressive",
};
