import { useEffect, useMemo, useRef, useState } from "react";
import L, { latLngBounds, type LatLngTuple } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  Crosshair,
  Expand,
  Eye,
  EyeOff,
  Globe2,
  LocateFixed,
  MapPin,
  Plane,
  Route,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { InternationalShipment } from "../../lib/internationalTrackingApi";
import { internationalTrackingAssets } from "../../lib/internationalTrackingAssets";
import {
  resolveInternationalMapPoints,
  type InternationalTrackingMapPoint,
} from "../public/InternationalTrackingLiveMap";
import {
  adminInternationalMapLights,
  adminInternationalNetworkPreviewRoutes,
} from "../../data/adminInternationalMapLights";
import "../../styles/dn-international-operations-map.css";

type Props = {
  shipment: InternationalShipment | null;
  isArabic: boolean;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>\'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}

function greatCircle(from: LatLngTuple, to: LatLngTuple, segments = 64): LatLngTuple[] {
  const toRadians = (value: number) => value * Math.PI / 180;
  const toDegrees = (value: number) => value * 180 / Math.PI;
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const lambda1 = toRadians(lng1);
  const lambda2 = toRadians(lng2);
  const delta = 2 * Math.asin(Math.sqrt(
    Math.sin((phi2 - phi1) / 2) ** 2
      + Math.cos(phi1) * Math.cos(phi2) * Math.sin((lambda2 - lambda1) / 2) ** 2,
  ));
  if (!Number.isFinite(delta) || delta < 0.000001) return [from, to];
  const denominator = Math.sin(delta);
  return Array.from({ length: segments + 1 }, (_, index) => {
    const ratio = index / segments;
    const scaleA = Math.sin((1 - ratio) * delta) / denominator;
    const scaleB = Math.sin(ratio * delta) / denominator;
    const x = scaleA * Math.cos(phi1) * Math.cos(lambda1) + scaleB * Math.cos(phi2) * Math.cos(lambda2);
    const y = scaleA * Math.cos(phi1) * Math.sin(lambda1) + scaleB * Math.cos(phi2) * Math.sin(lambda2);
    const z = scaleA * Math.sin(phi1) + scaleB * Math.sin(phi2);
    return [
      toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
      toDegrees(Math.atan2(y, x)),
    ] as LatLngTuple;
  });
}

function bearing(from: InternationalTrackingMapPoint, to: InternationalTrackingMapPoint) {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const delta = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(delta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function planeIcon(rotation: number) {
  return L.divIcon({
    className: "dn-intl-ops-plane-marker",
    html: `<span class="dn-intl-ops-plane-glow"></span><img src="${internationalTrackingAssets.markers.aircraftDayNight}" alt="" style="--dn-intl-plane-rotation:${rotation}deg" />`,
    iconSize: [76, 54],
    iconAnchor: [38, 27],
  });
}

function checkpointIcon(label: string, kind: "origin" | "latest" | "destination") {
  const asset = kind === "latest"
    ? internationalTrackingAssets.markers.currentPin
    : internationalTrackingAssets.markers.dayNightPin;
  return L.divIcon({
    className: `dn-intl-ops-checkpoint dn-intl-ops-checkpoint--${kind}`,
    html: `<span><img src="${asset}" alt="" /></span><b>${escapeHtml(label)}</b>`,
    iconSize: [54, 62],
    iconAnchor: [27, 49],
  });
}

function FitMap({ points, focus }: { points: InternationalTrackingMapPoint[]; focus: InternationalTrackingMapPoint }) {
  const map = useMap();
  const signature = points.map((point) => `${point.lat}:${point.lng}`).join("|");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
      if (points.length > 1) {
        map.fitBounds(
          latLngBounds(points.map((point) => [point.lat, point.lng] as LatLngTuple)),
          { padding: [62, 62], maxZoom: 6, animate: false },
        );
      } else {
        map.setView([focus.lat, focus.lng], points.length ? 6 : 3, { animate: false });
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [focus.lat, focus.lng, map, signature]);
  return null;
}

function MapControls({
  points,
  focus,
  isArabic,
  cityLights,
  networkPreview,
  onToggleCityLights,
  onToggleNetworkPreview,
}: {
  points: InternationalTrackingMapPoint[];
  focus: InternationalTrackingMapPoint;
  isArabic: boolean;
  cityLights: boolean;
  networkPreview: boolean;
  onToggleCityLights: () => void;
  onToggleNetworkPreview: () => void;
}) {
  const map = useMap();
  const fit = () => {
    if (points.length > 1) {
      map.fitBounds(latLngBounds(points.map((point) => [point.lat, point.lng] as LatLngTuple)), {
        padding: [62, 62],
        maxZoom: 6,
      });
      return;
    }
    map.flyTo([focus.lat, focus.lng], points.length ? 6 : 3, { duration: 0.45 });
  };
  const recenter = () => map.flyTo([focus.lat, focus.lng], Math.max(5, map.getZoom()), { duration: 0.45 });
  const fullscreen = async () => {
    const shell = map.getContainer().closest(".dn-intl-ops-map") as HTMLElement | null;
    if (!shell) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await shell.requestFullscreen?.().catch(() => undefined);
    window.setTimeout(() => map.invalidateSize(), 120);
  };
  return (
    <div className="dn-intl-ops-map__controls">
      <button type="button" onClick={fit} title={isArabic ? "ملاءمة المسار" : "Fit route"} aria-label={isArabic ? "ملاءمة المسار" : "Fit route"}><Crosshair /></button>
      <button type="button" onClick={recenter} title={isArabic ? "إعادة التمركز" : "Recenter"} aria-label={isArabic ? "إعادة التمركز" : "Recenter"}><LocateFixed /></button>
      <button type="button" onClick={onToggleCityLights} className={cityLights ? "is-active" : ""} title={isArabic ? "أنوار المدن" : "City lights"} aria-label={isArabic ? "أنوار المدن" : "City lights"}>{cityLights ? <Eye /> : <EyeOff />}</button>
      <button type="button" onClick={onToggleNetworkPreview} className={networkPreview ? "is-active" : ""} title={isArabic ? "شبكة المسارات التوضيحية" : "Network preview"} aria-label={isArabic ? "شبكة المسارات التوضيحية" : "Network preview"}><Route /></button>
      <button type="button" onClick={() => void fullscreen()} title={isArabic ? "ملء الشاشة" : "Fullscreen"} aria-label={isArabic ? "ملء الشاشة" : "Fullscreen"}><Expand /></button>
    </div>
  );
}

export default function AdminInternationalOperationsMap({ shipment, isArabic }: Props) {
  const language = isArabic ? "ar" : "en";
  const route = useMemo(() => shipment ? resolveInternationalMapPoints(shipment, language) : null, [language, shipment]);
  const [cityLights, setCityLights] = useState(true);
  const [networkPreview, setNetworkPreview] = useState(true);
  const mapShellRef = useRef<HTMLElement | null>(null);
  const worldFocus: InternationalTrackingMapPoint = { lat: 24.4539, lng: 54.3773, label: "Abu Dhabi", estimated: true };
  const focus = route?.plane || worldFocus;
  const points = [route?.origin, route?.destination, route?.latest].filter((point): point is InternationalTrackingMapPoint => Boolean(point));
  const rotation = route?.mode === "route" ? bearing(route.plane, route.destination) - 90 : -8;
  const confirmedEvents = (shipment?.events || [])
    .filter((event) => Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude)))
    .slice(-8);

  useEffect(() => {
    const listener = () => window.setTimeout(() => {
      const mapElement = mapShellRef.current?.querySelector(".leaflet-container") as HTMLElement | null;
      mapElement?.dispatchEvent(new Event("resize"));
    }, 120);
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  }, []);

  const heading = shipment
    ? (isArabic ? "خريطة عمليات الشحنة" : "Shipment operations map")
    : (isArabic ? "شبكة DAY NIGHT الدولية" : "DAY NIGHT international network");
  const positionSource = route
    ? (route.plane.estimated
      ? (isArabic ? "موقع تقديري من بيانات المسار" : "Estimated from route data")
      : (isArabic ? "آخر نقطة مؤكدة من الناقل" : "Last confirmed carrier point"))
    : (isArabic ? "عرض توضيحي للشبكة — لا توجد شحنة محددة" : "Network preview — no shipment selected");

  return (
    <section className="dn-intl-ops-map" ref={mapShellRef} aria-label={heading}>
      <header className="dn-intl-ops-map__header">
        <div>
          <span><Globe2 /></span>
          <div><small>{isArabic ? "مركز العمليات العالمي" : "GLOBAL OPERATIONS CENTER"}</small><strong>{heading}</strong></div>
        </div>
        <em className={route && !route.plane.estimated ? "is-confirmed" : "is-estimated"}><i />{positionSource}</em>
      </header>
      <div className="dn-intl-ops-map__canvas-wrap">
        <MapContainer center={[focus.lat, focus.lng]} zoom={shipment ? 5 : 3} zoomControl={false} preferCanvas className="dn-intl-ops-map__canvas">
          <TileLayer attribution="&copy; OpenStreetMap contributors &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={19} crossOrigin="anonymous" />
          {cityLights && adminInternationalMapLights.map((light) => {
            const color = light.tone === "gold" ? "#f4cf67" : light.tone === "blue" ? "#55b9ff" : "#ffffff";
            const radius = light.tier === "global" ? 4 : light.tier === "regional" ? 3 : 2;
            return <CircleMarker key={light.id} center={light.coordinates} radius={radius} pathOptions={{ color, fillColor: color, fillOpacity: 0.86, opacity: 0.65, weight: 1 }} className={`dn-intl-city-light dn-intl-city-light--${light.tier}`}><Tooltip direction="top">{light.name} · {light.id}</Tooltip></CircleMarker>;
          })}
          {networkPreview && adminInternationalNetworkPreviewRoutes.map((preview) => greatCircle(preview.from, preview.to).map((line, index, all) => index === 0 ? null : <Polyline key={`${preview.id}-${index}`} positions={[all[index - 1], line]} pathOptions={{ color: "#3d9df4", opacity: 0.22, weight: 1.2, dashArray: "3 11", lineCap: "round" }} />))}
          {route?.mode === "route" && <>
            <Polyline positions={route.routeLine} pathOptions={{ color: "#338fff", weight: 8, opacity: 0.11, lineCap: "round" }} />
            <Polyline positions={route.routeLine} pathOptions={{ color: "#52b9ff", weight: 2.4, opacity: 0.76, dashArray: "7 11", lineCap: "round" }} />
            <Polyline positions={route.completedLine} pathOptions={{ color: "#f2c94c", weight: 7, opacity: 0.12, lineCap: "round" }} />
            <Polyline positions={route.completedLine} pathOptions={{ color: "#f2c94c", weight: 3.3, opacity: 1, lineCap: "round" }} />
          </>}
          {confirmedEvents.map((event, index) => <CircleMarker key={`${event.event_time || "event"}-${index}`} center={[Number(event.latitude), Number(event.longitude)]} radius={3.5} pathOptions={{ color: "#f2c94c", fillColor: "#081d37", fillOpacity: 1, weight: 1.6 }}><Tooltip direction="top">{event.location || event.city || (isArabic ? "نقطة تتبع مؤكدة" : "Confirmed checkpoint")}</Tooltip></CircleMarker>)}
          {route?.origin && <Marker position={[route.origin.lat, route.origin.lng]} icon={checkpointIcon(isArabic ? "من" : "FROM", "origin")}><Tooltip direction="top">{route.origin.label}</Tooltip></Marker>}
          {route?.latest && <Marker position={[route.latest.lat, route.latest.lng]} icon={checkpointIcon(isArabic ? "الحالي" : "CURRENT", "latest")}><Tooltip direction="top">{route.latest.label}</Tooltip></Marker>}
          {route?.destination && <Marker position={[route.destination.lat, route.destination.lng]} icon={checkpointIcon(isArabic ? "إلى" : "TO", "destination")}><Tooltip direction="top">{route.destination.label}</Tooltip></Marker>}
          {route && route.mode !== "world" && <Marker position={[route.plane.lat, route.plane.lng]} icon={planeIcon(rotation)} zIndexOffset={1000}><Tooltip direction="top" permanent>{route.plane.estimated ? (isArabic ? "موقع تقديري" : "Estimated position") : (isArabic ? "آخر موقع مؤكد" : "Last confirmed position")}</Tooltip></Marker>}
          <FitMap points={points} focus={focus} />
          <MapControls points={points} focus={focus} isArabic={isArabic} cityLights={cityLights} networkPreview={networkPreview} onToggleCityLights={() => setCityLights((value) => !value)} onToggleNetworkPreview={() => setNetworkPreview((value) => !value)} />
        </MapContainer>
        <div className="dn-intl-ops-map__legend" aria-label={isArabic ? "مفتاح الخريطة" : "Map legend"}>
          <span><i className="is-gold" />{isArabic ? "المسار المكتمل" : "Completed"}</span>
          <span><i className="is-blue" />{isArabic ? "المسار الجاري" : "Active route"}</span>
          <span><i className="is-white" />{isArabic ? "أنوار المدن" : "City lights"}</span>
          <span><Plane />{isArabic ? "طائرة DAY NIGHT" : "DAY NIGHT aircraft"}</span>
        </div>
      </div>
      <footer className="dn-intl-ops-map__footer">
        <article><MapPin /><span><small>{isArabic ? "آخر موقع" : "Latest location"}</small><strong>{shipment?.latest_location || shipment?.latest_city || (isArabic ? "بانتظار بيانات الناقل" : "Awaiting carrier data")}</strong></span></article>
        <article><Plane /><span><small>{isArabic ? "رقم البوليصة" : "AWB"}</small><strong dir="ltr">{shipment?.carrier_tracking_number_full || shipment?.tracking_number || shipment?.carrier_tracking_number || "—"}</strong></span></article>
        <article><Route /><span><small>{isArabic ? "المصدر" : "Position source"}</small><strong>{positionSource}</strong></span></article>
      </footer>
      {!shipment && <div className="dn-intl-ops-map__empty"><Globe2 /><span><strong>{isArabic ? "اختر طلبًا مربوطًا ببوليصة تتبع" : "Select an order with a linked AWB"}</strong><small>{isArabic ? "المسارات الزرقاء عرض توضيحي للشبكة وليست شحنات حية." : "Blue routes are a network preview, not live shipments."}</small></span></div>}
    </section>
  );
}
