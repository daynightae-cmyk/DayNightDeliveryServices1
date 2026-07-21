-- DAY NIGHT DELIVERY SERVICES
-- Merchant account linkage and operational core repair.
-- Production-safe: creates no orders, expenses, statements, COD rows, driver locations, or demo data.
-- It only repairs merchant account linkage and preserves strict merchant_id ownership.

begin;

create extension if not exists pgcrypto;

alter table public.merchants
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create table if not exists public.merchant_user_links (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text not null default 'owner',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (merchant_id, user_id)
);

create index if not exists merchant_user_links_merchant_idx
  on public.merchant_user_links(merchant_id, active);

alter table public.merchant_user_links enable row level security;

drop policy if exists merchant_user_links_select_own on public.merchant_user_links;
create policy merchant_user_links_select_own
on public.merchant_user_links
for select
to authenticated
using (user_id = auth.uid());

-- Preserve every existing authoritative merchants.user_id relationship.
insert into public.merchant_user_links (merchant_id, user_id, access_role, active)
select m.id, m.user_id, 'owner', true
from public.merchants m
where m.user_id is not null
on conflict (user_id) do update
set merchant_id = excluded.merchant_id,
    active = true,
    updated_at = now();

-- Ensure the official DAY NIGHT merchant exists. This is the company's real portal
-- identity, not a demonstration order or fabricated financial record.
insert into public.merchants (
  merchant_code,
  trade_name,
  owner_name,
  phone,
  email,
  emirate,
  city,
  address,
  pickup_address,
  settlement_cycle,
  commission_type,
  default_payment_method,
  status,
  notes
)
values (
  'DN-MERCHANT-OFFICIAL',
  'DAY NIGHT Merchant',
  'DAY NIGHT DELIVERY SERVICES',
  '+971568757331',
  'merchant@daynightae.com',
  'Abu Dhabi',
  'Mussafah',
  'UAE — Abu Dhabi — Mussafah 40',
  'UAE — Abu Dhabi — Mussafah 40',
  'weekly',
  'fixed_delivery_fee',
  'sender_pays',
  'active',
  'Official DAY NIGHT merchant portal account'
)
on conflict (merchant_code) do update
set trade_name = excluded.trade_name,
    owner_name = excluded.owner_name,
    phone = excluded.phone,
    email = excluded.email,
    emirate = excluded.emirate,
    city = excluded.city,
    address = excluded.address,
    pickup_address = excluded.pickup_address,
    settlement_cycle = excluded.settlement_cycle,
    commission_type = excluded.commission_type,
    default_payment_method = excluded.default_payment_method,
    status = 'active',
    notes = excluded.notes,
    updated_at = now();

-- Approve both the dedicated merchant login and the company owner's existing Google
-- account. They resolve to the same official merchant without weakening order RLS.
insert into public.merchant_user_links (merchant_id, user_id, access_role, active)
select m.id, u.id, 'owner', true
from public.merchants m
join auth.users u
  on lower(coalesce(u.email, '')) in (
    'merchant@daynightae.com',
    'daynightae@gmail.com'
  )
where m.merchant_code = 'DN-MERCHANT-OFFICIAL'
on conflict (user_id) do update
set merchant_id = excluded.merchant_id,
    access_role = 'owner',
    active = true,
    updated_at = now();

create or replace function public.merchant_session_id()
returns uuid
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select resolved.merchant_id
  from (
    select l.merchant_id, 1 as priority, l.updated_at
    from public.merchant_user_links l
    join public.merchants m on m.id = l.merchant_id
    where auth.uid() is not null
      and l.user_id = auth.uid()
      and l.active
      and lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')

    union all

    select m.id as merchant_id, 2 as priority, m.updated_at
    from public.merchants m
    where auth.uid() is not null
      and m.user_id = auth.uid()
      and lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
  ) resolved
  order by resolved.priority, resolved.updated_at desc nulls last, resolved.merchant_id
  limit 1;
