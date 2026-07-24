-- DAY NIGHT DELIVERY SERVICES
-- Unified employee HR directory, salary history, payroll movements and driver linkage.
-- Additive and idempotent. Existing driver payroll remains authoritative for linked drivers.

begin;

create extension if not exists pgcrypto;

create or replace function public.employee_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.driver_is_admin(), false);
$$;

create or replace function public.daynight_generate_employee_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := 'DN-EMP-' || to_char(current_date, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists(select 1 from public.employees where employee_code = v_code);
  end loop;
  return v_code;
exception when undefined_table then
  return 'DN-EMP-' || to_char(current_date, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
end;
$$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  driver_profile_id uuid unique references public.driver_profiles(id) on delete set null,
  full_name text not null,
  employee_type text not null default 'other',
  custom_job_title text,
  department text,
  phone text not null,
  alternate_phone text,
  email text,
  nationality text,
  emirate text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  identity_number text,
  passport_number text,
  visa_expiry date,
  joined_at date not null default current_date,
  employment_status text not null default 'active' check (employment_status in ('active','inactive','on_leave','suspended','terminated')),
  base_salary numeric(12,2) not null default 0 check (base_salary >= 0),
  salary_currency text not null default 'AED',
  salary_cycle text not null default 'monthly' check (salary_cycle in ('monthly','weekly','daily')),
  salary_effective_from date not null default current_date,
  avatar_url text,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_type_status_idx on public.employees(employee_type, employment_status);
create index if not exists employees_name_phone_idx on public.employees(lower(full_name), phone);
create index if not exists employees_driver_profile_idx on public.employees(driver_profile_id) where driver_profile_id is not null;

create table if not exists public.employee_salary_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  base_salary numeric(12,2) not null check (base_salary >= 0),
  salary_currency text not null default 'AED',
  salary_cycle text not null check (salary_cycle in ('monthly','weekly','daily')),
  effective_from date not null,
  effective_to date,
  change_amount numeric(12,2) not null default 0,
  change_kind text not null default 'initial' check (change_kind in ('initial','increase','decrease','correction')),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_salary_history_period_check check (effective_to is null or effective_to >= effective_from),
  constraint employee_salary_history_unique unique(employee_id, effective_from)
);

create index if not exists employee_salary_history_period_idx
  on public.employee_salary_history(employee_id, effective_from desc, effective_to);

create table if not exists public.employee_payroll_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in (
    'bonus','overtime','allowance','reimbursement','adjustment',
    'deduction','advance','penalty','expense','debit_adjustment','payment'
  )),
  direction text not null check (direction in ('credit','debit')),
  amount numeric(12,2) not null check (amount > 0),
  reference_number text,
  notes text not null,
  status text not null default 'approved' check (status in ('draft','approved','void')),
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  voided_by uuid references auth.users(id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_payroll_entries_period_idx
  on public.employee_payroll_entries(employee_id, entry_date desc, created_at desc);
create index if not exists employee_payroll_entries_status_idx
  on public.employee_payroll_entries(status, entry_type);

create or replace function public.employee_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists employees_touch_updated_at on public.employees;
create trigger employees_touch_updated_at
before update on public.employees
for each row execute function public.employee_touch_updated_at();

drop trigger if exists employee_salary_history_touch_updated_at on public.employee_salary_history;
create trigger employee_salary_history_touch_updated_at
before update on public.employee_salary_history
for each row execute function public.employee_touch_updated_at();

drop trigger if exists employee_payroll_entries_touch_updated_at on public.employee_payroll_entries;
create trigger employee_payroll_entries_touch_updated_at
before update on public.employee_payroll_entries
for each row execute function public.employee_touch_updated_at();

-- Import current drivers into the unified directory without replacing their driver payroll.
insert into public.employees(
  employee_code,user_id,driver_profile_id,full_name,employee_type,custom_job_title,department,
  phone,email,nationality,emirate,address,emergency_contact_phone,joined_at,employment_status,
  base_salary,salary_currency,salary_cycle,salary_effective_from,avatar_url,notes
)
select
  'DN-EMP-DRV-' || upper(substr(replace(dp.id::text, '-', ''), 1, 6)),
  dp.user_id,
  dp.id,
  coalesce(nullif(btrim(coalesce(dp.full_name, dp.name, '')), ''), 'DAY NIGHT Driver'),
  'driver',
  'Delivery Driver',
  'Delivery Operations',
  coalesce(nullif(btrim(coalesce(dp.phone, '')), ''), 'Not set'),
  dp.email,
  dp.nationality,
  dp.emirate,
  dp.address,
  dp.emergency_contact,
  coalesce(dp.joined_at::date, dp.created_at::date, current_date),
  case when lower(coalesce(dp.status, 'active')) in ('active','inactive','suspended') then lower(dp.status) else 'active' end,
  coalesce(dp.base_salary, 0),
  coalesce(nullif(dp.salary_currency, ''), 'AED'),
  case when lower(coalesce(dp.salary_cycle, 'monthly')) in ('monthly','weekly','daily') then lower(dp.salary_cycle) else 'monthly' end,
  coalesce(dp.salary_effective_from, dp.joined_at::date, current_date),
  coalesce(dp.avatar_url, dp.avatar_path),
  'Imported automatically from driver_profiles; driver payroll remains authoritative.'
from public.driver_profiles dp
where not exists(select 1 from public.employees e where e.driver_profile_id = dp.id)
on conflict (employee_code) do nothing;

insert into public.employee_salary_history(
  employee_id,base_salary,salary_currency,salary_cycle,effective_from,change_amount,change_kind,note,created_by
)
select
  e.id,e.base_salary,e.salary_currency,e.salary_cycle,e.salary_effective_from,e.base_salary,'initial',
  case when e.driver_profile_id is not null then 'Initial mirror of linked driver salary' else 'Initial employee salary' end,
  null
from public.employees e
where not exists(select 1 from public.employee_salary_history h where h.employee_id = e.id)
on conflict (employee_id,effective_from) do nothing;

create or replace function public.admin_employee_directory()
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select case
    when not public.employee_is_admin() then jsonb_build_object('error','not_authorized')
    else coalesce((
      select jsonb_agg(to_jsonb(e) order by
        case e.employment_status when 'active' then 0 when 'on_leave' then 1 else 2 end,
        e.full_name
      )
      from public.employees e
    ), '[]'::jsonb)
  end;
$$;

create or replace function public.admin_create_employee(p_payload jsonb)
returns public.employees
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_row public.employees%rowtype;
  v_driver public.driver_profiles%rowtype;
  v_driver_id uuid := nullif(p_payload->>'driver_profile_id','')::uuid;
  v_type text := lower(replace(btrim(coalesce(p_payload->>'employee_type','other')), ' ', '_'));
  v_status text := lower(replace(btrim(coalesce(p_payload->>'employment_status','active')), ' ', '_'));
  v_cycle text := lower(btrim(coalesce(p_payload->>'salary_cycle','monthly')));
  v_salary numeric := greatest(coalesce(nullif(p_payload->>'base_salary','')::numeric,0),0);
  v_effective date := coalesce(nullif(p_payload->>'salary_effective_from','')::date,current_date);
  v_joined date := coalesce(nullif(p_payload->>'joined_at','')::date,current_date);
  v_name text;
  v_phone text;
  v_code text := upper(nullif(btrim(coalesce(p_payload->>'employee_code','')),''));
begin
  if not public.employee_is_admin() then raise exception 'not_authorized'; end if;
  if v_status not in ('active','inactive','on_leave','suspended','terminated') then raise exception 'invalid_employee_status'; end if;
  if v_cycle not in ('monthly','weekly','daily') then raise exception 'invalid_salary_cycle'; end if;
  if v_effective > current_date then raise exception 'future_salary_effective_date_not_supported'; end if;

  if v_driver_id is not null then
    select * into v_driver from public.driver_profiles where id = v_driver_id;
    if not found then raise exception 'driver_not_found'; end if;
    if exists(select 1 from public.employees where driver_profile_id = v_driver_id) then raise exception 'driver_already_linked_to_employee'; end if;
    v_type := 'driver';
  end if;

  v_name := coalesce(
    nullif(btrim(coalesce(p_payload->>'full_name','')),''),
    nullif(btrim(coalesce(v_driver.full_name,v_driver.name,'')), '')
  );
  v_phone := coalesce(
    nullif(btrim(coalesce(p_payload->>'phone','')),''),
    nullif(btrim(coalesce(v_driver.phone,'')), '')
  );
  if v_name is null then raise exception 'employee_name_required'; end if;
  if v_phone is null then raise exception 'employee_phone_required'; end if;
  if v_code is null then v_code := public.daynight_generate_employee_code(); end if;

  insert into public.employees(
    employee_code,user_id,driver_profile_id,full_name,employee_type,custom_job_title,department,
    phone,alternate_phone,email,nationality,emirate,address,emergency_contact_name,
    emergency_contact_phone,identity_number,passport_number,visa_expiry,joined_at,employment_status,
    base_salary,salary_currency,salary_cycle,salary_effective_from,avatar_url,notes,created_by,updated_by
  ) values (
    v_code,coalesce(v_driver.user_id,nullif(p_payload->>'user_id','')::uuid),v_driver_id,v_name,v_type,
    nullif(btrim(coalesce(p_payload->>'custom_job_title','')),''),
    nullif(btrim(coalesce(p_payload->>'department','')),''),
    v_phone,nullif(btrim(coalesce(p_payload->>'alternate_phone','')),''),
    coalesce(nullif(btrim(coalesce(p_payload->>'email','')),''),v_driver.email),
    coalesce(nullif(btrim(coalesce(p_payload->>'nationality','')),''),v_driver.nationality),
    coalesce(nullif(btrim(coalesce(p_payload->>'emirate','')),''),v_driver.emirate),
    coalesce(nullif(btrim(coalesce(p_payload->>'address','')),''),v_driver.address),
    nullif(btrim(coalesce(p_payload->>'emergency_contact_name','')),''),
    coalesce(nullif(btrim(coalesce(p_payload->>'emergency_contact_phone','')),''),v_driver.emergency_contact),
    nullif(btrim(coalesce(p_payload->>'identity_number','')),''),
    nullif(btrim(coalesce(p_payload->>'passport_number','')),''),
    nullif(p_payload->>'visa_expiry','')::date,v_joined,v_status,v_salary,'AED',v_cycle,v_effective,
    coalesce(nullif(btrim(coalesce(p_payload->>'avatar_url','')),''),v_driver.avatar_url,v_driver.avatar_path),
    nullif(btrim(coalesce(p_payload->>'notes','')),''),auth.uid(),auth.uid()
  ) returning * into v_row;

  insert into public.employee_salary_history(
    employee_id,base_salary,salary_currency,salary_cycle,effective_from,change_amount,change_kind,note,created_by
  ) values (
    v_row.id,v_row.base_salary,v_row.salary_currency,v_row.salary_cycle,v_row.salary_effective_from,
    v_row.base_salary,'initial','Initial salary created with employee profile',auth.uid()
  );

  if v_driver_id is not null and (
    coalesce(v_driver.base_salary,0) <> v_salary or
    coalesce(v_driver.salary_cycle,'monthly') <> v_cycle
  ) then
    perform public.admin_set_driver_salary(v_driver_id,v_salary,v_cycle,v_effective,'Synchronized from unified employee HR profile');
  end if;

  return v_row;
end
$dn$;

create or replace function public.admin_set_employee_salary(
  p_employee_id uuid,
  p_base_salary numeric,
  p_cycle text default 'monthly',
  p_effective_from date default current_date,
  p_note text default null
)
returns public.employees
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_row public.employees%rowtype;
  v_old_salary numeric;
  v_cycle text := lower(btrim(coalesce(p_cycle,'monthly')));
  v_effective date := coalesce(p_effective_from,current_date);
  v_latest date;
  v_kind text;
begin
  if not public.employee_is_admin() then raise exception 'not_authorized'; end if;
  if coalesce(p_base_salary,-1) < 0 then raise exception 'invalid_base_salary'; end if;
  if v_cycle not in ('monthly','weekly','daily') then raise exception 'invalid_salary_cycle'; end if;
  if v_effective > current_date then raise exception 'future_salary_effective_date_not_supported'; end if;

  select * into v_row from public.employees where id = p_employee_id for update;
  if not found then raise exception 'employee_not_found'; end if;
  v_old_salary := coalesce(v_row.base_salary,0);

  select max(effective_from) into v_latest from public.employee_salary_history where employee_id = p_employee_id;
  if v_latest is not null and v_effective < v_latest then raise exception 'salary_effective_date_before_latest'; end if;

  update public.employee_salary_history
  set effective_to = v_effective - 1, updated_at = now()
  where employee_id = p_employee_id and effective_to is null and effective_from < v_effective;

  v_kind := case when p_base_salary > v_old_salary then 'increase' when p_base_salary < v_old_salary then 'decrease' else 'correction' end;

  insert into public.employee_salary_history(
    employee_id,base_salary,salary_currency,salary_cycle,effective_from,effective_to,
    change_amount,change_kind,note,created_by
  ) values (
    p_employee_id,round(p_base_salary,2),'AED',v_cycle,v_effective,null,
    round(p_base_salary-v_old_salary,2),v_kind,nullif(btrim(coalesce(p_note,'')),''),auth.uid()
  ) on conflict (employee_id,effective_from) do update set
    base_salary=excluded.base_salary,salary_currency=excluded.salary_currency,salary_cycle=excluded.salary_cycle,
    effective_to=null,change_amount=excluded.change_amount,change_kind=excluded.change_kind,
    note=coalesce(excluded.note,public.employee_salary_history.note),updated_at=now();

  update public.employees set
    base_salary=round(p_base_salary,2),salary_currency='AED',salary_cycle=v_cycle,
    salary_effective_from=v_effective,updated_by=auth.uid(),updated_at=now()
  where id=p_employee_id returning * into v_row;

  if v_row.driver_profile_id is not null then
    perform public.admin_set_driver_salary(
      v_row.driver_profile_id,round(p_base_salary,2),v_cycle,v_effective,
      coalesce(nullif(btrim(coalesce(p_note,'')),''),'Synchronized from employee HR salary revision')
    );
  end if;

  return v_row;
end
$dn$;

create or replace function public.admin_create_employee_payroll_entry(
  p_employee_id uuid,
  p_entry_date date,
  p_entry_type text,
  p_amount numeric,
  p_reference_number text default null,
  p_notes text default null,
  p_status text default 'approved'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_employee public.employees%rowtype;
  v_type text := lower(btrim(coalesce(p_entry_type,'')));
  v_status text := lower(btrim(coalesce(p_status,'approved')));
  v_direction text;
  v_row public.employee_payroll_entries%rowtype;
  v_driver_row public.driver_payroll_entries%rowtype;
  v_driver_type text;
begin
  if not public.employee_is_admin() then raise exception 'not_authorized'; end if;
  select * into v_employee from public.employees where id=p_employee_id;
  if not found then raise exception 'employee_not_found'; end if;
  if v_type not in ('bonus','overtime','allowance','reimbursement','adjustment','deduction','advance','penalty','expense','debit_adjustment','payment') then
    raise exception 'invalid_payroll_entry_type';
  end if;
  if v_status not in ('draft','approved') then raise exception 'invalid_payroll_status'; end if;
  if coalesce(p_amount,0)<=0 then raise exception 'invalid_payroll_amount'; end if;
  if nullif(btrim(coalesce(p_notes,'')),'') is null then raise exception 'payroll_note_required'; end if;

  if v_employee.driver_profile_id is not null then
    v_driver_type := case
      when v_type in ('overtime','allowance') then 'bonus'
      when v_type='penalty' then 'deduction'
      else v_type
    end;
    select * into v_driver_row from public.admin_create_driver_payroll_entry(
      v_employee.driver_profile_id,coalesce(p_entry_date,current_date),v_driver_type,round(p_amount,2),
      p_reference_number,p_notes,null,v_status
    );
    return to_jsonb(v_driver_row) || jsonb_build_object(
      'employee_id',v_employee.id,'source','driver_payroll','original_entry_type',v_type
    );
  end if;

  v_direction := case when v_type in ('bonus','overtime','allowance','reimbursement','adjustment') then 'credit' else 'debit' end;
  insert into public.employee_payroll_entries(
    employee_id,entry_date,entry_type,direction,amount,reference_number,notes,status,
    created_by,approved_by,approved_at
  ) values (
    p_employee_id,coalesce(p_entry_date,current_date),v_type,v_direction,round(p_amount,2),
    nullif(btrim(coalesce(p_reference_number,'')),''),btrim(p_notes),v_status,auth.uid(),
    case when v_status='approved' then auth.uid() end,
    case when v_status='approved' then now() end
  ) returning * into v_row;
  return to_jsonb(v_row) || jsonb_build_object('source','employee_payroll');
end
$dn$;

create or replace function public.admin_set_employee_payroll_entry_status(
  p_employee_id uuid,
  p_entry_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_employee public.employees%rowtype;
  v_status text := lower(btrim(coalesce(p_status,'')));
  v_row public.employee_payroll_entries%rowtype;
  v_driver_row public.driver_payroll_entries%rowtype;
begin
  if not public.employee_is_admin() then raise exception 'not_authorized'; end if;
  if v_status not in ('approved','void') then raise exception 'invalid_payroll_status'; end if;
  select * into v_employee from public.employees where id=p_employee_id;
  if not found then raise exception 'employee_not_found'; end if;

  if v_employee.driver_profile_id is not null then
    select * into v_driver_row from public.admin_set_driver_payroll_entry_status(p_entry_id,v_status,p_note);
    return to_jsonb(v_driver_row) || jsonb_build_object('employee_id',v_employee.id,'source','driver_payroll');
  end if;

  update public.employee_payroll_entries set
    status=v_status,
    approved_by=case when v_status='approved' then auth.uid() else approved_by end,
    approved_at=case when v_status='approved' then now() else approved_at end,
    voided_by=case when v_status='void' then auth.uid() else null end,
    voided_at=case when v_status='void' then now() else null end,
    void_reason=case when v_status='void' then nullif(btrim(coalesce(p_note,'')),'') else null end,
    updated_at=now()
  where id=p_entry_id and employee_id=p_employee_id
  returning * into v_row;
  if not found then raise exception 'payroll_entry_not_found'; end if;
  return to_jsonb(v_row) || jsonb_build_object('source','employee_payroll');
end
$dn$;

create or replace function public.admin_employee_payroll_snapshot(
  p_employee_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_employee public.employees%rowtype;
  v_from date := coalesce(p_from,date_trunc('month',current_date)::date);
  v_to date := coalesce(p_to,current_date);
  v_driver_snapshot jsonb;
  v_gross numeric := 0;
  v_bonus numeric := 0;
  v_overtime numeric := 0;
  v_allowance numeric := 0;
  v_reimbursement numeric := 0;
  v_adjustment numeric := 0;
  v_deduction numeric := 0;
  v_advance numeric := 0;
  v_penalty numeric := 0;
  v_expense numeric := 0;
  v_debit_adjustment numeric := 0;
  v_payment numeric := 0;
  v_credits numeric := 0;
  v_debits numeric := 0;
  v_net numeric := 0;
  v_outstanding numeric := 0;
  v_liability numeric := 0;
  v_overpaid numeric := 0;
begin
  if not public.employee_is_admin() then raise exception 'not_authorized'; end if;
  if v_from>v_to then raise exception 'invalid_payroll_period'; end if;
  select * into v_employee from public.employees where id=p_employee_id;
  if not found then raise exception 'employee_not_found'; end if;

  if v_employee.driver_profile_id is not null then
    v_driver_snapshot := public.admin_driver_payroll_snapshot(v_employee.driver_profile_id,v_from,v_to);
    return v_driver_snapshot || jsonb_build_object(
      'employee',to_jsonb(v_employee),
      'source','driver_payroll',
      'employee_liability',0,
      'linked_driver',true
    );
  end if;

  select round(coalesce(sum(
    case coalesce(h.salary_cycle,v_employee.salary_cycle,'monthly')
      when 'daily' then coalesce(h.base_salary,v_employee.base_salary,0)
      when 'weekly' then coalesce(h.base_salary,v_employee.base_salary,0)/7.0
      else coalesce(h.base_salary,v_employee.base_salary,0)/extract(day from (date_trunc('month',d.day)+interval '1 month - 1 day'))
    end
  ),0),2)
  into v_gross
  from generate_series(v_from,v_to,interval '1 day') as d(day)
  left join lateral (
    select sh.base_salary,sh.salary_cycle
    from public.employee_salary_history sh
    where sh.employee_id=p_employee_id
      and sh.effective_from<=d.day::date
      and (sh.effective_to is null or sh.effective_to>=d.day::date)
    order by sh.effective_from desc limit 1
  ) h on true;

  select
    coalesce(sum(amount) filter(where entry_type='bonus' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='overtime' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='allowance' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='reimbursement' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='adjustment' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='deduction' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='advance' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='penalty' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='expense' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='debit_adjustment' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='payment' and status='approved'),0)
  into v_bonus,v_overtime,v_allowance,v_reimbursement,v_adjustment,
       v_deduction,v_advance,v_penalty,v_expense,v_debit_adjustment,v_payment
  from public.employee_payroll_entries
  where employee_id=p_employee_id and entry_date between v_from and v_to;

  v_credits := round(v_bonus+v_overtime+v_allowance+v_reimbursement+v_adjustment,2);
  v_debits := round(v_deduction+v_advance+v_penalty+v_expense+v_debit_adjustment,2);
  v_net := round(v_gross+v_credits-v_debits,2);
  v_outstanding := greatest(0,round(v_net-v_payment,2));
  v_liability := greatest(0,round(-v_net,2));
  v_overpaid := greatest(0,round(v_payment-greatest(v_net,0),2));

  return jsonb_build_object(
    'employee',to_jsonb(v_employee),'period_from',v_from,'period_to',v_to,'currency','AED',
    'gross_salary',v_gross,'credits',v_credits,'debits',v_debits,
    'bonuses',v_bonus,'overtime',v_overtime,'allowances',v_allowance,
    'reimbursements',v_reimbursement,'adjustments',v_adjustment,
    'deductions',v_deduction,'advances',v_advance,'penalties',v_penalty,
    'expenses',v_expense,'debit_adjustments',v_debit_adjustment,'payments',v_payment,
    'net_salary',v_net,'outstanding',v_outstanding,'employee_liability',v_liability,
    'overpaid',v_overpaid,'source','employee_payroll','linked_driver',false,
    'calculation_method','daily_proration_from_employee_salary_history',
    'salary_history',(
      select coalesce(jsonb_agg(to_jsonb(h) order by h.effective_from desc),'[]'::jsonb)
      from public.employee_salary_history h
      where h.employee_id=p_employee_id and h.effective_from<=v_to
        and (h.effective_to is null or h.effective_to>=v_from)
    ),
    'entries',(
      select coalesce(jsonb_agg(to_jsonb(e) order by e.entry_date desc,e.created_at desc),'[]'::jsonb)
      from public.employee_payroll_entries e
      where e.employee_id=p_employee_id and e.entry_date between v_from and v_to
    )
  );
end
$dn$;

alter table public.employees enable row level security;
alter table public.employee_salary_history enable row level security;
alter table public.employee_payroll_entries enable row level security;

drop policy if exists "admins manage employees" on public.employees;
create policy "admins manage employees" on public.employees for all to authenticated
using (public.employee_is_admin()) with check (public.employee_is_admin());
drop policy if exists "employee reads own profile" on public.employees;
create policy "employee reads own profile" on public.employees for select to authenticated
using (user_id=auth.uid() or public.employee_is_admin());

drop policy if exists "admins manage employee salary history" on public.employee_salary_history;
create policy "admins manage employee salary history" on public.employee_salary_history for all to authenticated
using (public.employee_is_admin()) with check (public.employee_is_admin());
drop policy if exists "employee reads own salary history" on public.employee_salary_history;
create policy "employee reads own salary history" on public.employee_salary_history for select to authenticated
using (public.employee_is_admin() or exists(select 1 from public.employees e where e.id=employee_id and e.user_id=auth.uid()));

drop policy if exists "admins manage employee payroll entries" on public.employee_payroll_entries;
create policy "admins manage employee payroll entries" on public.employee_payroll_entries for all to authenticated
using (public.employee_is_admin()) with check (public.employee_is_admin());
drop policy if exists "employee reads own payroll entries" on public.employee_payroll_entries;
create policy "employee reads own payroll entries" on public.employee_payroll_entries for select to authenticated
using (public.employee_is_admin() or exists(select 1 from public.employees e where e.id=employee_id and e.user_id=auth.uid()));

revoke all on public.employees,public.employee_salary_history,public.employee_payroll_entries from anon;
revoke insert,update,delete on public.employees,public.employee_salary_history,public.employee_payroll_entries from authenticated;
grant select on public.employees,public.employee_salary_history,public.employee_payroll_entries to authenticated;

revoke all on function public.admin_employee_directory() from public,anon;
revoke all on function public.admin_create_employee(jsonb) from public,anon;
revoke all on function public.admin_set_employee_salary(uuid,numeric,text,date,text) from public,anon;
revoke all on function public.admin_create_employee_payroll_entry(uuid,date,text,numeric,text,text,text) from public,anon;
revoke all on function public.admin_set_employee_payroll_entry_status(uuid,uuid,text,text) from public,anon;
revoke all on function public.admin_employee_payroll_snapshot(uuid,date,date) from public,anon;

grant execute on function public.admin_employee_directory() to authenticated;
grant execute on function public.admin_create_employee(jsonb) to authenticated;
grant execute on function public.admin_set_employee_salary(uuid,numeric,text,date,text) to authenticated;
grant execute on function public.admin_create_employee_payroll_entry(uuid,date,text,numeric,text,text,text) to authenticated;
grant execute on function public.admin_set_employee_payroll_entry_status(uuid,uuid,text,text) to authenticated;
grant execute on function public.admin_employee_payroll_snapshot(uuid,date,date) to authenticated;

commit;
