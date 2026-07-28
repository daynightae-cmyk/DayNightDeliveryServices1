-- DAY NIGHT DELIVERY SERVICES
-- Final authoritative local pricing and audited manual-delivery correction.
--
-- Rules:
--   * Al Ain and all Al Ain districts: 25 AED.
--   * Remote Al Dhafra / Western Region routes: 50 AED.
--   * A positive manual delivery fee is stored exactly as entered.
--   * An explicitly entered manual fee of zero means the official 25 AED fee
--     is deducted from the merchant; it never means free delivery.
--   * Delivered financials remain locked except through the audited admin RPC.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.orders
  add column if not exists manual_delivery_price numeric(14,2),
  add column if not exists price_source text,
  add column if not exists financial_adjusted_at timestamptz,
  add column if not exists financial_adjusted_by uuid,
  add column if not exists financial_adjustment_reason text;

create or replace function public.daynight_is_extended_coverage(p_value text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_value text := lower(
    regexp_replace(
      translate(coalesce(p_value, ''), '‐‑‒–—_', '------'),
      '\s+',
      ' ',
      'g'
    )
  );
begin
  -- Al Ain is a normal 25 AED city, including every district written after it.
  if v_value ~ '(al[ _-]?ain|العين)' then
    return false;
  end if;

  -- Only remote Western Region / Al Dhafra routes remain at 50 AED.
  if v_value ~ '(western region|al[ _-]?dhafra|dhafra|al[ _-]?ruwais|ruwais|al[ _-]?dhannah|dhannah|liwa|ghayathi|sila|al[ _-]?mirfa|mirfa|madinat zayed|bada mutawa|baynouna|habshan|hamim|asab|shuweihat|barakah|dalma|المنطقة الغربية|الغربية|الظفرة|الرويس|الظنة|ليوا|غياثي|السلع|المرفأ|مدينة زايد|بدع مطوع|بينونة|حبشان|حَمِيم|عصب|شويهات|براكة|دلما)' then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.daynight_official_local_delivery_fee(
  p_from_city text,
  p_to_city text
)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when public.daynight_is_extended_coverage(p_from_city)
      or public.daynight_is_extended_coverage(p_to_city)
      then 50::numeric
    else 25::numeric
  end;
$$;

revoke all on function public.daynight_is_extended_coverage(text) from public;
revoke all on function public.daynight_official_local_delivery_fee(text, text) from public;
grant execute on function public.daynight_is_extended_coverage(text) to anon, authenticated;
grant execute on function public.daynight_official_local_delivery_fee(text, text) to anon, authenticated;

create table if not exists public.order_financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid not null,
  reason text not null,
  before_data jsonb not null,
  after_data jsonb not null,
  delta_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists order_financial_adjustments_order_idx
  on public.order_financial_adjustments(order_id, created_at desc);
create index if not exists order_financial_adjustments_actor_idx
  on public.order_financial_adjustments(actor_id, created_at desc);

alter table public.order_financial_adjustments enable row level security;

create or replace function public.daynight_admin_or_support()
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.role::text) in ('admin', 'support')
  );
$$;

revoke all on function public.daynight_admin_or_support() from public, anon;
grant execute on function public.daynight_admin_or_support() to authenticated;

drop policy if exists order_financial_adjustments_admin_select
  on public.order_financial_adjustments;
create policy order_financial_adjustments_admin_select
  on public.order_financial_adjustments
  for select
  to authenticated
  using (public.daynight_admin_or_support());

