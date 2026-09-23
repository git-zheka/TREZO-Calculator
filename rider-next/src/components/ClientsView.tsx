"use client";

import type { Client, Order } from "@/lib/types";
import { normalizeClientType } from "@/lib/types";
import type { MoneyMode } from "@/lib/calc";
import { clientStats } from "@/lib/calc";
import { money, num, ordersWord, plural } from "@/lib/format";
import MoneyModeSwitch from "./MoneyModeSwitch";

const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];

export default function ClientsView({
  orders,
  clients,
  onOpen,
  onNewClient,
  onNewOrder,
  mode,
  onMode,
}: {
  orders: Order[];
  clients: Client[];
  onOpen: (id: string) => void;
  onNewClient: () => void;
  onNewOrder: () => void;
  mode: MoneyMode;
  onMode: (m: MoneyMode) => void;
}) {
  const cs = clientStats(orders, clients, mode);
  const confirmed = orders.filter((o) => o.status === "confirmed").length;

  if (!cs.length) {
    return (
      <div className="empty">
        <h3>Замовників поки немає</h3>
        <p>
          Заведи постійних — агенції, клуби, тих, хто дає роботу регулярно. Вони будуть у списку,
          коли створюєш замовлення. Разові зʼявляться самі, щойно впишеш ім’я в замовленні.
        </p>
        <div className="rowflex" style={{ justifyContent: "center" }}>
          <button className="btn primary" onClick={onNewClient}>Додати замовника</button>
          <button className="btn" onClick={onNewOrder}>Створити замовлення</button>
        </div>
      </div>
    );
  }

  const totalOrders = cs.reduce((s, c) => s + c.orders, 0);
  const totals = { UAH: cs.reduce((s, c) => s + c.UAH, 0), USD: cs.reduce((s, c) => s + c.USD, 0) };
  // Порядок за доходом; долар зважений грубо, лише щоб відсортувати рядки
  const byRev = [...cs].sort((a, b) => b.UAH + b.USD * 40 - (a.UAH + a.USD * 40) || b.orders - a.orders);
  const worked = byRev.filter((c) => c.orders > 0);
  const top = worked[0] ?? byRev[0];
  const topShare = totalOrders && top ? Math.round((top.orders / totalOrders) * 100) : 0;
  const regulars = cs.filter((c) => c.client?.regular);
  const stale = cs.filter((c) => c.idleDays != null && c.idleDays > 90);
  // Рядки без картки — імена, що прийшли лише із замовлень. Їх можна перевести в постійні.
  const loose = byRev.filter((c) => !c.client);

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="k">Замовників</div>
          <div className="v num">{cs.length}</div>
          <div className="d">{regulars.length} {plural(regulars.length, "постійний", "постійних", "постійних")} · {ordersWord(totalOrders)} усього</div>
        </div>
        <div className="tile">
          <div className="k">Найбільший</div>
          <div className="v" style={{ fontSize: 17 }}>{top?.name ?? "—"}</div>
          <div className="d">{topShare}% усіх замовлень</div>
        </div>
        <div className="tile">
          <div className="k">Затихли</div>
          <div className="v num">{stale.length}</div>
          <div className="d">{stale.length ? "без замовлень понад 3 міс" : "усі активні за 3 міс"}</div>
        </div>
      </div>

      {topShare >= 50 && top && (
        <div className="panel" style={{ borderColor: "color-mix(in srgb, var(--warn) 45%, transparent)" }}>
          <div className="rowflex">
            <span className="pill" style={{ color: "var(--warn)", borderColor: "var(--warn)" }}>Концентрація</span>
            <span style={{ fontSize: 13.5 }}>
              На <b>{top.name}</b> припадає {topShare}% замовлень. Якщо цей канал зупиниться, зупиниться більша частина роботи.
            </span>
          </div>
        </div>
      )}

      <div className="sec-head">
        <div>
          <h2 className="sec">Хто дає роботу</h2>
          <p className="sec-sub">
            Частка рахується від усіх замовлень; дохід — {mode === "done" ? "тільки з виконаних" : "з виконаних і підтверджених"}.
            Клік по рядку відкриває картку.
          </p>
        </div>
        <div className="rowflex">
          <MoneyModeSwitch mode={mode} onChange={onMode} confirmed={confirmed} />
          <button className="btn sm" onClick={onNewClient}>＋ Замовник</button>
        </div>
      </div>

      <div className="panel flush">
        <div className="tbl-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Замовник</th>
                <th style={{ width: 180 }}>Частка замовлень</th>
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
                  <tr
                    key={c.key}
                    className={c.client ? "rowlink" : undefined}
                    onClick={c.client ? () => onOpen(c.client!.id) : undefined}
                  >
                    <td>
                      <b>{c.name}</b>
                      <div className="hint" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {c.client?.regular && <span className="pill sm reg">постійний</span>}
                        {c.client ? ` ${normalizeClientType(c.client.type)}` : " без картки"}
                        {c.client?.contact ? ` · ${c.client.contact}` : ""}
                      </div>
                    </td>
                    <td>
                      <div className="share">
                        <div className="track"><i style={{ width: `${share.toFixed(1)}%`, background: SERIES[Math.min(i, 4)] }} /></div>
                        <span className="mono num" style={{ fontSize: 12 }}>{share.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="n">{c.orders || "—"}</td>
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

      <p className="hint">
        Разом: {money(totals.UAH, "UAH")} · {money(totals.USD, "USD")}
        {loose.length > 0 && ` · ${loose.length} ${plural(loose.length, "замовник", "замовники", "замовників")} без картки — заведи картку з тією самою назвою, і рядки зіллються`}
      </p>
    </>
  );
}
