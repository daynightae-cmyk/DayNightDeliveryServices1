-- DAY NIGHT DELIVERY SERVICES
-- Canonical non-blocking Admin order CRUD v3.
--
-- Root cause addressed:
-- Admin order writes were routed through strict merchant-portal, coupon, finance,
-- statement and notification triggers. Any optional secondary failure (including
-- merchant_portal_account_not_linked) aborted the same transaction and rolled the
-- core orders row back.
--
-- Contract:
-- 1. authenticated Admin/support authorization remains mandatory;
-- 2. the exact order row is locked and updated first with patch semantics;
-- 3. optional relationship and reconciliation failures become warnings;
-- 4. every successful core mutation is audited with before/after evidence;
-- 5. strict triggers remain enabled for every non-v3 caller.
--
-- DOWN MIGRATION (documented, intentionally not automatic):
-- - drop the v3 RPCs/tables/columns introduced below;
-- - recreate the affected triggers without the v3 WHEN predicate using their
--   definitions from the immediately preceding applied migrations;
-- - restore frontend callers to the former RPCs only after a controlled rollback.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.orders add column if not exists is_deleted boolean not null default false;
alter table public.orders add column if not exists deleted_at timestamptz;
alter table public.orders add column if not exists deleted_by uuid;
alter table public.orders add column if not exists deletion_reason text;
alter table public.orders add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists restored_at timestamptz;
alter table public.orders add column if not exists restored_by uuid;

create index if not exists idx_orders_admin_active_v3
  on public.orders (is_deleted, updated_at desc);
create index if not exists idx_orders_admin_deleted_v3
  on public.orders (deleted_at desc)
  where is_deleted = true;

create table if not exists public.admin_order_mutation_audit_v3 (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  operation text not null,
  request_id text not null,
  actor_id uuid not null,
  source_page text,
  reason text,
  old_status text,
  new_status text,
  changed_fields text[] not null default '{}',
  warnings jsonb not null default '[]'::jsonb,
  reconciliation_required boolean not null default false,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_order_mutation_audit_v3_request_uidx
  on public.admin_order_mutation_audit_v3(actor_id, request_id, operation, order_id);
create index if not exists admin_order_mutation_audit_v3_order_idx
  on public.admin_order_mutation_audit_v3(order_id, created_at desc);

create table if not exists public.admin_order_reconciliation_queue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  request_id text not null,
  warning_code text not null,
  warning_detail jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','reviewing','resolved','ignored')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text
);

create unique index if not exists admin_order_reconciliation_queue_uidx
  on public.admin_order_reconciliation_queue(order_id, request_id, warning_code);
create index if not exists admin_order_reconciliation_queue_status_idx
  on public.admin_order_reconciliation_queue(status, created_at desc);

alter table public.admin_order_mutation_audit_v3 enable row level security;
alter table public.admin_order_reconciliation_queue enable row level security;

drop policy if exists admin_order_mutation_audit_v3_admin_read
  on public.admin_order_mutation_audit_v3;
create policy admin_order_mutation_audit_v3_admin_read
  on public.admin_order_mutation_audit_v3
  for select to authenticated
  using (public.daynight_admin_or_support());

drop policy if exists admin_order_reconciliation_queue_admin_read
  on public.admin_order_reconciliation_queue;
create policy admin_order_reconciliation_queue_admin_read
  on public.admin_order_reconciliation_queue
  for select to authenticated
  using (public.daynight_admin_or_support());

drop policy if exists admin_order_reconciliation_queue_admin_update
  on public.admin_order_reconciliation_queue;
create policy admin_order_reconciliation_queue_admin_update
  on public.admin_order_reconciliation_queue
  for update to authenticated
  using (public.daynight_admin_or_support())
  with check (public.daynight_admin_or_support());

revoke all on public.admin_order_mutation_audit_v3 from public, anon;
revoke all on public.admin_order_reconciliation_queue from public, anon;
grant select on public.admin_order_mutation_audit_v3 to authenticated;
grant select, update on public.admin_order_reconciliation_queue to authenticated;

create or replace function public.dn_admin_order_override_active()
returns boolean
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
begin
  if lower(coalesce(current_setting('daynight.admin_order_override', true), 'off')) <> 'on' then
    return false;
  end if;
  if auth.role() = 'service_role' then
    return true;
  end if;
  return auth.uid() is not null and public.daynight_admin_or_support();
exception when others then
  return false;
end;
$$;

revoke all on function public.dn_admin_order_override_active() from public, anon;
grant execute on function public.dn_admin_order_override_active() to authenticated, service_role;

