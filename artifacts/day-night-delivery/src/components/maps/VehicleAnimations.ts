export type LatLngTuple = [number, number];

export function normalizeBearing(value: number) {
  const normalized = Number.isFinite(value) ? value % 360 : 0;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function shortestBearingDelta(from: number, to: number) {
  const start = normalizeBearing(from);
  const end = normalizeBearing(to);
  return ((end - start + 540) % 360) - 180;
}

export function interpolateBearing(from: number, to: number, progress: number) {
  return normalizeBearing(from + shortestBearingDelta(from, to) * Math.min(1, Math.max(0, progress)));
}

export function easeOutCubic(progress: number) {
  const value = Math.min(1, Math.max(0, progress));
  return 1 - Math.pow(1 - value, 3);
}

export function calculateBearing(from: LatLngTuple, to: LatLngTuple) {
  if (from[0] === to[0] && from[1] === to[1]) return 0;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const toDegrees = (value: number) => (value * 180) / Math.PI;
  const startLat = toRadians(from[0]);
  const endLat = toRadians(to[0]);
  const deltaLng = toRadians(to[1] - from[1]);
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);
  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}

export function vehicleSizeForZoom(zoom: number, navigationMode = false) {
  if (navigationMode) return 56;
  if (zoom <= 8) return 32;
  if (zoom >= 15) return 48;
  return 40;
}
