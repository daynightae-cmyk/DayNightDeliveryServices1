-- DAY NIGHT DELIVERY SERVICES
-- Public shipment tracking by phone number.
-- Apply this in Supabase SQL Editor after the orders table exists.

begin;

create or replace function public.track_orders_by_phone(
  p_phone text,
  p_limit integer default 10
)
returns setof public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 10);
  v_conditions text[] := array[]::text[];
  v_column text;
  v_sql text;
begin
  -- Prevent broad guessing. UAE mobile/local numbers have enough digits after normalization.
  if length(v_phone) < 7 then
    return;
  end if;

  foreach v_column in array array[
    'customer_phone',
    'sender_phone',
    'receiver_phone',
    'phone'
  ] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = v_column
    ) then
      v_conditions := array_append(
        v_conditions,
        format(
          '(regexp_replace(coalesce(o.%I::text, ''''), ''[^0-9]'', '''', ''g'') = $1 or (length($1) >= 9 and right(regexp_replace(coalesce(o.%I::text, ''''), ''[^0-9]'', '''', ''g''), 9) = right($1, 9)))',
          v_column,
          v_column
        )
      );
    end if;
  end loop;

  if array_length(v_conditions, 1) is null then
    return;
  end if;

  v_sql := format(
    'select o.* from public.orders o where (%s) order by o.created_at desc nulls last limit $2',
    array_to_string(v_conditions, ' or ')
  );

  return query execute v_sql using v_phone, v_limit;
end;
$$;

revoke all on function public.track_orders_by_phone(text, integer) from public;
grant execute on function public.track_orders_by_phone(text, integer) to anon, authenticated;

comment on function public.track_orders_by_phone(text, integer)
is 'Allows the public tracking page to find recent shipments by exact normalized sender/receiver/customer phone number. Returns at most 10 matching orders.';

commit;
