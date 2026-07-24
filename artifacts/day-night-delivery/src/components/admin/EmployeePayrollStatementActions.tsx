import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, Loader2, Share2 } from "lucide-react";
import {
  fetchEmployeePayrollSnapshot,
  fetchEmployees,
  type Employee,
  type EmployeePayrollEntry,
  type EmployeePayrollSnapshot,
  type EmployeeSalaryHistory,
} from "../../lib/adminEmployees";
import {
  downloadEmployeePayrollPdfSafe,
  shareEmployeePayrollPdfSafe,
  type EmployeePayrollStatementPayload,
} from "../../lib/employeePayrollStatementSafeExport";

type Props = {
  active: boolean;
  isArabic: boolean;
};

type Target = {
  host: HTMLElement;
  employeeCode: string;
  dateFrom: string;
  dateTo: string;
};

const EMPLOYEE_CODE = /\bDN-EMP-[A-Z0-9-]+\b/i;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function payrollPeriod(root: HTMLElement) {
  const periodSection = Array.from(root.querySelectorAll<HTMLElement>("section")).find((section) => {
    const text = section.textContent?.replace(/\s+/g, " ").trim() || "";
    return /كشف راتب الفترة|Payroll period/i.test(text) && section.querySelectorAll('input[type="date"]').length >= 2;
  });
  const dateInputs = Array.from(periodSection?.querySelectorAll<HTMLInputElement>('input[type="date"]') || []);
  return {
    dateFrom: dateInputs[0]?.value || monthStart(),
    dateTo: dateInputs[1]?.value || today(),
  };
}

function ensureTarget(): Target | null {
  const root = document.querySelector<HTMLElement>(".dn-employee-hr-embedded-root");
  if (!root) return null;
  const header = Array.from(root.querySelectorAll<HTMLElement>("header")).find((candidate) => EMPLOYEE_CODE.test(candidate.textContent || ""));
  if (!header) return null;
  const employeeCode = (header.textContent || "").match(EMPLOYEE_CODE)?.[0]?.toUpperCase();
  if (!employeeCode) return null;
  header.dataset.dnEmployeeDetailHeader = "true";
  const actions = header.querySelector<HTMLElement>(".flex.flex-wrap.gap-2") || header;
  let host = actions.querySelector<HTMLElement>("[data-dn-employee-pdf-actions]");
  if (!host) {
    host = document.createElement("span");
    host.dataset.dnEmployeePdfActions = "true";
    host.className = "dn-employee-payroll-actions";
    actions.appendChild(host);
  }
  return { host, employeeCode, ...payrollPeriod(root) };
}

function sameTarget(left: Target | null, right: Target | null) {
  return left?.host === right?.host && left?.employeeCode === right?.employeeCode && left?.dateFrom === right?.dateFrom && left?.dateTo === right?.dateTo;
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/٬/g, ",")
    .replace(/٫/g, ".");
}

