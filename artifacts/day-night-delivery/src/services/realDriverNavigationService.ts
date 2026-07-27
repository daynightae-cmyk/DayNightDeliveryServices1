export type NavigationPoint = [number, number];

export type RoadRoute = {
  points: NavigationPoint[];
  distanceMeters: number;
  durationSeconds: number;
};

type CachedRouteRequest = {
  expiresAt: number;
  promise: Promise<RoadRoute>;
};

const DEFAULT_ROUTING_ENDPOINT = "https://router.project-osrm.org";
const DEFAULT_GEOCODING_ENDPOINT = "https://nominatim.openstreetmap.org";
const UAE_BOUNDS = { minLat: 22.45, maxLat: 26.55, minLng: 51.45, maxLng: 56.65 };
const ROUTE_CACHE_PRECISION = 3;
const ROUTE_CACHE_TTL_MS = 20_000;
const ROUTE_NETWORK_TIMEOUT_MS = 15_000;
const inFlightRouteRequests = new Map<string, CachedRouteRequest>();

function endpoint(value: unknown, fallback: string) {
  const text = String(value || fallback).trim().replace(/\/+$/, "");
  return text || fallback;
}

const routingEndpoint = endpoint(import.meta.env.VITE_ROUTING_ENDPOINT, DEFAULT_ROUTING_ENDPOINT);
const geocodingEndpoint = endpoint(import.meta.env.VITE_GEOCODING_ENDPOINT, DEFAULT_GEOCODING_ENDPOINT);

export function isValidNavigationPoint(value: unknown): value is NavigationPoint {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
    && !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001);
}

export function isPointInsideUae(point: NavigationPoint) {
  return point[0] >= UAE_BOUNDS.minLat
    && point[0] <= UAE_BOUNDS.maxLat
    && point[1] >= UAE_BOUNDS.minLng
    && point[1] <= UAE_BOUNDS.maxLng;
}

export function readCoordinatePair(
  record: Record<string, unknown>,
  pairs: Array<[string, string]>,
): NavigationPoint | null {
  for (const [latKey, lngKey] of pairs) {
    const rawLat = record[latKey];
    const rawLng = record[lngKey];
    if (rawLat === null || rawLat === undefined || rawLat === "" || rawLng === null || rawLng === undefined || rawLng === "") continue;
    const point: NavigationPoint = [Number(rawLat), Number(rawLng)];
    if (isValidNavigationPoint(point)) return point;
  }
  return null;
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

export function distanceMeters(a: NavigationPoint, b: NavigationPoint) {
  const radius = 6_371_000;
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);
  const deltaLat = toRadians(b[0] - a[0]);
  const deltaLng = toRadians(b[1] - a[1]);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestPointOnSegment(point: NavigationPoint, start: NavigationPoint, end: NavigationPoint): NavigationPoint {
  const latitudeScale = 111_320;
  const longitudeScale = Math.max(1, Math.cos(toRadians(point[0])) * latitudeScale);
  const px = point[1] * longitudeScale;
  const py = point[0] * latitudeScale;
  const ax = start[1] * longitudeScale;
  const ay = start[0] * latitudeScale;
  const bx = end[1] * longitudeScale;
  const by = end[0] * latitudeScale;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const ratio = denominator > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denominator)) : 0;
  return [(ay + dy * ratio) / latitudeScale, (ax + dx * ratio) / longitudeScale];
}

export function snapPointToRoadRoute(
  point: NavigationPoint,
  route: NavigationPoint[],
  maximumDistanceMeters = 55,
) {
  if (!isValidNavigationPoint(point) || route.length < 2) return { point, snapped: false, segmentIndex: -1, distanceMeters: Infinity };
  let bestPoint = point;
  let bestDistance = Infinity;
  let bestSegment = -1;
  for (let index = 0; index < route.length - 1; index += 1) {
    const candidate = nearestPointOnSegment(point, route[index], route[index + 1]);
    const candidateDistance = distanceMeters(point, candidate);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestPoint = candidate;
      bestSegment = index;
    }
  }
  if (bestDistance > maximumDistanceMeters) return { point, snapped: false, segmentIndex: bestSegment, distanceMeters: bestDistance };
  return { point: bestPoint, snapped: true, segmentIndex: bestSegment, distanceMeters: bestDistance };
}

