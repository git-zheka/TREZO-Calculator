import { neon } from "@neondatabase/serverless";
import type { Client, Gear, Order, Snapshot } from "./types";

/**
 * Neon serverless driver: кожен запит іде по HTTP, без пулу з'єднань.
 * Саме тому воно працює на безкоштовному Vercel — там немає живого процесу,
 * який тримав би TCP-сокет між запитами.
 */
function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не заданий. Див. .env.example");
  return neon(url);
}

/* ---------- читання ---------- */

type Row = Record<string, unknown>;

/**
 * Дати віддаємо рядком через to_char, а не колонкою date.
 * Інакше драйвер робить із неї JS Date у локальній зоні процесу,
 * і toISOString() на машині за UTC зсуває день назад.
 */
const ORDER_COLS = `id, to_char(date,'YYYY-MM-DD') as date, client_id, client_name, title,
                    kind, currency, status, expenses, notes, items`;
const GEAR_COLS = `id, name, category, qty, to_char(purchase_date,'YYYY-MM-DD') as purchase_date,
                   purchase_price, purchase_currency, rate_uah, rate_usd, status, notes, parts, needs, sort`;

const asOrder = (r: Row): Order => ({
  id: String(r.id),
  date: String(r.date ?? "").slice(0, 10),
  clientId: (r.client_id as string) ?? null,
  clientName: (r.client_name as string) ?? "",
  title: (r.title as string) ?? "",
  kind: (r.kind as Order["kind"]) ?? "rent+set",
  currency: (r.currency as Order["currency"]) ?? "UAH",
  status: (r.status as Order["status"]) ?? "confirmed",
  expenses: Number(r.expenses) || 0,
  notes: (r.notes as string) ?? "",
  items: Array.isArray(r.items) ? (r.items as Order["items"]) : [],
});

const asGear = (r: Row): Gear => ({
  id: String(r.id),
  name: (r.name as string) ?? "",
  category: (r.category as string) ?? "",
  qty: Number(r.qty) || 1,
  purchaseDate: r.purchase_date ? String(r.purchase_date).slice(0, 10) : "",
  purchasePrice: Number(r.purchase_price) || 0,
  purchaseCurrency: (r.purchase_currency as Gear["purchaseCurrency"]) ?? "UAH",
  rateUah: Number(r.rate_uah) || 0,
  rateUsd: Number(r.rate_usd) || 0,
  status: (r.status as Gear["status"]) ?? "active",
  notes: (r.notes as string) ?? "",
  parts: Array.isArray(r.parts) ? (r.parts as Gear["parts"]) : [],
  needs: Array.isArray(r.needs) ? (r.needs as Gear["needs"]) : [],
  sort: Number(r.sort) || 0,
});

const asClient = (r: Row): Client => ({
  id: String(r.id),
  name: (r.name as string) ?? "",
  type: (r.type as string) ?? "direct",
  notes: (r.notes as string) ?? "",
});

export async function loadSnapshot(): Promise<Snapshot> {
  const db = sql();
  const [orders, gear, clients, settings] = await Promise.all([
    db.query(`select ${ORDER_COLS} from orders order by date desc`),
    db.query(`select ${GEAR_COLS} from gear order by sort, name`),
    db`select id, name, type, notes from clients order by name`,
    db`select * from settings where id = 1`,
  ]);
  const s = (settings as Row[])[0];
  return {
    orders: (orders as Row[]).map(asOrder),
    gear: (gear as Row[]).map(asGear),
    clients: (clients as Row[]).map(asClient),
    settings: { rate: Number(s?.rate) || 0, icsToken: (s?.ics_token as string) ?? "" },
  };
}

/** Для ICS-фіду: замовлення й налаштування без решти. */
export async function loadForIcs(token: string): Promise<Order[] | null> {
  const db = sql();
  const rows = (await db`select ics_token from settings where id = 1`) as Row[];
  const real = rows[0]?.ics_token as string | undefined;
  if (!real || real !== token) return null;
  const orders = (await db.query(
    `select ${ORDER_COLS} from orders where status <> 'cancelled' order by date`,
  )) as Row[];
  return orders.map(asOrder);
}

/* ---------- запис ---------- */

export async function upsertOrder(o: Order) {
  const db = sql();
  await db`
    insert into orders (id, date, client_id, client_name, title, kind, currency, status, expenses, notes, items, updated_at)
    values (${o.id}, ${o.date}, ${o.clientId}, ${o.clientName}, ${o.title}, ${o.kind}, ${o.currency},
            ${o.status}, ${o.expenses}, ${o.notes}, ${JSON.stringify(o.items)}::jsonb, now())
    on conflict (id) do update set
      date = excluded.date, client_id = excluded.client_id, client_name = excluded.client_name,
      title = excluded.title, kind = excluded.kind, currency = excluded.currency,
      status = excluded.status, expenses = excluded.expenses, notes = excluded.notes,
      items = excluded.items, updated_at = now()`;
}

export async function deleteOrder(id: string) {
  const db = sql();
  await db`delete from orders where id = ${id}`;
}

export async function upsertGear(g: Gear) {
  const db = sql();
  await db`
    insert into gear (id, name, category, qty, purchase_date, purchase_price, purchase_currency, rate_uah, rate_usd, status, notes, parts, needs, sort)
    values (${g.id}, ${g.name}, ${g.category}, ${g.qty}, ${g.purchaseDate || null}, ${g.purchasePrice},
            ${g.purchaseCurrency}, ${g.rateUah}, ${g.rateUsd}, ${g.status}, ${g.notes},
            ${JSON.stringify(g.parts ?? [])}::jsonb, ${JSON.stringify(g.needs ?? [])}::jsonb, ${g.sort ?? 0})
    on conflict (id) do update set
      name = excluded.name, category = excluded.category, qty = excluded.qty,
      purchase_date = excluded.purchase_date, purchase_price = excluded.purchase_price,
      purchase_currency = excluded.purchase_currency, rate_uah = excluded.rate_uah,
      rate_usd = excluded.rate_usd, status = excluded.status, notes = excluded.notes,
      parts = excluded.parts, needs = excluded.needs, sort = excluded.sort`;
}

/** Записує новий порядок: індекс у масиві стає значенням sort. */
export async function reorderGear(ids: string[]) {
  const db = sql();
  for (let i = 0; i < ids.length; i++) {
    await db`update gear set sort = ${i} where id = ${ids[i]}`;
  }
}

export async function deleteGear(id: string) {
  const db = sql();
  await db`delete from gear where id = ${id}`;
}

export async function findOrCreateClient(name: string): Promise<Client | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const db = sql();
  const found = (await db`select id, name, type, notes from clients where lower(name) = lower(${trimmed}) limit 1`) as Row[];
  if (found[0]) return asClient(found[0]);
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const created = (await db`
    insert into clients (id, name) values (${id}, ${trimmed})
    returning id, name, type, notes`) as Row[];
  return asClient(created[0]);
}

export async function saveRate(rate: number) {
  const db = sql();
  await db`update settings set rate = ${rate}, updated_at = now() where id = 1`;
}

export async function rotateIcsToken(): Promise<string> {
  const db = sql();
  const rows = (await db`
    update settings set ics_token = md5(random()::text || clock_timestamp()::text) || md5(random()::text), updated_at = now()
    where id = 1 returning ics_token`) as Row[];
  return rows[0].ics_token as string;
}
