import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, Loader2, Share2 } from "lucide-react";
import { fetchEmployeePayrollSnapshot, fetchEmployees } from "../../lib/adminEmployees";
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
