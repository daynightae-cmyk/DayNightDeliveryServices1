-- DAY NIGHT DELIVERY SERVICES
-- Production hotfix:
-- 1) PostgreSQL ENUM-safe order/merchant status comparisons.
-- 2) Admin can create a real merchant-linked order with zero financial values.
-- 3) A delivered zero-value merchant-paid order stays financially unposted until accounts closes it.
-- 4) Closing the order in accounts posts a 30 AED merchant debit exactly once.

begin;

create extension if not exists pgcrypto;

-- Keep the notification trigger compatible with the production order_status ENUM.
create or replace function public.portal_notify_order_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_order jsonb := to_jsonb(new);
  v_old_order jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_merchant_user uuid;
  v_driver_user uuid;
  v_reference text;
  v_status text;
  v_old_status text;
  v_metadata jsonb;
  v_merchant_id uuid;
  v_driver_id uuid;
begin
  v_reference := coalesce(
    nullif(v_order->>'tracking_number', ''),
    nullif(v_order->>'tracking_code', ''),
    nullif(v_order->>'invoice_number', ''),
    nullif(v_order->>'coupon_number', ''),
    v_order->>'id'
  );
  v_status := lower(coalesce(v_order->>'status', 'pending'));
  v_old_status := case when tg_op = 'UPDATE' then lower(coalesce(v_old_order->>'status', '')) else '' end;

  begin
    v_merchant_id := nullif(v_order->>'merchant_id', '')::uuid;
  exception when others then
    v_merchant_id := null;
  end;

  begin
    v_driver_id := nullif(coalesce(v_order->>'assigned_driver_id', v_order->>'driver_id'), '')::uuid;
  exception when others then
    v_driver_id := null;
  end;

  if v_merchant_id is not null then
    select m.user_id into v_merchant_user
    from public.merchants m
    where m.id = v_merchant_id
    limit 1;
  end if;

  if v_driver_id is not null then
    select d.user_id into v_driver_user
    from public.driver_profiles d
    where d.id = v_driver_id
    limit 1;
  end if;

  v_metadata := jsonb_build_object(
    'order_id', v_order->>'id',
    'tracking_reference', v_reference,
    'status', v_status,
    'merchant_id', v_merchant_id,
    'driver_id', v_driver_id,
    'title_ar', case when tg_op = 'INSERT' then 'تم إنشاء طلب جديد' else 'تم تحديث حالة الطلب' end,
    'message_ar', case when tg_op = 'INSERT'
      then 'تم تسجيل الطلب ' || coalesce(v_reference, '')
      else 'الطلب ' || coalesce(v_reference, '') || ' أصبح بالحالة: ' || v_status
    end
  );

  if tg_op = 'INSERT' then
    perform public.portal_insert_notification(
      v_merchant_user,
      'New order created',
      'Order ' || coalesce(v_reference, '') || ' was created successfully.',
      'order_created',
      v_metadata
    );

    if v_driver_user is not null then
      perform public.portal_insert_notification(
        v_driver_user,
        'New assigned order',
        'Order ' || coalesce(v_reference, '') || ' is assigned to you.',
        'driver_assignment',
        v_metadata
      );
    end if;
  elsif v_status is distinct from v_old_status then
    perform public.portal_insert_notification(
      v_merchant_user,
      'Order status updated',
      'Order ' || coalesce(v_reference, '') || ' is now ' || v_status || '.',
      'order_status',
      v_metadata
    );

    if v_driver_user is not null then
      perform public.portal_insert_notification(
        v_driver_user,
        'Order status updated',
        'Order ' || coalesce(v_reference, '') || ' is now ' || v_status || '.',
        'order_status',
        v_metadata
      );
    end if;
  elsif tg_op = 'UPDATE'
    and coalesce(v_order->>'assigned_driver_id', v_order->>'driver_id', '')
        is distinct from coalesce(v_old_order->>'assigned_driver_id', v_old_order->>'driver_id', '')
    and v_driver_user is not null then
      perform public.portal_insert_notification(
        v_driver_user,
        'New assigned order',
        'Order ' || coalesce(v_reference, '') || ' is assigned to you.',
        'driver_assignment',
        v_metadata
      );
  end if;

  return new;
end;
$$;

