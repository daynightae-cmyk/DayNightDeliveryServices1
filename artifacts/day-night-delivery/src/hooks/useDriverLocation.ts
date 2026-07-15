import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

const minMs = 15000;
const minMeters = 25;
const toRad = (v: number) => (v * Math.PI) / 180;
function distanceMeters(a: GeolocationCoordinates, b: GeolocationCoordinates) { const R = 6371000; const dLat = toRad(b.latitude - a.latitude); const dLng = toRad(b.longitude - a.longitude); const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLng/2)**2; return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)); }

export function useDriverLocation(driverId?: string, currentOrderId?: string | null) {
  const [permission, setPermission] = useState<"prompt"|"granted"|"denied"|"unsupported">("prompt");
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState("");
  const lastSent = useRef<{ at: number; coords: GeolocationCoordinates } | null>(null);

  const writeLocation = useCallback(async (pos: GeolocationPosition, online = true) => {
    if (!supabase || !driverId) return;
    const now = new Date().toISOString();
    const payload = { driver_id: driverId, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, heading: pos.coords.heading, speed: pos.coords.speed, is_online: online, last_seen_at: now, current_order_id: currentOrderId || null, updated_at: now };
    await supabase.from("driver_locations").upsert(payload, { onConflict: "driver_id" });
    await supabase.from("driver_location_history").insert({ driver_id: driverId, order_id: currentOrderId || null, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, heading: pos.coords.heading, speed: pos.coords.speed, recorded_at: now });
  }, [currentOrderId, driverId]);

  useEffect(() => {
    if (!driverId) return;
    if (!("geolocation" in navigator)) { setPermission("unsupported"); return; }
    let watchId = 0;
    watchId = navigator.geolocation.watchPosition((pos) => {
      setPermission("granted"); setPosition(pos); setError("");
      const previous = lastSent.current;
      const moved = previous ? distanceMeters(previous.coords, pos.coords) >= minMeters : true;
      const elapsed = previous ? Date.now() - previous.at >= minMs : true;
      if (moved || elapsed) { lastSent.current = { at: Date.now(), coords: pos.coords }; void writeLocation(pos, true); }
    }, (geoError) => { setError(geoError.message); setPermission(geoError.code === geoError.PERMISSION_DENIED ? "denied" : "prompt"); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverId, writeLocation]);

  return { permission, position, error, writeLocation };
}
