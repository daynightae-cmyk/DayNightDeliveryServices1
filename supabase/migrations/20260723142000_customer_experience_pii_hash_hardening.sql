-- DAY NIGHT customer-experience minimal public PII and non-reversible request hashing.

begin;

alter table public.customer_experience_settings
  add column if not exists privacy_salt bytea not null default gen_random_bytes(32);

create or replace function public.dn_ce_request_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers jsonb := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  v_ip text;
  v_salt bytea;
begin
  v_ip := coalesce(
    nullif(split_part(coalesce(v_headers->>'x-forwarded-for',''), ',', 1), ''),
    nullif(v_headers->>'cf-connecting-ip', ''),
    'unknown'
  );
  select privacy_salt into v_salt
  from public.customer_experience_settings
  where id=true;
  if v_salt is null then
    v_salt := digest('DAY-NIGHT-CUSTOMER-EXPERIENCE-FALLBACK', 'sha256');
  end if;
  return encode(hmac(convert_to(v_ip,'UTF8'), v_salt, 'sha256'), 'hex');
end;
$$;

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
  where token_hash=digest(coalesce(p_token,''),'sha256')
    and is_active=true
    and expires_at>now()
  order by created_at desc
  limit 1;
  if not found then raise exception 'feedback_token_invalid_or_expired'; end if;

  select * into v_order from public.orders where id=v_token.order_id;
  if not found then raise exception 'order_not_found'; end if;
  v_status := lower(coalesce(to_jsonb(v_order)->>'status',''));
  if v_status not in ('delivered','completed') then raise exception 'feedback_only_after_delivery'; end if;

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
  select exists(select 1 from public.order_feedback f where f.order_id=v_order.id) into v_existing;

  -- No internal IDs, full customer name, phone number, addresses, COD amount or payment data.
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

revoke all on function public.dn_ce_request_ip_hash() from public;
revoke all on function public.get_feedback_context(text) from public;
grant execute on function public.dn_ce_request_ip_hash() to anon, authenticated;
grant execute on function public.get_feedback_context(text) to anon, authenticated;

select pg_notify('pgrst','reload schema');

commit;
