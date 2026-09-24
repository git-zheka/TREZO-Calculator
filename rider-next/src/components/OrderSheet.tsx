"use client";

import { useEffect, useState } from "react";
import type { Client, Currency, Gear, Order, OrderItem, Role } from "@/lib/types";
import { KIND_LABEL, STATUS_LABEL, isBillable, normalizeCategory } from "@/lib/types";
import { lineTotal, orderDates, orderTotal, withDates } from "@/lib/calc";
import { CUR, addDays, daysBetween, daysWord, fmtDate, nextDay, num } from "@/lib/format";
import NumberField from "./NumberField";

const defaultRate = (g: Gear, cur: Currency) => Number(cur === "USD" ? g.rateUsd : g.rateUah) || 0;

export default function OrderSheet({
  draft,
  gear,
  clients,
  roles,
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
  roles: Role[];
  exists: boolean;
  pending: boolean;
  onChange: (o: Order) => void;
  onClose: () => void;
  onSave: (o: Order) => void;
  onDelete: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Order>(k: K, v: Order[K]) => onChange({ ...draft, [k]: v });

  const dates = orderDates(draft);
  const extra = dates.length > 1;

  /**
   * Зміна набору днів переставляє «Днів» у позиціях техніки: взяв екран ще на добу —
   * сума має вирости сама. Власна робота лишається одним днем: гонорар за виступ
   * не множиться на те, скільки днів у замовника стоїть апаратура.
   */
  const setDates = (list: string[]) => {
    const next = withDates(draft, list);
    const days = orderDates(next).length;
    onChange({ ...next, items: next.items.map((it) => (it.type === "gear" ? { ...it, days } : it)) });
  };

  /** Зсув першого дня тягне за собою решту, щоб діапазон не розривався. */
  const setStart = (d: string) => {
    if (!d) return;
    if (dates.length <= 1) return setDates([d]);
    const shift = daysBetween(dates[0], d);
    setDates(dates.map((x) => addDays(x, shift)));
  };

  /** Кінцева дата заповнює проміжок днями поспіль; порожня — лишає один день. */
  const setEnd = (d: string) => {
    const start = dates[0];
    if (!start) return;
    if (!d || d <= start) return setDates([start]);
    const list: string[] = [];
    for (let cur = start; cur <= d; cur = nextDay(cur)) list.push(cur);
    setDates(list);
  };

  /** Постійні першими, решта за абеткою. Список короткий — тож чіпи, а не datalist:
   *  datalist на мобільних браузерах або не відкривається, або ховається за клавіатурою. */
  const pickable = [...clients].sort(
    (a, b) => Number(b.regular) - Number(a.regular) || a.name.localeCompare(b.name, "uk"),
  );

  /** Набране руками ім'я, що збігається із заведеним, чіпляється до тієї ж картки —
   *  інакше в аналітиці зʼявився б другий рядок із тим самим замовником. */
  const pickId = (name: string) =>
    clients.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())?.id ?? null;

  const setCurrency = (cur: Currency) => {
    // Зміна валюти переставляє дефолтні ставки — індивідуальні ціни довелося б
    // переводити за курсом, а курс тут не наше діло.
    const items = draft.items.map((it) => {
      if (it.type === "gear") {
        const g = gear.find((x) => x.id === it.equipmentId);
        return g ? { ...it, price: defaultRate(g, cur) } : it;
      }
      const r = it.roleId ? roles.find((x) => x.id === it.roleId) : null;
      return r ? { ...it, price: Number(cur === "USD" ? r.rateUsd : r.rateUah) || 0 } : it;
    });
    onChange({ ...draft, currency: cur, items });
  };

  const lineFor = (g: Gear, via: string | null, qty = 1) => ({
    type: "gear" as const,
    equipmentId: g.id,
    name: g.name,
    qty,
    days: dates.length,
    price: defaultRate(g, draft.currency),
    // Копія на момент замовлення: якщо комплект колись зміниться, старі замовлення лишаться як були.
    parts: (g.parts ?? []).filter((x) => x.name.trim()).map((x) => ({ name: x.name, qty: x.qty })),
    via,
  });

  const toggleGear = (g: Gear) => {
    const has = draft.items.some((it) => it.equipmentId === g.id);
    if (has) {
      // Знімаємо позицію разом із її комутацією — але тільки тією,
      // якої не потребує жодна інша позиція, що лишається в замовленні.
      const staying = draft.items.filter((it) => it.equipmentId !== g.id && !it.via);
      const stillNeeded = new Set(
        staying.flatMap((it) => {
          const owner = gear.find((x) => x.id === it.equipmentId);
          return (owner?.needs ?? []).map((n) => n.gearId);
        }),
      );
      onChange({
        ...draft,
        items: draft.items.filter(
          (it) => it.equipmentId !== g.id && (!it.via || it.via !== g.id || stillNeeded.has(it.equipmentId ?? "")),
        ),
      });
      return;
    }
    const items = [...draft.items, lineFor(g, null)];
    for (const n of g.needs ?? []) {
      if (items.some((it) => it.equipmentId === n.gearId)) continue;
      const linked = gear.find((x) => x.id === n.gearId);
      if (linked) items.push(lineFor(linked, g.id, Number(n.qty) || 1));
    }
    onChange({ ...draft, items });
  };

  /**
   * Комутація і стійки в списку вибору не показуються: вони підставляються самі
   * до позиції, з якою повʼязані. Кнопка відкриває їх, коли кабель треба дати
   * окремо — без прив'язки до чогось.
   */
  const live = gear.filter((g) => g.status !== "sold");
  const pickableGear = live.filter((g) => showAll || isBillable(normalizeCategory(g.category)));
  const hiddenCount = live.length - live.filter((g) => isBillable(normalizeCategory(g.category))).length;

  const roleRate = (r: Role, cur: Currency) => Number(cur === "USD" ? r.rateUsd : r.rateUah) || 0;

  /** Роль — перемикач: другий тап знімає її з замовлення. */
  const toggleRole = (r: Role) => {
    const has = draft.items.some((it) => it.roleId === r.id);
    onChange({
      ...draft,
      items: has
        ? draft.items.filter((it) => it.roleId !== r.id)
        : [...draft.items, { type: "service" as const, roleId: r.id, name: r.name, qty: 1, price: roleRate(r, draft.currency) }],
    });
  };

  const addService = (name: string) =>
    onChange({ ...draft, items: [...draft.items, { type: "service", roleId: null, name, qty: 1, price: 0 }] });

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
              <input className="i" type="date" value={dates[0] ?? ""} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="f">
              <span>По (якщо кілька днів)</span>
              <input className="i" type="date" min={dates[0] || undefined} value={dates.length > 1 ? dates[dates.length - 1] : ""} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <label className="f">
              <span>Замовник</span>
              <input
                className="i"
                value={draft.clientName}
                placeholder="Клуб, агенція, ім'я"
                onChange={(e) => onChange({ ...draft, clientName: e.target.value, clientId: pickId(e.target.value) })}
              />
            </label>
            <label className="f">
              <span>Статус</span>
              <select className="i" value={draft.status} onChange={(e) => set("status", e.target.value as Order["status"])}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          {pickable.length > 0 && (
            <div className="chips">
              {pickable.map((c) => {
                const on = draft.clientName.trim().toLowerCase() === c.name.trim().toLowerCase();
                return (
                  <button
                    key={c.id}
                    className="chip"
                    data-on={on ? "1" : "0"}
                    onClick={() => onChange(on
                      ? { ...draft, clientName: "", clientId: null }
                      : { ...draft, clientName: c.name, clientId: c.id })}
                  >
                    {c.regular && <span className="mono" style={{ fontSize: 11, opacity: .7 }}>★</span>}
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {(dates.length > 1 || extra) && (
            <div className="datechips">
              {dates.map((d) => (
                <span key={d} className="datechip">
                  {fmtDate(d)}
                  {dates.length > 1 && (
                    <button aria-label={`Прибрати ${fmtDate(d)}`} onClick={() => setDates(dates.filter((x) => x !== d))}>✕</button>
                  )}
                </span>
              ))}
              <span className="hint">{daysWord(dates.length)} · техніка зайнята на кожен із них</span>
            </div>
          )}

          <label className="f">
            <span>Додати окремий день</span>
            <input
              className="i"
              type="date"
              value=""
              onChange={(e) => { if (e.target.value) setDates([...dates, e.target.value]); }}
            />
            <em className="hint" style={{ fontStyle: "normal" }}>
              Для дат не поспіль: вихідні через тиждень, два різні заходи в одного замовника.
            </em>
          </label>

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
              <NumberField className="i" value={draft.expenses} onChange={(n) => set("expenses", n)} />
            </label>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>
              Обладнання
              {hiddenCount > 0 && (
                <button className="linkbtn" onClick={() => setShowAll(!showAll)}>
                  {showAll ? "сховати комутацію" : `показати комутацію (${hiddenCount})`}
                </button>
              )}
            </div>
            <div className="chips">
              {pickableGear.length === 0 && (
                <span className="hint">Карток ще немає — додай їх у вкладці «Обладнання».</span>
              )}
              {pickableGear.map((g) => (
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
              {roles.map((r) => (
                <button
                  key={r.id}
                  className="chip svc"
                  data-on={draft.items.some((it) => it.roleId === r.id) ? "1" : "0"}
                  onClick={() => toggleRole(r)}
                >
                  {r.name}
                  {roleRate(r, draft.currency) > 0 && (
                    <span className="mono" style={{ fontSize: 11, opacity: .7 }}>{num(roleRate(r, draft.currency))}</span>
                  )}
                </button>
              ))}
              <button className="chip svc" onClick={() => addService("Інша послуга")}>＋ Разова послуга</button>
            </div>
            {roles.length === 0 && (
              <p className="hint" style={{ margin: "6px 0 0" }}>
                Ролі (монтаж, звукооператор, DJ) додаються у вкладці «Аналітика» — після цього вони будуть тут кнопками.
              </p>
            )}
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Позиції замовлення</div>
            <div className="lines">
              {draft.items.length > 0 && (
                <div className={`line lines-head${extra ? " withdays" : ""}`}>
                  <div>Позиція</div>
                  <div>К-сть</div>
                  {extra && <div>Днів</div>}
                  <div>Ціна/день</div>
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
                  <div className={`line${over ? " over" : ""}${extra ? " withdays" : ""}`} key={`${it.equipmentId ?? it.name}-${i}`}>
                    <div className="ln">
                      {it.name}
                      <em className={over ? "warn" : undefined}>
                        {it.type === "service"
                          ? "послуга"
                          : over
                            ? `у тебе лише ${owned} шт`
                            : it.via
                              ? `комутація до «${gear.find((x) => x.id === it.via)?.name ?? "…"}» · ${owned} шт у парку`
                              : `${owned} шт у парку · ${custom ? `своя ціна, дефолт ${num(def!)}` : def ? "дефолтна ціна" : "ціна не задана"}`}
                      </em>
                    </div>
                    <NumberField value={it.qty} ariaLabel="Кількість" placeholder="1" onChange={(n) => patchItem(i, { qty: n })} />
                    {extra && (
                      <NumberField
                        value={Number(it.days) || 1}
                        placeholder="1"
                        ariaLabel="Скільки днів"
                        onChange={(n) => patchItem(i, { days: n || 1 })}
                      />
                    )}
                    <NumberField value={it.price} ariaLabel="Ціна за день" onChange={(n) => patchItem(i, { price: n })} />
                    <div className="amt">{num(lineTotal(it))}</div>
                    <button className="x" aria-label="Прибрати позицію" onClick={() => dropItem(i)}>✕</button>
                    {it.parts && it.parts.length > 0 && (
                      <div className="parts-note">
                        у комплекті: {it.parts.map((x) => (x.qty > 1 ? `${x.name} ×${x.qty}` : x.name)).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="totrow">
                <span className="hint">
                  Разом{draft.expenses ? ` · чистими ${num(total - draft.expenses)} ${CUR[draft.currency]}` : ""}
                  {extra ? ` · техніка рахується за ${daysWord(dates.length)}, власна робота — за один` : ""}
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
