-- Blanco Coffee House: live menu + hours
-- Run in the Supabase SQL editor (once). Safe to re-run: seed uses ON CONFLICT.

create extension if not exists pgcrypto;

create table if not exists public.house_settings (
  id int primary key default 1 check (id = 1),
  hours_line text not null default 'Open every day · 11am–8pm',
  hours_days text not null default 'Monday–Sunday',
  hours_range text not null default '11am–8pm',
  opens time not null default '11:00',
  closes time not null default '20:00',
  updated_at timestamptz not null default now()
);

alter table public.house_settings
  add column if not exists notice text not null default '';

alter table public.house_settings
  add column if not exists how_busy text not null default '';

alter table public.house_settings
  drop constraint if exists house_settings_how_busy;

alter table public.house_settings
  add constraint house_settings_how_busy check (
    how_busy = any (array[''::text, 'quiet'::text, 'easy'::text, 'busy'::text, 'packed'::text])
  );

alter table public.house_settings
  add column if not exists how_wait text not null default '';

alter table public.house_settings
  add column if not exists pace_at timestamptz;

alter table public.house_settings
  drop constraint if exists house_settings_how_wait;

alter table public.house_settings
  add constraint house_settings_how_wait check (
    how_wait = any (array[''::text, 'flowing'::text, 'short'::text, 'queue'::text])
  );

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('drinks', 'sweets')),
  section text not null,
  name text not null,
  description text not null default '',
  price_gbp numeric(6,2) not null check (price_gbp >= 0),
  sort int not null default 0,
  sold_out boolean not null default false,
  photo text not null default '',
  driver_price_gbp numeric(6,2),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_board_sort on public.menu_items (board, sort, name);

alter table public.menu_items
  add column if not exists photo text not null default '';

alter table public.menu_items
  add column if not exists driver_price_gbp numeric(6,2);

alter table public.house_settings enable row level security;
alter table public.menu_items enable row level security;

drop policy if exists house_settings_public_read on public.house_settings;
create policy house_settings_public_read
  on public.house_settings for select
  using (true);

drop policy if exists menu_items_public_read on public.menu_items;
create policy menu_items_public_read
  on public.menu_items for select
  using (true);

-- Writes go through the Vercel admin function (service role), not anon.

insert into public.house_settings (id, hours_line, hours_days, hours_range, opens, closes)
values (
  1,
  'Open every day · 11am–8pm',
  'Monday–Sunday',
  '11am–8pm',
  '11:00'::time,
  '20:00'::time
)
on conflict (id) do update set
  hours_line = excluded.hours_line,
  hours_days = excluded.hours_days,
  hours_range = excluded.hours_range,
  opens = excluded.opens,
  closes = excluded.closes,
  updated_at = now();

