import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  LogOut,
  Navigation,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
  Wifi,
} from "lucide-react";
import { supabase } from "../../supabase";
import { driverErrorMessage, setDriverPresence, updateDriverOrderStatus } from "../../lib/driverData";
import type { DriverProfile, ProfileRole } from "../../types/driver";
import { useDriverOrders } from "../../hooks/useDriverOrders";
import { useDriverLocation } from "../../hooks/useDriverLocation";
import DriverOrderCard from "./DriverOrderCard";

export default function DriverDashboard({
  profile,
  driver,
  isArabic,
}: {
  profile: ProfileRole;
  driver: DriverProfile;
  isArabic: boolean;
}) {
  const {
    activeOrders,
    completedOrders,
    deliveredToday,
    activeCod,
    loading,
    error,
    refresh,
  } = useDriverOrders(driver.id);
  const currentOrderId = useMemo(() => activeOrders[0]?.id || null, [activeOrders]);
  const [shiftStarted, setShiftStarted] = useState(String(driver.shift_status || "").toLowerCase() !== "offline");
  const [tab, setTab] = useState<"active" | "history" | "profile">("active");
  const [busyOrder, setBusyOrder] = useState("");
  const [actionError, setActionError] = useState("");
  const [shiftBusy, setShiftBusy] = useState(false);
  const gps = useDriverLocation(driver.id, currentOrderId, shiftStarted, isArabic);
  const name = driver.full_name || driver.name || profile.full_name || "DAY NIGHT Driver";

  async function toggleShift() {
    setShiftBusy(true);
    setActionError("");
    try {
      if (shiftStarted) {
        await gps.stopShift();
        setShiftStarted(false);
      } else {
        await setDriverPresence(true, "available", "Driver started shift");
        setShiftStarted(true);
      }
    } catch (shiftError) {
      setActionError(driverErrorMessage(shiftError, isArabic));
    } finally {
      setShiftBusy(false);
    }
  }

  async function logout() {
    try {
      if (shiftStarted) await gps.stopShift();
    } catch {
      // Sign-out must still remain available if presence update fails.
    }
    await supabase?.auth.signOut();
  }

  async function updateStatus(orderId: string, status: string, note?: string) {
    setBusyOrder(orderId);
    setActionError("");
    try {
      await updateDriverOrderStatus(orderId, status, note);
      await refresh();
    } catch (statusError) {
      setActionError(driverErrorMessage(statusError, isArabic));
    } finally {
      setBusyOrder("");
    }
  }

  const lastSyncLabel = gps.lastSyncedAt
    ? new Date(gps.lastSyncedAt).toLocaleTimeString(isArabic ? "ar-AE" : "en-AE")
    : "—";

  return (
    <section className="dn-driver-shell" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-driver-topbar">
        <div className="dn-driver-identity">
          <span className="dn-driver-avatar"><Truck /></span>
          <div>
            <small>DAY NIGHT DELIVERY SERVICES</small>
            <h1>{name}</h1>
            <p>{driver.vehicle_type || "Toyota Rush"} · {driver.vehicle_plate || (isArabic ? "بدون لوحة مسجلة" : "No plate registered")}</p>
          </div>
        </div>
        <button type="button" className="dn-driver-icon-button" onClick={() => void logout()} aria-label="Sign out">
          <LogOut />
        </button>
      </header>

      <section className={`dn-driver-shift-card ${shiftStarted ? "is-active" : ""}`}>
        <div>
          <span className="dn-driver-shift-indicator"><Wifi /></span>
          <div>
            <small>{isArabic ? "حالة الوردية" : "Shift status"}</small>
            <h2>{shiftStarted ? (isArabic ? "متصل وجاهز للتوصيل" : "Online and available") : (isArabic ? "الوردية متوقفة" : "Shift is offline")}</h2>
            <p>
              {shiftStarted
                ? isArabic ? "يتم إرسال موقعك الحقيقي أثناء فتح الصفحة." : "Your real location is shared while this page stays open."
                : isArabic ? "ابدأ الوردية لتفعيل GPS والطلبات المباشرة." : "Start the shift to enable GPS and live dispatch."}
            </p>
          </div>
        </div>
        <button type="button" disabled={shiftBusy} onClick={() => void toggleShift()}>
          {shiftStarted ? <PauseCircle /> : <PlayCircle />}
          {shiftStarted ? (isArabic ? "إنهاء الوردية" : "End shift") : (isArabic ? "بدء الوردية" : "Start shift")}
        </button>
      </section>

      <div className="dn-driver-kpi-grid">
        <article><Route /><small>{isArabic ? "طلبات نشطة" : "Active orders"}</small><strong>{activeOrders.length}</strong></article>
        <article><CheckCircle2 /><small>{isArabic ? "تم اليوم" : "Delivered today"}</small><strong>{deliveredToday}</strong></article>
        <article><Banknote /><small>{isArabic ? "تحصيل نشط" : "Active COD"}</small><strong>{activeCod.toFixed(2)} <em>AED</em></strong></article>
        <article><Navigation /><small>{isArabic ? "دقة GPS" : "GPS accuracy"}</small><strong>{gps.position ? `${Math.round(gps.position.coords.accuracy)}m` : "—"}</strong></article>
      </div>

      <section className="dn-driver-live-strip">
        <span className={gps.permission === "granted" && shiftStarted ? "is-online" : "is-offline"}>
          <Wifi /> {gps.permission === "granted" && shiftStarted ? (isArabic ? "GPS مباشر" : "Live GPS") : (isArabic ? "GPS غير نشط" : "GPS inactive")}
        </span>
        <span><Clock3 /> {isArabic ? "آخر مزامنة" : "Last sync"}: {lastSyncLabel}</span>
        {gps.sending && <span>{isArabic ? "جارٍ الإرسال..." : "Syncing..."}</span>}
      </section>

      {(error || actionError || gps.error) && (
        <div className="dn-driver-alert">{actionError || gps.error || error}</div>
      )}

      <nav className="dn-driver-tabs">
        <button type="button" className={tab === "active" ? "is-active" : ""} onClick={() => setTab("active")}>
          <Truck /> {isArabic ? "المهام الحالية" : "Active jobs"} <span>{activeOrders.length}</span>
        </button>
        <button type="button" className={tab === "history" ? "is-active" : ""} onClick={() => setTab("history")}>
          <Clock3 /> {isArabic ? "السجل" : "History"} <span>{completedOrders.length}</span>
        </button>
        <button type="button" className={tab === "profile" ? "is-active" : ""} onClick={() => setTab("profile")}>
          <UserRound /> {isArabic ? "ملفي" : "Profile"}
        </button>
      </nav>

      <div className="dn-driver-section-heading">
        <div>
          <h2>{tab === "active" ? (isArabic ? "الطلبات المسندة الآن" : "Current assigned orders") : tab === "history" ? (isArabic ? "آخر الطلبات المغلقة" : "Recent closed orders") : (isArabic ? "بيانات المندوب" : "Driver profile")}</h2>
          <p>{tab === "active" ? (isArabic ? "غيّر الحالة فقط حسب سير المهمة الفعلي." : "Update status only as the real delivery progresses.") : tab === "history" ? (isArabic ? "طلبات تم تسليمها أو إغلاقها مؤخرًا." : "Recently delivered, returned or closed orders.") : (isArabic ? "البيانات التشغيلية المسجلة لدى الإدارة." : "Operational details managed by dispatch.")}</p>
        </div>
        {tab !== "profile" && (
          <button type="button" className="dn-driver-icon-button" onClick={() => void refresh()} aria-label="Refresh">
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {tab === "active" && (
        <div className="dn-driver-order-list">
          {!loading && activeOrders.length === 0 && <div className="dn-driver-empty"><Truck /><h3>{isArabic ? "لا توجد مهام مسندة الآن" : "No active jobs"}</h3><p>{isArabic ? "ستظهر الطلبات فور إسنادها من لوحة الإدارة." : "Orders appear immediately after dispatch assignment."}</p></div>}
          {activeOrders.map((order) => <DriverOrderCard key={order.id} order={order} isArabic={isArabic} busy={busyOrder === order.id} onStatus={(status, note) => void updateStatus(order.id, status, note)} />)}
        </div>
      )}

      {tab === "history" && (
        <div className="dn-driver-order-list">
          {!loading && completedOrders.length === 0 && <div className="dn-driver-empty"><Clock3 /><h3>{isArabic ? "لا يوجد سجل حتى الآن" : "No history yet"}</h3></div>}
          {completedOrders.slice(0, 20).map((order) => <DriverOrderCard key={order.id} order={order} isArabic={isArabic} busy={false} onStatus={() => undefined} />)}
        </div>
      )}

      {tab === "profile" && (
        <section className="dn-driver-profile-grid">
          <article><ShieldCheck /><small>{isArabic ? "حالة الحساب" : "Account"}</small><strong>{driver.status || "active"}</strong></article>
          <article><Truck /><small>{isArabic ? "المركبة" : "Vehicle"}</small><strong>{driver.vehicle_type || "—"}</strong></article>
          <article><Route /><small>{isArabic ? "رقم اللوحة" : "Plate"}</small><strong>{driver.vehicle_plate || "—"}</strong></article>
          <article><Navigation /><small>{isArabic ? "الإمارة" : "Emirate"}</small><strong>{driver.emirate || "—"}</strong></article>
          <article className="dn-driver-profile-wide"><UserRound /><small>{isArabic ? "التواصل" : "Contact"}</small><strong>{driver.phone || profile.phone || (isArabic ? "يُحدّث من الإدارة" : "Managed by admin")}</strong></article>
        </section>
      )}
    </section>
  );
}
