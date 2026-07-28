import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import {
  fetchInternationalTracking,
  type InternationalShipment,
} from "../../lib/internationalTrackingApi";
import InternationalTrackingLiveMap from "./InternationalTrackingLiveMap";
import "../../styles/dn-international-tracking-layout-fix.css";

const ROUTE_PATTERN = /^\/international-tracking\/?$/i;
const HOST_ID = "dn-it-live-map-host";

function referenceFromLocation() {
  return new URL(window.location.href).searchParams.get("number")?.trim() || "";
}

function ensureMapHost() {
  const shell = document.querySelector<HTMLElement>(".dn-it-shell");
  const hero = shell?.querySelector<HTMLElement>(".dn-it-hero");
  const results = shell?.querySelector<HTMLElement>(".dn-it-results");
  if (!shell || !hero || !results) return null;

  let host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (!host) {
    host = document.createElement("section");
    host.id = HOST_ID;
    host.className = "dn-it-live-map-host";
    shell.insertBefore(host, hero);
  }
  return host;
}

export default function InternationalTrackingVisualBridge() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [shipment, setShipment] = useState<InternationalShipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const activeReference = useRef("");
  const requestSequence = useRef(0);

  useLayoutEffect(() => {
    if (!ROUTE_PATTERN.test(window.location.pathname)) return;
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    document.documentElement.classList.add("dn-it-standalone-root");
    document.body.classList.add("dn-it-standalone-root");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));

    return () => {
      window.cancelAnimationFrame(frame);
      window.history.scrollRestoration = previousRestoration;
      document.documentElement.classList.remove("dn-it-standalone-root");
      document.body.classList.remove("dn-it-standalone-root", "dn-it-has-live-map");
    };
  }, []);

  useEffect(() => {
    if (!ROUTE_PATTERN.test(window.location.pathname)) return;
    let disposed = false;
    let queued = 0;

    const sync = () => {
      if (disposed) return;
      const results = document.querySelector(".dn-it-results");
      const nextHost = results ? ensureMapHost() : null;

      if (!nextHost) {
        document.body.classList.remove("dn-it-has-live-map");
        setHost(null);
        setShipment(null);
        activeReference.current = "";
        return;
      }

      document.body.classList.add("dn-it-has-live-map");
      setHost((current) => current === nextHost ? current : nextHost);
      const reference = referenceFromLocation();
      if (!reference || reference === activeReference.current) return;

      activeReference.current = reference;
      const sequence = ++requestSequence.current;
      setLoading(true);
      setMapError("");
      void fetchInternationalTracking(reference)
        .then((result) => {
          if (disposed || sequence !== requestSequence.current) return;
          if (!result.ok || !result.shipment) throw new Error(result.code || "map_tracking_not_found");
          setShipment(result.shipment);
        })
        .catch(() => {
          if (disposed || sequence !== requestSequence.current) return;
          setShipment(null);
          setMapError(isArabic ? "تعذر تجهيز الخريطة الآن، بينما تظل بيانات التتبع متاحة بالأسفل." : "The map could not be prepared, while tracking details remain available below.");
        })
        .finally(() => {
          if (!disposed && sequence === requestSequence.current) setLoading(false);
        });
    };

    const scheduleSync = () => {
      window.cancelAnimationFrame(queued);
      queued = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", scheduleSync);
    window.addEventListener("focus", scheduleSync);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(queued);
      observer.disconnect();
      window.removeEventListener("popstate", scheduleSync);
      window.removeEventListener("focus", scheduleSync);
      document.body.classList.remove("dn-it-has-live-map");
      document.getElementById(HOST_ID)?.remove();
    };
  }, [isArabic]);

  if (!host) return null;

  return createPortal(
    loading ? (
      <div className="dn-it-live-map-loading" role="status">
        <RefreshCw aria-hidden="true" />
        <span>{isArabic ? "جاري تجهيز خريطة الرحلة…" : "Preparing the live journey map…"}</span>
      </div>
    ) : shipment ? (
      <InternationalTrackingLiveMap shipment={shipment} isArabic={isArabic} />
    ) : (
      <div className="dn-it-live-map-loading is-error" role="status">
        <span>✈</span>
        <b>{mapError || (isArabic ? "الخريطة غير متاحة مؤقتًا" : "Map temporarily unavailable")}</b>
      </div>
    ),
    host,
  );
}
