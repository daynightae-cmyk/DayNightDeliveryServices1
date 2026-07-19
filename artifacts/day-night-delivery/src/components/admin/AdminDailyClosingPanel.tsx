import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileMinus,
  Landmark,
  Loader2,
  PiggyBank,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Store,
  Truck,
} from "lucide-react";
import type { Order } from "../../types";
import {
  fetchAuthoritativeDailyClosing,
  saveAuthoritativeDailyClosing,
} from "../../lib/adminFinanceLedger";
import { financialsFromOrder } from "../../lib/orderFinancials";
import type { FinanceSummary, FinanceSummarySource } from "../../lib/adminData";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { AdminIconBadge, AdminStateChip, type AdminIconName } from "./adminIconSystem";
import { addAdminNotification, playAdminAudioEvent } from "../../lib/adminAudio";
import "../../styles/dn-daily-closing.css";

type Props = {
  isArabic: boolean;
  orders: Order[];
  financeSummary: FinanceSummary | null;
  financeSummarySource: FinanceSummarySource;
  onNavigate?: (id: string) => void;
};

type ClosingStatus = "draft" | "needs_review" | "closed" | "reopened";

type ClosingSnapshot = Record<string, unknown> & {
  closing_date: string;
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  goods_value: number;
  delivery_income: number;
  discounts_total: number;
  customer_total: number;
  merchant_due: number;
  cod_total: number;
  cod_collected: number;
  cod_pending: number;
  cod_reconciled: number;
  expenses_total: number;
  adjustments_net: number;
  net_total: number;
  budget_allocated: number;
  budget_remaining: number;
  unassigned_orders: number;
  pending_review_orders: number;
  unreconciled_cod: number;
  unposted_delivered_orders: number;
  print_jobs_pending: number;
  status: ClosingStatus;
  source: "rpc" | "preview";
  notes?: string;
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: unknown) => `${num(value).toFixed(2)} AED`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const normalizeStatus = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
const isDelivered = (order: Order) => ["delivered", "completed", "complete"].includes(normalizeStatus(order.status));

function statusText(status: ClosingStatus | "blocked", isArabic: boolean) {
  const labels: Record<string, [string, string]> = {
    blocked: ["غير متصل بالدفتر المالي", "Finance ledger unavailable"],
    draft: ["مسودة", "Draft"],
    needs_review: ["يحتاج مراجعة", "Needs review"],
    closed: ["مغلق", "Closed"],
    reopened: ["أعيد فتحه", "Reopened"],
  };
  return labels[status][isArabic ? 0 : 1];
}

function normalizeSnapshot(raw: Record<string, unknown>): ClosingSnapshot {
  const status = normalizeStatus(raw.status);
  return {
    ...raw,
    closing_date: String(raw.closing_date || todayKey()),
    total_orders: num(raw.total_orders),
    delivered_orders: num(raw.delivered_orders),
    cancelled_orders: num(raw.cancelled_orders),
    returned_orders: num(raw.returned_orders),
    goods_value: num(raw.goods_value),
    delivery_income: num(raw.delivery_income),
    discounts_total: num(raw.discounts_total),
    customer_total: num(raw.customer_total),
    merchant_due: num(raw.merchant_due),
    cod_total: num(raw.cod_total),
    cod_collected: num(raw.cod_collected),
    cod_pending: num(raw.cod_pending),
    cod_reconciled: num(raw.cod_reconciled),
    expenses_total: num(raw.expenses_total),
    adjustments_net: num(raw.adjustments_net),
    net_total: num(raw.net_total),
    budget_allocated: num(raw.budget_allocated),
    budget_remaining: num(raw.budget_remaining),
    unassigned_orders: num(raw.unassigned_orders),
    pending_review_orders: num(raw.pending_review_orders),
    unreconciled_cod: num(raw.unreconciled_cod),
    unposted_delivered_orders: num(raw.unposted_delivered_orders),
    print_jobs_pending: num(raw.print_jobs_pending),
    status: ["draft", "needs_review", "closed", "reopened"].includes(status) ? (status as ClosingStatus) : "needs_review",
    source: raw.source === "rpc" ? "rpc" : "preview",
    notes: String(raw.notes || "").trim() || undefined,
  };
}

