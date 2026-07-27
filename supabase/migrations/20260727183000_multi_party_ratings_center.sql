-- DAY NIGHT DELIVERY SERVICES
-- Secure multi-party ratings: customer, merchant and driver.
-- Keeps the legacy customer-feedback contract compatible while allowing one
-- independent rating from each party for the same delivered order.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.feedback_tokens
  add column if not exists rater_type text not null default 'customer',
  add column if not exists rater_id uuid,
  add column if not exists locale text not null default 'ar',
  add column if not exists target_scope jsonb not null default '{}'::jsonb;

alter table public.feedback_tokens
  drop constraint if exists feedback_tokens_rater_type_check;
alter table public.feedback_tokens
  add constraint feedback_tokens_rater_type_check
  check (rater_type in ('customer','merchant','driver'));

alter table public.feedback_tokens
  drop constraint if exists feedback_tokens_locale_check;
alter table public.feedback_tokens
  add constraint feedback_tokens_locale_check
  check (locale in ('ar','en'));

alter table public.order_feedback
  add column if not exists rater_type text not null default 'customer',
  add column if not exists rater_id uuid,
  add column if not exists merchant_rating smallint,
  add column if not exists customer_cooperation_rating smallint;

alter table public.order_feedback
  alter column driver_rating drop not null,
  alter column company_rating drop not null;

alter table public.order_feedback
  drop constraint if exists order_feedback_rater_type_check;
alter table public.order_feedback
  add constraint order_feedback_rater_type_check
  check (rater_type in ('customer','merchant','driver'));

alter table public.order_feedback
  drop constraint if exists order_feedback_merchant_rating_check;
alter table public.order_feedback
  add constraint order_feedback_merchant_rating_check
  check (merchant_rating is null or merchant_rating between 1 and 5);

alter table public.order_feedback
  drop constraint if exists order_feedback_customer_cooperation_rating_check;
alter table public.order_feedback
  add constraint order_feedback_customer_cooperation_rating_check
  check (customer_cooperation_rating is null or customer_cooperation_rating between 1 and 5);

alter table public.order_feedback
  drop constraint if exists order_feedback_order_id_key;
alter table public.order_feedback
  drop constraint if exists order_feedback_order_rater_uq;
alter table public.order_feedback
  add constraint order_feedback_order_rater_uq unique (order_id, rater_type);

create index if not exists feedback_tokens_order_rater_idx
  on public.feedback_tokens(order_id, rater_type, created_at desc);
create index if not exists order_feedback_rater_type_idx
  on public.order_feedback(rater_type, submitted_at desc);

