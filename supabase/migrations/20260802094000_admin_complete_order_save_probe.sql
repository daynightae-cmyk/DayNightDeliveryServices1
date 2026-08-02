-- DAY NIGHT DELIVERY SERVICES
-- Rollback-safe production probe for the complete admin order save path.
--
-- This function executes the exact public save RPC inside a PL/pgSQL
-- subtransaction, deliberately rolls the subtransaction back, and then proves
-- that the order row and audit count are unchanged. It is safe to run against a
-- real order because no update or audit record survives the probe.

begin;

create or replace function public.admin_probe_order_complete_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_order_id uuid := public.dn_safe_uuid(p_payload ->> 'order_id');
  v_before jsonb;
  v_after jsonb;
  v_audit_before bigint := 0;
  v_audit_after bigint := 0;
  v_save_result jsonb;
  v_marker constant text := 'DAY_NIGHT_COMPLETE_ORDER_SAVE_PROBE_ROLLBACK';
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

  select to_jsonb(o)
  into v_before
  from public.orders o
  where o.id = v_order_id;

  if v_before is null then
    raise exception 'order_not_found';
  end if;

  select count(*)
  into v_audit_before
  from public.order_admin_edit_audit a
  where a.order_id = v_order_id;

  begin
    v_save_result := public.admin_update_order_complete_verified(p_payload);

    if coalesce((v_save_result ->> 'ok')::boolean, false) is not true then
      raise exception 'complete_save_probe_save_result_not_ok';
    end if;

    -- Raising inside this nested block rolls back every write performed by the
    -- real save RPC, including order changes, financial adjustments, dependent
    -- ownership changes and audit records.
    raise exception using
      errcode = 'P0001',
      message = v_marker;
  exception when raise_exception then
    if sqlerrm is distinct from v_marker then
      raise;
    end if;
  end;

  select to_jsonb(o)
  into v_after
  from public.orders o
  where o.id = v_order_id;

  select count(*)
  into v_audit_after
  from public.order_admin_edit_audit a
  where a.order_id = v_order_id;

  if v_after is distinct from v_before then
    raise exception 'complete_save_probe_order_rollback_failed';
  end if;
  if v_audit_after is distinct from v_audit_before then
    raise exception 'complete_save_probe_audit_rollback_failed';
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'real_save_rpc_executed', true,
    'rollback_verified', true,
    'order_unchanged', true,
    'audit_unchanged', true,
    'tested_at', clock_timestamp()
  );
exception when others then
  raise exception using
    message = 'admin_probe_order_complete_save_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate || '; order_id=' || coalesce(v_order_id::text, 'null'),
    hint = 'The real complete-order save path failed before rollback verification.';
end;
$$;

revoke all on function public.admin_probe_order_complete_save(jsonb) from public, anon;
grant execute on function public.admin_probe_order_complete_save(jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
