import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/dn-admin-video-map-final.css";
import "../../styles/dn-admin-map-shipment-rescue.css";
import L from "leaflet";
import {
  AlertTriangle,
  CalendarDays,
  Filter,
  Layers,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  PackagePlus,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  SearchCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { AdminStateChip } from "./adminIconSystem";
import { defaultLocations } from "../../data/defaultLocations";
import { adminMapRegions, orderRegionId } from "../../data/adminCommandExpansion";
import { addAdminNotification, playAdminAudioEvent, unlockAdminAudio } from "../../lib/adminAudio";
import {
  getOrderNumber,
  getOrderReference,
  getOrderRouteCities,
  getOrderString,
  interpolatePoint,
  progressFromStatus,
  resolveUaePoint,
  type LatLngTuple,
} from "../../lib/mapUtils";

type MapMode = "standard" | "satellite" | "terrain";
type FocusCommand = { type: "fit" | "driver" | "region" | "refresh"; nonce: number } | null;

export type AdminLiveOperationsMapProps = {
  isArabic: boolean;
  orders: any[];
  selectedOrder?: any | null;
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
  className: "dn-live-map-driver dn-live-map-vehicle",
  html: `
    <div class="dn-vehicle-marker" aria-label="DAY NIGHT vehicle">
      <svg viewBox="0 0 64 64" role="img">
        <path d="M10 36h4l5-12c1-3 3-4 6-4h17c3 0 5 1 7 4l5 12h2c2 0 4 2 4 4v8c0 2-2 4-4 4h-4a8 8 0 0 1-16 0H28a8 8 0 0 1-16 0h-2c-2 0-4-2-4-4v-8c0-2 2-4 4-4Z" fill="#D4AF37"/>
        <path d="M22 25h11v10H18l4-10Zm14 0h7l5 10H36V25Z" fill="#071A33"/>
        <circle cx="20" cy="52" r="5" fill="#071A33"/>
        <circle cx="44" cy="52" r="5" fill="#071A33"/>
        <path d="M14 39h42" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>
      </svg>
    </div>
  `,
  iconSize: [54, 54],
  iconAnchor: [27, 44],
});

const modeLabels = [
  { mode: "standard" as const, ar: "عادي", en: "Standard", Icon: MapPin },
  { mode: "satellite" as const, ar: "فضائي", en: "Satellite", Icon: Layers },
  { mode: "terrain" as const, ar: "تضاريس", en: "Terrain", Icon: Route },
];

const statusFilters = [
  { id: "all", ar: "كل الشحنات", en: "All shipments" },
  { id: "active", ar: "قيد التنفيذ", en: "Active" },
  { id: "delayed", ar: "متأخرة", en: "Delayed" },
  { id: "review", ar: "قيد المراجعة", en: "Under review" },
  { id: "delivered", ar: "مسلمة", en: "Delivered" },
  { id: "cancelled", ar: "ملغية", en: "Cancelled" },
];

function readLocal(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore private browsing/storage restrictions.
  }
}

function readMapMode(): MapMode {
  const value = readLocal("dn_admin_map_mode", "satellite");
  return value === "satellite" || value === "terrain" ? value : "standard";
}

function readRegion() {
  const value = readLocal("dn_admin_map_region", "all");
  return adminMapRegions.some((region) => region.id === value) ? value : "all";
}

function norm(value: unknown) {
  return String(value || "").toLowerCase().replace(/[_-]/g, " ");
}

function isActiveOrder(order: any) {
  const status = norm(order?.status);
  return !/deliver|cancel|return|fail|complete/.test(status);
}

function orderAmount(order: any) {
  return Number(order?.cod_amount || order?.delivery_price || order?.price || order?.total_amount || 0);
}

function label(value: unknown, fallback = "—") {
  return String(value || fallback);
}

function orderKey(order: any) {
  return String(order?.id || getOrderReference(order));
}

function orderTitle(order: any, isArabic: boolean) {
  const ref = getOrderReference(order);
  const city = label(order?.receiver_city || order?.delivery_city || order?.receiver_name, isArabic ? "بدون مدينة" : "No city");
  return `${ref} — ${city}`;
}

