"use client";

import { useEffect } from "react";
import type { Gear, Order, Settings } from "@/lib/types";
import { GEAR_STATUS_LABEL } from "@/lib/types";
import { payback } from "@/lib/calc";
import { fmtDate, money } from "@/lib/format";

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
              <input className="i" type="number" min={1} step={1} value={draft.qty} onChange={(e) => set("qty", Number(e.target.value) || 1)} />
            </label>
            <label className="f">
              <span>Дата покупки</span>
              <input className="i" type="date" value={draft.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} />
            </label>
          </div>

          <div className="fgrid">
            <label className="f">
              <span>Ціна покупки за 1 шт</span>
              <input className="i" type="number" min={0} step={1} value={draft.purchasePrice} onChange={(e) => set("purchasePrice", Number(e.target.value) || 0)} />
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
              <input className="i" type="number" min={0} step={1} value={draft.rateUah} onChange={(e) => set("rateUah", Number(e.target.value) || 0)} />
            </label>
            <label className="f">
              <span>Дефолтна ціна оренди, $</span>
              <input className="i" type="number" min={0} step={1} value={draft.rateUsd} onChange={(e) => set("rateUsd", Number(e.target.value) || 0)} />
            </label>
          </div>
          {(Number(draft.qty) || 1) > 1 && (Number(draft.purchasePrice) || 0) > 0 && (
            <p className="hint">
              Разом за {draft.qty} шт: <b>{money((Number(draft.purchasePrice) || 0) * (Number(draft.qty) || 1), draft.purchaseCurrency)}</b> — саме проти цієї суми рахується окупність.
            </p>
          )}
          <p className="hint">
            Ці ціни підставляються автоматично, коли додаєш картку в замовлення — у самому замовленні їх завжди можна перебити індивідуальною.
          </p>

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
