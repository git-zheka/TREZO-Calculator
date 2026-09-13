"use client";

import { useEffect } from "react";
import type { Gear, GearPart, Order, Settings } from "@/lib/types";
import { GEAR_STATUS_LABEL } from "@/lib/types";
import { payback } from "@/lib/calc";
import { fmtDate, money, num } from "@/lib/format";
import NumberField from "./NumberField";

const CATEGORIES = ["Звук", "Світло", "DJ-пульт", "Ефекти", "Кабелі", "Стійки", "Транспорт"];

export default function GearSheet({
  draft,
  orders,
  settings,
  exists,
  pending,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Gear;
  orders: Order[];
  settings: Settings;
  exists: boolean;
  pending: boolean;
  onChange: (g: Gear) => void;
  onClose: () => void;
  onSave: (g: Gear) => void;
  onDelete: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Gear>(k: K, v: Gear[K]) => onChange({ ...draft, [k]: v });
  const p = exists ? payback(orders, draft, settings) : null;

  const parts = draft.parts ?? [];
  const addPart = () => set("parts", [...parts, { name: "", qty: 1, price: 0 }]);
  const patchPart = (i: number, patch: Partial<GearPart>) =>
    set("parts", parts.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const dropPart = (i: number) => set("parts", parts.filter((_, idx) => idx !== i));
  const partsCost = parts.reduce((s, x) => s + (Number(x.price) || 0) * (Number(x.qty) || 1), 0);
  const unitsCost = (Number(draft.purchasePrice) || 0) * (Number(draft.qty) || 1);

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Обладнання">
        <header>
          <h3>{exists ? "Картка обладнання" : "Нова картка"}</h3>
          <div className="rowflex">
            {exists && <button className="btn danger sm" disabled={pending} onClick={() => onDelete(draft.id)}>Видалити</button>}
            <button className="btn ghost sm" onClick={onClose}>Закрити</button>
          </div>
        </header>

        <div className="body">
          <label className="f">
            <span>Назва</span>
            <input className="i" value={draft.name} placeholder="Напр. Колонки RCF ART 912-A" onChange={(e) => set("name", e.target.value)} />
          </label>

          <div className="fgrid">
            <label className="f">
              <span>Категорія</span>
              <input className="i" list="catList" value={draft.category} placeholder="Звук, Світло, DJ-пульт" onChange={(e) => set("category", e.target.value)} />
              <datalist id="catList">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="f">
              <span>Скільки одиниць</span>
              <NumberField className="i" value={draft.qty} placeholder="1" onChange={(n) => set("qty", n || 1)} />
            </label>
            <label className="f">
              <span>Дата покупки</span>
              <input className="i" type="date" value={draft.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} />
            </label>
          </div>

          <div className="fgrid">
            <label className="f">
              <span>Ціна покупки за 1 шт</span>
              <NumberField className="i" value={draft.purchasePrice} onChange={(n) => set("purchasePrice", n)} />
            </label>
            <label className="f">
              <span>Валюта покупки</span>
              <select className="i" value={draft.purchaseCurrency} onChange={(e) => set("purchaseCurrency", e.target.value as Gear["purchaseCurrency"])}>
                <option value="UAH">₴ Гривня</option>
                <option value="USD">$ Долар</option>
              </select>
            </label>
            <label className="f">
              <span>Стан</span>
              <select className="i" value={draft.status} onChange={(e) => set("status", e.target.value as Gear["status"])}>
                {Object.entries(GEAR_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          <div className="fgrid">
            <label className="f">
              <span>Дефолтна ціна оренди, ₴</span>
              <NumberField className="i" value={draft.rateUah} onChange={(n) => set("rateUah", n)} />
            </label>
            <label className="f">
              <span>Дефолтна ціна оренди, $</span>
              <NumberField className="i" value={draft.rateUsd} onChange={(n) => set("rateUsd", n)} />
            </label>
          </div>
          <p className="hint">
            Ці ціни підставляються автоматично, коли додаєш картку в замовлення — у самому замовленні їх завжди можна перебити індивідуальною.
          </p>

          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Комплектація</div>
            <p className="hint" style={{ margin: "0 0 8px" }}>
              Те, що їде разом і окремо не здається: сумка, пульт, кабелі. У сумі замовлення не зʼявляється,
              але вартість входить у вкладення, а список — у нагадування, що взяти.
            </p>
            <div className="lines">
              {parts.length > 0 && (
                <div className="line lines-head">
                  <div>Що входить</div>
                  <div>К-сть</div>
                  <div>Ціна за 1</div>
                  <div>Сума</div>
                  <div />
                </div>
              )}
              {parts.map((x, i) => (
                <div className="line" key={i}>
                  <input
                    className="i"
                    style={{ textAlign: "left", fontFamily: "inherit" }}
                    value={x.name}
                    placeholder="Напр. сумка, пульт DMX"
                    onChange={(e) => patchPart(i, { name: e.target.value })}
                  />
                  <NumberField value={x.qty} placeholder="1" ariaLabel="Кількість" onChange={(n) => patchPart(i, { qty: n || 1 })} />
                  <NumberField value={x.price} ariaLabel="Ціна за одиницю" onChange={(n) => patchPart(i, { price: n })} />
                  <div className="amt">{num((Number(x.qty) || 1) * (Number(x.price) || 0))}</div>
                  <button className="x" aria-label="Прибрати" onClick={() => dropPart(i)}>✕</button>
                </div>
              ))}
              {parts.length === 0 && (
                <div className="empty-lines">Нічого не входить — або ще не додано.</div>
              )}
              <div className="totrow">
                <button className="btn ghost sm" onClick={addPart}>＋ Додати складову</button>
                <span className="hint">
                  {unitsCost || partsCost
                    ? <>Вкладено в позицію: <b>{money(unitsCost + partsCost, draft.purchaseCurrency)}</b>
                        {partsCost ? ` (техніка ${num(unitsCost)} + комплект ${num(partsCost)})` : ""}</>
                    : "Впиши ціну покупки, щоб рахувалась окупність"}
                </span>
              </div>
            </div>
          </div>

          {p && (
            <div className="panel" style={{ margin: 0 }}>
              <div className="paid">
                <span className={`pct${p.pct >= 100 ? " ok" : ""}`}>{p.pct}%</span>
                <span className="hint">{p.pct >= 100 ? "окупилось" : `залишилось ${money(p.left, p.cur)}`}</span>
              </div>
              <div className="bar" style={{ marginTop: 8 }}>
                <i className={p.pct >= 100 ? "full" : ""} style={{ width: `${Math.min(100, p.pct)}%` }} />
              </div>
              <div className="grow" style={{ marginTop: 10 }}>
                <span>Здавалось {p.uses}× · {p.unitsRented} од.</span>
                <span>{p.last ? `востаннє ${fmtDate(p.last)}` : ""}</span>
              </div>
            </div>
          )}

          <label className="f">
            <span>Нотатки</span>
            <textarea className="i" value={draft.notes} placeholder="Серійник, комплектація, що зношується" onChange={(e) => set("notes", e.target.value)} />
          </label>
        </div>

        <footer>
          <span className="hint">{exists ? "Зміни цін не перераховують минулі замовлення" : "Картку можна буде відредагувати будь-коли"}</span>
          <div className="rowflex">
            <button className="btn ghost" onClick={onClose}>Скасувати</button>
            <button className="btn primary" disabled={pending || !draft.name.trim()} onClick={() => onSave(draft)}>
              {pending ? "Зберігаю…" : "Зберегти"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
