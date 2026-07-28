import { useEffect, useMemo } from "react";
import L, { latLngBounds, type LatLngTuple } from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { InternationalShipment, InternationalTrackingEvent } from "../../lib/internationalTrackingApi";

export type InternationalTrackingMapPoint = {
  lat: number;
  lng: number;
  label: string;
  estimated: boolean;
};

const CITY_COORDINATES: Record<string, LatLngTuple> = {
  "ajman": [25.4052, 55.5136],
  "ajman city": [25.4052, 55.5136],
  "dubai": [25.2048, 55.2708],
  "abu dhabi": [24.4539, 54.3773],
  "mussafah": [24.3589, 54.4827],
  "al ain": [24.1302, 55.8023],
  "sharjah": [25.3463, 55.4209],
  "umm al quwain": [25.5647, 55.5552],
  "ras al khaimah": [25.7895, 55.9432],
  "fujairah": [25.1288, 56.3265],
  "khor fakkan": [25.3313, 56.3575],
  "riyadh": [24.7136, 46.6753],
  "jeddah": [21.4858, 39.1925],
  "dammam": [26.4207, 50.0888],
  "mecca": [21.3891, 39.8579],
  "makkah": [21.3891, 39.8579],
  "medina": [24.5247, 39.5692],
  "doha": [25.2854, 51.5310],
  "kuwait city": [29.3759, 47.9774],
  "muscat": [23.5880, 58.3829],
  "manama": [26.2235, 50.5876],
  "london": [51.5072, -0.1276],
  "new york": [40.7128, -74.0060],
  "toronto": [43.6532, -79.3832],
  "sydney": [-33.8688, 151.2093],
};

const COUNTRY_COORDINATES: Record<string, LatLngTuple> = {
  ae: [24.4539, 54.3773],
  uae: [24.4539, 54.3773],
  "united arab emirates": [24.4539, 54.3773],
  sa: [24.7136, 46.6753],
  ksa: [24.7136, 46.6753],
  "saudi arabia": [24.7136, 46.6753],
  qa: [25.2854, 51.5310],
  qatar: [25.2854, 51.5310],
  kw: [29.3759, 47.9774],
  kuwait: [29.3759, 47.9774],
  om: [23.5880, 58.3829],
  oman: [23.5880, 58.3829],
  bh: [26.2235, 50.5876],
  bahrain: [26.2235, 50.5876],
};

const STATUS_PROGRESS: Record<string, number> = {
  not_found: 0.04,
  information_received: 0.08,
  picked_up: 0.18,
  departed_origin: 0.3,
  in_transit: 0.48,
  customs_clearance: 0.62,
  customs_exception: 0.62,
  arrived_destination: 0.76,
  available_for_pickup: 0.84,
  out_for_delivery: 0.91,
  delivery_failed: 0.91,
  delivered: 0.985,
  returned: 0.55,
  cancelled: 0.08,
  exception: 0.5,
  expired: 0.5,
  unknown: 0.4,
};

function normalizePlace(value: unknown) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

function validCoordinate(value: unknown, min: number, max: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max ? numeric : null;
}

function pointFromCoordinates(
  coordinates: { latitude?: number | null; longitude?: number | null } | null | undefined,
  label: string,
): InternationalTrackingMapPoint | null {
  const lat = validCoordinate(coordinates?.latitude, -90, 90);
  const lng = validCoordinate(coordinates?.longitude, -180, 180);
  if (lat === null || lng === null) return null;
  return { lat, lng, label, estimated: false };
}

function fallbackPoint(city: unknown, country: unknown, label: string): InternationalTrackingMapPoint | null {
  const cityKey = normalizePlace(city);
  const countryKey = normalizePlace(country);
  const coordinates = CITY_COORDINATES[cityKey] || COUNTRY_COORDINATES[countryKey];
  if (!coordinates) return null;
  return { lat: coordinates[0], lng: coordinates[1], label, estimated: true };
}

function placeLabel(city: unknown, country: unknown, fallback: string) {
  return [String(city || "").trim(), String(country || "").trim()].filter(Boolean).join(", ") || fallback;
}

