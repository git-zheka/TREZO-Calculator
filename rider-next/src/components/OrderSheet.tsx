"use client";

import { useEffect } from "react";
import type { Client, Currency, Gear, Order, OrderItem } from "@/lib/types";
import { KIND_LABEL, STATUS_LABEL } from "@/lib/types";
import { orderTotal } from "@/lib/calc";
import { CUR, num } from "@/lib/format";

const defaultRate = (g: Gear, cur: Currency) => Number(cur === "USD" ? g.rateUsd : g.rateUah) || 0;

export default function OrderSheet({
  draft,
  gear,
  clients,
  exists,
  pending,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Order;
  gear: Gear[];
  clients: Client[];
  exists: boolean;
  pending: boolean;
  onChange: (o: Order) => void;
  onClose: () => void;
  onSave: (o: Order) => void;
  onDelete: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Order>(k: K, v: Order[K]) => onChange({ ...draft, [k]: v });

  const setCurrency = (cur: Currency) => {
    // Зміна валюти переставляє дефолтні ставки — індивідуальні ціни довелося б
    // переводити за курсом, а курс тут не наше діло.
    const items = draft.items.map((it) => {
      if (it.type !== "gear") return it;
      const g = gear.find((x) => x.id === it.equipmentId);
      return g ? { ...it, price: defaultRate(g, cur) } : it;
    });
    onChange({ ...draft, currency: cur, items });
  };

  const toggleGear = (g: Gear) => {
    const at = draft.items.findIndex((it) => it.equipmentId === g.id);
    const items = [...draft.items];
    if (at >= 0) items.splice(at, 1);
    else items.push({ type: "gear", equipmentId: g.id, name: g.name, qty: 1, price: defaultRate(g, draft.currency) });
    onChange({ ...draft, items });
  };

  const addService = (name: string) =>
    onChange({ ...draft, items: [...draft.items, { type: "service", name, qty: 1, price: 0 }] });

  const patchItem = (i: number, patch: Partial<OrderItem>) => {
    const items = draft.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    onChange({ ...draft, items });
  };

  const dropItem = (i: number) => onChange({ ...draft, items: draft.items.filter((_, idx) => idx !== i) });

  const total = orderTotal(draft);

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Замовлення">
        <header>
          <h3>{exists ? "Замовлення" : "Нове замовлення"}</h3>
          <div className="rowflex">
            {exists && <button className="btn danger sm" disabled={pending} onClick={() => onDelete(draft.id)}>Видалити</button>}
            <button className="btn ghost sm" onClick={onClose}>Закрити</button>
          </div>
        </header>

        <div className="body">
          <div className="fgrid">
            <label className="f">
              <span>Дата</span>
              <input className="i" type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
            </label>
            <label className="f">
              <span>Замовник</span>
              <input className="i" list="clientNames" value={draft.clientName} placeholder="Клуб, агенція, ім'я" onChange={(e) => set("clientName", e.target.value)} />
              <datalist id="clientNames">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </label>
            <label className="f">
              <span>Статус</span>
              <select className="i" value={draft.status} onChange={(e) => set("status", e.target.value as Order["status"])}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          <label className="f">
            <span>Що робимо</span>
            <input className="i" value={draft.title} placeholder="Напр. вечірка в Atlas, весілля, відкриття шоуруму" onChange={(e) => set("title", e.target.value)} />
          </label>

          <div className="fgrid">
            <label className="f">
              <span>Тип</span>
              <select className="i" value={draft.kind} onChange={(e) => set("kind", e.target.value as Order["kind"])}>
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="f">
              <span>Валюта</span>
              <select className="i" value={draft.currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="UAH">₴ Гривня</option>
                <option value="USD">$ Долар</option>
              </select>
            </label>
            <label className="f">
              <span>Витрати (дорога, помічник)</span>
              <input className="i" type="number" min={0} step={1} value={draft.expenses} onChange={(e) => set("expenses", Number(e.target.value) || 0)} />
            </label>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Обладнання</div>
            <div className="chips">
              {gear.filter((g) => g.status !== "sold").length === 0 && (
                <span className="hint">Карток ще немає — додай їх у вкладці «Обладнання».</span>
              )}
              {gear.filter((g) => g.status !== "sold").map((g) => (
                <button
                  key={g.id}
                  className="chip"
                  data-on={draft.items.some((it) => it.equipmentId === g.id) ? "1" : "0"}
                  onClick={() => toggleGear(g)}
                >
                  {g.name}
                  {(Number(g.qty) || 1) > 1 && (
                    <span className="mono" style={{ fontSize: 11, opacity: .55 }}>×{g.qty}</span>
                  )}
                  <span className="mono" style={{ fontSize: 11, opacity: .7 }}>{num(defaultRate(g, draft.currency))}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Моя робота</div>
            <div className="chips">
              <button className="chip svc" onClick={() => addService("Виступ")}>＋ Виступ</button>
              <button className="chip svc" onClick={() => addService("Доставка і монтаж")}>＋ Доставка / монтаж</button>
              <button className="chip svc" onClick={() => addService("Інша послуга")}>＋ Інша послуга</button>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Позиції замовлення</div>
            <div className="lines">
              {draft.items.length > 0 && (
                <div className="line lines-head">
                  <div>Позиція</div>
                  <div>К-сть</div>
                  <div>Ціна за 1</div>
                  <div>Сума</div>
                  <div />
                </div>
              )}
              {draft.items.length === 0 && (
                <div className="empty-lines">Обери обладнання вище — позиції зʼявляться тут з дефолтною ціною, яку можна змінити.</div>
              )}
              {draft.items.map((it, i) => {
                const g = it.type === "gear" ? gear.find((x) => x.id === it.equipmentId) : undefined;
                const def = g ? defaultRate(g, draft.currency) : null;
                const custom = def != null && def > 0 && Number(it.price) !== def;
                const owned = g ? Number(g.qty) || 1 : null;
                // Попереджаємо, але не блокуємо: одиницю можна дібрати в колеги.
                const over = owned != null && Number(it.qty) > owned;
                return (
                  <div className={`line${over ? " over" : ""}`} key={`${it.equipmentId ?? it.name}-${i}`}>
                    <div className="ln">
                      {it.name}
                      <em className={over ? "warn" : undefined}>
                        {it.type === "service"
                          ? "послуга"
                          : over
                            ? `у тебе лише ${owned} шт`
                            : `${owned} шт у парку · ${custom ? `своя ціна, дефолт ${num(def!)}` : def ? "дефолтна ціна" : "ціна не задана"}`}
                      </em>
                    </div>
                    <input type="number" min={1} step={1} value={it.qty} aria-label="Кількість" onChange={(e) => patchItem(i, { qty: Number(e.target.value) || 0 })} />
                    <input type="number" min={0} step={1} value={it.price} aria-label="Ціна" onChange={(e) => patchItem(i, { price: Number(e.target.value) || 0 })} />
                    <div className="amt">{num((Number(it.qty) || 0) * (Number(it.price) || 0))}</div>
                    <button className="x" aria-label="Прибрати позицію" onClick={() => dropItem(i)}>✕</button>
                  </div>
                );
              })}
              <div className="totrow">
                <span className="hint">
                  Разом{draft.expenses ? ` · чистими ${num(total - draft.expenses)} ${CUR[draft.currency]}` : ""}
                </span>
                <span className="tv num">{num(total)} {CUR[draft.currency]}</span>
              </div>
            </div>
          </div>

          <label className="f">
            <span>Нотатки</span>
            <textarea className="i" value={draft.notes} placeholder="Час, адреса, з ким домовлявся" onChange={(e) => set("notes", e.target.value)} />
          </label>
        </div>

        <footer>
          <span className="hint">Окупність рахується лише зі статусу «Виконано»</span>
          <div className="rowflex">
            <button className="btn ghost" onClick={onClose}>Скасувати</button>
            <button className="btn primary" disabled={pending} onClick={() => onSave(draft)}>
              {pending ? "Зберігаю…" : "Зберегти"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
