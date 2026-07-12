-- JURUJAHIT — skema database (Supabase / Postgres). §5
-- Jalankan di Supabase SQL editor. Idempoten-ish: pakai "if not exists" bila perlu.

create extension if not exists "pgcrypto";

-- Penjahit (single-tenant MVP, tapi siap multi)
create table if not exists tailors (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint unique not null,
  name text not null,
  business_name text,
  work_days_per_week int not null default 6,
  work_hours_per_day numeric not null default 8,
  created_at timestamptz default now()
);

-- Profil kapasitas: durasi pengerjaan per jenis item
create table if not exists item_types (
  id uuid primary key default gen_random_uuid(),
  tailor_id uuid references tailors(id) not null,
  name text not null,
  aliases text[],
  hours_per_unit numeric not null,
  base_price numeric,
  outsource_cost numeric,
  created_at timestamptz default now()
);

-- Rekan penjahit (untuk opsi OPER)
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  tailor_id uuid references tailors(id) not null,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz default now()
);

-- Order
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  tailor_id uuid references tailors(id) not null,
  customer_name text,
  raw_message text not null,
  extracted jsonb not null,
  item_type_id uuid references item_types(id),
  item_label text not null,
  quantity int not null default 1,
  deadline date,
  material_provided_by text check (material_provided_by in ('customer','tailor','unknown')) default 'unknown',
  est_hours numeric not null,
  quoted_price numeric,
  status text not null check (status in
    ('pending','accepted','outsourced','rejected','done','cancelled')) default 'pending',
  partner_id uuid references partners(id),
  outsource_cost numeric,
  start_date date,
  finish_date date,
  verdict jsonb,
  created_at timestamptz default now(),
  decided_at timestamptz,
  completed_at timestamptz
);

create index if not exists orders_tailor_status_idx on orders (tailor_id, status);

-- === RLS ===
-- Backend pakai service key (bypass RLS). Anon key hanya boleh SELECT untuk dashboard.
alter table tailors enable row level security;
alter table item_types enable row level security;
alter table partners enable row level security;
alter table orders enable row level security;

-- Kebijakan read-only untuk anon (dashboard). Hapus bila memilih endpoint Express.
drop policy if exists anon_read_orders on orders;
create policy anon_read_orders on orders for select to anon using (true);
drop policy if exists anon_read_tailors on tailors;
create policy anon_read_tailors on tailors for select to anon using (true);
drop policy if exists anon_read_items on item_types;
create policy anon_read_items on item_types for select to anon using (true);
