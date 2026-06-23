-- ============================================================
-- DN_SAFE_PRICING_HELPER_PATCH.sql
-- Targeted fix for pricing helper functions
-- Idempotent, no data loss, no table resets
-- ============================================================

-- Create pricing KV table if it doesn't exist
create table if not exists public.daynight_pricing_kv (
  setting_key text primary key,
  setting_value numeric not null,
  description text,
  updated_at timestamptz default now()
);

-- Upsert exact pricing values
insert into public.daynight_pricing_kv (setting_key, setting_value, description)
values
  ('vat_rate', 0.05, 'VAT rate for all pricing'),
  ('local_main_base', 30.00, 'Domestic main cities base price'),
  ('local_extended_base', 50.00, 'Domestic extended areas base price'),
  ('express_surcharge', 15.00, 'Express delivery surcharge'),
  ('gcc_first_kg', 95.00, 'GCC first kg price'),
  ('gcc_additional_kg', 45.00, 'GCC additional kg price'),
  ('worldwide_first_kg', 190.00, 'Worldwide first kg price'),
  ('worldwide_additional_kg', 90.00, 'Worldwide additional kg price'),
  ('europe_first_kg', 190.00, 'Europe first kg price'),
  ('europe_additional_kg', 90.00, 'Europe additional kg price'),
  ('usa_first_kg', 190.00, 'USA first kg price'),
  ('usa_additional_kg', 90.00, 'USA additional kg price'),
  ('canada_first_kg', 190.00, 'Canada first kg price'),
  ('canada_additional_kg', 90.00, 'Canada additional kg price'),
  ('australia_first_kg', 190.00, 'Australia first kg price'),
  ('australia_additional_kg', 90.00, 'Australia additional kg price')
on conflict (setting_key) do update set
  setting_value = excluded.setting_value,
  description = excluded.description,
  updated_at = now();

-- Recreate dn_price_setting function with alias support
create or replace function public.dn_price_setting(p_key text)
returns numeric
language sql
stable
set search_path = public
as $$
  select setting_value
  from public.daynight_pricing_kv
  where setting_key = 
    case
      when p_key in ('vat_rate') then 'vat_rate'
      when p_key in ('local_main_base', 'domestic_main', 'main_base') then 'local_main_base'
      when p_key in ('local_extended_base', 'domestic_extended', 'extended_base') then 'local_extended_base'
      when p_key in ('express_surcharge') then 'express_surcharge'
      when p_key in ('gcc_first_kg', 'gcc_first', 'gcc_base') then 'gcc_first_kg'
      when p_key in ('gcc_additional_kg', 'gcc_additional') then 'gcc_additional_kg'
      when p_key in ('worldwide_first_kg', 'world_first_kg', 'worldwide_first', 
                     'usa_first_kg', 'europe_first_kg', 'canada_first_kg', 'australia_first_kg') 
        then 'worldwide_first_kg'
      when p_key in ('worldwide_additional_kg', 'world_additional_kg', 'worldwide_additional',
                     'usa_additional_kg', 'europe_additional_kg', 'canada_additional_kg', 'australia_additional_kg')
        then 'worldwide_additional_kg'
      else null
    end;
$$;

-- Recreate calculate_international_price with safe fallback constants
create or replace function public.calculate_international_price(
  p_destination text,
  p_weight_kg numeric default 1
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_destination text := upper(coalesce(p_destination, ''));
  v_billable numeric := greatest(1, ceil(coalesce(p_weight_kg, 1)));
  v_is_gcc boolean;
  v_is_worldwide boolean;
  v_first numeric(12,2);
  v_additional numeric(12,2);
  v_subtotal numeric(12,2);
  v_vat numeric(12,2);
  v_total numeric(12,2);
  v_vat_rate numeric(6,4) := coalesce(public.dn_price_setting('vat_rate'), 0.05);
  v_region text;
begin
  -- Determine region and pricing tier
  v_is_gcc := v_destination in ('SA', 'KSA', 'QA', 'KW', 'OM', 'BH', 'GCC');
  v_is_worldwide := not v_is_gcc;
  
  if v_is_gcc then
    v_first := coalesce(public.dn_price_setting('gcc_first_kg'), 95.00);
    v_additional := coalesce(public.dn_price_setting('gcc_additional_kg'), 45.00);
    v_region := 'GCC';
  else
    v_first := coalesce(public.dn_price_setting('worldwide_first_kg'), 190.00);
    v_additional := coalesce(public.dn_price_setting('worldwide_additional_kg'), 90.00);
    v_region := 'WORLDWIDE';
  end if;

  -- Calculate pricing
  v_subtotal := round(v_first + ((v_billable - 1) * v_additional), 2);
  v_vat := round(v_subtotal * v_vat_rate, 2);
  v_total := round(v_subtotal + v_vat, 2);

  return jsonb_build_object(
    'country_code', v_destination,
    'region', v_region,
    'weight_kg', coalesce(p_weight_kg, 1),
    'billable_weight_kg', v_billable,
    'first_kg', v_first,
    'additional_kg', v_additional,
    'subtotal', v_subtotal,
    'vat_rate', v_vat_rate,
    'vat_amount', v_vat,
    'total', v_total,
    'currency', 'AED'
  );
end;
$$;

-- Grant permissions
grant select on public.daynight_pricing_kv to anon, authenticated;
grant execute on function public.dn_price_setting(text) to anon, authenticated;
grant execute on function public.calculate_international_price(text, numeric) to anon, authenticated;

-- Reload schema cache
notify pgrst, 'reload schema';

-- Final verification
select 
  'PRICING_PATCH_VERIFICATION' as status,
  public.dn_price_setting('gcc_first_kg') as gcc_first,
  public.dn_price_setting('gcc_additional_kg') as gcc_additional,
  public.dn_price_setting('worldwide_first_kg') as worldwide_first,
  public.dn_price_setting('worldwide_additional_kg') as worldwide_additional,
  (public.calculate_international_price('SA', 3)->>'total')::numeric as saudi_3kg,
  (public.calculate_international_price('US', 2)->>'total')::numeric as usa_2kg,
  (public.calculate_international_price('EUROPE', 2)->>'total')::numeric as europe_2kg;
