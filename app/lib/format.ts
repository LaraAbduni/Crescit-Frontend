const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

/** R$ 19.026,00 */
export const money = (value: number) => currency.format(value);

/** 3,1% (recebe a fração: 0.031) */
export const pct = (fraction: number) => percent.format(fraction);

/** +3,1% / −2,0% */
export const signedPct = (fraction: number) => `${fraction >= 0 ? "+" : "−"}${pct(Math.abs(fraction))}`;

export const qty = (value: number) => quantity.format(value);

/** "2026-10-08" -> "08/10/2026" (sem passar por Date, para não mudar o dia pelo fuso) */
export function dateBR(iso: string, withYear = true) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

/** Data de hoje no fuso local, no formato da API (yyyy-mm-dd). */
export function todayISO() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Aceita "131,50", "1.310,00" e "131.5". Devolve NaN se não for número. */
export function parseDecimal(input: string) {
  const s = input.trim();
  if (!s) return NaN;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}
