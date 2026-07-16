-- DAY NIGHT — Production dispatch smoke verification
-- Read-only: does not create, assign or modify any order.

select public.admin_dispatch_runtime_health() as runtime_health;

select
  count(*) filter (
    where coalesce(assigned_driver_id, driver_id) is null
      and lower(replace(coalesce(status::text, ''), ' ', '_')) not in ('delivered','cancelled','returned')
  ) as unassigned_open_orders,
  count(*) filter (
    where coalesce(assigned_driver_id, driver_id) is not null
      and lower(replace(coalesce(status::text, ''), ' ', '_')) not in ('delivered','cancelled','returned')
  ) as assigned_open_orders,
  count(*) filter (
    where lower(replace(coalesce(status::text, ''), ' ', '_')) in ('accepted','picked_up','in_transit')
  ) as in_progress_orders
from public.orders;

select
  count(*) as active_drivers,
  count(*) filter (where shift_status::text = 'available') as available_drivers,
  count(*) filter (where shift_status::text = 'busy') as busy_drivers
from public.driver_profiles
where status::text = 'active';

select
  action,
  count(*) as operations
from public.driver_assignment_history
group by action
order by action;
