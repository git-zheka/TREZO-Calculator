"use client";

import { useEffect } from "react";
import type { Client, Order } from "@/lib/types";
import { CLIENT_TYPES, normalizeClientType } from "@/lib/types";
import { clientStats } from "@/lib/calc";
import { fmtDate, money, ordersWord, plural } from "@/lib/format";

export default function ClientSheet({
  draft,
  orders,
  allClients,
  exists,
  pending,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Client;
  orders: Order[];
  allClients: Client[];
  exists: boolean;
  pending: boolean;
  onChange: (c: Client) => void;
  onClose: () => void;
  onSave: (c: Client) => void;
  onDelete: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Client>(k: K, v: Client[K]) => onChange({ ...draft, [k]: v });

  const all = clientStats(orders, allClients);
  const mine = all.find((c) => c.key === draft.id);
  const totalOrders = all.reduce((s, c) => s + c.orders, 0);
  const share = totalOrders && mine ? Math.round((mine.orders / totalOrders) * 100) : 0;

  const name = draft.name.trim();
  // Дублікат за іменем зламав би зведення: два рядки з однією назвою і рознесеною статистикою.
  const clash = name
    ? allClients.some((c) => c.id !== draft.id && c.name.trim().toLowerCase() === name.toLowerCase())
    : false;

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Замовник">
        <header>
          <h3>{exists ? "Замовник" : "Новий замовник"}</h3>
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
              placeholder="Напр. Atlas, Wedding Lab, Олег"
              onChange={(e) => set("name", e.target.value)}
            />
            {clash && <em className="warn" style={{ fontSize: 12 }}>Замовник із такою назвою вже є — статистика розділиться на два рядки</em>}
          </label>

          <div className="fgrid">
            <label className="f">
              <span>Тип</span>
              <select className="i" value={normalizeClientType(draft.type)} onChange={(e) => set("type", e.target.value)}>
                {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="f">
              <span>Контакт</span>
              <input
                className="i"
                value={draft.contact}
                placeholder="Телефон, телеграм, пошта"
                onChange={(e) => set("contact", e.target.value)}
              />
            </label>
          </div>

          <button
            type="button"
            className="toggle"
            aria-pressed={draft.regular}
            onClick={() => set("regular", !draft.regular)}
          >
            <span className="box" aria-hidden>{draft.regular ? "✓" : ""}</span>
            <span>
              <b>Постійний замовник</b>
              <em>Стоїть першим у списку при створенні замовлення й угорі в переліку</em>
            </span>
          </button>

          {mine && (
            <div className="panel" style={{ margin: 0 }}>
              {mine.orders === 0 ? (
                <p className="hint" style={{ margin: 0 }}>
                  Замовлень ще не було. Щойно створиш перше з цим замовником — тут зʼявиться частка й дохід.
                </p>
              ) : (
                <>
                  <div className="paid">
                    <span className="pct">{share}%</span>
                    <span className="hint">{ordersWord(mine.orders)} з {totalOrders}</span>
                  </div>
                  <div className="bar" style={{ marginTop: 8 }}>
                    <i style={{ width: `${Math.min(100, share)}%` }} />
                  </div>
                  <div className="grow" style={{ marginTop: 10 }}>
                    <span>Дохід</span>
                    <b>
                      {[mine.UAH ? money(mine.UAH, "UAH") : null, mine.USD ? money(mine.USD, "USD") : null]
                        .filter(Boolean).join(" · ") || "—"}
                    </b>
                  </div>
                  <div className="grow">
                    <span>Виконано</span>
                    <b>{mine.done} з {mine.orders}</b>
                  </div>
                  <div className="grow">
                    <span>Останнє</span>
                    <b>
                      {mine.last
                        ? `${fmtDate(mine.last)}${mine.idleDays != null ? ` · ${mine.idleDays} ${plural(mine.idleDays, "день", "дні", "днів")} тому` : ""}`
                        : "—"}
                    </b>
                  </div>
                </>
              )}
            </div>
          )}

          <label className="f">
            <span>Нотатки</span>
            <textarea
              className="i"
              value={draft.notes}
              placeholder="Хто контактна особа, як платить, особливості майданчика"
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
        </div>

        <footer>
          <span className="hint">
            {exists ? "Видалення прибирає картку, але замовлення й історія лишаються" : "Замовника можна вибрати у формі замовлення"}
          </span>
          <div className="rowflex">
            <button className="btn ghost" onClick={onClose}>Скасувати</button>
            <button
              className="btn primary"
              disabled={pending || !name}
              onClick={() => onSave({ ...draft, name, type: normalizeClientType(draft.type) })}
            >
              {pending ? "Зберігаю…" : "Зберегти"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
