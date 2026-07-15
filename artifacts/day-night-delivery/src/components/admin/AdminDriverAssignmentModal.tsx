import { useEffect, useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import type { Order } from "../../types";
import { supabase } from "../../supabase";
import type { DriverProfile } from "../../types/driver";
import { createAdminAuditEvent } from "../../lib/adminData";

type Props = {
  order: Order | null;
  isArabic: boolean;
  open: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

const ref = (order: Order) => order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";

export default function AdminDriverAssignmentModal({ order, isArabic, open, onClose, onSaved }: Props) {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [driverId, setDriverId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !supabase) return;
    void supabase
      .from("driver_profiles")
      .select("*")
      .neq("status", "inactive")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        else setDrivers((data || []) as DriverProfile[]);
      });
  }, [open]);

  if (!open || !order) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !order) return;
    if (!driverId) {
      setMessage(isArabic ? "اختر مندوباً حقيقياً." : "Select a real driver.");
      return;
    }

    setBusy(true);
    setMessage("");

    const driver = drivers.find((row) => row.id === driverId);
    const now = new Date().toISOString();
    const payload = {
      driver_id: driverId,
      assigned_driver_id: driverId,
      driver_name: driver?.full_name || driver?.name || null,
      driver_phone: driver?.phone || null,
      status: "assigned",
      updated_at: now,
    };

    const { error } = await supabase.from("orders").update(payload).eq("id", order.id);
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    const { error: historyError } = await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "assigned",
      note: note || "Admin assigned driver",
      driver_id: driverId,
      created_at: now,
    });

    if (historyError) {
      setMessage(historyError.message);
      setBusy(false);
      return;
    }

    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: driver?.user_id,
      title: "New assigned order",
      message: ref(order),
      type: "driver_assignment",
      created_at: now,
    });

    if (notificationError) {
      console.warn("DAY NIGHT driver assignment notification skipped", notificationError.message);
    }

    await createAdminAuditEvent({
      entity_type: "order",
      entity_id: order.id,
      action: "driver_assigned",
      metadata: { driver_id: driverId, note },
    }).catch(() => undefined);

    setMessage(isArabic ? "تم إسناد الطلب للمندوب." : "Order assigned to driver.");
    await onSaved?.();
    setBusy(false);
  }

  return (
    <div className="dn-admin-modal-backdrop" role="dialog" aria-modal="true">
      <form className="dn-admin-action-modal" onSubmit={submit}>
        <header>
          <div>
            <span>{isArabic ? "تعيين مندوب" : "Assign driver"}</span>
            <strong>{ref(order)}</strong>
          </div>
          <button type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>
        <label>
          {isArabic ? "المندوب" : "Driver"}
          <select value={driverId} onChange={(event) => setDriverId(event.target.value)} required>
            <option value="">{isArabic ? "اختر مندوباً" : "Select driver"}</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name || driver.name || driver.id} {driver.phone ? `· ${driver.phone}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          {isArabic ? "ملاحظة التعيين" : "Assignment note"}
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {message && <p className="dn-admin-modal-message">{message}</p>}
        <footer>
          <button type="button" onClick={onClose}>
            {isArabic ? "إغلاق" : "Close"}
          </button>
          <button type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isArabic ? "إسناد للمندوب" : "Assign driver"}
          </button>
        </footer>
      </form>
    </div>
  );
}
