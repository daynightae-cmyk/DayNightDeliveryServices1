-- DAY NIGHT DELIVERY SERVICES
-- Audited complete admin order editor.
--
-- This migration gives authenticated admin/support users one atomic edit path for
-- merchant-owned orders, including delivered/financially-posted rows.
--
-- Safety:
-- - order identity fields remain immutable (id/tracking/invoice/created_at);
-- - merchant changes resolve to the canonical portal-linked UUID;
-- - the existing canonical merchant trigger synchronizes dependent ownership rows;
-- - delivered financial changes use admin_adjust_order_financials_verified();
-- - core-only edits never create a no-op financial adjustment/version increment;
-- - every successful edit records before/after JSON and changed fields;
-- - any failure rolls the whole edit back.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.order_admin_edit_audit (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid not null,
  reason text not null,
  changed_fields text[] not null default '{}',
  merchant_changed boolean not null default false,
  financially_posted boolean not null default false,
  before_data jsonb not null,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists order_admin_edit_audit_order_idx
  on public.order_admin_edit_audit(order_id, created_at desc);
create index if not exists order_admin_edit_audit_actor_idx
  on public.order_admin_edit_audit(actor_id, created_at desc);

alter table public.order_admin_edit_audit enable row level security;

drop policy if exists order_admin_edit_audit_admin_select
  on public.order_admin_edit_audit;
create policy order_admin_edit_audit_admin_select
  on public.order_admin_edit_audit
  for select
  to authenticated
  using (public.daynight_admin_or_support());

create or replace function public.admin_update_order_complete_verified(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_order_id uuid := public.dn_safe_uuid(p_payload ->> 'order_id');
  v_patch jsonb := coalesce(p_payload -> 'patch', '{}'::jsonb);
  v_financials jsonb := coalesce(p_payload -> 'financials', '{}'::jsonb);
  v_reason text := btrim(coalesce(p_payload ->> 'reason', ''));
  v_before public.orders%rowtype;
  v_after public.orders%rowtype;
  v_before_json jsonb;
  v_after_json jsonb;
  v_selected_merchant_id uuid;
  v_canonical_merchant_id uuid;
  v_merchant public.merchants%rowtype;
  v_merchant_changed boolean := false;
  v_posted boolean := false;
  v_financial_changed boolean := false;
  v_core_patch jsonb;
  v_set_clause text;
  v_adjustment jsonb;
  v_changed_fields text[] := '{}';
  v_audit_id uuid;
  v_entered_delivery numeric(14,2);
  v_desired_goods numeric(14,2);
  v_desired_discount numeric(14,2);
  v_desired_mode text;
  v_desired_payment text;
  v_price_source text;
  v_desired_manual_delivery numeric(14,2);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.daynight_admin_or_support() then
    raise exception 'not_authorized';
  end if;
  if v_order_id is null then
    raise exception 'order_id_required';
  end if;
  if length(v_reason) < 6 then
    raise exception 'admin_edit_reason_required_min_6';
  end if;

  select * into v_before
  from public.orders
  where id = v_order_id
  for update;

  if v_before.id is null then
    raise exception 'order_not_found';
  end if;
  if v_before.merchant_id is null then
    raise exception 'personal_order_use_personal_editor';
  end if;

  v_before_json := to_jsonb(v_before);
  v_posted := v_before.financial_posted_at is not null
    or lower(replace(replace(coalesce(v_before.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete');

  begin
    v_selected_merchant_id := coalesce(
      nullif(v_patch ->> 'merchant_id', '')::uuid,
      v_before.merchant_id
    );
  exception when invalid_text_representation then
    raise exception 'invalid_merchant_id';
  end;

  v_canonical_merchant_id := public.dn_resolve_portal_merchant_uuid(v_selected_merchant_id);
  select * into v_merchant
  from public.merchants
  where id = v_canonical_merchant_id;

  if v_merchant.id is null then
    raise exception 'canonical_merchant_not_found';
  end if;

  v_merchant_changed := v_before.merchant_id is distinct from v_merchant.id;

  -- Resolve and validate the desired accounting state before writing anything.
  v_price_source := lower(coalesce(nullif(btrim(v_patch ->> 'price_source'), ''), 'system'));
  if v_price_source not in ('system', 'manual') then
    raise exception 'invalid_price_source';
  end if;

  if v_price_source = 'manual' then
    v_entered_delivery := round(public.dn_safe_numeric(v_patch ->> 'manual_delivery_price', null), 2);
    v_desired_manual_delivery := v_entered_delivery;
  else
    v_entered_delivery := round(public.dn_safe_numeric(v_financials ->> 'delivery_fee', 0), 2);
    v_desired_manual_delivery := null;
  end if;
  if v_entered_delivery is null or v_entered_delivery < 0 then
    raise exception 'invalid_delivery_fee';
  end if;

  v_desired_goods := round(public.dn_safe_numeric(v_financials ->> 'goods_value', 0), 2);
  v_desired_discount := round(public.dn_safe_numeric(v_financials ->> 'discount_amount', 0), 2);
  if v_desired_goods < 0 or v_desired_discount < 0 then
    raise exception 'negative_financial_value';
  end if;

  v_desired_payment := lower(replace(btrim(coalesce(
    nullif(v_patch ->> 'payment_method', ''),
    v_before.payment_method::text,
    'cod'
  )), '-', '_'));
  if v_desired_payment = 'merchant_pays' then
    v_desired_payment := 'sender_pays';
  elsif v_desired_payment = 'cash' then
    v_desired_payment := 'cod';
  elsif v_desired_payment in ('card', 'bank_transfer') then
    v_desired_payment := 'prepaid';
  end if;
  if v_desired_payment not in ('cod', 'receiver_pays', 'sender_pays', 'prepaid') then
    raise exception 'invalid_payment_method: %', v_desired_payment;
  end if;

  v_desired_mode := lower(replace(btrim(coalesce(
    nullif(v_financials ->> 'delivery_fee_mode', ''),
    'customer_pays'
  )), '-', '_'));
  if v_desired_payment = 'sender_pays' then
    v_desired_mode := 'deduct_from_merchant';
  elsif v_desired_mode not in ('customer_pays', 'deduct_from_merchant') then
    raise exception 'invalid_delivery_fee_mode: %', v_desired_mode;
  end if;

  v_financial_changed :=
    round(coalesce(v_before.goods_value, 0)::numeric, 2) is distinct from v_desired_goods
    or round(coalesce(v_before.delivery_fee, v_before.delivery_price, 0)::numeric, 2) is distinct from v_entered_delivery
    or round(coalesce(v_before.discount_amount, 0)::numeric, 2) is distinct from v_desired_discount
    or lower(replace(coalesce(v_before.delivery_fee_mode::text, 'customer_pays'), '-', '_'))
      is distinct from v_desired_mode
    or lower(replace(coalesce(v_before.payment_method::text, 'cod'), '-', '_'))
      is distinct from v_desired_payment
    or lower(coalesce(v_before.price_source::text, 'system')) is distinct from v_price_source
    or round(v_before.manual_delivery_price::numeric, 2) is distinct from v_desired_manual_delivery;

  -- Change ownership first. The canonical merchant trigger keeps financial values
  -- unchanged, verifies dependent ownership conflicts, synchronizes dependency
  -- merchant UUIDs and writes the merchant repair audit.
  if v_merchant_changed
     or v_before.merchant_code is distinct from v_merchant.merchant_code
     or v_before.merchant_name is distinct from v_merchant.trade_name then
    update public.orders
    set merchant_id = v_merchant.id,
        merchant_code = v_merchant.merchant_code,
        merchant_name = v_merchant.trade_name,
        updated_at = clock_timestamp()
    where id = v_before.id;
  end if;

  -- Core/order fields are written independently from financial fields. This avoids
  -- the canonical ownership trigger restoring OLD money during the same UPDATE.
  v_core_patch := v_patch || jsonb_build_object(
    'merchant_id', v_merchant.id,
    'merchant_code', v_merchant.merchant_code,
    'merchant_name', v_merchant.trade_name,
    'sender_name', coalesce(nullif(btrim(v_patch ->> 'sender_name'), ''), v_merchant.trade_name),
    'sender_phone', coalesce(nullif(btrim(v_patch ->> 'sender_phone'), ''), nullif(v_merchant.phone, '')),
    'sender_city', coalesce(nullif(btrim(v_patch ->> 'sender_city'), ''), nullif(v_merchant.emirate, '')),
    'sender_address', coalesce(
      nullif(btrim(v_patch ->> 'sender_address'), ''),
      nullif(v_merchant.pickup_address, ''),
      nullif(v_merchant.address, '')
    ),
    'updated_at', clock_timestamp()
  );

  -- Immutable/system-owned and financial fields are not part of the core update.
  v_core_patch := v_core_patch
    - 'id' - 'tracking_number' - 'tracking_code' - 'invoice_number'
    - 'created_at' - 'created_by' - 'financial_posted_at'
    - 'driver_id' - 'assigned_driver_id' - 'driver_code' - 'driver_name' - 'driver_phone'
    - 'status' - 'status_history'
    - 'payment_method' - 'cod_amount' - 'collected_amount'
    - 'goods_value' - 'delivery_fee' - 'discount_amount' - 'delivery_fee_mode'
    - 'customer_total' - 'merchant_due' - 'company_revenue'
    - 'delivery_price' - 'base_price' - 'subtotal' - 'total' - 'total_price'
    - 'amount' - 'price' - 'manual_delivery_price' - 'price_source'
    - 'financial_version' - 'financial_adjusted_at' - 'financial_adjusted_by'
    - 'financial_adjustment_reason';

  select string_agg(
    format('%1$I = (jsonb_populate_record(null::public.orders, $1)).%1$I', c.column_name),
    ', ' order by c.ordinal_position
  ) into v_set_clause
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and v_core_patch ? c.column_name
    and c.column_name = any(array[
      'merchant_id','merchant_name','merchant_code',
      'sender_name','sender_phone','sender_city','sender_address',
      'receiver_name','receiver_phone','receiver_city','receiver_address',
      'coupon_number','package_type','package_description','weight','pieces','order_count',
      'shipping_scope','destination_country','service_type','currency','notes','updated_at'
    ])
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_set_clause, '') is not null then
    execute format('update public.orders o set %s where o.id = $2', v_set_clause)
      using v_core_patch, v_before.id;
  end if;

  if v_posted and v_financial_changed then
    select public.admin_adjust_order_financials_verified(
      v_before.id,
      v_desired_goods,
      v_entered_delivery,
      v_desired_discount,
      v_desired_mode,
      v_desired_payment,
      v_reason
    ) into v_adjustment;

    -- The existing audited adjustment intentionally records manual correction.
    -- Restore the administrator's explicit source choice inside this same outer
    -- transaction and preserve the final state in order_admin_edit_audit.
    update public.orders
    set price_source = v_price_source,
        manual_delivery_price = v_desired_manual_delivery,
        updated_at = clock_timestamp()
    where id = v_before.id;
  elsif not v_posted then
    perform public.admin_update_order_with_financials(
      jsonb_build_object(
        'reference', v_before.id::text,
        'patch', v_patch || jsonb_build_object(
          'merchant_id', v_merchant.id,
          'merchant_code', v_merchant.merchant_code,
          'merchant_name', v_merchant.trade_name,
          'sender_name', coalesce(nullif(btrim(v_patch ->> 'sender_name'), ''), v_merchant.trade_name),
          'sender_phone', coalesce(nullif(btrim(v_patch ->> 'sender_phone'), ''), nullif(v_merchant.phone, '')),
          'sender_city', coalesce(nullif(btrim(v_patch ->> 'sender_city'), ''), nullif(v_merchant.emirate, '')),
          'sender_address', coalesce(
            nullif(btrim(v_patch ->> 'sender_address'), ''),
            nullif(v_merchant.pickup_address, ''),
            nullif(v_merchant.address, '')
          )
        ),
        'financials', v_financials,
        'reason', v_reason
      )
    );
  end if;

  select * into v_after
  from public.orders
  where id = v_before.id;

  if v_after.id is null then
    raise exception 'complete_order_edit_readback_missing';
  end if;
  if v_after.merchant_id is distinct from v_merchant.id then
    raise exception 'complete_order_edit_merchant_readback_mismatch';
  end if;

  v_after_json := to_jsonb(v_after);

  select coalesce(array_agg(changed.key order by changed.key), '{}')
  into v_changed_fields
  from (
    select coalesce(b.key, a.key) as key
    from jsonb_each(v_before_json) b
    full join jsonb_each(v_after_json) a on a.key = b.key
    where b.value is distinct from a.value
      and coalesce(b.key, a.key) not in (
        'updated_at', 'financial_adjusted_at', 'financial_adjusted_by',
        'financial_adjustment_reason'
      )
  ) changed;

  insert into public.order_admin_edit_audit (
    order_id,
    actor_id,
    reason,
    changed_fields,
    merchant_changed,
    financially_posted,
    before_data,
    after_data
  ) values (
    v_before.id,
    auth.uid(),
    v_reason,
    v_changed_fields,
    v_merchant_changed,
    v_posted,
    v_before_json,
    v_after_json
  ) returning id into v_audit_id;

  return jsonb_build_object(
    'ok', true,
    'order', to_jsonb(v_after),
    'audit_id', v_audit_id,
    'changed_fields', v_changed_fields,
    'merchant_changed', v_merchant_changed,
    'financially_posted', v_posted,
    'financial_changed', v_financial_changed,
    'financial_adjustment_id', coalesce(v_adjustment ->> 'adjustment_id', '')
  );
exception when others then
  raise exception using
    message = 'admin_update_order_complete_verified_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate || '; order_id=' || coalesce(v_order_id::text, 'null'),
    hint = 'راجع سبب التعديل وربط التاجر والكوبون والقيم المالية. العملية تُلغى بالكامل عند أي تعارض.';
end;
$$;

create or replace function public.admin_complete_order_edit_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_update_order_complete_verified(jsonb)') is not null
      and to_regclass('public.order_admin_edit_audit') is not null
      and to_regprocedure('public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)') is not null
      and to_regprocedure('public.dn_resolve_portal_merchant_uuid(uuid)') is not null,
    'complete_edit_rpc', to_regprocedure('public.admin_update_order_complete_verified(jsonb)')::text,
    'audit_table', to_regclass('public.order_admin_edit_audit')::text,
    'delivered_financial_adjustment_ready',
      to_regprocedure('public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)') is not null,
    'canonical_merchant_resolution_ready',
      to_regprocedure('public.dn_resolve_portal_merchant_uuid(uuid)') is not null,
    'checked_at', now()
  );
$$;

revoke all on function public.admin_update_order_complete_verified(jsonb) from public, anon;
revoke all on function public.admin_complete_order_edit_health() from public, anon;
grant execute on function public.admin_update_order_complete_verified(jsonb) to authenticated, service_role;
grant execute on function public.admin_complete_order_edit_health() to authenticated, service_role;
grant select on public.order_admin_edit_audit to authenticated;
grant all on public.order_admin_edit_audit to service_role;

notify pgrst, 'reload schema';

commit;
