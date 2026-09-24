import type { Client, Currency, Gear, Order, OrderItem, Role, Settings } from "./types";
import { isBillable, normalizeCategory } from "./types";
import { MONTHS, daysBetween, nextDay, today } from "./format";

/* ---------- дати замовлення ---------- */

/**
 * Усі дні, на які замовлення займає техніку. Старі записи мають лише date,
 * тож порожній список читається як один день — інакше вони зникли б з календаря.
 */
export function orderDates(o: Order): string[] {
  const list = (o.dates ?? []).filter(Boolean);
  if (!list.length) return o.date ? [o.date] : [];
  return Array.from(new Set(list)).sort();
}

/** Нормалізація перед записом: без повторів, за зростанням, date = перший день. */
export function withDates(o: Order, dates: string[]): Order {
  const clean = Array.from(new Set(dates.filter(Boolean))).sort();
  return { ...o, dates: clean, date: clean[0] ?? o.date };
}

/** Суцільні відрізки: [17,18,19,25] → [[17,18,19],[25]]. Для календарних подій. */
export function dateRuns(dates: string[]): string[][] {
  const runs: string[][] = [];
  for (const d of [...dates].sort()) {
    const last = runs[runs.length - 1];
    if (last && nextDay(last[last.length - 1]) === d) last.push(d);
    else runs.push([d]);
  }
  return runs;
}

/* ---------- суми ---------- */

/** Сума рядка: одиниці × ціна за одну × кількість днів. Днів немає — один. */
export const lineTotal = (it: OrderItem) =>
  (Number(it.qty) || 0) * (Number(it.price) || 0) * (Number(it.days) || 1);

export const orderTotal = (o: Order) => (o.items || []).reduce((s, it) => s + lineTotal(it), 0);

export const orderNet = (o: Order) => orderTotal(o) - (Number(o.expenses) || 0);

export const gearRevenue = (o: Order) =>
  (o.items || []).filter((i) => i.type === "gear").reduce((s, it) => s + lineTotal(it), 0);

/**
 * Два режими підрахунку грошей.
 *
 *   done   — тільки виконане: реально зароблене, на нього спирається окупність
 *   active — виконане плюс підтверджене: скільки вже законтрактовано
 *
 * Другий потрібен тому, що замовлення живуть у статусі «Підтверджено» тижнями
 * до самої дати, і поки жодне не позначене виконаним, «done» показує суцільні
 * нулі — виглядає як зламаний підрахунок, хоч робота розписана на місяць уперед.
 */
export type MoneyMode = "done" | "active";

/** У гроші рахуємо тільки виконані замовлення. */
export const counted = (o: Order) => o.status === "done";
export const contracted = (o: Order) => o.status === "done" || o.status === "confirmed";
export const inMode = (o: Order, mode: MoneyMode) => (mode === "done" ? counted(o) : contracted(o));

/* ---------- окупність ---------- */

export type Payback = {
  cur: Currency;
  other: Currency;
  /** Повне вкладення: ціна за одиницю × кількість */
  price: number;
  /** Ціна однієї одиниці */
  unitPrice: number;
  units: number;
  /** Скільки коштувала комплектація — сумки, пульти, кабелі */
  partsCost: number;
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
  /** Дохід не свій, а розподілена частка — комутація, стійки */
  shared: boolean;
};

export function gearEarnings(orders: Order[], gearId: string, mode: MoneyMode = "done") {
  const out = { UAH: 0, USD: 0, uses: 0, units: 0, last: null as string | null };
  for (const o of orders) {
    if (!inMode(o, mode)) continue;
    for (const it of o.items || []) {
      if (it.type !== "gear" || it.equipmentId !== gearId) continue;
      out[o.currency] += lineTotal(it);
      out.uses += 1;
      out.units += Number(it.qty) || 0;
      if (!out.last || o.date > out.last) out.last = o.date;
    }
  }
  return out;
}