create or replace function public.create_experience_rating_token_for_order(
  p_order_id uuid,
  p_rater_type text default 'customer',
  p_locale text default 'ar'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_rater_type text := lower(btrim(coalesce(p_rater_type,'customer')));
  v_locale text := case when lower(coalesce(p_locale,'ar')) like 'en%' then 'en' else 'ar' end;
  v_token text;
  v_days integer := 30;
  v_enabled boolean := true;
  v_rater_id uuid;
  v_driver_id uuid;
  v_targets jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_rater_type not in ('customer','merchant','driver') then raise exception 'invalid_rater_type'; end if;

  select * into v_order from public.orders where id=p_order_id;
  if not found then raise exception 'order_not_found'; end if;

  v_driver_id := coalesce(
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'assigned_driver_id'),
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'driver_id')
  );

  if v_rater_type='customer' then
    if not (
      public.dn_ce_is_admin_or_support()
      or public.dn_ce_driver_for_order(p_order_id)
      or public.dn_ce_merchant_for_order(p_order_id)
      or public.dn_ce_customer_for_order(p_order_id)
    ) then raise exception 'not_authorized'; end if;
    if public.dn_ce_customer_for_order(p_order_id) then v_rater_id := auth.uid(); end if;
    v_targets := jsonb_build_object('company',true,'driver',v_driver_id is not null,'merchant',false,'customer',false);
  elsif v_rater_type='merchant' then
    if not (public.dn_ce_is_admin_or_support() or public.dn_ce_merchant_for_order(p_order_id)) then
      raise exception 'not_authorized';
    end if;
    select m.id into v_rater_id from public.merchants m where m.user_id=auth.uid() limit 1;
    v_targets := jsonb_build_object('company',true,'driver',v_driver_id is not null,'merchant',false,'customer',false);
  else
    if not (public.dn_ce_is_admin_or_support() or public.dn_ce_driver_for_order(p_order_id)) then
      raise exception 'not_authorized';
    end if;
    select d.id into v_rater_id from public.driver_profiles d where d.user_id=auth.uid() limit 1;
    v_targets := jsonb_build_object('company',true,'driver',false,'merchant',v_order.merchant_id is not null,'customer',true);
  end if;

  select feedback_expiry_days,feedback_enabled into v_days,v_enabled
  from public.customer_experience_settings where id=true;
  if not coalesce(v_enabled,true) then raise exception 'feedback_disabled'; end if;

  v_token := encode(gen_random_bytes(32),'hex');
  insert into public.feedback_tokens(
    order_id,token_hash,expires_at,rater_type,rater_id,locale,target_scope
  ) values (
    p_order_id,extensions.digest(v_token,'sha256'),now()+make_interval(days=>coalesce(v_days,30)),
    v_rater_type,v_rater_id,v_locale,v_targets
  );

  perform public.dn_ce_audit(
    'feedback_token','create',
    jsonb_build_object('order_id',p_order_id,'rater_type',v_rater_type,'rater_id',v_rater_id)
  );

  return jsonb_build_object(
    'ok',true,
    'token',v_token,
    'url','https://www.daynightae.com/rate/'||v_token,
    'rater_type',v_rater_type,
    'targets',v_targets,
    'expires_at',now()+make_interval(days=>coalesce(v_days,30))
  );
end;
$$;

create or replace function public.create_feedback_token_for_order(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.create_experience_rating_token_for_order(p_order_id,'customer','ar');
$$;

create or replace function public.get_experience_rating_context(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_token public.feedback_tokens%rowtype;
  v_order public.orders%rowtype;
  v_merchant public.merchants%rowtype;
  v_driver public.driver_profiles%rowtype;
  v_driver_id uuid;
  v_status text;
  v_delivered boolean;
  v_existing boolean;
begin
  select * into v_token
  from public.feedback_tokens
  where token_hash=extensions.digest(coalesce(p_token,''),'sha256')
    and is_active and expires_at>now()
  order by created_at desc limit 1;
  if not found then raise exception 'feedback_token_invalid_or_expired'; end if;

  select * into v_order from public.orders where id=v_token.order_id;
  if not found then raise exception 'order_not_found'; end if;

  if v_order.merchant_id is not null then
    select * into v_merchant from public.merchants where id=v_order.merchant_id;
  end if;
  v_driver_id := coalesce(
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'assigned_driver_id'),
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'driver_id')
  );
  if v_driver_id is not null then
    select * into v_driver from public.driver_profiles where id=v_driver_id;
  end if;

  v_status := lower(replace(coalesce(to_jsonb(v_order)->>'status',''),'-','_'));
  v_delivered := v_status in ('delivered','completed','complete');
  select exists(
    select 1 from public.order_feedback f
    where f.order_id=v_order.id and f.rater_type=v_token.rater_type
  ) into v_existing;

  return jsonb_build_object(
    'ok',true,
    'tracking_number',public.dn_ce_tracking_reference(v_order),
    'order_status',v_status,
    'can_submit',v_delivered,
    'delivered_at',coalesce(to_jsonb(v_order)->>'delivered_at',to_jsonb(v_order)->>'updated_at'),
    'service_type',to_jsonb(v_order)->>'service_type',
    'driver_name',coalesce(to_jsonb(v_order)->>'driver_name',to_jsonb(v_driver)->>'full_name',to_jsonb(v_driver)->>'name','مندوب داي نايت'),
    'merchant_name',coalesce(to_jsonb(v_merchant)->>'trade_name',''),
    'customer_name',coalesce(to_jsonb(v_order)->>'receiver_name',to_jsonb(v_order)->>'customer_name','عميل داي نايت'),
    'masked_phone',public.dn_ce_mask_phone(coalesce(to_jsonb(v_order)->>'receiver_phone',to_jsonb(v_order)->>'customer_phone','')),
    'locale',coalesce(v_token.locale,'ar'),
    'rater_type',coalesce(v_token.rater_type,'customer'),
    'targets',coalesce(v_token.target_scope,'{}'::jsonb),
    'already_submitted',v_existing,
    'expires_at',v_token.expires_at
  );
