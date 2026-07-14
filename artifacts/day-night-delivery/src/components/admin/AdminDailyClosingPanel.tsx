import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, FileMinus, Printer, RotateCcw, ShieldAlert, Store, Truck } from "lucide-react";
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
import { AdminIconBadge, AdminStateChip, type AdminIconName } from "./adminIconSystem";
import { addAdminNotification } from "../../lib/adminAudio";
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

  useEffect(() => {
    const hasRisk = Number(closing.net_total || 0) < 0 || Number(closing.unreconciled_cod || 0) > 0;
    const needsReview = Number(closing.cod_pending || 0) > 0 || Number(closing.unassigned_orders || 0) > 0 || Number(closing.pending_review_orders || 0) > 0;
    if (hasRisk) addAdminNotification({ type: "warning", sectionId: "daily_closing", priority: "high", dedupeKey: `closing:${date}:risk`, audioEvent: "warning", titleAr: "خطر مالي قبل الإغلاق", titleEn: "Financial risk before closing", bodyAr: `صافي اليوم ${money(closing.net_total)} و COD غير مسوى ${money(closing.unreconciled_cod)}.`, bodyEn: `Net total is ${money(closing.net_total)} and unresolved COD is ${money(closing.unreconciled_cod)}.` });
    else if (needsReview) addAdminNotification({ type: "daily_closing", sectionId: "daily_closing", priority: "high", dedupeKey: `closing:${date}:review:${closing.cod_pending}:${closing.unassigned_orders}:${closing.pending_review_orders}`, audioEvent: "daily_closing_warning", titleAr: "الإغلاق يحتاج مراجعة", titleEn: "Closing needs review", bodyAr: `COD معلق ${money(closing.cod_pending)}، بدون مندوب ${closing.unassigned_orders}، مراجعة ${closing.pending_review_orders}.`, bodyEn: `Pending COD ${money(closing.cod_pending)}, unassigned ${closing.unassigned_orders}, review ${closing.pending_review_orders}.` });
    else addAdminNotification({ type: "daily_closing", sectionId: "daily_closing", priority: "normal", dedupeKey: `closing:${date}:ready`, audioEvent: "daily_closing_ready", titleAr: "اليوم جاهز للإغلاق", titleEn: "Day is ready to close", bodyAr: "كل المؤشرات الأساسية تسمح بإغلاق اليوم.", bodyEn: "All core indicators allow closing the day." });
  }, [date, closing.status, closing.cod_pending, closing.unassigned_orders, closing.pending_review_orders, closing.unreconciled_cod, closing.net_total]);

  useEffect(() => { void fetchDailyClosing(date).then((result) => { setRecord(result.snapshot); setSource(result.source); if (result.warning) setMessage(result.warning); }); }, [date]);

  async function save() { const result = await saveDailyClosingSnapshot({ ...derived, status: record?.status || derived.status }); setRecord(result.snapshot); setSource(result.source); setMessage(result.saved ? (isArabic ? "تم حفظ إغلاق اليوم في قاعدة البيانات." : "Daily closing saved to the database.") : (result.warning || (isArabic ? "تعذر حفظ إغلاق اليوم في قاعدة البيانات، تم الاحتفاظ بالملخص مؤقتاً فقط." : "Database save failed; the summary is available only as a temporary fallback."))); }
  async function review() { const result = await markDailyClosingReviewed(date, "Closing reviewed"); setRecord(result.snapshot); setSource(result.source); setMessage(result.saved ? (isArabic ? "تمت مراجعة الإغلاق" : "Closing marked as reviewed") : (isArabic ? "مراجعة محلية مؤقتة — لم يتم الحفظ في قاعدة البيانات." : "Temporary local review — not saved to the database.")); }
  async function reopen() { const result = await reopenDailyClosing(date, "Reopen day"); setRecord(result.snapshot); setSource(result.source); setMessage(result.saved ? (isArabic ? "تمت إعادة فتح اليوم" : "Day reopened") : (isArabic ? "إعادة فتح محلية مؤقتة — لم يتم الحفظ في قاعدة البيانات." : "Temporary local reopen — not saved to the database.")); }

  const cards: Array<{ ar: string; en: string; value: string | number; icon: AdminIconName }> = [
    { ar: "طلبات اليوم", en: "Today's orders", value: closing.total_orders, icon: "orders" },
    { ar: "تم التسليم اليوم", en: "Delivered today", value: closing.delivered_orders, icon: "delivered-orders" },
    { ar: "ملغية اليوم", en: "Cancelled today", value: closing.cancelled_orders, icon: "cancelled-orders" },
    { ar: "راجعة اليوم", en: "Returned today", value: closing.returned_orders, icon: "returned-orders" },
    { ar: "دخل التوصيل اليوم", en: "Delivery income today", value: money(closing.delivery_income), icon: "income" },
    { ar: "COD اليوم", en: "Today's COD", value: money(closing.cod_total), icon: "cod" },
    { ar: "COD محصل", en: "Collected COD", value: money(closing.cod_collected), icon: "cash-collection" },
    { ar: "COD معلق", en: "Pending COD", value: money(closing.cod_pending), icon: "warning" },
    { ar: "COD غير مسوى", en: "Unreconciled COD", value: money(closing.unreconciled_cod), icon: "warning" },
    { ar: "مصروفات اليوم", en: "Today's expenses", value: money(closing.expenses_total), icon: "expenses" },
    { ar: "التسويات", en: "Adjustments", value: money(closing.adjustments_net), icon: "adjustments" },
    { ar: "صافي اليوم", en: "Today's net", value: money(closing.net_total), icon: "income" },
    { ar: "طلبات بدون مندوب", en: "Unassigned orders", value: closing.unassigned_orders, icon: "unassigned-orders" },
    { ar: "طلبات تحتاج مراجعة", en: "Orders needing review", value: closing.pending_review_orders, icon: "review-orders-status" },
    { ar: "مهام طباعة معلقة", en: "Pending print jobs", value: closing.print_jobs_pending, icon: "printer" },
  ];
  const summaryText = isArabic
    ? `إغلاق يومي ${closing.closing_date}: ${statusText(record ? closing.status : "unsaved", true)}، COD معلق ${money(closing.cod_pending)}، صافي اليوم ${money(closing.net_total)}.`
    : `Daily closing ${closing.closing_date}: ${statusText(record ? closing.status : "unsaved", false)}, pending COD ${money(closing.cod_pending)}, net ${money(closing.net_total)}.`;
  const pdfPayload = { language: isArabic ? ("ar" as const) : ("en" as const), sectionTitle: isArabic ? "إغلاق يومي" : "Daily closing", filters: `${sourceText(source, isArabic)} | ${closing.closing_date}`, totals: Object.fromEntries(cards.map((card) => [isArabic ? card.ar : card.en, card.value])), columns: [{ key: "metric", label: isArabic ? "البند" : "Metric" }, { key: "value", label: isArabic ? "القيمة" : "Value" }], rows: cards.map((card) => ({ metric: isArabic ? card.ar : card.en, value: card.value })) };

  return (
    <section className={`dn-daily-closing ${closing.status}`} dir={isArabic ? "rtl" : "ltr"}>
      <header>
        <div className="dn-closing-title">
          <AdminIconBadge name="daily-closing" label={isArabic ? "إغلاق يومي" : "Daily closing"} />
          <div>
            <AdminStateChip name={source === "derived" || source === "local" ? "warning" : "database-health"} tone={source === "derived" || source === "local" ? "warning" : "success"}>
              {sourceText(source, isArabic)}
            </AdminStateChip>
            <h2>{isArabic ? "إغلاق يومي" : "Daily closing"}</h2>
            <p>{isArabic ? "محفوظ في قاعدة البيانات عند توفر الجدول، مع حفظ مؤقت محلي واضح عند التعذر." : "DB-backed when the table exists, with clear local fallback."}</p>
          </div>
        </div>
        <AdminStateChip name="daily-closing" tone={closing.status === "closed" ? "success" : "warning"}>
          {statusText(record ? closing.status : "unsaved", isArabic)}
        </AdminStateChip>
      </header>

      {message && <p className="dn-local-review">{message}</p>}

      <div className="dn-closing-grid">
        {cards.map((card) => (
          <article key={card.en}>
            <AdminIconBadge name={card.icon} label={isArabic ? card.ar : card.en} />
            <span>{isArabic ? card.ar : card.en}</span>
            <b>{card.value}</b>
          </article>
        ))}
      </div>

      <div className="dn-closing-actions">
        <button type="button" onClick={() => void save()}>
          <CheckCircle2 aria-hidden="true" />
          {isArabic ? "حفظ الإغلاق" : "Save closing"}
        </button>
        <button type="button" onClick={() => void review()}>
          <CheckCircle2 aria-hidden="true" />
          {isArabic ? "تمت مراجعة الإغلاق" : "Closing reviewed"}
        </button>
        <button type="button" onClick={() => void reopen()}>
          <RotateCcw aria-hidden="true" />
          {isArabic ? "إعادة فتح اليوم" : "Reopen day"}
        </button>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(summaryText)}>
          <Clipboard aria-hidden="true" />
          {isArabic ? "نسخ ملخص الإغلاق" : "Copy closing summary"}
        </button>
        <AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={pdfPayload} />
        <button type="button" onClick={() => onNavigate?.("cod")}>
          <ShieldAlert aria-hidden="true" />
          {isArabic ? "فتح التحصيل COD" : "Open COD"}
        </button>
        <button type="button" onClick={() => onNavigate?.("expenses")}>
          <FileMinus aria-hidden="true" />
          {isArabic ? "فتح المصروفات" : "Open expenses"}
        </button>
        <button type="button" onClick={() => onNavigate?.("driver_statements")}>
          <Truck aria-hidden="true" />
          {isArabic ? "فتح كشوفات المناديب" : "Open driver statements"}
        </button>
        <button type="button" onClick={() => onNavigate?.("merchant_statements")}>
          <Store aria-hidden="true" />
          {isArabic ? "فتح كشوفات التجار" : "Open merchant statements"}
        </button>
        <button type="button" onClick={() => onNavigate?.("print")}>
          <Printer aria-hidden="true" />
          {isArabic ? "فتح الطباعة" : "Open print"}
        </button>
      </div>
    </section>
  );
}
