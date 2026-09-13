export type Currency = "UAH" | "USD";
export type OrderStatus = "lead" | "confirmed" | "done" | "cancelled";
export type OrderKind = "rent" | "rent+set" | "set" | "other";
export type GearStatus = "active" | "repair" | "sold";

export type OrderItem = {
  type: "gear" | "service";
  equipmentId?: string | null;
  name: string;
  qty: number;
  price: number;
  /** Комплектація на момент замовлення — щоб не забути взяти. Копія, не посилання. */
  parts?: { name: string; qty: number }[];
  /** Рядок доданий автоматично як комутація до цієї позиції (id картки-власника). */
  via?: string | null;
};

export type Order = {
  id: string;
  date: string; // YYYY-MM-DD
  clientId: string | null;
  clientName: string;
  title: string;
  kind: OrderKind;
  currency: Currency;
  status: OrderStatus;
  expenses: number;
  notes: string;
  items: OrderItem[];
};

/** Складова комплекту: сумка, пульт, кабель. Окремо не здається, але коштувала грошей. */
export type GearPart = {
  name: string;
  qty: number;
  /** Ціна покупки за одну штуку; входить у вкладення в позицію */
  price: number;
};

/** Комутація: посилання на іншу картку, яка зазвичай їде разом.
 *  Саме посилання, а не копія — кабель має власний запас на складі. */
export type GearLink = {
  gearId: string;
  qty: number;
};

export type Gear = {
  id: string;
  name: string;
  category: string;
  qty: number;
  purchaseDate: string;
  purchasePrice: number;
  purchaseCurrency: Currency;
  rateUah: number;
  rateUsd: number;
  status: GearStatus;
  notes: string;
  parts: GearPart[];
  needs: GearLink[];
  /** Порядок картки всередині своєї групи; менше — вище */
  sort: number;
};

/** Групи в парку. Порядок цього масиву задає порядок секцій на вкладці. */
export const CATEGORIES = [
  "Звук",
  "Світло",
  "Мультимедія",
  "Пульти та контролери",
  "Ефекти",
  "Комутація",
  "Стійки",
  "Інше",
] as const;

/**
 * Комутація і стійки окремо не здаються — вони їдуть як супутнє до основної
 * позиції. Тож у них немає ставки оренди й немає власної окупності:
 * заробляє світло, а не кабель до нього. Вартість покупки при цьому
 * лишається у вкладеннях, інакше парк виглядав би дешевшим, ніж є.
 */
export const NON_BILLABLE: readonly string[] = ["Комутація", "Стійки"];
export const isBillable = (category: string) => !NON_BILLABLE.includes(category);
export const normalizeCategory = (c: string) =>
  (CATEGORIES as readonly string[]).includes(c) ? c : c.trim() ? c : "Інше";

export type Client = {
  id: string;
  name: string;
  type: string;
  notes: string;
};

export type Settings = {
  rate: number;      // 1 USD = rate UAH, 0 = вимкнено
  icsToken: string;  // секрет у URL підписки на календар
};

export type Snapshot = {
  orders: Order[];
  gear: Gear[];
  clients: Client[];
  settings: Settings;
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  lead: "Заявка",
  confirmed: "Підтверджено",
  done: "Виконано",
  cancelled: "Скасовано",
};

export const KIND_LABEL: Record<OrderKind, string> = {
  rent: "Тільки оренда",
  "rent+set": "Оренда + робота",
  set: "Тільки виступ",
  other: "Інше",
};

export const GEAR_STATUS_LABEL: Record<GearStatus, string> = {
  active: "В строю",
  repair: "На ремонті",
  sold: "Продане",
};
