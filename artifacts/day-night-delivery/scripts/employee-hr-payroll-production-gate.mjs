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

console.log("\n--- DAY NIGHT employee HR & payroll gate ---");

const launcher = read("src/components/admin/AdminEmployeeLauncher.tsx");
const center = read("src/components/admin/AdminEmployeesCenter.tsx");
const client = read("src/lib/adminEmployees.ts");
const main = read("src/main.tsx");
const migration = read("../../supabase/migrations/20260724083000_employee_hr_payroll_center.sql");

expect(launcher, /\/admin\/new-employee/, "New employee admin route is registered");
expect(launcher, /\/admin\/employees/, "Employee directory admin route is registered");
expect(launcher, /AdminEmployeesCenter/, "Admin navigation mounts the employee center");
expect(center, /محاسب|Accountant/, "Employee types include accountant");
expect(center, /مطور برمجيات|Developer/, "Employee types include developer");
expect(center, /سائق \/ مندوب|Driver/, "Employee types include driver");
expect(center, /مكافأة|Bonus/, "Payroll supports bonuses");
expect(center, /خصم من الراتب|Salary deduction/, "Payroll supports deductions");
expect(center, /زيادة أو تعديل الراتب الأساسي|Salary revision/, "Employee card supports salary increases and revisions");
expect(center, /المكافأة تُضاف والخصم يُطرح تلقائيًا|Bonuses add and deductions subtract automatically/, "UI explains automatic payroll effects");
expect(center, /مرتبط بسجل رواتب المندوب الأصلي|Linked to the original driver payroll/, "Linked drivers do not duplicate payroll");
expect(client, /admin_employee_payroll_snapshot/, "Frontend reads authoritative payroll snapshots");
expect(client, /admin_set_employee_salary/, "Frontend persists salary revisions");
expect(client, /admin_create_employee_payroll_entry/, "Frontend persists payroll movements");
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