insert into public.menu_items (id, board, section, name, description, price_gbp, sort, sold_out) values
  ('11111111-1111-4111-8111-000000000001'::uuid, 'drinks', 'Blanco Coffee', 'Signature Blanco Latte', 'Smooth espresso with steamed milk and a velvety finish.', 5, 10, false),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'drinks', 'Blanco Coffee', 'Espresso', '', 5, 20, false),
  ('11111111-1111-4111-8111-000000000003'::uuid, 'drinks', 'Blanco Coffee', 'Cappuccino', '', 5, 30, false),
  ('11111111-1111-4111-8111-000000000004'::uuid, 'drinks', 'Blanco Coffee', 'Americano', '', 5, 40, false),
  ('11111111-1111-4111-8111-000000000005'::uuid, 'drinks', 'Tea', 'Signature Blanco Tea', 'Traditional karak chai with bold black tea, warming spices and creamy milk.', 4, 110, false),
  ('11111111-1111-4111-8111-000000000006'::uuid, 'drinks', 'Tea', 'English', '', 4, 120, false),
  ('11111111-1111-4111-8111-000000000007'::uuid, 'drinks', 'Tea', 'Earl Grey', '', 4, 130, false),
  ('11111111-1111-4111-8111-000000000008'::uuid, 'drinks', 'Tea', 'Chai Latte', '', 4, 140, false),
  ('11111111-1111-4111-8111-000000000009'::uuid, 'drinks', 'Tea', 'Chamomile', '', 4, 150, false),
  ('11111111-1111-4111-8111-000000000010'::uuid, 'drinks', 'Tea', 'Peppermint', '', 4, 160, false),
  ('11111111-1111-4111-8111-000000000011'::uuid, 'drinks', 'Chocolate', 'Mocha', '', 5, 210, false),
  ('11111111-1111-4111-8111-000000000012'::uuid, 'drinks', 'Chocolate', 'Signature Blanco Hot Choc', 'Rich hot chocolate blended with steamed milk for a smooth, creamy finish.', 5, 220, false),
  ('11111111-1111-4111-8111-000000000013'::uuid, 'drinks', 'Iced Blanco Coffee', 'Signature Blanco Iced Latte', 'Smooth espresso over ice with creamy milk and blanco''s signature blend and syrups. Our signature drink.', 6, 310, false),
  ('11111111-1111-4111-8111-000000000014'::uuid, 'drinks', 'Iced Blanco Coffee', 'Iced Latte', 'Choose your flavour (Spanish, Caramel, Vanilla, White Chocolate, Hazelnut). Add a flavour +1.', 6, 320, false),
  ('11111111-1111-4111-8111-000000000015'::uuid, 'drinks', 'Matcha Blanco', 'Signature Blanco Hot Matcha', 'Smooth matcha with creamy milk and blanco''s signature blend.', 6, 410, false),
  ('11111111-1111-4111-8111-000000000016'::uuid, 'drinks', 'Matcha Blanco', 'Signature Blanco Iced Matcha', 'Smooth matcha over ice with creamy milk for a refreshing finish. Choose your flavour (Strawberry, Blueberry, White Chocolate, Hazelnut). Add a flavour +1.', 6, 420, false),
  ('11111111-1111-4111-8111-000000000017'::uuid, 'drinks', 'Blanco Smoothies', 'Signature Blanco Smoothie', 'Strawberries, raspberries, blueberries, cranberries, honey, orange juice & strawberry yogurt.', 7, 510, false),
  ('11111111-1111-4111-8111-000000000018'::uuid, 'drinks', 'Blanco Smoothies', 'Tropical Crush', 'Tropical juice, mango, apple, strawberries & mango yoghurt.', 7, 520, false),
  ('11111111-1111-4111-8111-000000000019'::uuid, 'drinks', 'Blanco Smoothies', 'Strawberry Dream', 'Strawberries, strawberry yogurt, banana & apple juice.', 7, 530, false),
  ('11111111-1111-4111-8111-000000000020'::uuid, 'drinks', 'Blanco Smoothies', 'Berry Burst', 'Strawberries, raspberries, blueberries, apple & pineapple juice.', 7, 540, false),
  ('11111111-1111-4111-8111-000000000021'::uuid, 'drinks', 'Drinks', 'Any Soft Drink', '', 3, 610, false),
  ('11111111-1111-4111-8111-000000000022'::uuid, 'drinks', 'Drinks', 'House Drinks', '', 3, 620, false),
  ('11111111-1111-4111-8111-000000000023'::uuid, 'drinks', 'Drinks', 'Water', '', 2, 630, false),
  ('11111111-1111-4111-8111-000000000024'::uuid, 'sweets', 'Milkshakes', 'Signature Shake', 'Brownie, white bueno & fresh strawberries, topped with whipped cream and chocolate sauce.', 7, 1010, false),
  ('11111111-1111-4111-8111-000000000025'::uuid, 'sweets', 'Milkshakes', 'The Milli Shake', 'Ferrero Rocher, fresh strawberries, strawberry sauce and chocolate sauce topped with whipped cream.', 7, 1020, false),
  ('11111111-1111-4111-8111-000000000026'::uuid, 'sweets', 'Milkshakes', 'Cookie Monster Shake', 'Cookies, brownies & chocolate sauce topped with whipped cream.', 7, 1030, false),
  ('11111111-1111-4111-8111-000000000027'::uuid, 'sweets', 'Milkshakes', 'Nutter Shake', 'Oreos, peanut butter & crushed Oreos topped with whipped cream and chocolate sauce.', 7, 1040, false),
  ('11111111-1111-4111-8111-000000000028'::uuid, 'sweets', 'Milkshakes', 'Bronx Shake', 'Maltesers & milky bar topped with whipped cream and chocolate sauce.', 7, 1050, false),
  ('11111111-1111-4111-8111-000000000029'::uuid, 'sweets', 'Milkshakes', 'Hershey''s Special Shake', 'Hershey''s cookies & cream, oreos, and chocolate sauce with whipped cream.', 7, 1060, false),
  ('11111111-1111-4111-8111-000000000030'::uuid, 'sweets', 'Milkshakes', 'Risk it for a Biscuit Shake', 'Biscoff biscuits and biscoff sauce topped with whipped cream and biscoff crumbs.', 7, 1070, false),
  ('11111111-1111-4111-8111-000000000031'::uuid, 'sweets', 'Milkshakes', 'Jammie Dodger Shake', 'Jammie Dodgers, strawberries, strawberry sauce & topped with whipped cream.', 7, 1080, false),
  ('11111111-1111-4111-8111-000000000032'::uuid, 'sweets', 'Ice cream', 'Ice Cream Scoop', 'Vanilla, Chocolate, Strawberry, Hazelnut, Honeycomb, Bubblegum, Mint Chocolate, Raspberry Ripple, Cookies ''n'' Cream, Pistachio, Mango, Caramel, Bueno.', 2, 1110, false),
  ('11111111-1111-4111-8111-000000000033'::uuid, 'sweets', 'Sundaes', 'Mini Egg Crunch', 'Cookies & Cream & chocolate ice cream topped with mini eggs and crunch topping with chocolate sauce & whipped cream.', 7, 1210, false),
  ('11111111-1111-4111-8111-000000000034'::uuid, 'sweets', 'Sundaes', 'Brownie Blast', 'Cookies & Cream & chocolate ice cream topped with brownie chunks, chocolate sauce & whipped cream.', 7, 1220, false),
  ('11111111-1111-4111-8111-000000000035'::uuid, 'sweets', 'Sundaes', 'Strawberry Burst', 'Strawberry & vanilla ice cream with fresh strawberries & strawberry sauce topped with whipped cream.', 7, 1230, false),
  ('11111111-1111-4111-8111-000000000036'::uuid, 'sweets', 'Sundaes', 'Oreo Explosion', 'Chocolate & vanilla ice cream topped with crushed Oreos, chocolate sauce & whipped cream.', 7, 1240, false),
  ('11111111-1111-4111-8111-000000000037'::uuid, 'sweets', 'Sundaes', 'Kinder Dream', 'Bueno & chocolate ice cream, topped with bueno chunks, chocolate sauce & whipped cream.', 7, 1250, false),
  ('11111111-1111-4111-8111-000000000038'::uuid, 'sweets', 'Sundaes', 'Lotus Lover', 'Vanilla & Biscoff ice cream with crushed Biscoff biscuit topped with whipped cream & Biscoff sauce.', 7, 1260, false),
  ('11111111-1111-4111-8111-000000000039'::uuid, 'sweets', 'Sundaes', 'Pistachio Fever', 'Vanilla & pistachio ice cream with crushed biscuit and pistachios topped with whipped cream and pistachio sauce.', 7, 1270, false),
  ('11111111-1111-4111-8111-000000000040'::uuid, 'sweets', 'Loaded cups', 'Strawberry & Chocolate', '', 7, 1310, false),
  ('11111111-1111-4111-8111-000000000041'::uuid, 'sweets', 'Loaded cups', 'Strawberry & Brownies', '', 7, 1320, false),
  ('11111111-1111-4111-8111-000000000042'::uuid, 'sweets', 'Loaded cups', 'Waffle Bites & Chocolate', '', 7, 1330, false),
  ('11111111-1111-4111-8111-000000000043'::uuid, 'sweets', 'Loaded cups', 'Kinder Dream', '', 7, 1340, false)
