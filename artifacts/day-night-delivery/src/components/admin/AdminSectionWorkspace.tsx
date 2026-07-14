import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CalendarClock, FileText, Filter, RotateCcw, Search, Sparkles, Truck, XCircle } from "lucide-react";
import AdminLiveOperationsMap from "./AdminLiveOperationsMap";
import AdminPdfExportButton from "./AdminPdfExportButton";
import AdminFinanceOperationsCenter from "./AdminFinanceOperationsCenter";
import { adminSectionById, type AdminSectionId } from "./AdminSectionRegistry";
import type { Merchant, Order } from "../../types";
import type { FinanceSummary, FinanceSummarySource } from "../../lib/adminData";
import { actionLabel, fieldLabel as translatedFieldLabel, kpiLabel, sectionFallbackLabel, tableColumnLabel } from "../../data/adminTranslations";
import { addAdminNotification, playAdminAudioEvent } from "../../lib/adminAudio";
import { updateExistingOrderStatus } from "../../supabaseAdminOps";
import "../../styles/dn-admin-sections.css";

type FinanceArea = "finance_dashboard" | "driver_statements" | "merchant_statements" | "income" | "cod" | "expenses" | "accounts" | "adjustments" | "audit_log";

type Props = {
  id: AdminSectionId;
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  financeSummary: FinanceSummary | null;
  financeSummarySource?: FinanceSummarySource;
  financeWarning?: string;
  onNavigate?: (id: AdminSectionId) => void;
  onRefresh?: () => Promise<void>;
};

type ExtendedOrder = Order & {
  total?: number;
  total_amount?: number;
  service_fee?: number;
  pickup_city?: string;
  delivery_city?: string;
  driver_id?: string;
  assigned_driver_id?: string;
  internal_notes?: string;
  admin_notes?: string;
};

type OrderStatusOption = {
  value: string;
  ar: string;
  en: string;
  icon: typeof CheckCircle2;
};

const financeSections = new Set<AdminSectionId>([
  "finance_dashboard",
  "driver_statements",
  "merchant_statements",
  "income",
  "cod",
  "expenses",
  "accounts",
  "adjustments",
  "audit_log",
]);

const orderStatusOptions: OrderStatusOption[] = [
  { value: "pending", ar: "قيد الانتظار", en: "Pending", icon: CalendarClock },
  { value: "review", ar: "قيد المراجعة", en: "Under review", icon: Search },
  { value: "confirmed", ar: "تم التأكيد", en: "Confirmed", icon: CheckCircle2 },
  { value: "assigned", ar: "تم تعيين مندوب", en: "Driver assigned", icon: Truck },
  { value: "picked_up", ar: "تم الإحضار", en: "Picked up", icon: Truck },
  { value: "in_transit", ar: "في الطريق", en: "In transit", icon: Truck },
  { value: "delivered", ar: "تم التسليم", en: "Delivered", icon: CheckCircle2 },
  { value: "postponed", ar: "مؤجل", en: "Postponed", icon: CalendarClock },
  { value: "returned", ar: "راجع", en: "Returned", icon: RotateCcw },
  { value: "cancelled", ar: "ملغي", en: "Cancelled", icon: XCircle },
];

const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[ـ]/g, "").trim();
const normalizeStatusKey = (value: unknown) => normalize(value).replace(/[\s-]+/g, "_");
const money = (value: unknown, isArabic: boolean) => isArabic ? `${Number(value || 0).toFixed(2)} درهم` : `${Number(value || 0).toFixed(2)} AED`;
const extra = (order: Order) => order as ExtendedOrder;
const tracking = (order: Order) => order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";
const route = (order: Order) => `${order.sender_city || extra(order).pickup_city || "—"} → ${order.receiver_city || extra(order).delivery_city || order.destination_country || "—"}`;
const amount = (order: Order) => Number(order.cod_amount || order.delivery_price || order.price || extra(order).total || extra(order).total_amount || 0);

