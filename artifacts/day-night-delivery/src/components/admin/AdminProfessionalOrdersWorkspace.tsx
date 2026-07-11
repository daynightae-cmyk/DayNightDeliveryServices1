import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Eye,
  Filter,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  XCircle,
} from "lucide-react";
import type { Merchant, Order } from "../../types";
import { actionLabel, statusLabel } from "../../data/adminTranslations";
import AdminPdfExportButton from "./AdminPdfExportButton";
import AdminOrderDetailsDrawer from "./AdminOrderDetailsDrawer";
import AdminStatusUpdateModal from "./AdminStatusUpdateModal";
import AdminDriverAssignmentModal from "./AdminDriverAssignmentModal";
import type { AdminSectionId } from "./AdminSectionRegistry";
import "../../styles/dn-admin-professional-orders.css";

type OrderSectionId = Extract<AdminSectionId, "all_orders" | "cancelled" | "review" | "postponed" | "returned">;
type OrderExtra = Order & {
  pickup_city?: string;
  delivery_city?: string;
  total?: number;
  total_amount?: number;
  amount?: number;
  admin_notes?: string;
  internal_notes?: string;
  assigned_driver_id?: string;
  driver_id?: string;
};

type Props = {
  id: OrderSectionId;
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  onRefresh?: () => Promise<void> | void;
  onNavigate?: (id: AdminSectionId) => void;
};

const ORDER_SECTION_IDS: OrderSectionId[] = ["all_orders", "cancelled", "review", "postponed", "returned"];

const meta: Record<OrderSectionId, { ar: string; en: string; subAr: string; subEn: string; icon: ReactNode; tone: string }> = {
  all_orders: {
    ar: "كافة الطلبات",
    en: "All Orders",
    subAr: "مركز تحكم كامل لكل الطلبات الحقيقية مع بحث وفلاتر وإجراءات مباشرة.",
    subEn: "Full control center for real orders with search, filters, and direct actions.",
    icon: <ClipboardList className="h-5 w-5" />,
    tone: "sky",
  },
  cancelled: {
    ar: "الطلبات الملغية",
    en: "Cancelled Orders",
    subAr: "تحليل الإلغاء والفشل والرفض بدون إدخال صفوف وهمية.",
    subEn: "Cancellation, failure, and rejection analysis without fake rows.",
    icon: <XCircle className="h-5 w-5" />,
    tone: "rose",
  },
  review: {
    ar: "الطلبات قيد المراجعة",
    en: "Under Review",
    subAr: "قرارات ما قبل التحريك: بيانات ناقصة، تأكيد، تعليق، أو مخاطرة COD.",
    subEn: "Pre-dispatch decisions: missing data, confirmation, hold, or COD risk.",
    icon: <ShieldCheck className="h-5 w-5" />,
    tone: "gold",
  },
  postponed: {
    ar: "الطلبات المؤجلة",
    en: "Postponed Orders",
    subAr: "جدولة التأجيلات والمواعيد الجديدة والتنبيهات المتأخرة.",
    subEn: "Rescheduling, new dates, and overdue postponement alerts.",
    icon: <CalendarClock className="h-5 w-5" />,
    tone: "violet",
  },
  returned: {
    ar: "الطلبات الراجعة",
    en: "Returned Orders",
    subAr: "متابعة الإرجاع وعكس COD ورسوم الرجوع والتسليم البديل.",
    subEn: "Return tracking, COD reversal, return fees, and retry handling.",
    icon: <RotateCcw className="h-5 w-5" />,
    tone: "cyan",
  },
};

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textOf(order: Order) {
  const item = order as OrderExtra;
  return normalize([
    order.status,
    order.notes,
    item.admin_notes,
    item.internal_notes,
    order.package_description,
    order.service_type,
    order.shipping_scope,
  ].filter(Boolean).join(" "));
}

function ref(order: Order) {
  return order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";
}

function amount(order: Order) {
  const item = order as OrderExtra;
  return Number(order.delivery_price || order.price || item.total || item.total_amount || item.amount || 0);
}

