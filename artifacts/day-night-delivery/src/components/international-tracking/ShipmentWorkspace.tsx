import { useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Box,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Gauge,
  Globe2,
  MapPin,
  PackageCheck,
  Plane,
  Printer,
  RefreshCw,
  Route,
  Share2,
  ShieldCheck,
  Weight,
} from "lucide-react";
import type { InternationalShipment, InternationalTrackingEvent } from "../../lib/internationalTrackingApi";
import { internationalTrackingAssets } from "../../lib/internationalTrackingAssets";
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

type Actions = {
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onRefresh: () => void;
};

const available = (value: unknown): value is string | number => value !== null && value !== undefined && value !== "";
const place = (city?: string | null, country?: string | null) => [city, country].filter(Boolean).join(", ") || "—";
const origin = (shipment: EnrichedInternationalShipment) => shipment.origin || { city: shipment.origin_city, country: shipment.origin_country, coordinates: null };
const destination = (shipment: EnrichedInternationalShipment) => shipment.destination || { city: shipment.destination_city, country: shipment.destination_country, coordinates: null };

function safeDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function dateParts(value: string | null | undefined, locale: string) {
  if (!value) return { date: "—", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: "" };
  return {
    date: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(date),
  };
}

function routeCode(city?: string | null, country?: string | null) {
  const known: Record<string, string> = {
    singapore: "SIN", "los angeles": "LAX", dubai: "DXB", "abu dhabi": "AUH", london: "LHR",
    paris: "CDG", vienna: "VIE", "new york": "JFK", toronto: "YYZ", sydney: "SYD", tokyo: "NRT",
    riyadh: "RUH", jeddah: "JED", doha: "DOH", muscat: "MCT", manama: "BAH",
  };
  const normalized = String(city || "").trim().toLowerCase();
  if (known[normalized]) return known[normalized];
  return String(city || country || "").normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "—";
}

function formatMoney(shipment: EnrichedInternationalShipment, language: TrackingLanguage) {
  if (!available(shipment.total_cost)) return "";
  try {
    return new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-US", {
      style: "currency",
      currency: shipment.currency || "AED",
      maximumFractionDigits: 2,
    }).format(Number(shipment.total_cost));
  } catch {
    return `${shipment.currency || "AED"} ${shipment.total_cost}`;
  }
}

function DetailRow({ icon, label, value, dir }: { icon: ReactNode; label: string; value: ReactNode; dir?: "ltr" | "rtl" }) {
  return <article className="dn-it-metric"><span>{icon}</span><div><small>{label}</small><strong dir={dir}>{value}</strong></div></article>;
}

function SummaryFact({ icon, label, value, tone, dir }: { icon: ReactNode; label: string; value: ReactNode; tone?: "success" | "gold"; dir?: "ltr" | "rtl" }) {
  return <article className={`dn-it-summary-fact ${tone ? `is-${tone}` : ""}`}><span>{icon}</span><div><small>{label}</small><strong dir={dir}>{value}</strong></div></article>;
}

