-- DAY NIGHT customer-experience final RLS, column privacy, storage and message-log hardening.

begin;

-- Merchant access is row-scoped and column-scoped. IP hashes, customer IDs and audit metadata remain inaccessible.
drop policy if exists ce_feedback_scoped_read on public.order_feedback;
drop policy if exists ce_feedback_admin_read on public.order_feedback;
drop policy if exists ce_feedback_admin_only_read on public.order_feedback;
create policy ce_feedback_admin_merchant_read on public.order_feedback for select to authenticated
using (
  public.dn_ce_is_admin_or_support()
  or public.dn_ce_merchant_for_order(order_id)
);

revoke select on public.order_feedback from authenticated;
grant select (
  id,order_id,tracking_number,merchant_id,driver_id,
  overall_rating,driver_rating,company_rating,punctuality_rating,communication_rating,
  professionalism_rating,package_care_rating,tracking_experience_rating,selected_tags,
  comment,allow_public_display,request_contact,submitted_at,updated_at,source,review_status
) on public.order_feedback to authenticated;

create or replace function public.admin_order_feedback_rows()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.dn_ce_is_admin_or_support() then raise exception 'not_authorized'; end if;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.submitted_at desc),'[]'::jsonb)
  into v_result
  from public.order_feedback f;
  return jsonb_build_object('ok',true,'feedback',v_result);
end;
$$;

create or replace function public.merchant_order_feedback()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant public.merchants%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_merchant from public.merchants where user_id=auth.uid() limit 1;
  if not found then raise exception 'merchant_profile_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'order_id', f.order_id,
    'tracking_number', f.tracking_number,
    'overall_rating', f.overall_rating,
    'driver_rating', f.driver_rating,
    'company_rating', f.company_rating,
    'punctuality_rating', f.punctuality_rating,
    'communication_rating', f.communication_rating,
    'professionalism_rating', f.professionalism_rating,
    'package_care_rating', f.package_care_rating,
    'tracking_experience_rating', f.tracking_experience_rating,
    'selected_tags', f.selected_tags,
    'comment', f.comment,
    'submitted_at', f.submitted_at,
    'review_status', f.review_status
  ) order by f.submitted_at desc),'[]'::jsonb)
  into v_result
  from public.order_feedback f
  where f.merchant_id=v_merchant.id;

  return jsonb_build_object('ok',true,'merchant_id',v_merchant.id,'feedback',v_result);
end;
$$;

create or replace function public.dn_ce_can_upload_complaint_attachment(
  p_complaint_id text,
  p_upload_nonce text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.complaints c
    where c.id::text=p_complaint_id
      and c.metadata->>'upload_nonce'=p_upload_nonce
      and c.created_at>now()-interval '30 minutes'
  );
$$;

-- Storage policy must not query an RLS-hidden complaint row directly as anon.
drop policy if exists ce_complaint_storage_insert on storage.objects;
create policy ce_complaint_storage_insert on storage.objects for insert to anon, authenticated
with check (
  bucket_id='complaint-attachments'
  and array_length(storage.foldername(name),1)>=3
  and public.dn_ce_can_upload_complaint_attachment(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);

create or replace function public.mark_outbound_message_status(p_log_id uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text := lower(coalesce(p_status,''));
  v_count integer;
  v_ip_hash text := public.dn_ce_request_ip_hash();
begin
  if v_status not in ('generated','opened','copied','failed') then raise exception 'invalid_message_status'; end if;
  update public.outbound_message_logs
  set status=v_status,
      opened_at=case when v_status='opened' then coalesce(opened_at,now()) else opened_at end,
      metadata=metadata||jsonb_build_object('last_status_at',now())
  where id=p_log_id
    and (
      public.dn_ce_is_admin_or_support()
      or generated_by=auth.uid()
      or (
        generated_by is null
        and coalesce(metadata->>'ip_hash','')=v_ip_hash
      )
    );
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',v_count=1,'updated',v_count);
end;
$$;

revoke all on function public.admin_order_feedback_rows() from public, anon;
revoke all on function public.merchant_order_feedback() from public, anon;
revoke all on function public.dn_ce_can_upload_complaint_attachment(text,text) from public;
revoke all on function public.mark_outbound_message_status(uuid,text) from public;

grant execute on function public.admin_order_feedback_rows() to authenticated;
grant execute on function public.merchant_order_feedback() to authenticated;
grant execute on function public.dn_ce_can_upload_complaint_attachment(text,text) to anon, authenticated;
grant execute on function public.mark_outbound_message_status(uuid,text) to anon, authenticated;

select pg_notify('pgrst','reload schema');

commit;
