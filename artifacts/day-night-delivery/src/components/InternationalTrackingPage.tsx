import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { AlertCircle, Clock3, Headphones, QrCode, RefreshCw, X } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";
import {
  fetchInternationalTracking,
  internationalTrackingUrl,
  type InternationalShipment,
} from "../lib/internationalTrackingApi";
import TrackingTopbar from "./international-tracking/TrackingTopbar";
import TrackingSearch from "./international-tracking/TrackingSearch";
import {
  InitialTrackingState,
  TrackingErrorState,
  TrackingLoadingState,
} from "./international-tracking/TrackingStates";
import {
  RouteProgressCard,
  ShipmentHero,
  ShipmentMetricsGrid,
  ShipmentTabs,
  type EnrichedInternationalShipment,
} from "./international-tracking/ShipmentWorkspace";
import { trackingCopy, type TrackingLanguage } from "./international-tracking/i18n";
import { statusMeta } from "./international-tracking/status";
import "../styles/dn-international-tracking.css";

const InternationalTrackingLiveMap = lazy(() => import("./public/InternationalTrackingLiveMap"));
const RECENT_KEY = "dn_international_tracking_recent_v2";
const PAGE_ARABIC_HERO = "تتبّع شحنتك الدولية";
const CHECKPOINT_DISCLOSURE = "not live GPS tracking | ليس تتبع GPS مباشرًا";

const normalizeReference = (value: string) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
const validReference = (value: string) => /^[A-Z0-9\-_.]{5,80}$/.test(value);
const place = (city?: string | null, country?: string | null) => [city, country].filter(Boolean).join(", ") || "—";