create or replace function public.dn_admin_safe_uuid_v3(p_value text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;
  return btrim(p_value)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.dn_admin_safe_numeric_v3(p_value text)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  if p_value is null then
    return null;
  end if;
  v := translate(
    btrim(p_value),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );
  v := replace(v, '٬', '');
  v := replace(v, ',', '');
  v := replace(v, '٫', '.');
  v := regexp_replace(v, '[[:space:]]+', '', 'g');
  if v = '' then
    return 0;
  end if;
  return round(v::numeric, 2);
exception when others then
  return null;
end;
$$;

create or replace function public.dn_admin_normalize_status_v3(p_status text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := lower(replace(replace(btrim(coalesce(p_status, '')), '-', '_'), ' ', '_'));
begin
  v := case v
    when 'waiting' then 'pending'
    when 'order_pending' then 'pending'
    when 'under_review' then 'review'
    when 'needs_review' then 'review'
    when 'manual_review' then 'review'
    when 'accepted' then 'confirmed'
    when 'approved' then 'confirmed'
    when 'driver_assigned' then 'assigned'
    when 'pickup' then 'picked_up'
    when 'collected' then 'picked_up'
    when 'out_for_delivery' then 'in_transit'
    when 'on_the_way' then 'in_transit'
    when 'complete' then 'delivered'
    when 'completed' then 'delivered'
    when 'deferred' then 'postponed'
    when 'return' then 'returned'
    when 'canceled' then 'cancelled'
    when 'failed' then 'cancelled'
    else v
  end;
  if v not in (
    'pending','review','confirmed','assigned','picked_up','in_transit',
    'delivered','postponed','returned','cancelled'
  ) then
    return null;
  end if;
  return v;
end;
$$;

-- Strict triggers stay active globally, but are skipped during the short,
-- authenticated, transaction-local v3 core-write window only.
drop trigger if exists trg_orders_canonical_merchant_link on public.orders;
create trigger trg_orders_canonical_merchant_link
before insert or update of merchant_id, merchant_code, merchant_name
on public.orders
for each row
when (not public.dn_admin_order_override_active())
execute function public.dn_enforce_canonical_order_merchant_link();

drop trigger if exists trg_admin_enforce_order_coupon_policy on public.orders;
create trigger trg_admin_enforce_order_coupon_policy
before insert or update on public.orders
for each row
when (not public.dn_admin_order_override_active())
execute function public.admin_enforce_order_coupon_policy();

drop trigger if exists trg_daynight_normalize_financial_order on public.orders;
create trigger trg_daynight_normalize_financial_order
before insert or update on public.orders
for each row
when (not public.dn_admin_order_override_active())
execute function public.daynight_normalize_financial_order();

drop trigger if exists dn_guard_admin_order_required_fields on public.orders;
create trigger dn_guard_admin_order_required_fields
before insert or update on public.orders
for each row
when (not public.dn_admin_order_override_active())
execute function public.dn_guard_admin_order_required_fields();

drop trigger if exists trg_daynight_post_delivered_financials on public.orders;
create trigger trg_daynight_post_delivered_financials
after insert or update on public.orders
for each row
when (not public.dn_admin_order_override_active())
execute function public.daynight_post_delivered_financials();

drop trigger if exists trg_dn_project_delivered_order_dependencies on public.orders;
create trigger trg_dn_project_delivered_order_dependencies
after insert or update of status, financial_posted_at, merchant_id, payment_method,
  customer_total, collected_amount, assigned_driver_id, driver_id
on public.orders
for each row
when (not public.dn_admin_order_override_active())
execute function public.dn_project_delivered_order_dependencies();

drop trigger if exists merchant_order_notification_sync on public.orders;
create trigger merchant_order_notification_sync
after insert or update of status on public.orders
for each row
when (not public.dn_admin_order_override_active())
execute function public.merchant_order_notification_trigger();

drop trigger if exists trg_portal_notify_order_lifecycle on public.orders;
create trigger trg_portal_notify_order_lifecycle
after insert or update of status, assigned_driver_id, driver_id on public.orders
for each row
when (not public.dn_admin_order_override_active())
execute function public.portal_notify_order_lifecycle();

create or replace function public.admin_update_order_complete_v3(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_order_id uuid := public.dn_admin_safe_uuid_v3(p_payload ->> 'order_id');
  v_operation text := lower(btrim(coalesce(nullif(p_payload ->> 'operation', ''), 'update')));
  v_request_id text := btrim(coalesce(nullif(p_payload ->> 'request_id', ''), gen_random_uuid()::text));
  v_source_page text := nullif(btrim(p_payload ->> 'source_page'), '');
  v_reason text := nullif(btrim(coalesce(p_payload ->> 'reason', p_payload ->> 'note')), '');
  v_patch jsonb := coalesce(p_payload -> 'patch', '{}'::jsonb);
  v_before public.orders%rowtype;
  v_after public.orders%rowtype;
  v_before_json jsonb;
  v_after_json jsonb;
  v_status text;
  v_old_status text;
  v_raw text;
  v_numeric numeric;
  v_key text;
  v_set_clause text;
  v_changed_fields text[] := '{}';
  v_warnings jsonb := '[]'::jsonb;
  v_warning jsonb;
  v_reconciliation boolean := false;
  v_audit_id uuid;
  v_existing_audit public.admin_order_mutation_audit_v3%rowtype;
  v_candidate_merchant uuid;
  v_merchant public.merchants%rowtype;
  v_candidate_count integer := 0;
  v_candidate_driver uuid;
  v_coupon text;
  v_coupon_key text;
  v_conflict_order uuid;
  v_now timestamptz := clock_timestamp();
  v_history jsonb;
  v_allowed constant text[] := array[
    'status','status_history',
    'customer_id','customer_name','customer_phone','customer_email',
    'sender_name','sender_phone','sender_email','sender_city','sender_address',
    'sender_emirate','sender_area','sender_landmark','sender_city_ar',
    'sender_emirate_ar','sender_area_ar','sender_address_ar','sender_landmark_ar',
    'receiver_name','receiver_phone','receiver_email','receiver_city','receiver_address',
    'receiver_emirate','receiver_area','receiver_landmark','receiver_city_ar',
    'receiver_emirate_ar','receiver_area_ar','receiver_address_ar','receiver_landmark_ar',
    'destination_country','destination_country_ar','delivery_date',
    'merchant_id','merchant_code','merchant_name','merchant_phone',
    'driver_id','assigned_driver_id','driver_code','driver_name','driver_phone',
    'coupon_number','order_count','shipping_scope','source_channel','source_domain',
    'order_type','order_kind','package_type','package_description','weight','pieces',
    'service_type','payment_method','payment_status','currency','notes',
    'cancellation_reason','return_reason','tracking_information','tracking_notes',
    'cod_amount','goods_value','product_value','merchant_goods_value',
    'delivery_fee','delivery_price','base_price','manual_delivery_price','price_source',
    'discount_amount','discount','customer_total','collected_amount','paid_amount',
    'remaining_amount','merchant_due','company_revenue','subtotal','total',
    'total_amount','total_price','amount','price','delivery_fee_mode','financial_version',
    'pickup_lat','pickup_lng','sender_lat','sender_lng','receiver_lat','receiver_lng',
    'delivery_lat','delivery_lng','driver_lat','driver_lng','current_lat','current_lng',
    'live_lat','live_lng','driver_location_updated_at','live_location_updated_at',
    'live_location_source','delivered_at','cancelled_at','returned_at','picked_up_at',
    'assigned_at','confirmed_at','in_transit_at','is_deleted','deleted_at','deleted_by',
    'deletion_reason','archived_at','restored_at','restored_by','updated_at'
  ];
  v_numeric_keys constant text[] := array[
    'order_count','weight','pieces','cod_amount','goods_value','product_value',
    'merchant_goods_value','delivery_fee','delivery_price','base_price',
    'manual_delivery_price','discount_amount','discount','customer_total',
    'collected_amount','paid_amount','remaining_amount','merchant_due',
    'company_revenue','subtotal','total','total_amount','total_price','amount','price',
    'financial_version','pickup_lat','pickup_lng','sender_lat','sender_lng',
    'receiver_lat','receiver_lng','delivery_lat','delivery_lng','driver_lat','driver_lng',
    'current_lat','current_lng','live_lat','live_lng'
  ];
  v_nonnegative_keys constant text[] := array[
    'order_count','weight','pieces','cod_amount','goods_value','product_value',
    'merchant_goods_value','delivery_fee','delivery_price','base_price',
    'manual_delivery_price','discount_amount','discount','customer_total',
    'collected_amount','paid_amount','remaining_amount','company_revenue','subtotal',
    'total','total_amount','total_price','amount','price','financial_version'
  ];
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;
  if not public.daynight_admin_or_support() then
    raise exception 'not_authorized';
  end if;
  if v_order_id is null then
    raise exception 'order_id_required';
  end if;
  if v_operation not in ('update','status','archive','soft_delete','restore') then
    raise exception 'invalid_admin_order_operation: %', v_operation;
  end if;

  select * into v_existing_audit
  from public.admin_order_mutation_audit_v3 a
  where a.actor_id = v_actor
    and a.request_id = v_request_id
    and a.operation = v_operation
    and a.order_id = v_order_id
  order by a.created_at desc
  limit 1;

  if v_existing_audit.id is not null then
    select * into v_after from public.orders where id = v_order_id;
    return jsonb_build_object(
      'ok', true,
      'success', true,
      'operation', v_operation,
      'order', case when v_after.id is null then v_existing_audit.after_data else to_jsonb(v_after) end,
      'warnings', v_existing_audit.warnings,
      'reconciliation_required', v_existing_audit.reconciliation_required,
      'audit_id', v_existing_audit.id,
      'request_id', v_request_id,
      'replayed', true
    );
  end if;

  select * into v_before
  from public.orders
  where id = v_order_id
  for update;

  if v_before.id is null then
    raise exception 'order_not_found';
  end if;

  v_before_json := to_jsonb(v_before);
  v_old_status := public.dn_admin_normalize_status_v3(v_before.status::text);

  -- Immutable and system-owned identity is never rewritten through the generic editor.
  v_patch := v_patch
    - 'id' - 'tracking_number' - 'tracking_code' - 'invoice_number'
    - 'created_at' - 'created_by' - 'financial_posted_at';

  if p_payload ? 'status' then
    v_patch := jsonb_set(v_patch, '{status}', to_jsonb(p_payload ->> 'status'), true);
  end if;

  if v_operation in ('archive','soft_delete') then
    v_patch := v_patch || jsonb_build_object(
      'is_deleted', true,
      'deleted_at', coalesce(v_before.deleted_at, v_now),
      'deleted_by', v_actor,
      'deletion_reason', coalesce(v_reason, 'Archived from DAY NIGHT Admin'),
      'archived_at', coalesce(v_before.archived_at, v_now)
    );
  elsif v_operation = 'restore' then
    v_patch := v_patch || jsonb_build_object(
      'is_deleted', false,
      'deleted_at', null,
      'deleted_by', null,
      'deletion_reason', null,
      'archived_at', null,
      'restored_at', v_now,
      'restored_by', v_actor
    );
  end if;

  if v_patch ? 'status' then
    v_status := public.dn_admin_normalize_status_v3(v_patch ->> 'status');
    if v_status is null then
      raise exception 'invalid_order_status: %', coalesce(v_patch ->> 'status', 'null');
    end if;
    v_patch := jsonb_set(v_patch, '{status}', to_jsonb(v_status), true);

    if v_status is distinct from v_old_status then
      v_history := case
        when jsonb_typeof(v_before_json -> 'status_history') = 'array'
          then v_before_json -> 'status_history'
        else '[]'::jsonb
      end || jsonb_build_array(jsonb_build_object(
        'status', v_status,
        'previous_status', v_old_status,
        'note', coalesce(v_reason, 'Admin status correction'),
        'created_at', v_now,
        'date', v_now,
        'timestamp', v_now,
        'changed_by', 'admin',
        'changed_by_user_id', v_actor,
        'request_id', v_request_id
      ));
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'status_history'
      ) then
        v_patch := jsonb_set(v_patch, '{status_history}', v_history, true);
      end if;

      if v_status = 'delivered'
         and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='delivered_at')
         and nullif(v_before_json ->> 'delivered_at', '') is null then
        v_patch := jsonb_set(v_patch, '{delivered_at}', to_jsonb(v_now), true);
      elsif v_status = 'cancelled'
         and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='cancelled_at')
         and nullif(v_before_json ->> 'cancelled_at', '') is null then
        v_patch := jsonb_set(v_patch, '{cancelled_at}', to_jsonb(v_now), true);
      elsif v_status = 'returned'
         and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='returned_at')
         and nullif(v_before_json ->> 'returned_at', '') is null then
        v_patch := jsonb_set(v_patch, '{returned_at}', to_jsonb(v_now), true);
      elsif v_status = 'picked_up'
         and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='picked_up_at')
         and nullif(v_before_json ->> 'picked_up_at', '') is null then
        v_patch := jsonb_set(v_patch, '{picked_up_at}', to_jsonb(v_now), true);
      elsif v_status = 'assigned'
         and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='assigned_at')
         and nullif(v_before_json ->> 'assigned_at', '') is null then
        v_patch := jsonb_set(v_patch, '{assigned_at}', to_jsonb(v_now), true);
      elsif v_status = 'confirmed'
         and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='confirmed_at')
         and nullif(v_before_json ->> 'confirmed_at', '') is null then
        v_patch := jsonb_set(v_patch, '{confirmed_at}', to_jsonb(v_now), true);
      elsif v_status = 'in_transit'
         and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='in_transit_at')
         and nullif(v_before_json ->> 'in_transit_at', '') is null then
        v_patch := jsonb_set(v_patch, '{in_transit_at}', to_jsonb(v_now), true);
      end if;
    end if;
  else
    v_status := v_old_status;
  end if;

  -- Safe numeric normalization supports Arabic and English digits. Explicit blank
  -- financial inputs become zero, while invalid non-empty values remain core errors.
  foreach v_key in array v_numeric_keys loop
    if v_patch ? v_key and jsonb_typeof(v_patch -> v_key) <> 'null' then
      v_raw := coalesce(v_patch ->> v_key, '');
      v_numeric := public.dn_admin_safe_numeric_v3(v_raw);
      if v_numeric is null then
        raise exception 'invalid_numeric_value: %', v_key;
      end if;
      if v_key = any(v_nonnegative_keys) and v_numeric < 0 then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code', 'negative_numeric_normalized',
          'field', v_key,
          'entered', v_raw,
          'saved', 0
        ));
        v_reconciliation := true;
        v_numeric := 0;
      end if;
      if v_key = any(array['order_count','pieces','financial_version']) then
        v_numeric := round(v_numeric, 0);
        if v_key = any(array['order_count','pieces']) then v_numeric := greatest(v_numeric, 1); end if;
      elsif v_key = 'weight' then
        v_numeric := greatest(v_numeric, 0.1);
      end if;
      v_patch := jsonb_set(v_patch, array[v_key], to_jsonb(v_numeric), true);
    end if;
  end loop;

  -- Exact merchant resolution only. Portal linkage is deliberately not required.
  if v_patch ? 'merchant_id' then
    if jsonb_typeof(v_patch -> 'merchant_id') = 'null'
       or nullif(btrim(v_patch ->> 'merchant_id'), '') is null then
      v_patch := jsonb_set(v_patch, '{merchant_id}', 'null'::jsonb, true);
    else
      v_candidate_merchant := public.dn_admin_safe_uuid_v3(v_patch ->> 'merchant_id');
      if v_candidate_merchant is null then
        v_patch := jsonb_set(v_patch, '{merchant_id}', 'null'::jsonb, true);
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code', 'merchant_reference_invalid',
          'entered', v_patch ->> 'merchant_id'
        ));
        v_reconciliation := true;
      else
        select * into v_merchant from public.merchants where id = v_candidate_merchant;
        if v_merchant.id is null then
          v_patch := jsonb_set(v_patch, '{merchant_id}', 'null'::jsonb, true);
          v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
            'code', 'merchant_link_warning',
            'merchant_id', v_candidate_merchant,
            'reason', 'merchant_record_not_found'
          ));
          v_reconciliation := true;
        else
          if not (v_patch ? 'merchant_code') then
            v_patch := jsonb_set(v_patch, '{merchant_code}', coalesce(to_jsonb(v_merchant.merchant_code), 'null'::jsonb), true);
          end if;
          if not (v_patch ? 'merchant_name') then
            v_patch := jsonb_set(v_patch, '{merchant_name}', coalesce(to_jsonb(v_merchant.trade_name), 'null'::jsonb), true);
          end if;
          begin
            if public.dn_merchant_portal_link_count(v_merchant.id) = 0 then
              v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
                'code', 'merchant_link_warning',
                'merchant_id', v_merchant.id,
                'merchant_code', v_merchant.merchant_code,
                'reason', 'merchant_portal_account_not_linked'
              ));
              v_reconciliation := true;
            end if;
          exception when others then
            v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
              'code', 'merchant_link_check_unavailable',
              'merchant_id', v_merchant.id
            ));
            v_reconciliation := true;
          end;
        end if;
      end if;
    end if;
  elsif v_patch ? 'merchant_code' and nullif(btrim(v_patch ->> 'merchant_code'), '') is not null then
    select count(*), (array_agg(m.id order by m.id))[1] into v_candidate_count, v_candidate_merchant
    from public.merchants m
    where lower(btrim(coalesce(m.merchant_code, ''))) = lower(btrim(v_patch ->> 'merchant_code'));
    if v_candidate_count = 1 then
      v_patch := jsonb_set(v_patch, '{merchant_id}', to_jsonb(v_candidate_merchant), true);
    elsif v_candidate_count = 0 then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'merchant_link_warning',
        'merchant_code', v_patch ->> 'merchant_code',
        'reason', 'exact_code_not_found'
      ));
      v_reconciliation := true;
    else
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'merchant_link_warning',
        'merchant_code', v_patch ->> 'merchant_code',
        'reason', 'exact_code_ambiguous'
      ));
      v_reconciliation := true;
    end if;
  end if;

  -- Invalid driver references are detached, while Admin-entered textual details stay.
  if v_patch ? 'driver_id' and jsonb_typeof(v_patch -> 'driver_id') <> 'null'
     and nullif(btrim(v_patch ->> 'driver_id'), '') is not null then
    v_candidate_driver := public.dn_admin_safe_uuid_v3(v_patch ->> 'driver_id');
    if v_candidate_driver is null or not exists (
      select 1 from public.driver_profiles dp
      where dp.id = v_candidate_driver or dp.user_id = v_candidate_driver
    ) then
      v_patch := jsonb_set(v_patch, '{driver_id}', 'null'::jsonb, true);
      if exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='assigned_driver_id') then
        v_patch := jsonb_set(v_patch, '{assigned_driver_id}', 'null'::jsonb, true);
      end if;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'driver_link_warning',
        'entered', coalesce(v_candidate_driver::text, v_patch ->> 'driver_id')
      ));
      v_reconciliation := true;
    end if;
  end if;

  -- Coupon conflicts never create a second conflicting row. Preserve the old value
  -- and return an explicit reconciliation warning instead of rolling back status.
  if v_patch ? 'coupon_number' then
    v_coupon := public.canonical_order_coupon(v_patch ->> 'coupon_number');
    if v_coupon is null then
      v_patch := jsonb_set(v_patch, '{coupon_number}', 'null'::jsonb, true);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'coupon_reconciliation_required',
        'reason', 'coupon_missing_or_blank'
      ));
      v_reconciliation := true;
    else
      v_coupon_key := public.normalized_order_coupon(v_coupon);
      select o.id into v_conflict_order
      from public.orders o
      where public.normalized_order_coupon(o.coupon_number) = v_coupon_key
        and o.id <> v_order_id
      order by o.created_at asc nulls last, o.id
      limit 1;
      if v_conflict_order is not null then
        v_patch := v_patch - 'coupon_number';
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code', 'coupon_reconciliation_required',
          'reason', 'coupon_conflict',
          'requested_coupon', v_coupon,
          'conflicting_order_id', v_conflict_order,
          'preserved_coupon', v_before.coupon_number
        ));
        v_reconciliation := true;
      else
        v_patch := jsonb_set(v_patch, '{coupon_number}', to_jsonb(v_coupon), true);
      end if;
    end if;
  elsif v_status is distinct from v_old_status and public.canonical_order_coupon(v_before.coupon_number) is null then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'coupon_reconciliation_required',
      'reason', 'legacy_order_without_coupon'
    ));
    v_reconciliation := true;
  end if;

  -- Explicit null is accepted only for nullable columns. For NOT NULL fields it
  -- means "leave unchanged" and returns a warning rather than aborting the save.
  for v_key in select key from jsonb_each(v_patch) loop
    if jsonb_typeof(v_patch -> v_key) = 'null'
       and exists (
         select 1 from information_schema.columns c
         where c.table_schema='public' and c.table_name='orders'
           and c.column_name=v_key and c.is_nullable='NO'
       ) then
      v_patch := v_patch - v_key;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'non_nullable_clear_ignored',
        'field', v_key
      ));
      v_reconciliation := true;
    end if;
  end loop;

  v_patch := v_patch || jsonb_build_object('updated_at', v_now);

  select string_agg(
    format('%1$I = (jsonb_populate_record(null::public.orders, $1)).%1$I', c.column_name),
    ', ' order by c.ordinal_position
  ) into v_set_clause
  from information_schema.columns c
  where c.table_schema='public'
    and c.table_name='orders'
    and c.column_name = any(v_allowed)
    and v_patch ? c.column_name
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_set_clause, '') is null then
    raise exception 'admin_order_v3_patch_empty';
  end if;

  perform set_config('daynight.admin_order_override', 'on', true);
  execute format(
    'update public.orders o set %s where o.id = $2 returning o.*',
    v_set_clause
  ) using v_patch, v_order_id into v_after;
  perform set_config('daynight.admin_order_override', 'off', true);

  if v_after.id is null then
    raise exception 'admin_order_v3_update_affected_zero_rows';
  end if;

  v_after_json := to_jsonb(v_after);
  select coalesce(array_agg(x.key order by x.key), '{}') into v_changed_fields
  from (
    select coalesce(b.key, a.key) as key
    from jsonb_each(v_before_json) b
    full join jsonb_each(v_after_json) a on a.key=b.key
    where b.value is distinct from a.value
      and coalesce(b.key,a.key) <> 'updated_at'
  ) x;

  -- Normalized timeline is secondary. Embedded status_history was already part of
  -- the committed core row, so a timeline-table failure cannot erase the status.
  if v_status is distinct from v_old_status then
    begin
      insert into public.order_status_history(order_id, status, note, created_at)
      values (v_order_id, v_status, coalesce(v_reason, 'Admin status correction'), v_now);
    exception when others then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'timeline_reconciliation_required',
        'sqlstate', sqlstate
      ));
      v_reconciliation := true;
    end;

    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'notification_sync_queued',
      'status', v_status
    ));
    v_reconciliation := true;

    if v_status = 'delivered' then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'financial_reconciliation_required',
        'reason', 'core_delivery_saved_before_optional_ledgers'
      ));
      v_reconciliation := true;
    end if;
  end if;

  insert into public.admin_order_mutation_audit_v3(
    order_id, operation, request_id, actor_id, source_page, reason,
    old_status, new_status, changed_fields, warnings,
    reconciliation_required, before_data, after_data
  ) values (
    v_order_id, v_operation, v_request_id, v_actor, v_source_page, v_reason,
    v_old_status, v_status, v_changed_fields, v_warnings,
    v_reconciliation, v_before_json, v_after_json
  ) returning id into v_audit_id;

  for v_warning in select value from jsonb_array_elements(v_warnings) loop
    begin
      insert into public.admin_order_reconciliation_queue(
        order_id, request_id, warning_code, warning_detail, created_by
      ) values (
        v_order_id,
        v_request_id,
        coalesce(nullif(v_warning ->> 'code', ''), 'admin_order_warning'),
        v_warning,
        v_actor
      ) on conflict (order_id, request_id, warning_code) do nothing;
    exception when others then
      null;
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'success', true,
    'operation', v_operation,
    'order', v_after_json,
    'warnings', v_warnings,
    'reconciliation_required', v_reconciliation,
    'audit_id', v_audit_id,
    'request_id', v_request_id,
    'changed_fields', to_jsonb(v_changed_fields),
    'previous_status', v_old_status,
    'status', v_status,
    'core_saved_at', v_now,
    'replayed', false
  );
