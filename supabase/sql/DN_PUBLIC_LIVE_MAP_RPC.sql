-- DAY NIGHT public live map RPC
-- Apply this SQL in Supabase before enabling live public map data.
-- Safe for enum/order fields: public values are cast to text before null/like checks.

rollback;
begin;

create or replace function public.public_live_operations_map(p_limit integer default 18)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with safe_limit as (
    select least(greatest(coalesce(p_limit, 18), 1), 30)::integer as value
  ),
  live_orders as (
    select
      coalesce(
        nullif(o.tracking_code::text, ''),
        nullif(o.tracking_number::text, ''),
        concat('DN-', left(o.id::text, 8))
      ) as raw_tracking,
      coalesce(nullif(o.status::text, ''), 'Pending') as status,
      coalesce(nullif(o.sender_city::text, ''), 'Abu Dhabi') as sender_city,
      coalesce(nullif(o.receiver_city::text, ''), 'Dubai') as receiver_city,
      o.created_at,
      o.updated_at
    from public.orders o
    where lower(coalesce(o.status::text, '')) not like '%cancel%'
    order by coalesce(o.updated_at, o.created_at) desc nulls last
    limit (select value from safe_limit)
  ),
  public_orders as (
    select jsonb_agg(
      jsonb_build_object(
        'tracking_ref',
          case
            when length(raw_tracking) > 12
              then concat(left(raw_tracking, 9), '...', right(raw_tracking, 3))
            else raw_tracking
          end,
        'status', status,
        'sender_city', sender_city,
        'receiver_city', receiver_city,
        'updated_at', updated_at,
        'created_at', created_at
      )
      order by coalesce(updated_at, created_at) desc nulls last
    ) as orders_json
    from live_orders
  ),
  active_order_count as (
    select count(*)::integer as value
    from public.orders o
    where lower(coalesce(o.status::text, '')) not like '%cancel%'
      and lower(coalesce(o.status::text, '')) not like '%delivered%'
  ),
  active_driver_count as (
    select count(*)::integer as value
    from public.driver_locations
  )
  select jsonb_build_object(
    'generated_at', now(),
    'mode', 'live_rpc',
    'active_orders_count', (select value from active_order_count),
    'driver_count', (select value from active_driver_count),
    'orders', coalesce((select orders_json from public_orders), '[]'::jsonb)
  );
$$;

revoke all on function public.public_live_operations_map(integer) from public;
grant execute on function public.public_live_operations_map(integer) to anon, authenticated;

commit;

-- Smoke test:
-- select public.public_live_operations_map(10);
