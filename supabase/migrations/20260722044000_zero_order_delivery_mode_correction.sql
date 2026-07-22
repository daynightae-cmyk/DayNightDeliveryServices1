-- DAY NIGHT DELIVERY SERVICES
-- Follow-up correction: the zero-order deferral is governed by delivery_fee_mode,
-- not only by the collection payment method. This supports a zero-COD order whose
-- delivery fee will be debited from the merchant when Accounts closes it.

begin;

create or replace function public.daynight_normalize_financial_order()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text;
  v_old_status text;
  v_breakdown jsonb;
  v_financial_changed boolean := false;
  v_payment text;
  v_fee_mode text;
  v_deferred_zero_merchant boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_financial_changed :=
      new.goods_value is distinct from old.goods_value
      or new.delivery_fee is distinct from old.delivery_fee
      or new.discount_amount is distinct from old.discount_amount
      or new.delivery_fee_mode is distinct from old.delivery_fee_mode
      or new.customer_total is distinct from old.customer_total
      or new.merchant_due is distinct from old.merchant_due
      or new.company_revenue is distinct from old.company_revenue;

    if old.financial_posted_at is not null and v_financial_changed then
      raise exception 'financials_locked_after_delivery';
    end if;
  end if;

  if coalesce(new.delivery_fee, 0) = 0 and coalesce(new.delivery_price, 0) > 0 then
    new.delivery_fee := round(new.delivery_price::numeric, 2);
  end if;

  v_breakdown := public.daynight_calculate_order_financials(
    new.goods_value,
    new.delivery_fee,
    new.discount_amount,
    new.delivery_fee_mode
  );

  new.goods_value := (v_breakdown ->> 'goods_value')::numeric;
  new.delivery_fee := (v_breakdown ->> 'delivery_fee')::numeric;
  new.discount_amount := (v_breakdown ->> 'discount_amount')::numeric;
  new.delivery_fee_mode := v_breakdown ->> 'delivery_fee_mode';
  new.customer_total := (v_breakdown ->> 'customer_total')::numeric;
  new.merchant_due := (v_breakdown ->> 'merchant_due')::numeric;
  new.company_revenue := (v_breakdown ->> 'company_revenue')::numeric;
  new.financial_version := 1;

  new.delivery_price := new.delivery_fee;
  new.base_price := new.delivery_fee;
  new.subtotal := new.customer_total;
  new.total := new.customer_total;
  new.total_price := new.customer_total;
  new.amount := new.customer_total;
  new.price := new.customer_total;

  if lower(coalesce(new.payment_method::text, '')) = 'cod' then
    new.cod_amount := new.customer_total;
  end if;

  v_status := lower(replace(coalesce(new.status::text, 'pending'), '-', '_'));
  v_old_status := case when tg_op = 'UPDATE' then lower(replace(coalesce(old.status::text, ''), '-', '_')) else '' end;
  v_payment := lower(replace(coalesce(new.payment_method::text, ''), '-', '_'));
  v_fee_mode := lower(replace(coalesce(new.delivery_fee_mode, ''), '-', '_'));

  v_deferred_zero_merchant :=
    v_status in ('delivered', 'completed', 'complete')
    and v_old_status not in ('delivered', 'completed', 'complete')
    and new.financial_posted_at is null
    and (v_fee_mode = 'deduct_from_merchant' or v_payment in ('sender_pays', 'merchant_pays'))
    and coalesce(new.goods_value, 0) = 0
    and coalesce(new.delivery_fee, 0) = 0
    and coalesce(new.discount_amount, 0) = 0
    and coalesce(new.customer_total, 0) = 0;

  if v_status in ('delivered', 'completed', 'complete')
     and v_old_status not in ('delivered', 'completed', 'complete') then
    if v_deferred_zero_merchant then
      new.collected_amount := 0;
      new.financial_posted_at := null;
    else
      new.collected_amount := new.customer_total;
      new.financial_posted_at := coalesce(new.financial_posted_at, now());
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';

commit;
