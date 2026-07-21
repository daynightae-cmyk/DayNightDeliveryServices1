-- DAY NIGHT DELIVERY SERVICES
-- Emergency production-core verification — READ ONLY.
-- No merchants, orders, expenses, statements, drivers, or locations are created.
-- Run in the approved Supabase SQL Editor before demonstrating the portals.

with function_checks(name) as (
  values
    ('admin_create_merchant'),
    ('admin_create_coupon_order'),
    ('admin_dispatch_order'),
    ('driver_get_session_profile'),
    ('driver_report_location'),
    ('driver_set_presence'),
    ('driver_update_order_status'),
    ('merchant_get_session_profile'),
    ('merchant_portal_orders'),
    ('merchant_portal_business_center'),
    ('merchant_create_order')
),
required_tables(name) as (
  values
    ('profiles'),
    ('merchants'),
    ('orders'),
    ('driver_profiles'),
    ('driver_locations'),
    ('order_status_history'),
    ('merchant_branches'),
    ('merchant_documents'),
    ('merchant_pickup_requests'),
    ('cod_collections'),
    ('merchant_statement_entries')
),
checks as (
  select
    'TABLE ' || name as check_name,
    to_regclass('public.' || name) is not null as passed,
    case when to_regclass('public.' || name) is not null then 'ready' else 'missing' end as detail
  from required_tables

  union all

  select
    'RPC ' || f.name,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = f.name
    ),
    case when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = f.name
    ) then 'ready' else 'missing' end
  from function_checks f

  union all

  select
    'RLS merchants',
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.merchants')), false),
    'merchants row-level security'

  union all

  select
    'RLS orders',
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.orders')), false),
    'orders row-level security'

  union all

  select
    'ADMIN account role',
    exists (
      select 1
      from auth.users u
      join public.profiles p on p.id = u.id
      where lower(u.email) = 'daynightae@gmail.com'
        and lower(p.role::text) in ('admin','support','super_admin')
        and coalesce(p.is_active, true)
    ),
    coalesce((
      select lower(p.role::text)
      from auth.users u
      join public.profiles p on p.id = u.id
      where lower(u.email) = 'daynightae@gmail.com'
      limit 1
    ), 'not linked')

  union all

  select
    'DRIVER account role and operational profile',
    exists (
      select 1
      from auth.users u
      join public.profiles p on p.id = u.id
      join public.driver_profiles d on d.user_id = u.id or d.id = u.id
      where lower(u.email) = 'driver@daynightae.com'
        and lower(p.role::text) = 'driver'
        and coalesce(p.is_active, true)
    ),
    case when exists (
      select 1
      from auth.users u
      join public.profiles p on p.id = u.id
      join public.driver_profiles d on d.user_id = u.id or d.id = u.id
      where lower(u.email) = 'driver@daynightae.com'
        and lower(p.role::text) = 'driver'
    ) then 'linked' else 'not linked' end

  union all

  select
    'MERCHANT account linked',
    exists (
      select 1
      from auth.users u
      join public.merchants m on m.user_id = u.id
      where lower(u.email) = 'merchant@daynightae.com'
        and lower(coalesce(m.status, 'active')) = 'active'
    ),
    coalesce((
      select m.merchant_code
      from auth.users u
      join public.merchants m on m.user_id = u.id
      where lower(u.email) = 'merchant@daynightae.com'
      limit 1
    ), 'not linked')

  union all

  select
    'RECENT orders linked to merchants',
    not exists (
      select 1
      from public.orders o
      where o.created_at >= now() - interval '30 days'
        and o.merchant_id is null
        and lower(coalesce(o.source_channel, '')) in ('admin_operations','merchant_portal')
    ),
    (
      select count(*)::text || ' unlinked recent operational orders'
      from public.orders o
      where o.created_at >= now() - interval '30 days'
        and o.merchant_id is null
        and lower(coalesce(o.source_channel, '')) in ('admin_operations','merchant_portal')
    )

  union all

  select
    'ASSIGNED active orders reference real drivers',
    not exists (
      select 1
      from public.orders o
      where lower(coalesce(o.status::text, '')) in ('assigned','accepted','picked_up','in_transit','out_for_delivery')
        and coalesce(to_jsonb(o)->>'driver_id', to_jsonb(o)->>'assigned_driver_id', '') <> ''
        and not exists (
          select 1
          from public.driver_profiles d
          where d.id::text = coalesce(to_jsonb(o)->>'driver_id', to_jsonb(o)->>'assigned_driver_id')
        )
    ),
    'active assignments must resolve to driver_profiles'
)
select
  check_name,
  passed,
  detail
from checks
order by passed asc, check_name;

-- Operational counts only; these rows are not test data.
select
  (select count(*) from public.merchants) as merchants_count,
  (select count(*) from public.orders) as orders_count,
  (select count(*) from public.driver_profiles) as drivers_count,
  (select count(*) from public.orders where lower(coalesce(status::text,'')) in ('pending','confirmed','assigned','accepted','picked_up','in_transit','out_for_delivery')) as active_orders_count;
