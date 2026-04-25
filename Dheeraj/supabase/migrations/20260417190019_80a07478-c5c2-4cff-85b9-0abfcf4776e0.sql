-- ROLES
create type public.app_role as enum ('admin', 'staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare user_count int;
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  select count(*) into user_count from public.user_roles;
  if user_count = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'staff');
  end if;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- DOMAIN TABLES
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  address text,
  last_booking date,
  total_bookings int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  total_quantity int not null check (total_quantity >= 0),
  available_quantity int not null check (available_quantity >= 0),
  price numeric(12,2) not null check (price >= 0),
  image text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (available_quantity <= total_quantity)
);

create table public.function_types (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text,
  created_at timestamptz default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  role text check (role in ('Delivery','Installation','Support')),
  address text,
  status text default 'Active' check (status in ('Active','Inactive')),
  created_at timestamptz default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric(12,2) not null check (amount > 0),
  category text,
  description text,
  payment_method text check (payment_method in ('Cash','UPI','Bank Transfer')),
  attachments text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create sequence public.booking_id_seq start 1;
create or replace function public.next_booking_id()
returns text language sql as $$
  select 'SS-' || lpad(nextval('public.booking_id_seq')::text, 3, '0')
$$;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null unique default public.next_booking_id(),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  phone text not null,
  address text not null,
  function_type_id uuid references public.function_types(id) on delete set null,
  start_date date not null,
  end_date date not null,
  items jsonb default '[]'::jsonb,
  pricing jsonb default '{}'::jsonb,
  payments jsonb default '[]'::jsonb,
  total_paid numeric(12,2) default 0,
  remaining_amount numeric(12,2) default 0,
  payment_status text default 'Unpaid' check (payment_status in ('Unpaid','Partial','Paid')),
  delivery_team uuid[],
  delivery_person text,
  delivery_status text default 'Pending' check (delivery_status in ('Pending','Out for Delivery','Delivered','Returned')),
  delivery_date date,
  return_team uuid[],
  return_date date,
  item_checklist jsonb default '[]'::jsonb,
  missing_items text,
  damage_notes text,
  status text default 'Incoming' check (status in ('Incoming','Confirmed','Ready','Out for Delivery','Delivered','Returned','Late Return','Partially Returned')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (start_date <= end_date)
);
create index bookings_dates_idx on public.bookings (start_date, end_date);
create index bookings_phone_idx on public.bookings (phone);
create index bookings_status_idx on public.bookings (status);

create table public.order_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique default replace(gen_random_uuid()::text,'-',''),
  customer_name text,
  phone text,
  address text,
  event_date date,
  items jsonb default '[]'::jsonb,
  status text default 'Active' check (status in ('Active','Pending','Submitted')),
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);
create index order_sessions_sid_idx on public.order_sessions (session_id);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  module text not null,
  description text,
  user_id uuid references auth.users(id) on delete set null,
  changes jsonb,
  created_at timestamptz default now()
);

create table public.vendor_transactions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  type text not null check (type in ('borrow','return')),
  items jsonb not null,
  notes text,
  created_at timestamptz default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  for t in select unnest(array['profiles','customers','categories','inventory_items','vendors','expenses','bookings']) loop
    execute format('create trigger trg_touch_%I before update on public.%I for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.customers enable row level security;
alter table public.categories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.function_types enable row level security;
alter table public.vendors enable row level security;
alter table public.workers enable row level security;
alter table public.expenses enable row level security;
alter table public.bookings enable row level security;
alter table public.order_sessions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.vendor_transactions enable row level security;

create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

create policy "view own roles" on public.user_roles for select using (auth.uid() = user_id or public.is_admin());
create policy "admin manage roles" on public.user_roles for all using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  for t in select unnest(array[
    'customers','categories','inventory_items','function_types','vendors',
    'workers','expenses','bookings','activity_logs','vendor_transactions'
  ]) loop
    execute format('create policy "auth read %1$I" on public.%1$I for select to authenticated using (true);', t);
    execute format('create policy "auth insert %1$I" on public.%1$I for insert to authenticated with check (true);', t);
    execute format('create policy "auth update %1$I" on public.%1$I for update to authenticated using (true);', t);
    execute format('create policy "admin delete %1$I" on public.%1$I for delete to authenticated using (public.is_admin());', t);
  end loop;
end $$;

create policy "public read inventory" on public.inventory_items for select to anon using (true);
create policy "public read categories" on public.categories for select to anon using (true);
create policy "public read function_types" on public.function_types for select to anon using (true);
create policy "public read sessions" on public.order_sessions for select to anon using (true);
create policy "public update sessions" on public.order_sessions for update to anon using (true);
create policy "auth manage sessions" on public.order_sessions for all to authenticated using (true) with check (true);
create policy "anon submit booking" on public.bookings for insert to anon with check (status = 'Incoming');