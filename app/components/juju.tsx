import { Fragment, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { jujuApi } from "~/lib/api";
import { answer, MASCOT_NAME, SUGGESTED_QUESTIONS, type JujuAnswer } from "~/lib/juju";
import { buildJujuFacts } from "~/lib/juju-context";
import { todayISO } from "~/lib/format";
import { useGoals } from "~/lib/goals";
import { usePriceAlerts } from "~/lib/price-alerts";
import type { InvestorType } from "~/lib/profile";
import { useMonthlyGoal } from "~/lib/use-monthly-goal";
import { usePortfolio } from "~/lib/use-portfolio";

/** Mascote do Crescit: a Juju (de "juros"), uma moedinha com um broto, porque o dinheiro cresce. */
export function JujuAvatar({ size = 40, ring = false }: { size?: number; ring?: boolean }) {
  // Cada instância precisa dos próprios ids de gradiente
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={`${id}-coin`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6c768" />
          <stop offset="1" stopColor="#d48f22" />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbd88a" />
          <stop offset="1" stopColor="#e9a83c" />
        </linearGradient>
      </defs>
      {ring && <circle cx="24" cy="24" r="24" fill="#ffffff" />}
      {/* Moeda: a borda de baixo dá a espessura */}
      <circle cx="24" cy="26.6" r="17.4" fill="#b8741a" />
      <circle cx="24" cy="25" r="17.4" fill={`url(#${id}-coin)`} />
      <circle cx="24" cy="25" r="13.4" fill={`url(#${id}-face)`} stroke="#c98420" strokeWidth="1.4" />
      <path d="M12.6 19.4a12.6 12.6 0 0 1 7.6-6.8" stroke="#fff8e8" strokeOpacity="0.9" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M37.2 9.2l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#fff3d0" />
      {/* Broto: o dinheiro cresce */}
      <path d="M24 12.2c0-1.6.2-2.9.7-4" stroke="#0f5c4c" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M24.8 8.4c1-2.4 3.6-3.5 6.1-2.8-.6 2.5-3.1 4-6.1 2.8z" fill="#2e9484" />
      {/* Rosto */}
      <ellipse cx="18.8" cy="24.4" rx="2" ry="2.5" fill="#1c2a2e" />
      <ellipse cx="29.2" cy="24.4" rx="2" ry="2.5" fill="#1c2a2e" />
      <circle cx="19.5" cy="23.4" r=".75" fill="#ffffff" />
      <circle cx="29.9" cy="23.4" r=".75" fill="#ffffff" />
      <ellipse cx="15.8" cy="29" rx="2.3" ry="1.4" fill="#e2694d" opacity=".45" />
      <ellipse cx="32.2" cy="29" rx="2.3" ry="1.4" fill="#e2694d" opacity=".45" />
      <path d="M20.6 29.2c1.9 2.2 4.9 2.2 6.8 0" stroke="#1c2a2e" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Botão flutuante que abre a conversa. Fica acima da navegação inferior no celular. */
export function JujuLauncher({ userId, investorType }: { userId: string; investorType: InvestorType }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group fixed right-4 bottom-28 z-40 flex items-center gap-2 rounded-full bg-brand p-1.5 text-white shadow-[0_10px_30px_rgba(15,92,76,0.35)] transition hover:-translate-y-0.5 hover:bg-brand-dark lg:right-8 lg:bottom-8 lg:pr-5"
          aria-label={`Conversar com a ${MASCOT_NAME}`}
        >
          <span className="motion-safe:group-hover:animate-juju-wiggle">
            <JujuAvatar size={48} ring />
          </span>
          <span className="hidden font-semibold lg:inline">Pergunte à {MASCOT_NAME}</span>
        </button>
      )}
      {open && <JujuChat userId={userId} investorType={investorType} onClose={() => setOpen(false)} />}
    </>
  );
}

type Message = { from: "user" | "juju"; id: number } & JujuAnswer;

const DESKTOP = "(min-width: 1024px)";

