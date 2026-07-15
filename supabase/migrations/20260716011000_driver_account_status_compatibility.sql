-- =========================================================
-- DAY NIGHT — DRIVER ACCOUNT STATUS COMPATIBILITY
-- Keeps the legacy driver_status enum untouched and introduces a dedicated
-- text account_status for active/inactive/suspended account management.
-- Safe for the existing production database and repeatable.
-- =========================================================

alter table public.driver_profiles
  add column if not exists account_status text;

update public.driver_profiles
set account_status = case
  when lower(coalesce(account_status, '')) in ('active','inactive','suspended') then lower(account_status)
  else 'active'
end;

alter table public.driver_profiles
  alter column account_status set default 'active';

alter table public.driver_profiles
  alter column account_status set not null;

create index if not exists driver_profiles_account_status_idx
  on public.driver_profiles(account_status, shift_status);

-- -----------------------------------------------------------------------------
-- Driver GPS report: account activation uses account_status, not legacy enum.
-- -----------------------------------------------------------------------------

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
  where user_id = auth.uid() and account_status = 'active'
  order by created_at desc nulls last
  limit 1;
  if not found then raise exception 'driver_setup_required'; end if;

  insert into public.driver_locations(
    driver_id,lat,lng,accuracy,heading,speed,altitude,is_online,battery_level,
    network_state,current_order_id,last_seen_at,created_at,updated_at
  ) values (
    v_driver.id,p_lat,p_lng,p_accuracy,p_heading,p_speed,p_altitude,true,
    p_battery_level,p_network_state,v_order_id,now(),now(),now()
  )
  on conflict (driver_id) do update set
    lat=excluded.lat,
    lng=excluded.lng,
    accuracy=excluded.accuracy,
    heading=excluded.heading,
    speed=excluded.speed,
    altitude=excluded.altitude,
    is_online=true,
    battery_level=excluded.battery_level,
    network_state=excluded.network_state,
    current_order_id=excluded.current_order_id,
    last_seen_at=now(),
    updated_at=now();

  insert into public.driver_location_history(
    driver_id,order_id,lat,lng,accuracy,heading,speed,altitude,recorded_at
  ) values (
    v_driver.id,v_order_id,p_lat,p_lng,p_accuracy,p_heading,p_speed,p_altitude,now()
  );

  update public.driver_profiles
  set shift_status = case when v_order_id is null then 'available' else 'busy' end,
      updated_at = now()
  where id = v_driver.id;

  perform public.driver_audit(
    v_driver.id,
    'location_reported',
    v_order_id,
    jsonb_build_object('accuracy',p_accuracy,'speed',p_speed,'network',p_network_state)
  );

  return jsonb_build_object('ok',true,'driver_id',v_driver.id,'recorded_at',now());
end
$dn$;

-- -----------------------------------------------------------------------------
-- Driver order transitions.
-- -----------------------------------------------------------------------------

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
  if v_status = 'failed' then v_status := 'cancelled'; end if;
  if v_status not in ('accepted','confirmed','picked_up','in_transit','delivered','cancelled','returned','postponed') then
    raise exception 'unsupported_driver_status: %', p_status;
  end if;
  if v_status in ('delivered','cancelled','returned')
     and nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'status_note_required';
  end if;

  select * into v_driver
  from public.driver_profiles
  where user_id = auth.uid() and account_status = 'active'
  order by created_at desc nulls last
  limit 1;
  if not found then raise exception 'driver_setup_required'; end if;

  select * into v_order
  from public.orders
  where (id::text=p_order_id or tracking_number=p_order_id or invoice_number=p_order_id or coupon_number=p_order_id)
    and (driver_id=v_driver.id or assigned_driver_id=v_driver.id)
  limit 1;
  if not found then raise exception 'order_not_assigned_to_driver'; end if;

  update public.orders
  set status=v_status,
      driver_id=v_driver.id,
      assigned_driver_id=v_driver.id,
      driver_name=coalesce(v_driver.full_name,driver_name),
      driver_phone=coalesce(v_driver.phone,driver_phone),
      updated_at=now()
  where id=v_order.id
  returning * into v_order;

  insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at)
  values (
    v_order.id,
    v_status,
    coalesce(nullif(btrim(coalesce(p_note,'')),''),'Driver status update'),
    v_driver.id,
    auth.uid(),
    now()
  );

  if v_status in ('delivered','cancelled','returned') then
    update public.driver_locations
    set current_order_id=null,updated_at=now()
    where driver_id=v_driver.id and current_order_id=v_order.id;

    update public.driver_profiles
    set shift_status='available',updated_at=now()
    where id=v_driver.id;
  else
    update public.driver_locations
    set current_order_id=v_order.id,updated_at=now()
    where driver_id=v_driver.id;

    update public.driver_profiles
    set shift_status='busy',updated_at=now()
    where id=v_driver.id;
  end if;

  perform public.driver_audit(
    v_driver.id,
    'order_status_updated',
    v_order.id,
    jsonb_build_object('status',v_status,'note',p_note)
  );

  return jsonb_build_object('ok',true,'order_id',v_order.id,'status',v_status);
