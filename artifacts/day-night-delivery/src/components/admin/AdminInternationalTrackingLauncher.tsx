import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Gauge,
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
import { fetchAdminOrders } from "../../lib/adminData";
import {
  INTERNATIONAL_DESTINATIONS,
  internationalDestinationLabel,
  normalizeInternationalDestination,
} from "../../data/internationalDestinations";
import { matchesSearchQuery } from "../../lib/searchNormalization";
import {
  internationalTrackingUrl,
  registerAramexShipment,
  runTrack17Admin,
  syncAramexShipment,
  type InternationalShipment,
  type TrackingOperationError,
} from "../../lib/internationalTrackingApi";
import "../../styles/dn-international-admin.css";

const INTERNATIONAL_SHIPMENT_UPDATED_EVENT = "dn-international-shipment-updated";

type OrderOption = {
  id: string;
  tracking_code?: string | null;
  tracking_number?: string | null;
  invoice_number?: string | null;
  coupon_number?: string | null;
  sender_city?: string | null;
  receiver_city?: string | null;
  destination_country?: string | null;
  shipping_scope?: string | null;
  service_type?: string | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  merchant_id?: string | null;
  merchant_code?: string | null;
  merchant_name?: string | null;
};

type WebhookLog = {
  id: string;
  event_type?: string | null;
  tracking_number?: string | null;
  signature_valid?: boolean | null;
  processing_status?: string | null;
  http_result?: number | null;
  received_at?: string | null;
};

type TrackingCenterData = {
  ok: boolean;
  shipments: InternationalShipment[];
  webhook_logs: WebhookLog[];
  quota?: {
    quota_total?: number | null;
    quota_used?: number | null;
    quota_remain?: number | null;
    today_used?: number | null;
  } | null;
};

type RegistrationForm = {
  order_id: string;
  tracking_number: string;
  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;
  ship_date: string;
};

const EMPTY_FORM: RegistrationForm = {
  order_id: "",
  tracking_number: "",
  origin_country: "AE",
  origin_city: "",
  destination_country: "",
  destination_city: "",
  ship_date: "",
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeOrder(row: Record<string, unknown>): OrderOption | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    tracking_code: text(row.tracking_code) || null,
    tracking_number: text(row.tracking_number) || null,
    invoice_number: text(row.invoice_number) || null,
    coupon_number: text(row.coupon_number) || null,
    sender_city: text(row.sender_city) || null,
    receiver_city: text(row.receiver_city) || null,
    destination_country: text(row.destination_country) || null,
    shipping_scope: text(row.shipping_scope) || null,
    service_type: text(row.service_type) || null,
    receiver_name: text(row.receiver_name) || null,
  };
}

function orderReference(order: OrderOption) {
  return order.tracking_code || order.tracking_number || order.invoice_number || order.coupon_number || order.id;
}

function countryCode(value: unknown) {
  return normalizeInternationalDestination(value);
}

function isInternational(order: OrderOption) {
  const scope = `${order.shipping_scope || ""} ${order.service_type || ""}`.toLowerCase();
  if (/international|global|worldwide|external/.test(scope)) return true;
  const destination = countryCode(order.destination_country);
  return Boolean(destination && destination !== "AE");
}

function statusLabel(value?: string | null, arabic = true) {
  const labels: Record<string, [string, string]> = {
    information_received: ["تم استلام البيانات", "Information received"],
    picked_up: ["تم استلام الشحنة", "Picked up"],
    departed_origin: ["غادرت المنشأ", "Departed origin"],
    in_transit: ["في الطريق", "In transit"],
    customs_clearance: ["التخليص الجمركي", "Customs clearance"],
    arrived_destination: ["وصلت بلد الوجهة", "Destination arrival"],
    out_for_delivery: ["خرجت للتسليم", "Out for delivery"],
    delivered: ["تم التسليم", "Delivered"],
    exception: ["تنبيه", "Exception"],
    expired: ["انتهى التتبع", "Expired"],
    returned: ["مرتجعة", "Returned"],
  };
  return (labels[String(value || "").toLowerCase()] || ["جاري التحديث", "Updating"])[arabic ? 0 : 1];
}

