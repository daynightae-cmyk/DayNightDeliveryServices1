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

function reject(file, patterns) {
  const source = read(file);
  for (const pattern of patterns) {
    const ok = pattern instanceof RegExp ? !pattern.test(source) : !source.includes(pattern);
    checks.push({ file, pattern: `forbidden:${String(pattern)}`, ok });
  }
}

expect("src/components/public/InternationalTrackingLiveMap.tsx", [
  "MapContainer",
  "LayersControl",
  "Polyline",
  "greatCircle",
  "dn-it-live-plane-marker",
  "resolveInternationalMapPoints",
  "t.estimatedPosition",
  "internationalTrackingAssets.markers.aircraftDayNight",
]);

expect("src/components/InternationalTrackingPage.tsx", [
  'lazy(() => import("./public/InternationalTrackingLiveMap"))',
  "TrackingTopbar",
  "TrackingSearch",
  "ShipmentHero",
  "RouteProgressCard",
  "ShipmentMetricsGrid",
  "ShipmentTabs",
  "BarcodeDetector",
  "new jsPDF",
  "navigator.share",
  "setInterval",
  "45_000",
  "تتبّع شحنتك الدولية",
  "not live GPS tracking",
]);

expect("src/components/international-tracking/ShipmentWorkspace.tsx", [
  "ShipmentHero",
  "RouteProgressCard",
  "ShipmentTimeline",
  "ShipmentTabs",
  "protectedDocuments",
  "shipment.documents || []",
]);

expect("src/data/internationalTrackingAssets.ts", [
  "daynight-official-master-logo.png",
  "daynight-aircraft-side-transparent.png",
  "daynight-map-assets-master-sheet.png",
  "reservedAsset15: null",
  /\b(?:asset\(\s*33\s*,|id\s*:\s*33\b)/,
]);

expect("src/styles/dn-international-tracking.css", [
  "--dn-deep-navy:#020914",
  ".dn-it-workspace",
  ".dn-it-live-map__canvas",
  /@media\s*\(\s*max-width\s*:\s*620px\s*\)/,
  "@media print",
  "prefers-reduced-motion",
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

expect("src/main.tsx", ["InternationalTrackingPage"]);
reject("src/main.tsx", [
  "InternationalTrackingVisualBridge",
  "dn-international-live-map.css",
  "AdminInternationalTrackingRouteBridge",
  "AdminInternationalOrderWhatsappBridge",
]);

reject("src/components/InternationalTrackingPage.tsx", [
  "window.location.href =.*aramex",
  "api.17track.net",
  '"17token"',
]);

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error("International tracking visual gate failed:");
  for (const failure of failed) console.error(`- ${failure.file}: ${failure.pattern}`);
  process.exit(1);
}

console.log(`International tracking visual gate passed (${checks.length} assertions).`);