$$;

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
  v_merchant public.merchants%rowtype;
  v_candidate_ids uuid[] := '{}'::uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select m.* into v_merchant
  from public.merchants m
  where m.id = public.merchant_session_id()
  limit 1;

  if v_merchant.id is not null then
    return jsonb_build_object(
      'ok', true,
      'merchant', to_jsonb(v_merchant),
      'linked_user_id', v_uid,
      'ownership_mode', 'existing_link'
    );
  end if;

  -- Company-approved aliases always map to the official merchant account.
  if v_email in ('merchant@daynightae.com', 'daynightae@gmail.com') then
    select * into v_merchant
    from public.merchants
    where merchant_code = 'DN-MERCHANT-OFFICIAL'
    limit 1;

    if v_merchant.id is null then
      raise exception 'merchant_record_missing';
    end if;

    insert into public.merchant_user_links (merchant_id, user_id, access_role, active)
    values (v_merchant.id, v_uid, 'owner', true)
    on conflict (user_id) do update
    set merchant_id = excluded.merchant_id,
        access_role = 'owner',
        active = true,
        updated_at = now();

    return jsonb_build_object(
      'ok', true,
      'merchant', to_jsonb(v_merchant),
      'linked_user_id', v_uid,
      'ownership_mode', 'approved_official_alias'
    );
  end if;

  if v_email = '' and v_phone = '' then
    raise exception 'merchant_identity_missing';
  end if;

  select coalesce(array_agg(m.id order by m.updated_at desc nulls last, m.created_at desc nulls last, m.id), '{}'::uuid[])
  into v_candidate_ids
  from public.merchants m
  where lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
    and (
      (v_email <> '' and lower(btrim(coalesce(m.email, ''))) = v_email)
      or (v_phone <> '' and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') = v_phone)
      or (v_phone <> '' and regexp_replace(coalesce(m.alt_phone, ''), '[^0-9]', '', 'g') = v_phone)
    );

  if coalesce(array_length(v_candidate_ids, 1), 0) = 0 then
    raise exception 'merchant_profile_not_found';
  end if;

  if array_length(v_candidate_ids, 1) > 1 then
    raise exception 'merchant_identity_ambiguous_contact_support';
  end if;

  select * into v_merchant from public.merchants where id = v_candidate_ids[1];

  insert into public.merchant_user_links (merchant_id, user_id, access_role, active)
  values (v_merchant.id, v_uid, 'owner', true)
  on conflict (user_id) do update
  set merchant_id = excluded.merchant_id,
      active = true,
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'merchant', to_jsonb(v_merchant),
    'linked_user_id', v_uid,
    'ownership_mode', 'unambiguous_exact_identity_claim'
  );
end;
$$;

revoke all on function public.merchant_session_id() from public, anon;
revoke all on function public.merchant_session_ids() from public, anon;
revoke all on function public.merchant_claim_approved_account() from public, anon;
grant execute on function public.merchant_session_id() to authenticated;
grant execute on function public.merchant_session_ids() to authenticated;
grant execute on function public.merchant_claim_approved_account() to authenticated;

-- Keep existing strict merchant_id-only ownership policies. Recreate them so they use
-- the repaired multi-account session resolver.
drop policy if exists merchants_session_self_select on public.merchants;
create policy merchants_session_self_select on public.merchants
for select to authenticated
using (id = public.merchant_session_id());

drop policy if exists orders_merchant_session_select on public.orders;
create policy orders_merchant_session_select on public.orders
for select to authenticated
using (merchant_id is not null and merchant_id = public.merchant_session_id());

notify pgrst, 'reload schema';
commit;

-- Verification output. Every row must be true after the migration runs.
select 'merchant_user_links_ready' as check_name,
       to_regclass('public.merchant_user_links') is not null as passed;

select 'official_merchant_ready' as check_name,
       exists (
         select 1 from public.merchants
         where merchant_code = 'DN-MERCHANT-OFFICIAL'
           and lower(coalesce(status, 'active')) = 'active'
       ) as passed;

select 'approved_accounts_linked' as check_name,
       not exists (
         select 1
         from auth.users u
         where lower(coalesce(u.email, '')) in ('merchant@daynightae.com','daynightae@gmail.com')
           and not exists (
             select 1 from public.merchant_user_links l
             where l.user_id = u.id and l.active
           )
       ) as passed;

select 'merchant_create_order_ready' as check_name,
       exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'merchant_create_order'
       ) as passed;

select 'admin_dispatch_order_ready' as check_name,
       exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'admin_dispatch_order'
       ) as passed;
