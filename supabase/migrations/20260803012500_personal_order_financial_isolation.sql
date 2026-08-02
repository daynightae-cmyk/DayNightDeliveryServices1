-- DAY NIGHT DELIVERY SERVICES
-- Personal orders have no merchant owner and therefore no merchant payable.
-- Keep the mature financial normalization for merchant orders unchanged.

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
  v_audited_adjustment boolean := false;
  v_personal_order boolean :=
    lower(coalesce(new.source_channel, '')) = 'admin_personal_order'
    and new.merchant_id is null;
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

    v_audited_adjustment :=
      old.financial_posted_at is not null
      and auth.uid() is not null
      and new.financial_adjusted_by = auth.uid()
      and new.financial_adjusted_at is not null
      and length(btrim(coalesce(new.financial_adjustment_reason, ''))) >= 6
      and public.daynight_admin_or_support();

    if old.financial_posted_at is not null
       and v_financial_changed
       and not v_audited_adjustment then
      raise exception 'financials_locked_after_delivery';
    end if;
  end if;

  if v_personal_order then
    new.goods_value := round(greatest(coalesce(new.goods_value, 0), 0)::numeric, 2);
    new.delivery_fee := 25;
    new.discount_amount := round(greatest(coalesce(new.discount_amount, 0), 0)::numeric, 2);
    if new.discount_amount > new.goods_value + new.delivery_fee then
      raise exception 'discount_exceeds_personal_order_total';
    end if;
    new.delivery_fee_mode := 'customer_pays';
    new.customer_total := round(new.goods_value + new.delivery_fee - new.discount_amount, 2);
    new.merchant_due := 0;
    new.company_revenue := new.delivery_fee;
  else
    if coalesce(new.delivery_fee, 0) = 0
       and coalesce(new.delivery_price, 0) > 0 then
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
  end if;

  if tg_op = 'UPDATE' and v_audited_adjustment then
    new.financial_version := greatest(
      coalesce(new.financial_version, 1),
      coalesce(old.financial_version, 1) + 1
    );
  else
    new.financial_version := coalesce(new.financial_version, 1);
  end if;

  new.delivery_price := new.delivery_fee;
  new.base_price := new.delivery_fee;
  new.subtotal := new.customer_total;
  new.total := new.customer_total;
  new.total_price := new.customer_total;
  new.amount := new.customer_total;
  new.price := new.customer_total;

  if lower(coalesce(new.payment_method::text, '')) in ('cod', 'cash', 'receiver_pays') then
    new.cod_amount := new.customer_total;
  elsif lower(coalesce(new.payment_method::text, '')) in ('prepaid', 'card', 'bank_transfer', 'wallet') then
    new.cod_amount := 0;
  end if;

  v_status := lower(replace(coalesce(new.status::text, 'pending'), '-', '_'));
  v_old_status := case
    when tg_op = 'UPDATE'
      then lower(replace(coalesce(old.status::text, ''), '-', '_'))
    else ''
  end;

  if v_status in ('delivered', 'completed', 'complete')
     and v_old_status not in ('delivered', 'completed', 'complete') then
    new.collected_amount := new.customer_total;
    new.financial_posted_at := coalesce(new.financial_posted_at, now());
  end if;

  if tg_op = 'UPDATE'
     and v_audited_adjustment
     and v_status in ('delivered', 'completed', 'complete') then
    new.collected_amount := new.customer_total;
    new.financial_posted_at := coalesce(old.financial_posted_at, new.financial_posted_at, now());
  end if;

  return new;
end;
$$;

create or replace function public.daynight_post_delivered_financials()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text := lower(replace(coalesce(new.status::text, ''), '-', '_'));
  v_reference text := coalesce(
    nullif(new.tracking_number, ''),
    nullif(new.invoice_number, ''),
    nullif(new.coupon_number, ''),
    new.id::text
  );
  v_merchant_direction text;
  v_merchant_amount numeric(14,2);
  v_personal_order boolean :=
    lower(coalesce(new.source_channel, '')) = 'admin_personal_order'
    and new.merchant_id is null;
begin
  if v_status not in ('delivered', 'completed', 'complete')
     or new.financial_posted_at is null then
    return new;
  end if;

  insert into public.order_financial_settlements (
    order_id,
    order_reference,
    merchant_id,
    coupon_number,
    goods_value,
    delivery_fee,
    discount_amount,
    delivery_fee_mode,
    customer_total,
    collected_amount,
    merchant_due,
    company_revenue,
    currency,
    posted_at,
    posted_by,
    source_status,
    snapshot
  ) values (
    new.id::text,
    v_reference,
    new.merchant_id,
    new.coupon_number,
    new.goods_value,
    new.delivery_fee,
    new.discount_amount,
    new.delivery_fee_mode,
    new.customer_total,
    new.collected_amount,
    new.merchant_due,
    new.company_revenue,
    coalesce(new.currency, 'AED'),
    new.financial_posted_at,
    auth.uid(),
    v_status,
    to_jsonb(new)
  )
  on conflict (order_id)
  do update set
    order_reference = excluded.order_reference,
    merchant_id = excluded.merchant_id,
    coupon_number = excluded.coupon_number,
    goods_value = excluded.goods_value,
    delivery_fee = excluded.delivery_fee,
    discount_amount = excluded.discount_amount,
    delivery_fee_mode = excluded.delivery_fee_mode,
    customer_total = excluded.customer_total,
    collected_amount = excluded.collected_amount,
    merchant_due = excluded.merchant_due,
    company_revenue = excluded.company_revenue,
    currency = excluded.currency,
    source_status = excluded.source_status,
    snapshot = excluded.snapshot;

  if v_personal_order then
    delete from public.financial_account_entries
    where order_id = new.id::text
      and account_type = 'merchant'
      and entry_type = 'delivered_order_settlement';
  else
    v_merchant_direction := case when new.merchant_due < 0 then 'debit' else 'credit' end;
    v_merchant_amount := abs(new.merchant_due);

    insert into public.financial_account_entries (
      order_id,
      order_reference,
      merchant_id,
      account_type,
      entry_type,
      direction,
      amount,
      currency,
      notes,
      posted_at
    ) values (
      new.id::text,
      v_reference,
      new.merchant_id,
      'merchant',
      'delivered_order_settlement',
      v_merchant_direction,
      v_merchant_amount,
      coalesce(new.currency, 'AED'),
      'Merchant due after audited financial correction',
      new.financial_posted_at
    )
    on conflict (order_id, account_type, entry_type)
    do update set
      order_reference = excluded.order_reference,
      merchant_id = excluded.merchant_id,
      direction = excluded.direction,
      amount = excluded.amount,
      currency = excluded.currency,
      notes = excluded.notes;
  end if;

  insert into public.financial_account_entries (
    order_id,
    order_reference,
    merchant_id,
    account_type,
    entry_type,
    direction,
    amount,
    currency,
    notes,
    posted_at
  ) values (
    new.id::text,
    v_reference,
    new.merchant_id,
    'company',
    'delivered_order_settlement',
    'credit',
    new.company_revenue,
    coalesce(new.currency, 'AED'),
    case when v_personal_order
      then 'DAY NIGHT revenue for personal order without merchant'
      else 'DAY NIGHT revenue after audited financial correction'
    end,
    new.financial_posted_at
  )
  on conflict (order_id, account_type, entry_type)
  do update set
    order_reference = excluded.order_reference,
    merchant_id = excluded.merchant_id,
    direction = excluded.direction,
    amount = excluded.amount,
    currency = excluded.currency,
    notes = excluded.notes;

  return new;
end;
$$;

select pg_notify('pgrst', 'reload schema');

commit;
