-- CORRECT HOTFIX: DRIVER START 23502 / driver_locations latitude NOT NULL.
-- Run this after 20260722090000_driver_chat_payroll_and_mission_runtime.sql.
-- Starting a mission must never create fake/null GPS coordinates.

begin;

do $dn_hotfix$
declare
  v_regprocedure regprocedure := to_regprocedure('public.driver_start_mission(text,text)');
  v_before text;
  v_after text;
  v_old text := $old$
  insert into public.driver_locations(driver_id,current_order_id,is_online,last_seen_at,created_at,updated_at)
  values(v_driver.id,v_order.id,true,now(),now(),now())
  on conflict(driver_id) do update set current_order_id=excluded.current_order_id,is_online=true,last_seen_at=now(),updated_at=now();$old$;
  v_new text := $new$
  -- Mission start is independent from the first GPS fix. Link a real existing
  -- location row only; driver_report_location creates it with real coordinates.
  update public.driver_locations
  set current_order_id=v_order.id,is_online=true,last_seen_at=now(),updated_at=now()
  where driver_id=v_driver.id;$new$;
begin
  if v_regprocedure is null then
    raise exception 'driver_start_mission_missing_run_20260722090000_first';
  end if;

  select pg_get_functiondef(v_regprocedure) into v_before;
  v_after := replace(v_before,v_old,v_new);

  if v_after=v_before then
    if position('insert into public.driver_locations' in lower(v_before))>0 then
      raise exception 'driver_start_mission_location_insert_signature_not_repaired';
    end if;
    -- The canonical migration may already contain the repaired UPDATE-only
    -- implementation. In that case this hotfix is safely idempotent.
  else
    execute v_after;
  end if;
end
$dn_hotfix$;

create or replace function public.driver_start_mission_location_hotfix_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $dn_health$
  with mission as (
    select to_regprocedure('public.driver_start_mission(text,text)') as rpc
  ), definition as (
    select rpc,case when rpc is null then '' else lower(pg_get_functiondef(rpc)) end as body
    from mission
  )
  select jsonb_build_object(
    'ok',rpc is not null
      and position('insert into public.driver_locations' in body)=0
      and position('update public.driver_locations' in body)>0,
    'mission_rpc',rpc is not null,
    'location_insert_removed',position('insert into public.driver_locations' in body)=0,
    'existing_location_update',position('update public.driver_locations' in body)>0,
    'gps_source','driver_report_location_only'
  )
  from definition;
$dn_health$;

revoke all on function public.driver_start_mission_location_hotfix_health() from public;
grant execute on function public.driver_start_mission_location_hotfix_health() to anon,authenticated;

select pg_notify('pgrst','reload schema');
select pg_notify('pgrst','reload config');

commit;

-- Expected SQL Editor result: one row with ok=true and
-- location_insert_removed=true. "No rows returned" is not sufficient.
select public.driver_start_mission_location_hotfix_health();
