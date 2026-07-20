import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BatteryCharging,
  Bell,
  Clock3,
  Crosshair,
  History,
  Home,
  LogOut,
  MessageCircle,
  Navigation,
  Package,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  Route,
  Settings2,
  ShieldCheck,
  Signal,
  Truck,
  UserRound,
  Weight,
  Wifi,
} from "lucide-react";
import { supabase } from "../../supabase";
import { driverErrorMessage, setDriverPresence, updateDriverOrderStatus } from "../../lib/driverData";
import type { DriverProfile, DriverShiftStatus, ProfileRole } from "../../types/driver";
import { useDriverOrders } from "../../hooks/useDriverOrders";
import { useDriverLocation } from "../../hooks/useDriverLocation";
import localAssets, { withRemoteFallback } from "../../data/localAssets";
import DriverOrderCard from "./DriverOrderCard";
import DriverProfilePanel from "./DriverProfilePanel";
import TrackingMap from "../tracking/TrackingMap";

const ADMIN_PHONE = "+971568757331";
const closedStatuses = ["delivered", "cancelled", "returned"];

type DriverTab = "home" | "active" | "history" | "profile";

function accuracyLabel(value: number | null | undefined, isArabic: boolean) {
  if (value == null) return "—";
  if (value <= 15) return isArabic ? "ممتازة" : "Excellent";
  if (value <= 50) return isArabic ? "جيدة" : "Good";
  if (value <= 150) return isArabic ? "متوسطة" : "Moderate";
  return isArabic ? "ضعيفة" : "Low";
}

function orderDestination(order: ReturnType<typeof useDriverOrders>["activeOrders"][number] | undefined) {
  if (!order) return "";
  const lat = Number(order.receiver_lat ?? order.delivery_lat);
  const lng = Number(order.receiver_lng ?? order.delivery_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat},${lng}`;
  return [order.receiver_city, order.receiver_address].filter(Boolean).join(", ");
}

function normalizeStatus(value?: string | null) {
  return String(value || "assigned").trim().toLowerCase().replace(/\s+/g, "_");
}

function statusLabel(value: string | undefined, isArabic: boolean) {
  const status = normalizeStatus(value);
  const labels: Record<string, [string, string]> = {
    assigned: ["مسند للمندوب", "Assigned"],
    available: ["متاح", "Available"],
    busy: ["مشغول", "Busy"],
    paused: ["استراحة", "Paused"],
    offline: ["غير متصل", "Offline"],
    accepted: ["تم قبول المهمة", "Accepted"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    out_for_delivery: ["خرج للتسليم", "Out for delivery"],
    delivered: ["تم التسليم", "Delivered"],
    returned: ["مرتجع", "Returned"],
    cancelled: ["ملغي", "Cancelled"],
  };
  return labels[status]?.[isArabic ? 0 : 1] || value || (isArabic ? "مسند" : "Assigned");
}

function progressIndex(value?: string | null) {
  const status = normalizeStatus(value);
  if (status === "delivered") return 4;
  if (["in_transit", "out_for_delivery"].includes(status)) return 3;
  if (status === "picked_up") return 2;
  if (status === "accepted") return 1;
  return 0;
}

function formatShiftDuration(minutes: number, isArabic: boolean) {
  if (minutes < 60) return `${minutes}${isArabic ? " د" : "m"}`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}${isArabic ? " س" : "h"} ${remainder}${isArabic ? " د" : "m"}`;
}

