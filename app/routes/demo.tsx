import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/demo";
import { PageTitle } from "~/components/ui";
import { useToast } from "~/components/toast";
import { apiErrorMessage } from "~/lib/api";
import { applyPersona, clearPortfolio, PERSONAS, type Persona } from "~/lib/demo";
import { useOnboarding } from "~/lib/onboarding";
import { INVESTOR_TYPES } from "~/lib/profile";
import { useMonthlyGoal } from "~/lib/use-monthly-goal";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Modo demonstração · Crescit" }];
}

type Status = { kind: "idle" } | { kind: "confirm"; action: Action } | { kind: "running"; progress: number } | { kind: "error"; message: string };
type Action = { type: "persona"; persona: Persona } | { type: "clear" };

/**
 * Página fora do menu (/demo), para preparar a apresentação: troca a carteira
 * da conta logada por uma das personas, usando a API de verdade.
 */
export default function Demo() {
  const { profile, setContext } = useOnboarding();
  const { userId, investorType } = profile!;
  const [, setGoal] = useMonthlyGoal(userId);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [doneId, setDoneId] = useState<string>();
  const toast = useToast();
  const running = status.kind === "running";

  async function run(action: Action) {
    setStatus({ kind: "running", progress: 0 });
    try {
      if (action.type === "clear") {
        await clearPortfolio(userId);
        toast("Carteira esvaziada");
        setDoneId("clear");
      } else {
        await applyPersona(userId, action.persona, setContext, setGoal, (progress) => setStatus({ kind: "running", progress }));
        toast(`Carteira "${action.persona.title}" pronta`);
        setDoneId(action.persona.id);
      }
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", message: apiErrorMessage(e, "Não foi possível montar a carteira. Tente de novo.") });
    }
  }

  return (
    <>
      <PageTitle>Modo demonstração</PageTitle>
      <p className="mt-1 max-w-2xl text-lg text-muted">
        Prepara esta conta para a apresentação. A carteira atual é <strong className="text-ink">apagada</strong> e trocada
        pela da persona escolhida, com aportes nos meses anteriores.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {Object.values(PERSONAS).map((p) => {
          const profileMatches = p.expectedProfile === investorType;
          return (
            <section key={p.id} className="flex flex-col rounded-3xl border border-line bg-white p-6">
              <h2 className="text-xl font-semibold text-ink">{p.title}</h2>
              <p className="mt-2 text-ink/80">{p.description}</p>
              <p className="mt-3 text-sm text-muted">
                Meta mensal de R$ {p.monthlyGoal.toLocaleString("pt-BR")} · perfil sugerido:{" "}
                <span className="font-semibold text-ink">{INVESTOR_TYPES[p.expectedProfile].label}</span>
              </p>
              {!profileMatches && (
                <p className="mt-2 rounded-xl bg-moderate-soft px-3 py-2 text-sm text-moderate-text">
                  Esta conta está como {INVESTOR_TYPES[investorType].label}. Para a história bater,{" "}
                  <Link to="/perfil/questionario" className="font-semibold underline">
                    refaça o questionário
                  </Link>
                  .
                </p>
              )}
              <div className="mt-auto pt-5">
                {doneId === p.id ? (
                  <Link to="/inicio" className="inline-flex h-12 items-center rounded-2xl bg-brand-soft px-5 font-semibold text-brand">
                    Pronto: ir para o Início
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => setStatus({ kind: "confirm", action: { type: "persona", persona: p } })}
                    className="h-12 rounded-2xl bg-brand px-5 font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
                  >
                    Usar esta carteira
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-5">
        <button
          type="button"
          disabled={running}
          onClick={() => setStatus({ kind: "confirm", action: { type: "clear" } })}
          className="font-semibold text-aggressive hover:underline disabled:opacity-40"
        >
          Só esvaziar a carteira
        </button>
      </div>

      {status.kind === "confirm" && (
        <div role="alertdialog" aria-label="Confirmar" className="mt-6 max-w-xl rounded-3xl border-2 border-aggressive/40 bg-white p-6">
          <p className="text-lg text-ink">
            {status.action.type === "clear"
              ? "Apagar todos os investimentos e aportes desta conta?"
              : `Apagar a carteira atual desta conta e montar a de "${status.action.persona.title}"?`}
          </p>
          <p className="mt-1 text-sm text-muted">Não dá para desfazer.</p>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => run(status.action)} className="h-11 rounded-xl bg-aggressive px-5 font-semibold text-white">
              Sim, continuar
            </button>
            <button type="button" onClick={() => setStatus({ kind: "idle" })} className="h-11 rounded-xl border-2 border-line px-5 font-semibold text-ink">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {status.kind === "running" && (
        <div className="mt-6 max-w-xl" role="status">
          <p className="text-ink">Montando a carteira… {Math.round(status.progress * 100)}%</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${status.progress * 100}%` }} />
          </div>
        </div>
      )}

      {status.kind === "error" && (
        <p role="alert" className="mt-6 text-aggressive">
          {status.message}
        </p>
      )}
    </>
  );
}
