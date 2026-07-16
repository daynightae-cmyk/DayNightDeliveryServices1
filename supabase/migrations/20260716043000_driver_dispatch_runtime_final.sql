-- =========================================================
-- DAY NIGHT — FINAL DRIVER DISPATCH RUNTIME
-- One stable JSON RPC, legacy compatibility, schema-cache reload,
-- assignment reconciliation, RLS and realtime verification.
-- No demo rows and no fabricated locations.
-- =========================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Real-order assignment metadata and immutable history.
-- -----------------------------------------------------------------------------

alter table public.orders add column if not exists driver_assigned_at timestamptz;
alter table public.orders add column if not exists driver_assigned_by uuid;
alter table public.orders add column if not exists driver_assignment_note text;
alter table public.orders add column if not exists driver_assignment_version integer not null default 0;

create table if not exists public.driver_assignment_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  action text not null check (action in ('assigned','reassigned','unassigned')),
  previous_driver_id uuid references public.driver_profiles(id) on delete set null,
  driver_id uuid references public.driver_profiles(id) on delete set null,
  previous_status text,
  resulting_status text,
  note text,
  forced boolean not null default false,
  actor_id uuid,
  created_at timestamptz not null default now()
);

alter table public.driver_assignment_history add column if not exists actor_id uuid;
alter table public.driver_assignment_history add column if not exists forced boolean not null default false;
alter table public.driver_assignment_history add column if not exists note text;
alter table public.driver_assignment_history add column if not exists previous_status text;
alter table public.driver_assignment_history add column if not exists resulting_status text;
alter table public.driver_assignment_history add column if not exists created_at timestamptz not null default now();

create index if not exists orders_dispatch_driver_idx
  on public.orders(assigned_driver_id, status, created_at desc);
create index if not exists orders_dispatch_legacy_driver_idx
  on public.orders(driver_id, status, created_at desc);
create index if not exists orders_dispatch_unassigned_idx
  on public.orders(status, created_at desc)
  where assigned_driver_id is null and driver_id is null;
create index if not exists driver_assignment_history_order_idx
  on public.driver_assignment_history(order_id, created_at desc);
create index if not exists driver_assignment_history_driver_idx
  on public.driver_assignment_history(driver_id, created_at desc);
create index if not exists driver_assignment_history_previous_driver_idx
  on public.driver_assignment_history(previous_driver_id, created_at desc);

-- Reconcile legacy rows. Never invent a driver: only copy an already stored real id.
update public.orders o
set assigned_driver_id = coalesce(o.assigned_driver_id, o.driver_id),
    driver_id = coalesce(o.driver_id, o.assigned_driver_id),
    driver_assignment_version = greatest(coalesce(o.driver_assignment_version, 0), 1),
    driver_assigned_at = coalesce(o.driver_assigned_at, o.updated_at, o.created_at),
    updated_at = coalesce(o.updated_at, now())
where (o.assigned_driver_id is not null or o.driver_id is not null)
  and (o.assigned_driver_id is distinct from coalesce(o.assigned_driver_id, o.driver_id)
       or o.driver_id is distinct from coalesce(o.driver_id, o.assigned_driver_id)
       or coalesce(o.driver_assignment_version, 0) = 0
       or o.driver_assigned_at is null);

update public.orders o
set driver_name = coalesce(nullif(o.driver_name, ''), dp.full_name, dp.name),
    driver_phone = coalesce(nullif(o.driver_phone, ''), dp.phone)
from public.driver_profiles dp
where dp.id = coalesce(o.assigned_driver_id, o.driver_id)
  and (nullif(o.driver_name, '') is null or nullif(o.driver_phone, '') is null);

-- -----------------------------------------------------------------------------
-- 2) RLS for the real immutable assignment history.
-- -----------------------------------------------------------------------------

alter table public.driver_assignment_history enable row level security;

drop policy if exists "admins read driver assignment history" on public.driver_assignment_history;
create policy "admins read driver assignment history"
on public.driver_assignment_history
for select
to authenticated
using (public.driver_is_admin());

drop policy if exists "drivers read own assignment history" on public.driver_assignment_history;
create policy "drivers read own assignment history"
on public.driver_assignment_history
for select
to authenticated
using (
  public.driver_is_admin()
  or exists (
    select 1
    from public.driver_profiles dp
    where (dp.id = auth.uid() or dp.user_id = auth.uid())
      and (
        dp.id = driver_assignment_history.driver_id
        or dp.id = driver_assignment_history.previous_driver_id
      )
  )
);

-- -----------------------------------------------------------------------------
-- 3) Stable single-argument RPC. This avoids PostgREST overload/signature drift.
-- The transactional business rules remain in admin_dispatch_order.
-- -----------------------------------------------------------------------------