function includesCity(order: any, query: string) {
  return `
    ${order?.sender_city || ""}
    ${order?.receiver_city || ""}
    ${order?.pickup_city || ""}
    ${order?.delivery_city || ""}
    ${order?.destination_country || ""}
  `
    .toLowerCase()
    .includes(query.toLowerCase());
}

function isStatusMatch(order: any, filter: string) {
  const status = norm(order?.status);

  if (filter === "all") return true;
  if (filter === "active") return isActiveOrder(order);
  if (filter === "delayed") return /delay|late|postpone|defer|schedule|مؤجل|متأخر/.test(status);
  if (filter === "review") return /pending|review|confirm|hold|مراجعة|انتظار/.test(status);
  if (filter === "delivered") return /deliver|complete|تم التسليم|مكتمل/.test(status);
  if (filter === "cancelled") return /cancel|fail|ملغي|فشل/.test(status);

  return true;
}

function translatedStatus(status: unknown, isArabic: boolean) {
  const value = norm(status);
  if (!isArabic) return label(status, "Unknown");
  if (/cancel|fail|ملغي/.test(value)) return "ملغية";
  if (/deliver|complete|تم التسليم/.test(value)) return "مسلمة";
  if (/pending|review|hold/.test(value)) return "قيد المراجعة";
  if (/postpone|defer|schedule/.test(value)) return "مؤجلة";
  if (/assign|transit|pickup|route/.test(value)) return "قيد التنفيذ";
  return label(status, "غير محدد");
}

function MapRefresh({
  points,
  driver,
  focusRegion,
  focusCommand,
  mapMode,
  refreshNonce,
}: {
  points: LatLngTuple[];
  driver: LatLngTuple;
  focusRegion: (typeof adminMapRegions)[number];
  focusCommand: FocusCommand;
  mapMode: MapMode;
  refreshNonce: number;
}) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize({ animate: true }), 150);
    return () => window.clearTimeout(timer);
  }, [map, mapMode, refreshNonce]);

  useEffect(() => {
    const validPoints = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (focusCommand?.type === "driver") {
      map.setView(driver, 13, { animate: true });
      return;
    }

    if (focusCommand?.type === "region" && focusRegion.id !== "all") {
      map.setView(focusRegion.center, focusRegion.zoom, { animate: true });
      return;
    }

    if (validPoints.length >= 2) {
      map.fitBounds(validPoints, { padding: [56, 56], maxZoom: 13, animate: true });
      return;
    }

    map.setView(focusRegion.id === "all" ? defaultLocations.abuDhabi : focusRegion.center, focusRegion.id === "all" ? 9 : focusRegion.zoom, { animate: true });
  }, [map, points, driver, focusRegion, focusCommand]);

  return null;
}