exception when others then
  perform set_config('daynight.admin_order_override', 'off', true);
  raise exception using
    errcode = coalesce(nullif(sqlstate, ''), 'P0001'),
    message = 'admin_update_order_complete_v3_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate
      || '; order_id=' || coalesce(v_order_id::text, 'null')
      || '; request_id=' || coalesce(v_request_id, 'null')
      || '; operation=' || coalesce(v_operation, 'null'),
    hint = 'Only authentication, authorization, order identity, status and core value conversion can block this RPC. Optional relationships are returned as warnings.';
end;
$$;

-- Backward-compatible names now route forward to v3. They no longer call the
-- restrictive v1 implementation or require portal-linked merchant ownership.
create or replace function public.admin_update_order_complete_verified_v2(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
  select public.admin_update_order_complete_v3(
    coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object('operation', coalesce(nullif(p_payload ->> 'operation', ''), 'update'))
  );
$$;

create or replace function public.admin_update_order_complete_verified(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
  select public.admin_update_order_complete_v3(
    coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object('operation', coalesce(nullif(p_payload ->> 'operation', ''), 'update'))
  );
$$;

create or replace function public.admin_update_order_status_verified(
  p_order_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_result jsonb;
begin
  v_result := public.admin_update_order_complete_v3(jsonb_build_object(
    'order_id', p_order_id,
    'operation', 'status',
    'status', p_status,
    'note', p_note,
    'reason', coalesce(nullif(btrim(p_note), ''), 'Admin quick status update'),
    'source_page', 'admin_quick_status',
    'request_id', gen_random_uuid()::text,
    'patch', jsonb_build_object('status', p_status)
  ));
  return v_result || jsonb_build_object(
    'status', v_result #>> '{order,status}',
    'financial_posted', nullif(v_result #>> '{order,financial_posted_at}', '') is not null,
    'financial_posted_at', v_result #>> '{order,financial_posted_at}'
  );
end;
$$;

create or replace function public.admin_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_result jsonb;
  v_order public.orders%rowtype;
begin
  v_result := public.admin_update_order_status_verified(
    public.dn_admin_safe_uuid_v3(p_order_id),
    p_status,
    p_note
  );
  select * into v_order
  from jsonb_populate_record(null::public.orders, v_result -> 'order');
  if v_order.id is null then
    raise exception 'admin_update_order_status_v3_returned_no_order';
  end if;
  return v_order;
end;
$$;

create or replace function public.admin_soft_delete_order_v3(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
  select public.admin_update_order_complete_v3(
    coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object('operation', 'soft_delete')
  );
$$;

create or replace function public.admin_restore_order_v3(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
  select public.admin_update_order_complete_v3(
    coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object('operation', 'restore')
  );
$$;

create or replace function public.admin_bulk_mutate_orders_v3(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_item jsonb;
  v_order_id text;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_operation text := coalesce(nullif(p_payload ->> 'operation', ''), 'update');
  v_base_request text := coalesce(nullif(p_payload ->> 'request_id', ''), gen_random_uuid()::text);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.daynight_admin_or_support() then raise exception 'not_authorized'; end if;
  if jsonb_typeof(p_payload -> 'order_ids') <> 'array' then
    raise exception 'order_ids_array_required';
  end if;

  for v_item in select value from jsonb_array_elements(p_payload -> 'order_ids') loop
    v_order_id := trim(both '"' from v_item::text);
    begin
      v_result := public.admin_update_order_complete_v3(jsonb_build_object(
        'order_id', v_order_id,
        'operation', v_operation,
        'request_id', v_base_request || ':' || v_order_id,
        'source_page', coalesce(p_payload ->> 'source_page', 'admin_bulk'),
        'reason', p_payload ->> 'reason',
        'status', p_payload ->> 'status',
        'patch', coalesce(p_payload -> 'patch', '{}'::jsonb)
      ));
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'order_id', v_order_id,
        'success', true,
        'warning', coalesce(jsonb_array_length(v_result -> 'warnings'), 0) > 0,
        'failed', false,
        'result', v_result,
        'reconciliation_required', coalesce((v_result ->> 'reconciliation_required')::boolean, false)
      ));
    exception when others then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'order_id', v_order_id,
        'success', false,
        'warning', false,
        'failed', true,
        'reason', sqlerrm,
        'sqlstate', sqlstate,
        'reconciliation_required', false
      ));
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'operation', v_operation,
    'results', v_results,
    'total', jsonb_array_length(v_results),
    'request_id', v_base_request
  );
end;
$$;

create or replace function public.admin_order_reconciliation_report_v3()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.daynight_admin_or_support() then raise exception 'not_authorized'; end if;
  return jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'missing_merchant_link', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'order_id', o.id,
        'reference', coalesce(o.tracking_number,o.invoice_number,o.coupon_number,o.id::text),
        'merchant_id', o.merchant_id,
        'merchant_code', o.merchant_code
      )), '[]'::jsonb)
      from public.orders o
      where o.merchant_id is not null
        and public.dn_merchant_portal_link_count(o.merchant_id) = 0
    ),
    'missing_coupon', (
      select coalesce(jsonb_agg(jsonb_build_object('order_id',o.id,'status',o.status)), '[]'::jsonb)
      from public.orders o where public.canonical_order_coupon(o.coupon_number) is null
    ),
    'pending_reconciliation', (
      select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb)
      from public.admin_order_reconciliation_queue q where q.status='pending'
    )
  );
