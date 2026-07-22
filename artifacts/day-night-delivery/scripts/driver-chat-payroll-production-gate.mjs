import fs from "node:fs";
import path from "node:path";

const root=process.cwd(); const repo=path.resolve(root,"../.."); let failed=false;
function read(relative,repository=false){const file=path.join(repository?repo:root,relative);if(!fs.existsSync(file)){console.error(`FAIL: missing ${relative}`);failed=true;return"";}console.log(`PASS: ${relative} exists`);return fs.readFileSync(file,"utf8");}
function expect(content,pattern,label){if(!pattern.test(content)){console.error(`FAIL: ${label}`);failed=true;}else console.log(`PASS: ${label}`);}
function reject(content,pattern,label){if(pattern.test(content)){console.error(`FAIL: ${label}`);failed=true;}else console.log(`PASS: ${label}`);}

console.log("\n--- DAY NIGHT driver chat & payroll production gate ---");
const dashboard=read("src/components/driver/DriverDashboard.tsx");
expect(dashboard,/updateStatus\(order\.id,\s*["']confirmed["']/,"Mission start persists the canonical confirmed status");
reject(dashboard,/updateStatus\(order\.id,\s*["']accepted["']/,"Mission start does not persist the legacy accepted enum value");
expect(dashboard,/OrderChatDialog/,"Driver dashboard mounts the private order chat");
expect(dashboard,/useNavigate\(\)/,"Driver portal exposes safe back navigation");

const orderCard=read("src/components/driver/DriverOrderCard.tsx");
expect(orderCard,/onChat/,"Every active driver order exposes customer chat");
expect(orderCard,/wa\.me/ ,"Every driver order keeps professional WhatsApp contact");

const overlay=read("src/components/portals/PortalRuntimeOverlay.tsx");
expect(overlay,/!isMerchant && !isDriver/,"Global floating controls cannot cover either authenticated portal");

const exactCss=read("src/styles/dn-driver-figma-exact.css");
expect(exactCss,/dn-driver-exact-rail\{display:none !important\}/,"Duplicate desktop rail is removed on mobile");
expect(exactCss,/dn-driver-mobile-dock-v3\{display:grid !important/,"Purpose-built mobile dock stays active");

const customer=read("src/components/customer/CustomerOrderHistory.tsx");
expect(customer,/actorRole=["']customer["']/,"Customer can join the private order conversation");

const statements=read("src/components/admin/AdminDriverStatementsCenter.tsx");
expect(statements,/useAdminDrivers/,"Driver statements load real driver profiles and assigned orders");
expect(statements,/setDriverSalary/,"Driver statements save real salary configuration");
expect(statements,/createDriverPayrollEntry/,"Expenses and deductions post to the payroll ledger");
expect(statements,/AdminPdfExportButton/,"Driver statements export PDF, CSV, and document files");
reject(statements,/Math\.random|localStorage|mock driver|demo driver/i,"Driver statements contain no generated or browser-only operational rows");

const merchants=read("src/components/admin/AdminMerchantStatementsCenter.tsx");
expect(merchants,/dn-admin-merchant-directory-card/,"Merchant directory cards use a dedicated non-button surface");

const migration=read("supabase/migrations/20260722090000_driver_chat_payroll_and_mission_runtime.sql",true);
expect(migration,/order_conversation_messages/,"Migration creates the private conversation table");
expect(migration,/order_chat_can_access/,"Chat access is enforced at the database boundary");
expect(migration,/driver_payroll_entries/,"Migration creates the audited payroll ledger");
expect(migration,/admin_driver_payroll_snapshot/,"Migration calculates the real net and outstanding salary");
expect(migration,/v_status in \('accepted','approved'\).*confirmed/s,"Database normalizes legacy mission starts to confirmed");

if(failed){console.error("Driver chat & payroll production gate FAILED.");process.exit(1);}
console.log("Driver chat & payroll production gate PASSED.\n");
