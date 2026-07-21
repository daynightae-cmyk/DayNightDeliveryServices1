import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = false;

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`FAIL: missing ${relative}`);
    failed = true;
    return "";
  }
  console.log(`PASS: ${relative}`);
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

function reject(content, pattern, label) {
  if (pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

console.log("\n--- DAY NIGHT emergency production-core gate ---");

const adminMerchant = read("src/components/admin/AdminNewMerchant.tsx");
expect(adminMerchant, /createOpsMerchant/, "Admin merchant form calls the production merchant operation");
expect(adminMerchant, /onSaved\?\.\(saved\)/, "Admin merchant form refreshes state from the returned database row");
reject(adminMerchant, /localStorage|sessionStorage|Math\.random|mock|demo merchant/i, "Admin merchant creation has no browser-only or mock persistence");

const adminOrder = read("src/components/admin/AdminNewOrderFlexible.tsx");
expect(adminOrder, /createOpsOrder/, "Admin order form calls the production order operation");
expect(adminOrder, /!selectedMerchant/, "Admin order creation requires a real selected merchant");
expect(adminOrder, /onSaved\?\.\(saved\)/, "Admin order form refreshes from the returned saved row");
reject(adminOrder, /localStorage|sessionStorage|Math\.random|mock order|demo order/i, "Admin order creation has no browser-only or mock persistence");

const adminData = read("src/lib/adminOperationsData.ts");
expect(adminData, /from\(["']merchants["']\)[\s\S]*insert/, "Merchant creation writes to the merchants table when RPC compatibility is needed");
expect(adminData, /admin_create_merchant/, "Merchant creation uses the protected admin RPC");
expect(adminData, /admin_create_coupon_order/, "Order creation uses the protected admin order RPC");
expect(adminData, /from\(["']orders["']\)[\s\S]*insert/, "Order creation has a real database write fallback");
expect(adminData, /merchant_id:/, "Orders persist the merchant relationship");

const driverLogin = read("src/components/driver/DriverLogin.tsx");
expect(driverLogin, /signInWithPassword/, "Driver login uses Supabase authentication");
expect(driverLogin, /type=[{]showPassword \? ["']text["'] : ["']password["'][}]/, "Driver login includes a real password input");
reject(driverLogin, /hardcoded|demo password|mock login/i, "Driver login contains no demo credentials");

const driverCss = read("src/styles/dn-driver-mobile-auth-hotfix.css");
expect(driverCss, /dn-driver-auth-card[\s\S]*display:\s*flex\s*!important/, "Driver credential card is forced visible on phones");
expect(driverCss, /dn-driver-auth-visual[\s\S]*display:\s*none\s*!important/, "Driver marketing panel cannot push the login form below the mobile viewport");
expect(driverCss, /font-size:\s*16px\s*!important/, "Mobile inputs avoid browser zoom and remain usable");

const overlay = read("src/components/portals/PortalRuntimeOverlay.tsx");
expect(overlay, /dn-driver-mobile-auth-hotfix\.css/, "Mobile driver authentication hotfix is loaded after portal authentication styles");

const driverData = read("src/lib/driverData.ts");
for (const operation of [
  "driver_get_session_profile",
  "driver_report_location",
  "driver_set_presence",
  "driver_update_order_status",
  "admin_dispatch_order",
]) {
  expect(driverData, new RegExp(operation), `Driver runtime uses ${operation}`);
}
reject(driverData, /Math\.random|mock driver|demo order/i, "Driver runtime contains no fake assignments or GPS generation");

const merchantPortal = read("src/components/merchant/MerchantPortalCommandCenter.tsx");
for (const operation of [
  "merchant_get_session_profile",
  "merchant_portal_orders",
  "merchant_portal_business_center",
]) {
  expect(merchantPortal, new RegExp(operation), `Merchant portal uses ${operation}`);
}
reject(merchantPortal, /Math\.random|mock merchant|demo order/i, "Merchant command center contains no generated merchant/order data");

if (failed) {
  console.error("Production-core rescue gate FAILED.");
  process.exit(1);
}

console.log("Production-core rescue gate PASSED.\n");
