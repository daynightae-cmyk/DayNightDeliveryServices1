import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Truck, X } from "lucide-react";
import type { Order } from "../../types";
import { supabase } from "../../supabase";
import type { DriverProfile } from "../../types/driver";
import { assignDriverToOrder } from "../../lib/driverData";

type Props = {
  order: Order | null;
  isArabic: boolean;
  open: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

const orderRef = (order: Order) => order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";

export default function AdminDriverAssignmentModal({ order, isArabic, open, onClose, onSaved }: Props) {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [driverId, setDriverId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    if (!open || !supabase) return;
    setLoadingDrivers(true);
    setMessage("");
    void supabase
      .from("driver_profiles")
      .select("*")
      .eq("status", "active")
      .order("shift_status", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        else setDrivers((data || []) as DriverProfile[]);
        setLoadingDrivers(false);
      });
  }, [open]);

  if (!open || !order) return null;
  const activeOrder = order;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!driverId) {
      setMessage(isArabic ? "اختر مندوبًا حقيقيًا من القائمة." : "Select a real driver.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await assignDriverToOrder(activeOrder.id, driverId, note.trim() || undefined);
      setMessage(isArabic ? "تم إسناد الطلب وإشعار المندوب." : "Order assigned and driver notified.");
      await onSaved?.();
      window.dispatchEvent(new CustomEvent("dn-admin-orders-updated"));
    } catch (assignmentError) {
      setMessage(assignmentError instanceof Error ? assignmentError.message : String(assignmentError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dn-admin-modal-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
      <form className="dn-admin-action-modal" onSubmit={submit}>
        <header>
          <div><span>{isArabic ? "تعيين مندوب للطلب" : "Assign driver"}</span><strong>{orderRef(activeOrder)}</strong></div>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </header>

        <label>
          {isArabic ? "المندوب المتاح" : "Available driver"}
          <select value={driverId} onChange={(event) => setDriverId(event.target.value)} required disabled={loadingDrivers}>
            <option value="">{loadingDrivers ? (isArabic ? "جاري التحميل..." : "Loading...") : (isArabic ? "اختر المندوب" : "Select driver")}</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name || driver.name || driver.id} · {driver.shift_status || "offline"} · {driver.vehicle_plate || "—"}
              </option>
            ))}
          </select>
        </label>

        <label>
          {isArabic ? "تعليمات التوزيع" : "Dispatch instructions"}
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder={isArabic ? "ملاحظات الاستلام أو التسليم للمندوب" : "Pickup or delivery instructions for the driver"} />
        </label>

        {message && <p className="dn-admin-modal-message">{message}</p>}

        <footer>
          <button type="button" onClick={onClose}>{isArabic ? "إغلاق" : "Close"}</button>
          <button type="submit" disabled={busy || loadingDrivers || drivers.length === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            {isArabic ? "إسناد الطلب" : "Assign order"}
          </button>
        </footer>
      </form>
    </div>
  );
}