function JujuChat({ userId, investorType, onClose }: { userId: string; investorType: InvestorType; onClose: () => void }) {
  // A carteira só é carregada quando a conversa abre
  const { load } = usePortfolio(userId);
  const [goal] = useMonthlyGoal(userId);
  const { goals } = useGoals(userId);
  const { statuses: priceAlerts } = usePriceAlerts(userId);
  const [messages, setMessages] = useState<Message[]>(() => [{ from: "juju", id: 0, ...answer("oi", { investorType, goal, today: todayISO() }) }]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);
  const titleId = useId();

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, typing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    // No celular a conversa ocupa a tela toda; no computador a página continua rolando ao lado
    const lockScroll = !window.matchMedia?.(DESKTOP).matches;
    const overflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      if (lockScroll) document.body.style.overflow = overflow;
    };
  }, [onClose]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || typing) return;
    setInput("");
    const conversation: Message[] = [...messages, { from: "user", id: nextId.current++, text }];
    setMessages(conversation);
    setTyping(true);
    const summary = load.status === "done" ? load.summary : undefined;
    const ctx = { summary, investorType, goal, goals, priceAlerts, today: todayISO() };
    let reply: JujuAnswer;
    try {
      // A saudação inicial é local; a conversa enviada começa na primeira pergunta
      const history = conversation.slice(1).map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));
      reply = await jujuApi<JujuAnswer>({ messages: history, facts: buildJujuFacts(ctx) });
    } catch (error) {
      // Sem IA (sem chave, fora do ar), a Juju volta para as respostas prontas
      console.warn("Juju: usando respostas prontas", error);
      reply = answer(text, ctx);
    }
    setMessages((m) => [...m, { from: "juju", id: nextId.current++, ...reply }]);
    setTyping(false);
  }

  const onlyGreeting = messages.length === 1;

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col bg-cream motion-safe:animate-juju-up lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[440px] lg:border-l lg:border-line lg:shadow-[-16px_0_48px_rgba(28,42,46,0.14)] lg:motion-safe:animate-juju-side"
    >
      <header className="flex items-center gap-3 bg-brand px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 text-white">
        <JujuAvatar size={48} ring />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-serif text-xl font-bold leading-tight">
            {MASCOT_NAME}
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-white/80">
            <span className="size-2 rounded-full bg-[#7ee0b8]" aria-hidden />
            Sua assistente de investimentos
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar conversa"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div role="log" aria-live="polite" aria-label="Conversa" className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
        {messages.map((m) =>
          m.from === "user" ? (
            <p key={m.id} className="max-w-[85%] self-end whitespace-pre-line rounded-3xl rounded-br-lg bg-brand px-4 py-3 text-white shadow-sm motion-safe:animate-juju-pop">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="flex max-w-[92%] items-end gap-2 self-start motion-safe:animate-juju-pop">
              <JujuAvatar size={34} />
              <div className="rounded-3xl rounded-bl-lg border border-line bg-white px-4 py-3 text-ink shadow-sm">
                <RichText text={m.text} />
                {m.links && m.links.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-2">
                    {m.links.map((l) => (
                      <Link
                        key={l.to}
                        to={l.to}
                        onClick={() => !window.matchMedia?.(DESKTOP).matches && onClose()}
                        className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
                      >
                        {l.label} →
                      </Link>
                    ))}
                  </p>
                )}
              </div>
            </div>
          ),
        )}
        {typing && (
          <div className="flex items-end gap-2 self-start" aria-label={`${MASCOT_NAME} está digitando`}>
            <JujuAvatar size={34} />
            <span className="flex gap-1 rounded-3xl rounded-bl-lg border border-line bg-white px-4 py-4">
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="size-2 rounded-full bg-muted motion-safe:animate-bounce" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          className={`mb-3 flex gap-2 ${onlyGreeting ? "flex-wrap" : "-mx-4 overflow-x-auto px-4 [scrollbar-width:none]"}`}
          aria-label="Sugestões de pergunta"
        >
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={typing}
              onClick={() => ask(q)}
              className="shrink-0 rounded-full border border-line bg-cream px-3 py-1.5 text-sm text-ink transition hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2 rounded-3xl border-2 border-line bg-cream p-1.5 pl-4 focus-within:border-brand"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <label className="sr-only" htmlFor="juju-input">
            Sua pergunta
          </label>
          <textarea
            id="juju-input"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra a linha
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder={`Pergunte à ${MASCOT_NAME}`}
            maxLength={1000}
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-ink outline-none [field-sizing:content] placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            aria-label="Enviar"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        <p className="mt-2 text-center text-xs text-muted">A {MASCOT_NAME} é educativa e pode errar. A decisão de investir é sua.</p>
      </div>
    </div>
  );
}

/** Parágrafos, listas simples e **negrito** vindos da IA, sem interpretar HTML. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-2 leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((l, j) => <li key={j}><Bold text={l.replace(/^\s*([-*•]|\d+[.)])\s+/, "")} /></li>)}
            </ul>
          );
        }
        return <p key={i} className="whitespace-pre-line"><Bold text={block} /></p>;
      })}
    </div>
  );
}

function Bold({ text }: { text: string }) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}
