import { useState } from "react";
import { PrimaryButton, TextField } from "~/components/ui";
import { incomeTaxRate, rateLabel, simulate } from "~/lib/fixed-income";
import { money, parseDecimal, pct } from "~/lib/format";
import { unitLabel } from "~/lib/portfolio";
import {
  ASSET_TYPE_DESCRIPTION,
  ASSET_TYPE_LABEL,
  RISK_EXPLANATION,
  RISK_LABEL,
  type Asset,
  type Recommendation,
} from "~/lib/recommendations";

/** Conteúdo do painel de detalhe de um ativo recomendado. */
export function AssetDetail({
  item,
  asset,
  reason,
  balances,
  owned,
  onAdd,
}: {
  item: Recommendation;
  /** Dados do catálogo (descrição, liquidez, taxa); podem faltar se o catálogo não carregar */
  asset?: Asset;
  reason?: string;
  balances: boolean;
  owned: boolean;
  onAdd: () => void;
}) {
  const [amountInput, setAmountInput] = useState("1000");
  const amount = parseDecimal(amountInput) || 0;
  const isRate = !!(asset?.rateType && asset.rateValue);

  const facts: [string, React.ReactNode][] = [
    ["Tipo", ASSET_TYPE_LABEL[item.assetType]],
    ["Risco", <><span className="font-semibold">{RISK_LABEL[item.riskLevel]}.</span> {RISK_EXPLANATION[item.riskLevel]}</>],
  ];
  if (isRate) {
    facts.push(["Rentabilidade", rateLabel(asset!.rateType!, asset!.rateValue!)]);
    facts.push(["Imposto de renda", asset!.taxExempt ? "Isento para pessoa física" : "Tabela regressiva: de 22,5% a 15% sobre o rendimento"]);
    if (asset!.minimumInvestment) facts.push(["Aplicação mínima", money(asset!.minimumInvestment)]);
  } else {
    facts.push(["Preço de referência", money(item.currentPrice)]);
  }
  if (asset?.liquidity) facts.push(["Resgate", asset.liquidity]);
  if (asset?.sector && !isRate) facts.push(["Setor", asset.sector]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[1.05rem] leading-relaxed text-ink/85">{asset?.description || ASSET_TYPE_DESCRIPTION[item.assetType]}</p>

      {reason && (
        <div className={`rounded-2xl px-4 py-3 ${balances ? "bg-brand-soft" : "bg-white"}`}>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {balances ? "Equilibra sua carteira" : "Por que para você"}
          </p>
          <p className="mt-1 text-ink">{reason}</p>
        </div>
      )}

      <dl className="divide-y divide-line rounded-2xl bg-white px-4">
        {facts.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-2xl bg-white p-4" aria-label="Simulação">
        <h3 className="font-semibold text-ink">Simule</h3>
        <div className="mt-3 max-w-48">
          <TextField label="Quanto quer investir?" inputMode="decimal" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />
        </div>
        <div className="mt-3 text-ink">
          {amount <= 0 ? (
            <p className="text-muted">Informe um valor.</p>
          ) : isRate ? (
            <FixedIncomeSimulation asset={asset!} amount={amount} />
          ) : (
            <MarketSimulation item={item} amount={amount} />
          )}
        </div>
      </section>

      {owned ? (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-center font-semibold text-brand">Este ativo já está na sua carteira</p>
      ) : (
        <PrimaryButton onClick={onAdd}>Adicionar à carteira</PrimaryButton>
      )}
    </div>
  );
}

function MarketSimulation({ item, amount }: { item: Recommendation; amount: number }) {
  const units = Math.floor(amount / item.currentPrice);
  if (units === 0) {
    return (
      <p>
        Com {money(amount)} ainda não dá para comprar uma unidade: cada uma custa cerca de <strong>{money(item.currentPrice)}</strong>.
      </p>
    );
  }
  return (
    <p>
      Com {money(amount)} você compra cerca de{" "}
      <strong>
        {units} {unitLabel(item.assetType, units)}
      </strong>{" "}
      ({money(units * item.currentPrice)}), e sobram {money(amount - units * item.currentPrice)}.
    </p>
  );
}

function FixedIncomeSimulation({ asset, amount }: { asset: Asset; amount: number }) {
  const option = { rateType: asset.rateType!, rateValue: asset.rateValue!, exempt: !!asset.taxExempt };
  const rows = [12, 24].map((months) => ({ months, ...simulate(option, amount, months) }));
  return (
    <>
      {asset.minimumInvestment && amount < asset.minimumInvestment && (
        <p className="mb-2 text-sm text-moderate-text">A aplicação mínima de referência é {money(asset.minimumInvestment)}.</p>
      )}
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.months}>
            Em {r.months === 12 ? "1 ano" : "2 anos"}: <strong>{money(r.net)}</strong>
            <span className="text-muted">
              {" "}
              líquido{asset.taxExempt ? " (isento)" : ` (IR de ${pct(incomeTaxRate(Math.round((r.months / 12) * 365)))})`}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
