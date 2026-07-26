-- DAY NIGHT DELIVERY SERVICES
-- Safe biometric/passkey audit events. No credential, token, password, WebAuthn
-- challenge, or encrypted session material is accepted by this schema.

begin;

create table if not exists public.auth_security_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'passkey_registered',
    'passkey_removed',
    'biometric_enabled',
    'biometric_disabled',
    'biometric_login_success',
    'biometric_login_failed',
    'biometric_session_revoked'
  )),
  expected_role text null check (expected_role is null or expected_role in ('driver', 'merchant', 'admin')),
  package_id text null check (package_id is null or package_id in (
    'com.daynightae.driver',
    'com.daynightae.merchant',
    'com.daynightae.admin',
    'web'
  )),
  success boolean not null default true,
  reason text null check (reason is null or length(reason) <= 180),
  created_at timestamptz not null default now()
);

create index if not exists auth_security_audit_actor_created_idx
  on public.auth_security_audit(actor_user_id, created_at desc);
create index if not exists auth_security_audit_event_created_idx
  on public.auth_security_audit(event_type, created_at desc);

alter table public.auth_security_audit enable row level security;

revoke all on table public.auth_security_audit from public, anon;
grant select on table public.auth_security_audit to authenticated;

 drop policy if exists auth_security_audit_read_own_or_admin on public.auth_security_audit;
create policy auth_security_audit_read_own_or_admin
on public.auth_security_audit
for select
to authenticated
using (
  actor_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  )
);

create or replace function public.record_auth_security_event(
  p_event_type text,
  p_role text default null,
  p_package_id text default null,
  p_success boolean default true,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_event text := lower(btrim(coalesce(p_event_type, '')));
  v_role text := nullif(lower(btrim(coalesce(p_role, ''))), '');
  v_package text := nullif(btrim(coalesce(p_package_id, '')), '');
  v_reason text := nullif(left(regexp_replace(coalesce(p_reason, ''), '[\r\n\t]+', ' ', 'g'), 180), '');
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;

  if v_event not in (
    'passkey_registered',
    'passkey_removed',
    'biometric_enabled',
    'biometric_disabled',
    'biometric_login_success',
    'biometric_login_failed',
    'biometric_session_revoked'
  ) then
    raise exception 'invalid_security_event';
  end if;

  if v_role is not null and v_role not in ('driver', 'merchant', 'admin') then
    raise exception 'invalid_security_role';
  end if;

  if v_package is not null and v_package not in (
    'com.daynightae.driver',
    'com.daynightae.merchant',
    'com.daynightae.admin',
    'web'
  ) then
    raise exception 'invalid_security_package';
  end if;

  insert into public.auth_security_audit (
    actor_user_id,
    event_type,
    expected_role,
    package_id,
    success,
    reason
  ) values (
    v_actor,
    v_event,
    v_role,
    v_package,
    coalesce(p_success, true),
    v_reason
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_auth_security_event(text, text, text, boolean, text)
from public, anon;
grant execute on function public.record_auth_security_event(text, text, text, boolean, text)
to authenticated;

notify pgrst, 'reload schema';

commit;
