import { supabase } from "../supabase";

export type EmployeeStatus = "active" | "inactive" | "on_leave" | "suspended" | "terminated" | string;
export type SalaryCycle = "monthly" | "weekly" | "daily" | string;

export type Employee = {
  id: string;
  employee_code: string;
  user_id?: string | null;
  driver_profile_id?: string | null;
  full_name: string;
  employee_type: string;
  custom_job_title?: string | null;
  department?: string | null;
  phone: string;
  alternate_phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  emirate?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  identity_number?: string | null;
  passport_number?: string | null;
  visa_expiry?: string | null;
  joined_at: string;
  employment_status: EmployeeStatus;
  base_salary: number;
  salary_currency: string;
  salary_cycle: SalaryCycle;
  salary_effective_from: string;
  avatar_url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeSalaryHistory = {
  id: string;
  employee_id?: string;
  driver_id?: string;
  base_salary: number;
  salary_currency: string;
  salary_cycle: SalaryCycle;
  effective_from: string;
  effective_to?: string | null;
  change_amount?: number;
  change_kind?: string;
  note?: string | null;
  created_at: string;
};

export type EmployeePayrollEntry = {
  id: string;
  employee_id?: string;
  driver_id?: string;
  entry_date: string;
  entry_type: string;
  original_entry_type?: string;
  direction: "credit" | "debit" | string;
  amount: number;
  reference_number?: string | null;
  notes: string;
  status: "draft" | "approved" | "void" | string;
  source?: "employee_payroll" | "driver_payroll" | string;
  created_at: string;
};

export type EmployeePayrollSnapshot = {
  employee: Employee;
  period_from: string;
  period_to: string;
  currency: string;
  gross_salary: number;
  credits: number;
  debits?: number;
  bonuses: number;
  overtime?: number;
  allowances?: number;
  adjustments: number;
  reimbursements: number;
  expenses: number;
  deductions: number;
  advances: number;
  penalties?: number;
  debit_adjustments: number;
  payments: number;
  net_salary: number;
  outstanding: number;
  employee_liability?: number;
  overpaid: number;
  source: "employee_payroll" | "driver_payroll" | string;
  linked_driver?: boolean;
  calculation_method?: string;
  salary_history: EmployeeSalaryHistory[];
  entries: EmployeePayrollEntry[];
};

export type NewEmployeeInput = {
  full_name: string;
  employee_type: string;
  custom_job_title?: string;
  department?: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  nationality?: string;
  emirate?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  identity_number?: string;
  passport_number?: string;
  visa_expiry?: string;
  joined_at: string;
  employment_status: EmployeeStatus;
  base_salary: number;
  salary_cycle: SalaryCycle;
  salary_effective_from: string;
  avatar_url?: string;
  notes?: string;
  driver_profile_id?: string;
};

function client() {
  if (!supabase) throw new Error("Supabase client is not configured.");
  return supabase;
}

function one<T>(value: unknown): T {
  return (Array.isArray(value) ? value[0] : value) as T;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function numberValue(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeEmployeePayrollSnapshot(value: unknown, dateFrom: string, dateTo: string): EmployeePayrollSnapshot {
  const raw = objectValue(one<unknown>(value));
  if (raw.error) throw new Error(textValue(raw.error, "employee_payroll_snapshot_failed"));

  const employeeRaw = objectValue(raw.employee);
  if (!textValue(employeeRaw.id)) throw new Error("invalid_employee_payroll_snapshot");

  const employee = {
    ...employeeRaw,
    id: textValue(employeeRaw.id),
    employee_code: textValue(employeeRaw.employee_code),
    full_name: textValue(employeeRaw.full_name, "DAY NIGHT Employee"),
    employee_type: textValue(employeeRaw.employee_type, "other"),
    phone: textValue(employeeRaw.phone, "Not set"),
    joined_at: textValue(employeeRaw.joined_at, dateFrom),
    employment_status: textValue(employeeRaw.employment_status, "active"),
    base_salary: numberValue(employeeRaw.base_salary),
    salary_currency: textValue(employeeRaw.salary_currency, "AED"),
    salary_cycle: textValue(employeeRaw.salary_cycle, "monthly"),
    salary_effective_from: textValue(employeeRaw.salary_effective_from, dateFrom),
  } as Employee;

  const deductions = numberValue(raw.deductions);
  const advances = numberValue(raw.advances);
  const penalties = numberValue(raw.penalties);
  const expenses = numberValue(raw.expenses);
  const debitAdjustments = numberValue(raw.debit_adjustments);
  const debits = numberValue(raw.debits, deductions + advances + penalties + expenses + debitAdjustments);

  const salaryHistory = listValue<Record<string, unknown>>(raw.salary_history).map((item, index) => ({
    ...item,
    id: textValue(item.id, `salary-history-${index}`),
    base_salary: numberValue(item.base_salary),
    salary_currency: textValue(item.salary_currency, "AED"),
    salary_cycle: textValue(item.salary_cycle, "monthly"),
    effective_from: textValue(item.effective_from, dateFrom),
    effective_to: textValue(item.effective_to) || null,
    change_amount: numberValue(item.change_amount),
    created_at: textValue(item.created_at),
  })) as EmployeeSalaryHistory[];

  const entries = listValue<Record<string, unknown>>(raw.entries).map((item, index) => ({
    ...item,
    id: textValue(item.id, `payroll-entry-${index}`),
    entry_date: textValue(item.entry_date, dateFrom),
    entry_type: textValue(item.entry_type, "adjustment"),
    direction: textValue(item.direction, "debit"),
    amount: numberValue(item.amount),
    notes: textValue(item.notes),
    status: textValue(item.status, "approved"),
    source: textValue(item.source, textValue(raw.source, "employee_payroll")),
    created_at: textValue(item.created_at),
  })) as EmployeePayrollEntry[];

  return {
    employee,
    period_from: textValue(raw.period_from, dateFrom),
    period_to: textValue(raw.period_to, dateTo),
    currency: textValue(raw.currency, "AED"),
    gross_salary: numberValue(raw.gross_salary),
    credits: numberValue(raw.credits),
    debits,
    bonuses: numberValue(raw.bonuses),
    overtime: numberValue(raw.overtime),
    allowances: numberValue(raw.allowances),
    adjustments: numberValue(raw.adjustments),
    reimbursements: numberValue(raw.reimbursements),
    expenses,
    deductions,
    advances,
    penalties,
    debit_adjustments: debitAdjustments,
    payments: numberValue(raw.payments),
    net_salary: numberValue(raw.net_salary),
    outstanding: numberValue(raw.outstanding),
    employee_liability: numberValue(raw.employee_liability),
    overpaid: numberValue(raw.overpaid),
    source: textValue(raw.source, "employee_payroll"),
    linked_driver: Boolean(raw.linked_driver),
    calculation_method: textValue(raw.calculation_method),
    salary_history: salaryHistory,
    entries,
  };
}

export async function fetchEmployees() {
  const { data, error } = await client().rpc("admin_employee_directory");
  if (error) throw new Error(error.message);
  if (data && !Array.isArray(data) && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error?: string }).error || "employee_directory_failed"));
  }
  return (Array.isArray(data) ? data : []) as Employee[];
}

