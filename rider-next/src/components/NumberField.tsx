"use client";

/**
 * Поле для сум і кількостей: без стрілок-лічильника, з числовою клавіатурою
 * на телефоні. Нуль показується порожнім, щоб не доводилось його стирати
 * перед кожним введенням.
 *
 * Значення повністю контролює батько — власного стану тут немає навмисно,
 * інакше довелося б синхронізувати його ефектом (наприклад, коли зміна валюти
 * підставляє іншу ставку), а це зайві перерендери й класичне джерело багів.
 * Через це поле приймає лише цілі числа; дробові там, де вони справді потрібні
 * (курс), робляться окремо з власним станом.
 */
export default function NumberField({
  value,
  onChange,
  className = "",
  ariaLabel,
  placeholder = "0",
  style,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value ? String(value) : ""}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={style}
      disabled={disabled}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits ? Number(digits) : 0);
      }}
    />
  );
}