function displayDate(value?: string | null, arabic = true) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(arabic ? "ar-AE" : "en-AE");
}

function operationMessage(cause: unknown, arabic: boolean) {
  const error = cause as TrackingOperationError | undefined;
  const code = text(error?.code);
  const details = text(error?.details);
  const raw = text(error?.message || cause);
  const combined = `${code} ${details} ${raw}`.toLowerCase();

  const known: Array<[RegExp, string, string]> = [
    [/international_shipments|schema cache|shipment_list_failed/, "جداول التتبع الدولي غير موجودة في قاعدة البيانات. طبّق هجرة إصلاح Track17.", "The international tracking tables are missing. Apply the Track17 repair migration."],
    [/not_authenticated|jwt|session/, "انتهت جلسة المدير. سجّل الخروج ثم الدخول مرة واحدة.", "The administrator session has expired."],
    [/not_authorized|403/, "الحساب الحالي لا يحمل صلاحية مدير.", "The current account does not have administrator permission."],
    [/track17_api_key_missing/, "مفتاح TRACK17_API_KEY غير متاح في Supabase.", "TRACK17_API_KEY is unavailable in Supabase."],
    [/invalid_order_id/, "معرّف الطلب المختار غير صالح.", "The selected order ID is invalid."],
    [/order_not_found/, "الطلب المختار غير موجود.", "The selected order was not found."],
    [/track17_registration_rejected/, "رفض 17TRACK تسجيل رقم البوليصة.", "17TRACK rejected the AWB registration."],
    [/shipment_insert_failed/, "وصل الطلب إلى 17TRACK لكن تعذر حفظ الشحنة.", "17TRACK was reached, but the shipment could not be saved."],
    [/carrier_mismatch/, "رقم البوليصة لا يعود إلى أرامكس.", "The AWB is not identified as Aramex."],
    [/timeout/, "انتهت مهلة خدمة التتبع. أعد المحاولة.", "The tracking request timed out."],
    [/network|failed to fetch|cors/, "تعذر الاتصال بوظيفة Supabase.", "The Supabase Function could not be reached."],
  ];

  const match = known.find(([pattern]) => pattern.test(combined));
  const primary = match ? match[arabic ? 1 : 2] : (arabic ? "تعذر تنفيذ عملية التتبع الدولي." : "The tracking operation failed.");
  const technical = [code, details || (!match ? raw : "")].filter(Boolean).join(" — ");
  return technical ? `${primary} [${technical}]` : primary;
}

function mergeShipment(current: InternationalShipment[], shipment: InternationalShipment) {
  return [shipment, ...current.filter((item) => item.id !== shipment.id)].slice(0, 100);
}

function shipmentTrackingNumber(shipment?: InternationalShipment | null) {
  return text(
    shipment?.carrier_tracking_number_full
      || shipment?.tracking_number
      || shipment?.carrier_tracking_number
      || shipment?.public_tracking_number,
  );
}

function announceInternationalShipmentUpdate(
  shipment: InternationalShipment | null | undefined,
  fallbackOrderId = "",
  fallbackTrackingNumber = "",
) {
  window.dispatchEvent(new CustomEvent(INTERNATIONAL_SHIPMENT_UPDATED_EVENT, {
    detail: {
      orderId: text(shipment?.order_id || fallbackOrderId),
      trackingNumber: shipmentTrackingNumber(shipment) || text(fallbackTrackingNumber),
      shipment: shipment || null,
    },
  }));
}

