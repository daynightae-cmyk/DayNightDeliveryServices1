import { useMemo, useState } from "react";
import { LogOut, Navigation, RefreshCw } from "lucide-react";
import { supabase } from "../../supabase";
import type { DriverProfile, ProfileRole } from "../../types/driver";
import { useDriverOrders } from "../../hooks/useDriverOrders";
import { useDriverLocation } from "../../hooks/useDriverLocation";
import DriverOrderCard from "./DriverOrderCard";

const closedStatuses = ["delivered", "cancelled", "returned"];

function currentOrderId(orders: { id: string; status: string }[]) {
  return orders.find((order) => !closedStatuses.includes(String(order.status).toLowerCase()))?.id || null;
}

export default function DriverDashboard({
  profile,
  driver,
  isArabic,
}: {
  profile: ProfileRole;
  driver: DriverProfile;
  isArabic: boolean;
}) {
  const { orders, loading, error, refresh } = useDriverOrders(driver.id);
  const activeOrderId = useMemo(() => currentOrderId(orders), [orders]);
  const gps = useDriverLocation(driver.id, activeOrderId);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const name = driver.full_name || driver.name || profile.full_name || profile.name || "DAY NIGHT Driver";

  async function logout() {
    if (!supabase) return;
    await supabase
      .from("driver_locations")
      .upsert(
        {
          driver_id: driver.id,
          is_online: false,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "driver_id" },
      );
    await supabase.auth.signOut();
  }

  async function insertDriverNotification(orderId: string, status: string) {
    if (!supabase) return;
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: profile.id,
      title: "Driver status update",
      message: `${orderId} → ${status}`,
      type: "order_status",
      created_at: new Date().toISOString(),
    });

    if (notificationError) {
      console.warn("DAY NIGHT driver notification skipped", notificationError.message);
    }
  }

  async function updateStatus(orderId: string, status: string, note?: string) {
    if (!supabase) return;
    setBusy(orderId);
    setActionError("");

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status,
        driver_id: driver.id,
        assigned_driver_id: driver.id,
        updated_at: now,
      })
      .eq("id", orderId)
      .or(`driver_id.eq.${driver.id},assigned_driver_id.eq.${driver.id}`);

    if (updateError) {
      setActionError(updateError.message);
      setBusy("");
      return;
    }

    const { error: historyError } = await supabase.from("order_status_history").insert({
      order_id: orderId,
      status,
      note: note || `Driver update: ${status}`,
      driver_id: driver.id,
      changed_by: profile.id,
      created_at: now,
    });

    if (historyError) {
      setActionError(historyError.message);
      setBusy("");
      return;
    }

    await insertDriverNotification(orderId, status);
    await refresh();
    setBusy("");
  }

  const gpsActive = gps.permission === "granted";

  return (
    <section className="mx-auto max-w-xl space-y-4 pb-10" dir={isArabic ? "rtl" : "ltr"}>
      <header className="rounded-[2rem] border border-white/10 bg-[#071A33]/95 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-brand-gold">DAY NIGHT DELIVERY</p>
            <h1 className="text-2xl font-black text-white">{name}</h1>
            <p className="mt-1 text-xs text-white/55">
              {isArabic
                ? "أبقِ الصفحة مفتوحة أثناء التوصيل لتفعيل التتبع الحي."
                : "Keep this page open during deliveries for live web GPS tracking."}
            </p>
          </div>
          <button onClick={() => void logout()} className="rounded-2xl bg-white/10 p-3 text-white">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {!gpsActive && (
        <div className="rounded-3xl border border-amber-400/25 bg-amber-500/10 p-5 text-amber-100">
          <Navigation className="mb-2 h-6 w-6" />
          <b>{isArabic ? "GPS مطلوب" : "GPS required"}</b>
          <p className="mt-1 text-sm opacity-80">
            {isArabic
              ? "اسمح بالوصول للموقع من المتصفح ليظهر موقعك للإدارة."
              : "Allow browser location access so admin can track active deliveries."}
          </p>
          {gps.error && <p className="mt-2 text-xs">{gps.error}</p>}
        </div>
      )}

      <article className="grid grid-cols-2 gap-3 rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 text-white">
        <div>
          <span className="text-xs text-white/50">{isArabic ? "الاتصال" : "Connection"}</span>
          <b className="block text-lg text-emerald-300">{gpsActive ? "Online" : "GPS Required"}</b>
        </div>
        <div>
          <span className="text-xs text-white/50">{isArabic ? "دقة GPS" : "GPS accuracy"}</span>
          <b className="block text-lg">{gps.position ? `${Math.round(gps.position.coords.accuracy)}m` : "—"}</b>
        </div>
        <div>
          <span className="text-xs text-white/50">{isArabic ? "آخر تحديث" : "Last update"}</span>
          <b className="block text-sm">{gps.position ? new Date(gps.position.timestamp).toLocaleTimeString() : "—"}</b>
        </div>
        <div>
          <span className="text-xs text-white/50">{isArabic ? "الطلب الحالي" : "Current order"}</span>
          <b className="block truncate text-sm">{activeOrderId || "—"}</b>
        </div>
      </article>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white">{isArabic ? "طلباتي المسندة" : "Assigned orders"}</h2>
        <button onClick={() => void refresh()} className="rounded-xl bg-white/10 p-2 text-white">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading && <p className="text-white/60">{isArabic ? "جاري التحميل..." : "Loading..."}</p>}
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-red-100">{error}</p>}
      {actionError && <p className="rounded-xl bg-red-500/10 p-3 text-red-100">{actionError}</p>}
      {!loading && orders.length === 0 && (
        <p className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
          {isArabic ? "لا توجد طلبات مسندة حالياً." : "No assigned orders right now."}
        </p>
      )}
      <div className="space-y-4">
        {orders.map((order) => (
          <DriverOrderCard
            key={order.id}
            order={order}
            isArabic={isArabic}
            busy={busy === order.id}
            onStatus={(status, note) => void updateStatus(order.id, status, note)}
          />
        ))}
      </div>
    </section>
  );
}
