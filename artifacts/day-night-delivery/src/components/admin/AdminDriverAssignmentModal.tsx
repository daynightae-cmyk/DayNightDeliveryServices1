import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, Radio, Truck, Wifi, WifiOff, X } from "lucide-react";
import type { Order } from "../../types";
import { supabase } from "../../supabase";
import { resolveDriverAvatarUrls } from "../../lib/driverData";
import {
  dispatchOrderRuntime,
  dispatchRuntimeErrorMessage,
  fetchDispatchCandidates,
  type DispatchCandidate,
} from "../../lib/driverDispatchRuntime";
import type { DriverLocation, DriverProfile } from "../../types/driver";

type Props = {
  order: Order | null;
  isArabic: boolean;
  open: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

type AssignmentOrderRow = {
  driver_id?: string | null;
  assigned_driver_id?: string | null;
  status?: string | null;
};

const CLOSED = new Set(["delivered", "cancelled", "returned"]);

const orderRef = (order: Order) =>
  order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";

const assignedDriverId = (order: Order) => {
  const row = order as Order & { assigned_driver_id?: string | null; driver_id?: string | null };
  return row.assigned_driver_id || row.driver_id || null;
};

async function loadDirectRealCandidates(): Promise<DispatchCandidate[]> {
  if (!supabase) throw new Error("Supabase client is not configured.");

  const [profilesResult, locationsResult, ordersResult] = await Promise.all([
    supabase.from("driver_profiles").select("*").eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("driver_locations").select("*"),
    supabase.from("orders").select("driver_id,assigned_driver_id,status"),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (locationsResult.error) throw locationsResult.error;
  if (ordersResult.error) throw ordersResult.error;

  const profiles = await resolveDriverAvatarUrls((profilesResult.data || []) as DriverProfile[]);
  const locations = (locationsResult.data || []) as DriverLocation[];
  const orderRows = (ordersResult.data || []) as AssignmentOrderRow[];
  const load = new Map<string, number>();

  for (const row of orderRows) {
    const driver = row.assigned_driver_id || row.driver_id;
    const status = String(row.status || "").toLowerCase().replace(/[-\s]+/g, "_");
    if (!driver || CLOSED.has(status)) continue;
    load.set(driver, (load.get(driver) || 0) + 1);
  }

  return profiles
    .map((profile) => {
      const location = locations.find((row) => row.driver_id === profile.id) || null;
      const lat = Number(location?.lat ?? location?.latitude);
      const lng = Number(location?.lng ?? location?.longitude);
      const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
      return {
        ...profile,
        active_orders: load.get(profile.id) || 0,
        is_online: Boolean(location?.is_online),
        last_seen_at: location?.last_seen_at || null,
        lat: hasLocation ? lat : null,
        lng: hasLocation ? lng : null,
        accuracy: location?.accuracy || null,
        current_order_id: location?.current_order_id || null,
        location: hasLocation
          ? {
              ...location,
              driver_id: profile.id,
              lat,
              lng,
            }
          : null,
      } satisfies DispatchCandidate;
    })
    .sort((a, b) => {
      if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
      const shiftRank = (value: unknown) => {
        if (value === "available") return 0;
        if (value === "busy") return 1;
        if (value === "paused") return 2;
        return 3;
      };
      const shift = shiftRank(a.shift_status) - shiftRank(b.shift_status);
      if (shift) return shift;
      return a.active_orders - b.active_orders;
    });
}

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
      .catch(async () => loadDirectRealCandidates())
      .then((rows) => {
        if (!active) return;
        setDrivers(rows);
        if (!rows.length) {
          setError(isArabic ? "لا توجد حسابات مندوبين نشطة في قاعدة البيانات." : "No active driver accounts exist in the database.");
        }
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
