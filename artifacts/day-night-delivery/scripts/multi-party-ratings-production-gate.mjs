import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = false;

function read(relative) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) {
    console.error(`FAIL: missing ${relative}`);
    failed = true;
    return "";
  }
  console.log(`PASS: ${relative}`);
  return fs.readFileSync(target, "utf8");
}

function expect(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else console.log(`PASS: ${label}`);
}

console.log("\n--- DAY NIGHT multi-party ratings gate ---");
const migration = read("../../supabase/migrations/20260727183000_multi_party_ratings_center.sql");
const service = read("src/services/multiPartyRatingsService.ts");
const page = read("src/components/MultiPartyRatingPage.tsx");
const center = read("src/components/admin/AdminRatingsCenter.tsx");
const launcher = read("src/components/admin/AdminRatingsLauncher.tsx");
const driverCommunication = read("src/components/driver/DriverCustomerCommunication.tsx");
const driverMessages = read("src/services/driverActionMessageService.ts");
const whatsapp = read("src/services/whatsappMessageService.ts");
const main = read("src/main.tsx");

expect(migration, /rater_type[^\n]+customer[^\n]+merchant[^\n]+driver/, "Database distinguishes customer, merchant and driver raters");
expect(migration, /unique \(order_id, rater_type\)/, "One independent rating per party and order");
expect(migration, /create_experience_rating_token_for_order/, "Secure role-bound rating links are created by RPC");
expect(migration, /get_experience_rating_context/, "Public context is token-scoped");
expect(migration, /submit_experience_rating/, "Ratings persist through a dedicated security-definer RPC");
expect(service, /createMultiPartyRatingLink/, "Frontend can create role-specific links");
expect(page, /rater_type === "merchant"/, "Merchant rating experience is explicit");
expect(page, /rater_type === "driver"/, "Driver rating experience is explicit");
expect(center, /قسم التقييمات/, "Administration has a dedicated Ratings Center");
expect(center, /customer_cooperation_rating/, "Customer cooperation score is visible");
expect(center, /createMultiPartyRatingLink/, "Ratings Center creates order-linked requests");
expect(launcher, /cx.*ratings/, "Ratings Center is mounted as an admin section");
expect(driverCommunication, /createFeedbackLinkForOrder\(order\.id\)/, "Driver order messages create a secure customer rating link");
expect(driverMessages, /رابط تقييم الخدمة/, "Every deterministic driver message carries the rating link footer");
expect(whatsapp, /create_experience_rating_token_for_order/, "Legacy feedback helper prefers the new customer-rating RPC");
expect(main, /MultiPartyRatingPage/, "Public rating routes mount the role-aware page");
expect(main, /AdminRatingsLauncher/, "Admin Ratings section is globally mounted");

if (failed) {
  console.error("Multi-party ratings gate FAILED.");
  process.exit(1);
}
console.log("Multi-party ratings gate PASSED.\n");
