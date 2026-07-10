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
import L from "leaflet";
import {
  AlertTriangle,
  CalendarDays,
  Filter,
  Layers,
  MapPin,
  Navigation,
  Route,
  Search,
  Truck,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import { AdminIconBadge, AdminStateChip } from "./adminIconSystem";
import { defaultLocations } from "../../data/defaultLocations";
import { adminMapRegions, orderRegionId } from "../../data/adminCommandExpansion";
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
type FocusCommand = { type: "fit" | "driver" | "region"; nonce: number } | null;

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
  { mode: "standard" as const, ar: "عرض عادي", en: "Standard view" },
  { mode: "satellite" as const, ar: "عرض فضائي", en: "Satellite view" },
  { mode: "terrain" as const, ar: "عرض تضاريس", en: "Terrain view" },
];

const statusFilters = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "active", ar: "النشطة", en: "Active" },
  { id: "delayed", ar: "متأخرة", en: "Delayed" },
  { id: "review", ar: "مراجعة", en: "Review" },
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

function readMapMode(): MapMode {
  const value = readLocal("dn_admin_map_mode", "standard");
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

function includesCity(order: any, query: string) {
  return `
    ${order.sender_city || ""}
    ${order.receiver_city || ""}
    ${order.pickup_city || ""}
    ${order.delivery_city || ""}
    ${order.destination_country || ""}
  `
    .toLowerCase()
    .includes(query.toLowerCase());
}

function isStatusMatch(order: any, filter: string) {
  const status = norm(order.status);

  if (filter === "all") return true;
  if (filter === "active") return isActiveOrder(order);
  if (filter === "delayed") return /delay|late|postpone|defer|schedule/.test(status);
  if (filter === "review") return /pending|review|confirm/.test(status);
  if (filter === "delivered") return /deliver|complete/.test(status);
  if (filter === "cancelled") return /cancel|fail/.test(status);

  return true;
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
    const timer = window.setTimeout(() => {
      map.invalidateSize({ animate: true });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [map, mapMode, refreshNonce]);

  useEffect(() => {
    if (focusCommand?.type === "driver") {
      map.setView(driver, 13, { animate: true });
      return;
    }

    if (focusCommand?.type === "region" && focusRegion.id !== "all") {
      map.setView(focusRegion.center, focusRegion.zoom, { animate: true });
      return;
    }

    const validPoints = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (validPoints.length >= 2) {
      map.fitBounds(validPoints, {
        padding: [52, 52],
        maxZoom: 12,
        animate: true,
      });
    }
  }, [map, points, driver, focusRegion, focusCommand]);

  return null;
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
  onReset: () => void;
}) {
  const map = useMap();
  const fitRoute = () => {
    const validPoints = fitPoints.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (validPoints.length >= 2) map.fitBounds(validPoints, { padding: [64, 64], maxZoom: 13, animate: true });
  };
  const resetMap = () => {
    map.setView(focusRegion.id === "all" ? defaultLocations.abuDhabi : focusRegion.center, focusRegion.id === "all" ? 9 : focusRegion.zoom, { animate: true });
    onReset();
  };
  const controls = [
    { key: "zoom-in", label: isArabic ? "تكبير الخريطة" : "Zoom in", Icon: ZoomIn, action: () => map.zoomIn() },
    { key: "zoom-out", label: isArabic ? "تصغير الخريطة" : "Zoom out", Icon: ZoomOut, action: () => map.zoomOut() },
    { key: "reset", label: isArabic ? "إعادة ضبط الخريطة" : "Reset map", Icon: LocateFixed, action: resetMap },
    { key: "fit", label: isArabic ? "ملاءمة المسار" : "Fit route", Icon: Maximize2, action: fitRoute },
    { key: "driver", label: isArabic ? "تمركز على الإمارات" : "Center UAE", Icon: Navigation, action: () => map.setView(driver, 13, { animate: true }) },
  ];
  return <div className="dn-map-control-dock" role="toolbar" aria-label={isArabic ? "أدوات الخريطة" : "Map controls"}>{controls.map(({ key, label, Icon, action }) => <button key={key} type="button" className="dn-map-control-button" aria-label={label} title={label} onClick={action}><Icon className="h-4 w-4" aria-hidden="true" /></button>)}</div>;
}

export default function AdminLiveOperationsMap({
  isArabic,
  orders,
  selectedOrder,
}: AdminLiveOperationsMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>(() => readMapMode());
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [tileFailedByMode, setTileFailedByMode] = useState<Record<MapMode, boolean>>({
    standard: false,
    satellite: false,
    terrain: false,
  });
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [regionFilter, setRegionFilter] = useState(() => readRegion());
  const [searchQuery, setSearchQuery] = useState("");
  const [focusCommand, setFocusCommand] = useState<FocusCommand>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    () =>
      [...(orders || [])].sort(
        (a, b) =>
          new Date(b.created_at || b.updated_at || 0).getTime() -
          new Date(a.created_at || a.updated_at || 0).getTime(),
      ),
    [orders],
  );

  const filteredOrders = useMemo(
    () =>
      sortedOrders.filter((order) => {
        const regionOk = regionFilter === "all" || orderRegionId(order) === regionFilter;
        const statusOk = isStatusMatch(order, statusFilter);
        const searchOk =
          !searchQuery.trim() ||
          [
            getOrderReference(order),
            order.sender_name,
            order.receiver_name,
            order.merchant_name,
            order.receiver_phone,
            order.sender_phone,
          ]
            .join(" ")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          includesCity(order, searchQuery);

        return regionOk && statusOk && searchOk;
      }),
    [sortedOrders, regionFilter, statusFilter, searchQuery],
  );

  const activeOrder = useMemo(() => {
    if (selectedOrder) return selectedOrder;

    const fromSelected = filteredOrders.find(
      (order) => String(order.id || getOrderReference(order)) === selectedOrderId,
    );

    return fromSelected || filteredOrders.find(isActiveOrder) || filteredOrders[0] || sortedOrders[0] || null;
  }, [selectedOrder, filteredOrders, sortedOrders, selectedOrderId]);

  useEffect(() => {
    if (!activeOrder) return;
    setSelectedOrderId(String(activeOrder.id || getOrderReference(activeOrder)));
  }, [activeOrder?.id, activeOrder?.tracking_number]);

  const { pickupCity, deliveryCity } = getOrderRouteCities(activeOrder);
  const pickup = resolveUaePoint(pickupCity, defaultLocations.mussafah);
  const destination = resolveUaePoint(deliveryCity, defaultLocations.abuDhabi);

  const pickupPos: LatLngTuple = [
    getOrderNumber(activeOrder, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]) ?? pickup.lat,
    getOrderNumber(activeOrder, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]) ??
      pickup.lng,
  ];

  const destPos: LatLngTuple = [
    getOrderNumber(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]) ?? destination.lat,
    getOrderNumber(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]) ??
      destination.lng,
  ];

  const driverLat = getOrderNumber(activeOrder, ["driver_lat", "current_lat", "live_lat", "courier_lat"]);
  const driverLng = getOrderNumber(activeOrder, [
    "driver_lng",
    "current_lng",
    "live_lng",
    "courier_lng",
    "driver_lon",
    "current_lon",
  ]);

  const hasLiveDriver = driverLat !== null && driverLng !== null;

  const driverPos: LatLngTuple =
    hasLiveDriver && driverLat !== null && driverLng !== null
      ? [driverLat, driverLng]
      : interpolatePoint(pickupPos, destPos, progressFromStatus(getOrderString(activeOrder, ["status"])));

  const fitPoints = [pickupPos, driverPos, destPos];
  const focusRegion = adminMapRegions.find((region) => region.id === regionFilter) || adminMapRegions[0];

  const routeWaypoints = useMemo(
    () =>
      (hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos])
        .map(([lat, lng]) => `${lng},${lat}`)
        .join(";"),
    [hasLiveDriver, pickupPos[0], pickupPos[1], driverPos[0], driverPos[1], destPos[0], destPos[1]],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchRoute() {
      setRouteDistance(null);
      setRouteDuration(null);

      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${routeWaypoints}?overview=full&geometries=geojson&alternatives=false&steps=false`,
          { signal: controller.signal },
        );
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

      if (!cancelled) {
        setRoutePoints(hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]);
      }
    }

    void fetchRoute();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeWaypoints, hasLiveDriver]);

  if (!isMounted) {
    return <div className="dn-live-map-shell dn-admin-live-ops-map min-h-[380px] animate-pulse" />;
  }

  const reference = getOrderReference(activeOrder);
  const activeMode = modeLabels.find((item) => item.mode === mapMode) || modeLabels[0];
  const activeModeLabel = isArabic ? activeMode.ar : activeMode.en;
  const activeLayerFailed = tileFailedByMode[mapMode];
  const selectedStatus = label(activeOrder?.status, isArabic ? "غير محدد" : "Unknown");
  const amount = orderAmount(activeOrder);
  const distanceKm = routeDistance ? (routeDistance / 1000).toFixed(1) : "—";
  const durationMin = routeDuration ? Math.max(1, Math.round(routeDuration / 60)) : null;

  const tileHandlers = {
    tileerror: () => setTileFailedByMode((current) => ({ ...current, [mapMode]: true })),
    tileload: () => setTileFailedByMode((current) => ({ ...current, [mapMode]: false })),
  };

  const selectMode = (mode: MapMode) => {
    setMapMode(mode);
    setRefreshNonce((value) => value + 1);
    setTileFailedByMode((current) => ({ ...current, [mode]: false }));

    try {
      localStorage.setItem("dn_admin_map_mode", mode);
    } catch {
      // Ignore storage restrictions.
    }
  };

  const setRegion = (region: string) => {
    setRegionFilter(region);

    try {
      localStorage.setItem("dn_admin_map_region", region);
    } catch {
      // Ignore storage restrictions.
    }

    setFocusCommand({ type: "region", nonce: Date.now() });
  };

  const doFocus = (type: "fit" | "driver" | "region") => {
    setFocusCommand({ type, nonce: Date.now() });
  };

  const renderBaseLayers = () => {
    if (mapMode === "terrain") {
      return (
        <TileLayer
          key={`terrain-${refreshNonce}`}
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap"
          eventHandlers={tileHandlers}
        />
      );
    }

    if (mapMode === "satellite") {
      return (
        <>
          <TileLayer
            key={`satellite-esri-${refreshNonce}`}
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            eventHandlers={tileHandlers}
          />
          <TileLayer
            key={`satellite-labels-${refreshNonce}`}
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            eventHandlers={tileHandlers}
          />
        </>
      );
    }

    return (
      <TileLayer
        key={`standard-${refreshNonce}`}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
        eventHandlers={tileHandlers}
      />
    );
  };

  return (
    <div
      className="dn-live-map-shell dn-admin-live-ops-map relative h-[460px] w-full overflow-hidden rounded-[28px] border border-brand-gold/25 bg-[#020812]"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="dn-live-map-ops-panel">
        <div className="dn-map-title-card">
          <p>
            <AdminIconBadge name="map" className="!h-8 !w-8 !min-w-8" />
            {isArabic ? "خريطة العمليات الحية" : "Live Operations Map"}
          </p>
          <AdminStateChip name="live-data" tone="success">{isArabic ? "الوضع الحالي" : "Current mode"}: {activeModeLabel}</AdminStateChip>
          <b dir="ltr">{String(reference).slice(0, 28)}</b>
        </div>

        <div className="dn-map-control-grid">
          <label>
            <span>{isArabic ? "الشحنة" : "Shipment"}</span>
            <select value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>
              {filteredOrders.slice(0, 80).map((order) => (
                <option key={String(order.id || getOrderReference(order))} value={String(order.id || getOrderReference(order))}>
                  {getOrderReference(order)} — {label(order.receiver_city || order.delivery_city || order.receiver_name)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{isArabic ? "الحالة" : "Status"}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusFilters.map((item) => (
                <option key={item.id} value={item.id}>
                  {isArabic ? item.ar : item.en}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{isArabic ? "الإمارة" : "Emirate"}</span>
            <select value={regionFilter} onChange={(event) => setRegion(event.target.value)}>
              {adminMapRegions.map((region) => (
                <option key={region.id} value={region.id}>
                  {isArabic ? region.ar : region.en}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{isArabic ? "بحث" : "Search"}</span>
            <div className="dn-map-search-inline">
              <Search className="h-3.5 w-3.5" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={isArabic ? "مدينة / تاجر / هاتف" : "City / merchant / phone"}
              />
            </div>
          </label>
        </div>
      </div>

      <div className="dn-map-mode-bar">
        <Layers className="h-4 w-4 text-brand-gold" />
        {modeLabels.map((item) => (
          <button
            key={item.mode}
            type="button"
            onClick={() => selectMode(item.mode)}
            aria-pressed={mapMode === item.mode}
            aria-label={isArabic ? item.ar : item.en}
            className={mapMode === item.mode ? "is-active" : ""}
          >
            {isArabic ? item.ar : item.en}
          </button>
        ))}
      </div>

      <div className="dn-map-region-chips">
        {adminMapRegions
          .filter((region) => ["all", "abu_dhabi", "dubai", "sharjah", "al_ain", "external"].includes(region.id))
          .map((region) => (
            <button
              key={region.id}
              type="button"
              onClick={() => setRegion(region.id)}
              className={regionFilter === region.id ? "is-active" : ""}
            >
              {isArabic ? region.ar : region.en}
            </button>
          ))}
      </div>

      <div className="dn-map-action-bar">
        <button type="button" onClick={() => doFocus("fit")}><Maximize2 className="h-4 w-4" />
          {isArabic ? "ملاءمة المسار" : "Fit route"}
        </button>
        <button type="button" onClick={() => doFocus("driver")}><LocateFixed className="h-4 w-4" />
          {isArabic ? "تمركز على الإمارات" : "Center UAE"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRefreshNonce((value) => value + 1);
            doFocus("fit");
          }}
        >
          <RefreshCw className="h-4 w-4" />{isArabic ? "إعادة ضبط الخريطة" : "Reset map"}
        </button>
      </div>

      {activeLayerFailed && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[660] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-300/30 bg-[#071A33]/90 px-4 py-3 text-center text-xs font-black text-amber-100 shadow-2xl backdrop-blur-xl">
          <AlertTriangle className="mx-auto mb-1 h-4 w-4 text-brand-gold" />
          {isArabic ? "تعذر تحميل هذه الطبقة مؤقتاً، جرّب وضعاً آخر." : "This layer could not be loaded temporarily; try another mode."}
        </div>
      )}

      <MapContainer
        key={`${mapMode}-${refreshNonce}`}
        center={driverPos}
        zoom={regionFilter === "all" ? 10 : focusRegion.zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
      >
        <MapCommandControls isArabic={isArabic} fitPoints={fitPoints} driver={driverPos} focusRegion={focusRegion} onReset={() => setRefreshNonce((value) => value + 1)} />
        {renderBaseLayers()}

        <MapRefresh
          points={fitPoints}
          driver={driverPos}
          focusRegion={focusRegion}
          focusCommand={focusCommand}
          mapMode={mapMode}
          refreshNonce={refreshNonce}
        />

        <Polyline
          positions={routePoints.length ? routePoints : [pickupPos, destPos]}
          pathOptions={{ color: "#D4AF37", weight: 6, opacity: 0.92 }}
        />

        <Polyline
          positions={[pickupPos, driverPos, destPos]}
          pathOptions={{ color: "#18A8E8", weight: 2.5, opacity: 0.76, dashArray: "10 12" }}
        />

        {(routePoints.length ? routePoints : [pickupPos, driverPos, destPos])
          .filter((_, index) => index % Math.max(1, Math.floor((routePoints.length || 3) / 12)) === 0)
          .map((point, index) => (
            <CircleMarker
              key={`${point[0]}-${point[1]}-${index}`}
              center={point}
              radius={2.8}
              pathOptions={{
                color: "#F5B700",
                fillColor: "#F5B700",
                fillOpacity: 0.75,
                opacity: 0.55,
              }}
            />
          ))}

        <Marker position={pickupPos} icon={pickupIcon}>
          <Popup>
            <b>{isArabic ? "نقطة الاستلام" : "Pickup Point"}</b>
            <br />
            {getOrderString(activeOrder, ["sender_address", "pickup_address", "origin_address"]) ||
              (isArabic ? pickup.labelAr : pickup.labelEn)}
          </Popup>
        </Marker>

        <Marker position={driverPos} icon={driverIcon}>
          <Popup>
            <b>{isArabic ? "سيارة DAY NIGHT" : "DAY NIGHT Vehicle"}</b>
            <br />
            {hasLiveDriver
              ? isArabic
                ? "موقع السيارة المباشر"
                : "Live vehicle location"
              : isArabic
                ? "موقع الشحنة التقديري"
                : "Estimated shipment position"}
            <br />
            {isArabic ? "المندوب" : "Driver"}: {label(activeOrder?.driver_name || activeOrder?.assigned_driver_name)}
          </Popup>
        </Marker>

        <Marker position={destPos} icon={destinationIcon}>
          <Popup>
            <b>{isArabic ? "نقطة التسليم" : "Delivery Point"}</b>
            <br />
            {getOrderString(activeOrder, ["receiver_address", "delivery_address", "destination_address"]) ||
              (isArabic ? destination.labelAr : destination.labelEn)}
          </Popup>
        </Marker>
      </MapContainer>

      <div className="dn-map-route-summary">
        <span>
          <MapPin className="h-3.5 w-3.5 text-brand-gold" />
          {isArabic ? pickup.labelAr : pickup.labelEn}
        </span>
        <span>
          <Route className="h-3.5 w-3.5" />
          {distanceKm} km {durationMin ? `• ${durationMin}m` : ""}
        </span>
        <span>
          <Truck className="h-3.5 w-3.5 text-brand-sky" />
          {label(activeOrder?.driver_name || activeOrder?.assigned_driver_name, isArabic ? "بدون مندوب" : "Unassigned")}
        </span>
        <span>
          <Navigation className="h-3.5 w-3.5 text-brand-sky" />
          {isArabic ? destination.labelAr : destination.labelEn}
        </span>
        <span>
          <Filter className="h-3.5 w-3.5 text-brand-gold" />
          {selectedStatus}
        </span>
        <span>
          <CalendarDays className="h-3.5 w-3.5 text-brand-sky" />
          {amount ? `${amount.toFixed(2)} AED` : "—"}
        </span>
      </div>
    </div>
  );
}