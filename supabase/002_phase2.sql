-- Phase 2. Run AFTER schema.sql. Inventory, refunds, settlements, tracking, WhatsApp templates.
alter table orders add column if not exists courier text, add column if not exists tracking_number text,
  add column if not exists tracking_url text, add column if not exists estimated_delivery date;

-- Stock is the sum of movements. A variant that is not listed here is simply not tracked (never blocks a sale).
create table variants (
  id uuid primary key default gen_random_uuid(),
  size text not null, colour text not null,
  low_stock_at int not null default 5,
  unique (size, colour)
);
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references variants(id),
  order_id uuid references orders(id),
  order_item_id uuid references order_items(id),
  delta int not null,
  reason text not null check (reason in ('sale','restock','adjust','return')),
  note text, admin_id uuid references administrators(id),
  created_at timestamptz not null default now()
);
create unique index one_sale_per_item on inventory_movements (order_item_id) where reason = 'sale';
create view variant_stock with (security_invoker = true) as
  select v.*, coalesce(sum(m.delta), 0)::int as stock
  from variants v left join inventory_movements m on m.variant_id = v.id group by v.id;
-- Safe to call repeatedly (webhook retries, manual mark-paid): one sale movement per order item, ever.
create or replace function deduct_stock(p_order uuid) returns void language sql as $$
  insert into inventory_movements (variant_id, order_id, order_item_id, delta, reason)
  select v.id, p_order, i.id, -1, 'sale' from order_items i
  join variants v on v.size = i.size and v.colour = i.colour where i.order_id = p_order
  on conflict (order_item_id) where reason = 'sale' do nothing;
$$;

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  payment_id uuid not null references payments(id),
  amount_kobo bigint not null check (amount_kobo > 0),
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  paystack_refund_id text, reason text,
  admin_id uuid references administrators(id),
  created_at timestamptz not null default now(), processed_at timestamptz
);
create table settlements (
  id uuid primary key default gen_random_uuid(),
  paystack_id text not null unique,
  status text, total_amount_kobo bigint, effective_amount_kobo bigint, fees_kobo bigint,
  settlement_date timestamptz, raw jsonb,
  created_at timestamptz not null default now()
);
create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'order' check (category in ('order','followup','promo')),
  body text not null, sort int not null default 100,
  updated_at timestamptz not null default now()
);
alter table variants enable row level security;
alter table inventory_movements enable row level security;
alter table refunds enable row level security;
alter table settlements enable row level security;
alter table whatsapp_templates enable row level security;

insert into whatsapp_templates (name, category, sort, body) values
('Order received','order',10,'Hello {{customer_name}}, thank you for placing order {{order_number}} with LOFT. We are getting your order ready and will keep you updated. Thank you for choosing LOFT.'),
('Payment confirmation','order',20,'Hello {{customer_name}}, we have confirmed your payment of {{order_amount}} for order {{order_number}}. Thank you!'),
('Payment reminder','order',30,'Hello {{customer_name}}, this is LOFT. Your order {{order_number}} ({{order_amount}}) is still awaiting payment. Let us know if you need any help completing it.'),
('Order processing','order',40,'Hello {{customer_name}}, your LOFT order {{order_number}} is now being prepared.'),
('Ready for dispatch','order',50,'Hello {{customer_name}}, your LOFT order {{order_number}} is packed and ready for dispatch to {{delivery_address}}.'),
('Dispatched','order',60,'Hello {{customer_name}}, your LOFT order {{order_number}} has been dispatched. {{tracking_info}}'),
('Delivery follow-up','followup',70,'Hello {{customer_name}}, this is LOFT. We hope order {{order_number}} reached you well. How are you finding your joggers?'),
('Customer appreciation','followup',80,'Hello {{customer_name}}, thank you for shopping with LOFT. We appreciate you.'),
('Promotional offer','promo',90,'Hello {{customer_name}}, this is LOFT. Our offers: 1 jogger ₦20,499; 2 for ₦38,999 with a free gift; buy 3 get 1 cap free; buy 5 get 2 caps free. Reply here to order.');
