-- DAY NIGHT Customer Experience production runtime hotfix.
-- Required for Supabase projects where pgcrypto is installed in extensions
-- and notifications.type is an enum rather than text.

begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.dn_ce_request_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_ip text;
  v_salt bytea;
begin
  v_ip := coalesce(
    nullif(split_part(coalesce(v_headers->>'x-forwarded-for',''), ',', 1), ''),
    nullif(v_headers->>'cf-connecting-ip', ''),
    'unknown'
  );

  select privacy_salt
  into v_salt
  from public.customer_experience_settings
  where id=true;

  if v_salt is null then
    v_salt := extensions.digest(
      'DAY-NIGHT-CUSTOMER-EXPERIENCE-FALLBACK'::text,
      'sha256'::text
    );
  end if;

  return encode(
    extensions.hmac(
      convert_to(v_ip,'UTF8'),
      v_salt,
      'sha256'::text
    ),
    'hex'
  );
end;
$$;

create or replace function public.get_feedback_context(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_token public.feedback_tokens%rowtype;
  v_merchant public.merchants%rowtype;
  v_driver public.driver_profiles%rowtype;
  v_driver_id uuid;
  v_status text;
  v_existing boolean;
begin
  select *
  into v_token
  from public.feedback_tokens
  where token_hash=extensions.digest(coalesce(p_token,'')::text,'sha256'::text)
    and is_active=true
    and expires_at>now()
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'feedback_token_invalid_or_expired';
  end if;

  select *
  into v_order
  from public.orders
  where id=v_token.order_id;

  if not found then
    raise exception 'order_not_found';
  end if;

  v_status := lower(coalesce(to_jsonb(v_order)->>'status',''));
  if v_status not in ('delivered','completed') then
    raise exception 'feedback_only_after_delivery';
  end if;

  if v_order.merchant_id is not null then
    select * into v_merchant
    from public.merchants
    where id=v_order.merchant_id;
  end if;

  v_driver_id := coalesce(
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'assigned_driver_id'),
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'driver_id')
  );

  if v_driver_id is not null then
    select * into v_driver
    from public.driver_profiles
    where id=v_driver_id;
  end if;

  select exists(
    select 1
    from public.order_feedback f
    where f.order_id=v_order.id
  ) into v_existing;

  return jsonb_build_object(
    'ok',true,
    'tracking_number',public.dn_ce_tracking_reference(v_order),
    'delivered_at',coalesce(to_jsonb(v_order)->>'delivered_at',to_jsonb(v_order)->>'updated_at'),
    'service_type',to_jsonb(v_order)->>'service_type',
    'driver_name',coalesce(to_jsonb(v_order)->>'driver_name',to_jsonb(v_driver)->>'full_name',to_jsonb(v_driver)->>'name','مندوب داي نايت'),
    'merchant_name',coalesce(to_jsonb(v_merchant)->>'trade_name',''),
    'masked_phone',public.dn_ce_mask_phone(coalesce(to_jsonb(v_order)->>'receiver_phone',to_jsonb(v_order)->>'customer_phone','')),
    'locale',coalesce(to_jsonb(v_order)->>'preferred_language','ar'),
    'already_submitted',v_existing,
    'expires_at',v_token.expires_at
  );
end;
$$;

create or replace function public.dn_ce_notify_admins(
  p_title text,
  p_message text,
  p_type text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
declare
  v_user record;
  v_type_schema text;
  v_type_name text;
  v_type_kind "char";
  v_type_value text;
  v_has_metadata boolean;
begin
  if to_regclass('public.notifications') is null then
    return;
  end if;

  select type_ns.nspname, type_def.typname, type_def.typtype
  into v_type_schema, v_type_name, v_type_kind
  from pg_class table_def
  join pg_namespace table_ns on table_ns.oid=table_def.relnamespace
  join pg_attribute column_def on column_def.attrelid=table_def.oid
  join pg_type type_def on type_def.oid=column_def.atttypid
  join pg_namespace type_ns on type_ns.oid=type_def.typnamespace
  where table_ns.nspname='public'
    and table_def.relname='notifications'
    and column_def.attname='type'
    and column_def.attnum>0
    and not column_def.attisdropped
  limit 1;

  select exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='notifications'
      and column_name='metadata'
  ) into v_has_metadata;

  if v_type_kind='e' then
    select enum_value.enumlabel
    into v_type_value
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid=enum_value.enumtypid
    join pg_namespace enum_ns on enum_ns.oid=enum_type.typnamespace
    where enum_ns.nspname=v_type_schema
      and enum_type.typname=v_type_name
    order by case
      when enum_value.enumlabel=coalesce(nullif(btrim(p_type),''),'info') then 0
      when enum_value.enumlabel='info' then 1
      when enum_value.enumlabel='system' then 2
      else 3
    end,
    enum_value.enumsortorder
    limit 1;
  else
    v_type_value := coalesce(nullif(btrim(p_type),''),'info');
  end if;

  for v_user in
    select profile_row.id
    from public.profiles profile_row
    where lower(coalesce(profile_row.role::text,'')) in ('admin','support')
  loop
    if v_type_kind='e' then
      if v_has_metadata then
        execute format(
          'insert into public.notifications(user_id,title,message,type,metadata) values ($1,$2,$3,$4::%I.%I,$5)',
          v_type_schema,
          v_type_name
        ) using v_user.id,p_title,p_message,v_type_value,coalesce(p_metadata,'{}'::jsonb);
      else
        execute format(
          'insert into public.notifications(user_id,title,message,type) values ($1,$2,$3,$4::%I.%I)',
          v_type_schema,
          v_type_name
        ) using v_user.id,p_title,p_message,v_type_value;
      end if;
    elsif v_has_metadata then
      insert into public.notifications(user_id,title,message,type,metadata)
      values(v_user.id,p_title,p_message,v_type_value,coalesce(p_metadata,'{}'::jsonb));
    else
      insert into public.notifications(user_id,title,message,type)
      values(v_user.id,p_title,p_message,v_type_value);
    end if;
  end loop;
exception when others then
  raise notice 'Admin notification skipped: %',sqlerrm;
end;
$$;

revoke all on function public.dn_ce_request_ip_hash() from public;
revoke all on function public.get_feedback_context(text) from public;
revoke all on function public.dn_ce_notify_admins(text,text,text,jsonb) from public;

grant execute on function public.dn_ce_request_ip_hash() to anon, authenticated;
grant execute on function public.get_feedback_context(text) to anon, authenticated;
grant execute on function public.dn_ce_notify_admins(text,text,text,jsonb) to authenticated;

select pg_notify('pgrst','reload schema');

commit;