function routeRequestKey(start: NavigationPoint, destination: NavigationPoint) {
  return [start, destination]
    .flatMap(([lat, lng]) => [lat.toFixed(ROUTE_CACHE_PRECISION), lng.toFixed(ROUTE_CACHE_PRECISION)])
    .join(":");
}

async function requestRoadRoute(start: NavigationPoint, destination: NavigationPoint): Promise<RoadRoute> {
  const waypoints = [start, destination]
    .map(([lat, lng]) => `${lng.toFixed(ROUTE_CACHE_PRECISION)},${lat.toFixed(ROUTE_CACHE_PRECISION)}`)
    .join(";");
  const url = `${routingEndpoint}/route/v1/driving/${waypoints}?overview=full&geometries=geojson&alternatives=false&steps=true&annotations=false`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ROUTE_NETWORK_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`routing_http_${response.status}`);
    const payload = await response.json();
    const route = payload?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (payload?.code !== "Ok" || !Array.isArray(coordinates) || coordinates.length < 2) throw new Error("routing_no_road_route");
    const points = coordinates
      .map(([lng, lat]: [number, number]) => [Number(lat), Number(lng)] as NavigationPoint)
      .filter(isValidNavigationPoint);
    if (points.length < 2) throw new Error("routing_invalid_geometry");
    return {
      points,
      distanceMeters: Number(route.distance || 0),
      durationSeconds: Number(route.duration || 0),
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchRealDrivingRoute(
  start: NavigationPoint,
  destination: NavigationPoint,
  signal?: AbortSignal,
): Promise<RoadRoute> {
  if (!isValidNavigationPoint(start) || !isValidNavigationPoint(destination)) throw new Error("invalid_route_coordinates");
  if (signal?.aborted) throw new Error("routing_request_aborted");

  const key = routeRequestKey(start, destination);
  const now = Date.now();
  const cached = inFlightRouteRequests.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  if (cached) inFlightRouteRequests.delete(key);

  // The network request deliberately owns its AbortController. Rapid one-second
  // GPS updates may replace React effects, but they reuse this coalesced request
  // instead of repeatedly cancelling routing before geometry can arrive.
  const promise = requestRoadRoute(start, destination).catch((error) => {
    inFlightRouteRequests.delete(key);
    throw error;
  });
  inFlightRouteRequests.set(key, { promise, expiresAt: now + ROUTE_CACHE_TTL_MS });
  return promise;
}

function geocodeCacheKey(query: string) {
  return `dn-geocode:${query.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export async function geocodeUaeAddress(query: string, signal?: AbortSignal): Promise<NavigationPoint | null> {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (normalized.length < 6) return null;
  const key = geocodeCacheKey(normalized);
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const point = JSON.parse(cached) as NavigationPoint;
      if (isValidNavigationPoint(point) && isPointInsideUae(point)) return point;
    }
  } catch {
    // Ignore unavailable or malformed session storage.
  }

  const params = new URLSearchParams({
    q: normalized,
    format: "jsonv2",
    limit: "1",
    countrycodes: "ae",
    addressdetails: "0",
  });
  const response = await fetch(`${geocodingEndpoint}/search?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json", "Accept-Language": "ar,en;q=0.8" },
  });
  if (!response.ok) throw new Error(`geocoding_http_${response.status}`);
  const payload = await response.json();
  const first = Array.isArray(payload) ? payload[0] : null;
  const point: NavigationPoint = [Number(first?.lat), Number(first?.lon)];
  if (!isValidNavigationPoint(point) || !isPointInsideUae(point)) return null;
  try {
    sessionStorage.setItem(key, JSON.stringify(point));
  } catch {
    // Storage is optional; routing still works without it.
  }
  return point;
}
