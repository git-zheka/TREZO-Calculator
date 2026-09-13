// Переносить data/rider.json у Postgres. Запускати один раз, у день переїзду:
//   npm run db:push        (створити таблиці)
//   npm run db:migrate     (залити дані)
//
// Ідемпотентно: усе через on conflict do update, тож повторний запуск
// просто перезапише ті самі рядки, а не задвоїть їх.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не заданий. Додай його в .env.local і запусти ще раз.");
  process.exit(1);
}

const file = join(process.cwd(), "data", process.env.DATA_FILE_NAME ?? "rider.json");

let data;
try {
  data = JSON.parse(await readFile(file, "utf8"));
} catch (err) {
  if (err.code === "ENOENT") {
    console.error(`Файл ${file} не знайдений — переносити нічого.`);
    process.exit(1);
  }
  throw err;
}

const sql = neon(url);
const { orders = [], gear = [], clients = [], settings = {} } = data;

// Порядок важливий: orders посилається на clients через client_id.
for (const c of clients) {
  await sql`
    insert into clients (id, name, type, notes)
    values (${c.id}, ${c.name}, ${c.type ?? "direct"}, ${c.notes ?? ""})
    on conflict (id) do update set
      name = excluded.name, type = excluded.type, notes = excluded.notes`;
}
console.log(`✓ замовників: ${clients.length}`);

for (const g of gear) {
  await sql`
    insert into gear (id, name, category, qty, purchase_date, purchase_price, purchase_currency,
                      rate_uah, rate_usd, status, notes, parts)
    values (${g.id}, ${g.name}, ${g.category ?? ""}, ${g.qty ?? 1}, ${g.purchaseDate || null},
            ${g.purchasePrice ?? 0}, ${g.purchaseCurrency ?? "UAH"}, ${g.rateUah ?? 0},
            ${g.rateUsd ?? 0}, ${g.status ?? "active"}, ${g.notes ?? ""},
            ${JSON.stringify(g.parts ?? [])}::jsonb)
    on conflict (id) do update set
      name = excluded.name, category = excluded.category, qty = excluded.qty,
      purchase_date = excluded.purchase_date, purchase_price = excluded.purchase_price,
      purchase_currency = excluded.purchase_currency, rate_uah = excluded.rate_uah,
      rate_usd = excluded.rate_usd, status = excluded.status, notes = excluded.notes,
      parts = excluded.parts`;
}
console.log(`✓ техніки: ${gear.length}`);

for (const o of orders) {
  await sql`
    insert into orders (id, date, client_id, client_name, title, kind, currency, status,
                        expenses, notes, items, updated_at)
    values (${o.id}, ${o.date}, ${o.clientId || null}, ${o.clientName ?? ""}, ${o.title ?? ""},
            ${o.kind ?? "rent+set"}, ${o.currency ?? "UAH"}, ${o.status ?? "confirmed"},
            ${o.expenses ?? 0}, ${o.notes ?? ""}, ${JSON.stringify(o.items ?? [])}::jsonb, now())
    on conflict (id) do update set
      date = excluded.date, client_id = excluded.client_id, client_name = excluded.client_name,
      title = excluded.title, kind = excluded.kind, currency = excluded.currency,
      status = excluded.status, expenses = excluded.expenses, notes = excluded.notes,
      items = excluded.items, updated_at = now()`;
}
console.log(`✓ замовлень: ${orders.length}`);

// Курс переносимо. Токен календаря — ні: у базі вже свій, і краще, щоб
// підписка на проді відрізнялася від локальної.
if (settings.rate) {
  await sql`update settings set rate = ${settings.rate}, updated_at = now() where id = 1`;
  console.log(`✓ курс: ${settings.rate}`);
}

console.log("Готово. Тепер дані в Postgres; data/rider.json можна лишити як бекап.");
