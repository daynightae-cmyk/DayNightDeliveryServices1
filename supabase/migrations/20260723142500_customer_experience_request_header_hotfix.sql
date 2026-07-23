-- DAY NIGHT Customer Experience request-header parsing hotfix.

begin;

create or replace function public.dn_ce_request_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
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
    v_salt := extensions.digest('DAY-NIGHT-CUSTOMER-EXPERIENCE-FALLBACK'::text, 'sha256'::text);
  end if;
  return encode(
    extensions.hmac(convert_to(v_ip,'UTF8'), v_salt, 'sha256'::text),
    'hex'
  );
end;
$$;

revoke all on function public.dn_ce_request_ip_hash() from public;
grant execute on function public.dn_ce_request_ip_hash() to anon, authenticated;

select pg_notify('pgrst','reload schema');

commit;
