import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  Headphones,
  Languages,
  MapPin,
  Navigation,
  PackageCheck,
  Plane,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
  Weight,
  X,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";
import {
  fetchInternationalTracking,
  internationalTrackingUrl,
  type InternationalShipment,
  type InternationalTrackingEvent,
} from "../lib/internationalTrackingApi";
import "../styles/dn-international-tracking.css";

const statusCopy: Record<string, { ar: string; en: string; stage: number; tone: string }> = {
  not_found: { ar: "لم يتم العثور على الشحنة", en: "Shipment not found", stage: 0, tone: "danger" },
  information_received: { ar: "تم استلام بيانات الشحنة", en: "Information received", stage: 1, tone: "info" },
  picked_up: { ar: "تم استلام الشحنة من المرسل", en: "Shipment picked up", stage: 2, tone: "info" },
  departed_origin: { ar: "غادرت الشحنة بلد المنشأ", en: "Departed origin", stage: 3, tone: "info" },
  in_transit: { ar: "الشحنة في الطريق", en: "In transit", stage: 4, tone: "info" },
  customs_clearance: { ar: "قيد التخليص الجمركي", en: "Customs clearance", stage: 5, tone: "warning" },
  customs_exception: { ar: "توجد ملاحظة جمركية", en: "Customs attention required", stage: 5, tone: "warning" },
  arrived_destination: { ar: "وصلت إلى بلد الوجهة", en: "Arrived at destination", stage: 6, tone: "info" },
  available_for_pickup: { ar: "جاهزة للاستلام", en: "Available for pickup", stage: 7, tone: "info" },
  out_for_delivery: { ar: "خرجت للتسليم", en: "Out for delivery", stage: 8, tone: "info" },
  delivery_failed: { ar: "تعذر التسليم", en: "Delivery attempt failed", stage: 8, tone: "danger" },
  delivered: { ar: "تم تسليم الشحنة", en: "Delivered", stage: 9, tone: "success" },
  exception: { ar: "يوجد تنبيه على الشحنة", en: "Shipment exception", stage: 4, tone: "warning" },
  expired: { ar: "انتهت مدة التتبع", en: "Tracking expired", stage: 0, tone: "warning" },
  returned: { ar: "الشحنة مرتجعة", en: "Returned", stage: 8, tone: "danger" },
  cancelled: { ar: "تم إلغاء الشحنة", en: "Cancelled", stage: 0, tone: "danger" },
  unknown: { ar: "جاري تحديث الحالة", en: "Status updating", stage: 0, tone: "neutral" },
};

const journeySteps = [
  { key: "information_received", ar: "استلام البيانات", en: "Information" },
  { key: "picked_up", ar: "استلام الشحنة", en: "Picked up" },
  { key: "departed_origin", ar: "مغادرة المنشأ", en: "Origin departure" },
  { key: "in_transit", ar: "في الطريق", en: "In transit" },
  { key: "customs_clearance", ar: "الجمارك", en: "Customs" },
  { key: "arrived_destination", ar: "بلد الوجهة", en: "Destination" },
  { key: "out_for_delivery", ar: "خرجت للتسليم", en: "Out for delivery" },
  { key: "delivered", ar: "تم التسليم", en: "Delivered" },
];

