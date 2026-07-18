-- DAY NIGHT DELIVERY SERVICES
-- SECURITY HOTFIX: strict merchant-to-order isolation.
--
-- Problem fixed:
-- A merchant session could resolve more than one merchant row through shared/reused
-- email or phone values. The portal then also accepted merchant_code/trade_name as
-- order ownership fallbacks, so orders belonging to other merchants could appear.
--
-- Security rule after this migration:
--   one auth user -> one merchant row -> orders where orders.merchant_id = merchant.id
-- Names, phones, emails, merchant codes, and store titles are NEVER order-ownership
-- evidence. They are used only once, during an unambiguous account claim.

begin;

alter table public.merchants
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.orders add column if not exists merchant_id uuid;

create index if not exists idx_orders_merchant_id on public.orders(merchant_id);
create index if not exists idx_merchants_user_id on public.merchants(user_id);

-- Repair historical duplicate auth links safely. Keep the same canonical ordering
-- previously used by the portal (most recently updated first), but unlink every other
-- merchant from that auth account. No merchant or order row is deleted.
with ranked_links as (
  select
    id,
    user_id,
    row_number() over (
      partition by user_id
      order by updated_at desc nulls last, created_at desc nulls last, id
    ) as rn
  from public.merchants
  where user_id is not null
)
update public.merchants m
set user_id = null,
    updated_at = now()
from ranked_links r
where m.id = r.id
  and r.rn > 1;

create unique index if not exists ux_merchants_single_auth_user
  on public.merchants(user_id)
  where user_id is not null;

-- The only authoritative merchant identity for a session.
create or replace function public.merchant_session_id()
returns uuid
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select m.id
  from public.merchants m
  where auth.uid() is not null
    and m.user_id = auth.uid()
    and lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
  order by m.updated_at desc nulls last, m.created_at desc nulls last, m.id
  limit 1;
$$;

-- Compatibility wrapper retained for older frontend/database callers. It can now
-- contain zero or one ID only.
create or replace function public.merchant_session_ids()
returns uuid[]
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select case
    when public.merchant_session_id() is null then '{}'::uuid[]
    else array[public.merchant_session_id()]
  end;
$$;

revoke all on function public.merchant_session_id() from public, anon;
revoke all on function public.merchant_session_ids() from public, anon;
grant execute on function public.merchant_session_id() to authenticated;
grant execute on function public.merchant_session_ids() to authenticated;

-- Strict RLS: merchant ownership is merchant_id only. Remove all name/code fallbacks.
drop policy if exists merchants_session_self_select on public.merchants;
create policy merchants_session_self_select on public.merchants
for select to authenticated
using (id = public.merchant_session_id());

drop policy if exists orders_merchant_session_select on public.orders;
create policy orders_merchant_session_select on public.orders
for select to authenticated
using (
  merchant_id is not null
  and merchant_id = public.merchant_session_id()
);

