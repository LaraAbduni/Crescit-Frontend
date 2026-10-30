import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/portfolio";
import { ConfirmRemoval, ContributionForm, EditInvestmentForm, InvestmentForm } from "~/components/portfolio-forms";
import { Sheet } from "~/components/sheet";
import { useToast } from "~/components/toast";
import { Trend } from "~/components/trend";
import { Chip, PageTitle } from "~/components/ui";
import { CDI_REFERENCE, rateLabel } from "~/lib/fixed-income";
import { dateBR, money, pct, qty } from "~/lib/format";
import { useOnboarding } from "~/lib/onboarding";
import {
  addContribution,
  addInvestment,
  deleteContribution,
  deleteInvestment,
  updateInvestment,
  displayName,
  institutionOf,
  ALLOCATION_ORDER,
  unitLabel,
  type Contribution,
  type Holding,
} from "~/lib/portfolio";
import { ASSET_TYPE_LABEL } from "~/lib/recommendations";
import { usePortfolio } from "~/lib/use-portfolio";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Carteira · Crescit" }];
}

type SheetState =
  | { kind: "investment" }
  | { kind: "contribution"; holding: Holding }
  | { kind: "edit"; holding: Holding }
  | { kind: "removeInvestment"; holding: Holding }
  | { kind: "removeContribution"; holding: Holding; contribution: Contribution }
  | null;

type GroupBy = "institution" | "type";

