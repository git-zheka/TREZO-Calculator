export type Currency = "UAH" | "USD";
export type OrderStatus = "lead" | "confirmed" | "done" | "cancelled";
export type OrderKind = "rent" | "rent+set" | "set" | "other";
export type GearStatus = "active" | "repair" | "sold";

export type OrderItem = {
  type: "gear" | "service";
  equipmentId?: string | null;
  /** Для послуг: у якій ролі працював (монтаж, звукооператор, DJ). null — разова послуга. */
  roleId?: string | null;
  name: string;
  qty: number;
  price: number;
  /**
   * Скільки днів рахується ця позиція. Техніці підставляється кількість
   * вибраних днів замовлення, власній роботі — один. Відсутнє = один день,
   * тому старі замовлення рахуються як раніше.
   */
  days?: number;
  /** Комплектація на момент замовлення — щоб не забути взяти. Копія, не посилання. */
  parts?: { name: string; qty: number }[];
  /** Рядок доданий автоматично як комутація до цієї позиції (id картки-власника). */
  via?: string | null;
};

export type Order = {
  id: string;
  /** Перший день замовлення. Лишається окремим полем: по ньому сортування й індекси. */
  date: string; // YYYY-MM-DD
  /**
   * Усі дні замовлення, коли техніка зайнята: екран можуть узяти на три дні поспіль
   * або на дві окремі дати. Відсортований список без повторів, перший елемент = date.
   * Порожній список у старих записах означає один день — див. orderDates().
   */
  dates?: string[];
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

/**
 * Старі назви груп, набрані вручну до появи списку, — щоб картки не загубились.
 * Ключі в нижньому регістрі. Усе, чого тут немає, падає в «Інше».
 */
const CATEGORY_ALIASES: Record<string, string> = {
  // комутація і живлення
  "кабель": "Комутація", "кабелі": "Комутація", "кабели": "Комутація",
  "переноска": "Комутація", "переноски": "Комутація",
  "подовжувач": "Комутація", "подовжувачі": "Комутація", "удлинитель": "Комутація",
  "живлення": "Комутація", "питание": "Комутація",
  "провід": "Комутація", "проводи": "Комутація", "шнур": "Комутація", "шнури": "Комутація",
  "перехідник": "Комутація", "перехідники": "Комутація",
  "комутації": "Комутація", "комутация": "Комутація", "комутацiя": "Комутація",
  // стійки
  "стійка": "Стійки", "стойка": "Стійки", "стойки": "Стійки",
  "штатив": "Стійки", "штативи": "Стійки", "тринога": "Стійки",
  // мультимедія
  "мультимедіа": "Мультимедія", "мультимедиа": "Мультимедія", "мультімедіа": "Мультимедія",
  "відео": "Мультимедія", "видео": "Мультимедія",
  "екран": "Мультимедія", "екрани": "Мультимедія", "телевізор": "Мультимедія", "телевізори": "Мультимедія",
  "проєктор": "Мультимедія", "проектор": "Мультимедія",
  // звук
  "аудіо": "Звук", "аудио": "Звук", "колонка": "Звук", "колонки": "Звук", "акустика": "Звук",
  "мікрофон": "Звук", "мікрофони": "Звук",
  // світло
  "свет": "Світло", "світлодіоди": "Світло", "прожектор": "Світло", "прожектори": "Світло",
  // пульти
  "пульт": "Пульти та контролери", "пульти": "Пульти та контролери",
  "контролер": "Пульти та контролери", "контролери": "Пульти та контролери",
  "мікшер": "Пульти та контролери", "мікшери": "Пульти та контролери", "мікшерний пульт": "Пульти та контролери",
  // ефекти
  "ефект": "Ефекти", "дим": "Ефекти", "димогенератор": "Ефекти", "генератор диму": "Ефекти",
};

/**
 * Назва групи → одна з CATEGORIES, завжди. Вкладка «Обладнання» будує секції
 * саме за цим списком, тож будь-що поза ним раніше просто зникало з очей
 * (у лічильниках зверху рахувалось, а картки не було).
 */
export const normalizeCategory = (c: string): string => {
  const raw = (c ?? "").trim();
  if (!raw) return "Інше";
  const exact = (CATEGORIES as readonly string[]).find((x) => x.toLowerCase() === raw.toLowerCase());
  return exact ?? CATEGORY_ALIASES[raw.toLowerCase()] ?? "Інше";
};

/**
 * Роль, у якій він працює на замовленні: монтаж/демонтаж, звукооператор, DJ.
 * Окрема сутність, а не текст у рядку, — інакше «DJ» і «діджей» стануть
 * двома різними рядками у статистиці.
 */
export type Role = {
  id: string;
  name: string;
  /** Дефолтний гонорар; підставляється в замовлення й там перебивається */
  rateUah: number;
  rateUsd: number;
  sort: number;
};

/** Ставляться при першому запуску; далі список редагується вручну. */
export const DEFAULT_ROLES: Role[] = [
  { id: "role-mount", name: "Монтаж / демонтаж", rateUah: 0, rateUsd: 0, sort: 0 },
  { id: "role-sound", name: "Звукооператор", rateUah: 0, rateUsd: 0, sort: 1 },
  { id: "role-dj", name: "DJ", rateUah: 0, rateUsd: 0, sort: 2 },
];

export type Client = {
  id: string;
  name: string;
  type: string;
  /** Постійний — виноситься нагору в списках і підставляється першим у замовленні */
  regular: boolean;
  /** Телефон, телеграм, пошта — щоб не шукати по переписках */
  contact: string;
  notes: string;
};

/** Типи замовників. Порядок задає порядок у випадному списку. */
export const CLIENT_TYPES = [
  "Агенція",
  "Клуб / заклад",
  "Ресторан",
  "Компанія",
  "Приватна особа",
  "Інше",
] as const;

export const normalizeClientType = (t: string): string => {
  const raw = (t ?? "").trim();
  if (!raw) return "Інше";
  const exact = (CLIENT_TYPES as readonly string[]).find((x) => x.toLowerCase() === raw.toLowerCase());
  // "direct" — дефолт зі старої схеми, коли типи ще не вибирались зі списку
  return exact ?? "Інше";
};

export type Settings = {
  rate: number;      // 1 USD = rate UAH, 0 = вимкнено
  icsToken: string;  // секрет у URL підписки на календар
};

export type Snapshot = {
  orders: Order[];
  gear: Gear[];
  clients: Client[];
  roles: Role[];
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
