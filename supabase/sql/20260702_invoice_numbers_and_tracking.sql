-- DAY NIGHT DELIVERY SERVICES
-- Invoice numbers + tracking by invoice / tracking / phone
-- Apply this file in Supabase SQL Editor before final handover.

begin;

alter table public.orders
  add column if not exists invoice_number text;

create unique index if not exists orders_invoice_number_unique_idx
  on public.orders (invoice_number)
  where invoice_number is not null and invoice_number <> '';

create or replace function public.daynight_generate_invoice_number(
  p_reference text default null,
  p_created_at timestamptz default now()
)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_year text;
  v_seed text;
  v_hash text;
begin
  v_year := to_char(coalesce(p_created_at, now()), 'YYYY');
  v_seed := coalesce(nullif(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'), ''), md5(random()::text || clock_timestamp()::text));
  v_hash := upper(right(regexp_replace(v_seed, '^(DNINV|INV|DN)', '', 'i'), 12));
  if v_hash = '' then
    v_hash := upper(right(md5(random()::text || clock_timestamp()::text), 12));
  end if;
  return 'DN-INV-' || v_year || '-' || v_hash;
end;
$$;

create or replace function public.daynight_set_invoice_number()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    new.invoice_number := public.daynight_generate_invoice_number(
      coalesce(new.tracking_code, new.tracking_number, new.id::text),
      coalesce(new.created_at, now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_daynight_set_invoice_number on public.orders;
create trigger trg_daynight_set_invoice_number
before insert or update of tracking_code, tracking_number, invoice_number, created_at
on public.orders
for each row
execute function public.daynight_set_invoice_number();

update public.orders
set invoice_number = public.daynight_generate_invoice_number(
  coalesce(tracking_code, tracking_number, id::text),
  coalesce(created_at, now())
)
where invoice_number is null or btrim(invoice_number) = '';

create index if not exists orders_sender_phone_digits_idx
  on public.orders ((regexp_replace(coalesce(sender_phone, ''), '\D', '', 'g')));

create index if not exists orders_receiver_phone_digits_idx
  on public.orders ((regexp_replace(coalesce(receiver_phone, ''), '\D', '', 'g')));

create or replace function public.track_order(p_tracking_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ref text := btrim(coalesce(p_tracking_code, ''));
  v_order jsonb;
begin
  if v_ref = '' then
    return null;
  end if;

  select to_jsonb(o)
  into v_order
  from public.orders o
  where lower(coalesce(o.tracking_code, '')) = lower(v_ref)
     or lower(coalesce(o.tracking_number, '')) = lower(v_ref)
     or lower(coalesce(o.invoice_number, '')) = lower(v_ref)
     or o.id::text = v_ref
  order by coalesce(o.updated_at, o.created_at) desc nulls last
  limit 1;

  return v_order;
end;
$$;

create or replace function public.track_orders_by_phone(p_phone text, p_limit integer default 10)
returns setof jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 25);
begin
  if length(v_phone) < 7 then
    return;
  end if;

  return query
  select to_jsonb(o)
  from public.orders o
  where regexp_replace(coalesce(o.sender_phone, ''), '\D', '', 'g') like '%' || v_phone || '%'
     or regexp_replace(coalesce(o.receiver_phone, ''), '\D', '', 'g') like '%' || v_phone || '%'
     or regexp_replace(coalesce(to_jsonb(o)->>'customer_phone', ''), '\D', '', 'g') like '%' || v_phone || '%'
  order by coalesce(o.updated_at, o.created_at) desc nulls last
  limit v_limit;
end;
$$;

revoke all on function public.track_order(text) from public;
revoke all on function public.track_orders_by_phone(text, integer) from public;
revoke all on function public.daynight_generate_invoice_number(text, timestamptz) from public;

grant execute on function public.track_order(text) to anon, authenticated;
grant execute on function public.track_orders_by_phone(text, integer) to anon, authenticated;
grant execute on function public.daynight_generate_invoice_number(text, timestamptz) to authenticated;

commit;
