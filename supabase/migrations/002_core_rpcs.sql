-- DAY NIGHT DELIVERY SERVICES
-- Migration 002: Core RPC functions for production
-- Run this in Supabase SQL Editor or via Supabase CLI

-- 1. calculate_delivery_price RPC
-- Calculates delivery price based on cities and weight
-- Returns clean prices: 30 AED (main), 50 AED (extended), 95+45 (GCC), 190+90 (Worldwide)
create or replace function public.calculate_delivery_price(
  p_from_city text default null,
  p_to_city text default null,
  p_weight_kg numeric default 1
)
returns json
language plpgsql
security definer
as $$
declare
  v_from_zone_type text;
  v_to_zone_type text;
  v_base_price numeric := 0;
  v_additional_price numeric := 0;
  v_total_price numeric := 0;
  v_service_type text := 'domestic';
begin
  -- Get zone types for cities
  select z.zone_type into v_from_zone_type
  from public.cities c
  join public.zones z on c.zone_id = z.id
  where c.name_en = p_from_city or c.name_ar = p_from_city;

  select z.zone_type into v_to_zone_type
  from public.cities c
  join public.zones z on c.zone_id = z.id
  where c.name_en = p_to_city or c.name_ar = p_to_city;

  -- Default to main if not found
  if v_from_zone_type is null then v_from_zone_type := 'main'; end if;
  if v_to_zone_type is null then v_to_zone_type := 'main'; end if;

  -- Determine pricing based on destination zone
  if v_to_zone_type = 'main' then
    v_base_price := 30;
    v_additional_price := 0;
    v_service_type := 'domestic_main';
  elsif v_to_zone_type = 'extended' then
    v_base_price := 50;
    v_additional_price := 0;
    v_service_type := 'domestic_extended';
  elsif v_to_zone_type = 'gcc' then
    v_base_price := 95;
    v_additional_price := 45;
    v_service_type := 'gcc';
  elsif v_to_zone_type = 'worldwide' then
    v_base_price := 190;
    v_additional_price := 90;
    v_service_type := 'worldwide';
  else
    v_base_price := 30;
    v_additional_price := 0;
    v_service_type := 'domestic_main';
  end if;

  -- Calculate total price
  if p_weight_kg > 1 then
    v_total_price := v_base_price + (ceil(p_weight_kg) - 1) * v_additional_price;
  else
    v_total_price := v_base_price;
  end if;

  return json_build_object(
    'base_price', v_base_price,
    'additional_kg_price', v_additional_price,
    'weight_kg', p_weight_kg,
    'total_price', v_total_price,
    'service_type', v_service_type,
    'currency', 'AED',
    'vat_included', true
  );
end;
$$;

-- 2. create_public_order RPC
-- Creates a new order with server-side price calculation
-- Returns tracking_code and calculated_price
create or replace function public.create_public_order(
  p_order_data jsonb
)
returns json
language plpgsql
security definer
as $$
declare
  v_order_id uuid;
  v_tracking_code text;
  v_calculated_price numeric;
  v_pickup_city_id bigint;
  v_delivery_city_id bigint;
  v_weight_kg numeric;
  v_service_type text;
  v_sender_name text;
  v_sender_phone text;
  v_receiver_name text;
  v_receiver_phone text;
  v_pickup_address text;
  v_delivery_address text;
  v_package_type text;
  v_payment_method text;
  v_cod_amount numeric;
  v_year int;
  v_seq int;
