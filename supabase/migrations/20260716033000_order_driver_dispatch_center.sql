-- =========================================================
-- DAY NIGHT — ORDER ↔ DRIVER DISPATCH CENTER
-- Production-safe assignment, reassignment and unassignment.
-- No demo orders, fake drivers or fallback coordinates.
-- =========================================================

create extension if not exists pgcrypto;

-- Assignment metadata on the real orders table.
alter table public.orders add column if not exists driver_assigned_at timestamptz;
alter table public.orders add column if not exists driver_assigned_by uuid;
alter table public.orders add column if not exists driver_assignment_note text;
alter table public.orders add column if not exists driver_assignment_version integer not null default 0;

create index if not exists orders_dispatch_driver_idx
  on public.orders(assigned_driver_id, status, created_at desc);
create index if not exists orders_dispatch_unassigned_idx
  on public.orders(status, created_at desc)
  where assigned_driver_id is null and driver_id is null;

-- Immutable operational history: every assign/reassign/unassign action is recorded.
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

create index if not exists driver_assignment_history_order_idx
  on public.driver_assignment_history(order_id, created_at desc);
create index if not exists driver_assignment_history_driver_idx
  on public.driver_assignment_history(driver_id, created_at desc);
create index if not exists driver_assignment_history_previous_driver_idx
  on public.driver_assignment_history(previous_driver_id, created_at desc);

alter table public.driver_assignment_history enable row level security;

drop policy if exists "admins read driver assignment history" on public.driver_assignment_history;
create policy "admins read driver assignment history"
on public.driver_assignment_history for select to authenticated
using (public.driver_is_admin());

drop policy if exists "drivers read own assignment history" on public.driver_assignment_history;
create policy "drivers read own assignment history"
on public.driver_assignment_history for select to authenticated
using (
  exists (
    select 1
    from public.driver_profiles dp
    where (dp.id = auth.uid() or dp.user_id = auth.uid())
      and (dp.id = driver_assignment_history.driver_id or dp.id = driver_assignment_history.previous_driver_id)
  )
  or public.driver_is_admin()
);