/**
 * Дохід, приписаний комутації та стійкам.
 *
 * Своєї ціни вони не мають — їдуть як супутнє, тож у замовленні стоять нулем.
 * Щоб їхня окупність не лишалася вічним нулем, кожному виїзду віддається
 * частка доходу цього замовлення, пропорційна вкладеним у позицію грошам
 * серед усієї техніки, що поїхала. Кабель за 500 ₴ поруч із плазмою за 20 000
 * отримує 1/41 доходу — приблизно стільки він у ньому й важить.
 *
 * Це облікова частка, а не окремі гроші: у суму замовлення вона не додається
 * і доходу в аналітиці не збільшує.
 */
export function sharedEarnings(orders: Order[], g: Gear, allGear: Gear[], mode: MoneyMode) {
  const out = { UAH: 0, USD: 0 };
  const unitCost = (id?: string | null) => Number(allGear.find((x) => x.id === id)?.purchasePrice) || 0;
  const mineUnit = Number(g.purchasePrice) || 0;
  if (mineUnit <= 0) return out;

  for (const o of orders) {
    if (!inMode(o, mode)) continue;
    const lines = (o.items || []).filter((i) => i.type === "gear" && i.equipmentId);
    const mineQty = lines.filter((i) => i.equipmentId === g.id).reduce((s, i) => s + (Number(i.qty) || 0), 0);
    if (!mineQty) continue;
    const base = lines.reduce((s, l) => s + unitCost(l.equipmentId) * (Number(l.qty) || 0), 0);
    if (base <= 0) continue;
    out[o.currency] += gearRevenue(o) * ((mineUnit * mineQty) / base);
  }
  return out;
}

export function payback(
  orders: Order[],
  g: Gear,
  settings: Settings,
  mode: MoneyMode = "done",
  allGear: Gear[] = [],
): Payback {
  const e = gearEarnings(orders, g.id, mode);
  // Виїзди й дати лишаються свої, а гроші комутації — розподілена частка.
  const shared = !isBillable(normalizeCategory(g.category));
  if (shared && allGear.length) {
    const s = sharedEarnings(orders, g, allGear, mode);
    e.UAH = s.UAH;
    e.USD = s.USD;
  }
  const cur: Currency = g.purchaseCurrency || "UAH";
  const other: Currency = cur === "UAH" ? "USD" : "UAH";
  // Ціна покупки — за ОДНУ одиницю, як і ставка оренди.
  // Окупність міряється проти повного вкладення в позицію.
  const units = Number(g.qty) || 1;
  const partsCost = (g.parts ?? []).reduce((s, x) => s + (Number(x.price) || 0) * (Number(x.qty) || 1), 0);
  const price = (Number(g.purchasePrice) || 0) * units + partsCost;
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
    units,
    partsCost,
    earned, earnedSame, earnedOther, pct,
    uses: e.uses, unitsRented: e.units, last: e.last, usesLeft, left,
    shared,
  };
}

/* ---------- замовники ---------- */

export type ClientStat = {
  key: string;
  name: string;
  /** Заведена картка замовника, якщо вона є; для рядків, що виникли лише із замовлень, — null */
  client: Client | null;
  orders: number;
  done: number;
  /** Оборот — скільки виставлено замовнику */
  UAH: number;
  USD: number;
  /** Чисті — оборот мінус витрати на виїзд (дорога, помічник) */
  netUAH: number;
  netUSD: number;
  last: string | null;
  idleDays: number | null;
};

/**
 * Зводить замовлення по замовниках. Заведені картки потрапляють у список навіть
 * без жодного замовлення — інакше щойно створений постійний клієнт зникав би
 * до першої роботи. Замовлення чіпляється до картки за id, а якщо його немає
 * (старі записи) — за іменем без урахування регістру.
 */
