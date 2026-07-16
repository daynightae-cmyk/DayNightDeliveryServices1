import { Fragment, useEffect, useMemo } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { AdminDriverRow } from "../../hooks/useAdminDrivers";

const UAE_CENTER: [number, number] = [24.4539, 54.3773];

const colors = {
  online: "#22c55e",
  idle: "#f4c430",
  offline: "#94a3b8",
  problem: "#ef4444",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[character] || character));
}

function markerIcon(driver: AdminDriverRow, selected: boolean) {
  const color = colors[driver.presence];
  const initials = String(driver.full_name || driver.name || "DN")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const accessibleName = escapeHtml(driver.full_name || driver.name || "Driver");
  const content = driver.avatar_url
    ? `<span class="dn-driver-map-avatar-frame"><img src="${escapeHtml(driver.avatar_url)}" alt="${accessibleName}" width="52" height="52" decoding="async" /></span>`
    : `<span class="dn-driver-map-avatar-frame is-initials"><b>${escapeHtml(initials)}</b></span>`;

  return L.divIcon({
    className: "dn-driver-map-marker-shell",
    html: `<span class="dn-driver-map-marker ${selected ? "is-selected" : ""}" style="--marker:${color}">${content}<i aria-hidden="true"></i></span>`,
    iconSize: [58, 66],
    iconAnchor: [29, 60],
    popupAnchor: [0, -54],
  });
}

function FitMap({ drivers, selectedId }: { drivers: AdminDriverRow[]; selectedId?: string | null }) {
  const map = useMap();
  useEffect(() => {
    const selected = drivers.find((driver) => driver.id === selectedId && driver.location);
    if (selected?.location) {
      map.flyTo([selected.location.lat, selected.location.lng], 17, { duration: 0.8 });
      return;
    }
    const points = drivers
      .filter((driver) => driver.location)
      .map((driver) => [driver.location!.lat, driver.location!.lng] as [number, number]);
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(points, { padding: [42, 42], maxZoom: 14 });
  }, [drivers, map, selectedId]);
  return null;
}

export default function DriverLiveMap({
  drivers,
  isArabic,
  selectedId,
  onSelect,
}: {
  drivers: AdminDriverRow[];
  isArabic: boolean;
  selectedId?: string | null;
  onSelect?: (driverId: string) => void;
}) {
  const visibleDrivers = useMemo(() => drivers.filter((driver) => driver.location), [drivers]);
  const selected = drivers.find((driver) => driver.id === selectedId);

  return (
    <div className="dn-driver-map-wrap">
      <MapContainer center={UAE_CENTER} zoom={8} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMap drivers={visibleDrivers} selectedId={selectedId} />
        {visibleDrivers.map((driver) => {
          const location = driver.location!;
          const selectedDriver = driver.id === selectedId;
          return (
            <Fragment key={driver.id}>
              {selectedDriver && Number(location.accuracy || 0) > 0 && (
                <Circle
                  center={[location.lat, location.lng]}
                  radius={Math.max(5, Number(location.accuracy || 0))}
                  pathOptions={{ color: colors[driver.presence], fillColor: colors[driver.presence], fillOpacity: 0.13, weight: 2 }}
                />
              )}
              <Marker
                position={[location.lat, location.lng]}
                icon={markerIcon(driver, selectedDriver)}
                eventHandlers={{ click: () => onSelect?.(driver.id) }}
              >
                <Popup>
                  <div className="dn-driver-map-popup" dir={isArabic ? "rtl" : "ltr"}>
                    <div className="dn-driver-map-popup-head">
                      {driver.avatar_url ? <img src={driver.avatar_url} alt={driver.full_name || "Driver"} width={44} height={44} /> : null}
                      <section><strong>{driver.full_name || driver.name || driver.id}</strong><small>{driver.vehicle_type || "—"} · {driver.vehicle_plate || "—"}</small></section>
                    </div>
                    <span>{isArabic ? "الحالة" : "Status"}: {driver.presence}</span>
                    <span>{isArabic ? "الطلبات النشطة" : "Active orders"}: {driver.active_orders}</span>
                    <span>{isArabic ? "آخر تحديث" : "Last seen"}: {location.last_seen_at ? new Date(location.last_seen_at).toLocaleString(isArabic ? "ar-AE" : "en-AE") : "—"}</span>
                    <span>{isArabic ? "الدقة" : "Accuracy"}: {location.accuracy != null ? `${Math.round(location.accuracy)}m` : "—"}</span>
                    <span>{isArabic ? "الإحداثيات" : "Coordinates"}: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                    <a href={`https://www.google.com/maps?q=${location.lat},${location.lng}`} target="_blank" rel="noreferrer">
                      {isArabic ? "فتح الموقع الدقيق" : "Open precise location"}
                    </a>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
        {selected && selected.trail.length > 1 && (
          <Polyline
            positions={selected.trail.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: "#f4c430", weight: 4, opacity: 0.8 }}
          />
        )}
      </MapContainer>
      {visibleDrivers.length === 0 && (
        <div className="dn-driver-map-empty">
          <strong>{isArabic ? "لا توجد إحداثيات GPS حقيقية بعد" : "No real GPS coordinates yet"}</strong>
          <span>{isArabic ? "لن يظهر أي Marker وهمي. يظهر المندوب فور السماح بالموقع بعد تسجيل الدخول." : "No fake marker is rendered. A driver appears immediately after granting location access."}</span>
        </div>
      )}
    </div>
  );
}