function eventPoint(event: InternationalTrackingEvent | undefined, fallbackLabel: string) {
  if (!event) return null;
  const lat = validCoordinate(event.latitude, -90, 90);
  const lng = validCoordinate(event.longitude, -180, 180);
  if (lat === null || lng === null) return null;
  return {
    lat,
    lng,
    label: event.location || placeLabel(event.city, event.country, fallbackLabel),
    estimated: false,
  } satisfies InternationalTrackingMapPoint;
}

function interpolate(origin: InternationalTrackingMapPoint, destination: InternationalTrackingMapPoint, progress: number) {
  const clamped = Math.max(0.04, Math.min(0.985, progress));
  return {
    lat: origin.lat + (destination.lat - origin.lat) * clamped,
    lng: origin.lng + (destination.lng - origin.lng) * clamped,
    label: "",
    estimated: true,
  } satisfies InternationalTrackingMapPoint;
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
  return L.divIcon({
    className: `dn-it-live-marker dn-it-live-marker--${kind}`,
    html: `<span aria-hidden="true"></span><b>${label}</b>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function planeIcon(rotation: number, delivered: boolean) {
  return L.divIcon({
    className: "dn-it-live-plane-marker",
    html: `<span class="dn-it-live-plane-pulse"></span><span class="dn-it-live-plane" style="--dn-plane-rotation:${rotation}deg">✈</span>${delivered ? '<i>✓</i>' : ""}`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
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
      if (points.length === 1) map.setView([points[0].lat, points[0].lng], 7, { animate: false });
      else map.fitBounds(bounds, { padding: [46, 46], maxZoom: 7, animate: false });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [key, map, points]);

  return null;
}

export function resolveInternationalMapPoints(shipment: InternationalShipment, isArabic: boolean) {
  const originData = shipment.origin || { city: shipment.origin_city, country: shipment.origin_country, coordinates: null };
  const destinationData = shipment.destination || { city: shipment.destination_city, country: shipment.destination_country, coordinates: null };
  const originLabel = placeLabel(originData.city, originData.country, isArabic ? "منشأ الشحنة" : "Shipment origin");
  const destinationLabel = placeLabel(destinationData.city, destinationData.country, isArabic ? "وجهة الشحنة" : "Shipment destination");

  const origin = pointFromCoordinates(originData.coordinates, originLabel)
    || fallbackPoint(originData.city, originData.country, originLabel)
    || fallbackPoint(shipment.origin_city, shipment.origin_country, originLabel);
  const destination = pointFromCoordinates(destinationData.coordinates, destinationLabel)
    || fallbackPoint(destinationData.city, destinationData.country, destinationLabel)
    || fallbackPoint(shipment.destination_city, shipment.destination_country, destinationLabel);

  if (!origin || !destination) return null;

  const events = [...(shipment.events || [])].sort((a, b) => Date.parse(b.event_time || "") - Date.parse(a.event_time || ""));
  const latestEventWithCoordinates = events.find((event) => validCoordinate(event.latitude, -90, 90) !== null && validCoordinate(event.longitude, -180, 180) !== null);
  const latestLabel = shipment.latest_location
    || placeLabel(shipment.latest_city, shipment.latest_country, isArabic ? "آخر تحديث من أرامكس" : "Latest Aramex checkpoint");
  const latest = pointFromCoordinates(shipment.latest_coordinates, latestLabel)
    || eventPoint(latestEventWithCoordinates, latestLabel);
  const status = String(shipment.normalized_status || "unknown").toLocaleLowerCase();
  const progress = STATUS_PROGRESS[status] ?? STATUS_PROGRESS.unknown;
  const plane = status === "delivered" ? destination : (latest || interpolate(origin, destination, progress));

  return {
    origin,
    destination,
    latest: latest || plane,
    plane,
    progress,
    status,
    hasEstimatedCoordinates: origin.estimated || destination.estimated || plane.estimated,
  };
}

export default function InternationalTrackingLiveMap({
  shipment,
  isArabic,
}: {
  shipment: InternationalShipment;
  isArabic: boolean;
}) {
  const route = useMemo(() => resolveInternationalMapPoints(shipment, isArabic), [isArabic, shipment]);

  if (!route) {
    return (
      <section className="dn-it-live-map dn-it-live-map--unavailable">
        <div>
          <span>✈</span>
          <strong>{isArabic ? "جاري تجهيز خريطة الرحلة" : "Preparing the shipment map"}</strong>
          <small>{isArabic ? "ستظهر الخريطة فور توفر مدينة منشأ ووجهة معتمدة." : "The map will appear when verified origin and destination cities are available."}</small>
        </div>
      </section>
    );
  }

  const routeLine: LatLngTuple[] = [
    [route.origin.lat, route.origin.lng],
    [route.destination.lat, route.destination.lng],
  ];
  const completedLine: LatLngTuple[] = [
    [route.origin.lat, route.origin.lng],
    [route.plane.lat, route.plane.lng],
  ];
  const mapPoints = [route.origin, route.destination, route.latest];
  const rotation = bearing(route.origin, route.destination) - 90;
  const delivered = route.status === "delivered";

  return (
    <section className="dn-it-live-map" aria-label={isArabic ? "خريطة رحلة الشحنة الدولية" : "International shipment journey map"}>
      <div className="dn-it-live-map__heading">
        <div>
          <span>{isArabic ? "خريطة الرحلة الحية" : "LIVE JOURNEY MAP"}</span>
          <strong>{route.origin.label} <b>→</b> {route.destination.label}</strong>
        </div>
        <em className={delivered ? "is-delivered" : ""}>{delivered ? (isArabic ? "تم الوصول" : "Delivered") : (isArabic ? "متابعة أرامكس" : "Aramex update")}</em>
      </div>

      <MapContainer
        center={[route.plane.lat, route.plane.lng]}
        zoom={5}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom
        preferCanvas
        className="dn-it-live-map__canvas"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <ZoomControl position={isArabic ? "topleft" : "topright"} />
        <Polyline positions={routeLine} pathOptions={{ color: "#2bb8ff", weight: 5, opacity: 0.28, dashArray: "11 12" }} />
        <Polyline positions={completedLine} pathOptions={{ color: "#f3d982", weight: 5, opacity: 0.95 }} />

        <Marker position={[route.origin.lat, route.origin.lng]} icon={markerIcon("origin", isArabic ? "من" : "FROM")}>
          <Tooltip direction="top" offset={[0, -12]}>{route.origin.label}</Tooltip>
        </Marker>
        <Marker position={[route.destination.lat, route.destination.lng]} icon={markerIcon("destination", isArabic ? "إلى" : "TO")}>
          <Tooltip direction="top" offset={[0, -12]}>{route.destination.label}</Tooltip>
        </Marker>
        <Marker position={[route.latest.lat, route.latest.lng]} icon={markerIcon("checkpoint", isArabic ? "آخر" : "LATEST")}>
          <Tooltip direction="top" offset={[0, -12]}>{route.latest.label || (isArabic ? "آخر نقطة مسجلة" : "Latest checkpoint")}</Tooltip>
        </Marker>
        <Marker position={[route.plane.lat, route.plane.lng]} icon={planeIcon(rotation, delivered)} zIndexOffset={1000}>
          <Tooltip direction="top" offset={[0, -18]} permanent>{delivered ? (isArabic ? "وصلت الشحنة" : "Shipment delivered") : (isArabic ? "موقع الرحلة التقديري" : "Estimated journey position")}</Tooltip>
        </Marker>
        <FitRoute points={mapPoints} />
      </MapContainer>

      <div className="dn-it-live-map__legend">
        <span><i className="is-origin" />{isArabic ? "المنشأ" : "Origin"}<b>{route.origin.label}</b></span>
        <span><i className="is-latest" />{isArabic ? "آخر نقطة" : "Latest"}<b>{route.latest.label || (isArabic ? "تحديث أرامكس" : "Aramex update")}</b></span>
        <span><i className="is-destination" />{isArabic ? "الوجهة" : "Destination"}<b>{route.destination.label}</b></span>
      </div>

      <p className="dn-it-live-map__notice">
        {route.hasEstimatedCoordinates
          ? (isArabic ? "المواضع الجغرافية تقريبية حسب المدن، بينما الحالة والخط الزمني قادمان مباشرة من شركة النقل." : "Map positions are city-level estimates; status and timeline data come directly from the carrier.")
          : (isArabic ? "آخر نقطة مبنية على إحداثيات شركة النقل وليست مشاركة GPS مستمرة من المركبة." : "The latest point uses carrier coordinates and is not continuous vehicle GPS sharing.")}
      </p>
    </section>
  );
}
