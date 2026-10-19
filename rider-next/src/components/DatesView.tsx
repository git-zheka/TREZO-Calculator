"use client";

import { useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { orderDates } from "@/lib/calc";
import { MONTH_NOM, today } from "@/lib/format";

type Mode = "busy" | "free";

/** Згортає числа в діапазони: [1,2,3,7,9,10] → "1–3, 7, 9–10". */
function ranges(days: number[]) {
  const out: string[] = [];
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++;
    out.push(j - i >= 1 ? `${days[i]}–${days[j]}` : `${days[i]}`);
    i = j + 1;
  }
  return out.join(", ");
}

export default function DatesView({ orders, onOpen }: { orders: Order[]; onOpen: (id: string) => void }) {
  const [mode, setMode] = useState<Mode>("busy");
  const [months, setMonths] = useState(3);
  const [leadsBusy, setLeadsBusy] = useState(true);
  const [copied, setCopied] = useState(false);

  const t = today();

  const data = useMemo(() => {
    const now = new Date();
    /** День → що саме того дня робиться. Заявки позначені окремо. */
    const byDay = new Map<string, { roles: string[]; lead: boolean; ids: string[] }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      if (o.status === "lead" && !leadsBusy) continue;
      // Назви ролей із позицій; якщо робота не вписана — це чиста оренда.
      const roles = o.items.filter((i) => i.type === "service").map((i) => i.name.trim()).filter(Boolean);
      for (const d of orderDates(o)) {
        if (!byDay.has(d)) byDay.set(d, { roles: [], lead: false, ids: [] });
        const slot = byDay.get(d)!;
        for (const r of roles.length ? roles : ["оренда"]) if (!slot.roles.includes(r)) slot.roles.push(r);
        if (o.status === "lead") slot.lead = true;
        slot.ids.push(o.id);
      }
    }

    const blocks: { y: number; m: number; label: string; busy: { day: number; text: string; lead: boolean; ids: string[] }[]; free: number[] }[] = [];
    for (let k = 0; k < months; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const last = new Date(y, m + 1, 0).getDate();
      const busy: { day: number; text: string; lead: boolean; ids: string[] }[] = [];
      const free: number[] = [];
      for (let day = 1; day <= last; day++) {
        const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        // Минулі дні поточного місяця не пропонуємо і не показуємо як зайняті.
        if (key < t) continue;
        const slot = byDay.get(key);
        if (slot) busy.push({ day, text: slot.roles.join(", "), lead: slot.lead, ids: slot.ids });
        else free.push(day);
      }
      blocks.push({ y, m, label: `${MONTH_NOM[m]} ${String(m + 1).padStart(2, "0")}`, busy, free });
    }
    return blocks;
  }, [orders, months, leadsBusy, t]);

  /** Те саме, що на екрані, тільки текстом — рівно це й лягає в буфер. */
  const text = useMemo(() => {
    const parts: string[] = [];
    for (const b of data) {
      if (mode === "busy" && !b.busy.length) continue;
      if (mode === "free" && !b.free.length) continue;
      const lines = [b.label];
      if (mode === "busy") {
        for (const x of b.busy) lines.push(`${x.day} — ${x.text}${x.lead ? " (заявка)" : ""}`);
      } else {
        lines.push(ranges(b.free));
      }
      parts.push(lines.join("\n"));
    }
    return parts.join("\n\n");
  }, [data, mode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API не скрізь доступний — старий спосіб через приховане поле
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const totalFree = data.reduce((s, b) => s + b.free.length, 0);
  const totalBusy = data.reduce((s, b) => s + b.busy.length, 0);

  return (
    <>
      <div className="sec-head">
        <div>
          <h2 className="sec">Дати для відправки</h2>
          <p className="sec-sub">
            Готовий текст, щоб скинути в чат. Рахується від сьогодні, минулі дні місяця не враховуються.
          </p>
        </div>
        <div className="seg">
          <button aria-pressed={mode === "busy"} onClick={() => setMode("busy")}>Зайняті</button>
          <button aria-pressed={mode === "free"} onClick={() => setMode("free")}>Вільні</button>
        </div>
      </div>

      <div className="rowflex" style={{ marginBottom: 14 }}>
        <div className="seg">
          {[1, 3, 6, 12].map((n) => (
            <button key={n} aria-pressed={months === n} onClick={() => setMonths(n)}>
              {n === 1 ? "цей місяць" : `${n} міс`}
            </button>
          ))}
        </div>
        <label className="check" style={{ padding: "7px 11px" }}>
          <input type="checkbox" checked={leadsBusy} onChange={(e) => setLeadsBusy(e.target.checked)} />
          <span>Заявки теж зайняті</span>
        </label>
        <span className="hint" style={{ marginLeft: "auto" }}>
          {mode === "busy" ? `${totalBusy} зайнятих днів` : `${totalFree} вільних днів`}
        </span>
      </div>

      <div className="panel">
        <div className="chart-head">
          <h3>Що скопіюється</h3>
          <button className="btn sm primary" onClick={copy} disabled={!text}>
            {copied ? "Скопійовано" : "Копіювати"}
          </button>
        </div>
        {text ? (
          <pre className="copytext">{text}</pre>
        ) : (
          <p className="hint" style={{ margin: 0 }}>
            {mode === "busy" ? "У цьому періоді зайнятих днів немає." : "У цьому періоді вільних днів немає."}
          </p>
        )}
      </div>

      {data.map((b) => (
        <section key={`${b.y}-${b.m}`} style={{ marginBottom: 18 }}>
          <div className="group-head">
            <h3>{b.label}</h3>
            <span className="hint">{b.busy.length} зайнято · {b.free.length} вільно</span>
          </div>
          {mode === "busy" ? (
            b.busy.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>Увесь місяць вільний.</p>
            ) : (
              <div className="daylist">
                {b.busy.map((x) => (
                  <button key={x.day} className="dayrow" onClick={() => onOpen(x.ids[0])}>
                    <b>{x.day}</b>
                    <span>{x.text}</span>
                    {x.lead && <em className="pill s-lead">заявка</em>}
                  </button>
                ))}
              </div>
            )
          ) : (
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              {b.free.length ? ranges(b.free) : <span className="hint">Вільних днів немає.</span>}
            </p>
          )}
        </section>
      ))}
    </>
  );
}