begin
  -- Extract data from JSON
  v_sender_name := p_order_data->>'sender_name';
  v_sender_phone := p_order_data->>'sender_phone';
  v_pickup_address := p_order_data->>'pickup_address';
  v_receiver_name := p_order_data->>'receiver_name';
  v_receiver_phone := p_order_data->>'receiver_phone';
  v_delivery_address := p_order_data->>'delivery_address';
  v_package_type := p_order_data->>'package_type';
  v_weight_kg := (p_order_data->>'weight_kg')::numeric;
  v_service_type := p_order_data->>'service_type';
  v_payment_method := p_order_data->>'payment_method';
  v_cod_amount := (p_order_data->>'cod_amount')::numeric;

  -- Get city IDs
  select id into v_pickup_city_id from public.cities 
    where name_en = p_order_data->>'pickup_city' or name_ar = p_order_data->>'pickup_city';
  
  select id into v_delivery_city_id from public.cities 
    where name_en = p_order_data->>'delivery_city' or name_ar = p_order_data->>'delivery_city';

  -- Validate required fields
  if v_sender_name is null or v_sender_phone is null then
    raise exception 'Sender name and phone are required';
  end if;
  if v_receiver_name is null or v_receiver_phone is null then
    raise exception 'Receiver name and phone are required';
  end if;
  if v_weight_kg is null or v_weight_kg <= 0 then
    raise exception 'Valid weight is required';
  end if;

  -- Calculate price server-side
  select (public.calculate_delivery_price(
    p_order_data->>'pickup_city',
    p_order_data->>'delivery_city',
    v_weight_kg
  )->>'total_price')::numeric into v_calculated_price;

  -- Generate tracking code: DN-YYYY-XXXXX
  select extract(year from now())::int into v_year;
  select coalesce(max(
    substring(tracking_code from 'DN-\\d+-(\\d+)')::int
  ), 0) + 1 into v_seq from public.orders
  where tracking_code like 'DN-' || v_year || '-%';

  v_tracking_code := format('DN-%s-%05s', v_year, v_seq);

  -- Insert order
  insert into public.orders (
    tracking_code,
    sender_name,
    sender_phone,
    pickup_city_id,
    pickup_address,
    receiver_name,
    receiver_phone,
    delivery_city_id,
    delivery_address,
    package_type,
    weight_kg,
    service_type,
    payment_method,
    cod_amount,
    calculated_price,
    status
  ) values (
    v_tracking_code,
    v_sender_name,
    v_sender_phone,
    v_pickup_city_id,
    v_pickup_address,
    v_receiver_name,
    v_receiver_phone,
    v_delivery_city_id,
    v_delivery_address,
    v_package_type,
    v_weight_kg,
    v_service_type,
    v_payment_method,
    v_cod_amount,
    v_calculated_price,
    'pending'
  ) returning id into v_order_id;

  -- Create initial status history
  insert into public.order_status_history (order_id, status, note, created_by)
  values (v_order_id, 'pending', 'Order created via public form', null);

  return json_build_object(
    'tracking_code', v_tracking_code,
    'calculated_price', v_calculated_price,
    'order_id', v_order_id
  );
end;
$$;

-- 3. track_public_order RPC
-- Safe public tracking - returns only non-sensitive data
create or replace function public.track_public_order(
  p_tracking_code text
)
returns json
language plpgsql
security definer
as $$
declare
  v_order record;
  v_status_history json;
  v_current_location text;
  v_progress int;
begin
  -- Get order data (only safe fields)
  select 
    o.tracking_code,
    o.status,
    o.service_type,
    o.weight_kg,
    o.calculated_price,
    o.estimated_delivery_at,
    o.created_at,
    c.name_en as pickup_city,
    dc.name_en as delivery_city
  into v_order
  from public.orders o
  left join public.cities c on o.pickup_city_id = c.id
  left join public.cities dc on o.delivery_city_id = dc.id
  where o.tracking_code = p_tracking_code;

  if v_order is null then
    return null;
  end if;

  -- Get status history (safe fields only)
  select json_agg(json_build_object(
    'status', status,
    'note', note,
    'location_text', location_text,
    'created_at', created_at
  ) order by created_at desc)
  into v_status_history
  from (
    select status, note, location_text, created_at
    from public.order_status_history
    where order_id = (select id from public.orders where tracking_code = p_tracking_code)
    order by created_at desc
    limit 10
  ) h;

  -- Calculate progress percentage
  case v_order.status
    when 'pending' then v_progress := 0;
    when 'confirmed' then v_progress := 20;
    when 'picked_up' then v_progress := 40;
    when 'in_transit' then v_progress := 60;
    when 'out_for_delivery' then v_progress := 80;
    when 'delivered' then v_progress := 100;
    when 'failed', 'cancelled' then v_progress := 0;
    else v_progress := 10;
  end case;

  -- Get current location text
  select location_text into v_current_location
  from public.order_status_history
  where order_id = (select id from public.orders where tracking_code = p_tracking_code)
  order by created_at desc
  limit 1;

  return json_build_object(
    'tracking_code', v_order.tracking_code,
    'status', v_order.status,
    'progress', v_progress,
    'current_location_text', v_current_location,
    'estimated_delivery_at', v_order.estimated_delivery_at,
    'last_updated', now(),
    'service_type', v_order.service_type,
    'weight_kg', v_order.weight_kg,
    'pickup_city', v_order.pickup_city,
    'delivery_city', v_order.delivery_city,
    'status_history', v_status_history
  );