function cod(order: Order) {
  return Number(order.cod_amount || 0);
}

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} AED`;
}

function route(order: Order) {
  const item = order as OrderExtra;
  return `${order.sender_city || item.pickup_city || "—"} → ${order.receiver_city || item.delivery_city || order.destination_country || "—"}`;
}

function merchantLabel(order: Order) {
  return order.merchant_name || order.sender_name || order.merchant_code || "—";
}

function ageDays(order: Order) {
  const date = new Date(order.created_at || new Date()).getTime();
  if (!Number.isFinite(date)) return 0;
  return Math.max(0, Math.floor((Date.now() - date) / 86400000));
}

function isDelivered(order: Order) {
  return /deliver|complete|تم التسليم|مسلم|مكتمل/.test(textOf(order));
}

function isCancelled(order: Order) {
  return /cancel|cancell|failed|fail|reject|void|ملغي|ملغى|الغاء|فشل|مرفوض/.test(textOf(order));
}

function isReview(order: Order) {
  return /review|under review|pending review|pending|hold|confirm|verification|check|مراجعه|مراجعة|قيد المراجعه|قيد المراجعة|تاكيد|تأكيد|معلق|انتظار/.test(textOf(order));
}

function isPostponed(order: Order) {
  return /postpone|postponed|defer|deferred|resched|schedule|scheduled|delayed|delay|مؤجل|موجل|تاجيل|تأجيل|مجدول|متاخر|متأخر/.test(textOf(order));
}

function isReturned(order: Order) {
  return /return|returned|rto|back|reverse|راجع|راجعه|راجعة|مرتجع|ارجاع|إرجاع|رجوع/.test(textOf(order));
}

function isUnassigned(order: Order) {
  const item = order as OrderExtra;
  return !order.driver_code && !order.driver_name && !order.driver_phone && !item.driver_id && !item.assigned_driver_id;
}

function matchesSection(order: Order, id: OrderSectionId) {
  if (id === "all_orders") return true;
  if (id === "cancelled") return isCancelled(order);
  if (id === "review") return isReview(order) && !isCancelled(order) && !isReturned(order);
  if (id === "postponed") return isPostponed(order) && !isCancelled(order) && !isReturned(order);
  if (id === "returned") return isReturned(order);
  return true;
}

function sectionCount(orders: Order[], id: OrderSectionId) {
  return orders.filter((order) => matchesSection(order, id)).length;
}

function riskLabel(order: Order, isArabic: boolean) {
  if (isCancelled(order)) return isArabic ? "إلغاء / فشل" : "Cancelled / failed";
  if (isReturned(order)) return isArabic ? "راجع" : "Returned";
  if (isPostponed(order)) return isArabic ? "مؤجل" : "Postponed";
  if (isReview(order)) return isArabic ? "مراجعة" : "Review";
  if (ageDays(order) >= 3 && !isDelivered(order)) return isArabic ? "متأخر" : "Overdue";
  return isArabic ? "تشغيل" : "Operational";
}

export { ORDER_SECTION_IDS };

export default function AdminProfessionalOrdersWorkspace({ id, isArabic, orders, merchants, onRefresh, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [codOnly, setCodOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusOrder, setStatusOrder] = useState<Order | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);

  const info = meta[id] || meta.all_orders;
  const title = isArabic ? info.ar : info.en;
  const subtitle = isArabic ? info.subAr : info.subEn;

  const baseRows = useMemo(() => orders.filter((order) => matchesSection(order, id)), [orders, id]);
  const rows = useMemo(() => {
    return baseRows.filter((order) => {
      const haystack = normalize([
        ref(order),
        order.status,
        order.sender_name,
        order.sender_phone,
        order.receiver_name,
        order.receiver_phone,
        order.customer_name,
        order.customer_phone,
        order.merchant_name,
        order.merchant_code,
        route(order),
        order.payment_method,
        order.service_type,
      ].filter(Boolean).join(" "));
      if (query && !haystack.includes(normalize(query))) return false;
      if (statusFilter && !textOf(order).includes(normalize(statusFilter))) return false;
      if (merchantFilter && !normalize(`${order.merchant_id || ""} ${order.merchant_name || ""} ${order.sender_name || ""}`).includes(normalize(merchantFilter))) return false;
      if (cityFilter && !normalize(route(order)).includes(normalize(cityFilter))) return false;
      if (dateFilter && !String(order.created_at || "").startsWith(dateFilter)) return false;
      if (codOnly && cod(order) <= 0) return false;
      return true;
    }).slice(0, 120);
  }, [baseRows, query, statusFilter, merchantFilter, cityFilter, dateFilter, codOnly]);

  const totals = useMemo(() => ({
    section: baseRows.length,
    visible: rows.length,
    cod: baseRows.reduce((sum, order) => sum + cod(order), 0),
    income: baseRows.reduce((sum, order) => sum + amount(order), 0),
    unassigned: baseRows.filter((order) => !isDelivered(order) && !isCancelled(order) && !isReturned(order) && isUnassigned(order)).length,
    aging: baseRows.filter((order) => ageDays(order) >= 3 && !isDelivered(order)).length,
  }), [baseRows, rows]);

  const pdfPayload = {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: title,
    filters: [
      query && `${isArabic ? "بحث" : "Search"}: ${query}`,
      statusFilter && `${isArabic ? "حالة" : "Status"}: ${statusFilter}`,
      merchantFilter && `${isArabic ? "تاجر" : "Merchant"}: ${merchantFilter}`,
      cityFilter && `${isArabic ? "مدينة" : "City"}: ${cityFilter}`,
      dateFilter && `${isArabic ? "تاريخ" : "Date"}: ${dateFilter}`,
      codOnly && "COD only",
    ].filter(Boolean).join(" | ") || (isArabic ? "بدون فلاتر" : "No filters"),
    totals: {
      rows: totals.section,
      visible: totals.visible,
      cod: money(totals.cod),
      income: money(totals.income),
      unassigned: totals.unassigned,
      aging: totals.aging,
    },
    columns: [
      { key: "tracking", label: isArabic ? "التتبع" : "Tracking" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
      { key: "merchant", label: isArabic ? "التاجر" : "Merchant" },
      { key: "route", label: isArabic ? "المسار" : "Route" },
      { key: "receiver", label: isArabic ? "المستلم" : "Receiver" },
      { key: "cod", label: "COD" },
      { key: "amount", label: isArabic ? "الدخل" : "Income" },
      { key: "date", label: isArabic ? "التاريخ" : "Date" },
    ],
    rows: rows.map((order) => ({
      tracking: ref(order),
      status: statusLabel(order.status || "", isArabic),
      merchant: merchantLabel(order),
      route: route(order),
      receiver: order.receiver_name || order.customer_name || "—",
      cod: money(cod(order)),
      amount: money(amount(order)),
      date: order.created_at ? new Date(order.created_at).toLocaleString(isArabic ? "ar-AE" : "en-AE") : "—",
    })),
  };

  return (
    <section className="dn-pro-orders" dir={isArabic ? "rtl" : "ltr"}>
      <header className={`dn-pro-orders-hero dn-pro-orders-hero-${info.tone}`}>
        <div className="dn-pro-orders-hero-icon">{info.icon}</div>
        <div>
          <span>{isArabic ? "إدارة الطلبات الحقيقية" : "Real order operations"}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="dn-pro-orders-hero-actions">
          <button type="button" onClick={() => void onRefresh?.()}><RefreshCw className="h-4 w-4" />{isArabic ? "تحديث" : "Refresh"}</button>
          <AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={pdfPayload} />
        </div>
      </header>

      <nav className="dn-pro-orders-tabs" aria-label={isArabic ? "أقسام الطلبات" : "Order sections"}>
        {ORDER_SECTION_IDS.map((sectionId) => {
          const item = meta[sectionId];
          const selected = sectionId === id;
          return (
            <button key={sectionId} type="button" className={selected ? "is-active" : ""} onClick={() => onNavigate?.(sectionId)}>
              <span>{item.icon}</span>
              <strong>{isArabic ? item.ar : item.en}</strong>
              <b>{sectionCount(orders, sectionId)}</b>
            </button>
          );
        })}
      </nav>

      <div className="dn-pro-orders-kpis">
        <Metric icon={<ClipboardList className="h-5 w-5" />} label={isArabic ? "داخل القسم" : "Section rows"} value={totals.section} />
        <Metric icon={<Search className="h-5 w-5" />} label={isArabic ? "ظاهرة الآن" : "Visible now"} value={totals.visible} />
        <Metric icon={<Truck className="h-5 w-5" />} label={isArabic ? "بدون مندوب" : "Unassigned"} value={totals.unassigned} tone="warn" />
        <Metric icon={<AlertTriangle className="h-5 w-5" />} label={isArabic ? "أقدم من ٣ أيام" : "Aging 3+ days"} value={totals.aging} tone="danger" />
        <Metric icon={<PackageCheck className="h-5 w-5" />} label="COD" value={money(totals.cod)} />
        <Metric icon={<Sparkles className="h-5 w-5" />} label={isArabic ? "دخل التوصيل" : "Delivery income"} value={money(totals.income)} />
      </div>

      <section className="dn-pro-orders-filters">
        <div className="dn-pro-orders-search">
          <Search className="h-5 w-5" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "بحث بالتتبع، الهاتف، التاجر، المستلم، المدينة..." : "Search tracking, phone, merchant, receiver, city..."} />
        </div>
        <label><span>{isArabic ? "الحالة" : "Status"}</span><input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder={isArabic ? "مثال: pending / ملغي" : "e.g. pending / cancelled"} /></label>
        <label><span>{isArabic ? "التاجر" : "Merchant"}</span><input value={merchantFilter} onChange={(event) => setMerchantFilter(event.target.value)} placeholder={isArabic ? "اسم أو كود التاجر" : "Merchant name or code"} /></label>
        <label><span>{isArabic ? "مدينة" : "City"}</span><input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder={isArabic ? "دبي، أبوظبي..." : "Dubai, Abu Dhabi..."} /></label>
        <label><span>{isArabic ? "تاريخ" : "Date"}</span><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
        <button type="button" className={codOnly ? "is-active" : ""} onClick={() => setCodOnly((value) => !value)}><Filter className="h-4 w-4" />COD</button>
      </section>

      {notice && <p className="dn-pro-orders-notice">{notice}</p>}

      <article className="dn-pro-orders-table-card">
        <div className="dn-pro-orders-table-head">
          <div>
            <span>{isArabic ? "صفوف حقيقية من قاعدة البيانات" : "Real database rows"}</span>
            <h2>{title}</h2>
          </div>
          <small>{isArabic ? "لا يوجد توليد صفوف وهمية" : "No fake row generation"}</small>
        </div>

        <div className="dn-pro-orders-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{isArabic ? "التتبع" : "Tracking"}</th>
                <th>{isArabic ? "الحالة" : "Status"}</th>
                <th>{isArabic ? "التاجر / المرسل" : "Merchant / sender"}</th>
                <th>{isArabic ? "المسار" : "Route"}</th>
                <th>{isArabic ? "المستلم" : "Receiver"}</th>
                <th>COD</th>
                <th>{isArabic ? "الدخل" : "Income"}</th>
                <th>{isArabic ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={String(order.id || ref(order))}>
                  <td><button type="button" onClick={() => setSelectedOrder(order)}>{ref(order)}</button></td>
                  <td><span className="dn-pro-orders-status">{statusLabel(order.status || "", isArabic)}<small>{riskLabel(order, isArabic)}</small></span></td>
                  <td>{merchantLabel(order)}</td>
                  <td>{route(order)}</td>
                  <td>{order.receiver_name || order.customer_name || "—"}</td>
                  <td>{money(cod(order))}</td>
                  <td>{money(amount(order))}</td>
                  <td>
                    <div className="dn-pro-orders-row-actions">
                      <button type="button" onClick={() => setSelectedOrder(order)}><Eye className="h-4 w-4" />{actionLabel("view", isArabic)}</button>
                      <button type="button" onClick={() => setStatusOrder(order)}>{actionLabel("editStatus", isArabic)}</button>
                      <button type="button" onClick={() => setAssignOrder(order)}>{actionLabel("assignDriver", isArabic)}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="dn-pro-orders-empty">
              <ClipboardList className="h-8 w-8" />
              <strong>{isArabic ? "لا توجد طلبات مطابقة الآن" : "No matching orders right now"}</strong>
              <p>{isArabic ? "القسم يعرض فقط ما هو موجود فعلياً في جدول الطلبات بعد الفلاتر." : "This section only displays real order-table rows after filters."}</p>
              <button type="button" onClick={() => onNavigate?.("new_order")}>{isArabic ? "إضافة طلب جديد" : "Create new order"}</button>
            </div>
          )}
        </div>
      </article>

      <AdminOrderDetailsDrawer
        order={selectedOrder}
        merchants={merchants}
        isArabic={isArabic}
        onClose={() => setSelectedOrder(null)}
        onStatus={(order) => setStatusOrder(order)}
        onAssign={(order) => setAssignOrder(order)}
        onMerchant={(merchant) => setNotice(merchant ? `${isArabic ? "ملف التاجر" : "Merchant"}: ${merchant.trade_name}` : "")}
        onPreview={setNotice}
      />
      <AdminStatusUpdateModal open={Boolean(statusOrder)} order={statusOrder} isArabic={isArabic} onClose={() => setStatusOrder(null)} onSaved={onRefresh} />
      <AdminDriverAssignmentModal open={Boolean(assignOrder)} order={assignOrder} isArabic={isArabic} onClose={() => setAssignOrder(null)} onSaved={onRefresh} />
    </section>
  );
}

function Metric({ icon, label, value, tone = "info" }: { icon: ReactNode; label: string; value: string | number; tone?: "info" | "warn" | "danger" }) {
  return (
    <article className={`dn-pro-orders-metric dn-pro-orders-metric-${tone}`}>
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </article>
  );
}
