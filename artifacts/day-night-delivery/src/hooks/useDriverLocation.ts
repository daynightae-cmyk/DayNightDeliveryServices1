import { useCallback, useEffect, useRef, useState } from "react";
import { driverErrorMessage, reportDriverLocation, setDriverPresence } from "../lib/driverData";

const MIN_SEND_MS = 5_000;
const MIN_MOVE_METERS = 5;
const HEARTBEAT_MS = 20_000;
const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 };

type DriverLocationPermission = "prompt" | "granted" | "denied" | "unsupported";

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

function geolocationErrorMessage(error: GeolocationPositionError, isArabic: boolean) {
  if (error.code === error.PERMISSION_DENIED) {
    return isArabic
      ? "تم رفض إذن الموقع. يمكنك متابعة الطلب وتسجيل التسليم، لكن الخريطة والتتبع المباشر متوقفان. افتح إعدادات الموقع من علامة القفل بجوار عنوان الموقع أو من إعدادات تطبيق DAY NIGHT، اختر «السماح أثناء الاستخدام»، ثم اضغط «تفعيل الموقع»."
      : "Location permission was denied. You can still manage the order and record delivery, but live tracking and navigation are paused. Allow location from the browser lock icon or the DAY NIGHT app settings, then tap Enable GPS.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return isArabic
      ? "إشارة GPS غير متاحة حالياً. انتقل إلى مكان مفتوح، فعّل الموقع الدقيق، ثم اضغط «تفعيل الموقع». لن يمنع ذلك تسجيل حالة الطلب."
      : "GPS is currently unavailable. Move to an open area, enable precise location, then tap Enable GPS. Order status actions remain available.";
  }
  if (error.code === error.TIMEOUT) {
    return isArabic
      ? "استغرق تحديد الموقع وقتاً أطول من المتوقع. تأكد من تشغيل GPS والإنترنت ثم اضغط «تفعيل الموقع» مرة أخرى."
      : "Location acquisition timed out. Check GPS and connectivity, then tap Enable GPS again.";
  }
  return isArabic
    ? "تعذر قراءة الموقع الحالي. يمكنك متابعة الطلب، ثم إعادة تفعيل GPS من إعدادات المتصفح أو التطبيق."
    : "The current location could not be read. You can continue the order, then re-enable GPS from the browser or app settings.";
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
  const [permission, setPermission] = useState<DriverLocationPermission>("prompt");
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
  const permissionRef = useRef<DriverLocationPermission>("prompt");
  const activeRef = useRef(false);
  const generationRef = useRef(0);

  const setPermissionState = useCallback((value: DriverLocationPermission) => {
    permissionRef.current = value;
    setPermission(value);
  }, []);

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
      setPermissionState("granted");
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
    [isCurrentGeneration, setPermissionState, writeLocation],
  );

  const rejectPosition = useCallback(
    (geoError: GeolocationPositionError, generation: number) => {
      if (!isCurrentGeneration(generation)) return;
      const denied = geoError.code === geoError.PERMISSION_DENIED;
      setPermissionState(denied ? "denied" : "prompt");
      setError(geolocationErrorMessage(geoError, isArabic));
      if (denied) {
        void setDriverPresence(false, "paused", "GPS permission denied; order controls remain available").catch(() => undefined);
      }
    },
    [isArabic, isCurrentGeneration, setPermissionState],
  );

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setPermissionState("unsupported");
      setError(isArabic ? "هذا الهاتف لا يدعم تحديد الموقع من المتصفح." : "Browser geolocation is not supported.");
      return;
    }
    const generation = generationRef.current;
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => acceptPosition(nextPosition, generation, true),
      (geoError) => rejectPosition(geoError, generation),
      GEO_OPTIONS,
    );
  }, [acceptPosition, isArabic, rejectPosition, setPermissionState]);

  useEffect(() => {
    if (!driverId || !enabled) {
      generationRef.current += 1;
      activeRef.current = false;
      return;
    }
    if (!("geolocation" in navigator)) {
      setPermissionState("unsupported");
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
      if (!isCurrentGeneration(generation) || permissionRef.current === "denied") return;
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
      if (document.visibilityState !== "visible" || !isCurrentGeneration(generation) || permissionRef.current === "denied") return;
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
  }, [acceptPosition, driverId, enabled, isArabic, isCurrentGeneration, rejectPosition, setPermissionState, writeLocation]);

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