end;
$$;

create or replace function public.get_feedback_context(p_token text)
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select public.get_experience_rating_context(p_token);
$$;

create or replace function public.submit_experience_rating(
  p_token text,
  p_overall_rating integer,
  p_company_rating integer,
  p_driver_rating integer,
  p_merchant_rating integer,
  p_customer_cooperation_rating integer,
  p_punctuality_rating integer,
  p_communication_rating integer,
  p_professionalism_rating integer,
  p_package_care_rating integer,
  p_tracking_experience_rating integer,
  p_selected_tags text[],
  p_comment text,
  p_allow_public_display boolean,
  p_request_contact boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_token public.feedback_tokens%rowtype;
  v_order public.orders%rowtype;
  v_feedback_id uuid;
  v_driver_id uuid;
  v_tracking text;
  v_status text;
  v_comment text := nullif(btrim(coalesce(p_comment,'')),'');
  v_rater_type text;
  v_company integer;
  v_driver integer;
  v_merchant integer;
  v_customer integer;
begin
  if p_overall_rating not between 1 and 5 then raise exception 'rating_out_of_range'; end if;
  if length(coalesce(v_comment,''))>2000 then raise exception 'comment_too_long'; end if;

  select * into v_token
  from public.feedback_tokens
  where token_hash=extensions.digest(coalesce(p_token,''),'sha256')
    and is_active and expires_at>now()
  order by created_at desc limit 1;
  if not found then raise exception 'feedback_token_invalid_or_expired'; end if;

  select * into v_order from public.orders where id=v_token.order_id;
  if not found then raise exception 'order_not_found'; end if;
  v_status := lower(replace(coalesce(to_jsonb(v_order)->>'status',''),'-','_'));
  if v_status not in ('delivered','completed','complete') then raise exception 'feedback_only_after_delivery'; end if;

  v_rater_type := coalesce(v_token.rater_type,'customer');
  v_company := case when p_company_rating between 1 and 5 then p_company_rating else null end;
  v_driver := case when p_driver_rating between 1 and 5 then p_driver_rating else null end;
  v_merchant := case when p_merchant_rating between 1 and 5 then p_merchant_rating else null end;
  v_customer := case when p_customer_cooperation_rating between 1 and 5 then p_customer_cooperation_rating else null end;

  if v_rater_type in ('customer','merchant') and v_company is null then raise exception 'company_rating_required'; end if;
  if v_rater_type in ('customer','merchant')
     and coalesce(public.dn_ce_try_uuid(to_jsonb(v_order)->>'assigned_driver_id'),public.dn_ce_try_uuid(to_jsonb(v_order)->>'driver_id')) is not null
     and v_driver is null then raise exception 'driver_rating_required'; end if;
  if v_rater_type='driver' and v_company is null then raise exception 'company_rating_required'; end if;
  if v_rater_type='driver' and v_order.merchant_id is not null and v_merchant is null then raise exception 'merchant_rating_required'; end if;
  if v_rater_type='driver' and v_customer is null then raise exception 'customer_cooperation_rating_required'; end if;

  v_tracking := public.dn_ce_tracking_reference(v_order);
  v_driver_id := coalesce(
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'assigned_driver_id'),
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'driver_id')
  );

  insert into public.order_feedback(
    order_id,tracking_number,customer_id,merchant_id,driver_id,rater_type,rater_id,
    overall_rating,driver_rating,company_rating,merchant_rating,customer_cooperation_rating,
    punctuality_rating,communication_rating,professionalism_rating,package_care_rating,
    tracking_experience_rating,selected_tags,comment,allow_public_display,request_contact,
    source,ip_hash,metadata
  ) values (
    v_order.id,v_tracking,
    case when v_rater_type='customer' then coalesce(v_token.rater_id,public.dn_ce_try_uuid(to_jsonb(v_order)->>'customer_id')) else public.dn_ce_try_uuid(to_jsonb(v_order)->>'customer_id') end,
    v_order.merchant_id,v_driver_id,v_rater_type,v_token.rater_id,
    p_overall_rating,v_driver,v_company,v_merchant,v_customer,
    case when p_punctuality_rating between 1 and 5 then p_punctuality_rating else null end,
    case when p_communication_rating between 1 and 5 then p_communication_rating else null end,
    case when p_professionalism_rating between 1 and 5 then p_professionalism_rating else null end,
    case when p_package_care_rating between 1 and 5 then p_package_care_rating else null end,
    case when p_tracking_experience_rating between 1 and 5 then p_tracking_experience_rating else null end,
    coalesce(p_selected_tags,'{}'),v_comment,coalesce(p_allow_public_display,false),coalesce(p_request_contact,false),
    'multi_party_rating',public.dn_ce_request_ip_hash(),
    jsonb_build_object('token_id',v_token.id,'rater_type',v_rater_type,'user_agent',(coalesce(current_setting('request.headers',true),'{}')::jsonb)->>'user-agent')
  )
  on conflict (order_id,rater_type) do update set
    rater_id=excluded.rater_id,
    overall_rating=excluded.overall_rating,
    driver_rating=excluded.driver_rating,
    company_rating=excluded.company_rating,
    merchant_rating=excluded.merchant_rating,
    customer_cooperation_rating=excluded.customer_cooperation_rating,
    punctuality_rating=excluded.punctuality_rating,
    communication_rating=excluded.communication_rating,
    professionalism_rating=excluded.professionalism_rating,
    package_care_rating=excluded.package_care_rating,
    tracking_experience_rating=excluded.tracking_experience_rating,
    selected_tags=excluded.selected_tags,
    comment=excluded.comment,
    allow_public_display=excluded.allow_public_display,
    request_contact=excluded.request_contact,
    updated_at=now(),
    ip_hash=excluded.ip_hash,
    metadata=public.order_feedback.metadata||excluded.metadata
  returning id into v_feedback_id;

  update public.feedback_tokens set used_at=coalesce(used_at,now()) where id=v_token.id;

  perform public.dn_ce_notify_admins(
    'تقييم جديد للطلب '||v_tracking,
    'وصل تقييم '||v_rater_type||' بدرجة '||p_overall_rating||' نجوم للطلب '||v_tracking||'.',
    'customer_feedback',
    jsonb_build_object('feedback_id',v_feedback_id,'order_id',v_order.id,'tracking_number',v_tracking,'rating',p_overall_rating,'rater_type',v_rater_type,'route','/admin?cx=ratings&tab=ratings')
  );
  perform public.dn_ce_audit('order_feedback','submit',jsonb_build_object('feedback_id',v_feedback_id,'order_id',v_order.id,'rating',p_overall_rating,'rater_type',v_rater_type));

  return jsonb_build_object('ok',true,'feedback_id',v_feedback_id,'tracking_number',v_tracking,'rater_type',v_rater_type);
