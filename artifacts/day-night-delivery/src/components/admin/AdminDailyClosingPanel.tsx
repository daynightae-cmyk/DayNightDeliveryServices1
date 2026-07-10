import { useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Printer, ShieldAlert } from "lucide-react";
import type { Order } from "../../types";
import type { FinanceSummary, FinanceSummarySource } from "../../lib/adminData";
import AdminPdfExportButton from "./AdminPdfExportButton";
import "../../styles/dn-daily-closing.css";

type Props = {
  isArabic: boolean;
  orders: Order[];
  financeSummary: FinanceSummary | null;
  financeSummarySource: FinanceSummarySource;
  onNavigate?: (id: string) => void;
};

type ClosingStatus = "ready" | "review" | "risk";

const money = (value: unknown) => `${Number(value || 0).toFixed(2)} AED`;
const norm = (value: unknown) => String(value || "").toLowerCase();
const todayKey = () => new Date().toISOString().slice(0, 10);
const revenue = (order: Order) => Number(order.delivery_price || order.price || order.base_price || 0);
const cod = (order: Order) => Number(order.cod_amount || 0);
const sourceLabel = (source: FinanceSummarySource, ar: boolean) => ar ? ({ rpc: "مصدر البيانات: RPC", view: "مصدر البيانات: View", derived: "مصدر البيانات: مشتق من الطلبات" }[source]) : ({ rpc: "Data source: RPC", view: "Data source: View", derived: "Data source: Derived" }[source]);

function statusLabel(status: ClosingStatus, ar: boolean) {
  if (status === "risk") return ar ? "خطر مالي — لا تغلق اليوم بعد" : "Financial risk — do not close yet";
  if (status === "review") return ar ? "يحتاج مراجعة قبل الإغلاق" : "Needs review before close";
  return ar ? "جاهز للإغلاق" : "Ready to close";
}

