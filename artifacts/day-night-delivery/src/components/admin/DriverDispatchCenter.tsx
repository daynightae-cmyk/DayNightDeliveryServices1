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
  dispatchOrderRuntime,
  dispatchRuntimeErrorMessage,
  fetchDispatchCandidates,
  fetchDispatchRuntimeHealth,
  type DispatchRuntimeHealth,
} from "../../lib/driverDispatchRuntime";
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

type RankedDriver = {
  driver: AdminDriverRow;
  distance: number | null;
  runtimeOnline: boolean;
  runtimeLoad: number;
  current: boolean;
};

const IN_PROGRESS = new Set(["accepted", "picked_up", "in_transit"]);
const CLOSED = new Set(["delivered", "cancelled", "returned"]);

const statusKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

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

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function orderTarget(order: DriverOrder): { lat: number; lng: number } | null {
  const values: Array<[unknown, unknown]> = [
    [order.pickup_lat, order.pickup_lng],
    [order.sender_lat, order.sender_lng],
    [order.receiver_lat, order.receiver_lng],
    [order.delivery_lat, order.delivery_lng],
  ];
  for (const [rawLat, rawLng] of values) {
    const lat = numberOrNull(rawLat);
    const lng = numberOrNull(rawLng);
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
  const earthRadiusKm = 6371;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function statusLabel(status: unknown, isArabic: boolean) {
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
  const key = statusKey(status);
  return labels[key]?.[isArabic ? 0 : 1] || String(status || "—");
}

function actionLabel(action: string, isArabic: boolean) {
  const labels: Record<string, [string, string]> = {
    assigned: ["تعيين", "Assigned"],
    reassigned: ["إعادة تعيين", "Reassigned"],
    unassigned: ["إلغاء الإسناد", "Unassigned"],
  };
  return labels[action]?.[isArabic ? 0 : 1] || action;
}

function presenceRank(driver: AdminDriverRow, runtimeOnline: boolean) {
  if (runtimeOnline || driver.presence === "online") return 0;
  if (driver.presence === "idle") return 1;
  return 2;
}

function shiftRank(driver: AdminDriverRow) {
  const value = String(driver.shift_status || "offline");
  if (value === "available") return 0;
  if (value === "busy") return 1;
  if (value === "paused") return 2;
  return 3;
}

function healthMissing(health: DispatchRuntimeHealth | null) {
  if (!health || health.ok) return [];
  return Object.entries(health)
    .filter(([key, value]) => key !== "ok" && value === false)
    .map(([key]) => key.replace(/_/g, " "));
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
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [runtimeWarning, setRuntimeWarning] = useState("");
  const [health, setHealth] = useState<DispatchRuntimeHealth | null>(null);
  const [runtimeRows, setRuntimeRows] = useState<Array<{
    id: string;
    active_orders?: number;
    is_online?: boolean;
    last_seen_at?: string | null;
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
    current_order_id?: string | null;
    is_current_driver?: boolean;
  }>>([]);

  const openOrders = useMemo(
    () => orders.filter((order) => !CLOSED.has(statusKey(order.status))),
    [orders],
  );

  const queue = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return openOrders
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
        const aUrgent = statusKey(a.priority) === "urgent" ? 1 : 0;
        const bUrgent = statusKey(b.priority) === "urgent" ? 1 : 0;
        if (aUrgent !== bUrgent) return bUrgent - aUrgent;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });
  }, [filter, openOrders, query]);

  const selectedOrder =
    openOrders.find((order) => order.id === selectedOrderId) || queue[0] || null;
  const assignedDriverId = selectedOrder ? currentDriverId(selectedOrder) : null;
  const assignedDriver = drivers.find((driver) => driver.id === assignedDriverId) || null;
  const target = selectedOrder ? orderTarget(selectedOrder) : null;
  const inProgress = selectedOrder ? IN_PROGRESS.has(statusKey(selectedOrder.status)) : false;

  const candidates = useMemo<RankedDriver[]>(() => {
    const runtimeMap = new Map(runtimeRows.map((row) => [row.id, row]));
    return drivers
      .filter((driver) => String(driver.status || "active") === "active")
      .map((driver) => {
        const runtime = runtimeMap.get(driver.id);
        const location = runtime && Number.isFinite(Number(runtime.lat)) && Number.isFinite(Number(runtime.lng))
          ? { lat: Number(runtime.lat), lng: Number(runtime.lng) }
          : driver.location
            ? { lat: driver.location.lat, lng: driver.location.lng }
            : null;
        return {
          driver,
          distance: distanceKm(location, target),
          runtimeOnline: Boolean(runtime?.is_online),
          runtimeLoad: Number(runtime?.active_orders ?? driver.active_orders ?? 0),
          current: Boolean(runtime?.is_current_driver || assignedDriverId === driver.id),
        };
      })
      .sort((a, b) => {
        const presence = presenceRank(a.driver, a.runtimeOnline) - presenceRank(b.driver, b.runtimeOnline);
        if (presence) return presence;
        const shift = shiftRank(a.driver) - shiftRank(b.driver);
        if (shift) return shift;
        if (a.distance != null && b.distance != null && a.distance !== b.distance) return a.distance - b.distance;
        if (a.distance != null && b.distance == null) return -1;
        if (a.distance == null && b.distance != null) return 1;
        return a.runtimeLoad - b.runtimeLoad;
      });
  }, [assignedDriverId, drivers, runtimeRows, target]);

  const chosenDriver = drivers.find((driver) => driver.id === candidateDriverId) || null;
  const isReassignment = Boolean(
    assignedDriverId && candidateDriverId && assignedDriverId !== candidateDriverId,
  );
  const sameDriver = Boolean(assignedDriverId && assignedDriverId === candidateDriverId);
  const selectedHistory = selectedOrder
    ? history.filter((entry) => entry.order_id === selectedOrder.id).slice(0, 20)
    : [];

  async function loadRuntime(orderId?: string | null) {
    setRuntimeBusy(true);
    setRuntimeWarning("");
    const [healthResult, candidatesResult] = await Promise.allSettled([
      fetchDispatchRuntimeHealth(),
      fetchDispatchCandidates(orderId),
    ]);

    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    else setHealth({ ok: false, runtime_rpc: false });

    if (candidatesResult.status === "fulfilled") {
      setRuntimeRows(candidatesResult.value);
    } else {
      setRuntimeRows([]);
      setRuntimeWarning(
        isArabic
          ? "تعذر تحميل ترتيب الخادم؛ يتم استخدام بيانات المندوبين الحقيقية الموجودة في اللوحة لحين تحديث Supabase API."
          : "Server ranking is unavailable; the dashboard is using its current real driver data until Supabase API refreshes.",
      );
    }
    setRuntimeBusy(false);
  }

  useEffect(() => {
    if (!selectedOrderId && queue[0]) setSelectedOrderId(queue[0].id);
    if (selectedOrderId && !openOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(queue[0]?.id || null);
    }
  }, [openOrders, queue, selectedOrderId]);

  useEffect(() => {
    if (selectedDriverId && !candidateDriverId) setCandidateDriverId(selectedDriverId);
  }, [candidateDriverId, selectedDriverId]);

  useEffect(() => {
    setNote("");
    setForce(false);
    setMessage("");
    setError("");
    void loadRuntime(selectedOrder?.id || null);
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
      const result = await dispatchOrderRuntime({
        orderId: selectedOrder.id,
        driverId: chosenDriver.id,
        action: isReassignment ? "reassign" : "assign",
        note: note.trim() || null,
        force,
      });
      setMessage(
        isArabic
          ? `${result.action === "reassigned" ? "تم نقل" : "تم تعيين"} الطلب ${tracking(selectedOrder)} إلى ${chosenDriver.full_name || chosenDriver.name || chosenDriver.id}.`
          : `${tracking(selectedOrder)} was ${result.action} to ${chosenDriver.full_name || chosenDriver.name || chosenDriver.id}.`,
      );
      onSelectDriver(chosenDriver.id);
      setNote("");
      setForce(false);
      window.dispatchEvent(
        new CustomEvent("dn-admin-order-assignment-change", {
          detail: { orderId: selectedOrder.id, driverId: chosenDriver.id, action: result.action },
        }),
      );
      window.dispatchEvent(new CustomEvent("dn-admin-orders-updated"));
      await onChanged();
      await loadRuntime(selectedOrder.id);
    } catch (assignmentError) {
      setError(dispatchRuntimeErrorMessage(assignmentError, isArabic));
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
      await dispatchOrderRuntime({
        orderId: selectedOrder.id,
        action: "unassign",
        note: note.trim(),
        force,
      });
      setMessage(
        isArabic
          ? `تم إلغاء إسناد الطلب ${tracking(selectedOrder)} وإعادته إلى طابور التوزيع.`
          : `${tracking(selectedOrder)} was returned to the dispatch queue.`,
      );
      setNote("");
      setForce(false);
      window.dispatchEvent(
        new CustomEvent("dn-admin-order-assignment-change", {
          detail: { orderId: selectedOrder.id, driverId: null, action: "unassigned" },
        }),
      );
      window.dispatchEvent(new CustomEvent("dn-admin-orders-updated"));
      await onChanged();
      await loadRuntime(selectedOrder.id);
    } catch (unassignError) {
      setError(dispatchRuntimeErrorMessage(unassignError, isArabic));
    } finally {
      setBusy(false);
    }
  }

  const unassignedCount = openOrders.filter((order) => !currentDriverId(order)).length;
  const assignedCount = openOrders.length - unassignedCount;
  const inProgressCount = openOrders.filter((order) => IN_PROGRESS.has(statusKey(order.status))).length;
  const missingHealth = healthMissing(health);

  return (
    <section className="dn-dispatch-center">
      <header className="dn-dispatch-header">
        <div>
          <span><ArrowLeftRight /> {isArabic ? "مركز إسناد الطلبات الحقيقي" : "Real Order Dispatch Center"}</span>
          <h2>{isArabic ? "اختر الطلب ثم المندوب" : "Select an order, then a driver"}</h2>
          <p>
            {isArabic
              ? "كل طلب هنا صف فعلي من orders، وكل تعيين أو نقل أو إلغاء عملية ذرية ومسجلة وتظهر للمندوب عبر Realtime."
              : "Every order is a real orders row. Assignment, transfer and removal are atomic, audited and delivered to the driver through Realtime."}
          </p>
        </div>
        <button type="button" onClick={() => { void onChanged(); void loadRuntime(selectedOrder?.id || null); }}>
          <RefreshCw className={runtimeBusy ? "animate-spin" : ""} /> {isArabic ? "تحديث الطابور والخدمة" : "Refresh queue & service"}
        </button>
      </header>

      <div className="dn-dispatch-kpis">
        <article><PackageCheck /><small>{isArabic ? "قابلة للتوزيع" : "Dispatchable"}</small><strong>{openOrders.length}</strong></article>
        <article className={unassignedCount ? "is-warning" : ""}><Unlink /><small>{isArabic ? "بدون مندوب" : "Unassigned"}</small><strong>{unassignedCount}</strong></article>
        <article><Truck /><small>{isArabic ? "مسندة" : "Assigned"}</small><strong>{assignedCount}</strong></article>
        <article><Navigation /><small>{isArabic ? "قيد التنفيذ" : "In progress"}</small><strong>{inProgressCount}</strong></article>
      </div>

      {health && !health.ok && (
        <div className="dn-dispatch-message is-error">
          <AlertTriangle />
          <span>
            {isArabic
              ? `خدمة التوزيع غير مكتملة: ${missingHealth.join("، ") || "فحص التشغيل لم ينجح"}.`
              : `Dispatch runtime is incomplete: ${missingHealth.join(", ") || "health check failed"}.`}
          </span>
        </div>
      )}
      {runtimeWarning && <div className="dn-dispatch-message"><AlertTriangle /> {runtimeWarning}</div>}

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

      {message && <div className="dn-dispatch-message is-success"><CheckCircle2 /> {message}</div>}
      {error && <div className="dn-dispatch-message is-error"><AlertTriangle /> {error}</div>}

      <div className="dn-dispatch-layout">
        <aside className="dn-dispatch-orders">
          {queue.length === 0 && <div className="dn-dispatch-empty"><CheckCircle2 /><strong>{isArabic ? "لا توجد طلبات مطابقة" : "No matching orders"}</strong></div>}
          {queue.slice(0, 200).map((order) => {
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
                <span><Clock3 /> {new Date(selectedOrder.created_at || Date.now()).toLocaleString(isArabic ? "ar-AE" : "en-AE")}</span>
                <span><Phone /> {selectedOrder.receiver_phone || selectedOrder.customer_phone || "—"}</span>
                {target && <span><Crosshair /> {target.lat.toFixed(6)}, {target.lng.toFixed(6)}</span>}
              </div>

              <section className="dn-dispatch-current-driver">
                <div>
                  <small>{isArabic ? "المندوب الحالي" : "Current driver"}</small>
                  {assignedDriver ? (
                    <section><span>{assignedDriver.avatar_url ? <img src={assignedDriver.avatar_url} alt={assignedDriver.full_name || "Driver"} /> : <UserRound />}</span><div><strong>{assignedDriver.full_name || assignedDriver.name}</strong><p>{assignedDriver.vehicle_type || "—"} · {assignedDriver.vehicle_plate || "—"}</p></div></section>
                  ) : <strong>{isArabic ? "لم يتم تعيين مندوب" : "No driver assigned"}</strong>}
                </div>
                {assignedDriver && <button type="button" onClick={() => onSelectDriver(assignedDriver.id)}>{isArabic ? "فتح ملف المندوب" : "Open driver"}</button>}
              </section>

              <label className="dn-dispatch-note">
                <span>{isArabic ? "تعليمات التوزيع / سبب النقل أو الإلغاء" : "Dispatch instructions / transfer or removal reason"}</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder={isArabic ? "مثال: استلام من التاجر الساعة 4، التواصل قبل الوصول..." : "Example: pickup at 4 PM, call before arrival..."} />
              </label>

              {inProgress && (
                <label className="dn-dispatch-force">
                  <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
                  <span><ShieldAlert /> {isArabic ? "إجراء اضطراري لطلب بدأ تنفيذه — العملية ستُسجل بالكامل." : "Emergency action for an in-progress order — the operation is fully audited."}</span>
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
          <header><div><small>{isArabic ? "المندوبون المرشحون" : "Driver candidates"}</small><h3>{isArabic ? "حالة الحساب والوردية والحمل والموقع الحقيقي" : "Real account, shift, workload and GPS ranking"}</h3></div><Truck /></header>
          {candidates.length === 0 && <div className="dn-dispatch-empty"><WifiOff /><strong>{isArabic ? "لا يوجد مندوب نشط" : "No active drivers"}</strong></div>}
          {candidates.map(({ driver, distance, runtimeOnline, runtimeLoad, current }, index) => {
            const selected = candidateDriverId === driver.id;
            return (
              <button type="button" key={driver.id} className={`${selected ? "is-selected" : ""} ${current ? "is-current" : ""}`} onClick={() => { setCandidateDriverId(driver.id); onSelectDriver(driver.id); }}>
                <span>{driver.avatar_url ? <img src={driver.avatar_url} alt={driver.full_name || "Driver"} /> : <UserRound />}</span>
                <div><strong>{driver.full_name || driver.name || driver.id}</strong><small>{driver.vehicle_type || "—"} · {driver.vehicle_plate || "—"}</small><em>{runtimeLoad} {isArabic ? "طلب نشط" : "active"}{distance != null ? ` · ${distance.toFixed(1)} km` : ""}</em></div>
                <section><b className={`is-${runtimeOnline ? "online" : driver.presence}`}>{runtimeOnline || driver.presence === "online" ? <Wifi /> : <WifiOff />} {runtimeOnline ? "online" : driver.presence}</b>{index === 0 && !current && <small>{isArabic ? "أفضل ترشيح متاح" : "Best available"}</small>}{current && <small>{isArabic ? "المندوب الحالي" : "Current"}</small>}</section>
              </button>
            );
          })}
          <button type="button" className="dn-dispatch-submit" disabled={busy || !selectedOrder || !chosenDriver || sameDriver || Boolean(health && !health.ok)} onClick={() => void executeAssignment()}>
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