function MapButton({ Icon, labelText, onClick }: { Icon: LucideIcon; labelText: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={labelText} title={labelText} className="dn-map-control-button">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function MapCommandControls({
  isArabic,
  fitPoints,
  driver,
  focusRegion,
  onReset,
}: {
  isArabic: boolean;
  fitPoints: LatLngTuple[];
  driver: LatLngTuple;
  focusRegion: (typeof adminMapRegions)[number];
  onReset: (type?: FocusCommand["type"]) => void;
}) {
  const map = useMap();

  const fitRoute = () => {
    const validPoints = fitPoints.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (validPoints.length >= 2) map.fitBounds(validPoints, { padding: [64, 64], maxZoom: 13, animate: true });
    onReset("fit");
  };

  const resetMap = () => {
    map.setView(focusRegion.id === "all" ? defaultLocations.abuDhabi : focusRegion.center, focusRegion.id === "all" ? 9 : focusRegion.zoom, { animate: true });
    onReset("refresh");
  };

  return (
    <div className="dn-map-floating-controls" role="toolbar" aria-label={isArabic ? "أدوات الخريطة" : "Map controls"}>
      <MapButton Icon={Plus} labelText={isArabic ? "تكبير الخريطة" : "Zoom in"} onClick={() => map.zoomIn()} />
      <MapButton Icon={Minus} labelText={isArabic ? "تصغير الخريطة" : "Zoom out"} onClick={() => map.zoomOut()} />
      <MapButton Icon={Route} labelText={isArabic ? "ملاءمة المسار" : "Fit route"} onClick={fitRoute} />
      <MapButton Icon={LocateFixed} labelText={isArabic ? "تركيز على المندوب" : "Focus driver"} onClick={() => { map.setView(driver, 13, { animate: true }); onReset("driver"); }} />
      <MapButton Icon={RotateCcw} labelText={isArabic ? "إعادة ضبط الخريطة" : "Reset map"} onClick={resetMap} />
      <MapButton Icon={RefreshCw} labelText={isArabic ? "تحديث الخريطة" : "Refresh map"} onClick={() => { map.invalidateSize({ animate: true }); onReset("refresh"); }} />
    </div>
  );
}

export default function AdminLiveOperationsMap({ isArabic, orders, selectedOrder }: AdminLiveOperationsMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>(() => readMapMode());
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [tileFailedByMode, setTileFailedByMode] = useState<Record<MapMode, boolean>>({ standard: false, satellite: false, terrain: false });
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState(() => readRegion());
  const [searchQuery, setSearchQuery] = useState("");
  const [focusCommand, setFocusCommand] = useState<FocusCommand>(null);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    const handler = () => {
      setMapMode(readMapMode());
      setRegionFilter(readRegion());
      setRefreshNonce((value) => value + 1);
      setFocusCommand({ type: "region", nonce: Date.now() });
    };
    window.addEventListener("dn-admin-settings-change", handler);
    return () => window.removeEventListener("dn-admin-settings-change", handler);
  }, []);

  const sortedOrders = useMemo(
    () => [...(orders || [])].sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime()),
    [orders],
  );

  const filteredOrders = useMemo(
    () => sortedOrders.filter((order) => {
      const regionOk = regionFilter === "all" || orderRegionId(order) === regionFilter;
      const statusOk = isStatusMatch(order, statusFilter);
      const searchText = [getOrderReference(order), order.sender_name, order.receiver_name, order.merchant_name, order.receiver_phone, order.sender_phone]
        .join(" ")
        .toLowerCase();
      const searchOk = !searchQuery.trim() || searchText.includes(searchQuery.toLowerCase()) || includesCity(order, searchQuery);
      return regionOk && statusOk && searchOk;
    }),
    [sortedOrders, regionFilter, statusFilter, searchQuery],
  );

  const visibleOrders = filteredOrders.length ? filteredOrders : sortedOrders;

  const activeOrder = useMemo(() => {
    if (selectedOrder) return selectedOrder;
    return visibleOrders.find((order) => orderKey(order) === selectedOrderId) || visibleOrders.find(isActiveOrder) || visibleOrders[0] || null;
  }, [selectedOrder, visibleOrders, selectedOrderId]);

  useEffect(() => {
    if (!activeOrder) return;
    const nextKey = orderKey(activeOrder);
    setSelectedOrderId(nextKey);
    setFocusCommand({ type: "fit", nonce: Date.now() });
  }, [activeOrder?.id, activeOrder?.tracking_number, activeOrder?.status]);

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
  const focusRegion = adminMapRegions.find((region) => region.id === regionFilter) || adminMapRegions[0];

  const routeWaypoints = useMemo(
    () => (hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]).map(([lat, lng]) => `${lng},${lat}`).join(";"),
    [hasLiveDriver, pickupPos[0], pickupPos[1], driverPos[0], driverPos[1], destPos[0], destPos[1]],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchRoute() {
      setRouteDistance(null);
      setRouteDuration(null);
      if (!activeOrder) {
        setRoutePoints([pickupPos, destPos]);
        return;
      }
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${routeWaypoints}?overview=full&geometries=geojson&alternatives=false&steps=false`, { signal: controller.signal });
        const data = await res.json();
        const route = data?.routes?.[0];
        const coords = route?.geometry?.coordinates;
        if (!cancelled && Array.isArray(coords) && coords.length > 1) {
          setRouteDistance(Number(route.distance || 0));
          setRouteDuration(Number(route.duration || 0));
          setRoutePoints(coords.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngTuple));
          return;
        }
      } catch {
        // Safe fallback below.
      }
      if (!cancelled) setRoutePoints(hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]);
    }

    void fetchRoute();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeWaypoints, hasLiveDriver, activeOrder?.id]);

  const reference = activeOrder ? getOrderReference(activeOrder) : isArabic ? "لا توجد شحنة محددة" : "No selected shipment";
  const activeMode = modeLabels.find((item) => item.mode === mapMode) || modeLabels[0];
  const activeLayerFailed = tileFailedByMode[mapMode];
  const selectedStatus = translatedStatus(activeOrder?.status, isArabic);
  const amount = orderAmount(activeOrder);
  const distanceKm = routeDistance ? (routeDistance / 1000).toFixed(1) : "—";
  const durationMin = routeDuration ? Math.max(1, Math.round(routeDuration / 60)) : null;
  const compactRegions = adminMapRegions.filter((region) => ["all", "abu_dhabi", "dubai", "sharjah", "al_ain", "external"].includes(region.id));

  const tileHandlers = {
    tileerror: () => setTileFailedByMode((current) => ({ ...current, [mapMode]: true })),
    tileload: () => setTileFailedByMode((current) => ({ ...current, [mapMode]: false })),
  };

  const selectMode = (mode: MapMode) => {
    unlockAdminAudio();
    playAdminAudioEvent("click");
    setMapMode(mode);
    setRefreshNonce((value) => value + 1);
    setTileFailedByMode((current) => ({ ...current, [mode]: false }));
    writeLocal("dn_admin_map_mode", mode);
  };

  const setRegion = (region: string) => {
    unlockAdminAudio();
    playAdminAudioEvent("click");
    setRegionFilter(region);
    writeLocal("dn_admin_map_region", region);
    setFocusCommand({ type: "region", nonce: Date.now() });
  };

  const selectShipment = (value: string) => {
    unlockAdminAudio();
    playAdminAudioEvent("notification");
    setSelectedOrderId(value);
    setStatusFilter((current) => (current === "all" ? current : "all"));
    setFocusCommand({ type: "fit", nonce: Date.now() });
    const selected = sortedOrders.find((order) => orderKey(order) === value);
    if (selected) {
      addAdminNotification({
        type: "info",
        sectionId: "dashboard",
        titleAr: "تم اختيار الشحنة على الخريطة",
        titleEn: "Shipment selected on map",
        bodyAr: `تم تركيز الخريطة على ${getOrderReference(selected)} ومسارها الحالي.`,
        bodyEn: `Map focused on ${getOrderReference(selected)} and its current route.`,
        audioEvent: "notification",
        dedupeKey: `map-select:${value}`,
        dedupeMs: 1800,
      });
    }
  };

  const requestCreateShipment = () => {
    unlockAdminAudio();
    playAdminAudioEvent("new_order");
    addAdminNotification({
      type: "new_order",
      sectionId: "new_order",
      titleAr: "فتح إضافة طلبية",
      titleEn: "Opening new shipment",
      bodyAr: "سيتم فتح قسم إضافة طلبية جديدة من لوحة العمليات.",
      bodyEn: "The new shipment form will open from operations.",
      audioEvent: "new_order",
      dedupeKey: `map-add-shipment-${Date.now()}`,
      dedupeMs: 1,
    });

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".dn-admin-side-nav button, .dn-admin-action-tile"));
    const target = buttons.find((button) => /إضافة طلب|إضافة طلبية|New Order|Add New Order/i.test(button.textContent || ""));
    target?.click();
  };

  const renderBaseLayers = () => {
    if (mapMode === "terrain") {
      return <TileLayer key={`terrain-${refreshNonce}`} url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap" eventHandlers={tileHandlers} />;
    }

    if (mapMode === "satellite") {
      return (
        <>
          <TileLayer key={`satellite-esri-${refreshNonce}`} url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" eventHandlers={tileHandlers} />
          <TileLayer key={`satellite-labels-${refreshNonce}`} url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" eventHandlers={tileHandlers} />
        </>
      );
    }

    return <TileLayer key={`standard-${refreshNonce}`} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" eventHandlers={tileHandlers} />;
  };

  if (!isMounted) {
    return <div className="min-h-[420px] w-full animate-pulse rounded-[28px] border border-brand-gold/20 bg-[#020812]" />;
  }

  return (
    <section className="dn-video-clean-live-map dn-admin-live-map-fixed w-full max-w-[920px] rounded-[28px] border border-brand-gold/20 bg-[#031226]/95 p-3 shadow-2xl shadow-black/25" dir={isArabic ? "rtl" : "ltr"} aria-label={isArabic ? "خريطة العمليات الحية" : "Live operations map"}>
      <header className="dn-map-header-clean">
        <div className="dn-map-title-row">
          <div className="min-w-0">
            <p>
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {isArabic ? "خريطة العمليات الحية" : "Live Operations Map"}
            </p>
            <span dir="ltr">{String(reference).slice(0, 42)}</span>
          </div>
          <div className="dn-map-header-actions">
            <AdminStateChip name="live-data" tone="success">
              {isArabic ? "الطبقة" : "Layer"}: {isArabic ? activeMode.ar : activeMode.en}
            </AdminStateChip>
            <button type="button" className="dn-map-add-shipment" onClick={requestCreateShipment}>
              <PackagePlus className="h-4 w-4" />
              {isArabic ? "إضافة طلبية" : "Add shipment"}
            </button>
          </div>
        </div>

        <div className="dn-map-form-grid">
          <label>
            <span>{isArabic ? "بحث" : "Search"}</span>
            <div>
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={isArabic ? "مدينة / تاجر / هاتف / رقم شحنة" : "City / merchant / phone / shipment"} />
            </div>
          </label>

          <label>
            <span>{isArabic ? "الإمارة" : "Emirate"}</span>
            <select value={regionFilter} onChange={(event) => setRegion(event.target.value)}>
              {adminMapRegions.map((region) => <option key={region.id} value={region.id}>{isArabic ? region.ar : region.en}</option>)}
            </select>
          </label>

          <label>
            <span>{isArabic ? "الحالة" : "Status"}</span>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setFocusCommand({ type: "fit", nonce: Date.now() }); }}>
              {statusFilters.map((item) => <option key={item.id} value={item.id}>{isArabic ? item.ar : item.en}</option>)}
            </select>
          </label>

          <label className="dn-map-shipment-picker">
            <span>{isArabic ? "اختيار الشحنة" : "Select shipment"}</span>
            <select value={selectedOrderId} onChange={(event) => selectShipment(event.target.value)} disabled={!visibleOrders.length}>
              {!visibleOrders.length && <option value="">{isArabic ? "لا توجد شحنات مطابقة" : "No matching shipments"}</option>}
              {visibleOrders.slice(0, 120).map((order) => <option key={orderKey(order)} value={orderKey(order)}>{orderTitle(order, isArabic)}</option>)}
            </select>
          </label>
        </div>

        <div className="dn-map-chip-row">
          <span>{isArabic ? "عرض الخريطة" : "Map view"}</span>
          {modeLabels.map(({ mode, ar, en, Icon }) => (
            <button key={mode} type="button" onClick={() => selectMode(mode)} aria-pressed={mapMode === mode} className={mapMode === mode ? "is-active" : ""}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {isArabic ? ar : en}
            </button>
          ))}
        </div>

        <div className="dn-map-chip-row">
          <span>{isArabic ? "المناطق" : "Regions"}</span>
          {compactRegions.map((region) => (
            <button key={region.id} type="button" onClick={() => setRegion(region.id)} className={regionFilter === region.id ? "is-active" : ""}>
              <SearchCheck className="h-3.5 w-3.5" />
              {isArabic ? region.ar : region.en}
            </button>
          ))}
        </div>
      </header>

      {activeLayerFailed && (
        <div className="dn-map-warning">
          <AlertTriangle className="h-4 w-4" />
          {isArabic ? "تعذر تحميل هذه الطبقة مؤقتاً، جرّب وضعاً آخر." : "This layer could not be loaded temporarily; try another mode."}
        </div>
      )}

      <div className="dn-video-map-square dn-live-map-square-clean mt-3 w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#020812]" style={{ aspectRatio: "1 / 1" }}>
        <MapContainer key={`${mapMode}-${refreshNonce}`} center={driverPos} zoom={regionFilter === "all" ? 10 : focusRegion.zoom} className="h-full w-full" style={{ height: "100%", width: "100%" }} scrollWheelZoom zoomControl={false} keyboard>
          <MapCommandControls isArabic={isArabic} fitPoints={fitPoints} driver={driverPos} focusRegion={focusRegion} onReset={(type = "refresh") => { setRefreshNonce((value) => value + 1); setFocusCommand({ type, nonce: Date.now() }); }} />
          {renderBaseLayers()}
          <MapRefresh points={fitPoints} driver={driverPos} focusRegion={focusRegion} focusCommand={focusCommand} mapMode={mapMode} refreshNonce={refreshNonce} />

          <Polyline positions={routePoints.length ? routePoints : [pickupPos, destPos]} pathOptions={{ color: "#D4AF37", weight: 6, opacity: 0.92 }} />
          <Polyline positions={[pickupPos, driverPos, destPos]} pathOptions={{ color: "#18A8E8", weight: 2.5, opacity: 0.76, dashArray: "10 12" }} />

          {(routePoints.length ? routePoints : [pickupPos, driverPos, destPos]).filter((_, index) => index % Math.max(1, Math.floor((routePoints.length || 3) / 12)) === 0).map((point, index) => (
            <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={2.8} pathOptions={{ color: "#F5B700", fillColor: "#F5B700", fillOpacity: 0.75, opacity: 0.55 }} />
          ))}

          <Marker position={pickupPos} icon={pickupIcon}>
            <Popup>
              <b>{isArabic ? "نقطة الاستلام" : "Pickup Point"}</b><br />
              {getOrderString(activeOrder, ["sender_address", "pickup_address", "origin_address"]) || (isArabic ? pickup.labelAr : pickup.labelEn)}
            </Popup>
          </Marker>

          <Marker position={driverPos} icon={driverIcon}>
            <Popup>
              <b>{isArabic ? "سيارة DAY NIGHT" : "DAY NIGHT Vehicle"}</b><br />
              {hasLiveDriver ? (isArabic ? "موقع السيارة المباشر" : "Live vehicle location") : (isArabic ? "موقع الشحنة التقديري" : "Estimated shipment position")}<br />
              {isArabic ? "المندوب" : "Driver"}: {label(activeOrder?.driver_name || activeOrder?.assigned_driver_name, isArabic ? "بدون مندوب" : "Unassigned")}
            </Popup>
          </Marker>

          <Marker position={destPos} icon={destinationIcon}>
            <Popup>
              <b>{isArabic ? "نقطة التسليم" : "Delivery Point"}</b><br />
              {getOrderString(activeOrder, ["receiver_address", "delivery_address", "destination_address"]) || (isArabic ? destination.labelAr : destination.labelEn)}
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <footer className="dn-video-map-summary dn-map-summary-clean mt-3 grid gap-2 rounded-3xl border border-white/10 bg-[#05182f]/70 p-3 text-[0.7rem] font-black text-white/75 sm:grid-cols-2 lg:grid-cols-3">
        <span><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span>
        <span><Route className="h-3.5 w-3.5 text-brand-gold" />{distanceKm} km {durationMin ? `• ${durationMin}m` : ""}</span>
        <span><Truck className="h-3.5 w-3.5 text-brand-sky" />{label(activeOrder?.driver_name || activeOrder?.assigned_driver_name, isArabic ? "بدون مندوب" : "Unassigned")}</span>
        <span><Navigation className="h-3.5 w-3.5 text-brand-sky" />{isArabic ? destination.labelAr : destination.labelEn}</span>
        <span><Filter className="h-3.5 w-3.5 text-brand-gold" />{selectedStatus}</span>
        <span><CalendarDays className="h-3.5 w-3.5 text-brand-sky" />{amount ? `${amount.toFixed(2)} AED` : "—"}</span>
      </footer>
    </section>
  );
}
