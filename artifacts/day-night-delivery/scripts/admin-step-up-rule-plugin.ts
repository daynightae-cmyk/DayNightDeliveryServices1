import type { Plugin } from "vite";

function replaceRequired(source: string, pattern: string | RegExp, replacement: string, label: string) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`DAY NIGHT admin step-up rule could not apply: ${label}`);
  return next;
}

/**
 * Fail-closed integration for large legacy admin service modules. Sensitive
 * operations call the centralized two-minute step-up provider before the RPC is
 * sent. Keeping the provider independent avoids weakening Supabase RLS/RPC auth.
 */
export function adminStepUpRulePlugin(): Plugin {
  return {
    name: "day-night-admin-step-up-rule-v1",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];

      if (normalized.endsWith("/src/lib/adminEmployees.ts")) {
        let code = replaceRequired(
          source,
          'import { supabase } from "../supabase";',
          'import { supabase } from "../supabase";\nimport { requireAdminStepUp } from "./adminStepUp";',
          "employee service imports step-up",
        );
        code = replaceRequired(
          code,
          "export async function createEmployee(input: NewEmployeeInput) {\n  const { data, error }",
          'export async function createEmployee(input: NewEmployeeInput) {\n  await requireAdminStepUp("create_employee");\n  const { data, error }',
          "employee creation requires step-up",
        );
        code = replaceRequired(
          code,
          /export async function setEmployeeSalary\(input: \{([\s\S]*?)\n\}\) \{\n  const \{ data, error \}/,
          'export async function setEmployeeSalary(input: {$1\n}) {\n  await requireAdminStepUp("change_salary");\n  const { data, error }',
          "salary change requires step-up",
        );
        code = replaceRequired(
          code,
          /export async function createEmployeePayrollEntry\(input: \{([\s\S]*?)\n\}\) \{\n  const \{ data, error \}/,
          'export async function createEmployeePayrollEntry(input: {$1\n}) {\n  await requireAdminStepUp("modify_payroll");\n  const { data, error }',
          "payroll entry requires step-up",
        );
        code = replaceRequired(
          code,
          /export async function setEmployeePayrollEntryStatus\(input: \{([\s\S]*?)\n\}\) \{\n  const \{ data, error \}/,
          'export async function setEmployeePayrollEntryStatus(input: {$1\n}) {\n  await requireAdminStepUp(input.status === "void" ? "void_payroll_entry" : "modify_payroll");\n  const { data, error }',
          "payroll status requires step-up",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/lib/adminOperationsData.ts")) {
        let code = replaceRequired(
          source,
          'import { createPublicOrder, supabase } from "../supabase";',
          'import { createPublicOrder, supabase } from "../supabase";\nimport { requireAdminStepUp } from "./adminStepUp";',
          "admin operations import step-up",
        );
        code = replaceRequired(
          code,
          "export async function createOpsMerchant(\n  input: OpsMerchantInput,\n): Promise<OpsCreateResult<Merchant>> {",
          'export async function createOpsMerchant(\n  input: OpsMerchantInput,\n): Promise<OpsCreateResult<Merchant>> {\n  if (clean(input.bank_name) || clean(input.iban)) await requireAdminStepUp("modify_bank_details");',
          "merchant bank fields require step-up",
        );
        code = replaceRequired(
          code,
          "export async function deleteOpsMerchant(\n  merchantId: string,\n): Promise<OpsCreateResult<Merchant>> {",
          'export async function deleteOpsMerchant(\n  merchantId: string,\n): Promise<OpsCreateResult<Merchant>> {\n  await requireAdminStepUp("change_permissions");',
          "merchant deletion requires step-up",
        );
        code = replaceRequired(
          code,
          "export async function deleteOpsOrder(order: Order): Promise<OpsDeleteResult> {",
          'export async function deleteOpsOrder(order: Order): Promise<OpsDeleteResult> {\n  await requireAdminStepUp("delete_order");',
          "order deletion requires step-up",
        );
        return { code, map: null };
      }

      return null;
    },
  };
}