create or replace function public.admin_dispatch_order_runtime(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_order_id text := nullif(btrim(coalesce(p_payload->>'order_id', '')), '');
  v_driver_text text := nullif(btrim(coalesce(p_payload->>'driver_id', '')), '');
  v_driver_id uuid;
  v_action text := lower(replace(btrim(coalesce(p_payload->>'action', 'assign')), ' ', '_'));
  v_note text := nullif(btrim(coalesce(p_payload->>'note', '')), '');
  v_force boolean := coalesce((p_payload->>'force')::boolean, false);
begin
  if v_order_id is null then
    raise exception 'order_required';
  end if;

  if v_driver_text is not null then
    begin
      v_driver_id := v_driver_text::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid_driver_id';
    end;
  end if;

  return public.admin_dispatch_order(
    v_order_id,
    v_driver_id,
    v_action,
    v_note,
    v_force
  );
end
$dn$;

-- Candidate snapshot used by order-list assignment dialogs.
create or replace function public.admin_dispatch_candidates(p_order_id text default null)
returns jsonb
language sql
security definer
stable
set search_path = public, auth
as $dn$
  with target_order as (
    select o.*
    from public.orders o
    where p_order_id is not null
      and (
        o.id::text = p_order_id
        or o.tracking_number = p_order_id
        or o.invoice_number = p_order_id
        or o.coupon_number = p_order_id
      )
    limit 1
  ), active_load as (
    select
      coalesce(o.assigned_driver_id, o.driver_id) as driver_id,
      count(*)::integer as active_orders
    from public.orders o
    where coalesce(o.assigned_driver_id, o.driver_id) is not null
      and lower(replace(coalesce(o.status::text, ''), ' ', '_')) not in ('delivered','cancelled','returned')
    group by coalesce(o.assigned_driver_id, o.driver_id)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', dp.id,
      'user_id', dp.user_id,
      'full_name', coalesce(dp.full_name, dp.name),
      'phone', dp.phone,
      'status', dp.status::text,
      'shift_status', dp.shift_status::text,
      'vehicle_type', dp.vehicle_type,
      'vehicle_plate', dp.vehicle_plate,
      'avatar_path', dp.avatar_path,
      'active_orders', coalesce(al.active_orders, 0),
      'is_online', coalesce(dl.is_online, false),
      'last_seen_at', dl.last_seen_at,
      'lat', coalesce(dl.lat, dl.latitude),
      'lng', coalesce(dl.lng, dl.longitude),
      'accuracy', dl.accuracy,
      'current_order_id', dl.current_order_id,
      'is_current_driver', exists (
        select 1 from target_order t
        where coalesce(t.assigned_driver_id, t.driver_id) = dp.id
      )
    )
    order by
      case when coalesce(dl.is_online, false) then 0 else 1 end,
      case dp.shift_status::text when 'available' then 0 when 'busy' then 1 when 'paused' then 2 else 3 end,
      coalesce(al.active_orders, 0),
      coalesce(dl.last_seen_at, 'epoch'::timestamptz) desc
  ), '[]'::jsonb)
  from public.driver_profiles dp
  left join public.driver_locations dl on dl.driver_id = dp.id
  left join active_load al on al.driver_id = dp.id
  where dp.status::text = 'active';
$dn$;

-- A single production health report that checks tables, RPCs and grants.
create or replace function public.admin_dispatch_runtime_health()
returns jsonb
language sql
security definer
stable
set search_path = public
as $dn$
  select jsonb_build_object(
    'ok',
      to_regclass('public.driver_assignment_history') is not null
      and to_regprocedure('public.admin_dispatch_order(text,uuid,text,text,boolean)') is not null
      and to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null
      and to_regprocedure('public.admin_dispatch_candidates(text)') is not null
      and has_function_privilege('authenticated', 'public.admin_dispatch_order_runtime(jsonb)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.admin_dispatch_candidates(text)', 'EXECUTE')
      and (
        select count(*) = 4
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'orders'
          and column_name in (
            'driver_assigned_at',
            'driver_assigned_by',
            'driver_assignment_note',
            'driver_assignment_version'
          )
      ),
    'assignment_history_table', to_regclass('public.driver_assignment_history') is not null,
    'transaction_rpc', to_regprocedure('public.admin_dispatch_order(text,uuid,text,text,boolean)') is not null,
    'runtime_rpc', to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null,
    'candidates_rpc', to_regprocedure('public.admin_dispatch_candidates(text)') is not null,
    'runtime_execute_grant', has_function_privilege('authenticated', 'public.admin_dispatch_order_runtime(jsonb)', 'EXECUTE'),
    'candidates_execute_grant', has_function_privilege('authenticated', 'public.admin_dispatch_candidates(text)', 'EXECUTE'),
    'history_select_grant', has_table_privilege('authenticated', 'public.driver_assignment_history', 'SELECT'),
    'orders_assignment_metadata', (
      select count(*) = 4
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name in (
          'driver_assigned_at',
          'driver_assigned_by',
          'driver_assignment_note',
          'driver_assignment_version'
        )
    )
  );
$dn$;

grant execute on function public.admin_dispatch_order_runtime(jsonb) to authenticated;
grant execute on function public.admin_dispatch_candidates(text) to authenticated;
grant execute on function public.admin_dispatch_runtime_health() to authenticated;
grant execute on function public.admin_dispatch_order(text,uuid,text,text,boolean) to authenticated;
grant execute on function public.admin_assign_driver(text,uuid,text) to authenticated;
grant execute on function public.admin_unassign_driver(text,text,boolean) to authenticated;
grant select on public.driver_assignment_history to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Realtime publications. Existing real rows only.
-- -----------------------------------------------------------------------------

do $dn$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
exception when duplicate_object then null;
end
$dn$;

do $dn$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_assignment_history'
  ) then
    alter publication supabase_realtime add table public.driver_assignment_history;
  end if;
exception when duplicate_object then null;
end
$dn$;

-- Force PostgREST to discover the functions immediately after this migration.
select pg_notify('pgrst', 'reload schema');
select pg_notify('pgrst', 'reload config');

-- The SQL editor displays one definitive result row after a successful run.
select public.admin_dispatch_runtime_health();
