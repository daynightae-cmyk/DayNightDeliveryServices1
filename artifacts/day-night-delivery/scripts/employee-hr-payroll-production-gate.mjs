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
  console.log(`PASS: ${relative} exists`);
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

console.log("\n--- DAY NIGHT employee HR & payroll gate ---");

const launcher = read("src/components/admin/AdminEmployeeLauncher.tsx");
const center = read("src/components/admin/AdminEmployeesCenter.tsx");
const client = read("src/lib/adminEmployees.ts");
const pdfActions = read("src/components/admin/EmployeePayrollStatementActions.tsx");
const pdfExport = read("src/lib/employeePayrollStatementExport.ts");
const safePdfExport = read("src/lib/employeePayrollStatementSafeExport.ts");
const canvasCompat = read("src/types/canvas-text-compat.d.ts");
const main = read("src/main.tsx");
const commandCenter = read("src/components/admin/command-center/AdminPanelCommandCenter.tsx");
const commandShell = read("src/components/admin/command-center/AdminCommandCenterShell.tsx");
const migration = read("../../supabase/migrations/20260724083000_employee_hr_payroll_center.sql");

expect(launcher, /\/admin\/new-employee/, "New employee admin route is registered");
expect(launcher, /\/admin\/employees/, "Employee directory admin route is registered");
expect(launcher, /AdminEmployeesCenter/, "Admin navigation mounts the employee center");
expect(launcher, /EmployeePayrollStatementActions/, "Employee card mounts premium PDF and sharing actions");
expect(commandCenter, /id:\s*"new_employee"[\s\S]*ar:\s*"إضافة موظف"/, "Add employee is a native command-center menu item");
expect(commandCenter, /id:\s*"employees"[\s\S]*ar:\s*"الموظفون"/, "Employee directory is a native command-center menu item");
expect(commandCenter, /groupAr:\s*"الموارد البشرية"/, "Employee menu has a permanent HR group");
expect(commandCenter, /navigateRouter\(path\)[\s\S]*announceEmployeePath/, "Native employee menu opens the real employee route");
expect(commandShell, /AdminCommandSectionId\s*=\s*AdminSectionId\s*\|\s*"new_employee"\s*\|\s*"employees"/, "Command shell recognizes permanent employee sections");
expect(commandShell, /data-dn-command-section=\{item\.id\}/, "Native command items expose stable section markers");
reject(launcher, /selector:\s*"\.dncc-navigation"/, "Employee links are no longer injected dynamically into command navigation");
expect(center, /محاسب|Accountant/, "Employee types include accountant");
expect(center, /مطور برمجيات|Developer/, "Employee types include developer");
expect(center, /سائق \/ مندوب|Driver/, "Employee types include driver");
expect(center, /مكافأة|Bonus/, "Payroll supports bonuses");
expect(center, /خصم من الراتب|Salary deduction/, "Payroll supports deductions");
expect(center, /زيادة أو تعديل الراتب الأساسي|Salary revision/, "Employee card supports salary increases and revisions");
expect(center, /المكافأة تُضاف والخصم يُطرح تلقائيًا|Bonuses add and deductions subtract automatically/, "UI explains automatic payroll effects");
expect(center, /مرتبط بسجل رواتب المندوب الأصلي|Linked to the original driver payroll/, "Linked drivers do not duplicate payroll");
expect(client, /admin_employee_payroll_snapshot/, "Frontend reads authoritative payroll snapshots");
expect(client, /normalizeEmployeePayrollSnapshot/, "Payroll snapshots are normalized before employee-card rendering");
expect(client, /salary_history:\s*salaryHistory/, "Missing salary history is converted to a safe list");
expect(client, /entries,\s*\n\s*};/, "Missing payroll entries are converted to a safe list");
expect(client, /numberValue\(raw\.debits,\s*deductions \+ advances \+ penalties \+ expenses \+ debitAdjustments\)/, "Driver snapshots receive a safe debit total");
expect(client, /invalid_employee_payroll_snapshot/, "Malformed payroll responses fail safely instead of crashing React");
expect(client, /admin_set_employee_salary/, "Frontend persists salary revisions");
expect(client, /admin_create_employee_payroll_entry/, "Frontend persists payroll movements");
expect(pdfActions, /كشف الراتب الحالي PDF|Current payroll PDF/, "Employee card exposes the current-period payroll PDF action");
expect(pdfActions, /downloadEmployeePayrollPdfSafe/, "Employee payroll action downloads through the safe PDF exporter");
expect(pdfActions, /shareEmployeePayrollPdfSafe/, "Employee card supports direct file sharing");
expect(pdfActions, /openPrintFallback/, "Employee payroll export falls back to a printable Save-as-PDF view");
expect(pdfActions, /fetchEmployeePayrollSnapshot/, "PDF uses authoritative payroll data for the automatic current period");
expect(safePdfExport, /createEmployeePayrollPdfBlobSafe/, "Safe payroll exporter validates the generated PDF blob");
expect(safePdfExport, /fallbackPdfBlob/, "Safe payroll exporter includes an independent fallback renderer");
expect(safePdfExport, /navigator\.share/, "Safe payroll exporter supports native file sharing when available");
expect(canvasCompat, /CanvasRenderingContext2D/, "Canvas PDF text typing remains compatible with strict TypeScript");
expect(pdfExport, /new jsPDF/, "Employee statement creates a real PDF file");
expect(pdfExport, /تفاصيل حركات الراتب|Payroll movement details/, "PDF includes complete payroll movement details");
expect(pdfExport, /تاريخ الراتب الأساسي|Base salary history/, "PDF includes base salary history");
expect(pdfExport, /الخصومات والسلف|Deductions & advances/, "PDF summarizes deductions and advances");
expect(pdfExport, /اعتماد الإدارة|Management approval/, "PDF includes management and employee signature areas");
expect(pdfExport, /createEmployeePayrollPdfBlob/, "PDF generator supports sharing as a real file");
expect(main, /AdminEmployeeLauncher/, "Employee launcher mounts globally and on direct admin routes");
expect(migration, /create table if not exists public\.employees/, "Employee directory table exists");
expect(migration, /create table if not exists public\.employee_salary_history/, "Salary history table exists");
expect(migration, /create table if not exists public\.employee_payroll_entries/, "Payroll entry table exists");
expect(migration, /driver_profile_id uuid unique/, "Employee records can link to existing drivers");
expect(migration, /admin_driver_payroll_snapshot/, "Linked drivers reuse authoritative driver payroll");
expect(migration, /v_net := round\(v_gross\+v_credits-v_debits,2\)/, "Net salary automatically adds credits and subtracts debits");
expect(migration, /change_kind in \('initial','increase','decrease','correction'\)/, "Salary history classifies increases and decreases");
expect(migration, /employee reads own payroll entries/, "Employee payroll has scoped RLS read access");

if (failed) {
  console.error("Employee HR & payroll gate FAILED.\n");
  process.exit(1);
}
console.log("Employee HR & payroll gate PASSED.\n");
