import { useEffect, useMemo } from "react";
import L, { latLngBounds, type LatLngTuple } from "leaflet";
import { LayersControl, MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import { Clock3, Crosshair, Expand, LocateFixed, MapPin, Plane } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { InternationalShipment, InternationalTrackingEvent } from "../../lib/internationalTrackingApi";
import { internationalTrackingAssets } from "../../lib/internationalTrackingAssets";
import type { TrackingLanguage } from "../international-tracking/i18n";
import { trackingCopy } from "../international-tracking/i18n";
import { statusMeta } from "../international-tracking/status";

export type InternationalTrackingMapPoint = { lat: number; lng: number; label: string; estimated: boolean };

const CITY_COORDINATES: Record<string, LatLngTuple> = {
  ajman: [25.4052, 55.5136], dubai: [25.2048, 55.2708], "abu dhabi": [24.4539, 54.3773], mussafah: [24.3589, 54.4827],
  "al ain": [24.1302, 55.8023], sharjah: [25.3463, 55.4209], fujairah: [25.1288, 56.3265], "khor fakkan": [25.3313, 56.3575],
  riyadh: [24.7136, 46.6753], jeddah: [21.4858, 39.1925], doha: [25.2854, 51.531], muscat: [23.588, 58.3829], manama: [26.2235, 50.5876],
  singapore: [1.3521, 103.8198], london: [51.5072, -0.1276], paris: [48.8566, 2.3522], vienna: [48.2082, 16.3738],
  "new york": [40.7128, -74.006], "los angeles": [34.0522, -118.2437], toronto: [43.6532, -79.3832], sydney: [-33.8688, 151.2093],
  "sao paulo": [-23.5505, -46.6333], johannesburg: [-26.2041, 28.0473], tokyo: [35.6762, 139.6503],
};

const COUNTRY_COORDINATES: Record<string, LatLngTuple> = {
  ae: [24.4539, 54.3773], uae: [24.4539, 54.3773], "united arab emirates": [24.4539, 54.3773],
  sa: [24.7136, 46.6753], "saudi arabia": [24.7136, 46.6753], qa: [25.2854, 51.531], qatar: [25.2854, 51.531],
  sg: [1.3521, 103.8198], singapore: [1.3521, 103.8198], us: [39.8283, -98.5795], usa: [39.8283, -98.5795],
  gb: [55.3781, -3.436], uk: [55.3781, -3.436], ca: [56.1304, -106.3468], canada: [56.1304, -106.3468],
  au: [-25.2744, 133.7751], australia: [-25.2744, 133.7751],
};

const normalizePlace = (value: unknown) => String(value || "").trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
const placeLabel = (city: unknown, country: unknown, fallback: string) => [String(city || "").trim(), String(country || "").trim()].filter(Boolean).join(", ") || fallback;

function validCoordinate(value: unknown, min: number, max: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max ? numeric : null;
}

function pointFromCoordinates(coordinates: { latitude?: number | null; longitude?: number | null } | null | undefined, label: string) {
  const lat = validCoordinate(coordinates?.latitude, -90, 90);
  const lng = validCoordinate(coordinates?.longitude, -180, 180);
  return lat === null || lng === null ? null : ({ lat, lng, label, estimated: false } satisfies InternationalTrackingMapPoint);
}

function fallbackPoint(city: unknown, country: unknown, label: string) {
  const coordinates = CITY_COORDINATES[normalizePlace(city)] || COUNTRY_COORDINATES[normalizePlace(country)];
  return coordinates ? ({ lat: coordinates[0], lng: coordinates[1], label, estimated: true } satisfies InternationalTrackingMapPoint) : null;
}

function eventPoint(event: InternationalTrackingEvent | undefined, fallbackLabel: string) {
  if (!event) return null;
  const lat = validCoordinate(event.latitude, -90, 90);
  const lng = validCoordinate(event.longitude, -180, 180);
  return lat === null || lng === null ? null : ({ lat, lng, label: event.location || placeLabel(event.city, event.country, fallbackLabel), estimated: false } satisfies InternationalTrackingMapPoint);
}

function toVector(point: InternationalTrackingMapPoint) {
  const lat = point.lat * Math.PI / 180;
  const lng = point.lng * Math.PI / 180;
  return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)] as const;
}

