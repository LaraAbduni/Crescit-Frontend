import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Sheet } from "~/components/sheet";
import { answer, MASCOT_NAME, SUGGESTED_QUESTIONS, type JujuAnswer } from "~/lib/juju";
import { todayISO } from "~/lib/format";
import { useGoals } from "~/lib/goals";
import type { InvestorType } from "~/lib/profile";
import { useMonthlyGoal } from "~/lib/use-monthly-goal";
import { usePortfolio } from "~/lib/use-portfolio";

/** Mascote do Crescit: a Juju (de "juros"), uma moedinha sorridente. */
export function JujuAvatar({ size = 40, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0" aria-hidden>
      <circle cx="20" cy="20" r="20" className={inverted ? "fill-white" : "fill-brand-soft"} />
      <circle cx="20" cy="20" r="13" className="fill-moderate" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.4" />
      <circle cx="16.3" cy="18" r="1.6" className="fill-ink" />
      <circle cx="23.7" cy="18" r="1.6" className="fill-ink" />
      <path d="M15.8 22.2c2.3 2.6 6.1 2.6 8.4 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="text-ink" />
    </svg>
  );
}

/** Botão flutuante que abre a conversa. Fica acima da navegação inferior no celular. */
export function JujuLauncher({ userId, investorType }: { userId: string; investorType: InvestorType }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-28 z-40 flex items-center gap-2 rounded-full bg-brand p-1.5 text-white shadow-lg transition hover:bg-brand-dark lg:right-8 lg:bottom-8 lg:pr-5"
        aria-label={`Conversar com a ${MASCOT_NAME}`}
      >
        <JujuAvatar size={44} inverted />
        <span className="hidden font-semibold lg:inline">Pergunte à {MASCOT_NAME}</span>
      </button>
      {open && <JujuChat userId={userId} investorType={investorType} onClose={() => setOpen(false)} />}
    </>
  );
}

type Message = { from: "user" | "juju"; id: number } & JujuAnswer;

function JujuChat({ userId, investorType, onClose }: { userId: string; investorType: InvestorType; onClose: () => void }) {
  // A carteira só é carregada quando a conversa abre
  const { load } = usePortfolio(userId);
  const [goal] = useMonthlyGoal(userId);
  const { goals } = useGoals(userId);
  const [messages, setMessages] = useState<Message[]>(() => [{ from: "juju", id: 0, ...answer("oi", { investorType, goal, today: todayISO() }) }]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, typing]);

  function ask(question: string) {
    const text = question.trim();
    if (!text || typing) return;
    setInput("");
    setMessages((m) => [...m, { from: "user", id: nextId.current++, text }]);
    setTyping(true);
    const summary = load.status === "done" ? load.summary : undefined;
    // Uma pausa curta para a resposta não aparecer junto com a pergunta
    window.setTimeout(() => {
      setMessages((m) => [...m, { from: "juju", id: nextId.current++, ...answer(text, { summary, investorType, goal, goals, today: todayISO() }) }]);
      setTyping(false);
    }, 650);
  }

  return (
    <Sheet title={MASCOT_NAME} onClose={onClose}>
      <div role="log" aria-live="polite" aria-label="Conversa" className="flex h-[min(24rem,45dvh)] flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-4">
        {messages.map((m) =>
          m.from === "user" ? (
            <p key={m.id} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-white">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="flex max-w-[92%] items-start gap-2 self-start">
              <JujuAvatar size={32} />
              <div className="rounded-2xl rounded-tl-md bg-cream px-4 py-2.5 text-ink">
                <p>{m.text}</p>
                {m.links && m.links.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {m.links.map((l) => (
                      <Link key={l.to} to={l.to} onClick={onClose} className="font-semibold text-brand hover:underline">
                        {l.label}
                      </Link>
                    ))}
                  </p>
                )}
              </div>
            </div>
          ),
        )}
        {typing && (
          <p className="flex items-center gap-2 self-start text-sm text-muted">
            <JujuAvatar size={32} /> {MASCOT_NAME} está digitando…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Sugestões de pergunta">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={typing}
            onClick={() => ask(q)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label className="sr-only" htmlFor="juju-input">
          Sua pergunta
        </label>
        <input
          id="juju-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreva sua dúvida"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-4 text-ink outline-none focus:border-brand"
        />
        <button type="submit" disabled={!input.trim() || typing} className="h-12 shrink-0 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-40">
          Enviar
        </button>
      </form>
    </Sheet>
  );
}
