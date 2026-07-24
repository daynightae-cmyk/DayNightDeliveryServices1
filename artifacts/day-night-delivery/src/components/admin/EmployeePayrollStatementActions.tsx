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
};

type PayrollPeriod = {
  dateFrom: string;
  dateTo: string;
};

const EMPLOYEE_CODE = /\bDN-EMP-[A-Z0-9-]+\b/i;
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function validIsoDate(value: unknown) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function automaticPeriod(employee?: Employee | null): PayrollPeriod {
  const end = today();
  const candidates = [
    monthStart(),
    validIsoDate(employee?.joined_at),
    validIsoDate(employee?.salary_effective_from),
  ].filter((value) => value && value <= end);
  const start = candidates.sort().at(-1) || monthStart();
  return { dateFrom: start, dateTo: end };
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

function ensureTarget(): Target | null {
  const root = document.querySelector<HTMLElement>(".dn-employee-hr-embedded-root");
  if (!root) return null;
  const header = Array.from(root.querySelectorAll<HTMLElement>("header")).find((candidate) =>
    EMPLOYEE_CODE.test(candidate.textContent || ""),
  );
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
  return { host, employeeCode };
}

function sameTarget(left: Target | null, right: Target | null) {
  return left?.host === right?.host && left?.employeeCode === right?.employeeCode;
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

function visibleEntries(root: HTMLElement, period: PayrollPeriod): EmployeePayrollEntry[] {
  const section = Array.from(root.querySelectorAll<HTMLElement>("section")).find((candidate) =>
    /كشف راتب الفترة|Payroll period/i.test(clean(candidate.textContent)),
  );
  const rows = Array.from(section?.querySelectorAll<HTMLTableRowElement>("tbody tr") || []);
  return rows.map((row, index) => {
    const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td")).map((cell) => clean(cell.textContent, "—"));
    const movement = cells[1] || "adjustment";
    const effect = cells[3] || "";
    const entryType = entryTypeFromText(movement);
    return {
      id: `visible-entry-${index}`,
      entry_date: validIsoDate(cells[0]) || period.dateFrom,
      entry_type: entryType,
      original_entry_type: entryType,
      direction: /إضافة|credit/i.test(effect) ? "credit" : "debit",
      amount: amountFromText(cells[4]),
      notes: cells[2] || "—",
      status: /ملغ|void/i.test(cells[5] || "") ? "void" : "approved",
      source: "visible_payroll_fallback",
      created_at: new Date().toISOString(),
    };
  });
}

function visibleSalaryHistory(root: HTMLElement, period: PayrollPeriod): EmployeeSalaryHistory[] {
  const section = Array.from(root.querySelectorAll<HTMLElement>("section")).find((candidate) =>
    /تاريخ الراتب الأساسي|Base salary history/i.test(clean(candidate.textContent)),
  );
  const rows = Array.from(section?.querySelectorAll<HTMLTableRowElement>("tbody tr") || []);
  return rows.map((row, index) => {
    const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td")).map((cell) => clean(cell.textContent, "—"));
    return {
      id: `visible-history-${index}`,
      base_salary: amountFromText(cells[2] || cells[0]),
      salary_currency: "AED",
      salary_cycle: cells[3] || "monthly",
      effective_from: validIsoDate(cells[0]) || period.dateFrom,
      effective_to: validIsoDate(cells[1]) || null,
      change_amount: amountFromText(cells[4]),
      note: cells[5] || "—",
      created_at: new Date().toISOString(),
    };
  });
}

function visiblePayload(
  target: Target,
  isArabic: boolean,
  period: PayrollPeriod,
  knownEmployee?: Employee | null,
): EmployeePayrollStatementPayload {
  const root = document.querySelector<HTMLElement>(".dn-employee-hr-embedded-root");
  const header = root?.querySelector<HTMLElement>('[data-dn-employee-detail-header="true"]');
  if (!root || !header) throw new Error("employee_visible_payload_missing");

  const headingCandidates = Array.from(header.querySelectorAll<HTMLElement>("h1,h2,h3,strong"))
    .map((node) => clean(node.textContent))
    .filter((value) => value && !EMPLOYEE_CODE.test(value) && !/اتصال|واتساب|PDF|كشف|إرسال|Call|WhatsApp|Share|Print/i.test(value));
  const fullName = knownEmployee?.full_name || headingCandidates.sort((left, right) => right.length - left.length)[0] || "DAY NIGHT Employee";
  const phone = knownEmployee?.phone || clean(header.querySelector<HTMLAnchorElement>('a[href^="tel:"]')?.getAttribute("href")?.replace(/^tel:/, ""), "Not set");
  const baseSalaryInput = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="number"]')).find((input) => amountFromText(input.value) > 0);
  const grossSalary = visibleMetric(root, [/راتب الفترة/i, /Period salary/i]);
  const credits = visibleMetric(root, [/المكافآت والإضافات/i, /Credits & bonuses/i]);
  const debits = visibleMetric(root, [/الخصومات والسلف/i, /Deductions & advances/i]);
  const netSalary = visibleMetric(root, [/صافي الاستحقاق/i, /Net entitlement/i]);
  const payments = visibleMetric(root, [/المدفوع/i, /^Paid/i]);
  const outstanding = visibleMetric(root, [/المتبقي للموظف/i, /Outstanding/i]);
  const liability = visibleMetric(root, [/مستحق على الموظف/i, /Employee liability/i]);

  const employee: Employee = knownEmployee || {
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
    joined_at: period.dateFrom,
    employment_status: "active",
    base_salary: amountFromText(baseSalaryInput?.value || grossSalary),
    salary_currency: "AED",
    salary_cycle: "monthly",
    salary_effective_from: period.dateFrom,
    avatar_url: null,
  };

  const snapshot: EmployeePayrollSnapshot = {
    employee,
    period_from: period.dateFrom,
    period_to: period.dateTo,
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
    calculation_method: "automatic_current_period_visible_fallback",
    salary_history: visibleSalaryHistory(root, period),
    entries: visibleEntries(root, period),
  };

  return {
    language: isArabic ? "ar" : "en",
    employee,
    snapshot,
    logoUrl: "/assets/daynight/merchant-statement-logo.png",
    generatedBy: "DAY NIGHT HR & Payroll Center",
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openPrintFallback(payload: EmployeePayrollStatementPayload) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) throw new Error("employee_print_document_unavailable");
  const ar = payload.language === "ar";
  const deductions = Number(payload.snapshot.debits || 0);
  const rows = payload.snapshot.entries.map((entry) => `
    <tr><td>${escapeHtml(entry.entry_date)}</td><td>${escapeHtml(entry.entry_type)}</td><td>${escapeHtml(entry.notes)}</td><td>${escapeHtml(entry.amount.toFixed(2))}</td><td>${escapeHtml(entry.status)}</td></tr>`).join("");
  doc.open();
  doc.write(`<!doctype html><html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${escapeHtml(payload.employee.full_name)}</title><style>
    body{font-family:Tahoma,Arial,sans-serif;margin:28px;color:#071a33}header{border-radius:18px;background:#031226;color:#fff;padding:22px;border-bottom:6px solid #d4af37}h1{margin:0;color:#d4af37}.info,.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.card{border:1px solid #d9e2ee;border-radius:12px;padding:12px}.card b{display:block;margin-top:7px;font-size:17px}table{width:100%;border-collapse:collapse;margin-top:18px}th{background:#d4af37;color:#071a33}th,td{border:1px solid #d9e2ee;padding:8px;text-align:center}footer{margin-top:24px;border-top:2px solid #d4af37;padding-top:12px;text-align:center;font-weight:700}@media print{body{margin:12mm}button{display:none}}
  </style></head><body><header><h1>DAY NIGHT DELIVERY SERVICES</h1><h2>${ar ? "كشف راتب الموظف" : "Employee Payroll Statement"}</h2><p>${escapeHtml(payload.snapshot.period_from)} — ${escapeHtml(payload.snapshot.period_to)}</p></header>
  <section class="info"><div class="card">${ar ? "الموظف" : "Employee"}<b>${escapeHtml(payload.employee.full_name)}</b></div><div class="card">${ar ? "الكود" : "Code"}<b>${escapeHtml(payload.employee.employee_code)}</b></div><div class="card">${ar ? "الهاتف" : "Phone"}<b>${escapeHtml(payload.employee.phone)}</b></div><div class="card">${ar ? "الوظيفة" : "Role"}<b>${escapeHtml(payload.employee.custom_job_title || payload.employee.employee_type)}</b></div></section>
  <section class="summary"><div class="card">${ar ? "راتب الفترة" : "Period salary"}<b>${payload.snapshot.gross_salary.toFixed(2)} AED</b></div><div class="card">${ar ? "الإضافات" : "Credits"}<b>${payload.snapshot.credits.toFixed(2)} AED</b></div><div class="card">${ar ? "الخصومات والسلف" : "Deductions"}<b>${deductions.toFixed(2)} AED</b></div><div class="card">${ar ? "صافي الاستحقاق" : "Net entitlement"}<b>${payload.snapshot.net_salary.toFixed(2)} AED</b></div><div class="card">${ar ? "المدفوع" : "Paid"}<b>${payload.snapshot.payments.toFixed(2)} AED</b></div><div class="card">${ar ? "المتبقي" : "Outstanding"}<b>${payload.snapshot.outstanding.toFixed(2)} AED</b></div></section>
  <table><thead><tr><th>${ar ? "التاريخ" : "Date"}</th><th>${ar ? "الحركة" : "Movement"}</th><th>${ar ? "السبب" : "Reason"}</th><th>${ar ? "القيمة" : "Amount"}</th><th>${ar ? "الحالة" : "Status"}</th></tr></thead><tbody>${rows || `<tr><td colspan="5">${ar ? "لا توجد حركات ضمن الفترة الحالية" : "No movements in the current period"}</td></tr>`}</tbody></table>
  <footer>www.daynightae.com · +971 56 875 7331 · Admin@daynightae.com</footer></body></html>`);
  doc.close();
  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 3000);
  }, 250);
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
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(sync, 700);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      document.body.classList.remove("dn-employee-detail-active");
    };
  }, [active]);

  async function payload(): Promise<EmployeePayrollStatementPayload> {
    if (!target) throw new Error("employee_pdf_target_missing");
    let employee: Employee | null = null;
    try {
      const employees = await fetchEmployees();
      const normalizedCode = target.employeeCode.replace(/\s+/g, "").toUpperCase();
      employee = employees.find((item) =>
        String(item.employee_code || "").replace(/\s+/g, "").toUpperCase() === normalizedCode,
      ) || null;
    } catch (error) {
      console.warn("Employee directory refresh failed; using visible card data.", error);
    }

    const period = automaticPeriod(employee);
    if (employee) {
      try {
        const snapshot = await fetchEmployeePayrollSnapshot(employee.id, period.dateFrom, period.dateTo);
        return {
          language: isArabic ? "ar" : "en",
          employee: snapshot.employee || employee,
          snapshot,
          logoUrl: "/assets/daynight/merchant-statement-logo.png",
          generatedBy: "DAY NIGHT HR & Payroll Center",
        };
      } catch (error) {
        console.warn("Payroll RPC refresh failed; exporting the visible employee card.", error);
      }
    }
    return visiblePayload(target, isArabic, period, employee);
  }

  async function run(action: "download" | "share") {
    if (!target || busy) return;
    setBusy(action);
    let data: EmployeePayrollStatementPayload | null = null;
    try {
      data = await payload();
      if (action === "download") await downloadEmployeePayrollPdfSafe(data);
      else await shareEmployeePayrollPdfSafe(data);
    } catch (error) {
      console.error("Employee payroll statement export failed.", error);
      if (action === "download" && data) {
        try {
          openPrintFallback(data);
          window.alert(isArabic
            ? "تعذر التنزيل التلقائي، لذلك فُتح كشف الطباعة الاحتياطي. اختر حفظ كملف PDF من نافذة الطباعة."
            : "Automatic download failed, so the print-ready statement was opened. Choose Save as PDF in the print dialog.");
          return;
        } catch (printError) {
          console.error("Employee payroll print fallback failed.", printError);
        }
      }
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
      title={isArabic ? "الفترة تُحسب تلقائيًا من بداية الشهر أو بداية الاستحقاق حتى اليوم" : "The period is calculated automatically from month start or entitlement start through today"}
      disabled={busy !== null}
      onClick={() => void run("download")}
      className="dn-employee-pdf-primary"
    >
      {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {busy === "download"
        ? (isArabic ? "جارٍ إنشاء الكشف..." : "Creating statement...")
        : (isArabic ? "كشف الراتب الحالي PDF" : "Current payroll PDF")}
    </button>
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => void run("share")}
      className="dn-employee-pdf-share"
    >
      {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      {busy === "share"
        ? (isArabic ? "جارٍ تجهيز المشاركة..." : "Preparing share...")
        : (isArabic ? "إرسال كشف الراتب" : "Share payroll statement")}
    </button>
  </>, target.host);
}
