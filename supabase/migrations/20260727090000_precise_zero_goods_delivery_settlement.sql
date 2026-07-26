-- DAY NIGHT DELIVERY SERVICES
-- Precise zero-goods / zero-delivery settlement split.
--
-- Required matrix:
--   goods 0  + delivery 25 + customer_pays       => customer_total 25, merchant_due 0
--   goods 0  + entered delivery 0                => official fee applies,
--                                                   customer_total 0, merchant_due -fee
--   goods 50 + delivery 25 + customer_pays       => customer_total 75, merchant_due 50
--
-- The frontend preserves an explicitly entered manual zero in
-- manual_delivery_price=0 while using the official system delivery fee.

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

-- Only rows with an explicit manual-price marker can be corrected without
-- guessing historical operator intent. Null historical markers are left intact.
with candidates as (
  select
    o.id,
    case
      when coalesce(o.manual_delivery_price, -1) = 0 then 'deduct_from_merchant'
      when coalesce(o.manual_delivery_price, 0) > 0 then 'customer_pays'
      else coalesce(o.delivery_fee_mode, 'customer_pays')
    end as resolved_mode,
    public.daynight_calculate_order_financials(
      coalesce(o.goods_value, 0),
      coalesce(o.delivery_fee, o.delivery_price, 0),
      coalesce(o.discount_amount, 0),
      case
        when coalesce(o.manual_delivery_price, -1) = 0 then 'deduct_from_merchant'
        when coalesce(o.manual_delivery_price, 0) > 0 then 'customer_pays'
        else coalesce(o.delivery_fee_mode, 'customer_pays')
      end
    ) as financials
  from public.orders o
  where coalesce(o.goods_value, 0) = 0
    and o.manual_delivery_price is not null
    and o.financial_posted_at is null
)
update public.orders o
set
  delivery_fee_mode = c.resolved_mode,
  customer_total = (c.financials->>'customer_total')::numeric,
  merchant_due = (c.financials->>'merchant_due')::numeric,
  company_revenue = (c.financials->>'company_revenue')::numeric,
  subtotal = (c.financials->>'customer_total')::numeric,
  total = (c.financials->>'customer_total')::numeric,
  total_price = (c.financials->>'customer_total')::numeric,
  amount = (c.financials->>'customer_total')::numeric,
  price = (c.financials->>'customer_total')::numeric,
  updated_at = now()
from candidates c
where o.id = c.id;

revoke all on function public.daynight_calculate_order_financials(numeric, numeric, numeric, text)
from public, anon;
grant execute on function public.daynight_calculate_order_financials(numeric, numeric, numeric, text)
to authenticated;

notify pgrst, 'reload schema';

commit;
