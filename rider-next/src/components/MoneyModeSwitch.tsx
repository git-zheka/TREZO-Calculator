"use client";

import type { MoneyMode } from "@/lib/calc";

/**
 * Перемикач того, що вважати грошима. Один на весь застосунок — стан живе
 * в AppShell, тож перемкнув в одній вкладці, і решта показує те саме.
 */
export default function MoneyModeSwitch({
  mode,
  onChange,
  confirmed,
}: {
  mode: MoneyMode;
  onChange: (m: MoneyMode) => void;
  /** Скільки підтверджених, але ще не виконаних — щоб було видно, що ховається за другим режимом */
  confirmed: number;
}) {
  return (
    <div className="seg" role="group" aria-label="Що рахувати грошима">
      <button aria-pressed={mode === "done"} onClick={() => onChange("done")}>Виконано</button>
      <button aria-pressed={mode === "active"} onClick={() => onChange("active")}>
        + підтверджені{confirmed ? ` (${confirmed})` : ""}
      </button>
    </div>
  );
}
