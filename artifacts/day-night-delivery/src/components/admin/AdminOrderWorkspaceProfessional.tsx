import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Filter,
  Loader2,
  MapPin,
  PackageCheck,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { FinanceSummary, FinanceSummarySource } from "../../lib/adminData";
import {
  cleanAdminText,
  matchesAdminSection,
  normalizeAdminKey,
  normalizeOrderStatus,
} from "../../lib/adminOrderLogic";
import { financialsFromOrder } from "../../lib/orderFinancials";
import {
  localizedOrderDestination,
  localizedOrderDestinationTooltip,
} from "../../lib/exportLocalization";
import { updateExistingOrderStatus } from "../../supabaseAdminOps";
import type { Merchant, Order } from "../../types";
import AdminDriverAssignmentModal from "./AdminDriverAssignmentModal";
import AdminOrderDeleteModal from "./AdminOrderDeleteModal";
import AdminOrderEditModal from "./AdminOrderEditModal";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { adminSectionById, type AdminSectionId } from "./AdminSectionRegistry";
import type { AdminPdfPayload } from "../../lib/adminPdfExport";
import { addAdminNotification, playAdminAudioEvent } from "../../lib/adminAudio";
import "../../styles/dn-admin-orders-professional.css";

type Props = {
  id: AdminSectionId;
  isArabic: boolean;
  orders: Order[];
  allOrders?: Order[];
  merchants: Merchant[];
  financeSummary: FinanceSummary | null;
  financeSummarySource?: FinanceSummarySource;
  financeWarning?: string;
  onNavigate?: (id: AdminSectionId) => void;
  onRefresh?: () => Promise<void>;
  searchManaged?: boolean;
};

type ExtendedOrder = Order & {
  driver_id?: string | null;
  assigned_driver_id?: string | null;
};

type SortMode = "newest" | "oldest" | "tracking" | "amount_desc";

const ORDER_STATUS_OPTIONS = [
  ["pending", "قيد الانتظار", "Pending"],
  ["review", "قيد المراجعة", "Under review"],
  ["confirmed", "تم التأكيد", "Confirmed"],
  ["assigned", "تم تعيين مندوب", "Driver assigned"],
  ["picked_up", "تم الاستلام", "Picked up"],
  ["in_transit", "في الطريق", "In transit"],
  ["delivered", "تم التسليم", "Delivered"],
  ["postponed", "مؤجل", "Postponed"],
  ["returned", "راجع", "Returned"],
  ["cancelled", "ملغي", "Cancelled"],
] as const;

const STATUS_VALUES = new Set(ORDER_STATUS_OPTIONS.map(([value]) => value));
const clean = (value: unknown) => String(value ?? "").trim();
const money = (value: unknown, isArabic: boolean) => {
  const parsed = Number(value || 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return isArabic ? `${amount.toFixed(2)} درهم` : `${amount.toFixed(2)} AED`;
};
const tracking = (order: Order) =>
  order.tracking_number || order.tracking_code || order.invoice_number || order.coupon_number || order.id || "—";
const orderDate = (order: Order) => clean(order.created_at || order.updated_at).slice(0, 10);
const canonicalStatus = (value: unknown) => normalizeOrderStatus(value as string | null | undefined);
const selectableStatus = (value: unknown) => {
  const canonical = canonicalStatus(value);
  return STATUS_VALUES.has(canonical as (typeof ORDER_STATUS_OPTIONS)[number][0]) ? canonical : "pending";
};
const route = (order: Order, isArabic: boolean) => localizedOrderDestination(order, isArabic ? "ar" : "en");
const routeTooltip = (order: Order, isArabic: boolean) => localizedOrderDestinationTooltip(order, isArabic ? "ar" : "en");
const rowKey = (order: Order) => String(order.id || tracking(order));

function statusText(value: unknown, isArabic: boolean) {
  const status = canonicalStatus(value);
  const option = ORDER_STATUS_OPTIONS.find(([key]) => key === status);
  if (option) return option[isArabic ? 1 : 2];
  return normalizeAdminKey(value).replace(/_/g, " ") || "—";
}

function searchText(order: Order) {
  const financial = financialsFromOrder(order as Order & Record<string, unknown>);
  return cleanAdminText(
    [
      tracking(order),
      order.coupon_number,
      order.invoice_number,
      order.merchant_name,
      order.merchant_code,
      order.sender_name,
      order.sender_phone,
      order.sender_city,
      order.sender_area,
      order.sender_address,
      order.receiver_name,
      order.receiver_phone,
      order.receiver_city,
      order.receiver_area,
      order.receiver_address,
      order.destination_country,
      order.driver_name,
      order.driver_phone,
      order.driver_code,
      order.status,
      financial.customerTotal,
      financial.goodsValue,
      financial.deliveryFee,
      order.cod_amount,
    ].join(" "),
  );
}

function orderAmount(order: Order) {
  return financialsFromOrder(order as Order & Record<string, unknown>).customerTotal;
}

function OrderMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone = "normal",
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof PackageCheck;
  tone?: "normal" | "gold" | "sky" | "success" | "danger";
}) {
  return (
    <article className={`dn-order-pro-metric dn-order-pro-metric--${tone}`}>
      <span className="dn-order-pro-metric-icon"><Icon /></span>
      <div>
        <small>{label}</small>
        <strong dir="ltr">{value}</strong>
        <em>{hint}</em>
      </div>
    </article>
  );
}

