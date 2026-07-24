-- DAY NIGHT — Specialized driver payroll history, classifications, and period calculations.
-- Additive and idempotent. Existing payroll rows remain intact.

begin;

create extension if not exists pgcrypto;

create table if not exists public.driver_salary_history (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  base_salary numeric(12,2) not null check (base_salary >= 0),
  salary_currency text not null default 'AED',
  salary_cycle text not null check (salary_cycle in ('monthly','weekly','daily')),
  effective_from date not null,
  effective_to date,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_salary_history_period_check check (effective_to is null or effective_to >= effective_from),
  constraint driver_salary_history_driver_effective_unique unique (driver_id,effective_from)
);

create index if not exists driver_salary_history_driver_period_idx
  on public.driver_salary_history(driver_id,effective_from desc,effective_to);

insert into public.driver_salary_history(
  driver_id,base_salary,salary_currency,salary_cycle,effective_from,note,created_by
)
select
  dp.id,
  coalesce(dp.base_salary,0),
  coalesce(nullif(dp.salary_currency,''),'AED'),
  case when lower(coalesce(dp.salary_cycle,'')) in ('monthly','weekly','daily') then lower(dp.salary_cycle) else 'monthly' end,
  coalesce(dp.salary_effective_from,date_trunc('month',current_date)::date),
  'Initial salary history imported from driver profile',
  null
from public.driver_profiles dp
where not exists (
  select 1 from public.driver_salary_history h where h.driver_id=dp.id
)
on conflict (driver_id,effective_from) do nothing;

alter table public.driver_payroll_entries
  drop constraint if exists driver_payroll_entries_entry_type_check;

alter table public.driver_payroll_entries
  add constraint driver_payroll_entries_entry_type_check
  check (entry_type in (
    'bonus',
    'expense',
    'deduction',
    'advance',
    'adjustment',
    'payment',
    'reimbursement',
    'debit_adjustment'
  ));

create or replace function public.admin_set_driver_salary(
  p_driver_id uuid,
  p_base_salary numeric,
  p_cycle text default 'monthly',
  p_effective_from date default current_date,
  p_note text default null
)
returns public.driver_profiles
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_row public.driver_profiles%rowtype;
  v_effective date := coalesce(p_effective_from,current_date);
  v_cycle text := lower(btrim(coalesce(p_cycle,'monthly')));
  v_latest date;
  v_old_salary numeric;
  v_old_cycle text;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if coalesce(p_base_salary,-1)<0 then raise exception 'invalid_base_salary'; end if;
  if v_cycle not in ('monthly','weekly','daily') then raise exception 'invalid_salary_cycle'; end if;
  if v_effective>current_date then raise exception 'future_salary_effective_date_not_supported'; end if;

  select * into v_row from public.driver_profiles where id=p_driver_id for update;
  if not found then raise exception 'driver_not_found'; end if;

  v_old_salary := coalesce(v_row.base_salary,0);
  v_old_cycle := coalesce(v_row.salary_cycle,'monthly');

  select max(effective_from) into v_latest
  from public.driver_salary_history
  where driver_id=p_driver_id;

  if v_latest is not null and v_effective<v_latest then
    raise exception 'salary_effective_date_before_latest';
  end if;

  update public.driver_salary_history
  set effective_to=v_effective-1,updated_at=now()
  where driver_id=p_driver_id
    and effective_to is null
    and effective_from<v_effective;

  insert into public.driver_salary_history(
    driver_id,base_salary,salary_currency,salary_cycle,effective_from,effective_to,note,created_by
  )
  values(
    p_driver_id,round(p_base_salary,2),'AED',v_cycle,v_effective,null,
    nullif(btrim(coalesce(p_note,'')),''),auth.uid()
  )
  on conflict (driver_id,effective_from) do update set
    base_salary=excluded.base_salary,
    salary_currency=excluded.salary_currency,
    salary_cycle=excluded.salary_cycle,
    effective_to=null,
    note=coalesce(excluded.note,public.driver_salary_history.note),
    updated_at=now();

  update public.driver_profiles set
    base_salary=round(p_base_salary,2),
    salary_currency='AED',
    salary_cycle=v_cycle,
    salary_effective_from=v_effective,
    updated_at=now()
  where id=p_driver_id
  returning * into v_row;

  perform public.driver_audit(
    v_row.id,
    'salary_updated',
    null,
    jsonb_build_object(
      'old_base_salary',v_old_salary,
      'new_base_salary',v_row.base_salary,
      'old_cycle',v_old_cycle,
      'new_cycle',v_row.salary_cycle,
      'effective_from',v_row.salary_effective_from,
      'note',p_note,
      'salary_history',true
    )
  );
  return v_row;