const sourceWords: Record<string, string> = {
  orders: "الطلبات",
  merchants: "التجار",
  finance_summary: "ملخص المالية",
  fallback: "بديل آمن",
  derived: "مشتق",
  pricing: "التسعير",
  local: "محلي",
  file: "ملف",
  preview: "معاينة",
  diagnostics: "تشخيص",
  support_tickets: "تذاكر الدعم",
  auth: "المصادقة",
  ledger_entries: "قيود دفتر الأستاذ",
  adjustments: "التسويات",
  audit_log: "سجل التدقيق",
  summary: "ملخص",
  settings: "الإعدادات",
  admin_settings: "إعدادات الإدارة",
};

const categoryWords: Record<string, { ar: string; en: string }> = {
  operations: { ar: "العمليات", en: "Operations" },
  orders: { ar: "الطلبات", en: "Orders" },
  dispatch: { ar: "التوزيع", en: "Dispatch" },
  finance: { ar: "المالية", en: "Finance" },
  tools: { ar: "الأدوات", en: "Tools" },
  system: { ar: "النظام", en: "System" },
  command: { ar: "مركز التحكم", en: "Command" },
};

const statusWords: Record<string, { ar: string; en: string }> = {
  pending: { ar: "قيد الانتظار", en: "Pending" },
  order_pending: { ar: "قيد الانتظار", en: "Pending" },
  confirmed: { ar: "تم التأكيد", en: "Confirmed" },
  assigned: { ar: "تم تعيين مندوب", en: "Driver assigned" },
  picked_up: { ar: "تم الإحضار", en: "Picked up" },
  pickup: { ar: "قيد الإحضار", en: "Pickup" },
  in_transit: { ar: "في الطريق", en: "In transit" },
  out_for_delivery: { ar: "في الطريق", en: "Out for delivery" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
  canceled: { ar: "ملغي", en: "Canceled" },
  order_cancelled: { ar: "ملغي", en: "Cancelled" },
  failed: { ar: "فشل", en: "Failed" },
  delivered: { ar: "تم التسليم", en: "Delivered" },
  order_delivered: { ar: "تم التسليم", en: "Delivered" },
  completed: { ar: "مكتمل", en: "Completed" },
  returned: { ar: "راجع", en: "Returned" },
  return_to_merchant: { ar: "راجع للتاجر", en: "Returned to merchant" },
  postponed: { ar: "مؤجل", en: "Postponed" },
  review: { ar: "قيد المراجعة", en: "Under review" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
};

const INTERNATIONAL_RE = /international|external|gcc|world|worldwide|saudi|kuwait|qatar|bahrain|oman|usa|uk|europe|canada|australia|دولي|خارجي|خليجي|السعودية|الكويت|قطر|البحرين|عمان/;
const ABU_DHABI_RE = /abu dhabi|mussafah|khalifa|mbz|al ain|أبوظبي|ابوظبي|العين|مصفح/;
const OTHER_EMIRATES_RE = /dubai|sharjah|ajman|umm al quwain|ras al khaimah|fujairah|khor fakkan|دبي|الشارقة|عجمان|أم القيوين|ام القيوين|رأس الخيمة|راس الخيمة|الفجيرة|خورفكان/;

function orderSearchText(order: Order) {
  return normalize([
    tracking(order),
    order.sender_city,
    order.receiver_city,
    extra(order).pickup_city,
    extra(order).delivery_city,
    order.destination_country,
    order.service_type,
    order.shipping_scope,
    order.notes,
    extra(order).internal_notes,
    extra(order).admin_notes,
    order.sender_address,
    order.receiver_address,
    order.payment_method,
    order.merchant_name,
    order.sender_name,
    order.receiver_name,
    order.customer_name,
    order.receiver_phone,
    order.sender_phone,
  ].join(" "));
}

function statusBlob(order: Order) {
  return normalize(`${normalizeStatusKey(order.status)} ${order.status || ""} ${orderSearchText(order)}`);
}

function isInternationalOrder(order: Order) {
  return INTERNATIONAL_RE.test(orderSearchText(order));
}

function isAbuDhabiOrder(order: Order) {
  return !isInternationalOrder(order) && ABU_DHABI_RE.test(orderSearchText(order));
}

function isOtherEmiratesOrder(order: Order) {
  const text = orderSearchText(order);
  return !isInternationalOrder(order) && !isAbuDhabiOrder(order) && OTHER_EMIRATES_RE.test(text);
}

function statusText(value: unknown, isArabic: boolean) {
  const key = normalizeStatusKey(value);
  if (statusWords[key]) return isArabic ? statusWords[key].ar : statusWords[key].en;
  if (!key) return "—";
  return isArabic ? "حالة محفوظة" : key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(value: unknown) {
  const key = normalizeStatusKey(value);
  if (/deliver|complete|تم_التسليم|مكتمل/.test(key)) return "is-success";
  if (/cancel|fail|ملغي|ملغية|كنسل/.test(key)) return "is-danger";
  if (/return|postpone|راجع|راجعة|مرتجع|مؤجل/.test(key)) return "is-warning";
  if (/review|pending|مراجعة|انتظار/.test(key)) return "is-muted";
  return "is-active";
}

function sourceText(value: string, isArabic: boolean) {
  if (!isArabic) return value.replace(/[_+]/g, " ");
  return value
    .split(/\s*[,+/]\s*|\s+/)
    .filter(Boolean)
    .map((token) => sourceWords[token] || (token.includes("_") ? token.split("_").map((part) => sourceWords[part]).filter(Boolean).join(" ") : ""))
    .filter(Boolean)
    .join(" + ") || "مصدر بيانات";
}

function categoryText(value: string, isArabic: boolean) {
  const pair = categoryWords[value];
  return pair ? (isArabic ? pair.ar : pair.en) : (isArabic ? "وحدة تشغيلية" : value);
}

function statusMatch(order: Order, id: AdminSectionId) {
  const blob = statusBlob(order);
  if (["all_orders", "reports", "print"].includes(id)) return true;
  if (id === "cancelled") return /order_cancelled|cancelled|canceled|cancel|failed|fail|ملغي|ملغية|الغاء|إلغاء|كنسل/.test(blob);
  if (id === "review") return /under_review|needs_review|manual_review|manual_approval|review|hold|مراجعة|قيد_المراجعة/.test(blob);
  if (id === "postponed") return /postponed|postpone|deferred|defer|scheduled|schedule|later|مؤجل|مؤجلة|تأجيل/.test(blob);
  if (id === "returned") return /return_to_merchant|returned|return|راجع|راجعة|مرتجع|مرتجعة|ارجاع|إرجاع/.test(blob);
  if (id === "pickup") return /picked_up|pickup|pick|assigned|assign|collect|إحضار|احضار|مندوب/.test(blob);
  if (id === "abu_dhabi") return isAbuDhabiOrder(order);
  if (id === "external") return isInternationalOrder(order);
  if (id === "out_scope") return isOtherEmiratesOrder(order) || /out.?of.?scope|unsupported|خارج_النطاق|خارج النطاق/.test(blob);
  return true;
}

function metricValue(key: string, rows: Order[], merchants: Merchant[], summary: FinanceSummary | null, isArabic: boolean) {
  const lower = key.toLowerCase();
  const delivered = rows.filter((order) => /deliver|complete|تم_التسليم|مكتمل/.test(normalizeStatusKey(order.status)));
  const cancelled = rows.filter((order) => /cancel|fail|ملغي|كنسل/.test(normalizeStatusKey(order.status)));
  const cod = rows.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
  const revenue = rows.reduce((sum, order) => sum + Number(order.delivery_price || order.price || extra(order).service_fee || 0), 0);
  if (lower.includes("merchant") && !lower.includes("payable") && !lower.includes("balance")) return merchants.length;
  if (lower.includes("delivered")) return delivered.length;
  if (lower.includes("cancel")) return cancelled.length;
  if (lower.includes("rate")) return rows.length ? `${Math.round((cancelled.length / rows.length) * 100)}%` : "0%";
  if (/cod|cash|balance|payable|revenue|income|expense|net|value|amount|fee|earning/.test(lower)) {
    if (lower.includes("expense")) return money(summary?.total_expenses || 0, isArabic);
    if (lower.includes("pending")) return money(summary?.cod_pending || cod, isArabic);
    if (lower.includes("collected")) return money(summary?.cod_collected || 0, isArabic);
    if (lower.includes("net")) return money(summary?.net_estimate || revenue, isArabic);
    return money(revenue || cod, isArabic);
  }
  return rows.length;
}

function statusOptionLabel(option: OrderStatusOption, isArabic: boolean) {
  return isArabic ? option.ar : option.en;
}

export default function AdminSectionWorkspace({ id, isArabic, orders, merchants, financeSummary, financeSummarySource = "derived", financeWarning, onNavigate, onRefresh }: Props) {
  const config = adminSectionById[id];
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [statusBusy, setStatusBusy] = useState("");
  const navigate = (target: AdminSectionId) => onNavigate?.(target);
  const refresh = onRefresh || (async () => undefined);
  const isFinance = financeSections.has(id);

  useEffect(() => {
    setQuery("");
    setFilters({});
    setNotice("");
    setStatusDrafts({});
    setStatusBusy("");
  }, [id]);

  const baseRows = useMemo(() => orders.filter((order) => statusMatch(order, id)), [id, orders]);
  const rows = useMemo(() => baseRows.filter((order) => {
    const haystack = orderSearchText(order);
    const q = normalize(query);
    if (q && !haystack.includes(q)) return false;
    if (filters.status && !statusBlob(order).includes(normalize(filters.status))) return false;
    if (filters.merchant && !normalize(`${order.merchant_id || ""} ${order.merchant_name || ""} ${order.sender_name || ""}`).includes(normalize(filters.merchant))) return false;
    if (filters.driver && !normalize(`${order.driver_code || ""} ${order.driver_name || ""} ${order.driver_phone || ""} ${extra(order).driver_id || ""} ${extra(order).assigned_driver_id || ""}`).includes(normalize(filters.driver))) return false;
    if ((filters.emirate || filters.city) && !haystack.includes(normalize(filters.emirate || filters.city))) return false;
    if (filters.codOnly && Number(order.cod_amount || 0) <= 0) return false;
    return true;
  }).slice(0, 120), [baseRows, filters, query]);

  const title = isArabic ? config.titleAr : config.titleEn;
  const subtitle = isArabic ? config.subtitleAr : config.subtitleEn;
  const source = sourceText(config.dataSource, isArabic);
  const totals = {
    orders: baseRows.length,
    visible: rows.length,
    cod: money(baseRows.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0), isArabic),
    income: money(baseRows.reduce((sum, order) => sum + Number(order.delivery_price || order.price || 0), 0), isArabic),
  };

  const doAction = (action: string) => {
    if (action === "addOrder") navigate("new_order");
    else if (action === "addMerchant") navigate("new_merchant");
    else if (action === "reviewPending") navigate("review");
    else if (action === "openFinance") navigate("finance_dashboard");
    else if (action === "openIncome") navigate("income");
    else if (action === "openExpenses") navigate("expenses");
    else if (action === "openCod") navigate("cod");
    else if (action === "openStatements") navigate("merchant_statements");
    else if (action === "editStatus" || action === "markUnderReview") setNotice(isArabic ? "اختر الحالة من عمود تحديث العميل أمام الطلب المطلوب." : "Use the customer status column beside the target order.");
    else setNotice(isArabic ? `تم فتح إجراء: ${actionLabel(action, true)}` : `Opened action: ${actionLabel(action, false)}`);
  };

  async function changeOrderStatus(order: Order) {
    const rowKey = String(order.id || tracking(order));
    const nextStatus = statusDrafts[rowKey] || normalizeStatusKey(order.status || "pending");
    if (!order.id || !nextStatus) return;
    if (nextStatus === normalizeStatusKey(order.status)) {
      setNotice(isArabic ? "لم يتغير شيء؛ الحالة المختارة هي نفس الحالة الحالية." : "No change; selected status is already current.");
      return;
    }

    const label = statusText(nextStatus, isArabic);
    setStatusBusy(rowKey);
    setNotice("");

    try {
      const ok = await updateExistingOrderStatus(order.id, nextStatus, isArabic ? `تحديث من لوحة الإدارة إلى: ${label}` : `Admin updated status to: ${label}`);
      if (!ok) throw new Error("status_update_failed");
      playAdminAudioEvent(nextStatus === "delivered" ? "success" : "notification");
      addAdminNotification({
        type: "success",
        sectionId: id,
        priority: nextStatus === "delivered" ? "normal" : "low",
        dedupeKey: `status:${order.id}:${nextStatus}`,
        dedupeMs: 120000,
        titleAr: "تم تحديث حالة الطلب",
        titleEn: "Order status updated",
        bodyAr: `تم تحديث ${tracking(order)} إلى ${label}. يظهر التحديث للعميل في صفحة التتبع.`,
        bodyEn: `${tracking(order)} was updated to ${label}. The customer tracking page now reflects it.`,
      });
      setNotice(isArabic ? `تم تحديث الطلب ${tracking(order)} إلى: ${label}.` : `Order ${tracking(order)} updated to: ${label}.`);
      await refresh();
    } catch (error) {
      console.error("Admin order status update failed:", error);
      playAdminAudioEvent("warning");
      setNotice(isArabic ? "فشل تحديث الحالة. تأكد من صلاحيات Supabase أو تطبيق migration حالة الطلب." : "Status update failed. Check Supabase permissions or apply the order-status migration.");
    } finally {
      setStatusBusy("");
    }
  }

  if (isFinance) {
    return <AdminFinanceOperationsCenter isArabic={isArabic} activeSection={id as FinanceArea} orders={orders} merchants={merchants} financeSummary={financeSummary} financeSummarySource={financeSummarySource} onRefresh={refresh} onNavigate={(target) => navigate(target as AdminSectionId)} />;
  }

  return (
    <section className="dn-section-workspace" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-section-hero">
        <div>
          <span>{categoryText(config.category, isArabic)} · {source}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="dn-section-hero-actions">
          <button type="button" onClick={() => void refresh()}>{isArabic ? "تحديث" : "Refresh"}</button>
          <AdminPdfExportButton
            payload={{
              language: isArabic ? "ar" : "en",
              sectionTitle: title,
              filters: Object.entries(filters).map(([key, value]) => `${translatedFieldLabel(key, isArabic)}: ${value || (isArabic ? "الكل" : "All")}`).join(" | ") || (isArabic ? "بدون فلاتر" : "No filters"),
              totals,
              columns: [
                { key: "tracking", label: isArabic ? "التتبع" : "Tracking" },
                { key: "status", label: isArabic ? "الحالة" : "Status" },
                { key: "merchant", label: isArabic ? "التاجر" : "Merchant" },
                { key: "route", label: isArabic ? "المسار" : "Route" },
                { key: "amount", label: isArabic ? "المبلغ" : "Amount" },
              ],
              rows: rows.map((order) => ({
                tracking: tracking(order),
                status: statusText(order.status || "", isArabic),
                merchant: order.merchant_name || order.sender_name || "—",
                route: route(order),
                amount: money(amount(order), isArabic),
              })),
            }}
          />
        </div>
      </header>

      {id === "dashboard" && <AdminLiveOperationsMap isArabic={isArabic} orders={orders} />}
      {financeWarning && <p className="dn-clean-note">{isArabic ? "ملخص مالي مشتق مؤقتاً من الطلبات" : "Finance summary temporarily derived from orders"}</p>}

      <div className="dn-section-kpis">
        {config.kpis.slice(0, 8).map((key) => (
          <article key={key}>
            <span>{kpiLabel(key, isArabic)}</span>
            <strong>{metricValue(key, baseRows, merchants, financeSummary, isArabic)}</strong>
            <small>{source}</small>
          </article>
        ))}
      </div>

      <div className="dn-section-panels">
        <article>
          <h3><Filter />{isArabic ? "الفلاتر والمدخلات" : "Filters & inputs"}</h3>
          <div className="dn-section-form">
            <label>
              <span>{isArabic ? "بحث" : "Search"}</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "تتبع، هاتف، تاجر..." : "Tracking, phone, merchant..."} />
            </label>
            {[...config.filters, ...config.inputFields].slice(0, 12).map((field) => (
              <label key={field}>
                <span>{translatedFieldLabel(field, isArabic)}</span>
                <input value={filters[field] || ""} onChange={(event) => setFilters((prev) => ({ ...prev, [field]: event.target.value }))} placeholder={translatedFieldLabel(field, isArabic)} />
              </label>
            ))}
          </div>
        </article>

        <article>
          <h3><Sparkles />{isArabic ? "إجراءات جاهزة" : "Ready actions"}</h3>
          <div className="dn-action-grid">
            {config.actions.map((action) => <button key={action} type="button" onClick={() => doAction(action)}>{actionLabel(action, isArabic)}</button>)}
          </div>
          <p className="dn-clean-note">{isArabic ? "أي طلب من الموقع يظهر هنا، ويمكن تغيير حالته من الجدول لتحديث صفحة تتبع العميل مباشرة." : "Website orders appear here, and their customer-visible status can be updated from the table."}</p>
        </article>
      </div>

      <article className="dn-section-table-card">
        <h3><FileText />{isArabic ? "الصفوف الحالية" : "Current rows"}</h3>
        {notice && <p className="dn-clean-note">{notice}</p>}
        <div className="dn-section-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tableColumnLabel("tracking", isArabic)}</th>
                <th>{tableColumnLabel("status", isArabic)}</th>
                <th>{tableColumnLabel("merchantSender", isArabic)}</th>
                <th>{tableColumnLabel("route", isArabic)}</th>
                <th>{tableColumnLabel("receiver", isArabic)}</th>
                <th>{tableColumnLabel("amount", isArabic)}</th>
                <th>{isArabic ? "تحديث العميل" : "Customer update"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => {
                const rowKey = String(order.id || tracking(order));
                const currentStatus = normalizeStatusKey(order.status || "pending");
                const draftStatus = statusDrafts[rowKey] || currentStatus;
                const isBusy = statusBusy === rowKey;
                return (
                  <tr key={rowKey}>
                    <td><span dir="ltr" className="dn-order-track-ref">{tracking(order)}</span></td>
                    <td><span className={`dn-order-status-chip ${statusTone(order.status)}`}>{statusText(order.status || "", isArabic)}</span></td>
                    <td>{order.merchant_name || order.sender_name || "—"}</td>
                    <td>{route(order)}</td>
                    <td>{order.receiver_name || order.customer_name || "—"}</td>
                    <td>{money(amount(order), isArabic)}</td>
                    <td>
                      <div className="dn-order-status-control">
                        <select value={draftStatus} onChange={(event) => setStatusDrafts((prev) => ({ ...prev, [rowKey]: event.target.value }))} aria-label={isArabic ? "اختيار حالة الطلب" : "Select order status"}>
                          {orderStatusOptions.map((option) => <option value={option.value} key={option.value}>{statusOptionLabel(option, isArabic)}</option>)}
                        </select>
                        <button type="button" disabled={isBusy || draftStatus === currentStatus} onClick={() => void changeOrderStatus(order)}>
                          {isBusy ? (isArabic ? "جارٍ الحفظ..." : "Saving...") : (isArabic ? "تحديث" : "Update")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <div className="dn-empty-state"><Search className="h-5 w-5" />{sectionFallbackLabel("noMatchingOrders", isArabic)}</div>}
        </div>
      </article>
    </section>
  );
}
