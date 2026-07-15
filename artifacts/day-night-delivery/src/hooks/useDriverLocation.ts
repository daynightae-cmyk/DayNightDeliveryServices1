import { useCallback, useEffect, useRef, useState } from "react";
import { driverErrorMessage, reportDriverLocation, setDriverPresence } from "../lib/driverData";

const MIN_SEND_MS = 5_000;
const MIN_MOVE_METERS = 5;
const HEARTBEAT_MS = 20_000;
const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 };

const toRad = (value: number) => (value * Math.PI) / 180;

function calculateDistanceMeters(a: GeolocationCoordinates, b: GeolocationCoordinates) {
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
  const networkState =
    navigatorWithConnection.connection?.effectiveType ||
    navigatorWithConnection.connection?.type ||
    (navigator.onLine ? "online" : "offline");
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
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [networkState, setNetworkState] = useState<string>(navigator.onLine ? "online" : "offline");
  const [travelledMeters, setTravelledMeters] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const lastSent = useRef<{ at: number; coords: GeolocationCoordinates } | null>(null);
  const lastAccepted = useRef<GeolocationCoordinates | null>(null);
  const latestPosition = useRef<GeolocationPosition | null>(null);
  const activeRef = useRef(false);
  const generationRef = useRef(0);

  const isCurrentGeneration = useCallback(
    (generation: number) => activeRef.current && generationRef.current === generation,
    [],
  );

  const writeLocation = useCallback(
    async (nextPosition: GeolocationPosition, generation = generationRef.current) => {
      if (!driverId || !isCurrentGeneration(generation)) return;
      setSending(true);
      try {
        const signals = await deviceSignals();
        if (!isCurrentGeneration(generation)) return;
        setBatteryLevel(signals.batteryLevel);
        setNetworkState(signals.networkState);
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
        if (!isCurrentGeneration(generation)) return;
        setLastSyncedAt(new Date().toISOString());
        setError("");
      } catch (writeError) {
        if (isCurrentGeneration(generation)) setError(driverErrorMessage(writeError, isArabic));
      } finally {
        if (isCurrentGeneration(generation)) setSending(false);
      }
    },
    [currentOrderId, driverId, isArabic, isCurrentGeneration],
  );

  const acceptPosition = useCallback(
    (nextPosition: GeolocationPosition, generation: number, force = false) => {
      if (!isCurrentGeneration(generation)) return;
      setPermission("granted");
      setPosition(nextPosition);
      latestPosition.current = nextPosition;

      const acceptedPrevious = lastAccepted.current;
      if (acceptedPrevious) {
        const segment = calculateDistanceMeters(acceptedPrevious, nextPosition.coords);
        if (segment >= 3 && segment <= 2_000) setTravelledMeters((current) => current + segment);
      }
      lastAccepted.current = nextPosition.coords;

      const previous = lastSent.current;
      const moved = previous ? calculateDistanceMeters(previous.coords, nextPosition.coords) >= MIN_MOVE_METERS : true;
      const elapsed = previous ? Date.now() - previous.at >= MIN_SEND_MS : true;
      if (force || moved || elapsed) {
        lastSent.current = { at: Date.now(), coords: nextPosition.coords };
        void writeLocation(nextPosition, generation);
      }
    },
    [isCurrentGeneration, writeLocation],
  );

  const rejectPosition = useCallback(
    (geoError: GeolocationPositionError, generation: number) => {
      if (!isCurrentGeneration(generation)) return;
      const denied = geoError.code === geoError.PERMISSION_DENIED;
      setPermission(denied ? "denied" : "prompt");
      setError(driverErrorMessage(geoError.message, isArabic));
      if (denied) {
        void setDriverPresence(false, "paused", "GPS permission denied").catch(() => undefined);
      }
    },
    [isArabic, isCurrentGeneration],
  );

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setPermission("unsupported");
      setError(isArabic ? "هذا الهاتف لا يدعم تحديد الموقع من المتصفح." : "Browser geolocation is not supported.");
      return;
    }
    const generation = generationRef.current;
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => acceptPosition(nextPosition, generation, true),
      (geoError) => rejectPosition(geoError, generation),
      GEO_OPTIONS,
    );
  }, [acceptPosition, isArabic, rejectPosition]);

  useEffect(() => {
    if (!driverId || !enabled) {
      generationRef.current += 1;
      activeRef.current = false;
      return;
    }
    if (!("geolocation" in navigator)) {
      setPermission("unsupported");
      setError(isArabic ? "هذا الهاتف لا يدعم تحديد الموقع من المتصفح." : "Browser geolocation is not supported.");
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    activeRef.current = true;
    lastSent.current = null;
    lastAccepted.current = null;
    setTravelledMeters(0);
    setSessionStartedAt(new Date().toISOString());

    void setDriverPresence(true, "available", "Driver signed in; automatic GPS tracking started").catch((presenceError) => {
      if (isCurrentGeneration(generation)) setError(driverErrorMessage(presenceError, isArabic));
    });

    navigator.geolocation.getCurrentPosition(
      (nextPosition) => acceptPosition(nextPosition, generation, true),
      (geoError) => rejectPosition(geoError, generation),
      GEO_OPTIONS,
    );

    const watchId = navigator.geolocation.watchPosition(
      (nextPosition) => acceptPosition(nextPosition, generation),
      (geoError) => rejectPosition(geoError, generation),
      GEO_OPTIONS,
    );

    const heartbeat = window.setInterval(() => {
      if (!isCurrentGeneration(generation)) return;
      if (latestPosition.current) void writeLocation(latestPosition.current, generation);
      else {
        navigator.geolocation.getCurrentPosition(
          (nextPosition) => acceptPosition(nextPosition, generation, true),
          (geoError) => rejectPosition(geoError, generation),
          GEO_OPTIONS,
        );
      }
    }, HEARTBEAT_MS);

    const syncWhenVisible = () => {
      if (document.visibilityState !== "visible" || !isCurrentGeneration(generation)) return;
      navigator.geolocation.getCurrentPosition(
        (nextPosition) => acceptPosition(nextPosition, generation, true),
        (geoError) => rejectPosition(geoError, generation),
        GEO_OPTIONS,
      );
    };
    const syncWhenOnline = () => syncWhenVisible();
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("online", syncWhenOnline);

    return () => {
      if (generationRef.current === generation) generationRef.current += 1;
      activeRef.current = false;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("online", syncWhenOnline);
    };
  }, [acceptPosition, driverId, enabled, isArabic, isCurrentGeneration, rejectPosition, writeLocation]);

  const stopShift = useCallback(async () => {
    generationRef.current += 1;
    activeRef.current = false;
    setSending(false);
    setSessionStartedAt(null);
    try {
      await setDriverPresence(false, "offline", "Driver ended shift");
      setError("");
    } catch (stopError) {
      setError(driverErrorMessage(stopError, isArabic));
      throw stopError;
    }
  }, [isArabic]);

  return {
    permission,
    position,
    error,
    sending,
    lastSyncedAt,
    batteryLevel,
    networkState,
    travelledMeters,
    sessionStartedAt,
    writeLocation,
    stopShift,
    requestLocation,
  };
}
