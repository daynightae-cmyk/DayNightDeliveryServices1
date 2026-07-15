import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  CheckCircle2,
  ClipboardCopy,
  Edit3,
  MapPinned,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import DriverLiveMap from "./DriverLiveMap";
import { useAdminDrivers } from "../../hooks/useAdminDrivers";
import { setAdminDriverStatus, updateAdminDriverProfile } from "../../lib/driverData";
import type { AdminDriverRow } from "../../hooks/useAdminDrivers";
import "../../styles/dn-driver-operations.css";

const DRIVER_LINK = "https://daynightae.com/driver";

export default function DriverTrackingPanel({ isArabic }: { isArabic: boolean }) {
  const { drivers, stats, loading, error, lastUpdatedAt, refresh } = useAdminDrivers();
  const [query, setQuery] = useState("");
  const [presenceFilter, setPresenceFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const filteredDrivers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return drivers.filter((driver) => {
      const matchesPresence = presenceFilter === "all" || driver.presence === presenceFilter;
      const haystack = [driver.full_name, driver.name, driver.phone, driver.vehicle_plate, driver.vehicle_type, driver.emirate]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesPresence && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [drivers, presenceFilter, query]);

  const selected = drivers.find((driver) => driver.id === selectedId) || filteredDrivers[0] || null;

  useEffect(() => {
    if (!selectedId && filteredDrivers[0]) setSelectedId(filteredDrivers[0].id);
    if (selectedId && !drivers.some((driver) => driver.id === selectedId)) setSelectedId(filteredDrivers[0]?.id || null);
  }, [drivers, filteredDrivers, selectedId]);

  async function copyDriverLink() {
    await navigator.clipboard.writeText(DRIVER_LINK);
    setMessage(isArabic ? "تم نسخ رابط تطبيق المندوب." : "Driver app link copied.");
  }

  async function changeStatus(status: string) {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      await setAdminDriverStatus(selected.id, status, `Admin changed driver status to ${status}`);
      setMessage(isArabic ? "تم تحديث حالة المندوب." : "Driver status updated.");
      await refresh();
    } catch (statusError) {
      setMessage(statusError instanceof Error ? statusError.message : String(statusError));
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(formData: FormData) {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      await updateAdminDriverProfile({
        driverId: selected.id,
        fullName: String(formData.get("full_name") || "").trim(),
        phone: String(formData.get("phone") || "").trim() || null,
        status: String(formData.get("status") || "active"),
        shiftStatus: String(formData.get("shift_status") || "offline"),
        vehicleType: String(formData.get("vehicle_type") || "").trim() || null,
        vehiclePlate: String(formData.get("vehicle_plate") || "").trim() || null,
        vehicleColor: String(formData.get("vehicle_color") || "").trim() || null,
        emirate: String(formData.get("emirate") || "").trim() || null,
        licenseNumber: String(formData.get("license_number") || "").trim() || null,
        emergencyContact: String(formData.get("emergency_contact") || "").trim() || null,
        note: String(formData.get("note") || "").trim() || null,
      });
      setMessage(isArabic ? "تم حفظ بيانات المندوب." : "Driver profile saved.");
      setEditing(false);
      await refresh();
    } catch (profileError) {
      setMessage(profileError instanceof Error ? profileError.message : String(profileError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dn-admin-driver-command" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-admin-driver-hero">
        <div>
          <span><Activity /> {isArabic ? "مركز تشغيل المندوبين المباشر" : "Live Driver Operations Center"}</span>
          <h1>{isArabic ? "المندوبون والتوزيع المباشر" : "Drivers & Live Dispatch"}</h1>
          <p>{isArabic ? "إدارة حسابات المندوبين، الورديات، المركبات، المواقع الحية، خط السير والطلبات المسندة من شاشة واحدة." : "Manage driver accounts, shifts, vehicles, live GPS, route trails and assigned orders from one workspace."}</p>
        </div>
        <div className="dn-admin-driver-hero-actions">
          <button type="button" onClick={() => void copyDriverLink()}><ClipboardCopy /> {isArabic ? "نسخ رابط المندوب" : "Copy driver link"}</button>
          <button type="button" onClick={() => void refresh()}><RefreshCw className={loading ? "animate-spin" : ""} /> {isArabic ? "تحديث مباشر" : "Refresh live"}</button>
        </div>
      </header>

      <div className="dn-admin-driver-kpis">
        <article><Truck /><small>{isArabic ? "إجمالي المندوبين" : "Total drivers"}</small><strong>{stats.total}</strong></article>
        <article className="is-online"><Wifi /><small>{isArabic ? "متصل الآن" : "Online now"}</small><strong>{stats.online}</strong></article>
        <article className="is-idle"><Activity /><small>{isArabic ? "خامل مؤقتًا" : "Idle"}</small><strong>{stats.idle}</strong></article>
        <article><WifiOff /><small>{isArabic ? "غير متصل" : "Offline"}</small><strong>{stats.offline}</strong></article>
        <article><MapPinned /><small>{isArabic ? "طلبات نشطة" : "Active orders"}</small><strong>{stats.activeOrders}</strong></article>
        <article><CheckCircle2 /><small>{isArabic ? "تم اليوم" : "Delivered today"}</small><strong>{stats.deliveredToday}</strong></article>
        <article><Banknote /><small>{isArabic ? "تحصيل نشط" : "Active COD"}</small><strong>{stats.codActive.toFixed(2)} <em>AED</em></strong></article>
      </div>

      <div className="dn-admin-driver-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "بحث بالاسم أو الهاتف أو اللوحة..." : "Search name, phone or plate..."} /></label>
        <select value={presenceFilter} onChange={(event) => setPresenceFilter(event.target.value)}>
          <option value="all">{isArabic ? "كل الحالات" : "All presence"}</option>
          <option value="online">{isArabic ? "متصل" : "Online"}</option>
          <option value="idle">{isArabic ? "خامل" : "Idle"}</option>
          <option value="offline">{isArabic ? "غير متصل" : "Offline"}</option>
          <option value="problem">{isArabic ? "مشكلة" : "Problem"}</option>
        </select>
        <span>{isArabic ? "آخر تحديث" : "Last update"}: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString(isArabic ? "ar-AE" : "en-AE") : "—"}</span>
      </div>

      {error && <div className="dn-admin-driver-message is-error">{error}</div>}
      {message && <div className="dn-admin-driver-message">{message}</div>}

      <div className="dn-admin-driver-layout">
        <aside className="dn-admin-driver-list">
          {loading && drivers.length === 0 && <div className="dn-admin-driver-empty">{isArabic ? "جاري تحميل بيانات المندوبين..." : "Loading drivers..."}</div>}
          {!loading && filteredDrivers.length === 0 && <div className="dn-admin-driver-empty">{isArabic ? "لا توجد نتائج مطابقة." : "No matching drivers."}</div>}
          {filteredDrivers.map((driver) => (
            <button type="button" key={driver.id} className={selected?.id === driver.id ? "is-selected" : ""} onClick={() => setSelectedId(driver.id)}>
              <span className={`dn-admin-driver-presence is-${driver.presence}`}></span>
              <div><strong>{driver.full_name || driver.name || driver.id}</strong><small>{driver.vehicle_type || "—"} · {driver.vehicle_plate || "—"}</small><em>{driver.active_orders} {isArabic ? "طلب نشط" : "active"}</em></div>
              <b>{driver.presence}</b>
            </button>
          ))}
        </aside>

        <main className="dn-admin-driver-main">
          <DriverLiveMap drivers={filteredDrivers} isArabic={isArabic} selectedId={selected?.id} onSelect={setSelectedId} />

          {selected && (
            <section className="dn-admin-driver-detail">
              <header>
                <div><span className={`dn-admin-driver-presence is-${selected.presence}`}></span><section><h2>{selected.full_name || selected.name || selected.id}</h2><p>{selected.vehicle_type || "—"} · {selected.vehicle_plate || "—"} · {selected.emirate || "—"}</p></section></div>
                <div>
                  <button type="button" onClick={() => setEditing(true)}><Edit3 /> {isArabic ? "تعديل الملف" : "Edit profile"}</button>
                  {String(selected.status || "active") === "active" ? <button type="button" className="is-danger" disabled={saving} onClick={() => void changeStatus("suspended")}><ShieldAlert /> {isArabic ? "إيقاف" : "Suspend"}</button> : <button type="button" disabled={saving} onClick={() => void changeStatus("active")}><UserRoundCheck /> {isArabic ? "تفعيل" : "Activate"}</button>}
                </div>
              </header>

              <div className="dn-admin-driver-detail-grid">
                <article><small>{isArabic ? "آخر ظهور" : "Last seen"}</small><strong>{selected.location?.last_seen_at ? new Date(selected.location.last_seen_at).toLocaleString(isArabic ? "ar-AE" : "en-AE") : "—"}</strong></article>
                <article><small>{isArabic ? "السرعة" : "Speed"}</small><strong>{selected.location?.speed != null ? `${Math.round(Number(selected.location.speed) * 3.6)} km/h` : "—"}</strong></article>
                <article><small>{isArabic ? "دقة الموقع" : "GPS accuracy"}</small><strong>{selected.location?.accuracy ? `${Math.round(selected.location.accuracy)}m` : "—"}</strong></article>
                <article><small>{isArabic ? "البطارية" : "Battery"}</small><strong>{selected.location?.battery_level != null ? `${selected.location.battery_level}%` : "—"}</strong></article>
                <article><small>{isArabic ? "الشبكة" : "Network"}</small><strong>{selected.location?.network_state || "—"}</strong></article>
                <article><small>{isArabic ? "تحصيل نشط" : "Active COD"}</small><strong>{selected.cod_active.toFixed(2)} AED</strong></article>
              </div>

              <div className="dn-admin-driver-contact-actions">
                <a href={selected.phone ? `tel:${selected.phone}` : undefined} aria-disabled={!selected.phone}><Phone /> {isArabic ? "اتصال" : "Call"}</a>
                <a href={selected.phone ? `https://wa.me/${String(selected.phone).replace(/\D/g, "")}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!selected.phone}><MessageCircle /> WhatsApp</a>
              </div>

              <div className="dn-admin-driver-orders">
                <h3>{isArabic ? "الطلبات المسندة" : "Assigned orders"}</h3>
                {selected.orders.length === 0 && <p>{isArabic ? "لا توجد طلبات مرتبطة بهذا المندوب." : "No orders assigned to this driver."}</p>}
                {selected.orders.slice(0, 10).map((order) => <article key={order.id}><div><strong>{order.tracking_number || order.invoice_number || order.id}</strong><span>{order.receiver_name || order.customer_name || "—"} · {order.receiver_city || "—"}</span></div><b>{order.status}</b><em>{Number(order.cod_amount || 0).toFixed(2)} AED</em></article>)}
              </div>
            </section>
          )}
        </main>
      </div>

      {editing && selected && (
        <div className="dn-admin-driver-modal" role="dialog" aria-modal="true">
          <form onSubmit={(event) => { event.preventDefault(); void saveProfile(new FormData(event.currentTarget)); }}>
            <header><div><small>{isArabic ? "إدارة ملف المندوب" : "Driver management"}</small><h2>{selected.full_name || selected.name}</h2></div><button type="button" onClick={() => setEditing(false)}><X /></button></header>
            <div className="dn-admin-driver-form-grid">
              <label>{isArabic ? "الاسم" : "Full name"}<input name="full_name" defaultValue={selected.full_name || selected.name || ""} required /></label>
              <label>{isArabic ? "الهاتف" : "Phone"}<input name="phone" defaultValue={selected.phone || ""} /></label>
              <label>{isArabic ? "حالة الحساب" : "Account status"}<select name="status" defaultValue={selected.status || "active"}><option value="active">active</option><option value="inactive">inactive</option><option value="suspended">suspended</option></select></label>
              <label>{isArabic ? "حالة الوردية" : "Shift status"}<select name="shift_status" defaultValue={selected.shift_status || "offline"}><option value="offline">offline</option><option value="available">available</option><option value="busy">busy</option><option value="paused">paused</option></select></label>
              <label>{isArabic ? "نوع المركبة" : "Vehicle type"}<input name="vehicle_type" defaultValue={selected.vehicle_type || "Toyota Rush"} /></label>
              <label>{isArabic ? "رقم اللوحة" : "Vehicle plate"}<input name="vehicle_plate" defaultValue={selected.vehicle_plate || ""} /></label>
              <label>{isArabic ? "لون المركبة" : "Vehicle color"}<input name="vehicle_color" defaultValue={selected.vehicle_color || "White"} /></label>
              <label>{isArabic ? "الإمارة" : "Emirate"}<input name="emirate" defaultValue={selected.emirate || "Abu Dhabi"} /></label>
              <label>{isArabic ? "رقم الرخصة" : "License number"}<input name="license_number" defaultValue={selected.license_number || ""} /></label>
              <label>{isArabic ? "اتصال الطوارئ" : "Emergency contact"}<input name="emergency_contact" defaultValue={selected.emergency_contact || ""} /></label>
              <label className="is-wide">{isArabic ? "ملاحظة إدارية" : "Admin note"}<textarea name="note" defaultValue={selected.last_status_note || ""} rows={3} /></label>
            </div>
            <footer><button type="button" onClick={() => setEditing(false)}>{isArabic ? "إلغاء" : "Cancel"}</button><button type="submit" disabled={saving}><ShieldCheck /> {isArabic ? "حفظ التغييرات" : "Save changes"}</button></footer>
          </form>
        </div>
      )}
    </section>
  );
}
