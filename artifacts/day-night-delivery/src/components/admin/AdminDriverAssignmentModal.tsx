import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, Radio, Truck, Wifi, WifiOff, X } from "lucide-react";
import type { Order } from "../../types";
import {
  dispatchOrderRuntime,
  dispatchRuntimeErrorMessage,
  fetchDispatchCandidates,
  type DispatchCandidate,
} from "../../lib/driverDispatchRuntime";

type Props = {
  order: Order | null;
  isArabic: boolean;
  open: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

const orderRef = (order: Order) =>
  order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";

const assignedDriverId = (order: Order) => {
  const row = order as Order & { assigned_driver_id?: string | null; driver_id?: string | null };
  return row.assigned_driver_id || row.driver_id || null;
};

export default function AdminDriverAssignmentModal({
  order,
  isArabic,
  open,
  onClose,
  onSaved,
}: Props) {
  const [drivers, setDrivers] = useState<DispatchCandidate[]>([]);
  const [driverId, setDriverId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const currentDriverId = order ? assignedDriverId(order) : null;
  const isReassignment = Boolean(currentDriverId && driverId && currentDriverId !== driverId);

  useEffect(() => {
    if (!open || !order) return;
    let active = true;
    setLoadingDrivers(true);
    setMessage("");
    setError("");
    setNote("");
    setDriverId(currentDriverId || "");

    void fetchDispatchCandidates(order.id)
      .then((rows) => {
        if (!active) return;
        setDrivers(rows);
      })
      .catch((loadError) => {
        if (!active) return;
        setDrivers([]);
        setError(dispatchRuntimeErrorMessage(loadError, isArabic));
      })
      .finally(() => {
        if (active) setLoadingDrivers(false);
      });

    return () => {
      active = false;
    };
  }, [currentDriverId, isArabic, open, order]);

  const selected = useMemo(
    () => drivers.find((driver) => driver.id === driverId) || null,
    [driverId, drivers],
  );

  if (!open || !order) return null;
  const activeOrder = order;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!driverId) {
      setError(isArabic ? "اختر مندوبًا حقيقيًا من القائمة." : "Select a real driver.");
      return;
    }
    if (currentDriverId === driverId) {
      setError(isArabic ? "هذا المندوب معيّن للطلب بالفعل." : "This driver is already assigned.");
      return;
    }
    if (isReassignment && !note.trim()) {
      setError(isArabic ? "اكتب سبب إعادة التعيين." : "Enter a reassignment reason.");
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await dispatchOrderRuntime({
        orderId: activeOrder.id,
        driverId,
        action: isReassignment ? "reassign" : "assign",
        note: note.trim() || null,
        force: false,
      });
      setMessage(
        isArabic
          ? `${result.action === "reassigned" ? "تم نقل" : "تم إسناد"} الطلب إلى ${selected?.full_name || selected?.name || "المندوب"}.`
          : `Order ${result.action} to ${selected?.full_name || selected?.name || "driver"}.`,
      );
      await onSaved?.();
      window.dispatchEvent(new CustomEvent("dn-admin-orders-updated"));
      window.dispatchEvent(
        new CustomEvent("dn-admin-order-assignment-change", {
          detail: { orderId: activeOrder.id, driverId, action: result.action },
        }),
      );
    } catch (assignmentError) {
      setError(dispatchRuntimeErrorMessage(assignmentError, isArabic));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dn-admin-modal-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
      <form className="dn-admin-action-modal" onSubmit={submit}>
        <header>
          <div>
            <span>{isReassignment ? (isArabic ? "إعادة تعيين المندوب" : "Reassign driver") : (isArabic ? "تعيين مندوب للطلب" : "Assign driver")}</span>
            <strong>{orderRef(activeOrder)}</strong>
          </div>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </header>

        <label>
          {isArabic ? "المندوب النشط" : "Active driver"}
          <select value={driverId} onChange={(event) => setDriverId(event.target.value)} required disabled={loadingDrivers}>
            <option value="">
              {loadingDrivers
                ? isArabic ? "جاري تحميل المندوبين الحقيقيين..." : "Loading real drivers..."
                : isArabic ? "اختر المندوب" : "Select driver"}
            </option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name || driver.name || driver.id} · {driver.shift_status || "offline"} · {driver.active_orders || 0} {isArabic ? "طلب" : "orders"} · {driver.vehicle_plate || "—"}
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <div className="dn-admin-modal-message">
            {selected.is_online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <strong>{selected.full_name || selected.name}</strong>
            <span>{selected.is_online ? (isArabic ? "متصل" : "Online") : (isArabic ? "غير متصل" : "Offline")}</span>
            <span>{selected.vehicle_type || "—"} · {selected.vehicle_plate || "—"}</span>
            <span><Radio className="h-4 w-4" /> {selected.last_seen_at ? new Date(selected.last_seen_at).toLocaleString(isArabic ? "ar-AE" : "en-AE") : "—"}</span>
          </div>
        )}

        <label>
          {isReassignment
            ? isArabic ? "سبب إعادة التعيين — إلزامي" : "Reassignment reason — required"
            : isArabic ? "تعليمات التوزيع" : "Dispatch instructions"}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            required={isReassignment}
            placeholder={isArabic ? "ملاحظات الاستلام أو التسليم للمندوب" : "Pickup or delivery instructions for the driver"}
          />
        </label>

        {message && <p className="dn-admin-modal-message">{message}</p>}
        {error && <p className="dn-admin-modal-message"><AlertTriangle className="h-4 w-4" /> {error}</p>}

        <footer>
          <button type="button" onClick={onClose}>{isArabic ? "إغلاق" : "Close"}</button>
          <button type="submit" disabled={busy || loadingDrivers || drivers.length === 0 || currentDriverId === driverId}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            {busy
              ? isArabic ? "جارٍ الحفظ..." : "Saving..."
              : isReassignment
                ? isArabic ? "نقل الطلب" : "Reassign order"
                : isArabic ? "إسناد الطلب" : "Assign order"}
          </button>
        </footer>
      </form>
    </div>
  );
}
