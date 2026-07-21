import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repositoryRoot = path.resolve(root, "../..");
let failed = false;

function read(relative, fromRepository = false) {
  const base = fromRepository ? repositoryRoot : root;
  const file = path.join(base, relative);
  if (!fs.existsSync(file)) {
    console.error(`FAIL: missing ${relative}`);
    failed = true;
    return "";
  }
  console.log(`PASS: ${relative} exists`);
  return fs.readFileSync(file, "utf8");
}

function expect(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

console.log("\n--- DAY NIGHT runtime live-feature gate ---");

const tracking = read("src/components/tracking/TrackingMap.tsx");
expect(tracking, /tracking_live_driver_location/, "Tracking map reads the authorized live-location RPC");
expect(tracking, /status === ["']out_for_delivery["']/, "Tracking map gates customer/merchant live location to out_for_delivery");
expect(tracking, /driver_locations/, "Tracking map subscribes to real driver location changes");
expect(tracking, /DayNightVehicleMarker/, "Tracking map renders the official DAY NIGHT vehicle marker");
expect(tracking, /Waiting for the driver's first GPS update|بانتظار أول تحديث GPS/, "Tracking map reports missing GPS truthfully");
if (/interpolate\(|progressFromStatus/.test(tracking)) {
  console.error("FAIL: Tracking map still fabricates an estimated driver position");
  failed = true;
} else {
  console.log("PASS: Tracking map does not fabricate driver positions");
}

const customer = read("src/components/customer/CustomerDashboard.tsx");
expect(customer, /CustomerOrderHistory/, "Customer dashboard mounts the order-history component");
expect(customer, /postgres_changes[\s\S]*table:\s*["']orders["']/, "Customer dashboard refreshes from order realtime changes");

const history = read("src/components/customer/CustomerOrderHistory.tsx");
expect(history, /Order history|سجل الطلبات/, "Customer order history has a dedicated final-history section");
expect(history, /delivered_at|delivery_date|completed_at/, "Customer history resolves the final delivery date");
expect(history, /sendDeliveryConfirmationEmail/, "Customer history exposes authenticated confirmation email sending");
expect(history, /FINAL_STATUSES/, "Customer history separates active and final deliveries");

const emailService = read("src/lib/deliveryConfirmationEmail.ts");
expect(emailService, /\/api\/delivery-confirmation/, "Client email service calls the protected API route");
expect(emailService, /access_token/, "Client email service forwards the authenticated Supabase token");

const api = read("api/delivery-confirmation.js", true);
expect(api, /GMAIL_USER/, "Email API uses a server-only Gmail sender account");
expect(api, /GMAIL_APP_PASSWORD/, "Email API uses a server-only Gmail App Password");
expect(api, /smtp\.gmail\.com/, "Email API delivers through Gmail SMTP");
expect(api, /SUPABASE_SERVICE_ROLE_KEY/, "Email API uses the service role only on the server");
expect(api, /verifyUser/, "Email API validates authenticated users");
expect(api, /delivery_confirmation_outbox/, "Email API processes the durable email outbox");
expect(api, /CRON_SECRET/, "Email outbox processor is protected by the Vercel cron secret");
if (/RESEND_API_KEY|api\.resend\.com/.test(api)) {
  console.error("FAIL: Email API still contains Resend credentials or endpoints");
  failed = true;
} else {
  console.log("PASS: Email API no longer depends on Resend");
}

const migration = read("supabase/migrations/20260721190000_runtime_delivery_verification_and_email.sql", true);
expect(migration, /tracking_live_driver_location/, "Migration defines secure live-driver location access");
expect(migration, /public_customer_order_history/, "Migration defines authenticated customer history");
expect(migration, /delivery_confirmation_outbox/, "Migration defines the delivery email outbox");
expect(migration, /admin_delivery_runtime_snapshot/, "Migration defines the admin runtime verification snapshot");
expect(migration, /dn_orders_set_delivered_at/, "Migration persists the final delivery timestamp");
expect(migration, /^begin;[\s\S]*commit;\s*$/m, "Runtime migration is transaction wrapped");

const runtimeE2E = read("scripts/runtime-delivery-e2e.mjs");
for (const label of [
  "Merchant creates real order",
  "Admin sees merchant order",
  "Admin assigns real driver",
  "Driver sees only assigned order",
  "Driver live location write",
  "Merchant live tracking RPC",
  "COD collection is real",
  "Merchant settlement entry is real",
  "Pickup request creation",
  "Branch, pickup, and document reload",
  "Delivery confirmation API sends email",
]) expect(runtimeE2E, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Runtime E2E covers: ${label}`);

const vercel = read("vercel.json", true);
expect(vercel, /"path"\s*:\s*"\/api\/delivery-confirmation"/, "Vercel schedules the protected confirmation outbox route");
expect(vercel, /"source"\s*:\s*"\/\(\(\?!api/, "SPA rewrite continues to exclude API routes");

if (failed) {
  console.error("Runtime live-feature gate FAILED.");
  process.exit(1);
}

console.log("All runtime live-feature checks PASSED.\n");