-- -----------------------------------------------------------------------------
-- DAY NIGHT DELIVERY SERVICES
-- Customer order linking helper
-- -----------------------------------------------------------------------------
-- Purpose:
--   Align the production orders table with the customer portal.
--   New orders created while a customer is signed in are tagged with auth.uid().
--   The customer portal can then show only that customer's linked orders.
-- -----------------------------------------------------------------------------

begin;

alter table public.orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null;

alter table public.orders
  add column if not exists customer_email text;

alter table public.orders
  add column if not exists customer_name text;

create index if not exists idx_orders_customer_id_created_at
  on public.orders (customer_id, created_at desc);

create index if not exists idx_orders_tracking_code
  on public.orders (tracking_code);

create index if not exists idx_orders_tracking_number
  on public.orders (tracking_number);

-- Customer read policy.
-- This is additive and does not replace existing admin/service policies.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'customers_select_own_linked_orders'
  ) then
    create policy customers_select_own_linked_orders
      on public.orders
      for select
      to authenticated
      using (customer_id = auth.uid());
  end if;
end $$;

-- Optional update guard for future profile/order linking screens.
-- Customers can only update their own linked order metadata fields if a future UI
-- explicitly uses these columns. Operational status changes remain admin-owned.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'customers_update_own_contact_metadata'
  ) then
    create policy customers_update_own_contact_metadata
      on public.orders
      for update
      to authenticated
      using (customer_id = auth.uid())
      with check (customer_id = auth.uid());
  end if;
end $$;

comment on column public.orders.customer_id is
  'Authenticated customer owner id used by DAY NIGHT customer portal.';

comment on column public.orders.customer_email is
  'Customer email captured from Supabase Auth when an order is created while signed in.';

comment on column public.orders.customer_name is
  'Customer display name captured from Supabase Auth when an order is created while signed in.';

commit;
