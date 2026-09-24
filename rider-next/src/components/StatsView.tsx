"use client";

import { useState } from "react";
import type { Currency, Gear, Order, Role, Settings } from "@/lib/types";
import type { MoneyMode } from "@/lib/calc";
import { gearRevenue, inMode, monthlySeries, orderTotal, payback, roleStats } from "@/lib/calc";
import { CUR, MONTHS, MONTHS_FULL, fmtDate, money, num, ordersWord, plural, trips } from "@/lib/format";
import BarChart, { type Bar } from "./BarChart";
import RateBlock from "./RateBlock";
import MoneyModeSwitch from "./MoneyModeSwitch";

const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];

export default function StatsView({
  orders,
  gear,
  roles,
  settings,
  mode,
  onMode,
  onOpenRole,
  onNewRole,
}: {
  orders: Order[];
  gear: Gear[];
  roles: Role[];
  settings: Settings;
  mode: MoneyMode;
  onMode: (m: MoneyMode) => void;
  onOpenRole: (id: string) => void;
  onNewRole: () => void;
}) {
  const [cur, setCur] = useState<Currency>("UAH");
  const done = orders.filter((o) => inMode(o, mode));
  const confirmed = orders.filter((o) => o.status === "confirmed").length;

  if (!done.length) {
    return (
      <>
        <div className="sec-head">
          <div>
            <h2 className="sec">Аналітика</h2>
            <p className="sec-sub">Що рахувати грошима</p>
          </div>
          <MoneyModeSwitch mode={mode} onChange={onMode} confirmed={confirmed} />
        </div>
        <div className="empty">
          <h3>Поки нічого рахувати</h3>
          <p>
            {mode === "done" && confirmed > 0
              ? "Жодне замовлення ще не позначене «Виконано». Перемкни вгорі на «+ підтверджені» — і побачиш те, що вже законтрактовано."
              : "Створи замовлення — і тут одразу буде сезонність, розподіл по замовниках і окупність."}
          </p>
        </div>
      </>
    );
  }

  const m12 = monthlySeries(orders, 12, mode);
  const counts: Bar[] = m12.map((b) => ({
    label: b.label,
    value: b.count,
    tipValue: `${b.count}`,
    tipTitle: b.label,
    tipNote: b.cancelled ? `скасовано: ${b.cancelled}` : undefined,
  }));
  // Стовпчик — чисті; оборот лишається у підказці, щоб було з чим звірити.
  const netKey = cur === "UAH" ? "netUAH" : "netUSD";
  const rev: Bar[] = m12.map((b) => ({
    label: b.label,
    value: b[netKey],
    tipValue: `${num(b[netKey])} ${CUR[cur]}`,
    tipNote: b[cur] !== b[netKey] ? `оборот ${num(b[cur])}` : undefined,
  }));

  const last3 = m12.slice(-3).reduce((s, b) => s + b.count, 0);
  const prev3 = m12.slice(-6, -3).reduce((s, b) => s + b.count, 0);
  const delta = prev3 ? Math.round(((last3 - prev3) / prev3) * 100) : null;

  const curDone = done.filter((o) => o.currency === cur);
  const total = curDone.reduce((s, o) => s + orderTotal(o), 0);
  const expenses = curDone.reduce((s, o) => s + (Number(o.expenses) || 0), 0);
  const net = total - expenses;
  const avgNet = curDone.length ? net / curDone.length : 0;
  const avg = curDone.length ? total / curDone.length : 0;
  const gearPart = curDone.reduce((s, o) => s + gearRevenue(o), 0);
  const svcPart = total - gearPart;

  const byMonth: Bar[] = Array.from({ length: 12 }, (_, i) => ({ label: MONTHS[i], value: 0, tipTitle: MONTHS_FULL[i] }));
  for (const o of orders) if (o.status !== "cancelled" && o.date) byMonth[new Date(o.date).getMonth()].value += 1;
  const peak = [...byMonth].sort((a, b) => b.value - a.value)[0];
  const low = byMonth.filter((b) => b.value > 0).sort((a, b) => a.value - b.value)[0];

  const paybacks = gear.map((g) => ({ g, p: payback(orders, g, settings, mode, gear) })).filter((x) => x.p.price > 0).sort((a, b) => a.p.pct - b.p.pct);

  const rs = roleStats(orders, roles, mode)
    .sort((a, b) => b.orders - a.orders || b.UAH + b.USD * 40 - (a.UAH + a.USD * 40));
  const roleOrders = rs.reduce((s, r) => s + r.orders, 0);

  return (
    <>
      <div className="sec-head">
        <div>
          <h2 className="sec">Аналітика</h2>
          <p className="sec-sub">
            Гривня і долар рахуються окремо — без конвертації.{" "}
            {mode === "done" ? "Тільки виконані замовлення." : "Виконані разом із підтвердженими."}
          </p>
        </div>
        <MoneyModeSwitch mode={mode} onChange={onMode} confirmed={confirmed} />
      </div>

      <div className="sec-head" style={{ marginTop: -6 }}>
        <div />
        <div className="seg">
          <button aria-pressed={cur === "UAH"} onClick={() => setCur("UAH")}>₴ Гривня</button>
          <button aria-pressed={cur === "USD"} onClick={() => setCur("USD")}>$ Долар</button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="k">Чистими, {CUR[cur]}</div>
          <div className="v num">
            {num(net)}
            {expenses > 0 && <span className="gross">оборот {num(total)}</span>}
          </div>
          <div className="d">{expenses ? `витрат ${num(expenses)} ${CUR[cur]} — дорога, помічники` : "витрат не вписано"}</div>
        </div>
        <div className="tile">
          <div className="k">Середній чек</div>
          <div className="v num">
            {num(avgNet)}
            {expenses > 0 && <span className="gross">оборот {num(avg)}</span>}
          </div>
          <div className="d">{ordersWord(curDone.length)} у {CUR[cur]}</div>
        </div>
        <div className="tile">
          <div className="k">З оренди техніки</div>
          <div className="v num">{total ? Math.round((gearPart / total) * 100) : 0}<small>%</small></div>
          <div className="d">{num(gearPart)} {CUR[cur]} з обороту {num(total)}</div>
        </div>
        <div className="tile">
          <div className="k">З власної роботи</div>
          <div className="v num">{total ? Math.round((svcPart / total) * 100) : 0}<small>%</small></div>
          <div className="d">{num(svcPart)} {CUR[cur]} з обороту — виступи, монтаж</div>
        </div>
      </div>

      <div className="panel">
        <div className="chart-head">
          <h3>Замовлень по місяцях</h3>
          <span className="chart-note">
            {delta == null ? "Мало даних для порівняння" : (
              <>Останні 3 міс: <b>{last3}</b> проти <b>{prev3}</b> за попередні три — {delta >= 0 ? "зростання" : "спад"} <b>{Math.abs(delta)}%</b></>
            )}
          </span>
        </div>
        <BarChart data={counts} color="var(--s1)" label="Кількість замовлень по місяцях" />
        <div className="legend"><span><i style={{ background: "var(--s1)" }} />Замовлення (без скасованих)</span></div>
      </div>

      <div className="panel">
        <div className="chart-head">
          <h3>Чистими по місяцях, {CUR[cur]}</h3>
          <span className="chart-note">
            {mode === "done" ? "Тільки виконані замовлення" : "Виконані та підтверджені"}
            {expenses > 0 ? " · оборот у підказці стовпчика" : ""}
          </span>
        </div>
        <BarChart data={rev} color="var(--s2)" label="Чистий дохід по місяцях" />
        <div className="legend"><span><i style={{ background: "var(--s2)" }} />Чистими у {CUR[cur]}, після витрат</span></div>
      </div>

      <div className="panel">
        <div className="chart-head">
          <h3>Ким я працюю</h3>
          <button className="btn sm" onClick={onNewRole}>＋ Роль</button>
        </div>
        {rs.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Ролей ще немає. Додай ті, в яких працюєш — монтаж, звукооператор, DJ — і вони зʼявляться
            у формі замовлення окремими кнопками.
          </p>
        ) : (
          <div className="tbl-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Роль</th>
                  <th style={{ width: 170 }}>Частка виїздів</th>
                  <th className="n">Замовлень</th>
                  <th className="n">Гонорар ₴</th>
                  <th className="n">Гонорар $</th>
                  <th className="n">Востаннє</th>
                </tr>
              </thead>
              <tbody>
                {rs.map((r, i) => {
                  const share = roleOrders ? (r.orders / roleOrders) * 100 : 0;
                  return (
                    <tr
                      key={r.key}
                      className={r.role ? "rowlink" : undefined}
                      onClick={r.role ? () => onOpenRole(r.role!.id) : undefined}
                    >
                      <td>
                        <b>{r.name}</b>
                        {!r.role && <div className="hint" style={{ fontSize: 11.5 }}>разова послуга, без ролі</div>}
                      </td>
                      <td>
                        <div className="share">
                          <div className="track"><i style={{ width: `${share.toFixed(1)}%`, background: SERIES[Math.min(i, 4)] }} /></div>
                          <span className="mono num" style={{ fontSize: 12 }}>{share.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="n">{r.orders || "—"}</td>
                      <td className="n">{r.UAH ? num(r.UAH) : "—"}</td>
                      <td className="n">{r.USD ? num(r.USD) : "—"}</td>
                      <td className="n">{r.last ? fmtDate(r.last) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ marginBottom: 0 }}>
          Частка рахується від виїздів, а не від грошей: в одному замовленні може бути кілька ролей.
          Клік по рядку відкриває роль — там ставка за замовчуванням.
        </p>
      </div>

      <div className="panel">
        <div className="chart-head">
          <h3>Сезонність — усі роки разом</h3>
          <span className="chart-note">
            {peak.value ? (
              <>Пік — <b>{peak.tipTitle}</b>{low && low.label !== peak.label ? <>, найтихіше — <b>{low.tipTitle}</b></> : null}</>
            ) : null}
          </span>
        </div>
        <BarChart data={byMonth} color="var(--s3)" height={160} label="Сезонність по місяцях" />
        <div className="legend"><span><i style={{ background: "var(--s3)" }} />Замовлень за місяць, усі роки</span></div>
      </div>

      {paybacks.length > 0 && (
        <div className="panel">
          <div className="chart-head">
            <h3>Окупність обладнання</h3>
            <span className="chart-note">Від найдалі до окупності — до найвигіднішого</span>
          </div>
          <div className="tbl-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Одиниця</th>
                  <th style={{ width: 190 }}>Окупність</th>
                  <th className="n">Куплено</th>
                  <th className="n">Зароблено</th>
                  <th className="n">Здавалось</th>
                  <th className="n">Залишилось</th>
                </tr>
              </thead>
              <tbody>
                {paybacks.map(({ g, p }) => (
                  <tr key={g.id}>
                    <td><b>{g.name}</b><div className="hint">{g.category}</div></td>
                    <td>
                      <div className="share">
                        <div className="track"><i style={{ width: `${Math.min(100, p.pct)}%`, background: p.pct >= 100 ? "var(--good)" : "var(--accent)" }} /></div>
                        <span className="mono num" style={{ fontSize: 12 }}>{p.pct}%</span>
                      </div>
                    </td>
                    <td className="n">
                      {money(p.price, p.cur)}
                      {p.units > 1 ? <div className="hint mono">{money(p.unitPrice, p.cur)} × {p.units}</div> : null}
                    </td>
                    <td className="n">
                      {money(p.earnedSame, p.cur)}
                      {p.earnedOther ? <div className="hint mono">+ {money(p.earnedOther, p.other)}</div> : null}
                    </td>
                    <td className="n">{p.uses}×</td>
                    <td className="n">{p.pct >= 100 ? "окупилось" : p.usesLeft != null ? `~${trips(p.usesLeft)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RateBlock settings={settings} />
        </div>
      )}
      <p className="hint">
        Усього замовлень у базі: {orders.length}, з них {mode === "done" ? "виконаних" : "виконаних і підтверджених"} {done.length}
        {orders.filter((o) => o.status === "cancelled").length
          ? `, скасованих ${orders.filter((o) => o.status === "cancelled").length}`
          : ""}
        . {plural(gear.length, "Одиниця", "Одиниці", "Одиниць")} техніки: {gear.length}.
      </p>
    </>
  );
}
