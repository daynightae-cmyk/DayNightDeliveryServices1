import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Box, CalendarClock, Check, CircleDollarSign, Clock3, Copy, Download, FileText, Gauge, Globe2, MapPin, PackageCheck, Plane, Printer, RefreshCw, Route, Share2, ShieldCheck, Weight } from "lucide-react";
import type { InternationalShipment, InternationalTrackingEvent } from "../../lib/internationalTrackingApi";
import { internationalTrackingAssets } from "../../data/internationalTrackingAssets";
import type { TrackingLanguage } from "./i18n";
import { trackingCopy } from "./i18n";
import { journeyStages, statusLabel, statusMeta } from "./status";

export type EnrichedInternationalShipment = InternationalShipment & {
  transport_mode?: "air" | "sea" | "land" | "multimodal" | null;
  service_type?: string | null;
  aircraft_type?: string | null;
  progress_percent?: number | null;
  departure_time?: string | null;
  customs_status?: string | null;
  payment_status?: string | null;
  total_cost?: number | null;
  currency?: string | null;
  reference_number?: string | null;
  package_type?: string | null;
  cargo_description?: string | null;
  commodity?: string | null;
  hs_code?: string | null;
  incoterm?: string | null;
  dimensions?: { length?: number | null; width?: number | null; height?: number | null; unit?: string | null } | null;
  volume?: number | null;
  chargeable_weight?: number | null;
  documents?: Array<{ id?: string; title?: string; type?: string; signed_url?: string; expires_at?: string }> | null;
};

type Actions = { copied: boolean; onCopy: () => void; onShare: () => void; onDownload: () => void; onPrint: () => void; onRefresh: () => void };

function safeDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function place(city?: string | null, country?: string | null) { return [city, country].filter(Boolean).join(", ") || "—"; }
function origin(shipment: EnrichedInternationalShipment) { return shipment.origin || { city: shipment.origin_city, country: shipment.origin_country, coordinates: null }; }
function destination(shipment: EnrichedInternationalShipment) { return shipment.destination || { city: shipment.destination_city, country: shipment.destination_country, coordinates: null }; }
function available(value: unknown): value is string | number { return value !== null && value !== undefined && value !== ""; }
function DetailRow({ icon, label, value, dir }: { icon: ReactNode; label: string; value: ReactNode; dir?: "ltr" | "rtl" }) { return <article className="dn-it-metric"><span>{icon}</span><div><small>{label}</small><strong dir={dir}>{value}</strong></div></article>; }

export function ShipmentHero({ shipment, language, actions }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage; actions: Actions }) {
  const t = trackingCopy(language);
  const meta = statusMeta(shipment.normalized_status);
  const routeOrigin = origin(shipment);
  const routeDestination = destination(shipment);
  const reference = shipment.public_tracking_number || shipment.carrier_tracking_number_full || shipment.tracking_number || "—";
  return (
    <section className="dn-it-shipment-hero">
      <div className="dn-it-shipment-hero__copy">
        <div className="dn-it-carrier-lockup"><span>DAY NIGHT</span><i>×</i><b>ARAMEX</b></div>
        <span className={`dn-it-status-badge is-${meta.tone}`}><i />{statusLabel(shipment.normalized_status, language)}</span>
        <small>{t.reference}</small><h1 dir="ltr">{reference}</h1><p>{shipment.latest_description || t.liveData}</p>
        <div className="dn-it-route-codes"><span><small>{t.origin}</small><strong>{place(routeOrigin.city, routeOrigin.country)}</strong></span><Route aria-hidden="true" /><span><small>{t.destination}</small><strong>{place(routeDestination.city, routeDestination.country)}</strong></span></div>
      </div>
      <div className="dn-it-shipment-hero__aircraft" aria-hidden="true"><div className="dn-it-aircraft-aura" /><img src={internationalTrackingAssets.aircraft.frontTransparent} alt="" /></div>
      <div className="dn-it-hero-actions">
        <button type="button" onClick={actions.onCopy}>{actions.copied ? <Check /> : <Copy />}{actions.copied ? t.copied : t.copy}</button>
        <button type="button" onClick={actions.onShare}><Share2 />{t.share}</button>
        <button type="button" onClick={actions.onDownload}><Download />PDF</button>
        <button type="button" onClick={actions.onPrint}><Printer />{t.print}</button>
        <button type="button" onClick={actions.onRefresh}><RefreshCw />{t.refresh}</button>
      </div>
    </section>
  );
}

