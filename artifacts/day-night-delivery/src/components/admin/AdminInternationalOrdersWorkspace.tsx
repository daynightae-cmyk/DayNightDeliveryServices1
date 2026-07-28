import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileDown,
  Globe2,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import type { AdminPdfPayload } from "../../lib/adminPdfExport";
import { matchesAdminSection, normalizeOrderStatus } from "../../lib/adminOrderLogic";
import { financialsFromOrder } from "../../lib/orderFinancials";
import {
  runTrack17Admin,
  type InternationalShipment,
} from "../../lib/internationalTrackingApi";
import { updateExistingOrderStatus } from "../../supabaseAdminOps";
import type { Merchant, Order } from "../../types";
import AdminDriverAssignmentModal from "./AdminDriverAssignmentModal";
import AdminEmptyState from "./AdminEmptyState";
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
};

type TrackingCenterData = {
  ok: boolean;
  shipments?: InternationalShipment[];
};

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

function searchText(order: Order) {
  return normalized([
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
  ].join(" "));
}

function statusLabel(value: unknown, isArabic: boolean) {
  const key = normalizeOrderStatus(value as string | Order | null | undefined);
  const option = statusOptions.find(([status]) => status === key);
  return option ? option[isArabic ? 1 : 2] : (clean(value) || "—");
}

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} AED`;
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
        route: `${clean(order.sender_city) || "—"} → ${clean(order.receiver_city || order.destination_country) || "—"}`,
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
}: Props) {
  const [query, setQuery] = useState("");
  const [shipments, setShipments] = useState<InternationalShipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [notice, setNotice] = useState("");
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [statusBusy, setStatusBusy] = useState("");

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

  const visibleOrders = useMemo(() => {
    const needle = normalized(query);
    if (!needle) return internationalOrders;
    return internationalOrders.filter((order) => searchText(order).includes(needle));
  }, [internationalOrders, query]);

  const shipmentsByOrder = useMemo(() => {
    const map = new Map<string, InternationalShipment>();
    shipments.forEach((shipment) => {
      const orderId = clean(shipment.order_id);
      if (orderId && shipmentAwb(shipment)) map.set(orderId, shipment);
    });
    return map;
  }, [shipments]);

  const linkedCount = internationalOrders.filter((order) => shipmentsByOrder.has(clean(order.id))).length;
  const pdfPayload = useMemo(
    () => allOrdersPdfPayload(visibleOrders, shipmentsByOrder, isArabic),
    [isArabic, shipmentsByOrder, visibleOrders],
  );

  async function registered(shipment: InternationalShipment) {
    setShipments((current) => [shipment, ...current.filter((item) => item.id !== shipment.id)]);
    setNotice(isArabic
      ? "تم حفظ رقم التتبع. رابط الشحنة ورسائل واتساب ظهرت أسفل الطلبية."
      : "Tracking saved. The shipment link and WhatsApp actions are now shown below the order.");
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
        isArabic ? "تحديث من صفحة الطلبات الدولية" : "Updated from international orders",
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

  return (
    <section className="dn-intl-orders-workspace" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-intl-orders-hero">
        <div>
          <span className="dn-intl-orders-hero__icon"><Globe2 /></span>
          <div>
            <small>DAY NIGHT · ARAMEX · 17TRACK</small>
            <h1>{isArabic ? "الطلبات الدولية" : "International Orders"}</h1>
            <p>{isArabic
              ? "أضف رقم بوليصة أرامكس من داخل الطلب نفسه، ثم أرسل رابط التتبع للعميل أو التاجر وصدّر ملفات PDF."
              : "Add the Aramex AWB inside each order, then send the tracking link and export PDF reports."}</p>
          </div>
        </div>
        <div className="dn-intl-orders-hero__actions">
          <button type="button" onClick={() => { void onRefresh?.(); void refreshShipments(); }}>
            {loadingShipments ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {isArabic ? "تحديث" : "Refresh"}
          </button>
          <AdminPdfExportButton payload={pdfPayload} label={isArabic ? "PDF كل الطلبات" : "All orders PDF"} />
        </div>
      </header>

      <div className="dn-intl-orders-kpis">
        <article><strong>{internationalOrders.length}</strong><span>{isArabic ? "إجمالي الطلبات الدولية" : "International orders"}</span></article>
        <article><strong>{linkedCount}</strong><span>{isArabic ? "مربوطة برقم تتبع" : "AWB linked"}</span></article>
        <article><strong>{Math.max(0, internationalOrders.length - linkedCount)}</strong><span>{isArabic ? "بانتظار رقم التتبع" : "Awaiting AWB"}</span></article>
      </div>

      <div className="dn-intl-orders-search">
        <Search />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "بحث برقم الطلب أو التاجر أو العميل أو المدينة..." : "Search order, merchant, customer or city..."} />
      </div>

      {notice && <p className="dn-intl-orders-notice">{notice}</p>}

      <div className="dn-intl-orders-list">
        {visibleOrders.map((order) => {
          const key = clean(order.id || orderReference(order));
          const shipment = shipmentsByOrder.get(clean(order.id)) || null;
          const merchant = merchantForOrder(order, merchants);
          const financial = financialsFromOrder(order as Order & Record<string, unknown>);
          const draft = statusDrafts[key] || normalizeOrderStatus(order);
          const assigned = clean((order as Order & { assigned_driver_id?: string; driver_id?: string }).assigned_driver_id
            || (order as Order & { assigned_driver_id?: string; driver_id?: string }).driver_id
            || order.driver_name
            || order.driver_code);

          return (
            <article className="dn-intl-order-card" key={key}>
              <header>
                <div>
                  <small>{isArabic ? "رقم الطلب" : "Order reference"}</small>
                  <strong dir="ltr">{orderReference(order)}</strong>
                  <span>{statusLabel(order.status, isArabic)}</span>
                </div>
                <div className={shipment ? "is-linked" : "is-waiting"}>
                  {shipment ? <CheckCircle2 /> : <Globe2 />}
                  <span>{shipment ? (isArabic ? "التتبع جاهز" : "Tracking ready") : (isArabic ? "أضف رقم التتبع" : "Add AWB")}</span>
                </div>
              </header>

              <div className="dn-intl-order-card__facts">
                <div><small>{isArabic ? "التاجر" : "Merchant"}</small><b>{clean(order.merchant_name || order.sender_name) || "—"}</b><span dir="ltr">{clean(merchant?.phone || order.sender_phone) || "—"}</span></div>
                <div><small>{isArabic ? "العميل" : "Customer"}</small><b>{clean(order.receiver_name || order.customer_name) || "—"}</b><span dir="ltr">{clean(order.receiver_phone || order.customer_phone) || "—"}</span></div>
                <div><small>{isArabic ? "المسار" : "Route"}</small><b>{clean(order.sender_city) || "—"} → {clean(order.receiver_city || order.destination_country) || "—"}</b><span>{isArabic ? "شحن دولي" : "International shipment"}</span></div>
                <div><small>{isArabic ? "الحساب" : "Financials"}</small><b>{money(financial.customerTotal)}</b><span>{isArabic ? `التوصيل ${money(financial.deliveryFee)}` : `Delivery ${money(financial.deliveryFee)}`}</span></div>
              </div>

              <div className="dn-intl-order-card__management">
                <button type="button" onClick={() => setEditOrder(order)}><Pencil />{isArabic ? "تعديل" : "Edit"}</button>
                <button type="button" className="is-danger" onClick={() => setDeleteOrder(order)}><Trash2 />{isArabic ? "حذف" : "Delete"}</button>
                <button type="button" className="is-driver" onClick={() => setAssignOrder(order)}><Truck />{assigned ? (isArabic ? "إعادة تعيين" : "Reassign") : (isArabic ? "إرسال للمندوب" : "Assign driver")}</button>
                <div className="dn-intl-order-status">
                  <select value={draft} onChange={(event) => setStatusDrafts((current) => ({ ...current, [key]: event.target.value }))}>
                    {statusOptions.map(([value, ar, en]) => <option value={value} key={value}>{isArabic ? ar : en}</option>)}
                  </select>
                  <button type="button" onClick={() => void updateStatus(order)} disabled={statusBusy === key}>
                    {statusBusy === key ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{isArabic ? "تحديث الحالة" : "Update status"}
                  </button>
                </div>
              </div>

              <AdminInternationalOrderTrackingActions
                order={order}
                merchant={merchant}
                shipment={shipment}
                isArabic={isArabic}
                onRegistered={registered}
              />
            </article>
          );
        })}

        {!visibleOrders.length && (
          <AdminEmptyState
            icon="empty-state"
            title={isArabic ? "لا توجد طلبات دولية مطابقة" : "No matching international orders"}
            message={isArabic ? "امسح البحث أو أضف طلبًا دوليًا جديدًا." : "Clear the search or add a new international order."}
            action={<button type="button" onClick={() => setQuery("")}><RefreshCw />{isArabic ? "مسح البحث" : "Clear search"}</button>}
          />
        )}
      </div>

      <AdminOrderEditModal
        order={editOrder}
        merchants={merchants}
        isArabic={isArabic}
        open={Boolean(editOrder)}
        onClose={() => setEditOrder(null)}
        onSaved={async () => { setEditOrder(null); setNotice(isArabic ? "تم حفظ الطلب." : "Order saved."); await onRefresh?.(); }}
      />
      <AdminOrderDeleteModal
        order={deleteOrder}
        isArabic={isArabic}
        open={Boolean(deleteOrder)}
        onClose={() => setDeleteOrder(null)}
        onDeleted={async () => { setDeleteOrder(null); setNotice(isArabic ? "تم حذف الطلب." : "Order deleted."); await onRefresh?.(); }}
      />
      <AdminDriverAssignmentModal
        order={assignOrder}
        isArabic={isArabic}
        open={Boolean(assignOrder)}
        onClose={() => setAssignOrder(null)}
        onSaved={async () => { setAssignOrder(null); setNotice(isArabic ? "تم إرسال الطلب للمندوب." : "Order assigned."); await onRefresh?.(); }}
      />
    </section>
  );
}
