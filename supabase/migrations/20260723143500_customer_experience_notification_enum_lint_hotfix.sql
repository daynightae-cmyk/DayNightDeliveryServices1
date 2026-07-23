-- DAY NIGHT Customer Experience notification enum/lint hotfix.
-- Uses dynamic SQL for every notifications.type assignment so Postgres/Supabase lint
-- never analyzes a text expression against an enum column in an unreachable branch.

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
  v_has_metadata boolean;
  v_insert_sql text;
begin
  if to_regclass('public.notifications') is null then
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

  select exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'metadata'
  ) into v_has_metadata;

  if v_type_kind = 'e' then
    select enum_value.enumlabel
    into v_type_value
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_ns on enum_ns.oid = enum_type.typnamespace
    where enum_ns.nspname = v_type_schema
      and enum_type.typname = v_type_name
    order by case
      when enum_value.enumlabel = coalesce(nullif(btrim(p_type), ''), 'info') then 0
      when enum_value.enumlabel = 'info' then 1
      when enum_value.enumlabel = 'system' then 2
      else 3
    end,
    enum_value.enumsortorder
    limit 1;
  else
    v_type_value := coalesce(nullif(btrim(p_type), ''), 'info');
  end if;

  if v_type_value is null then
    raise notice 'Admin notification skipped: no valid notifications.type value exists';
    return;
  end if;

  if v_has_metadata then
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

  for v_user in
    select profile_row.id
    from public.profiles profile_row
    where lower(coalesce(profile_row.role::text, '')) in ('admin', 'support')
  loop
    if v_has_metadata then
      execute v_insert_sql
      using v_user.id, p_title, p_message, v_type_value, coalesce(p_metadata, '{}'::jsonb);
    else
      execute v_insert_sql
      using v_user.id, p_title, p_message, v_type_value;
    end if;
  end loop;
exception when others then
  raise notice 'Admin notification skipped: %', sqlerrm;
end;
$$;

revoke all on function public.dn_ce_notify_admins(text,text,text,jsonb) from public;
grant execute on function public.dn_ce_notify_admins(text,text,text,jsonb) to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
