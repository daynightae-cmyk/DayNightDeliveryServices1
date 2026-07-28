// Official 17TRACK carrier list:
// https://res.17track.net/asset/carrier/info/apicarrier.all.json
// Aramex (not Aramex AU / NZ) uses carrier code 100006.
export const ARAMEX_CARRIER_CODE = 100006;
export const ARAMEX_CARRIER_NAME = "Aramex";
export const TRACK17_API_VERSION = "v2.4";
export const TRACK17_API_BASE_URL = `https://api.17track.net/track/${TRACK17_API_VERSION}`;
export const TRACK17_TIMEOUT_MS = 20_000;
export const TRACK17_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

export function normalizeTrackingNumber(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function assertTrackingNumber(value: unknown) {
  const trackingNumber = normalizeTrackingNumber(value);
  if (!/^[A-Z0-9-]{5,50}$/.test(trackingNumber)) {
    throw new Error("invalid_tracking_number");
  }
  return trackingNumber;
}