end;
$$;

create or replace function public.admin_permanently_delete_order_v3(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_order_id uuid := public.dn_admin_safe_uuid_v3(p_payload ->> 'order_id');
  v_confirmation text := btrim(coalesce(p_payload ->> 'confirmation', ''));
  v_request_id text := coalesce(nullif(btrim(p_payload ->> 'request_id'), ''), gen_random_uuid()::text);
  v_before public.orders%rowtype;
  v_reference text;
  v_audit_id uuid;
  v_retention boolean := false;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  select lower(coalesce(p.role::text,'')) into v_role from public.profiles p where p.id=v_actor;
  if v_role not in ('super_admin','owner') then raise exception 'super_admin_required'; end if;
  if v_order_id is null then raise exception 'order_id_required'; end if;

  select * into v_before from public.orders where id=v_order_id for update;
  if v_before.id is null then raise exception 'order_not_found'; end if;
  v_reference := coalesce(nullif(v_before.tracking_number,''),nullif(v_before.invoice_number,''),nullif(v_before.coupon_number,''),v_before.id::text);
  if v_confirmation <> 'DELETE ' || v_reference then
    raise exception 'typed_confirmation_mismatch';
  end if;

  v_retention := v_before.financial_posted_at is not null
    or exists (select 1 from public.order_financial_settlements s where s.order_id::text=v_order_id::text)
    or exists (select 1 from public.financial_account_entries e where e.order_id::text=v_order_id::text)
    or exists (select 1 from public.cod_collections c where c.order_id::text=v_order_id::text);

  if v_retention then
    return jsonb_build_object(
      'ok', false,
      'success', false,
      'deleted', false,
      'order_id', v_order_id,
      'reference', v_reference,
      'warnings', jsonb_build_array(jsonb_build_object(
        'code','legal_financial_retention_required',
        'message','The order contains financial or legal evidence and cannot be physically deleted.'
      )),
      'reconciliation_required', false
    );
  end if;

  insert into public.admin_order_mutation_audit_v3(
    order_id,operation,request_id,actor_id,source_page,reason,
    old_status,new_status,changed_fields,warnings,reconciliation_required,
    before_data,after_data
  ) values (
    v_order_id,'permanent_delete',v_request_id,v_actor,
    coalesce(p_payload->>'source_page','admin_trash'),
    coalesce(p_payload->>'reason','Explicit Super Admin permanent deletion'),
    v_before.status::text,null,array['permanent_delete'],'[]'::jsonb,false,
    to_jsonb(v_before),jsonb_build_object('deleted',true,'retained_audit_id',null)
  ) returning id into v_audit_id;

  perform set_config('daynight.admin_order_override','on',true);
  delete from public.orders where id=v_order_id;
  perform set_config('daynight.admin_order_override','off',true);

  if exists (select 1 from public.orders where id=v_order_id) then
    raise exception 'permanent_delete_readback_failed';
  end if;

  return jsonb_build_object(
    'ok',true,'success',true,'deleted',true,'order_id',v_order_id,
    'reference',v_reference,'audit_id',v_audit_id,'request_id',v_request_id,
    'warnings','[]'::jsonb,'reconciliation_required',false
  );
exception when others then
  perform set_config('daynight.admin_order_override','off',true);
  raise;
end;
$$;

create or replace function public.admin_order_crud_v3_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_update_order_complete_v3(jsonb)') is not null
      and to_regprocedure('public.admin_create_order_v3(jsonb)') is not null
      and to_regprocedure('public.admin_soft_delete_order_v3(jsonb)') is not null
      and to_regprocedure('public.admin_restore_order_v3(jsonb)') is not null
      and to_regprocedure('public.admin_bulk_mutate_orders_v3(jsonb)') is not null
      and to_regclass('public.admin_order_mutation_audit_v3') is not null
      and to_regclass('public.admin_order_reconciliation_queue') is not null,
    'canonical_rpc','admin_update_order_complete_v3',
    'canonical_create_rpc','admin_create_order_v3',
    'legacy_v2_redirected',true,
    'legacy_complete_redirected',true,
    'status_rpc_redirected',true,
    'merchant_portal_link_nonblocking',true,
    'coupon_reconciliation_nonblocking',true,
    'secondary_trigger_failures_nonblocking',true,
    'personal_orders_supported',true,
    'soft_delete_supported',true,
    'restore_supported',true,
    'bulk_partial_results_supported',true,
    'checked_at',now()
  );
