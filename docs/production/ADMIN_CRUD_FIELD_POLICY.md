# DAY NIGHT — Admin CRUD and Field Policy

## Scope

This policy applies to the administration workspace and keeps destructive actions visible without weakening operational history.

## Orders

Every order row in all order-status sections exposes three separate actions:

1. **Edit** — changes merchant, coupon, receiver, route, optional shipment details, payment, and pricing.
2. **Delete** — opens a dedicated protected deletion dialog.
3. **Assign/Reassign driver** — remains independent from general order editing.

Status changes remain independent because they create operational history.

### Required order fields

- Merchant
- Coupon number
- Receiver name
- Receiver phone

### Optional order fields

- Detailed address
- Package contents/description
- Weight and notes
- Manual price; system pricing remains the default
- Edit reason

COD amount becomes required only when COD is selected.

### Safe deletion

Deletion requires a written reason and writes a complete order snapshot to `admin_order_deletion_log` before the order is removed.

Deletion is blocked when the order:

- is assigned to a driver;
- is picked up or in transit;
- is delivered/completed;
- otherwise has an active workflow status.

Allowed deletion aliases include `review`/`under_review` and `cancelled`/`canceled`.

## Coupon integrity

Authenticated admin/support order writes require a coupon number. The same normalized coupon number cannot be reused for the same merchant. Public/historical orders are not globally converted to `NOT NULL`, avoiding a destructive migration.

## Other admin entities

- **Merchants:** status changes and deletion of merchants without linked orders are supported. Merchants with linked history should be paused/reviewed rather than hard-deleted.
- **Drivers:** profile editing and activate/suspend are supported. Hard deletion is intentionally avoided because assignments, GPS, COD, and event history depend on the driver identity.
- **Finance/audit:** immutable records should be voided or adjusted, not hard-deleted. Audit logs must remain immutable.
- **Imports:** validation/preview precedes committing real rows; invalid rows are not presented as successful imports.

## Production database step

Apply:

```sql
supabase/migrations/20260718193000_admin_crud_field_policy.sql
```

Then verify:

```sql
select public.admin_flexible_order_runtime_health();
select public.admin_crud_field_policy_health();
```

## Manual acceptance checks

1. Open each order section: All, Review, Postponed, Returned, Pickup, Abu Dhabi, International, Other Emirates, and Cancelled.
2. Confirm every order row shows separate **Edit**, **Delete**, and **Assign/Reassign** controls.
3. Confirm missing coupon number blocks new order creation and order editing.
4. Confirm duplicate coupon under the same merchant is rejected by the database.
5. Confirm the same coupon may be used by a different merchant only when business policy permits it.
6. Confirm assigned, active, and delivered orders cannot be deleted.
7. Confirm unassigned pending/review/confirmed/cancelled/returned orders require a deletion reason and create an audit row.
8. Confirm optional address/package fields may remain empty.
9. Confirm multi-piece quantities remain unchanged during editing.
10. Confirm `/auth`, `/admin`, `/tracking`, `/customer`, and `/driver` still load.
