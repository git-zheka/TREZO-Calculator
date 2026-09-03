"use client";

import { useState, useTransition } from "react";
import type { Settings } from "@/lib/types";
import { setRate } from "@/app/actions";

/**
 * Курс потрібен рівно для однієї речі — щоб техніка, куплена за долари,
 * могла окупатись гривневими замовленнями. Дохід у графіках лишається розділеним.
 */
export default function RateBlock({ settings }: { settings: Settings }) {
  const [value, setValue] = useState(settings.rate ? String(settings.rate) : "");
  const [pending, start] = useTransition();
  const rate = Number(settings.rate) || 0;

  return (
    <div className="panel" style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <div style={{ maxWidth: 520 }}>
        <b style={{ fontSize: 13.5 }}>Курс для окупності</b>
        <div className="hint">
          {rate
            ? "Заробіток в іншій валюті зараховується в окупність за цим курсом. Дохід у графіках лишається розділеним."
            : "Порожньо — гривня і долар рахуються окремо, тож техніка, куплена за $, не окупається гривневими замовленнями. Впиши курс, щоб зарахувати."}
        </div>
      </div>
      <label className="rowflex" style={{ gap: 7, fontSize: 13, whiteSpace: "nowrap" }}>
        1 $ =
        <input
          className="i"
          type="number"
          min={0}
          step={0.5}
          style={{ width: 96, textAlign: "right" }}
          value={value}
          placeholder="—"
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => { if (Number(value || 0) !== rate) start(async () => { await setRate(Number(value) || 0); }); }}
          aria-label="Курс долара до гривні"
        />
        ₴
      </label>
    </div>
  );
}
