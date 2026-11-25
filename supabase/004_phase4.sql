-- Phase 4. Run AFTER 003_phase3.sql. External order backup log, funnel events, duplicates, campaigns, unsubscribe.
alter table orders add column if not exists session_id text;
alter table customers add column if not exists opted_out_at timestamptz;

create table backup_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  event text not null,                       -- ORDER_CREATED or PAID
  status text not null default 'queued',     -- queued | sent | failed
  attempts int not null default 0, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (order_id, event)
);
create table analytics_events (
  id bigint generated always as identity primary key,
  session text not null, event text not null, props jsonb,
  created_at timestamptz not null default now()
);
create index on analytics_events (created_at);
create table duplicate_dismissals (
  a uuid not null references customers(id) on delete cascade, b uuid not null references customers(id) on delete cascade,
  primary key (a, b)
);
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null, body text not null,
  recipients int not null default 0, sent int not null default 0, failed int not null default 0,
  admin_id uuid references administrators(id), created_at timestamptz not null default now()
);
alter table backup_log enable row level security; alter table analytics_events enable row level security;
alter table duplicate_dismissals enable row level security; alter table campaigns enable row level security;
