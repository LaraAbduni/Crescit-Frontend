import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import type { Route } from "./+types/existing-investments";
import { InvestmentForm } from "~/components/portfolio-forms";
import { Sheet } from "~/components/sheet";
import { useToast } from "~/components/toast";
import { Eyebrow, PrimaryButton, Screen, TextButton, Title } from "~/components/ui";
import { money } from "~/lib/format";
import { NO_INSTITUTION } from "~/lib/institutions";
import { useOnboarding } from "~/lib/onboarding";
import { addContribution, addInvestment, displayName, institutionOf } from "~/lib/portfolio";
import { usePortfolio } from "~/lib/use-portfolio";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Seus investimentos · Crescit" }];
}

/** Opções do cadastro que não são uma instituição de verdade. */
const NOT_INSTITUTIONS = ["Nenhuma", "Outro"];

/** Depois do perfil: cadastrar o que a pessoa já tem em cada banco que indicou. */
export default function ExistingInvestments() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile, context } = useOnboarding();
  const { load, reload } = usePortfolio(profile?.userId ?? "");
  // undefined: fechado; "": outra instituição
  const [adding, setAdding] = useState<string>();

  if (!profile) return <Navigate to="/perfil/questionario" replace />;

  const banks = (context?.banks ?? []).filter((b) => !NOT_INSTITUTIONS.includes(b));
  const holdings = load.status === "done" ? load.summary.holdings : [];
  // Instituições com investimento cadastrado que não estavam na lista do cadastro também aparecem
  const extra = [...new Set(holdings.map(institutionOf))].filter((i) => !banks.includes(i) && i !== NO_INSTITUTION);
  const institutions = [...banks, ...extra];

  return (
    <Screen
      footer={
        <>
          <PrimaryButton onClick={() => navigate("/inicio")}>{holdings.length > 0 ? "Concluir" : "Continuar"}</PrimaryButton>
          {holdings.length === 0 && <TextButton onClick={() => navigate("/inicio")}>Pular por enquanto</TextButton>}
        </>
      }
    >
      <Eyebrow>Seus investimentos</Eyebrow>
      <Title>O que você já tem hoje?</Title>
      <p className="mt-3 text-muted">
        Cadastre o que está em cada banco ou corretora para acompanhar tudo num só lugar e receber sugestões que
        consideram a sua carteira. Dá para fazer isso depois, na aba Carteira.
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        {institutions.map((institution) => {
          const items = holdings.filter((h) => institutionOf(h) === institution);
          return (
            <li key={institution} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">{institution}</h2>
                <button
                  type="button"
                  onClick={() => setAdding(institution)}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border-2 border-brand px-3 font-semibold text-brand hover:bg-brand-soft"
                >
                  <PlusIcon /> Adicionar
                </button>
              </div>
              {items.length === 0 ? (
                <p className="mt-1 text-sm text-muted">Nenhum investimento cadastrado.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {items.map((h) => (
                    <li key={h.id} className="flex items-baseline justify-between gap-3 text-[0.95rem]">
                      <span className="min-w-0 truncate text-ink">{displayName(h)}</span>
                      <span className="shrink-0 font-semibold text-ink tabular-nums">{money(h.totalInvested)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setAdding("")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line px-5 py-4 font-semibold text-brand hover:border-brand/40"
          >
            <PlusIcon /> {institutions.length > 0 ? "Outra instituição" : "Adicionar investimento"}
          </button>
        </li>
      </ul>

      {adding !== undefined && (
        <Sheet title={adding ? `Investimento no ${adding}` : "Novo investimento"} onClose={() => setAdding(undefined)}>
          <InvestmentForm
            initialInstitution={adding}
            preferredInstitutions={banks}
            onSubmit={async (investment, contribution) => {
              const created = await addInvestment(profile.userId, investment);
              await addContribution(profile.userId, created.id, contribution);
              await reload();
              setAdding(undefined);
              toast(`${displayName(created)} adicionado à carteira`);
            }}
          />
        </Sheet>
      )}
    </Screen>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