type OrderEditorHandle = { open: (order: Order) => void; close: () => void };

const IsolatedOrderEditor = forwardRef<
  OrderEditorHandle,
  { merchants: Merchant[]; isArabic: boolean }
>(function IsolatedOrderEditor({ merchants, isArabic }, ref) {
  const [order, setOrder] = useState<Order | null>(null);
  useImperativeHandle(ref, () => ({ open: setOrder, close: () => setOrder(null) }), []);
  return (
    <AdminOrderEditModal
      order={order}
      merchants={merchants}
      isArabic={isArabic}
      open={Boolean(order)}
      onClose={() => setOrder(null)}
    />
  );
});

export default function AdminOrderWorkspaceProfessional({
  id,
  isArabic,
  orders,
  allOrders,
  merchants,
  financeSummary: _financeSummary,
  financeSummarySource: _financeSummarySource,
  financeWarning: _financeWarning,
  onNavigate: _onNavigate,
  onRefresh,
  searchManaged = false,
}: Props) {
  const config = adminSectionById[id];
  const refresh = onRefresh || (async () => undefined);
  const editorRef = useRef<OrderEditorHandle>(null);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selected, setSelected] = useState<string[]>([]);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [statusBusy, setStatusBusy] = useState("");
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
    setSortMode("newest");
    setSelected([]);
    setStatusDrafts({});
    setStatusBusy("");
    setNotice("");
    editorRef.current?.close();
    setDeleteOrder(null);
    setAssignOrder(null);
  }, [id]);

  const sourceOrders = allOrders ?? orders;
  const liveOrders = useMemo(
    () =>
      sourceOrders.map((order) => {
        const override = statusOverrides[rowKey(order)];
        return override && canonicalStatus(order.status) !== override ? { ...order, status: override } : order;
      }),
    [sourceOrders, statusOverrides],
  );

  const sectionRows = useMemo(
    () => liveOrders.filter((order) => matchesAdminSection(order, id)),
    [id, liveOrders],
  );

  const visibleRows = useMemo(() => {
    const normalizedQuery = cleanAdminText(query);
    const result = sectionRows.filter((order) => {
      const date = orderDate(order);
      const dateMatches = (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
      const statusMatches = statusFilter === "all" || canonicalStatus(order.status) === statusFilter;
      const queryMatches = searchManaged || !normalizedQuery || searchText(order).includes(normalizedQuery);
      return dateMatches && statusMatches && queryMatches;
    });
    return result.sort((left, right) => {
      if (sortMode === "tracking") return tracking(left).localeCompare(tracking(right), isArabic ? "ar" : "en");
      if (sortMode === "amount_desc") return orderAmount(right) - orderAmount(left);
      const leftTime = new Date(left.created_at || left.updated_at || 0).getTime();
      const rightTime = new Date(right.created_at || right.updated_at || 0).getTime();
      return sortMode === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [dateFrom, dateTo, id, isArabic, query, searchManaged, sectionRows, sortMode, statusFilter]);

  useEffect(() => {
    const visible = new Set(visibleRows.map(rowKey));
    setSelected((current) => current.filter((key) => visible.has(key)));
  }, [visibleRows]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedRows = useMemo(
    () => visibleRows.filter((order) => selectedSet.has(rowKey(order))),
    [selectedSet, visibleRows],
  );
  const exportRows = selectedRows.length ? selectedRows : visibleRows;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((order) => selectedSet.has(rowKey(order)));

  const sectionTotals = useMemo(() => {
    return sectionRows.reduce(
      (acc, order) => {
        const financial = financialsFromOrder(order as Order & Record<string, unknown>);
        acc.customer += financial.customerTotal;
        acc.company += financial.companyRevenue;
        acc.cod += Number(order.cod_amount || 0);
        if (canonicalStatus(order.status) === "delivered") acc.delivered += 1;
        if (["assigned", "picked_up", "in_transit", "confirmed"].includes(canonicalStatus(order.status))) acc.active += 1;
        return acc;
      },
      { customer: 0, company: 0, cod: 0, delivered: 0, active: 0 },
    );
  }, [sectionRows]);

  const exportTotals = useMemo(() => {
    return exportRows.reduce(
      (acc, order) => {
        const financial = financialsFromOrder(order as Order & Record<string, unknown>);
        acc.customer += financial.customerTotal;
        acc.company += financial.companyRevenue;
        acc.cod += Number(order.cod_amount || 0);
        return acc;
      },
      { customer: 0, company: 0, cod: 0 },
    );
  }, [exportRows]);

  const title = isArabic ? config.titleAr : config.titleEn;
  const subtitle = isArabic ? config.subtitleAr : config.subtitleEn;
  const filterSummary = [
    query ? `${isArabic ? "بحث" : "Search"}: ${query}` : "",
    statusFilter !== "all" ? `${isArabic ? "الحالة" : "Status"}: ${statusText(statusFilter, isArabic)}` : "",
    dateFrom ? `${isArabic ? "من" : "From"}: ${dateFrom}` : "",
    dateTo ? `${isArabic ? "إلى" : "To"}: ${dateTo}` : "",
    selectedRows.length ? `${isArabic ? "محدد" : "Selected"}: ${selectedRows.length}` : "",
  ].filter(Boolean).join(" · ") || (isArabic ? "كل السجلات الظاهرة" : "All visible records");

  const pdfPayload: AdminPdfPayload = {
    language: isArabic ? "ar" : "en",
    sectionTitle: `DAY NIGHT · ${title}`,
    filters: filterSummary,
    totals: {
      [isArabic ? "عدد السجلات" : "Rows"]: exportRows.length,
      [isArabic ? "إجمالي العميل" : "Customer total"]: money(exportTotals.customer, isArabic),
      [isArabic ? "إجمالي COD" : "COD total"]: money(exportTotals.cod, isArabic),
      [isArabic ? "دخل داي نايت" : "DAY NIGHT revenue"]: money(exportTotals.company, isArabic),
    },
    columns: [
      { key: "tracking", label: isArabic ? "التتبع" : "Tracking" },
      { key: "date", label: isArabic ? "التاريخ" : "Date" },
      { key: "coupon", label: isArabic ? "الكوبون" : "Coupon" },
      { key: "merchant", label: isArabic ? "التاجر / المرسل" : "Merchant / sender" },
      { key: "recipient", label: isArabic ? "المستلم" : "Recipient" },
      { key: "route", label: isArabic ? "المسار" : "Route" },
      { key: "customerTotal", label: isArabic ? "إجمالي العميل" : "Customer total" },
      { key: "cod", label: "COD" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
      { key: "driver", label: isArabic ? "المندوب" : "Driver" },
    ],
    rows: exportRows.map((order) => {
      const financial = financialsFromOrder(order as Order & Record<string, unknown>);
      return {
        tracking: tracking(order),
        date: orderDate(order) || "—",
        coupon: order.coupon_number || "—",
        merchant: order.merchant_name || order.sender_name || "—",
        recipient: `${order.receiver_name || order.customer_name || "—"}${order.receiver_phone ? ` · ${order.receiver_phone}` : ""}`,
        route: route(order, isArabic),
        customerTotal: money(financial.customerTotal, isArabic),
        cod: money(order.cod_amount || 0, isArabic),
        status: statusText(order.status, isArabic),
        driver: order.driver_name || order.driver_code || "—",
      };
    }),
    orientation: "landscape",
  };

  async function changeOrderStatus(order: Order) {
    const key = rowKey(order);
    const current = selectableStatus(order.status);
    const next = selectableStatus(statusDrafts[key] || current);
    if (!order.id || next === current) return;
    setStatusBusy(key);
    setNotice("");
    try {
      const ok = await updateExistingOrderStatus(
        order.id,
        next,
        isArabic ? `تحديث من سجل ${title}` : `Updated from ${title}`,
      );
      if (!ok) throw new Error("status_update_failed");
      setStatusOverrides((previous) => ({ ...previous, [key]: next }));
      playAdminAudioEvent(next === "delivered" ? "success" : "notification");
      addAdminNotification({
        type: "success",
        sectionId: id,
        priority: "low",
        dedupeKey: `order-pro:${order.id}:${next}`,
        titleAr: "تم تحديث الطلبية",
        titleEn: "Order updated",
        bodyAr: `${tracking(order)} ← ${statusText(next, true)}`,
        bodyEn: `${tracking(order)} → ${statusText(next, false)}`,
      });
      setNotice(isArabic ? `تم تحديث ${tracking(order)} بنجاح.` : `${tracking(order)} updated successfully.`);
      window.dispatchEvent(new CustomEvent("dn-admin-order-status-change", { detail: { orderId: order.id, status: next } }));
      await refresh();
    } catch (cause) {
      console.error(cause);
      setNotice(isArabic ? "تعذر تحديث الحالة. راجع صلاحيات الإدارة واتصال Supabase." : "Could not update status. Check Admin permissions and Supabase connectivity.");
    } finally {
      setStatusBusy("");
    }
  }

  function toggleRow(order: Order) {
    const key = rowKey(order);
    setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function toggleAllVisible() {
    setSelected(allVisibleSelected ? [] : visibleRows.map(rowKey));
  }

  const hasFilters = Boolean(query || dateFrom || dateTo || statusFilter !== "all");

  return (
    <section className="dn-order-pro" dir={isArabic ? "rtl" : "ltr"} data-order-section={id}>
      <header className="dn-order-pro-hero">
        <div className="dn-order-pro-hero-copy">
          <span className="dn-order-pro-eyebrow"><PackageCheck /> DAY NIGHT ORDER CONTROL</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {id === "abu_dhabi" && (
            <span className="dn-order-pro-region-chip"><MapPin />{isArabic ? "أبوظبي · مصفح · خليفة · محمد بن زايد · بني ياس · الشهامة · العين" : "Abu Dhabi · Mussafah · Khalifa · MBZ · Baniyas · Shahama · Al Ain"}</span>
          )}
        </div>
        <div className="dn-order-pro-hero-actions">
          <button type="button" onClick={() => void refresh()}><RefreshCw />{isArabic ? "تحديث مباشر" : "Live refresh"}</button>
          <AdminPdfExportButton
            payload={pdfPayload}
            label={selectedRows.length ? (isArabic ? `تصدير المحدد (${selectedRows.length})` : `Export selected (${selectedRows.length})`) : (isArabic ? "تصدير السجل" : "Export register")}
          />
        </div>
      </header>

      <div className="dn-order-pro-metrics">
        <OrderMetric label={isArabic ? "إجمالي القسم" : "Section total"} value={String(sectionRows.length)} hint={isArabic ? "كل السجلات المطابقة" : "All matching records"} icon={PackageCheck} tone="gold" />
        <OrderMetric label={isArabic ? "الظاهر الآن" : "Visible now"} value={String(visibleRows.length)} hint={isArabic ? "بعد البحث والفلاتر" : "After filters"} icon={Filter} tone="sky" />
        <OrderMetric label={isArabic ? "قيد التنفيذ" : "Active"} value={String(sectionTotals.active)} hint={isArabic ? "تشغيل حي" : "Live workflow"} icon={Truck} tone="normal" />
        <OrderMetric label={isArabic ? "تم التسليم" : "Delivered"} value={String(sectionTotals.delivered)} hint={isArabic ? "داخل هذا القسم" : "In this section"} icon={CheckCircle2} tone="success" />
        <OrderMetric label={isArabic ? "إجمالي COD" : "COD total"} value={money(sectionTotals.cod, isArabic)} hint={isArabic ? "قيمة التحصيل" : "Collection value"} icon={WalletCards} tone="gold" />
        <OrderMetric label={isArabic ? "دخل داي نايت" : "DAY NIGHT revenue"} value={money(sectionTotals.company, isArabic)} hint={isArabic ? "رسوم التوصيل" : "Delivery revenue"} icon={CircleDollarSign} tone="sky" />
      </div>

      <section className="dn-order-pro-toolbar">
        {!searchManaged && (
          <label className="dn-order-pro-search">
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "ابحث بالتتبع، الكوبون، الهاتف، التاجر، العنوان، المندوب..." : "Search tracking, coupon, phone, merchant, address, driver..."} />
          </label>
        )}
        <label><span><CalendarDays />{isArabic ? "من" : "From"}</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label><span><CalendarDays />{isArabic ? "إلى" : "To"}</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label><span><Filter />{isArabic ? "الحالة" : "Status"}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{isArabic ? "كل الحالات" : "All statuses"}</option>{ORDER_STATUS_OPTIONS.map(([value, ar, en]) => <option key={value} value={value}>{isArabic ? ar : en}</option>)}</select></label>
        <label><span><ChevronDown />{isArabic ? "الترتيب" : "Sort"}</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="newest">{isArabic ? "الأحدث أولاً" : "Newest first"}</option><option value="oldest">{isArabic ? "الأقدم أولاً" : "Oldest first"}</option><option value="tracking">{isArabic ? "رقم التتبع" : "Tracking"}</option><option value="amount_desc">{isArabic ? "الأعلى قيمة" : "Highest value"}</option></select></label>
        {hasFilters && <button type="button" className="dn-order-pro-clear" onClick={() => { setQuery(""); setDateFrom(""); setDateTo(""); setStatusFilter("all"); }}><XCircle />{isArabic ? "مسح الفلاتر" : "Clear filters"}</button>}
      </section>

      {notice && <p className="dn-order-pro-notice">{notice}</p>}

      <section className="dn-order-pro-register">
        <header className="dn-order-pro-register-head">
          <div>
            <span>{isArabic ? "سجل الطلبيات التشغيلي" : "Operational orders register"}</span>
            <h2>{visibleRows.length} {isArabic ? "طلبية مرتبة" : "organized orders"}</h2>
          </div>
          <div className="dn-order-pro-selection-actions">
            <button type="button" onClick={toggleAllVisible} disabled={!visibleRows.length}>
              <span className={`dn-order-pro-check ${allVisibleSelected ? "is-checked" : ""}`}>{allVisibleSelected ? "✓" : ""}</span>
              {allVisibleSelected ? (isArabic ? "إلغاء تحديد الكل" : "Clear all") : (isArabic ? "تحديد الظاهر" : "Select visible")}
            </button>
            {selectedRows.length > 0 && <button type="button" onClick={() => setSelected([])}>{isArabic ? "إلغاء التحديد" : "Clear selection"}</button>}
          </div>
        </header>

        <div className="dn-order-pro-table-wrap">
          <table className="dn-order-pro-table">
            <thead>
              <tr>
                <th className="dn-order-pro-select-cell">✓</th>
                <th>{isArabic ? "الطلب" : "Order"}</th>
                <th>{isArabic ? "التاريخ" : "Date"}</th>
                <th>{isArabic ? "التاجر / المرسل" : "Merchant / sender"}</th>
                <th>{isArabic ? "المستلم" : "Recipient"}</th>
                <th>{isArabic ? "المسار" : "Route"}</th>
                <th>{isArabic ? "الحساب" : "Financials"}</th>
                <th>{isArabic ? "الحالة" : "Status"}</th>
                <th>{isArabic ? "المندوب" : "Driver"}</th>
                <th>{isArabic ? "الإجراءات" : "Actions"}</th>
                <th>{isArabic ? "تحديث الحالة" : "Status update"}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((order) => {
                const key = rowKey(order);
                const financial = financialsFromOrder(order as Order & Record<string, unknown>);
                const selectedRow = selectedSet.has(key);
                const current = selectableStatus(order.status);
                const draft = statusDrafts[key] || current;
                const busy = statusBusy === key;
                const extended = order as ExtendedOrder;
                const assigned = extended.assigned_driver_id || extended.driver_id || order.driver_name || order.driver_code;
                return (
                  <tr key={key} className={selectedRow ? "is-selected" : ""}>
                    <td className="dn-order-pro-select-cell"><input type="checkbox" checked={selectedRow} onChange={() => toggleRow(order)} aria-label={`${isArabic ? "تحديد" : "Select"} ${tracking(order)}`} /></td>
                    <td><strong className="dn-order-pro-track" dir="ltr">{tracking(order)}</strong><small dir="ltr">{order.coupon_number || order.invoice_number || "—"}</small></td>
                    <td><span dir="ltr">{orderDate(order) || "—"}</span><small>{order.service_type || order.order_type || "—"}</small></td>
                    <td><strong>{order.merchant_name || order.sender_name || "—"}</strong><small dir="ltr">{order.sender_phone || order.merchant_code || "—"}</small></td>
                    <td><strong>{order.receiver_name || order.customer_name || "—"}</strong><small dir="ltr">{order.receiver_phone || "—"}</small></td>
                    <td title={routeTooltip(order, isArabic)}><strong className="dn-order-pro-route">{route(order, isArabic)}</strong><small>{order.receiver_area || order.sender_area || order.destination_country || "—"}</small></td>
                    <td><div className="dn-order-pro-money"><span>{isArabic ? "العميل" : "Total"}<b dir="ltr">{money(financial.customerTotal, isArabic)}</b></span><span>{isArabic ? "التوصيل" : "Delivery"}<b dir="ltr">{money(financial.deliveryFee, isArabic)}</b></span><span>COD<b dir="ltr">{money(order.cod_amount || 0, isArabic)}</b></span></div></td>
                    <td><span className={`dn-order-pro-status dn-order-pro-status--${canonicalStatus(order.status)}`}>{statusText(order.status, isArabic)}</span></td>
                    <td><span className="dn-order-pro-driver"><UserRound />{order.driver_name || order.driver_code || (assigned ? (isArabic ? "مسند" : "Assigned") : (isArabic ? "غير مسند" : "Unassigned"))}</span></td>
                    <td><div className="dn-order-pro-row-actions"><button type="button" onClick={() => editorRef.current?.open(order)} title={isArabic ? "تعديل" : "Edit"}><Pencil /></button><button type="button" onClick={() => setAssignOrder(order)} title={isArabic ? "إسناد مندوب" : "Assign driver"}><Truck /></button><a href={`/tracking?code=${encodeURIComponent(tracking(order))}`} target="_blank" rel="noreferrer" title={isArabic ? "متابعة" : "Track"}><ExternalLink /></a><button type="button" className="danger" onClick={() => setDeleteOrder(order)} title={isArabic ? "حذف" : "Delete"}><Trash2 /></button></div></td>
                    <td><div className="dn-order-pro-status-editor"><select value={draft} onChange={(event) => setStatusDrafts((currentDrafts) => ({ ...currentDrafts, [key]: event.target.value }))} disabled={busy}>{ORDER_STATUS_OPTIONS.map(([value, ar, en]) => <option key={value} value={value}>{isArabic ? ar : en}</option>)}</select><button type="button" disabled={busy || draft === current} onClick={() => void changeOrderStatus(order)}>{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{isArabic ? "حفظ" : "Save"}</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleRows.length && <div className="dn-order-pro-empty"><PackageCheck /><strong>{isArabic ? "لا توجد طلبيات مطابقة" : "No matching orders"}</strong><p>{id === "abu_dhabi" ? (isArabic ? "تم فحص المدينة والإمارة والمنطقة والعنوان والبيانات العربية. غيّر الفترة أو البحث إذا لزم." : "City, emirate, area, address, and Arabic location fields were checked. Adjust filters if needed.") : (isArabic ? "غيّر البحث أو الفلاتر، أو حدّث البيانات مباشرة." : "Change the filters or refresh live data.")}</p><button type="button" onClick={() => void refresh()}><RefreshCw />{isArabic ? "تحديث" : "Refresh"}</button></div>}
        </div>
      </section>

      <aside className={`dn-order-pro-export-bar ${selectedRows.length ? "has-selection" : ""}`}>
        <div><strong>{selectedRows.length ? `${selectedRows.length} ${isArabic ? "طلبية محددة" : "orders selected"}` : `${visibleRows.length} ${isArabic ? "طلبية ظاهرة" : "orders visible"}`}</strong><span>{isArabic ? "PDF · CSV · Word — نفس السجلات بالضبط بدون قص صامت" : "PDF · CSV · Word — exactly these records, with no silent row truncation"}</span></div>
        <AdminPdfExportButton payload={pdfPayload} label={selectedRows.length ? (isArabic ? "تصدير الطلبيات المحددة" : "Export selected orders") : (isArabic ? "تصدير الطلبيات الظاهرة" : "Export visible orders")} />
      </aside>

      <IsolatedOrderEditor ref={editorRef} merchants={merchants} isArabic={isArabic} />
      <AdminOrderDeleteModal order={deleteOrder} isArabic={isArabic} open={Boolean(deleteOrder)} onClose={() => setDeleteOrder(null)} onDeleted={async () => { setDeleteOrder(null); setNotice(isArabic ? "تم حذف الطلبية." : "Order deleted."); await refresh(); }} />
      <AdminDriverAssignmentModal order={assignOrder} isArabic={isArabic} open={Boolean(assignOrder)} onClose={() => setAssignOrder(null)} onSaved={async () => { setAssignOrder(null); setNotice(isArabic ? "تم تحديث إسناد المندوب." : "Driver assignment updated."); await refresh(); }} />
    </section>
  );
}
