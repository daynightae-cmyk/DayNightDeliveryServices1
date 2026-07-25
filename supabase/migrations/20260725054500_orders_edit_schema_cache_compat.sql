-- DAY NIGHT DELIVERY SERVICES
-- Restore optional order-edit columns used by the admin editor and reload PostgREST.

begin;

alter table public.orders
  add column if not exists manual_delivery_price numeric;

alter table public.orders
  add column if not exists price_source text default 'system';

alter table public.orders
  add column if not exists coupon_number text;

alter table public.orders
  add column if not exists source_channel text;

alter table public.orders
  add column if not exists source_domain text;

alter table public.orders
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_orders_coupon_number
  on public.orders(coupon_number);

create index if not exists idx_orders_source_channel
  on public.orders(source_channel);

update public.orders
set price_source = coalesce(nullif(price_source, ''), 'system')
where price_source is null or btrim(price_source) = '';

select pg_notify('pgrst', 'reload schema');

commit;