end;
$$;

-- 4. admin_update_order_status RPC
-- Admin/Support only - updates order status with audit trail
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_current_user_role text;
begin
  -- Verify user is admin or support
  select role into v_current_user_role
  from public.profiles
  where id = auth.uid();

  if v_current_user_role not in ('admin', 'support') then
    raise exception 'Only admin or support can update order status';
  end if;

  -- Validate status
  if p_status not in ('pending', 'confirmed', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled') then
    raise exception 'Invalid status';
  end if;

  -- Update order
  update public.orders
  set status = p_status, updated_at = now()
  where id = p_order_id;

  -- Add to history
  insert into public.order_status_history (order_id, status, note, created_by)
  values (p_order_id, p_status, p_note, auth.uid());

  return true;
end;
$$;

-- 5. driver_update_location RPC
-- Driver only - updates driver location
create or replace function public.driver_update_location(
  p_lat numeric,
  p_lng numeric,
  p_heading numeric default null,
  p_speed numeric default null,
  p_order_id uuid default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_driver_id uuid;
begin
  -- Get driver ID
  select id into v_driver_id
  from public.driver_profiles
  where user_id = auth.uid() and is_active = true;

  if v_driver_id is null then
    raise exception 'Active driver profile not found';
  end if;

  -- Insert/update location
  insert into public.driver_locations (driver_id, order_id, lat, lng, heading, speed, updated_at)
  values (v_driver_id, p_order_id, p_lat, p_lng, p_heading, p_speed, now())
  on conflict (driver_id) do update set
    order_id = excluded.order_id,
    lat = excluded.lat,
    lng = excluded.lng,
    heading = excluded.heading,
    speed = excluded.speed,
    updated_at = excluded.updated_at;

  return true;
end;
$$;

-- 6. assign_driver_to_order RPC
-- Admin only - assigns driver to order
create or replace function public.assign_driver_to_order(
  p_order_id uuid,
  p_driver_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_current_user_role text;
begin
  -- Verify user is admin
  select role into v_current_user_role
  from public.profiles
  where id = auth.uid();

  if v_current_user_role != 'admin' then
    raise exception 'Only admin can assign drivers';
  end if;

  -- Verify driver exists
  if not exists (select 1 from public.driver_profiles where id = p_driver_id and is_active = true) then
    raise exception 'Active driver not found';
  end if;

  -- Assign driver
  update public.orders
  set assigned_driver_id = p_driver_id, status = 'assigned', updated_at = now()
  where id = p_order_id;

  -- Add to history
  insert into public.order_status_history (order_id, status, note, created_by)
  values (p_order_id, 'assigned', 'Driver assigned', auth.uid());

  return true;
end;
$$;

-- Grant execute permissions
grant execute on function public.calculate_delivery_price(text, text, numeric) to anon, authenticated;
grant execute on function public.create_public_order(jsonb) to anon;
grant execute on function public.track_public_order(text) to anon;
grant execute on function public.admin_update_order_status(uuid, text, text) to authenticated;
grant execute on function public.driver_update_location(numeric, numeric, numeric, numeric, uuid) to authenticated;
grant execute on function public.assign_driver_to_order(uuid, uuid) to authenticated;
