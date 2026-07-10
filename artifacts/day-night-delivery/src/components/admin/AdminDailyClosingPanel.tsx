import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Printer, ShieldAlert } from "lucide-react";
import type { Order } from "../../types";
import {
  buildDailyClosingSnapshot,
  fetchDailyClosing,
  markDailyClosingReviewed,
  reopenDailyClosing,
  saveDailyClosingSnapshot,
  type DailyClosingSnapshot,
  type DailyClosingSource,
  type DailyClosingStatus,
  type FinanceSummary,
  type FinanceSummarySource,
} from "../../lib/adminData";
import AdminPdfExportButton from "./AdminPdfExportButton";
import "../../styles/dn-daily-closing.css";

type Props = { isArabic: boolean; orders: Order[]; financeSummary: FinanceSummary | null; financeSummarySource: FinanceSummarySource; onNavigate?: (id: string) => void };
const money = (value: unknown) => `${Number(value || 0).toFixed(2)} AED`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const statusText = (s: DailyClosingStatus | "unsaved", ar: boolean) => ar ? ({ unsaved: "غير محفوظ", draft: "مسودة", needs_review: "يحتاج مراجعة", closed: "مغلق", reopened: "أعيد فتحه" }[s]) : ({ unsaved: "Unsaved", draft: "Draft", needs_review: "Needs review", closed: "Closed", reopened: "Reopened" }[s]);
const sourceText = (s: DailyClosingSource | FinanceSummarySource, ar: boolean) => ar ? ({ rpc: "RPC", view: "View", derived: "مصدر مشتق", local: "حفظ مؤقت محلي" }[s]) : ({ rpc: "RPC", view: "View", derived: "Derived", local: "Local fallback" }[s]);

export default function AdminDailyClosingPanel({ isArabic, orders, financeSummary, financeSummarySource, onNavigate }: Props) {
  const [record, setRecord] = useState<DailyClosingSnapshot | null>(null);
  const [source, setSource] = useState<DailyClosingSource>(financeSummarySource);
  const [message, setMessage] = useState("");
  const date = todayKey();
  const derived = useMemo(() => buildDailyClosingSnapshot(date, orders, financeSummary, []), [date, orders, financeSummary]);
  const closing = record || derived;

  useEffect(() => { void fetchDailyClosing(date).then((result) => { setRecord(result.snapshot); setSource(result.source); if (result.warning) setMessage(result.warning); }); }, [date]);

  async function save() { const result = await saveDailyClosingSnapshot({ ...derived, status: record?.status || derived.status }); setRecord(result.snapshot); setSource(result.source); setMessage(result.saved ? "تم حفظ إغلاق اليوم في قاعدة البيانات." : (result.warning || "تعذر حفظ إغلاق اليوم في قاعدة البيانات، تم الاحتفاظ بالملخص مؤقتاً فقط.")); }
  async function review() { const result = await markDailyClosingReviewed(date, "Closing reviewed"); setRecord(result.snapshot); setSource(result.source); setMessage(result.saved ? "تمت مراجعة الإغلاق" : "مراجعة محلية مؤقتة — لم يتم الحفظ في قاعدة البيانات."); }
  async function reopen() { const result = await reopenDailyClosing(date, "Reopen day"); setRecord(result.snapshot); setSource(result.source); setMessage(result.saved ? "إعادة فتح اليوم" : "مراجعة محلية مؤقتة — لم يتم الحفظ في قاعدة البيانات."); }

  const cards = [
    ["طلبات اليوم", closing.total_orders], ["تم التسليم اليوم", closing.delivered_orders], ["ملغية اليوم", closing.cancelled_orders], ["راجعة اليوم", closing.returned_orders],
    ["دخل التوصيل اليوم", money(closing.delivery_income)], ["COD اليوم", money(closing.cod_total)], ["COD محصل", money(closing.cod_collected)], ["COD معلق", money(closing.cod_pending)],
    ["COD غير مسوى", money(closing.unreconciled_cod)], ["مصروفات اليوم", money(closing.expenses_total)], ["التسويات", money(closing.adjustments_net)], ["صافي اليوم", money(closing.net_total)],
    ["طلبات بدون مندوب", closing.unassigned_orders], ["طلبات تحتاج مراجعة", closing.pending_review_orders], ["مهام طباعة معلقة", closing.print_jobs_pending],
  ] as const;
  const summaryText = `إغلاق يومي ${closing.closing_date}: ${statusText(record ? closing.status : "unsaved", true)}، COD معلق ${money(closing.cod_pending)}، صافي اليوم ${money(closing.net_total)}.`;
  const pdfPayload = { language: isArabic ? ("ar" as const) : ("en" as const), sectionTitle: isArabic ? "إغلاق يومي" : "Daily closing", filters: `${sourceText(source, isArabic)} | ${closing.closing_date}`, totals: Object.fromEntries(cards), columns: [{ key: "metric", label: isArabic ? "البند" : "Metric" }, { key: "value", label: isArabic ? "القيمة" : "Value" }], rows: cards.map(([metric, value]) => ({ metric, value })) };

  return <section className={`dn-daily-closing ${closing.status}`} dir={isArabic ? "rtl" : "ltr"}>
    <header><div><span className="dn-source-badge">{sourceText(source, isArabic)}</span><h2>{isArabic ? "إغلاق يومي" : "Daily closing"}</h2><p>{isArabic ? "محفوظ في قاعدة البيانات عند توفر الجدول، مع حفظ مؤقت محلي واضح عند التعذر." : "DB-backed when the table exists, with clear local fallback."}</p></div><strong>{statusText(record ? closing.status : "unsaved", isArabic)}</strong></header>
    {message && <p className="dn-local-review">{message}</p>}
    <div className="dn-closing-grid">{cards.map(([label, value]) => <article key={label}><span>{isArabic ? label : label}</span><b>{value}</b></article>)}</div>
    <div className="dn-closing-actions">
      <button type="button" onClick={() => void save()}><CheckCircle2 />{isArabic ? "حفظ الإغلاق" : "Save closing"}</button>
      <button type="button" onClick={() => void review()}><CheckCircle2 />{isArabic ? "تمت مراجعة الإغلاق" : "Closing reviewed"}</button>
      <button type="button" onClick={() => void reopen()}>{isArabic ? "إعادة فتح اليوم" : "Reopen day"}</button>
      <button type="button" onClick={() => void navigator.clipboard?.writeText(summaryText)}><Clipboard />{isArabic ? "نسخ ملخص الإغلاق" : "Copy closing summary"}</button>
      <AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={pdfPayload} />
      <button type="button" onClick={() => onNavigate?.("cod")}><ShieldAlert />{isArabic ? "فتح التحصيل COD" : "Open COD"}</button>
      <button type="button" onClick={() => onNavigate?.("expenses")}>{isArabic ? "فتح المصروفات" : "Open expenses"}</button>
      <button type="button" onClick={() => onNavigate?.("driver_statements")}>{isArabic ? "فتح كشوفات المناديب" : "Open driver statements"}</button>
      <button type="button" onClick={() => onNavigate?.("merchant_statements")}>{isArabic ? "فتح كشوفات التجار" : "Open merchant statements"}</button>
      <button type="button" onClick={() => onNavigate?.("print")}><Printer />{isArabic ? "فتح الطباعة" : "Open print"}</button>
    </div>
  </section>;
}
