import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { defaultLocations } from "../../data/defaultLocations";
import localAssets, { withRemoteFallback } from "../../data/localAssets";
import { useAppContext } from "../../lib/AppContext";
import { translations } from "../../data/translations";
import type { Order } from "../../types";
import { Activity, MapPin, Navigation, Radio, Route, Satellite, Truck } from "lucide-react";
import { supabase } from "../../supabase";

type LatLngTuple = [number, number];

type TrackingMapProps = {
  order?: Order | null;
};

type MapMode = "standard" | "satellite" | "terrain";

type CityPoint = {
  labelEn: string;
  labelAr: string;
  lat: number;
  lng: number;
  x?: number;
  y?: number;
};

const cityPoints: Record<string, CityPoint> = {
  "abu dhabi": { ...defaultLocations.abuDhabi, x: 46, y: 68 },
  "أبوظبي": { ...defaultLocations.abuDhabi, x: 46, y: 68 },
  "ابوظبي": { ...defaultLocations.abuDhabi, x: 46, y: 68 },
  "abudhabi": { ...defaultLocations.abuDhabi, x: 46, y: 68 },
  "mussafah": { ...defaultLocations.mussafah, x: 41, y: 73 },
  "مصفح": { ...defaultLocations.mussafah, x: 41, y: 73 },
  "dubai": { ...defaultLocations.dubai, x: 64, y: 45 },
  "دبي": { ...defaultLocations.dubai, x: 64, y: 45 },
  "sharjah": { ...defaultLocations.sharjah, x: 70, y: 33 },
  "الشارقة": { ...defaultLocations.sharjah, x: 70, y: 33 },
  "ajman": { labelEn: "Ajman", labelAr: "عجمان", lat: 25.4052, lng: 55.5136, x: 67, y: 28 },
  "عجمان": { labelEn: "Ajman", labelAr: "عجمان", lat: 25.4052, lng: 55.5136, x: 67, y: 28 },
  "umm al quwain": { labelEn: "Umm Al Quwain", labelAr: "أم القيوين", lat: 25.5647, lng: 55.5552, x: 72, y: 23 },
  "أم القيوين": { labelEn: "Umm Al Quwain", labelAr: "أم القيوين", lat: 25.5647, lng: 55.5552, x: 72, y: 23 },
  "ras al khaimah": { labelEn: "Ras Al Khaimah", labelAr: "رأس الخيمة", lat: 25.8007, lng: 55.9762, x: 78, y: 13 },
  "رأس الخيمة": { labelEn: "Ras Al Khaimah", labelAr: "رأس الخيمة", lat: 25.8007, lng: 55.9762, x: 78, y: 13 },
  "fujairah": { labelEn: "Fujairah", labelAr: "الفجيرة", lat: 25.1288, lng: 56.3265, x: 88, y: 36 },
  "الفجيرة": { labelEn: "Fujairah", labelAr: "الفجيرة", lat: 25.1288, lng: 56.3265, x: 88, y: 36 },
  "khorfakkan": { labelEn: "Khorfakkan", labelAr: "خورفكان", lat: 25.3313, lng: 56.3410, x: 85, y: 30 },
  "خورفكان": { labelEn: "Khorfakkan", labelAr: "خورفكان", lat: 25.3313, lng: 56.3410, x: 85, y: 30 },
  "al ain": { ...defaultLocations.alAin, x: 78, y: 80 },
  "العين": { ...defaultLocations.alAin, x: 78, y: 80 },
  "al dhafra": { labelEn: "Al Dhafra", labelAr: "الظفرة", lat: 23.6574, lng: 53.7052, x: 23, y: 77 },
  "الظفرة": { labelEn: "Al Dhafra", labelAr: "الظفرة", lat: 23.6574, lng: 53.7052, x: 23, y: 77 },
  "liwa": { labelEn: "Liwa", labelAr: "ليوا", lat: 23.1336, lng: 53.7726, x: 20, y: 78 },
  "ليوا": { labelEn: "Liwa", labelAr: "ليوا", lat: 23.1336, lng: 53.7726, x: 20, y: 78 },
  "ruwais": { labelEn: "Al Ruwais", labelAr: "الرويس", lat: 24.1103, lng: 52.7306, x: 17, y: 54 },
  "الرويس": { labelEn: "Al Ruwais", labelAr: "الرويس", lat: 24.1103, lng: 52.7306, x: 17, y: 54 },
};