on conflict (id) do update set
  board = excluded.board,
  section = excluded.section,
  name = excluded.name,
  description = excluded.description,
  price_gbp = excluded.price_gbp,
  sort = excluded.sort,
  sold_out = excluded.sold_out,
  updated_at = now();

grant select on table public.house_settings to anon, authenticated;
grant select on table public.menu_items to anon, authenticated;

-- Click-and-collect. Service role only; members go through /api/orders.
create table if not exists public.collection_orders (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  email text,
  name text,
  status text not null default 'in',
  items jsonb not null default '[]'::jsonb,
  note text not null default '',
  total_gbp numeric not null default 0,
  paid boolean not null default false,
  pay_at text not null default 'counter',
  stripe_session_id text,
  rank boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collection_orders_status check (
    status = any (array['hold'::text, 'in'::text, 'preparing'::text, 'ready'::text, 'collected'::text, 'cancelled'::text])
  ),
  constraint collection_orders_pay_at check (
    pay_at = any (array['counter'::text, 'stripe'::text])
  )
);

create index if not exists collection_orders_user_idx
  on public.collection_orders (clerk_user_id, created_at desc);

create index if not exists collection_orders_status_idx
  on public.collection_orders (status, created_at desc);

alter table public.collection_orders enable row level security;

revoke all on table public.collection_orders from anon, authenticated;
grant all on table public.collection_orders to service_role;

