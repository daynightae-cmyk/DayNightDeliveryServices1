-- DAY NIGHT DELIVERY SERVICES
-- Preserve strict merchant-order validation while allowing the explicitly
-- optional personal-order sender phone and detailed address fields.

begin;

create or replace function public.dn_admin_order_invalid_fields(p_payload jsonb)
returns text[]
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_invalid text[] := '{}';
  v_scope text := lower(btrim(coalesce(p_payload->>'shipping_scope', 'local')));
  v_source text := lower(btrim(coalesce(p_payload->>'source_channel', '')));
  v_personal_order boolean :=
    lower(btrim(coalesce(p_payload->>'source_channel', ''))) = 'admin_personal_order'
    and nullif(btrim(coalesce(p_payload->>'merchant_id', '')), '') is null;
  v_sender_name text := btrim(coalesce(p_payload->>'sender_name', p_payload->>'merchant_name', ''));
  v_receiver_city text := btrim(coalesce(p_payload->>'receiver_city', ''));
  v_destination text := btrim(coalesce(p_payload->>'destination_country', ''));
  v_weight numeric := nullif(p_payload->>'weight', '')::numeric;
begin
  if v_sender_name = '' or lower(v_sender_name) in ('day night merchant', 'unknown', 'n/a') then
    v_invalid := array_append(v_invalid, 'sender_name');
  end if;
  if not v_personal_order and btrim(coalesce(p_payload->>'sender_phone', '')) = '' then
    v_invalid := array_append(v_invalid, 'sender_phone');
  end if;
  if btrim(coalesce(p_payload->>'sender_city', '')) = '' then
    v_invalid := array_append(v_invalid, 'sender_city');
  end if;
  if not v_personal_order and btrim(coalesce(p_payload->>'sender_address', '')) = '' then
    v_invalid := array_append(v_invalid, 'sender_address');
  end if;
  if btrim(coalesce(p_payload->>'receiver_name', '')) = '' then
    v_invalid := array_append(v_invalid, 'receiver_name');
  end if;
  if btrim(coalesce(p_payload->>'receiver_phone', '')) = '' then
    v_invalid := array_append(v_invalid, 'receiver_phone');
  end if;
  if not v_personal_order and btrim(coalesce(p_payload->>'receiver_address', '')) = '' then
    v_invalid := array_append(v_invalid, 'receiver_address');
  end if;
  if v_receiver_city = '' or lower(v_receiver_city) in ('world', 'unknown', 'n/a') then
    v_invalid := array_append(v_invalid, 'receiver_city');
  end if;
  if btrim(coalesce(p_payload->>'package_type', p_payload->>'package_description', '')) = '' then
    v_invalid := array_append(v_invalid, 'package_type');
  end if;
  if btrim(coalesce(p_payload->>'payment_method', '')) = '' then
    v_invalid := array_append(v_invalid, 'payment_method');
  end if;

  if v_scope = 'international' or lower(coalesce(p_payload->>'service_type', '')) = 'international' then
    if v_destination = '' or lower(v_destination) in ('world', 'unknown', 'n/a') then
      v_invalid := array_append(v_invalid, 'destination_country');
    end if;
    if coalesce(v_weight, 0) <= 0 then
      v_invalid := array_append(v_invalid, 'weight');
    end if;
  end if;

  if coalesce(nullif(p_payload->>'pieces', '')::numeric, nullif(p_payload->>'order_count', '')::numeric, 0) <= 0 then
    v_invalid := array_append(v_invalid, 'pieces');
  end if;

  return array(select distinct field_name from unnest(v_invalid) as field_name order by field_name);
exception
  when invalid_text_representation then
    return array_append(v_invalid, 'numeric_format');
end;
$$;

select pg_notify('pgrst', 'reload schema');

commit;
