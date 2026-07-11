-- DAY NIGHT Admin Finance compatibility preflight
-- Runs before the full finance suite migration. It upgrades already-created
-- admin finance tables so CREATE OR REPLACE VIEW/RPC statements do not fail
-- on old schemas. Safe/no-op on fresh projects where the tables do not exist yet.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.admin_expenses') is not null then
    alter table public.admin_expenses add column if not exists expense_date date not null default current_date;
    alter table public.admin_expenses add column if not exists category text not null default 'other';
    alter table public.admin_expenses add column if not exists amount numeric(12,2) not null default 0;
    alter table public.admin_expenses add column if not exists vat_amount numeric(12,2) not null default 0;
    alter table public.admin_expenses add column if not exists payment_method text not null default 'cash';
    alter table public.admin_expenses add column if not exists status text not null default 'draft';
    alter table public.admin_expenses add column if not exists reference_number text;
    alter table public.admin_expenses add column if not exists receipt_url text;
    alter table public.admin_expenses add column if not exists notes text;
    alter table public.admin_expenses add column if not exists created_by uuid references auth.users(id);
    alter table public.admin_expenses add column if not exists approved_by uuid references auth.users(id);
    alter table public.admin_expenses add column if not exists approved_at timestamptz;
    alter table public.admin_expenses add column if not exists voided_at timestamptz;
    alter table public.admin_expenses add column if not exists created_at timestamptz not null default now();
    alter table public.admin_expenses add column if not exists updated_at timestamptz not null default now();
  end if;

  if to_regclass('public.admin_adjustments') is not null then
    alter table public.admin_adjustments add column if not exists adjustment_type text not null default 'manual';
    alter table public.admin_adjustments add column if not exists direction text not null default 'positive';
    alter table public.admin_adjustments add column if not exists amount numeric(12,2) not null default 0;
    alter table public.admin_adjustments add column if not exists order_id uuid;
    alter table public.admin_adjustments add column if not exists merchant_id uuid;
    alter table public.admin_adjustments add column if not exists driver_id uuid;
    alter table public.admin_adjustments add column if not exists reason text not null default 'Manual adjustment';
    alter table public.admin_adjustments add column if not exists notes text;
    alter table public.admin_adjustments add column if not exists status text not null default 'draft';
    alter table public.admin_adjustments add column if not exists created_by uuid references auth.users(id);
    alter table public.admin_adjustments add column if not exists approved_by uuid references auth.users(id);
    alter table public.admin_adjustments add column if not exists approved_at timestamptz;
    alter table public.admin_adjustments add column if not exists voided_at timestamptz;
    alter table public.admin_adjustments add column if not exists created_at timestamptz not null default now();
    alter table public.admin_adjustments add column if not exists updated_at timestamptz not null default now();
  end if;

  if to_regclass('public.cod_collections') is not null then
    alter table public.cod_collections add column if not exists order_id uuid;
    alter table public.cod_collections add column if not exists tracking_number text;
    alter table public.cod_collections add column if not exists merchant_id uuid;
    alter table public.cod_collections add column if not exists driver_id uuid;
    alter table public.cod_collections add column if not exists cod_amount numeric(12,2) not null default 0;
    alter table public.cod_collections add column if not exists collected_amount numeric(12,2) not null default 0;
    alter table public.cod_collections add column if not exists reconciled_amount numeric(12,2) not null default 0;
    alter table public.cod_collections add column if not exists collection_date date not null default current_date;
    alter table public.cod_collections add column if not exists status text not null default 'pending';
    alter table public.cod_collections add column if not exists payment_method text default 'cash';
    alter table public.cod_collections add column if not exists reference_number text;
    alter table public.cod_collections add column if not exists notes text;
    alter table public.cod_collections add column if not exists created_by uuid references auth.users(id);
    alter table public.cod_collections add column if not exists reconciled_by uuid references auth.users(id);
    alter table public.cod_collections add column if not exists reconciled_at timestamptz;
    alter table public.cod_collections add column if not exists created_at timestamptz not null default now();
    alter table public.cod_collections add column if not exists updated_at timestamptz not null default now();
  end if;

  if to_regclass('public.merchant_statement_entries') is not null then
    alter table public.merchant_statement_entries add column if not exists merchant_id uuid;
    alter table public.merchant_statement_entries add column if not exists order_id uuid;
    alter table public.merchant_statement_entries add column if not exists tracking_number text;
    alter table public.merchant_statement_entries add column if not exists entry_date date not null default current_date;
    alter table public.merchant_statement_entries add column if not exists entry_type text not null default 'manual';
    alter table public.merchant_statement_entries add column if not exists debit numeric(12,2) not null default 0;
    alter table public.merchant_statement_entries add column if not exists credit numeric(12,2) not null default 0;
    alter table public.merchant_statement_entries add column if not exists balance numeric(12,2) not null default 0;
    alter table public.merchant_statement_entries add column if not exists status text not null default 'posted';
    alter table public.merchant_statement_entries add column if not exists notes text;
    alter table public.merchant_statement_entries add column if not exists created_by uuid references auth.users(id);
    alter table public.merchant_statement_entries add column if not exists created_at timestamptz not null default now();
    alter table public.merchant_statement_entries add column if not exists updated_at timestamptz not null default now();
  end if;

  if to_regclass('public.driver_statement_entries') is not null then
    alter table public.driver_statement_entries add column if not exists driver_id uuid;
    alter table public.driver_statement_entries add column if not exists order_id uuid;
    alter table public.driver_statement_entries add column if not exists tracking_number text;
    alter table public.driver_statement_entries add column if not exists entry_date date not null default current_date;
    alter table public.driver_statement_entries add column if not exists entry_type text not null default 'manual';
    alter table public.driver_statement_entries add column if not exists debit numeric(12,2) not null default 0;
    alter table public.driver_statement_entries add column if not exists credit numeric(12,2) not null default 0;
    alter table public.driver_statement_entries add column if not exists balance numeric(12,2) not null default 0;
    alter table public.driver_statement_entries add column if not exists status text not null default 'posted';
    alter table public.driver_statement_entries add column if not exists notes text;
    alter table public.driver_statement_entries add column if not exists created_by uuid references auth.users(id);
    alter table public.driver_statement_entries add column if not exists created_at timestamptz not null default now();
    alter table public.driver_statement_entries add column if not exists updated_at timestamptz not null default now();
  end if;

  if to_regclass('public.admin_audit_events') is not null then
    alter table public.admin_audit_events add column if not exists entity_type text not null default 'admin';
    alter table public.admin_audit_events add column if not exists entity_id text;
    alter table public.admin_audit_events add column if not exists action text not null default 'event';
    alter table public.admin_audit_events add column if not exists before_data jsonb;
    alter table public.admin_audit_events add column if not exists after_data jsonb;
    alter table public.admin_audit_events add column if not exists metadata jsonb;
    alter table public.admin_audit_events add column if not exists actor_id uuid references auth.users(id);
    alter table public.admin_audit_events add column if not exists created_at timestamptz not null default now();
  end if;
end $$;
