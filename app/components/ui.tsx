import { useNavigate } from "react-router";

/** Coluna centralizada com largura de celular e o botão principal fixo no rodapé. */
export function Screen({
  header,
  footer,
  children,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-10 pb-8">
      {header}
      <main className="flex flex-1 flex-col">{children}</main>
      {footer && <div className="mt-8 flex flex-col gap-4">{footer}</div>}
    </div>
  );
}

export function BackButton({ onClick }: { onClick?: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={onClick ?? (() => navigate(-1))}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-white text-ink transition hover:bg-brand-soft"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Cabeçalho com voltar, "Etapa X de Y" e barra de progresso. */
export function StepHeader({
  label,
  progress,
  onBack,
}: {
  label: string;
  progress: number;
  onBack?: () => void;
}) {
  return (
    <header className="mb-8">
      <div className="relative flex items-center">
        <BackButton onClick={onBack} />
        <span className="absolute inset-x-0 text-center text-muted pointer-events-none">{label}</span>
      </div>
      <div
        className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-line/70"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </header>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand">{children}</p>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-2 font-serif text-[2rem] leading-tight font-bold text-ink">{children}</h1>;
}

/** Título grande das telas principais (Recomendações, Carteira...). */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="font-serif text-[2.6rem] leading-tight font-bold text-ink">{children}</h1>;
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`h-14 w-full rounded-2xl bg-brand text-lg font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function TextButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className="h-10 text-lg font-semibold text-brand hover:underline">
      {children}
    </button>
  );
}

/** Cartão de opção: radio (seleção única) ou checkbox (múltipla). */
export function OptionCard({
  label,
  description,
  selected,
  multiple = false,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  multiple?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition ${
        selected ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/40"
      }`}
    >
      <span
        aria-hidden
        className={`grid size-6 shrink-0 place-items-center border-2 ${multiple ? "rounded-md" : "rounded-full"} ${
          selected ? "border-brand" : "border-line"
        } ${selected && multiple ? "bg-brand" : ""}`}
      >
        {selected &&
          (multiple ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span className="size-3 rounded-full bg-brand" />
          ))}
      </span>
      <span className="flex flex-col">
        <span className="text-[1.05rem] font-semibold leading-snug text-ink">{label}</span>
        {description && <span className="text-[0.9rem] text-muted">{description}</span>}
      </span>
    </button>
  );
}

export function Chip({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  const base = "rounded-full border px-4 py-2 text-[0.95rem] transition";
  if (!onClick) return <span className={`${base} border-line bg-white text-ink`}>{children}</span>;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${base} ${
        selected ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-brand/40"
      }`}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-medium text-ink">{label}</span>
      <input
        {...props}
        aria-invalid={!!error}
        className={`h-14 rounded-2xl border-2 bg-white px-4 text-lg text-ink outline-none transition placeholder:text-muted/60 focus:border-brand ${
          error ? "border-aggressive" : "border-line"
        }`}
      />
      {error && <span className="text-sm text-aggressive">{error}</span>}
    </label>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--color-brand)" />
        <path d="M9 21l5-5 3.5 3.5L24 13" stroke="white" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 13h5v5" stroke="white" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-serif text-2xl font-bold text-ink">Crescit</span>
    </div>
  );
}