export default function AdminInternationalTrackingLauncher() {
  const adminRoute = /^\/admin(?:\/|$)/.test(window.location.pathname);
  const [open, setOpen] = useState(false);
  const [arabic, setArabic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [shipmentSearch, setShipmentSearch] = useState("");
  const [form, setForm] = useState<RegistrationForm>(EMPTY_FORM);
  const [center, setCenter] = useState<TrackingCenterData>({ ok: true, shipments: [], webhook_logs: [], quota: null });

  const matchingOrders = useMemo(() => {
    return orders.filter((order) => matchesSearchQuery([
      order.id, orderReference(order), order.coupon_number, order.invoice_number,
      order.merchant_id, order.merchant_code, order.merchant_name,
      order.sender_name, order.sender_phone, order.receiver_name,
      order.receiver_phone, order.sender_city, order.receiver_city,
      order.destination_country,
    ], orderSearch));
  }, [orders, orderSearch]);

  const internationalOrders = useMemo(() => matchingOrders.filter(isInternational), [matchingOrders]);
  const otherOrders = useMemo(() => matchingOrders.filter((order) => !isInternational(order)), [matchingOrders]);

  const visibleShipments = useMemo(() => {
    return center.shipments.filter((shipment) => matchesSearchQuery([
      shipment.tracking_number, shipment.public_tracking_number,
      shipment.carrier_tracking_number, shipment.carrier_tracking_number_full,
      shipment.latest_location, shipment.latest_city, shipment.latest_country,
      shipment.destination_city, shipment.normalized_status,
    ], shipmentSearch));
  }, [center.shipments, shipmentSearch]);

  async function loadCenter(refreshQuota = false) {
    setLoading(true);
    setError("");
    const [ordersResult, centerResult] = await Promise.allSettled([
      fetchAdminOrders(),
      runTrack17Admin<TrackingCenterData>("list", { limit: 100 }),
    ]);

    if (ordersResult.status === "fulfilled") {
      setOrders((ordersResult.value || [])
        .map((order) => normalizeOrder(order as unknown as Record<string, unknown>))
        .filter((order): order is OrderOption => Boolean(order)));
    } else {
      setOrders([]);
      setError(operationMessage(ordersResult.reason, arabic));
    }

    if (centerResult.status === "fulfilled") {
      const next = centerResult.value;
      if (refreshQuota) {
        try {
          const quota = await runTrack17Admin<{ ok: boolean; quota: TrackingCenterData["quota"] }>("quota", { force: true });
          next.quota = quota.quota;
        } catch (cause) {
          setError(operationMessage(cause, arabic));
        }
      }
      setCenter({ ok: true, shipments: next.shipments || [], webhook_logs: next.webhook_logs || [], quota: next.quota || null });
    } else {
      setError(operationMessage(centerResult.reason, arabic));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (adminRoute && open) void loadCenter(false);
  }, [adminRoute, open]);

  if (!adminRoute) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="dn-it-admin-launch"
        onClick={() => setOpen(true)}
        hidden
        aria-hidden="true"
        tabIndex={-1}
      />
    );
  }

  function close() {
    setOpen(false);
    setError("");
    setSuccess("");
  }

  function selectOrder(orderId: string) {
    const order = orders.find((item) => item.id === orderId);
    setForm((current) => ({
      ...current,
      order_id: orderId,
      origin_country: "AE",
      origin_city: order?.sender_city || current.origin_city,
      destination_country: countryCode(order?.destination_country) || current.destination_country,
      destination_city: order?.receiver_city || current.destination_city,
    }));
  }

  async function register() {
    if (!form.order_id || !form.tracking_number.trim()) {
      setError(arabic ? "اختر طلبًا واكتب رقم بوليصة أرامكس." : "Select an order and enter the Aramex AWB.");
      return;
    }

    const savedOrderId = form.order_id;
    const savedTrackingNumber = form.tracking_number.trim();
    setOperation("register");
    setError("");
    setSuccess("");

    try {
      const result = await registerAramexShipment(form);
      if (!result.ok) throw new Error("registration_returned_not_ok");

      const registeredShipment = result.shipment as InternationalShipment | undefined;
      if (registeredShipment) {
        setCenter((current) => ({ ...current, shipments: mergeShipment(current.shipments, registeredShipment) }));
      }

      announceInternationalShipmentUpdate(registeredShipment, savedOrderId, savedTrackingNumber);
      setSuccess(result.already_registered || result.already_registered_at_provider
        ? (arabic
          ? "البوليصة مسجلة ومربوطة بالطلب. أزرار واتساب للعميل والتاجر أصبحت جاهزة بجانب الطلبية الدولية."
          : "The AWB is linked. Customer and merchant WhatsApp actions are now ready beside the international order.")
        : (arabic
          ? "تم تسجيل الشحنة وربطها بالطلب. ظهر زر إرسال التتبع للعميل والتاجر بجانب الطلبية الدولية."
          : "The shipment was registered and linked. Customer and merchant tracking buttons are now available beside the international order."));
      setForm((current) => ({ ...current, tracking_number: "" }));
    } catch (cause) {
      setError(operationMessage(cause, arabic));
    } finally {
      setOperation("");
    }
  }

  async function shipmentAction(action: "sync" | "stop" | "retrack", shipment: InternationalShipment) {
    setOperation(`${action}:${shipment.id}`);
    setError("");
    setSuccess("");
    try {
      let updatedShipment: InternationalShipment | null = null;
      if (action === "sync") {
        const result = await syncAramexShipment(shipment.id);
        updatedShipment = (result.shipment as InternationalShipment | undefined) || shipment;
        if (result.shipment) {
          setCenter((current) => ({ ...current, shipments: mergeShipment(current.shipments, result.shipment as InternationalShipment) }));
        }
      } else {
        await runTrack17Admin(action, { shipment_id: shipment.id });
        await loadCenter(false);
        updatedShipment = shipment;
      }

      announceInternationalShipmentUpdate(updatedShipment, text(shipment.order_id), shipmentTrackingNumber(shipment));
      setSuccess(action === "sync"
        ? (arabic ? "تم تحديث الشحنة ورابط واتساب بجانب الطلبية." : "Shipment and its WhatsApp tracking action were refreshed.")
        : action === "stop"
          ? (arabic ? "تم إيقاف التتبع." : "Tracking stopped.")
          : (arabic ? "تمت إعادة التتبع." : "Tracking restarted."));
    } catch (cause) {
      setError(operationMessage(cause, arabic));
    } finally {
      setOperation("");
    }
  }

  const lastWebhook = center.webhook_logs[0];
  const webhookHealthy = Boolean(lastWebhook?.signature_valid && lastWebhook?.http_result === 200);

  return (
    <div className="dn-it-admin-modal" dir={arabic ? "rtl" : "ltr"} role="dialog" aria-modal="true">
      <button type="button" className="dn-it-admin-shade" onClick={close} aria-label="Close" />
      <section className="dn-it-admin-panel">
        <header className="dn-it-admin-head">
          <div className="dn-it-admin-title-icon"><Plane /></div>
          <div><span>17TRACK V2.4 · ARAMEX</span><h1>{arabic ? "مركز التتبع الدولي" : "International Tracking Center"}</h1><p>{arabic ? "تسجيل بوليصات أرامكس وربطها بطلبات النظام." : "Register Aramex AWBs and link them to system orders."}</p></div>
          <div className="dn-it-admin-head-actions">
            <button type="button" onClick={() => setArabic((value) => !value)}>{arabic ? "EN" : "ع"}</button>
            <button type="button" onClick={() => void loadCenter(true)} disabled={loading}>{loading ? <Loader2 className="dn-it-admin-spin" /> : <RefreshCw />}</button>
            <button type="button" onClick={close}><X /></button>
          </div>
        </header>

        <div className="dn-it-admin-scroll">
          <section className="dn-it-admin-kpis">
            <article><span><ShieldCheck /></span><small>{arabic ? "حالة API" : "API status"}</small><b className="is-good">{arabic ? "المفتاح على الخادم" : "Server secured"}</b></article>
            <article><span><Gauge /></span><small>{arabic ? "الرصيد المتبقي" : "Remaining quota"}</small><b>{center.quota?.quota_remain ?? "—"}</b></article>
            <article><span><Activity /></span><small>{arabic ? "مستهلك اليوم" : "Used today"}</small><b>{center.quota?.today_used ?? "—"}</b></article>
            <article><span><Webhook /></span><small>{arabic ? "صحة Webhook" : "Webhook health"}</small><b className={webhookHealthy ? "is-good" : "is-warn"}>{webhookHealthy ? (arabic ? "سليم" : "Healthy") : (arabic ? "بانتظار البيانات" : "Awaiting data")}</b></article>
            <article><span><PackagePlus /></span><small>{arabic ? "طلبات النظام" : "System orders"}</small><b>{orders.length}</b></article>
          </section>

          {(error || success) && <div className={`dn-it-admin-message ${error ? "is-error" : "is-success"}`}>{error ? <AlertCircle /> : <CheckCircle2 />}<span>{error || success}</span><button type="button" onClick={() => { setError(""); setSuccess(""); }}><X /></button></div>}

          <section className="dn-it-admin-register">
            <header><PackagePlus /><div><small>REGISTER & LINK</small><h2>{arabic ? "تسجيل بوليصة أرامكس" : "Register an Aramex AWB"}</h2></div></header>
            <div className="dn-it-admin-form">
              <label className="is-wide"><span>{arabic ? `بحث في الطلبات (${orders.length})` : `Search orders (${orders.length})`}</span><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder={arabic ? "رقم الطلب، المدينة أو اسم المستلم" : "Order number, city or receiver"} /></label>
              <label className="is-wide"><span>{arabic ? "اختر الطلب" : "Select order"}</span><select value={form.order_id} onChange={(event) => selectOrder(event.target.value)}><option value="">{loading ? (arabic ? "جاري التحميل…" : "Loading…") : (arabic ? "اختر الطلب" : "Select order")}</option>{internationalOrders.length > 0 && <optgroup label={arabic ? `الطلبات الدولية (${internationalOrders.length})` : `International orders (${internationalOrders.length})`}>{internationalOrders.map((order) => <option key={order.id} value={order.id}>
                          {arabic ? "دولي" : "International"} · {orderReference(order)} · {order.sender_city || "—"} → {internationalDestinationLabel(order.destination_country || order.receiver_city, arabic)}
                        </option>)}</optgroup>}{otherOrders.length > 0 && <optgroup label={arabic ? `باقي الطلبات (${otherOrders.length})` : `Other orders (${otherOrders.length})`}>{otherOrders.map((order) => <option key={order.id} value={order.id}>
                          {arabic ? "طلب محلي" : "Local order"} · {orderReference(order)} · {order.sender_city || "—"} → {order.receiver_city || "—"}
                        </option>)}</optgroup>}</select></label>
              <label className="is-wide"><span>Aramex AWB</span><input dir="ltr" value={form.tracking_number} onChange={(event) => setForm({ ...form, tracking_number: event.target.value.toUpperCase() })} placeholder="37313304803" /></label>
              <label><span>{arabic ? "دولة المنشأ" : "Origin country"}</span><select value={normalizeInternationalDestination(form.origin_country, "AE")} onChange={(event) => setForm({ ...form, origin_country: event.target.value })}>{INTERNATIONAL_DESTINATIONS.map((country) => <option key={country.value} value={country.value}>{arabic ? country.ar : country.en}</option>)}</select></label>
              <label><span>{arabic ? "مدينة المنشأ" : "Origin city"}</span><input value={form.origin_city} onChange={(event) => setForm({ ...form, origin_city: event.target.value })} placeholder="Ajman" /></label>
              <label><span>{arabic ? "دولة الوجهة" : "Destination country"}</span><select value={normalizeInternationalDestination(form.destination_country, "SA")} onChange={(event) => setForm({ ...form, destination_country: event.target.value })}>{INTERNATIONAL_DESTINATIONS.filter((country) => country.value !== "AE").map((country) => <option key={country.value} value={country.value}>{arabic ? country.ar : country.en}</option>)}</select></label>
              <label><span>{arabic ? "مدينة الوجهة" : "Destination city"}</span><input value={form.destination_city} onChange={(event) => setForm({ ...form, destination_city: event.target.value })} placeholder="Riyadh" /></label>
              <label className="is-wide"><span>{arabic ? "تاريخ الشحن" : "Ship date"}</span><input type="date" value={form.ship_date} onChange={(event) => setForm({ ...form, ship_date: event.target.value })} /></label>
              <button type="button" className="dn-it-admin-primary" onClick={() => void register()} disabled={Boolean(operation) || !form.order_id || !form.tracking_number.trim()}>{operation === "register" ? <Loader2 className="dn-it-admin-spin" /> : <PackagePlus />}{arabic ? "تسجيل وربط الشحنة" : "Register and link shipment"}</button>
            </div>
          </section>

          <section className="dn-it-admin-list">
            <header><div><span>LIVE OPERATIONS</span><h2>{arabic ? "شحنات أرامكس الدولية" : "International Aramex shipments"}</h2></div><label><Search /><input value={shipmentSearch} onChange={(event) => setShipmentSearch(event.target.value)} placeholder={arabic ? "بحث بالرقم أو الموقع" : "Search number or location"} /></label></header>
            {loading && !center.shipments.length ? <div className="dn-it-admin-loading"><Loader2 /><span>{arabic ? "تحميل بيانات التتبع…" : "Loading tracking data…"}</span></div> : !visibleShipments.length ? <div className="dn-it-admin-empty"><Plane /><b>{arabic ? "لا توجد شحنات مسجلة" : "No registered shipments"}</b><p>{arabic ? "اختر طلبًا وسجّل بوليصة أرامكس." : "Select an order and register its Aramex AWB."}</p></div> : <div className="dn-it-admin-cards">{visibleShipments.map((shipment) => { const busy = operation.endsWith(`:${shipment.id}`); return <article key={shipment.id}><div className="dn-it-admin-card-top"><div><small>ARAMEX AWB</small><b dir="ltr">{shipment.tracking_number || shipment.carrier_tracking_number_full || "—"}</b><span>{shipment.public_tracking_number || "—"}</span></div><i className={`is-${shipment.normalized_status || "unknown"}`}>{statusLabel(shipment.normalized_status, arabic)}</i></div><div className="dn-it-admin-route"><span>{shipment.origin_city || shipment.origin_country || "UAE"}</span><Plane /><span>{shipment.destination_city || internationalDestinationLabel(shipment.destination_country, arabic)}</span></div><dl><div><dt>{arabic ? "آخر موقع" : "Latest location"}</dt><dd>{shipment.latest_location || "—"}</dd></div><div><dt>{arabic ? "آخر تحديث" : "Last update"}</dt><dd>{displayDate(shipment.latest_update_at, arabic)}</dd></div></dl><div className="dn-it-admin-card-actions"><button type="button" onClick={() => void shipmentAction("sync", shipment)} disabled={busy}>{operation === `sync:${shipment.id}` ? <Loader2 className="dn-it-admin-spin" /> : <RefreshCw />}{arabic ? "مزامنة" : "Sync"}</button><button type="button" onClick={() => void navigator.clipboard.writeText(internationalTrackingUrl(shipment.public_tracking_number || shipment.tracking_number || ""))}><Copy />{arabic ? "نسخ الرابط" : "Copy link"}</button><a href={internationalTrackingUrl(shipment.public_tracking_number || shipment.tracking_number || "")} target="_blank" rel="noreferrer"><Link2 />{arabic ? "فتح" : "Open"}</a>{shipment.tracking_stopped_at ? <button type="button" onClick={() => void shipmentAction("retrack", shipment)} disabled={busy}><RotateCcw />{arabic ? "إعادة التتبع" : "Retrack"}</button> : <button type="button" className="is-danger" onClick={() => void shipmentAction("stop", shipment)} disabled={busy}><Square />{arabic ? "إيقاف" : "Stop"}</button>}</div></article>; })}</div>}
          </section>
        </div>
      </section>
    </div>
  );
}
