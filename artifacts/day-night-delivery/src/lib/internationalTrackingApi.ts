import { supabase } from "../supabase";

export type InternationalTrackingEvent = {
  status?: string | null;
  provider_status?: string | null;
  provider_sub_status?: string | null;
  description?: string | null;
  description_ar?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  event_time?: string | null;
};

export type InternationalShipment = {
  id: string;
  public_tracking_number?: string | null;
  carrier_name: "Aramex" | string;
  carrier_code?: number | null;
  carrier_tracking_number?: string | null;
  carrier_tracking_number_full?: string | null;
  tracking_number?: string | null;
  provider?: string | null;
  provider_status?: string | null;
  provider_sub_status?: string | null;
  normalized_status?: string | null;
  latest_description?: string | null;
  latest_location?: string | null;
  latest_city?: string | null;
  latest_country?: string | null;
  latest_coordinates?: { longitude?: number | null; latitude?: number | null } | null;
  origin?: {
    country?: string | null;
    city?: string | null;
    coordinates?: { longitude?: number | null; latitude?: number | null } | null;
  } | null;
  destination?: {
    country?: string | null;
    city?: string | null;
    coordinates?: { longitude?: number | null; latitude?: number | null } | null;
  } | null;
  origin_country?: string | null;
  origin_city?: string | null;
  destination_country?: string | null;
  destination_city?: string | null;
  estimated_delivery_at?: string | null;
  pieces?: number | null;
  weight_kg?: number | null;
  registered_at?: string | null;
  latest_update_at?: string | null;
  delivered_at?: string | null;
  tracking_stopped_at?: string | null;
  last_webhook_at?: string | null;
  last_synced_at?: string | null;
  events?: InternationalTrackingEvent[];
  order_id?: string | null;
};

export type PublicInternationalTrackingResult = {
  ok: boolean;
  code?: string;
  shipment?: InternationalShipment;
  message_ar?: string;
  message_en?: string;
};

function requireSupabase() {
  if (!supabase) throw new Error("supabase_unavailable");
  return supabase;
}

function normalizeReference(value: string) {
  const reference = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9\-_.]{5,80}$/.test(reference)) throw new Error("invalid_tracking_reference");
  return reference;
}

export async function fetchInternationalTracking(reference: string): Promise<PublicInternationalTrackingResult> {
  const client = requireSupabase();
  const trackingNumber = normalizeReference(reference);
  const { data, error } = await client.functions.invoke("public-international-tracking", {
    body: { tracking_number: trackingNumber },
  });
  if (error) {
    const message = typeof data?.message_en === "string" ? data.message_en : error.message;
    const wrapped = new Error(message || "international_tracking_failed") as Error & { code?: string; status?: number };
    wrapped.code = data?.code || "international_tracking_failed";
    wrapped.status = Number(error.context?.status || 0) || undefined;
    throw wrapped;
  }
  return data as PublicInternationalTrackingResult;
}

export async function registerAramexShipment(input: {
  order_id: string;
  tracking_number: string;
  origin_country?: string;
  origin_city?: string;
  destination_country?: string;
  destination_city?: string;
  ship_date?: string;
}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke("register-track17-shipment", {
    body: { ...input, tracking_number: normalizeReference(input.tracking_number) },
  });
  if (error) throw new Error(data?.message_en || error.message || "registration_failed");
  return data as { ok: boolean; shipment?: InternationalShipment; already_registered?: boolean; sync_warning?: string | null };
}

export async function syncAramexShipment(shipmentId: string) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke("sync-track17-shipment", {
    body: { shipment_id: shipmentId },
  });
  if (error) throw new Error(data?.message_en || error.message || "sync_failed");
  return data as { ok: boolean; shipment?: InternationalShipment; status_changed?: boolean; events_received?: number };
}

export async function runTrack17Admin<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke("track17-admin", {
    body: { action, ...payload },
  });
  if (error) throw new Error(data?.message_en || error.message || `track17_admin_${action}_failed`);
  return data as T;
}

export function internationalTrackingUrl(reference: string) {
  const url = new URL("/international-tracking", window.location.origin);
  if (reference) url.searchParams.set("number", reference);
  return url.toString();
}