-- Keep delivered orders protected, but permit one auditable admin/support path.
create or replace function public.daynight_normalize_financial_order()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text;
  v_old_status text;
  v_breakdown jsonb;
  v_financial_changed boolean := false;
  v_audited_adjustment boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_financial_changed :=
      new.goods_value is distinct from old.goods_value
      or new.delivery_fee is distinct from old.delivery_fee
      or new.discount_amount is distinct from old.discount_amount
      or new.delivery_fee_mode is distinct from old.delivery_fee_mode
      or new.customer_total is distinct from old.customer_total
      or new.merchant_due is distinct from old.merchant_due
      or new.company_revenue is distinct from old.company_revenue;

    v_audited_adjustment :=
      old.financial_posted_at is not null
      and auth.uid() is not null
      and new.financial_adjusted_by = auth.uid()
      and new.financial_adjusted_at is not null
      and length(btrim(coalesce(new.financial_adjustment_reason, ''))) >= 6
      and public.daynight_admin_or_support();

    if old.financial_posted_at is not null
       and v_financial_changed
       and not v_audited_adjustment then
      raise exception 'financials_locked_after_delivery';
    end if;
  end if;

  if coalesce(new.delivery_fee, 0) = 0
     and coalesce(new.delivery_price, 0) > 0 then
    new.delivery_fee := round(new.delivery_price::numeric, 2);
  end if;

  v_breakdown := public.daynight_calculate_order_financials(
    new.goods_value,
    new.delivery_fee,
    new.discount_amount,
    new.delivery_fee_mode
  );

  new.goods_value := (v_breakdown ->> 'goods_value')::numeric;
  new.delivery_fee := (v_breakdown ->> 'delivery_fee')::numeric;
  new.discount_amount := (v_breakdown ->> 'discount_amount')::numeric;
  new.delivery_fee_mode := v_breakdown ->> 'delivery_fee_mode';
  new.customer_total := (v_breakdown ->> 'customer_total')::numeric;
  new.merchant_due := (v_breakdown ->> 'merchant_due')::numeric;
  new.company_revenue := (v_breakdown ->> 'company_revenue')::numeric;

  if tg_op = 'UPDATE' and v_audited_adjustment then
    new.financial_version := greatest(
      coalesce(new.financial_version, 1),
      coalesce(old.financial_version, 1) + 1
    );
  else
    new.financial_version := coalesce(new.financial_version, 1);
  end if;

  new.delivery_price := new.delivery_fee;
  new.base_price := new.delivery_fee;
  new.subtotal := new.customer_total;
  new.total := new.customer_total;
  new.total_price := new.customer_total;
  new.amount := new.customer_total;
  new.price := new.customer_total;

  if lower(coalesce(new.payment_method::text, '')) in ('cod', 'cash', 'receiver_pays') then
    new.cod_amount := new.customer_total;
  elsif lower(coalesce(new.payment_method::text, '')) in ('prepaid', 'card', 'bank_transfer', 'wallet') then
    new.cod_amount := 0;
  end if;

  v_status := lower(replace(coalesce(new.status::text, 'pending'), '-', '_'));
  v_old_status := case
    when tg_op = 'UPDATE'
      then lower(replace(coalesce(old.status::text, ''), '-', '_'))
    else ''
  end;

  if v_status in ('delivered', 'completed', 'complete')
     and v_old_status not in ('delivered', 'completed', 'complete') then
    new.collected_amount := new.customer_total;
    new.financial_posted_at := coalesce(new.financial_posted_at, now());
  end if;

  if tg_op = 'UPDATE'
     and v_audited_adjustment
     and v_status in ('delivered', 'completed', 'complete') then
    new.collected_amount := new.customer_total;
    new.financial_posted_at := coalesce(old.financial_posted_at, new.financial_posted_at, now());
  end if;

  return new;
end;
$$;

-- Synchronize posted statements when an audited correction changes a delivered order.
create or replace function public.daynight_post_delivered_financials()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text := lower(replace(coalesce(new.status::text, ''), '-', '_'));
  v_reference text := coalesce(
    nullif(new.tracking_number, ''),
    nullif(new.invoice_number, ''),
    nullif(new.coupon_number, ''),
    new.id::text
  );
  v_merchant_direction text;
  v_merchant_amount numeric(14,2);
