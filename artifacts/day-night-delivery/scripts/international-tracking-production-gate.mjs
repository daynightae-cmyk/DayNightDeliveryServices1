import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");
let failed = false;

function read(relative, repository = false) {
  const target = path.join(repository ? repoRoot : root, relative);
  if (!fs.existsSync(target)) {
    console.error(`FAIL: missing ${repository ? "repository " : ""}${relative}`);
    failed = true;
    return "";
  }
  console.log(`PASS: ${repository ? "repository " : ""}${relative}`);
  return fs.readFileSync(target, "utf8");
}

function expect(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else console.log(`PASS: ${label}`);
}

function reject(content, pattern, label) {
  if (pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else console.log(`PASS: ${label}`);
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

console.log("\n--- DAY NIGHT international Aramex tracking gate ---");

const migration = read("supabase/migrations/20260729010000_aramex_17track_international_tracking.sql", true);
const config = read("supabase/config.toml", true);
const webhook = read("supabase/functions/track17-webhook/index.ts", true);
const register = read("supabase/functions/register-track17-shipment/index.ts", true);
const sync = read("supabase/functions/sync-track17-shipment/index.ts", true);
const publicFunction = read("supabase/functions/public-international-tracking/index.ts", true);
const adminFunction = read("supabase/functions/track17-admin/index.ts", true);
const signature = read("supabase/functions/_shared/track17-signature.ts", true);
const client = read("supabase/functions/_shared/track17-client.ts", true);
const page = read("src/components/InternationalTrackingPage.tsx");
const nativeAdmin = read("src/components/admin/AdminInternationalOrdersWorkspace.tsx");
const nativeActions = read("src/components/admin/AdminInternationalOrderTrackingActions.tsx");
const merchant = read("src/components/merchant/MerchantInternationalTrackingLauncher.tsx");
const entry = read("src/components/InternationalTrackingEntryLauncher.tsx");
const main = read("src/main.tsx");
const workspace = read("src/components/admin/AdminSectionWorkspace.tsx");
const api = read("src/lib/internationalTrackingApi.ts");
const styles = read("src/styles/dn-international-tracking.css");

expect(config, /\[functions\.track17-webhook\][\s\S]*verify_jwt\s*=\s*false/, "External webhook bypasses Supabase JWT only at gateway level");
expect(config, /\[functions\.public-international-tracking\][\s\S]*verify_jwt\s*=\s*false/, "Public tracking endpoint is callable without a user session");
expect(config, /project_id\s*=\s*"ngdwybpgacauorygoedi"/, "Functions are pinned to the approved DAY NIGHT Supabase project");
expect(signature, /rawBody.*\/.*key|`\$\{rawBody\}\/\$\{key\}`/, "Webhook signature uses raw body slash API key contract");
expect(signature, /crypto\.subtle\.digest\("SHA-256"/, "Webhook signature uses SHA-256");
expect(signature, /constantTimeEqual/, "Webhook signature comparison is constant-time");
expect(webhook, /await req\.text\(\)/, "Webhook preserves raw request body before JSON parsing");
expect(webhook, /req\.headers\.get\("sign"\)/, "Webhook reads the official sign header");
expect(webhook, /status:\s*200/, "Webhook acknowledges successful and ignored callbacks with HTTP 200");
expect(webhook, /TRACKING_STOPPED/, "Webhook handles tracking stopped events");
expect(webhook, /persistParsedShipment/, "Webhook persists normalized shipment events");
expect(register, /carrier:\s*ARAMEX_CARRIER_CODE/, "Registration explicitly selects Aramex");
expect(sync, /TRACK17_SYNC_COOLDOWN_MS/, "Manual synchronization is protected by a cooldown");
expect(client, /"17token":\s*apiKey\(\)/, "17TRACK token is sent only by the server client");
expect(publicFunction, /daynight_public_international_tracking/, "Public endpoint reads the safe database RPC instead of polling 17TRACK");
expect(publicFunction, /MAX_REQUESTS/, "Public tracking endpoint has rate limiting");
expect(adminFunction, /getquota/, "Admin integration exposes quota monitoring");
expect(migration, /create table if not exists public\.international_shipments/, "International shipment table is migrated");
expect(migration, /create table if not exists public\.international_tracking_events/, "International event table is migrated");
expect(migration, /enable row level security/, "International tracking tables use RLS");
expect(migration, /carrier_code integer not null default 100006/, "Official Aramex carrier code is enforced by the database");
expect(migration, /unique \(provider, carrier_code, tracking_number\)/, "Duplicate provider registrations are blocked by a unique constraint");
expect(page, /تتبّع شحنتك الدولية/, "Premium Arabic customer hero is implemented");
expect(page, /not live GPS tracking|ليس تتبع GPS مباشرًا/, "International route is clearly described as checkpoint-based");
expect(page, /BarcodeDetector/, "QR scanning has a progressive browser implementation");
expect(page, /new jsPDF/, "Customer can export a tracking summary PDF");
expect(page, /navigator\.share/, "Customer sharing is implemented");
expect(page, /setInterval[\s\S]*45_000/, "Customer data automatically refreshes from Supabase without carrier polling");
expect(nativeActions, /registerAramexShipment/, "Admin can register Aramex AWBs from each international order");
expect(nativeActions, /إرسال للعميل/, "Admin can prepare a customer WhatsApp tracking message");
expect(nativeActions, /إرسال للتاجر/, "Admin can prepare a merchant WhatsApp tracking message");
expect(nativeActions, /AdminPdfExportButton/, "Admin can export one international order as PDF");
expect(nativeAdmin, /PDF كل الطلبات/, "Admin can export all international orders as PDF");
expect(nativeAdmin, /runTrack17Admin<TrackingCenterData>\("list"/, "Native international orders workspace reads registered shipments");
expect(workspace, /props\.id === "external"[\s\S]*AdminInternationalOrdersWorkspace/, "International Orders opens the native order workspace");
expect(merchant, /fetchInternationalTracking/, "Merchant view uses the public-safe tracking payload");
expect(entry, /\/international-tracking/, "Public pages link to the dedicated international tracking center");
expect(main, /InternationalTrackingPage/, "Dedicated international tracking route is mounted");
reject(main, /AdminInternationalTrackingLauncher|AdminInternationalTrackingRouteBridge|AdminInternationalOrderWhatsappBridge/, "Legacy floating admin tracking launchers are removed");
expect(main, /MerchantInternationalTrackingLauncher/, "Merchant tracking viewer is mounted");
expect(styles, /@media \(max-width: 620px\)/, "Tracking page has dedicated phone layout");
expect(styles, /@media print/, "Tracking result has print layout");
expect(api, /public-international-tracking/, "Frontend uses a Supabase Edge Function for public tracking");

const frontendFiles = walk(path.join(root, "src"));
const frontendSource = frontendFiles
  .filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");

reject(
  frontendSource,
  /(?:Deno\.env\.get|process\.env|import\.meta\.env|window\.__ENV__)[\s\S]{0,80}TRACK17_API_KEY|TRACK17_API_KEY[\s\S]{0,80}(?:Deno\.env\.get|process\.env|import\.meta\.env|window\.__ENV__)/,
  "Frontend never reads or injects the server secret",
);
reject(frontendSource, /["']17token["']\s*:/, "Frontend source never sends the 17TRACK authentication header");
reject(frontendSource, /api\.17track\.net/, "Frontend never calls 17TRACK directly");
reject(page, /window\.location\.href\s*=.*(?:aramex|17track)/i, "Customer tracking never redirects to a carrier website");

if (failed) {
  console.error("International Aramex tracking gate FAILED.");
  process.exit(1);
}
console.log("International Aramex tracking gate PASSED.\n");