function buildPreview(date: string, orders: Order[]): ClosingSnapshot {
  const dayOrders = orders.filter((order) => String(order.created_at || order.updated_at || "").slice(0, 10) === date);
  const delivered = dayOrders.filter(isDelivered);
  const financial = delivered.map((order) => financialsFromOrder(order as Order & Record<string, unknown>));
  const total = (key: keyof ReturnType<typeof financialsFromOrder>) => financial.reduce((sum, row) => sum + num(row[key]), 0);
  const collected = delivered.reduce((sum, order) => sum + num(order.collected_amount), 0);
  const unposted = delivered.filter((order) => !order.financial_posted_at).length;
  const codTotal = total("customerTotal");
  return {
    closing_date: date,
    total_orders: dayOrders.length,
    delivered_orders: delivered.length,
    cancelled_orders: dayOrders.filter((order) => ["cancelled", "canceled", "failed"].includes(normalizeStatus(order.status))).length,
    returned_orders: dayOrders.filter((order) => normalizeStatus(order.status) === "returned").length,
    goods_value: total("goodsValue"),
    delivery_income: total("companyRevenue"),
    discounts_total: total("discountAmount"),
    customer_total: codTotal,
    merchant_due: total("merchantDue"),
    cod_total: codTotal,
    cod_collected: collected,
    cod_pending: Math.max(0, codTotal - collected),
    cod_reconciled: 0,
    expenses_total: 0,
    adjustments_net: 0,
    net_total: total("companyRevenue"),
    budget_allocated: 0,
    budget_remaining: 0,
    unassigned_orders: dayOrders.filter((order) => !order.driver_name && !(order as Order & { driver_id?: string }).driver_id && !(order as Order & { assigned_driver_id?: string }).assigned_driver_id).length,
    pending_review_orders: dayOrders.filter((order) => ["pending", "review", "under_review", "confirmed"].includes(normalizeStatus(order.status))).length,
    unreconciled_cod: Math.max(0, codTotal - collected),
    unposted_delivered_orders: unposted,
    print_jobs_pending: 0,
    status: "needs_review",
    source: "preview",
  };
}