begin
  if v_status not in ('delivered', 'completed', 'complete')
     or new.financial_posted_at is null then
    return new;
  end if;

  insert into public.order_financial_settlements (
    order_id,
    order_reference,
    merchant_id,
    coupon_number,
    goods_value,
    delivery_fee,
    discount_amount,
    delivery_fee_mode,
    customer_total,
    collected_amount,
    merchant_due,
    company_revenue,
    currency,
    posted_at,
    posted_by,
    source_status,
    snapshot
  ) values (
    new.id::text,
    v_reference,
    new.merchant_id,
    new.coupon_number,
    new.goods_value,
    new.delivery_fee,
    new.discount_amount,
    new.delivery_fee_mode,
    new.customer_total,
    new.collected_amount,
    new.merchant_due,
    new.company_revenue,
    coalesce(new.currency, 'AED'),
    new.financial_posted_at,
    auth.uid(),
    v_status,
    to_jsonb(new)
  )
  on conflict (order_id)
  do update set
    order_reference = excluded.order_reference,
    merchant_id = excluded.merchant_id,
    coupon_number = excluded.coupon_number,
    goods_value = excluded.goods_value,
    delivery_fee = excluded.delivery_fee,
    discount_amount = excluded.discount_amount,
    delivery_fee_mode = excluded.delivery_fee_mode,
    customer_total = excluded.customer_total,
    collected_amount = excluded.collected_amount,
    merchant_due = excluded.merchant_due,
    company_revenue = excluded.company_revenue,
    currency = excluded.currency,
    source_status = excluded.source_status,
    snapshot = excluded.snapshot;

  v_merchant_direction := case when new.merchant_due < 0 then 'debit' else 'credit' end;
  v_merchant_amount := abs(new.merchant_due);

  insert into public.financial_account_entries (
    order_id,
    order_reference,
    merchant_id,
    account_type,
    entry_type,
    direction,
    amount,
    currency,
    notes,
    posted_at
  ) values (
    new.id::text,
    v_reference,
    new.merchant_id,
    'merchant',
    'delivered_order_settlement',
    v_merchant_direction,
    v_merchant_amount,
    coalesce(new.currency, 'AED'),
    'Merchant due after audited financial correction',
    new.financial_posted_at
  )
  on conflict (order_id, account_type, entry_type)
  do update set
    order_reference = excluded.order_reference,
    merchant_id = excluded.merchant_id,
    direction = excluded.direction,
    amount = excluded.amount,
    currency = excluded.currency,
    notes = excluded.notes;

  insert into public.financial_account_entries (
    order_id,
    order_reference,
    merchant_id,
    account_type,
    entry_type,
    direction,
    amount,
    currency,
    notes,
    posted_at
  ) values (
    new.id::text,
    v_reference,
    new.merchant_id,
    'company',
    'delivered_order_settlement',
    'credit',
    new.company_revenue,
    coalesce(new.currency, 'AED'),
    'DAY NIGHT revenue after audited financial correction',
    new.financial_posted_at
  )
  on conflict (order_id, account_type, entry_type)
  do update set
    order_reference = excluded.order_reference,
    merchant_id = excluded.merchant_id,
    direction = excluded.direction,
    amount = excluded.amount,
    currency = excluded.currency,
    notes = excluded.notes;

  return new;
end;
$$;

