"use client";

import type { Order } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { counted, orderDates, orderNet, orderTotal } from "@/lib/calc";
import { CUR, MONTHS, daysBetween, fmtDate, fmtDates, money, num, ordersWord, plural, today } from "@/lib/format";

export default function OrdersView({
  orders,
  onOpen,
  onNew,
}: {
  orders: Order[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const year = new Date().getFullYear();
  if (!orders.length) {
    return (
      <div className="empty">
        <h3>Ще жодного замовлення</h3>
        <p>Натисни «＋ Замовлення», обери картки обладнання — сума порахується сама.</p>
        <button className="btn primary" onClick={onNew}>Створити перше замовлення</button>
      </div>
    );
  }

  const sorted = [...orders].sort((a, b) => b.date.localeCompare(a.date));
  const t = today();
  // Багатоденне замовлення триває, доки не минув ОСТАННІЙ його день:
  // оренда з пʼятниці по неділю в суботу ще попереду, а не позаду.
  const lastDay = (o: Order) => orderDates(o).slice(-1)[0] ?? o.date;
  const upcoming = sorted.filter((o) => lastDay(o) >= t && o.status !== "cancelled" && o.status !== "done");
  const doneOrders = orders.filter(counted);
  const inYear = (o: Order) => new Date(o.date).getFullYear() === year;
  const yearDone = doneOrders.filter(inYear);
  // Підтверджене, але ще не виконане: саме тут лежить робота, розписана наперед.
  const yearPlanned = orders.filter((o) => o.status === "confirmed" && inYear(o));
  // Головна цифра — чисті: оборот мінус витрати на виїзд. Оборот лишається поруч.
  const net = (c: "UAH" | "USD") => yearDone.filter((o) => o.currency === c).reduce((s, o) => s + orderNet(o), 0);
  const sum = (c: "UAH" | "USD") => yearDone.filter((o) => o.currency === c).reduce((s, o) => s + orderTotal(o), 0);
  const spent = (c: "UAH" | "USD") => sum(c) - net(c);
  const countIn = (c: "UAH" | "USD") => yearDone.filter((o) => o.currency === c).length;
  const planSum = (c: "UAH" | "USD") => yearPlanned.filter((o) => o.currency === c).reduce((s, o) => s + orderNet(o), 0);
  const planCount = (c: "UAH" | "USD") => yearPlanned.filter((o) => o.currency === c).length;
  const lastDone = [...doneOrders].sort((a, b) => b.date.localeCompare(a.date))[0];
  const idle = lastDone ? daysBetween(lastDone.date, t) : null;
  const soonest = [...upcoming].sort((a, b) => a.date.localeCompare(b.date))[0];
  // Дата минула, а статус лишився «Підтверджено» — саме через це гроші не потрапляють у дохід.
  const overdue = orders.filter((o) => o.status === "confirmed" && lastDay(o) < t);

  return (
    <>
      <div className="tiles">
        {(["UAH", "USD"] as const).map((c) => (
          <div className="tile" key={c}>
            <div className="k">Чистими {year}, {CUR[c]}</div>
            <div className="v num">
              {num(net(c))} <small>{CUR[c]}</small>
              {sum(c) !== net(c) && <span className="gross">оборот {num(sum(c))}</span>}
            </div>
            <div className="d">
              за {ordersWord(countIn(c))}
              {spent(c) ? ` · витрат ${num(spent(c))} ${CUR[c]}` : ""}
              {planSum(c) ? <><br /><b>+ {num(planSum(c))} {CUR[c]}</b> заплановано за {ordersWord(planCount(c))}</> : null}
            </div>
          </div>
        ))}
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
                ? <>Дохід нульовий, бо жодне замовлення ще не позначене <b>«Виконано»</b> — гроші рахуються після того, як робота відбулась. Заплановане видно окремим рядком у плитках вище.</>
                : <>{overdue.length} {plural(overdue.length, "замовлення вже минуло", "замовлення вже минули", "замовлень уже минули")}, а статус досі «Підтверджено» — постав «Виконано», щоб сума потрапила в дохід і в окупність техніки.</>}
            </span>
          </div>
        </div>
      )}

      <div className="sec-head">
        <div>
          <h2 className="sec">Усі замовлення</h2>
          <p className="sec-sub">{orders.length} {plural(orders.length, "запис", "записи", "записів")} · натисни, щоб відкрити</p>
        </div>
        <button className="btn sm" onClick={onNew}>＋ Нове</button>
      </div>

      <div className="panel flush">
        <div className="olist">
          {sorted.map((o) => {
            const days = orderDates(o);
            const d = new Date(days[0] ?? o.date);
            const gearCount = o.items.filter((i) => i.type === "gear").reduce((s, i) => s + (Number(i.qty) || 0), 0);
            const svc = o.items.filter((i) => i.type === "service").length;
            return (
              <button key={o.id} className="orow" onClick={() => onOpen(o.id)}>
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
                    <span className={`pill s-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                  </div>
                </div>
                <div className="osum">
                  {money(orderNet(o), o.currency)}
                  {o.expenses ? <div className="hint mono" style={{ fontWeight: 500 }}>оборот {num(orderTotal(o))}</div> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
