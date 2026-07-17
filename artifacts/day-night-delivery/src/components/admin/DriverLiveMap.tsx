import { Fragment, useEffect, useMemo } from "react";
import { Circle, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/dn-driver-map-avatar-fix.css";
import type { AdminDriverRow } from "../../hooks/useAdminDrivers";
import DayNightVehicleMarker, { type DayNightVehicleState } from "../maps/DayNightVehicleMarker";
import VehicleTrail from "../maps/VehicleTrail";
import { calculateBearing, type LatLngTuple } from "../maps/VehicleAnimations";

const UAE_CENTER: [number, number] = [24.4539, 54.3773];

const colors = {
  online: "#0B5FFF",
  idle: "#D4AF37",
  offline: "#94a3b8",
  problem: "#f59e0b",
};

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

function vehicleState(driver: AdminDriverRow, selected: boolean): DayNightVehicleState {
  if (selected) return "selected";
  if (driver.presence === "offline") return "offline";
  if (driver.presence === "problem") return "emergency";
  if (driver.presence === "idle") return "stopped";
  return "driving";
}

function vehicleBearing(driver: AdminDriverRow) {
  const trail = Array.isArray(driver.trail) ? driver.trail : [];
  if (trail.length < 2) return 0;
  const previous = trail[trail.length - 2];
  const current = trail[trail.length - 1];
  return calculateBearing([previous.lat, previous.lng], [current.lat, current.lng]);
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
  const selectedTrail = useMemo<LatLngTuple[]>(
    () => selected?.trail?.map((point) => [point.lat, point.lng]) || [],
    [selected?.trail],
  );

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
          const label = driver.full_name || driver.name || "DAY NIGHT Driver";
          return (
            <Fragment key={driver.id}>
              {selectedDriver && Number(location.accuracy || 0) > 0 && (
                <Circle
                  center={[location.lat, location.lng]}
                  radius={Math.max(5, Number(location.accuracy || 0))}
                  pathOptions={{ color: colors[driver.presence], fillColor: colors[driver.presence], fillOpacity: 0.1, weight: 2 }}
                />
              )}
              <DayNightVehicleMarker
                position={[location.lat, location.lng]}
                bearing={vehicleBearing(driver)}
                state={vehicleState(driver, selectedDriver)}
                selected={selectedDriver}
                label={`${label} — DAY NIGHT Toyota Rush`}
                eventHandlers={{ click: () => onSelect?.(driver.id) }}
              >
                <Popup>
                  <div className="dn-driver-map-popup" dir={isArabic ? "rtl" : "ltr"}>
                    <div className="dn-driver-map-popup-head">
                      {driver.avatar_url ? <img src={driver.avatar_url} alt={driver.full_name || "Driver"} width={44} height={44} /> : null}
                      <section><strong>{label}</strong><small>{driver.vehicle_type || "Toyota Rush"} · {driver.vehicle_plate || "—"}</small></section>
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
              </DayNightVehicleMarker>
            </Fragment>
          );
        })}
        <VehicleTrail positions={selectedTrail} selected />
      </MapContainer>
      {visibleDrivers.length === 0 && (
        <div className="dn-driver-map-empty">
          <strong>{isArabic ? "لا توجد إحداثيات GPS حقيقية بعد" : "No real GPS coordinates yet"}</strong>
          <span>{isArabic ? "لا تظهر أي مركبة وهمية. تظهر سيارة DAY NIGHT فور السماح بالموقع بعد تسجيل الدخول." : "No fake vehicle is rendered. The DAY NIGHT vehicle appears after location access is granted."}</span>
        </div>
      )}
    </div>
  );
}
