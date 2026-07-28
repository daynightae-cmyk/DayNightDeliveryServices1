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
]);

expect("src/components/admin/AdminInternationalOrderWhatsappBridge.tsx", [
  "إرسال للعميل",
  "إرسال للتاجر",
  "runTrack17Admin",
  "buildInternationalTrackingWhatsappMessage",
  "dn-intl-whatsapp-actions",
  "dn-international-shipment-updated",
  "refreshImmediately",
]);

expect("src/components/admin/AdminInternationalTrackingLauncher.tsx", [
  "announceInternationalShipmentUpdate",
  "dn-international-shipment-updated",
  "dn-it-admin-launch",
  "أزرار واتساب للعميل والتاجر أصبحت جاهزة",
]);

expect("src/components/admin/AdminInternationalTrackingRouteBridge.tsx", [
  "data-dn-track17-sidebar",
  ".dn-it-admin-launch",
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

expect("src/main.tsx", [
  "AdminInternationalOrderWhatsappBridge",
  "InternationalTrackingVisualBridge",
  "dn-international-live-map.css",
  "dn-international-whatsapp-actions.css",
]);

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error("International tracking visual gate failed:");
  for (const failure of failed) console.error(`- ${failure.file}: ${failure.pattern}`);
  process.exit(1);
}

console.log(`International tracking visual gate passed (${checks.length} assertions).`);
