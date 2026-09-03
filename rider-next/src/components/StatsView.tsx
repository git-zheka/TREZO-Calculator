"use client";

import { useState } from "react";
import type { Currency, Gear, Order, Settings } from "@/lib/types";
import { counted, gearRevenue, monthlySeries, orderTotal, payback } from "@/lib/calc";
import { CUR, MONTHS, MONTHS_FULL, money, num, ordersWord, plural, trips } from "@/lib/format";
import BarChart, { type Bar } from "./BarChart";
import RateBlock from "./RateBlock";

export default function StatsView({ orders, gear, settings }: { orders: Order[]; gear: Gear[]; settings: Settings }) {
  const [cur, setCur] = useState<Currency>("UAH");
  const done = orders.filter(counted);

  if (!done.length) {
    return (
      <div className="empty">
        <h3>Аналітика зʼявиться з даними</h3>
        <p>Познач хоча б одне замовлення як «Виконано» — і тут одразу буде сезонність, розподіл по замовниках і окупність.</p>
      </div>
    );
  }

  const m12 = monthlySeries(orders, 12);
  const counts: Bar[] = m12.map((b) => ({
    label: b.label,
    value: b.count,
    tipValue: `${b.count}`,
    tipTitle: b.label,
    tipNote: b.cancelled ? `скасовано: ${b.cancelled}` : undefined,
  }));
  const rev: Bar[] = m12.map((b) => ({ label: b.label, value: b[cur], tipValue: `${num(b[cur])} ${CUR[cur]}` }));

  const last3 = m12.slice(-3).reduce((s, b) => s + b.count, 0);
  const prev3 = m12.slice(-6, -3).reduce((s, b) => s + b.count, 0);
  const delta = prev3 ? Math.round(((last3 - prev3) / prev3) * 100) : null;

  const curDone = done.filter((o) => o.currency === cur);
  const total = curDone.reduce((s, o) => s + orderTotal(o), 0);
  const expenses = curDone.reduce((s, o) => s + (Number(o.expenses) || 0), 0);
  const avg = curDone.length ? total / curDone.length : 0;
  const gearPart = curDone.reduce((s, o) => s + gearRevenue(o), 0);
  const svcPart = total - gearPart;

  const byMonth: Bar[] = Array.from({ length: 12 }, (_, i) => ({ label: MONTHS[i], value: 0, tipTitle: MONTHS_FULL[i] }));
  for (const o of orders) if (o.status !== "cancelled" && o.date) byMonth[new Date(o.date).getMonth()].value += 1;
  const peak = [...byMonth].sort((a, b) => b.value - a.value)[0];
  const low = byMonth.filter((b) => b.value > 0).sort((a, b) => a.value - b.value)[0];

  const paybacks = gear.map((g) => ({ g, p: payback(orders, g, settings) })).filter((x) => x.p.price > 0).sort((a, b) => a.p.pct - b.p.pct);

  return (
    <>
      <div className="sec-head">
        <div>
          <h2 className="sec">Аналітика</h2>
          <p className="sec-sub">Гривня і долар рахуються окремо — без конвертації</p>
        </div>
        <div className="seg">
          <button aria-pressed={cur === "UAH"} onClick={() => setCur("UAH")}>₴ Гривня</button>
          <button aria-pressed={cur === "USD"} onClick={() => setCur("USD")}>$ Долар</button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="k">Дохід, {CUR[cur]}</div>
          <div className="v num">{num(total)}</div>
          <div className="d">чистими {num(total - expenses)} після витрат</div>
        </div>
        <div className="tile">
          <div className="k">Середній чек</div>
          <div className="v num">{num(avg)}</div>
          <div className="d">{ordersWord(curDone.length)} у {CUR[cur]}</div>
        </div>
        <div className="tile">
          <div className="k">З оренди техніки</div>
          <div className="v num">{total ? Math.round((gearPart / total) * 100) : 0}<small>%</small></div>
          <div className="d">{num(gearPart)} {CUR[cur]} з {num(total)}</div>
        </div>
        <div className="tile">
          <div className="k">З власної роботи</div>
          <div className="v num">{total ? Math.round((svcPart / total) * 100) : 0}<small>%</small></div>
          <div className="d">{num(svcPart)} {CUR[cur]} — виступи, монтаж</div>
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
          <h3>Дохід по місяцях, {CUR[cur]}</h3>
          <span className="chart-note">Тільки виконані замовлення</span>
        </div>
        <BarChart data={rev} color="var(--s2)" label="Дохід по місяцях" />
        <div className="legend"><span><i style={{ background: "var(--s2)" }} />Дохід у {CUR[cur]}</span></div>
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
                    <td className="n">{money(p.price, p.cur)}</td>
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
        Усього замовлень у базі: {orders.length}, з них виконаних {done.length}
        {orders.filter((o) => o.status === "cancelled").length
          ? `, скасованих ${orders.filter((o) => o.status === "cancelled").length}`
          : ""}
        . {plural(gear.length, "Одиниця", "Одиниці", "Одиниць")} техніки: {gear.length}.
      </p>
    </>
  );
}
