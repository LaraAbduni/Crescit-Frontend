import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/alerts";
import { Sheet } from "~/components/sheet";
import { useToast } from "~/components/toast";
import { Chip, PageTitle, PrimaryButton, TextField } from "~/components/ui";
import { money, parseDecimal, pct, signedPct, todayISO } from "~/lib/format";
import { useOnboarding } from "~/lib/onboarding";
import { displayName } from "~/lib/portfolio";
import {
  DIRECTION_LABEL,
  newAlertId,
  PERCENT_OPTIONS,
  triggerPrice,
  usePriceAlerts,
  type AlertDirection,
  type AlertStatus,
  type PriceAlert,
} from "~/lib/price-alerts";
import { ASSET_TYPE_LABEL, getAssets, type Asset, type AssetType } from "~/lib/recommendations";
import { usePortfolio } from "~/lib/use-portfolio";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Avisos · Crescit" }];
}

const BAR_COLOR = "#00916f";

interface AssetOption {
  ticker: string;
  assetName: string;
  assetType: AssetType;
  /** Preço médio (venda) ou preço de hoje (compra) */
  basePrice: number;
  currentPrice: number;
}

export default function Alerts() {
  const { profile } = useOnboarding();
  const { userId } = profile!;
  const { alerts, statuses, loaded, save } = usePriceAlerts(userId);
  const { load } = usePortfolio(userId);
  const [catalog, setCatalog] = useState<Asset[]>([]);
  const [creating, setCreating] = useState<AlertDirection | null>(null);
  const toast = useToast();

  useEffect(() => {
    getAssets()
      .then((assets) => setCatalog(assets.filter((a) => a.active && !a.rateType && a.currentPrice > 0)))
      .catch(() => {});
  }, []);

  // Venda: ativos da carteira com preço no catálogo; compra: qualquer ativo de bolsa do catálogo
  const sellOptions: AssetOption[] =
    load.status === "done"
      ? load.summary.holdings
          .filter((h) => h.valuation === "market" && h.currentPrice && h.averagePrice > 0)
          .map((h) => ({ ticker: h.ticker, assetName: h.assetName, assetType: h.assetType, basePrice: h.averagePrice, currentPrice: h.currentPrice! }))
      : [];
  const buyOptions: AssetOption[] = catalog.map((a) => ({ ticker: a.ticker, assetName: a.name, assetType: a.assetType, basePrice: a.currentPrice, currentPrice: a.currentPrice }));

  const remove = (id: string, message: string) => {
    save(alerts.filter((a) => a.id !== id));
    toast(message);
  };

  const triggered = statuses.filter((s) => s.triggered);
  const waiting = (direction: AlertDirection) => statuses.filter((s) => !s.triggered && s.alert.direction === direction);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>Avisos</PageTitle>
          <p className="mt-1 max-w-2xl text-lg text-muted">
            Escolha o momento: um lembrete para vender quando um ativo seu subir, ou para comprar quando um ativo que você
            quer cair.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating("sell-up")}
          className="inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 text-lg font-semibold text-white hover:bg-brand-dark"
        >
          <span aria-hidden className="text-2xl leading-none">+</span> Novo aviso
        </button>
      </div>

      {loaded && triggered.length > 0 && (
        <section className="mt-6" aria-labelledby="disparados">
          <h2 id="disparados" className="flex items-center gap-2 text-lg font-semibold text-ink">
            <span className="size-2.5 rounded-full bg-aggressive" aria-hidden /> Disparados
          </h2>
          <ul className="mt-3 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {triggered.map((s) => (
              <li key={s.alert.id}>
                <AlertCard status={s} onRemove={() => remove(s.alert.id, "Aviso dispensado")} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        {(["sell-up", "buy-down"] as const).map((direction) => {
          const list = waiting(direction);
          return (
            <section key={direction} aria-labelledby={`sec-${direction}`}>
              <div className="flex items-center justify-between gap-4">
                <h2 id={`sec-${direction}`} className="text-lg font-semibold text-ink">
                  {direction === "sell-up" ? "Lembretes de venda" : "Lista de compra"}
                </h2>
                <button type="button" onClick={() => setCreating(direction)} className="font-semibold text-brand hover:underline">
                  Adicionar
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">
                {direction === "sell-up"
                  ? "Avisamos quando o preço passar do seu preço médio mais a porcentagem escolhida."
                  : "Avisamos quando o preço cair a porcentagem escolhida em relação ao dia em que você criou o aviso."}
              </p>
              {loaded && list.length === 0 ? (
                <div className="mt-3 rounded-3xl border border-dashed border-line bg-white p-6 text-center text-muted">
                  {direction === "sell-up" ? "Nenhum lembrete de venda aguardando." : "Nenhum ativo na lista de compra."}
                </div>
              ) : (
                <ul className="mt-3 flex flex-col gap-4">
                  {list.map((s) => (
                    <li key={s.alert.id}>
                      <AlertCard status={s} onRemove={() => remove(s.alert.id, "Aviso removido")} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-sm text-muted">
        Os avisos usam os preços do catálogo do Crescit, que ainda não são cotações em tempo real. Com a cotação ao vivo, o
        aviso vai chegar por notificação e e-mail.
      </p>

      {creating && (
        <Sheet title="Novo aviso" onClose={() => setCreating(null)}>
          <AlertForm
            initialDirection={creating}
            sellOptions={sellOptions}
            buyOptions={buyOptions}
            existing={alerts}
            onSubmit={(alert) => {
              save([...alerts, alert]);
              setCreating(null);
              toast(`Aviso de ${alert.ticker} criado`);
            }}
          />
        </Sheet>
      )}
    </>
  );
}

function AlertCard({ status, onRemove }: { status: AlertStatus; onRemove: () => void }) {
  const { alert, currentPrice, change, triggered, progress } = status;
  const sell = alert.direction === "sell-up";
  const name = displayName(alert);

  return (
    <article className={`rounded-3xl border bg-white p-5 ${triggered ? "border-aggressive/50 ring-2 ring-aggressive/15" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{DIRECTION_LABEL[alert.direction]}</p>
          <h3 className="truncate text-lg font-semibold text-ink">
            {name} <span className="font-normal text-muted">· {alert.assetName}</span>
          </h3>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${sell ? "bg-brand-soft text-brand" : "bg-moderate-soft text-moderate-text"}`}>
          {sell ? "↑" : "↓"} {pct(alert.percent)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-muted">{sell ? "Preço médio" : "Preço na criação"}</dt>
          <dd className="font-semibold text-ink tabular-nums">{money(alert.basePrice)}</dd>
        </div>
        <div>
          <dt className="text-muted">Gatilho</dt>
          <dd className="font-semibold text-ink tabular-nums">{money(status.triggerPrice)}</dd>
        </div>
        <div>
          <dt className="text-muted">Hoje</dt>
          <dd className="font-semibold text-ink tabular-nums">{currentPrice !== undefined ? money(currentPrice) : "—"}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-cream"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label={`Caminho até o gatilho de ${name}`}
        >
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: triggered ? "#d97a1f" : BAR_COLOR }} />
        </div>
        <p className="mt-2 text-sm text-ink">
          {change === undefined ? (
            <span className="text-muted">Sem preço no catálogo para acompanhar.</span>
          ) : triggered ? (
            <span className="font-semibold">
              {sell ? `Subiu ${signedPct(change)}: pode ser hora de vender parte.` : `Caiu ${signedPct(change)}: pode ser hora de comprar.`}
            </span>
          ) : (
            <>
              Variação de <span className="font-semibold tabular-nums">{signedPct(change)}</span>; o aviso dispara em{" "}
              {sell ? "+" : "−"}
              {pct(alert.percent)}.
            </>
          )}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {triggered && (
          <Link
            to={sell ? "/carteira" : `/recomendacoes?ativo=${encodeURIComponent(alert.ticker)}`}
            className="font-semibold text-brand hover:underline"
          >
            {sell ? "Ver na carteira" : "Ver para comprar"}
          </Link>
        )}
        <button type="button" onClick={onRemove} className="font-semibold text-muted hover:text-aggressive hover:underline">
          {triggered ? "Dispensar" : "Remover"}
        </button>
      </div>
    </article>
  );
}

function AlertForm({
  initialDirection,
  sellOptions,
  buyOptions,
  existing,
  onSubmit,
}: {
  initialDirection: AlertDirection;
  sellOptions: AssetOption[];
  buyOptions: AssetOption[];
  existing: PriceAlert[];
  onSubmit: (alert: PriceAlert) => void;
}) {
  const [direction, setDirection] = useState<AlertDirection>(initialDirection);
  const [ticker, setTicker] = useState("");
  const [percentInput, setPercentInput] = useState("10");
  const [submitted, setSubmitted] = useState(false);

  const options = direction === "sell-up" ? sellOptions : buyOptions;
  const option = options.find((o) => o.ticker === ticker);
  const percent = parseDecimal(percentInput) / 100;
  const duplicate = existing.some((a) => a.ticker === ticker && a.direction === direction);

  const errors = {
    ticker: !option ? "Escolha um ativo" : duplicate ? "Já existe um aviso desse tipo para este ativo" : undefined,
    percent: !(percent > 0 && percent < (direction === "buy-down" ? 1 : 10)) ? "Informe uma porcentagem válida" : undefined,
  };
  const shown: Partial<typeof errors> = submitted ? errors : {};

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (errors.ticker || errors.percent || !option) return;
        onSubmit({
          id: newAlertId(),
          ticker: option.ticker,
          assetName: option.assetName,
          assetType: option.assetType,
          direction,
          percent,
          basePrice: option.basePrice,
          createdAt: todayISO(),
        });
      }}
    >
      <fieldset>
        <legend className="mb-2 font-medium text-ink">Quero ser avisado para</legend>
        <div className="flex flex-wrap gap-2">
          <Chip selected={direction === "sell-up"} onClick={() => { setDirection("sell-up"); setTicker(""); }}>
            ↑ Vender quando subir
          </Chip>
          <Chip selected={direction === "buy-down"} onClick={() => { setDirection("buy-down"); setTicker(""); }}>
            ↓ Comprar quando cair
          </Chip>
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="font-medium text-ink">Ativo</span>
        <select
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className={`h-14 rounded-2xl border-2 bg-white px-4 text-lg text-ink outline-none focus:border-brand ${shown.ticker ? "border-aggressive" : "border-line"}`}
        >
          <option value="">Escolher...</option>
          {options.map((o) => (
            <option key={o.ticker} value={o.ticker}>
              {o.ticker} · {o.assetName} ({ASSET_TYPE_LABEL[o.assetType]})
            </option>
          ))}
        </select>
        {shown.ticker && <span className="text-sm text-aggressive">{shown.ticker}</span>}
        {direction === "sell-up" && sellOptions.length === 0 && (
          <span className="text-sm text-muted">Você ainda não tem ações, FIIs ou ETFs com preço no catálogo.</span>
        )}
      </label>

      <fieldset>
        <legend className="mb-2 font-medium text-ink">{direction === "sell-up" ? "Quando subir" : "Quando cair"}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {PERCENT_OPTIONS.map((p) => (
            <Chip key={p} selected={percent === p} onClick={() => setPercentInput(String(p * 100))}>
              {pct(p).replace(",0", "")}
            </Chip>
          ))}
          <div className="w-28">
            <TextField label="Outro (%)" inputMode="decimal" value={percentInput} onChange={(e) => setPercentInput(e.target.value)} error={shown.percent} />
          </div>
        </div>
      </fieldset>

      {option && percent > 0 && (
        <p className="rounded-2xl bg-white px-4 py-3 text-ink">
          Avisaremos quando <span className="font-semibold">{option.ticker}</span> chegar a{" "}
          <span className="font-semibold">{money(triggerPrice({ direction, percent, basePrice: option.basePrice }))}</span> (
          {direction === "sell-up" ? "+" : "−"}
          {pct(percent)} sobre {direction === "sell-up" ? "o seu preço médio" : "o preço de hoje"}, {money(option.basePrice)}). Hoje está em{" "}
          {money(option.currentPrice)}.
        </p>
      )}

      <PrimaryButton type="submit">Criar aviso</PrimaryButton>
    </form>
  );
}
