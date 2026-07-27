-- DAY NIGHT DELIVERY SERVICES
-- Audited financial correction for delivered/posted orders.
-- Allows an authorized admin/support user to correct goods, delivery, discount,
-- payer mode and payment method without corrupting merchant/company totals.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.orders
  add column if not exists financial_adjusted_at timestamptz,
  add column if not exists financial_adjusted_by uuid,
  add column if not exists financial_adjustment_reason text;

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
  v_goods numeric(14,2) := round(coalesce(p_goods_value, 0)::numeric, 2);
  v_delivery numeric(14,2) := round(coalesce(p_delivery_fee, 0)::numeric, 2);
  v_discount numeric(14,2) := round(coalesce(p_discount_amount, 0)::numeric, 2);
  v_mode text := lower(replace(btrim(coalesce(p_delivery_fee_mode, 'customer_pays')), '-', '_'));
  v_payment text := lower(replace(btrim(coalesce(p_payment_method, 'cod')), '-', '_'));
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
  if v_goods < 0 or v_delivery < 0 or v_discount < 0 then
    raise exception 'negative_financial_value';
  end if;

  if v_payment = 'merchant_pays' then
    v_payment := 'sender_pays';
  end if;
  if v_payment not in ('cod', 'receiver_pays', 'sender_pays', 'prepaid', 'cash', 'card', 'bank_transfer') then
    raise exception 'invalid_payment_method: %', v_payment;
  end if;

  if v_payment = 'sender_pays' then
    v_mode := 'deduct_from_merchant';
  elsif v_mode not in ('customer_pays', 'deduct_from_merchant') then
    v_mode := 'customer_pays';
  end if;

  if v_discount > case when v_mode = 'customer_pays' then v_goods + v_delivery else v_goods end then
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

  v_status := lower(replace(coalesce(v_before ->> 'status', ''), '-', '_'));
  v_customer_total := round(
    case when v_mode = 'customer_pays'
      then v_goods + v_delivery - v_discount
      else v_goods - v_discount
    end,
    2
  );
  v_merchant_due := round(
    case when v_mode = 'customer_pays'
      then v_goods - v_discount
      else v_goods - v_discount - v_delivery
    end,
    2
  );
  v_company_revenue := v_delivery;
  v_cod_amount := case when v_payment in ('cod', 'cash') then v_customer_total else 0 end;

  update public.orders o
  set
    goods_value = v_goods,
    delivery_fee = v_delivery,
    discount_amount = v_discount,
    delivery_fee_mode = v_mode,
    payment_method = v_payment,
    cod_amount = v_cod_amount,
    customer_total = v_customer_total,
    merchant_due = v_merchant_due,
    company_revenue = v_company_revenue,
    delivery_price = v_delivery,
    base_price = v_delivery,
    subtotal = v_customer_total,
    total = v_customer_total,
    total_price = v_customer_total,
    amount = v_customer_total,
    price = v_customer_total,
    manual_delivery_price = v_delivery,
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
        'financial_adjustment', true
      )
    ),
    updated_at = v_now
  where o.id = p_order_id
  returning to_jsonb(o) into v_after;

  if v_after is null then
    raise exception 'financial_adjustment_affected_zero_rows';
  end if;

  if round(coalesce((v_after ->> 'goods_value')::numeric, -1), 2) <> v_goods
     or round(coalesce((v_after ->> 'delivery_fee')::numeric, -1), 2) <> v_delivery
     or round(coalesce((v_after ->> 'discount_amount')::numeric, -1), 2) <> v_discount
     or round(coalesce((v_after ->> 'customer_total')::numeric, -1), 2) <> v_customer_total
     or round(coalesce((v_after ->> 'merchant_due')::numeric, -999999), 2) <> v_merchant_due then
    raise exception 'financial_adjustment_readback_mismatch';
  end if;

  insert into public.order_financial_adjustments(
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
      'delivery_fee', v_delivery - coalesce(nullif(v_before ->> 'delivery_fee', '')::numeric, 0),
      'discount_amount', v_discount - coalesce(nullif(v_before ->> 'discount_amount', '')::numeric, 0),
      'customer_total', v_customer_total - coalesce(nullif(v_before ->> 'customer_total', '')::numeric, 0),
      'merchant_due', v_merchant_due - coalesce(nullif(v_before ->> 'merchant_due', '')::numeric, 0),
      'company_revenue', v_company_revenue - coalesce(nullif(v_before ->> 'company_revenue', '')::numeric, 0)
    )
  ) returning id into v_adjustment_id;

  begin
    insert into public.admin_audit_events(
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
      jsonb_build_object('reason', v_reason, 'adjustment_id', v_adjustment_id),
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
      'delivery_fee', v_delivery,
      'discount_amount', v_discount,
      'delivery_fee_mode', v_mode,
      'payment_method', v_payment,
      'customer_total', v_customer_total,
      'merchant_due', v_merchant_due,
      'company_revenue', v_company_revenue
    )
  );
exception when others then
  raise exception using
    message = 'admin_adjust_order_financials_verified_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate || '; order_id=' || coalesce(p_order_id::text, 'null'),
    hint = 'Confirm the authenticated profile role is admin/support and apply this migration to the production Supabase project.';
end;
$$;

revoke all on function public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)
from public, anon;
grant execute on function public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)
to authenticated;

create or replace function public.admin_delivered_financial_adjustment_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)') is not null
      and to_regclass('public.order_financial_adjustments') is not null,
    'rpc', to_regprocedure('public.admin_adjust_order_financials_verified(uuid,numeric,numeric,numeric,text,text,text)') is not null,
    'audit_table', to_regclass('public.order_financial_adjustments') is not null,
    'checked_at', now()
  );
$$;

revoke all on function public.admin_delivered_financial_adjustment_health() from public, anon;
grant execute on function public.admin_delivered_financial_adjustment_health() to authenticated;

notify pgrst, 'reload schema';

commit;
