-- DAY NIGHT DELIVERY SERVICES
-- Make Customer Experience admin notifications compatible with the live
-- notifications schema where body is mandatory and message/metadata/data may
-- coexist for legacy and current clients.

begin;

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
  v_has_body boolean;
  v_has_message boolean;
  v_has_metadata boolean;
  v_has_data boolean;
  v_insert_sql text;
begin
  if to_regclass('public.notifications') is null then
    raise notice 'Admin notification skipped: notifications table does not exist';
    return;
  end if;

  select type_ns.nspname, type_def.typname, type_def.typtype
  into v_type_schema, v_type_name, v_type_kind
  from pg_class table_def
  join pg_namespace table_ns on table_ns.oid = table_def.relnamespace
  join pg_attribute column_def on column_def.attrelid = table_def.oid
  join pg_type type_def on type_def.oid = column_def.atttypid
  join pg_namespace type_ns on type_ns.oid = type_def.typnamespace
  where table_ns.nspname = 'public'
    and table_def.relname = 'notifications'
    and column_def.attname = 'type'
    and column_def.attnum > 0
    and not column_def.attisdropped
  limit 1;

  if v_type_schema is null or v_type_name is null then
    raise notice 'Admin notification skipped: notifications.type was not found';
    return;
  end if;

  select
    bool_or(column_name = 'body'),
    bool_or(column_name = 'message'),
    bool_or(column_name = 'metadata'),
    bool_or(column_name = 'data')
  into v_has_body, v_has_message, v_has_metadata, v_has_data
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'notifications'
    and column_name in ('body','message','metadata','data');

  if v_type_kind = 'e' then
    select enum_value.enumlabel
    into v_type_value
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_ns on enum_ns.oid = enum_type.typnamespace
    where enum_ns.nspname = v_type_schema
      and enum_type.typname = v_type_name
    order by case
      when enum_value.enumlabel = coalesce(nullif(btrim(p_type), ''), 'push') then 0
      when enum_value.enumlabel = 'push' then 1
      when enum_value.enumlabel = 'email' then 2
      when enum_value.enumlabel = 'sms' then 3
      when enum_value.enumlabel = 'whatsapp' then 4
      else 5
    end,
    enum_value.enumsortorder
    limit 1;
  else
    v_type_value := coalesce(nullif(btrim(p_type), ''), 'push');
  end if;

  if v_type_value is null then
    raise notice 'Admin notification skipped: no valid notifications.type value exists';
    return;
  end if;

  if coalesce(v_has_body, false) then
    if coalesce(v_has_message, false) and coalesce(v_has_metadata, false) and coalesce(v_has_data, false) then
      v_insert_sql := format(
        'insert into public.notifications(user_id,title,body,message,type,metadata,data) values ($1,$2,$3,$3,$4::%I.%I,$5,$5)',
        v_type_schema,
        v_type_name
      );
    elsif coalesce(v_has_message, false) and coalesce(v_has_metadata, false) then
      v_insert_sql := format(
        'insert into public.notifications(user_id,title,body,message,type,metadata) values ($1,$2,$3,$3,$4::%I.%I,$5)',
        v_type_schema,
        v_type_name
      );
    elsif coalesce(v_has_metadata, false) and coalesce(v_has_data, false) then
      v_insert_sql := format(
        'insert into public.notifications(user_id,title,body,type,metadata,data) values ($1,$2,$3,$4::%I.%I,$5,$5)',
        v_type_schema,
        v_type_name
      );
    elsif coalesce(v_has_metadata, false) then
      v_insert_sql := format(
        'insert into public.notifications(user_id,title,body,type,metadata) values ($1,$2,$3,$4::%I.%I,$5)',
        v_type_schema,
        v_type_name
      );
    elsif coalesce(v_has_data, false) then
      v_insert_sql := format(
        'insert into public.notifications(user_id,title,body,type,data) values ($1,$2,$3,$4::%I.%I,$5)',
        v_type_schema,
        v_type_name
      );
    else
      v_insert_sql := format(
        'insert into public.notifications(user_id,title,body,type) values ($1,$2,$3,$4::%I.%I)',
        v_type_schema,
        v_type_name
      );
    end if;
  elsif coalesce(v_has_message, false) then
    if coalesce(v_has_metadata, false) then
      v_insert_sql := format(
        'insert into public.notifications(user_id,title,message,type,metadata) values ($1,$2,$3,$4::%I.%I,$5)',
        v_type_schema,
        v_type_name
      );
    else
      v_insert_sql := format(
        'insert into public.notifications(user_id,title,message,type) values ($1,$2,$3,$4::%I.%I)',
        v_type_schema,
        v_type_name
      );
    end if;
  else
    raise exception 'notifications_schema_missing_body_and_message';
  end if;

  for v_user in
    select profile_row.id
    from public.profiles profile_row
    where lower(coalesce(profile_row.role::text, ''))
      in ('admin', 'support', 'owner', 'super_admin')
  loop
    execute v_insert_sql
    using
      v_user.id,
      coalesce(nullif(btrim(p_title), ''), 'DAY NIGHT'),
      coalesce(nullif(btrim(p_message), ''), 'DAY NIGHT notification'),
      v_type_value,
      coalesce(p_metadata, '{}'::jsonb);
  end loop;
end;
$$;

revoke all on function public.dn_ce_notify_admins(text,text,text,jsonb) from public, anon;
grant execute on function public.dn_ce_notify_admins(text,text,text,jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
