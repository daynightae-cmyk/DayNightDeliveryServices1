export type NexusLngLat = [number, number];

export type NexusRoute = {
  geometry: { type: "LineString"; coordinates: NexusLngLat[] };
  distance: number;
  duration: number;
  durationTypical?: number | null;
  congestion: {
    low: number;
    moderate: number;
    heavy: number;
    severe: number;
    unknown: number;
  };
};

export type NexusTrafficMatrixRow = {
  duration: number | null;
  distance: number | null;
};

const directionsCache = new Map<string, { expiresAt: number; routes: NexusRoute[] }>();
const matrixCache = new Map<string, { expiresAt: number; rows: NexusTrafficMatrixRow[] }>();

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstNumber(source: any, keys: string[]) {
  for (const key of keys) {
    const value = numeric(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

export function isValidNexusLngLat(point: NexusLngLat | null | undefined): point is NexusLngLat {
  if (!point) return false;
  const [lng, lat] = point;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90 &&
    !(Math.abs(lng) < 0.000001 && Math.abs(lat) < 0.000001)
  );
}

export function explicitOrderPickup(order: any): NexusLngLat | null {
  const lat = firstNumber(order, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]);
  const lng = firstNumber(order, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]);
  if (lat === null || lng === null) return null;
  const point: NexusLngLat = [lng, lat];
  return isValidNexusLngLat(point) ? point : null;
}

export function explicitOrderDestination(order: any): NexusLngLat | null {
  const lat = firstNumber(order, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]);
  const lng = firstNumber(order, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]);
  if (lat === null || lng === null) return null;
  const point: NexusLngLat = [lng, lat];
  return isValidNexusLngLat(point) ? point : null;
}

export function driverLocationPoint(location: any): NexusLngLat | null {
  const lat = numeric(location?.lat ?? location?.latitude);
  const lng = numeric(location?.lng ?? location?.longitude);
  if (lat === null || lng === null) return null;
  const point: NexusLngLat = [lng, lat];
  return isValidNexusLngLat(point) ? point : null;
}

