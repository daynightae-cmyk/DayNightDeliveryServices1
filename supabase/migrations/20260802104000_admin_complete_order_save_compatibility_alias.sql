-- DAY NIGHT DELIVERY SERVICES
-- Make the already-deployed web bundle use the corrected complete-save path.
--
-- Existing production JavaScript calls admin_update_order_complete_verified.
-- Rename the original implementation to an internal v1 name, let v2 call that
-- implementation with the guarded transaction context and sender fallback, then
-- recreate the public legacy name as a compatibility wrapper around v2.

begin;

do $$
begin
  if to_regprocedure('public.admin_update_order_complete_verified_v1_internal(jsonb)') is null
     and to_regprocedure('public.admin_update_order_complete_verified(jsonb)') is not null then
    alter function public.admin_update_order_complete_verified(jsonb)
      rename to admin_update_order_complete_verified_v1_internal;
  end if;
end
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
  v_effective_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_patch jsonb := coalesce(p_payload -> 'patch', '{}'::jsonb);
  v_requested_merchant_id uuid := public.dn_safe_uuid(v_patch ->> 'merchant_id');
  v_merchant public.merchants%rowtype;
  v_merchant_json jsonb := '{}'::jsonb;
  v_sender_name text;
  v_sender_phone text;
  v_sender_city text;
  v_sender_address text;
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

  if v_requested_merchant_id is not null then
    select m.*
      into v_merchant
    from public.merchants m
    where m.id = v_requested_merchant_id
    limit 1;

    if v_merchant.id is not null then
      v_merchant_json := to_jsonb(v_merchant);
    end if;
  end if;

  select candidate
    into v_sender_name
  from unnest(array[
    nullif(btrim(v_patch ->> 'sender_name'), ''),
    nullif(btrim(v_merchant_json ->> 'owner_name'), ''),
    nullif(btrim(v_merchant_json ->> 'trade_name'), ''),
    nullif(btrim(v_before ->> 'sender_name'), '')
  ]) with ordinality as candidates(candidate, position)
  where candidate is not null
    and lower(candidate) not in ('day night merchant', 'unknown', 'n/a')
  order by position
  limit 1;

  v_sender_phone := coalesce(
    nullif(btrim(v_patch ->> 'sender_phone'), ''),
    nullif(btrim(v_merchant_json ->> 'phone'), ''),
    nullif(btrim(v_before ->> 'sender_phone'), '')
  );
  v_sender_city := coalesce(
    nullif(btrim(v_patch ->> 'sender_city'), ''),
    nullif(btrim(v_merchant_json ->> 'emirate'), ''),
    nullif(btrim(v_merchant_json ->> 'city'), ''),
    nullif(btrim(v_before ->> 'sender_city'), '')
  );
  v_sender_address := coalesce(
    nullif(btrim(v_patch ->> 'sender_address'), ''),
    nullif(btrim(v_merchant_json ->> 'pickup_address'), ''),
    nullif(btrim(v_merchant_json ->> 'address'), ''),
    nullif(btrim(v_before ->> 'sender_address'), '')
  );

  v_patch := v_patch || jsonb_build_object(
    'sender_name', coalesce(v_sender_name, v_before ->> 'sender_name'),
    'sender_phone', coalesce(v_sender_phone, v_before ->> 'sender_phone'),
    'sender_city', coalesce(v_sender_city, v_before ->> 'sender_city'),
    'sender_address', coalesce(v_sender_address, v_before ->> 'sender_address')
  );
  v_effective_payload := jsonb_set(v_effective_payload, '{patch}', v_patch, true);

  v_before_invalid := public.dn_admin_order_invalid_fields(v_before);

  perform set_config('daynight.complete_order_edit', 'on', true);
  v_result := public.admin_update_order_complete_verified_v1_internal(v_effective_payload);
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
    'sender_identity_resolved', true,
    'compatibility_entrypoint', 'admin_update_order_complete_verified',
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

create or replace function public.admin_update_order_complete_verified(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
begin
  return public.admin_update_order_complete_verified_v2(p_payload);
end;
$$;

revoke all on function public.admin_update_order_complete_verified_v1_internal(jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_order_complete_verified_v1_internal(jsonb) to service_role;
revoke all on function public.admin_update_order_complete_verified_v2(jsonb) from public, anon;
grant execute on function public.admin_update_order_complete_verified_v2(jsonb) to authenticated, service_role;
revoke all on function public.admin_update_order_complete_verified(jsonb) from public, anon;
grant execute on function public.admin_update_order_complete_verified(jsonb) to authenticated, service_role;

-- Exercise the exact compatibility entrypoint used by the already-deployed site.
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

  select to_jsonb(o) into v_before
  from public.orders o
  where o.id = v_order_id;

  if v_before is null then
    raise exception 'order_not_found';
  end if;

  select count(*) into v_audit_before
  from public.order_admin_edit_audit a
  where a.order_id = v_order_id;

  begin
    v_save_result := public.admin_update_order_complete_verified(p_payload);

    if coalesce((v_save_result ->> 'ok')::boolean, false) is not true then
      raise exception 'complete_save_probe_save_result_not_ok';
    end if;

    raise exception using errcode = 'P0001', message = v_marker;
  exception when raise_exception then
    if sqlerrm is distinct from v_marker then
      raise;
    end if;
  end;

  select to_jsonb(o) into v_after
  from public.orders o
  where o.id = v_order_id;

  select count(*) into v_audit_after
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
    'tested_entrypoint', 'admin_update_order_complete_verified',
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

create or replace function public.admin_complete_order_save_compatibility_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_update_order_complete_verified(jsonb)') is not null
      and to_regprocedure('public.admin_update_order_complete_verified_v2(jsonb)') is not null
      and to_regprocedure('public.admin_update_order_complete_verified_v1_internal(jsonb)') is not null,
    'deployed_client_entrypoint', 'admin_update_order_complete_verified',
    'corrected_implementation', 'admin_update_order_complete_verified_v2',
    'original_implementation', 'admin_update_order_complete_verified_v1_internal',
    'probe_tests_deployed_client_entrypoint', true,
    'checked_at', now()
  );
$$;

revoke all on function public.admin_complete_order_save_compatibility_health() from public, anon;
grant execute on function public.admin_complete_order_save_compatibility_health() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
