import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];

function expect(file, patterns) {
  const source = read(file);
  for (const pattern of patterns) {
    const ok = pattern instanceof RegExp ? pattern.test(source) : source.includes(pattern);
    checks.push({ file, pattern: String(pattern), ok });
  }
}

expect("src/components/public/InternationalTrackingLiveMap.tsx", [
  "MapContainer",
  "TileLayer",
  "Polyline",
  "dn-it-live-plane-marker",
  "resolveInternationalMapPoints",
  "CITY_COORDINATES",
]);

expect("src/components/public/InternationalTrackingVisualBridge.tsx", [
  "dn-it-live-map-host",
  "dn-it-has-live-map",
  "scrollRestoration = \"manual\"",
  "fetchInternationalTracking",
  "dn-international-tracking-layout-fix.css",
]);

expect("src/components/admin/AdminInternationalOrdersWorkspace.tsx", [
  "AdminInternationalOrderTrackingActions",
  "PDF كل الطلبات",
  "matchesAdminSection(order, \"external\")",
  "dn-international-shipment-updated",
  "AdminDriverAssignmentModal",
]);

expect("src/components/admin/AdminInternationalOrderTrackingActions.tsx", [
  "إضافة رقم التتبع",
  "إرسال للعميل",
  "إرسال للتاجر",
  "registerAramexShipment",
  "buildInternationalTrackingWhatsappMessage",
  "AdminPdfExportButton",
]);

expect("src/components/admin/AdminSectionWorkspace.tsx", [
  "AdminInternationalOrdersWorkspace",
  "props.id === \"external\"",
]);

expect("src/lib/internationalTrackingLinks.ts", [
  "https://daynightae.com",
  "/international-tracking",
  "number",
]);

expect("src/lib/whatsapp.ts", [
  "normalizeWhatsAppPhone",
  "buildInternationalTrackingWhatsappMessage",
  "buildWhatsAppLink",
  "رقم التتبع الدولي",
]);

expect("src/styles/dn-international-live-map.css", [
  "body.dn-it-has-live-map .dn-it-map",
  "body.dn-it-has-live-map .dn-it-hero",
  ".dn-it-live-map__canvas",
  "@media (max-width: 760px)",
]);

expect("src/styles/dn-international-tracking-layout-fix.css", [
  "body:has(.dn-it-page)",
  ".dn-it-page .dn-it-shell",
  ".dn-it-page .dn-it-hero",
]);

expect("src/main.tsx", [
  "InternationalTrackingVisualBridge",
  "dn-international-live-map.css",
]);

const mainSource = read("src/main.tsx");
for (const forbidden of ["AdminInternationalTrackingRouteBridge", "AdminInternationalOrderWhatsappBridge"]) {
  checks.push({ file: "src/main.tsx", pattern: `forbidden:${forbidden}`, ok: !mainSource.includes(forbidden) });
}

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error("International tracking visual gate failed:");
  for (const failure of failed) console.error(`- ${failure.file}: ${failure.pattern}`);
  process.exit(1);
}

console.log(`International tracking visual gate passed (${checks.length} assertions).`);