function greatCircle(origin: InternationalTrackingMapPoint, destination: InternationalTrackingMapPoint, segments = 80) {
  const a = toVector(origin);
  const b = toVector(destination);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 0.000001) return [[origin.lat, origin.lng], [destination.lat, destination.lng]] as LatLngTuple[];
  const sinOmega = Math.sin(omega);
  return Array.from({ length: segments + 1 }, (_, index) => {
    const ratio = index / segments;
    const scaleA = Math.sin((1 - ratio) * omega) / sinOmega;
    const scaleB = Math.sin(ratio * omega) / sinOmega;
    const x = scaleA * a[0] + scaleB * b[0];
    const y = scaleA * a[1] + scaleB * b[1];
    const z = scaleA * a[2] + scaleB * b[2];
    return [Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI, Math.atan2(y, x) * 180 / Math.PI] as LatLngTuple;
  });
}

function pointOnRoute(route: LatLngTuple[], progress: number) {
  const ratio = Math.max(0, Math.min(1, progress));
  const position = ratio * (route.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(route.length - 1, Math.ceil(position));
  const mix = position - lower;
  return { lat: route[lower][0] + (route[upper][0] - route[lower][0]) * mix, lng: route[lower][1] + (route[upper][1] - route[lower][1]) * mix };
}

function bearing(origin: InternationalTrackingMapPoint, destination: InternationalTrackingMapPoint) {
  const lat1 = origin.lat * Math.PI / 180;
  const lat2 = destination.lat * Math.PI / 180;
  const delta = (destination.lng - origin.lng) * Math.PI / 180;
  const y = Math.sin(delta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function markerIcon(kind: "origin" | "destination" | "checkpoint", label: string) {
  const image = kind === "checkpoint" ? internationalTrackingAssets.markers.currentPin : internationalTrackingAssets.markers.dayNightPin;
  return L.divIcon({
    className: `dn-it-live-marker dn-it-live-marker--${kind}`,
    html: `<span><img src="${image}" alt="" /></span><b>${label}</b>`,
    iconSize: [48, 60],
    iconAnchor: [24, 48],
  });
}

function planeIcon(rotation: number, delivered: boolean) {
  return L.divIcon({
    className: "dn-it-live-plane-marker",
    html: `<span class="dn-it-live-plane-pulse"></span><span class="dn-it-live-plane-shell"><img class="dn-it-live-plane" src="${internationalTrackingAssets.markers.aircraftDayNight}" alt="" style="--dn-plane-rotation:${rotation}deg" /></span>${delivered ? '<i>✓</i>' : ""}`,
    iconSize: [92, 64],
    iconAnchor: [46, 32],
  });
}

function FitRoute({ points }: { points: InternationalTrackingMapPoint[] }) {
  const map = useMap();
  const key = points.map((point) => `${point.lat}:${point.lng}`).join("|");
  useEffect(() => {
    if (!points.length) return;
    const bounds = latLngBounds(points.map((point) => [point.lat, point.lng] as LatLngTuple));
    const timer = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds, { padding: [72, 72], maxZoom: 6, animate: false });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [key, map, points]);
  return null;
}

function MapActionControls({ points, plane, language }: { points: InternationalTrackingMapPoint[]; plane: InternationalTrackingMapPoint; language: TrackingLanguage }) {
  const map = useMap();
  const t = trackingCopy(language);
  const fit = () => map.fitBounds(latLngBounds(points.map((point) => [point.lat, point.lng] as LatLngTuple)), { padding: [72, 72], maxZoom: 6 });
  const recenter = () => map.flyTo([plane.lat, plane.lng], Math.max(map.getZoom(), 5), { duration: 0.55 });
  const fullscreen = async () => {
    const container = map.getContainer().closest(".dn-it-live-map") as HTMLElement | null;
    if (!container) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await container.requestFullscreen?.().catch(() => undefined);
    window.setTimeout(() => map.invalidateSize(), 120);
  };
  return <div className="dn-it-map-action-controls"><button type="button" onClick={fit} title={t.fitRoute} aria-label={t.fitRoute}><Crosshair /></button><button type="button" onClick={recenter} title={t.recenter} aria-label={t.recenter}><LocateFixed /></button><button type="button" onClick={() => void fullscreen()} title={t.fullScreen} aria-label={t.fullScreen}><Expand /></button></div>;
}

export function resolveInternationalMapPoints(shipment: InternationalShipment, language: TrackingLanguage) {
  const t = trackingCopy(language);
  const originData = shipment.origin || { city: shipment.origin_city, country: shipment.origin_country, coordinates: null };
  const destinationData = shipment.destination || { city: shipment.destination_city, country: shipment.destination_country, coordinates: null };
  const originLabel = placeLabel(originData.city, originData.country, t.origin);
  const destinationLabel = placeLabel(destinationData.city, destinationData.country, t.destination);
  const origin = pointFromCoordinates(originData.coordinates, originLabel) || fallbackPoint(originData.city, originData.country, originLabel) || fallbackPoint(shipment.origin_city, shipment.origin_country, originLabel);
  const destination = pointFromCoordinates(destinationData.coordinates, destinationLabel) || fallbackPoint(destinationData.city, destinationData.country, destinationLabel) || fallbackPoint(shipment.destination_city, shipment.destination_country, destinationLabel);
  if (!origin || !destination) return null;

  const events = [...(shipment.events || [])].sort((a, b) => Date.parse(b.event_time || "") - Date.parse(a.event_time || ""));
  const latestEventWithCoordinates = events.find((event) => validCoordinate(event.latitude, -90, 90) !== null && validCoordinate(event.longitude, -180, 180) !== null);
  const latestLabel = shipment.latest_location || placeLabel(shipment.latest_city, shipment.latest_country, t.latestCheckpoint);
  const latest = pointFromCoordinates(shipment.latest_coordinates, latestLabel) || eventPoint(latestEventWithCoordinates, latestLabel);
  const status = statusMeta(shipment.normalized_status);
  const routeLine = greatCircle(origin, destination);
  const estimated = pointOnRoute(routeLine, status.progress / 100);
  const plane = status.key === "delivered" ? destination : (latest || { ...estimated, label: t.estimatedPosition, estimated: true });
  const checkpointIndex = routeLine.reduce((best, point, index) => {
    const distance = Math.abs(point[0] - plane.lat) + Math.abs(point[1] - plane.lng);
    const current = Math.abs(routeLine[best][0] - plane.lat) + Math.abs(routeLine[best][1] - plane.lng);
    return distance < current ? index : best;
  }, 0);
  return { origin, destination, latest: latest || plane, plane, routeLine, completedLine: routeLine.slice(0, Math.max(2, checkpointIndex + 1)), status };
}

function statusLabelSafe(value: string, language: TrackingLanguage) {
  const status = statusMeta(value);
  return language === "ar" ? status.ar : status.en;
}

function formatDate(value: string | null | undefined, language: TrackingLanguage) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language === "ar" ? "ar-AE" : "en-AE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function InternationalTrackingLiveMap({ shipment, language }: { shipment: InternationalShipment; language: TrackingLanguage }) {
  const t = trackingCopy(language);
  const isArabic = language === "ar";
  const route = useMemo(() => resolveInternationalMapPoints(shipment, language), [language, shipment]);
  if (!route) return <section className="dn-it-live-map dn-it-live-map--unavailable"><div><Plane /><strong>{t.mapUnavailable}</strong><small>{t.noGps}</small></div></section>;

  const mapPoints = [route.origin, route.destination, route.latest];
  const rotation = bearing(route.origin, route.destination) - 90;
  const delivered = route.status.key === "delivered";

  return (
    <section className="dn-it-live-map" aria-label={isArabic ? "خريطة رحلة الشحنة الدولية" : "International shipment journey map"}>
      <div className="dn-it-live-map__heading">
        <div><span><i />{isArabic ? "تتبع مباشر" : "Live tracking"}</span><strong>{route.origin.label} <b>→</b> {route.destination.label}</strong></div>
        <em className={delivered ? "is-delivered" : route.plane.estimated ? "is-estimated" : "is-confirmed"}><i />{delivered ? statusLabelSafe("delivered", language) : route.plane.estimated ? t.estimatedPosition : t.confirmedPosition}</em>
      </div>

      <MapContainer center={[route.plane.lat, route.plane.lng]} zoom={4} zoomControl={false} scrollWheelZoom touchZoom doubleClickZoom preferCanvas className="dn-it-live-map__canvas">
        <LayersControl position={isArabic ? "topleft" : "topright"}>
          <LayersControl.BaseLayer checked name={isArabic ? "الخريطة الليلية" : "Night map"}><TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={19} /></LayersControl.BaseLayer>
          <LayersControl.BaseLayer name={isArabic ? "الخريطة الواضحة" : "Light map"}><TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} /></LayersControl.BaseLayer>
        </LayersControl>
        <ZoomControl position={isArabic ? "bottomleft" : "bottomright"} />
        <Polyline positions={route.routeLine} pathOptions={{ color: "#2F81F7", weight: 3, opacity: 0.72, dashArray: "7 12", lineCap: "round" }} />
        <Polyline positions={route.completedLine} pathOptions={{ color: "#F2C94C", weight: 4, opacity: 1, lineCap: "round" }} />
        <Marker position={[route.origin.lat, route.origin.lng]} icon={markerIcon("origin", isArabic ? "من" : "FROM")}><Tooltip direction="top" offset={[0, -20]}>{route.origin.label}</Tooltip></Marker>
        <Marker position={[route.destination.lat, route.destination.lng]} icon={markerIcon("destination", isArabic ? "إلى" : "TO")}><Tooltip direction="top" offset={[0, -20]}>{route.destination.label}</Tooltip></Marker>
        <Marker position={[route.latest.lat, route.latest.lng]} icon={markerIcon("checkpoint", isArabic ? "آخر" : "LATEST")}><Tooltip direction="top" offset={[0, -20]}>{route.latest.label || t.latestCheckpoint}</Tooltip></Marker>
        <Marker position={[route.plane.lat, route.plane.lng]} icon={planeIcon(rotation, delivered)} zIndexOffset={1000}><Tooltip direction="top" offset={[0, -18]} permanent>{delivered ? statusLabelSafe("delivered", language) : route.plane.estimated ? t.estimatedPosition : t.confirmedPosition}</Tooltip></Marker>
        <FitRoute points={mapPoints} /><MapActionControls points={mapPoints} plane={route.plane} language={language} />
      </MapContainer>

      <div className="dn-it-map-journey-stats">
        <article><MapPin /><span><small>{t.latestCheckpoint}</small><strong>{route.latest.label || t.carrierUpdates}</strong></span></article>
        <article><Clock3 /><span><small>{t.lastUpdate}</small><strong>{formatDate(shipment.latest_update_at, language)}</strong></span></article>
        <article><Plane /><span><small>{t.estimatedDelivery}</small><strong>{formatDate(shipment.estimated_delivery_at, language)}</strong></span></article>
      </div>
      <p className="dn-it-live-map__notice"><span aria-hidden="true">i</span>{t.noGps}</p>
    </section>
  );
}