end
$dn$;

create or replace function public.admin_create_driver_payroll_entry(
  p_driver_id uuid,
  p_entry_date date,
  p_entry_type text,
  p_amount numeric,
  p_reference_number text default null,
  p_notes text default null,
  p_order_id uuid default null,
  p_status text default 'approved'
)
returns public.driver_payroll_entries
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_type text := lower(btrim(coalesce(p_entry_type,'')));
  v_status text := lower(btrim(coalesce(p_status,'approved')));
  v_direction text;
  v_effect text;
  v_row public.driver_payroll_entries%rowtype;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.driver_profiles where id=p_driver_id) then raise exception 'driver_not_found'; end if;
  if v_type not in ('bonus','expense','deduction','advance','adjustment','payment','reimbursement','debit_adjustment') then
    raise exception 'invalid_payroll_entry_type';
  end if;
  if v_status not in ('draft','approved') then raise exception 'invalid_payroll_status'; end if;
  if coalesce(p_amount,0)<=0 then raise exception 'invalid_payroll_amount'; end if;
  if nullif(btrim(coalesce(p_notes,'')),'') is null then raise exception 'payroll_note_required'; end if;

  v_direction := case
    when v_type in ('bonus','adjustment','reimbursement') then 'credit'
    else 'debit'
  end;
  v_effect := case
    when v_type='payment' then 'reduces_outstanding_only'
    when v_direction='credit' then 'increases_net_and_outstanding'
    else 'reduces_net_and_outstanding'
  end;

  insert into public.driver_payroll_entries(
    driver_id,entry_date,entry_type,direction,amount,reference_number,notes,
    order_id,status,created_by,approved_by,approved_at
  )
  values(
    p_driver_id,coalesce(p_entry_date,current_date),v_type,v_direction,round(p_amount,2),
    nullif(btrim(coalesce(p_reference_number,'')),''),btrim(p_notes),p_order_id,v_status,
    auth.uid(),case when v_status='approved' then auth.uid() end,
    case when v_status='approved' then now() end
  )
  returning * into v_row;

  perform public.driver_audit(
    p_driver_id,
    'payroll_entry_created',
    p_order_id,
    jsonb_build_object(
      'entry_id',v_row.id,
      'entry_type',v_type,
      'direction',v_direction,
      'effect',v_effect,
      'amount',v_row.amount,
      'status',v_status
    )
  );
  return v_row;
end
$dn$;

