import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Layers, MapPin, Navigation, Radio, Route, Satellite, Truck } from "lucide-react";
import { defaultLocations } from "../../data/defaultLocations";
import { getOrderNumber, getOrderReference, getOrderRouteCities, getOrderString, interpolatePoint, progressFromStatus, resolveUaePoint, type LatLngTuple } from "../../lib/mapUtils";

type MapMode = "standard" | "satellite" | "terrain";

export type AdminLiveOperationsMapProps = {
  isArabic: boolean;
  orders: any[];
  selectedOrder?: any | null;
};

const pickupIcon = L.divIcon({ className: "dn-live-map-marker dn-live-map-marker-pickup", html: `<div class="dn-marker-core"><span></span></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
const destinationIcon = L.divIcon({ className: "dn-live-map-marker dn-live-map-marker-dest", html: `<div class="dn-marker-core"><span></span></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
const driverIcon = L.divIcon({ className: "dn-live-map-driver", html: `<div class="dn-driver-pulse"><span>DN</span></div>`, iconSize: [48, 48], iconAnchor: [24, 24] });

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    const validPoints = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (validPoints.length < 2) return;
    map.fitBounds(validPoints, { padding: [48, 48], maxZoom: 12, animate: true });
  }, [map, points]);
  return null;
}

function isActiveOrder(order: any) {
  const status = String(order?.status || "").toLowerCase();
  return !status.includes("deliver") && !status.includes("cancel") && !status.includes("return");
}

