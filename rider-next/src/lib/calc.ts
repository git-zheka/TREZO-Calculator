import type { Currency, Gear, Order, Settings } from "./types";
import { MONTHS, daysBetween, today } from "./format";

/* ---------- суми ---------- */

export const orderTotal = (o: Order) =>
  (o.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);

export const orderNet = (o: Order) => orderTotal(o) - (Number(o.expenses) || 0);

export const gearRevenue = (o: Order) =>
  (o.items || [])
    .filter((i) => i.type === "gear")
    .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);

/** У гроші рахуємо тільки виконані замовлення. */
export const counted = (o: Order) => o.status === "done";

/* ---------- окупність ---------- */

export type Payback = {
  cur: Currency;
  other: Currency;
  /** Повне вкладення: ціна за одиницю × кількість */
  price: number;
  /** Ціна однієї одиниці */
  unitPrice: number;
  units: number;
  earned: number;
  earnedSame: number;
  earnedOther: number;
  pct: number;
  uses: number;
  /** Скільки одиниць сумарно віддано в оренду за всі замовлення */
  unitsRented: number;
  last: string | null;
  usesLeft: number | null;
  left: number;
};

export function gearEarnings(orders: Order[], gearId: string) {
  const out = { UAH: 0, USD: 0, uses: 0, units: 0, last: null as string | null };
  for (const o of orders) {
    if (!counted(o)) continue;
    for (const it of o.items || []) {
      if (it.type !== "gear" || it.equipmentId !== gearId) continue;
      out[o.currency] += (Number(it.qty) || 0) * (Number(it.price) || 0);
      out.uses += 1;
      out.units += Number(it.qty) || 0;
      if (!out.last || o.date > out.last) out.last = o.date;
    }
  }
  return out;
}

export function payback(orders: Order[], g: Gear, settings: Settings): Payback {
  const e = gearEarnings(orders, g.id);
  const cur: Currency = g.purchaseCurrency || "UAH";
  const other: Currency = cur === "UAH" ? "USD" : "UAH";
  // Ціна покупки — за ОДНУ одиницю, як і ставка оренди.
  // Окупність міряється проти повного вкладення в позицію.
  const price = (Number(g.purchasePrice) || 0) * (Number(g.qty) || 1);
  const earnedSame = e[cur];
  const earnedOther = e[other];
  const rate = Number(settings.rate) || 0;
  // Конвертуємо, тільки якщо курс заданий вручну — інакше валюти живуть окремо.
  const converted = rate > 0 && earnedOther ? (cur === "UAH" ? earnedOther * rate : earnedOther / rate) : 0;
  const earned = earnedSame + converted;
  const pct = price > 0 ? Math.min(999, Math.round((earned / price) * 100)) : 0;
  const perUse = e.uses > 0 ? earned / e.uses : 0;
  const left = Math.max(0, price - earned);
  const usesLeft = perUse > 0 ? Math.ceil(left / perUse) : null;
  return {
    cur, other, price,
    unitPrice: Number(g.purchasePrice) || 0,
    units: Number(g.qty) || 1,
    earned, earnedSame, earnedOther, pct,
    uses: e.uses, unitsRented: e.units, last: e.last, usesLeft, left,
  };
}

/* ---------- замовники ---------- */

export type ClientStat = {
  key: string;
  name: string;
  orders: number;
  done: number;
  UAH: number;
  USD: number;
  last: string | null;
  idleDays: number | null;
};

export function clientStats(orders: Order[]): ClientStat[] {
  const map = new Map<string, ClientStat>();
  for (const o of orders) {
    const key = o.clientId || `n:${o.clientName || "—"}`;
    if (!map.has(key)) {
      map.set(key, { key, name: o.clientName || "Без замовника", orders: 0, done: 0, UAH: 0, USD: 0, last: null, idleDays: null });
    }
    const m = map.get(key)!;
    m.orders += 1;
    if (counted(o)) {
      m.done += 1;
      m[o.currency] += orderTotal(o);
    }
    if (!m.last || o.date > m.last) m.last = o.date;
  }
  const t = today();
  return Array.from(map.values()).map((c) => ({ ...c, idleDays: c.last ? daysBetween(c.last, t) : null }));
}

/* ---------- сезонність ---------- */

export type MonthBucket = { y: number; m: number; label: string; count: number; UAH: number; USD: number; cancelled: number };

export function monthlySeries(orders: Order[], months: number): MonthBucket[] {
  const now = new Date();
  const out: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ y: d.getFullYear(), m: d.getMonth(), label: MONTHS[d.getMonth()], count: 0, UAH: 0, USD: 0, cancelled: 0 });
  }
  for (const o of orders) {
    if (!o.date) continue;
    const d = new Date(o.date);
    const b = out.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
    if (!b) continue;
    if (o.status === "cancelled") {
      b.cancelled += 1;
      continue;
    }
    b.count += 1;
    if (counted(o)) b[o.currency] += orderTotal(o);
  }
  return out;
}

/* ---------- задвоєна техніка ---------- */

/** Дати, де одну позицію обіцяно більше разів, ніж є одиниць у парку. */
export function clashDays(orders: Order[], gear: Gear[]): Map<string, string[]> {
  const byDate = new Map<string, Order[]>();
  for (const o of orders) {
    if (o.status === "cancelled" || !o.date) continue;
    if (!byDate.has(o.date)) byDate.set(o.date, []);
    byDate.get(o.date)!.push(o);
  }
  const out = new Map<string, string[]>();
  byDate.forEach((os, date) => {
    if (os.length < 2) return;
    const booked = new Map<string, number>();
    const hits: string[] = [];
    for (const o of os) {
      for (const it of o.items || []) {
        if (it.type !== "gear" || !it.equipmentId) continue;
        const need = (Number(it.qty) || 0) + (booked.get(it.equipmentId) || 0);
        booked.set(it.equipmentId, need);
        const have = Number(gear.find((g) => g.id === it.equipmentId)?.qty) || 1;
        if (need > have && !hits.includes(it.name)) hits.push(it.name);
      }
    }
    if (hits.length) out.set(date, hits);
  });
  return out;
}
