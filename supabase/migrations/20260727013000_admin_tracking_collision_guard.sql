-- DAY NIGHT DELIVERY SERVICES
-- Prevent SQLSTATE 23505 on orders_tracking_number_key when an admin reuses a
-- coupon number. Coupon numbers are business references; tracking/invoice
-- numbers are generated independently and uniquely by the database.

begin;

create extension if not exists pgcrypto;

create or replace function public.daynight_generate_unique_tracking_number()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracking text;
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_tracking := 'DN-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

    exit when not exists (
      select 1
      from public.orders o
      where o.tracking_number = v_tracking
         or coalesce(to_jsonb(o) ->> 'tracking_code', '') = v_tracking
         or coalesce(to_jsonb(o) ->> 'invoice_number', '') = v_tracking
    );

    if v_attempt >= 20 then
      raise exception 'tracking_generation_exhausted';
    end if;
  end loop;

  return v_tracking;
end;
$$;

revoke all on function public.daynight_generate_unique_tracking_number() from public, anon;
grant execute on function public.daynight_generate_unique_tracking_number() to authenticated;

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
  v_tracking text;
  v_requested_payment text := lower(coalesce(nullif(btrim(p_order ->> 'payment_method'), ''), 'sender_pays'));
  v_payment_method text;
  v_fee_mode text := lower(replace(coalesce(nullif(btrim(p_order ->> 'delivery_fee_mode'), ''), 'customer_pays'), '-', '_'));
  v_payload jsonb;
  v_columns text;
  v_values text;
  v_saved_merchant_id text;
  v_attempt integer;
  v_constraint text;
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

  v_payment_method := case
    when v_requested_payment = 'merchant_pays' then 'sender_pays'
    else v_requested_payment
  end;

  if v_payment_method not in ('sender_pays', 'receiver_pays', 'cod', 'prepaid') then
    v_payment_method := 'sender_pays';
  end if;

  if v_requested_payment in ('merchant_pays', 'sender_pays') then
    v_fee_mode := 'deduct_from_merchant';
  elsif v_fee_mode not in ('customer_pays', 'deduct_from_merchant') then
    v_fee_mode := 'customer_pays';
  end if;

  -- The server owns tracking generation. Never reuse coupon_number,
  -- tracking_number, tracking_code, or invoice_number supplied by the browser.
  for v_attempt in 1..5 loop
    v_tracking := public.daynight_generate_unique_tracking_number();

    v_payload := jsonb_strip_nulls(
      coalesce(p_order, '{}'::jsonb)
      || jsonb_build_object(
        'tracking_number', v_tracking,
        'tracking_code', v_tracking,
        'invoice_number', v_tracking,
        'coupon_number', nullif(btrim(p_order ->> 'coupon_number'), ''),
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
        'delivery_fee_mode', v_fee_mode,
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

    begin
      execute format('insert into public.orders (%s) select %s returning *', v_columns, v_values)
        using v_payload into r;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;

      if v_attempt < 5
         and coalesce(v_constraint, '') ~* '(tracking|invoice)' then
        continue;
      end if;

      raise;
    end;
  end loop;

  if r.id is null then
    raise exception 'admin_order_insert_failed_after_tracking_retries';
  end if;

  v_saved_merchant_id := to_jsonb(r) ->> 'merchant_id';
  if v_saved_merchant_id is distinct from v_merchant.id::text then
    raise exception 'merchant_link_verification_failed';
  end if;

  return r;
exception when others then
  raise exception using
    message = 'admin_create_coupon_order_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate,
    hint = case
      when sqlstate = '23505' then 'A business reference already exists. Tracking is generated automatically; verify whether this coupon should be entered again.'
      else 'Confirm admin/support access, apply the latest migrations, and select an active merchant.'
    end;
end;
$$;

revoke all on function public.admin_create_coupon_order(jsonb) from public, anon;
grant execute on function public.admin_create_coupon_order(jsonb) to authenticated;

commit;
