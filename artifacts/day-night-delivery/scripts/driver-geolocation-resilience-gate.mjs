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
  } else {
    console.log(`PASS: ${label}`);
  }
}

function reject(content, pattern, label) {
  if (pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

console.log("\n--- DAY NIGHT driver geolocation resilience gate ---");
const hook = read("src/hooks/useDriverLocation.ts");
const dashboard = read("src/components/driver/DriverDashboard.tsx");

expect(hook, /geolocationErrorMessage/, "Geolocation errors use a dedicated user-facing translator");
expect(hook, /يمكنك متابعة الطلب وتسجيل التسليم/, "Denied GPS explicitly states that delivery controls remain available");
expect(hook, /Location permission was denied[\s\S]*record delivery/, "English denied-GPS guidance remains non-blocking");
expect(hook, /permissionRef\.current === "denied"/, "Automatic GPS retries stop after a persistent denial");
expect(hook, /GPS permission denied; order controls remain available/, "Presence audit records non-blocking GPS denial");
reject(hook, /setError\(driverErrorMessage\(geoError\.message/, "Raw browser geolocation denial is not shown as an operation failure");
expect(dashboard, /await updateDriverOrderStatus\(orderId, status, note\)/, "Order status updates remain independent from GPS acquisition");
reject(dashboard, /gps\.permission[^\n]*updateDriverOrderStatus/, "Delivery/status persistence is not gated by GPS permission");

if (failed) {
  console.error("Driver geolocation resilience gate FAILED.");
  process.exit(1);
}

console.log("Driver geolocation resilience gate PASSED.\n");