export default function DriverDashboard({
  profile,
  driver,
  isArabic,
  onProfileUpdated,
}: {
  profile: ProfileRole;
  driver: DriverProfile;
  isArabic: boolean;
  onProfileUpdated: () => Promise<void> | void;
}) {
  const {
    activeOrders,
    completedOrders,
    activeCod,
    loading,
    error,
    refresh,
  } = useDriverOrders(driver.id);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const currentOrder = activeOrders.find((order) => order.id === selectedOrderId) || activeOrders[0];
  const currentOrderId = currentOrder?.id || null;
  const [shiftStarted, setShiftStarted] = useState(true);
  const [shiftMode, setShiftMode] = useState<DriverShiftStatus>(
    driver.shift_status === "busy" ? "busy" : driver.shift_status === "paused" ? "paused" : "available",
  );
  const [tab, setTab] = useState<DriverTab>("home");
  const [busyOrder, setBusyOrder] = useState("");
  const [actionError, setActionError] = useState("");
  const [shiftBusy, setShiftBusy] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const gps = useDriverLocation(driver.id, currentOrderId, shiftStarted, isArabic);
  const name = driver.full_name || driver.name || profile.full_name || (isArabic ? "مندوب DAY NIGHT" : "DAY NIGHT Driver");
  const vehicleLabel = driver.vehicle_type || (isArabic ? "Toyota Rush — أسطول DAY NIGHT" : "Toyota Rush — DAY NIGHT Fleet");
  const plateLabel = driver.vehicle_plate || (isArabic ? "لوحة المركبة غير مسجلة" : "Vehicle plate not registered");
  const accuracy = gps.position?.coords.accuracy;

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const sessionMinutes = useMemo(() => {
    if (!gps.sessionStartedAt) return 0;
    return Math.max(0, Math.floor((clockNow - new Date(gps.sessionStartedAt).getTime()) / 60_000));
  }, [clockNow, gps.sessionStartedAt]);

  async function toggleShift() {
    setShiftBusy(true);
    setActionError("");
    try {
      if (shiftStarted) {
        await gps.stopShift();
        setShiftStarted(false);
        setShiftMode("offline");
      } else {
        await setDriverPresence(true, "available", "Driver manually resumed shift");
        setShiftStarted(true);
        setShiftMode("available");
        window.setTimeout(() => gps.requestLocation(), 50);
      }
    } catch (shiftError) {
      setActionError(driverErrorMessage(shiftError, isArabic));
    } finally {
      setShiftBusy(false);
    }
  }

  async function changeShiftMode(mode: "available" | "paused") {
    if (!shiftStarted || shiftBusy) return;
    setShiftBusy(true);
    setActionError("");
    try {
      await setDriverPresence(true, mode, mode === "paused" ? "Driver started a short break" : "Driver is ready for dispatch");
      setShiftMode(mode);
    } catch (presenceError) {
      setActionError(driverErrorMessage(presenceError, isArabic));
    } finally {
      setShiftBusy(false);
    }
  }

  async function logout() {
    try {
      if (shiftStarted) await gps.stopShift();
    } catch {
      // Sign-out must remain available if presence update fails.
    }
    await supabase?.auth.signOut();
  }

  async function updateStatus(orderId: string, status: string, note?: string) {
    setBusyOrder(orderId);
    setActionError("");
    try {
      await updateDriverOrderStatus(orderId, status, note);
      await refresh();
      if (closedStatuses.includes(status)) setShiftMode("available");
      else setShiftMode("busy");
    } catch (statusError) {
      setActionError(driverErrorMessage(statusError, isArabic));
    } finally {
      setBusyOrder("");
    }
  }

  const lastSyncLabel = gps.lastSyncedAt
    ? new Date(gps.lastSyncedAt).toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const destination = orderDestination(currentOrder);
  const navigationUrl = destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : undefined;
  const currentWeight = Number(currentOrder?.weight);
  const currentPieces = Number(currentOrder?.pieces);
  return (
    <section className="dn-driver-shell dn-driver-shell-v3 dn-driver-exact-shell" dir={isArabic ? "rtl" : "ltr"}>
      <aside className="dn-driver-rail-v3 dn-driver-exact-rail" aria-label={isArabic ? "تنقل لوحة المندوب" : "Driver navigation"}>
        <button type="button" className="dn-driver-brand-mark-v3" onClick={() => setTab("home")} aria-label="DAY NIGHT">
          <img src={localAssets.logo} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt="DAY NIGHT" />
        </button>

        <nav>
          <button type="button" className={tab === "home" ? "is-active" : ""} onClick={() => setTab("home")} title={isArabic ? "الرئيسية" : "Home"}><Home /></button>
          <button type="button" className={tab === "active" ? "is-active" : ""} onClick={() => setTab("active")} title={isArabic ? "المهام" : "Jobs"}><Package />{activeOrders.length > 0 && <b>{activeOrders.length}</b>}</button>
          <button type="button" className={tab === "history" ? "is-active" : ""} onClick={() => setTab("history")} title={isArabic ? "السجل" : "History"}><History /></button>
          <button type="button" className={tab === "profile" ? "is-active" : ""} onClick={() => setTab("profile")} title={isArabic ? "ملفي" : "Profile"}><UserRound /></button>
        </nav>

        <div className="dn-driver-rail-tools-v3">
          <a href={`https://wa.me/${ADMIN_PHONE.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle /></a>
          <button type="button" onClick={() => void logout()} title={isArabic ? "تسجيل الخروج" : "Sign out"}><LogOut /></button>
        </div>
      </aside>

      <main className="dn-driver-workspace-v3">
        <header className="dn-driver-topbar-v3 dn-driver-exact-header">
          <div className="dn-driver-heading-v3">
            <span>DAY NIGHT DELIVERY</span>
            <h1>{tab === "home" ? (isArabic ? "التتبع" : "Tracking") : tab === "active" ? (isArabic ? "المهام المسندة" : "Assigned jobs") : tab === "history" ? (isArabic ? "سجل التوصيلات" : "Delivery history") : (isArabic ? "ملف المندوب" : "Driver profile")}</h1>
          </div>

          <div className="dn-driver-topbar-actions-v3">
            <div className="dn-driver-profile-chip-v3">
              <span className={`dn-driver-avatar ${driver.avatar_url ? "has-photo" : ""}`}>
                {driver.avatar_url ? <img src={driver.avatar_url} alt={name} /> : <Truck />}
              </span>
              <div>
                <strong>{name}</strong>
                <small>{vehicleLabel} · {plateLabel}</small>
              </div>
            </div>
            <span className={`dn-driver-shift-badge is-${shiftStarted ? shiftMode : "offline"}`}>
              {shiftStarted ? statusLabel(shiftMode, isArabic) : (isArabic ? "غير متصل" : "Offline")}
            </span>
            <button type="button" className="dn-driver-exact-shift-button" disabled={shiftBusy} onClick={() => void toggleShift()}>
              {shiftStarted ? <PauseCircle /> : <PlayCircle />}
              <span>{shiftStarted ? (isArabic ? "إنهاء الوردية" : "End shift") : (isArabic ? "بدء الوردية" : "Start shift")}</span>
            </button>
            <button type="button" className="dn-driver-icon-button-v3" onClick={() => void refresh()} aria-label={isArabic ? "تحديث" : "Refresh"}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </button>
            <button type="button" className="dn-driver-icon-button-v3" aria-label={isArabic ? "الإشعارات" : "Notifications"}>
              <Bell />
              {activeOrders.length > 0 && <b>{activeOrders.length}</b>}
            </button>
          </div>
        </header>

        {(error || actionError || gps.error) && (
          <div className="dn-driver-alert dn-driver-alert-v3">{actionError || gps.error || error}</div>
        )}

        {tab === "home" && (
          <>
            <section className="dn-driver-exact-board">
              <article className="dn-driver-exact-jobs">
                <header>
                  <div><small>{isArabic ? "مهام اليوم" : "Today's jobs"}</small><strong>{activeOrders.length}</strong></div>
                  <button type="button" onClick={() => void refresh()} aria-label={isArabic ? "تحديث المهام" : "Refresh jobs"}><RefreshCw className={loading ? "animate-spin" : ""} /></button>
                </header>
                <div className="dn-driver-exact-job-list">
                  {activeOrders.slice(0, 5).map((order, orderIndex) => {
                    const reference = order.tracking_number || order.tracking_code || order.invoice_number || order.id;
                    const progress = progressIndex(order.status);
                    return (
                      <button key={order.id} type="button" className={currentOrder?.id === order.id ? "is-selected" : ""} onClick={() => setSelectedOrderId(order.id)}>
                        <span className="dn-driver-exact-job-number">#{reference}</span>
                        <span className="dn-driver-exact-job-tags"><em>{statusLabel(order.status, isArabic)}</em><em>{order.receiver_city || (isArabic ? "الإمارات" : "UAE")}</em></span>
                        <span className="dn-driver-exact-job-route"><b>{order.sender_city || "—"}</b><i>→</i><b>{order.receiver_city || "—"}</b></span>
                        <span className="dn-driver-exact-job-progress" aria-label={`${progress + 1}/5`}>
                          {[0, 1, 2, 3, 4].map((step) => <i key={step} className={step <= progress ? "is-complete" : ""} />)}
                        </span>
                        <small>{isArabic ? `المهمة ${orderIndex + 1} من ${activeOrders.length}` : `Job ${orderIndex + 1} of ${activeOrders.length}`}</small>
                      </button>
                    );
                  })}
                  {!loading && activeOrders.length === 0 && (
                    <div className="dn-driver-exact-no-job"><ShieldCheck /><strong>{isArabic ? "جاهز للمهمة التالية" : "Ready for the next job"}</strong><small>{isArabic ? "الموقع المباشر يعمل وسيظهر الطلب هنا فور إسناده." : "Live location is active. New assignments will appear here."}</small></div>
                  )}
                </div>
              </article>

              <article className="dn-driver-exact-vehicle">
                <header>
                  <div><small>{isArabic ? "مركبة التشغيل" : "Operating vehicle"}</small><h2>{vehicleLabel}</h2></div>
                  <button type="button" onClick={() => setTab("profile")}>{isArabic ? "بيانات المركبة" : "Vehicle details"}</button>
                </header>
                <div className="dn-driver-exact-vehicle-canvas">
                  <span className="dn-driver-exact-vehicle-grid" aria-hidden="true" />
                  <img src={localAssets.driverVehicle} alt={vehicleLabel} />
                </div>
                <div className="dn-driver-exact-metrics">
                  <article><Weight /><div><strong>{currentOrder && Number.isFinite(currentWeight) ? currentWeight.toFixed(1) : "—"}</strong><small>{isArabic ? "كجم" : "kg"}</small></div><span>{isArabic ? "الوزن" : "Payload"}</span></article>
                  <article><Package /><div><strong>{currentOrder && Number.isFinite(currentPieces) ? currentPieces : "—"}</strong><small>{isArabic ? "قطعة" : "pcs"}</small></div><span>{isArabic ? "القطع" : "Pieces"}</span></article>
                  <article><Route /><div><strong>{gps.travelledMeters < 1000 ? Math.round(gps.travelledMeters) : (gps.travelledMeters / 1000).toFixed(1)}</strong><small>{gps.travelledMeters < 1000 ? "m" : "km"}</small></div><span>{isArabic ? "المسافة" : "Distance"}</span></article>
                  <article><Banknote /><div><strong>{activeCod.toFixed(0)}</strong><small>AED</small></div><span>{isArabic ? "التحصيل" : "COD"}</span></article>
                </div>
              </article>

              <article className="dn-driver-exact-map">
                <header>
                  <div><small>{isArabic ? "الخريطة المباشرة" : "Live map"}</small><h2>{currentOrder ? `${currentOrder.sender_city || "—"} → ${currentOrder.receiver_city || "—"}` : (isArabic ? "موقع المندوب الحالي" : "Current driver location")}</h2></div>
                  <span className={gps.permission === "granted" && shiftStarted ? "is-live" : ""}><Wifi />{gps.permission === "granted" && shiftStarted ? (isArabic ? "مباشر" : "Live") : (isArabic ? "غير متصل" : "Offline")}</span>
                </header>
                <div className="dn-driver-exact-map-canvas"><TrackingMap order={currentOrder || null} /></div>
                <footer>
                  <section>
                    <span className={`dn-driver-avatar ${driver.avatar_url ? "has-photo" : ""}`}>{driver.avatar_url ? <img src={driver.avatar_url} alt={name} /> : <UserRound />}</span>
                    <div><small>{isArabic ? "المندوب" : "Driver"}</small><strong>{name}</strong><span>{driver.phone || profile.phone || ADMIN_PHONE}</span></div>
                    <a href={`tel:${driver.phone || profile.phone || ADMIN_PHONE}`} aria-label={isArabic ? "اتصال بالمندوب" : "Call driver"}><Phone /></a>
                  </section>
                  <section>
                    <div><small>{isArabic ? "عنوان التسليم" : "Delivery address"}</small><strong>{currentOrder ? [currentOrder.receiver_city, currentOrder.receiver_address].filter(Boolean).join("، ") || "—" : (isArabic ? "بانتظار مهمة" : "Waiting for assignment")}</strong><span><Clock3 />{isArabic ? "آخر مزامنة" : "Last sync"}: {lastSyncLabel}</span></div>
                    {navigationUrl ? <a href={navigationUrl} target="_blank" rel="noreferrer" aria-label={isArabic ? "فتح الملاحة" : "Open navigation"}><Navigation /></a> : <span className="is-disabled"><Navigation /></span>}
                  </section>
                </footer>
              </article>
            </section>

            <section className="dn-driver-exact-actionbar">
              <div><Crosshair /><span>{accuracy != null ? `${Math.round(accuracy)}m · ${accuracyLabel(accuracy, isArabic)}` : (isArabic ? "بانتظار GPS" : "Waiting for GPS")}</span></div>
              <div><Clock3 /><span>{isArabic ? "مدة الوردية" : "Shift time"}: {formatShiftDuration(sessionMinutes, isArabic)}</span></div>
              <div><BatteryCharging /><span>{gps.batteryLevel != null ? `${gps.batteryLevel}%` : "—"}</span><Signal /><span>{gps.networkState || "—"}</span></div>
              <div className="dn-driver-exact-actions">
                {gps.permission !== "granted" && shiftStarted && <button type="button" onClick={() => gps.requestLocation()}><Crosshair />{isArabic ? "تفعيل الموقع" : "Enable GPS"}</button>}
                <button type="button" onClick={() => void changeShiftMode(shiftMode === "paused" ? "available" : "paused")} disabled={!shiftStarted || shiftBusy || Boolean(currentOrder)}>{shiftMode === "paused" ? <PlayCircle /> : <PauseCircle />}{shiftMode === "paused" ? (isArabic ? "متاح" : "Available") : (isArabic ? "استراحة" : "Break")}</button>
                {currentOrder && <button type="button" className="is-primary" onClick={() => setTab("active")}><Settings2 />{isArabic ? "إدارة المهمة" : "Manage job"}</button>}
                {navigationUrl && <a href={navigationUrl} target="_blank" rel="noreferrer"><Navigation />{isArabic ? "ابدأ الملاحة" : "Navigate"}</a>}
              </div>
            </section>
          </>
        )}

        {tab !== "home" && (
          <div className="dn-driver-section-heading dn-driver-section-heading-v3">
            <div>
              <span>DAY NIGHT DRIVER</span>
              <h2>{tab === "active" ? (isArabic ? "الطلبات المسندة الآن" : "Current assigned orders") : tab === "history" ? (isArabic ? "آخر الطلبات المغلقة" : "Recent closed orders") : (isArabic ? "ملف المندوب الكامل" : "Complete driver profile")}</h2>
              <p>{tab === "active" ? (isArabic ? "حدّث الحالة حسب سير المهمة فقط." : "Update status only as the delivery progresses.") : tab === "history" ? (isArabic ? "طلبات تم تسليمها أو إغلاقها مؤخرًا." : "Recently delivered, returned or closed orders.") : (isArabic ? "صورتك وبياناتك تظهر في لوحة العمليات والخريطة." : "Your photo and details appear in operations and on the map.")}</p>
            </div>
            {tab !== "profile" && <button type="button" className="dn-driver-icon-button-v3" onClick={() => void refresh()} aria-label="Refresh"><RefreshCw className={loading ? "animate-spin" : ""} /></button>}
          </div>
        )}

        {tab === "active" && (
          <div className="dn-driver-order-list dn-driver-order-list-v3">
            {!loading && activeOrders.length === 0 && <div className="dn-driver-empty dn-driver-empty-v3"><Truck /><h3>{isArabic ? "لا توجد مهام مسندة الآن" : "No active jobs"}</h3><p>{isArabic ? "ستظهر الطلبات فور إسنادها من لوحة الإدارة." : "Orders appear immediately after dispatch assignment."}</p></div>}
            {activeOrders.map((order) => <DriverOrderCard key={order.id} order={order} isArabic={isArabic} busy={busyOrder === order.id} onStatus={(status, note) => void updateStatus(order.id, status, note)} />)}
          </div>
        )}

        {tab === "history" && (
          <div className="dn-driver-order-list dn-driver-order-list-v3">
            {!loading && completedOrders.length === 0 && <div className="dn-driver-empty dn-driver-empty-v3"><Clock3 /><h3>{isArabic ? "لا يوجد سجل حتى الآن" : "No history yet"}</h3></div>}
            {completedOrders.slice(0, 30).map((order) => <DriverOrderCard key={order.id} order={order} isArabic={isArabic} busy={false} onStatus={() => undefined} />)}
          </div>
        )}

        {tab === "profile" && <DriverProfilePanel profile={profile} driver={driver} isArabic={isArabic} onUpdated={onProfileUpdated} />}

        <nav className="dn-driver-mobile-dock dn-driver-mobile-dock-v3" aria-label="Driver navigation">
          <button type="button" className={tab === "home" ? "is-active" : ""} onClick={() => setTab("home")}><Home /><span>{isArabic ? "الرئيسية" : "Home"}</span></button>
          <button type="button" className={tab === "active" ? "is-active" : ""} onClick={() => setTab("active")}><Package /><span>{isArabic ? "المهام" : "Jobs"}</span>{activeOrders.length > 0 && <b>{activeOrders.length}</b>}</button>
          <button type="button" className={tab === "history" ? "is-active" : ""} onClick={() => setTab("history")}><History /><span>{isArabic ? "السجل" : "History"}</span></button>
          <button type="button" className={tab === "profile" ? "is-active" : ""} onClick={() => setTab("profile")}><UserRound /><span>{isArabic ? "ملفي" : "Profile"}</span></button>
        </nav>
      </main>
    </section>
  );
}