-- Admin order creation: cast merchant status to text before lower().
create or replace function public.admin_create_coupon_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_merchant public.merchants%rowtype;
  v_merchant_id uuid := public.admin_safe_uuid(p_order ->> 'merchant_id');
  v_created_at timestamptz := coalesce(public.admin_safe_timestamptz(p_order ->> 'created_at'), now());
  v_tracking text := coalesce(
    nullif(btrim(p_order ->> 'tracking_number'), ''),
    nullif(btrim(p_order ->> 'tracking_code'), ''),
    nullif(btrim(p_order ->> 'invoice_number'), ''),
    'DN-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );
  v_payment_method text := lower(coalesce(nullif(btrim(p_order ->> 'payment_method'), ''), 'sender_pays'));
  v_payload jsonb;
  v_columns text;
  v_values text;
  v_saved_merchant_id text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_merchant_id is null then raise exception 'merchant_required'; end if;

  select * into v_merchant
  from public.merchants
  where id = v_merchant_id
    and lower(coalesce(status::text, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
  limit 1;

  if v_merchant.id is null then raise exception 'merchant_not_found_or_inactive'; end if;

  if v_payment_method = 'merchant_pays' then v_payment_method := 'sender_pays'; end if;
  if v_payment_method not in ('sender_pays', 'receiver_pays', 'cod', 'prepaid') then v_payment_method := 'sender_pays'; end if;

  v_payload := jsonb_strip_nulls(
    coalesce(p_order, '{}'::jsonb)
    || jsonb_build_object(
      'tracking_number', v_tracking,
      'tracking_code', v_tracking,
      'invoice_number', coalesce(nullif(btrim(p_order ->> 'invoice_number'), ''), v_tracking),
      'merchant_id', v_merchant.id::text,
      'merchant_name', v_merchant.trade_name,
      'merchant_code', v_merchant.merchant_code,
      'sender_name', v_merchant.trade_name,
      'sender_phone', coalesce(nullif(v_merchant.phone, ''), nullif(p_order ->> 'sender_phone', ''), '971568757331'),
      'sender_city', coalesce(nullif(p_order ->> 'sender_city', ''), nullif(v_merchant.emirate, ''), 'Abu Dhabi'),
      'sender_address', coalesce(nullif(p_order ->> 'sender_address', ''), nullif(v_merchant.pickup_address, ''), nullif(v_merchant.address, ''), 'Abu Dhabi'),
      'receiver_name', nullif(p_order ->> 'receiver_name', ''),
      'receiver_phone', nullif(p_order ->> 'receiver_phone', ''),
      'receiver_city', coalesce(nullif(p_order ->> 'receiver_city', ''), 'Dubai'),
      'receiver_address', nullif(p_order ->> 'receiver_address', ''),
      'package_type', coalesce(nullif(p_order ->> 'package_type', ''), nullif(p_order ->> 'package_description', ''), 'Shipment'),
      'package_description', coalesce(nullif(p_order ->> 'package_description', ''), nullif(p_order ->> 'package_type', ''), 'Shipment'),
      'weight', coalesce(p_order -> 'weight', '1'::jsonb),
      'pieces', coalesce(p_order -> 'pieces', p_order -> 'order_count', '1'::jsonb),
      'order_count', coalesce(p_order -> 'order_count', p_order -> 'pieces', '1'::jsonb),
      'shipping_scope', coalesce(nullif(p_order ->> 'shipping_scope', ''), 'local'),
      'destination_country', nullif(p_order ->> 'destination_country', ''),
      'service_type', coalesce(nullif(p_order ->> 'service_type', ''), 'standard'),
      'payment_method', v_payment_method,
      'status', 'pending',
      'status_history', jsonb_build_array(jsonb_build_object(
        'status', 'pending',
        'date', v_created_at,
        'created_at', v_created_at,
        'note', 'Created from authenticated admin for merchant ' || v_merchant.trade_name
      )),
      'created_by', auth.uid()::text,
      'created_at', v_created_at,
      'updated_at', now()
    )
  );

  select
    string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
    string_agg(format('(jsonb_populate_record(null::public.orders, $1)).%I', c.column_name), ', ' order by c.ordinal_position)
  into v_columns, v_values
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and v_payload ? c.column_name
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_columns, '') is null or nullif(v_values, '') is null then
    raise exception 'orders_schema_has_no_insertable_payload_columns';
  end if;

  execute format('insert into public.orders (%s) select %s returning *', v_columns, v_values)
    using v_payload into r;

  v_saved_merchant_id := to_jsonb(r) ->> 'merchant_id';
  if v_saved_merchant_id is distinct from v_merchant.id::text then
    raise exception 'merchant_link_verification_failed';
  end if;

  return r;
exception when others then
  raise exception using
    message = 'admin_create_coupon_order_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate,
    hint = 'Confirm the signed-in profile role is admin/support and the selected merchant is active.';
end;
$$;

revoke all on function public.admin_create_coupon_order(jsonb) from public, anon;
grant execute on function public.admin_create_coupon_order(jsonb) to authenticated;

-- Zero-value merchant-paid delivered orders are intentionally deferred until Accounts closes them.
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

  v_deferred_zero_merchant :=
    v_status in ('delivered', 'completed', 'complete')
    and v_old_status not in ('delivered', 'completed', 'complete')
    and new.financial_posted_at is null
    and v_payment in ('sender_pays', 'merchant_pays')
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

-- Keep all finance ledgers synchronized, including the legacy merchant statement table.
create or replace function public.daynight_post_delivered_financials()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text := lower(replace(coalesce(new.status::text, ''), '-', '_'));
  v_reference text := coalesce(nullif(new.tracking_number, ''), nullif(new.invoice_number, ''), nullif(new.coupon_number, ''), new.id::text);
  v_merchant_direction text;
  v_merchant_amount numeric(14,2);
  v_merchant_debit numeric(14,2);
  v_merchant_credit numeric(14,2);
begin
  if v_status not in ('delivered', 'completed', 'complete') or new.financial_posted_at is null then
    return new;
  end if;

  insert into public.order_financial_settlements (
    order_id, order_reference, merchant_id, coupon_number,
    goods_value, delivery_fee, discount_amount, delivery_fee_mode,
    customer_total, collected_amount, merchant_due, company_revenue,
    currency, posted_at, posted_by, source_status, snapshot
  ) values (
    new.id::text, v_reference, new.merchant_id, new.coupon_number,
    new.goods_value, new.delivery_fee, new.discount_amount, new.delivery_fee_mode,
    new.customer_total, new.collected_amount, new.merchant_due, new.company_revenue,
    coalesce(new.currency, 'AED'), new.financial_posted_at, auth.uid(), v_status, to_jsonb(new)
  ) on conflict (order_id) do update set
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
    posted_at = excluded.posted_at,
    posted_by = excluded.posted_by,
    source_status = excluded.source_status,
    snapshot = excluded.snapshot;

  v_merchant_direction := case when new.merchant_due < 0 then 'debit' else 'credit' end;
  v_merchant_amount := abs(new.merchant_due);
  v_merchant_debit := case when new.merchant_due < 0 then abs(new.merchant_due) else 0 end;
  v_merchant_credit := case when new.merchant_due >= 0 then new.merchant_due else 0 end;

  insert into public.financial_account_entries (
    order_id, order_reference, merchant_id, account_type, entry_type,
    direction, amount, currency, notes, posted_at
  ) values (
    new.id::text, v_reference, new.merchant_id, 'merchant', 'delivered_order_settlement',
    v_merchant_direction, v_merchant_amount, coalesce(new.currency, 'AED'),
    'Merchant due from delivered order after delivery fee and discount', new.financial_posted_at
  ) on conflict (order_id, account_type, entry_type) do update set
    order_reference = excluded.order_reference,
    merchant_id = excluded.merchant_id,
    direction = excluded.direction,
    amount = excluded.amount,
    currency = excluded.currency,
    notes = excluded.notes,
    posted_at = excluded.posted_at;

  insert into public.financial_account_entries (
    order_id, order_reference, merchant_id, account_type, entry_type,
    direction, amount, currency, notes, posted_at
  ) values (
    new.id::text, v_reference, new.merchant_id, 'company', 'delivered_order_settlement',
    'credit', new.company_revenue, coalesce(new.currency, 'AED'),
    'DAY NIGHT delivery revenue from delivered order', new.financial_posted_at
  ) on conflict (order_id, account_type, entry_type) do update set
    order_reference = excluded.order_reference,
    merchant_id = excluded.merchant_id,
    direction = excluded.direction,
    amount = excluded.amount,
    currency = excluded.currency,
    notes = excluded.notes,
    posted_at = excluded.posted_at;

  if to_regclass('public.merchant_statement_entries') is not null and new.merchant_id is not null then
    update public.merchant_statement_entries
    set tracking_number = v_reference,
        entry_date = new.financial_posted_at::date,
        debit = v_merchant_debit,
        credit = v_merchant_credit,
        balance = new.merchant_due,
        status = 'posted',
        notes = 'Delivered order accounting close: DAY NIGHT delivery fee',
        updated_at = now()
    where order_id = new.id
      and entry_type = 'delivered_order_settlement';

    if not found then
      insert into public.merchant_statement_entries(
        merchant_id, order_id, tracking_number, entry_date, entry_type,
        debit, credit, balance, status, notes, created_by, created_at, updated_at
      ) values (
        new.merchant_id, new.id, v_reference, new.financial_posted_at::date, 'delivered_order_settlement',
        v_merchant_debit, v_merchant_credit, new.merchant_due, 'posted',
        'Delivered order accounting close: DAY NIGHT delivery fee', auth.uid(), now(), now()
      );
    end if;
  end if;

  return new;
end;
$$;

-- Explicit Accounts action: close a delivered order and debit the merchant 30 AED by default.
create or replace function public.admin_close_merchant_order_accounting(
  p_order_id uuid,
  p_delivery_fee numeric default 30
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_status text;
  v_fee numeric(14,2) := case when coalesce(p_delivery_fee, 0) <= 0 then 30 else round(p_delivery_fee, 2) end;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;

  select * into r from public.orders where id = p_order_id for update;
  if r.id is null then raise exception 'order_not_found'; end if;

  v_status := lower(replace(coalesce(r.status::text, ''), '-', '_'));
  if v_status not in ('delivered', 'completed', 'complete') then
    raise exception 'order_must_be_delivered_before_accounting_close';
  end if;

  -- A legitimate non-zero posting is already final and must not be duplicated.
  if r.financial_posted_at is not null
     and (coalesce(r.delivery_fee, 0) <> 0 or coalesce(r.merchant_due, 0) <> 0 or coalesce(r.company_revenue, 0) <> 0) then
    return r;
  end if;

  -- Repair a previous zero posting safely before applying the real 30 AED close.
  if r.financial_posted_at is not null then
    delete from public.order_financial_settlements where order_id = r.id::text;
    delete from public.financial_account_entries where order_id = r.id::text and entry_type = 'delivered_order_settlement';
    delete from public.merchant_statement_entries where order_id = r.id and entry_type = 'delivered_order_settlement';
    update public.orders set financial_posted_at = null, updated_at = now() where id = r.id returning * into r;
  end if;

  update public.orders
  set delivery_fee = v_fee,
      delivery_price = v_fee,
      base_price = v_fee,
      delivery_fee_mode = 'deduct_from_merchant',
      collected_amount = 0,
      financial_posted_at = now(),
      updated_at = now()
  where id = r.id
  returning * into r;

  return r;
exception when others then
  raise exception using
    message = 'admin_close_merchant_order_accounting_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate,
    hint = 'The order must be delivered and linked to a real merchant. The default merchant charge is 30 AED.';
end;
$$;

revoke all on function public.admin_close_merchant_order_accounting(uuid, numeric) from public, anon;
grant execute on function public.admin_close_merchant_order_accounting(uuid, numeric) to authenticated;

create or replace function public.zero_order_accounting_hotfix_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_create_coupon_order(jsonb)') is not null
      and to_regprocedure('public.admin_close_merchant_order_accounting(uuid,numeric)') is not null
      and to_regprocedure('public.portal_notify_order_lifecycle()') is not null,
    'admin_create_order_ready', to_regprocedure('public.admin_create_coupon_order(jsonb)') is not null,
    'merchant_accounting_close_ready', to_regprocedure('public.admin_close_merchant_order_accounting(uuid,numeric)') is not null,
    'default_merchant_delivery_fee', 30,
    'zero_orders_wait_for_accounts_close', true
  );
$$;

revoke all on function public.zero_order_accounting_hotfix_health() from public, anon;
grant execute on function public.zero_order_accounting_hotfix_health() to authenticated;

notify pgrst, 'reload schema';

commit;
