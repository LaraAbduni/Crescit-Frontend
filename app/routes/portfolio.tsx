import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/portfolio";
import { ConfirmRemoval, ContributionForm, InvestmentForm } from "~/components/portfolio-forms";
import { Sheet } from "~/components/sheet";
import { useToast } from "~/components/toast";
import { Trend } from "~/components/trend";
import { PageTitle } from "~/components/ui";
import { dateBR, money, qty } from "~/lib/format";
import { useOnboarding } from "~/lib/onboarding";
import {
  addContribution,
  addInvestment,
  deleteContribution,
  deleteInvestment,
  unitLabel,
  type Contribution,
  type Holding,
} from "~/lib/portfolio";
import { usePortfolio } from "~/lib/use-portfolio";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Carteira · Crescit" }];
}

type SheetState =
  | { kind: "investment" }
  | { kind: "contribution"; holding: Holding }
  | { kind: "removeInvestment"; holding: Holding }
  | { kind: "removeContribution"; holding: Holding; contribution: Contribution }
  | null;

export default function Portfolio() {
  const { profile } = useOnboarding();
  const userId = profile!.userId;
  const { load, reload, retry } = usePortfolio(userId);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const toast = useToast();

  const toggle = (id: string) => setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <PageTitle>Carteira</PageTitle>
        <button
          type="button"
          onClick={() => setSheet({ kind: "investment" })}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-brand px-5 text-lg font-semibold text-white hover:bg-brand-dark"
        >
          <PlusIcon /> Investimento
        </button>
      </div>

      {load.status === "loading" && <PortfolioSkeleton />}

      {load.status === "error" && (
        <div className="mt-6 rounded-3xl border border-line bg-white p-6 text-center">
          <p className="text-lg text-ink">{load.message}</p>
          <button type="button" onClick={retry} className="mt-4 h-12 rounded-xl border-2 border-brand px-5 text-lg font-semibold text-brand hover:bg-brand-soft">
            Tentar de novo
          </button>
        </div>
      )}

      {load.status === "done" && (
        <>
          {load.refreshError && <p role="alert" className="mt-4 text-aggressive">{load.refreshError} <button type="button" className="underline" onClick={retry}>Atualizar</button></p>}
          <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
            <div className="lg:sticky lg:top-12">
              <section className="rounded-3xl border border-line bg-white p-6">
                <p className="text-muted">Valor atual</p>
                <p className="mt-1 font-serif text-[2.6rem] leading-tight font-bold text-ink">{money(load.summary.currentValue)}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[1.05rem]">
                  <Trend gain={load.summary.gain} gainPct={load.summary.gainPct} />
                  <span className="text-muted">Investido {money(load.summary.totalInvested)}</span>
                </p>
              </section>
              <p className="mt-3 text-sm text-muted">Os valores usam os preços cadastrados no catálogo, sem cotação em tempo real.</p>
              {load.summary.hasMissingPrices && <p role="status" className="mt-2 text-sm text-muted">Alguns ativos estão sem preço disponível. Para eles, mostramos o valor investido.</p>}
            </div>
            {load.summary.holdings.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-line bg-white p-6 text-center lg:mt-0">
                <p className="text-lg font-semibold text-ink">Sua carteira está vazia</p>
                <p className="mt-1 text-muted">Adicione um investimento ou comece pelas recomendações para o seu perfil.</p>
                <Link to="/recomendacoes" className="mt-4 inline-block text-lg font-semibold text-brand hover:underline">
                  Ver recomendações
                </Link>
              </div>
            ) : (
              <ul className="mt-5 flex flex-col gap-4 lg:mt-0">
                {load.summary.holdings.map((h) => (
                  <li key={h.id}>
                    <HoldingCard
                      holding={h}
                      open={expanded.includes(h.id)}
                      onToggle={() => toggle(h.id)}
                      onNewContribution={() => setSheet({ kind: "contribution", holding: h })}
                    onRemove={() => setSheet({ kind: "removeInvestment", holding: h })}
                    onRemoveContribution={(c) => setSheet({ kind: "removeContribution", holding: h, contribution: c })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {sheet?.kind === "investment" && (
        <Sheet title="Novo investimento" onClose={() => setSheet(null)}>
          <InvestmentForm
            onSubmit={async (investment, contribution) => {
              const owned = load.status === "done" && load.summary.holdings.some((h) => h.ticker === investment.ticker);
              const created = await addInvestment(userId, investment);
              await addContribution(userId, created.id, contribution);
              await reload();
              setExpanded((e) => [...e, created.id]);
              setSheet(null);
              toast(owned ? `Aporte em ${created.ticker} registrado` : `${created.ticker} adicionado à carteira`);
            }}
          />
        </Sheet>
      )}

      {sheet?.kind === "contribution" && (
        <Sheet title={`Novo aporte · ${sheet.holding.ticker}`} onClose={() => setSheet(null)}>
          <ContributionForm
            suggestedPrice={sheet.holding.currentPrice}
            onSubmit={async (req) => {
              await addContribution(userId, sheet.holding.id, req);
              await reload();
              setSheet(null);
              toast(`Aporte em ${sheet.holding.ticker} registrado`);
            }}
          />
        </Sheet>
      )}

      {sheet?.kind === "removeInvestment" && (
        <Sheet title={`Remover ${sheet.holding.ticker}?`} onClose={() => setSheet(null)}>
          <ConfirmRemoval
            message={
              sheet.holding.contributions.length > 0
                ? `O ativo sai da carteira junto com ${sheet.holding.contributions.length === 1 ? "o aporte registrado" : `os ${sheet.holding.contributions.length} aportes registrados`}. Essa ação não pode ser desfeita.`
                : "O ativo sai da sua carteira."
            }
            confirmLabel="Remover da carteira"
            onCancel={() => setSheet(null)}
            onConfirm={async () => {
              await deleteInvestment(userId, sheet.holding.id);
              await reload();
              setExpanded((e) => e.filter((id) => id !== sheet.holding.id));
              setSheet(null);
              toast(`${sheet.holding.ticker} removido da carteira`);
            }}
          />
        </Sheet>
      )}

      {sheet?.kind === "removeContribution" && (
        <Sheet title="Remover aporte?" onClose={() => setSheet(null)}>
          <ConfirmRemoval
            message={
              <>
                Aporte de <strong className="text-ink">{money(sheet.contribution.amount)}</strong> em {sheet.holding.ticker},
                feito em {dateBR(sheet.contribution.contributionDate)}. A quantidade e o preço médio do ativo serão recalculados.
              </>
            }
            confirmLabel="Remover aporte"
            onCancel={() => setSheet(null)}
            onConfirm={async () => {
              await deleteContribution(userId, sheet.holding.id, sheet.contribution.id);
              await reload();
              setSheet(null);
              toast("Aporte removido");
            }}
          />
        </Sheet>
      )}
    </>
  );
}

function HoldingCard({
  holding: h,
  open,
  onToggle,
  onNewContribution,
  onRemove,
  onRemoveContribution,
}: {
  holding: Holding;
  open: boolean;
  onToggle: () => void;
  onNewContribution: () => void;
  onRemove: () => void;
  onRemoveContribution: (c: Contribution) => void;
}) {
  const panelId = `aportes-${h.id}`;
  const subtitle =
    h.totalQuantity === 0
      ? "Nenhum aporte ainda"
      : h.assetType === "FIXED_INCOME"
        ? `${h.assetName} · ${money(h.totalInvested)} investidos`
        : `${qty(h.totalQuantity)} ${unitLabel(h.assetType, h.totalQuantity)} · PM ${money(h.averagePrice)}`;

  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-5 py-5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-bold break-words text-ink">{h.ticker}</span>
          <span className="block text-[0.95rem] text-muted">{subtitle}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-lg font-bold whitespace-nowrap text-ink">{money(h.currentValue)}</span>
          <Trend gain={h.gain} gainPct={h.gainPct} showAmount={false} />
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="border-t border-line bg-cream/60 px-5 pt-5 pb-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">Histórico de aportes</h3>
          {h.contributions.length === 0 ? (
            <p className="mt-3 text-muted">Registre o primeiro aporte deste ativo.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {h.contributions.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-[0.875rem] whitespace-nowrap">
                  <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span className="text-muted tabular-nums">{dateBR(c.contributionDate)}</span>
                  <span className="flex-1 text-ink tabular-nums">
                    {qty(c.quantity)} × {money(c.unitPrice)}
                  </span>
                  <span className="font-semibold text-ink tabular-nums">{money(c.amount)}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveContribution(c)}
                    aria-label={`Remover aporte de ${dateBR(c.contributionDate)}`}
                    title="Remover aporte"
                    className="-my-1 grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-aggressive/10 hover:text-aggressive"
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onNewContribution}
              className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-brand bg-white px-5 text-lg font-semibold text-brand hover:bg-brand-soft"
            >
              <PlusIcon /> Novo aporte
            </button>
            <button type="button" onClick={onRemove} className="font-semibold text-[#b4472f] hover:underline">
              Remover ativo
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="mt-6 flex animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-36 rounded-3xl border border-line bg-white" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 rounded-3xl border border-line bg-white" />
      ))}
    </div>
  );
}
