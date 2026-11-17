-- wee-d-liver — core schema, row level security and grants.
-- Model: every write goes through a SECURITY DEFINER RPC that checks the caller.
-- Tables are read-only to API roles, and only through RLS.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- enums ----------
create type public.product_category as enum ('flower', 'concentrate', 'gear');
create type public.id_status        as enum ('unsubmitted', 'pending', 'approved', 'rejected');
create type public.order_status     as enum ('queued', 'assigned', 'en_route', 'arrived', 'delivered', 'failed', 'canceled');
create type public.staff_role       as enum ('owner', 'admin', 'dispatcher');
create type public.payment_method   as enum ('cash', 'debit_at_door');
create type public.invite_kind      as enum ('driver', 'dispatcher', 'admin');

-- ---------- tenants (licensed operators) ----------
create table public.tenants (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name               text not null check (char_length(name) between 2 and 80),
  license_number     text not null check (char_length(license_number) between 3 and 60),
  license_state      char(2) not null check (license_state ~ '^[A-Z]{2}$'),
  timezone           text not null default 'America/New_York',
  open_hour          int  not null default 8  check (open_hour between 0 and 23),
  close_hour         int  not null default 22 check (close_hour between 1 and 24),
  excise_rate        numeric(5,4) not null default 0.1300 check (excise_rate between 0 and 1),
  sales_tax_rate     numeric(5,4) not null default 0.0625 check (sales_tax_rate between 0 and 1),
  delivery_fee_cents int  not null default 500  check (delivery_fee_cents between 0 and 10000),
  min_order_cents    int  not null default 3000 check (min_order_cents between 0 and 100000),
  max_flower_g       numeric(6,2) not null default 28.35 check (max_flower_g > 0),
  max_concentrate_g  numeric(6,2) not null default 8.00  check (max_concentrate_g > 0),
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- Hubs / storefront locations. Exact coordinates are NOT public.
create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 80),
  address    text not null check (char_length(address) between 5 and 200),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  radius_km  numeric(5,1) not null default 15 check (radius_km between 1 and 150),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.locations (tenant_id);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  category    public.product_category not null,
  subcategory text not null check (char_length(subcategory) between 2 and 40),
  name        text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 400),
  strain      text check (strain in ('indica', 'sativa', 'hybrid')),
  thc_pct     numeric(5,2) check (thc_pct between 0 and 100),
  weight_g    numeric(6,2) check (weight_g > 0),
  price_cents int not null check (price_cents between 1 and 1000000),
  sort        int not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  -- cannabis must carry weight for per-order limits; gear must not carry cannabis fields
  constraint cannabis_has_weight check (category = 'gear' or weight_g is not null),
  constraint gear_no_thc check (category <> 'gear' or (thc_pct is null and strain is null))
);
create index on public.products (tenant_id, category, sort);

create table public.location_inventory (
  location_id uuid not null references public.locations(id) on delete cascade,
  product_id  uuid not null references public.products(id)  on delete cascade,
  qty         int  not null default 0 check (qty >= 0),
  primary key (location_id, product_id)
);
create index on public.location_inventory (product_id);

-- ---------- people ----------
create table public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  role       public.staff_role not null,
  name       text not null default '' check (char_length(name) <= 80),
  created_at timestamptz not null default now()
);
create index on public.staff (tenant_id);

