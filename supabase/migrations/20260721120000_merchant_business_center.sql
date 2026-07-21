-- DAY NIGHT DELIVERY SERVICES
-- Merchant Business Center: strict merchant-scoped operational tools.
-- Every read/write resolves ownership through public.merchant_session_id().

begin;

alter table public.merchants add column if not exists bank_verification_status text not null default 'missing';
alter table public.merchants add column if not exists portal_access_status text not null default 'active';
alter table public.merchants add column if not exists business_type text;
alter table public.merchants add column if not exists license_expiry date;
alter table public.merchants add column if not exists cod_enabled boolean not null default true;

create table if not exists public.merchant_branches (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  code text,
  contact_name text,
  phone text,
  email text,
  emirate text,
  city text,
  address text,
  working_hours text,
  pickup_instructions text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_pickup_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  branch_id uuid references public.merchant_branches(id) on delete set null,
  pickup_address text not null,
  requested_date date not null,
  time_window text not null,
  shipment_count integer not null default 1 check (shipment_count > 0),
  piece_count integer check (piece_count is null or piece_count > 0),
  status text not null default 'requested',
  driver_id uuid,
  driver_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_address_book (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  alternate_phone text,
  email text,
  emirate text,
  city text,
  area text,
  address text,
  building text,
  floor text,
  landmark text,
  notes text,
  tags text[] not null default '{}',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_documents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  document_type text not null,
  document_number text,
  issue_date date,
  expiry_date date,
  status text not null default 'missing',
  file_path text,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_team_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  role text not null default 'viewer',
  status text not null default 'invited',
  branch_ids uuid[] not null default '{}',
  permissions text[] not null default '{}',
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_order_action_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  order_id uuid not null,
  action text not null check (action in ('cancel','return','reschedule')),
  reason text,
  requested_date date,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_support_tickets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  category text not null,
  priority text not null default 'normal',
  subject text not null,
  message text not null,
  order_id uuid,
  settlement_id uuid,
  preferred_contact text,
  attachment_path text,
  status text not null default 'open',
  public_response text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchant_branches_merchant_idx on public.merchant_branches(merchant_id, active);
create index if not exists merchant_pickups_merchant_idx on public.merchant_pickup_requests(merchant_id, requested_date desc);
create index if not exists merchant_address_book_merchant_idx on public.merchant_address_book(merchant_id, archived);
create index if not exists merchant_documents_merchant_idx on public.merchant_documents(merchant_id, status);
create index if not exists merchant_team_merchant_idx on public.merchant_team_members(merchant_id, status);
create index if not exists merchant_order_actions_merchant_idx on public.merchant_order_action_requests(merchant_id, created_at desc);
create index if not exists merchant_support_merchant_idx on public.merchant_support_tickets(merchant_id, created_at desc);

alter table public.merchant_branches enable row level security;
alter table public.merchant_pickup_requests enable row level security;
alter table public.merchant_address_book enable row level security;
alter table public.merchant_documents enable row level security;
alter table public.merchant_team_members enable row level security;
alter table public.merchant_support_tickets enable row level security;
alter table public.merchant_order_action_requests enable row level security;

-- Strict ownership policies. These complement, not replace, backend authorization.
do $$
declare t text;
begin
  foreach t in array array['merchant_branches','merchant_pickup_requests','merchant_address_book','merchant_documents','merchant_team_members','merchant_support_tickets','merchant_order_action_requests'] loop
    execute format('drop policy if exists %I on public.%I', t || '_merchant_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (merchant_id = public.merchant_session_id())', t || '_merchant_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_merchant_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (merchant_id = public.merchant_session_id())', t || '_merchant_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_merchant_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (merchant_id = public.merchant_session_id()) with check (merchant_id = public.merchant_session_id())', t || '_merchant_update', t);
  end loop;
end $$;

create or replace function public.merchant_portal_business_center()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant_id uuid := public.merchant_session_id();
  v_branches jsonb := '[]'::jsonb;
  v_pickups jsonb := '[]'::jsonb;
  v_address_book jsonb := '[]'::jsonb;
  v_documents jsonb := '[]'::jsonb;
  v_team jsonb := '[]'::jsonb;
  v_tickets jsonb := '[]'::jsonb;
  v_cod jsonb := '[]'::jsonb;
  v_statements jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.is_default desc, x.name), '[]'::jsonb) into v_branches
  from public.merchant_branches x where x.merchant_id = v_merchant_id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_date desc, x.created_at desc), '[]'::jsonb) into v_pickups
  from public.merchant_pickup_requests x where x.merchant_id = v_merchant_id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.recipient_name), '[]'::jsonb) into v_address_book
  from public.merchant_address_book x where x.merchant_id = v_merchant_id and not x.archived;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.expiry_date nulls last), '[]'::jsonb) into v_documents
  from public.merchant_documents x where x.merchant_id = v_merchant_id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) into v_team
  from public.merchant_team_members x where x.merchant_id = v_merchant_id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) into v_tickets
  from (select id, category, priority, subject, message, status, order_id, settlement_id, public_response as response, created_at, updated_at from public.merchant_support_tickets where merchant_id = v_merchant_id limit 120) x;

  -- Finance tables may be empty, but values are never fabricated.
  if to_regclass('public.cod_collections') is not null then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.collection_date desc, x.created_at desc), '[]'::jsonb) into v_cod
    from (select id, order_id, tracking_number, cod_amount, collected_amount, reconciled_amount, collection_date, status, payment_method, reference_number, notes, created_at, updated_at from public.cod_collections where merchant_id = v_merchant_id limit 500) x;
  end if;
  if to_regclass('public.merchant_statement_entries') is not null then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date, x.created_at), '[]'::jsonb) into v_statements
    from (select id, order_id, tracking_number, entry_date, entry_type, debit, credit, balance, status, notes, created_at, updated_at from public.merchant_statement_entries where merchant_id = v_merchant_id limit 1000) x;
  end if;

  return jsonb_build_object(
    'ok', true,
    'merchant_id', v_merchant_id,
    'generated_at', now(),
    'branches', v_branches,
    'pickup_requests', v_pickups,
    'address_book', v_address_book,
    'documents', v_documents,
    'team', v_team,
    'support_tickets', v_tickets,
    'cod_collections', v_cod,
    'statement_entries', v_statements
  );
