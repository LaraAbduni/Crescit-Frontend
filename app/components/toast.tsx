import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Toast = { id: number; message: string };

const ToastContext = createContext<(message: string) => void>(() => {});

/** Aviso curto de confirmação ("Aporte registrado") depois de uma ação. */
export function useToast() {
  return useContext(ToastContext);
}

const DURATION = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  const show = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message }]);
    timers.current.push(window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), DURATION));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* No celular fica acima da navegação inferior; no computador, no canto inferior direito */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex flex-col items-center gap-2 px-6 lg:inset-x-auto lg:right-8 lg:bottom-8 lg:items-end"
      >
        {toasts.map((t) => (
          <p
            key={t.id}
            className="flex items-center gap-2.5 rounded-2xl bg-ink px-5 py-3.5 text-[1.05rem] text-white shadow-lg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-conservative">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
