-- Phase 6. Run AFTER 005_phase5.sql (Supabase > SQL Editor > paste > Run).
-- Free gifts (socks and caps) get their own stock, shown in Admin > Inventory > Free gifts.
-- Safe to run more than once.
create table if not exists gift_items (
  item text primary key check (item in ('socks', 'cap')),
  label text not null,
  low_stock_at int not null default 10
);
insert into gift_items (item, label, low_stock_at) values ('socks', 'Socks (pairs)', 10), ('cap', 'Caps', 10) on conflict (item) do nothing;

create table if not exists gift_movements (
  id uuid primary key default gen_random_uuid(),
  item text not null references gift_items(item),
  order_id uuid references orders(id),
  delta int not null,
  reason text not null check (reason in ('order', 'restock', 'adjust', 'return')),
  note text,
  admin_id uuid references administrators(id),
  created_at timestamptz not null default now()
);
create unique index if not exists one_gift_per_order_item on gift_movements (order_id, item) where reason = 'order';

create or replace view gift_stock with (security_invoker = true) as
  select g.*, coalesce(sum(m.delta), 0)::int as stock
  from gift_items g left join gift_movements m on m.item = g.item group by g.item;

-- Called when an order is paid: one movement per order and item, ever.
create or replace function deduct_gifts(p_order uuid, p_socks int, p_caps int) returns void language sql as $$
  insert into gift_movements (item, order_id, delta, reason)
  select x.item, p_order, -x.n, 'order' from (values ('socks', p_socks), ('cap', p_caps)) as x(item, n) where x.n > 0
  on conflict (order_id, item) where reason = 'order' do nothing;
$$;

alter table gift_items enable row level security;
alter table gift_movements enable row level security;

-- The promo WhatsApp template used to mention a "free gift"; update it if you have not edited it.
update whatsapp_templates
  set body = 'Hello {{customer_name}}, this is LOFT. Our offers: 1 jogger ₦20,499 with a free pair of socks; 2 for ₦38,999 with 2 pairs of socks; buy 3 get 1 cap free; buy 5 get 2 caps free. Reply here to order.'
  where body like '%2 for ₦38,999 with a free gift%';