-- Claim exactly one approved merchant account. Exact email/phone matching is allowed
-- only when no user_id link exists, and only when the result is unambiguous.
create or replace function public.merchant_claim_approved_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_phone text := regexp_replace(
    coalesce(
      auth.jwt() ->> 'phone',
      auth.jwt() #>> '{user_metadata,phone}',
      auth.jwt() #>> '{user_metadata,phone_number}',
      auth.jwt() #>> '{user_metadata,mobile}',
      ''
    ),
    '[^0-9]', '', 'g'
  );
  v_candidate_ids uuid[] := '{}'::uuid[];
  v_merchant public.merchants%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Existing authoritative link always wins.
  select *
  into v_merchant
  from public.merchants m
  where m.user_id = v_uid
    and lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
  order by m.updated_at desc nulls last, m.created_at desc nulls last, m.id
  limit 1;

  if v_merchant.id is not null then
    return jsonb_build_object(
      'ok', true,
      'merchant', to_jsonb(v_merchant),
      'linked_user_id', v_uid,
      'ownership_mode', 'user_id'
    );
  end if;

  if v_email = '' and v_phone = '' then
    raise exception 'merchant_identity_missing';
  end if;

  select coalesce(array_agg(m.id order by m.updated_at desc nulls last, m.created_at desc nulls last, m.id), '{}'::uuid[])
  into v_candidate_ids
  from public.merchants m
  where m.user_id is null
    and lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
    and (
      (v_email <> '' and lower(btrim(coalesce(m.email, ''))) = v_email)
      or (
        v_phone <> ''
        and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') = v_phone
      )
      or (
        v_phone <> ''
        and regexp_replace(coalesce(m.alt_phone, ''), '[^0-9]', '', 'g') = v_phone
      )
    );

  if coalesce(array_length(v_candidate_ids, 1), 0) = 0 then
    raise exception 'merchant_profile_not_found';
  end if;

  if array_length(v_candidate_ids, 1) > 1 then
    raise exception 'merchant_identity_ambiguous_contact_support';
  end if;

  update public.merchants m
  set user_id = v_uid,
      status = case
        when lower(coalesce(m.status, 'active')) in ('deleted', 'archived', 'blocked', 'suspended') then m.status
        else 'active'
      end,
      updated_at = now()
  where m.id = v_candidate_ids[1]
    and m.user_id is null
  returning * into v_merchant;

  if v_merchant.id is null then
    raise exception 'merchant_claim_conflict_retry';
  end if;

  return jsonb_build_object(
    'ok', true,
    'merchant', to_jsonb(v_merchant),
    'linked_user_id', v_uid,
    'ownership_mode', 'unambiguous_exact_identity_claim'
  );
end;
$$;

-- Return exactly one merchant profile. The legacy `merchants` array remains for
-- frontend compatibility but can never contain more than one row.
create or replace function public.merchant_get_session_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant_id uuid := public.merchant_session_id();
  v_merchant public.merchants%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if v_merchant_id is not null then
    select * into v_merchant
    from public.merchants
    where id = v_merchant_id
    limit 1;
  end if;

  if v_merchant.id is null then
    return jsonb_build_object(
      'ok', true,
      'generated_at', now(),
      'merchant_count', 0,
      'merchant', null,
      'merchants', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'merchant_count', 1,
    'merchant_id', v_merchant.id,
    'merchant', to_jsonb(v_merchant),
    'merchants', jsonb_build_array(to_jsonb(v_merchant))
  );
end;
$$;

-- Orders are selected ONLY by the authoritative UUID foreign key.
create or replace function public.merchant_portal_orders(p_limit integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant_id uuid := public.merchant_session_id();
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 250);
  v_orders jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if v_merchant_id is null then
    raise exception 'merchant_profile_not_found';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(o) order by o.created_at desc nulls last, o.updated_at desc nulls last),
    '[]'::jsonb
  )
  into v_orders
  from (
    select *
    from public.orders
    where merchant_id = v_merchant_id
    order by created_at desc nulls last, updated_at desc nulls last
    limit v_limit
  ) o;

  return jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'merchant_id', v_merchant_id,
    'ownership_rule', 'orders.merchant_id = current merchant id',
    'limit', v_limit,
    'orders_count', jsonb_array_length(v_orders),
    'orders', v_orders
  );
end;
$$;

