import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repo = path.resolve(root, "../..");
let failed = 0;

function read(relative, base = root) {
  const filename = path.join(base, relative);
  if (!fs.existsSync(filename)) {
    console.error(`FAIL missing ${path.relative(repo, filename)}`);
    failed += 1;
    return "";
  }
  return fs.readFileSync(filename, "utf8");
}

function expect(content, pattern, label) {
  if (pattern.test(content)) console.log(`PASS ${label}`);
  else {
    console.error(`FAIL ${label}`);
    failed += 1;
  }
}

function reject(content, pattern, label) {
  if (!pattern.test(content)) console.log(`PASS ${label}`);
  else {
    console.error(`FAIL ${label}`);
    failed += 1;
  }
}

console.log("\n--- DAY NIGHT merchant morning WhatsApp broadcast gate ---");

const center = read("src/components/admin/AdminMessageControlCenter.tsx");
const broadcast = read("src/components/admin/AdminMerchantMorningBroadcast.tsx");
const service = read("src/services/merchantMorningBroadcastService.ts");
const whatsapp = read("src/services/whatsappMessageService.ts");
const templates = read("src/config/messageTemplates.ts");
const edge = read("supabase/functions/merchant-morning-broadcast/index.ts", repo);
const migration = read(
  "supabase/migrations/20260731162000_merchant_morning_whatsapp_broadcast.sql",
  repo,
);
const config = read("supabase/config.toml", repo);

expect(center, /AdminMerchantMorningBroadcast/, "message center mounts the merchant broadcast workspace");
expect(broadcast, /subscribeMerchantMorningAudience/, "merchant audience updates in realtime");
expect(broadcast, /selectedMerchants\.length/, "operator sees the exact selected merchant count");
expect(broadcast, /sendMerchantMorningBroadcast/, "official send action is connected");
expect(broadcast, /startManualQueue[\s\S]*openNextManual/, "safe sequential WhatsApp Web fallback exists");
expect(broadcast, /cloud_configured/, "official provider readiness is visible before sending");
expect(broadcast, /window\.confirm/, "bulk sending requires explicit operator confirmation");
expect(service, /whatsapp_broadcast_enabled/, "new merchants are included by database default with opt-out support");
expect(service, /postgres_changes[\s\S]*table:\s*"merchants"/, "merchant changes refresh the live audience");
expect(service, /merchantMorningPreview/, "personalized merchant preview exists");
expect(whatsapp, /"merchant_orders_today"/, "existing central WhatsApp message service owns the template key");
expect(templates, /merchant_orders_today/, "built-in template fallback remains available");

expect(edge, /requireAdmin\(req\)/, "Edge Function enforces admin or support authentication");
expect(edge, /WHATSAPP_CLOUD_ACCESS_TOKEN/, "provider token is read only on the server");
expect(edge, /WHATSAPP_PHONE_NUMBER_ID/, "provider phone number ID is server-side");
expect(edge, /graph\.facebook\.com/, "official WhatsApp Business Platform endpoint is used");
expect(edge, /type:\s*"template"/, "automatic sending uses an approved WhatsApp template");
expect(edge, /sentTodayMerchantIds/, "same-day duplicate delivery protection is enforced server-side");
expect(edge, /mapWithConcurrency\(toSend,\s*4/, "provider calls are rate-limited in bounded batches");
expect(edge, /provider_message_id/, "provider message IDs are recorded for audit");
expect(edge, /status:\s*"failed"/, "per-recipient failures are retained instead of fake success");

expect(migration, /whatsapp_broadcast_enabled boolean not null default true/, "new merchants automatically enter the audience");
expect(migration, /merchant_broadcast_campaigns/, "campaign audit table exists");
expect(migration, /merchant_broadcast_recipients/, "recipient audit table exists");
expect(migration, /unique\(campaign_id, merchant_id\)/, "one campaign cannot duplicate a merchant");
expect(migration, /merchant_morning_broadcast_health/, "database health check exists");
expect(migration, /السلام عليكم ورحمة الله وبركاته يا \{merchant_name\}/, "Arabic message is personalized by merchant name");
expect(config, /\[functions\.merchant-morning-broadcast\][\s\S]*verify_jwt\s*=\s*false/, "function gateway mode matches internal role verification");

const frontend = `${center}\n${broadcast}\n${service}\n${whatsapp}\n${templates}`;
reject(frontend, /WHATSAPP_CLOUD_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID/, "browser source never references provider secrets");
reject(frontend, /graph\.facebook\.com/, "browser never sends directly to Meta Graph API");
reject(edge, /console\.log\([^\n]*(accessToken|authorization)/i, "server never logs credentials");
reject(broadcast, /setInterval\([^\n]*window\.open/i, "UI does not spam pop-up windows automatically");

if (failed) {
  console.error(`Merchant morning broadcast gate FAILED with ${failed} error(s).`);
  process.exit(1);
}
console.log("Merchant morning broadcast gate PASSED.\n");
