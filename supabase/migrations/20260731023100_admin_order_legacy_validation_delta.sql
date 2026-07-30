-- DAY NIGHT DELIVERY SERVICES
-- Allow safe updates to historical orders without weakening new-order validation.
--
-- Historical rows may predate fields that are mandatory today. An update is allowed
-- when it does not introduce any new validation defect. Clearing a valid field or
-- creating a new invalid value is still blocked.

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

    -- Existing legacy defects are not relevant to a financial, note, status or
    -- incremental correction. Only a newly introduced defect blocks the update.
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

create or replace function public.admin_order_legacy_validation_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.dn_guard_admin_order_required_fields()') is not null
      and exists (
        select 1
        from pg_trigger
        where tgname = 'dn_guard_admin_order_required_fields'
          and not tgisinternal
      ),
    'new_orders_require_complete_fields', true,
    'legacy_updates_block_only_new_defects', true,
    'financial_only_legacy_updates_allowed', true,
    'checked_at', now()
  );
$$;

revoke all on function public.admin_order_legacy_validation_health() from public, anon;
grant execute on function public.admin_order_legacy_validation_health() to authenticated;

notify pgrst, 'reload schema';

commit;
