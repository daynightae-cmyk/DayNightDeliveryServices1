const INTERNATIONAL_TRACKING_ORIGIN = "https://daynightae.com";

export function buildInternationalTrackingUrl(trackingNumber: string) {
  const reference = String(trackingNumber || "").trim();
  const url = new URL("/international-tracking", INTERNATIONAL_TRACKING_ORIGIN);
  if (reference) url.searchParams.set("number", reference);
  return url.toString();
}
