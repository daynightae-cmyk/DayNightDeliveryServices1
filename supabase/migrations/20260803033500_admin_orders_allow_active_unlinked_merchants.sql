-- DAY NIGHT DELIVERY SERVICES
-- Admin order creation must use the exact selected active merchant row.
-- A merchant portal login/link is a visibility/authentication concern and must not
-- block an authorized administrator from creating or editing that merchant's order.
-- Merchant portal reads remain isolated by merchant_session_id and effective links.

begin;

create or replace function public.dn_resolve_admin_order_merchant_uuid(p_merchant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant public.merchants%rowtype;
begin
  if p_merchant_id is null then
    raise exception using errcode = '23502', message = 'merchant_required';
  end if;

  -- Stabilize the selected legal merchant for the surrounding order transaction.
  lock table public.merchants in share mode;

  select * into v_merchant
  from public.merchants m
  where m.id = p_merchant_id;

  if v_merchant.id is null then
    raise exception using
      errcode = '23503',
      message = 'merchant_not_found_for_order',
      detail = jsonb_build_object('merchant_id', p_merchant_id)::text;
  end if;

  if lower(coalesce(v_merchant.status, 'active')) in ('deleted','archived','blocked','suspended') then
    raise exception using
      errcode = '23514',
      message = 'merchant_inactive_for_order',
      detail = jsonb_build_object(
        'merchant_id', v_merchant.id,
        'merchant_code', v_merchant.merchant_code,
        'status', v_merchant.status
      )::text;
  end if;

  return v_merchant.id;
end;
$$;

revoke all on function public.dn_resolve_admin_order_merchant_uuid(uuid) from public, anon;

create or replace function public.admin_resolve_order_merchant(p_merchant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_resolved_id uuid;
  v_merchant public.merchants%rowtype;
  v_users uuid[] := '{}'::uuid[];
  v_actual_link_count integer := 0;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  v_resolved_id := public.dn_resolve_admin_order_merchant_uuid(p_merchant_id);
  select * into v_merchant from public.merchants where id = v_resolved_id;
  v_users := public.dn_effective_portal_user_ids(v_resolved_id);
  v_actual_link_count := coalesce(cardinality(v_users), 0);

  return jsonb_build_object(
    'ok', true,
    'selected_merchant_id', p_merchant_id,
    'canonical_merchant_id', v_resolved_id,
    'canonicalized', false,
    -- Backward compatibility for the already-deployed admin client. Older builds
    -- interpreted this field as order-write eligibility. It does not grant portal
    -- access; actual portal readiness is reported separately below.
    'portal_link_count', greatest(v_actual_link_count, 1),
    'actual_portal_link_count', v_actual_link_count,
    'portal_ready', v_actual_link_count > 0,
    'order_write_allowed', true,
    'portal_user_ids', v_users,
    'merchant', to_jsonb(v_merchant),
    'resolution_source', case
      when v_actual_link_count > 0 then 'EXACT_ACTIVE_MERCHANT_WITH_PORTAL_LINK'
      else 'EXACT_ACTIVE_MERCHANT_NO_PORTAL_LINK'
    end,
    'ownership_rule', 'admin writes exact active merchants.id; portal reads remain link-scoped'
  );
end;
$$;

create or replace function public.dn_enforce_canonical_order_merchant_link()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_resolved_id uuid;
  v_merchant public.merchants%rowtype;
  v_dependencies jsonb;
  v_dependent_updates jsonb := '{}'::jsonb;
  v_admin_actor boolean := false;
begin
  if tg_op = 'UPDATE'
     and new.merchant_id is not distinct from old.merchant_id
     and new.merchant_code is not distinct from old.merchant_code
     and new.merchant_name is not distinct from old.merchant_name then
    return new;
  end if;

  if auth.role() = 'service_role' then
    v_admin_actor := true;
  elsif auth.uid() is not null then
    begin
      v_admin_actor := public.is_admin_or_support();
    exception when others then
      v_admin_actor := false;
    end;
  end if;

  -- Merchant ownership changes must never recalculate or rewrite money. An older
  -- financial normalization trigger can run before this trigger on UPDATE, so
  -- restore every financial/legacy amount from OLD before syncing identity.
  if tg_op = 'UPDATE' and new.merchant_id is distinct from old.merchant_id then
    new.cod_amount := old.cod_amount;
    new.goods_value := old.goods_value;
    new.delivery_fee := old.delivery_fee;
    new.discount_amount := old.discount_amount;
    new.customer_total := old.customer_total;
    new.merchant_due := old.merchant_due;
    new.company_revenue := old.company_revenue;
    new.delivery_price := old.delivery_price;
    new.base_price := old.base_price;
    new.subtotal := old.subtotal;
    new.total := old.total;
    new.total_price := old.total_price;
    new.amount := old.amount;
    new.price := old.price;
    new.collected_amount := old.collected_amount;
    new.delivery_fee_mode := old.delivery_fee_mode;
    new.manual_delivery_price := old.manual_delivery_price;
    new.price_source := old.price_source;
    new.payment_method := old.payment_method;
    new.currency := old.currency;
    new.financial_version := old.financial_version;
    new.financial_posted_at := old.financial_posted_at;
  end if;

  if new.merchant_id is null then
    if nullif(btrim(coalesce(new.merchant_code, '')), '') is not null
       or nullif(btrim(coalesce(new.merchant_name, '')), '') is not null then
      raise exception using
        errcode = '23502',
        message = 'merchant_id_required_for_selected_merchant',
        hint = 'اختر تاجرًا صحيحًا ثم أعد حفظ الطلب.';
    end if;
    return new;
  end if;

  -- Authorized administration writes the exact selected active merchant. Portal
  -- and other non-admin writes retain the strict portal-linked canonical resolver.
  if v_admin_actor then
    v_resolved_id := public.dn_resolve_admin_order_merchant_uuid(new.merchant_id);
  else
    v_resolved_id := public.dn_resolve_portal_merchant_uuid(new.merchant_id);
  end if;

  select * into v_merchant from public.merchants where id = v_resolved_id;
  new.merchant_id := v_merchant.id;
  new.merchant_code := v_merchant.merchant_code;
  new.merchant_name := v_merchant.trade_name;

  if tg_op = 'UPDATE'
     and coalesce(current_setting('daynight.order_merchant_reconciliation', true), '') <> 'backfill' then
    v_dependencies := public.dn_order_dependency_ownership_snapshot(
      old.id,
      old.merchant_id,
      v_merchant.id
    );
    if coalesce((v_dependencies ->> 'total_conflicts')::integer, 0) <> 0 then
      raise exception using
        errcode = '23514',
        message = 'dependent_merchant_security_conflict',
        detail = jsonb_build_object('order_id', old.id, 'dependencies', v_dependencies)::text;
    end if;

    v_dependent_updates := public.dn_apply_order_dependency_ownership(
      old.id,
      old.merchant_id,
      v_merchant.id
    );

    insert into public.order_merchant_repair_audit (
      run_id, order_id, old_merchant_id, new_merchant_id,
      old_merchant_code, new_merchant_code, old_merchant_name, new_merchant_name,
      resolution_evidence, dependent_rows_updated, migration_version,
      operation_type, executed_by
    ) values (
      null, old.id, old.merchant_id, v_merchant.id,
      old.merchant_code, v_merchant.merchant_code, old.merchant_name, v_merchant.trade_name,
      case
        when old.merchant_id is distinct from v_merchant.id and v_admin_actor
          then 'AUTHORIZED_ADMIN_EXACT_MERCHANT_CHANGE'
        when old.merchant_id is distinct from v_merchant.id
          then 'AUTHORIZED_CANONICAL_MERCHANT_CHANGE'
        else 'CANONICAL_MERCHANT_DISPLAY_SYNC'
      end,
      v_dependent_updates, '20260803033500', 'INTERACTIVE_UPDATE', auth.uid()
    );
  end if;

  return new;
end;
$$;

create or replace function public.admin_create_canonical_merchant_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_selected_id uuid := public.admin_safe_uuid(p_order ->> 'merchant_id');
  v_resolved_id uuid;
  v_merchant public.merchants%rowtype;
  v_payload jsonb;
  v_created public.orders%rowtype;
  v_saved public.orders%rowtype;
begin
  if auth.uid() is null or not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  v_resolved_id := public.dn_resolve_admin_order_merchant_uuid(v_selected_id);
  select * into v_merchant from public.merchants where id = v_resolved_id;

  v_payload := coalesce(p_order, '{}'::jsonb) || jsonb_build_object(
    'merchant_id', v_merchant.id,
    'merchant_code', v_merchant.merchant_code,
    'merchant_name', v_merchant.trade_name
  );

  select * into v_created from public.admin_create_coupon_order(v_payload);
  if v_created.id is null then
    raise exception 'canonical_merchant_order_creation_returned_no_row';
  end if;

  select * into v_saved from public.orders where id = v_created.id for update;
  if v_saved.id is null or v_saved.merchant_id is distinct from v_resolved_id then
    raise exception using
      errcode = '23514',
      message = 'saved_order_merchant_id_mismatch',
      detail = jsonb_build_object(
        'order_id', v_created.id,
        'expected_merchant_id', v_resolved_id,
        'saved_merchant_id', v_saved.merchant_id
      )::text;
  end if;

  return v_saved;
end;
$$;

create or replace function public.admin_order_merchant_write_health(p_merchant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_id uuid;
  v_actual_links integer;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  v_id := public.dn_resolve_admin_order_merchant_uuid(p_merchant_id);
  v_actual_links := public.dn_merchant_portal_link_count(v_id);

  return jsonb_build_object(
    'ok', true,
    'merchant_id', v_id,
    'admin_order_write_allowed', true,
    'portal_ready', v_actual_links > 0,
    'actual_portal_link_count', v_actual_links,
    'portal_visibility_rule_unchanged', true,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.admin_order_merchant_write_health(uuid) from public, anon;
grant execute on function public.admin_order_merchant_write_health(uuid) to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');

commit;
