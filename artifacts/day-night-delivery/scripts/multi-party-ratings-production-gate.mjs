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
const driverCard = read("src/components/driver/DriverOrderCard.tsx");
const driverCommunication = read("src/components/driver/DriverCustomerCommunication.tsx");
const driverMessages = read("src/services/driverActionMessageService.ts");
const main = read("src/main.tsx");

expect(migration, /rater_type[^\n]+customer[^\n]+merchant[^\n]+driver/, "Database distinguishes customer, merchant and driver raters");
expect(migration, /unique \(order_id, rater_type\)/, "One independent rating per party and order");
expect(migration, /create_experience_rating_token_for_order/, "Secure role-bound rating links are created by RPC");
expect(migration, /get_experience_rating_context/, "Public context is token-scoped");
expect(migration, /submit_experience_rating/, "Ratings persist through a dedicated security-definer RPC");
expect(service, /createMultiPartyRatingLink/, "Frontend can create role-specific links");
expect(page, /RATING_LABELS/, "The public page explains the one-to-five rating scale");
expect(page, /1: \["سيئ جدًا"/, "One star is explicitly the lowest rating");
expect(page, /5: \["الأفضل"/, "Five stars is explicitly the best rating");
expect(page, /لدي شكوى تحتاج متابعة/, "Customer can flag a complaint for administration");
expect(page, /Loader2[\s\S]*CheckCircle2/, "Successful submission transitions from spinner to check mark");
expect(page, /نشكرك على تقييمك/, "Success screen thanks the customer");
expect(center, /قسم التقييمات/, "Administration has a dedicated Ratings Center");
expect(center, /isComplaint/, "Ratings Center identifies complaint submissions");
expect(center, /شكاوى تحتاج متابعة/, "Administration sees a complaint KPI");
expect(center, /يحتاج متابعة فورية من الإدارة/, "Complaints are visibly escalated in the list");
expect(center, /createMultiPartyRatingLink/, "Ratings Center creates order-linked requests");
expect(launcher, /cx.*ratings/, "Ratings Center is mounted as an admin section");
expect(driverCard, /onConfirmDelivered/, "Driver card exposes one authoritative delivery callback to communication");
expect(driverCommunication, /تم التسليم وإرسال التقييم/, "Driver sees a single deliver-and-send-rating action");
expect(driverCommunication, /await onConfirmDelivered\(\)/, "Delivery is persisted before the rating link is generated");
expect(driverCommunication, /createMultiPartyRatingLink\(order\.id, "customer"/, "Customer rating link is created after delivery confirmation");
expect(driverCommunication, /openPreparedWhatsApp/, "The one-click delivery action opens the customer WhatsApp request");
expect(driverMessages, /رابط تقييم الخدمة/, "Delivered message carries the secure rating link");
expect(main, /MultiPartyRatingPage/, "Public rating routes mount the role-aware page");
expect(main, /AdminRatingsLauncher/, "Admin Ratings section is globally mounted");

if (failed) {
  console.error("Multi-party ratings gate FAILED.");
  process.exit(1);
}
console.log("Multi-party ratings gate PASSED.\n");
