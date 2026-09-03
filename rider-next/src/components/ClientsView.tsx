"use client";

import type { Order } from "@/lib/types";
import { clientStats } from "@/lib/calc";
import { money, num, ordersWord, plural } from "@/lib/format";

const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];

export default function ClientsView({ orders, onNew }: { orders: Order[]; onNew: () => void }) {
  const cs = clientStats(orders);
  if (!cs.length) {
    return (
      <div className="empty">
        <h3>Замовників поки немає</h3>
        <p>Вони зʼявляться самі, щойно ти створиш замовлення й впишеш, від кого воно.</p>
        <button className="btn primary" onClick={onNew}>Створити замовлення</button>
      </div>
    );
  }

  const totalOrders = cs.reduce((s, c) => s + c.orders, 0);
  const totals = { UAH: cs.reduce((s, c) => s + c.UAH, 0), USD: cs.reduce((s, c) => s + c.USD, 0) };
  // Порядок за доходом; долар зважений грубо, лише щоб відсортувати рядки
  const byRev = [...cs].sort((a, b) => b.UAH + b.USD * 40 - (a.UAH + a.USD * 40));
  const top = byRev[0];
  const topShare = totalOrders ? Math.round((top.orders / totalOrders) * 100) : 0;
  const stale = cs.filter((c) => c.idleDays != null && c.idleDays > 90);

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="k">Замовників</div>
          <div className="v num">{cs.length}</div>
          <div className="d">{ordersWord(totalOrders)} усього</div>
        </div>
        <div className="tile">
          <div className="k">Найбільший</div>
          <div className="v" style={{ fontSize: 17 }}>{top.name}</div>
          <div className="d">{topShare}% усіх замовлень</div>
        </div>
        <div className="tile">
          <div className="k">Затихли</div>
          <div className="v num">{stale.length}</div>
          <div className="d">{stale.length ? "без замовлень понад 3 міс" : "усі активні за 3 міс"}</div>
        </div>
      </div>

      {topShare >= 50 && (
        <div className="panel" style={{ borderColor: "color-mix(in srgb, var(--warn) 45%, transparent)" }}>
          <div className="rowflex">
            <span className="pill" style={{ color: "var(--warn)", borderColor: "var(--warn)" }}>Концентрація</span>
            <span style={{ fontSize: 13.5 }}>
              На <b>{top.name}</b> припадає {topShare}% замовлень. Якщо цей канал зупиниться, зупиниться більша частина роботи.
            </span>
          </div>
        </div>
      )}

      <h2 className="sec">Хто дає роботу</h2>
      <p className="sec-sub">Частка рахується від усіх замовлень; дохід — тільки з виконаних</p>

      <div className="panel flush">
        <div className="tbl-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Замовник</th>
                <th style={{ width: 190 }}>Частка замовлень</th>
                <th className="n">Замовлень</th>
                <th className="n">Дохід ₴</th>
                <th className="n">Дохід $</th>
                <th className="n">Останнє</th>
              </tr>
            </thead>
            <tbody>
              {byRev.map((c, i) => {
                const share = totalOrders ? (c.orders / totalOrders) * 100 : 0;
                return (
                  <tr key={c.key}>
                    <td><b>{c.name}</b></td>
                    <td>
                      <div className="share">
                        <div className="track"><i style={{ width: `${share.toFixed(1)}%`, background: SERIES[Math.min(i, 4)] }} /></div>
                        <span className="mono num" style={{ fontSize: 12 }}>{share.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="n">{c.orders}</td>
                    <td className="n">{c.UAH ? num(c.UAH) : "—"}</td>
                    <td className="n">{c.USD ? num(c.USD) : "—"}</td>
                    <td className="n" style={{ color: (c.idleDays ?? 0) > 90 ? "var(--warn)" : "var(--ink-2)" }}>
                      {c.idleDays == null ? "—" : `${c.idleDays} ${plural(c.idleDays, "день", "дні", "днів")} тому`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="hint">Разом: {money(totals.UAH, "UAH")} · {money(totals.USD, "USD")}</p>
    </>
  );
}
