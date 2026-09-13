"use client";

import type { Gear, Order, Settings } from "@/lib/types";
import { payback } from "@/lib/calc";
import { money, num, plural, trips } from "@/lib/format";
import RateBlock from "./RateBlock";

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
  if (!gear.length) {
    return (
      <div className="empty">
        <h3>Обладнання ще не додане</h3>
        <p>Створи картку на кожну одиницю: ціна покупки і дефолтна ціна оренди — з цього рахується окупність.</p>
        <button className="btn primary" onClick={onNew}>Додати обладнання</button>
      </div>
    );
  }

  const items = gear.map((g) => ({ g, p: payback(orders, g, settings) })).sort((a, b) => b.p.pct - a.p.pct);
  const paidOff = items.filter((x) => x.p.pct >= 100).length;
  const invested = { UAH: 0, USD: 0 };
  for (const g of gear) {
    invested[g.purchaseCurrency] +=
      (Number(g.purchasePrice) || 0) * (Number(g.qty) || 1) +
      (g.parts ?? []).reduce((s, x) => s + (Number(x.price) || 0) * (Number(x.qty) || 1), 0);
  }
  const totalUnits = gear.reduce((s, g) => s + (Number(g.qty) || 1), 0);

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="k">Одиниць у парку</div>
          <div className="v num">{totalUnits}</div>
          <div className="d">{gear.length} {plural(gear.length, "позиція", "позиції", "позицій")} · {paidOff} {plural(paidOff, "окупилась", "окупились", "окупились")}</div>
        </div>
        <div className="tile">
          <div className="k">Вкладено, ₴</div>
          <div className="v num">{num(invested.UAH)} <small>₴</small></div>
          <div className="d">за цінами покупки</div>
        </div>
        <div className="tile">
          <div className="k">Вкладено, $</div>
          <div className="v num">{num(invested.USD)} <small>$</small></div>
          <div className="d">за цінами покупки</div>
        </div>
      </div>

      <RateBlock settings={settings} />

      <div className="sec-head">
        <div>
          <h2 className="sec">Парк обладнання</h2>
          <p className="sec-sub">Окупність рахується тільки з виконаних замовлень, у валюті покупки</p>
        </div>
        <button className="btn sm" onClick={onNew}>＋ Картка</button>
      </div>

      <div className="gear-grid">
        {items.map(({ g, p }) => {
          const full = p.pct >= 100;
          return (
            <button key={g.id} className="gear" onClick={() => onOpen(g.id)}>
              <div>
                <div className="gcat">{g.category || "без категорії"}{g.qty > 1 ? ` · ${g.qty} шт` : ""}</div>
                <div className="gname">{g.name}</div>
              </div>
              <div className="paid">
                <span className={`pct${full ? " ok" : ""}`}>{p.pct}%</span>
                <span className="hint">
                  {full ? "окупилось" : p.usesLeft != null ? `ще ~${trips(p.usesLeft)}` : p.uses ? "заробіток в іншій валюті" : "ще не здавалось"}
                </span>
              </div>
              <div className="bar"><i className={full ? "full" : ""} style={{ width: `${Math.min(100, p.pct)}%` }} /></div>
              <div className="grow">
                <span>Вкладено</span>
                <b>{money(p.price, p.cur)}</b>
              </div>
              {(p.units > 1 || p.partsCost > 0) && (
                <div className="grow" style={{ marginTop: -6, fontSize: 12 }}>
                  <span className="hint">
                    {p.units > 1 ? `${money(p.unitPrice, p.cur)} × ${p.units}` : money(p.unitPrice, p.cur)}
                    {p.partsCost > 0 ? ` + комплект ${money(p.partsCost, p.cur)}` : ""}
                  </span>
                </div>
              )}
              {(g.parts ?? []).filter((x) => x.name.trim()).length > 0 && (
                <div className="hint" style={{ fontSize: 11.5, lineHeight: 1.35 }}>
                  У комплекті: {(g.parts ?? []).filter((x) => x.name.trim()).map((x) => (x.qty > 1 ? `${x.name} ×${x.qty}` : x.name)).join(", ")}
                </div>
              )}
              <div className="grow">
                <span>Зароблено</span>
                <b>{money(p.earnedSame, p.cur)}{p.earnedOther ? ` + ${money(p.earnedOther, p.other)}` : ""}</b>
              </div>
              <div className="grow"><span>Здавалось</span><b>{p.uses}× · {p.unitsRented} од.</b></div>
            </button>
          );
        })}
      </div>
    </>
  );
}
