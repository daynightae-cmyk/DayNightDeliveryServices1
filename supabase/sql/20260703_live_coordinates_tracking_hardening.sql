-- DAY NIGHT DELIVERY SERVICES
-- Live shipment coordinates + tracking by invoice/phone/coupon.
-- Apply once in Supabase SQL Editor. Safe to re-run.

begin;

alter table public.orders
  add column if not exists pickup_lat numeric(10,7),
  add column if not exists pickup_lng numeric(10,7),
  add column if not exists receiver_lat numeric(10,7),
  add column if not exists receiver_lng numeric(10,7),
  add column if not exists delivery_lat numeric(10,7),
  add column if not exists delivery_lng numeric(10,7),
  add column if not exists driver_lat numeric(10,7),
  add column if not exists driver_lng numeric(10,7),
  add column if not exists driver_location_updated_at timestamptz,
  add column if not exists live_location_updated_at timestamptz,
  add column if not exists live_location_source text default 'order';

create index if not exists orders_tracking_code_lookup_idx on public.orders (lower(coalesce(tracking_code, '')));
create index if not exists orders_tracking_number_lookup_idx on public.orders (lower(coalesce(tracking_number, '')));
create index if not exists orders_invoice_number_lookup_idx on public.orders (lower(coalesce(invoice_number, '')));
create index if not exists orders_coupon_number_lookup_idx on public.orders (lower(coalesce(coupon_number, '')));
create index if not exists orders_driver_coordinates_idx on public.orders (driver_lat, driver_lng) where driver_lat is not null and driver_lng is not null;
create index if not exists orders_pickup_coordinates_idx on public.orders (pickup_lat, pickup_lng) where pickup_lat is not null and pickup_lng is not null;
create index if not exists orders_receiver_coordinates_idx on public.orders (receiver_lat, receiver_lng) where receiver_lat is not null and receiver_lng is not null;

create or replace function public.dn_digits(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.daynight_public_order_json(p_order public.orders)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select to_jsonb(p_order) || jsonb_build_object(
    'tracking_ref', coalesce(p_order.tracking_code, p_order.tracking_number, p_order.invoice_number, p_order.coupon_number, p_order.id::text),
    'status', coalesce(p_order.status::text, 'pending'),
    'status_history', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', h.status::text,
          'note', h.note,
          'created_at', h.created_at,
          'date', h.created_at
        ) order by h.created_at asc
      )
      from public.order_status_history h
      where h.order_id = p_order.id
    ), '[]'::jsonb)
  );
$$;

