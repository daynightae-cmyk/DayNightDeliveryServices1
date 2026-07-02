-- DAY NIGHT DELIVERY SERVICES
-- Secure customer order lookup for the customer dashboard.
-- Apply this in Supabase SQL Editor after deployment.

create or replace function public.public_customer_orders(
  p_limit integer default 25
)
returns setof public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  v_phone text := regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '[^0-9]', '', 'g');
  v_safe_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  if v_uid is null then
    return;
  end if;

  return query
  select o.*
  from public.orders o
  where
    coalesce(to_jsonb(o) ->> 'customer_id', '') = v_uid::text
    or (
      v_email is not null
      and v_email <> ''
      and lower(coalesce(to_jsonb(o) ->> 'customer_email', '')) = v_email
    )
    or (
      v_email is not null
      and v_email <> ''
      and lower(coalesce(to_jsonb(o) ->> 'sender_email', '')) = v_email
    )
    or (
      v_email is not null
      and v_email <> ''
      and lower(coalesce(to_jsonb(o) ->> 'receiver_email', '')) = v_email
    )
    or (
      v_phone <> ''
      and regexp_replace(coalesce(to_jsonb(o) ->> 'customer_phone', ''), '[^0-9]', '', 'g') = v_phone
    )
  order by coalesce(o.updated_at, o.created_at) desc nulls last, o.created_at desc nulls last
  limit v_safe_limit;
end;
$$;

revoke all on function public.public_customer_orders(integer) from public;
revoke all on function public.public_customer_orders(integer) from anon;
grant execute on function public.public_customer_orders(integer) to authenticated;