const pickupIcon = L.divIcon({
  className: "dn-live-map-marker dn-live-map-marker-pickup",
  html: `<div class="dn-marker-core"><span></span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const destinationIcon = L.divIcon({
  className: "dn-live-map-marker dn-live-map-marker-dest",
  html: `<div class="dn-marker-core"><span></span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const driverIcon = L.divIcon({
  className: "dn-live-map-driver",
  html: `<div class="dn-driver-pulse"><span>DN</span></div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

function normalizeKey(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function resolvePoint(city?: string | null, fallback?: CityPoint): CityPoint {
  const raw = normalizeKey(city);
  if (cityPoints[raw]) return cityPoints[raw];
  const loose = Object.entries(cityPoints).find(([key]) => raw.includes(key) || (raw.length > 2 && key.includes(raw)));
  return loose?.[1] || fallback || { ...defaultLocations.abuDhabi, x: 46, y: 68 };
}

function getNumeric(order: Order | null | undefined, keys: string[]) {
  const source = order as unknown as Record<string, unknown> | null | undefined;
  if (!source) return null;
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function hasAnyNumeric(order: Order | null | undefined, keys: string[]) {
  return getNumeric(order, keys) !== null;
}

function interpolate(a: LatLngTuple, b: LatLngTuple, t: number): LatLngTuple {
  return [Number((a[0] + (b[0] - a[0]) * t).toFixed(6)), Number((a[1] + (b[1] - a[1]) * t).toFixed(6))];
}

function progressFromStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (value.includes("deliver")) return 0.92;
  if (value.includes("out")) return 0.74;
  if (value.includes("transit") || value.includes("route")) return 0.58;
  if (value.includes("pickup") || value.includes("picked")) return 0.34;
  if (value.includes("assign") || value.includes("confirm")) return 0.18;
  return 0.12;
}

function pathForArc(from: CityPoint, to: CityPoint) {
  const fx = from.x ?? 46;
  const fy = from.y ?? 68;
  const tx = to.x ?? 64;
  const ty = to.y ?? 45;
  const cx = (fx + tx) / 2;
  const cy = Math.min(fy, ty) - 16;
  return `M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}`;
}

function pointOnArc(from: CityPoint, to: CityPoint, t: number) {
  const fx = from.x ?? 46;
  const fy = from.y ?? 68;
  const tx = to.x ?? 64;
  const ty = to.y ?? 45;
  const cx = (fx + tx) / 2;
  const cy = Math.min(fy, ty) - 16;
  return {
    x: (1 - t) ** 2 * fx + 2 * (1 - t) * t * cx + t ** 2 * tx,
    y: (1 - t) ** 2 * fy + 2 * (1 - t) * t * cy + t ** 2 * ty,
  };
}

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    const validPoints = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (validPoints.length < 2) return;
    map.fitBounds(validPoints, { padding: [38, 38], maxZoom: 13, animate: true });
  }, [map, points]);
  return null;
}

function LuxuryFallbackMap({
  activeOrder,
  pickup,
  destination,
  progress,
  hasLiveDriver,
  isArabic,
}: {
  activeOrder: Order | null;
  pickup: CityPoint;
  destination: CityPoint;
  progress: number;
  hasLiveDriver: boolean;
  isArabic: boolean;
}) {
  const moving = pointOnArc(pickup, destination, progress);
  const status = activeOrder?.status || (isArabic ? "قيد المعالجة" : "Processing");
  const ref = activeOrder?.tracking_code || activeOrder?.tracking_number || activeOrder?.invoice_number || activeOrder?.coupon_number || activeOrder?.id || "DAY NIGHT";
  const cities = [pickup, destination, resolvePoint("Dubai"), resolvePoint("Sharjah"), resolvePoint("Ajman"), resolvePoint("Fujairah"), resolvePoint("Al Ain")]
    .filter((city, index, array) => array.findIndex((item) => item.labelEn === city.labelEn) === index);

  return (
    <div className="dn-3d-tracking-map relative h-full min-h-[330px] overflow-hidden rounded-2xl border border-brand-gold/20 bg-[#020812]">
      <img
        src={localAssets.uaeMap}
        alt="DAY NIGHT UAE 3D tracking map"
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
        onError={(event) => withRemoteFallback(event, localAssets.remote.uaeMap)}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.15)_56%,rgba(0,0,0,.68)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(24,168,232,.14),transparent_32%,rgba(245,183,0,.10)_54%,transparent_72%)]" />

      <svg className="pointer-events-none absolute inset-0 z-[4] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={pathForArc(pickup, destination)} fill="none" stroke="rgba(5,20,42,.72)" strokeWidth="1.45" strokeLinecap="round" />
        <path className="dn-route-glow" d={pathForArc(pickup, destination)} fill="none" stroke="rgba(245,183,0,.98)" strokeWidth="0.86" strokeLinecap="round" strokeDasharray="2 2.4" />
        <path d={pathForArc(pickup, destination)} fill="none" stroke="rgba(24,168,232,.78)" strokeWidth="0.32" strokeLinecap="round" strokeDasharray=".8 2.4" />
      </svg>

      {cities.map((city) => (
        <div
          key={city.labelEn}
          className="dn-3d-city-pin absolute z-[7] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${city.x ?? 50}%`, top: `${city.y ?? 50}%` }}
        >
          <span />
          <strong>{isArabic ? city.labelAr : city.labelEn}</strong>
        </div>
      ))}

      <div
        className="dn-3d-driver absolute z-[9] -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${moving.x}%`, top: `${moving.y}%` }}
      >
        <Truck className="h-5 w-5" />
      </div>

      <div className="absolute left-3 right-3 top-3 z-[12] flex flex-wrap items-start justify-between gap-2">
        <div className="rounded-2xl border border-brand-gold/25 bg-[#071A33]/88 px-3 py-2 backdrop-blur-xl shadow-xl">
          <p className="flex items-center gap-2 text-[11px] font-black text-brand-gold">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {hasLiveDriver ? (isArabic ? "موقع المندوب مباشر" : "Live courier position") : (isArabic ? "مسار الشحنة الحي" : "Live shipment route")}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-white/70">
            <Satellite className="h-3 w-3 text-brand-sky" />
            {isArabic ? "خريطة DAY NIGHT ثلاثية الأبعاد" : "DAY NIGHT 3D operations map"}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-[#071A33]/82 px-3 py-2 text-[10px] font-black text-white/75 backdrop-blur-xl" dir="ltr">
          {status} • {String(ref).slice(0, 22)}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 z-[12] grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#071A33]/86 px-3 py-2 text-[10px] font-bold text-white/70 backdrop-blur-xl max-sm:grid-cols-1">
        <span className="flex items-center justify-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span>
        <span className="flex items-center justify-center gap-1.5 text-brand-gold"><Route className="h-3.5 w-3.5" />{isArabic ? "مسار نشط" : "Active route"}</span>
        <span className="flex items-center justify-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-brand-sky" />{isArabic ? destination.labelAr : destination.labelEn}</span>
      </div>
    </div>
  );
}

