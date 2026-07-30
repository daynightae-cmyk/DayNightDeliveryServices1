-- DAY NIGHT DELIVERY SERVICES
-- Production repair for Admin -> Orders -> Edit financial save.
--
-- Fixes two interacting failures:
--   1) financial-only edits of legacy rows were rejected by the full required-field
--      guard even when no operational/customer field changed;
--   2) admin_update_order_with_financials depended on the older flexible runtime,
--      which rewrote legacy amount columns before the authoritative calculation and
--      assumed one fixed payment_method representation.
--
-- The replacement is atomic, preserves manual zero as an explicit marker, resolves
-- it to the official 25 AED merchant debit, adapts to text/enum payment columns, and
-- verifies the stored financial result before returning success.

begin;

alter table public.orders
  add column if not exists manual_delivery_price numeric(14,2),
  add column if not exists price_source text default 'system';

-- Full validation is mandatory for inserts and for real operational/core edits.
-- Financial-only, note-only and workflow-only updates on historical rows must not be
-- blocked because an unrelated legacy field is missing.
create or replace function public.dn_guard_admin_order_required_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_payload jsonb := to_jsonb(new);
  v_old_payload jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_source text := lower(btrim(coalesce(v_payload->>'source_channel', '')));
  v_status text := lower(replace(replace(btrim(coalesce(v_payload->>'status', 'pending')), '-', '_'), ' ', '_'));
  v_admin_actor boolean := auth.uid() is not null and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) in ('admin', 'support', 'owner', 'super_admin')
  );
  v_core_changed boolean := tg_op = 'INSERT';
  v_invalid text[];
begin
  if v_status = 'draft' then
    return new;
  end if;

  if v_source <> 'admin_panel' and not v_admin_actor then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_core_changed :=
      coalesce(v_payload->>'merchant_id', '') is distinct from coalesce(v_old_payload->>'merchant_id', '')
      or coalesce(v_payload->>'sender_name', '') is distinct from coalesce(v_old_payload->>'sender_name', '')
      or coalesce(v_payload->>'sender_phone', '') is distinct from coalesce(v_old_payload->>'sender_phone', '')
      or coalesce(v_payload->>'sender_city', '') is distinct from coalesce(v_old_payload->>'sender_city', '')
      or coalesce(v_payload->>'sender_address', '') is distinct from coalesce(v_old_payload->>'sender_address', '')
      or coalesce(v_payload->>'receiver_name', '') is distinct from coalesce(v_old_payload->>'receiver_name', '')
      or coalesce(v_payload->>'receiver_phone', '') is distinct from coalesce(v_old_payload->>'receiver_phone', '')
      or coalesce(v_payload->>'receiver_city', '') is distinct from coalesce(v_old_payload->>'receiver_city', '')
      or coalesce(v_payload->>'receiver_address', '') is distinct from coalesce(v_old_payload->>'receiver_address', '')
      or coalesce(v_payload->>'package_type', v_payload->>'package_description', '')
         is distinct from coalesce(v_old_payload->>'package_type', v_old_payload->>'package_description', '')
      or coalesce(v_payload->>'payment_method', '') is distinct from coalesce(v_old_payload->>'payment_method', '')
      or coalesce(v_payload->>'pieces', v_payload->>'order_count', '')
         is distinct from coalesce(v_old_payload->>'pieces', v_old_payload->>'order_count', '')
      or coalesce(v_payload->>'shipping_scope', '') is distinct from coalesce(v_old_payload->>'shipping_scope', '')
      or coalesce(v_payload->>'destination_country', '') is distinct from coalesce(v_old_payload->>'destination_country', '')
      or coalesce(v_payload->>'service_type', '') is distinct from coalesce(v_old_payload->>'service_type', '');

    if not v_core_changed then
      return new;
    end if;
  end if;

  v_invalid := public.dn_admin_order_invalid_fields(v_payload);
  if coalesce(array_length(v_invalid, 1), 0) > 0 then
    raise log 'DAY_NIGHT_ADMIN_ORDER_BLOCKED actor=% source=% status=% invalid_fields=% reference=%',
      coalesce(auth.uid()::text, 'unknown'),
      coalesce(v_source, 'legacy_direct_insert'),
      v_status,
      array_to_string(v_invalid, ','),
      coalesce(v_payload->>'invoice_number', v_payload->>'tracking_number', v_payload->>'id', 'unassigned');

    raise exception using
      errcode = '23514',
      message = 'admin_order_validation_failed',
      detail = array_to_string(v_invalid, ',');
  end if;

  return new;
