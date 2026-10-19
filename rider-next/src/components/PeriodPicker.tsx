"use client";

import type { Order } from "@/lib/types";
import { orderDates } from "@/lib/calc";
import { today } from "@/lib/format";

export type Period = { from: string; to: string; preset: PresetId };
export type PresetId = "month" | "q" | "year" | "all" | "custom";

const first = (y: number, m: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-01`;

/** Найраніша дата серед замовлень — нижня межа «за весь час». */
export function earliestDate(orders: Order[]) {
  let min: string | null = null;
  for (const o of orders) {
    const d = orderDates(o)[0];
    if (d && (!min || d < min)) min = d;
  }
  return min ?? today();
}

export function presetRange(preset: PresetId, orders: Order[]): { from: string; to: string } {
  const now = new Date();
  const t = today();
  if (preset === "month") return { from: first(now.getFullYear(), now.getMonth()), to: t };
  if (preset === "q") {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: first(d.getFullYear(), d.getMonth()), to: t };
  }
  if (preset === "year") return { from: `${now.getFullYear()}-01-01`, to: t };
  return { from: earliestDate(orders), to: t };
}

const LABELS: { id: PresetId; label: string }[] = [
  { id: "month", label: "місяць" },
  { id: "q", label: "3 міс" },
  { id: "year", label: "рік" },
  { id: "all", label: "весь час" },
];

/**
 * Період, за який рахується аналітика. Пресети покривають майже все,
 * а свій діапазон потрібен, коли звіряєшся за конкретний сезон.
 */
export default function PeriodPicker({
  period,
  orders,
  onChange,
}: {
  period: Period;
  orders: Order[];
  onChange: (p: Period) => void;
}) {
  const pick = (id: PresetId) => onChange({ ...presetRange(id, orders), preset: id });

  return (
    <div className="rowflex">
      <div className="seg">
        {LABELS.map((x) => (
          <button key={x.id} aria-pressed={period.preset === x.id} onClick={() => pick(x.id)}>
            {x.label}
          </button>
        ))}
        <button aria-pressed={period.preset === "custom"} onClick={() => onChange({ ...period, preset: "custom" })}>
          свій
        </button>
      </div>
      {period.preset === "custom" && (
        <div className="rowflex" style={{ gap: 6 }}>
          <input
            className="i dateinput"
            type="date"
            value={period.from}
            max={period.to}
            onChange={(e) => onChange({ ...period, from: e.target.value || period.from, preset: "custom" })}
          />
          <span className="hint">—</span>
          <input
            className="i dateinput"
            type="date"
            value={period.to}
            min={period.from}
            onChange={(e) => onChange({ ...period, to: e.target.value || period.to, preset: "custom" })}
          />
        </div>
      )}
    </div>
  );
}
