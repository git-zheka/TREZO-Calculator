import type { Order } from "./types";
import { CUR, money, nextDay } from "./format";
import { orderTotal } from "./calc";
import { STATUS_LABEL } from "./types";

const esc = (s: string) => String(s ?? "").replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");

/** Рядки довші за 75 октетів треба згортати, інакше суворі парсери відмовляють. */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 73) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, "utf8") > 73) {
      out.push(out.length ? ` ${cur}` : cur);
      cur = "";
    }
    cur += ch;
  }
  if (cur) out.push(out.length ? ` ${cur}` : cur);
  return out.join("\r\n");
}

/** У рядку календаря має бути видно і подію, і замовника — саме за цим
 *  розрізняєш дві роботи в один день, не відкриваючи картку. */
export function summaryOf(o: Order) {
  const mark = o.status === "lead" ? "? " : "";
  const what = o.title.trim();
  const who = o.clientName.trim();
  if (what && who) return `${mark}${what} · ${who}`;
  return mark + (what || who || "Замовлення");
}

export function descriptionOf(o: Order) {
  const gear = (o.items || []).filter((i) => i.type === "gear").map((i) => {
    const extra = (i.parts ?? []).length
      ? `\n   + ${(i.parts ?? []).map((x) => (x.qty > 1 ? `${x.name} ×${x.qty}` : x.name)).join(", ")}`
      : "";
    return `• ${i.name} × ${i.qty}${extra}`;
  });
  const svc = (o.items || []).filter((i) => i.type === "service").map((i) => `• ${i.name}`);
  const parts = [
    o.clientName.trim() ? `Замовник: ${o.clientName.trim()}` : "Замовник не вказаний",
    `Статус: ${STATUS_LABEL[o.status]}`,
    `Сума: ${money(orderTotal(o), o.currency)}`,
  ];
  if (gear.length) parts.push(`Обладнання:\n${gear.join("\n")}`);
  if (svc.length) parts.push(`Робота:\n${svc.join("\n")}`);
  if (o.notes) parts.push(`Нотатки: ${o.notes}`);
  return parts.join("\n\n");
}

export function buildIcs(orders: Order[], calendarName = "Райдер") {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const L = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rider//UA//",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calendarName)}`,
    // Підказка клієнту, як часто перечитувати. Google усе одно має власний інтервал.
    "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
    "X-PUBLISHED-TTL:PT2H",
  ];
  for (const o of orders) {
    if (!o.date || o.status === "cancelled") continue;
    L.push(
      "BEGIN:VEVENT",
      `UID:rider-${o.id}@rider`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${o.date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${nextDay(o.date).replace(/-/g, "")}`,
      fold(`SUMMARY:${esc(summaryOf(o))}`),
      fold(`DESCRIPTION:${esc(descriptionOf(o))}`),
      `TRANSP:${o.status === "lead" ? "TRANSPARENT" : "OPAQUE"}`,
      "END:VEVENT",
    );
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}

export const CURRENCIES = CUR;
