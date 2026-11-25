-- Phase 3. Run AFTER 002_phase2.sql. Settings, DB-driven offers, follow-ups, notifications, activity log, email templates, staff control.
alter table administrators add column if not exists active boolean not null default true;

create table settings (key text primary key, value text not null default '', updated_at timestamptz not null default now());
insert into settings (key, value) values ('delivery_fee_naira',''),('high_value_naira','100000'),('inactive_days','60'),('followup_days','3');

create table offers (
  q int primary key, price_kobo bigint not null check (price_kobo > 0),
  free_text text not null default '',   -- recorded on the order (e.g. "1 free cap")
  label text not null default '',       -- short text on the storefront card
  tag text not null default '',         -- badge, e.g. "1 CAP FREE"
  cap boolean not null default false,   -- show the cap picture on the card
  active boolean not null default true, starts_at timestamptz, ends_at timestamptz
);
insert into offers (q, price_kobo, free_text, label, tag, cap) values
 (1, 2049900, '', '', '', false),
 (2, 3899900, 'A free gift (LOFT confirms which)', 'A free gift', 'FREE GIFT', false),
 (3, 6149700, '1 free cap', '1 free cap', '1 CAP FREE', true),
 (5, 10249500, '2 free caps', '2 free caps', '2 CAPS FREE', true);

create table follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id), order_id uuid references orders(id) unique,
  status text not null default 'not_contacted' check (status in ('not_contacted','contact_initiated','follow_up_required','completed','not_interested')),
  due_date date not null, notes text, admin_id uuid references administrators(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null, title text not null, body text, link text,
  dedupe_key text unique, read_at timestamptz, read_by uuid references administrators(id),
  created_at timestamptz not null default now()
);
create table admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references administrators(id), action text not null, entity text, entity_id text, detail text,
  created_at timestamptz not null default now()
);
create table email_templates (
  type text primary key, subject text, line text, active boolean not null default true, updated_at timestamptz not null default now()
);
alter table settings enable row level security; alter table offers enable row level security;
alter table follow_up_tasks enable row level security; alter table notifications enable row level security;
alter table admin_activity_logs enable row level security; alter table email_templates enable row level security;
