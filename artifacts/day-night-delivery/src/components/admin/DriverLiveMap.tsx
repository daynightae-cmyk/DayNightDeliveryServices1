import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { AdminDriverRow } from "../../hooks/useAdminDrivers";

const UAE_CENTER: [number, number] = [24.4539, 54.3773];

const colors = {
  online: "#22c55e",
  idle: "#f4c430",
  offline: "#94a3b8",
  problem: "#ef4444",
};

function markerIcon(driver: AdminDriverRow, selected: boolean) {
  const color = colors[driver.presence];
  const initials = String(driver.full_name || driver.name || "DN")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return L.divIcon({
    className: "dn-driver-map-marker-shell",
    html: `<span class="dn-driver-map-marker ${selected ? "is-selected" : ""}" style="--marker:${color}"><b>${initials}</b><i></i></span>`,
    iconSize: [46, 54],
    iconAnchor: [23, 48],
    popupAnchor: [0, -44],
  });
}

function FitMap({ drivers, selectedId }: { drivers: AdminDriverRow[]; selectedId?: string | null }) {
  const map = useMap();
  useEffect(() => {
    const selected = drivers.find((driver) => driver.id === selectedId && driver.location);
    if (selected?.location) {
      map.flyTo([selected.location.lat, selected.location.lng], 15, { duration: 0.8 });
      return;
    }
    const points = drivers
      .filter((driver) => driver.location)
      .map((driver) => [driver.location!.lat, driver.location!.lng] as [number, number]);
    if (points.length === 1) map.setView(points[0], 13);
    else if (points.length > 1) map.fitBounds(points, { padding: [42, 42], maxZoom: 13 });
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
          return (
            <Marker
              key={driver.id}
              position={[location.lat, location.lng]}
              icon={markerIcon(driver, driver.id === selectedId)}
              eventHandlers={{ click: () => onSelect?.(driver.id) }}
            >
              <Popup>
                <div className="dn-driver-map-popup" dir={isArabic ? "rtl" : "ltr"}>
                  <strong>{driver.full_name || driver.name || driver.id}</strong>
                  <span>{isArabic ? "الحالة" : "Status"}: {driver.presence}</span>
                  <span>{isArabic ? "الطلبات النشطة" : "Active orders"}: {driver.active_orders}</span>
                  <span>{isArabic ? "آخر تحديث" : "Last seen"}: {location.last_seen_at ? new Date(location.last_seen_at).toLocaleString(isArabic ? "ar-AE" : "en-AE") : "—"}</span>
                  <span>{isArabic ? "الدقة" : "Accuracy"}: {location.accuracy ? `${Math.round(location.accuracy)}m` : "—"}</span>
                </div>
              </Popup>
            </Marker>
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
          <strong>{isArabic ? "لا توجد إحداثيات حية بعد" : "No live coordinates yet"}</strong>
          <span>{isArabic ? "تظهر المواقع فور بدء المندوب ورديته والسماح بـ GPS." : "Locations appear when a driver starts a shift and permits GPS."}</span>
        </div>
      )}
    </div>
  );
}