end;
$$;

create or replace function public.submit_order_feedback(
  p_token text,
  p_overall_rating integer,
  p_driver_rating integer,
  p_company_rating integer,
  p_punctuality_rating integer,
  p_communication_rating integer,
  p_professionalism_rating integer,
  p_package_care_rating integer,
  p_tracking_experience_rating integer,
  p_selected_tags text[],
  p_comment text,
  p_allow_public_display boolean,
  p_request_contact boolean
)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.submit_experience_rating(
    p_token,p_overall_rating,p_company_rating,p_driver_rating,null,null,
    p_punctuality_rating,p_communication_rating,p_professionalism_rating,
    p_package_care_rating,p_tracking_experience_rating,p_selected_tags,p_comment,
    p_allow_public_display,p_request_contact
  );
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
  select * into v_driver from public.driver_profiles where user_id=auth.uid() limit 1;
  if not found then raise exception 'driver_profile_not_found'; end if;

  select jsonb_build_object(
    'ok',true,
    'driver_id',v_driver.id,
    'rating_count',count(*) filter (where driver_rating is not null),
    'average_driver_rating',coalesce(round(avg(driver_rating)::numeric,2),0),
    'average_punctuality',coalesce(round(avg(punctuality_rating)::numeric,2),0),
    'average_communication',coalesce(round(avg(communication_rating)::numeric,2),0),
    'average_professionalism',coalesce(round(avg(professionalism_rating)::numeric,2),0),
    'average_package_care',coalesce(round(avg(package_care_rating)::numeric,2),0),
    'recent_tags',coalesce((select to_jsonb(array_agg(tag)) from (
      select tag from public.order_feedback f2,unnest(f2.selected_tags) tag
      where f2.driver_id=v_driver.id and f2.rater_type in ('customer','merchant')
      group by tag order by count(*) desc limit 8
    ) ranked_tags),'[]'::jsonb)
  ) into v_summary
  from public.order_feedback f
  where f.driver_id=v_driver.id and f.rater_type in ('customer','merchant');
  return v_summary;
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
    'id',f.id,'order_id',f.order_id,'tracking_number',f.tracking_number,
    'rater_type',f.rater_type,'overall_rating',f.overall_rating,'driver_rating',f.driver_rating,
    'company_rating',f.company_rating,'punctuality_rating',f.punctuality_rating,
    'communication_rating',f.communication_rating,'professionalism_rating',f.professionalism_rating,
    'package_care_rating',f.package_care_rating,'tracking_experience_rating',f.tracking_experience_rating,
    'selected_tags',f.selected_tags,'comment',f.comment,'submitted_at',f.submitted_at,
    'review_status',f.review_status
  ) order by f.submitted_at desc),'[]'::jsonb)
  into v_result
  from public.order_feedback f
  where f.merchant_id=v_merchant.id and f.rater_type='customer';

  return jsonb_build_object('ok',true,'merchant_id',v_merchant.id,'feedback',v_result);
