import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Gauge,
  Globe2,
  Link2,
  Loader2,
  PackagePlus,
  Plane,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
  Webhook,
  X,
} from "lucide-react";
import { supabase } from "../../supabase";
import {
  internationalTrackingUrl,
  registerAramexShipment,
  runTrack17Admin,
  syncAramexShipment,
  type InternationalShipment,
} from "../../lib/internationalTrackingApi";
import "../../styles/dn-international-admin.css";

type AdminListResponse = {
  ok: boolean;
  shipments: InternationalShipment[];
  webhook_logs: Array<{
    id: string;
    event_type?: string | null;
    tracking_number?: string | null;
    signature_valid?: boolean | null;
    processing_status?: string | null;
    http_result?: number | null;
    error_code?: string | null;
    received_at?: string | null;
  }>;
  quota?: {
    quota_total?: number | null;
    quota_used?: number | null;
    quota_remain?: number | null;
    today_used?: number | null;
    checked_at?: string | null;
  } | null;
};

type OrderOption = {
  id: string;
  tracking_code?: string | null;
  tracking_number?: string | null;
  invoice_number?: string | null;
  sender_city?: string | null;
  receiver_city?: string | null;
  status?: string | null;
};

function statusLabel(value?: string | null, isArabic = true) {
  const key = String(value || "unknown").toLowerCase();
  const map: Record<string, [string, string]> = {
    information_received: ["تم استلام البيانات", "Information received"],
    picked_up: ["تم استلام الشحنة", "Picked up"],
    departed_origin: ["غادرت المنشأ", "Departed origin"],
    in_transit: ["في الطريق", "In transit"],
    customs_clearance: ["التخليص الجمركي", "Customs clearance"],
    customs_exception: ["ملاحظة جمركية", "Customs exception"],
    arrived_destination: ["وصلت بلد الوجهة", "Destination arrival"],
    available_for_pickup: ["جاهزة للاستلام", "Available for pickup"],
    out_for_delivery: ["خرجت للتسليم", "Out for delivery"],
    delivery_failed: ["تعذر التسليم", "Delivery failed"],
    delivered: ["تم التسليم", "Delivered"],
    exception: ["تنبيه", "Exception"],
    expired: ["انتهى التتبع", "Expired"],
    returned: ["مرتجعة", "Returned"],
    unknown: ["جاري التحديث", "Updating"],
  };
  return (map[key] || map.unknown)[isArabic ? 0 : 1];
}

function date(value?: string | null, isArabic = true) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(isArabic ? "ar-AE" : "en-AE");
}