create or replace function public.admin_adjust_order_financials_verified(
  p_order_id uuid,
  p_goods_value numeric,
  p_delivery_fee numeric,
  p_discount_amount numeric default 0,
  p_delivery_fee_mode text default 'customer_pays',
  p_payment_method text default 'cod',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_adjustment_id uuid;
  v_cast_row public.orders%rowtype;

  v_goods numeric(14,2) := round(coalesce(p_goods_value, 0)::numeric, 2);
  v_entered_delivery numeric(14,2) := round(coalesce(p_delivery_fee, 0)::numeric, 2);
  v_effective_delivery numeric(14,2);
  v_discount numeric(14,2) := round(coalesce(p_discount_amount, 0)::numeric, 2);

  v_mode text := lower(replace(btrim(coalesce(p_delivery_fee_mode, 'customer_pays')), '-', '_'));
  v_payment text := lower(replace(btrim(coalesce(p_payment_method, 'cod')), '-', '_'));
  v_payment_db text;
  v_existing_payment text;
  v_payment_type_oid oid;
  v_payment_type_kind "char";
  v_payment_candidates text[];

  v_reason text := btrim(coalesce(p_reason, ''));
  v_customer_total numeric(14,2);
  v_merchant_due numeric(14,2);
  v_company_revenue numeric(14,2);
  v_cod_amount numeric(14,2);
  v_status text;
  v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.daynight_admin_or_support() then
    raise exception 'not_authorized';
  end if;
  if p_order_id is null then
    raise exception 'order_id_required';
  end if;
  if length(v_reason) < 6 then
    raise exception 'financial_adjustment_reason_required';
  end if;
  if v_goods < 0 or v_entered_delivery < 0 or v_discount < 0 then
    raise exception 'negative_financial_value';
  end if;

  -- Any positive manual value is exact. Explicit zero means a 25 AED merchant debit.
  if v_entered_delivery = 0 then
    v_effective_delivery := 25;
    v_mode := 'deduct_from_merchant';
  else
    v_effective_delivery := v_entered_delivery;
  end if;

  if v_payment = 'merchant_pays' then
    v_payment := 'sender_pays';
  elsif v_payment = 'cash' then
    v_payment := 'cod';
  elsif v_payment in ('card', 'bank_transfer', 'wallet') then
    v_payment := 'prepaid';
  end if;

  if v_payment not in ('cod', 'receiver_pays', 'sender_pays', 'prepaid') then
    raise exception 'invalid_payment_method: %', v_payment;
  end if;

  if v_payment = 'sender_pays' or v_entered_delivery = 0 then
    v_mode := 'deduct_from_merchant';
  elsif v_mode not in ('customer_pays', 'deduct_from_merchant') then
    v_mode := 'customer_pays';
  end if;

  if v_discount > (
    case
      when v_mode = 'customer_pays' then v_goods + v_effective_delivery
      else v_goods
    end
  ) then
    raise exception 'discount_exceeds_allowed_total';
  end if;

  select to_jsonb(o)
    into v_before
  from public.orders o
  where o.id = p_order_id
  for update;

  if v_before is null then
    raise exception 'order_not_found';
  end if;

  v_existing_payment := nullif(v_before ->> 'payment_method', '');

  select a.atttypid, t.typtype
    into v_payment_type_oid, v_payment_type_kind
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.orders'::regclass
    and a.attname = 'payment_method'
    and a.attnum > 0
    and not a.attisdropped;

  v_payment_candidates := case v_payment
    when 'cod' then array['cod', 'cash', 'receiver_pays']
    when 'receiver_pays' then array['receiver_pays', 'cash', 'cod']
    when 'sender_pays' then array['sender_pays', 'merchant_pays', 'prepaid', 'bank_transfer', 'cash', 'cod']
    else array['prepaid', 'bank_transfer', 'card', 'wallet']
  end;

  if v_payment_type_kind = 'e' then
    select e.enumlabel
      into v_payment_db
    from unnest(v_payment_candidates) with ordinality c(label, position)
    join pg_enum e
      on e.enumtypid = v_payment_type_oid
     and e.enumlabel = c.label
    order by c.position
    limit 1;

    v_payment_db := coalesce(v_payment_db, v_existing_payment);
  else
    v_payment_db := v_payment;
  end if;

  select x.*
    into v_cast_row
  from jsonb_populate_record(
    null::public.orders,
    jsonb_strip_nulls(jsonb_build_object(
      'payment_method', v_payment_db,
      'delivery_fee_mode', v_mode
    ))
  ) x;

  v_status := lower(replace(coalesce(v_before ->> 'status', ''), '-', '_'));

  v_customer_total := round(
    case
      when v_mode = 'customer_pays'
        then v_goods + v_effective_delivery - v_discount
      else v_goods - v_discount
    end,
    2
  );

  v_merchant_due := round(
    case
      when v_mode = 'customer_pays'
        then v_goods - v_discount
      else v_goods - v_discount - v_effective_delivery
    end,
    2
  );

  v_company_revenue := v_effective_delivery;
  v_cod_amount := case
    when v_payment in ('cod', 'receiver_pays') then v_customer_total
    else 0
  end;

  update public.orders o
  set
    goods_value = v_goods,
    delivery_fee = v_effective_delivery,
    discount_amount = v_discount,
    delivery_fee_mode = coalesce(v_cast_row.delivery_fee_mode, o.delivery_fee_mode),
    payment_method = coalesce(v_cast_row.payment_method, o.payment_method),
    cod_amount = v_cod_amount,
    customer_total = v_customer_total,
    merchant_due = v_merchant_due,
    company_revenue = v_company_revenue,
    delivery_price = v_effective_delivery,
    base_price = v_effective_delivery,
    subtotal = v_customer_total,
    total = v_customer_total,
    total_price = v_customer_total,
    amount = v_customer_total,
    price = v_customer_total,
    manual_delivery_price = v_entered_delivery,
    price_source = 'manual',
    collected_amount = case
      when v_status in ('delivered', 'completed', 'complete') then v_customer_total
      else coalesce(o.collected_amount, 0)
    end,
    financial_posted_at = case
      when v_status in ('delivered', 'completed', 'complete') then coalesce(o.financial_posted_at, v_now)
      else o.financial_posted_at
    end,
    financial_version = coalesce(o.financial_version, 1) + 1,
    financial_adjusted_at = v_now,
    financial_adjusted_by = auth.uid(),
    financial_adjustment_reason = v_reason,
    status_history = coalesce(o.status_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'status', coalesce(v_before ->> 'status', 'pending'),
        'note', 'Audited financial adjustment: ' || v_reason,
        'created_at', v_now,
        'date', v_now,
        'timestamp', v_now,
        'changed_by', 'admin',
        'changed_by_user_id', auth.uid(),
        'financial_adjustment', true,
        'manual_delivery_price', v_entered_delivery,
        'effective_delivery_fee', v_effective_delivery,
        'delivery_fee_mode', v_mode,
        'customer_total', v_customer_total,
        'merchant_due', v_merchant_due,
        'company_revenue', v_company_revenue
      )
    ),
    updated_at = v_now
  where o.id = p_order_id
  returning to_jsonb(o) into v_after;

  if v_after is null then
    raise exception 'financial_adjustment_affected_zero_rows';
  end if;

  if round(coalesce(nullif(v_after ->> 'goods_value', '')::numeric, -1), 2) <> v_goods
     or round(coalesce(nullif(v_after ->> 'delivery_fee', '')::numeric, -1), 2) <> v_effective_delivery
     or round(coalesce(nullif(v_after ->> 'manual_delivery_price', '')::numeric, -1), 2) <> v_entered_delivery
     or round(coalesce(nullif(v_after ->> 'discount_amount', '')::numeric, -1), 2) <> v_discount
     or round(coalesce(nullif(v_after ->> 'customer_total', '')::numeric, -1), 2) <> v_customer_total
     or round(coalesce(nullif(v_after ->> 'merchant_due', '')::numeric, -999999), 2) <> v_merchant_due
     or round(coalesce(nullif(v_after ->> 'company_revenue', '')::numeric, -1), 2) <> v_company_revenue then
    raise exception 'financial_adjustment_readback_mismatch';
  end if;

  insert into public.order_financial_adjustments (
    order_id,
    actor_id,
    reason,
    before_data,
    after_data,
    delta_data
  ) values (
    p_order_id,
    auth.uid(),
    v_reason,
    v_before,
    v_after,
    jsonb_build_object(
      'goods_value', v_goods - coalesce(nullif(v_before ->> 'goods_value', '')::numeric, 0),
      'manual_delivery_price_before', v_before ->> 'manual_delivery_price',
      'manual_delivery_price_after', v_entered_delivery,
      'delivery_fee', v_effective_delivery - coalesce(nullif(v_before ->> 'delivery_fee', '')::numeric, 0),
      'discount_amount', v_discount - coalesce(nullif(v_before ->> 'discount_amount', '')::numeric, 0),
      'customer_total', v_customer_total - coalesce(nullif(v_before ->> 'customer_total', '')::numeric, 0),
      'merchant_due', v_merchant_due - coalesce(nullif(v_before ->> 'merchant_due', '')::numeric, 0),
      'company_revenue', v_company_revenue - coalesce(nullif(v_before ->> 'company_revenue', '')::numeric, 0),
      'delivery_fee_mode_before', v_before ->> 'delivery_fee_mode',
      'delivery_fee_mode_after', v_mode,
      'payment_method_before', v_before ->> 'payment_method',
      'payment_method_after', v_after ->> 'payment_method'
    )
  ) returning id into v_adjustment_id;

  begin
    insert into public.admin_audit_events (
      entity_type,
      entity_id,
      action,
      before_data,
      after_data,
      metadata,
      actor_id
    ) values (
      'order',
      p_order_id::text,
      'audited_financial_adjustment',
      v_before,
      v_after,
      jsonb_build_object(
        'reason', v_reason,
        'adjustment_id', v_adjustment_id,
        'manual_delivery_price', v_entered_delivery,
        'effective_delivery_fee', v_effective_delivery
      ),
      auth.uid()
    );
  exception
    when undefined_table or undefined_column or insufficient_privilege then
      null;
  end;

  return jsonb_build_object(
    'ok', true,
    'order', v_after,
    'adjustment_id', v_adjustment_id,
    'financials', jsonb_build_object(
      'goods_value', v_goods,
      'manual_delivery_price', v_entered_delivery,
      'delivery_fee', v_effective_delivery,
      'discount_amount', v_discount,
      'delivery_fee_mode', v_mode,
      'payment_method', v_after ->> 'payment_method',
      'customer_total', v_customer_total,
      'merchant_due', v_merchant_due,
      'company_revenue', v_company_revenue,
      'cod_amount', v_cod_amount
    )
  );
