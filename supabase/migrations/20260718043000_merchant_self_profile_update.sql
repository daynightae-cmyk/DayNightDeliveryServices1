-- DAY NIGHT DELIVERY SERVICES
-- Merchant self-service profile editing.
-- Allows an authenticated merchant to update only the approved business-profile fields.
-- Security-critical identity, status, pricing, commission, settlement and bank fields remain admin-managed.

begin;

create or replace function public.merchant_update_own_profile(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_phone text := regexp_replace(
    coalesce(
      auth.jwt() ->> 'phone',
      auth.jwt() #>> '{user_metadata,phone}',
      auth.jwt() #>> '{user_metadata,phone_number}',
      auth.jwt() #>> '{user_metadata,mobile}',
      ''
    ),
    '[^0-9]',
    '',
    'g'
  );
  v_merchant public.merchants%rowtype;
  v_trade_name text;
  v_owner_name text;
  v_primary_phone text;
  v_alt_phone text;
  v_emirate text;
  v_city text;
  v_address text;
  v_pickup_address text;
  v_logo_url text;
  v_license_number text;
  v_trn text;
  v_notes text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select m.*
    into v_merchant
  from public.merchants m
  where lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
    and (
      m.user_id = v_uid
      or (v_email <> '' and lower(coalesce(m.email, '')) = v_email)
      or (
        v_phone <> ''
        and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') = v_phone
      )
      or (
        v_phone <> ''
        and regexp_replace(coalesce(m.alt_phone, ''), '[^0-9]', '', 'g') = v_phone
      )
    )
  order by (m.user_id = v_uid) desc, m.updated_at desc nulls last, m.created_at desc nulls last
  limit 1
  for update;

  if v_merchant.id is null then
    raise exception 'merchant_profile_not_found';
  end if;

  v_trade_name := nullif(btrim(coalesce(p_updates ->> 'trade_name', '')), '');
  v_owner_name := nullif(btrim(coalesce(p_updates ->> 'owner_name', '')), '');
  v_primary_phone := nullif(btrim(coalesce(p_updates ->> 'phone', '')), '');
  v_alt_phone := nullif(btrim(coalesce(p_updates ->> 'alt_phone', '')), '');
  v_emirate := nullif(btrim(coalesce(p_updates ->> 'emirate', '')), '');
  v_city := nullif(btrim(coalesce(p_updates ->> 'city', '')), '');
  v_address := nullif(btrim(coalesce(p_updates ->> 'address', '')), '');
  v_pickup_address := nullif(btrim(coalesce(p_updates ->> 'pickup_address', '')), '');
  v_logo_url := nullif(btrim(coalesce(p_updates ->> 'logo_url', '')), '');
  v_license_number := nullif(btrim(coalesce(p_updates ->> 'license_number', '')), '');
  v_trn := nullif(btrim(coalesce(p_updates ->> 'trn', '')), '');
  v_notes := nullif(btrim(coalesce(p_updates ->> 'notes', '')), '');

  if v_trade_name is null then
    raise exception 'merchant_trade_name_required';
  end if;

  if v_primary_phone is null then
    raise exception 'merchant_phone_required';
  end if;

  if length(v_trade_name) > 160
    or length(coalesce(v_owner_name, '')) > 160
    or length(v_primary_phone) > 40
    or length(coalesce(v_alt_phone, '')) > 40
    or length(coalesce(v_emirate, '')) > 120
    or length(coalesce(v_city, '')) > 160
    or length(coalesce(v_address, '')) > 500
    or length(coalesce(v_pickup_address, '')) > 500
    or length(coalesce(v_logo_url, '')) > 1000
    or length(coalesce(v_license_number, '')) > 120
    or length(coalesce(v_trn, '')) > 120
    or length(coalesce(v_notes, '')) > 1200
  then
    raise exception 'merchant_profile_value_too_long';
  end if;

  if v_logo_url is not null and v_logo_url !~* '^https://[^[:space:]]+$' then
    raise exception 'invalid_logo_url';
  end if;

  update public.merchants
  set
    trade_name = v_trade_name,
    owner_name = v_owner_name,
    phone = v_primary_phone,
    alt_phone = v_alt_phone,
    emirate = v_emirate,
    city = v_city,
    address = v_address,
    pickup_address = v_pickup_address,
    logo_url = v_logo_url,
    license_number = v_license_number,
    trn = v_trn,
    notes = v_notes,
    user_id = coalesce(user_id, v_uid),
    updated_at = now()
  where id = v_merchant.id
  returning * into v_merchant;

  return jsonb_build_object(
    'ok', true,
    'updated_at', now(),
    'merchant', to_jsonb(v_merchant)
  );
end;
$$;

revoke all on function public.merchant_update_own_profile(jsonb) from public, anon;
grant execute on function public.merchant_update_own_profile(jsonb) to authenticated;

comment on function public.merchant_update_own_profile(jsonb) is
  'Updates the authenticated merchant business profile using an explicit safe-field allowlist.';

notify pgrst, 'reload schema';

commit;
