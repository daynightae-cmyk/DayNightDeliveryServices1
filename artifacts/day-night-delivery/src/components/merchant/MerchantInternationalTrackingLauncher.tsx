import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Globe2,
  Loader2,
  MapPin,
  Plane,
  Search,
  X,
} from "lucide-react";
import {
  fetchInternationalTracking,
  internationalTrackingUrl,
  type InternationalShipment,
} from "../../lib/internationalTrackingApi";
import "../../styles/dn-international-merchant.css";

const labels: Record<string, [string, string]> = {
  information_received: ["تم استلام البيانات", "Information received"],
  picked_up: ["تم استلام الشحنة", "Picked up"],
  departed_origin: ["غادرت المنشأ", "Departed origin"],
  in_transit: ["في الطريق", "In transit"],
  customs_clearance: ["التخليص الجمركي", "Customs clearance"],
  customs_exception: ["ملاحظة جمركية", "Customs exception"],
  arrived_destination: ["وصلت بلد الوجهة", "Arrived at destination"],
  available_for_pickup: ["جاهزة للاستلام", "Available for pickup"],
  out_for_delivery: ["خرجت للتسليم", "Out for delivery"],
  delivery_failed: ["تعذر التسليم", "Delivery failed"],
  delivered: ["تم التسليم", "Delivered"],
  exception: ["يوجد تنبيه", "Exception"],
  returned: ["مرتجعة", "Returned"],
  expired: ["انتهى التتبع", "Expired"],
  unknown: ["جاري التحديث", "Updating"],
};

function date(value?: string | null, isArabic = true) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(isArabic ? "ar-AE" : "en-AE");
}

export default function MerchantInternationalTrackingLauncher() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const visible = /^\/merchant(?:\/|$)/.test(pathname);
  const [open, setOpen] = useState(false);
  const [isArabic, setIsArabic] = useState(true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shipment, setShipment] = useState<InternationalShipment | null>(null);
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setShipment(null);
    try {
      const result = await fetchInternationalTracking(query);
      if (!result.ok || !result.shipment) throw new Error("not_found");
      setShipment(result.shipment);
    } catch {
      setError(isArabic ? "لم يتم العثور على شحنة دولية بهذا الرقم." : "No international shipment was found for this reference.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!shipment) return;
    const reference = shipment.public_tracking_number || shipment.carrier_tracking_number_full || query;
    await navigator.clipboard.writeText(internationalTrackingUrl(reference));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const status = String(shipment?.normalized_status || "unknown").toLowerCase();
  const statusLabel = (labels[status] || labels.unknown)[isArabic ? 0 : 1];
  const events = shipment?.events || [];

  return (
    <>
      <button type="button" className="dn-it-merchant-launch" onClick={() => setOpen(true)}><Globe2 /><span>{isArabic ? "تتبع أرامكس" : "Aramex tracking"}</span></button>
      {open && <div className="dn-it-merchant-modal" dir={isArabic ? "rtl" : "ltr"} role="dialog" aria-modal="true">
        <button type="button" className="dn-it-merchant-shade" onClick={() => setOpen(false)} aria-label="Close" />
        <section className="dn-it-merchant-panel">
          <header><span><Plane /></span><div><small>DAY NIGHT · ARAMEX</small><h2>{isArabic ? "تتبع الشحنة الدولية" : "International shipment tracking"}</h2></div><button type="button" onClick={() => setIsArabic((value) => !value)}>{isArabic ? "EN" : "ع"}</button><button type="button" onClick={() => setOpen(false)}><X /></button></header>
          <div className="dn-it-merchant-body">
            <div className="dn-it-merchant-search"><Search /><input dir="ltr" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void search()} placeholder={isArabic ? "رقم DAY NIGHT أو بوليصة أرامكس" : "DAY NIGHT reference or Aramex AWB"} /><button type="button" onClick={() => void search()} disabled={loading || !query.trim()}>{loading ? <Loader2 className="dn-it-merchant-spin" /> : <Search />}{isArabic ? "تتبع" : "Track"}</button></div>

            {error && <div className="dn-it-merchant-error"><AlertCircle /><span>{error}</span></div>}
            {!shipment && !error && !loading && <div className="dn-it-merchant-empty"><Globe2 /><b>{isArabic ? "أدخل رقم الشحنة الدولية" : "Enter an international shipment reference"}</b><p>{isArabic ? "ستظهر حالة أرامكس وآخر موقع وسجل الحركة دون عرض أي بيانات سرية." : "Aramex status, latest checkpoint, and the timeline will appear without exposing private data."}</p></div>}

            {shipment && <div className="dn-it-merchant-result">
              <section className="dn-it-merchant-status"><span className={status === "delivered" ? "is-delivered" : ""}>{status === "delivered" ? <CheckCircle2 /> : <Plane />}</span><div><small>{isArabic ? "الحالة الحالية" : "Current status"}</small><h3>{statusLabel}</h3><p>{shipment.latest_description || "—"}</p></div><aside><small>{isArabic ? "بوليصة أرامكس" : "Aramex AWB"}</small><b dir="ltr">{shipment.carrier_tracking_number || shipment.carrier_tracking_number_full || "—"}</b><strong>{shipment.public_tracking_number || "—"}</strong></aside></section>
              <section className="dn-it-merchant-facts"><article><MapPin /><small>{isArabic ? "آخر موقع" : "Latest location"}</small><b>{shipment.latest_location || "—"}</b></article><article><Clock3 /><small>{isArabic ? "آخر تحديث" : "Last update"}</small><b>{date(shipment.latest_update_at, isArabic)}</b></article><article><Plane /><small>{isArabic ? "المسار" : "Route"}</small><b>{shipment.origin?.city || shipment.origin_city || "UAE"} → {shipment.destination?.city || shipment.destination_city || "—"}</b></article></section>
              <section className="dn-it-merchant-timeline"><header><Clock3 /><h3>{isArabic ? "سجل حركة الشحنة" : "Shipment timeline"}</h3></header>{events.length ? events.map((event, index) => <article key={`${event.event_time}-${index}`}><span>{index === 0 ? <Plane /> : <CheckCircle2 />}</span><div><b>{isArabic ? event.description_ar || (labels[String(event.status || "unknown")?.toLowerCase()] || labels.unknown)[0] : event.description || (labels[String(event.status || "unknown")?.toLowerCase()] || labels.unknown)[1]}</b><p>{event.location || [event.city, event.country].filter(Boolean).join(", ") || "—"}</p><time>{date(event.event_time, isArabic)}</time></div></article>) : <p className="dn-it-merchant-no-events">{isArabic ? "بانتظار أول تحديث من أرامكس." : "Awaiting the first Aramex update."}</p>}</section>
              <div className="dn-it-merchant-actions"><button type="button" onClick={() => void copyLink()}>{copied ? <CheckCircle2 /> : <Copy />}{copied ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ رابط العميل" : "Copy customer link")}</button><a href={internationalTrackingUrl(shipment.public_tracking_number || shipment.carrier_tracking_number_full || query)} target="_blank" rel="noreferrer"><ExternalLink />{isArabic ? "فتح صفحة العميل" : "Open customer page"}</a></div>
            </div>}
          </div>
        </section>
      </div>}
    </>
  );
}
