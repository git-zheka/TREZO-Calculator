-- Райдер — схема Postgres. Запускається ідемпотентно: npm run db:push
-- Все під одним акаунтом: користувач один, тож окремої таблиці users немає.

create table if not exists clients (
  id          text primary key,
  name        text not null,
  type        text not null default 'direct',
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

-- Постійні замовники: заводяться руками, а не лише зʼявляються із замовлень
alter table clients add column if not exists regular boolean not null default false;
alter table clients add column if not exists contact text not null default '';

create table if not exists gear (
  id                text primary key,
  name              text not null,
  category          text not null default '',
  qty               integer not null default 1,
  purchase_date     date,
  purchase_price    numeric(14,2) not null default 0,
  purchase_currency text not null default 'UAH' check (purchase_currency in ('UAH','USD')),
  rate_uah          numeric(14,2) not null default 0,
  rate_usd          numeric(14,2) not null default 0,
  status            text not null default 'active' check (status in ('active','repair','sold')),
  notes             text not null default '',
  created_at        timestamptz not null default now()
);

-- Комплектація (сумка, пульт, кабелі): додано пізніше, тому окремим ALTER
alter table gear add column if not exists parts jsonb not null default '[]'::jsonb;
-- Комутація: посилання на інші картки (кабелі, стійки), які їдуть разом
alter table gear add column if not exists needs jsonb not null default '[]'::jsonb;
-- Ручний порядок карток усередині групи
alter table gear add column if not exists sort integer not null default 0;

-- Ролі, в яких він працює: монтаж, звукооператор, DJ. Список редагується в застосунку.
create table if not exists roles (
  id         text primary key,
  name       text not null,
  rate_uah   numeric(14,2) not null default 0,
  rate_usd   numeric(14,2) not null default 0,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

-- Стартовий набір ставиться тільки в порожню таблицю: інакше видалена роль
-- поверталася б при кожному наступному db:push.
insert into roles (id, name, sort)
select v.id, v.name, v.sort
from (values ('role-mount', 'Монтаж / демонтаж', 0),
             ('role-sound', 'Звукооператор', 1),
             ('role-dj',    'DJ', 2)) as v(id, name, sort)
where not exists (select 1 from roles);

create table if not exists orders (
  id          text primary key,
  date        date not null,
  client_id   text references clients(id) on delete set null,
  client_name text not null default '',
  title       text not null default '',
  kind        text not null default 'rent+set',
  currency    text not null default 'UAH' check (currency in ('UAH','USD')),
  status      text not null default 'confirmed' check (status in ('lead','confirmed','done','cancelled')),
  expenses    numeric(14,2) not null default 0,
  notes       text not null default '',
  -- Позиції лежать документом. Вони незмінні після збереження й ніколи не
  -- запитуються окремо від замовлення, тож нормалізація тут дала б лише join.
  items       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Кілька днів на одне замовлення: оренда екрана на вихідні — це один запис і три дати
alter table orders add column if not exists dates jsonb not null default '[]'::jsonb;

create index if not exists orders_date_idx   on orders (date desc);
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_client_idx on orders (client_id);
-- Пошук «де задіяна ця одиниця» йде по jsonb
create index if not exists orders_items_idx  on orders using gin (items);

create table if not exists settings (
  id         integer primary key default 1 check (id = 1),
  rate       numeric(10,2) not null default 0,
  ics_token  text not null,
  updated_at timestamptz not null default now()
);

-- Один рядок налаштувань із випадковим токеном для ICS-підписки
-- Токен без pgcrypto: md5 є в ядрі, тож схема ставиться на будь-який Postgres
insert into settings (id, rate, ics_token)
values (1, 0, md5(random()::text || clock_timestamp()::text) || md5(random()::text))
on conflict (id) do nothing;
