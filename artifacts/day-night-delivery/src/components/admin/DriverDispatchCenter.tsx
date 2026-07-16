import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  Clock3,
  Crosshair,
  History,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Truck,
  Unlink,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { AdminDriverRow } from "../../hooks/useAdminDrivers";
import {
  dispatchErrorMessage,
  dispatchOrder,
} from "../../lib/driverData";
import type {
  DriverAssignmentHistory,
  DriverOrder,
} from "../../types/driver";
import "../../styles/dn-order-dispatch.css";

type Props = {
  isArabic: boolean;
  drivers: AdminDriverRow[];
  orders: DriverOrder[];
  history: DriverAssignmentHistory[];
  selectedDriverId: string | null;
  onSelectDriver: (driverId: string) => void;
  onChanged: () => Promise<void> | void;
};

type QueueFilter = "unassigned" | "assigned" | "in_progress" | "all";

const IN_PROGRESS = new Set(["accepted", "picked_up", "in_transit"]);

const statusKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const tracking = (order: DriverOrder) =>
  order.tracking_number ||
  order.tracking_code ||
  order.invoice_number ||
  order.coupon_number ||
  order.id;

const currentDriverId = (order: DriverOrder) =>
  order.assigned_driver_id || order.driver_id || null;

const orderSearchText = (order: DriverOrder) =>
  [
    tracking(order),
    order.merchant_name,
    order.sender_name,
    order.sender_phone,
    order.sender_city,
    order.sender_address,
    order.receiver_name,
    order.receiver_phone,
    order.receiver_city,
    order.receiver_address,
    order.customer_name,
    order.customer_phone,
    order.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function orderTarget(order: DriverOrder): { lat: number; lng: number } | null {
  const candidates: Array<[unknown, unknown]> = [
    [order.pickup_lat, order.pickup_lng],
    [order.sender_lat, order.sender_lng],
    [order.receiver_lat, order.receiver_lng],
    [order.delivery_lat, order.delivery_lng],
  ];
  for (const [rawLat, rawLng] of candidates) {
    const lat = num(rawLat);
    const lng = num(rawLng);
    if (lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

function distanceKm(
  from: { lat: number; lng: number } | null,
  to: { lat: number; lng: number } | null,
) {
  if (!from || !to) return null;
  const radians = (value: number) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function presenceRank(driver: AdminDriverRow) {
  if (driver.presence === "online") return 0;
  if (driver.presence === "idle") return 1;
  if (driver.presence === "offline") return 3;
  return 4;
}

function shiftRank(driver: AdminDriverRow) {
  const status = String(driver.shift_status || "offline");
  if (status === "available") return 0;
  if (status === "busy") return 1;
  if (status === "paused") return 2;
  return 3;
}

function statusLabel(status: string, isArabic: boolean) {
  const labels: Record<string, [string, string]> = {
    pending: ["قيد الانتظار", "Pending"],
    review: ["قيد المراجعة", "Review"],
    confirmed: ["مؤكد", "Confirmed"],
    assigned: ["تم إسناد مندوب", "Assigned"],
    accepted: ["قبله المندوب", "Accepted"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    postponed: ["مؤجل", "Postponed"],
  };
  return labels[statusKey(status)]?.[isArabic ? 0 : 1] || status;
}

function actionLabel(action: string, isArabic: boolean) {
  const labels: Record<string, [string, string]> = {
    assigned: ["تعيين", "Assigned"],
    reassigned: ["إعادة تعيين", "Reassigned"],
    unassigned: ["إلغاء الإسناد", "Unassigned"],
  };
  return labels[action]?.[isArabic ? 0 : 1] || action;
}

export default function DriverDispatchCenter({
  isArabic,
  drivers,
  orders,
  history,
  selectedDriverId,
  onSelectDriver,
  onChanged,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("unassigned");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [candidateDriverId, setCandidateDriverId] = useState<string | null>(selectedDriverId);
  const [note, setNote] = useState("");
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const queue = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders
      .filter((order) => {
        const assigned = Boolean(currentDriverId(order));
        const inProgress = IN_PROGRESS.has(statusKey(order.status));
        const matchesFilter =
          filter === "all" ||
          (filter === "unassigned" && !assigned) ||
          (filter === "assigned" && assigned) ||
          (filter === "in_progress" && inProgress);
        return matchesFilter && (!normalized || orderSearchText(order).includes(normalized));
      })
      .sort((a, b) => {
        const aPriority = String(a.priority || "").toLowerCase() === "urgent" ? 1 : 0;
        const bPriority = String(b.priority || "").toLowerCase() === "urgent" ? 1 : 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [filter, orders, query]);

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) || queue[0] || null;
  const assignedDriverId = selectedOrder ? currentDriverId(selectedOrder) : null;
  const assignedDriver = drivers.find((driver) => driver.id === assignedDriverId) || null;
  const target = selectedOrder ? orderTarget(selectedOrder) : null;
  const inProgress = selectedOrder ? IN_PROGRESS.has(statusKey(selectedOrder.status)) : false;

  const candidates = useMemo(() => {
    return drivers
      .filter((driver) => String(driver.status || "active") === "active")
      .map((driver) => {
        const distance = distanceKm(
          driver.location ? { lat: driver.location.lat, lng: driver.location.lng } : null,
          target,
        );
        return { driver, distance };
      })
      .sort((a, b) => {
        const presence = presenceRank(a.driver) - presenceRank(b.driver);
        if (presence) return presence;
        const shift = shiftRank(a.driver) - shiftRank(b.driver);
        if (shift) return shift;
        if (a.distance != null && b.distance != null && a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        if (a.distance != null && b.distance == null) return -1;
        if (a.distance == null && b.distance != null) return 1;
        return a.driver.active_orders - b.driver.active_orders;
      });
  }, [drivers, target]);

  const chosenDriver = drivers.find((driver) => driver.id === candidateDriverId) || null;
  const isReassignment = Boolean(assignedDriverId && candidateDriverId && assignedDriverId !== candidateDriverId);
  const sameDriver = Boolean(assignedDriverId && assignedDriverId === candidateDriverId);
  const selectedHistory = selectedOrder
    ? history.filter((entry) => entry.order_id === selectedOrder.id).slice(0, 15)
    : [];

  useEffect(() => {
    if (!selectedOrderId && queue[0]) setSelectedOrderId(queue[0].id);
    if (selectedOrderId && !orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(queue[0]?.id || null);
    }
  }, [orders, queue, selectedOrderId]);

  useEffect(() => {
    if (selectedDriverId) setCandidateDriverId(selectedDriverId);
  }, [selectedDriverId]);

  useEffect(() => {
    setNote("");
    setForce(false);
    setMessage("");
    setError("");
  }, [selectedOrder?.id]);

  async function executeAssignment() {
    if (!selectedOrder || !chosenDriver || sameDriver) return;
    if (isReassignment && !note.trim()) {
      setError(isArabic ? "اكتب سبب إعادة تعيين الطلب." : "Enter a reassignment reason.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await dispatchOrder({
        orderId: selectedOrder.id,
        driverId: chosenDriver.id,
        action: isReassignment ? "reassign" : "assign",
        note: note.trim() || null,
        force,
      });
      setMessage(
        isArabic
          ? `${result.action === "reassigned" ? "تم نقل" : "تم تعيين"} الطلب ${tracking(selectedOrder)} إلى ${chosenDriver.full_name || chosenDriver.name}.`
          : `${tracking(selectedOrder)} was ${result.action} to ${chosenDriver.full_name || chosenDriver.name}.`,
      );
      onSelectDriver(chosenDriver.id);
      setNote("");
      setForce(false);
      window.dispatchEvent(
        new CustomEvent("dn-admin-order-assignment-change", {
          detail: { orderId: selectedOrder.id, driverId: chosenDriver.id, action: result.action },
        }),
      );
      await onChanged();
    } catch (dispatchError) {
      setError(dispatchErrorMessage(dispatchError, isArabic));
    } finally {
      setBusy(false);
    }
  }

  async function executeUnassign() {
    if (!selectedOrder || !assignedDriverId) return;
    if (!note.trim()) {
      setError(isArabic ? "اكتب سبب إلغاء الإسناد." : "Enter an unassignment reason.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await dispatchOrder({
        orderId: selectedOrder.id,
        action: "unassign",
        note: note.trim(),
        force,
      });
      setMessage(
        isArabic
          ? `تم إلغاء إسناد الطلب ${tracking(selectedOrder)} وإعادته للطابور.`
          : `${tracking(selectedOrder)} was returned to the dispatch queue.`,
      );
      setNote("");
      setForce(false);
      window.dispatchEvent(
        new CustomEvent("dn-admin-order-assignment-change", {
          detail: { orderId: selectedOrder.id, driverId: null, action: "unassigned" },
        }),
      );
      await onChanged();
    } catch (dispatchError) {
      setError(dispatchErrorMessage(dispatchError, isArabic));
    } finally {
      setBusy(false);
    }
  }

  const unassignedCount = orders.filter((order) => !currentDriverId(order)).length;
  const assignedCount = orders.length - unassignedCount;
  const inProgressCount = orders.filter((order) => IN_PROGRESS.has(statusKey(order.status))).length;

  return (
    <section className="dn-dispatch-center">
      <header className="dn-dispatch-header">
        <div>
          <span><ArrowLeftRight /> {isArabic ? "مركز إسناد الطلبات الحقيقي" : "Real Order Dispatch Center"}</span>
          <h2>{isArabic ? "اختر الطلب ثم المندوب" : "Select an order, then a driver"}</h2>
          <p>
            {isArabic
              ? "الطلبات هنا من جدول orders الفعلي. كل تعيين أو نقل أو إلغاء يُسجل في قاعدة البيانات ويظهر للمندوب فورًا."
              : "These are real rows from orders. Every assignment, transfer and removal is recorded and appears in the driver app immediately."}
          </p>
        </div>
        <button type="button" onClick={() => void onChanged()}><RefreshCw /> {isArabic ? "تحديث الطابور" : "Refresh queue"}</button>
      </header>

      <div className="dn-dispatch-kpis">
        <article><PackageCheck /><small>{isArabic ? "قابلة للتوزيع" : "Dispatchable"}</small><strong>{orders.length}</strong></article>
        <article className={unassignedCount ? "is-warning" : ""}><Unlink /><small>{isArabic ? "بدون مندوب" : "Unassigned"}</small><strong>{unassignedCount}</strong></article>
        <article><Truck /><small>{isArabic ? "مسندة" : "Assigned"}</small><strong>{assignedCount}</strong></article>
        <article><Navigation /><small>{isArabic ? "قيد التنفيذ" : "In progress"}</small><strong>{inProgressCount}</strong></article>
      </div>

      <div className="dn-dispatch-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "بحث برقم التتبع، العميل، الهاتف، المدينة أو التاجر..." : "Search tracking, customer, phone, city or merchant..."} /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value as QueueFilter)}>
          <option value="unassigned">{isArabic ? "طلبات بدون مندوب" : "Unassigned orders"}</option>
          <option value="assigned">{isArabic ? "طلبات مسندة" : "Assigned orders"}</option>
          <option value="in_progress">{isArabic ? "طلبات قيد التنفيذ" : "In-progress orders"}</option>
          <option value="all">{isArabic ? "كل الطلبات المفتوحة" : "All open orders"}</option>
        </select>
        <span>{queue.length} {isArabic ? "طلب ظاهر" : "visible"}</span>
      </div>

      {message && <div className="dn-dispatch-message is-success">{message}</div>}
      {error && <div className="dn-dispatch-message is-error">{error}</div>}

      <div className="dn-dispatch-layout">
        <aside className="dn-dispatch-orders">
          {queue.length === 0 && <div className="dn-dispatch-empty"><CheckCircle2 /><strong>{isArabic ? "لا توجد طلبات مطابقة" : "No matching orders"}</strong></div>}
          {queue.slice(0, 120).map((order) => {
            const driverId = currentDriverId(order);
            const driver = drivers.find((item) => item.id === driverId);
            const selected = selectedOrder?.id === order.id;
            return (
              <button type="button" key={order.id} className={selected ? "is-selected" : ""} onClick={() => setSelectedOrderId(order.id)}>
                <span className={`dn-dispatch-order-state ${driverId ? "is-assigned" : "is-unassigned"}`}>{driverId ? <Truck /> : <Unlink />}</span>
                <div>
                  <strong>{tracking(order)}</strong>
                  <small>{order.receiver_name || order.customer_name || "—"} · {order.receiver_city || "—"}</small>
                  <em>{driver ? driver.full_name || driver.name : isArabic ? "بدون مندوب" : "Unassigned"}</em>
                </div>
                <section><b>{statusLabel(order.status, isArabic)}</b><span>{Number(order.cod_amount || 0).toFixed(2)} AED</span></section>
              </button>
            );
          })}
        </aside>

        <main className="dn-dispatch-order-detail">
          {!selectedOrder && <div className="dn-dispatch-empty"><Route /><strong>{isArabic ? "اختر طلبًا من الطابور" : "Select an order from the queue"}</strong></div>}
          {selectedOrder && (
            <>
              <header>
                <div><small>{isArabic ? "الطلب المحدد" : "Selected order"}</small><h3>{tracking(selectedOrder)}</h3><p>{selectedOrder.merchant_name || selectedOrder.sender_name || "—"}</p></div>
                <span>{statusLabel(selectedOrder.status, isArabic)}</span>
              </header>

              <div className="dn-dispatch-route">
                <article><MapPin /><div><small>{isArabic ? "الاستلام" : "Pickup"}</small><strong>{[selectedOrder.sender_city, selectedOrder.sender_address].filter(Boolean).join("، ") || "—"}</strong></div></article>
                <article><Navigation /><div><small>{isArabic ? "التسليم" : "Drop-off"}</small><strong>{[selectedOrder.receiver_city, selectedOrder.receiver_address].filter(Boolean).join("، ") || "—"}</strong></div></article>
              </div>

              <div className="dn-dispatch-order-meta">
                <span><Banknote /> {Number(selectedOrder.cod_amount || 0).toFixed(2)} AED COD</span>
                <span><Clock3 /> {new Date(selectedOrder.created_at).toLocaleString(isArabic ? "ar-AE" : "en-AE")}</span>
                <span><Phone /> {selectedOrder.receiver_phone || selectedOrder.customer_phone || "—"}</span>
                {target && <span><Crosshair /> {target.lat.toFixed(5)}, {target.lng.toFixed(5)}</span>}
              </div>

              <section className="dn-dispatch-current-driver">
                <div>
                  <small>{isArabic ? "المندوب الحالي" : "Current driver"}</small>
                  {assignedDriver ? (
                    <section><span>{assignedDriver.avatar_url ? <img src={assignedDriver.avatar_url} alt={assignedDriver.full_name || "Driver"} /> : <UserRound />}</span><div><strong>{assignedDriver.full_name || assignedDriver.name}</strong><p>{assignedDriver.vehicle_type || "—"} · {assignedDriver.vehicle_plate || "—"}</p></div></section>
                  ) : <strong>{isArabic ? "لم يتم تعيين مندوب" : "No driver assigned"}</strong>}
                </div>
                {assignedDriver && <button type="button" onClick={() => onSelectDriver(assignedDriver.id)}>{isArabic ? "فتح المندوب" : "Open driver"}</button>}
              </section>

              <label className="dn-dispatch-note">
                <span>{isArabic ? "تعليمات التوزيع / سبب النقل أو الإلغاء" : "Dispatch instructions / transfer or removal reason"}</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder={isArabic ? "مثال: استلام من التاجر الساعة 4، التواصل قبل الوصول..." : "Example: pickup at 4 PM, call before arrival..."} />
              </label>

              {inProgress && (
                <label className="dn-dispatch-force">
                  <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
                  <span><ShieldAlert /> {isArabic ? "نقل/إلغاء اضطراري لطلب بدأ تنفيذه — سيتم تسجيله وإظهاره للمراجعة." : "Forced transfer/removal for an in-progress order — fully audited and returned to review when unassigned."}</span>
                </label>
              )}

              <div className="dn-dispatch-actions">
                <button type="button" disabled={busy || !assignedDriverId} className="is-danger" onClick={() => void executeUnassign()}><Unlink /> {busy ? (isArabic ? "جارٍ التنفيذ..." : "Working...") : isArabic ? "إلغاء الإسناد" : "Unassign"}</button>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([selectedOrder.receiver_city, selectedOrder.receiver_address].filter(Boolean).join(", "))}`} target="_blank" rel="noreferrer"><Navigation /> {isArabic ? "فتح وجهة التسليم" : "Open drop-off"}</a>
              </div>

              <section className="dn-dispatch-history">
                <header><History /><div><small>{isArabic ? "سجل الإسناد" : "Assignment history"}</small><strong>{selectedHistory.length}</strong></div></header>
                {selectedHistory.length === 0 && <p>{isArabic ? "لم تُسجل عمليات إسناد لهذا الطلب بعد." : "No assignment operations recorded for this order yet."}</p>}
                {selectedHistory.map((entry) => (
                  <article key={entry.id}><i /><div><strong>{actionLabel(entry.action, isArabic)}</strong><small>{new Date(entry.created_at).toLocaleString(isArabic ? "ar-AE" : "en-AE")}</small>{entry.note && <p>{entry.note}</p>}</div></article>
                ))}
              </section>
            </>
          )}
        </main>

        <aside className="dn-dispatch-candidates">
          <header><div><small>{isArabic ? "المندوبون المرشحون" : "Driver candidates"}</small><h3>{isArabic ? "اختيار مبني على الحالة والحمل والموقع الحقيقي" : "Ranked by real presence, workload and GPS"}</h3></div><Truck /></header>
          {candidates.length === 0 && <div className="dn-dispatch-empty"><WifiOff /><strong>{isArabic ? "لا يوجد مندوب نشط" : "No active drivers"}</strong></div>}
          {candidates.map(({ driver, distance }, index) => {
            const selected = candidateDriverId === driver.id;
            const current = assignedDriverId === driver.id;
            return (
              <button type="button" key={driver.id} className={`${selected ? "is-selected" : ""} ${current ? "is-current" : ""}`} onClick={() => { setCandidateDriverId(driver.id); onSelectDriver(driver.id); }}>
                <span>{driver.avatar_url ? <img src={driver.avatar_url} alt={driver.full_name || "Driver"} /> : <UserRound />}</span>
                <div><strong>{driver.full_name || driver.name || driver.id}</strong><small>{driver.vehicle_type || "—"} · {driver.vehicle_plate || "—"}</small><em>{driver.active_orders} {isArabic ? "طلب نشط" : "active"}{distance != null ? ` · ${distance.toFixed(1)} km` : ""}</em></div>
                <section><b className={`is-${driver.presence}`}>{driver.presence === "online" ? <Wifi /> : <WifiOff />} {driver.presence}</b>{index === 0 && !current && <small>{isArabic ? "أفضل ترشيح متاح" : "Best available"}</small>}{current && <small>{isArabic ? "الحالي" : "Current"}</small>}</section>
              </button>
            );
          })}
          <button type="button" className="dn-dispatch-submit" disabled={busy || !selectedOrder || !chosenDriver || sameDriver} onClick={() => void executeAssignment()}>
            <ArrowLeftRight />
            {busy
              ? isArabic ? "جارٍ الحفظ..." : "Saving..."
              : sameDriver
                ? isArabic ? "المندوب معين بالفعل" : "Already assigned"
                : isReassignment
                  ? isArabic ? "نقل الطلب للمندوب المحدد" : "Transfer to selected driver"
                  : isArabic ? "تعيين المندوب للطلب" : "Assign selected driver"}
          </button>
        </aside>
      </div>
    </section>
  );
}
