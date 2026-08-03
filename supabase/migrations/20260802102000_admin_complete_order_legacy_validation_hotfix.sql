-- DAY NIGHT DELIVERY SERVICES
-- Fix complete admin saves that change the canonical merchant on historical orders.
--
-- The complete editor updates ownership before the remaining core fields so the
-- canonical ownership trigger can synchronize all dependent ledgers. The generic
-- required-field trigger previously validated that intermediate ownership-only row
-- and rejected some historical delivered orders with admin_order_validation_failed.
--
-- Safety model:
-- 1. only the authenticated admin/support SECURITY DEFINER wrapper enables the
--    transaction-local bypass;
-- 2. the bypass applies only to the generic required-field trigger;
-- 3. the completed row is validated before the wrapper returns;
-- 4. any newly introduced invalid field rolls the entire transaction back;
-- 5. existing historical defects may remain only when this edit did not create them.

begin;

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
  v_complete_edit boolean :=
    lower(coalesce(current_setting('daynight.complete_order_edit', true), 'off')) = 'on';
  v_invalid text[] := '{}';
  v_old_invalid text[] := '{}';
  v_new_invalid text[] := '{}';
begin
  if v_status = 'draft' then
    return new;
  end if;

  if v_source <> 'admin_panel' and not v_admin_actor then
    return new;
  end if;

  -- The trusted wrapper validates the final row after every intermediate write.
  -- Direct table updates and every other RPC continue through the normal guard.
  if tg_op = 'UPDATE' and v_complete_edit and v_admin_actor then
    return new;
  end if;

  v_invalid := public.dn_admin_order_invalid_fields(v_payload);
  if coalesce(array_length(v_invalid, 1), 0) = 0 then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_old_invalid := public.dn_admin_order_invalid_fields(v_old_payload);

    select coalesce(array_agg(field_name order by field_name), '{}')
      into v_new_invalid
    from (
      select unnest(v_invalid) as field_name
      except
      select unnest(v_old_invalid) as field_name
    ) delta;

    if coalesce(array_length(v_new_invalid, 1), 0) = 0 then
      return new;
    end if;

    v_invalid := v_new_invalid;
  end if;

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
end;
$$;

create or replace function public.admin_update_order_complete_verified_v2(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_order_id uuid := public.dn_safe_uuid(p_payload ->> 'order_id');
  v_reason text := btrim(coalesce(p_payload ->> 'reason', ''));
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_before_invalid text[] := '{}';
  v_after_invalid text[] := '{}';
  v_new_invalid text[] := '{}';
  v_message text;
  v_detail text;
  v_hint text;
  v_state text;
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

  select to_jsonb(o)
    into v_before
  from public.orders o
  where o.id = v_order_id
  for update;

  if v_before is null then
    raise exception 'order_not_found';
  end if;

  v_before_invalid := public.dn_admin_order_invalid_fields(v_before);

  perform set_config('daynight.complete_order_edit', 'on', true);
  v_result := public.admin_update_order_complete_verified(p_payload);
  perform set_config('daynight.complete_order_edit', 'off', true);

  v_after := coalesce(v_result -> 'order', '{}'::jsonb);
  if coalesce(v_result ->> 'ok', 'false') <> 'true'
     or nullif(v_after ->> 'id', '') is null then
    raise exception 'complete_order_edit_v2_returned_no_order';
  end if;

  v_after_invalid := public.dn_admin_order_invalid_fields(v_after);

  select coalesce(array_agg(field_name order by field_name), '{}')
    into v_new_invalid
  from (
    select unnest(v_after_invalid) as field_name
    except
    select unnest(v_before_invalid) as field_name
  ) delta;

  if coalesce(array_length(v_new_invalid, 1), 0) > 0 then
    raise exception using
      errcode = '23514',
      message = 'complete_order_edit_created_invalid_fields',
      detail = array_to_string(v_new_invalid, ','),
      hint = 'Complete the listed order fields and save again. No partial change was committed.';
  end if;

  return v_result || jsonb_build_object(
    'final_validation_checked', true,
    'existing_legacy_invalid_fields', to_jsonb(v_before_invalid),
    'final_invalid_fields', to_jsonb(v_after_invalid),
    'new_invalid_fields', to_jsonb(v_new_invalid)
  );
exception when others then
  get stacked diagnostics
    v_message = message_text,
    v_detail = pg_exception_detail,
    v_hint = pg_exception_hint,
    v_state = returned_sqlstate;
  perform set_config('daynight.complete_order_edit', 'off', true);

  raise exception using
    errcode = coalesce(nullif(v_state, ''), 'P0001'),
    message = 'admin_update_order_complete_verified_v2_failed: ' || coalesce(v_message, 'unknown_error'),
    detail = concat_ws(' | ',
      nullif(v_detail, ''),
      'SQLSTATE=' || coalesce(v_state, 'P0001'),
      'order_id=' || coalesce(v_order_id::text, 'null')
    ),
    hint = coalesce(
      nullif(v_hint, ''),
      'The complete order edit was rolled back. Review the original database reason.'
    );
end;
$$;

revoke all on function public.admin_update_order_complete_verified_v2(jsonb) from public, anon;
grant execute on function public.admin_update_order_complete_verified_v2(jsonb) to authenticated, service_role;

-- Keep the existing rollback-safe production probe name, but execute the corrected
-- final-validation wrapper so every future CI run exercises the same path as Save.
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
  v_message text;
  v_detail text;
  v_hint text;
  v_state text;
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
    v_save_result := public.admin_update_order_complete_verified_v2(p_payload);

    if coalesce((v_save_result ->> 'ok')::boolean, false) is not true then
      raise exception 'complete_save_probe_save_result_not_ok';
    end if;

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
    'corrected_save_rpc', 'admin_update_order_complete_verified_v2',
    'rollback_verified', true,
    'order_unchanged', true,
    'audit_unchanged', true,
    'tested_at', clock_timestamp()
  );
exception when others then
  get stacked diagnostics
    v_message = message_text,
    v_detail = pg_exception_detail,
    v_hint = pg_exception_hint,
    v_state = returned_sqlstate;

  raise exception using
    errcode = coalesce(nullif(v_state, ''), 'P0001'),
    message = 'admin_probe_order_complete_save_failed: ' || coalesce(v_message, 'unknown_error'),
    detail = concat_ws(' | ',
      nullif(v_detail, ''),
      'SQLSTATE=' || coalesce(v_state, 'P0001'),
      'order_id=' || coalesce(v_order_id::text, 'null')
    ),
    hint = coalesce(
      nullif(v_hint, ''),
      'The real complete-order save path failed before rollback verification.'
    );
end;
$$;

revoke all on function public.admin_probe_order_complete_save(jsonb) from public, anon;
grant execute on function public.admin_probe_order_complete_save(jsonb) to authenticated, service_role;

create or replace function public.admin_complete_order_legacy_validation_hotfix_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_update_order_complete_verified_v2(jsonb)') is not null
      and to_regprocedure('public.admin_probe_order_complete_save(jsonb)') is not null
      and to_regprocedure('public.dn_guard_admin_order_required_fields()') is not null,
    'corrected_rpc', to_regprocedure('public.admin_update_order_complete_verified_v2(jsonb)')::text,
    'intermediate_validation_bypass', 'transaction_local_admin_wrapper_only',
    'final_validation', 'new_invalid_fields_rejected',
    'rollback_probe_uses_corrected_rpc', true,
    'checked_at', now()
  );
$$;

revoke all on function public.admin_complete_order_legacy_validation_hotfix_health() from public, anon;
grant execute on function public.admin_complete_order_legacy_validation_hotfix_health() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
