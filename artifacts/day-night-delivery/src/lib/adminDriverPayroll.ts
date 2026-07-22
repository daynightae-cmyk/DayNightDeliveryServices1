import { supabase } from "../supabase";
import type { DriverProfile } from "../types/driver";

export type DriverPayrollEntry = {
  id: string;
  driver_id: string;
  entry_date: string;
  entry_type: "bonus" | "expense" | "deduction" | "advance" | "adjustment" | "payment" | string;
  direction: "credit" | "debit" | string;
  amount: number;
  reference_number?: string | null;
  notes: string;
  order_id?: string | null;
  status: "draft" | "approved" | "void" | string;
  created_at: string;
};

export type DriverPayrollSnapshot = {
  driver: DriverProfile;
  period_from: string;
  period_to: string;
  currency: string;
  gross_salary: number;
  credits: number;
  expenses: number;
  deductions: number;
  advances: number;
  payments: number;
  net_salary: number;
  outstanding: number;
  entries: DriverPayrollEntry[];
};

function client() {
  if (!supabase) throw new Error("Supabase client is not configured.");
  return supabase;
}

function one<T>(value: unknown): T {
  return (Array.isArray(value) ? value[0] : value) as T;
}

export async function fetchDriverPayrollSnapshot(driverId: string, dateFrom: string, dateTo: string) {
  const { data, error } = await client().rpc("admin_driver_payroll_snapshot", { p_driver_id: driverId, p_from: dateFrom, p_to: dateTo });
  if (error) throw new Error(error.message);
  return one<DriverPayrollSnapshot>(data);
}

export async function setDriverSalary(driverId: string, salary: number, cycle: string, effectiveFrom: string, note: string) {
  const { data, error } = await client().rpc("admin_set_driver_salary", { p_driver_id: driverId, p_base_salary: salary, p_cycle: cycle, p_effective_from: effectiveFrom, p_note: note || null });
  if (error) throw new Error(error.message);
  return one<DriverProfile>(data);
}

export async function createDriverPayrollEntry(input: { driverId: string; entryDate: string; entryType: string; amount: number; reference?: string; notes: string; orderId?: string | null; status?: "draft" | "approved" }) {
  const { data, error } = await client().rpc("admin_create_driver_payroll_entry", {
    p_driver_id: input.driverId,
    p_entry_date: input.entryDate,
    p_entry_type: input.entryType,
    p_amount: input.amount,
    p_reference_number: input.reference || null,
    p_notes: input.notes,
    p_order_id: input.orderId || null,
    p_status: input.status || "approved",
  });
  if (error) throw new Error(error.message);
  return one<DriverPayrollEntry>(data);
}

export async function setDriverPayrollEntryStatus(entryId: string, status: "approved" | "void", note?: string) {
  const { data, error } = await client().rpc("admin_set_driver_payroll_entry_status", { p_entry_id: entryId, p_status: status, p_note: note || null });
  if (error) throw new Error(error.message);
  return one<DriverPayrollEntry>(data);
}

export function payrollErrorMessage(error: unknown, isArabic: boolean) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/does not exist|schema cache|admin_driver_payroll/i.test(raw)) return isArabic ? "تحديث الرواتب الجديد لم يُفعّل بعد في قاعدة البيانات." : "The new payroll database update has not been activated yet.";
  if (/not_authorized|permission|row-level/i.test(raw)) return isArabic ? "حساب الإدارة لا يملك صلاحية الرواتب." : "This admin account does not have payroll permission.";
  if (/payroll_note_required/i.test(raw)) return isArabic ? "اكتب سبباً واضحاً للحركة المالية." : "Add a clear reason for the payroll entry.";
  return isArabic ? "تعذر حفظ حركة الراتب. راجع البيانات وأعد المحاولة." : "The payroll change could not be saved. Review the data and retry.";
}
