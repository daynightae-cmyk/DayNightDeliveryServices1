import { describeTrack17Status } from "./track17-status.ts";
import { sha256Hex } from "./track17-signature.ts";

export type ParsedTrackingEvent = {
  eventHash: string;
  providerEventId: string | null;
  providerStatus: string | null;
  providerSubStatus: string | null;
  normalizedStatus: string;
  statusRank: number;
  description: string | null;
  descriptionAr: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  longitude: number | null;
  latitude: number | null;
  eventTime: string;
  rawPayload: Record<string, unknown>;
};

export type ParsedTrack17Shipment = {
  trackingNumber: string;
  carrierCode: number;
  carrierName: string | null;
  providerStatus: string | null;
  providerSubStatus: string | null;
  normalizedStatus: string;
  statusRank: number;
  latestDescription: string | null;
  latestLocation: string | null;
  latestCity: string | null;
  latestCountry: string | null;
  latestCoordinates: { longitude: number | null; latitude: number | null } | null;
  originCountry: string | null;
  originCity: string | null;
  originCoordinates: { longitude: number | null; latitude: number | null } | null;
  destinationCountry: string | null;
  destinationCity: string | null;
  destinationCoordinates: { longitude: number | null; latitude: number | null } | null;
  estimatedDeliveryAt: string | null;
  latestUpdateAt: string | null;
  events: ParsedTrackingEvent[];
  rawPayload: Record<string, unknown>;
};

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function text(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function coordinates(value: unknown) {
  const row = object(value);
  const longitude = number(row.longitude ?? row.lng ?? row.lon);
  const latitude = number(row.latitude ?? row.lat);
  if (longitude === null && latitude === null) return null;
  return { longitude, latitude };
}

function isoTime(event: Record<string, any>) {
  const direct = text(event.time_iso || event.time_utc || event.event_time || event.time);
  if (direct) {
    const timestamp = Date.parse(direct);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  const raw = object(event.time_raw);
  const combined = [text(raw.date), text(raw.time)].filter(Boolean).join("T");
  if (combined) {
    const withZone = `${combined}${text(raw.timezone) || "Z"}`;
    const timestamp = Date.parse(withZone);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return new Date().toISOString();
}

function allProviderEvents(trackInfo: Record<string, any>) {
  const tracking = object(trackInfo.tracking);
  const providers = [
    ...(Array.isArray(tracking.providers) ? tracking.providers : []),
    ...(Array.isArray(trackInfo.providers) ? trackInfo.providers : []),
  ];
  const events: Record<string, any>[] = [];
  for (const providerValue of providers) {
    const providerRow = object(providerValue);
    for (const eventValue of Array.isArray(providerRow.events) ? providerRow.events : []) {
      events.push({ ...object(eventValue), __provider: providerRow.provider || providerRow });
    }
  }
  if (trackInfo.latest_event) events.push(object(trackInfo.latest_event));
  return events;
}

async function parseEvent(trackingNumber: string, carrierCode: number, eventValue: unknown): Promise<ParsedTrackingEvent> {
  const event = object(eventValue);
  const address = object(event.address);
  const statusValue = text(event.stage || event.status || event.sub_status);
  const subStatus = text(event.sub_status);
  const description = text(event.description_translation?.description || event.description);
  const descriptor = describeTrack17Status(statusValue, subStatus, description);
  const eventTime = isoTime(event);
  const location = text(event.location || [address.city, address.state, address.country].filter(Boolean).join(", "));
  const eventIdentity = [
    trackingNumber,
    carrierCode,
    eventTime,
    statusValue,
    subStatus,
    description,
    location,
  ].map((value) => String(value || "")).join("|");

  return {
    eventHash: await sha256Hex(eventIdentity),
    providerEventId: text(event.id || event.event_id || event.events_hash),
    providerStatus: statusValue,
    providerSubStatus: subStatus,
    normalizedStatus: descriptor.normalized,
    statusRank: descriptor.rank,
    description,
    descriptionAr: descriptor.ar,
    location,
    city: text(address.city),
    state: text(address.state),
    country: text(address.country),
    postalCode: text(address.postal_code),
    longitude: coordinates(address.coordinates)?.longitude ?? null,
    latitude: coordinates(address.coordinates)?.latitude ?? null,
    eventTime,
    rawPayload: event,
  };
}

export function track17Rows(payload: unknown) {
  const root = object(payload);
  const data = root.data;
  if (Array.isArray(object(data).accepted)) return object(data).accepted.map(object);
  if (Array.isArray(data)) return data.map(object);
  if (data && typeof data === "object") return [object(data)];
  return [];
}

export async function parseTrack17Row(rowValue: unknown): Promise<ParsedTrack17Shipment> {
  const row = object(rowValue);
  const trackInfo = object(row.track_info);
  const latestStatus = object(trackInfo.latest_status);
  const latestEvent = object(trackInfo.latest_event);
  const shippingInfo = object(trackInfo.shipping_info);
  const shipperAddress = object(shippingInfo.shipper_address);
  const recipientAddress = object(shippingInfo.recipient_address);
  const timeMetrics = object(trackInfo.time_metrics);
  const estimated = object(timeMetrics.estimated_delivery_date);
  const trackingNumber = String(row.number || "").trim().toUpperCase();
  const carrierCode = Number(row.carrier || 0);
  const providerStatus = text(latestStatus.status || latestEvent.stage || latestEvent.status);
  const providerSubStatus = text(latestStatus.sub_status || latestEvent.sub_status);
  const latestDescription = text(latestEvent.description_translation?.description || latestEvent.description || latestStatus.sub_status_descr);
  const descriptor = describeTrack17Status(providerStatus, providerSubStatus, latestDescription);
  const latestAddress = object(latestEvent.address);
  const eventValues = allProviderEvents(trackInfo);
  const parsedEvents = await Promise.all(eventValues.map((event) => parseEvent(trackingNumber, carrierCode, event)));
  const dedupedEvents = Array.from(new Map(parsedEvents.map((event) => [event.eventHash, event])).values())
    .sort((left, right) => Date.parse(right.eventTime) - Date.parse(left.eventTime));
  const provider = object(object(trackInfo.tracking).providers?.[0]?.provider || trackInfo.provider || row.provider);
  const latestUpdateAt = text(latestEvent.time_iso || latestEvent.time_utc) || dedupedEvents[0]?.eventTime || null;

  return {
    trackingNumber,
    carrierCode,
    carrierName: text(provider.name || row.carrier_name),
    providerStatus,
    providerSubStatus,
    normalizedStatus: descriptor.normalized,
    statusRank: descriptor.rank,
    latestDescription,
    latestLocation: text(latestEvent.location || [latestAddress.city, latestAddress.state, latestAddress.country].filter(Boolean).join(", ")),
    latestCity: text(latestAddress.city),
    latestCountry: text(latestAddress.country),
    latestCoordinates: coordinates(latestAddress.coordinates),
    originCountry: text(shipperAddress.country || row.origin_country),
    originCity: text(shipperAddress.city),
    originCoordinates: coordinates(shipperAddress.coordinates),
    destinationCountry: text(recipientAddress.country || row.destination_country),
    destinationCity: text(recipientAddress.city || row.destination_city),
    destinationCoordinates: coordinates(recipientAddress.coordinates),
    estimatedDeliveryAt: text(estimated.to || estimated.from),
    latestUpdateAt,
    events: dedupedEvents,
    rawPayload: row,
  };
}
