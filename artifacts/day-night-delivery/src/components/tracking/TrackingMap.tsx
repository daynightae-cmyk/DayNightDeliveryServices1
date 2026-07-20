import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Clock3, Crosshair, Flag, Layers, MapPin, Navigation, Radio, Route, Satellite, Truck, X } from "lucide-react";
import { defaultLocations } from "../../data/defaultLocations";
import { translations } from "../../data/translations";
import { useAppContext } from "../../lib/AppContext";
import { supabase } from "../../supabase";
import type { Order } from "../../types";
import DayNightVehicleMarker from "../maps/DayNightVehicleMarker";
import { calculateBearing } from "../maps/VehicleAnimations";

type LatLngTuple = [number, number];
type MapMode = "standard" | "satellite" | "terrain";

type TrackingMapProps = {
  order?: Order | null;
  navigationMode?: boolean;
  devicePosition?: {
    latitude: number;
    longitude: number;
    heading?: number | null;
    speed?: number | null;
    accuracy?: number | null;
  } | null;
  onExitNavigation?: () => void;
};

type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
  roadName: string;
};

type CityPoint = {
  labelEn: string;
  labelAr: string;
  lat: number;
  lng: number;
};

const cityPoints: Record<string, CityPoint> = {
  "abu dhabi": defaultLocations.abuDhabi,
  "أبوظبي": defaultLocations.abuDhabi,
  "ابوظبي": defaultLocations.abuDhabi,
  "abudhabi": defaultLocations.abuDhabi,
  "mussafah": defaultLocations.mussafah,
  "مصفح": defaultLocations.mussafah,
  "dubai": defaultLocations.dubai,
  "دبي": defaultLocations.dubai,
  "sharjah": defaultLocations.sharjah,
  "الشارقة": defaultLocations.sharjah,
  "ajman": { labelEn: "Ajman", labelAr: "عجمان", lat: 25.4052, lng: 55.5136 },
  "عجمان": { labelEn: "Ajman", labelAr: "عجمان", lat: 25.4052, lng: 55.5136 },
  "umm al quwain": { labelEn: "Umm Al Quwain", labelAr: "أم القيوين", lat: 25.5647, lng: 55.5552 },
  "أم القيوين": { labelEn: "Umm Al Quwain", labelAr: "أم القيوين", lat: 25.5647, lng: 55.5552 },
  "ras al khaimah": { labelEn: "Ras Al Khaimah", labelAr: "رأس الخيمة", lat: 25.8007, lng: 55.9762 },
  "رأس الخيمة": { labelEn: "Ras Al Khaimah", labelAr: "رأس الخيمة", lat: 25.8007, lng: 55.9762 },
  "fujairah": { labelEn: "Fujairah", labelAr: "الفجيرة", lat: 25.1288, lng: 56.3265 },
  "الفجيرة": { labelEn: "Fujairah", labelAr: "الفجيرة", lat: 25.1288, lng: 56.3265 },
  "khorfakkan": { labelEn: "Khorfakkan", labelAr: "خورفكان", lat: 25.3313, lng: 56.3410 },
  "خورفكان": { labelEn: "Khorfakkan", labelAr: "خورفكان", lat: 25.3313, lng: 56.3410 },
  "al ain": defaultLocations.alAin,
  "العين": defaultLocations.alAin,
  "al dhafra": { labelEn: "Al Dhafra", labelAr: "الظفرة", lat: 23.6574, lng: 53.7052 },
  "الظفرة": { labelEn: "Al Dhafra", labelAr: "الظفرة", lat: 23.6574, lng: 53.7052 },
  "liwa": { labelEn: "Liwa", labelAr: "ليوا", lat: 23.1336, lng: 53.7726 },
  "ليوا": { labelEn: "Liwa", labelAr: "ليوا", lat: 23.1336, lng: 53.7726 },
  "ruwais": { labelEn: "Al Ruwais", labelAr: "الرويس", lat: 24.1103, lng: 52.7306 },
  "الرويس": { labelEn: "Al Ruwais", labelAr: "الرويس", lat: 24.1103, lng: 52.7306 },
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

function normalizeKey(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function asRecord(order: Order | null | undefined) {
  return (order || {}) as Record<string, unknown>;
}

function getString(order: Order | null | undefined, keys: string[]) {
  const source = asRecord(order);
  for (const key of keys) {
    const raw = source[key];
    if (raw !== null && raw !== undefined && String(raw).trim()) return String(raw).trim();
  }
  return "";
}

function getNumeric(order: Order | null | undefined, keys: string[]) {
  const source = asRecord(order);
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function resolvePoint(city?: string | null, fallback?: CityPoint): CityPoint {
  const raw = normalizeKey(city);
  if (cityPoints[raw]) return cityPoints[raw];
  const loose = Object.entries(cityPoints).find(([key]) => raw.includes(key) || (raw.length > 2 && key.includes(raw)));
  return loose?.[1] || fallback || defaultLocations.abuDhabi;
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

function isDeliveryLeg(status?: string | null) {
  const value = String(status || "").toLowerCase();
  return value.includes("picked") || value.includes("transit") || value.includes("out_for_delivery") || value.includes("deliver");
}

function formatRouteDistance(meters: number, isArabic: boolean) {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} ${isArabic ? "م" : "m"}`;
  return `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} ${isArabic ? "كم" : "km"}`;
}

function formatRouteDuration(seconds: number, isArabic: boolean) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} ${isArabic ? "دقيقة" : "min"}`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} ${isArabic ? "س" : "h"}${remainder ? ` ${remainder} ${isArabic ? "د" : "m"}` : ""}`;
}

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    const validPoints = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (validPoints.length < 2) return;
    map.fitBounds(validPoints, { padding: [42, 42], maxZoom: 13, animate: true });
  }, [map, points]);
  return null;
}

function FollowDriver({ position, enabled }: { position: LatLngTuple; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    map.setView(position, Math.max(map.getZoom(), 16), { animate: true });
  }, [enabled, map, position[0], position[1]]);
  return null;
}

export default function TrackingMap({ order, navigationMode = false, devicePosition, onExitNavigation }: TrackingMapProps) {
  const { language } = useAppContext();
  const t = translations[language].trackingMap;
  const isArabic = language === "ar";
  const [isMounted, setIsMounted] = useState(false);
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);
  const [tileFailed, setTileFailed] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("satellite");
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [followDriver, setFollowDriver] = useState(navigationMode);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => setFollowDriver(navigationMode), [navigationMode]);

  useEffect(() => {
    setLiveOrder(null);
    setLastLiveAt(null);
    setTileFailed(false);
    if (!supabase || !order?.id) return;
    const supabaseClient = supabase;
    const orderChannel = supabaseClient
      .channel(`dn-live-order-${order.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, (payload) => {
        setLiveOrder(payload.new as Order);
        setLastLiveAt(new Date());
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(orderChannel);
    };
  }, [order?.id]);

  const activeOrder = liveOrder || order || null;
  const driverId = getString(activeOrder, ["driver_id", "assigned_driver_id", "courier_id"]);

  useEffect(() => {
    if (!supabase || !driverId) return;
    const supabaseClient = supabase;
    const driverChannel = supabaseClient
      .channel(`dn-live-driver-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` }, (payload) => {
        const location = payload.new as Record<string, unknown>;
        setLiveOrder((current) => ({
          ...((current || order || {}) as Order),
          driver_lat: location.lat ?? location.latitude ?? location.driver_lat,
          driver_lng: location.lng ?? location.longitude ?? location.driver_lng,
        } as Order));
        setLastLiveAt(new Date());
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(driverChannel);
    };
  }, [driverId, order]);

  const pickupCity = getString(activeOrder, ["sender_city", "pickup_city", "origin_city", "from_city"]) || "Mussafah";
  const destinationCity = getString(activeOrder, ["receiver_city", "delivery_city", "destination_city", "to_city"]) || "Abu Dhabi";
  const pickup = resolvePoint(pickupCity, defaultLocations.mussafah);
  const destination = resolvePoint(destinationCity, defaultLocations.abuDhabi);

  const pickupPos: LatLngTuple = [
    getNumeric(activeOrder, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]) ?? pickup.lat,
    getNumeric(activeOrder, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]) ?? pickup.lng,
  ];
  const destPos: LatLngTuple = [
    getNumeric(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]) ?? destination.lat,
    getNumeric(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]) ?? destination.lng,
  ];

  const deviceLat = Number(devicePosition?.latitude);
  const deviceLng = Number(devicePosition?.longitude);
  const hasDevicePosition = Number.isFinite(deviceLat) && Number.isFinite(deviceLng);
  const driverLat = hasDevicePosition ? deviceLat : getNumeric(activeOrder, ["driver_lat", "current_lat", "live_lat", "courier_lat"]);
  const driverLng = hasDevicePosition ? deviceLng : getNumeric(activeOrder, ["driver_lng", "current_lng", "live_lng", "courier_lng", "driver_lon", "current_lon"]);
  const hasLiveDriver = driverLat !== null && driverLng !== null;
  const driverPos: LatLngTuple = hasLiveDriver && driverLat !== null && driverLng !== null ? [driverLat, driverLng] : interpolate(pickupPos, destPos, progressFromStatus(getString(activeOrder, ["status"])));
  const deliveryLeg = isDeliveryLeg(getString(activeOrder, ["status"]));
  const navigationTarget = deliveryLeg ? destPos : pickupPos;
  const fitPoints = navigationMode ? [driverPos, navigationTarget] : [pickupPos, driverPos, destPos];
  const suppliedHeading = Number(devicePosition?.heading);
  const vehicleBearing = Number.isFinite(suppliedHeading) && suppliedHeading >= 0
    ? suppliedHeading
    : calculateBearing(hasLiveDriver ? driverPos : pickupPos, navigationMode ? navigationTarget : destPos);

  const routeWaypoints = useMemo(() => {
    const points = navigationMode
      ? [driverPos, navigationTarget]
      : hasLiveDriver
        ? [pickupPos, driverPos, destPos]
        : [pickupPos, destPos];
    return points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  }, [navigationMode, hasLiveDriver, pickupPos[0], pickupPos[1], driverPos[0], driverPos[1], destPos[0], destPos[1], navigationTarget[0], navigationTarget[1]]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setRouteSummary(null);

    async function fetchRoadRoute() {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${routeWaypoints}?overview=full&geometries=geojson&alternatives=false&steps=true`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        const route = data?.routes?.[0];
        const coords = route?.geometry?.coordinates;
        if (!cancelled && Array.isArray(coords) && coords.length > 1) {
          setRoutePoints(coords.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngTuple));
          const firstStep = route?.legs?.[0]?.steps?.find((step: { distance?: number }) => Number(step?.distance) > 15) || route?.legs?.[0]?.steps?.[0];
          setRouteSummary({
            distanceMeters: Number(route?.distance || 0),
            durationSeconds: Number(route?.duration || 0),
            roadName: String(firstStep?.name || firstStep?.maneuver?.type || ""),
          });
          return;
        }
      } catch {
        // Use a real map with straight-line route fallback if OSRM is temporarily unavailable.
      }
      if (!cancelled) {
        setRouteSummary(null);
        setRoutePoints(navigationMode ? [driverPos, navigationTarget] : hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]);
      }
    }

    fetchRoadRoute();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeWaypoints, hasLiveDriver, navigationMode]);

  if (!isMounted) return <div className="h-full min-h-72 rounded-2xl bg-brand-deep animate-pulse" />;

  const status = getString(activeOrder, ["status"]) || (isArabic ? "قيد المعالجة" : "Processing");
  const reference = getString(activeOrder, ["tracking_code", "tracking_number", "invoice_number", "coupon_number", "id"]) || "DAY NIGHT";
  const liveLabel = hasLiveDriver ? (isArabic ? "خريطة حقيقية — موقع المندوب مباشر" : "Real map — live courier position") : (isArabic ? "خريطة حقيقية — مسار الإمارات" : "Real map — UAE shipment route");
  const lastLiveLabel = lastLiveAt ? lastLiveAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" }) : "—";
  const navigationTargetLabel = deliveryLeg
    ? (getString(activeOrder, ["receiver_address", "delivery_address", "destination_address"]) || (isArabic ? destination.labelAr : destination.labelEn))
    : (getString(activeOrder, ["sender_address", "pickup_address", "origin_address"]) || (isArabic ? pickup.labelAr : pickup.labelEn));

  const mapModes: { mode: MapMode; label: string; labelAr: string }[] = [
    { mode: "standard", label: "Standard", labelAr: "عادي" },
    { mode: "satellite", label: "Satellite", labelAr: "ساتلايت" },
    { mode: "terrain", label: "Terrain", labelAr: "تضاريس" },
  ];

  const tileHandlers = {
    tileerror: () => setTileFailed(true),
  };

  const renderBaseLayers = () => {
    if (tileFailed || mapMode === "standard") {
      return <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" eventHandlers={tileHandlers} />;
    }

    if (mapMode === "terrain") {
      return <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap" eventHandlers={tileHandlers} />;
    }

    return (
      <>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" eventHandlers={tileHandlers} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap contributors &copy; CARTO" eventHandlers={tileHandlers} />
      </>
    );
  };

  return (
    <div className={`dn-live-map-shell dn-satellite-map relative h-full min-h-[360px] w-full overflow-hidden rounded-2xl border border-brand-gold/20 bg-[#020812] ${navigationMode ? "dn-live-map-navigation" : ""}`}>
      <div className="absolute left-3 right-3 top-3 z-[650] flex flex-wrap items-center justify-between gap-2">
        <div className={`pointer-events-none rounded-2xl border border-brand-gold/25 bg-[#071A33]/88 px-3 py-2 shadow-xl backdrop-blur-xl ${navigationMode ? "dn-navigation-hud" : ""}`}>
          <p className="flex items-center gap-2 text-[11px] font-black text-brand-gold">
            {navigationMode ? <Navigation className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5 animate-pulse" />}
            {navigationMode ? (isArabic ? "ملاحة DAY NIGHT داخل التطبيق" : "DAY NIGHT in-app navigation") : liveLabel}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-white/60">
            {navigationMode ? <Flag className="h-3 w-3 text-brand-gold" /> : <Satellite className="h-3 w-3 text-brand-sky" />}
            {navigationMode
              ? `${deliveryLeg ? (isArabic ? "إلى التسليم" : "To drop-off") : (isArabic ? "إلى الاستلام" : "To pickup")}: ${navigationTargetLabel}`
              : tileFailed ? (isArabic ? "خريطة طرق احتياطية" : "Fallback road map") : (isArabic ? "طبقات خرائط حقيقية + توجيه طرق" : "Real map layers + road routing")}
          </p>
        </div>
        {navigationMode ? (
          <div className="dn-navigation-controls flex items-center gap-2">
            <button type="button" className={followDriver ? "is-active" : ""} onClick={() => setFollowDriver((value) => !value)} title={isArabic ? "تتبع السيارة" : "Follow vehicle"}><Crosshair /></button>
            {onExitNavigation && <button type="button" onClick={onExitNavigation} title={isArabic ? "إغلاق الملاحة" : "Close navigation"}><X /></button>}
          </div>
        ) : (
          <div className="pointer-events-none rounded-full border border-white/10 bg-[#071A33]/82 px-3 py-2 text-[10px] font-black text-white/70 backdrop-blur-xl" dir="ltr">
            {status} • {String(reference).slice(0, 22)} • {lastLiveLabel}
          </div>
        )}
      </div>

      <div className={`absolute right-3 z-[650] flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-[#071A33]/86 p-1 text-[10px] font-black text-white/70 backdrop-blur-xl ${navigationMode ? "top-28" : "top-24"}`} dir={isArabic ? "rtl" : "ltr"}>
        <Layers className="mx-1 h-3.5 w-3.5 text-brand-gold" />
        {mapModes.map((item) => (
          <button
            key={item.mode}
            type="button"
            onClick={() => {
              setTileFailed(false);
              setMapMode(item.mode);
            }}
            className={`rounded-full px-2.5 py-1 transition ${mapMode === item.mode ? "bg-brand-gold text-brand-deep" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          >
            {isArabic ? item.labelAr : item.label}
          </button>
        ))}
      </div>

      <MapContainer key={mapMode} center={driverPos} zoom={navigationMode ? 16 : 10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={navigationMode} zoomControl>
        {renderBaseLayers()}
        {navigationMode ? <FollowDriver position={driverPos} enabled={followDriver} /> : <FitBounds points={fitPoints} />}
        <Polyline positions={routePoints.length ? routePoints : navigationMode ? [driverPos, navigationTarget] : [pickupPos, destPos]} pathOptions={{ color: "#D4AF37", weight: navigationMode ? 8 : 6, opacity: 0.94 }} />
        {!navigationMode && <Polyline positions={[pickupPos, driverPos, destPos]} pathOptions={{ color: "#071A33", weight: 2.4, opacity: 0.72, dashArray: "10 12" }} />}
        {(routePoints.length ? routePoints : [pickupPos, driverPos, destPos]).filter((_, index) => index % Math.max(1, Math.floor((routePoints.length || 3) / 10)) === 0).map((point, index) => (
          <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={2.8} pathOptions={{ color: "#F5B700", fillColor: "#F5B700", fillOpacity: 0.75, opacity: 0.55 }} />
        ))}

        <Marker position={pickupPos} icon={pickupIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-blue uppercase">{t.pickupPoint}</p>
              <p>{getString(activeOrder, ["sender_address", "pickup_address", "origin_address"]) || (isArabic ? pickup.labelAr : pickup.labelEn)}</p>
            </div>
          </Popup>
        </Marker>

        <DayNightVehicleMarker
          position={driverPos}
          bearing={vehicleBearing}
          state={hasLiveDriver ? "driving" : "assignment"}
          label={isArabic ? "سيارة DAY NIGHT على مسار الشحنة" : "DAY NIGHT vehicle on shipment route"}
        >
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">DAY NIGHT</p>
              <p>{hasLiveDriver ? (isArabic ? "موقع المندوب المباشر" : "Live courier location") : (isArabic ? "موقع الشحنة التقديري" : "Estimated shipment position")}</p>
            </div>
          </Popup>
        </DayNightVehicleMarker>

        <Marker position={destPos} icon={destinationIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">{t.destinationPoint}</p>
              <p>{getString(activeOrder, ["receiver_address", "delivery_address", "destination_address"]) || (isArabic ? destination.labelAr : destination.labelEn)}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {navigationMode ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[650] grid grid-cols-3 gap-2 rounded-2xl border border-brand-gold/25 bg-[#071A33]/92 px-3 py-3 text-white backdrop-blur-xl dn-navigation-summary">
          <span><Route /><small>{isArabic ? "المتبقي" : "Remaining"}</small><strong>{formatRouteDistance(routeSummary?.distanceMeters || 0, isArabic)}</strong></span>
          <span><Clock3 /><small>{isArabic ? "الوصول المتوقع" : "ETA"}</small><strong>{formatRouteDuration(routeSummary?.durationSeconds || 0, isArabic)}</strong></span>
          <span><Navigation /><small>{isArabic ? "الاتجاه التالي" : "Next road"}</small><strong>{routeSummary?.roadName || (isArabic ? "تابع المسار الذهبي" : "Follow the gold route")}</strong></span>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[650] flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#071A33]/86 px-3 py-2 text-[10px] font-bold text-white/65 backdrop-blur-xl">
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span>
          <span className="flex items-center gap-1.5 text-brand-gold"><Route className="h-3.5 w-3.5" />{isArabic ? "مسار خرائط حقيقي" : "Real map route"}</span>
          <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-brand-gold" />{hasLiveDriver ? (isArabic ? "مباشر" : "Live") : (isArabic ? "تقديري" : "Estimated")}</span>
          <span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? destination.labelAr : destination.labelEn}</span>
        </div>
      )}
    </div>
  );
}