drop function if exists public.track_order(text);
create function public.track_order(p_tracking_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ref text := btrim(coalesce(p_tracking_code, ''));
  v_order public.orders%rowtype;
begin
  if v_ref = '' then
    return null;
  end if;

  select * into v_order
  from public.orders o
  where lower(coalesce(o.tracking_code, '')) = lower(v_ref)
     or lower(coalesce(o.tracking_number, '')) = lower(v_ref)
     or lower(coalesce(o.invoice_number, '')) = lower(v_ref)
     or lower(coalesce(o.coupon_number, '')) = lower(v_ref)
     or lower(o.id::text) = lower(v_ref)
  order by o.created_at desc nulls last
  limit 1;

  if not found then
    return null;
  end if;

  return public.daynight_public_order_json(v_order);
end;
$$;

drop function if exists public.track_orders_by_phone(text, integer);
create function public.track_orders_by_phone(p_phone text, p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := public.dn_digits(p_phone);
  v_tail text := right(public.dn_digits(p_phone), 9);
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 25);
  v_orders jsonb;
begin
  if length(v_phone) < 7 then
    return '[]'::jsonb;
  end if;

  with matched as (
    select *
    from public.orders o
    where public.dn_digits(o.sender_phone) = v_phone
       or public.dn_digits(o.receiver_phone) = v_phone
       or public.dn_digits(coalesce(o.customer_phone, '')) = v_phone
       or right(public.dn_digits(o.sender_phone), 9) = v_tail
       or right(public.dn_digits(o.receiver_phone), 9) = v_tail
       or right(public.dn_digits(coalesce(o.customer_phone, '')), 9) = v_tail
    order by o.created_at desc nulls last
    limit v_limit
  )
  select coalesce(jsonb_agg(public.daynight_public_order_json(m) order by m.created_at desc nulls last), '[]'::jsonb)
  into v_orders
  from matched m;

  return coalesce(v_orders, '[]'::jsonb);
end;
$$;

drop function if exists public.public_live_operations_map(integer);
create function public.public_live_operations_map(p_limit integer default 18)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 18), 1), 30);
begin
  return jsonb_build_object(
    'generated_at', now(),
    'mode', 'live_public_map',
    'active_orders_count', (
      select count(*)::integer
      from public.orders o
      where lower(coalesce(o.status::text, 'pending')) not like '%cancel%'
        and lower(coalesce(o.status::text, 'pending')) not like '%delivered%'
    ),
    'driver_count', (
      select count(*)::integer
      from public.orders o
      where o.driver_lat is not null and o.driver_lng is not null
    ),
    'orders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tracking_ref', coalesce(o.tracking_code, o.tracking_number, o.invoice_number, o.coupon_number, o.id::text),
          'status', coalesce(o.status::text, 'pending'),
          'sender_city', o.sender_city,
          'receiver_city', o.receiver_city,
          'pickup_lat', o.pickup_lat,
          'pickup_lng', o.pickup_lng,
          'receiver_lat', coalesce(o.receiver_lat, o.delivery_lat),
          'receiver_lng', coalesce(o.receiver_lng, o.delivery_lng),
          'driver_lat', o.driver_lat,
          'driver_lng', o.driver_lng,
          'updated_at', o.updated_at,
          'created_at', o.created_at
        ) order by o.updated_at desc nulls last, o.created_at desc nulls last
      )
      from (
        select *
        from public.orders o
        where lower(coalesce(o.status::text, 'pending')) not like '%cancel%'
        order by o.updated_at desc nulls last, o.created_at desc nulls last
        limit v_limit
      ) o
    ), '[]'::jsonb)
  );
end;
$$;

drop function if exists public.admin_update_order_coordinates(text, numeric, numeric, numeric, numeric, numeric, numeric);
create function public.admin_update_order_coordinates(
  p_order_id text,
  p_pickup_lat numeric default null,
  p_pickup_lng numeric default null,
  p_receiver_lat numeric default null,
  p_receiver_lng numeric default null,
  p_driver_lat numeric default null,
  p_driver_lng numeric default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'support')
  ) then
    raise exception 'not_authorized';
  end if;

  update public.orders o
  set pickup_lat = coalesce(p_pickup_lat, o.pickup_lat),
      pickup_lng = coalesce(p_pickup_lng, o.pickup_lng),
      receiver_lat = coalesce(p_receiver_lat, o.receiver_lat),
      receiver_lng = coalesce(p_receiver_lng, o.receiver_lng),
      delivery_lat = coalesce(p_receiver_lat, o.delivery_lat),
      delivery_lng = coalesce(p_receiver_lng, o.delivery_lng),
      driver_lat = coalesce(p_driver_lat, o.driver_lat),
      driver_lng = coalesce(p_driver_lng, o.driver_lng),
      driver_location_updated_at = case when p_driver_lat is not null and p_driver_lng is not null then now() else o.driver_location_updated_at end,
      live_location_updated_at = now(),
      live_location_source = 'admin_live_map',
      updated_at = now()
  where o.id::text = p_order_id
  returning * into v_order;

  if not found then
    return null;
  end if;

  return public.daynight_public_order_json(v_order);
end;
$$;

grant execute on function public.track_order(text) to anon, authenticated;
grant execute on function public.track_orders_by_phone(text, integer) to anon, authenticated;
grant execute on function public.public_live_operations_map(integer) to anon, authenticated;
grant execute on function public.admin_update_order_coordinates(text, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

commit;