export default function TrackingMap({ order }: TrackingMapProps) {
  const { language } = useAppContext();
  const t = translations[language].trackingMap;
  const [isMounted, setIsMounted] = useState(false);
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);
  const [tileFailed, setTileFailed] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("satellite");
  const isArabic = language === "ar";

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    setLiveOrder(null);
    setLastLiveAt(null);
    setTileFailed(false);
    if (!supabase || !order?.id) return;
    const supabaseClient = supabase;

    const channel = supabaseClient
      .channel(`dn-live-order-${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload) => {
          setLiveOrder(payload.new as Order);
          setLastLiveAt(new Date());
        }
      )
      .subscribe();

    const driverId = String((order as unknown as { driver_id?: string | null })?.driver_id || "").trim();
    const driverChannel = driverId
      ? supabaseClient
        .channel(`dn-driver-location-${driverId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
          (payload) => {
            setLiveOrder((current) => ({ ...(current || order), ...(payload.new as Record<string, unknown>) } as Order));
            setLastLiveAt(new Date());
          }
        )
        .subscribe()
      : null;

    return () => {
      supabaseClient.removeChannel(channel);
      if (driverChannel) supabaseClient.removeChannel(driverChannel);
    };
  }, [order?.id]);

  const activeOrder = liveOrder || order || null;
  const pickup = resolvePoint(activeOrder?.sender_city, { ...defaultLocations.mussafah, x: 41, y: 73 });
  const destination = resolvePoint(activeOrder?.receiver_city, { ...defaultLocations.abuDhabi, x: 46, y: 68 });

  const hasPickupCoordinates = hasAnyNumeric(activeOrder, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]) && hasAnyNumeric(activeOrder, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]);
  const hasDestinationCoordinates = hasAnyNumeric(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]) && hasAnyNumeric(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]);
  const hasLiveDriver = hasAnyNumeric(activeOrder, ["driver_lat", "current_lat", "live_lat", "courier_lat"]) && hasAnyNumeric(activeOrder, ["driver_lng", "current_lng", "live_lng", "courier_lng", "driver_lon", "current_lon"]);
  const useRoadMap = (hasPickupCoordinates && hasDestinationCoordinates) || hasLiveDriver;

  const pickupLat = getNumeric(activeOrder, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]) ?? pickup.lat;
  const pickupLng = getNumeric(activeOrder, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]) ?? pickup.lng;
  const destLat = getNumeric(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]) ?? destination.lat;
  const destLng = getNumeric(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]) ?? destination.lng;
  const driverLat = getNumeric(activeOrder, ["driver_lat", "current_lat", "live_lat", "courier_lat"]);
  const driverLng = getNumeric(activeOrder, ["driver_lng", "current_lng", "live_lng", "courier_lng", "driver_lon", "current_lon"]);

  const pickupPos: LatLngTuple = [pickupLat, pickupLng];
  const destPos: LatLngTuple = [destLat, destLng];
  const driverPos: LatLngTuple = hasLiveDriver && driverLat !== null && driverLng !== null ? [driverLat, driverLng] : interpolate(pickupPos, destPos, progressFromStatus(activeOrder?.status));
  const fitPoints = [pickupPos, driverPos, destPos];
  const visualProgress = hasLiveDriver ? 0.58 : progressFromStatus(activeOrder?.status);

  const routeWaypoints = useMemo(() => {
    const points = hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos];
    return points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  }, [hasLiveDriver, pickupPos[0], pickupPos[1], driverPos[0], driverPos[1], destPos[0], destPos[1]]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchRoadRoute() {
      if (!useRoadMap) {
        setRoutePoints([]);
        return;
      }

      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${routeWaypoints}?overview=full&geometries=geojson&alternatives=false&steps=false`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!cancelled && Array.isArray(coords) && coords.length > 1) {
          setRoutePoints(coords.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngTuple));
          return;
        }
      } catch {
        // fallback line if route service is unavailable
      }
      if (!cancelled) setRoutePoints(hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]);
    }

    fetchRoadRoute();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeWaypoints, hasLiveDriver, useRoadMap]);

  if (!isMounted) return <div className="h-full min-h-72 bg-brand-deep rounded-2xl animate-pulse" />;

  if (!useRoadMap) {
    return (
      <LuxuryFallbackMap
        activeOrder={activeOrder}
        pickup={pickup}
        destination={destination}
        progress={visualProgress}
        hasLiveDriver={hasLiveDriver}
        isArabic={isArabic}
      />
    );
  }

  const liveLabel = hasLiveDriver
    ? (isArabic ? "إحداثيات المندوب مباشرة" : "Live courier coordinates")
    : (isArabic ? "مسار فعلي من إحداثيات الطلب" : "Road route from order coordinates");
  const lastLiveLabel = lastLiveAt
    ? lastLiveAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" })
    : "—";

  const tileHandlers = {
    tileerror: () => setTileFailed(true),
  };

  return (
    <div className="dn-live-map-shell dn-satellite-map h-full w-full overflow-hidden rounded-2xl border border-brand-gold/20 relative bg-[#020812]">
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[650] flex flex-wrap items-center justify-between gap-2">
        <div className="rounded-2xl border border-brand-gold/25 bg-[#071A33]/88 px-3 py-2 backdrop-blur-xl shadow-xl">
          <p className="flex items-center gap-2 text-[11px] font-black text-brand-gold">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {liveLabel}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-white/60">
            <Satellite className="h-3 w-3 text-brand-sky" />
            {tileFailed ? (isArabic ? "خريطة طرق احتياطية" : "Fallback road map") : (isArabic ? "ساتلايت وطرق فعلية" : "Satellite + road routing")}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-[#071A33]/82 px-3 py-2 text-[10px] font-black text-white/70 backdrop-blur-xl">
          {activeOrder?.status || (isArabic ? "قيد المعالجة" : "Processing")} • {lastLiveLabel}
        </div>
      </div>


      <div className="absolute left-3 top-24 z-[660] flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-[#071A33]/88 p-1 backdrop-blur-xl">
        {(["standard", "satellite", "terrain"] as MapMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => { setTileFailed(false); setMapMode(mode); }}
            className={`pointer-events-auto rounded-xl px-3 py-2 text-[10px] font-black transition-colors ${mapMode === mode ? "bg-brand-gold text-brand-deep" : "text-white/75 hover:bg-white/10"}`}
          >
            {mode === "standard" ? (isArabic ? "قياسية" : "Standard") : mode === "satellite" ? (isArabic ? "أقمار" : "Satellite") : (isArabic ? "تضاريس" : "Terrain")}
          </button>
        ))}
      </div>

      <MapContainer center={driverPos} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl>
        {tileFailed || mapMode === "standard" ? (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
        ) : mapMode === "terrain" ? (
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution="Map data &copy; OpenStreetMap contributors, SRTM | OpenTopoMap"
            eventHandlers={tileHandlers}
          />
        ) : (
          <>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              eventHandlers={tileHandlers}
            />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              eventHandlers={tileHandlers}
            />
          </>
        )}
        <FitBounds points={fitPoints} />
        <Polyline positions={routePoints.length ? routePoints : [pickupPos, destPos]} pathOptions={{ color: "#D4AF37", weight: 6, opacity: 0.92 }} />
        <Polyline positions={[pickupPos, driverPos, destPos]} pathOptions={{ color: "#18A8E8", weight: 2.4, opacity: 0.76, dashArray: "10 12" }} />
        {routePoints.length > 2 && routePoints.filter((_, index) => index % Math.max(1, Math.floor(routePoints.length / 12)) === 0).map((point, index) => (
          <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={2.8} pathOptions={{ color: "#F5B700", fillColor: "#F5B700", fillOpacity: 0.75, opacity: 0.55 }} />
        ))}

        <Marker position={pickupPos} icon={pickupIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-blue uppercase">{t.pickupPoint}</p>
              <p>{activeOrder?.sender_address || (isArabic ? pickup.labelAr : pickup.labelEn)}</p>
            </div>
          </Popup>
        </Marker>

        <Marker position={driverPos} icon={driverIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">DAY NIGHT</p>
              <p>{hasLiveDriver ? (isArabic ? "موقع المندوب المباشر" : "Live courier location") : (isArabic ? "موقع الشحنة التقديري" : "Estimated shipment position")}</p>
            </div>
          </Popup>
        </Marker>

        <Marker position={destPos} icon={destinationIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">{t.destinationPoint}</p>
              <p>{activeOrder?.receiver_address || (isArabic ? destination.labelAr : destination.labelEn)}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[650] flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#071A33]/86 px-3 py-2 text-[10px] font-bold text-white/65 backdrop-blur-xl">
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span>
        <span className="flex items-center gap-1.5 text-brand-gold"><Route className="h-3.5 w-3.5" />{isArabic ? "مسار طرق فعلي" : "Real road route"}</span>
        <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-brand-sky" />{hasLiveDriver ? (isArabic ? "مباشر" : "Live") : (isArabic ? "تقديري" : "Estimated")}</span>
        <span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-brand-sky" />{isArabic ? destination.labelAr : destination.labelEn}</span>
      </div>
    </div>
  );
}
