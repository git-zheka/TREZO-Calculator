"use client";

import { useEffect } from "react";
import type { Order, Role } from "@/lib/types";
import type { MoneyMode } from "@/lib/calc";
import { roleStats } from "@/lib/calc";
import { fmtDate, money, ordersWord } from "@/lib/format";
import NumberField from "./NumberField";

export default function RoleSheet({
  draft,
  orders,
  allRoles,
  mode,
  exists,
  pending,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Role;
  orders: Order[];
  allRoles: Role[];
  mode: MoneyMode;
  exists: boolean;
  pending: boolean;
  onChange: (r: Role) => void;
  onClose: () => void;
  onSave: (r: Role) => void;
  onDelete: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Role>(k: K, v: Role[K]) => onChange({ ...draft, [k]: v });

  const mine = roleStats(orders, allRoles, mode).find((r) => r.key === draft.id);
  const name = draft.name.trim();

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Роль">
        <header>
          <h3>{exists ? "Роль" : "Нова роль"}</h3>
          <div className="rowflex">
            {exists && <button className="btn danger sm" disabled={pending} onClick={() => onDelete(draft.id)}>Видалити</button>}
            <button className="btn ghost sm" onClick={onClose}>Закрити</button>
          </div>
        </header>

        <div className="body">
          <label className="f">
            <span>Назва</span>
            <input
              className="i"
              value={draft.name}
              placeholder="Напр. Монтаж / демонтаж, Звукооператор, DJ"
              onChange={(e) => set("name", e.target.value)}
            />
          </label>

          <div className="fgrid">
            <label className="f">
              <span>Дефолтний гонорар, ₴</span>
              <NumberField className="i" value={draft.rateUah} onChange={(n) => set("rateUah", n)} />
            </label>
            <label className="f">
              <span>Дефолтний гонорар, $</span>
              <NumberField className="i" value={draft.rateUsd} onChange={(n) => set("rateUsd", n)} />
            </label>
          </div>
          <p className="hint">
            Підставляється, коли додаєш роль у замовлення. Там суму завжди можна перебити —
            минулі замовлення від зміни ставки не перераховуються.
          </p>

          {mine && mine.orders > 0 && (
            <div className="panel" style={{ margin: 0 }}>
              <div className="grow"><span>Замовлень у цій ролі</span><b>{ordersWord(mine.orders)}</b></div>
              <div className="grow">
                <span>Зароблено</span>
                <b>
                  {[mine.UAH ? money(mine.UAH, "UAH") : null, mine.USD ? money(mine.USD, "USD") : null]
                    .filter(Boolean).join(" · ") || "—"}
                </b>
              </div>
              <div className="grow"><span>Востаннє</span><b>{fmtDate(mine.last)}</b></div>
            </div>
          )}
        </div>

        <footer>
          <span className="hint">
            {exists ? "Видалення прибирає роль зі списку — у минулих замовленнях назва лишається" : "Роль зʼявиться у формі замовлення"}
          </span>
          <div className="rowflex">
            <button className="btn ghost" onClick={onClose}>Скасувати</button>
            <button className="btn primary" disabled={pending || !name} onClick={() => onSave({ ...draft, name })}>
              {pending ? "Зберігаю…" : "Зберегти"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