-- Main dispatch transaction.
create or replace function public.admin_dispatch_order(
  p_order_id text,
  p_driver_id uuid default null,
  p_action text default 'assign',
  p_note text default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_action text := lower(replace(btrim(coalesce(p_action,'assign')),' ','_'));
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_order public.orders%rowtype;
  v_driver public.driver_profiles%rowtype;
  v_previous_driver public.driver_profiles%rowtype;
  v_previous_driver_id uuid;
  v_previous_status text;
  v_resulting_status text;
  v_other_active integer := 0;
  v_history_action text;
begin
  if not public.driver_is_admin() then
    raise exception 'not_authorized';
  end if;

  if v_action not in ('assign','reassign','unassign') then
    raise exception 'invalid_dispatch_action: %', p_action;
  end if;

  select * into v_order
  from public.orders
  where id::text = p_order_id
     or tracking_number = p_order_id
     or invoice_number = p_order_id
     or coupon_number = p_order_id
  limit 1
  for update;

  if not found then raise exception 'order_not_found'; end if;

  v_previous_driver_id := coalesce(v_order.assigned_driver_id, v_order.driver_id);
  v_previous_status := lower(replace(btrim(coalesce(v_order.status,'pending')),' ','_'));

  if v_previous_status in ('delivered','cancelled','returned') then
    raise exception 'closed_order_cannot_be_dispatched';
  end if;

  if v_action = 'unassign' then
    if v_previous_driver_id is null then
      return jsonb_build_object(
        'ok', true,
        'action', 'unassigned',
        'order_id', v_order.id,
        'already_unassigned', true,
        'status', v_previous_status
      );
    end if;

    if v_note is null then raise exception 'unassignment_reason_required'; end if;

    if v_previous_status in ('accepted','picked_up','in_transit') and not coalesce(p_force,false) then
      raise exception 'force_required_for_in_progress_unassign';
    end if;

    v_resulting_status := case
      when v_previous_status in ('accepted','picked_up','in_transit') then 'review'
      when v_previous_status = 'assigned' then 'confirmed'
      else v_previous_status
    end;

    select * into v_previous_driver
    from public.driver_profiles
    where id = v_previous_driver_id
    limit 1;

    update public.orders
    set driver_id = null,
        assigned_driver_id = null,
        driver_name = null,
        driver_phone = null,
        status = v_resulting_status,
        driver_assigned_at = null,
        driver_assigned_by = auth.uid(),
        driver_assignment_note = v_note,
        driver_assignment_version = coalesce(driver_assignment_version,0) + 1,
        updated_at = now()
    where id = v_order.id
    returning * into v_order;

    update public.driver_locations
    set current_order_id = null,
        updated_at = now()
    where driver_id = v_previous_driver_id
      and current_order_id = v_order.id;

    select count(*) into v_other_active
    from public.orders o
    where coalesce(o.assigned_driver_id,o.driver_id) = v_previous_driver_id
      and o.id <> v_order.id
      and lower(replace(coalesce(o.status,''),' ','_')) not in ('delivered','cancelled','returned');

    if v_other_active = 0 and coalesce(v_previous_driver.shift_status::text,'offline') not in ('offline','paused') then
      update public.driver_profiles set shift_status = 'available', updated_at = now()
      where id = v_previous_driver_id;
    end if;

    insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at)
    values (
      v_order.id,
      v_resulting_status,
      'Driver unassigned: ' || v_note,
      v_previous_driver_id,
      auth.uid(),
      now()
    );

    insert into public.driver_assignment_history(
      order_id,action,previous_driver_id,driver_id,previous_status,resulting_status,note,forced,actor_id
    ) values (
      v_order.id,'unassigned',v_previous_driver_id,null,v_previous_status,v_resulting_status,v_note,coalesce(p_force,false),auth.uid()
    );

    if v_previous_driver.user_id is not null then
      perform public.driver_try_notification(
        v_previous_driver.user_id,
        'Order assignment removed',
        coalesce(v_order.tracking_number,v_order.id::text),
        'driver_unassignment'
      );
    end if;

    perform public.driver_audit(
      v_previous_driver_id,
      'order_unassigned',
      v_order.id,
      jsonb_build_object('note',v_note,'previous_status',v_previous_status,'resulting_status',v_resulting_status,'forced',p_force)
    );

    return jsonb_build_object(
      'ok',true,
      'action','unassigned',
      'order_id',v_order.id,
      'previous_driver_id',v_previous_driver_id,
      'status',v_resulting_status,
      'assignment_version',v_order.driver_assignment_version
    );
  end if;

  if p_driver_id is null then raise exception 'driver_required'; end if;

  select * into v_driver
  from public.driver_profiles
  where id = p_driver_id
    and status::text = 'active'
  limit 1;

  if not found then raise exception 'active_driver_not_found'; end if;

  if v_previous_driver_id = v_driver.id then
    update public.orders
    set driver_assignment_note = coalesce(v_note,driver_assignment_note),
        driver_assigned_at = coalesce(driver_assigned_at,now()),
        driver_assigned_by = auth.uid(),
        updated_at = now()
    where id = v_order.id
    returning * into v_order;

    return jsonb_build_object(
      'ok',true,
      'action','assigned',
      'order_id',v_order.id,
      'driver_id',v_driver.id,
      'already_assigned',true,
      'status',v_order.status,
      'assignment_version',v_order.driver_assignment_version
    );
  end if;

  if v_previous_driver_id is not null and v_note is null then
    raise exception 'reassignment_reason_required';
  end if;

  if v_previous_driver_id is not null
     and v_previous_status in ('accepted','picked_up','in_transit')
     and not coalesce(p_force,false) then
    raise exception 'force_required_for_in_progress_reassign';
  end if;

  if v_previous_driver_id is not null then
    select * into v_previous_driver
    from public.driver_profiles
    where id = v_previous_driver_id
    limit 1;
  end if;

  v_resulting_status := case
    when v_previous_status in ('pending','review','confirmed','postponed','assigned') then 'assigned'
    else v_previous_status
  end;
  v_history_action := case when v_previous_driver_id is null then 'assigned' else 'reassigned' end;

  update public.orders
  set driver_id = v_driver.id,
      assigned_driver_id = v_driver.id,
      driver_name = coalesce(v_driver.full_name,v_driver.name),
      driver_phone = v_driver.phone,
      status = v_resulting_status,
      driver_assigned_at = now(),
      driver_assigned_by = auth.uid(),
      driver_assignment_note = v_note,
      driver_assignment_version = coalesce(driver_assignment_version,0) + 1,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  if v_previous_driver_id is not null then
    update public.driver_locations
    set current_order_id = null,
        updated_at = now()
    where driver_id = v_previous_driver_id
      and current_order_id = v_order.id;

    select count(*) into v_other_active
    from public.orders o
    where coalesce(o.assigned_driver_id,o.driver_id) = v_previous_driver_id
      and o.id <> v_order.id
      and lower(replace(coalesce(o.status,''),' ','_')) not in ('delivered','cancelled','returned');

    if v_other_active = 0 and coalesce(v_previous_driver.shift_status::text,'offline') not in ('offline','paused') then
      update public.driver_profiles set shift_status = 'available', updated_at = now()
      where id = v_previous_driver_id;
    end if;
  end if;

  update public.driver_locations
  set current_order_id = v_order.id,
      updated_at = now()
  where driver_id = v_driver.id;

  if coalesce(v_driver.shift_status::text,'offline') <> 'offline' then
    update public.driver_profiles set shift_status = 'busy', updated_at = now()
    where id = v_driver.id;
  end if;

  insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at)
  values (
    v_order.id,
    v_resulting_status,
    case
      when v_history_action = 'assigned' then coalesce(v_note,'Admin assigned driver')
      else 'Driver reassigned: ' || v_note
    end,
    v_driver.id,
    auth.uid(),
    now()
  );

  insert into public.driver_assignment_history(
    order_id,action,previous_driver_id,driver_id,previous_status,resulting_status,note,forced,actor_id
  ) values (
    v_order.id,v_history_action,v_previous_driver_id,v_driver.id,v_previous_status,v_resulting_status,v_note,coalesce(p_force,false),auth.uid()
  );

  if v_previous_driver_id is not null and v_previous_driver.user_id is not null then
    perform public.driver_try_notification(
      v_previous_driver.user_id,
      'Order reassigned',
      coalesce(v_order.tracking_number,v_order.id::text),
      'driver_reassignment_removed'
    );
    perform public.driver_audit(
      v_previous_driver_id,
      'order_reassigned_from',
      v_order.id,
      jsonb_build_object('new_driver_id',v_driver.id,'note',v_note,'forced',p_force)
    );
  end if;

  perform public.driver_try_notification(
    v_driver.user_id,
    case when v_history_action = 'assigned' then 'New assigned order' else 'Reassigned order' end,
    coalesce(v_order.tracking_number,v_order.id::text),
    'driver_assignment'
  );

  perform public.driver_audit(
    v_driver.id,
    case when v_history_action = 'assigned' then 'order_assigned' else 'order_reassigned_to' end,
    v_order.id,
    jsonb_build_object('previous_driver_id',v_previous_driver_id,'note',v_note,'status',v_resulting_status,'forced',p_force)
  );

  return jsonb_build_object(
    'ok',true,
    'action',v_history_action,
    'order_id',v_order.id,
    'driver_id',v_driver.id,
    'previous_driver_id',v_previous_driver_id,
    'status',v_resulting_status,
    'assignment_version',v_order.driver_assignment_version
  );