export default function AdminDailyClosingPanel({ isArabic, orders, financeSummary, financeSummarySource, onNavigate }: Props) {
  const [reviewedAt, setReviewedAt] = useState(() => window.localStorage.getItem(`dn-closing-reviewed-${todayKey()}`) || "");
  const closing = useMemo(() => {
    const today = todayKey();
    const todayOrders = orders.filter((order) => String(order.created_at || order.updated_at || "").slice(0, 10) === today);
    const deliveredToday = todayOrders.filter((order) => /deliver|complete/.test(norm(order.status)));
    const cancelledToday = todayOrders.filter((order) => /cancel|fail/.test(norm(order.status)));
    const returnedToday = todayOrders.filter((order) => /return/.test(norm(order.status)));
    const activeOrders = todayOrders.filter((order) => !/deliver|complete|cancel|fail|return/.test(norm(order.status)));
    const pendingReviewOrders = todayOrders.filter((order) => /review|confirm|hold|pending/.test(norm(order.status)));
    const unassignedActiveOrders = activeOrders.filter((order) => !(order as Order & { driver_id?: string; assigned_driver_id?: string }).driver_id && !(order as Order & { driver_id?: string; assigned_driver_id?: string }).assigned_driver_id && !order.driver_name);
    const deliveryIncomeToday = todayOrders.reduce((sum, order) => sum + revenue(order), 0);
    const codTotalToday = todayOrders.reduce((sum, order) => sum + cod(order), 0);
    const codCollectedToday = deliveredToday.reduce((sum, order) => sum + cod(order), 0);
    const codPendingToday = Math.max(0, Number(financeSummary?.cod_pending ?? codTotalToday - codCollectedToday));
    const unreconciledCod = Math.max(0, codCollectedToday - Number(financeSummary?.cod_reconciled || 0));
    const expensesToday = Number(financeSummary?.total_expenses || 0);
    const adjustmentsToday = 0;
    const netToday = deliveryIncomeToday - expensesToday + adjustmentsToday;
    const expensesDraft = 0;
    const printJobsPending = 0;
    const status: ClosingStatus = netToday < 0 ? "risk" : (codPendingToday > 0 || unreconciledCod > 0 || pendingReviewOrders.length > 0 || expensesDraft > 0 ? "review" : "ready");
    return { today, todayOrders, deliveredToday, cancelledToday, returnedToday, deliveryIncomeToday, codCollectedToday, codPendingToday, expensesToday, adjustmentsToday, netToday, unassignedActiveOrders, pendingReviewOrders, unreconciledCod, printJobsPending, expensesDraft, status };
  }, [orders, financeSummary]);

  const cards = [
    [isArabic ? "طلبات اليوم" : "Today's orders", closing.todayOrders.length],
    [isArabic ? "تم تسليمها اليوم" : "Delivered today", closing.deliveredToday.length],
    [isArabic ? "ملغاة اليوم" : "Cancelled today", closing.cancelledToday.length],
    [isArabic ? "راجعة اليوم" : "Returned today", closing.returnedToday.length],
    [isArabic ? "دخل التوصيل اليوم" : "Delivery income today", money(closing.deliveryIncomeToday)],
    [isArabic ? "تحصيل اليوم" : "COD collected today", money(closing.codCollectedToday)],
    [isArabic ? "COD معلق اليوم" : "COD pending today", money(closing.codPendingToday)],
    [isArabic ? "مصروفات اليوم" : "Expenses today", money(closing.expensesToday)],
    [isArabic ? "تسويات اليوم" : "Adjustments today", money(closing.adjustmentsToday)],
    [isArabic ? "صافي اليوم" : "Net today", money(closing.netToday)],
    [isArabic ? "طلبات نشطة غير معينة" : "Unassigned active orders", closing.unassignedActiveOrders.length],
    [isArabic ? "طلبات تحتاج مراجعة" : "Pending review orders", closing.pendingReviewOrders.length],
    [isArabic ? "COD غير مسوى" : "Unreconciled COD", money(closing.unreconciledCod)],
    [isArabic ? "مهام طباعة معلقة" : "Print jobs pending", closing.printJobsPending],
  ] as const;
  const summaryText = `${isArabic ? "ملخص الإغلاق" : "Closing summary"} ${closing.today}: ${statusLabel(closing.status, isArabic)}. COD ${money(closing.codPendingToday)}, ${isArabic ? "صافي اليوم" : "net"} ${money(closing.netToday)}.`;
  const markReviewed = () => { const value = new Date().toISOString(); window.localStorage.setItem(`dn-closing-reviewed-${closing.today}`, value); setReviewedAt(value); };

  return <section className={`dn-daily-closing ${closing.status}`} dir={isArabic ? "rtl" : "ltr"}>
    <header><div><span className="dn-source-badge">{sourceLabel(financeSummarySource, isArabic)}</span><h2>{isArabic ? "إغلاق اليوم" : "Daily closing"}</h2><p>{isArabic ? "ملخص الإغلاق ومراجعة التحصيل والمصروفات قبل نهاية اليوم." : "Closing summary and reconciliation review before end of day."}</p></div><strong>{statusLabel(closing.status, isArabic)}</strong></header>
    <div className="dn-closing-grid">{cards.map(([label, value]) => <article key={label}><span>{label}</span><b>{value}</b></article>)}</div>
    <div className="dn-closing-actions">
      <AdminPdfExportButton label={isArabic ? "تصدير PDF إغلاق اليوم" : "Export daily closing PDF"} payload={{ language: isArabic ? "ar" : "en", sectionTitle: isArabic ? "إغلاق اليوم" : "Daily closing", filters: `${isArabic ? "مصدر البيانات" : "Data source"}: ${financeSummarySource.toUpperCase()} | ${isArabic ? "تم الإنشاء" : "Generated"}: ${new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE")}`, totals: Object.fromEntries(cards.map(([label, value]) => [label, value])), columns: [{ key: "decision", label: isArabic ? "قرار الإغلاق" : "Closing decision" }, { key: "recommendation", label: isArabic ? "توصية خليفة" : "Khalifa recommendation" }], rows: [{ decision: statusLabel(closing.status, isArabic), recommendation: closing.status === "ready" ? (isArabic ? "يمكن الإغلاق بعد حفظ التقرير." : "Close after saving the report.") : (isArabic ? "راجع COD والمصروفات والطلبات المعلقة أولاً." : "Review COD, expenses, and pending orders first.") }] }} />
      <button type="button" onClick={() => window.print()}><Printer />{isArabic ? "طباعة تقرير الإغلاق" : "Print closing report"}</button>
      <button type="button" onClick={() => onNavigate?.("cod")}><ShieldAlert />{isArabic ? "فتح تسوية COD" : "Open COD reconciliation"}</button>
      <button type="button" onClick={() => onNavigate?.("expenses")}>{isArabic ? "فتح المصروفات" : "Open expenses"}</button>
      <button type="button" onClick={() => onNavigate?.("driver_statements")}>{isArabic ? "فتح كشوف المناديب" : "Open driver statements"}</button>
      <button type="button" onClick={() => onNavigate?.("merchant_statements")}>{isArabic ? "فتح كشوف التجار" : "Open merchant statements"}</button>
      <button type="button" onClick={() => void navigator.clipboard?.writeText(summaryText)}><Clipboard />{isArabic ? "نسخ ملخص الإغلاق" : "Copy closing summary"}</button>
      <button type="button" onClick={markReviewed}><CheckCircle2 />{isArabic ? "تمت مراجعة اليوم" : "Mark day as reviewed"}</button>
    </div>
    <p className="dn-local-review">{reviewedAt ? (isArabic ? `مراجعة محلية مؤقتة: ${new Date(reviewedAt).toLocaleString("ar-AE")}` : `Temporary local review: ${new Date(reviewedAt).toLocaleString("en-AE")}`) : (isArabic ? "مراجعة محلية مؤقتة — لا يوجد حفظ قاعدة بيانات بعد." : "Temporary local review — no database save yet.")}</p>
  </section>;
}
