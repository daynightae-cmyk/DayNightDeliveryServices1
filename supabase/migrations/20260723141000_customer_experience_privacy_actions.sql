-- DAY NIGHT customer-experience privacy and administration actions.

begin;

alter table public.order_feedback
  add column if not exists review_status text not null default 'new';

alter table public.order_feedback
  drop constraint if exists order_feedback_review_status_check;

alter table public.order_feedback
  add constraint order_feedback_review_status_check
  check (review_status in ('new','reviewed','published','hidden','converted_to_complaint'));

-- Raw feedback rows are not exposed to drivers. Drivers receive aggregate summaries through a dedicated RPC.
drop policy if exists ce_feedback_admin_read on public.order_feedback;
create policy ce_feedback_scoped_read on public.order_feedback for select to authenticated
using (
  public.dn_ce_is_admin_or_support()
  or public.dn_ce_merchant_for_order(order_id)
  or customer_id = auth.uid()
);

create or replace function public.get_feedback_context(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
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
  select * into v_token
  from public.feedback_tokens
  where token_hash = digest(coalesce(p_token,''), 'sha256')
    and is_active = true
    and expires_at > now()
  order by created_at desc
  limit 1;
  if not found then raise exception 'feedback_token_invalid_or_expired'; end if;

  select * into v_order from public.orders where id = v_token.order_id;
  if not found then raise exception 'order_not_found'; end if;
  v_status := lower(coalesce(to_jsonb(v_order)->>'status',''));
  if v_status not in ('delivered','completed') then raise exception 'feedback_only_after_delivery'; end if;

  if v_order.merchant_id is not null then
    select * into v_merchant from public.merchants where id = v_order.merchant_id;
  end if;
  v_driver_id := coalesce(
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'assigned_driver_id'),
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'driver_id')
  );
  if v_driver_id is not null then
    select * into v_driver from public.driver_profiles where id = v_driver_id;
  end if;
  select exists(select 1 from public.order_feedback f where f.order_id = v_order.id) into v_existing;

  -- Deliberately excludes order_id, customer_id, merchant_id and driver_id.
  return jsonb_build_object(
    'ok', true,
    'tracking_number', public.dn_ce_tracking_reference(v_order),
    'delivered_at', coalesce(to_jsonb(v_order)->>'delivered_at', to_jsonb(v_order)->>'updated_at'),
    'service_type', to_jsonb(v_order)->>'service_type',
    'driver_name', coalesce(to_jsonb(v_order)->>'driver_name', to_jsonb(v_driver)->>'full_name', to_jsonb(v_driver)->>'name', 'مندوب داي نايت'),
    'merchant_name', coalesce(to_jsonb(v_merchant)->>'trade_name',''),
    'customer_name', coalesce(to_jsonb(v_order)->>'receiver_name',to_jsonb(v_order)->>'customer_name','عميل داي نايت'),
    'masked_phone', public.dn_ce_mask_phone(coalesce(to_jsonb(v_order)->>'receiver_phone',to_jsonb(v_order)->>'customer_phone','')),
    'locale', coalesce(to_jsonb(v_order)->>'preferred_language','ar'),
    'already_submitted', v_existing,
    'expires_at', v_token.expires_at
  );
end;
$$;

create or replace function public.driver_feedback_summary()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_driver public.driver_profiles%rowtype;
  v_summary jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_driver from public.driver_profiles where user_id = auth.uid() limit 1;
  if not found then raise exception 'driver_profile_not_found'; end if;

  select jsonb_build_object(
    'ok', true,
    'driver_id', v_driver.id,
    'rating_count', count(*),
    'average_driver_rating', coalesce(round(avg(driver_rating)::numeric,2),0),
    'average_punctuality', coalesce(round(avg(punctuality_rating)::numeric,2),0),
    'average_communication', coalesce(round(avg(communication_rating)::numeric,2),0),
    'average_professionalism', coalesce(round(avg(professionalism_rating)::numeric,2),0),
    'average_package_care', coalesce(round(avg(package_care_rating)::numeric,2),0),
    'recent_tags', coalesce((select to_jsonb(array_agg(tag)) from (
      select tag
      from public.order_feedback f2, unnest(f2.selected_tags) tag
      where f2.driver_id = v_driver.id
      group by tag
      order by count(*) desc
      limit 8
    ) ranked_tags),'[]'::jsonb)
  ) into v_summary
  from public.order_feedback f
  where f.driver_id = v_driver.id;

  return v_summary;
end;
$$;

