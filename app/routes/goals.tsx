import { useEffect, useState } from "react";
import type { Route } from "./+types/goals";
import { Sheet } from "~/components/sheet";
import { useToast } from "~/components/toast";
import { Chip, PageTitle, PrimaryButton, TextField } from "~/components/ui";
import { monthlyHistory, monthLabel } from "~/lib/analysis";
import { planStorageKey, RESERVE_MONTHS } from "~/lib/first-steps";
import { money, parseDecimal, pct, todayISO } from "~/lib/format";
import {
  GOAL_KINDS,
  goalEmoji,
  goalProgress,
  goalRate,
  monthlyNeeded,
  monthsUntil,
  newGoalId,
  useGoals,
  type Goal,
  type GoalKind,
} from "~/lib/goals";
import { useOnboarding } from "~/lib/onboarding";
import type { PortfolioSummary } from "~/lib/portfolio";
import { useMonthlyGoal } from "~/lib/use-monthly-goal";
import { usePortfolio } from "~/lib/use-portfolio";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Metas · Crescit" }];
}

const BAR_COLOR = "#00916f";

export default function Goals() {
  const { profile } = useOnboarding();
  const { userId, investorType } = profile!;
  const [monthlyGoal, setMonthlyGoal] = useMonthlyGoal(userId);
  const { goals, loaded, save } = useGoals(userId);
  const { load } = usePortfolio(userId);
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [removing, setRemoving] = useState<string>();
  const toast = useToast();
  const today = todayISO();
  const summary = load.status === "done" ? load.summary : undefined;

  const needs = goals.map((g) => ({ goal: g, need: monthlyNeeded(g, today, goalRate(monthsUntil(g.deadline, today), investorType)) }));
  const totalNeed = needs.reduce((acc, n) => acc + n.need, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>Metas</PageTitle>
          <p className="mt-1 max-w-2xl text-lg text-muted">Quanto você quer investir por mês e onde quer chegar.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 text-lg font-semibold text-white hover:bg-brand-dark"
        >
          <span aria-hidden className="text-2xl leading-none">+</span> Novo objetivo
        </button>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        <MonthlyGoalCard goal={monthlyGoal} onChange={(v) => { setMonthlyGoal(v); toast("Meta mensal salva"); }} summary={summary} today={today} totalNeed={totalNeed} />

        <section aria-label="Objetivos">
          {loaded && goals.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-white p-8 text-center">
              <p className="text-lg font-semibold text-ink">Nenhum objetivo ainda</p>
              <p className="mt-1 text-muted">Dê um destino para o seu dinheiro. Comece por um destes:</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {GOAL_KINDS.filter((k) => k.kind !== "outro").map((k) => (
                  <Chip key={k.kind} selected={false} onClick={() => setEditing({ ...blankGoal(k.kind, today), name: k.label })}>
                    <span aria-hidden>{k.emoji}</span> {k.label}
                  </Chip>
                ))}
              </div>
            </div>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2">
              {needs.map(({ goal, need }) => (
                <li key={goal.id}>
                  <GoalCard
                    goal={goal}
                    need={need}
                    today={today}
                    removing={removing === goal.id}
                    onEdit={() => setEditing(goal)}
                    onRemove={() => setRemoving(goal.id)}
                    onCancelRemove={() => setRemoving(undefined)}
                    onConfirmRemove={() => {
                      save(goals.filter((g) => g.id !== goal.id));
                      setRemoving(undefined);
                      toast("Objetivo removido");
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          {goals.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              Prazos de até 2 anos consideram renda fixa a 100% do CDI, já com IR; prazos maiores usam a rentabilidade média
              ilustrativa do seu perfil. É uma estimativa, não uma garantia.
            </p>
          )}
        </section>
      </div>

      {editing && (
        <Sheet title={editing !== "new" && goals.some((g) => g.id === editing.id) ? "Editar objetivo" : "Novo objetivo"} onClose={() => setEditing(null)}>
          <GoalForm
            userId={userId}
            initial={editing === "new" ? blankGoal("viagem", today) : editing}
            portfolioValue={summary?.currentValue}
            onSubmit={(goal) => {
              const exists = goals.some((g) => g.id === goal.id);
              save(exists ? goals.map((g) => (g.id === goal.id ? goal : g)) : [...goals, goal]);
              setEditing(null);
              toast(exists ? "Objetivo atualizado" : "Objetivo criado");
            }}
          />
        </Sheet>
      )}
    </>
  );
}

function blankGoal(kind: GoalKind, today: string): Goal {
  const [y, m] = today.split("-");
  return { id: newGoalId(), kind, name: "", target: 0, saved: 0, deadline: `${Number(y) + 1}-${m}` };
}

function MonthlyGoalCard({
  goal,
  onChange,
  summary,
  today,
  totalNeed,
}: {
  goal: number;
  onChange: (value: number) => void;
  summary?: PortfolioSummary;
  today: string;
  totalNeed: number;
}) {
  const [input, setInput] = useState(String(goal));
  useEffect(() => setInput(String(goal)), [goal]);
  const value = parseDecimal(input);
  const changed = value > 0 && value !== goal;

  const months = summary ? monthlyHistory(summary, today).slice(-6) : [];
  const thisMonth = months.find((m) => m.month === today.slice(0, 7))?.contributed ?? 0;
  const progress = goal > 0 ? Math.min(thisMonth / goal, 1) : 0;
  const hits = months.filter((m) => m.contributed >= goal).length;

  return (
    <section className="rounded-3xl border border-line bg-white p-6 lg:sticky lg:top-8 lg:p-7">
      <h2 className="text-lg font-semibold text-ink">Aporte por mês</h2>
      <form
        className="mt-3 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) onChange(value);
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField label="Meta mensal (R$)" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button type="submit" disabled={!changed} className="mb-0.5 h-12 shrink-0 rounded-xl bg-brand px-4 font-semibold text-white disabled:opacity-40">
          Salvar
        </button>
      </form>

      <div className="mt-6">
        <p className="flex flex-wrap items-baseline justify-between gap-2 text-ink">
          <span>
            <span className="font-semibold">{money(thisMonth)}</span> em {monthLabel(today.slice(0, 7)).split(" ")[0]}
          </span>
          <span className="text-sm text-muted tabular-nums">{pct(progress)} da meta</span>
        </p>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-cream"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Aportes do mês em relação à meta"
        >
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: BAR_COLOR }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {thisMonth >= goal ? "Meta do mês cumprida." : `Faltam ${money(goal - thisMonth)} para cumprir a meta.`}
        </p>
      </div>

      {months.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm text-muted">
            Você bateu a meta em <span className="font-semibold text-ink">{hits} de {months.length}</span>{" "}
            {months.length === 1 ? "mês" : "meses"}
          </p>
          <ol className="mt-3 grid grid-cols-6 gap-1.5">
            {months.map((m) => {
              const hit = m.contributed >= goal;
              return (
                <li key={m.month} className="flex flex-col items-center gap-1 text-center" title={`${monthLabel(m.month)}: ${money(m.contributed)}`}>
                  <span
                    className={`grid size-8 place-items-center rounded-full text-sm font-bold ${hit ? "bg-brand text-white" : "bg-cream text-muted"}`}
                    aria-hidden
                  >
                    {hit ? "✓" : "–"}
                  </span>
                  <span className="text-xs text-muted">{monthLabel(m.month, true).split("/")[0]}</span>
                  <span className="sr-only">
                    {monthLabel(m.month)}: {money(m.contributed)}, {hit ? "meta cumprida" : "abaixo da meta"}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {totalNeed > 0 && (
        <p className={`mt-6 rounded-2xl px-4 py-3 text-sm ${totalNeed <= goal ? "bg-brand-soft text-brand" : "bg-moderate-soft text-moderate-text"}`}>
          Seus objetivos pedem cerca de <span className="font-semibold">{money(Math.ceil(totalNeed))}</span> por mês.{" "}
          {totalNeed <= goal ? "Sua meta mensal dá conta." : "Sua meta mensal não cobre tudo: aumente a meta ou estenda algum prazo."}
        </p>
      )}
    </section>
  );
}

function GoalCard({
  goal,
  need,
  today,
  removing,
  onEdit,
  onRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  goal: Goal;
  need: number;
  today: string;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}) {
  const progress = goalProgress(goal);
  const months = monthsUntil(goal.deadline, today);
  const done = goal.saved >= goal.target;
  const [y, m] = goal.deadline.split("-");

  return (
    <article className="flex h-full flex-col rounded-3xl border border-line bg-white p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream text-2xl" aria-hidden>
          {goalEmoji(goal.kind)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-ink">{goal.name}</h3>
          <p className="text-sm text-muted">
            {money(goal.target)} até {m}/{y}
            {!done && months > 0 && ` · ${months === 1 ? "1 mês" : `${months} meses`}`}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-ink">
            <span className="font-semibold">{money(goal.saved)}</span> guardados
          </span>
          <span className="text-muted tabular-nums">{pct(progress)}</span>
        </p>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-cream"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label={`Progresso de ${goal.name}`}
        >
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: BAR_COLOR }} />
        </div>
      </div>

      <p className="mt-4 text-ink">
        {done ? (
          <span className="font-semibold text-brand">Objetivo alcançado!</span>
        ) : need === 0 ? (
          "Só com o rendimento do que já guardou, você chega lá no prazo."
        ) : months === 0 ? (
          <>
            O prazo chegou: faltam <span className="font-semibold">{money(goal.target - goal.saved)}</span>.
          </>
        ) : (
          <>
            Guarde <span className="font-semibold">{money(Math.ceil(need))}</span> por mês para chegar lá.
          </>
        )}
      </p>

      <div className="mt-auto pt-5">
        {removing ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink">Remover este objetivo?</span>
            <button type="button" onClick={onConfirmRemove} className="font-semibold text-aggressive hover:underline">
              Remover
            </button>
            <button type="button" onClick={onCancelRemove} className="font-semibold text-muted hover:underline">
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex gap-5">
            <button type="button" onClick={onEdit} className="font-semibold text-brand hover:underline">
              Editar
            </button>
            <button type="button" onClick={onRemove} className="font-semibold text-muted hover:text-aggressive hover:underline">
              Remover
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const toInput = (n: number) => (n > 0 ? String(n).replace(".", ",") : "");

function GoalForm({
  userId,
  initial,
  portfolioValue,
  onSubmit,
}: {
  userId: string;
  initial: Goal;
  portfolioValue?: number;
  onSubmit: (goal: Goal) => void;
}) {
  const [kind, setKind] = useState<GoalKind>(initial.kind);
  const [name, setName] = useState(initial.name);
  const [target, setTarget] = useState(toInput(initial.target));
  const [saved, setSaved] = useState(toInput(initial.saved));
  const [deadline, setDeadline] = useState(initial.deadline);
  const [submitted, setSubmitted] = useState(false);

  // Reserva de emergência: sugere 6 meses dos gastos informados nos Primeiros passos
  let reserveHint: number | undefined;
  try {
    const plan = JSON.parse(localStorage.getItem(planStorageKey(userId)) ?? "null");
    const expenses = parseDecimal(plan?.expenses ?? "");
    if (expenses > 0) reserveHint = expenses * RESERVE_MONTHS;
  } catch {}

  const errors = {
    name: !name.trim() ? "Dê um nome ao objetivo" : undefined,
    target: !(parseDecimal(target) > 0) ? "Informe quanto quer juntar" : undefined,
    saved: saved.trim() && !(parseDecimal(saved) >= 0) ? "Valor inválido" : undefined,
    deadline: !/^\d{4}-\d{2}$/.test(deadline) ? "Escolha o mês" : deadline < todayISO().slice(0, 7) ? "O prazo não pode estar no passado" : undefined,
  };
  const shown: Partial<typeof errors> = submitted ? errors : {};

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (Object.values(errors).some(Boolean)) return;
        onSubmit({ id: initial.id, kind, name: name.trim(), target: parseDecimal(target), saved: parseDecimal(saved) || 0, deadline });
      }}
    >
      <fieldset>
        <legend className="mb-2 font-medium text-ink">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {GOAL_KINDS.map((k) => (
            <Chip
              key={k.kind}
              selected={kind === k.kind}
              onClick={() => {
                // Troca o nome junto, se ele ainda for o padrão do tipo anterior
                if (!name.trim() || GOAL_KINDS.some((g) => g.label === name)) setName(k.kind === "outro" ? "" : k.label);
                setKind(k.kind);
              }}
            >
              <span aria-hidden>{k.emoji}</span> {k.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <TextField label="Nome" placeholder="Viagem para o Chile" value={name} onChange={(e) => setName(e.target.value)} error={shown.name} />

      <div>
        <TextField label="Quanto quer juntar (R$)" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} error={shown.target} />
        {kind === "reserva" && reserveHint && (
          <button type="button" onClick={() => setTarget(toInput(reserveHint!))} className="mt-2 text-sm font-semibold text-brand hover:underline">
            Usar {RESERVE_MONTHS} meses dos seus gastos: {money(reserveHint)}
          </button>
        )}
      </div>

      <div>
        <TextField label="Quanto já tem guardado para isso (R$)" inputMode="decimal" placeholder="0" value={saved} onChange={(e) => setSaved(e.target.value)} error={shown.saved} />
        {portfolioValue !== undefined && portfolioValue > 0 && (
          <button
            type="button"
            onClick={() => setSaved(toInput(Math.round(portfolioValue * 100) / 100))}
            className="mt-2 text-sm font-semibold text-brand hover:underline"
          >
            Usar o valor da sua carteira: {money(portfolioValue)}
          </button>
        )}
      </div>

      <TextField label="Até quando" type="month" min={todayISO().slice(0, 7)} value={deadline} onChange={(e) => setDeadline(e.target.value)} error={shown.deadline} />

      <PrimaryButton type="submit">Salvar objetivo</PrimaryButton>
    </form>
  );
}
