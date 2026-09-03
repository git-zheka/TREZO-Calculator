"use client";

import { useState } from "react";

export type Bar = { label: string; value: number; tipTitle?: string; tipValue?: string; tipNote?: string };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return s * mag;
}

const nf = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 });

export default function BarChart({
  data,
  color = "var(--s1)",
  height = 190,
  label,
}: {
  data: Bar[];
  color?: string;
  height?: number;
  label: string;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; bar: Bar } | null>(null);
  const W = 720;
  const padL = 44, padR = 8, padT = 12, padB = 26;
  const iw = W - padL - padR;
  const ih = height - padT - padB;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const step = iw / Math.max(1, data.length);
  const bw = Math.min(46, step * 0.62);
  const ticks = [0, max / 2, max];

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
        <line x1={padL} x2={W - padR} y1={padT + ih} y2={padT + ih} stroke="var(--baseline)" strokeWidth={1} />
        {ticks.map((t) => {
          const y = padT + ih - (t / max) * ih;
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--grid)" strokeWidth={1} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize={10.5} fontFamily="var(--font-mono)">
                {nf.format(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = padL + step * i + (step - bw) / 2;
          const h = (d.value / max) * ih;
          const y = padT + ih - h;
          const r = Math.min(4, h / 2);
          return (
            <g key={`${d.label}-${i}`}>
              {h > 0.5 && (
                <path
                  d={`M${x} ${padT + ih} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + bw - r} ${y} Q${x + bw} ${y} ${x + bw} ${y + r} L${x + bw} ${padT + ih} Z`}
                  fill={color}
                />
              )}
              <rect
                x={padL + step * i}
                y={padT}
                width={step}
                height={ih}
                fill="transparent"
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, bar: d })}
                onMouseLeave={() => setTip(null)}
              />
              <text x={x + bw / 2} y={height - 8} textAnchor="middle" fill="var(--muted)" fontSize={10.5} fontFamily="var(--font-mono)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {tip && (
        <div
          className="tip"
          style={{ left: Math.min(tip.x + 12, (typeof window !== "undefined" ? window.innerWidth : 1000) - 220), top: Math.max(8, tip.y - 46) }}
        >
          {tip.bar.tipTitle ?? tip.bar.label} — <span className="tv">{tip.bar.tipValue ?? nf.format(tip.bar.value)}</span>
          {tip.bar.tipNote ? (
            <>
              <br />
              {tip.bar.tipNote}
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