export function orderNeedsPickup(order: any) {
  const status = String(order?.status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return !/(picked_up|in_transit|out_for_delivery|delivered|returned|cancelled)/.test(status);
}

export function buildOrderRouteWaypoints(order: any, driver: NexusLngLat | null): NexusLngLat[] {
  if (!driver) return [];
  const pickup = explicitOrderPickup(order);
  const destination = explicitOrderDestination(order);
  if (!destination) return [];
  if (orderNeedsPickup(order) && pickup) return [driver, pickup, destination];
  return [driver, destination];
}

function roundedPoint([lng, lat]: NexusLngLat) {
  // ~100m coordinate buckets prevent a Directions request for every small GPS update.
  return `${lng.toFixed(3)},${lat.toFixed(3)}`;
}

function routeCacheKey(points: NexusLngLat[]) {
  return points.map(roundedPoint).join(";");
}

function congestionSummary(route: any): NexusRoute["congestion"] {
  const summary = { low: 0, moderate: 0, heavy: 0, severe: 0, unknown: 0 };
  for (const leg of route?.legs || []) {
    for (const value of leg?.annotation?.congestion || []) {
      const key = String(value || "unknown").toLowerCase();
      if (key === "low" || key === "moderate" || key === "heavy" || key === "severe") {
        summary[key] += 1;
      } else {
        summary.unknown += 1;
      }
    }
  }
  return summary;
}

export async function fetchMapboxTrafficRoutes(
  accessToken: string,
  points: NexusLngLat[],
  signal?: AbortSignal,
): Promise<NexusRoute[]> {
  if (!accessToken || points.length < 2 || points.some((point) => !isValidNexusLngLat(point))) return [];
  const key = routeCacheKey(points);
  const cached = directionsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.routes;

  const coordinates = points.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const params = new URLSearchParams({
    access_token: accessToken,
    alternatives: "true",
    annotations: "distance,duration,congestion,congestion_numeric",
    geometries: "geojson",
    overview: "full",
    steps: "true",
  });
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}?${params.toString()}`,
    { signal },
  );
  if (!response.ok) throw new Error(`mapbox_directions_http_${response.status}`);
  const payload = await response.json();
  if (payload?.code !== "Ok") throw new Error(`mapbox_directions_${String(payload?.code || "unknown")}`);

  const routes: NexusRoute[] = (payload.routes || [])
    .filter((route: any) => route?.geometry?.type === "LineString" && Array.isArray(route?.geometry?.coordinates))
    .slice(0, 3)
    .map((route: any) => ({
      geometry: route.geometry,
      distance: Number(route.distance || 0),
      duration: Number(route.duration || 0),
      durationTypical: Number.isFinite(Number(route.duration_typical)) ? Number(route.duration_typical) : null,
      congestion: congestionSummary(route),
    }));

  directionsCache.set(key, { expiresAt: Date.now() + 60_000, routes });
  return routes;
}

export async function fetchMapboxTrafficMatrix(
  accessToken: string,
  sources: NexusLngLat[],
  destination: NexusLngLat,
  signal?: AbortSignal,
): Promise<NexusTrafficMatrixRow[]> {
  const validSources = sources.filter(isValidNexusLngLat).slice(0, 9);
  if (!accessToken || !validSources.length || !isValidNexusLngLat(destination)) return [];
  const points = [...validSources, destination];
  const key = `matrix:${routeCacheKey(points)}`;
  const cached = matrixCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;

  const destinationIndex = points.length - 1;
  const coordinates = points.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const params = new URLSearchParams({
    access_token: accessToken,
    annotations: "duration,distance",
    sources: validSources.map((_, index) => String(index)).join(";"),
    destinations: String(destinationIndex),
  });
  const response = await fetch(
    `https://api.mapbox.com/directions-matrix/v1/mapbox/driving-traffic/${coordinates}?${params.toString()}`,
    { signal },
  );
  if (!response.ok) throw new Error(`mapbox_matrix_http_${response.status}`);
  const payload = await response.json();
  if (payload?.code !== "Ok") throw new Error(`mapbox_matrix_${String(payload?.code || "unknown")}`);

  const rows: NexusTrafficMatrixRow[] = validSources.map((_, index) => ({
    duration: Number.isFinite(Number(payload?.durations?.[index]?.[0])) ? Number(payload.durations[index][0]) : null,
    distance: Number.isFinite(Number(payload?.distances?.[index]?.[0])) ? Number(payload.distances[index][0]) : null,
  }));
  matrixCache.set(key, { expiresAt: Date.now() + 60_000, rows });
  return rows;
}

export function routeCongestionLabel(route: NexusRoute | null | undefined) {
  if (!route) return "unknown" as const;
  const values = route.congestion;
  const known = values.low + values.moderate + values.heavy + values.severe;
  if (!known) return "unknown" as const;
  if (values.severe / known >= 0.2) return "severe" as const;
  if ((values.severe + values.heavy) / known >= 0.3) return "heavy" as const;
  if ((values.severe + values.heavy + values.moderate) / known >= 0.35) return "moderate" as const;
  return "low" as const;
}

export function formatRouteDuration(seconds: number | null | undefined, isArabic: boolean) {
  if (!Number.isFinite(Number(seconds))) return "—";
  const minutes = Math.max(1, Math.round(Number(seconds) / 60));
  if (minutes < 60) return isArabic ? `${minutes} د` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return isArabic ? `${hours} س ${rest} د` : `${hours}h ${rest}m`;
}

export function formatRouteDistance(meters: number | null | undefined) {
  if (!Number.isFinite(Number(meters))) return "—";
  return `${(Number(meters) / 1000).toFixed(Number(meters) >= 10_000 ? 0 : 1)} km`;
}
