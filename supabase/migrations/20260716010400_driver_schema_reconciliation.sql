-- =========================================================
-- DAY NIGHT — FINAL DRIVER SCHEMA RECONCILIATION
-- Supports the production legacy model where:
--   driver_profiles.id -> profiles.id -> auth.users.id
-- Also remains compatible with the newer user_id-based model.
-- No writes to auth.users or auth.identities.
-- =========================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Normalize legacy columns, identifiers and current-location uniqueness.
-- -----------------------------------------------------------------------------

do $dn$
declare
  v_id_references_profiles boolean := false;
begin
  alter table public.profiles alter column phone drop not null;

  alter table public.driver_profiles add column if not exists user_id uuid;
  alter table public.driver_profiles add column if not exists email text;
  alter table public.driver_profiles add column if not exists shift_status text;
  alter table public.driver_profiles add column if not exists vehicle_color text;
  alter table public.driver_profiles add column if not exists emirate text;
  alter table public.driver_profiles add column if not exists license_number text;
  alter table public.driver_profiles add column if not exists emergency_contact text;
  alter table public.driver_profiles add column if not exists last_status_note text;
  alter table public.driver_profiles add column if not exists joined_at timestamptz;
  alter table public.driver_profiles add column if not exists created_at timestamptz;
  alter table public.driver_profiles add column if not exists updated_at timestamptz;

  update public.driver_profiles
  set user_id = id
  where user_id is null
    and exists (select 1 from auth.users au where au.id = driver_profiles.id);

  update public.driver_profiles dp
  set email = lower(au.email),
      joined_at = coalesce(dp.joined_at, dp.created_at, now()),
      created_at = coalesce(dp.created_at, now()),
      updated_at = coalesce(dp.updated_at, now())
  from auth.users au
  where au.id = coalesce(dp.user_id, dp.id);

  select exists (
    select 1
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    where con.contype = 'f'
      and child_ns.nspname = 'public'
      and child.relname = 'driver_profiles'
      and parent_ns.nspname = 'public'
      and parent.relname = 'profiles'
      and con.conkey = array[(select attnum from pg_attribute where attrelid=child.oid and attname='id')]
  ) into v_id_references_profiles;

  -- A shared-primary-key legacy table must never generate an unrelated UUID.
  if v_id_references_profiles then
    alter table public.driver_profiles alter column id drop default;
  end if;

  alter table public.driver_locations alter column id set default gen_random_uuid();
  alter table public.driver_location_history alter column id set default gen_random_uuid();
  if to_regclass('public.driver_events') is not null then
    alter table public.driver_events alter column id set default gen_random_uuid();
  end if;
end
$dn$;

-- Keep one live row per driver, which is required by ON CONFLICT(driver_id).
with ranked as (
  select ctid,
         row_number() over (
           partition by driver_id
           order by coalesce(updated_at,last_seen_at,created_at,now()) desc, ctid desc
         ) as rn
  from public.driver_locations
  where driver_id is not null
)
delete from public.driver_locations target
using ranked
where target.ctid=ranked.ctid and ranked.rn>1;

create unique index if not exists driver_locations_driver_id_uidx
  on public.driver_locations(driver_id);
create index if not exists driver_profiles_user_id_idx
  on public.driver_profiles(user_id);

-- -----------------------------------------------------------------------------
-- 2) Provision an existing Auth user using a single canonical identity.
-- The inserted driver id is the Auth/profile id, satisfying legacy FK schemas.
-- -----------------------------------------------------------------------------

