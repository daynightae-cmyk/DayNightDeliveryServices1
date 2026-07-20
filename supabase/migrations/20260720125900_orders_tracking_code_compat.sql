-- DAY NIGHT DELIVERY SERVICES
-- Compatibility required by shared merchant/driver tracking and notification UI.

begin;

alter table public.orders add column if not exists tracking_code text;

update public.orders
set tracking_code = coalesce(tracking_code, tracking_number, invoice_number, coupon_number)
where tracking_code is null;

create index if not exists idx_orders_tracking_code
  on public.orders(tracking_code)
  where tracking_code is not null;

commit;