export default function AdminInternationalTrackingLauncher() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const visible = /^\/admin(?:\/|$)/.test(pathname);
  const [open, setOpen] = useState(false);
  const [isArabic, setIsArabic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<AdminListResponse>({ ok: true, shipments: [], webhook_logs: [], quota: null });
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    order_id: "",
    tracking_number: "",
    origin_country: "AE",
    origin_city: "",
    destination_country: "",
    destination_city: "",
    ship_date: "",
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data.shipments;
    return data.shipments.filter((shipment) => [
      shipment.public_tracking_number,
      shipment.tracking_number,
      shipment.carrier_tracking_number_full,
      shipment.latest_location,
      shipment.destination_city,
      shipment.destination_country,
    ].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [data.shipments, search]);

  async function load(refreshQuota = false) {
    setLoading(true);
    setError("");
    try {
      const [list, orderResult] = await Promise.all([
        runTrack17Admin<AdminListResponse>("list", { limit: 100 }),
        supabase
          ? supabase.from("orders").select("id,tracking_code,tracking_number,invoice_number,sender_city,receiver_city,status").order("created_at", { ascending: false }).limit(200)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (refreshQuota) {
        const quota = await runTrack17Admin<{ ok: boolean; quota: AdminListResponse["quota"] }>("quota", { force: true });
        list.quota = quota.quota;
      }
      setData(list);
      setOrders((orderResult.data || []) as OrderOption[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "admin_tracking_load_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible && open) void load(false);
  }, [visible, open]);

  if (!visible) return null;

  async function register() {
    if (!form.order_id || !form.tracking_number) {
      setError(isArabic ? "اختر الطلب واكتب رقم بوليصة أرامكس." : "Select an order and enter the Aramex AWB.");
      return;
    }
    setOperation("register");
    setError("");
    setSuccess("");
    try {
      await registerAramexShipment(form);
      setSuccess(isArabic ? "تم تسجيل شحنة أرامكس وربطها بالطلب." : "The Aramex shipment was registered and linked to the order.");
      setForm((current) => ({ ...current, tracking_number: "", destination_country: "", destination_city: "" }));
      await load(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "registration_failed");
    } finally {
      setOperation("");
    }
  }

  async function shipmentAction(action: "sync" | "stop" | "retrack", shipment: InternationalShipment) {
    setOperation(`${action}:${shipment.id}`);
    setError("");
    setSuccess("");
    try {
      if (action === "sync") await syncAramexShipment(shipment.id);
      else await runTrack17Admin(action, { shipment_id: shipment.id });
      setSuccess(action === "sync"
        ? (isArabic ? "تم تحديث بيانات الشحنة." : "Shipment data updated.")
        : action === "stop"
          ? (isArabic ? "تم إيقاف التتبع." : "Tracking stopped.")
          : (isArabic ? "تمت إعادة التتبع." : "Tracking restarted."));
      await load(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${action}_failed`);
    } finally {
      setOperation("");
    }
  }

  async function copyTracking(shipment: InternationalShipment) {
    const reference = shipment.public_tracking_number || shipment.tracking_number || "";
    await navigator.clipboard.writeText(internationalTrackingUrl(reference));
    setSuccess(isArabic ? "تم نسخ رابط التتبع." : "Tracking link copied.");
  }

  const quota = data.quota;
  const lastWebhook = data.webhook_logs[0];
  const healthyWebhook = Boolean(lastWebhook?.signature_valid && lastWebhook?.http_result === 200);

  return (
    <>
      <button type="button" className="dn-it-admin-launch" onClick={() => setOpen(true)}>
        <Globe2 /><span>{isArabic ? "التتبع الدولي" : "International tracking"}</span>
        {data.shipments.length > 0 && <b>{data.shipments.length}</b>}
      </button>

      {open && (
        <div className="dn-it-admin-modal" dir={isArabic ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-label={isArabic ? "مركز تتبع أرامكس" : "Aramex tracking center"}>
          <button type="button" className="dn-it-admin-shade" onClick={() => setOpen(false)} aria-label="Close" />
          <section className="dn-it-admin-panel">
            <header className="dn-it-admin-head">
              <div className="dn-it-admin-title-icon"><Plane /></div>
              <div><span>17TRACK V2.4 · ARAMEX</span><h1>{isArabic ? "مركز التتبع الدولي" : "International Tracking Center"}</h1><p>{isArabic ? "تسجيل بوليصات أرامكس ومتابعة التحديثات والـWebhook من مكان واحد." : "Register Aramex AWBs and manage shipment updates and webhook health."}</p></div>
              <div className="dn-it-admin-head-actions">
                <button type="button" onClick={() => setIsArabic((value) => !value)}>{isArabic ? "EN" : "ع"}</button>
                <button type="button" onClick={() => void load(true)} disabled={loading}>{loading ? <Loader2 className="dn-it-admin-spin" /> : <RefreshCw />}</button>
                <button type="button" onClick={() => setOpen(false)}><X /></button>
              </div>
            </header>

            <div className="dn-it-admin-scroll">
              <section className="dn-it-admin-kpis">
                <article><span><ShieldCheck /></span><small>{isArabic ? "حالة API" : "API status"}</small><b className="is-good">{isArabic ? "المفتاح على الخادم" : "Server secured"}</b></article>
                <article><span><Gauge /></span><small>{isArabic ? "الرصيد المتبقي" : "Remaining quota"}</small><b>{quota?.quota_remain ?? "—"}</b></article>
                <article><span><Activity /></span><small>{isArabic ? "مستهلك اليوم" : "Used today"}</small><b>{quota?.today_used ?? "—"}</b></article>
                <article><span><Webhook /></span><small>{isArabic ? "صحة Webhook" : "Webhook health"}</small><b className={healthyWebhook ? "is-good" : "is-warn"}>{healthyWebhook ? (isArabic ? "سليم" : "Healthy") : (isArabic ? "بانتظار الاختبار" : "Awaiting test")}</b></article>
                <article><span><Globe2 /></span><small>{isArabic ? "الشحنات المسجلة" : "Registered shipments"}</small><b>{data.shipments.length}</b></article>
              </section>

              {(error || success) && <div className={`dn-it-admin-message ${error ? "is-error" : "is-success"}`}>{error ? <AlertCircle /> : <CheckCircle2 />}<span>{error || success}</span><button type="button" onClick={() => { setError(""); setSuccess(""); }}><X /></button></div>}

              <section className="dn-it-admin-register">
                <header><PackagePlus /><div><small>{isArabic ? "إضافة وربط" : "REGISTER & LINK"}</small><h2>{isArabic ? "تسجيل بوليصة أرامكس" : "Register an Aramex AWB"}</h2></div></header>
                <div className="dn-it-admin-form">
                  <label className="is-wide"><span>{isArabic ? "طلب DAY NIGHT" : "DAY NIGHT order"}</span><select value={form.order_id} onChange={(event) => setForm({ ...form, order_id: event.target.value })}><option value="">{isArabic ? "اختر الطلب" : "Select order"}</option>{orders.map((order) => <option value={order.id} key={order.id}>{order.tracking_code || order.tracking_number || order.invoice_number || order.id} · {order.sender_city || "—"} → {order.receiver_city || "—"}</option>)}</select></label>
                  <label className="is-wide"><span>{isArabic ? "رقم بوليصة أرامكس AWB" : "Aramex AWB"}</span><input dir="ltr" value={form.tracking_number} onChange={(event) => setForm({ ...form, tracking_number: event.target.value.toUpperCase() })} placeholder="37312196364" /></label>
                  <label><span>{isArabic ? "دولة المنشأ" : "Origin country"}</span><input dir="ltr" maxLength={3} value={form.origin_country} onChange={(event) => setForm({ ...form, origin_country: event.target.value.toUpperCase() })} placeholder="AE" /></label>
                  <label><span>{isArabic ? "مدينة المنشأ" : "Origin city"}</span><input value={form.origin_city} onChange={(event) => setForm({ ...form, origin_city: event.target.value })} placeholder="Abu Dhabi" /></label>
                  <label><span>{isArabic ? "دولة الوجهة" : "Destination country"}</span><input dir="ltr" maxLength={3} value={form.destination_country} onChange={(event) => setForm({ ...form, destination_country: event.target.value.toUpperCase() })} placeholder="SA" /></label>
                  <label><span>{isArabic ? "مدينة الوجهة" : "Destination city"}</span><input value={form.destination_city} onChange={(event) => setForm({ ...form, destination_city: event.target.value })} placeholder="Riyadh" /></label>
                  <label className="is-wide"><span>{isArabic ? "تاريخ الشحن (اختياري)" : "Ship date (optional)"}</span><input type="date" value={form.ship_date} onChange={(event) => setForm({ ...form, ship_date: event.target.value })} /></label>
                  <button type="button" className="dn-it-admin-primary" onClick={() => void register()} disabled={Boolean(operation)}>{operation === "register" ? <Loader2 className="dn-it-admin-spin" /> : <PackagePlus />}{isArabic ? "تسجيل وربط الشحنة" : "Register and link shipment"}</button>
                </div>
              </section>

              <section className="dn-it-admin-list">
                <header><div><span>{isArabic ? "العمليات الحية" : "LIVE OPERATIONS"}</span><h2>{isArabic ? "شحنات أرامكس الدولية" : "International Aramex shipments"}</h2></div><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isArabic ? "بحث بالرقم أو الموقع" : "Search number or location"} /></label></header>

                {loading && !data.shipments.length ? <div className="dn-it-admin-loading"><Loader2 /><span>{isArabic ? "تحميل بيانات التتبع…" : "Loading tracking data…"}</span></div> : !filtered.length ? <div className="dn-it-admin-empty"><Plane /><b>{isArabic ? "لا توجد شحنات مسجلة" : "No registered shipments"}</b><p>{isArabic ? "سجّل أول بوليصة أرامكس من النموذج بالأعلى." : "Register the first Aramex AWB using the form above."}</p></div> : <div className="dn-it-admin-cards">{filtered.map((shipment) => {
                  const busy = operation.endsWith(`:${shipment.id}`);
                  return <article key={shipment.id}>
                    <div className="dn-it-admin-card-top"><div><small>ARAMEX AWB</small><b dir="ltr">{shipment.tracking_number || shipment.carrier_tracking_number_full || "—"}</b><span>{shipment.public_tracking_number || "—"}</span></div><i className={`is-${shipment.normalized_status || "unknown"}`}>{statusLabel(shipment.normalized_status, isArabic)}</i></div>
                    <div className="dn-it-admin-route"><span>{shipment.origin_city || shipment.origin_country || "UAE"}</span><Plane /><span>{shipment.destination_city || shipment.destination_country || "—"}</span></div>
                    <dl><div><dt>{isArabic ? "آخر موقع" : "Latest location"}</dt><dd>{shipment.latest_location || "—"}</dd></div><div><dt>{isArabic ? "آخر تحديث" : "Last update"}</dt><dd>{date(shipment.latest_update_at, isArabic)}</dd></div><div><dt>Webhook</dt><dd>{date(shipment.last_webhook_at, isArabic)}</dd></div><div><dt>{isArabic ? "مزامنة" : "Sync"}</dt><dd>{date(shipment.last_synced_at, isArabic)}</dd></div></dl>
                    <div className="dn-it-admin-card-actions"><button type="button" onClick={() => void shipmentAction("sync", shipment)} disabled={busy}>{operation === `sync:${shipment.id}` ? <Loader2 className="dn-it-admin-spin" /> : <RefreshCw />}{isArabic ? "مزامنة" : "Sync"}</button><button type="button" onClick={() => void copyTracking(shipment)}><Copy />{isArabic ? "نسخ الرابط" : "Copy link"}</button><a href={internationalTrackingUrl(shipment.public_tracking_number || shipment.tracking_number || "")} target="_blank" rel="noreferrer"><Link2 />{isArabic ? "فتح" : "Open"}</a>{shipment.tracking_stopped_at ? <button type="button" onClick={() => void shipmentAction("retrack", shipment)} disabled={busy}><RotateCcw />{isArabic ? "إعادة التتبع" : "Retrack"}</button> : <button type="button" className="is-danger" onClick={() => void shipmentAction("stop", shipment)} disabled={busy}><Square />{isArabic ? "إيقاف" : "Stop"}</button>}</div>
                  </article>;
                })}</div>}
              </section>

              <section className="dn-it-admin-webhooks">
                <header><Webhook /><div><small>17TRACK CALLBACKS</small><h2>{isArabic ? "آخر تحديثات Webhook" : "Latest webhook activity"}</h2></div></header>
                <div>{data.webhook_logs.length ? data.webhook_logs.map((log) => <article key={log.id}><span className={log.signature_valid ? "is-good" : "is-bad"}>{log.signature_valid ? <ShieldCheck /> : <AlertCircle />}</span><div><b>{log.event_type || "TRACKING_UPDATED"}</b><small dir="ltr">{log.tracking_number || "Test webhook"}</small></div><i>{log.processing_status || "received"}</i><time>{date(log.received_at, isArabic)}</time></article>) : <p>{isArabic ? "لم يتم إرسال اختبار Webhook بعد." : "No webhook test has been received yet."}</p>}</div>
              </section>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