-- Own-profile updates are restricted to the single current merchant UUID.
create or replace function public.merchant_update_own_profile(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant_id uuid := public.merchant_session_id();
  v_merchant public.merchants%rowtype;
  v_logo text := nullif(btrim(p_updates ->> 'logo_url'), '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if v_merchant_id is null then
    raise exception 'merchant_profile_not_found';
  end if;

  if v_logo is not null and v_logo !~* '^https://' then
    raise exception 'invalid_logo_url';
  end if;

  update public.merchants m
  set
    trade_name = case when p_updates ? 'trade_name' then coalesce(nullif(btrim(p_updates ->> 'trade_name'), ''), m.trade_name) else m.trade_name end,
    owner_name = case when p_updates ? 'owner_name' then nullif(btrim(p_updates ->> 'owner_name'), '') else m.owner_name end,
    phone = case when p_updates ? 'phone' then coalesce(nullif(btrim(p_updates ->> 'phone'), ''), m.phone) else m.phone end,
    alt_phone = case when p_updates ? 'alt_phone' then nullif(btrim(p_updates ->> 'alt_phone'), '') else m.alt_phone end,
    emirate = case when p_updates ? 'emirate' then coalesce(nullif(btrim(p_updates ->> 'emirate'), ''), m.emirate) else m.emirate end,
    city = case when p_updates ? 'city' then coalesce(nullif(btrim(p_updates ->> 'city'), ''), m.city) else m.city end,
    address = case when p_updates ? 'address' then nullif(btrim(p_updates ->> 'address'), '') else m.address end,
    pickup_address = case when p_updates ? 'pickup_address' then nullif(btrim(p_updates ->> 'pickup_address'), '') else m.pickup_address end,
    logo_url = case when p_updates ? 'logo_url' then v_logo else m.logo_url end,
    license_number = case when p_updates ? 'license_number' then nullif(btrim(p_updates ->> 'license_number'), '') else m.license_number end,
    trn = case when p_updates ? 'trn' then nullif(btrim(p_updates ->> 'trn'), '') else m.trn end,
    notes = case when p_updates ? 'notes' then nullif(btrim(p_updates ->> 'notes'), '') else m.notes end,
    updated_at = now()
  where m.id = v_merchant_id
  returning * into v_merchant;

  if v_merchant.id is null then
    raise exception 'merchant_profile_update_failed';
  end if;

  return jsonb_build_object(
    'ok', true,
    'merchant_id', v_merchant.id,
    'merchant', to_jsonb(v_merchant)
  );
end;
$$;

revoke all on function public.merchant_claim_approved_account() from public, anon;
revoke all on function public.merchant_get_session_profile() from public, anon;
revoke all on function public.merchant_portal_orders(integer) from public, anon;
revoke all on function public.merchant_update_own_profile(jsonb) from public, anon;

grant execute on function public.merchant_claim_approved_account() to authenticated;
grant execute on function public.merchant_get_session_profile() to authenticated;
grant execute on function public.merchant_portal_orders(integer) to authenticated;
grant execute on function public.merchant_update_own_profile(jsonb) to authenticated;

create or replace function public.merchant_portal_isolation_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  with current_identity as (
    select public.merchant_session_id() as merchant_id
  )
  select jsonb_build_object(
    'ok',
      auth.uid() is not null
      and (select merchant_id from current_identity) is not null
      and coalesce(array_length(public.merchant_session_ids(), 1), 0) <= 1,
    'authenticated_user_id', auth.uid(),
    'current_merchant_id', (select merchant_id from current_identity),
    'session_merchant_count', coalesce(array_length(public.merchant_session_ids(), 1), 0),
    'linked_merchants_for_user', (
      select count(*)
      from public.merchants m
      where m.user_id = auth.uid()
    ),
    'exact_merchant_order_count', (
      select count(*)
      from public.orders o
      where o.merchant_id = (select merchant_id from current_identity)
    ),
    'potential_legacy_name_or_code_collisions_excluded', (
      select count(*)
      from public.orders o
      join public.merchants m on m.id = (select merchant_id from current_identity)
      where o.merchant_id is distinct from m.id
        and (
          (nullif(btrim(m.merchant_code), '') is not null and o.merchant_code = m.merchant_code)
          or (nullif(btrim(m.trade_name), '') is not null and lower(coalesce(o.merchant_name, '')) = lower(m.trade_name))
        )
    ),
    'ownership_rule', 'merchant_id_only',
    'checked_at', now()
  );
$$;

revoke all on function public.merchant_portal_isolation_health() from public, anon;
grant execute on function public.merchant_portal_isolation_health() to authenticated;

notify pgrst, 'reload schema';

commit;