$$;

revoke all on function public.admin_update_order_complete_v3(jsonb) from public, anon;
revoke all on function public.admin_update_order_complete_verified_v2(jsonb) from public, anon;
revoke all on function public.admin_update_order_complete_verified(jsonb) from public, anon;
revoke all on function public.admin_update_order_status_verified(uuid,text,text) from public, anon;
revoke all on function public.admin_update_order_status(text,text,text) from public, anon;
revoke all on function public.admin_soft_delete_order_v3(jsonb) from public, anon;
revoke all on function public.admin_restore_order_v3(jsonb) from public, anon;
revoke all on function public.admin_bulk_mutate_orders_v3(jsonb) from public, anon;
revoke all on function public.admin_order_reconciliation_report_v3() from public, anon;
revoke all on function public.admin_permanently_delete_order_v3(jsonb) from public, anon;
revoke all on function public.admin_order_crud_v3_health() from public, anon;

grant execute on function public.admin_update_order_complete_v3(jsonb) to authenticated, service_role;
grant execute on function public.admin_update_order_complete_verified_v2(jsonb) to authenticated, service_role;
grant execute on function public.admin_update_order_complete_verified(jsonb) to authenticated, service_role;
grant execute on function public.admin_update_order_status_verified(uuid,text,text) to authenticated, service_role;
grant execute on function public.admin_update_order_status(text,text,text) to authenticated, service_role;
grant execute on function public.admin_soft_delete_order_v3(jsonb) to authenticated, service_role;
grant execute on function public.admin_restore_order_v3(jsonb) to authenticated, service_role;
grant execute on function public.admin_bulk_mutate_orders_v3(jsonb) to authenticated, service_role;
grant execute on function public.admin_order_reconciliation_report_v3() to authenticated, service_role;
grant execute on function public.admin_permanently_delete_order_v3(jsonb) to authenticated, service_role;
grant execute on function public.admin_order_crud_v3_health() to authenticated, service_role;


