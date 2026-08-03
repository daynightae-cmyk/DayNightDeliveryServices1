import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Globe2,
  Loader2,
  MapPin,
  PackageCheck,
  Pencil,
  Plane,
  RefreshCw,
  Route,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import type { AdminPdfPayload } from "../../lib/adminPdfExport";
import { internationalDestinationLabel, isKnownInternationalDestination } from "../../data/internationalDestinations";
import { matchesAdminSection, normalizeOrderStatus } from "../../lib/adminOrderLogic";
import { financialsFromOrder } from "../../lib/orderFinancials";
import { matchesSearchQuery } from "../../lib/searchNormalization";
import {
  runTrack17Admin,
  type InternationalShipment,
} from "../../lib/internationalTrackingApi";
import { updateExistingOrderStatus } from "../../supabaseAdminOps";
import type { Merchant, Order } from "../../types";
import AdminDriverAssignmentModal from "./AdminDriverAssignmentModal";
import AdminEmptyState from "./AdminEmptyState";
import AdminInternationalOperationsMap from "./AdminInternationalOperationsMap";
import AdminInternationalOrderTrackingActions from "./AdminInternationalOrderTrackingActions";
import AdminOrderDeleteModal from "./AdminOrderDeleteModal";
import AdminOrderEditModal from "./AdminOrderEditModal";
import AdminPdfExportButton from "./AdminPdfExportButton";
import "../../styles/dn-international-orders-workspace.css";

type Props = {
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  onRefresh?: () => Promise<void>;
  searchManaged?: boolean;
};

type TrackingCenterData = {
  ok: boolean;
  shipments?: InternationalShipment[];
};

type WorkspaceFilter = "all" | "linked" | "awaiting" | "in_transit" | "delivered" | "exception";