export async function createEmployee(input: NewEmployeeInput) {
  const { data, error } = await client().rpc("admin_create_employee", { p_payload: input });
  if (error) throw new Error(error.message);
  return one<Employee>(data);
}

export async function fetchEmployeePayrollSnapshot(employeeId: string, dateFrom: string, dateTo: string) {
  const { data, error } = await client().rpc("admin_employee_payroll_snapshot", {
    p_employee_id: employeeId,
    p_from: dateFrom,
    p_to: dateTo,
  });
  if (error) throw new Error(error.message);
  return normalizeEmployeePayrollSnapshot(data, dateFrom, dateTo);
}

export async function setEmployeeSalary(input: {
  employeeId: string;
  baseSalary: number;
  cycle: SalaryCycle;
  effectiveFrom: string;
  note: string;
}) {
  const { data, error } = await client().rpc("admin_set_employee_salary", {
    p_employee_id: input.employeeId,
    p_base_salary: input.baseSalary,
    p_cycle: input.cycle,
    p_effective_from: input.effectiveFrom,
    p_note: input.note || null,
  });
  if (error) throw new Error(error.message);
  return one<Employee>(data);
}

export async function createEmployeePayrollEntry(input: {
  employeeId: string;
  entryDate: string;
  entryType: string;
  amount: number;
  reference?: string;
  notes: string;
  status?: "draft" | "approved";
}) {
  const { data, error } = await client().rpc("admin_create_employee_payroll_entry", {
    p_employee_id: input.employeeId,
    p_entry_date: input.entryDate,
    p_entry_type: input.entryType,
    p_amount: input.amount,
    p_reference_number: input.reference || null,
    p_notes: input.notes,
    p_status: input.status || "approved",
  });
  if (error) throw new Error(error.message);
  return one<EmployeePayrollEntry>(data);
}