end
$dn$;

-- Backward-compatible wrapper used by existing frontend calls.
create or replace function public.admin_assign_driver(
  p_order_id text,
  p_driver_id uuid,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = public, auth
as $dn$
  select public.admin_dispatch_order(
    p_order_id,
    p_driver_id,
    'assign',
    p_note,
    false
  );
$dn$;

create or replace function public.admin_unassign_driver(
  p_order_id text,
  p_note text,
  p_force boolean default false
)
returns jsonb
language sql
security definer
set search_path = public, auth
as $dn$
  select public.admin_dispatch_order(
    p_order_id,
    null,
    'unassign',
    p_note,
    p_force
  );
$dn$;

create or replace function public.admin_dispatch_health()
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
      and exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='orders' and column_name='driver_assignment_version'
      ),
    'assignment_history_table',to_regclass('public.driver_assignment_history') is not null,
    'dispatch_rpc',to_regprocedure('public.admin_dispatch_order(text,uuid,text,text,boolean)') is not null,
    'assign_wrapper',to_regprocedure('public.admin_assign_driver(text,uuid,text)') is not null,
    'unassign_wrapper',to_regprocedure('public.admin_unassign_driver(text,text,boolean)') is not null,
    'orders_assignment_metadata',(
      select count(*) = 4
      from information_schema.columns
      where table_schema='public' and table_name='orders'
        and column_name in ('driver_assigned_at','driver_assigned_by','driver_assignment_note','driver_assignment_version')
    )
  );
$dn$;

grant execute on function public.admin_dispatch_order(text,uuid,text,text,boolean) to authenticated;
grant execute on function public.admin_assign_driver(text,uuid,text) to authenticated;
grant execute on function public.admin_unassign_driver(text,text,boolean) to authenticated;
grant execute on function public.admin_dispatch_health() to authenticated;
grant select on public.driver_assignment_history to authenticated;

-- Realtime assignment/history updates.
do $dn$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='driver_assignment_history'
  ) then
    alter publication supabase_realtime add table public.driver_assignment_history;
  end if;
exception when duplicate_object then null;
end
$dn$;
