import { supabase } from "../supabase";
import type { DriverProfile } from "../types/driver";

export type DriverPayrollEntryType =
  | "bonus"
  | "expense"
  | "deduction"
  | "advance"
  | "adjustment"
  | "payment"
  | "reimbursement"
  | "debit_adjustment"
  | string;

export type DriverPayrollEntry = {
  id: string;
  driver_id: string;
  entry_date: string;
  entry_type: DriverPayrollEntryType;
  direction: "credit" | "debit" | string;
  amount: number;
  reference_number?: string | null;
  notes: string;
  order_id?: string | null;
  status: "draft" | "approved" | "void" | string;
  created_at: string;
};

export type DriverSalaryHistoryRow = {
  id: string;
  driver_id: string;
  base_salary: number;
  salary_currency: string;
  salary_cycle: "monthly" | "weekly" | "daily" | string;
  effective_from: string;
  effective_to?: string | null;
  note?: string | null;
  created_at: string;
};

export type DriverPayrollSnapshot = {
  driver: DriverProfile;
  period_from: string;
  period_to: string;
  currency: string;
  gross_salary: number;
  credits: number;
  bonuses: number;
  adjustments: number;
  reimbursements: number;
  expenses: number;
  deductions: number;
  advances: number;
  debit_adjustments: number;
  payments: number;
  net_salary: number;
  outstanding: number;
  overpaid: number;
  calculation_method?: string;
  salary_history: DriverSalaryHistoryRow[];
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
  const { data, error } = await client().rpc("admin_driver_payroll_snapshot", {
    p_driver_id: driverId,
    p_from: dateFrom,
    p_to: dateTo,
  });
  if (error) throw new Error(error.message);
  return one<DriverPayrollSnapshot>(data);
}

export async function setDriverSalary(
  driverId: string,
  salary: number,
  cycle: string,
  effectiveFrom: string,
  note: string,
) {
  const { data, error } = await client().rpc("admin_set_driver_salary", {
    p_driver_id: driverId,
    p_base_salary: salary,
    p_cycle: cycle,
    p_effective_from: effectiveFrom,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
  return one<DriverProfile>(data);
}

export async function createDriverPayrollEntry(input: {
  driverId: string;
  entryDate: string;
  entryType: DriverPayrollEntryType;
  amount: number;
  reference?: string;
  notes: string;
  orderId?: string | null;
  status?: "draft" | "approved";
}) {
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

export async function setDriverPayrollEntryStatus(
  entryId: string,
  status: "approved" | "void",
  note?: string,
) {
  const { data, error } = await client().rpc("admin_set_driver_payroll_entry_status", {
    p_entry_id: entryId,
    p_status: status,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
  return one<DriverPayrollEntry>(data);
}

export function payrollErrorMessage(error: unknown, isArabic: boolean) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/does not exist|schema cache|admin_driver_payroll|driver_salary_history/i.test(raw)) {
    return isArabic
      ? "تحديث الرواتب المتخصص لم يُفعّل بعد في قاعدة البيانات."
      : "The specialized payroll database update has not been activated yet.";
  }
  if (/not_authorized|permission|row-level/i.test(raw)) {
    return isArabic
      ? "حساب الإدارة لا يملك صلاحية الرواتب."
      : "This admin account does not have payroll permission.";
  }
  if (/payroll_note_required/i.test(raw)) {
    return isArabic ? "اكتب سبباً واضحاً للحركة المالية." : "Add a clear reason for the payroll entry.";
  }
  if (/salary_effective_date_before_latest/i.test(raw)) {
    return isArabic
      ? "تاريخ بداية الراتب أقدم من آخر راتب مسجل. اختر تاريخاً مساوياً أو أحدث."
      : "The salary effective date is earlier than the latest recorded salary.";
  }
  if (/future_salary_effective_date_not_supported/i.test(raw)) {
    return isArabic
      ? "تاريخ بداية الراتب لا يمكن أن يكون في المستقبل حالياً."
      : "The salary effective date cannot be in the future yet.";
  }
  if (/invalid_payroll_entry_type/i.test(raw)) {
    return isArabic ? "نوع حركة الراتب غير صحيح." : "The payroll entry type is invalid.";
  }
  return isArabic
    ? "تعذر حفظ حركة الراتب. راجع البيانات وأعد المحاولة."
    : "The payroll change could not be saved. Review the data and retry.";
}
