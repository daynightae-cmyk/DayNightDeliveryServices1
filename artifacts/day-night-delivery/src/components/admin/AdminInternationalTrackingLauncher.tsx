import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
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
import { fetchAdminOrders } from "../../lib/adminData";
import {
  internationalTrackingUrl,
  registerAramexShipment,
  runTrack17Admin,
  syncAramexShipment,
  type InternationalShipment,
  type TrackingOperationError,
} from "../../lib/internationalTrackingApi";
import "../../styles/dn-international-admin.css";

const TRACKING_NAV_SELECTOR = '[data-dn-command-section="external"]';

type WebhookLog = {
  id: string;
  event_type?: string | null;
  tracking_number?: string | null;
  signature_valid?: boolean | null;
  processing_status?: string | null;
  http_result?: number | null;
  error_code?: string | null;
  received_at?: string | null;
};

type AdminListResponse = {
  ok: boolean;
  shipments: InternationalShipment[];
  webhook_logs: WebhookLog[];
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
  coupon_number?: string | null;
  sender_city?: string | null;
  receiver_city?: string | null;
  destination_country?: string | null;
  shipping_scope?: string | null;
  service_type?: string | null;
  receiver_name?: string | null;
  status?: string | null;
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

const INITIAL_FORM: RegistrationForm = {
  order_id: "",
  tracking_number: "",
  origin_country: "AE",
  origin_city: "",
  destination_country: "",
  destination_city: "",
  ship_date: "",
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeOrder(order: Record<string, unknown>): OrderOption | null {
  const id = clean(order.id);
  if (!id) return null;
  return {
    id,
    tracking_code: clean(order.tracking_code) || null,
    tracking_number: clean(order.tracking_number) || null,
    invoice_number: clean(order.invoice_number) || null,
    coupon_number: clean(order.coupon_number) || null,
    sender_city: clean(order.sender_city) || null,
    receiver_city: clean(order.receiver_city) || null,
    destination_country: clean(order.destination_country) || null,
    shipping_scope: clean(order.shipping_scope) || null,
    service_type: clean(order.service_type) || null,
    receiver_name: clean(order.receiver_name) || null,
    status: clean(order.status) || null,
  };
}

function orderReference(order: OrderOption) {
  return order.tracking_code || order.tracking_number || order.invoice_number || order.coupon_number || order.id;
}

function isInternationalOrder(order: OrderOption) {
  const scope = `${order.shipping_scope || ""} ${order.service_type || ""}`.toLowerCase();
  if (/international|global|worldwide|external/.test(scope)) return true;
  const destination = clean(order.destination_country).toUpperCase();
  return Boolean(destination && !["AE", "UAE", "UNITED ARAB EMIRATES", "الإمارات", "الامارات"].includes(destination));
}

function normalizeCountryCode(value: unknown) {
  const raw = clean(value).toUpperCase();
  const map: Record<string, string> = {
    "UNITED ARAB EMIRATES": "AE",
    UAE: "AE",
    EMIRATES: "AE",
    "SAUDI ARABIA": "SA",
    KSA: "SA",
    SAUDI: "SA",
    "المملكة العربية السعودية": "SA",
    السعودية: "SA",
    RIYADH: "SA",
  };
  return map[raw] || raw.slice(0, 3);
}

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

function formatDate(value?: string | null, isArabic = true) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(isArabic ? "ar-AE" : "en-AE");
}

function operationErrorText(cause: unknown, isArabic: boolean) {
  const error = cause as TrackingOperationError | undefined;
  const code = clean(error?.code);
  const details = clean(error?.details);
  const rawMessage = clean(error?.message || cause);
  const combined = `${code} ${details} ${rawMessage}`.toLowerCase();

  const known: Array<[RegExp, string, string]> = [
    [/international_shipments|schema cache|shipment_list_failed/, "جداول التتبع الدولي غير موجودة في قاعدة البيانات. طبّق هجرة إصلاح Track17.", "The international tracking tables are missing. Apply the Track17 schema repair migration."],
    [/not_authenticated|jwt|session/, "انتهت جلسة المدير. سجّل الخروج ثم الدخول مرة واحدة.", "The administrator session has expired. Sign out and in once."],
    [/not_authorized|403/, "الحساب الحالي لا يحمل صلاحية مدير في جدول profiles.", "The current account does not have an administrator role."],
    [/track17_api_key_missing/, "مفتاح TRACK17_API_KEY غير متاح داخل وظيفة Supabase.", "TRACK17_API_KEY is unavailable inside the Supabase Function."],
    [/invalid_order_id/, "معرّف الطلب المختار غير صالح لقاعدة البيانات.", "The selected order ID is invalid."],
    [/order_not_found/, "الطلب المختار غير موجود في قاعدة البيانات.", "The selected order was not found."],
    [/track17_registration_rejected/, "رفض 17TRACK تسجيل رقم البوليصة.", "17TRACK rejected the AWB registration."],
    [/shipment_insert_failed/, "تم الوصول إلى 17TRACK لكن تعذر حفظ الشحنة في قاعدة البيانات.", "17TRACK was reached, but the shipment could not be saved."],
    [/carrier_mismatch/, "أعاد 17TRACK ناقلًا غير أرامكس لهذا الرقم.", "17TRACK returned a carrier other than Aramex."],
    [/function_timeout|timeout/, "انتهت مهلة الاتصال بخدمة التتبع. أعد المحاولة مرة واحدة.", "The tracking request timed out. Retry once."],
    [/failed to fetch|network|cors/, "تعذر الوصول إلى وظيفة Supabase من المتصفح.", "The browser could not reach the Supabase Function."],
  ];

  const match = known.find(([pattern]) => pattern.test(combined));
  const primary = match ? match[isArabic ? 1 : 2] : (isArabic ? "تعذر تنفيذ عملية التتبع الدولي." : "The international tracking operation failed.");
  const technical = [code, details || (!match ? rawMessage : "")].filter(Boolean).join(" — ");
  return technical ? `${primary} [${technical}]` : primary;
}

function upsertShipment(rows: InternationalShipment[], shipment: InternationalShipment) {
  return [shipment, ...rows.filter((row) => row.id !== shipment.id)].slice(0, 100);
}

export default function AdminInternationalTrackingLauncher() {
  const visible = /^\/admin(?:\/|$)/.test(window.location.pathname);
  const [open, setOpen] = useState(false);
  const [isArabic, setIsArabic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<AdminListResponse>({ ok: true, shipments: [], webhook_logs: [], quota: null });
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<RegistrationForm>(INITIAL_FORM);

  const matchingOrders = useMemo(() => {
    const needle = orderSearch.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((order) => [
      orderReference(order), order.sender_city, order.receiver_city,
      order.destination_country, order.receiver_name, order.status,
    ].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [orders, orderSearch]);

  const internationalOrders = useMemo(() => matchingOrders.filter(isInternationalOrder), [matchingOrders]);
  const systemOrders = useMemo(() => matchingOrders.filter((order) => !isInternationalOrder(order)), [matchingOrders]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data.shipments;
    return data.shipments.filter((shipment) => [
      shipment.public_tracking_number, shipment.tracking_number,
      shipment.carrier_tracking_number_full, shipment.latest_location,
      shipment.destination_city, shipment.destination_country,
    ].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [data.shipments, search]);

  async function load(refreshQuota = false, preserveMessage = false) {
    setLoading(true);
    if (!preserveMessage) {
      setError("");
      setSuccess("");
    }

    const [ordersResult, listResult] = await Promise.allSettled([
      fetchAdminOrders(),
      runTrack17Admin<AdminListResponse>("list", { limit: 100 }),
    ]);

    if (ordersResult.status === "fulfilled") {
      const normalized = (ordersResult.value || [])
        .map((order) => normalizeOrder(order as unknown as Record<string, unknown>))
        .filter((order): order is OrderOption => Boolean(order));
      setOrders(normalized);
    } else if (!preserveMessage) {
      setOrders([]);
      setError(operationErrorText(ordersResult.reason, isArabic));
    }

    if (listResult.status === "fulfilled") {
      const list = listResult.value;
      if (refreshQuota) {
        try {
          const quotaResult = await runTrack17Admin<{ ok: boolean; quota: AdminListResponse["quota"] }>("quota", { force: true });
          list.quota = quotaResult.quota;
        } catch (cause) {
          if (!preserveMessage) setError(operationErrorText(cause, isArabic));
        }
      }
      setData({
        ok: true,
        shipments: list.shipments || [],
        webhook_logs: list.webhook_logs || [],
        quota: list.quota || null,
      });
    } else if (!preserveMessage) {
      setError(operationErrorText(listResult.reason, isArabic));
    }

    setLoading(false);
  }

  // The old floating button has been removed completely. The existing fixed
  // sidebar item "International Orders" is now the sole entry point for this
  // center, so it is present from the first normal admin render.
  useEffect(() => {
    if (!visible) return;

    const applySidebarLabel = () => {
      document.querySelectorAll<HTMLElement>(TRACKING_NAV_SELECTOR).forEach((button) => {
        const strong = button.querySelector("strong");
        const small = button.querySelector("small");
        if (strong) strong.textContent = isArabic ? "التتبع الدولي" : "International Tracking";
        if (small) small.textContent = isArabic ? "International Tracking" : "التتبع الدولي";
        button.classList.toggle("is-active", open);
        button.setAttribute("aria-current", open ? "page" : "false");
      });
    };

    const handleSidebarClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest(TRACKING_NAV_SELECTOR) : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(true);
    };

    applySidebarLabel();
    const observer = new MutationObserver(applySidebarLabel);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleSidebarClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleSidebarClick, true);
    };
  }, [visible, isArabic, open]);

  useEffect(() => {
    if (visible && open) void load(false);
  }, [visible, open]);

  if (!visible || !open) return null;

  function closeCenter() {
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
      destination_country: normalizeCountryCode(order?.destination_country) || current.destination_country,
      destination_city: order?.receiver_city || current.destination_city,
    }));
  }

  async function register() {
    if (!form.order_id || !form.tracking_number.trim()) {
      setError(isArabic ? "اختر طلبًا واكتب رقم بوليصة أرامكس." : "Select an order and enter the Aramex AWB.");
      return;
    }

    setOperation("register");
    setError("");
    setSuccess("");
    try {
      const result = await registerAramexShipment(form);
      if (!result?.ok) throw new Error("registration_returned_not_ok");
      if (result.shipment) {
        setData((current) => ({ ...current, shipments: upsertShipment(current.shipments, result.shipment as InternationalShipment) }));
      }
      const already = Boolean(result.already_registered || result.already_registered_at_provider);
      const warning = clean(result.sync_warning);
      setSuccess(already
        ? (isArabic ? "البوليصة مسجلة مسبقًا وتم ربطها وعرضها بنجاح." : "The AWB was already registered and is now linked and displayed.")
        : warning
          ? (isArabic ? `تم تسجيل وربط الشحنة. المزامنة الأولى مؤجلة: ${warning}` : `Shipment registered and linked. Initial sync is pending: ${warning}`)
          : (isArabic ? "تم تسجيل شحنة أرامكس وربطها بالطلب بنجاح." : "The Aramex shipment was registered and linked successfully."));
      setForm((current) => ({ ...current, tracking_number: "" }));
    } catch (cause) {
      setError(operationErrorText(cause, isArabic));
    } finally {
      setOperation("");
    }
  }

  async function shipmentAction(action: "sync" | "stop" | "retrack", shipment: InternationalShipment) {
    setOperation(`${action}:${shipment.id}`);
    setError("");
    setSuccess("");
    try {
      if (action === "sync") {
        const result = await syncAramexShipment(shipment.id);
        if (result.shipment) setData((current) => ({ ...current, shipments: upsertShipment(current.shipments, result.shipment as InternationalShipment) }));
      } else {
        await runTrack17Admin(action, { shipment_id: shipment.id });
      }
      setSuccess(action === "sync"
        ? (isArabic ? "تم تحديث بيانات الشحنة." : "Shipment data updated.")
        : action === "stop"
          ? (isArabic ? "تم إيقاف التتبع." : "Tracking stopped.")
          : (isArabic ? "تمت إعادة التتبع." : "Tracking restarted."));
      if (action !== "sync") void load(false, true);
    } catch (cause) {
      setError(operationErrorText(cause, isArabic));
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
    <div className="dn-it-admin-modal" dir={isArabic ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-label={isArabic ? "مركز تتبع أرامكس" : "Aramex tracking center"}>
      <button type="button" className="dn-it-admin-shade" onClick={closeCenter} aria-label="Close" />
      <section className="dn-it-admin-panel">
        <header className="dn-it-admin-head">
          <div className="dn-it-admin-title-icon"><Plane /></div>
          <div><span>17TRACK V2.4 · ARAMEX</span><h1>{isArabic ? "مركز التتبع الدولي" : "International Tracking Center"}</h1><p>{isArabic ? "تسجيل بوليصات أرامكس وربطها مباشرة بطلبات النظام." : "Register Aramex AWBs and link them directly to system orders."}</p></div>
          <div className="dn-it-admin-head-actions">
            <button type="button" onClick={() => setIsArabic((value) => !value)}>{isArabic ? "EN" : "ع"}</button>
            <button type="button" onClick={() => void load(true)} disabled={loading}>{loading ? <Loader2 className="dn-it-admin-spin" /> : <RefreshCw />}</button>
            <button type="button" onClick={closeCenter}><X /></button>
          </div>
        </header>

        <div className="dn-it-admin-scroll">
          <section className="dn-it-admin-kpis">
            <article><span><ShieldCheck /></span><small>{isArabic ? "حالة API" : "API status"}</small><b className="is-good">{isArabic ? "المفتاح على الخادم" : "Server secured"}</b></article>
            <article><span><Gauge /></span><small>{isArabic ? "الرصيد المتبقي" : "Remaining quota"}</small><b>{quota?.quota_remain ?? "—"}</b></article>
            <article><span><Activity /></span><small>{isArabic ? "مستهلك اليوم" : "Used today"}</small><b>{quota?.today_used ?? "—"}</b></article>
            <article><span><Webhook /></span><small>{isArabic ? "صحة Webhook" : "Webhook health"}</small><b className={healthyWebhook ? "is-good" : "is-warn"}>{healthyWebhook ? (isArabic ? "سليم" : "Healthy") : (isArabic ? "بانتظار البيانات" : "Awaiting data")}</b></article>
            <article><span><Globe2 /></span><small>{isArabic ? "طلبات النظام" : "System orders"}</small><b>{orders.length}</b></article>
          </section>

          {(error || success) && <div className={`dn-it-admin-message ${error ? "is-error" : "is-success"}`}>{error ? <AlertCircle /> : <CheckCircle2 />}<span>{error || success}</span><button type="button" onClick={() => { setError(""); setSuccess(""); }}><X /></button></div>}

          <section className="dn-it-admin-register">
            <header><PackagePlus /><div><small>{isArabic ? "إضافة وربط" : "REGISTER & LINK"}</small><h2>{isArabic ? "تسجيل بوليصة أرامكس" : "Register an Aramex AWB"}</h2></div></header>
            <div className="dn-it-admin-form">
              <label className="is-wide"><span>{isArabic ? `بحث في طلبات النظام (${orders.length})` : `Search system orders (${orders.length})`}</span><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder={isArabic ? "رقم الطلب، الفاتورة، المدينة أو اسم المستلم" : "Order number, invoice, city or receiver"} /></label>
              <label className="is-wide">
                <span>{isArabic ? "اختر الطلب الدولي أو أي طلب من النظام" : "Select an international or system order"}</span>
                <select value={form.order_id} onChange={(event) => selectOrder(event.target.value)}>
                  <option value="">{loading ? (isArabic ? "جاري تحميل الطلبات…" : "Loading orders…") : (isArabic ? "اختر الطلب" : "Select order")}</option>
                  {internationalOrders.length > 0 && <optgroup label={isArabic ? `الطلبات الدولية (${internationalOrders.length})` : `International orders (${internationalOrders.length})`}>{internationalOrders.map((order) => <option value={order.id} key={order.id}>دولي · {orderReference(order)} · {order.sender_city || "—"} → {order.receiver_city || order.destination_country || "—"}</option>)}</optgroup>}
                  {systemOrders.length > 0 && <optgroup label={isArabic ? `باقي طلبات النظام (${systemOrders.length})` : `Other system orders (${systemOrders.length})`}>{systemOrders.map((order) => <option value={order.id} key={order.id}>نظام · {orderReference(order)} · {order.sender_city || "—"} → {order.receiver_city || "—"}</option>)}</optgroup>}
                  {!loading && !matchingOrders.length && <option value="" disabled>{isArabic ? "لا توجد نتائج مطابقة" : "No matching orders"}</option>}
                </select>
              </label>
              <label className="is-wide"><span>{isArabic ? "رقم بوليصة أرامكس AWB" : "Aramex AWB"}</span><input dir="ltr" value={form.tracking_number} onChange={(event) => setForm({ ...form, tracking_number: event.target.value.toUpperCase() })} placeholder="37313304803" /></label>
              <label><span>{isArabic ? "دولة المنشأ" : "Origin country"}</span><input dir="ltr" maxLength={3} value={form.origin_country} onChange={(event) => setForm({ ...form, origin_country: event.target.value.toUpperCase() })} placeholder="AE" /></label>
              <label><span>{isArabic ? "مدينة المنشأ" : "Origin city"}</span><input value={form.origin_city} onChange={(event) => setForm({ ...form, origin_city: event.target.value })} placeholder="Ajman" /></label>
              <label><span>{isArabic ? "دولة الوجهة" : "Destination country"}</span><input dir="ltr" maxLength={3} value={form.destination_country} onChange={(event) => setForm({ ...form, destination_country: event.target.value.toUpperCase() })} placeholder="SA" /></label>
              <label><span>{isArabic ? "مدينة الوجهة" : "Destination city"}</span><input value={form.destination_city} onChange={(event) => setForm({ ...form, destination_city: event.target.value })} placeholder="Riyadh" /></label>
              <label className="is-wide"><span>{isArabic ? "تاريخ الشحن (اختياري)" : "Ship date (optional)"}</span><input type="date" value={form.ship_date} onChange={(event) => setForm({ ...form, ship_date: event.target.value })} /></label>
              <button type="button" className="dn-it-admin-primary" onClick={() => void register()} disabled={Boolean(operation) || !form.order_id || !form.tracking_number.trim()}>{operation === "register" ? <Loader2 className="dn-it-admin-spin" /> : <PackagePlus />}{isArabic ? "تسجيل وربط الشحنة" : "Register and link shipment"}</button>
            </div>
          </section>

          <section className="dn-it-admin-list">
            <header><div><span>{isArabic ? "العمليات الحية" : "LIVE OPERATIONS"}</span><h2>{isArabic ? "شحنات أرامكس الدولية" : "International Aramex shipments"}</h2></div><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isArabic ? "بحث بالرقم أو الموقع" : "Search number or location"} /></label></header>
            {loading && !data.shipments.length
              ? <div className="dn-it-admin-loading"><Loader2 /><span>{isArabic ? "تحميل بيانات التتبع…" : "Loading tracking data…"}</span></div>
              : !filtered.length
                ? <div className="dn-it-admin-empty"><Plane /><b>{isArabic ? "لا توجد شحنات مسجلة" : "No registered shipments"}</b><p>{isArabic ? "اختر طلبًا من النظام وسجّل بوليصة أرامكس من النموذج بالأعلى." : "Select a system order and register its Aramex AWB above."}</p></div>
                : <div className="dn-it-admin-cards">{filtered.map((shipment) => {
                    const busy = operation.endsWith(`:${shipment.id}`);
                    return <article key={shipment.id}>
                      <div className="dn-it-admin-card-top"><div><small>ARAMEX AWB</small><b dir="ltr">{shipment.tracking_number || shipment.carrier_tracking_number_full || "—"}</b><span>{shipment.public_tracking_number || "—"}</span></div><i className={`is-${shipment.normalized_status || "unknown"}`}>{statusLabel(shipment.normalized_status, isArabic)}</i></div>
                      <div className="dn-it-admin-route"><span>{shipment.origin_city || shipment.origin_country || "UAE"}</span><Plane /><span>{shipment.destination_city || shipment.destination_country || "—"}</span></div>
                      <dl><div><dt>{isArabic ? "آخر موقع" : "Latest location"}</dt><dd>{shipment.latest_location || "—"}</dd></div><div><dt>{isArabic ? "آخر تحديث" : "Last update"}</dt><dd>{formatDate(shipment.latest_update_at, isArabic)}</dd></div><div><dt>Webhook</dt><dd>{formatDate(shipment.last_webhook_at, isArabic)}</dd></div><div><dt>{isArabic ? "مزامنة" : "Sync"}</dt><dd>{formatDate(shipment.last_synced_at, isArabic)}</dd></div></dl>
                      <div className="dn-it-admin-card-actions"><button type="button" onClick={() => void shipmentAction("sync", shipment)} disabled={busy}>{operation === `sync:${shipment.id}` ? <Loader2 className="dn-it-admin-spin" /> : <RefreshCw />}{isArabic ? "مزامنة" : "Sync"}</button><button type="button" onClick={() => void copyTracking(shipment)}><Copy />{isArabic ? "نسخ الرابط" : "Copy link"}</button><a href={internationalTrackingUrl(shipment.public_tracking_number || shipment.tracking_number || "")} target="_blank" rel="noreferrer"><Link2 />{isArabic ? "فتح" : "Open"}</a>{shipment.tracking_stopped_at ? <button type="button" onClick={() => void shipmentAction("retrack", shipment)} disabled={busy}><RotateCcw />{isArabic ? "إعادة التتبع" : "Retrack"}</button> : <button type="button" className="is-danger" onClick={() => void shipmentAction("stop", shipment)} disabled={busy}><Square />{isArabic ? "إيقاف" : "Stop"}</button>}</div>
                    </article>;
                  })}</div>}
          </section>

          <section className="dn-it-admin-webhooks">
            <header><Webhook /><div><small>17TRACK CALLBACKS</small><h2>{isArabic ? "آخر تحديثات Webhook" : "Latest webhook activity"}</h2></div></header>
            <div>{data.webhook_logs.length ? data.webhook_logs.map((log) => <article key={log.id}><span className={log.signature_valid ? "is-good" : "is-bad"}>{log.signature_valid ? <ShieldCheck /> : <AlertCircle />}</span><div><b>{log.event_type || "TRACKING_UPDATED"}</b><small dir="ltr">{log.tracking_number || "Test webhook"}</small></div><i>{log.processing_status || "received"}</i><time>{formatDate(log.received_at, isArabic)}</time></article>) : <p>{isArabic ? "لا توجد تحديثات Webhook معروضة بعد." : "No webhook activity is displayed yet."}</p>}</div>
          </section>
        </div>
      </section>
    </div>
  );
}