export function ShipmentHero({ shipment, language, actions }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage; actions: Actions }) {
  const t = trackingCopy(language);
  const meta = statusMeta(shipment.normalized_status);
  const routeOrigin = origin(shipment);
  const routeDestination = destination(shipment);
  const reference = shipment.public_tracking_number || shipment.carrier_tracking_number_full || shipment.tracking_number || "—";
  const awb = shipment.carrier_tracking_number_full || shipment.carrier_tracking_number || reference;
  const money = formatMoney(shipment, language);
  const isArabic = language === "ar";
  const documents = (shipment.documents || []).filter((document) => document.signed_url && document.title);

  return (
    <section className="dn-it-shipment-hero">
      <header className="dn-it-shipment-hero__header">
        <div>
          <span className={`dn-it-status-badge is-${meta.tone}`}><i />{statusLabel(shipment.normalized_status, language)}</span>
          <small>{t.reference}</small>
          <h1 dir="ltr">{reference}</h1>
          <p>{shipment.latest_description || t.liveData}</p>
        </div>
        <button type="button" className="dn-it-copy-reference" onClick={actions.onCopy} aria-label={t.copy}>{actions.copied ? <Check /> : <Copy />}</button>
      </header>

      <div className="dn-it-shipment-hero__visual" aria-hidden="true">
        <div className="dn-it-aircraft-aura" />
        <span className="dn-it-runway-light is-a" /><span className="dn-it-runway-light is-b" />
        <img src={internationalTrackingAssets.aircraft.flightSide} alt="" />
      </div>

      <div className="dn-it-hero-route">
        <div><strong dir="ltr">{routeCode(routeOrigin.city, routeOrigin.country)}</strong><span>{place(routeOrigin.city, routeOrigin.country)}</span></div>
        <div className="dn-it-hero-route__line"><span /><Plane /><span /></div>
        <div><strong dir="ltr">{routeCode(routeDestination.city, routeDestination.country)}</strong><span>{place(routeDestination.city, routeDestination.country)}</span></div>
      </div>

      <div className="dn-it-summary-grid">
        <SummaryFact icon={<Plane />} label={t.carrier} value={shipment.carrier_name || "Aramex"} />
        <SummaryFact icon={<FileText />} label="AWB" value={awb} dir="ltr" />
        {available(shipment.service_type) && <SummaryFact icon={<Gauge />} label={t.service} value={shipment.service_type} />}
        {available(shipment.aircraft_type) && <SummaryFact icon={<Plane />} label={isArabic ? "الطائرة" : "Aircraft"} value={shipment.aircraft_type} />}
        {available(shipment.weight_kg) && <SummaryFact icon={<Weight />} label={t.weight} value={`${shipment.weight_kg} KG`} dir="ltr" />}
        {available(shipment.pieces) && <SummaryFact icon={<Box />} label={t.pieces} value={shipment.pieces} />}
        {available(shipment.reference_number) && <SummaryFact icon={<FileCheck2 />} label={isArabic ? "مرجع الطلب" : "Order reference"} value={shipment.reference_number} dir="ltr" />}
        {available(shipment.customs_status) && <SummaryFact icon={<ShieldCheck />} label={t.customs} value={shipment.customs_status} tone="success" />}
        {available(shipment.payment_status) && <SummaryFact icon={<CircleDollarSign />} label={isArabic ? "حالة الدفع" : "Payment status"} value={shipment.payment_status} tone="success" />}
        {money && <SummaryFact icon={<CircleDollarSign />} label={isArabic ? "إجمالي التكلفة" : "Total cost"} value={money} tone="gold" dir="ltr" />}
      </div>

      <div className="dn-it-hero-actions">
        <button type="button" className="is-primary" onClick={actions.onDownload}><Download />{t.download}</button>
        {documents.length > 0 && <span className="dn-it-documents-count"><FileText />{documents.length} {t.documents}</span>}
        <div>
          <button type="button" onClick={actions.onShare} aria-label={t.share}><Share2 /></button>
          <button type="button" onClick={actions.onPrint} aria-label={t.print}><Printer /></button>
          <button type="button" onClick={actions.onRefresh} aria-label={t.refresh}><RefreshCw /></button>
        </div>
      </div>
    </section>
  );
}

