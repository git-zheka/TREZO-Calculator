"use client";

import type { Order, OrderStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { counted, orderDates, orderNet, orderTotal } from "@/lib/calc";
import { MONTHS, MONTH_NOM, daysBetween, fmtDate, fmtDates, num, ordersWord, plural, today } from "@/lib/format";

export default function OrdersView({
  orders,
  onOpen,
  onNew,
  onStatus,
}: {
  orders: Order[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onStatus: (id: string, status: OrderStatus) => void;
}) {
  if (!orders.length) {
    return (
      <div className="empty">
        <h3>Ще жодного замовлення</h3>
        <p>Натисни «＋ Замовлення», обери картки обладнання — сума порахується сама.</p>
        <button className="btn primary" onClick={onNew}>Створити перше замовлення</button>
      </div>
    );
  }

  const now = new Date();
  const sorted = [...orders].sort((a, b) => b.date.localeCompare(a.date));
  const t = today();
  // Багатоденне замовлення триває, доки не минув ОСТАННІЙ його день:
  // оренда з пʼятниці по неділю в суботу ще попереду, а не позаду.
  const lastDay = (o: Order) => orderDates(o).slice(-1)[0] ?? o.date;
  const upcoming = sorted.filter((o) => lastDay(o) >= t && o.status !== "cancelled" && o.status !== "done");
  const doneOrders = orders.filter(counted);

  // Головний екран — про поточний місяць: скільки вже є і що ще попереду.
  // Підсумки за весь період живуть в аналітиці.
  const inMonth = (o: Order) => {
    const d = new Date(o.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  const monthDone = doneOrders.filter(inMonth);
  const monthPlanned = orders.filter((o) => o.status === "confirmed" && inMonth(o));

  const net = monthDone.reduce((s, o) => s + orderNet(o), 0);
  const sum = monthDone.reduce((s, o) => s + orderTotal(o), 0);
  const planNet = monthPlanned.reduce((s, o) => s + orderNet(o), 0);

  const lastDone = [...doneOrders].sort((a, b) => b.date.localeCompare(a.date))[0];
  const idle = lastDone ? daysBetween(lastDone.date, t) : null;
  const soonest = [...upcoming].sort((a, b) => a.date.localeCompare(b.date))[0];
  // Дата минула, а статус лишився «Підтверджено» — саме через це гроші не потрапляють у дохід.
  const overdue = orders.filter((o) => o.status === "confirmed" && lastDay(o) < t);

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="k">Чистими · {MONTH_NOM[now.getMonth()].toLowerCase()}</div>
          <div className="v num">
            {num(net)} <small>₴</small>
            {sum !== net && <span className="gross">оборот {num(sum)}</span>}
          </div>
          <div className="d">
            за {ordersWord(monthDone.length)}
            {sum !== net ? ` · витрат ${num(sum - net)} ₴` : ""}
          </div>
        </div>
        <div className="tile">
          <div className="k">Заплановано · {MONTH_NOM[now.getMonth()].toLowerCase()}</div>
          <div className="v num">{num(planNet)} <small>₴</small></div>
          <div className="d">
            {monthPlanned.length ? `${ordersWord(monthPlanned.length)} підтверджено` : "нічого не підтверджено"}
          </div>
        </div>
        <div className="tile">
          <div className="k">Попереду</div>
          <div className="v num">{upcoming.length}</div>
          <div className="d">{soonest ? `найближче — ${fmtDate(soonest.date)}` : "нічого не заплановано"}</div>
        </div>
        <div className="tile">
          <div className="k">Без роботи</div>
          <div className="v num">{idle ?? "—"} <small>{idle == null ? "" : plural(idle, "день", "дні", "днів")}</small></div>
          <div className="d">{lastDone ? `останній виїзд ${fmtDate(lastDone.date)}` : "ще не було виконаних"}</div>
        </div>
      </div>

      {(!doneOrders.length || overdue.length > 0) && (
        <div className="panel" style={{ borderColor: "color-mix(in srgb, var(--warn) 45%, transparent)" }}>
          <div className="rowflex">
            <span className="pill" style={{ color: "var(--warn)", borderColor: "var(--warn)" }}>Статуси</span>
            <span style={{ fontSize: 13.5 }}>
              {!doneOrders.length
                ? <>Дохід нульовий, бо жодне замовлення ще не позначене <b>«Виконано»</b> — гроші рахуються після того, як робота відбулась.</>
                : <>{overdue.length} {plural(overdue.length, "замовлення вже минуло", "замовлення вже минули", "замовлень уже минули")}, а статус досі «Підтверджено» — зміни його прямо в списку, щоб сума потрапила в дохід і в окупність техніки.</>}
            </span>
          </div>
        </div>
      )}

      <div className="sec-head">
        <div>
          <h2 className="sec">Усі замовлення</h2>
          <p className="sec-sub">{orders.length} {plural(orders.length, "запис", "записи", "записів")} · статус міняється прямо тут</p>
        </div>
        <button className="btn sm" onClick={onNew}>＋ Нове</button>
      </div>

      <div className="panel flush">
        <div className="olist">
          {sorted.map((o) => {
            const days = orderDates(o);
            const d = new Date(days[0] ?? o.date);
            const gearCount = o.items.filter((i) => i.type === "gear" && !i.via).reduce((s, i) => s + (Number(i.qty) || 0), 0);
            const svc = o.items.filter((i) => i.type === "service").length;
            const stale = o.status === "confirmed" && lastDay(o) < t;
            return (
              <div className="orow" key={o.id}>
                {/* Рядок — не одна кнопка: інакше селект статусу всередині неї не клікався б */}
                <button className="orow-main" onClick={() => onOpen(o.id)}>
                  <div className="odate"><b>{d.getDate()}</b>{MONTHS[d.getMonth()]} {String(d.getFullYear()).slice(2)}</div>
                  <div>
                    <div className="otitle">{o.title || "Без назви"}</div>
                    <div className="ometa">
                      <span>{o.clientName || "—"}</span>
                      {days.length > 1 && (
                        <>
                          <span className="dotsep">·</span>
                          <span>{fmtDates(days)}</span>
                        </>
                      )}
                      <span className="dotsep">·</span>
                      <span>
                        {gearCount ? `${gearCount} ${plural(gearCount, "одиниця техніки", "одиниці техніки", "одиниць техніки")}` : ""}
                        {gearCount && svc ? " + " : ""}
                        {svc ? `${svc} ${plural(svc, "послуга", "послуги", "послуг")}` : ""}
                        {!gearCount && !svc ? "порожнє" : ""}
                      </span>
                    </div>
                  </div>
                </button>

                <div className="orow-side">
                  <div className="osum">
                    ₴ {num(orderNet(o))}
                    {o.expenses ? <div className="hint mono" style={{ fontWeight: 500 }}>оборот {num(orderTotal(o))}</div> : null}
                  </div>
                  {/* Нативний селект: один тап і системний список — найшвидший шлях на телефоні */}
                  <select
                    className={`statsel s-${o.status}${stale ? " stale" : ""}`}
                    value={o.status}
                    aria-label={`Статус: ${STATUS_LABEL[o.status]}`}
                    onChange={(e) => onStatus(o.id, e.target.value as OrderStatus)}
                  >
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
