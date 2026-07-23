# DAY NIGHT Customer Experience — Production Deployment Runbook

This runbook applies to the Smart WhatsApp Messaging, Feedback and Complaints system.

## 1. Required migration order

Apply the migrations in timestamp order:

1. `20260723140000_smart_whatsapp_feedback_complaints.sql`
2. `20260723140500_customer_experience_runtime_health.sql`
3. `20260723141000_customer_experience_privacy_actions.sql`
4. `20260723141500_customer_experience_rls_storage_hardening.sql`
5. `20260723142000_customer_experience_pii_hash_hardening.sql`

Using the Supabase CLI from the repository root:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push --password "$SUPABASE_DB_PASSWORD"
```

Never place the database password, service-role key, access token or test-account passwords in the repository or command history.

## 2. Database health proof

After migration deployment, run in Supabase SQL Editor or through the public RPC:

```sql
select public.customer_experience_runtime_health();
```

Expected result:

- `ok: true`
- `missing_tables: []`
- `rls_missing: []`
- `realtime_missing: []`
- `attachment_bucket: true`
- all required RPC flags are `true`

## 3. Protected live acceptance test

GitHub Actions contains:

```text
Customer Experience Runtime E2E
```

It uses the protected `production-runtime-tests` environment. The workflow:

- authenticates the existing protected merchant, admin and driver test accounts;
- creates a temporary real merchant order;
- assigns the real test driver;
- transitions the order to delivered;
- creates a secure feedback token;
- verifies the public context exposes no internal IDs;
- submits and updates one feedback row;
- confirms the driver sees only an aggregate summary;
- confirms merchant feedback access is row/column safe;
- submits a complaint and rejects an immediate duplicate;
- uploads and registers a private PNG attachment;
- checks complaint RLS;
- changes complaint status and verifies the event audit;
- publishes feedback through the admin RPC;
- rejects an unknown message-template variable;
- logs accurate `generated` and `opened` WhatsApp states;
- verifies the administration notification;
- removes temporary storage objects and the temporary order, which cascades the test feedback and complaint records.

Do not enable **keep test data** except for a supervised visual review.

## 4. Application routes

- Secure feedback: `/feedback/:secureToken`
- Alternate secure feedback route: `/rate/:secureToken`
- Admin Customer Experience: `/admin/customer-experience`
- Tracking with automatic search: `/tracking?number=DN-...`
- Merchant portal: `/merchant`
- Driver portal: `/driver`

## 5. WhatsApp delivery-state accuracy

The web-link integration can prove only:

- `generated`
- `opened`
- `copied`
- `failed`

It must never write `delivered` unless a future official WhatsApp Business API webhook confirms delivery.

## 6. Rollback

The migrations intentionally avoid destructive changes to existing orders, merchants, driver profiles and notifications. If the feature must be disabled without dropping data:

```sql
update public.customer_experience_settings
set feedback_enabled=false,
    complaint_enabled=false,
    updated_at=now()
where id=true;

update public.message_templates
set is_active=false,
    updated_at=now();
```

Do not drop feedback, complaint, audit or message-log tables during an incident; retain them for investigation.
