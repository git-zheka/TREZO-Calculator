import type { Currency } from "./types";

export const CUR: Record<Currency, string> = { UAH: "₴", USD: "$" };

const nf = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 });

export const num = (v: number) => nf.format(Math.round(v || 0));
export const money = (v: number, c: Currency) => `${CUR[c]} ${num(v)}`;

export const MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
export const MONTHS_FULL = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
export const MONTH_NOM = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
export const DOW = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];

/** Українські форми множини: 1 виїзд / 2 виїзди / 5 виїздів */
export function plural(n: number, one: string, few: string, many: string) {
  const n1 = n % 10;
  const n2 = n % 100;
  if (n1 === 1 && n2 !== 11) return one;
  if (n1 >= 2 && n1 <= 4 && (n2 < 10 || n2 >= 20)) return few;
  return many;
}

export const trips = (n: number) => `${n} ${plural(n, "виїзд", "виїзди", "виїздів")}`;
export const ordersWord = (n: number) => `${n} ${plural(n, "замовлення", "замовлення", "замовлень")}`;

export const today = () => toYmd(new Date());

export function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Наступний день у форматі YYYY-MM-DD — межа all-day події */
export function nextDay(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Зсув дати на n днів. Рахуємо в UTC, інакше перехід на літній час губить день. */
export function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]}`;
}

/** Стисло про кілька днів: «17–19 вересня», «17 вересня і ще 2 дні». */
export function fmtDates(dates: string[]) {
  if (!dates.length) return "—";
  if (dates.length === 1) return fmtDate(dates[0]);
  const sorted = [...dates].sort();
  const first = new Date(sorted[0]);
  const last = new Date(sorted[sorted.length - 1]);
  // Суцільний відрізок пишемо діапазоном, розкидані дати — числом днів.
  const solid = daysBetween(sorted[0], sorted[sorted.length - 1]) === sorted.length - 1;
  if (!solid) return `${fmtDate(sorted[0])} і ще ${sorted.length - 1} ${plural(sorted.length - 1, "день", "дні", "днів")}`;
  return first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${last.getDate()} ${MONTHS_FULL[last.getMonth()]}`
    : `${fmtDate(sorted[0])} — ${fmtDate(sorted[sorted.length - 1])}`;
}

export const daysWord = (n: number) => `${n} ${plural(n, "день", "дні", "днів")}`;

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
