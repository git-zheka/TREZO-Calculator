"use client";

import { useState, useTransition } from "react";
import type { Gear, Order, Settings } from "@/lib/types";
import { CATEGORIES, isBillable, normalizeCategory } from "@/lib/types";
import { payback } from "@/lib/calc";
import { money, num, plural, trips } from "@/lib/format";
import { reorderGear } from "@/app/actions";
import RateBlock from "./RateBlock";

const investedIn = (g: Gear) =>
  (Number(g.purchasePrice) || 0) * (Number(g.qty) || 1) +
  (g.parts ?? []).reduce((s, x) => s + (Number(x.price) || 0) * (Number(x.qty) || 1), 0);

export default function GearView({
  orders,
  gear,
  settings,
  onOpen,
  onNew,
}: {
  orders: Order[];
  gear: Gear[];
  settings: Settings;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startReorder] = useTransition();

  if (!gear.length) {
    return (
      <div className="empty">
        <h3>Обладнання ще не додане</h3>
        <p>Створи картку на кожну позицію: ціна покупки і дефолтна ціна оренди — з цього рахується окупність.</p>
        <button className="btn primary" onClick={onNew}>Додати обладнання</button>
      </div>
    );
  }

  const sorted = [...gear].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "uk"));

  // Групи в порядку CATEGORIES; усе незнайоме падає в «Інше».
  const groups = CATEGORIES.map((cat) => ({
    cat,
    items: sorted.filter((g) => normalizeCategory(g.category) === cat),
  })).filter((x) => x.items.length > 0);

  const paidOff = sorted.filter((g) => isBillable(normalizeCategory(g.category)) && payback(orders, g, settings).pct >= 100).length;
  const invested = { UAH: 0, USD: 0 };
  for (const g of sorted) invested[g.purchaseCurrency] += investedIn(g);
  const totalUnits = sorted.reduce((s, g) => s + (Number(g.qty) || 1), 0);

  /** Перетягування: новий порядок пишеться для всієї групи одним махом. */
  const dropOn = (targetId: string, items: Gear[]) => {
    if (!dragId || dragId === targetId) return;
    const ids = items.map((g) => g.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    // Порядок глобальний, тож надсилаємо всі картки: спершу переставлену групу,
    // потім решту в поточному порядку — інакше сусідні групи перемішаються.
    const rest = sorted.filter((g) => !ids.includes(g.id)).map((g) => g.id);
    const merged = sorted.map((g) => g.id);
    const groupPositions = merged.map((id, i) => (ids.includes(id) ? i : -1)).filter((i) => i >= 0);
    const next = [...merged];
    groupPositions.forEach((pos, i) => { next[pos] = ids[i]; });
    void rest;
    setDragId(null);
    startReorder(async () => { await reorderGear(next); });
  };

  const move = (id: string, dir: -1 | 1, items: Gear[]) => {
    const ids = items.map((g) => g.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const merged = sorted.map((g) => g.id);
    const positions = merged.map((x, k) => (ids.includes(x) ? k : -1)).filter((k) => k >= 0);
    const next = [...merged];
    positions.forEach((pos, k) => { next[pos] = ids[k]; });
    startReorder(async () => { await reorderGear(next); });
  };

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="k">Одиниць у парку</div>
          <div className="v num">{totalUnits}</div>
          <div className="d">{sorted.length} {plural(sorted.length, "позиція", "позиції", "позицій")} · {paidOff} {plural(paidOff, "окупилась", "окупились", "окупились")}</div>
        </div>
        <div className="tile">
          <div className="k">Вкладено, ₴</div>
          <div className="v num">{num(invested.UAH)} <small>₴</small></div>
          <div className="d">разом із комутацією</div>
        </div>
        <div className="tile">
          <div className="k">Вкладено, $</div>
          <div className="v num">{num(invested.USD)} <small>$</small></div>
          <div className="d">разом із комутацією</div>
        </div>
      </div>

      <RateBlock settings={settings} />

      <div className="sec-head">
        <div>
          <h2 className="sec">Парк обладнання</h2>
          <p className="sec-sub">Окупність — тільки з виконаних замовлень. Картки всередині групи можна перетягувати.</p>
        </div>
        <button className="btn sm" onClick={onNew}>＋ Картка</button>
      </div>

      {groups.map(({ cat, items }) => {
        const billable = isBillable(cat);
        return (
          <section key={cat} style={{ marginBottom: 22 }}>
            <div className="group-head">
              <h3>{cat}</h3>
              <span className="hint">
                {items.reduce((s, g) => s + (Number(g.qty) || 1), 0)} шт
                {!billable ? " · їде як супутнє, окремо не здається" : ""}
              </span>
            </div>

            <div className="gear-grid">
              {items.map((g, i) => {
                const p = payback(orders, g, settings);
                const full = p.pct >= 100;
                return (
                  <div
                    key={g.id}
                    className={`gear-wrap${dragId === g.id ? " dragging" : ""}`}
                    draggable
                    onDragStart={() => setDragId(g.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(g.id, items)}
                  >
                    <div className="gear-order">
                      <button className="ord" aria-label="Вище" disabled={i === 0} onClick={() => move(g.id, -1, items)}>↑</button>
                      <span className="grip" aria-hidden>⠿</span>
                      <button className="ord" aria-label="Нижче" disabled={i === items.length - 1} onClick={() => move(g.id, 1, items)}>↓</button>
                    </div>

                    <button className="gear" onClick={() => onOpen(g.id)}>
                      <div>
                        <div className="gcat">{g.qty > 1 ? `${g.qty} шт` : "1 шт"}</div>
                        <div className="gname">{g.name}</div>
                      </div>

                      {billable ? (
                        <>
                          <div className="paid">
                            <span className={`pct${full ? " ok" : ""}`}>{p.pct}%</span>
                            <span className="hint">
                              {full ? "окупилось" : p.usesLeft != null ? `ще ~${trips(p.usesLeft)}` : p.uses ? "заробіток в іншій валюті" : "ще не здавалось"}
                            </span>
                          </div>
                          <div className="bar"><i className={full ? "full" : ""} style={{ width: `${Math.min(100, p.pct)}%` }} /></div>
                        </>
                      ) : (
                        <div className="paid"><span className="hint">Без окремої ставки — вартість у вкладеннях</span></div>
                      )}

                      <div className="grow"><span>Вкладено</span><b>{money(p.price, p.cur)}</b></div>
                      {(p.units > 1 || p.partsCost > 0) && (
                        <div className="grow" style={{ marginTop: -6 }}>
                          <span className="hint" style={{ fontSize: 11.5 }}>
                            {p.units > 1 ? `${money(p.unitPrice, p.cur)} × ${p.units}` : money(p.unitPrice, p.cur)}
                            {p.partsCost > 0 ? ` + комплект ${money(p.partsCost, p.cur)}` : ""}
                          </span>
                        </div>
                      )}
                      {billable && (
                        <>
                          <div className="grow">
                            <span>Зароблено</span>
                            <b>{money(p.earnedSame, p.cur)}{p.earnedOther ? ` + ${money(p.earnedOther, p.other)}` : ""}</b>
                          </div>
                          <div className="grow"><span>Здавалось</span><b>{p.uses}× · {p.unitsRented} од.</b></div>
                        </>
                      )}
                      {(g.parts ?? []).filter((x) => x.name.trim()).length > 0 && (
                        <div className="hint" style={{ fontSize: 11.5, lineHeight: 1.35 }}>
                          У комплекті: {(g.parts ?? []).filter((x) => x.name.trim()).map((x) => (x.qty > 1 ? `${x.name} ×${x.qty}` : x.name)).join(", ")}
                        </div>
                      )}
                      {(g.needs ?? []).length > 0 && (
                        <div className="hint" style={{ fontSize: 11.5, lineHeight: 1.35 }}>
                          Комутація: {(g.needs ?? []).map((n) => {
                            const l = gear.find((x) => x.id === n.gearId);
                            return l ? (n.qty > 1 ? `${l.name} ×${n.qty}` : l.name) : null;
                          }).filter(Boolean).join(", ")}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