export default function AdminDailyClosingPanel({
  isArabic,
  orders,
  financeSummary: _legacyFinanceSummary,
  financeSummarySource: _legacyFinanceSource,
  onNavigate,
}: Props) {
  const [record, setRecord] = useState<ClosingSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ledgerReady, setLedgerReady] = useState(false);
  const date = todayKey();
  const preview = useMemo(() => buildPreview(date, orders), [date, orders]);
  const closing = record || preview;

  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const raw = await fetchAuthoritativeDailyClosing(date);
      const next = normalizeSnapshot(raw);
      setRecord(next);
      setLedgerReady(next.source === "rpc");
    } catch (error) {
      console.warn("Authoritative daily closing unavailable:", error);
      setRecord(null);
      setLedgerReady(false);
      setMessage(isArabic ? "الإغلاق اليومي في وضع معاينة فقط. طبّق Migration المالية الجديدة ثم أعد الفحص." : "Daily closing is preview-only. Apply the new finance migration, then retry.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [date, orders]);

  useEffect(() => {
    if (!ledgerReady) return;
    const hasRisk = closing.net_total < 0 || closing.unreconciled_cod > 0 || closing.unposted_delivered_orders > 0;
    const needsReview = closing.cod_pending > 0 || closing.unassigned_orders > 0 || closing.pending_review_orders > 0;
    if (hasRisk) {
      addAdminNotification({
        type: "warning",
        sectionId: "daily_closing",
        priority: "high",
        dedupeKey: `closing:${date}:risk:${closing.unposted_delivered_orders}:${closing.unreconciled_cod}`,
        audioEvent: "warning",
        titleAr: "الإغلاق اليومي متوقف",
        titleEn: "Daily closing blocked",
        bodyAr: `طلبات مسلّمة غير مُرحّلة ${closing.unposted_delivered_orders}، وتحصيل غير مسوى ${money(closing.unreconciled_cod)}.`,
        bodyEn: `${closing.unposted_delivered_orders} delivered orders are unposted and ${money(closing.unreconciled_cod)} is unreconciled.`,
      });
    } else if (needsReview) {
      addAdminNotification({
        type: "daily_closing",
        sectionId: "daily_closing",
        priority: "high",
        dedupeKey: `closing:${date}:review:${closing.cod_pending}:${closing.unassigned_orders}`,
        audioEvent: "daily_closing_warning",
        titleAr: "الإغلاق يحتاج مراجعة",
        titleEn: "Closing needs review",
        bodyAr: `تحصيل معلق ${money(closing.cod_pending)}، وطلبات بدون مندوب ${closing.unassigned_orders}.`,
        bodyEn: `Pending collection ${money(closing.cod_pending)} and ${closing.unassigned_orders} unassigned orders.`,
      });
    }
  }, [ledgerReady, closing.cod_pending, closing.unassigned_orders, closing.unreconciled_cod, closing.unposted_delivered_orders, date]);

  async function save(status: ClosingStatus) {
    if (!ledgerReady) return;
    setBusy(true);
    setMessage("");
    try {
      const raw = await saveAuthoritativeDailyClosing({ closing_date: date, status, notes: status === "closed" ? "Closing reviewed by admin" : status === "reopened" ? "Reopened by admin" : "Daily finance snapshot" });
      setRecord(normalizeSnapshot(raw as Record<string, unknown>));
      playAdminAudioEvent("success");
      setMessage(status === "closed" ? (isArabic ? "تم إغلاق اليوم وحفظ لقطة مالية فعلية." : "The day was closed with an authoritative finance snapshot.") : status === "reopened" ? (isArabic ? "تمت إعادة فتح اليوم مع تسجيل التدقيق." : "The day was reopened with an audit record.") : (isArabic ? "تم حفظ لقطة الإغلاق في قاعدة البيانات." : "The closing snapshot was saved to the database."));
      await load();
    } catch (error) {
      console.warn("Daily closing save failed:", error);
      setMessage(isArabic ? "لم يتم حفظ الإغلاق. راجع Migration المالية وصلاحيات الأدمن." : "Closing was not saved. Check the finance migration and admin permissions.");
    } finally {
      setBusy(false);
    }
  }

  const cards: Array<{ ar: string; en: string; value: string | number; icon: AdminIconName; risk?: boolean }> = [
    { ar: "طلبات اليوم", en: "Today's orders", value: closing.total_orders, icon: "orders" },
    { ar: "طلبات مسلّمة", en: "Delivered orders", value: closing.delivered_orders, icon: "delivered-orders" },
    { ar: "قيمة البضاعة", en: "Goods value", value: money(closing.goods_value), icon: "package" },
    { ar: "دخل التوصيل", en: "Delivery revenue", value: money(closing.delivery_income), icon: "income" },
    { ar: "الخصومات", en: "Discounts", value: money(closing.discounts_total), icon: "adjustments" },
    { ar: "إجمالي العملاء", en: "Customer total", value: money(closing.customer_total), icon: "cod" },
    { ar: "مستحق التجار", en: "Merchant due", value: money(closing.merchant_due), icon: "merchant" },
    { ar: "المحصل", en: "Collected", value: money(closing.cod_collected), icon: "cash-collection" },
    { ar: "تحصيل معلق", en: "Pending collection", value: money(closing.cod_pending), icon: "warning", risk: closing.cod_pending > 0 },
    { ar: "مصروفات معتمدة", en: "Approved expenses", value: money(closing.expenses_total), icon: "expenses" },
    { ar: "التسويات", en: "Adjustments", value: money(closing.adjustments_net), icon: "adjustments" },
    { ar: "صافي التشغيل", en: "Operating net", value: money(closing.net_total), icon: "income", risk: closing.net_total < 0 },
    { ar: "الميزانية", en: "Budget allocated", value: money(closing.budget_allocated), icon: "finance" },
    { ar: "متبقي الميزانية", en: "Budget remaining", value: money(closing.budget_remaining), icon: "finance", risk: closing.budget_remaining < 0 },
    { ar: "مُسلّم غير مُرحّل", en: "Delivered, unposted", value: closing.unposted_delivered_orders, icon: "warning", risk: closing.unposted_delivered_orders > 0 },
    { ar: "طلبات بدون مندوب", en: "Unassigned orders", value: closing.unassigned_orders, icon: "unassigned-orders", risk: closing.unassigned_orders > 0 },
  ];

  const summaryText = isArabic
    ? `إغلاق ${date}: صافي ${money(closing.net_total)}، دخل ${money(closing.delivery_income)}، مصروفات ${money(closing.expenses_total)}، مستحق تجار ${money(closing.merchant_due)}، غير مُرحّل ${closing.unposted_delivered_orders}.`
    : `Closing ${date}: net ${money(closing.net_total)}, income ${money(closing.delivery_income)}, expenses ${money(closing.expenses_total)}, merchant due ${money(closing.merchant_due)}, unposted ${closing.unposted_delivered_orders}.`;

  const pdfPayload = {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: isArabic ? "الإغلاق المالي اليومي" : "Daily financial closing",
    filters: `${date} · ${ledgerReady ? "RPC" : "PREVIEW"}`,
    totals: Object.fromEntries(cards.map((card) => [isArabic ? card.ar : card.en, card.value])),
    columns: [
      { key: "metric", label: isArabic ? "البند" : "Metric" },
      { key: "value", label: isArabic ? "القيمة" : "Value" },
    ],
    rows: cards.map((card) => ({ metric: isArabic ? card.ar : card.en, value: card.value })),
  };

  return (
    <section className={`dn-daily-closing ${closing.status}`} dir={isArabic ? "rtl" : "ltr"}>
      <header>
        <div className="dn-closing-title">
          <AdminIconBadge name="daily-closing" label={isArabic ? "إغلاق يومي" : "Daily closing"} />
          <div>
            <AdminStateChip name={ledgerReady ? "database-health" : "warning"} tone={ledgerReady ? "success" : "danger"}>
              {ledgerReady ? (isArabic ? "RPC مالي فعلي" : "Authoritative finance RPC") : (isArabic ? "معاينة غير قابلة للحفظ" : "Preview only")}
            </AdminStateChip>
            <h2>{isArabic ? "الإغلاق المالي اليومي" : "Daily Financial Closing"}</h2>
            <p>{isArabic ? "يُبنى من ترحيلات الطلبات والمصروفات المعتمدة والتسويات والميزانية، ولا يعتمد على إجماليات قديمة أو حفظ محلي." : "Built from posted orders, approved expenses, adjustments, and budgets—never legacy totals or local persistence."}</p>
          </div>
        </div>
        <AdminStateChip name={ledgerReady ? "daily-closing" : "warning"} tone={ledgerReady && closing.status === "closed" ? "success" : "warning"}>
          {statusText(ledgerReady ? closing.status : "blocked", isArabic)}
        </AdminStateChip>
      </header>

      {message && <p className="dn-local-review">{message}</p>}

      <div className="dn-closing-grid">
        {cards.map((card) => (
          <article key={card.en} className={card.risk ? "is-risk" : ""}>
            <AdminIconBadge name={card.icon} label={isArabic ? card.ar : card.en} />
            <span>{isArabic ? card.ar : card.en}</span>
            <b>{card.value}</b>
          </article>
        ))}
      </div>

      {!ledgerReady && (
        <div className="dn-local-review">
          <AlertTriangle className="inline h-4 w-4" /> {isArabic ? "تم تعطيل الحفظ والإغلاق حتى يعمل admin_daily_closing_snapshot من قاعدة البيانات." : "Saving and closing are disabled until admin_daily_closing_snapshot is available from the database."}
        </div>
      )}

      <div className="dn-closing-actions">
        <button type="button" disabled={busy || !ledgerReady} onClick={() => void save("draft")}>
          {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}
          {isArabic ? "حفظ لقطة اليوم" : "Save snapshot"}
        </button>
        <button type="button" disabled={busy || !ledgerReady || closing.unposted_delivered_orders > 0} onClick={() => void save("closed")}>
          <ShieldAlert aria-hidden="true" />
          {isArabic ? "مراجعة وإغلاق" : "Review and close"}
        </button>
        <button type="button" disabled={busy || !ledgerReady} onClick={() => void save("reopened")}>
          <RotateCcw aria-hidden="true" />
          {isArabic ? "إعادة فتح اليوم" : "Reopen day"}
        </button>
        <button type="button" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" />
          {isArabic ? "إعادة الحساب" : "Recalculate"}
        </button>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(summaryText)}>
          <Clipboard aria-hidden="true" />
          {isArabic ? "نسخ الملخص" : "Copy summary"}
        </button>
        <AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={pdfPayload} />
        <button type="button" onClick={() => onNavigate?.("finance_dashboard")}><Landmark aria-hidden="true" />{isArabic ? "المالية" : "Finance"}</button>
        <button type="button" onClick={() => onNavigate?.("expenses")}><FileMinus aria-hidden="true" />{isArabic ? "المصروفات" : "Expenses"}</button>
        <button type="button" onClick={() => onNavigate?.("finance_dashboard")}><PiggyBank aria-hidden="true" />{isArabic ? "الميزانية" : "Budget"}</button>
        <button type="button" onClick={() => onNavigate?.("driver_statements")}><Truck aria-hidden="true" />{isArabic ? "المناديب" : "Drivers"}</button>
        <button type="button" onClick={() => onNavigate?.("merchant_statements")}><Store aria-hidden="true" />{isArabic ? "التجار" : "Merchants"}</button>
        <button type="button" onClick={() => onNavigate?.("print")}><Printer aria-hidden="true" />{isArabic ? "الطباعة" : "Print"}</button>
      </div>
    </section>
  );
}