end;
$$;

create or replace function public.merchant_create_pickup_request(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_merchant_id uuid := public.merchant_session_id(); v_row public.merchant_pickup_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;
  if nullif(btrim(p_request->>'pickupAddress'),'') is null then raise exception 'pickup_address_required'; end if;
  if nullif(p_request->>'branchId','') is not null and not exists (
    select 1 from public.merchant_branches b
    where b.id = (p_request->>'branchId')::uuid and b.merchant_id = v_merchant_id and b.active
  ) then raise exception 'merchant_branch_not_found'; end if;
  insert into public.merchant_pickup_requests(merchant_id, branch_id, pickup_address, requested_date, time_window, shipment_count, piece_count, notes)
  values(v_merchant_id, nullif(p_request->>'branchId','')::uuid, btrim(p_request->>'pickupAddress'), (p_request->>'requestedDate')::date, coalesce(nullif(btrim(p_request->>'timeWindow'),''),'09:00-12:00'), greatest(coalesce((p_request->>'shipmentCount')::int,1),1), nullif(p_request->>'pieceCount','')::int, nullif(btrim(p_request->>'notes'),'')) returning * into v_row;
  return jsonb_build_object('ok', true, 'request', to_jsonb(v_row));
end;
$$;

create or replace function public.merchant_create_support_ticket(p_ticket jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_merchant_id uuid := public.merchant_session_id(); v_row public.merchant_support_tickets%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;
  if nullif(btrim(p_ticket->>'subject'),'') is null or nullif(btrim(p_ticket->>'message'),'') is null then raise exception 'support_subject_and_message_required'; end if;
  if lower(coalesce(nullif(btrim(p_ticket->>'priority'),''),'normal')) not in ('low','normal','high','critical') then raise exception 'invalid_support_priority'; end if;
  if nullif(p_ticket->>'orderId','') is not null and not exists (
    select 1 from public.orders o where o.id=(p_ticket->>'orderId')::uuid and o.merchant_id=v_merchant_id
  ) then raise exception 'merchant_order_not_found'; end if;
  if nullif(p_ticket->>'settlementId','') is not null and not exists (
    select 1 from public.merchant_statement_entries e where e.id=(p_ticket->>'settlementId')::uuid and e.merchant_id=v_merchant_id
  ) then raise exception 'merchant_settlement_reference_not_found'; end if;
  insert into public.merchant_support_tickets(merchant_id, category, priority, subject, message, order_id, settlement_id, preferred_contact, created_by)
  values(v_merchant_id, coalesce(nullif(btrim(p_ticket->>'category'),''),'other'), coalesce(nullif(btrim(p_ticket->>'priority'),''),'normal'), btrim(p_ticket->>'subject'), btrim(p_ticket->>'message'), nullif(p_ticket->>'orderId','')::uuid, nullif(p_ticket->>'settlementId','')::uuid, nullif(btrim(p_ticket->>'preferredContact'),''), auth.uid()) returning * into v_row;
  return jsonb_build_object('ok', true, 'ticket', to_jsonb(v_row));
end;
$$;

create or replace function public.merchant_request_order_action(p_order_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_merchant_id uuid := public.merchant_session_id(); v_order public.orders%rowtype; v_row public.merchant_order_action_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;
  if p_action not in ('cancel','return','reschedule') then raise exception 'unsupported_merchant_order_action'; end if;
  select * into v_order from public.orders where id=p_order_id and merchant_id=v_merchant_id limit 1;
  if v_order.id is null then raise exception 'merchant_order_not_found'; end if;
  if lower(coalesce(v_order.status,'')) in ('delivered','cancelled','returned') and p_action='cancel' then raise exception 'order_action_not_allowed_for_status'; end if;
  if exists (
    select 1 from public.merchant_order_action_requests r
    where r.merchant_id=v_merchant_id and r.order_id=p_order_id and r.action=p_action and r.status in ('pending','under_review')
  ) then raise exception 'merchant_order_action_already_pending'; end if;
  insert into public.merchant_order_action_requests(merchant_id,order_id,action,reason,requested_date)
  values(v_merchant_id,p_order_id,p_action,nullif(btrim(p_payload->>'reason'),''),nullif(p_payload->>'requestedDate','')::date) returning * into v_row;
  return jsonb_build_object('ok',true,'request',to_jsonb(v_row),'order_status',v_order.status);
end;
$$;

create or replace function public.merchant_update_bank_details(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_merchant_id uuid := public.merchant_session_id(); v_row public.merchants%rowtype; v_iban text := upper(regexp_replace(coalesce(p_updates->>'iban',''), '\s+', '', 'g'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;
  if v_iban <> '' and v_iban !~ '^AE[0-9]{21}$' then raise exception 'invalid_uae_iban'; end if;
  update public.merchants set bank_name = nullif(btrim(p_updates->>'bank_name'),''), iban = nullif(v_iban,''), settlement_cycle = coalesce(nullif(btrim(p_updates->>'settlement_cycle'),''), settlement_cycle), bank_verification_status = 'under_review', updated_at = now() where id = v_merchant_id returning * into v_row;
  if v_row.id is null then raise exception 'merchant_profile_update_failed'; end if;
  return jsonb_build_object('ok', true, 'review_required', true, 'merchant', to_jsonb(v_row));
end;
$$;

revoke all on function public.merchant_portal_business_center() from public, anon;
revoke all on function public.merchant_create_pickup_request(jsonb) from public, anon;
revoke all on function public.merchant_create_support_ticket(jsonb) from public, anon;
revoke all on function public.merchant_request_order_action(uuid,text,jsonb) from public, anon;
revoke all on function public.merchant_update_bank_details(jsonb) from public, anon;
grant execute on function public.merchant_portal_business_center() to authenticated;
grant execute on function public.merchant_create_pickup_request(jsonb) to authenticated;
grant execute on function public.merchant_create_support_ticket(jsonb) to authenticated;
grant execute on function public.merchant_request_order_action(uuid,text,jsonb) to authenticated;
grant execute on function public.merchant_update_bank_details(jsonb) to authenticated;


-- Merchant-owned storage. The first path segment is always the authoritative merchant UUID.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('merchant-assets','merchant-assets',true,5242880,array['image/jpeg','image/png','image/webp']),
  ('merchant-coupon-images','merchant-coupon-images',false,10485760,array['image/jpeg','image/png','image/webp']),
  ('merchant-documents','merchant-documents',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists merchant_assets_insert on storage.objects;
create policy merchant_assets_insert on storage.objects for insert to authenticated
with check (bucket_id='merchant-assets' and (storage.foldername(name))[1]=public.merchant_session_id()::text);
drop policy if exists merchant_assets_update on storage.objects;
create policy merchant_assets_update on storage.objects for update to authenticated
using (bucket_id='merchant-assets' and (storage.foldername(name))[1]=public.merchant_session_id()::text)
with check (bucket_id='merchant-assets' and (storage.foldername(name))[1]=public.merchant_session_id()::text);
drop policy if exists merchant_assets_delete on storage.objects;
create policy merchant_assets_delete on storage.objects for delete to authenticated
using (bucket_id='merchant-assets' and (storage.foldername(name))[1]=public.merchant_session_id()::text);

drop policy if exists merchant_coupon_images_select on storage.objects;
create policy merchant_coupon_images_select on storage.objects for select to authenticated
using (bucket_id='merchant-coupon-images' and (storage.foldername(name))[1]=public.merchant_session_id()::text);
drop policy if exists merchant_coupon_images_insert on storage.objects;
create policy merchant_coupon_images_insert on storage.objects for insert to authenticated
with check (bucket_id='merchant-coupon-images' and (storage.foldername(name))[1]=public.merchant_session_id()::text);

drop policy if exists merchant_documents_select on storage.objects;
create policy merchant_documents_select on storage.objects for select to authenticated
using (bucket_id='merchant-documents' and (storage.foldername(name))[1]=public.merchant_session_id()::text);
drop policy if exists merchant_documents_insert on storage.objects;
create policy merchant_documents_insert on storage.objects for insert to authenticated
with check (bucket_id='merchant-documents' and (storage.foldername(name))[1]=public.merchant_session_id()::text);

notify pgrst, 'reload schema';
commit;
