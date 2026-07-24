-- DAY NIGHT DELIVERY SERVICES
-- Zero-value merchant orders always charge the full delivery fee to the merchant.
--
-- Business rule:
--   goods_value = 0 and delivery_fee > 0
--   customer_total = 0
--   merchant_due = -delivery_fee
--   delivery_fee_mode = deduct_from_merchant

begin;

create or replace function public.daynight_calculate_order_financials(
  p_goods_value numeric,
  p_delivery_fee numeric,
  p_discount_amount numeric default 0,
  p_delivery_fee_mode text default 'customer_pays'
)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_goods numeric(14,2) := round(greatest(coalesce(p_goods_value, 0), 0), 2);
  v_fee numeric(14,2) := round(greatest(coalesce(p_delivery_fee, 0), 0), 2);
  v_discount numeric(14,2) := round(greatest(coalesce(p_discount_amount, 0), 0), 2);
  v_mode text := lower(replace(coalesce(nullif(btrim(p_delivery_fee_mode), ''), 'customer_pays'), '-', '_'));
  v_customer_total numeric(14,2);
  v_merchant_due numeric(14,2);
begin
  if v_mode in ('merchant_pays', 'sender_pays') then
    v_mode := 'deduct_from_merchant';
  end if;

  -- Authoritative DAY NIGHT rule: a zero-value order is never displayed as
  -- "due to merchant 0". Its full delivery fee belongs on the merchant account.
  if v_goods = 0 and v_fee > 0 then
    v_mode := 'deduct_from_merchant';
  end if;

  if v_mode not in ('customer_pays', 'deduct_from_merchant') then
    v_mode := 'customer_pays';
  end if;

  if v_mode = 'customer_pays' then
    if v_discount > v_goods + v_fee then
      raise exception 'discount_exceeds_customer_total';
    end if;
    v_customer_total := round(v_goods + v_fee - v_discount, 2);
    v_merchant_due := round(v_goods - v_discount, 2);
  else
    if v_discount > v_goods then
      raise exception 'discount_exceeds_goods_value';
    end if;
    v_customer_total := round(v_goods - v_discount, 2);
    v_merchant_due := round(v_goods - v_discount - v_fee, 2);
  end if;

  return jsonb_build_object(
    'goods_value', v_goods,
    'delivery_fee', v_fee,
    'discount_amount', v_discount,
    'delivery_fee_mode', v_mode,
    'customer_total', v_customer_total,
    'merchant_due', v_merchant_due,
    'company_revenue', v_fee
  );
end;
$$;

-- Correct existing orders that have not been financially posted yet.
-- The existing normalization trigger recalculates customer_total and merchant_due.
update public.orders
set delivery_fee_mode = 'deduct_from_merchant',
    updated_at = now()
where coalesce(goods_value, 0) = 0
  and coalesce(delivery_fee, delivery_price, 0) > 0
  and financial_posted_at is null
  and coalesce(delivery_fee_mode, 'customer_pays') <> 'deduct_from_merchant';

revoke all on function public.daynight_calculate_order_financials(numeric, numeric, numeric, text)
from public, anon;
grant execute on function public.daynight_calculate_order_financials(numeric, numeric, numeric, text)
to authenticated;

commit;