export function clientStats(orders: Order[], clients: Client[] = [], mode: MoneyMode = "done"): ClientStat[] {
  const map = new Map<string, ClientStat>();
  const byName = new Map<string, string>();

  const blank = (key: string, name: string, client: Client | null): ClientStat =>
    ({ key, name, client, orders: 0, done: 0, UAH: 0, USD: 0, netUAH: 0, netUSD: 0, last: null, idleDays: null });

  for (const c of clients) {
    map.set(c.id, blank(c.id, c.name, c));
    byName.set(c.name.trim().toLowerCase(), c.id);
  }

  for (const o of orders) {
    const named = byName.get((o.clientName || "").trim().toLowerCase());
    const key = (o.clientId && map.has(o.clientId) ? o.clientId : null) ?? named ?? o.clientId ?? `n:${o.clientName || "—"}`;
    if (!map.has(key)) map.set(key, blank(key, o.clientName || "Без замовника", null));
    const m = map.get(key)!;
    m.orders += 1;
    if (inMode(o, mode)) {
      m.done += 1;
      m[o.currency] += orderTotal(o);
      m[o.currency === "UAH" ? "netUAH" : "netUSD"] += orderNet(o);
    }
    if (!m.last || o.date > m.last) m.last = o.date;
  }
  const t = today();
  return Array.from(map.values()).map((c) => ({ ...c, idleDays: c.last ? daysBetween(c.last, t) : null }));
}

/* ---------- сезонність ---------- */

export type MonthBucket = {
  y: number; m: number; label: string; count: number;
  /** Оборот за місяць */
  UAH: number; USD: number;
  /** Чисті за місяць — після витрат на виїзди */
  netUAH: number; netUSD: number;
  cancelled: number;
};

export function monthlySeries(orders: Order[], months: number, mode: MoneyMode = "done"): MonthBucket[] {
  const now = new Date();
  const out: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ y: d.getFullYear(), m: d.getMonth(), label: MONTHS[d.getMonth()], count: 0, UAH: 0, USD: 0, netUAH: 0, netUSD: 0, cancelled: 0 });
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
    if (inMode(o, mode)) {
      b[o.currency] += orderTotal(o);
      b[o.currency === "UAH" ? "netUAH" : "netUSD"] += orderNet(o);
    }
  }
  return out;
}

/* ---------- ким я працюю ---------- */

export type RoleStat = {
  key: string;
  name: string;
  role: Role | null;
  /** Скільки замовлень містили цю роль (не рядків: дві однакові ролі в одному — це одне замовлення) */
  orders: number;
  UAH: number;
  USD: number;
  last: string | null;
};

/**
 * Розподіл роботи по ролях. Рядок замовлення чіпляється до ролі за roleId,
 * а старі послуги, заведені до появи ролей, — за назвою: інакше вся історія
 * до цього оновлення випала б зі статистики.
 */
export function roleStats(orders: Order[], roles: Role[], mode: MoneyMode = "done"): RoleStat[] {
  const map = new Map<string, RoleStat>();
  const byName = new Map<string, string>();
  for (const r of roles) {
    map.set(r.id, { key: r.id, name: r.name, role: r, orders: 0, UAH: 0, USD: 0, last: null });
    byName.set(r.name.trim().toLowerCase(), r.id);
  }

  for (const o of orders) {
    if (!inMode(o, mode)) continue;
    const seen = new Set<string>();
    for (const it of o.items || []) {
      if (it.type !== "service") continue;
      const named = byName.get((it.name || "").trim().toLowerCase());
      const key = (it.roleId && map.has(it.roleId) ? it.roleId : null) ?? named ?? `n:${(it.name || "Інше").trim()}`;
      if (!map.has(key)) map.set(key, { key, name: it.name || "Інше", role: null, orders: 0, UAH: 0, USD: 0, last: null });
      const m = map.get(key)!;
      m[o.currency] += lineTotal(it);
      if (!seen.has(key)) {
        m.orders += 1;
        seen.add(key);
      }
      if (!m.last || o.date > m.last) m.last = o.date;
    }
  }
  return Array.from(map.values());
}

/* ---------- задвоєна техніка ---------- */

/** Дати, де одну позицію обіцяно більше разів, ніж є одиниць у парку. */
export function clashDays(orders: Order[], gear: Gear[]): Map<string, string[]> {
  const byDate = new Map<string, Order[]>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    // Багатоденне замовлення тримає техніку кожен свій день, тож воно
    // потрапляє в перевірку на кожну дату окремо.
    for (const d of orderDates(o)) {
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(o);
    }
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
