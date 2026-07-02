-- DAY NIGHT DELIVERY SERVICES
-- Customer Dashboard secure order verification RPC
-- Apply this file in Supabase SQL Editor after the existing orders table is deployed.

begin;

create or replace function public.public_customer_orders(p_limit integer default 25)
returns setof public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid text := coalesce(auth.uid()::text, '');
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_phone text := regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '\D', '', 'g');
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_conditions text[] := array[]::text[];
  v_column text;
  v_sql text;
begin
  -- Authenticated customers only. Anonymous users get an empty result.
  if v_uid = '' then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'customer_id'
  ) then
    v_conditions := array_append(v_conditions, 'o.customer_id::text = $1');
  end if;

  if v_email <> '' then
    foreach v_column in array array[
      'customer_email',
      'sender_email',
      'receiver_email',
      'email'
    ] loop
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'orders'
          and column_name = v_column
      ) then
        v_conditions := array_append(v_conditions, format('lower(o.%I::text) = $2', v_column));
      end if;
    end loop;
  end if;

  if v_phone <> '' then
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
        v_conditions := array_append(v_conditions, format('regexp_replace(coalesce(o.%I::text, ''''), ''\D'', '''', ''g'') = $3', v_column));
      end if;
    end loop;
  end if;

  if array_length(v_conditions, 1) is null then
    return;
  end if;

  v_sql := format(
    'select o.* from public.orders o where (%s) order by o.created_at desc nulls last limit $4',
    array_to_string(v_conditions, ' or ')
  );

  return query execute v_sql using v_uid, v_email, v_phone, v_limit;
end;
$$;

revoke all on function public.public_customer_orders(integer) from public;
revoke all on function public.public_customer_orders(integer) from anon;
grant execute on function public.public_customer_orders(integer) to authenticated;

comment on function public.public_customer_orders(integer)
is 'Returns only the signed-in customer orders using customer_id first, then safe email/phone fallbacks when older orders were created before customer_id linking.';

commit;
