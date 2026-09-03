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
};

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