create table public.drivers (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  display_name      text not null check (char_length(display_name) between 2 and 40),
  phone             text not null check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  vehicle           text not null default '' check (char_length(vehicle) <= 80),
  status            text not null default 'offline' check (status in ('offline', 'online')),
  lat               double precision check (lat between -90 and 90),
  lng               double precision check (lng between -180 and 180),
  last_seen_at      timestamptz,
  max_active_orders int not null default 3 check (max_active_orders between 1 and 10),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index on public.drivers (tenant_id, status);

create table public.driver_inventory (
  driver_id  uuid not null references public.drivers(user_id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty        int  not null default 0 check (qty >= 0),
  primary key (driver_id, product_id)
);
create index on public.driver_inventory (product_id);

create table public.customers (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  full_name        text not null check (char_length(full_name) between 2 and 80),
  phone            text not null check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  dob              date not null check (dob > date '1900-01-01'),
  id_status        public.id_status not null default 'unsubmitted',
  id_front_path    text,
  selfie_path      text,
  submitted_at     timestamptz,
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  rejection_reason text check (char_length(rejection_reason) <= 200),
  created_at       timestamptz not null default now()
);
create index on public.customers (tenant_id, id_status);

create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.customers(user_id) on delete cascade,
  label        text not null default 'Home' check (char_length(label) between 1 and 30),
  line1        text not null check (char_length(line1) between 3 and 120),
  line2        text not null default '' check (char_length(line2) <= 60),
  city         text not null check (char_length(city) between 2 and 60),
  state        char(2) not null check (state ~ '^[A-Z]{2}$'),
  zip          text not null check (zip ~ '^[0-9]{5}(-[0-9]{4})?$'),
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  instructions text not null default '' check (char_length(instructions) <= 200),
  created_at   timestamptz not null default now()
);
create index on public.addresses (user_id);

-- One-time invite codes (only a SHA-256 hash is stored).
create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  kind       public.invite_kind not null,
  label      text not null default '' check (char_length(label) <= 80),
  code_hash  text not null unique,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on public.invites (tenant_id);

-- ---------- orders ----------
create table public.orders (
  id                      uuid primary key default gen_random_uuid(),
  receipt_no              bigint generated always as identity unique,
  tenant_id               uuid not null references public.tenants(id),
  customer_id             uuid not null references public.customers(user_id),
  customer_name           text not null,
  customer_phone          text not null,
  address                 jsonb not null,
  lat                     double precision not null,
  lng                     double precision not null,
  status                  public.order_status not null default 'queued',
  driver_id               uuid references public.drivers(user_id),
  driver_name             text,
  subtotal_cents          int not null check (subtotal_cents >= 0),
  cannabis_subtotal_cents int not null check (cannabis_subtotal_cents >= 0),
  excise_cents            int not null check (excise_cents >= 0),
  sales_tax_cents         int not null check (sales_tax_cents >= 0),
  delivery_fee_cents      int not null check (delivery_fee_cents >= 0),
  total_cents             int not null check (total_cents >= 0),
  payment_method          public.payment_method not null,
  notes                   text not null default '' check (char_length(notes) <= 300),
  id_check_attempts       int not null default 0,
  failed_reason           text,
  cancel_reason           text,
  created_at              timestamptz not null default now(),
  assigned_at             timestamptz,
  en_route_at             timestamptz,
  arrived_at              timestamptz,
  delivered_at            timestamptz,
  closed_at               timestamptz
);
create index on public.orders (tenant_id, status, created_at desc);
create index on public.orders (customer_id, created_at desc);
create index on public.orders (driver_id, status);

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  name             text not null,
  category         public.product_category not null,
  subcategory      text not null,
  weight_g         numeric(6,2),
  unit_price_cents int not null check (unit_price_cents >= 0),
  qty              int not null check (qty between 1 and 20),
  line_total_cents int not null check (line_total_cents >= 0)
);
create index on public.order_items (order_id);
create index on public.order_items (product_id);

create table public.order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  actor      uuid references auth.users(id) on delete set null,
  event      text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.order_events (order_id, created_at);
create index on public.order_events (actor);

-- ---------- marketing ----------
create table public.qr_campaigns (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  code         text not null unique check (code ~ '^[a-z0-9]{6,16}$'),
  label        text not null check (char_length(label) between 2 and 60),
  placement    text not null default '' check (char_length(placement) <= 120),
  scans        int not null default 0,
  last_scan_at timestamptz,
  created_at   timestamptz not null default now()
);
create index on public.qr_campaigns (tenant_id);

-- ---------- audit ----------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  tenant_id  uuid references public.tenants(id) on delete cascade,
  actor      uuid references auth.users(id) on delete set null,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (tenant_id, created_at desc);
create index on public.audit_log (actor);

create table private.rate_limits (
  user_id      uuid not null,
  action       text not null,
  window_start timestamptz not null,
  hits         int not null,
  primary key (user_id, action)
);