function dateTime(value: string | null | undefined, locale = "en-AE") {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function readRecent() {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecent(reference: string, current: string[]) {
  const next = [reference, ...current.filter((item) => item !== reference)].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* restricted storage */
  }
  return next;
}

export default function InternationalTrackingPage() {
  const { language, toggleLanguage, theme, toggleTheme } = useAppContext();
  const trackingLanguage = language as TrackingLanguage;
  const t = trackingCopy(trackingLanguage);
  const isArabic = trackingLanguage === "ar";
  const initialNumber = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("number") || ""
    : "";

  const [query, setQuery] = useState(initialNumber);
  const [shipment, setShipment] = useState<EnrichedInternationalShipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(initialNumber));
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [copied, setCopied] = useState(false);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);
  const requestSequence = useRef(0);
  const lastSuccessfulReference = useRef("");

  useEffect(() => {
    const previousTitle = document.title;
    const title = isArabic
      ? "تتبع الشحن الدولي وأرامكس | DAY NIGHT"
      : "International & Aramex Tracking | DAY NIGHT";
    const description = isArabic
      ? "تتبع شحنتك الدولية مع أرامكس داخل منصة DAY NIGHT، مع خريطة تفاعلية وآخر نقطة مؤكدة وخط زمني كامل."
      : "Track international Aramex shipments inside DAY NIGHT with an interactive route map, verified checkpoint, and complete timeline.";

    document.title = title;
    const ensure = (selector: string, attrs: Record<string, string>) => {
      let node = document.head.querySelector(selector) as HTMLElement | null;
      if (!node) {
        node = document.createElement(attrs.rel ? "link" : "meta");
        document.head.appendChild(node);
      }
      Object.entries(attrs).forEach(([key, value]) => node?.setAttribute(key, value));
    };

    ensure('meta[name="description"]', { name: "description", content: description });
    ensure('meta[property="og:title"]', { property: "og:title", content: title });
    ensure('meta[property="og:description"]', { property: "og:description", content: description });
    ensure('link[rel="canonical"]', { rel: "canonical", href: `${window.location.origin}/international-tracking` });

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
      name: title,
      description,
      url: `${window.location.origin}/international-tracking`,
      provider: { "@type": "Organization", name: companyMeta.name, url: companyMeta.website },
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
    const reference = normalizeReference(forced ?? query);
    if (!validReference(reference)) {
      if (!silent) {
        setSearched(true);
        setError(t.invalid);
      }
      return;
    }
    if (!navigator.onLine) {
      setOffline(true);
      setError(t.offline);
      return;
    }

    const sequence = ++requestSequence.current;
    if (!silent) {
      setLoading(true);
      setSearched(true);
      setError("");
    }

    try {
      const result = await fetchInternationalTracking(reference);
      if (sequence !== requestSequence.current) return;
      if (!result.ok || !result.shipment) throw new Error(result.code || "not_found");

      setShipment(result.shipment as EnrichedInternationalShipment);
      setQuery(reference);
      setError("");
      lastSuccessfulReference.current = reference;
      setRecent((current) => saveRecent(reference, current));
      const url = new URL(window.location.href);
      url.searchParams.set("number", reference);
      window.history.replaceState(window.history.state, "", url);
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      const notFound = /not.found|404/i.test(cause instanceof Error ? cause.message : "");
      if (!silent || !shipment) setError(notFound ? t.notFound : t.apiError);
      if (notFound && !silent) setShipment(null);
    } finally {
      if (sequence === requestSequence.current && !silent) setLoading(false);
    }
  }, [query, shipment, t.apiError, t.invalid, t.notFound, t.offline]);

  useEffect(() => {
    if (initialNumber) void search(initialNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shipment || !lastSuccessfulReference.current) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void search(lastSuccessfulReference.current, true);
      }
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [search, shipment?.id]);

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
      setScannerError(t.cameraUnavailable);
      setScannerOpen(true);
      return;
    }

    try {
      setScannerOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      mediaStream.current = stream;
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (!videoRef.current) throw new Error("camera_unavailable");
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
          /* plain reference */
        }
        setQuery(reference);
        stopScanner();
        void search(reference);
      }, 550);
    } catch {
      setScannerError(t.cameraDenied);
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
    }
  }, [search, stopScanner, t.cameraDenied, t.cameraUnavailable]);

  const reference = shipment?.public_tracking_number || shipment?.carrier_tracking_number_full || query;
  const trackingLink = useMemo(() => internationalTrackingUrl(reference), [reference]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(trackingLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1700);
  };

  const share = async () => {
    const data = {
      title: isArabic ? "تتبع شحنة DAY NIGHT" : "Track a DAY NIGHT shipment",
      text: `${isArabic ? "تتبع الشحنة" : "Track shipment"} ${reference}`,
      url: trackingLink,
    };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard.writeText(trackingLink);
  };

  const downloadPdf = () => {
    if (!shipment) return;
    const meta = statusMeta(shipment.normalized_status);
    const doc = new jsPDF();
    doc.setFillColor(2, 9, 20);
    doc.rect(0, 0, 210, 45, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(companyMeta.name, 18, 21);
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(11);
    doc.text("INTERNATIONAL SHIPMENT TRACKING", 18, 31);
    doc.setTextColor(15, 30, 50);
    doc.setFontSize(11);

    const lines = [
      `Reference: ${reference || "—"}`,
      `Carrier: ${shipment.carrier_name || "Aramex"}`,
      `AWB: ${shipment.carrier_tracking_number_full || shipment.carrier_tracking_number || "—"}`,
      `Status: ${meta.en}`,
      `Origin: ${place(shipment.origin?.city || shipment.origin_city, shipment.origin?.country || shipment.origin_country)}`,
      `Destination: ${place(shipment.destination?.city || shipment.destination_city, shipment.destination?.country || shipment.destination_country)}`,
      `Latest checkpoint: ${shipment.latest_location || place(shipment.latest_city, shipment.latest_country)}`,
      `Last update: ${dateTime(shipment.latest_update_at)}`,
      `Estimated delivery: ${dateTime(shipment.estimated_delivery_at)}`,
      shipment.weight_kg ? `Weight: ${shipment.weight_kg} kg` : "",
      shipment.pieces ? `Pieces: ${shipment.pieces}` : "",
    ].filter(Boolean);

    lines.forEach((line, index) => doc.text(line, 18, 58 + index * 9));
    doc.setFontSize(9);
    doc.setTextColor(80, 95, 115);
    doc.text("Carrier checkpoints are not live GPS tracking. Generated securely by DAY NIGHT.", 18, 168);
    doc.text(companyMeta.displayWebsite, 18, 178);
    doc.save(`DAY-NIGHT-${reference || "international-tracking"}.pdf`);
  };

  const addTracking = () => {
    setQuery("");
    setShipment(null);
    setSearched(false);
    setError("");
    const url = new URL(window.location.href);
    url.searchParams.delete("number");
    window.history.replaceState(window.history.state, "", url);
    window.requestAnimationFrame(() => document.getElementById("dn-international-tracking-input")?.focus());
  };

  const actions = {
    copied,
    onCopy: () => void copyLink(),
    onShare: () => void share(),
    onDownload: downloadPdf,
    onPrint: () => window.print(),
    onRefresh: () => void search(lastSuccessfulReference.current || query),
  };

  return (
    <div className={`dn-it-page is-${theme}`} dir={isArabic ? "rtl" : "ltr"} data-disclosure={CHECKPOINT_DISCLOSURE}>
      <TrackingTopbar
        language={trackingLanguage}
        theme={theme}
        onToggleLanguage={toggleLanguage}
        onToggleTheme={toggleTheme}
        onAddTracking={addTracking}
      />

      <main className="dn-it-shell" aria-label={isArabic ? PAGE_ARABIC_HERO : "Track your international shipment"}>
        <section className="dn-it-search-deck">
          <TrackingSearch
            language={trackingLanguage}
            value={query}
            loading={loading}
            onChange={setQuery}
            onSubmit={() => void search()}
            onScan={() => void startScanner()}
          />
          <div className="dn-it-search-assurance">
            <span><i />{t.secure}</span>
            <span><RefreshCw />{t.autoRefresh}</span>
            <span><Headphones />24/7</span>
          </div>
        </section>

        {offline && <div className="dn-it-inline-alert is-warning"><AlertCircle />{t.offline}</div>}
        {error && shipment && (
          <div className="dn-it-inline-alert is-warning">
            <AlertCircle />{error}
            <button type="button" onClick={() => void search()}>{t.retry}</button>
          </div>
        )}

        {!searched && !loading && <InitialTrackingState language={trackingLanguage} />}
        {loading && !shipment && <TrackingLoadingState language={trackingLanguage} />}
        {!loading && searched && error && !shipment && (
          <TrackingErrorState language={trackingLanguage} message={error} onRetry={() => void search()} />
        )}

        {shipment && (
          <div className="dn-it-workspace" aria-live="polite">
            <div className="dn-it-map-area">
              <Suspense fallback={<div className="dn-it-map-suspense"><RefreshCw />{t.mapLoading}</div>}>
                <InternationalTrackingLiveMap shipment={shipment as InternationalShipment} language={trackingLanguage} />
              </Suspense>
            </div>

            <div className="dn-it-summary-area">
              <ShipmentHero shipment={shipment} language={trackingLanguage} actions={actions} />
            </div>

            <div className="dn-it-metrics-area">
              <ShipmentMetricsGrid shipment={shipment} language={trackingLanguage} />
            </div>

            <div className="dn-it-progress-area">
              <RouteProgressCard shipment={shipment} language={trackingLanguage} />
            </div>

            <div className="dn-it-timeline-area">
              <ShipmentTabs shipment={shipment} language={trackingLanguage} />
            </div>

            <aside className="dn-it-side-lower">
              <section className="dn-it-support-card">
                <span><Headphones /></span>
                <div>
                  <strong>{isArabic ? "هل تحتاج إلى مساعدة؟" : "Need shipment support?"}</strong>
                  <small>{isArabic ? "فريق DAY NIGHT متاح على مدار الساعة" : "DAY NIGHT support is available 24/7"}</small>
                </div>
                <a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer">{t.support}</a>
              </section>

              <section className="dn-it-recent-card">
                <header>
                  <span><Clock3 />{t.recent}</span>
                  {recent.length > 0 && (
                    <button type="button" onClick={() => {
                      setRecent([]);
                      try {
                        localStorage.removeItem(RECENT_KEY);
                      } catch {
                        /* noop */
                      }
                    }}>{t.clearRecent}</button>
                  )}
                </header>
                <div>
                  {recent.filter((item) => item !== reference).length > 0
                    ? recent.filter((item) => item !== reference).map((item) => (
                      <button type="button" key={item} onClick={() => {
                        setQuery(item);
                        void search(item);
                      }}>
                        <Clock3 /><span dir="ltr">{item}</span>
                      </button>
                    ))
                    : <small>{isArabic ? "لا توجد أرقام أخرى محفوظة." : "No other saved references."}</small>}
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>

      <footer className="dn-it-footer">
        <span>{companyMeta.name}</span>
        <small>{isArabic ? companyMeta.sloganAr : companyMeta.sloganEn}</small>
        <a href={companyMeta.website}>{companyMeta.displayWebsite}</a>
      </footer>

      {scannerOpen && (
        <div className="dn-it-scanner" role="dialog" aria-modal="true" aria-label={t.scanQr}>
          <div className="dn-it-scanner-card">
            <button type="button" className="dn-it-scanner-close" onClick={stopScanner} aria-label={t.close}><X /></button>
            <QrCode className="dn-it-scanner-title-icon" />
            <h2>{t.scanQr}</h2>
            <div className="dn-it-video-frame"><video ref={videoRef} muted playsInline /><span /></div>
            {scannerError && <div className="dn-it-inline-alert is-warning"><AlertCircle />{scannerError}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