export default function AdminLiveOperationsMap({ isArabic, orders, selectedOrder }: AdminLiveOperationsMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("satellite");
  const [tileFailed, setTileFailed] = useState(false);
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);

  useEffect(() => setIsMounted(true), []);

  const activeOrder = useMemo(() => {
    if (selectedOrder) return selectedOrder;
    const sorted = [...(orders || [])].sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime());
    return sorted.find(isActiveOrder) || sorted[0] || null;
  }, [orders, selectedOrder]);

  const { pickupCity, deliveryCity } = getOrderRouteCities(activeOrder);
  const pickup = resolveUaePoint(pickupCity, defaultLocations.mussafah);
  const destination = resolveUaePoint(deliveryCity, defaultLocations.abuDhabi);

  const pickupPos: LatLngTuple = [
    getOrderNumber(activeOrder, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]) ?? pickup.lat,
    getOrderNumber(activeOrder, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]) ?? pickup.lng,
  ];
  const destPos: LatLngTuple = [
    getOrderNumber(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]) ?? destination.lat,
    getOrderNumber(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]) ?? destination.lng,
  ];
  const driverLat = getOrderNumber(activeOrder, ["driver_lat", "current_lat", "live_lat", "courier_lat"]);
  const driverLng = getOrderNumber(activeOrder, ["driver_lng", "current_lng", "live_lng", "courier_lng", "driver_lon", "current_lon"]);
  const hasLiveDriver = driverLat !== null && driverLng !== null;
  const driverPos: LatLngTuple = hasLiveDriver && driverLat !== null && driverLng !== null ? [driverLat, driverLng] : interpolatePoint(pickupPos, destPos, progressFromStatus(getOrderString(activeOrder, ["status"])));
  const fitPoints = [pickupPos, driverPos, destPos];

  const routeWaypoints = useMemo(() => (hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]).map(([lat, lng]) => `${lng},${lat}`).join(";"), [hasLiveDriver, pickupPos[0], pickupPos[1], driverPos[0], driverPos[1], destPos[0], destPos[1]]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function fetchRoute() {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${routeWaypoints}?overview=full&geometries=geojson&alternatives=false&steps=false`, { signal: controller.signal });
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!cancelled && Array.isArray(coords) && coords.length > 1) {
          setRoutePoints(coords.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngTuple));
          return;
        }
      } catch {
        // Straight line remains on the real tile map if OSRM is unavailable.
      }
      if (!cancelled) setRoutePoints(hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]);
    }
    void fetchRoute();
    return () => { cancelled = true; controller.abort(); };
  }, [routeWaypoints, hasLiveDriver]);

  if (!isMounted) return <div className="dn-live-map-shell dn-admin-live-ops-map min-h-[380px] animate-pulse" />;

  const modeLabels = [
    { mode: "standard" as const, ar: "عادي", en: "Standard" },
    { mode: "satellite" as const, ar: "ساتلايت", en: "Satellite" },
    { mode: "terrain" as const, ar: "تضاريس", en: "Terrain" },
  ];
  const reference = getOrderReference(activeOrder);
  const statusLabel = hasLiveDriver ? (isArabic ? "مباشر" : "Live") : (isArabic ? "تقديري" : "Estimated");
  const title = isArabic ? "خريطة العمليات الحية" : "Live Operations Map";

  const tileHandlers = { tileerror: () => setTileFailed(true) };
  const renderBaseLayers = () => {
    if (tileFailed || mapMode === "standard") return <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" eventHandlers={tileHandlers} />;
    if (mapMode === "terrain") return <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap" eventHandlers={tileHandlers} />;
    return <><TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" eventHandlers={tileHandlers} /><TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap contributors &copy; CARTO" eventHandlers={tileHandlers} /></>;
  };

  return (
    <div className="dn-live-map-shell dn-admin-live-ops-map relative h-[460px] w-full overflow-hidden rounded-[28px] border border-brand-gold/25 bg-[#020812]" dir={isArabic ? "rtl" : "ltr"}>
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[650] flex flex-wrap items-start justify-between gap-2">
        <div className="rounded-3xl border border-brand-gold/25 bg-[#071A33]/88 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <p className="flex items-center gap-2 text-sm font-black text-brand-gold"><Radio className="h-4 w-4 animate-pulse" />{title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-white/65"><Satellite className="h-3.5 w-3.5 text-brand-sky" />{tileFailed ? (isArabic ? "طبقة طرق احتياطية بعد تعذر تحميل البلاطات" : "Fallback road tiles after a tile error") : (isArabic ? "بلاطات خرائط حقيقية + مسار طرق" : "Real tiles + road route")}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-[#071A33]/86 px-3 py-2 text-[11px] font-black text-white/75 backdrop-blur-xl" dir="ltr">{statusLabel} • {String(reference).slice(0, 24)}</div>
      </div>

      <div className="absolute top-24 z-[650] flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-[#071A33]/88 p-1 text-[10px] font-black text-white/75 backdrop-blur-xl ltr:right-3 rtl:left-3">
        <Layers className="mx-1 h-3.5 w-3.5 text-brand-gold" />
        {modeLabels.map((item) => <button key={item.mode} type="button" onClick={() => { setTileFailed(false); setMapMode(item.mode); }} className={`rounded-full px-3 py-1.5 transition ${mapMode === item.mode ? "bg-brand-gold text-brand-deep" : "hover:bg-white/10"}`}>{isArabic ? item.ar : item.en}</button>)}
      </div>

      <MapContainer key={mapMode} center={driverPos} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl>
        {renderBaseLayers()}<FitBounds points={fitPoints} />
        <Polyline positions={routePoints.length ? routePoints : [pickupPos, destPos]} pathOptions={{ color: "#D4AF37", weight: 6, opacity: 0.92 }} />
        <Polyline positions={[pickupPos, driverPos, destPos]} pathOptions={{ color: "#18A8E8", weight: 2.5, opacity: 0.76, dashArray: "10 12" }} />
        {(routePoints.length ? routePoints : [pickupPos, driverPos, destPos]).filter((_, index) => index % Math.max(1, Math.floor((routePoints.length || 3) / 12)) === 0).map((point, index) => <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={2.8} pathOptions={{ color: "#F5B700", fillColor: "#F5B700", fillOpacity: 0.75, opacity: 0.55 }} />)}
        <Marker position={pickupPos} icon={pickupIcon}><Popup><b>{isArabic ? "نقطة الاستلام" : "Pickup"}</b><br />{getOrderString(activeOrder, ["sender_address", "pickup_address", "origin_address"]) || (isArabic ? pickup.labelAr : pickup.labelEn)}</Popup></Marker>
        <Marker position={driverPos} icon={driverIcon}><Popup><b>DAY NIGHT</b><br />{hasLiveDriver ? (isArabic ? "موقع المندوب المباشر" : "Live courier location") : (isArabic ? "موقع الشحنة التقديري" : "Estimated shipment position")}</Popup></Marker>
        <Marker position={destPos} icon={destinationIcon}><Popup><b>{isArabic ? "نقطة التسليم" : "Delivery"}</b><br />{getOrderString(activeOrder, ["receiver_address", "delivery_address", "destination_address"]) || (isArabic ? destination.labelAr : destination.labelEn)}</Popup></Marker>
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[650] flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#071A33]/88 px-3 py-2 text-[10px] font-bold text-white/70 backdrop-blur-xl">
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span>
        <span className="flex items-center gap-1.5 text-brand-gold"><Route className="h-3.5 w-3.5" />{isArabic ? "مسار حقيقي" : "Real route"}</span>
        <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-brand-sky" />{statusLabel}</span>
        <span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-brand-sky" />{isArabic ? destination.labelAr : destination.labelEn}</span>
      </div>
    </div>
  );
}