function amountFromText(value: unknown) {
  const normalized = normalizeDigits(String(value ?? ""));
  const parsed = Number(normalized.replace(/,/g, "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function visibleMetric(root: HTMLElement, labels: RegExp[]) {
  const article = Array.from(root.querySelectorAll<HTMLElement>("article")).find((candidate) => {
    const text = clean(candidate.textContent);
    return labels.some((label) => label.test(text));
  });
  return amountFromText(article?.querySelector("strong")?.textContent || article?.textContent || "0");
}

function entryTypeFromText(value: string) {
  const normalized = clean(value).toLowerCase();
  if (/مكافأة|bonus/.test(normalized)) return "bonus";
  if (/عمل إضافي|overtime/.test(normalized)) return "overtime";
  if (/بدل|حافز|allowance/.test(normalized)) return "allowance";
  if (/تعويض|reimbursement/.test(normalized)) return "reimbursement";
  if (/خصم من الراتب|salary deduction/.test(normalized)) return "deduction";
  if (/سلفة|advance/.test(normalized)) return "advance";
  if (/جزاء|مخالفة|penalty/.test(normalized)) return "penalty";
  if (/مصروف|expense/.test(normalized)) return "expense";
  if (/دفعة راتب|salary payment|سداد/.test(normalized)) return "payment";
  if (/تسوية خصم|debit adjustment/.test(normalized)) return "debit_adjustment";
  return "adjustment";
}

function visibleEntries(root: HTMLElement, dateFrom: string): EmployeePayrollEntry[] {
  const section = Array.from(root.querySelectorAll<HTMLElement>("section")).find((candidate) => /كشف راتب الفترة|Payroll period/i.test(clean(candidate.textContent)));
  const rows = Array.from(section?.querySelectorAll<HTMLTableRowElement>("tbody tr") || []);
  return rows.map((row, index) => {
    const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td")).map((cell) => clean(cell.textContent, "—"));
    const movement = cells[1] || "adjustment";
    const effect = cells[3] || "";
    const entryType = entryTypeFromText(movement);
    const direction = /إضافة|credit/i.test(effect) ? "credit" : "debit";
    return {
      id: `visible-entry-${index}`,
      entry_date: cells[0] || dateFrom,
      entry_type: entryType,
      original_entry_type: entryType,
      direction,
      amount: amountFromText(cells[4]),
      notes: cells[2] || "—",
      status: /ملغ|void/i.test(cells[5] || "") ? "void" : "approved",
      source: "visible_payroll_fallback",
      created_at: new Date().toISOString(),
    };
  });
}

function visibleSalaryHistory(root: HTMLElement, dateFrom: string): EmployeeSalaryHistory[] {
  const section = Array.from(root.querySelectorAll<HTMLElement>("section")).find((candidate) => /تاريخ الراتب الأساسي|Base salary history/i.test(clean(candidate.textContent)));
  const rows = Array.from(section?.querySelectorAll<HTMLTableRowElement>("tbody tr") || []);
  return rows.map((row, index) => {
    const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td")).map((cell) => clean(cell.textContent, "—"));
    return {
      id: `visible-history-${index}`,
      base_salary: amountFromText(cells[2] || cells[0]),
      salary_currency: "AED",
      salary_cycle: cells[3] || "monthly",
      effective_from: cells[0] || dateFrom,
      effective_to: cells[1] && cells[1] !== "—" ? cells[1] : null,
      change_amount: amountFromText(cells[4]),
      note: cells[5] || "—",
      created_at: new Date().toISOString(),
    };
  });
}

function visiblePayload(target: Target, isArabic: boolean): EmployeePayrollStatementPayload {
  const root = document.querySelector<HTMLElement>(".dn-employee-hr-embedded-root");
  const header = root?.querySelector<HTMLElement>('[data-dn-employee-detail-header="true"]');
  if (!root || !header) throw new Error("employee_visible_payload_missing");
  const headingCandidates = Array.from(header.querySelectorAll<HTMLElement>("h1,h2,h3,strong"))
    .map((node) => clean(node.textContent))
    .filter((value) => value && !EMPLOYEE_CODE.test(value) && !/اتصال|واتساب|PDF|كشف|إرسال|Call|WhatsApp|Share|Print/i.test(value));
  const fullName = headingCandidates.sort((left, right) => right.length - left.length)[0] || "DAY NIGHT Employee";
  const phone = clean(header.querySelector<HTMLAnchorElement>('a[href^="tel:"]')?.getAttribute("href")?.replace(/^tel:/, ""), "Not set");
  const baseSalaryInput = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="number"]')).find((input) => amountFromText(input.value) > 0);
  const grossSalary = visibleMetric(root, [/راتب الفترة/i, /Period salary/i]);
  const credits = visibleMetric(root, [/المكافآت والإضافات/i, /Credits & bonuses/i]);
  const debits = visibleMetric(root, [/الخصومات والسلف/i, /Deductions & advances/i]);
  const netSalary = visibleMetric(root, [/صافي الاستحقاق/i, /Net entitlement/i]);
  const payments = visibleMetric(root, [/المدفوع/i, /^Paid/i]);
  const outstanding = visibleMetric(root, [/المتبقي للموظف/i, /Outstanding/i]);
  const liability = visibleMetric(root, [/مستحق على الموظف/i, /Employee liability/i]);
  const entries = visibleEntries(root, target.dateFrom);
  const salaryHistory = visibleSalaryHistory(root, target.dateFrom);
  const employee: Employee = {
    id: `visible-${target.employeeCode}`,
    employee_code: target.employeeCode,
    full_name: fullName,
    employee_type: /سائق|مندوب|driver/i.test(clean(header.textContent)) ? "driver" : "other",
    custom_job_title: clean(header.querySelector("p")?.textContent, isArabic ? "موظف DAY NIGHT" : "DAY NIGHT Employee"),
    department: "DAY NIGHT",
    phone,
    email: null,
    nationality: null,
    emirate: null,
    address: null,
    joined_at: target.dateFrom,
    employment_status: "active",
    base_salary: amountFromText(baseSalaryInput?.value || grossSalary),
    salary_currency: "AED",
    salary_cycle: "monthly",
    salary_effective_from: target.dateFrom,
    avatar_url: null,
  };
  const snapshot: EmployeePayrollSnapshot = {
    employee,
    period_from: target.dateFrom,
    period_to: target.dateTo,
    currency: "AED",
    gross_salary: grossSalary,
    credits,
    debits,
    bonuses: credits,
    overtime: 0,
    allowances: 0,
    adjustments: 0,
    reimbursements: 0,
    expenses: 0,
    deductions: debits,
    advances: 0,
    penalties: 0,
    debit_adjustments: 0,
    payments,
    net_salary: netSalary,
    outstanding,
    employee_liability: liability,
    overpaid: 0,
    source: "visible_payroll_fallback",
    linked_driver: /مندوب|driver/i.test(clean(header.textContent)),
    calculation_method: "visible_employee_card_fallback",
    salary_history: salaryHistory,
    entries,
  };
  return {
    language: isArabic ? "ar" : "en",
    employee,
    snapshot,
    logoUrl: "/assets/daynight/merchant-statement-logo.png",
    generatedBy: "DAY NIGHT HR & Payroll Center",
  };
}

export default function EmployeePayrollStatementActions({ active, isArabic }: Props) {
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);

  useEffect(() => {
    if (!active) {
      setTarget(null);
      document.body.classList.remove("dn-employee-detail-active");
      return;
    }
    const sync = () => {
      const next = ensureTarget();
      setTarget((current) => sameTarget(current, next) ? current : next);
      document.body.classList.toggle("dn-employee-detail-active", Boolean(next));
    };
    const syncFromInput = (event: Event) => {
      const element = event.target as HTMLElement | null;
      if (element?.matches('.dn-employee-hr-embedded-root input[type="date"]')) sync();
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", syncFromInput, true);
    document.addEventListener("change", syncFromInput, true);
    const timer = window.setInterval(sync, 500);
    return () => {
      observer.disconnect();
      document.removeEventListener("input", syncFromInput, true);
      document.removeEventListener("change", syncFromInput, true);
      window.clearInterval(timer);
      document.body.classList.remove("dn-employee-detail-active");
    };
  }, [active]);

  async function payload(): Promise<EmployeePayrollStatementPayload> {
    if (!target) throw new Error("employee_pdf_target_missing");
    try {
      const employees = await fetchEmployees();
      const normalizedCode = target.employeeCode.replace(/\s+/g, "").toUpperCase();
      const employee = employees.find((item) => String(item.employee_code || "").replace(/\s+/g, "").toUpperCase() === normalizedCode);
      if (!employee) throw new Error("employee_not_found_for_pdf");
      const snapshot = await fetchEmployeePayrollSnapshot(employee.id, target.dateFrom, target.dateTo);
      return {
        language: isArabic ? "ar" : "en",
        employee: snapshot.employee || employee,
        snapshot,
        logoUrl: "/assets/daynight/merchant-statement-logo.png",
        generatedBy: "DAY NIGHT HR & Payroll Center",
      };
    } catch (error) {
      console.warn("Payroll RPC refresh failed; exporting the visible employee card.", error);
      return visiblePayload(target, isArabic);
    }
  }

  async function run(action: "download" | "share") {
    if (!target || busy) return;
    setBusy(action);
    try {
      const data = await payload();
      if (action === "download") await downloadEmployeePayrollPdfSafe(data);
      else await shareEmployeePayrollPdfSafe(data);
    } catch (error) {
      console.error("Employee payroll statement export failed.", error);
      const code = error instanceof Error ? error.message : String(error || "unknown_error");
      window.alert(isArabic
        ? `تعذر إنشاء كشف راتب الموظف. رمز الخطأ: ${code}`
        : `The employee payroll statement could not be created. Error: ${code}`);
    } finally {
      setBusy(null);
    }
  }

  if (!active || !target) return null;

  return createPortal(<>
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => void run("download")}
      className="dn-employee-pdf-primary"
    >
      {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {busy === "download" ? (isArabic ? "جارٍ إنشاء PDF..." : "Creating PDF...") : (isArabic ? "طباعة كشف الراتب PDF" : "Print payroll PDF")}
    </button>
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => void run("share")}
      className="dn-employee-pdf-share"
    >
      {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      {busy === "share" ? (isArabic ? "جارٍ تجهيز المشاركة..." : "Preparing share...") : (isArabic ? "إرسال كشف الموظف" : "Share employee statement")}
    </button>
  </>, target.host);
}