create or replace function public.admin_driver_payroll_snapshot(
  p_driver_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_from date:=coalesce(p_from,date_trunc('month',current_date)::date);
  v_to date:=coalesce(p_to,current_date);
  v_gross numeric:=0;
  v_bonuses numeric:=0;
  v_adjustments numeric:=0;
  v_reimbursements numeric:=0;
  v_expenses numeric:=0;
  v_deductions numeric:=0;
  v_advances numeric:=0;
  v_debit_adjustments numeric:=0;
  v_payments numeric:=0;
  v_credits numeric:=0;
  v_net numeric:=0;
  v_outstanding numeric:=0;
  v_overpaid numeric:=0;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if v_from>v_to then raise exception 'invalid_payroll_period'; end if;

  select * into v_driver from public.driver_profiles where id=p_driver_id;
  if not found then raise exception 'driver_not_found'; end if;

  select round(coalesce(sum(
    case coalesce(h.salary_cycle,v_driver.salary_cycle,'monthly')
      when 'daily' then coalesce(h.base_salary,v_driver.base_salary,0)
      when 'weekly' then coalesce(h.base_salary,v_driver.base_salary,0)/7.0
      else coalesce(h.base_salary,v_driver.base_salary,0)/extract(day from (date_trunc('month',d.day)+interval '1 month - 1 day'))
    end
  ),0),2)
  into v_gross
  from generate_series(v_from,v_to,interval '1 day') as d(day)
  left join lateral (
    select sh.base_salary,sh.salary_cycle
    from public.driver_salary_history sh
    where sh.driver_id=p_driver_id
      and sh.effective_from<=d.day::date
      and (sh.effective_to is null or sh.effective_to>=d.day::date)
    order by sh.effective_from desc
    limit 1
  ) h on true;

  select
    coalesce(sum(amount) filter(where entry_type='bonus' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='adjustment' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='reimbursement' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='expense' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='deduction' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='advance' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='debit_adjustment' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='payment' and status='approved'),0)
  into
    v_bonuses,v_adjustments,v_reimbursements,v_expenses,v_deductions,v_advances,v_debit_adjustments,v_payments
  from public.driver_payroll_entries
  where driver_id=p_driver_id and entry_date between v_from and v_to;

  v_credits:=round(v_bonuses+v_adjustments+v_reimbursements,2);
  v_net:=greatest(0,round(v_gross+v_credits-v_expenses-v_deductions-v_advances-v_debit_adjustments,2));
  v_outstanding:=greatest(0,round(v_net-v_payments,2));
  v_overpaid:=greatest(0,round(v_payments-v_net,2));

  return jsonb_build_object(
    'driver',to_jsonb(v_driver),
    'period_from',v_from,
    'period_to',v_to,
    'currency','AED',
    'gross_salary',v_gross,
    'credits',v_credits,
    'bonuses',v_bonuses,
    'adjustments',v_adjustments,
    'reimbursements',v_reimbursements,
    'expenses',v_expenses,
    'deductions',v_deductions,
    'advances',v_advances,
    'debit_adjustments',v_debit_adjustments,
    'payments',v_payments,
    'net_salary',v_net,
    'outstanding',v_outstanding,
    'overpaid',v_overpaid,
    'calculation_method','daily_proration_from_salary_history',
    'salary_history',(
      select coalesce(jsonb_agg(to_jsonb(h) order by h.effective_from desc),'[]'::jsonb)
      from public.driver_salary_history h
      where h.driver_id=p_driver_id
        and h.effective_from<=v_to
        and (h.effective_to is null or h.effective_to>=v_from)
    ),
    'entries',(
      select coalesce(jsonb_agg(to_jsonb(e) order by e.entry_date desc,e.created_at desc),'[]'::jsonb)
      from public.driver_payroll_entries e
      where e.driver_id=p_driver_id and e.entry_date between v_from and v_to
    )
  );
end
$dn$;

alter table public.driver_salary_history enable row level security;

drop policy if exists "admins manage driver salary history" on public.driver_salary_history;
create policy "admins manage driver salary history"
on public.driver_salary_history
for all to authenticated
using (public.driver_is_admin())
with check (public.driver_is_admin());

drop policy if exists "drivers read own salary history" on public.driver_salary_history;
create policy "drivers read own salary history"
on public.driver_salary_history
for select to authenticated
using (
  exists(
    select 1 from public.driver_profiles dp
    where dp.id=driver_salary_history.driver_id
      and (dp.id=auth.uid() or dp.user_id=auth.uid())
  )
);

revoke all on table public.driver_salary_history from public, anon;
grant select on table public.driver_salary_history to authenticated;

revoke all on function public.admin_set_driver_salary(uuid,numeric,text,date,text) from public, anon;
revoke all on function public.admin_create_driver_payroll_entry(uuid,date,text,numeric,text,text,uuid,text) from public, anon;
revoke all on function public.admin_driver_payroll_snapshot(uuid,date,date) from public, anon;
grant execute on function public.admin_set_driver_salary(uuid,numeric,text,date,text) to authenticated;
grant execute on function public.admin_create_driver_payroll_entry(uuid,date,text,numeric,text,text,uuid,text) to authenticated;
grant execute on function public.admin_driver_payroll_snapshot(uuid,date,date) to authenticated;

create or replace function public.driver_payroll_specialization_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $dn$
  select jsonb_build_object(
    'ok',
      to_regclass('public.driver_salary_history') is not null
      and to_regclass('public.driver_payroll_entries') is not null
      and to_regprocedure('public.admin_set_driver_salary(uuid,numeric,text,date,text)') is not null
      and to_regprocedure('public.admin_create_driver_payroll_entry(uuid,date,text,numeric,text,text,uuid,text)') is not null
      and to_regprocedure('public.admin_driver_payroll_snapshot(uuid,date,date)') is not null,
    'salary_history',to_regclass('public.driver_salary_history') is not null,
    'period_calculation','daily_proration_from_salary_history',
    'entry_types',jsonb_build_array(
      'bonus','expense','deduction','advance','adjustment','payment','reimbursement','debit_adjustment'
    ),
    'generated_at',now()
  );
$dn$;

revoke all on function public.driver_payroll_specialization_health() from public, anon;
grant execute on function public.driver_payroll_specialization_health() to anon, authenticated;

select pg_notify('pgrst','reload schema');
select pg_notify('pgrst','reload config');

commit;

select public.driver_payroll_specialization_health();
