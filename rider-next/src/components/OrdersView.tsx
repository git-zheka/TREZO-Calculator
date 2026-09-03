"use client";

import type { Order } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { counted, orderTotal } from "@/lib/calc";
import { MONTHS, daysBetween, fmtDate, money, num, ordersWord, plural, today } from "@/lib/format";

export default function OrdersView({
  orders,
  onOpen,
  onNew,
}: {
  orders: Order[];
  onOpen: (id: string) => void;
  onNew: () => void;
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

  const sorted = [...orders].sort((a, b) => b.date.localeCompare(a.date));
  const t = today();
  const upcoming = sorted.filter((o) => o.date >= t && o.status !== "cancelled" && o.status !== "done");
  const doneOrders = orders.filter(counted);
  const year = new Date().getFullYear();
  const yearDone = doneOrders.filter((o) => new Date(o.date).getFullYear() === year);
  const sum = (c: "UAH" | "USD") => yearDone.filter((o) => o.currency === c).reduce((s, o) => s + orderTotal(o), 0);
  const countIn = (c: "UAH" | "USD") => yearDone.filter((o) => o.currency === c).length;
  const lastDone = [...doneOrders].sort((a, b) => b.date.localeCompare(a.date))[0];
  const idle = lastDone ? daysBetween(lastDone.date, t) : null;
  const soonest = [...upcoming].sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="k">Дохід {year}, ₴</div>
          <div className="v num">{num(sum("UAH"))} <small>₴</small></div>
          <div className="d">за {ordersWord(countIn("UAH"))}</div>
        </div>
        <div className="tile">
          <div className="k">Дохід {year}, $</div>
          <div className="v num">{num(sum("USD"))} <small>$</small></div>
          <div className="d">за {ordersWord(countIn("USD"))}</div>
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
            const d = new Date(o.date);
            const gearCount = o.items.filter((i) => i.type === "gear").reduce((s, i) => s + (Number(i.qty) || 0), 0);
            const svc = o.items.filter((i) => i.type === "service").length;
            return (
              <button key={o.id} className="orow" onClick={() => onOpen(o.id)}>
                <div className="odate"><b>{d.getDate()}</b>{MONTHS[d.getMonth()]} {String(d.getFullYear()).slice(2)}</div>
                <div>
                  <div className="otitle">{o.title || "Без назви"}</div>
                  <div className="ometa">
                    <span>{o.clientName || "—"}</span>
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
                <div className="osum">{money(orderTotal(o), o.currency)}</div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