const statusOptions = [
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

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalized(value: unknown) {
  return clean(value).toLocaleLowerCase().replace(/\s+/g, " ");
}

function orderReference(order: Order) {
  return clean(order.tracking_number || order.invoice_number || order.coupon_number || order.id) || "—";
}

function shipmentAwb(shipment?: InternationalShipment | null) {
  return clean(
    shipment?.carrier_tracking_number_full
      || shipment?.tracking_number
      || shipment?.carrier_tracking_number
      || shipment?.public_tracking_number,
  );
}

function shipmentStatus(shipment?: InternationalShipment | null) {
  return normalized(shipment?.normalized_status || shipment?.provider_status || shipment?.provider_sub_status);
}

function merchantForOrder(order: Order, merchants: Merchant[]) {
  const merchantId = clean(order.merchant_id);
  if (merchantId) {
    const found = merchants.find((merchant) => clean(merchant.id) === merchantId);
    if (found) return found;
  }
  const merchantCode = normalized(order.merchant_code);
  if (merchantCode) {
    const found = merchants.find((merchant) => normalized(merchant.merchant_code) === merchantCode);
    if (found) return found;
  }
  const merchantName = normalized(order.merchant_name);
  if (merchantName) {
    return merchants.find((merchant) =>
      normalized(merchant.trade_name) === merchantName || normalized(merchant.owner_name) === merchantName,
    ) || null;
  }
  return null;
}

function searchValues(order: Order, shipment?: InternationalShipment | null) {
  return [
    orderReference(order),
    order.coupon_number,
    order.merchant_name,
    order.merchant_code,
    order.sender_name,
    order.sender_phone,
    order.receiver_name,
    order.receiver_phone,
    order.customer_name,
    order.customer_phone,
    order.sender_city,
    order.receiver_city,
    order.destination_country,
    order.status,
    shipmentAwb(shipment),
    shipment?.latest_location,
    shipment?.latest_city,
    shipment?.latest_country,
    shipment?.normalized_status,
  ];
}

function destinationLabel(order: Order, isArabic: boolean) {
  const raw = clean(order.destination_country || order.receiver_city);
  if (isKnownInternationalDestination(raw)) {
    return internationalDestinationLabel(raw, isArabic);
  }
  return raw || "—";
}

function statusLabel(value: unknown, isArabic: boolean) {
  const key = normalizeOrderStatus(value as string | Order | null | undefined);
  const option = statusOptions.find(([status]) => status === key);
  return option ? option[isArabic ? 1 : 2] : (clean(value) || "—");
}

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} AED`;
}

function formatDate(value: string | null | undefined, isArabic: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(isArabic ? "ar-AE" : "en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function allOrdersPdfPayload(
  orders: Order[],
  shipmentsByOrder: Map<string, InternationalShipment>,
  isArabic: boolean,
): AdminPdfPayload {
  const revenue = orders.reduce((sum, order) => sum + financialsFromOrder(order as Order & Record<string, unknown>).companyRevenue, 0);
  return {
    language: isArabic ? "ar" : "en",
    sectionTitle: isArabic ? "الطلبات الدولية" : "International orders",
    filters: isArabic ? "جميع الطلبات الدولية الظاهرة" : "All visible international orders",
    totals: {
      orders: String(orders.length),
      visible: String(orders.length),
      income: money(revenue),
    },
    columns: [
      { key: "order", label: isArabic ? "رقم الطلب" : "Order" },
      { key: "awb", label: isArabic ? "بوليصة أرامكس" : "Aramex AWB" },
      { key: "merchant", label: isArabic ? "التاجر" : "Merchant" },
      { key: "customer", label: isArabic ? "العميل" : "Customer" },
      { key: "route", label: isArabic ? "المسار" : "Route" },
      { key: "delivery", label: isArabic ? "التوصيل" : "Delivery" },
      { key: "total", label: isArabic ? "إجمالي العميل" : "Customer total" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
    ],
    rows: orders.map((order) => {
      const financial = financialsFromOrder(order as Order & Record<string, unknown>);
      const shipment = shipmentsByOrder.get(clean(order.id));
      return {
        order: orderReference(order),
        awb: shipmentAwb(shipment) || "—",
        merchant: clean(order.merchant_name || order.sender_name) || "—",
        customer: clean(order.receiver_name || order.customer_name) || "—",
        route: `${clean(order.sender_city) || "—"} → ${destinationLabel(order, isArabic)}`,
        delivery: money(financial.deliveryFee),
        total: money(financial.customerTotal),
        status: statusLabel(order.status, isArabic),
      };
    }),
  };
}

export default function AdminInternationalOrdersWorkspace({
  isArabic,
  orders,
  merchants,
  onRefresh,
  searchManaged = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WorkspaceFilter>("all");
  const [shipments, setShipments] = useState<InternationalShipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [notice, setNotice] = useState("");
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [statusBusy, setStatusBusy] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const refreshShipments = useCallback(async () => {
    setLoadingShipments(true);
    try {
      const result = await runTrack17Admin<TrackingCenterData>("list", { limit: 200 });
      setShipments(result.shipments || []);
    } catch (cause) {
      console.error(cause);
      setNotice(isArabic
        ? "تعذر قراءة بوليصات التتبع الدولي الآن. الطلبات نفسها ما زالت ظاهرة."
        : "International AWBs could not be read. Orders remain visible.");
    } finally {
      setLoadingShipments(false);
    }
  }, [isArabic]);

  useEffect(() => {
    void refreshShipments();
    const listener = () => void refreshShipments();
    window.addEventListener("dn-international-shipment-updated", listener);
    return () => window.removeEventListener("dn-international-shipment-updated", listener);
  }, [refreshShipments]);

  const internationalOrders = useMemo(
    () => orders.filter((order) => matchesAdminSection(order, "external")),
    [orders],
  );

  const shipmentsByOrder = useMemo(() => {
    const map = new Map<string, InternationalShipment>();
    shipments.forEach((shipment) => {
      const orderId = clean(shipment.order_id);
      if (orderId && shipmentAwb(shipment)) map.set(orderId, shipment);
    });
    return map;
  }, [shipments]);

  const filteredOrders = useMemo(() => {
    return internationalOrders.filter((order) => {
      const shipment = shipmentsByOrder.get(clean(order.id));
      if (!searchManaged && !matchesSearchQuery(searchValues(order, shipment), query)) return false;
      const trackingStatus = shipmentStatus(shipment);
      if (filter === "linked") return Boolean(shipment);
      if (filter === "awaiting") return !shipment;
      if (filter === "in_transit") return trackingStatus.includes("transit") || normalizeOrderStatus(order) === "in_transit";
      if (filter === "delivered") return trackingStatus.includes("deliver") || normalizeOrderStatus(order) === "delivered";
      if (filter === "exception") return /exception|delay|failed|return|cancel/.test(trackingStatus);
      return true;
    });
  }, [filter, internationalOrders, query, searchManaged, shipmentsByOrder]);

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedOrderId("");
      return;
    }
    if (!filteredOrders.some((order) => clean(order.id) === selectedOrderId)) {
      setSelectedOrderId(clean(filteredOrders[0]?.id));
    }
  }, [filteredOrders, selectedOrderId]);

  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => clean(order.id) === selectedOrderId) || null,
    [filteredOrders, selectedOrderId],
  );
  const selectedShipment = selectedOrder ? shipmentsByOrder.get(clean(selectedOrder.id)) || null : null;
  const selectedMerchant = selectedOrder ? merchantForOrder(selectedOrder, merchants) : null;
  const selectedFinancial = selectedOrder ? financialsFromOrder(selectedOrder as Order & Record<string, unknown>) : null;

  const linkedCount = internationalOrders.filter((order) => shipmentsByOrder.has(clean(order.id))).length;
  const inTransitCount = internationalOrders.filter((order) => {
    const shipment = shipmentsByOrder.get(clean(order.id));
    return shipmentStatus(shipment).includes("transit") || normalizeOrderStatus(order) === "in_transit";
  }).length;
  const deliveredCount = internationalOrders.filter((order) => {
    const shipment = shipmentsByOrder.get(clean(order.id));
    return shipmentStatus(shipment).includes("deliver") || normalizeOrderStatus(order) === "delivered";
  }).length;
  const exceptionCount = internationalOrders.filter((order) => /exception|delay|failed|return|cancel/.test(shipmentStatus(shipmentsByOrder.get(clean(order.id))))).length;

  const pdfPayload = useMemo(
    () => allOrdersPdfPayload(filteredOrders, shipmentsByOrder, isArabic),
    [filteredOrders, isArabic, shipmentsByOrder],
  );

  async function registered(shipment: InternationalShipment) {
    setShipments((current) => [shipment, ...current.filter((item) => item.id !== shipment.id)]);
    setNotice(isArabic
      ? "تم حفظ رقم التتبع. رابط الشحنة ورسائل واتساب ظهرت داخل مركز العمليات."
      : "Tracking saved. Shipment link and WhatsApp actions are now available in the operations center.");
    window.dispatchEvent(new CustomEvent("dn-international-shipment-updated", { detail: { shipment } }));
    await onRefresh?.();
  }

  async function updateStatus(order: Order) {
    const key = clean(order.id);
    const next = statusDrafts[key] || normalizeOrderStatus(order);
    if (!key || !next) return;
    setStatusBusy(key);
    try {
      const ok = await updateExistingOrderStatus(
        key,
        next,
        isArabic ? "تحديث من مركز عمليات الطلبات الدولية" : "Updated from international operations center",
      );
      if (!ok) throw new Error("status_update_failed");
      setNotice(isArabic ? "تم تحديث حالة الطلب." : "Order status updated.");
      await onRefresh?.();
    } catch (cause) {
      console.error(cause);
      setNotice(isArabic ? "تعذر تحديث الحالة." : "Status update failed.");
    } finally {
      setStatusBusy("");
    }
  }

  const kpis: Array<{ filter: WorkspaceFilter; value: number; ar: string; en: string; icon: typeof Globe2 }> = [
    { filter: "all", value: internationalOrders.length, ar: "إجمالي الشحنات", en: "Total shipments", icon: Globe2 },
    { filter: "linked", value: linkedCount, ar: "مربوطة ببوليصة", en: "AWB linked", icon: PackageCheck },
    { filter: "in_transit", value: inTransitCount, ar: "قيد النقل", en: "In transit", icon: Plane },
    { filter: "delivered", value: deliveredCount, ar: "تم التسليم", en: "Delivered", icon: CheckCircle2 },
    { filter: "exception", value: exceptionCount, ar: "تحتاج متابعة", en: "Need attention", icon: AlertTriangle },
    { filter: "awaiting", value: Math.max(0, internationalOrders.length - linkedCount), ar: "بانتظار البوليصة", en: "Awaiting AWB", icon: Clock3 },
  ];

  return (
    <section className="dn-intl-orders-workspace" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-intl-orders-hero">
        <div>
          <span className="dn-intl-orders-hero__icon"><Globe2 /></span>
          <div>
            <small>DAY NIGHT · ARAMEX · 17TRACK</small>
            <h1>{isArabic ? "مركز عمليات الشحنات الدولية" : "International Shipments Command Center"}</h1>
            <p>{isArabic
              ? "إدارة الطلبات الدولية الحقيقية، ربط بوليصات أرامكس، متابعة المسارات، وتحديث حالة الطلب من شاشة تشغيل واحدة."
              : "Manage real international orders, link Aramex AWBs, review routes and update order status from one operations workspace."}</p>
          </div>
        </div>
        <div className="dn-intl-orders-hero__actions">
          <button type="button" onClick={() => { void onRefresh?.(); void refreshShipments(); }}>
            {loadingShipments ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {isArabic ? "تحديث البيانات" : "Refresh data"}
          </button>
          <AdminPdfExportButton payload={pdfPayload} label={isArabic ? "PDF كل الطلبات" : "All orders PDF"} />
        </div>
      </header>

      <div className="dn-intl-orders-kpis" role="group" aria-label={isArabic ? "فلاتر إحصاءات الشحنات" : "Shipment KPI filters"}>
        {kpis.map((item) => {
          const Icon = item.icon;
          return <button type="button" key={item.filter} className={filter === item.filter ? "is-active" : ""} onClick={() => setFilter(item.filter)} aria-pressed={filter === item.filter}><Icon /><span><strong>{item.value}</strong><small>{isArabic ? item.ar : item.en}</small></span></button>;
        })}
      </div>

      <div className="dn-intl-orders-toolbar">
        {!searchManaged && <label className="dn-intl-orders-search">
          <Search />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "بحث بالطلب أو البوليصة أو التاجر أو العميل أو المدينة..." : "Search order, AWB, merchant, customer or city..."} />
        </label>}
        <div className="dn-intl-orders-toolbar__result"><Route /><span>{isArabic ? "النتائج" : "Results"}</span><strong>{filteredOrders.length}</strong></div>
        {((!searchManaged && query) || filter !== "all") && <button type="button" className="dn-intl-orders-clear" onClick={() => { setQuery(""); setFilter("all"); }}><RefreshCw />{isArabic ? "مسح الفلاتر" : "Clear filters"}</button>}
      </div>

      {notice && <p className="dn-intl-orders-notice">{notice}</p>}

      <div className="dn-intl-orders-command-grid">
        <aside className="dn-intl-orders-selector" aria-label={isArabic ? "قائمة الطلبات الدولية" : "International order list"}>
          <header><div><small>{isArabic ? "قائمة التشغيل" : "OPERATIONS QUEUE"}</small><strong>{isArabic ? "الطلبات الدولية" : "International orders"}</strong></div><span>{filteredOrders.length}</span></header>
          <div className="dn-intl-orders-selector__list">
            {filteredOrders.map((order) => {
              const key = clean(order.id);
              const shipment = shipmentsByOrder.get(key) || null;
              const isSelected = key === selectedOrderId;
              return <button type="button" key={key || orderReference(order)} className={isSelected ? "is-selected" : ""} onClick={() => setSelectedOrderId(key)} aria-pressed={isSelected}>
                <span className="dn-intl-order-selector__top"><b dir="ltr">{orderReference(order)}</b><em className={shipment ? "is-linked" : "is-waiting"}>{shipment ? (isArabic ? "مربوط" : "Linked") : (isArabic ? "بانتظار AWB" : "Awaiting AWB")}</em></span>
                <span className="dn-intl-order-selector__route"><MapPin />{clean(order.sender_city) || "—"}<i>→</i>{destinationLabel(order, isArabic)}</span>
                <span className="dn-intl-order-selector__meta"><small>{clean(order.merchant_name || order.sender_name) || "—"}</small><strong>{statusLabel(order.status, isArabic)}</strong></span>
                {shipment && <span className="dn-intl-order-selector__awb" dir="ltr"><Plane />{shipmentAwb(shipment)}</span>}
              </button>;
            })}
            {!filteredOrders.length && <AdminEmptyState icon="empty-state" title={isArabic ? "لا توجد طلبات دولية مطابقة" : "No matching international orders"} message={isArabic ? "امسح البحث أو الفلاتر لعرض بقية الطلبات." : "Clear the search or filters to show the remaining orders."} action={<button type="button" onClick={() => { setQuery(""); setFilter("all"); }}><RefreshCw />{isArabic ? "مسح الفلاتر" : "Clear filters"}</button>} />}
          </div>
        </aside>

        <main className="dn-intl-orders-main">
          <AdminInternationalOperationsMap shipment={selectedShipment} isArabic={isArabic} />

          {selectedOrder && selectedFinancial ? <article className="dn-intl-selected-order">
            <header>
              <div><small>{isArabic ? "الشحنة المحددة" : "SELECTED SHIPMENT"}</small><strong dir="ltr">{orderReference(selectedOrder)}</strong><span>{statusLabel(selectedOrder.status, isArabic)}</span></div>
              <div className={selectedShipment ? "is-linked" : "is-waiting"}>{selectedShipment ? <CheckCircle2 /> : <Globe2 />}<span>{selectedShipment ? (isArabic ? "التتبع جاهز" : "Tracking ready") : (isArabic ? "أضف بوليصة أرامكس" : "Add Aramex AWB")}</span></div>
            </header>

            <div className="dn-intl-selected-order__facts">
              <div><small>{isArabic ? "التاجر" : "Merchant"}</small><b>{clean(selectedOrder.merchant_name || selectedOrder.sender_name) || "—"}</b><span dir="ltr">{clean(selectedMerchant?.phone || selectedOrder.sender_phone) || "—"}</span></div>
              <div><small>{isArabic ? "العميل" : "Customer"}</small><b>{clean(selectedOrder.receiver_name || selectedOrder.customer_name) || "—"}</b><span dir="ltr">{clean(selectedOrder.receiver_phone || selectedOrder.customer_phone) || "—"}</span></div>
              <div><small>{isArabic ? "المسار" : "Route"}</small><b>{clean(selectedOrder.sender_city) || "—"} → {destinationLabel(selectedOrder, isArabic)}</b><span>{selectedShipment?.latest_location || (isArabic ? "بانتظار تحديث الناقل" : "Awaiting carrier update")}</span></div>
              <div><small>{isArabic ? "الحساب" : "Financials"}</small><b>{money(selectedFinancial.customerTotal)}</b><span>{isArabic ? `التوصيل ${money(selectedFinancial.deliveryFee)}` : `Delivery ${money(selectedFinancial.deliveryFee)}`}</span></div>
              <div><small>{isArabic ? "رقم البوليصة" : "Aramex AWB"}</small><b dir="ltr">{shipmentAwb(selectedShipment) || "—"}</b><span>{selectedShipment?.carrier_name || "Aramex"}</span></div>
              <div><small>{isArabic ? "آخر تحديث" : "Last update"}</small><b>{formatDate(selectedShipment?.latest_update_at || selectedShipment?.last_synced_at, isArabic)}</b><span>{selectedShipment?.latest_description || (isArabic ? "لا توجد أحداث بعد" : "No carrier events yet")}</span></div>
            </div>

            <div className="dn-intl-selected-order__management">
              <button type="button" onClick={() => setEditOrder(selectedOrder)}><Pencil />{isArabic ? "تعديل الطلب" : "Edit order"}</button>
              <button type="button" className="is-danger" onClick={() => setDeleteOrder(selectedOrder)}><Trash2 />{isArabic ? "حذف" : "Delete"}</button>
              <button type="button" className="is-driver" onClick={() => setAssignOrder(selectedOrder)}><Truck />{isArabic ? "إرسال للمندوب" : "Assign driver"}</button>
              <div className="dn-intl-order-status">
                <select value={statusDrafts[clean(selectedOrder.id)] || normalizeOrderStatus(selectedOrder)} onChange={(event) => setStatusDrafts((current) => ({ ...current, [clean(selectedOrder.id)]: event.target.value }))} aria-label={isArabic ? "حالة الطلب" : "Order status"}>
                  {statusOptions.map(([value, ar, en]) => <option value={value} key={value}>{isArabic ? ar : en}</option>)}
                </select>
                <button type="button" onClick={() => void updateStatus(selectedOrder)} disabled={statusBusy === clean(selectedOrder.id)}>{statusBusy === clean(selectedOrder.id) ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{isArabic ? "تحديث الحالة" : "Update status"}</button>
              </div>
            </div>

            <AdminInternationalOrderTrackingActions order={selectedOrder} merchant={selectedMerchant} shipment={selectedShipment} isArabic={isArabic} onRegistered={registered} />
          </article> : <AdminEmptyState icon="empty-state" title={isArabic ? "اختر طلبًا دوليًا" : "Select an international order"} message={isArabic ? "اختر طلبًا من القائمة لعرض الخريطة والتفاصيل والإجراءات." : "Choose an order from the queue to view its map, details and actions."} />}
        </main>
      </div>

      <AdminOrderEditModal order={editOrder} merchants={merchants} isArabic={isArabic} open={Boolean(editOrder)} onClose={() => setEditOrder(null)} onSaved={async () => { setEditOrder(null); setNotice(isArabic ? "تم حفظ الطلب." : "Order saved."); await onRefresh?.(); }} />
      <AdminOrderDeleteModal order={deleteOrder} isArabic={isArabic} open={Boolean(deleteOrder)} onClose={() => setDeleteOrder(null)} onDeleted={async () => { setDeleteOrder(null); setNotice(isArabic ? "تم حذف الطلب." : "Order deleted."); await onRefresh?.(); }} />
      <AdminDriverAssignmentModal order={assignOrder} isArabic={isArabic} open={Boolean(assignOrder)} onClose={() => setAssignOrder(null)} onSaved={async () => { setAssignOrder(null); setNotice(isArabic ? "تم إرسال الطلب للمندوب." : "Order assigned."); await onRefresh?.(); }} />
    </section>
  );
}