export async function setEmployeePayrollEntryStatus(input: {
  employeeId: string;
  entryId: string;
  status: "approved" | "void";
  note?: string;
}) {
  const { data, error } = await client().rpc("admin_set_employee_payroll_entry_status", {
    p_employee_id: input.employeeId,
    p_entry_id: input.entryId,
    p_status: input.status,
    p_note: input.note || null,
  });
  if (error) throw new Error(error.message);
  return one<EmployeePayrollEntry>(data);
}

export function employeeErrorMessage(error: unknown, isArabic: boolean) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/does not exist|schema cache|admin_employee|employee_salary_history/i.test(raw)) {
    return isArabic
      ? "تحديث الموارد البشرية والرواتب لم يُفعّل بعد في قاعدة البيانات."
      : "The employee HR and payroll database update has not been activated yet.";
  }
  if (/not_authorized|permission|row-level/i.test(raw)) {
    return isArabic ? "حساب الإدارة لا يملك صلاحية إدارة الموظفين والرواتب." : "This admin account does not have HR payroll permission.";
  }
  if (/invalid_employee_payroll_snapshot/i.test(raw)) {
    return isArabic ? "تعذر قراءة بطاقة الراتب بأمان. أعد المحاولة أو حدّث الصفحة." : "The payroll card response could not be read safely. Retry or refresh the page.";
  }
  if (/employee_name_required/i.test(raw)) return isArabic ? "اسم الموظف مطلوب." : "Employee name is required.";
  if (/employee_phone_required/i.test(raw)) return isArabic ? "رقم هاتف الموظف مطلوب." : "Employee phone is required.";
  if (/driver_already_linked_to_employee/i.test(raw)) {
    return isArabic ? "هذا المندوب مرتبط بالفعل ببطاقة موظف." : "This driver is already linked to an employee card.";
  }
  if (/salary_effective_date_before_latest/i.test(raw)) {
    return isArabic ? "تاريخ الراتب أقدم من آخر تعديل راتب محفوظ." : "The salary date is earlier than the latest saved revision.";
  }
  if (/payroll_note_required/i.test(raw)) return isArabic ? "اكتب سبب الحركة المالية بوضوح." : "Add a clear reason for the payroll entry.";
  if (/invalid_payroll_amount/i.test(raw)) return isArabic ? "قيمة الحركة يجب أن تكون أكبر من صفر." : "The payroll amount must be greater than zero.";
  return isArabic ? "تعذر حفظ بيانات الموظف أو حركة الراتب. راجع البيانات وأعد المحاولة." : "The employee or payroll change could not be saved. Review the data and retry.";
}
