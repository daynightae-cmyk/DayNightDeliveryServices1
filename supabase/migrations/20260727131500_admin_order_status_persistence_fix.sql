-- DAY NIGHT DELIVERY SERVICES
-- Authoritative admin order-status persistence and delivered financial posting.
--
-- Fixes the production symptom where the admin selects "Delivered / تسليم وترحيل",
-- the UI appears to save, then the order returns to its previous status after refresh.
-- The RPC updates one exact order UUID, verifies the stored status in the same
-- transaction, and never reports success for zero affected rows.

begin;

create or replace function public.admin_update_order_status_verified(
  p_order_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text := lower(replace(btrim(coalesce(p_status, '')), '-', '_'));
  v_note text := coalesce(nullif(btrim(p_note), ''), 'Admin status update');
  v_status_type text;
  v_before jsonb;
  v_after jsonb;
  v_history jsonb;
  v_now timestamptz := clock_timestamp();
  v_deferred_zero_merchant boolean := false;
  v_set_sql text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  v_status := case v_status
    when 'waiting' then 'pending'
    when 'under_review' then 'review'
    when 'needs_review' then 'review'
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
    else v_status
  end;

  if v_status not in (
    'pending', 'review', 'confirmed', 'assigned', 'picked_up',
    'in_transit', 'delivered', 'postponed', 'returned', 'cancelled'
  ) then
    raise exception 'invalid_order_status: %', v_status;
  end if;

  select to_jsonb(o)
    into v_before
  from public.orders o
  where o.id = p_order_id
  for update;

  if v_before is null then
    raise exception 'order_not_found';
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into v_status_type
  from pg_attribute a
  where a.attrelid = 'public.orders'::regclass
    and a.attname = 'status'
    and a.attnum > 0
    and not a.attisdropped;

  if nullif(v_status_type, '') is null then
    raise exception 'orders_status_column_not_found';
  end if;

  v_history := case
    when jsonb_typeof(v_before -> 'status_history') = 'array'
      then v_before -> 'status_history'
    else '[]'::jsonb
  end || jsonb_build_array(jsonb_build_object(
    'status', v_status,
    'note', v_note,
    'created_at', v_now,
    'date', v_now,
    'timestamp', v_now,
    'changed_by', 'admin',
    'changed_by_user_id', auth.uid()
  ));

  v_deferred_zero_merchant :=
    v_status = 'delivered'
    and lower(coalesce(v_before ->> 'delivery_fee_mode', '')) = 'deduct_from_merchant'
    and coalesce(nullif(v_before ->> 'goods_value', '')::numeric, 0) = 0
    and coalesce(nullif(v_before ->> 'delivery_fee', '')::numeric, 0) = 0
    and coalesce(nullif(v_before ->> 'discount_amount', '')::numeric, 0) = 0
    and coalesce(nullif(v_before ->> 'customer_total', '')::numeric, 0) = 0;

  v_set_sql := format(
    'status = $1::%s, status_history = $3::jsonb, updated_at = $4',
    v_status_type
  );

  -- "Deliver & post" is atomic. Normal delivered orders receive their collected
  -- amount and financial posting timestamp in this same update. The intentional
  -- zero-value merchant case remains deferred for the separate Accounts close RPC.
  if v_status = 'delivered' and not v_deferred_zero_merchant then
    v_set_sql := v_set_sql ||
      ', collected_amount = coalesce(customer_total, 0), financial_posted_at = coalesce(financial_posted_at, $4)';
  elsif v_status = 'delivered' and v_deferred_zero_merchant then
    v_set_sql := v_set_sql || ', collected_amount = 0, financial_posted_at = null';
  end if;

  execute format(
    'update public.orders o set %s where o.id = $2 returning to_jsonb(o)',
    v_set_sql
  )
  using v_status, p_order_id, v_history, v_now
  into v_after;

  if v_after is null then
    raise exception 'order_status_update_affected_zero_rows';
  end if;

  if lower(replace(coalesce(v_after ->> 'status', ''), '-', '_')) <> v_status then
    raise exception 'order_status_readback_mismatch';
  end if;

  if v_status = 'delivered'
     and not v_deferred_zero_merchant
     and nullif(v_after ->> 'financial_posted_at', '') is null then
    raise exception 'delivery_financial_posting_not_confirmed';
  end if;

  begin
    insert into public.admin_audit_events(
      entity_type,
      entity_id,
      action,
      before_data,
      after_data,
      metadata,
      actor_id
    ) values (
      'order',
      p_order_id::text,
      case when v_status = 'delivered' then 'deliver_and_post' else 'status_update' end,
      v_before,
      v_after,
      jsonb_build_object(
        'requested_status', p_status,
        'persisted_status', v_status,
        'note', v_note,
        'financial_posted', nullif(v_after ->> 'financial_posted_at', '') is not null,
        'deferred_zero_merchant', v_deferred_zero_merchant
      ),
      auth.uid()
    );
  exception
    when undefined_table or undefined_column or insufficient_privilege then
      null;
  end;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', v_after ->> 'status',
    'financial_posted', nullif(v_after ->> 'financial_posted_at', '') is not null,
    'financial_posted_at', v_after ->> 'financial_posted_at',
    'deferred_zero_merchant', v_deferred_zero_merchant,
    'updated_at', v_after ->> 'updated_at'
  );
exception when others then
  raise exception using
    message = 'admin_update_order_status_verified_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate || '; order_id=' || coalesce(p_order_id::text, 'null') || '; requested_status=' || coalesce(p_status, 'null'),
    hint = 'Apply this migration, confirm the authenticated profile role is admin/support, and verify the orders financial trigger is installed.';
end;
$$;

revoke all on function public.admin_update_order_status_verified(uuid, text, text)
from public, anon;
grant execute on function public.admin_update_order_status_verified(uuid, text, text)
to authenticated;

create or replace function public.admin_order_status_persistence_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_update_order_status_verified(uuid,text,text)') is not null
      and to_regprocedure('public.daynight_normalize_financial_order()') is not null,
    'verified_status_rpc',
      to_regprocedure('public.admin_update_order_status_verified(uuid,text,text)') is not null,
    'financial_normalizer',
      to_regprocedure('public.daynight_normalize_financial_order()') is not null,
    'orders_table', to_regclass('public.orders') is not null,
    'checked_at', now()
  );
$$;

revoke all on function public.admin_order_status_persistence_health()
from public, anon;
grant execute on function public.admin_order_status_persistence_health()
to authenticated;

notify pgrst, 'reload schema';

commit;