create or replace function public.admin_provision_existing_driver(
  p_email text,
  p_full_name text,
  p_phone text default null,
  p_vehicle_type text default 'Toyota Rush',
  p_vehicle_plate text default null,
  p_emirate text default 'Abu Dhabi'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_user_id uuid;
  v_driver public.driver_profiles%rowtype;
  v_plate text := coalesce(nullif(btrim(coalesce(p_vehicle_plate,'')),''),'DAY-NIGHT-01');
begin
  if auth.uid() is not null and not public.driver_is_admin() then
    raise exception 'not_authorized';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email)=lower(btrim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'auth_user_not_found: %', p_email;
  end if;

  insert into public.profiles(id,role,full_name,phone,is_active,created_at,updated_at)
  values (
    v_user_id,
    'driver',
    coalesce(nullif(btrim(coalesce(p_full_name,'')),''),'DAY NIGHT Driver'),
    nullif(btrim(coalesce(p_phone,'')),''),
    true,
    now(),
    now()
  )
  on conflict (id) do update set
    role='driver',
    full_name=excluded.full_name,
    phone=excluded.phone,
    is_active=true,
    updated_at=now();

  select * into v_driver
  from public.driver_profiles
  where id=v_user_id or user_id=v_user_id
  order by case when id=v_user_id then 0 else 1 end, created_at desc nulls last
  limit 1;

  if found then
    update public.driver_profiles set
      user_id=v_user_id,
      full_name=coalesce(nullif(btrim(coalesce(p_full_name,'')),''),'DAY NIGHT Driver'),
      email=lower(btrim(p_email)),
      phone=nullif(btrim(coalesce(p_phone,'')),''),
      status='active',
      shift_status='offline',
      vehicle_type=coalesce(nullif(btrim(coalesce(p_vehicle_type,'')),''),'Toyota Rush'),
      vehicle_plate=v_plate,
      vehicle_color=coalesce(nullif(vehicle_color,''),'White'),
      emirate=coalesce(nullif(btrim(coalesce(p_emirate,'')),''),'Abu Dhabi'),
      joined_at=coalesce(joined_at,created_at,now()),
      created_at=coalesce(created_at,now()),
      updated_at=now()
    where id=v_driver.id
    returning * into v_driver;
  else
    insert into public.driver_profiles(
      id,user_id,full_name,email,phone,status,shift_status,
      vehicle_type,vehicle_plate,vehicle_color,emirate,
      joined_at,created_at,updated_at
    ) values (
      v_user_id,v_user_id,
      coalesce(nullif(btrim(coalesce(p_full_name,'')),''),'DAY NIGHT Driver'),
      lower(btrim(p_email)),
      nullif(btrim(coalesce(p_phone,'')),''),
      'active','offline',
      coalesce(nullif(btrim(coalesce(p_vehicle_type,'')),''),'Toyota Rush'),
      v_plate,'White',
      coalesce(nullif(btrim(coalesce(p_emirate,'')),''),'Abu Dhabi'),
      now(),now(),now()
    )
    returning * into v_driver;
  end if;

  perform public.driver_audit(
    v_driver.id,
    'driver_provisioned',
    null,
    jsonb_build_object('email',lower(btrim(p_email)),'identity_mode','profile_shared_primary_key')
  );

  return jsonb_build_object(
    'ok',true,
    'auth_user_id',v_user_id,
    'profile_id',v_user_id,
    'driver_profile_id',v_driver.id,
    'driver_user_id',v_driver.user_id,
    'email',lower(btrim(p_email))
  );
end
$dn$;

-- -----------------------------------------------------------------------------
-- 3) Driver RPCs accept both shared-id legacy rows and user_id rows.
-- -----------------------------------------------------------------------------

create or replace function public.driver_get_session_profile()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $dn$
declare
  v_profile public.profiles%rowtype;
  v_driver public.driver_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_profile from public.profiles where id=auth.uid() limit 1;
  if not found then raise exception 'driver_setup_required: public profile missing'; end if;
  if v_profile.role::text <> 'driver' then raise exception 'not_driver'; end if;

  select * into v_driver
  from public.driver_profiles
  where id=auth.uid() or user_id=auth.uid()
  order by case when id=auth.uid() then 0 else 1 end, created_at desc nulls last
  limit 1;

  if not found then raise exception 'driver_setup_required: operational driver profile missing'; end if;

  return jsonb_build_object(
    'profile',jsonb_build_object(
      'id',v_profile.id,
      'role',v_profile.role::text,
      'full_name',v_profile.full_name,
      'phone',v_profile.phone,
      'is_active',v_profile.is_active
    ),
    'driver',to_jsonb(v_driver)
  );
