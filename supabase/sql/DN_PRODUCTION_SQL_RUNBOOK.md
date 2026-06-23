# DN Production SQL Runbook

This runbook defines the required SQL execution order for DAY NIGHT DELIVERY SERVICES.

## Required Order

1. Run `DN_MASTER_PRODUCTION_FIX.sql`
2. Run `DN_SEED_BUSINESS_DATA.sql`
3. Run `DN_VERIFY_PRODUCTION.sql`

## Why This Order

- Master creates and hardens tables, functions, grants, and RPC behavior.
- Seed loads official business data and enables public read policies where needed.
- Verify executes non-destructive checks to validate pricing and tracking RPC behavior.

## Pre-Run Checklist

- Use a database owner/admin role in Supabase SQL editor.
- Confirm you are on the intended project.
- Confirm no secrets are pasted into SQL files.
- Ensure frontend does not use service role credentials.

## Post-Run Checklist

- Confirm `notify pgrst, 'reload schema';` was executed from master/seed.
- Run final gate from app workspace.
- Validate domestic and international pricing outputs.
- Validate `create_public_order` and `track_order` RPC flow.
