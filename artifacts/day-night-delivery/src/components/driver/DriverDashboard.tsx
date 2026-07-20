import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BatteryCharging,
  Bell,
  CheckCircle2,
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

function daysUntil(value?: string | null) {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

function profileCompletion(profile: ProfileRole, driver: DriverProfile) {
  const values = [
    driver.avatar_path,
    driver.full_name || profile.full_name,
    driver.phone || profile.phone,
    driver.emergency_contact,
    driver.work_area,
    driver.address,
    driver.bio,
    driver.vehicle_type,
    driver.vehicle_plate,
    driver.emirate,
    driver.license_number,
  ];
  return Math.round((values.filter(Boolean).length / values.length) * 100);
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
    deliveredToday,
    activeCod,
    loading,
    error,
    refresh,
  } = useDriverOrders(driver.id);
  const currentOrder = activeOrders[0];
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
  const completion = profileCompletion(profile, driver);
  const licenseDays = daysUntil(driver.license_expiry);
  const registrationDays = daysUntil(driver.vehicle_registration_expiry);
  const documentWarnings = [
    licenseDays != null && licenseDays <= 30
      ? isArabic
        ? `الرخصة ${licenseDays < 0 ? "منتهية" : `تنتهي خلال ${licenseDays} يوم`}`
        : `License ${licenseDays < 0 ? "expired" : `expires in ${licenseDays} days`}`
      : null,
    registrationDays != null && registrationDays <= 30
      ? isArabic
        ? `تسجيل المركبة ${registrationDays < 0 ? "منتهٍ" : `ينتهي خلال ${registrationDays} يوم`}`
        : `Registration ${registrationDays < 0 ? "expired" : `expires in ${registrationDays} days`}`
      : null,
  ].filter(Boolean) as string[];

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
  const currentReference = currentOrder?.tracking_number || currentOrder?.tracking_code || currentOrder?.invoice_number || currentOrder?.id;
  const currentProgress = progressIndex(currentOrder?.status);
  const currentWeight = Number(currentOrder?.weight);
  const currentPieces = Number(currentOrder?.pieces);
  const timeline = [
    { ar: "تم الإسناد", en: "Assigned" },
    { ar: "تم القبول", en: "Accepted" },
    { ar: "تم الاستلام", en: "Picked up" },
    { ar: "في الطريق", en: "In transit" },
    { ar: "تم التسليم", en: "Delivered" },
  ];

  return (
    <section className="dn-driver-shell dn-driver-shell-v3" dir={isArabic ? "rtl" : "ltr"}>
      <aside className="dn-driver-rail-v3" aria-label={isArabic ? "تنقل لوحة المندوب" : "Driver navigation"}>
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
        <header className="dn-driver-topbar-v3">
          <div className="dn-driver-heading-v3">
            <span>{isArabic ? "مركز تشغيل المندوب" : "Driver Operations Center"}</span>
            <h1>{tab === "home" ? (isArabic ? "التتبع والمهام المباشرة" : "Live tracking & jobs") : tab === "active" ? (isArabic ? "المهام المسندة" : "Assigned jobs") : tab === "history" ? (isArabic ? "سجل التوصيلات" : "Delivery history") : (isArabic ? "ملف المندوب" : "Driver profile")}</h1>
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
            <section className="dn-driver-command-surface-v3">
              <article className={`dn-driver-tracking-card-v3 ${currentOrder ? "has-order" : "is-empty"}`}>
                <div className="dn-driver-progress-line-v3"><i style={{ width: `${currentOrder ? Math.max(12, currentProgress * 25) : 8}%` }} /></div>
                <header>
                  <div>
                    <small>{isArabic ? "المهمة الحالية" : "Current mission"}</small>
                    <h2 dir="ltr">{currentReference || (isArabic ? "بانتظار مهمة جديدة" : "Waiting for a new job")}</h2>
                  </div>
                  <span className={`dn-driver-status-v3 is-${normalizeStatus(currentOrder?.status)}`}>{currentOrder ? statusLabel(currentOrder.status, isArabic) : (isArabic ? "متاح" : "Available")}</span>
                </header>

                {currentOrder ? (
                  <>
                    <div className="dn-driver-timeline-v3">
                      {timeline.map((item, index) => (
                        <div key={item.en} className={index <= currentProgress ? "is-complete" : ""}>
                          <i>{index < currentProgress ? <CheckCircle2 /> : index + 1}</i>
                          <span>{isArabic ? item.ar : item.en}</span>
                        </div>
                      ))}
                    </div>

                    <div className="dn-driver-route-v3">
                      <article>
                        <span>1</span>
                        <div><small>{isArabic ? "نقطة الاستلام" : "Pickup"}</small><strong>{[currentOrder.sender_city, currentOrder.sender_address].filter(Boolean).join("، ") || "—"}</strong></div>
                      </article>
                      <article>
                        <span>2</span>
                        <div><small>{isArabic ? "نقطة التسليم" : "Drop-off"}</small><strong>{[currentOrder.receiver_city, currentOrder.receiver_address].filter(Boolean).join("، ") || "—"}</strong></div>
                      </article>
                    </div>

                    <div className="dn-driver-card-actions-v3">
                      <button type="button" onClick={() => setTab("active")}><Settings2 />{isArabic ? "إدارة المهمة" : "Manage job"}</button>
                      {navigationUrl ? <a href={navigationUrl} target="_blank" rel="noreferrer"><Navigation />{isArabic ? "ابدأ الملاحة" : "Navigate"}</a> : <button type="button" disabled><Navigation />{isArabic ? "لا يوجد مسار" : "No route"}</button>}
                    </div>
                  </>
                ) : (
                  <div className="dn-driver-waiting-v3">
                    <ShieldCheck />
                    <h3>{isArabic ? "أنت جاهز لاستقبال المهمة التالية" : "Ready for the next assignment"}</h3>
                    <p>{isArabic ? "اترك الموقع مفعّلًا لتظهر للمشرف داخل مركز العمليات." : "Keep location enabled so dispatch can see your live availability."}</p>
                  </div>
                )}
              </article>

              <article className="dn-driver-vehicle-stage-v3">
                <div className="dn-driver-vehicle-copy-v3">
                  <span>{isArabic ? "مركبة التشغيل" : "Operating vehicle"}</span>
                  <h2>{vehicleLabel}</h2>
                  <p>{isArabic ? "هوية DAY NIGHT — سريع • آمن • موثوق" : "DAY NIGHT identity — Fast • Safe • Reliable"}</p>
                </div>
                <div className="dn-driver-vehicle-visual-v3">
                  <div className="dn-driver-vehicle-route-grid-v3" aria-hidden="true" />
                  <img src={localAssets.driverVehicle} alt={vehicleLabel} />
                  <span><img src={localAssets.logo} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt="" /></span>
                </div>
                <div className="dn-driver-mini-metrics-v3">
                  <article><Banknote /><div><strong>{activeCod.toFixed(2)}</strong><small>{isArabic ? "تحصيل AED" : "COD AED"}</small></div></article>
                  <article><Route /><div><strong>{gps.travelledMeters < 1000 ? `${Math.round(gps.travelledMeters)}m` : `${(gps.travelledMeters / 1000).toFixed(1)}km`}</strong><small>{isArabic ? "المسافة" : "Distance"}</small></div></article>
                  <article><Weight /><div><strong>{currentOrder && Number.isFinite(currentWeight) ? `${currentWeight.toFixed(1)} kg` : "—"}</strong><small>{isArabic ? "وزن الشحنة" : "Shipment weight"}</small></div></article>
                  <article><Package /><div><strong>{currentOrder && Number.isFinite(currentPieces) ? currentPieces : "—"}</strong><small>{isArabic ? "عدد القطع" : "Pieces"}</small></div></article>
                </div>
              </article>

              <article className="dn-driver-map-stage-v3">
                <header>
                  <div>
                    <small>{isArabic ? "الخريطة المباشرة" : "Live map"}</small>
                    <h2>{currentOrder ? `${currentOrder.sender_city || "—"} → ${currentOrder.receiver_city || "—"}` : (isArabic ? "موقعك داخل الإمارات" : "Your UAE location")}</h2>
                  </div>
                  <span className={gps.permission === "granted" && shiftStarted ? "is-online" : "is-offline"}><Wifi />{gps.permission === "granted" && shiftStarted ? (isArabic ? "مباشر" : "Live") : (isArabic ? "غير متصل" : "Offline")}</span>
                </header>
                <div className="dn-driver-live-map-v3">
                  <TrackingMap order={currentOrder || null} />
                </div>
                <footer>
                  <span><Crosshair />{accuracy != null ? `${Math.round(accuracy)}m · ${accuracyLabel(accuracy, isArabic)}` : (isArabic ? "بانتظار GPS" : "Waiting for GPS")}</span>
                  <span><Clock3 />{isArabic ? "آخر مزامنة" : "Last sync"}: {lastSyncLabel}</span>
                </footer>
              </article>
            </section>

            <section className="dn-driver-kpi-grid-v3">
              <article><Route /><div><small>{isArabic ? "الطلبات النشطة" : "Active orders"}</small><strong>{activeOrders.length}</strong></div></article>
              <article><CheckCircle2 /><div><small>{isArabic ? "تم التسليم اليوم" : "Delivered today"}</small><strong>{deliveredToday}</strong></div></article>
              <article><Clock3 /><div><small>{isArabic ? "مدة الوردية" : "Shift time"}</small><strong>{formatShiftDuration(sessionMinutes, isArabic)}</strong></div></article>
              <article><BatteryCharging /><div><small>{isArabic ? "الجهاز والشبكة" : "Device & network"}</small><strong>{gps.batteryLevel != null ? `${gps.batteryLevel}%` : "—"}</strong><em><Signal /> {gps.networkState || "—"}</em></div></article>
            </section>

            <section className="dn-driver-operations-grid-v3">
              <article className={`dn-driver-shift-console-v3 ${shiftStarted ? "is-active" : ""}`}>
                <header><div><small>{isArabic ? "الوردية والتواجد" : "Shift & presence"}</small><h2>{shiftStarted ? (isArabic ? "متصل بمركز العمليات" : "Connected to operations") : (isArabic ? "الوردية متوقفة" : "Shift is offline")}</h2></div><Wifi /></header>
                <p>{shiftStarted ? (isArabic ? "يتم تحديث موقعك وحالة الجهاز تلقائيًا أثناء الوردية." : "Your location and device health sync automatically during the shift.") : (isArabic ? "ابدأ الوردية لتفعيل التتبع والمهام المباشرة." : "Start the shift to reactivate tracking and live dispatch.")}</p>
                <div className="dn-driver-shift-controls-v3">
                  <button type="button" className={shiftMode === "available" ? "is-active" : ""} disabled={!shiftStarted || shiftBusy || Boolean(currentOrder)} onClick={() => void changeShiftMode("available")}><CheckCircle2 />{isArabic ? "متاح" : "Available"}</button>
                  <button type="button" className={shiftMode === "paused" ? "is-active" : ""} disabled={!shiftStarted || shiftBusy || Boolean(currentOrder)} onClick={() => void changeShiftMode("paused")}><PauseCircle />{isArabic ? "استراحة" : "Break"}</button>
                  <button type="button" className="is-primary" disabled={shiftBusy} onClick={() => void toggleShift()}>{shiftStarted ? <PauseCircle /> : <PlayCircle />}{shiftStarted ? (isArabic ? "إنهاء الوردية" : "End shift") : (isArabic ? "بدء الوردية" : "Start shift")}</button>
                </div>
                {gps.permission !== "granted" && shiftStarted && <button type="button" className="dn-driver-gps-retry-v3" onClick={() => gps.requestLocation()}><Crosshair />{isArabic ? "تفعيل الموقع الآن" : "Enable location now"}</button>}
              </article>

              <article className="dn-driver-readiness-v3">
                <header><div><small>{isArabic ? "جاهزية الملف" : "Profile readiness"}</small><h2>{completion}%</h2></div><UserRound /></header>
                <div className="dn-driver-progress-v3"><i style={{ width: `${completion}%` }} /></div>
                <p>{completion === 100 ? (isArabic ? "ملفك مكتمل وجاهز للتشغيل." : "Your operational profile is complete.") : (isArabic ? "أكمل بيانات الملف لتظهر بصورة أفضل في مركز العمليات." : "Complete your profile to improve dispatch visibility.")}</p>
                <button type="button" onClick={() => setTab("profile")}><Settings2 />{isArabic ? "تحديث الملف" : "Update profile"}</button>
              </article>

              <article className="dn-driver-support-v3">
                <header><div><small>{isArabic ? "الدعم المباشر" : "Direct support"}</small><h2>{isArabic ? "غرفة العمليات" : "Operations room"}</h2></div><MessageCircle /></header>
                <p>{isArabic ? "للمشكلات العاجلة أو تعديل بيانات المهمة تواصل مباشرة مع الإدارة." : "Contact operations directly for urgent issues or job corrections."}</p>
                <div><a href={`tel:${ADMIN_PHONE}`}><Phone />{isArabic ? "اتصال" : "Call"}</a><a href={`https://wa.me/${ADMIN_PHONE.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></div>
              </article>

              <article className={`dn-driver-compliance-v3 ${documentWarnings.length ? "has-warning" : ""}`}>
                <header><div><small>{isArabic ? "الوثائق التشغيلية" : "Operational documents"}</small><h2>{documentWarnings.length ? (isArabic ? "تحتاج مراجعة" : "Needs attention") : (isArabic ? "الحالة سليمة" : "All clear")}</h2></div>{documentWarnings.length ? <AlertTriangle /> : <ShieldCheck />}</header>
                {documentWarnings.length ? documentWarnings.map((warning) => <p key={warning}>{warning}</p>) : <p>{isArabic ? "لا توجد تنبيهات انتهاء مسجلة حاليًا." : "No recorded expiry warnings right now."}</p>}
              </article>
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