export function RouteProgressCard({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const meta = statusMeta(shipment.normalized_status);
  const suppliedProgress = Number(shipment.progress_percent);
  const progress = Number.isFinite(suppliedProgress) ? Math.max(0, Math.min(100, suppliedProgress)) : meta.progress;
  const routeOrigin = origin(shipment);
  const routeDestination = destination(shipment);
  return (
    <section className="dn-it-route-progress-card">
      <header><div><span><Route />{t.route}</span><strong>{t.progress}</strong></div><em>{Math.round(progress)}%</em></header>
      <div className="dn-it-route-progress-line" aria-label={`${t.progress}: ${Math.round(progress)}%`}><span className="dn-it-route-track" /><span className="dn-it-route-complete" style={{ width: `${progress}%` }} /><img src={internationalTrackingAssets.aircraft.sideTransparent} alt="" style={{ insetInlineStart: `clamp(12px, calc(${progress}% - 44px), calc(100% - 88px))` }} /><i className="dn-it-route-node is-origin" /><i className="dn-it-route-node is-customs" /><i className="dn-it-route-node is-destination" /></div>
      <div className="dn-it-route-progress-labels"><span><small>{t.origin}</small><b>{place(routeOrigin.city, routeOrigin.country)}</b></span><span><small>{t.latestCheckpoint}</small><b>{shipment.latest_location || place(shipment.latest_city, shipment.latest_country)}</b></span><span><small>{t.destination}</small><b>{place(routeDestination.city, routeDestination.country)}</b></span></div>
      <p><AlertCircle />{t.noGps}</p>
    </section>
  );
}

export function ShipmentMetricsGrid({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const locale = language === "ar" ? "ar-AE" : "en-AE";
  const metrics = [
    <DetailRow key="carrier" icon={<Plane />} label={t.carrier} value={shipment.carrier_name || "Aramex"} />,
    <DetailRow key="updated" icon={<Clock3 />} label={t.lastUpdate} value={safeDate(shipment.latest_update_at, locale)} />,
    <DetailRow key="eta" icon={<CalendarClock />} label={t.estimatedDelivery} value={safeDate(shipment.estimated_delivery_at, locale)} />,
    <DetailRow key="location" icon={<MapPin />} label={t.latestCheckpoint} value={shipment.latest_location || place(shipment.latest_city, shipment.latest_country)} />,
  ];
  if (available(shipment.weight_kg)) metrics.push(<DetailRow key="weight" icon={<Weight />} label={t.weight} value={`${shipment.weight_kg} kg`} />);
  if (available(shipment.pieces)) metrics.push(<DetailRow key="pieces" icon={<Box />} label={t.pieces} value={shipment.pieces} />);
  if (available(shipment.service_type)) metrics.push(<DetailRow key="service" icon={<Gauge />} label={t.service} value={shipment.service_type} />);
  if (available(shipment.customs_status)) metrics.push(<DetailRow key="customs" icon={<ShieldCheck />} label={t.customs} value={shipment.customs_status} />);
  return <section className="dn-it-metrics-grid">{metrics}</section>;
}

function eventTitle(event: InternationalTrackingEvent, language: TrackingLanguage) {
  return language === "ar" ? event.description_ar || statusLabel(event.status, language) : event.description || event.provider_sub_status || statusLabel(event.status, language);
}

export function ShipmentTimeline({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const locale = language === "ar" ? "ar-AE" : "en-AE";
  const events = useMemo(() => [...(shipment.events || [])].sort((a, b) => Date.parse(b.event_time || "") - Date.parse(a.event_time || "")), [shipment.events]);
  if (!events.length) return <div className="dn-it-panel-empty"><Clock3 /><strong>{t.noEvents}</strong></div>;
  return <div className="dn-it-timeline">{events.map((event, index) => <article className={`dn-it-timeline-event ${index === 0 ? "is-current" : ""}`} key={`${event.event_time}-${event.provider_status}-${index}`}><span className="dn-it-timeline-dot">{index === 0 ? <Plane /> : <Check />}</span><div><header><strong>{eventTitle(event, language)}</strong>{index === 0 && <em>{t.currentStatus}</em>}</header>{event.description && language === "ar" && event.description !== event.description_ar && <p>{event.description}</p>}<span><MapPin />{event.location || place(event.city, event.country)}</span><time>{safeDate(event.event_time, locale)}</time></div></article>)}</div>;
}

function CargoPanel({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const values = [
    [language === "ar" ? "وصف الحمولة" : "Cargo description", shipment.cargo_description],
    [language === "ar" ? "السلعة" : "Commodity", shipment.commodity],
    ["HS Code", shipment.hs_code], ["Incoterm", shipment.incoterm],
    [language === "ar" ? "نوع الطرد" : "Package type", shipment.package_type],
    [language === "ar" ? "الوزن المحاسبي" : "Chargeable weight", available(shipment.chargeable_weight) ? `${shipment.chargeable_weight} kg` : null],
    [language === "ar" ? "الحجم" : "Volume", shipment.volume],
  ].filter(([, value]) => available(value));
  if (!values.length) return <div className="dn-it-panel-empty"><Box /><strong>{t.noExtraDetails}</strong></div>;
  return <div className="dn-it-cargo-grid">{values.map(([label, value]) => <article key={String(label)}><small>{label}</small><strong>{value}</strong></article>)}</div>;
}

function DocumentsPanel({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const documents = (shipment.documents || []).filter((item) => item.signed_url && item.title);
  return <div className="dn-it-documents-panel"><div className="dn-it-document-security"><ShieldCheck /><span><strong>{t.protectedDocuments}</strong><small>{t.detailsAvailable}</small></span></div>{documents.length ? documents.map((document, index) => <a key={document.id || `${document.title}-${index}`} href={document.signed_url} target="_blank" rel="noreferrer"><FileText /><span><strong>{document.title}</strong><small>{document.type || "Shipment document"}</small></span><Download /></a>) : <div className="dn-it-panel-empty"><FileText /><strong>{t.noDocuments}</strong></div>}</div>;
}

function PaymentPanel({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const hasPayment = available(shipment.payment_status) || available(shipment.total_cost);
  if (!hasPayment) return <div className="dn-it-panel-empty"><CircleDollarSign /><strong>{t.noExtraDetails}</strong></div>;
  let formattedCost = "";
  if (available(shipment.total_cost)) {
    try { formattedCost = new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-AE", { style: "currency", currency: shipment.currency || "AED" }).format(Number(shipment.total_cost)); }
    catch { formattedCost = `${shipment.total_cost} ${shipment.currency || "AED"}`; }
  }
  return <div className="dn-it-cargo-grid">{available(shipment.payment_status) && <article><small>{language === "ar" ? "حالة الدفع" : "Payment status"}</small><strong>{shipment.payment_status}</strong></article>}{available(shipment.total_cost) && <article><small>{language === "ar" ? "التكلفة المتاحة" : "Available cost"}</small><strong>{formattedCost}</strong></article>}</div>;
}

export function ShipmentTabs({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const [active, setActive] = useState<"overview" | "timeline" | "cargo" | "documents" | "payment">("overview");
  const tabs = [["overview", t.overview, Globe2], ["timeline", t.timeline, Clock3], ["cargo", t.cargo, Box], ["documents", t.documents, FileText], ["payment", t.payment, CircleDollarSign]] as const;
  return <section className="dn-it-tabs-card"><div className="dn-it-tabs" role="tablist" aria-label={language === "ar" ? "تفاصيل الشحنة" : "Shipment details"}>{tabs.map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={active === key} className={active === key ? "is-active" : ""} onClick={() => setActive(key)}><Icon />{label}</button>)}</div><div className="dn-it-tab-panel" role="tabpanel">{active === "overview" && <OverviewPanel shipment={shipment} language={language} />}{active === "timeline" && <ShipmentTimeline shipment={shipment} language={language} />}{active === "cargo" && <CargoPanel shipment={shipment} language={language} />}{active === "documents" && <DocumentsPanel shipment={shipment} language={language} />}{active === "payment" && <PaymentPanel shipment={shipment} language={language} />}</div></section>;
}

function OverviewPanel({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const meta = statusMeta(shipment.normalized_status);
  return <div className="dn-it-overview-panel"><div className="dn-it-lifecycle">{journeyStages.map((key, index) => { const step = statusMeta(key); const complete = meta.stage >= step.stage || meta.key === "delivered"; const current = meta.stage === step.stage && meta.key !== "delivered"; return <article className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`} key={key}><span>{complete ? <Check /> : index + 1}</span><small>{language === "ar" ? step.ar : step.en}</small></article>; })}</div><div className="dn-it-overview-summary"><article><PackageCheck /><span><small>{t.currentStatus}</small><strong>{statusLabel(shipment.normalized_status, language)}</strong></span></article><article><MapPin /><span><small>{t.latestCheckpoint}</small><strong>{shipment.latest_location || place(shipment.latest_city, shipment.latest_country)}</strong></span></article><article><Plane /><span><small>{t.aramexPartner}</small><strong>{shipment.provider_sub_status || shipment.provider_status || t.carrierUpdates}</strong></span></article></div></div>;
}