create or replace function public.admin_set_feedback_review(
  p_feedback_id uuid,
  p_review_status text,
  p_allow_public_display boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text := lower(btrim(coalesce(p_review_status,'')));
  v_row public.order_feedback%rowtype;
begin
  if not public.dn_ce_is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_status not in ('new','reviewed','published','hidden','converted_to_complaint') then
    raise exception 'invalid_feedback_review_status';
  end if;
  update public.order_feedback
  set review_status = v_status,
      allow_public_display = case
        when v_status = 'published' then true
        when v_status = 'hidden' then false
        else coalesce(p_allow_public_display,allow_public_display)
      end,
      updated_at = now()
  where id = p_feedback_id
  returning * into v_row;
  if not found then raise exception 'feedback_not_found'; end if;
  perform public.dn_ce_audit('order_feedback','review',jsonb_build_object('feedback_id',p_feedback_id,'review_status',v_status));
  return to_jsonb(v_row) || jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_create_complaint_from_feedback(
  p_feedback_id uuid,
  p_severity text default 'medium'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_feedback public.order_feedback%rowtype;
  v_id uuid;
  v_number text;
  v_severity text := lower(btrim(coalesce(p_severity,'medium')));
begin
  if not public.dn_ce_is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_severity not in ('low','medium','high','critical') then raise exception 'invalid_complaint_severity'; end if;
  select * into v_feedback from public.order_feedback where id = p_feedback_id for update;
  if not found then raise exception 'feedback_not_found'; end if;

  select c.id, c.complaint_number into v_id, v_number
  from public.complaints c
  where c.metadata->>'source_feedback_id' = p_feedback_id::text
  limit 1;
  if found then return jsonb_build_object('ok',true,'id',v_id,'complaint_number',v_number,'already_exists',true); end if;

  v_number := 'DN-CMP-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.dn_complaint_number_seq')::text,5,'0');
  insert into public.complaints(
    complaint_number,order_id,tracking_number,complainant_type,customer_id,merchant_id,driver_id,
    category,severity,description,status,request_contact,metadata
  ) values (
    v_number,v_feedback.order_id,v_feedback.tracking_number,'customer',v_feedback.customer_id,v_feedback.merchant_id,v_feedback.driver_id,
    'other',v_severity,coalesce(nullif(v_feedback.comment,''),'Converted from a low customer rating'),'under_review',v_feedback.request_contact,
    jsonb_build_object('source','feedback_conversion','source_feedback_id',p_feedback_id)
  ) returning id into v_id;

  update public.order_feedback set review_status='converted_to_complaint',updated_at=now() where id=p_feedback_id;
  insert into public.complaint_events(complaint_id,event_type,new_status,note,created_by,metadata)
  values(v_id,'created_from_feedback','under_review','Converted from customer feedback',auth.uid(),jsonb_build_object('feedback_id',p_feedback_id));
  perform public.dn_ce_notify_admins(
    'تم تحويل تقييم إلى شكوى',
    'تم إنشاء الشكوى '||v_number||' من تقييم الشحنة '||v_feedback.tracking_number||'.',
    'complaint',
    jsonb_build_object('complaint_id',v_id,'complaint_number',v_number,'feedback_id',p_feedback_id,'route','/admin/customer-experience?tab=complaints&complaint='||v_id)
  );
  perform public.dn_ce_audit('complaint','create_from_feedback',jsonb_build_object('complaint_id',v_id,'feedback_id',p_feedback_id));
  return jsonb_build_object('ok',true,'id',v_id,'complaint_number',v_number,'already_exists',false);
end;
$$;

create or replace function public.admin_suspend_driver_for_complaint(
  p_complaint_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_complaint public.complaints%rowtype;
  v_count integer;
begin
  if not public.dn_ce_is_admin_or_support() then raise exception 'not_authorized'; end if;
  select * into v_complaint from public.complaints where id=p_complaint_id for update;
  if not found then raise exception 'complaint_not_found'; end if;
  if v_complaint.driver_id is null then raise exception 'complaint_has_no_driver'; end if;

  update public.driver_profiles
  set status='suspended',
      last_status_note=left(coalesce(nullif(btrim(p_note),''),'Suspended from complaint '||v_complaint.complaint_number),1000),
      updated_at=now()
  where id=v_complaint.driver_id;
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'driver_profile_not_found'; end if;

  insert into public.complaint_events(complaint_id,event_type,note,created_by,metadata)
  values(p_complaint_id,'driver_suspended',nullif(btrim(p_note),''),auth.uid(),jsonb_build_object('driver_id',v_complaint.driver_id));
  perform public.dn_ce_audit('driver_profile','suspend_from_complaint',jsonb_build_object('driver_id',v_complaint.driver_id,'complaint_id',p_complaint_id));
  return jsonb_build_object('ok',true,'driver_id',v_complaint.driver_id,'complaint_id',p_complaint_id);
end;
$$;

revoke all on function public.driver_feedback_summary() from public, anon;
revoke all on function public.admin_set_feedback_review(uuid,text,boolean) from public, anon;
revoke all on function public.admin_create_complaint_from_feedback(uuid,text) from public, anon;
revoke all on function public.admin_suspend_driver_for_complaint(uuid,text) from public, anon;

grant execute on function public.driver_feedback_summary() to authenticated;
grant execute on function public.admin_set_feedback_review(uuid,text,boolean) to authenticated;
grant execute on function public.admin_create_complaint_from_feedback(uuid,text) to authenticated;
grant execute on function public.admin_suspend_driver_for_complaint(uuid,text) to authenticated;

select pg_notify('pgrst','reload schema');

commit;
