import { useCallback, useEffect, useRef, useState } from "react";
import { driverErrorMessage, reportDriverLocation, setDriverPresence } from "../lib/driverData";

const MIN_SEND_MS = 15_000;
const MIN_MOVE_METERS = 20;
const HEARTBEAT_MS = 60_000;

const toRad = (value: number) => (value * Math.PI) / 180;

function distanceMeters(a: GeolocationCoordinates, b: GeolocationCoordinates) {
  const radius = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

type NetworkInformationLike = { effectiveType?: string; type?: string };
type NavigatorWithConnection = Navigator & { connection?: NetworkInformationLike };
type NavigatorWithBattery = Navigator & { getBattery?: () => Promise<{ level: number }> };

async function deviceSignals() {
  const navigatorWithConnection = navigator as NavigatorWithConnection;
  const navigatorWithBattery = navigator as NavigatorWithBattery;
  let batteryLevel: number | null = null;
  try {
    if (navigatorWithBattery.getBattery) {
      const battery = await navigatorWithBattery.getBattery();
      batteryLevel = Math.round(battery.level * 100);
    }
  } catch {
    batteryLevel = null;
  }
  const networkState = navigatorWithConnection.connection?.effectiveType || navigatorWithConnection.connection?.type || (navigator.onLine ? "online" : "offline");
  return { batteryLevel, networkState };
}

export function useDriverLocation(
  driverId: string | undefined,
  currentOrderId: string | null | undefined,
  enabled: boolean,
  isArabic: boolean,
) {
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const lastSent = useRef<{ at: number; coords: GeolocationCoordinates } | null>(null);
  const latestPosition = useRef<GeolocationPosition | null>(null);

  const writeLocation = useCallback(
    async (nextPosition: GeolocationPosition) => {
      if (!driverId) return;
      setSending(true);
      try {
        const signals = await deviceSignals();
        await reportDriverLocation({
          latitude: nextPosition.coords.latitude,
          longitude: nextPosition.coords.longitude,
          accuracy: nextPosition.coords.accuracy,
          heading: nextPosition.coords.heading,
          speed: nextPosition.coords.speed,
          altitude: nextPosition.coords.altitude,
          currentOrderId: currentOrderId || null,
          batteryLevel: signals.batteryLevel,
          networkState: signals.networkState,
        });
        setLastSyncedAt(new Date().toISOString());
        setError("");
      } catch (writeError) {
        setError(driverErrorMessage(writeError, isArabic));
      } finally {
        setSending(false);
      }
    },
    [currentOrderId, driverId, isArabic],
  );

  useEffect(() => {
    if (!driverId || !enabled) return;
    if (!("geolocation" in navigator)) {
      setPermission("unsupported");
      setError(isArabic ? "هذا الهاتف لا يدعم تحديد الموقع من المتصفح." : "Browser geolocation is not supported.");
      return;
    }

    let active = true;
    void setDriverPresence(true, "available", "Driver started shift").catch((presenceError) => {
      if (active) setError(driverErrorMessage(presenceError, isArabic));
    });

    const watchId = navigator.geolocation.watchPosition(
      (nextPosition) => {
        if (!active) return;
        setPermission("granted");
        setPosition(nextPosition);
        latestPosition.current = nextPosition;
        const previous = lastSent.current;
        const moved = previous ? distanceMeters(previous.coords, nextPosition.coords) >= MIN_MOVE_METERS : true;
        const elapsed = previous ? Date.now() - previous.at >= MIN_SEND_MS : true;
        if (moved || elapsed) {
          lastSent.current = { at: Date.now(), coords: nextPosition.coords };
          void writeLocation(nextPosition);
        }
      },
      (geoError) => {
        if (!active) return;
        setPermission(geoError.code === geoError.PERMISSION_DENIED ? "denied" : "prompt");
        setError(geoError.message);
      },
      { enableHighAccuracy: true, maximumAge: 8_000, timeout: 20_000 },
    );

    const heartbeat = window.setInterval(() => {
      if (latestPosition.current) void writeLocation(latestPosition.current);
    }, HEARTBEAT_MS);

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeat);
    };
  }, [driverId, enabled, isArabic, writeLocation]);

  const stopShift = useCallback(async () => {
    try {
      await setDriverPresence(false, "offline", "Driver ended shift");
      setError("");
    } catch (stopError) {
      setError(driverErrorMessage(stopError, isArabic));
      throw stopError;
    }
  }, [isArabic]);

  return { permission, position, error, sending, lastSyncedAt, writeLocation, stopShift };
}