end
$dn$;

-- -----------------------------------------------------------------------------
-- Admin assignment and account management.
-- -----------------------------------------------------------------------------

create or replace function public.admin_assign_driver(
  p_order_id text,
  p_driver_id uuid,
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
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;

  select * into v_driver
  from public.driver_profiles
  where id=p_driver_id and account_status='active'
  limit 1;
  if not found then raise exception 'active_driver_not_found'; end if;

  select * into v_order
  from public.orders
  where id::text=p_order_id or tracking_number=p_order_id or invoice_number=p_order_id or coupon_number=p_order_id
  limit 1;
  if not found then raise exception 'order_not_found'; end if;

  update public.orders
  set driver_id=v_driver.id,
      assigned_driver_id=v_driver.id,
      driver_name=v_driver.full_name,
      driver_phone=v_driver.phone,
      status='assigned',
      updated_at=now()
  where id=v_order.id
  returning * into v_order;

  insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at)
  values (
    v_order.id,
    'assigned',
    coalesce(nullif(btrim(coalesce(p_note,'')),''),'Admin assigned driver'),
    v_driver.id,
    auth.uid(),
    now()
  );

  update public.driver_profiles
  set shift_status=case when shift_status='offline' then 'offline' else 'busy' end,
      updated_at=now()
  where id=v_driver.id;

  perform public.driver_try_notification(
    v_driver.user_id,
    'New assigned order',
    coalesce(v_order.tracking_number,v_order.id::text),
    'driver_assignment'
  );
  perform public.driver_audit(v_driver.id,'order_assigned',v_order.id,jsonb_build_object('note',p_note));

  return jsonb_build_object('ok',true,'order_id',v_order.id,'driver_id',v_driver.id);
end
$dn$;

