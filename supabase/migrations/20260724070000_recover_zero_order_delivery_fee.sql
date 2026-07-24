-- DAY NIGHT DELIVERY SERVICES
-- Final zero-order settlement rule.
--
-- Any order whose goods/customer value is zero is not free for the merchant.
-- The delivery fee is charged fully to the merchant. Older rows sometimes
-- stored 0 in company_revenue/delivery_fee while another price column held the
-- real fee. We recover the largest stored fee; when every historical price
-- field is zero, DAY NIGHT's approved fallback for this workflow is 180 AED.

begin;

with recoverable as (
  select
    id,
    greatest(
      coalesce(delivery_fee, 0),
      coalesce(delivery_price, 0),
      coalesce(manual_delivery_price, 0),
      coalesce(base_price, 0),
      coalesce(company_revenue, 0),
      coalesce(price, 0),
      coalesce(
        nullif(
          substring(coalesce(notes, '') from '(?i)Delivery fee[[:space:]]+([0-9]+(?:\.[0-9]+)?)'),
          ''
        )::numeric,
        0
      ),
      180
    )::numeric(14,2) as effective_fee
  from public.orders
  where coalesce(goods_value, product_value, merchant_goods_value, 0) = 0
    and coalesce(customer_total, total_amount, total, collected_amount, 0) = 0
    and financial_posted_at is null
)
update public.orders o
set delivery_fee = r.effective_fee,
    delivery_price = r.effective_fee,
    base_price = r.effective_fee,
    company_revenue = r.effective_fee,
    delivery_fee_mode = 'deduct_from_merchant',
    customer_total = 0,
    cod_amount = 0,
    subtotal = 0,
    total = 0,
    total_price = 0,
    amount = 0,
    merchant_due = -r.effective_fee,
    updated_at = now()
from recoverable r
where o.id = r.id
  and (
    coalesce(o.merchant_due, 0) <> -r.effective_fee
    or coalesce(o.delivery_fee, 0) <> r.effective_fee
    or coalesce(o.delivery_fee_mode, '') <> 'deduct_from_merchant'
  );

commit;