end;
$$;

create or replace function public.multi_party_ratings_health()
returns jsonb
language sql
security definer
stable
set search_path = public,auth,pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.create_experience_rating_token_for_order(uuid,text,text)') is not null
      and to_regprocedure('public.get_experience_rating_context(text)') is not null
      and to_regprocedure('public.submit_experience_rating(text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean)') is not null,
    'customer_ratings',true,
    'merchant_ratings',true,
    'driver_ratings',true,
    'checked_at',now()
  );
$$;

revoke all on function public.create_experience_rating_token_for_order(uuid,text,text) from public,anon;
revoke all on function public.get_experience_rating_context(text) from public;
revoke all on function public.submit_experience_rating(text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean) from public;
revoke all on function public.multi_party_ratings_health() from public,anon;

grant execute on function public.create_experience_rating_token_for_order(uuid,text,text) to authenticated;
grant execute on function public.get_experience_rating_context(text) to anon,authenticated;
grant execute on function public.submit_experience_rating(text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean) to anon,authenticated;
grant execute on function public.multi_party_ratings_health() to authenticated;

grant execute on function public.create_feedback_token_for_order(uuid) to authenticated;
grant execute on function public.get_feedback_context(text) to anon,authenticated;
grant execute on function public.submit_order_feedback(text,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean) to anon,authenticated;
grant execute on function public.driver_feedback_summary() to authenticated;
grant execute on function public.merchant_order_feedback() to authenticated;

select pg_notify('pgrst','reload schema');

commit;