export function RouteProgressCard({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const meta = statusMeta(shipment.normalized_status);
  const suppliedProgress = Number(shipment.progress_percent);
  const progress = Number.isFinite(suppliedProgress) ? Math.max(0, Math.min(100, suppliedProgress)) : meta.progress;
  const locale = language === "ar" ? "ar-AE" : "en-AE";
  const routeOrigin = origin(shipment);
  const routeDestination = destination(shipment);
  const events = [...(shipment.events || [])].sort((a, b) => Date.parse(a.event_time || "") - Date.parse(b.event_time || ""));
  const eventBy = (needle: RegExp) => events.find((event) => needle.test(`${event.status || ""} ${event.provider_status || ""} ${event.provider_sub_status || ""}`));
  const activeIndex = progress >= 100 ? 4 : progress >= 78 ? 3 : progress >= 60 ? 2 : progress >= 28 ? 1 : 0;
  const isArabic = language === "ar";
  const stages = [
    { label: isArabic ? "تم الإرسال" : "Departed", location: place(routeOrigin.city, routeOrigin.country), time: shipment.departure_time || eventBy(/depart|pick|origin/i)?.event_time || shipment.registered_at, icon: <Check /> },
    { label: isArabic ? "في الطريق" : "In transit", location: shipment.latest_location || place(shipment.latest_city, shipment.latest_country), time: eventBy(/transit|depart/i)?.event_time || shipment.latest_update_at, icon: <Plane /> },
    { label: isArabic ? "الجمارك" : "Customs", location: place(routeDestination.city, routeDestination.country), time: eventBy(/custom/i)?.event_time, icon: <ShieldCheck /> },
    { label: isArabic ? "المرحلة الأخيرة" : "Last mile", location: place(routeDestination.city, routeDestination.country), time: eventBy(/out_for_delivery|available_for_pickup|destination/i)?.event_time, icon: <PackageCheck /> },
    { label: isArabic ? "التسليم" : "Delivery", location: place(routeDestination.city, routeDestination.country), time: shipment.delivered_at || shipment.estimated_delivery_at, icon: <Box /> },
  ];

  return (
    <section className="dn-it-route-progress-card">
      <header><div><span><Route />{t.route}</span><strong>{t.progress}</strong></div><em>{Math.round(progress)}%</em></header>
      <div className="dn-it-route-progress-visual" aria-label={`${t.progress}: ${Math.round(progress)}%`}>
        <span className="dn-it-route-track" /><span className="dn-it-route-complete" style={{ width: `${progress}%` }} />
        <img src={internationalTrackingAssets.aircraft.sideTransparent} alt="" style={{ insetInlineStart: `clamp(16px, calc(${progress}% - 42px), calc(100% - 88px))` }} />
      </div>
      <div className="dn-it-route-milestones">
        {stages.map((stage, index) => {
          const current = index === activeIndex;
          const complete = index < activeIndex || progress >= 100;
          const parts = dateParts(stage.time, locale);
          return <article className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`} key={stage.label}><span>{complete && !current ? <Check /> : stage.icon}</span><strong>{stage.label}</strong><small>{stage.location}</small><time>{parts.date}<b>{parts.time}</b></time></article>;
        })}
      </div>
      <p><AlertCircle />{t.noGps}</p>
    </section>
  );
}

export function ShipmentMetricsGrid({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const locale = language === "ar" ? "ar-AE" : "en-AE";
  return <section className="dn-it-metrics-grid">
    <DetailRow icon={<Clock3 />} label={t.lastUpdate} value={safeDate(shipment.latest_update_at, locale)} />
    <DetailRow icon={<CalendarClock />} label={t.estimatedDelivery} value={safeDate(shipment.estimated_delivery_at, locale)} />
    <DetailRow icon={<MapPin />} label={t.latestCheckpoint} value={shipment.latest_location || place(shipment.latest_city, shipment.latest_country)} />
    <DetailRow icon={<Plane />} label={t.carrier} value={shipment.carrier_name || "Aramex"} />
  </section>;
}

function eventTitle(event: InternationalTrackingEvent, language: TrackingLanguage) {
  return language === "ar" ? event.description_ar || statusLabel(event.status || event.provider_status, language) : event.description || event.provider_sub_status || statusLabel(event.status || event.provider_status, language);
}

function eventIcon(event: InternationalTrackingEvent, current: boolean) {
  const key = `${event.status || ""} ${event.provider_status || ""} ${event.provider_sub_status || ""}`.toLowerCase();
  if (current || /transit|depart/.test(key)) return <Plane />;
  if (/custom/.test(key)) return <ShieldCheck />;
  if (/deliver/.test(key)) return <PackageCheck />;
  if (/pick|book|information/.test(key)) return <FileCheck2 />;
  return <Check />;
}

export function ShipmentTimeline({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const locale = language === "ar" ? "ar-AE" : "en-AE";
  const events = useMemo(() => [...(shipment.events || [])].sort((a, b) => Date.parse(b.event_time || "") - Date.parse(a.event_time || "")), [shipment.events]);
  if (!events.length) return <div className="dn-it-panel-empty"><Clock3 /><strong>{t.noEvents}</strong></div>;
  return <div className="dn-it-timeline">{events.map((event, index) => {
    const parts = dateParts(event.event_time, locale);
    return <article className={`dn-it-timeline-event ${index === 0 ? "is-current" : ""}`} key={`${event.event_time}-${event.provider_status}-${index}`}><span className="dn-it-timeline-dot">{eventIcon(event, index === 0)}</span><div className="dn-it-timeline-copy"><header><strong>{eventTitle(event, language)}</strong>{index === 0 && <em>{t.currentStatus}</em>}</header>{event.description && language === "ar" && event.description !== event.description_ar && <p>{event.description}</p>}<span><MapPin />{event.location || place(event.city, event.country)}</span></div><time><strong>{parts.date}</strong><small>{parts.time}</small></time></article>;
  })}</div>;
}

function CargoPanel({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const values = [
    [language === "ar" ? "وصف الحمولة" : "Cargo description", shipment.cargo_description],
    [language === "ar" ? "السلعة" : "Commodity", shipment.commodity], ["HS Code", shipment.hs_code], ["Incoterm", shipment.incoterm],
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
  const money = formatMoney(shipment, language);
  if (!available(shipment.payment_status) && !money) return <div className="dn-it-panel-empty"><CircleDollarSign /><strong>{t.noExtraDetails}</strong></div>;
  return <div className="dn-it-cargo-grid">{available(shipment.payment_status) && <article><small>{language === "ar" ? "حالة الدفع" : "Payment status"}</small><strong>{shipment.payment_status}</strong></article>}{money && <article><small>{language === "ar" ? "التكلفة المتاحة" : "Available cost"}</small><strong dir="ltr">{money}</strong></article>}</div>;
}

export function ShipmentTabs({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const [active, setActive] = useState<"overview" | "timeline" | "cargo" | "documents" | "payment">("timeline");
  const tabs = [["timeline", t.timeline, Clock3], ["overview", t.overview, Globe2], ["cargo", t.cargo, Box], ["documents", t.documents, FileText], ["payment", t.payment, CircleDollarSign]] as const;
  return <section className="dn-it-tabs-card"><header className="dn-it-tabs-card__heading"><div><span><Clock3 />{t.events}</span><strong>{language === "ar" ? "سجل تتبع الشحنة" : "Shipment tracking history"}</strong></div><small>{shipment.events?.length || 0} {language === "ar" ? "تحديث" : "updates"}</small></header><div className="dn-it-tabs" role="tablist" aria-label={language === "ar" ? "تفاصيل الشحنة" : "Shipment details"}>{tabs.map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={active === key} className={active === key ? "is-active" : ""} onClick={() => setActive(key)}><Icon />{label}</button>)}</div><div className="dn-it-tab-panel" role="tabpanel">{active === "overview" && <OverviewPanel shipment={shipment} language={language} />}{active === "timeline" && <ShipmentTimeline shipment={shipment} language={language} />}{active === "cargo" && <CargoPanel shipment={shipment} language={language} />}{active === "documents" && <DocumentsPanel shipment={shipment} language={language} />}{active === "payment" && <PaymentPanel shipment={shipment} language={language} />}</div></section>;
}

function OverviewPanel({ shipment, language }: { shipment: EnrichedInternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const meta = statusMeta(shipment.normalized_status);
  return <div className="dn-it-overview-panel"><div className="dn-it-lifecycle">{journeyStages.map((key, index) => {
    const step = statusMeta(key);
    const complete = meta.stage >= step.stage || meta.key === "delivered";
    const current = meta.stage === step.stage && meta.key !== "delivered";
    return <article className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`} key={key}><span>{complete ? <Check /> : index + 1}</span><small>{language === "ar" ? step.ar : step.en}</small></article>;
  })}</div><div className="dn-it-overview-summary"><article><PackageCheck /><span><small>{t.currentStatus}</small><strong>{statusLabel(shipment.normalized_status, language)}</strong></span></article><article><MapPin /><span><small>{t.latestCheckpoint}</small><strong>{shipment.latest_location || place(shipment.latest_city, shipment.latest_country)}</strong></span></article><article><Plane /><span><small>{t.aramexPartner}</small><strong>{shipment.provider_sub_status || shipment.provider_status || t.carrierUpdates}</strong></span></article></div></div>;
}