create or replace function public.admin_update_driver_profile(
  p_driver_id uuid,
  p_full_name text,
  p_phone text default null,
  p_status text default 'active',
  p_shift_status text default null,
  p_vehicle_type text default null,
  p_vehicle_plate text default null,
  p_vehicle_color text default null,
  p_emirate text default null,
  p_license_number text default null,
  p_emergency_contact text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if nullif(btrim(coalesce(p_full_name,'')),'') is null then raise exception 'driver_name_required'; end if;
  if p_status not in ('active','inactive','suspended') then raise exception 'invalid_driver_status'; end if;

  update public.driver_profiles
  set full_name=btrim(p_full_name),
      phone=nullif(btrim(coalesce(p_phone,'')),''),
      account_status=p_status,
      shift_status=case
        when p_status<>'active' then 'offline'
        when p_shift_status in ('offline','available','busy','paused') then p_shift_status
        else shift_status
      end,
      vehicle_type=nullif(btrim(coalesce(p_vehicle_type,'')),''),
      vehicle_plate=nullif(btrim(coalesce(p_vehicle_plate,'')),''),
      vehicle_color=nullif(btrim(coalesce(p_vehicle_color,'')),''),
      emirate=nullif(btrim(coalesce(p_emirate,'')),''),
      license_number=nullif(btrim(coalesce(p_license_number,'')),''),
      emergency_contact=nullif(btrim(coalesce(p_emergency_contact,'')),''),
      last_status_note=nullif(btrim(coalesce(p_note,'')),''),
      updated_at=now()
  where id=p_driver_id
  returning * into v_driver;
  if not found then raise exception 'driver_not_found'; end if;

  update public.profiles
  set full_name=v_driver.full_name,
      phone=v_driver.phone,
      is_active=(v_driver.account_status='active'),
      updated_at=now()
  where id=v_driver.user_id;

  if v_driver.account_status<>'active' then
    update public.driver_locations
    set is_online=false,updated_at=now()
    where driver_id=v_driver.id;
  end if;

  perform public.driver_audit(
    v_driver.id,
    'profile_updated',
    null,
    jsonb_build_object('account_status',v_driver.account_status,'shift_status',v_driver.shift_status)
  );
  return to_jsonb(v_driver);
end
$dn$;

create or replace function public.admin_set_driver_status(
  p_driver_id uuid,
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
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if p_status not in ('active','inactive','suspended') then raise exception 'invalid_driver_status'; end if;

  update public.driver_profiles
  set account_status=p_status,
      shift_status=case when p_status='active' then shift_status else 'offline' end,
      last_status_note=nullif(btrim(coalesce(p_note,'')),''),
      updated_at=now()
  where id=p_driver_id
  returning * into v_driver;
  if not found then raise exception 'driver_not_found'; end if;

  update public.profiles
  set is_active=(p_status='active'),updated_at=now()
  where id=v_driver.user_id;

  if p_status<>'active' then
    update public.driver_locations
    set is_online=false,updated_at=now()
    where driver_id=p_driver_id;
  end if;

  perform public.driver_audit(
    p_driver_id,
    'account_status_changed',
    null,
    jsonb_build_object('account_status',p_status,'note',p_note)
  );
  return jsonb_build_object('ok',true,'driver_id',p_driver_id,'status',p_status);
end
$dn$;

-- Provision an Auth user without writing to auth.users/auth.identities and without
-- assigning an unsupported value to the legacy driver_status enum.
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
begin
  if auth.uid() is not null and not public.driver_is_admin() then raise exception 'not_authorized'; end if;

  select id into v_user_id
  from auth.users
  where lower(email)=lower(btrim(p_email))
  limit 1;
  if not found then raise exception 'auth_user_not_found: create % in Authentication first', p_email; end if;

  insert into public.profiles(id,role,full_name,phone,is_active,created_at,updated_at)
  values (
    v_user_id,
    'driver',
    btrim(p_full_name),
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
  where user_id=v_user_id
  order by created_at desc nulls last
  limit 1;

  if found then
    update public.driver_profiles
    set full_name=btrim(p_full_name),
        email=lower(btrim(p_email)),
        phone=nullif(btrim(coalesce(p_phone,'')),''),
        account_status='active',
        vehicle_type=coalesce(nullif(btrim(coalesce(p_vehicle_type,'')),''),'Toyota Rush'),
        vehicle_plate=nullif(btrim(coalesce(p_vehicle_plate,'')),''),
        vehicle_color=coalesce(vehicle_color,'White'),
        emirate=nullif(btrim(coalesce(p_emirate,'')),''),
        updated_at=now()
    where id=v_driver.id
    returning * into v_driver;
  else
    insert into public.driver_profiles(
      user_id,full_name,email,phone,account_status,shift_status,
      vehicle_type,vehicle_plate,vehicle_color,emirate,joined_at,created_at,updated_at
    ) values (
      v_user_id,
      btrim(p_full_name),
      lower(btrim(p_email)),
      nullif(btrim(coalesce(p_phone,'')),''),
      'active',
      'offline',
      coalesce(nullif(btrim(coalesce(p_vehicle_type,'')),''),'Toyota Rush'),
      nullif(btrim(coalesce(p_vehicle_plate,'')),''),
      'White',
      nullif(btrim(coalesce(p_emirate,'')),''),
      now(),now(),now()
    )
    returning * into v_driver;
  end if;

  perform public.driver_audit(v_driver.id,'driver_provisioned',null,jsonb_build_object('email',p_email));
  return jsonb_build_object(
    'ok',true,
    'auth_user_id',v_user_id,
    'driver_profile_id',v_driver.id,
    'email',p_email,
    'account_status',v_driver.account_status
  );
end
$dn$;

grant execute on function public.driver_report_location(double precision,double precision,double precision,double precision,double precision,double precision,text,numeric,text) to authenticated;
grant execute on function public.driver_update_order_status(text,text,text) to authenticated;
grant execute on function public.admin_assign_driver(text,uuid,text) to authenticated;
grant execute on function public.admin_update_driver_profile(uuid,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_set_driver_status(uuid,text,text) to authenticated;
grant execute on function public.admin_provision_existing_driver(text,text,text,text,text,text) to authenticated;

create or replace function public.driver_module_health()
returns jsonb
language sql
security definer
stable
set search_path = public
as $dn$
  select jsonb_build_object(
    'driver_profiles', (select count(*) from public.driver_profiles),
    'active_accounts', (select count(*) from public.driver_profiles where account_status='active'),
    'online_locations', (select count(*) from public.driver_locations where is_online=true and last_seen_at>now()-interval '10 minutes'),
    'history_points', (select count(*) from public.driver_location_history),
    'assigned_orders', (select count(*) from public.orders where assigned_driver_id is not null or driver_id is not null),
    'session_rpc', to_regprocedure('public.driver_get_session_profile()') is not null,
    'location_rpc', to_regprocedure('public.driver_report_location(double precision,double precision,double precision,double precision,double precision,double precision,text,numeric,text)') is not null,
    'status_rpc', to_regprocedure('public.driver_update_order_status(text,text,text)') is not null,
    'assign_rpc', to_regprocedure('public.admin_assign_driver(text,uuid,text)') is not null,
    'account_status_compatibility', true
  )
$dn$;

grant execute on function public.driver_module_health() to authenticated;