end
$dn$;

create or replace function public.driver_report_location(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_heading double precision default null,
  p_speed double precision default null,
  p_altitude double precision default null,
  p_current_order_id text default null,
  p_battery_level numeric default null,
  p_network_state text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_order_id uuid := public.driver_safe_uuid(p_current_order_id);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;

  select * into v_driver
  from public.driver_profiles
  where (id=auth.uid() or user_id=auth.uid()) and status::text='active'
  order by case when id=auth.uid() then 0 else 1 end, created_at desc nulls last
  limit 1;
  if not found then raise exception 'driver_setup_required_or_inactive'; end if;

  insert into public.driver_locations(
    driver_id,lat,lng,accuracy,heading,speed,altitude,is_online,
    battery_level,network_state,current_order_id,last_seen_at,created_at,updated_at
  ) values (
    v_driver.id,p_lat,p_lng,p_accuracy,p_heading,p_speed,p_altitude,true,
    p_battery_level,p_network_state,v_order_id,now(),now(),now()
  )
  on conflict (driver_id) do update set
    lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,
    heading=excluded.heading,speed=excluded.speed,altitude=excluded.altitude,
    is_online=true,battery_level=excluded.battery_level,
    network_state=excluded.network_state,current_order_id=excluded.current_order_id,
    last_seen_at=now(),updated_at=now();

  insert into public.driver_location_history(
    driver_id,order_id,lat,lng,accuracy,heading,speed,altitude,recorded_at
  ) values (
    v_driver.id,v_order_id,p_lat,p_lng,p_accuracy,p_heading,p_speed,p_altitude,now()
  );

  update public.driver_profiles
  set shift_status=case when v_order_id is null then 'available' else 'busy' end,
      updated_at=now()
  where id=v_driver.id;

  return jsonb_build_object('ok',true,'driver_id',v_driver.id,'recorded_at',now());
end
$dn$;

create or replace function public.driver_set_presence(
  p_online boolean,
  p_shift_status text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_shift text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_driver
  from public.driver_profiles
  where id=auth.uid() or user_id=auth.uid()
  order by case when id=auth.uid() then 0 else 1 end, created_at desc nulls last
  limit 1;
  if not found then raise exception 'driver_setup_required'; end if;
  if v_driver.status::text <> 'active' then raise exception 'driver_inactive'; end if;

  v_shift := case
    when not coalesce(p_online,false) then 'offline'
    when p_shift_status in ('available','busy','paused') then p_shift_status
    else 'available'
  end;

  update public.driver_profiles
  set shift_status=v_shift,
      last_status_note=nullif(btrim(coalesce(p_note,'')),''),
      updated_at=now()
  where id=v_driver.id;

  update public.driver_locations
  set is_online=coalesce(p_online,false),last_seen_at=now(),updated_at=now()
  where driver_id=v_driver.id;

  perform public.driver_audit(v_driver.id,'presence_changed',null,
    jsonb_build_object('online',p_online,'shift_status',v_shift,'note',p_note));

  return jsonb_build_object('ok',true,'driver_id',v_driver.id,'shift_status',v_shift);
end
$dn$;

create or replace function public.driver_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_order public.orders%rowtype;
  v_status text := lower(replace(btrim(coalesce(p_status,'')),' ','_'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_status='failed' then v_status:='cancelled'; end if;
  if v_status not in ('accepted','confirmed','picked_up','in_transit','delivered','cancelled','returned','postponed') then
    raise exception 'unsupported_driver_status: %',p_status;
  end if;
  if v_status in ('delivered','cancelled','returned') and nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'status_note_required';
  end if;

  select * into v_driver
  from public.driver_profiles
  where (id=auth.uid() or user_id=auth.uid()) and status::text='active'
  order by case when id=auth.uid() then 0 else 1 end, created_at desc nulls last
  limit 1;
  if not found then raise exception 'driver_setup_required_or_inactive'; end if;

  select * into v_order
  from public.orders
  where (id::text=p_order_id or tracking_number=p_order_id or invoice_number=p_order_id or coupon_number=p_order_id)
    and (driver_id=v_driver.id or assigned_driver_id=v_driver.id)
  limit 1;
  if not found then raise exception 'order_not_assigned_to_driver'; end if;

  update public.orders set
    status=v_status,
    driver_id=v_driver.id,
    assigned_driver_id=v_driver.id,
    driver_name=coalesce(v_driver.full_name,driver_name),
    driver_phone=coalesce(v_driver.phone,driver_phone),
    updated_at=now()
  where id=v_order.id returning * into v_order;

  insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at)
  values (
    v_order.id,v_status,
    coalesce(nullif(btrim(coalesce(p_note,'')),''),'Driver status update'),
    v_driver.id,auth.uid(),now()
  );

  if v_status in ('delivered','cancelled','returned') then
    update public.driver_locations set current_order_id=null,updated_at=now()
    where driver_id=v_driver.id and current_order_id=v_order.id;
    update public.driver_profiles set shift_status='available',updated_at=now() where id=v_driver.id;
  else
    update public.driver_locations set current_order_id=v_order.id,updated_at=now() where driver_id=v_driver.id;
    update public.driver_profiles set shift_status='busy',updated_at=now() where id=v_driver.id;
  end if;

  perform public.driver_audit(v_driver.id,'order_status_updated',v_order.id,
    jsonb_build_object('status',v_status,'note',p_note));

  return jsonb_build_object('ok',true,'order_id',v_order.id,'status',v_status);
end
$dn$;

-- -----------------------------------------------------------------------------
-- 4) RLS compatibility for both identity models.
-- -----------------------------------------------------------------------------

drop policy if exists "drivers read own driver profile" on public.driver_profiles;
create policy "drivers read own driver profile"
on public.driver_profiles for select to authenticated
using (id=auth.uid() or user_id=auth.uid() or public.driver_is_admin());

drop policy if exists "drivers read own current location" on public.driver_locations;
create policy "drivers read own current location"
on public.driver_locations for select to authenticated
using (
  exists(select 1 from public.driver_profiles dp
         where dp.id=driver_locations.driver_id
           and (dp.id=auth.uid() or dp.user_id=auth.uid()))
  or public.driver_is_admin()
);

drop policy if exists "drivers read own trail" on public.driver_location_history;
create policy "drivers read own trail"
on public.driver_location_history for select to authenticated
using (
  exists(select 1 from public.driver_profiles dp
         where dp.id=driver_location_history.driver_id
           and (dp.id=auth.uid() or dp.user_id=auth.uid()))
  or public.driver_is_admin()
);

drop policy if exists "drivers read assigned orders" on public.orders;
create policy "drivers read assigned orders"
on public.orders for select to authenticated
using (
  exists(select 1 from public.driver_profiles dp
         where (dp.id=auth.uid() or dp.user_id=auth.uid())
           and (dp.id=orders.driver_id or dp.id=orders.assigned_driver_id))
  or public.driver_is_admin()
);

drop policy if exists "drivers read assigned order history" on public.order_status_history;
create policy "drivers read assigned order history"
on public.order_status_history for select to authenticated
using (
  exists(
    select 1 from public.driver_profiles dp
    join public.orders o on o.id=order_status_history.order_id
    where (dp.id=auth.uid() or dp.user_id=auth.uid())
      and (o.driver_id=dp.id or o.assigned_driver_id=dp.id)
  )
  or public.driver_is_admin()
);

-- -----------------------------------------------------------------------------
-- 5) One health report covering schema, identity, RPCs and the primary account.
-- -----------------------------------------------------------------------------

create or replace function public.driver_full_health(
  p_email text default 'driver@daynightae.com'
)
returns jsonb
language sql
security definer
stable
set search_path = public, auth
as $dn$
  with target as (
    select au.id,au.email
    from auth.users au
    where lower(au.email)=lower(p_email)
    limit 1
  ), driver as (
    select dp.*
    from public.driver_profiles dp,target t
    where dp.id=t.id or dp.user_id=t.id
    order by case when dp.id=t.id then 0 else 1 end,dp.created_at desc nulls last
    limit 1
  )
  select jsonb_build_object(
    'ok',
      exists(select 1 from target)
      and exists(select 1 from public.profiles p,target t where p.id=t.id and p.role::text='driver' and p.is_active=true)
      and exists(select 1 from driver where status::text='active')
      and to_regprocedure('public.driver_get_session_profile()') is not null
      and to_regprocedure('public.driver_report_location(double precision,double precision,double precision,double precision,double precision,double precision,text,numeric,text)') is not null,
    'auth_user_exists',exists(select 1 from target),
    'public_profile_exists',exists(select 1 from public.profiles p,target t where p.id=t.id),
    'profile_role',(select p.role::text from public.profiles p,target t where p.id=t.id limit 1),
    'profile_active',(select p.is_active from public.profiles p,target t where p.id=t.id limit 1),
    'driver_profile_exists',exists(select 1 from driver),
    'driver_id',(select id from driver),
    'driver_user_id',(select user_id from driver),
    'identity_consistent',(select id=coalesce(user_id,id) from driver),
    'driver_status',(select status::text from driver),
    'shift_status',(select shift_status::text from driver),
    'vehicle_type',(select vehicle_type from driver),
    'vehicle_plate',(select vehicle_plate from driver),
    'driver_id_references_profiles',exists(
      select 1 from pg_constraint con
      join pg_class c on c.oid=con.conrelid
      join pg_namespace n on n.oid=c.relnamespace
      join pg_class p on p.oid=con.confrelid
      where con.contype='f' and n.nspname='public'
        and c.relname='driver_profiles' and p.relname='profiles'
    ),
    'location_upsert_unique',exists(
      select 1 from pg_indexes
      where schemaname='public' and tablename='driver_locations'
        and indexdef ilike '%unique%' and indexdef ilike '%(driver_id)%'
    ),
    'session_rpc',to_regprocedure('public.driver_get_session_profile()') is not null,
    'location_rpc',to_regprocedure('public.driver_report_location(double precision,double precision,double precision,double precision,double precision,double precision,text,numeric,text)') is not null,
    'presence_rpc',to_regprocedure('public.driver_set_presence(boolean,text,text)') is not null,
    'status_rpc',to_regprocedure('public.driver_update_order_status(text,text,text)') is not null,
    'assign_rpc',to_regprocedure('public.admin_assign_driver(text,uuid,text)') is not null
  )
$dn$;

grant execute on function public.admin_provision_existing_driver(text,text,text,text,text,text) to authenticated;
grant execute on function public.driver_get_session_profile() to authenticated;
grant execute on function public.driver_report_location(double precision,double precision,double precision,double precision,double precision,double precision,text,numeric,text) to authenticated;
grant execute on function public.driver_set_presence(boolean,text,text) to authenticated;
grant execute on function public.driver_update_order_status(text,text,text) to authenticated;
grant execute on function public.driver_full_health(text) to authenticated;

-- Provision the already-created primary driver account idempotently.
do $dn$
begin
  if exists(select 1 from auth.users where lower(email)=lower('driver@daynightae.com')) then
    perform public.admin_provision_existing_driver(
      'driver@daynightae.com',
      'DAY NIGHT Driver',
      null,
      'Toyota Rush',
      'DAY-NIGHT-01',
      'Abu Dhabi'
    );
  end if;
end
$dn$;

select public.driver_full_health('driver@daynightae.com');
