# DAY NIGHT DELIVERY SERVICES - Supabase Setup Guide

## Project Information

- **Project ID:** `ngdwybpgacauorygoedi`
- **Project URL:** https://ngdwybpgacauorygoedi.supabase.co
- **Company:** DAY NIGHT DELIVERY SERVICES (داي نايت لخدمات التوصيل والشحن)

## Quick Start

### 1. Run Migrations

Execute the following SQL files in order in the Supabase SQL Editor:

```bash
# Option A: Via Supabase CLI
supabase db reset  # Reset and apply all migrations

# Option B: Manual execution in SQL Editor
# Copy and paste each file content into Supabase SQL Editor:
# 1. supabase/migrations/001_core_tables.sql
# 2. supabase/migrations/002_core_rpcs.sql
# 3. supabase/migrations/003_seed_data.sql
```

### 2. Verify Setup

Run this query to verify tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- profiles
- zones
- cities
- pricing_rules
- international_rates
- orders
- order_status_history
- driver_profiles
- driver_locations
- invoices
- notifications
- error_logs
- performance_logs

### 3. Test RPC Functions

```sql
-- Test pricing calculation
SELECT public.calculate_delivery_price('Dubai', 'Abu Dhabi', 2);
-- Expected: {"base_price": 30, "total_price": 30, "service_type": "domestic_main"}

SELECT public.calculate_delivery_price('Dubai', 'Western Region', 3);
-- Expected: {"base_price": 50, "total_price": 50, "service_type": "domestic_extended"}

-- Test order creation (anonymous)
SELECT public.create_public_order('{
  "sender_name": "Test User",
  "sender_phone": "+971501234567",
  "pickup_city": "Dubai",
  "pickup_address": "Test Address 1",
  "receiver_name": "Test Receiver",
  "receiver_phone": "+971507654321",
  "delivery_city": "Abu Dhabi",
  "delivery_address": "Test Address 2",
  "package_type": "document",
  "weight_kg": 2,
  "service_type": "domestic",
  "payment_method": "cod"
}'::jsonb);

-- Test tracking
SELECT public.track_public_order('DN-2025-00001');
```

## Environment Variables

Create a `.env` file in your project root:

```env
VITE_SUPABASE_URL=https://ngdwybpgacauorygoedi.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_vVsZNbg6kYyNkduCYm-N2w_2fXvyoOm
```

## Security Notes

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

| Table | Read Access | Write Access |
|-------|-------------|--------------|
| profiles | Own profile, Admins all | Own profile, Admins all |
| zones | Public (active only) | Admin only |
| cities | Public (active only) | Admin only |
| pricing_rules | Public (active only) | Admin only |
| international_rates | Public (active only) | Admin only |
| orders | Own orders, Admin/Support/Driver all | RPC only for public, Admin/Support update |
| order_status_history | Related orders, Admin/Support/Driver | Admin/Support/Driver insert |
| driver_profiles | Own, Admins all | Admin only |
| driver_locations | Public | Own drivers |
| invoices | Own invoices, Admin/Support | System only |
| notifications | Own | Own update, System insert |
| error_logs | Admin only | System only |
| performance_logs | Admin only | System only |

### RPC Functions Security

| Function | Access | Purpose |
|----------|--------|---------|
| calculate_delivery_price | Public | Calculate delivery price |
| create_public_order | Public (anon) | Create new order |
| track_public_order | Public (anon) | Track order (safe data only) |
| admin_update_order_status | Authenticated (Admin/Support) | Update order status |
| driver_update_location | Authenticated (Driver) | Update driver GPS |
| assign_driver_to_order | Authenticated (Admin) | Assign driver to order |

## Pricing Rules

### Domestic UAE
- **Main Cities:** 30 AED (flat rate)
- **Extended Areas:** 50 AED (flat rate)

### GCC Countries
- **First 1 kg:** 95 AED
- **Each additional kg:** 45 AED

### Worldwide
- **First 1 kg:** 190 AED
- **Each additional kg:** 90 AED

**Note:** All prices include VAT. The frontend displays clean prices without separate VAT line items.

## Main Cities Covered

### UAE Main Zone (30 AED)
- Abu Dhabi
- Dubai
- Sharjah
- Ajman
- Umm Al Quwain
- Ras Al Khaimah
- Fujairah
- Al Ain
- Mussafah

### UAE Extended Zone (50 AED)
- Western Region (Al Dhafra)
- Remote areas

## Troubleshooting

### Issue: RPC function not found
**Solution:** Ensure migrations were run in order. Check function exists:
```sql
SELECT proname FROM pg_proc WHERE proname = 'calculate_delivery_price';
```

### Issue: RLS blocking access
**Solution:** Verify user role and policies:
```sql
SELECT * FROM public.profiles WHERE id = auth.uid();
```

### Issue: Price calculation returns wrong value
**Solution:** Check city zone assignment:
```sql
SELECT c.name_en, z.zone_type 
FROM public.cities c 
JOIN public.zones z ON c.zone_id = z.id;
```

## Next Steps

1. ✅ Run all migrations
2. ✅ Verify tables and functions
3. ✅ Test RPC functions
4. ✅ Configure frontend environment variables
5. ✅ Deploy frontend application
6. ⬜ Set up email provider (Resend/SendGrid)
7. ⬜ Configure storage buckets for invoices/signatures
8. ⬜ Set up monitoring and alerting

## Support

For issues or questions, contact the development team with:
- Error messages
- SQL queries attempted
- Expected vs actual results