-- ---------- helper functions (private schema: not reachable through the API) ----------
create function private.staff_tenant(p_roles public.staff_role[] default null)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.tenant_id from public.staff s
  where s.user_id = auth.uid() and (p_roles is null or s.role = any (p_roles))
$$;

create function private.driver_tenant()
returns uuid language sql stable security definer set search_path = '' as $$
  select d.tenant_id from public.drivers d where d.user_id = auth.uid() and d.active
$$;

create function private.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 6371.0 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create function private.rate_limit(p_action text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = '' as $$
declare v_hits int;
begin
  if auth.uid() is null then return; end if;
  insert into private.rate_limits as r (user_id, action, window_start, hits)
  values (auth.uid(), p_action, now(), 1)
  on conflict (user_id, action) do update set
    hits         = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into v_hits;
  if v_hits > p_max then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
end $$;

-- ---------- row level security ----------
alter table public.tenants            enable row level security;
alter table public.locations          enable row level security;
alter table public.products           enable row level security;
alter table public.location_inventory enable row level security;
alter table public.staff              enable row level security;
alter table public.drivers            enable row level security;
alter table public.driver_inventory   enable row level security;
alter table public.customers          enable row level security;
alter table public.addresses          enable row level security;
alter table public.invites            enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.order_events       enable row level security;
alter table public.qr_campaigns       enable row level security;
alter table public.audit_log          enable row level security;
alter table private.rate_limits       enable row level security;

create policy tenants_read on public.tenants for select to anon, authenticated
  using (active);

create policy products_read on public.products for select to anon, authenticated
  using ((active and exists (select 1 from public.tenants t where t.id = tenant_id and t.active))
         or tenant_id = (select private.staff_tenant()));

create policy locations_read on public.locations for select to authenticated
  using (tenant_id = (select private.staff_tenant()) or tenant_id = (select private.driver_tenant()));

create policy location_inventory_read on public.location_inventory for select to authenticated
  using (exists (select 1 from public.locations l where l.id = location_id
                 and l.tenant_id = (select private.staff_tenant())));

create policy staff_read on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or tenant_id = (select private.staff_tenant()));

create policy drivers_read on public.drivers for select to authenticated
  using (user_id = (select auth.uid()) or tenant_id = (select private.staff_tenant()));

create policy driver_inventory_read on public.driver_inventory for select to authenticated
  using (driver_id = (select auth.uid())
         or exists (select 1 from public.drivers d where d.user_id = driver_id
                    and d.tenant_id = (select private.staff_tenant())));

create policy customers_read on public.customers for select to authenticated
  using (user_id = (select auth.uid()) or tenant_id = (select private.staff_tenant()));

create policy addresses_read on public.addresses for select to authenticated
  using (user_id = (select auth.uid()));

create policy invites_read on public.invites for select to authenticated
  using (tenant_id = (select private.staff_tenant(array['owner','admin']::public.staff_role[])));

create policy orders_read on public.orders for select to authenticated
  using (customer_id = (select auth.uid())
         or driver_id = (select auth.uid())
         or tenant_id = (select private.staff_tenant()));

create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy order_events_read on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy qr_read on public.qr_campaigns for select to authenticated
  using (tenant_id = (select private.staff_tenant()));

create policy audit_read on public.audit_log for select to authenticated
  using (tenant_id = (select private.staff_tenant(array['owner','admin']::public.staff_role[])));

-- ---------- grants: read-only API surface ----------
revoke all on all tables    in schema public  from anon, authenticated;
revoke all on all sequences in schema public  from anon, authenticated;
revoke all on all tables    in schema private from anon, authenticated, public;

grant select on public.tenants, public.products to anon, authenticated;
grant select on public.locations, public.location_inventory, public.staff, public.drivers,
  public.driver_inventory, public.customers, public.addresses, public.orders,
  public.order_items, public.order_events, public.qr_campaigns, public.audit_log to authenticated;
-- invite hashes never leave the database: column-level grant without code_hash
grant select (id, tenant_id, kind, label, expires_at, created_by, used_by, used_at, created_at)
  on public.invites to authenticated;

-- policies call these helpers as the invoking role
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.staff_tenant(public.staff_role[]) to authenticated;
grant execute on function private.driver_tenant() to authenticated;

-- new objects stay locked by default
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
