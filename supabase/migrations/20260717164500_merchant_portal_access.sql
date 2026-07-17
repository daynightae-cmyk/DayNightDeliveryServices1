-- Merchant portal access layer for DAY NIGHT production.
-- This migration keeps the public UI real-data-only by exposing authenticated
-- merchants and their own orders through security-definer RPCs.

begin;

alter table public.merchants
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_merchants_user_id on public.merchants(user_id);
create index if not exists idx_merchants_email_lower on public.merchants((lower(coalesce(email, ''))));
create index if not exists idx_merchants_phone_digits on public.merchants((regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')));
create index if not exists idx_merchants_alt_phone_digits on public.merchants((regexp_replace(coalesce(alt_phone, ''), '[^0-9]', '', 'g')));
create index if not exists idx_orders_merchant_id_text on public.orders((merchant_id::text));
create index if not exists idx_orders_merchant_code on public.orders(merchant_code);
create index if not exists idx_orders_merchant_name_lower on public.orders((lower(coalesce(merchant_name, ''))));

create or replace function public.merchant_get_session_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_phone text := regexp_replace(
    coalesce(
      auth.jwt() ->> 'phone',
      auth.jwt() #>> '{user_metadata,phone}',
      auth.jwt() #>> '{user_metadata,phone_number}',
      auth.jwt() #>> '{user_metadata,mobile}',
      ''
    ),
    '[^0-9]',
    '',
    'g'
  );
  v_merchants jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.updated_at desc nulls last, m.created_at desc nulls last), '[]'::jsonb)
    into v_merchants
  from public.merchants m
  where lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
    and (
      m.user_id = v_uid
      or (v_email <> '' and lower(coalesce(m.email, '')) = v_email)
      or (v_phone <> '' and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') = v_phone)
      or (v_phone <> '' and regexp_replace(coalesce(m.alt_phone, ''), '[^0-9]', '', 'g') = v_phone)
    );

  return jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'merchant_count', jsonb_array_length(v_merchants),
    'merchants', v_merchants
  );
end;
$$;

create or replace function public.merchant_portal_orders(p_limit integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_phone text := regexp_replace(
    coalesce(
      auth.jwt() ->> 'phone',
      auth.jwt() #>> '{user_metadata,phone}',
      auth.jwt() #>> '{user_metadata,phone_number}',
      auth.jwt() #>> '{user_metadata,mobile}',
      ''
    ),
    '[^0-9]',
    '',
    'g'
  );
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 250);
  v_orders jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  with my_merchants as (
    select
      m.id::text as merchant_id_text,
      nullif(trim(m.merchant_code), '') as merchant_code,
      lower(nullif(trim(m.trade_name), '')) as trade_name_lower
    from public.merchants m
    where lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
      and (
        m.user_id = v_uid
        or (v_email <> '' and lower(coalesce(m.email, '')) = v_email)
        or (v_phone <> '' and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') = v_phone)
        or (v_phone <> '' and regexp_replace(coalesce(m.alt_phone, ''), '[^0-9]', '', 'g') = v_phone)
      )
  ), scoped_orders as (
    select o.*
    from public.orders o
    where exists (
      select 1
      from my_merchants m
      where coalesce(o.merchant_id::text, '') = m.merchant_id_text
        or (m.merchant_code is not null and coalesce(o.merchant_code, '') = m.merchant_code)
        or (m.trade_name_lower is not null and lower(coalesce(o.merchant_name, '')) = m.trade_name_lower)
    )
    order by o.created_at desc nulls last, o.updated_at desc nulls last
    limit v_limit
  )
  select coalesce(jsonb_agg(to_jsonb(scoped_orders) order by scoped_orders.created_at desc nulls last, scoped_orders.updated_at desc nulls last), '[]'::jsonb)
    into v_orders
  from scoped_orders;

  return jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'limit', v_limit,
    'orders_count', jsonb_array_length(v_orders),
    'orders', v_orders
  );
end;
$$;

revoke all on function public.merchant_get_session_profile() from public, anon;
revoke all on function public.merchant_portal_orders(integer) from public, anon;
grant execute on function public.merchant_get_session_profile() to authenticated;
grant execute on function public.merchant_portal_orders(integer) to authenticated;

commit;
