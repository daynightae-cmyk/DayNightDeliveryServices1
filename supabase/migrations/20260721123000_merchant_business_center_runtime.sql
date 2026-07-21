-- DAY NIGHT DELIVERY SERVICES
-- Merchant Business Center runtime completion.
-- Adds authoritative merchant order creation, bulk imports, notifications,
-- and merchant-scoped CRUD helpers without weakening existing RLS.

begin;

create extension if not exists pgcrypto;

create table if not exists public.merchant_notifications (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  notification_type text not null default 'system',
  title_ar text not null,
  title_en text not null,
  message_ar text not null,
  message_en text not null,
  priority text not null default 'normal',
  related_entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists merchant_notifications_scope_idx on public.merchant_notifications(merchant_id, created_at desc);
alter table public.merchant_notifications enable row level security;
drop policy if exists merchant_notifications_select_own on public.merchant_notifications;
create policy merchant_notifications_select_own on public.merchant_notifications for select to authenticated
using (merchant_id = public.merchant_session_id());
drop policy if exists merchant_notifications_update_own on public.merchant_notifications;
create policy merchant_notifications_update_own on public.merchant_notifications for update to authenticated
using (merchant_id = public.merchant_session_id()) with check (merchant_id = public.merchant_session_id());

-- Existing import tables become safely available to the current merchant only.
alter table public.import_batches add column if not exists column_mapping jsonb not null default '{}'::jsonb;
alter table public.import_batches add column if not exists error_summary jsonb not null default '[]'::jsonb;
alter table public.import_batch_rows add column if not exists updated_at timestamptz not null default now();

drop policy if exists merchant_import_batches_select_own on public.import_batches;
create policy merchant_import_batches_select_own on public.import_batches for select to authenticated
using (merchant_id = public.merchant_session_id());
drop policy if exists merchant_import_batches_insert_own on public.import_batches;
create policy merchant_import_batches_insert_own on public.import_batches for insert to authenticated
with check (merchant_id = public.merchant_session_id() and created_by = auth.uid());
drop policy if exists merchant_import_rows_select_own on public.import_batch_rows;
create policy merchant_import_rows_select_own on public.import_batch_rows for select to authenticated
using (exists (
  select 1 from public.import_batches b
  where b.id = batch_id and b.merchant_id = public.merchant_session_id()
));

drop policy if exists merchant_cod_collections_select_own on public.cod_collections;
create policy merchant_cod_collections_select_own on public.cod_collections for select to authenticated
using (merchant_id = public.merchant_session_id());

drop policy if exists merchant_statement_entries_select_own on public.merchant_statement_entries;
create policy merchant_statement_entries_select_own on public.merchant_statement_entries for select to authenticated
using (merchant_id = public.merchant_session_id());

-- Own-merchant order creation with server-side pricing and schema-compatible insertion.
create or replace function public.merchant_create_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant_id uuid := public.merchant_session_id();
  v_merchant public.merchants%rowtype;
  v_order public.orders%rowtype;
  v_price_json jsonb;
  v_total numeric;
  v_weight numeric := greatest(coalesce(public.dn_numeric_or_null(p_order->>'weight'), 1), 0.01);
  v_tracking text := 'DN-' || to_char(clock_timestamp(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_payment text := lower(coalesce(nullif(btrim(p_order->>'payment_method'), ''), 'sender_pays'));
  v_payload jsonb;
  v_columns text;
  v_values text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;
  select * into v_merchant from public.merchants where id = v_merchant_id limit 1;
  if v_merchant.id is null then raise exception 'merchant_profile_not_found'; end if;
  if lower(coalesce(v_merchant.status, 'active')) in ('blocked','suspended','deleted','archived') then raise exception 'merchant_account_not_active'; end if;

  if nullif(btrim(p_order->>'receiver_name'), '') is null then raise exception 'recipient_name_required'; end if;
  if nullif(regexp_replace(coalesce(p_order->>'receiver_phone',''), '\D', '', 'g'), '') is null then raise exception 'recipient_phone_required'; end if;
  if nullif(btrim(p_order->>'receiver_city'), '') is null then raise exception 'delivery_city_required'; end if;
  if nullif(btrim(p_order->>'receiver_address'), '') is null then raise exception 'delivery_address_required'; end if;
  if v_payment not in ('sender_pays','receiver_pays','cod','prepaid') then raise exception 'invalid_payment_method'; end if;

  begin
    execute 'select to_jsonb(x) from public.calculate_delivery_price($1,$2,$3) x limit 1'
      into v_price_json
      using coalesce(nullif(p_order->>'sender_city',''), v_merchant.city, v_merchant.emirate),
            p_order->>'receiver_city', v_weight;
  exception
    when undefined_function then raise exception 'merchant_pricing_service_unavailable';
    when others then raise exception 'merchant_pricing_failed: %', sqlerrm;
  end;

  if jsonb_typeof(v_price_json) = 'number' then
    v_total := (v_price_json #>> '{}')::numeric;
  else
    v_total := coalesce(
      public.dn_numeric_or_null(v_price_json->>'total'),
      public.dn_numeric_or_null(v_price_json->>'total_price'),
      public.dn_numeric_or_null(v_price_json->>'price'),
      public.dn_numeric_or_null(v_price_json->>'delivery_price')
    );
  end if;
  if v_total is null or v_total < 0 then raise exception 'merchant_pricing_unconfirmed'; end if;

  v_payload := jsonb_strip_nulls(p_order || jsonb_build_object(
    'tracking_number', v_tracking,
    'tracking_code', v_tracking,
    'invoice_number', coalesce(nullif(btrim(p_order->>'invoice_number'), ''), v_tracking),
    'merchant_id', v_merchant.id::text,
    'merchant_name', v_merchant.trade_name,
    'merchant_code', v_merchant.merchant_code,
    'sender_name', coalesce(nullif(btrim(p_order->>'sender_name'), ''), v_merchant.trade_name),
    'sender_phone', coalesce(nullif(btrim(p_order->>'sender_phone'), ''), v_merchant.phone),
    'sender_city', coalesce(nullif(btrim(p_order->>'sender_city'), ''), v_merchant.city, v_merchant.emirate, 'Abu Dhabi'),
    'sender_address', coalesce(nullif(btrim(p_order->>'sender_address'), ''), v_merchant.pickup_address, v_merchant.address, 'Abu Dhabi'),
    'package_type', coalesce(nullif(btrim(p_order->>'package_type'), ''), 'Shipment'),
    'package_description', coalesce(nullif(btrim(p_order->>'package_description'), ''), nullif(btrim(p_order->>'package_type'), ''), 'Shipment'),
    'weight', v_weight,
    'pieces', greatest(coalesce(public.dn_numeric_or_null(p_order->>'pieces')::integer, 1), 1),
    'order_count', greatest(coalesce(public.dn_numeric_or_null(p_order->>'pieces')::integer, 1), 1),
    'service_type', coalesce(nullif(btrim(p_order->>'service_type'), ''), 'standard'),
    'payment_method', v_payment,
    'cod_amount', case when v_payment = 'cod' then greatest(coalesce(public.dn_numeric_or_null(p_order->>'cod_amount'), 0), 0) else 0 end,
    'delivery_price', v_total,
    'subtotal', v_total,
    'base_price', coalesce(public.dn_numeric_or_null(v_price_json->>'base_fee'), public.dn_numeric_or_null(v_price_json->>'base_price'), v_total),
    'total', v_total,
    'total_price', v_total,
    'amount', v_total,
    'price', v_total,
    'currency', 'AED',
    'source_channel', coalesce(nullif(btrim(p_order->>'source_channel'), ''), 'merchant_portal'),
    'source_domain', 'daynightae.com',
    'status', 'pending',
    'status_history', jsonb_build_array(jsonb_build_object('status','pending','created_at',now(),'note','Created by authenticated merchant portal')),
    'created_by', auth.uid()::text,
    'created_at', now(),
    'updated_at', now()
  ));

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('(jsonb_populate_record(null::public.orders, $1)).%I', c.column_name), ', ' order by c.ordinal_position)
    into v_columns, v_values
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'orders'
    and v_payload ? c.column_name
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  execute format('insert into public.orders (%s) select %s returning *', v_columns, v_values)
    using v_payload into v_order;
  if to_jsonb(v_order)->>'merchant_id' is distinct from v_merchant_id::text then raise exception 'merchant_order_link_verification_failed'; end if;
  return v_order;
end;
$$;

create or replace function public.merchant_save_branch(p_branch jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_mid uuid := public.merchant_session_id(); v_id uuid := public.admin_safe_uuid(p_branch->>'id'); v_row public.merchant_branches%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_mid is null then raise exception 'merchant_profile_not_found'; end if;
  if nullif(btrim(p_branch->>'name'),'') is null or nullif(btrim(p_branch->>'address'),'') is null then raise exception 'branch_name_and_address_required'; end if;
  if v_id is null then
    insert into public.merchant_branches(merchant_id,name,code,contact_name,phone,email,emirate,city,address,working_hours,pickup_instructions,is_default,active)
    values(v_mid,btrim(p_branch->>'name'),nullif(btrim(p_branch->>'code'),''),nullif(btrim(p_branch->>'contactName'),''),nullif(btrim(p_branch->>'phone'),''),nullif(btrim(p_branch->>'email'),''),nullif(btrim(p_branch->>'emirate'),''),nullif(btrim(p_branch->>'city'),''),btrim(p_branch->>'address'),nullif(btrim(p_branch->>'workingHours'),''),nullif(btrim(p_branch->>'pickupInstructions'),''),coalesce((p_branch->>'isDefault')::boolean,false),coalesce((p_branch->>'active')::boolean,true)) returning * into v_row;
  else
    update public.merchant_branches set name=btrim(p_branch->>'name'),code=nullif(btrim(p_branch->>'code'),''),contact_name=nullif(btrim(p_branch->>'contactName'),''),phone=nullif(btrim(p_branch->>'phone'),''),email=nullif(btrim(p_branch->>'email'),''),emirate=nullif(btrim(p_branch->>'emirate'),''),city=nullif(btrim(p_branch->>'city'),''),address=btrim(p_branch->>'address'),working_hours=nullif(btrim(p_branch->>'workingHours'),''),pickup_instructions=nullif(btrim(p_branch->>'pickupInstructions'),''),is_default=coalesce((p_branch->>'isDefault')::boolean,is_default),active=coalesce((p_branch->>'active')::boolean,active),updated_at=now() where id=v_id and merchant_id=v_mid returning * into v_row;
  end if;
  if v_row.id is null then raise exception 'branch_not_found'; end if;
  if v_row.is_default then
    update public.merchant_branches set is_default=false, updated_at=now()
    where merchant_id=v_mid and id<>v_row.id and is_default;
  end if;
  return jsonb_build_object('ok',true,'branch',to_jsonb(v_row));
end $$;

create or replace function public.merchant_save_address_book_entry(p_entry jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_mid uuid := public.merchant_session_id(); v_id uuid := public.admin_safe_uuid(p_entry->>'id'); v_row public.merchant_address_book%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_mid is null then raise exception 'merchant_profile_not_found'; end if;
  if nullif(btrim(p_entry->>'recipientName'),'') is null or nullif(btrim(p_entry->>'phone'),'') is null then raise exception 'recipient_name_and_phone_required'; end if;
  if v_id is null then
    insert into public.merchant_address_book(merchant_id,recipient_name,phone,alternate_phone,email,emirate,city,area,address,building,floor,landmark,notes,tags)
    values(v_mid,btrim(p_entry->>'recipientName'),btrim(p_entry->>'phone'),nullif(btrim(p_entry->>'alternatePhone'),''),nullif(btrim(p_entry->>'email'),''),nullif(btrim(p_entry->>'emirate'),''),nullif(btrim(p_entry->>'city'),''),nullif(btrim(p_entry->>'area'),''),nullif(btrim(p_entry->>'address'),''),nullif(btrim(p_entry->>'building'),''),nullif(btrim(p_entry->>'floor'),''),nullif(btrim(p_entry->>'landmark'),''),nullif(btrim(p_entry->>'notes'),''),coalesce(array(select jsonb_array_elements_text(coalesce(p_entry->'tags','[]'::jsonb))),'{}')) returning * into v_row;
  else
    update public.merchant_address_book set recipient_name=btrim(p_entry->>'recipientName'),phone=btrim(p_entry->>'phone'),alternate_phone=nullif(btrim(p_entry->>'alternatePhone'),''),email=nullif(btrim(p_entry->>'email'),''),emirate=nullif(btrim(p_entry->>'emirate'),''),city=nullif(btrim(p_entry->>'city'),''),area=nullif(btrim(p_entry->>'area'),''),address=nullif(btrim(p_entry->>'address'),''),building=nullif(btrim(p_entry->>'building'),''),floor=nullif(btrim(p_entry->>'floor'),''),landmark=nullif(btrim(p_entry->>'landmark'),''),notes=nullif(btrim(p_entry->>'notes'),''),tags=coalesce(array(select jsonb_array_elements_text(coalesce(p_entry->'tags','[]'::jsonb))),tags),updated_at=now() where id=v_id and merchant_id=v_mid returning * into v_row;
  end if;
  if v_row.id is null then raise exception 'address_book_entry_not_found'; end if;
  return jsonb_build_object('ok',true,'entry',to_jsonb(v_row));
end $$;

create or replace function public.merchant_save_team_member(p_member jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_mid uuid := public.merchant_session_id(); v_id uuid := public.admin_safe_uuid(p_member->>'id'); v_row public.merchant_team_members%rowtype; v_role text := lower(coalesce(nullif(p_member->>'role',''),'viewer'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_mid is null then raise exception 'merchant_profile_not_found'; end if;
  if v_role not in ('owner','manager','operations','finance','viewer') then raise exception 'invalid_team_role'; end if;
  if nullif(btrim(p_member->>'name'),'') is null or nullif(btrim(p_member->>'email'),'') is null then raise exception 'team_name_and_email_required'; end if;
  if v_id is null then
    insert into public.merchant_team_members(merchant_id,name,email,phone,role,status,permissions)
    values(v_mid,btrim(p_member->>'name'),lower(btrim(p_member->>'email')),nullif(btrim(p_member->>'phone'),''),v_role,'invited',coalesce(array(select jsonb_array_elements_text(coalesce(p_member->'permissions','[]'::jsonb))),'{}')) returning * into v_row;
  else
    update public.merchant_team_members set name=btrim(p_member->>'name'),email=lower(btrim(p_member->>'email')),phone=nullif(btrim(p_member->>'phone'),''),role=v_role,permissions=coalesce(array(select jsonb_array_elements_text(coalesce(p_member->'permissions','[]'::jsonb))),permissions),updated_at=now() where id=v_id and merchant_id=v_mid returning * into v_row;
  end if;
  if v_row.id is null then raise exception 'team_member_not_found'; end if;
  return jsonb_build_object('ok',true,'member',to_jsonb(v_row));
end $$;

create or replace function public.merchant_create_import_preview(p_file_name text, p_branch_id uuid, p_rows jsonb, p_mapping jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_mid uuid := public.merchant_session_id(); v_batch public.import_batches%rowtype; v_item jsonb; v_index integer := 0; v_valid integer := 0; v_invalid integer := 0; v_errors jsonb; v_normal jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_mid is null then raise exception 'merchant_profile_not_found'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'import_rows_must_be_array'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'import_row_limit_exceeded'; end if;
  if p_branch_id is not null and not exists (select 1 from public.merchant_branches where id=p_branch_id and merchant_id=v_mid and active) then raise exception 'merchant_branch_not_found'; end if;
  insert into public.import_batches(merchant_id,file_name,import_mode,status,total_rows,created_by,column_mapping)
  values(v_mid,coalesce(nullif(btrim(p_file_name),''),'merchant-import.csv'),'preview','validating',jsonb_array_length(p_rows),auth.uid(),coalesce(p_mapping,'{}'::jsonb)) returning * into v_batch;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    v_normal := jsonb_build_object(
      'receiver_name', nullif(btrim(v_item->>'recipientName'),''),
      'receiver_phone', nullif(btrim(v_item->>'recipientPhone'),''),
      'receiver_city', nullif(btrim(v_item->>'deliveryCity'),''),
      'receiver_address', nullif(btrim(v_item->>'deliveryAddress'),''),
      'cod_amount', greatest(coalesce(public.dn_numeric_or_null(v_item->>'codAmount'),0),0),
      'package_type', coalesce(nullif(btrim(v_item->>'packageType'),''),'Shipment'),
      'pieces', greatest(coalesce(public.dn_numeric_or_null(v_item->>'pieces')::integer,1),1),
      'weight', greatest(coalesce(public.dn_numeric_or_null(v_item->>'weight'),1),0.01),
      'service_type', coalesce(nullif(btrim(v_item->>'serviceType'),''),'standard'),
      'payment_method', case when coalesce(public.dn_numeric_or_null(v_item->>'codAmount'),0)>0 then 'cod' else 'sender_pays' end,
      'merchant_reference', nullif(btrim(v_item->>'merchantReference'),'')
    );
    v_errors := '[]'::jsonb;
    if v_normal->>'receiver_name' is null then v_errors := v_errors || jsonb_build_array('recipient_name_required'); end if;
    if length(regexp_replace(coalesce(v_normal->>'receiver_phone',''),'\D','','g')) < 9 then v_errors := v_errors || jsonb_build_array('valid_phone_required'); end if;
    if v_normal->>'receiver_city' is null then v_errors := v_errors || jsonb_build_array('delivery_city_required'); end if;
    if v_normal->>'receiver_address' is null then v_errors := v_errors || jsonb_build_array('delivery_address_required'); end if;
    insert into public.import_batch_rows(batch_id,row_index,raw_payload,normalized_payload,validation_errors,status)
    values(v_batch.id,v_index,v_item,v_normal,v_errors,case when jsonb_array_length(v_errors)=0 then 'valid' else 'invalid' end);
    if jsonb_array_length(v_errors)=0 then v_valid:=v_valid+1; else v_invalid:=v_invalid+1; end if;
  end loop;
  update public.import_batches set valid_rows=v_valid,invalid_rows=v_invalid,status='preview_ready',error_summary=(select coalesce(jsonb_agg(jsonb_build_object('row',row_index,'errors',validation_errors)),'[]'::jsonb) from public.import_batch_rows where batch_id=v_batch.id and status='invalid') where id=v_batch.id returning * into v_batch;
  return jsonb_build_object('ok',true,'batch_id',v_batch.id,'total_rows',v_batch.total_rows,'valid_rows',v_valid,'invalid_rows',v_invalid,'warnings',0,'duplicate_rows',0,'row_errors',v_batch.error_summary);
end $$;

create or replace function public.merchant_commit_import(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_mid uuid := public.merchant_session_id(); v_batch public.import_batches%rowtype; v_row public.import_batch_rows%rowtype; v_order public.orders%rowtype; v_imported integer:=0; v_failed integer:=0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_mid is null then raise exception 'merchant_profile_not_found'; end if;
  select * into v_batch from public.import_batches where id=p_batch_id and merchant_id=v_mid for update;
  if v_batch.id is null then raise exception 'import_batch_not_found'; end if;
  if v_batch.status = 'completed' then return jsonb_build_object('ok',true,'batch_id',v_batch.id,'imported_count',v_batch.valid_rows,'failed_count',v_batch.invalid_rows,'already_committed',true); end if;
  update public.import_batches set status='processing' where id=v_batch.id;
  for v_row in select * from public.import_batch_rows where batch_id=v_batch.id and status='valid' order by row_index loop
    begin
      v_order := public.merchant_create_order(v_row.normalized_payload || jsonb_build_object('source_channel','merchant_bulk_import'));
      update public.import_batch_rows set status='imported',created_order_id=v_order.id,updated_at=now() where id=v_row.id;
      v_imported:=v_imported+1;
    exception when others then
      update public.import_batch_rows set status='failed',validation_errors=validation_errors||jsonb_build_array(sqlerrm),updated_at=now() where id=v_row.id;
      v_failed:=v_failed+1;
    end;
  end loop;
  update public.import_batches set status=case when v_failed=0 then 'completed' else 'completed_with_errors' end,completed_at=now() where id=v_batch.id;
  return jsonb_build_object('ok',v_failed=0,'batch_id',v_batch.id,'imported_count',v_imported,'failed_count',v_failed);
end $$;


-- Extend the existing strict self-profile RPC without widening merchant ownership.
create or replace function public.merchant_update_own_profile(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_mid uuid := public.merchant_session_id();
  v_row public.merchants%rowtype;
  v_logo text := nullif(btrim(p_updates->>'logo_url'),'');
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_mid is null then raise exception 'merchant_profile_not_found'; end if;
  if v_logo is not null and v_logo !~* '^https://' then raise exception 'invalid_logo_url'; end if;
  update public.merchants m set
    trade_name=case when p_updates?'trade_name' then coalesce(nullif(btrim(p_updates->>'trade_name'),''),m.trade_name) else m.trade_name end,
    owner_name=case when p_updates?'owner_name' then nullif(btrim(p_updates->>'owner_name'),'') else m.owner_name end,
    phone=case when p_updates?'phone' then coalesce(nullif(btrim(p_updates->>'phone'),''),m.phone) else m.phone end,
    alt_phone=case when p_updates?'alt_phone' then nullif(btrim(p_updates->>'alt_phone'),'') else m.alt_phone end,
    emirate=case when p_updates?'emirate' then coalesce(nullif(btrim(p_updates->>'emirate'),''),m.emirate) else m.emirate end,
    city=case when p_updates?'city' then coalesce(nullif(btrim(p_updates->>'city'),''),m.city) else m.city end,
    address=case when p_updates?'address' then nullif(btrim(p_updates->>'address'),'') else m.address end,
    pickup_address=case when p_updates?'pickup_address' then nullif(btrim(p_updates->>'pickup_address'),'') else m.pickup_address end,
    logo_url=case when p_updates?'logo_url' then v_logo else m.logo_url end,
    license_number=case when p_updates?'license_number' then nullif(btrim(p_updates->>'license_number'),'') else m.license_number end,
    license_expiry=case when p_updates?'license_expiry' then nullif(p_updates->>'license_expiry','')::date else m.license_expiry end,
    business_type=case when p_updates?'business_type' then nullif(btrim(p_updates->>'business_type'),'') else m.business_type end,
    trn=case when p_updates?'trn' then nullif(btrim(p_updates->>'trn'),'') else m.trn end,
    default_payment_method=case when p_updates?'default_payment_method' then coalesce(nullif(btrim(p_updates->>'default_payment_method'),''),m.default_payment_method) else m.default_payment_method end,
    cod_enabled=case when p_updates?'cod_enabled' then coalesce((p_updates->>'cod_enabled')::boolean,m.cod_enabled) else m.cod_enabled end,
    notes=case when p_updates?'notes' then nullif(btrim(p_updates->>'notes'),'') else m.notes end,
    updated_at=now()
  where m.id=v_mid returning * into v_row;
  if v_row.id is null then raise exception 'merchant_profile_update_failed'; end if;
  return jsonb_build_object('ok',true,'merchant_id',v_row.id,'merchant',to_jsonb(v_row));
end $$;

create or replace function public.merchant_order_notification_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_tracking text := coalesce(to_jsonb(new)->>'tracking_number',to_jsonb(new)->>'tracking_code',to_jsonb(new)->>'invoice_number',new.id::text);
  v_status text := lower(coalesce(to_jsonb(new)->>'status','pending'));
  v_title_ar text;
  v_title_en text;
  v_message_ar text;
  v_message_en text;
begin
  if new.merchant_id is null then return new; end if;
  if tg_op='INSERT' then
    v_title_ar:='تم إنشاء طلب جديد'; v_title_en:='New order created';
    v_message_ar:='تم تسجيل الطلب '||v_tracking||' في بوابة التاجر.';
    v_message_en:='Order '||v_tracking||' was registered in the Merchant Portal.';
  elsif to_jsonb(old)->>'status' is distinct from to_jsonb(new)->>'status' then
    v_title_ar:='تحديث حالة الطلب'; v_title_en:='Order status updated';
    v_message_ar:='الطلب '||v_tracking||' أصبح: '||replace(v_status,'_',' ');
    v_message_en:='Order '||v_tracking||' is now: '||replace(v_status,'_',' ');
  else
    return new;
  end if;
  insert into public.merchant_notifications(merchant_id,notification_type,title_ar,title_en,message_ar,message_en,priority,related_entity_id)
  values(new.merchant_id,case when tg_op='INSERT' then 'order_created' else 'order_status' end,v_title_ar,v_title_en,v_message_ar,v_message_en,case when v_status in ('failed','delivery_failed','returned','cancelled') then 'high' else 'normal' end,new.id::text);
  return new;
end $$;

drop trigger if exists merchant_order_notification_sync on public.orders;
create trigger merchant_order_notification_sync
after insert or update of status on public.orders
for each row execute function public.merchant_order_notification_trigger();

create or replace function public.merchant_mark_notification_read(p_notification_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_mid uuid := public.merchant_session_id(); v_count integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.merchant_notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and merchant_id=v_mid;
  get diagnostics v_count = row_count;
  if v_count=0 then raise exception 'notification_not_found'; end if;
  return jsonb_build_object('ok',true,'notification_id',p_notification_id,'read_at',now());
end $$;

-- Replace the business center aggregate with runtime-complete data.
create or replace function public.merchant_portal_business_center()
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_mid uuid := public.merchant_session_id();
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_mid is null then raise exception 'merchant_profile_not_found'; end if;
  return jsonb_build_object(
    'ok',true,'merchant_id',v_mid,'generated_at',now(),
    'branches',(select coalesce(jsonb_agg(to_jsonb(x) order by x.is_default desc,x.name),'[]'::jsonb) from public.merchant_branches x where x.merchant_id=v_mid),
    'pickup_requests',(select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_date desc,x.created_at desc),'[]'::jsonb) from public.merchant_pickup_requests x where x.merchant_id=v_mid),
    'address_book',(select coalesce(jsonb_agg(to_jsonb(x) order by x.recipient_name),'[]'::jsonb) from public.merchant_address_book x where x.merchant_id=v_mid and not x.archived),
    'documents',(select coalesce(jsonb_agg(to_jsonb(x) order by x.expiry_date nulls last),'[]'::jsonb) from public.merchant_documents x where x.merchant_id=v_mid),
    'team',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.merchant_team_members x where x.merchant_id=v_mid),
    'support_tickets',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (select id,category,priority,subject,message,status,order_id,settlement_id,public_response as response,created_at,updated_at from public.merchant_support_tickets where merchant_id=v_mid limit 120) x),
    'notifications',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'type',x.notification_type,'titleAr',x.title_ar,'titleEn',x.title_en,'messageAr',x.message_ar,'messageEn',x.message_en,'priority',x.priority,'relatedEntityId',x.related_entity_id,'read',x.read_at is not null,'createdAt',x.created_at) order by x.created_at desc),'[]'::jsonb) from public.merchant_notifications x where x.merchant_id=v_mid limit 150),
    'cod_collections',(select coalesce(jsonb_agg(to_jsonb(x) order by x.collection_date desc nulls last,x.created_at desc),'[]'::jsonb) from public.cod_collections x where x.merchant_id=v_mid limit 500),
    'statement_entries',(select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date,x.created_at),'[]'::jsonb) from public.merchant_statement_entries x where x.merchant_id=v_mid limit 1000),
    'import_batches',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from public.import_batches x where x.merchant_id=v_mid limit 50)
  );
end $$;

revoke all on function public.merchant_create_order(jsonb) from public, anon;
revoke all on function public.merchant_save_branch(jsonb) from public, anon;
revoke all on function public.merchant_save_address_book_entry(jsonb) from public, anon;
revoke all on function public.merchant_save_team_member(jsonb) from public, anon;
revoke all on function public.merchant_create_import_preview(text,uuid,jsonb,jsonb) from public, anon;
revoke all on function public.merchant_commit_import(uuid) from public, anon;
revoke all on function public.merchant_mark_notification_read(uuid) from public, anon;
revoke all on function public.merchant_update_own_profile(jsonb) from public, anon;

grant execute on function public.merchant_create_order(jsonb) to authenticated;
grant execute on function public.merchant_save_branch(jsonb) to authenticated;
grant execute on function public.merchant_save_address_book_entry(jsonb) to authenticated;
grant execute on function public.merchant_save_team_member(jsonb) to authenticated;
grant execute on function public.merchant_create_import_preview(text,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.merchant_commit_import(uuid) to authenticated;
grant execute on function public.merchant_mark_notification_read(uuid) to authenticated;
grant execute on function public.merchant_update_own_profile(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
