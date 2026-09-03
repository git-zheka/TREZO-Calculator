"use client";

import { useState } from "react";
import type { Gear, Order, Settings } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { clashDays, orderTotal } from "@/lib/calc";
import { DOW, MONTH_NOM, fmtDate, money, plural, toYmd } from "@/lib/format";
import IcsPanel from "./IcsPanel";

export default function CalendarView({
  orders,
  gear,
  settings,
  onOpen,
  onNewOn,
}: {
  orders: Order[];
  gear: Gear[];
  settings: Settings;
  onOpen: (id: string) => void;
  onNewOn: (date: string) => void;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const first = new Date(cursor.y, cursor.m, 1);
  const offset = (first.getDay() + 6) % 7; // тиждень із понеділка
  const gridStart = new Date(cursor.y, cursor.m, 1 - offset);
  const clashes = clashDays(orders, gear);
  const todayStr = toYmd(now);

  const byDate = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.date) continue;
    if (!byDate.has(o.date)) byDate.set(o.date, []);
    byDate.get(o.date)!.push(o);
  }

  const monthAll = orders
    .filter((o) => {
      const d = new Date(o.date);
      return d.getFullYear() === cursor.y && d.getMonth() === cursor.m;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const busyDays = new Set(monthAll.filter((o) => o.status !== "cancelled").map((o) => o.date)).size;
  const sums = { UAH: 0, USD: 0 };
  for (const o of monthAll) if (o.status !== "cancelled") sums[o.currency] += orderTotal(o);

  const move = (step: number) => {
    if (step === 0) return setCursor({ y: now.getFullYear(), m: now.getMonth() });
    const d = new Date(cursor.y, cursor.m + step, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const clashList = Array.from(clashes.entries()).filter(([date]) => {
    const d = new Date(date);
    return d.getFullYear() === cursor.y && d.getMonth() === cursor.m;
  });

  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));

  return (
    <>
      <div className="cal-top">
        <button className="navbtn" onClick={() => move(-1)} aria-label="Попередній місяць">‹</button>
        <button className="navbtn" onClick={() => move(1)} aria-label="Наступний місяць">›</button>
        <div className="cal-title">{MONTH_NOM[cursor.m]} {cursor.y}</div>
        <button className="btn sm" onClick={() => move(0)}>Сьогодні</button>
        <span className="hint" style={{ marginLeft: "auto" }}>
          {busyDays} {plural(busyDays, "зайнятий день", "зайнятих дні", "зайнятих днів")} у цьому місяці
        </span>
      </div>

      <IcsPanel settings={settings} />

      <div className="cal">
        {DOW.map((d) => <div className="dow" key={d}>{d}</div>)}
        {cells.map((d) => {
          const key = toYmd(d);
          const out = d.getMonth() !== cursor.m;
          const list = (byDate.get(key) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));
          const clash = clashes.has(key);
          return (
            <div
              key={key}
              className={`day${out ? " out" : ""}${key === todayStr ? " today" : ""}${clash ? " clash" : ""}`}
              onClick={(e) => { if (e.target === e.currentTarget) onNewOn(key); }}
              title={clash ? `Конфлікт: ${clashes.get(key)!.join(", ")}` : undefined}
            >
              <span className="dn">{d.getDate()}</span>
              {list.slice(0, 3).map((o) => (
                <button
                  key={o.id}
                  className={`ev s-${o.status}`}
                  onClick={() => onOpen(o.id)}
                  title={`${o.title} · ${o.clientName} · ${money(orderTotal(o), o.currency)}`}
                >
                  {o.title || "Замовлення"}
                </button>
              ))}
              {list.length > 3 && <span className="more">ще {list.length - 3}</span>}
            </div>
          );
        })}
      </div>

      <div className="legend-cal">
        <span><i style={{ background: "var(--warn)" }} />Заявка</span>
        <span><i style={{ background: "var(--s1)" }} />Підтверджено</span>
        <span><i style={{ background: "var(--good)" }} />Виконано</span>
        <span><i style={{ background: "var(--crit)" }} />Скасовано</span>
        <span className="hint">Клік по порожньому дню створює замовлення на цю дату</span>
      </div>

      {monthAll.length > 0 && (
        <>
          <div className="sec-head" style={{ marginTop: 22 }}>
            <div>
              <h2 className="sec">{MONTH_NOM[cursor.m]} — список</h2>
              <p className="sec-sub">
                {[sums.UAH ? money(sums.UAH, "UAH") : null, sums.USD ? money(sums.USD, "USD") : null].filter(Boolean).join(" · ") || "без сум"}
              </p>
            </div>
          </div>
          <div className="panel flush">
            <div className="mlist">
              {monthAll.map((o) => {
                const d = new Date(o.date);
                return (
                  <button key={o.id} className="mrow" onClick={() => onOpen(o.id)}>
                    <div className="md"><b>{d.getDate()}</b>{DOW[(d.getDay() + 6) % 7]}</div>
                    <div>
                      <div className="mt">{o.title || "Замовлення"}</div>
                      <div className="mm">{o.clientName || "—"}</div>
                    </div>
                    <div className="ms">
                      {money(orderTotal(o), o.currency)}
                      <div style={{ marginTop: 4 }}><span className={`pill s-${o.status}`}>{STATUS_LABEL[o.status]}</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {clashList.length > 0 && (
        <div className="panel" style={{ marginTop: 16, borderColor: "color-mix(in srgb, var(--crit) 45%, transparent)" }}>
          <b style={{ fontSize: 13.5, color: "var(--crit)" }}>Техніка задвоєна</b>
          <div className="hint" style={{ marginTop: 6 }}>
            На цих датах одну й ту саму позицію обіцяно більше разів, ніж у тебе одиниць:
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5 }}>
            {clashList.map(([date, items]) => (
              <li key={date}>{fmtDate(date)} — {items.join(", ")}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
