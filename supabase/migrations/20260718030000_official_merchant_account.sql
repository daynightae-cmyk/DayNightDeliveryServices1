-- DAY NIGHT DELIVERY SERVICES
-- Official merchant portal account linkage.
-- Passwords are intentionally never stored in GitHub or SQL migrations.

begin;

alter table public.merchants
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_merchants_user_id on public.merchants(user_id);
create index if not exists idx_merchants_email_lower on public.merchants((lower(coalesce(email, ''))));

insert into public.merchants (
  merchant_code,
  trade_name,
  owner_name,
  phone,
  email,
  emirate,
  city,
  address,
  pickup_address,
  settlement_cycle,
  commission_type,
  default_payment_method,
  status,
  notes
)
values (
  'DN-MERCHANT-OFFICIAL',
  'DAY NIGHT Merchant',
  'DAY NIGHT DELIVERY SERVICES',
  '+971568757331',
  'merchant@daynightae.com',
  'Abu Dhabi',
  'Mussafah',
  'UAE — Abu Dhabi — Mussafah 40',
  'UAE — Abu Dhabi — Mussafah 40',
  'weekly',
  'fixed_delivery_fee',
  'sender_pays',
  'active',
  'Official DAY NIGHT merchant portal account'
)
on conflict (merchant_code) do update set
  trade_name = excluded.trade_name,
  owner_name = excluded.owner_name,
  phone = excluded.phone,
  email = excluded.email,
  emirate = excluded.emirate,
  city = excluded.city,
  address = excluded.address,
  pickup_address = excluded.pickup_address,
  settlement_cycle = excluded.settlement_cycle,
  commission_type = excluded.commission_type,
  default_payment_method = excluded.default_payment_method,
  status = 'active',
  notes = excluded.notes,
  updated_at = now();

update public.merchants m
set user_id = u.id,
    status = 'active',
    updated_at = now()
from auth.users u
where lower(coalesce(u.email, '')) = 'merchant@daynightae.com'
  and m.merchant_code = 'DN-MERCHANT-OFFICIAL';

create or replace function public.merchant_claim_approved_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_merchant public.merchants%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_email <> 'merchant@daynightae.com' then
    raise exception 'merchant_account_not_approved';
  end if;

  update public.merchants
  set user_id = v_uid,
      status = 'active',
      updated_at = now()
  where merchant_code = 'DN-MERCHANT-OFFICIAL'
  returning * into v_merchant;

  if v_merchant.id is null then
    raise exception 'merchant_record_missing';
  end if;

  return jsonb_build_object(
    'ok', true,
    'merchant', to_jsonb(v_merchant),
    'linked_user_id', v_uid
  );
end;
$$;

revoke all on function public.merchant_claim_approved_account() from public, anon;
grant execute on function public.merchant_claim_approved_account() to authenticated;

notify pgrst, 'reload schema';

commit;
