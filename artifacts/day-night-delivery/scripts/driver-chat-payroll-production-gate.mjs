import fs from "node:fs";
import path from "node:path";

const root=process.cwd(); const repo=path.resolve(root,"../.."); let failed=false;
function read(relative,repository=false){const file=path.join(repository?repo:root,relative);if(!fs.existsSync(file)){console.error(`FAIL: missing ${relative}`);failed=true;return"";}console.log(`PASS: ${relative} exists`);return fs.readFileSync(file,"utf8");}
function expect(content,pattern,label){if(!pattern.test(content)){console.error(`FAIL: ${label}`);failed=true;}else console.log(`PASS: ${label}`);}
function reject(content,pattern,label){if(pattern.test(content)){console.error(`FAIL: ${label}`);failed=true;}else console.log(`PASS: ${label}`);}

console.log("\n--- DAY NIGHT driver operations and employee payroll separation gate ---");
const dashboard=read("src/components/driver/DriverDashboard.tsx");
expect(dashboard,/updateStatus\(order\.id,\s*["']confirmed["']/,"Mission start persists the canonical confirmed status");
reject(dashboard,/updateStatus\(order\.id,\s*["']accepted["']/,"Mission start does not persist the legacy accepted enum value");
expect(dashboard,/OrderChatDialog/,"Driver dashboard mounts the private order chat");
expect(dashboard,/useNavigate\(\)/,"Driver portal exposes safe back navigation");

const orderCard=read("src/components/driver/DriverOrderCard.tsx");
expect(orderCard,/onChat/,"Every active driver order exposes customer chat");
expect(orderCard,/DriverCustomerCommunication/,"Every driver order mounts professional WhatsApp contact");
const driverContact=read("src/components/driver/DriverCustomerCommunication.tsx");
const whatsappService=read("src/services/whatsappMessageService.ts");
expect(driverContact,/prepareWhatsAppMessage/,"Driver contact uses the centralized template engine");
expect(driverContact,/openPreparedWhatsApp/,"Driver contact opens a validated prepared WhatsApp URL");
expect(driverContact,/ensureRecordedAmountLine/,"Every driver customer message receives the recorded shipment amount");
expect(driverContact,/order\.cod_amount[\s\S]*order\.customer_total[\s\S]*order\.total_amount/,"Shipment amount uses authoritative order financial fields");
expect(driverContact,/مبلغ الشحنة المسجل|Recorded shipment amount/,"Driver UI clearly previews the recorded shipment amount");
expect(driverContact,/recordedShipmentAmount/,"Outbound-message metadata records the shipment amount used");
expect(whatsappService,/https:\/\/wa\.me\/|buildWhatsAppUrl/,"Central service produces a prefilled WhatsApp URL");

const messageLauncher=read("src/components/admin/AdminCustomerExperienceLauncher.tsx");
expect(messageLauncher,/مركز الرسائل|Message Center/,"Admin navigation exposes a permanent Message Center");
expect(messageLauncher,/dn-customer-experience-native-section/,"Message Center owns a stable native admin navigation section");
expect(messageLauncher,/AdminMessageControlCenter/,"Message Center mounts the operational message-control workspace");
expect(messageLauncher,/ensureLegacyTarget/,"Message Center no longer depends solely on a returned-order button injection");

const canvasTypes=read("src/types/canvas-text-compat.d.ts");
expect(canvasTypes,/CanvasRenderingContext2D/,"Payroll PDF canvas typing is available to strict TypeScript checks");
expect(canvasTypes,/string \| null \| undefined/,"Nullable display text is safely accepted by the browser canvas contract");

const overlay=read("src/components/portals/PortalRuntimeOverlay.tsx");
expect(overlay,/!isMerchant && !isDriver/,"Global floating controls cannot cover either authenticated portal");

const exactCss=read("src/styles/dn-driver-figma-exact.css");
expect(exactCss,/dn-driver-exact-rail\{display:none !important\}/,"Duplicate desktop rail is removed on mobile");
expect(exactCss,/dn-driver-mobile-dock-v3\{display:grid !important/,"Purpose-built mobile dock stays active");
const portalEntry=read("src/components/driver/DriverPortal.tsx");
expect(portalEntry,/dn-driver-mobile-runtime-final\.css/,"Final mobile runtime CSS loads after the driver design layers");
const mobileRuntime=read("src/styles/dn-driver-mobile-runtime-final.css");
expect(mobileRuntime,/body:has\(\.dn-driver-exact-shell\) \.dn-portal-auth-page/,"Authenticated driver shell removes any stale white auth cover");
expect(mobileRuntime,/overflow-y:\s*auto !important/,"Authenticated driver page remains vertically scrollable on phones");
expect(mobileRuntime,/dn-driver-exact-rail[\s\S]*display:\s*none !important/,"Desktop driver rail cannot cover the mobile app");

const driverData=read("src/lib/driverData.ts");
expect(driverData,/rpc\(["']driver_start_mission["']/,"Mission start uses the dedicated production RPC");
expect(driverData,/DN-DB-START/,"Driver sees an actionable database diagnostic instead of a generic failure");

const customer=read("src/components/customer/CustomerOrderHistory.tsx");
expect(customer,/actorRole=["']customer["']/,"Customer can join the private order conversation");

const statements=read("src/components/admin/AdminDriverStatementsCenter.tsx");
expect(statements,/useAdminDrivers/,"Driver statements load real driver profiles and assigned orders");
expect(statements,/driver\.orders/,"Driver statements are based on the orders assigned to each driver");
expect(statements,/كشف طلبيات المندوب|Driver assigned-orders statement/,"Driver statements are explicitly operational order statements");
expect(statements,/AdminPdfExportButton/,"Driver assigned orders export a professional statement");
expect(statements,/\/tracking\?code=/,"Every driver-order row exposes direct tracking");
expect(statements,/updateOrderStatus/,"Driver statements can persist operational status updates");
reject(statements,/setDriverSalary|createDriverPayrollEntry|fetchDriverPayrollSnapshot|payrollPdf|Salary setup and history|تعريف الراتب وحفظ تاريخه/,"Driver Statements never manages salary, advances, deductions, or payroll history");
reject(statements,/Math\.random|localStorage|mock driver|demo driver/i,"Driver statements contain no generated or browser-only operational rows");

const employeePayrollActions=read("src/components/admin/EmployeePayrollStatementActions.tsx");
expect(employeePayrollActions,/automaticPeriod/,"Employee payroll PDF calculates the current period automatically");
expect(employeePayrollActions,/monthStart\(\)/,"Automatic payroll period begins from the current month boundary");
expect(employeePayrollActions,/salary_effective_from/,"Automatic period respects salary entitlement start");
expect(employeePayrollActions,/openPrintFallback/,"Employee payroll export has a print-to-PDF recovery path");
expect(employeePayrollActions,/كشف الراتب الحالي PDF|Current payroll PDF/,"Employee card exposes a direct current-payroll PDF action");
reject(employeePayrollActions,/function payrollPeriod\(|querySelectorAll\('input\[type="date"\]'\)/,"Payroll PDF no longer depends on manually selected date inputs");

const payrollClient=read("src/lib/adminDriverPayroll.ts");
expect(payrollClient,/DriverSalaryHistoryRow/,"Linked driver payroll contract still preserves salary history for the HR employee file");
expect(payrollClient,/overpaid/,"Linked driver payroll contract exposes overpayment separately");
expect(payrollClient,/reimbursement/,"Linked driver payroll contract supports reimbursements");
expect(payrollClient,/debit_adjustment/,"Linked driver payroll contract supports negative adjustments");

const employees=read("src/components/admin/AdminEmployeesCenter.tsx");
expect(employees,/fetchEmployeePayrollSnapshot|createEmployeePayrollEntry|setEmployeeSalary/,"Payroll administration remains inside the Employees center");

const merchants=read("src/components/admin/AdminMerchantStatementsCenter.tsx");
expect(merchants,/dn-admin-merchant-directory-card/,"Merchant directory cards use a dedicated non-button surface");

const migration=read("supabase/migrations/20260722090000_driver_chat_payroll_and_mission_runtime.sql",true);
expect(migration,/order_conversation_messages/,"Migration creates the private conversation table");
expect(migration,/order_chat_can_access/,"Chat access is enforced at the database boundary");
expect(migration,/driver_payroll_entries/,"Migration preserves the audited linked-driver payroll ledger");
expect(migration,/admin_driver_payroll_snapshot/,"Migration calculates linked-driver payroll for the employee HR file");
expect(migration,/v_status in \('accepted','approved'\).*confirmed/s,"Database normalizes legacy mission starts to confirmed");
expect(migration,/function public\.driver_start_mission/ ,"Migration defines a dedicated idempotent mission-start RPC");
reject(migration,/insert into public\.driver_locations\(driver_id,current_order_id,is_online/ ,"Mission start never inserts a location row before the first real GPS fix");
expect(migration,/update public\.driver_locations[\s\S]*where driver_id=v_driver\.id/ ,"Mission start links only an existing real driver location");
expect(migration,/alter type[\s\S]*add value if not exists/s,"Migration reconciles production ENUM labels before mission updates");
expect(migration,/pg_notify\('pgrst','reload schema'\)/,"Migration reloads the live PostgREST schema immediately");
expect(migration,/grant execute on function public\.driver_chat_payroll_runtime_health\(\) to anon, authenticated/,"Runtime health is remotely verifiable after SQL execution");

const payrollSpecialization=read("supabase/migrations/20260724043000_specialized_driver_payroll.sql",true);
expect(payrollSpecialization,/create table if not exists public\.driver_salary_history/,"Specialized migration preserves dated salary history");
expect(payrollSpecialization,/daily_proration_from_salary_history/,"Period salary is prorated from salary history");
expect(payrollSpecialization,/entry_type in \([\s\S]*reimbursement[\s\S]*debit_adjustment/s,"Payroll ledger separates reimbursement and debit adjustment");
expect(payrollSpecialization,/v_type='payment'.*reduces_outstanding_only/s,"Salary payments reduce outstanding only");
expect(payrollSpecialization,/driver_payroll_specialization_health/,"Specialized payroll migration exposes a health RPC");
expect(payrollSpecialization,/drivers read own salary history/,"Drivers can read only their own salary history");
expect(payrollSpecialization,/driver_is_admin\(\)/,"Payroll writes remain restricted to administrators");
reject(payrollSpecialization,/delete from public\.driver_payroll_entries|truncate public\.driver_payroll_entries/i,"Specialization never destroys payroll history");

const missionLocationHotfix=read("supabase/migrations/20260722094500_driver_start_mission_location_not_null_hotfix.sql",true);
expect(missionLocationHotfix,/driver_start_mission_location_hotfix_health/,"23502 location hotfix publishes a remotely verifiable health RPC");
expect(missionLocationHotfix,/location_insert_removed/,"23502 hotfix proves the premature location insert was removed");
expect(missionLocationHotfix,/gps_source','driver_report_location_only'/,"GPS rows remain sourced exclusively from real phone coordinates");

if(failed){console.error("Driver operations and employee payroll separation gate FAILED.");process.exit(1);}
console.log("Driver operations and employee payroll separation gate PASSED.\n");