function dateTime(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function place(city?: string | null, country?: string | null) {
  return [city, country].filter(Boolean).join(", ") || "—";
}

function normalizedStatus(shipment?: InternationalShipment | null) {
  return String(shipment?.normalized_status || "unknown").toLowerCase();
}

function statusDetails(shipment?: InternationalShipment | null) {
  return statusCopy[normalizedStatus(shipment)] || statusCopy.unknown;
}

function eventTitle(event: InternationalTrackingEvent, isArabic: boolean) {
  const descriptor = statusCopy[String(event.status || "unknown").toLowerCase()] || statusCopy.unknown;
  return isArabic
    ? event.description_ar || descriptor.ar
    : event.description || event.provider_sub_status || descriptor.en;
}

function RouteMap({ shipment, isArabic }: { shipment: InternationalShipment; isArabic: boolean }) {
  const origin = shipment.origin || { city: shipment.origin_city, country: shipment.origin_country };
  const destination = shipment.destination || { city: shipment.destination_city, country: shipment.destination_country };
  const progress = Math.max(8, Math.min(96, (statusDetails(shipment).stage / 9) * 100));

  return (
    <section className="dn-it-map" aria-label={isArabic ? "المسار التقريبي للشحنة" : "Approximate shipment route"}>
      <div className="dn-it-world-grid" aria-hidden="true" />
      <div className="dn-it-route-line" aria-hidden="true">
        <span className="dn-it-route-progress" style={{ width: `${progress}%` }} />
        <span className="dn-it-route-plane" style={{ insetInlineStart: `calc(${progress}% - 18px)` }}><Plane /></span>
      </div>
      <div className="dn-it-map-point dn-it-map-origin">
        <span><MapPin /></span>
        <small>{isArabic ? "المنشأ" : "Origin"}</small>
        <strong>{place(origin?.city, origin?.country)}</strong>
      </div>
      <div className="dn-it-map-point dn-it-map-current">
        <span><Navigation /></span>
        <small>{isArabic ? "آخر نقطة مسجلة" : "Latest checkpoint"}</small>
        <strong>{shipment.latest_location || place(shipment.latest_city, shipment.latest_country)}</strong>
      </div>
      <div className="dn-it-map-point dn-it-map-destination">
        <span><PackageCheck /></span>
        <small>{isArabic ? "الوجهة" : "Destination"}</small>
        <strong>{place(destination?.city, destination?.country)}</strong>
      </div>
    </section>
  );
}

export default function InternationalTrackingPage() {
  const { language, toggleLanguage, theme } = useAppContext();
  const isArabic = language === "ar";
  const isLight = theme === "light";
  const locale = isArabic ? "ar-AE" : "en-AE";
  const initialNumber = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("number") || "" : "";
  const [query, setQuery] = useState(initialNumber);
  const [shipment, setShipment] = useState<InternationalShipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanTimer = useRef<number | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const lastSuccessfulReference = useRef("");

  const descriptor = statusDetails(shipment);
  const currentStage = descriptor.stage;
  const events = useMemo(() => [...(shipment?.events || [])].sort((a, b) => {
    return Date.parse(b.event_time || "") - Date.parse(a.event_time || "");
  }), [shipment?.events]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = isArabic
      ? "تتبع الشحن الدولي وأرامكس | DAY NIGHT"
      : "International & Aramex Tracking | DAY NIGHT";

    const description = isArabic
      ? "تتبع شحنتك الدولية مع أرامكس داخل DAY NIGHT برقم البوليصة أو رقم الطلب، مع خط زمني وآخر نقطة مسجلة."
      : "Track international Aramex shipments inside DAY NIGHT using an AWB or order number, with checkpoints and a complete timeline.";
    const canonical = `${window.location.origin}/international-tracking`;
    const ensureMeta = (selector: string, attributes: Record<string, string>) => {
      let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!element) {
        element = document.createElement(attributes.rel ? "link" : "meta");
        document.head.appendChild(element);
      }
      Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
      return element;
    };
    ensureMeta('meta[name="description"]', { name: "description", content: description });
    ensureMeta('meta[property="og:title"]', { property: "og:title", content: document.title });
    ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
    ensureMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    ensureMeta('link[rel="canonical"]', { rel: "canonical", href: canonical });

    let schema = document.getElementById("dn-international-tracking-schema") as HTMLScriptElement | null;
    if (!schema) {
      schema = document.createElement("script");
      schema.id = "dn-international-tracking-schema";
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: document.title,
      description,
      url: canonical,
      provider: { "@type": "Organization", name: "DAY NIGHT DELIVERY SERVICES", url: window.location.origin },
    });

    return () => {
      document.title = previousTitle;
      schema?.remove();
    };
  }, [isArabic]);

  useEffect(() => {
    const online = () => setOffline(false);
    const offlineHandler = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineHandler);
    };
  }, []);

  const search = useCallback(async (forced?: string, silent = false) => {
    const reference = String(forced ?? query).trim();
    if (!reference) return;
    if (!navigator.onLine) {
      setOffline(true);
      setError(isArabic ? "لا يوجد اتصال بالإنترنت." : "You are offline.");
      return;
    }
    if (!silent) {
      setLoading(true);
      setShipment(null);
      setError("");
      setSearched(true);
    }
    try {
      const result = await fetchInternationalTracking(reference);
      if (!result.ok || !result.shipment) throw new Error(result.code || "not_found");
      setShipment(result.shipment);
      lastSuccessfulReference.current = reference;
      setError("");
      const url = new URL(window.location.href);
      url.searchParams.set("number", reference);
      window.history.replaceState(window.history.state, "", url);
    } catch (cause) {
      if (!silent) {
        const message = cause instanceof Error ? cause.message : "tracking_failed";
        const notFound = /not.found|404/i.test(message);
        setError(notFound
          ? (isArabic ? "لم يتم العثور على شحنة دولية بهذا الرقم." : "No international shipment was found for this reference.")
          : (isArabic ? "تعذر الاتصال بخدمة التتبع. أعد المحاولة." : "Unable to reach the tracking service. Please try again."));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isArabic, query]);

  useEffect(() => {
    if (initialNumber) void search(initialNumber);
  }, []);

  useEffect(() => {
    if (!shipment || !lastSuccessfulReference.current) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void search(lastSuccessfulReference.current, true);
      }
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [shipment?.id, search]);

  const stopScanner = useCallback(() => {
    if (scanTimer.current) window.clearInterval(scanTimer.current);
    scanTimer.current = null;
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    mediaStream.current = null;
    setScannerOpen(false);
  }, []);

  useEffect(() => () => stopScanner(), [stopScanner]);

  const startScanner = useCallback(async () => {
    setScannerError("");
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setScannerError(isArabic ? "مسح QR غير مدعوم في هذا المتصفح." : "QR scanning is not supported by this browser.");
      setScannerOpen(true);
      return;
    }
    try {
      setScannerOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      mediaStream.current = stream;
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      if (!videoRef.current) throw new Error("camera_view_unavailable");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      scanTimer.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const codes = await detector.detect(videoRef.current).catch(() => []);
        const rawValue = String(codes?.[0]?.rawValue || "").trim();
        if (!rawValue) return;
        let reference = rawValue;
        try {
          const parsed = new URL(rawValue);
          reference = parsed.searchParams.get("number") || parsed.searchParams.get("code") || rawValue;
        } catch {
          // Plain AWB/reference QR.
        }
        setQuery(reference);
        stopScanner();
        void search(reference);
      }, 550);
    } catch {
      setScannerError(isArabic ? "تعذر تشغيل الكاميرا. تحقق من الإذن." : "Unable to start the camera. Check camera permission.");
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
    }
  }, [isArabic, search, stopScanner]);

  const copyLink = async () => {
    const reference = shipment?.public_tracking_number || shipment?.carrier_tracking_number_full || query;
    await navigator.clipboard.writeText(internationalTrackingUrl(reference));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    const reference = shipment?.public_tracking_number || shipment?.carrier_tracking_number_full || query;
    const url = internationalTrackingUrl(reference);
    const data = {
      title: isArabic ? "تتبع شحنة DAY NIGHT" : "Track a DAY NIGHT shipment",
      text: isArabic ? `تتبع الشحنة ${reference}` : `Track shipment ${reference}`,
      url,
    };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard.writeText(url);
  };

  const downloadPdf = () => {
    if (!shipment) return;
    const doc = new jsPDF();
    const reference = shipment.public_tracking_number || shipment.carrier_tracking_number_full || "—";
    doc.setFontSize(20);
    doc.text("DAY NIGHT DELIVERY SERVICES", 18, 22);
    doc.setFontSize(12);
    doc.text("International Shipment Tracking Summary", 18, 32);
    doc.line(18, 37, 192, 37);
    const lines = [
      `Reference: ${reference}`,
      `Carrier: Aramex`,
      `AWB: ${shipment.carrier_tracking_number_full || shipment.carrier_tracking_number || "—"}`,
      `Status: ${descriptor.en}`,
      `Origin: ${place(shipment.origin?.city || shipment.origin_city, shipment.origin?.country || shipment.origin_country)}`,
      `Destination: ${place(shipment.destination?.city || shipment.destination_city, shipment.destination?.country || shipment.destination_country)}`,
      `Latest checkpoint: ${shipment.latest_location || "—"}`,
      `Last update: ${dateTime(shipment.latest_update_at, "en-AE")}`,
      `Estimated delivery: ${dateTime(shipment.estimated_delivery_at, "en-AE")}`,
    ];
    lines.forEach((line, index) => doc.text(line, 18, 50 + index * 9));
    doc.setFontSize(9);
    doc.text("Checkpoint locations are supplied by the carrier and are not live GPS positions.", 18, 140);
    doc.save(`DAY-NIGHT-${reference}.pdf`);
  };

  const whatsappUrl = useMemo(() => {
    const reference = shipment?.public_tracking_number || shipment?.carrier_tracking_number_full || query;
    const url = internationalTrackingUrl(reference);
    const text = isArabic ? `تتبع شحنة DAY NIGHT رقم ${reference}: ${url}` : `Track DAY NIGHT shipment ${reference}: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [isArabic, query, shipment]);

  return (
    <div className={`dn-it-page ${isLight ? "is-light" : "is-dark"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-it-aurora dn-it-aurora-a" />
      <div className="dn-it-aurora dn-it-aurora-b" />

      <header className="dn-it-topbar">
        <a href="/" className="dn-it-brand" aria-label="DAY NIGHT home">
          <img src={companyMeta.logoUrl} alt="DAY NIGHT" />
          <span><b>DAY NIGHT</b><small>{isArabic ? "الشحن الدولي" : "INTERNATIONAL TRACKING"}</small></span>
        </a>
        <div className="dn-it-top-actions">
          <button type="button" onClick={toggleLanguage}><Languages />{isArabic ? "English" : "العربية"}</button>
          <a href="/tracking"><ArrowLeft className={isArabic ? "dn-it-flip" : ""} />{isArabic ? "التتبع المحلي" : "Local tracking"}</a>
          <a href="/" className="dn-it-home-link">{isArabic ? "الرئيسية" : "Home"}<ArrowRight className={isArabic ? "dn-it-flip" : ""} /></a>
        </div>
      </header>

      <main className="dn-it-shell">
        <section className="dn-it-hero">
          <div className="dn-it-hero-copy">
            <span className="dn-it-eyebrow"><Sparkles />{isArabic ? "تتبع دولي متصل بأرامكس" : "ARAME-X CONNECTED INTERNATIONAL TRACKING"}</span>
            <h1>{isArabic ? "تتبّع شحنتك الدولية من البداية حتى التسليم" : "Track your international shipment from origin to delivery"}</h1>
            <p>{isArabic
              ? "أدخل رقم DAY NIGHT أو رقم الطلب أو بوليصة أرامكس، وشاهد آخر حالة ونقاط الرحلة داخل موقعنا دون الانتقال إلى أي منصة أخرى."
              : "Enter a DAY NIGHT reference, order number, or Aramex AWB to see carrier checkpoints and the complete journey without leaving our website."}</p>
            <div className="dn-it-trust-row">
              <span><ShieldCheck />{isArabic ? "بيانات آمنة" : "Secure data"}</span>
              <span><RefreshCw />{isArabic ? "تحديث تلقائي" : "Auto refresh"}</span>
              <span><Smartphone />{isArabic ? "متوافق مع الهاتف" : "Mobile ready"}</span>
            </div>
          </div>
          <div className="dn-it-hero-orbit" aria-hidden="true">
            <div className="dn-it-globe"><Globe2 /></div>
            <span className="dn-it-orbit dn-it-orbit-one"><Plane /></span>
            <span className="dn-it-orbit dn-it-orbit-two"><Box /></span>
            <span className="dn-it-orbit dn-it-orbit-three"><MapPin /></span>
          </div>
        </section>

        <section className="dn-it-search-card">
          <div className="dn-it-search-label"><Search /><span><b>{isArabic ? "رقم التتبع" : "Tracking reference"}</b><small>{isArabic ? "DAY NIGHT / رقم الطلب / Aramex AWB" : "DAY NIGHT / order number / Aramex AWB"}</small></span></div>
          <div className="dn-it-search-controls">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void search()}
              placeholder={isArabic ? "مثال: DN-2026-54821 أو رقم أرامكس" : "Example: DN-2026-54821 or an Aramex AWB"}
              dir="ltr"
              autoComplete="off"
              inputMode="text"
              aria-label={isArabic ? "رقم التتبع" : "Tracking reference"}
            />
            <button type="button" className="dn-it-qr-button" onClick={() => void startScanner()} aria-label={isArabic ? "مسح رمز QR" : "Scan QR code"}><QrCode /></button>
            <button type="button" className="dn-it-track-button" onClick={() => void search()} disabled={loading || !query.trim()}>
              {loading ? <RefreshCw className="dn-it-spin" /> : <Search />}{isArabic ? "تتبع الآن" : "Track now"}
            </button>
          </div>
          {offline && <div className="dn-it-inline-alert is-warning"><AlertCircle />{isArabic ? "أنت غير متصل بالإنترنت. سيعمل البحث بعد عودة الاتصال." : "You are offline. Tracking will resume when your connection returns."}</div>}
        </section>

        {!searched && !loading && (
          <section className="dn-it-empty-showcase">
            <article><Globe2 /><b>{isArabic ? "إلى دول الخليج والعالم" : "GCC and worldwide"}</b><p>{isArabic ? "متابعة واضحة للشحنات الدولية من الإمارات." : "Clear international shipment visibility from the UAE."}</p></article>
            <article><Plane /><b>{isArabic ? "خط زمني كامل" : "Complete timeline"}</b><p>{isArabic ? "كل نقطة مسجلة من شركة النقل بترتيب زمني." : "Every carrier checkpoint in chronological order."}</p></article>
            <article><Headphones /><b>{isArabic ? "دعم DAY NIGHT" : "DAY NIGHT support"}</b><p>{isArabic ? "تواصل مباشر عند وجود تأخير أو استثناء." : "Direct support for delays and exceptions."}</p></article>
          </section>
        )}

        {loading && (
          <section className="dn-it-loading" aria-live="polite">
            <div className="dn-it-skeleton dn-it-skeleton-wide" />
            <div className="dn-it-skeleton-grid"><div className="dn-it-skeleton" /><div className="dn-it-skeleton" /><div className="dn-it-skeleton" /></div>
            <div className="dn-it-loading-copy"><RefreshCw className="dn-it-spin" />{isArabic ? "جارٍ قراءة أحدث بيانات الشحنة…" : "Reading the latest shipment data…"}</div>
          </section>
        )}

        {!loading && searched && error && !shipment && (
          <section className="dn-it-error-state">
            <span><AlertCircle /></span>
            <h2>{isArabic ? "تعذر عرض الشحنة" : "Shipment unavailable"}</h2>
            <p>{error}</p>
            <div><button type="button" onClick={() => void search()}><RefreshCw />{isArabic ? "إعادة المحاولة" : "Try again"}</button><a href={`https://wa.me/${String(companyMeta.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Headphones />{isArabic ? "الدعم" : "Support"}</a></div>
          </section>
        )}

        {!loading && shipment && (
          <div className="dn-it-results" aria-live="polite">
            <section className="dn-it-status-panel">
              <div className="dn-it-status-main">
                <div className={`dn-it-status-icon is-${descriptor.tone}`}>
                  {normalizedStatus(shipment) === "delivered" ? <CheckCircle2 /> : descriptor.tone === "danger" || descriptor.tone === "warning" ? <AlertCircle /> : <Plane />}
                </div>
                <div>
                  <span>{isArabic ? "الحالة الحالية" : "Current status"}</span>
                  <h2>{isArabic ? descriptor.ar : descriptor.en}</h2>
                  <p>{shipment.latest_description || (isArabic ? "تم التحديث من شبكة أرامكس عبر نظام DAY NIGHT." : "Updated from the Aramex network through DAY NIGHT.")}</p>
                </div>
              </div>
              <div className="dn-it-status-reference">
                <small>{isArabic ? "رقم DAY NIGHT" : "DAY NIGHT reference"}</small>
                <b dir="ltr">{shipment.public_tracking_number || "—"}</b>
                <small>{isArabic ? "بوليصة أرامكس" : "Aramex AWB"}</small>
                <strong dir="ltr">{shipment.carrier_tracking_number || shipment.carrier_tracking_number_full || "—"}</strong>
              </div>
            </section>

            <section className="dn-it-progress" aria-label={isArabic ? "مراحل الشحنة" : "Shipment stages"}>
              {journeySteps.map((step, index) => {
                const complete = currentStage >= index + 1 || normalizedStatus(shipment) === "delivered";
                const current = currentStage === index + 1 && normalizedStatus(shipment) !== "delivered";
                return <div key={step.key} className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}><span>{complete ? <Check /> : index + 1}</span><small>{isArabic ? step.ar : step.en}</small></div>;
              })}
            </section>

            <section className="dn-it-facts">
              <article><span><MapPin /></span><small>{isArabic ? "من" : "From"}</small><b>{place(shipment.origin?.city || shipment.origin_city, shipment.origin?.country || shipment.origin_country)}</b></article>
              <article><span><Navigation /></span><small>{isArabic ? "آخر موقع" : "Latest checkpoint"}</small><b>{shipment.latest_location || place(shipment.latest_city, shipment.latest_country)}</b></article>
              <article><span><MapPin /></span><small>{isArabic ? "إلى" : "To"}</small><b>{place(shipment.destination?.city || shipment.destination_city, shipment.destination?.country || shipment.destination_country)}</b></article>
              <article><span><Clock3 /></span><small>{isArabic ? "آخر تحديث" : "Last update"}</small><b>{dateTime(shipment.latest_update_at, locale)}</b></article>
              <article><span><Weight /></span><small>{isArabic ? "الوزن" : "Weight"}</small><b>{shipment.weight_kg ? `${shipment.weight_kg} kg` : "—"}</b></article>
              <article><span><Box /></span><small>{isArabic ? "عدد القطع" : "Pieces"}</small><b>{shipment.pieces || "—"}</b></article>
            </section>

            <RouteMap shipment={shipment} isArabic={isArabic} />
            <div className="dn-it-map-note"><AlertCircle />{isArabic ? "الموقع الظاهر مبني على آخر تحديث مسجل من شركة النقل، وليس تتبع GPS مباشرًا." : "The displayed location is based on the carrier's latest checkpoint and is not live GPS tracking."}</div>

            <section className="dn-it-details-grid">
              <article className="dn-it-timeline-card">
                <header><span><Clock3 /></span><div><small>{isArabic ? "التاريخ التشغيلي" : "OPERATIONS HISTORY"}</small><h2>{isArabic ? "الخط الزمني للشحنة" : "Shipment timeline"}</h2></div></header>
                {events.length ? (
                  <div className="dn-it-timeline">
                    {events.map((event, index) => (
                      <div className="dn-it-event" key={`${event.event_time}-${event.provider_status}-${index}`}>
                        <span className="dn-it-event-dot">{index === 0 ? <Plane /> : <Check />}</span>
                        <div>
                          <b>{eventTitle(event, isArabic)}</b>
                          {event.description && isArabic && <p>{event.description}</p>}
                          <span><MapPin />{event.location || place(event.city, event.country)}</span>
                          <time>{dateTime(event.event_time, locale)}</time>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="dn-it-no-events"><Clock3 />{isArabic ? "سيظهر سجل الحركة عند وصول أول تحديث من أرامكس." : "Shipment events will appear after the first Aramex update."}</div>}
              </article>

              <aside className="dn-it-side-card">
                <div className="dn-it-carrier"><span>ARAMEX</span><small>{isArabic ? "شركة النقل الدولية" : "International carrier"}</small></div>
                <div className="dn-it-eta"><Clock3 /><span><small>{isArabic ? "الوصول المتوقع" : "Estimated delivery"}</small><b>{dateTime(shipment.estimated_delivery_at, locale)}</b></span></div>
                <div className="dn-it-action-grid">
                  <button type="button" onClick={() => void copyLink()}>{copied ? <Check /> : <Copy />}{copied ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ الرابط" : "Copy link")}</button>
                  <button type="button" onClick={() => void share()}><Share2 />{isArabic ? "مشاركة" : "Share"}</button>
                  <a href={whatsappUrl} target="_blank" rel="noreferrer"><ExternalLink />WhatsApp</a>
                  <button type="button" onClick={() => window.print()}><Printer />{isArabic ? "طباعة" : "Print"}</button>
                  <button type="button" onClick={downloadPdf}><Download />PDF</button>
                  <button type="button" onClick={() => void search(lastSuccessfulReference.current || query)}><RefreshCw />{isArabic ? "تحديث" : "Refresh"}</button>
                </div>
                <a className="dn-it-support-cta" href={`https://wa.me/${String(companyMeta.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Headphones /><span><b>{isArabic ? "هل تحتاج مساعدة؟" : "Need assistance?"}</b><small>{isArabic ? "دعم DAY NIGHT على مدار الساعة" : "DAY NIGHT support is available 24/7"}</small></span><ArrowRight className={isArabic ? "dn-it-flip" : ""} /></a>
              </aside>
            </section>
          </div>
        )}
      </main>

      <footer className="dn-it-footer"><span>DAY NIGHT DELIVERY SERVICES</span><small>{isArabic ? "سريع • آمن • موثوق" : "FAST • RELIABLE • EVERY TIME"}</small></footer>

      {scannerOpen && (
        <div className="dn-it-scanner" role="dialog" aria-modal="true" aria-label={isArabic ? "ماسح QR" : "QR scanner"}>
          <div className="dn-it-scanner-card">
            <button type="button" className="dn-it-scanner-close" onClick={stopScanner}><X /></button>
            <QrCode className="dn-it-scanner-title-icon" />
            <h2>{isArabic ? "امسح رمز التتبع" : "Scan tracking QR"}</h2>
            <p>{isArabic ? "وجّه الكاميرا نحو رمز QR الموجود على بوليصة الشحن." : "Point your camera at the QR code on the shipment label."}</p>
            <div className="dn-it-video-frame"><video ref={videoRef} muted playsInline /><span /></div>
            {scannerError && <div className="dn-it-inline-alert is-warning"><AlertCircle />{scannerError}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
