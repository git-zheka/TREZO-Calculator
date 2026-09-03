"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import type { Settings } from "@/lib/types";
import { rotateIcsToken } from "@/app/actions";

/**
 * Підписка календаря замість синхронізації руками.
 * Google Календар додає цей URL через «Інші календарі → Підписатись за URL»
 * і сам перечитує його. Далі броні видно у віджеті Google Календаря на телефоні.
 */
export default function IcsPanel({ settings }: { settings: Settings }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  // Origin відомий лише в браузері: на сервері віддаємо порожній рядок,
  // щоб розмітка збіглася і гідратація не сварилась.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const url = settings.icsToken ? `${origin}/api/ics/${settings.icsToken}` : "";

  return (
    <div className="panel" style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <div style={{ maxWidth: 560 }}>
        <b style={{ fontSize: 13.5 }}>Календар на телефоні</b>
        <div className="hint" style={{ marginTop: 4 }}>
          Підпиши Google Календар на це посилання — заброньовані дати зʼявляться там самі, разом із віджетом на робочому столі.
          Посилання містить секрет: хто його має, той бачить твої дати.
        </div>
        {url && (
          <code className="mono" style={{ display: "block", marginTop: 8, fontSize: 11.5, wordBreak: "break-all", color: "var(--ink-2)" }}>
            {url}
          </code>
        )}
      </div>
      <div className="rowflex">
        <button
          className="btn"
          disabled={!url}
          onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}
        >
          {copied ? "Скопійовано" : "Копіювати посилання"}
        </button>
        <button
          className="btn ghost sm"
          disabled={pending}
          onClick={() => { if (confirm("Стара підписка перестане працювати. Оновити посилання?")) start(async () => { await rotateIcsToken(); }); }}
        >
          {pending ? "Оновлюю…" : "Оновити секрет"}
        </button>
      </div>
    </div>
  );
}
