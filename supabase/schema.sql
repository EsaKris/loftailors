-- LOFT database. Run once in Supabase > SQL Editor.
-- All money is stored as integer kobo. Timestamps are UTC.
create extension if not exists pgcrypto;
create sequence if not exists order_seq start 1001;

create table administrators (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null check (role in ('super','staff')),
  permissions jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_e164 text not null unique,
  whatsapp_e164 text,
  email text,
  address text, city text, state text,
  marketing_consent boolean not null default false,
  consent_at timestamptz, consent_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('LOFT-' || lpad(nextval('order_seq')::text, 6, '0')),
  customer_id uuid not null references customers(id),
  channel text not null check (channel in ('card','whatsapp')),
  pack_qty int not null,
  subtotal_kobo bigint not null,
  delivery_kobo bigint,
  total_kobo bigint not null,
  free_items text,
  payment_status text not null default 'pending' check (payment_status in ('pending','successful','failed','abandoned','refunded','partially_refunded')),
  order_status text not null default 'new' check (order_status in ('new','payment_pending','payment_confirmed','processing','ready_for_dispatch','dispatched','delivered','cancelled','refunded')),
  delivery_address text, city text, state text,
  customer_note text, internal_notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders (customer_id);
create index on orders (created_at desc);
create index on orders (payment_status, order_status);
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product text not null default 'LOFT Joggers',
  size text not null, colour text not null
);
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  provider text not null default 'paystack',
  reference text not null unique,
  amount_kobo bigint not null,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','successful','failed','abandoned','refunded','partially_refunded')),
  channel text, fees_kobo bigint, paid_at timestamptz,
  recorded_by uuid references administrators(id),
  raw jsonb,
  created_at timestamptz not null default now()
);
create table webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null unique,   -- idempotency: duplicate deliveries are ignored
  event_type text, payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create table email_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  customer_id uuid references customers(id),
  type text not null, to_email text not null, subject text,
  status text not null default 'queued',
  provider_id text, error text,
  created_at timestamptz not null default now(),
  unique (order_id, type)           -- one email of each type per order
);
create table status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  admin_id uuid references administrators(id),
  from_status text, to_status text, note text,
  created_at timestamptz not null default now()
);
create table communication_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  order_id uuid references orders(id),
  admin_id uuid references administrators(id),
  channel text not null default 'whatsapp',
  template text,
  status text not null default 'prepared' check (status in ('prepared','opened','confirmed_sent')),
  created_at timestamptz not null default now()
);

-- Row Level Security: enabled with NO public policies, so the browser (anon key)
-- can read nothing. The server uses the service-role key, which bypasses RLS.
alter table administrators enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table webhook_events enable row level security;
alter table email_log enable row level security;
alter table status_history enable row level security;
alter table communication_logs enable row level security;

-- After creating your user in Supabase > Authentication > Users, make yourself Super Admin:
-- insert into administrators (id, name, role) values ('<your-auth-user-uuid>', 'Your Name', 'super');