export default function Portfolio() {
  const { profile, context } = useOnboarding();
  const userId = profile!.userId;
  const { load, reload, retry } = usePortfolio(userId);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("institution");
  const toast = useToast();

  // Instituições já usadas na carteira e as marcadas no cadastro aparecem primeiro no formulário
  const preferredInstitutions = [
    ...(load.status === "done" ? load.summary.byInstitution.map((i) => i.institution) : []),
    ...(context?.banks ?? []),
  ].filter((name) => name !== "Nenhuma" && name !== "Outro" && name !== "Sem instituição");

  const groups =
    load.status !== "done"
      ? []
      : groupBy === "institution"
        ? load.summary.byInstitution.map((g) => ({
            key: g.institution,
            label: g.institution,
            value: g.value,
            share: g.share,
            holdings: load.summary.holdings.filter((h) => institutionOf(h) === g.institution),
          }))
        : load.summary.allocation.map((g) => ({
            key: g.type,
            label: ASSET_TYPE_LABEL[g.type],
            value: g.value,
            share: g.share,
            holdings: load.summary.holdings.filter((h) => h.assetType === g.type),
          }));
  // Ativos com valor zero (sem aportes) não entram na distribuição por tipo; ficam num grupo à parte
  const ungrouped =
    load.status === "done" && groupBy === "type"
      ? load.summary.holdings.filter((h) => !groups.some((g) => g.holdings.includes(h)))
      : [];
  if (ungrouped.length > 0) groups.push({ key: "other", label: "Sem aportes", value: 0, share: 0, holdings: ungrouped });

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
              <p className="mt-3 text-sm text-muted">Ações, FIIs e ETFs usam os preços cadastrados no catálogo, sem cotação em tempo real.</p>
              {load.summary.hasEstimates && (
                <p className="mt-2 text-sm text-muted">
                  Renda fixa: valor bruto estimado pela taxa contratada, com CDI de referência de {pct(CDI_REFERENCE)} ao ano.
                </p>
              )}
              {load.summary.hasMissingPrices && <p role="status" className="mt-2 text-sm text-muted">Para fundos e ativos sem preço ou taxa, mostramos o valor investido.</p>}
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
              <div className="mt-5 lg:mt-0">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Agrupar investimentos">
                  <Chip selected={groupBy === "institution"} onClick={() => setGroupBy("institution")}>
                    Por instituição
                  </Chip>
                  <Chip selected={groupBy === "type"} onClick={() => setGroupBy("type")}>
                    Por tipo
                  </Chip>
                </div>
                {groups.map((g) => (
                  <section key={g.key} className="mt-6" aria-label={g.label}>
                    <div className="flex items-baseline justify-between gap-3 px-1">
                      <h2 className="text-lg font-semibold text-ink">
                        {g.label}{" "}
                        <span className="text-[0.95rem] font-normal text-muted">
                          · {g.holdings.length} {g.holdings.length === 1 ? "investimento" : "investimentos"}
                        </span>
                      </h2>
                      <span className="shrink-0 text-right">
                        <span className="font-semibold text-ink tabular-nums">{money(g.value)}</span>
                        {g.share > 0 && <span className="ml-2 text-muted tabular-nums">{pct(g.share)}</span>}
                      </span>
                    </div>
                    {g.key === "Sem instituição" && (
                      <p className="mt-1 px-1 text-sm text-muted">Abra o investimento e toque em Editar para indicar o banco ou a corretora.</p>
                    )}
                    <ul className="mt-3 flex flex-col gap-3">
                      {g.holdings.map((h) => (
                        <li key={h.id}>
                          <HoldingCard
                            holding={h}
                            showInstitution={groupBy !== "institution"}
                            open={expanded.includes(h.id)}
                            onToggle={() => toggle(h.id)}
                            onNewContribution={() => setSheet({ kind: "contribution", holding: h })}
                            onEdit={() => setSheet({ kind: "edit", holding: h })}
                            onRemove={() => setSheet({ kind: "removeInvestment", holding: h })}
                            onRemoveContribution={(c) => setSheet({ kind: "removeContribution", holding: h, contribution: c })}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {sheet?.kind === "investment" && (
        <Sheet title="Novo investimento" onClose={() => setSheet(null)}>
          <InvestmentForm
            preferredInstitutions={preferredInstitutions}
            onSubmit={async (investment, contribution) => {
              const owned = load.status === "done" && load.summary.holdings.some((h) => h.ticker === investment.ticker);
              const created = await addInvestment(userId, investment);
              await addContribution(userId, created.id, contribution);
              await reload();
              setExpanded((e) => [...e, created.id]);
              setSheet(null);
              toast(owned ? `Aporte em ${displayName(created)} registrado` : `${displayName(created)} adicionado à carteira`);
            }}
          />
        </Sheet>
      )}

      {sheet?.kind === "contribution" && (
        <Sheet title={`Novo aporte · ${displayName(sheet.holding)}`} onClose={() => setSheet(null)}>
          <ContributionForm
            suggestedPrice={sheet.holding.currentPrice}
            amountBased={sheet.holding.amountBased}
            onSubmit={async (req) => {
              await addContribution(userId, sheet.holding.id, req);
              await reload();
              setSheet(null);
              toast(`Aporte em ${displayName(sheet.holding)} registrado`);
            }}
          />
        </Sheet>
      )}

      {sheet?.kind === "edit" && (
        <Sheet title={`Editar ${displayName(sheet.holding)}`} onClose={() => setSheet(null)}>
          <EditInvestmentForm
            holding={sheet.holding}
            preferredInstitutions={preferredInstitutions}
            onSubmit={async (req) => {
              await updateInvestment(userId, sheet.holding.id, req);
              await reload();
              setSheet(null);
              toast("Alterações salvas");
            }}
          />
        </Sheet>
      )}

      {sheet?.kind === "removeInvestment" && (
        <Sheet title={`Remover ${displayName(sheet.holding)}?`} onClose={() => setSheet(null)}>
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
              toast(`${displayName(sheet.holding)} removido da carteira`);
            }}
          />
        </Sheet>
      )}

      {sheet?.kind === "removeContribution" && (
        <Sheet title="Remover aporte?" onClose={() => setSheet(null)}>
          <ConfirmRemoval
            message={
              <>
                Aporte de <strong className="text-ink">{money(sheet.contribution.amount)}</strong> em {displayName(sheet.holding)},
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
  showInstitution,
  open,
  onToggle,
  onNewContribution,
  onEdit,
  onRemove,
  onRemoveContribution,
}: {
  holding: Holding;
  showInstitution: boolean;
  open: boolean;
  onToggle: () => void;
  onNewContribution: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onRemoveContribution: (c: Contribution) => void;
}) {
  const panelId = `aportes-${h.id}`;
  const name = displayName(h);
  const details: string[] = [];
  if (showInstitution) details.push(institutionOf(h));
  if (h.totalQuantity === 0) details.push("Nenhum aporte ainda");
  else if (h.amountBased) {
    if (h.rateType && h.rateValue) details.push(rateLabel(h.rateType, h.rateValue));
    else details.push(`${money(h.totalInvested)} aplicados`);
    if (h.maturityDate) details.push(`vence ${dateBR(h.maturityDate).slice(3)}`);
  } else {
    // Ticker da bolsa no título; o nome completo ajuda quem não decorou o código
    if (name === h.ticker && h.assetName) details.push(h.assetName);
    details.push(`${qty(h.totalQuantity)} ${unitLabel(h.assetType, h.totalQuantity)} · PM ${money(h.averagePrice)}`);
  }

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
          <span className="block text-xl font-bold break-words text-ink">{name}</span>
          <span className="block text-[0.95rem] text-muted">{details.join(" · ")}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-lg font-bold whitespace-nowrap text-ink">{money(h.currentValue)}</span>
          {h.valuation === "invested" ? (
            <span className="text-sm text-muted">valor aplicado</span>
          ) : (
            <span className="flex items-baseline gap-1.5">
              <Trend gain={h.gain} gainPct={h.gainPct} showAmount={false} />
              {h.valuation === "estimated" && <span className="text-sm text-muted">estimado</span>}
            </span>
          )}
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
          {h.netValue !== undefined && (
            <p className="mb-4 rounded-xl bg-white px-4 py-3 text-[0.95rem] text-ink">
              {h.taxExempt ? (
                <>Isento de IR: o valor estimado de <strong>{money(h.netValue)}</strong> já é líquido.</>
              ) : (
                <>
                  Valor líquido estimado, depois do IR: <strong>{money(h.netValue)}</strong>{" "}
                  <span className="text-muted">({money(h.currentValue - h.netValue)} de imposto)</span>
                </>
              )}
            </p>
          )}
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
                    {h.amountBased ? "Aplicação" : `${qty(c.quantity)} × ${money(c.unitPrice)}`}
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
            <span className="flex items-center gap-5">
              <button type="button" onClick={onEdit} className="font-semibold text-brand hover:underline">
                Editar
              </button>
              <button type="button" onClick={onRemove} className="font-semibold text-[#b4472f] hover:underline">
                Remover ativo
              </button>
            </span>
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