create unique index if not exists admin_order_mutation_audit_v3_create_request_uidx
  on public.admin_order_mutation_audit_v3(actor_id, request_id, operation)
  where operation = 'create';

create or replace function public.admin_create_order_v3(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(nullif(p_payload ->> 'request_id', ''), gen_random_uuid()::text));
  v_source_page text := nullif(btrim(coalesce(p_payload ->> 'source_page', 'admin_new_order')), '');
  v_reason text := nullif(btrim(coalesce(p_payload ->> 'reason', 'Admin order creation')), '');
  v_patch jsonb := coalesce(p_payload -> 'order', p_payload -> 'patch', '{}'::jsonb);
  v_existing public.admin_order_mutation_audit_v3%rowtype;
  v_created public.orders%rowtype;
  v_created_json jsonb;
  v_status text;
  v_reference text;
  v_coupon text;
  v_coupon_key text;
  v_conflict_order uuid;
  v_candidate_merchant uuid;
  v_candidate_count integer := 0;
  v_merchant public.merchants%rowtype;
  v_key text;
  v_raw text;
  v_numeric numeric;
  v_columns text;
  v_values text;
  v_warnings jsonb := '[]'::jsonb;
  v_warning jsonb;
  v_reconciliation boolean := false;
  v_audit_id uuid;
  v_now timestamptz := clock_timestamp();
  v_allowed constant text[] := array[
    'tracking_number','tracking_code','invoice_number','coupon_number',
    'customer_id','customer_name','customer_phone','customer_email',
    'sender_name','sender_phone','sender_email','sender_city','sender_address',
    'sender_emirate','sender_area','sender_landmark','sender_city_ar',
    'sender_emirate_ar','sender_area_ar','sender_address_ar','sender_landmark_ar',
    'receiver_name','receiver_phone','receiver_email','receiver_city','receiver_address',
    'receiver_emirate','receiver_area','receiver_landmark','receiver_city_ar',
    'receiver_emirate_ar','receiver_area_ar','receiver_address_ar','receiver_landmark_ar',
    'destination_country','destination_country_ar','delivery_date',
    'merchant_id','merchant_code','merchant_name','merchant_phone',
    'driver_id','assigned_driver_id','driver_code','driver_name','driver_phone',
    'order_count','shipping_scope','source_channel','source_domain','order_type','order_kind',
    'package_type','package_description','weight','pieces','service_type','payment_method',
    'payment_status','currency','notes','cancellation_reason','return_reason',
    'tracking_information','tracking_notes','cod_amount','goods_value','product_value',
    'merchant_goods_value','delivery_fee','delivery_price','base_price',
    'manual_delivery_price','price_source','discount_amount','discount','customer_total',
    'collected_amount','paid_amount','remaining_amount','merchant_due','company_revenue',
    'subtotal','total','total_amount','total_price','amount','price','delivery_fee_mode',
    'financial_version','pickup_lat','pickup_lng','sender_lat','sender_lng','receiver_lat',
    'receiver_lng','delivery_lat','delivery_lng','driver_lat','driver_lng','current_lat',
    'current_lng','live_lat','live_lng','status','status_history','created_at','updated_at',
    'is_deleted','deleted_at','deleted_by','deletion_reason','archived_at','restored_at','restored_by'
  ];
  v_numeric_keys constant text[] := array[
    'order_count','weight','pieces','cod_amount','goods_value','product_value',
    'merchant_goods_value','delivery_fee','delivery_price','base_price',
    'manual_delivery_price','discount_amount','discount','customer_total','collected_amount',
    'paid_amount','remaining_amount','merchant_due','company_revenue','subtotal','total',
    'total_amount','total_price','amount','price','financial_version','pickup_lat','pickup_lng',
    'sender_lat','sender_lng','receiver_lat','receiver_lng','delivery_lat','delivery_lng',
    'driver_lat','driver_lng','current_lat','current_lng','live_lat','live_lng'
  ];
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.daynight_admin_or_support() then raise exception 'not_authorized'; end if;

  select * into v_existing
  from public.admin_order_mutation_audit_v3 a
  where a.actor_id = v_actor
    and a.request_id = v_request_id
    and a.operation = 'create'
  order by a.created_at desc
  limit 1;

  if v_existing.id is not null then
    select * into v_created from public.orders where id = v_existing.order_id;
    return jsonb_build_object(
      'ok', true,
      'success', true,
      'operation', 'create',
      'order', coalesce(to_jsonb(v_created), v_existing.after_data),
      'warnings', v_existing.warnings,
      'reconciliation_required', v_existing.reconciliation_required,
      'audit_id', v_existing.id,
      'request_id', v_request_id,
      'changed_fields', v_existing.changed_fields,
      'replayed', true
    );
  end if;

  v_patch := v_patch - 'id' - 'created_by' - 'financial_posted_at';
  v_status := public.dn_admin_normalize_status_v3(coalesce(v_patch ->> 'status', 'pending'));
  if v_status is null then raise exception 'invalid_order_status: %', coalesce(v_patch ->> 'status', 'null'); end if;
  v_patch := jsonb_set(v_patch, '{status}', to_jsonb(v_status), true);

  v_reference := coalesce(
    nullif(btrim(v_patch ->> 'tracking_number'), ''),
    nullif(btrim(v_patch ->> 'tracking_code'), ''),
    nullif(btrim(v_patch ->> 'invoice_number'), ''),
    'DN-' || to_char(v_now, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  );
  v_patch := jsonb_set(v_patch, '{tracking_number}', to_jsonb(v_reference), true);
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='tracking_code') then
    v_patch := jsonb_set(v_patch, '{tracking_code}', to_jsonb(v_reference), true);
  end if;
  v_patch := jsonb_set(v_patch, '{invoice_number}', to_jsonb(coalesce(nullif(btrim(v_patch ->> 'invoice_number'), ''), v_reference)), true);

  v_patch := v_patch || jsonb_build_object(
    'source_channel', coalesce(nullif(v_patch ->> 'source_channel', ''), 'admin_order_v3'),
    'source_domain', coalesce(nullif(v_patch ->> 'source_domain', ''), 'daynightae.com'),
    'shipping_scope', coalesce(nullif(v_patch ->> 'shipping_scope', ''), 'local'),
    'service_type', coalesce(nullif(v_patch ->> 'service_type', ''), 'standard'),
    'payment_method', coalesce(nullif(v_patch ->> 'payment_method', ''), 'cod'),
    'currency', coalesce(nullif(v_patch ->> 'currency', ''), 'AED'),
    'order_count', coalesce(v_patch -> 'order_count', '1'::jsonb),
    'pieces', coalesce(v_patch -> 'pieces', v_patch -> 'order_count', '1'::jsonb),
    'weight', coalesce(v_patch -> 'weight', '1'::jsonb),
    'goods_value', coalesce(v_patch -> 'goods_value', '0'::jsonb),
    'delivery_fee', coalesce(v_patch -> 'delivery_fee', v_patch -> 'delivery_price', '0'::jsonb),
    'discount_amount', coalesce(v_patch -> 'discount_amount', '0'::jsonb),
    'customer_total', coalesce(v_patch -> 'customer_total', v_patch -> 'total', '0'::jsonb),
    'merchant_due', coalesce(v_patch -> 'merchant_due', '0'::jsonb),
    'company_revenue', coalesce(v_patch -> 'company_revenue', v_patch -> 'delivery_fee', '0'::jsonb),
    'cod_amount', coalesce(v_patch -> 'cod_amount', '0'::jsonb),
    'created_at', coalesce(v_patch -> 'created_at', to_jsonb(v_now)),
    'updated_at', to_jsonb(v_now),
    'is_deleted', false
  );

  foreach v_key in array v_numeric_keys loop
    if v_patch ? v_key and jsonb_typeof(v_patch -> v_key) <> 'null' then
      v_raw := coalesce(v_patch ->> v_key, '');
      v_numeric := public.dn_admin_safe_numeric_v3(v_raw);
      if v_numeric is null then raise exception 'invalid_numeric_value: %', v_key; end if;
      if v_key = any(array[
        'order_count','weight','pieces','cod_amount','goods_value','product_value',
        'merchant_goods_value','delivery_fee','delivery_price','base_price',
        'manual_delivery_price','discount_amount','discount','customer_total','collected_amount',
        'paid_amount','remaining_amount','company_revenue','subtotal','total','total_amount',
        'total_price','amount','price','financial_version'
      ]) and v_numeric < 0 then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code','negative_numeric_normalized','field',v_key,'entered',v_raw,'saved',0
        ));
        v_reconciliation := true;
        v_numeric := 0;
      end if;
      if v_key = any(array['order_count','pieces','financial_version']) then
        v_numeric := round(v_numeric,0);
        if v_key = any(array['order_count','pieces']) then v_numeric := greatest(v_numeric,1); end if;
      elsif v_key='weight' then
        v_numeric := greatest(v_numeric,0.1);
      end if;
      v_patch := jsonb_set(v_patch,array[v_key],to_jsonb(v_numeric),true);
    end if;
  end loop;

  if v_patch ? 'merchant_id' and jsonb_typeof(v_patch -> 'merchant_id') <> 'null'
     and nullif(btrim(v_patch ->> 'merchant_id'),'') is not null then
    v_candidate_merchant := public.dn_admin_safe_uuid_v3(v_patch ->> 'merchant_id');
    if v_candidate_merchant is null then
      v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason','invalid_merchant_id'));
      v_reconciliation := true;
    else
      select * into v_merchant from public.merchants where id=v_candidate_merchant;
      if v_merchant.id is null then
        v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason','merchant_record_not_found','merchant_id',v_candidate_merchant));
        v_reconciliation := true;
      end if;
    end if;
  elsif nullif(btrim(v_patch ->> 'merchant_code'),'') is not null then
    select count(*),(array_agg(m.id order by m.id))[1] into v_candidate_count,v_candidate_merchant
    from public.merchants m
    where lower(btrim(coalesce(m.merchant_code,'')))=lower(btrim(v_patch ->> 'merchant_code'));
    if v_candidate_count=1 then
      select * into v_merchant from public.merchants where id=v_candidate_merchant;
      v_patch := jsonb_set(v_patch,'{merchant_id}',to_jsonb(v_candidate_merchant),true);
    else
      v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason',case when v_candidate_count=0 then 'exact_code_not_found' else 'exact_code_ambiguous' end,'merchant_code',v_patch ->> 'merchant_code'));
      v_reconciliation := true;
    end if;
  elsif nullif(regexp_replace(coalesce(v_patch ->> 'merchant_phone',''),'\D','','g'),'') is not null then
    select count(*),(array_agg(m.id order by m.id))[1] into v_candidate_count,v_candidate_merchant
    from public.merchants m
    where right(regexp_replace(coalesce(m.phone,''),'\D','','g'),9)=right(regexp_replace(v_patch ->> 'merchant_phone','\D','','g'),9);
    if v_candidate_count=1 then
      select * into v_merchant from public.merchants where id=v_candidate_merchant;
      v_patch := jsonb_set(v_patch,'{merchant_id}',to_jsonb(v_candidate_merchant),true);
    else
      v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason',case when v_candidate_count=0 then 'exact_phone_not_found' else 'exact_phone_ambiguous' end));
      v_reconciliation := true;
    end if;
  else
    v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
  end if;

  if v_merchant.id is not null then
    if not (v_patch ? 'merchant_code') then v_patch := jsonb_set(v_patch,'{merchant_code}',coalesce(to_jsonb(v_merchant.merchant_code),'null'::jsonb),true); end if;
    if not (v_patch ? 'merchant_name') then v_patch := jsonb_set(v_patch,'{merchant_name}',coalesce(to_jsonb(v_merchant.trade_name),'null'::jsonb),true); end if;
    begin
      if public.dn_merchant_portal_link_count(v_merchant.id)=0 then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason','merchant_portal_account_not_linked','merchant_id',v_merchant.id));
        v_reconciliation := true;
      end if;
    exception when others then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_check_unavailable','merchant_id',v_merchant.id));
      v_reconciliation := true;
    end;
  end if;

  v_coupon := public.canonical_order_coupon(v_patch ->> 'coupon_number');
  if v_coupon is null then
    v_patch := jsonb_set(v_patch,'{coupon_number}','null'::jsonb,true);
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','coupon_reconciliation_required','reason','coupon_missing_or_blank'));
    v_reconciliation := true;
  else
    v_coupon_key := public.normalized_order_coupon(v_coupon);
    select o.id into v_conflict_order
    from public.orders o
    where public.normalized_order_coupon(o.coupon_number)=v_coupon_key
    order by o.created_at asc nulls last,o.id
    limit 1;
    if v_conflict_order is not null then
      v_patch := jsonb_set(v_patch,'{coupon_number}','null'::jsonb,true);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','coupon_reconciliation_required','reason','coupon_conflict','requested_coupon',v_coupon,'conflicting_order_id',v_conflict_order));
      v_reconciliation := true;
    else
      v_patch := jsonb_set(v_patch,'{coupon_number}',to_jsonb(v_coupon),true);
    end if;
  end if;

  for v_key in select key from jsonb_each(v_patch) loop
    if jsonb_typeof(v_patch -> v_key)='null'
       and exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='orders' and c.column_name=v_key and c.is_nullable='NO') then
      v_patch := v_patch - v_key;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','non_nullable_clear_ignored','field',v_key));
      v_reconciliation := true;
    end if;
  end loop;

  select string_agg(format('%I',c.column_name),', ' order by c.ordinal_position),
         string_agg(format('(jsonb_populate_record(null::public.orders,$1)).%I',c.column_name),', ' order by c.ordinal_position)
  into v_columns,v_values
  from information_schema.columns c
  where c.table_schema='public' and c.table_name='orders'
    and c.column_name=any(v_allowed)
    and v_patch ? c.column_name
    and coalesce(c.is_generated,'NEVER')='NEVER'
    and coalesce(c.identity_generation,'')<>'ALWAYS';

  if nullif(v_columns,'') is null then raise exception 'admin_order_v3_create_payload_empty'; end if;

  perform set_config('daynight.admin_order_override','on',true);
  execute format('insert into public.orders (%s) select %s returning *',v_columns,v_values)
    using v_patch into v_created;
  perform set_config('daynight.admin_order_override','off',true);

  if v_created.id is null then raise exception 'admin_order_v3_create_returned_no_row'; end if;
  v_created_json := to_jsonb(v_created);

  begin
    execute 'insert into public.order_status_history(order_id,status,note,created_at)
             select $1,(jsonb_populate_record(null::public.order_status_history,jsonb_build_object(''status'',$2))).status,$3,$4'
      using v_created.id,v_status,coalesce(v_reason,'Admin order creation'),v_now;
  exception when others then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','timeline_reconciliation_required','sqlstate',sqlstate));
    v_reconciliation := true;
  end;

  v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','notification_sync_queued','status',v_status));
  v_reconciliation := true;

  insert into public.admin_order_mutation_audit_v3(
    order_id,operation,request_id,actor_id,source_page,reason,old_status,new_status,
    changed_fields,warnings,reconciliation_required,before_data,after_data
  ) values (
    v_created.id,'create',v_request_id,v_actor,v_source_page,v_reason,null,v_status,
    array(select jsonb_object_keys(v_created_json)),v_warnings,v_reconciliation,null,v_created_json
  ) returning id into v_audit_id;

  for v_warning in select value from jsonb_array_elements(v_warnings) loop
    begin
      insert into public.admin_order_reconciliation_queue(order_id,request_id,warning_code,warning_detail,created_by)
      values(v_created.id,v_request_id,coalesce(nullif(v_warning ->> 'code',''),'admin_order_warning'),v_warning,v_actor)
      on conflict(order_id,request_id,warning_code) do nothing;
    exception when others then null;
    end;
  end loop;

  return jsonb_build_object(
    'ok',true,'success',true,'operation','create','order',v_created_json,
    'warnings',v_warnings,'reconciliation_required',v_reconciliation,
    'audit_id',v_audit_id,'request_id',v_request_id,
    'changed_fields',to_jsonb(array(select jsonb_object_keys(v_created_json))),
    'replayed',false,'core_saved_at',v_now
  );
exception when others then
  perform set_config('daynight.admin_order_override','off',true);
  raise exception using
    errcode=coalesce(nullif(sqlstate,''),'P0001'),
    message='admin_create_order_v3_failed: ' || sqlerrm,
    detail='SQLSTATE=' || sqlstate || '; request_id=' || coalesce(v_request_id,'null'),
    hint='Only authentication, authorization, status and core value conversion can block Admin order creation. Optional relationships are warnings.';
end;
$;

revoke all on function public.admin_create_order_v3(jsonb) from public,anon;
grant execute on function public.admin_create_order_v3(jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';

commit;
