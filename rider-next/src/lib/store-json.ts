import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import type { Client, Gear, Order, Role, Snapshot } from "./types";
import { DEFAULT_ROLES } from "./types";

/**
 * Сховище у звичайному JSON-файлі. Увесь стан — один документ на диску.
 *
 * Годиться для локальної роботи й для будь-якого хостингу зі справжнім диском.
 * НЕ годиться для Vercel: там файлова система ефемерна, запис або впаде,
 * або зникне при наступному холодному старті. Для онлайну — store-pg.ts.
 */

/**
 * Шлях мусить бути статично прив'язаний до підпапки: інакше збирач не може
 * довести, куди саме йде читання, і про всяк випадок тягне в серверний бандл
 * увесь проєкт. На Vercel це роздуває функцію до відмови.
 * Тому "data" — літерал, змінною задається лише ім'я файлу.
 */
const FILE = join(process.cwd(), "data", process.env.DATA_FILE_NAME ?? "rider.json");

const empty = (): Snapshot => ({
  orders: [],
  gear: [],
  clients: [],
  roles: DEFAULT_ROLES.map((r) => ({ ...r })),
  settings: { rate: 0, icsToken: randomBytes(18).toString("hex") },
});

/**
 * Запити в Next ходять паралельно, а тут read-modify-write цілого файлу.
 * Черга з одного промісу перетворює це на послідовність — без неї два
 * одночасні збереження затирають одне одного.
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

async function read(): Promise<Snapshot> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    return {
      orders: (parsed.orders ?? []).map((o) => ({ ...o, dates: o.dates ?? [] })),
      gear: parsed.gear ?? [],
      // Старі файли не знають про regular/contact — добиваємо дефолтами при читанні,
      // інакше в інтерфейс приїде undefined і чекбокс стане неконтрольованим.
      clients: (parsed.clients ?? []).map((c) => ({ ...c, regular: c.regular === true, contact: c.contact ?? "" })),
      // Ролі підставляються лише коли ключа ще нема — порожній список означає,
      // що всі ролі видалили свідомо, і повертати їх не треба.
      roles: parsed.roles ?? DEFAULT_ROLES.map((r) => ({ ...r })),
      settings: {
        rate: Number(parsed.settings?.rate) || 0,
        icsToken: parsed.settings?.icsToken || randomBytes(18).toString("hex"),
      },
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const fresh = empty();
      await save(fresh);
      return fresh;
    }
    throw err;
  }
}

/** Запис через тимчасовий файл і rename — щоб обрив не лишив половинчастий JSON. */
async function save(snapshot: Snapshot) {
  await mkdir(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf8");
  await rename(tmp, FILE);
}

async function mutate(fn: (s: Snapshot) => void | Promise<void>) {
  return serial(async () => {
    const snapshot = await read();
    await fn(snapshot);
    await save(snapshot);
    return snapshot;
  });
}

/* ---------- той самий API, що й у Postgres-версії ---------- */

export async function loadSnapshot(): Promise<Snapshot> {
  return serial(read);
}

export async function loadForIcs(token: string): Promise<Order[] | null> {
  const s = await serial(read);
  if (!s.settings.icsToken || s.settings.icsToken !== token) return null;
  return s.orders.filter((o) => o.status !== "cancelled").sort((a, b) => a.date.localeCompare(b.date));
}

export async function upsertOrder(o: Order) {
  await mutate((s) => {
    const i = s.orders.findIndex((x) => x.id === o.id);
    if (i >= 0) s.orders[i] = o;
    else s.orders.push(o);
    s.orders.sort((a, b) => b.date.localeCompare(a.date));
  });
}

export async function deleteOrder(id: string) {
  await mutate((s) => {
    s.orders = s.orders.filter((o) => o.id !== id);
  });
}

export async function upsertGear(g: Gear) {
  await mutate((s) => {
    const i = s.gear.findIndex((x) => x.id === g.id);
    if (i >= 0) s.gear[i] = g;
    else s.gear.push(g);
    s.gear.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "uk"));
  });
}

export async function reorderGear(ids: string[]) {
  await mutate((s) => {
    s.gear = s.gear.map((g) => ({ ...g, sort: ids.indexOf(g.id) >= 0 ? ids.indexOf(g.id) : g.sort ?? 0 }));
    s.gear.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "uk"));
  });
}

export async function deleteGear(id: string) {
  await mutate((s) => {
    s.gear = s.gear.filter((g) => g.id !== id);
  });
}

export async function findOrCreateClient(name: string): Promise<Client | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  let result: Client | null = null;
  await mutate((s) => {
    const found = s.clients.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (found) {
      result = found;
      return;
    }
    const created: Client = {
      id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
      name: trimmed,
      type: "",
      regular: false,
      contact: "",
      notes: "",
    };
    s.clients.push(created);
    sortClients(s.clients);
    result = created;
  });
  return result;
}

/** Постійні вгорі, решта за абеткою — той самий порядок, що й у Postgres. */
const sortClients = (list: Client[]) =>
  list.sort((a, b) => Number(b.regular) - Number(a.regular) || a.name.localeCompare(b.name, "uk"));

export async function upsertClient(c: Client) {
  await mutate((s) => {
    const i = s.clients.findIndex((x) => x.id === c.id);
    if (i >= 0) s.clients[i] = c;
    else s.clients.push(c);
    sortClients(s.clients);
    // Ім'я в замовленнях — копія, тож перейменування треба рознести окремо.
    s.orders = s.orders.map((o) => (o.clientId === c.id ? { ...o, clientName: c.name } : o));
  });
}

/** Замовлення лишаються: посилання обнуляється, вписане ім'я в них уже є. */
export async function deleteClient(id: string) {
  await mutate((s) => {
    s.clients = s.clients.filter((c) => c.id !== id);
    s.orders = s.orders.map((o) => (o.clientId === id ? { ...o, clientId: null } : o));
  });
}

export async function upsertRole(r: Role) {
  await mutate((s) => {
    const i = s.roles.findIndex((x) => x.id === r.id);
    if (i >= 0) s.roles[i] = r;
    else s.roles.push(r);
    s.roles.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "uk"));
  });
}

/** Роль зникає зі списку, але назва лишається вписаною в минулі замовлення. */
export async function deleteRole(id: string) {
  await mutate((s) => {
    s.roles = s.roles.filter((r) => r.id !== id);
  });
}

export async function saveRate(rate: number) {
  await mutate((s) => {
    s.settings.rate = Number.isFinite(rate) ? rate : 0;
  });
}

export async function rotateIcsToken(): Promise<string> {
  const token = randomBytes(18).toString("hex");
  await mutate((s) => {
    s.settings.icsToken = token;
  });
  return token;
}

/** Де саме лежить файл — показуємо в інтерфейсі, щоб було видно, що бекапити. */
export const dataFilePath = FILE;