exception when others then
  raise exception using
    message = 'admin_adjust_order_financials_verified_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate || '; order_id=' || coalesce(p_order_id::text, 'null'),
    hint = 'Apply migration 20260729010000 and confirm the authenticated profile role is admin/support.';
end;
$$;

revoke all on function public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)
from public, anon;
grant execute on function public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)
to authenticated;

create or replace function public.daynight_pricing_financial_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      public.daynight_official_local_delivery_fee('Al Ain', 'Al Ain') = 25
      and public.daynight_official_local_delivery_fee('Dubai', 'Al Dhafra') = 50
      and to_regprocedure('public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)') is not null
      and to_regclass('public.order_financial_adjustments') is not null,
    'al_ain_fee', public.daynight_official_local_delivery_fee('Al Ain', 'Al Ain'),
    'western_region_fee', public.daynight_official_local_delivery_fee('Dubai', 'Al Dhafra'),
    'manual_zero_effective_fee', 25,
    'rpc', to_regprocedure('public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)') is not null,
    'audit_table', to_regclass('public.order_financial_adjustments') is not null,
    'checked_at', now()
  );
$$;

revoke all on function public.daynight_pricing_financial_health() from public, anon;
grant execute on function public.daynight_pricing_financial_health() to authenticated;

notify pgrst, 'reload schema';

commit;
