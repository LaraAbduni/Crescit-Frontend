import { useState } from "react";
import { Chip, TextField } from "~/components/ui";
import {
  CDI_REFERENCE,
  RATE_TYPE_LABEL,
  rateLabel,
  simulate,
  taxedEquivalentCdiPercent,
  type FixedIncomeOption,
  type RateType,
} from "~/lib/fixed-income";
import { money, parseDecimal, pct, qty } from "~/lib/format";
import { displayName, institutionOf, type Holding } from "~/lib/portfolio";

const PERIODS = [
  { months: 6, label: "6 meses" },
  { months: 12, label: "1 ano" },
  { months: 24, label: "2 anos" },
  { months: 36, label: "3 anos" },
  { months: 60, label: "5 anos" },
];

interface OptionState {
  exempt: boolean;
  rateType: RateType;
  rateValue: string;
}

const DEFAULTS: [OptionState, OptionState] = [
  { exempt: false, rateType: "CDI_PERCENT", rateValue: "110" },
  { exempt: true, rateType: "CDI_PERCENT", rateValue: "92" },
];

const toOption = (o: OptionState): FixedIncomeOption | null => {
  const rateValue = parseDecimal(o.rateValue);
  return rateValue > 0 ? { exempt: o.exempt, rateType: o.rateType, rateValue } : null;
};

/** Compara duas aplicações de renda fixa pelo valor líquido no fim do prazo. */
export function FixedIncomeComparator({ holdings }: { holdings: Holding[] }) {
  const [amountInput, setAmountInput] = useState("10000");
  const [months, setMonths] = useState(24);
  const [options, setOptions] = useState<[OptionState, OptionState]>(DEFAULTS);
  // Investimentos da pessoa com taxa cadastrada podem preencher uma opção
  const withRate = holdings.filter((h) => h.rateType && h.rateValue);

  const amount = parseDecimal(amountInput) || 0;
  const results = options.map((o) => {
    const option = toOption(o);
    return option && amount > 0 ? simulate(option, amount, months) : null;
  });
  const [a, b] = results;
  const best = a && b ? (a.net === b.net ? -1 : a.net > b.net ? 0 : 1) : -1;
  const period = PERIODS.find((p) => p.months === months)!.label;

  const update = (index: 0 | 1, patch: Partial<OptionState>) =>
    setOptions((current) => {
      const next = [...current] as [OptionState, OptionState];
      next[index] = { ...next[index], ...patch };
      return next;
    });

  // Equivalência: quanto um CDB precisa pagar para empatar com a opção isenta (% do CDI)
  const exemptCdi = options.findIndex((o) => o.exempt && o.rateType === "CDI_PERCENT" && parseDecimal(o.rateValue) > 0);

  return (
    <div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-end">
        <TextField label="Valor aplicado" inputMode="decimal" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />
        <fieldset>
          <legend className="mb-2 font-medium text-ink">Prazo</legend>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Chip key={p.months} selected={months === p.months} onClick={() => setMonths(p.months)}>
                {p.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {options.map((o, i) => {
          const r = results[i];
          const index = i as 0 | 1;
          return (
            <div key={i} className={`rounded-2xl border-2 p-5 ${best === i ? "border-brand bg-brand-soft/40" : "border-line"}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-ink">Opção {i === 0 ? "A" : "B"}</h3>
                {best === i && (
                  <span className="rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white">Rende mais</span>
                )}
              </div>

              {withRate.length > 0 && (
                <label className="mt-3 flex flex-col gap-1 text-sm text-muted">
                  Preencher com um investimento seu
                  <select
                    className="h-11 rounded-xl border-2 border-line bg-white px-3 text-[0.95rem] text-ink outline-none focus:border-brand"
                    value=""
                    onChange={(e) => {
                      const h = withRate.find((x) => x.id === e.target.value);
                      if (h) update(index, { exempt: !!h.taxExempt, rateType: h.rateType!, rateValue: String(h.rateValue).replace(".", ",") });
                    }}
                  >
                    <option value="">Escolher...</option>
                    {withRate.map((h) => (
                      <option key={h.id} value={h.id}>
                        {displayName(h)} · {institutionOf(h)} · {rateLabel(h.rateType!, h.rateValue!)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Chip selected={!o.exempt} onClick={() => update(index, { exempt: false })}>
                  CDB e outros (com IR)
                </Chip>
                <Chip selected={o.exempt} onClick={() => update(index, { exempt: true })}>
                  LCI ou LCA (isento)
                </Chip>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(RATE_TYPE_LABEL) as RateType[]).map((t) => (
                  <Chip key={t} selected={o.rateType === t} onClick={() => update(index, { rateType: t })}>
                    {RATE_TYPE_LABEL[t]}
                  </Chip>
                ))}
              </div>
              <div className="mt-3 max-w-40">
                <TextField
                  label={o.rateType === "CDI_PERCENT" ? "% do CDI" : o.rateType === "PREFIXED" ? "% ao ano" : "IPCA + % ao ano"}
                  inputMode="decimal"
                  value={o.rateValue}
                  onChange={(e) => update(index, { rateValue: e.target.value })}
                />
              </div>

              {r ? (
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.95rem]">
                  <dt className="text-muted">Valor bruto</dt>
                  <dd className="text-right text-ink tabular-nums">{money(r.gross)}</dd>
                  <dt className="text-muted">IR {r.taxRate > 0 ? `(${pct(r.taxRate)})` : ""}</dt>
                  <dd className="text-right text-ink tabular-nums">{r.tax > 0 ? `− ${money(r.tax)}` : "Isento"}</dd>
                  <dt className="font-semibold text-ink">Valor líquido</dt>
                  <dd className="text-right text-lg font-bold text-ink tabular-nums">{money(r.net)}</dd>
                  <dt className="text-muted">Rendimento líquido</dt>
                  <dd className="text-right text-ink tabular-nums">{pct(r.netAnnual)} ao ano</dd>
                </dl>
              ) : (
                <p className="mt-5 text-muted">Informe a taxa para simular.</p>
              )}
            </div>
          );
        })}
      </div>

      {a && b && best !== -1 && (
        <p className="mt-4 text-lg text-ink">
          A <strong>opção {best === 0 ? "A" : "B"}</strong> rende <strong>{money(Math.abs(a.net - b.net))}</strong> a mais em{" "}
          {period}, já descontado o IR.
        </p>
      )}
      {exemptCdi !== -1 && (
        <p className="mt-2 text-muted">
          Uma aplicação isenta de {qty(parseDecimal(options[exemptCdi].rateValue))}% do CDI equivale a um CDB de{" "}
          <strong className="text-ink">{qty(Math.round(taxedEquivalentCdiPercent(parseDecimal(options[exemptCdi].rateValue), months) * 10) / 10)}% do CDI</strong>{" "}
          nesse prazo.
        </p>
      )}
      <p className="mt-3 text-sm text-muted">
        Simulação com CDI de referência de {pct(CDI_REFERENCE)} ao ano e taxas constantes no período. Não considera IOF
        (resgates em menos de 30 dias).
      </p>
    </div>
  );
}