-- Desk photo drop. Public read; writes go through /api/gallery.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.gallery_shots (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  alt text not null default '',
  kind text not null default 'house',
  caption text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint gallery_shots_kind check (
    kind = any (array['cup'::text, 'sweets'::text, 'house'::text])
  )
);

create index if not exists gallery_shots_sort_idx
  on public.gallery_shots (sort desc, created_at desc);

alter table public.gallery_shots enable row level security;

drop policy if exists gallery_shots_public_read on public.gallery_shots;
create policy gallery_shots_public_read
  on public.gallery_shots for select
  using (true);

grant select on table public.gallery_shots to anon, authenticated;
grant all on table public.gallery_shots to service_role;

-- Taxi rank concession. Service role only; members go through /api/drivers.
alter table public.collection_orders
  add column if not exists rank boolean not null default false;

create table if not exists public.rank_settings (
  id int primary key default 1 check (id = 1),
  join_code text not null default 'RANK-4W7K',
  updated_at timestamptz not null default now()
);

insert into public.rank_settings (id, join_code)
values (1, 'RANK-4W7K')
on conflict (id) do nothing;

alter table public.rank_settings enable row level security;
revoke all on table public.rank_settings from anon, authenticated;
grant all on table public.rank_settings to service_role;

create table if not exists public.rank_drivers (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  email text not null,
  name text,
  status text not null default 'in',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rank_drivers_status check (
    status = any (array['in'::text, 'paused'::text])
  )
);

create unique index if not exists rank_drivers_email_idx
  on public.rank_drivers (lower(email));

create index if not exists rank_drivers_status_idx
  on public.rank_drivers (status, created_at desc);

alter table public.rank_drivers enable row level security;
revoke all on table public.rank_drivers from anon, authenticated;
grant all on table public.rank_drivers to service_role;

update public.menu_items set driver_price_gbp = 2.00
where name in ('Espresso', 'Americano', 'English', 'Earl Grey', 'Chamomile', 'Peppermint')
  and driver_price_gbp is null;

update public.menu_items set driver_price_gbp = 3.00
where name in (
  'Signature Blanco Latte',
  'Cappuccino',
  'Signature Blanco Tea',
  'Mocha',
  'Signature Blanco Hot Choc'
) and driver_price_gbp is null;

update public.menu_items set driver_price_gbp = 3.50
where name = 'Iced Latte' and driver_price_gbp is null;

update public.menu_items set driver_price_gbp = 1.00
where name = 'Water' and driver_price_gbp is null;

update public.menu_items set driver_price_gbp = 1.50
where name = 'Ice Cream Scoop' and driver_price_gbp is null;

-- Daily cup check-in. Public read of the shot; writes go through /api/checkins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checkins',
  'checkins',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.cup_checkins (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  display_name text not null default '',
  path text not null unique,
  day date not null,
  created_at timestamptz not null default now(),
  constraint cup_checkins_user_day unique (clerk_user_id, day)
);

create index if not exists cup_checkins_day_idx
  on public.cup_checkins (day desc, created_at desc);

alter table public.cup_checkins enable row level security;

drop policy if exists cup_checkins_public_read on public.cup_checkins;
create policy cup_checkins_public_read
  on public.cup_checkins for select
  using (true);

grant select on table public.cup_checkins to anon, authenticated;
grant all on table public.cup_checkins to service_role;

-- Public handles. Real names stay with Clerk / the desk.
create table if not exists public.member_handles (
  clerk_user_id text primary key,
  handle text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists member_handles_handle_idx
  on public.member_handles (lower(handle));

alter table public.member_handles enable row level security;

revoke all on table public.member_handles from anon, authenticated;
grant all on table public.member_handles to service_role;

drop policy if exists checkins_public_read on storage.objects;
create policy checkins_public_read
  on storage.objects for select
  using (bucket_id = 'checkins');
