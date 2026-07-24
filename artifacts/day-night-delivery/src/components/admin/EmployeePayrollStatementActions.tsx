import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, Loader2, Share2 } from "lucide-react";
import { fetchEmployeePayrollSnapshot, fetchEmployees } from "../../lib/adminEmployees";
import {
  downloadEmployeePayrollPdf,
  shareEmployeePayrollPdf,
  type EmployeePayrollStatementPayload,
} from "../../lib/employeePayrollStatementExport";

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
  const actions = header.querySelector<HTMLElement>(".flex.flex-wrap.gap-2") || header;
  let host = actions.querySelector<HTMLElement>("[data-dn-employee-pdf-actions]");
  if (!host) {
    host = document.createElement("span");
    host.dataset.dnEmployeePdfActions = "true";
    host.className = "contents";
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
      return;
    }
    const sync = () => {
      const next = ensureTarget();
      setTarget((current) => sameTarget(current, next) ? current : next);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["value"] });
    const timer = window.setInterval(sync, 700);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [active]);

  async function payload(): Promise<EmployeePayrollStatementPayload> {
    if (!target) throw new Error("employee_pdf_target_missing");
    const employees = await fetchEmployees();
    const employee = employees.find((item) => String(item.employee_code || "").toUpperCase() === target.employeeCode);
    if (!employee) throw new Error("employee_not_found_for_pdf");
    const snapshot = await fetchEmployeePayrollSnapshot(employee.id, target.dateFrom, target.dateTo);
    return {
      language: isArabic ? "ar" : "en",
      employee: snapshot.employee || employee,
      snapshot,
      logoUrl: "https://i.postimg.cc/XqnP282D/cropped-circle-image-(9).png",
      generatedBy: "DAY NIGHT HR & Payroll Center",
    };
  }

  async function run(action: "download" | "share") {
    if (!target || busy) return;
    setBusy(action);
    try {
      const data = await payload();
      if (action === "download") await downloadEmployeePayrollPdf(data);
      else await shareEmployeePayrollPdf(data);
    } catch (error) {
      console.error("Employee payroll statement export failed.", error);
      window.alert(isArabic
        ? "تعذر إنشاء كشف راتب الموظف الآن. حدّث الصفحة وتأكد من تحديد الفترة ثم أعد المحاولة."
        : "The employee payroll statement could not be created. Refresh, confirm the period, and try again.");
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
      className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-[#031226] shadow-lg shadow-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {busy === "download" ? (isArabic ? "جارٍ إنشاء PDF..." : "Creating PDF...") : (isArabic ? "كشف راتب PDF" : "Payroll PDF")}
    </button>
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => void run("share")}
      className="inline-flex items-center gap-2 rounded-xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      {busy === "share" ? (isArabic ? "جارٍ تجهيز المشاركة..." : "Preparing share...") : (isArabic ? "مشاركة الكشف" : "Share statement")}
    </button>
  </>, target.host);
}
