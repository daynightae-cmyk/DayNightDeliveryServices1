\set ON_ERROR_STOP on

select public.customer_experience_runtime_health() as health \gset

select case
  when (:health::jsonb->>'ok')::boolean is true then 1
  else (select 1/0)
end as health_ok;

select case when to_regclass('public.message_templates') is not null then 1 else (select 1/0) end;
select case when to_regclass('public.outbound_message_logs') is not null then 1 else (select 1/0) end;
select case when to_regclass('public.order_feedback') is not null then 1 else (select 1/0) end;
select case when to_regclass('public.complaints') is not null then 1 else (select 1/0) end;
select case when to_regclass('public.complaint_attachments') is not null then 1 else (select 1/0) end;
select case when to_regclass('public.complaint_events') is not null then 1 else (select 1/0) end;
select case when to_regclass('public.feedback_tokens') is not null then 1 else (select 1/0) end;
select case when to_regclass('public.order_contact_attempts') is not null then 1 else (select 1/0) end;

select case when to_regprocedure('public.create_feedback_token_for_order(uuid)') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.get_feedback_context(text)') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.submit_order_feedback(text,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean)') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.submit_public_complaint(text,text,text,text,text,boolean)') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.driver_feedback_summary()') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.merchant_order_feedback()') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.admin_order_feedback_rows()') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.admin_update_complaint(uuid,text,text,uuid,text,text)') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.admin_set_feedback_review(uuid,text,boolean)') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.admin_create_complaint_from_feedback(uuid,text)') is not null then 1 else (select 1/0) end;
select case when to_regprocedure('public.admin_suspend_driver_for_complaint(uuid,text)') is not null then 1 else (select 1/0) end;

select case when exists(
  select 1 from storage.buckets
  where id='complaint-attachments'
    and public=false
    and file_size_limit=8388608
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp','application/pdf']::text[]
) then 1 else (select 1/0) end as attachment_bucket_ok;

select case when exists(
  select 1 from pg_policies
  where schemaname='storage'
    and tablename='objects'
    and policyname='ce_complaint_storage_insert'
) then 1 else (select 1/0) end as attachment_policy_ok;

select case when exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='dn_ce_request_ip_hash'
    and pg_get_functiondef(p.oid) like '%hmac(%'
) then 1 else (select 1/0) end as salted_hash_ok;

select case when not exists(
  select 1
  from information_schema.role_column_grants
  where table_schema='public'
    and table_name='order_feedback'
    and grantee='authenticated'
    and column_name in ('customer_id','ip_hash','metadata')
    and privilege_type='SELECT'
) then 1 else (select 1/0) end as sensitive_columns_not_granted;

select case when exists(
  select 1
  from information_schema.role_column_grants
  where table_schema='public'
    and table_name='order_feedback'
    and grantee='authenticated'
    and column_name='overall_rating'
    and privilege_type='SELECT'
) then 1 else (select 1/0) end as safe_rating_columns_granted;

select case when (
  select count(*) from public.message_templates
  where language in ('ar','en') and channel='whatsapp'
) >= 30 then 1 else (select 1/0) end as seeded_templates_ok;

\echo 'DAY NIGHT Customer Experience PostgreSQL verification: PASS'
