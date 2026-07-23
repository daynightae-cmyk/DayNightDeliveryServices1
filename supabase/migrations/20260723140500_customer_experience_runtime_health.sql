-- DAY NIGHT customer-experience final SQL hardening and remote health proof.

begin;

create or replace function public.admin_update_message_template(
  p_template_id uuid,
  p_body text,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_unknown text[];
  v_allowed text[] := array[
    'customer_name','customer_city','merchant_name','driver_name','tracking_number','amount_due','amount_due_line','payment_method','payment_line','tracking_url','feedback_url','merchant_portal_url','merchant_order_url','statement_url','order_status','complaint_number','support_phone','company_name_ar','company_name_en','company_email','company_website','pickup_time','delivery_time','failure_reason','settlement_period','order_count','gross_collected','fees','net_due'
  ];
  v_row public.message_templates%rowtype;
begin
  if not public.dn_ce_is_admin_or_support() then raise exception 'not_authorized'; end if;
  if length(btrim(coalesce(p_body,''))) < 2 then raise exception 'template_body_empty'; end if;

  select array_agg(variable order by variable)
  into v_unknown
  from (
    select distinct (regexp_matches(p_body, '\{([a-zA-Z0-9_]+)\}', 'g'))[1] as variable
  ) variables
  where variable is not null
    and not (variable = any(v_allowed));

  if coalesce(array_length(v_unknown,1),0) > 0 then
    raise exception 'unknown_template_variables:%', array_to_string(v_unknown,',');
  end if;

  update public.message_templates
  set body = p_body,
      is_active = coalesce(p_is_active,is_active),
      updated_at = now()
  where id = p_template_id
  returning * into v_row;

  if not found then raise exception 'template_not_found'; end if;
  perform public.dn_ce_audit(
    'message_template',
    'update',
    jsonb_build_object('template_id',p_template_id,'template_key',v_row.template_key,'language',v_row.language)
  );
  return to_jsonb(v_row) || jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.admin_update_message_template(uuid,text,boolean) from public, anon;
grant execute on function public.admin_update_message_template(uuid,text,boolean) to authenticated;

create or replace function public.customer_experience_runtime_health()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_tables text[] := array[
    'customer_experience_settings',
    'message_templates',
    'outbound_message_logs',
    'feedback_tokens',
    'order_feedback',
    'complaints',
    'complaint_attachments',
    'complaint_events',
    'order_contact_attempts'
  ];
  v_missing text[];
  v_rls_missing text[];
  v_realtime_missing text[];
begin
  select array_agg(table_name order by table_name)
  into v_missing
  from unnest(v_tables) table_name
  where to_regclass('public.' || table_name) is null;

  select array_agg(table_name order by table_name)
  into v_rls_missing
  from unnest(v_tables) table_name
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = table_name
      and c.relrowsecurity = true
  );

  select array_agg(table_name order by table_name)
  into v_realtime_missing
  from unnest(array['order_feedback','complaints','outbound_message_logs','complaint_events']) table_name
  where not exists (
    select 1
    from pg_publication_tables p
    where p.pubname = 'supabase_realtime'
      and p.schemaname = 'public'
      and p.tablename = table_name
  );

  return jsonb_build_object(
    'ok',
      coalesce(array_length(v_missing,1),0)=0
      and coalesce(array_length(v_rls_missing,1),0)=0
      and coalesce(array_length(v_realtime_missing,1),0)=0
      and to_regprocedure('public.create_feedback_token_for_order(uuid)') is not null
      and to_regprocedure('public.get_feedback_context(text)') is not null
      and to_regprocedure('public.submit_order_feedback(text,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean)') is not null
      and to_regprocedure('public.submit_public_complaint(text,text,text,text,text,boolean)') is not null,
    'missing_tables', coalesce(to_jsonb(v_missing),'[]'::jsonb),
    'rls_missing', coalesce(to_jsonb(v_rls_missing),'[]'::jsonb),
    'realtime_missing', coalesce(to_jsonb(v_realtime_missing),'[]'::jsonb),
    'feedback_token_rpc', to_regprocedure('public.create_feedback_token_for_order(uuid)') is not null,
    'feedback_context_rpc', to_regprocedure('public.get_feedback_context(text)') is not null,
    'feedback_submit_rpc', to_regprocedure('public.submit_order_feedback(text,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean)') is not null,
    'complaint_submit_rpc', to_regprocedure('public.submit_public_complaint(text,text,text,text,text,boolean)') is not null,
    'message_log_rpc', to_regprocedure('public.log_outbound_message(text,text,text,uuid,text,uuid,uuid,uuid,text,text,text,jsonb)') is not null,
    'attachment_bucket', exists(select 1 from storage.buckets where id='complaint-attachments' and public=false),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.customer_experience_runtime_health() from public;
grant execute on function public.customer_experience_runtime_health() to anon, authenticated;

select pg_notify('pgrst','reload schema');

commit;