end;
$$;

create or replace function public.admin_update_order_with_financials(p_payload jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders%rowtype;
  v_merchant public.merchants%rowtype;
  v_reference text := nullif(btrim(coalesce(p_payload->>'reference', '')), '');
  v_patch jsonb := coalesce(p_payload->'patch', '{}'::jsonb);
  v_financials jsonb := coalesce(p_payload->'financials', '{}'::jsonb);
  v_reason text := coalesce(nullif(btrim(p_payload->>'reason'), ''), 'Updated from admin financial order editor');

  v_goods numeric(14,2) := round(greatest(public.daynight_financial_number(v_financials->>'goods_value', 0), 0), 2);
  v_fee numeric(14,2) := round(greatest(public.daynight_financial_number(v_financials->>'delivery_fee', 0), 0), 2);
  v_discount numeric(14,2) := round(greatest(public.daynight_financial_number(v_financials->>'discount_amount', 0), 0), 2);
  v_mode text := lower(replace(coalesce(nullif(btrim(v_financials->>'delivery_fee_mode'), ''), 'customer_pays'), '-', '_'));
  v_breakdown jsonb;

  v_price_source text := lower(coalesce(nullif(btrim(v_patch->>'price_source'), ''), 'system'));
  v_manual_entered numeric(14,2);
  v_merchant_id uuid;

  v_payment_requested text;
  v_payment_db text;
  v_existing_payment text;
  v_payment_type_oid oid;
  v_payment_type_kind "char";
  v_payment_candidates text[];

  v_set_clause text;
  v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) in ('admin', 'support', 'owner', 'super_admin')
  ) then
    raise exception 'not_authorized';
  end if;
  if v_reference is null then
    raise exception 'order_reference_required';
  end if;

  select o.* into r
  from public.orders o
  where o.id::text = v_reference
     or coalesce(to_jsonb(o)->>'tracking_number', '') = v_reference
     or coalesce(to_jsonb(o)->>'invoice_number', '') = v_reference
     or coalesce(to_jsonb(o)->>'coupon_number', '') = v_reference
  limit 1
  for update;

  if r.id is null then
    raise exception 'order_not_found';
  end if;
  if r.financial_posted_at is not null then
    raise exception 'financials_locked_after_delivery';
  end if;

  begin
    v_merchant_id := coalesce(nullif(v_patch->>'merchant_id', '')::uuid, r.merchant_id);
  exception when invalid_text_representation then
    raise exception 'invalid_merchant_id';
  end;
  if v_merchant_id is null then
    raise exception 'merchant_required';
  end if;

  select m.* into v_merchant
  from public.merchants m
  where m.id = v_merchant_id
    and lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
  limit 1;
  if v_merchant.id is null then
    raise exception 'merchant_not_found_or_inactive';
  end if;

  if v_price_source not in ('system', 'manual') then
    v_price_source := 'system';
  end if;

  if v_price_source = 'manual' then
    begin
      v_manual_entered := round((v_patch->>'manual_delivery_price')::numeric, 2);
    exception when others then
      v_manual_entered := null;
    end;
    if v_manual_entered is null or v_manual_entered < 0 then
      raise exception 'invalid_manual_delivery_price';
    end if;
    if v_manual_entered = 0 then
      v_fee := 25;
      v_mode := 'deduct_from_merchant';
    else
      v_fee := v_manual_entered;
    end if;
  else
    v_manual_entered := null;
  end if;

  if v_mode in ('merchant_pays', 'sender_pays') then
    v_mode := 'deduct_from_merchant';
  end if;
  if v_mode not in ('customer_pays', 'deduct_from_merchant') then
    v_mode := 'customer_pays';
  end if;

  v_payment_requested := lower(replace(coalesce(nullif(btrim(v_patch->>'payment_method'), ''), r.payment_method::text, 'cod'), '-', '_'));
  if v_payment_requested = 'merchant_pays' then
    v_payment_requested := 'sender_pays';
  elsif v_payment_requested = 'cash' then
    v_payment_requested := 'cod';
  elsif v_payment_requested in ('card', 'bank_transfer', 'wallet') then
    v_payment_requested := 'prepaid';
  end if;

  if v_payment_requested = 'sender_pays' then
    v_mode := 'deduct_from_merchant';
  end if;

  v_breakdown := public.daynight_calculate_order_financials(v_goods, v_fee, v_discount, v_mode);
  v_goods := (v_breakdown->>'goods_value')::numeric;
  v_fee := (v_breakdown->>'delivery_fee')::numeric;
  v_discount := (v_breakdown->>'discount_amount')::numeric;
  v_mode := v_breakdown->>'delivery_fee_mode';

  v_existing_payment := nullif(r.payment_method::text, '');
  select a.atttypid, t.typtype
    into v_payment_type_oid, v_payment_type_kind
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.orders'::regclass
    and a.attname = 'payment_method'
    and a.attnum > 0
    and not a.attisdropped;

  v_payment_candidates := case v_payment_requested
    when 'cod' then array['cod', 'cash', 'receiver_pays']
    when 'receiver_pays' then array['receiver_pays', 'cash', 'cod']
    when 'sender_pays' then array['sender_pays', 'merchant_pays', 'prepaid', 'bank_transfer', 'cash', 'cod']
    else array['prepaid', 'bank_transfer', 'card', 'wallet']
  end;

  if v_payment_type_kind = 'e' then
    select e.enumlabel into v_payment_db
    from unnest(v_payment_candidates) with ordinality c(label, position)
    join pg_enum e on e.enumtypid = v_payment_type_oid and e.enumlabel = c.label
    order by c.position
    limit 1;
    v_payment_db := coalesce(v_payment_db, v_existing_payment);
  else
    v_payment_db := coalesce(v_payment_candidates[1], v_existing_payment);
  end if;

  v_patch := v_patch || jsonb_build_object(
    'merchant_id', v_merchant.id,
    'merchant_name', v_merchant.trade_name,
    'merchant_code', coalesce(v_merchant.merchant_code, ''),
    'sender_name', coalesce(nullif(v_patch->>'sender_name', ''), v_merchant.trade_name, r.sender_name),
    'sender_phone', coalesce(nullif(v_patch->>'sender_phone', ''), nullif(v_merchant.phone, ''), r.sender_phone),
    'sender_city', coalesce(nullif(v_patch->>'sender_city', ''), nullif(v_merchant.emirate, ''), r.sender_city),
    'sender_address', coalesce(nullif(v_patch->>'sender_address', ''), nullif(v_merchant.pickup_address, ''), nullif(v_merchant.address, ''), r.sender_address),
    'receiver_name', coalesce(nullif(v_patch->>'receiver_name', ''), r.receiver_name),
    'receiver_phone', coalesce(nullif(v_patch->>'receiver_phone', ''), r.receiver_phone),
    'receiver_city', coalesce(nullif(v_patch->>'receiver_city', ''), r.receiver_city),
    'receiver_address', coalesce(nullif(v_patch->>'receiver_address', ''), r.receiver_address),
    'coupon_number', coalesce(nullif(v_patch->>'coupon_number', ''), r.coupon_number),
    'package_type', coalesce(nullif(v_patch->>'package_type', ''), nullif(v_patch->>'package_description', ''), r.package_type),
    'package_description', coalesce(nullif(v_patch->>'package_description', ''), nullif(v_patch->>'package_type', ''), r.package_description, r.package_type),
    'payment_method', v_payment_db,
    'goods_value', v_goods,
    'delivery_fee', v_fee,
    'discount_amount', v_discount,
    'delivery_fee_mode', v_mode,
    'customer_total', (v_breakdown->>'customer_total')::numeric,
    'merchant_due', (v_breakdown->>'merchant_due')::numeric,
    'company_revenue', (v_breakdown->>'company_revenue')::numeric,
    'cod_amount', case when v_payment_requested in ('cod', 'receiver_pays') then (v_breakdown->>'customer_total')::numeric else 0 end,
    'delivery_price', v_fee,
    'base_price', v_fee,
    'subtotal', (v_breakdown->>'customer_total')::numeric,
    'total', (v_breakdown->>'customer_total')::numeric,
    'total_price', (v_breakdown->>'customer_total')::numeric,
    'amount', (v_breakdown->>'customer_total')::numeric,
    'price', (v_breakdown->>'customer_total')::numeric,
    'manual_delivery_price', v_manual_entered,
    'price_source', v_price_source,
    'financial_version', greatest(coalesce(r.financial_version, 1), 2),
    'notes', concat_ws(' | ', nullif(btrim(v_patch->>'notes'), ''), 'Admin edit: ' || v_reason),
    'updated_at', v_now
  );

  v_patch := v_patch
    - 'id' - 'tracking_number' - 'tracking_code' - 'invoice_number'
    - 'created_at' - 'created_by' - 'driver_id' - 'assigned_driver_id'
    - 'driver_code' - 'driver_name' - 'driver_phone'
    - 'status' - 'status_history' - 'financial_posted_at';

  select string_agg(
    format('%1$I = (jsonb_populate_record(null::public.orders, $1)).%1$I', c.column_name),
    ', ' order by c.ordinal_position
  ) into v_set_clause
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and v_patch ? c.column_name
    and c.column_name = any(array[
      'merchant_id','merchant_name','merchant_code',
      'sender_name','sender_phone','sender_city','sender_address',
      'receiver_name','receiver_phone','receiver_city','receiver_address',
      'coupon_number','package_type','package_description','weight','pieces','order_count',
      'shipping_scope','destination_country','service_type','payment_method','cod_amount',
      'goods_value','delivery_fee','discount_amount','delivery_fee_mode',
      'customer_total','merchant_due','company_revenue','delivery_price','base_price',
      'subtotal','total','total_price','amount','price','manual_delivery_price','price_source',
      'financial_version','currency','notes','updated_at'
    ])
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_set_clause, '') is null then
    raise exception 'no_editable_order_fields';
  end if;

  execute format('update public.orders o set %s where o.id = $2 returning o.*', v_set_clause)
    using v_patch, r.id
    into r;

  if r.id is null then
    raise exception 'order_update_affected_zero_rows';
  end if;
  if round(coalesce(r.goods_value, -1), 2) <> v_goods
     or round(coalesce(r.delivery_fee, -1), 2) <> v_fee
     or round(coalesce(r.discount_amount, -1), 2) <> v_discount
     or coalesce(r.delivery_fee_mode, '') <> v_mode
     or round(coalesce(r.customer_total, -1), 2) <> round((v_breakdown->>'customer_total')::numeric, 2)
     or round(coalesce(r.merchant_due, -999999), 2) <> round((v_breakdown->>'merchant_due')::numeric, 2)
     or round(coalesce(r.company_revenue, -1), 2) <> round((v_breakdown->>'company_revenue')::numeric, 2)
     or coalesce(r.price_source, '') <> v_price_source
     or (v_price_source = 'manual' and round(coalesce(r.manual_delivery_price, -1), 2) <> round(v_manual_entered, 2)) then
    raise exception 'financial_order_update_readback_mismatch';
  end if;

  return r;
exception when others then
  raise exception using
    message = 'admin_update_order_with_financials_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate || '; reference=' || coalesce(v_reference, 'null'),
    hint = 'Apply migration 20260731023000. Financial-only legacy edits are allowed; delivered orders still require the audited adjustment control.';
end;
$$;

revoke all on function public.admin_update_order_with_financials(jsonb) from public, anon;
grant execute on function public.admin_update_order_with_financials(jsonb) to authenticated;

create or replace function public.admin_order_financial_save_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_update_order_with_financials(jsonb)') is not null
      and to_regprocedure('public.dn_guard_admin_order_required_fields()') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'manual_delivery_price'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'price_source'
      ),
    'rpc', to_regprocedure('public.admin_update_order_with_financials(jsonb)')::text,
    'legacy_financial_updates_allowed', true,
    'manual_zero_effective_fee', 25,
    'manual_zero_mode', 'deduct_from_merchant',
    'checked_at', now()
  );
$$;

revoke all on function public.admin_order_financial_save_health() from public, anon;
grant execute on function public.admin_order_financial_save_health() to authenticated;

notify pgrst, 'reload schema';

commit;
