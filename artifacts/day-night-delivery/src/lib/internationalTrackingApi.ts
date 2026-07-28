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

const SUPABASE_FUNCTIONS_BASE = "https://ngdwybpgacauorygoedi.supabase.co/functions/v1";
const SUPABASE_ANON_KEY = String((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "").trim();

function requireSupabase() {
  if (!supabase) throw new Error("supabase_unavailable");
  return supabase;
}

function requireAnonKey() {
  if (!SUPABASE_ANON_KEY) throw new Error("supabase_anon_key_missing");
  return SUPABASE_ANON_KEY;
}

function normalizeReference(value: string) {
  const reference = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9\-_.]{5,80}$/.test(reference)) throw new Error("invalid_tracking_reference");
  return reference;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message_en: text };
  }
}

function trackingError(
  name: string,
  response: Response,
  payload: any,
) {
  const message = payload?.message_en || payload?.message_ar || payload?.code || `HTTP ${response.status}` || `${name}_failed`;
  const wrapped = new Error(String(message)) as Error & {
    code?: string;
    status?: number;
    details?: string;
  };
  wrapped.code = String(payload?.code || `${name}_failed`);
  wrapped.status = response.status;
  wrapped.details = String(payload?.details || payload?.error_message || "");
  return wrapped;
}

async function callFunction<T>(
  name: string,
  body: Record<string, unknown>,
  accessToken?: string,
): Promise<T> {
  const anonKey = requireAnonKey();
  const response = await fetch(`${SUPABASE_FUNCTIONS_BASE}/${name}`, {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${accessToken || anonKey}`,
      "X-Client-Info": "day-night-web-track17/2.0",
    },
    body: JSON.stringify(body),
  });

  const payload = await parseResponse(response);
  if (!response.ok) throw trackingError(name, response, payload);
  return payload as T;
}

async function invokeAuthenticated<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const client = requireSupabase();

  let sessionResult = await client.auth.getSession();
  if (sessionResult.error) throw new Error("not_authenticated");

  if (!sessionResult.data.session?.access_token) {
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) {
      throw new Error("not_authenticated");
    }
    sessionResult = refreshed;
  }

  return callFunction<T>(
    name,
    body,
    sessionResult.data.session?.access_token,
  );
}

export async function fetchInternationalTracking(
  reference: string,
): Promise<PublicInternationalTrackingResult> {
  const trackingNumber = normalizeReference(reference);
  return callFunction<PublicInternationalTrackingResult>(
    "public-international-tracking",
    { tracking_number: trackingNumber },
  );
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
  return invokeAuthenticated<{
    ok: boolean;
    shipment?: InternationalShipment;
    already_registered?: boolean;
    sync_warning?: string | null;
  }>("register-track17-shipment", {
    ...input,
    tracking_number: normalizeReference(input.tracking_number),
  });
}

export async function syncAramexShipment(shipmentId: string) {
  return invokeAuthenticated<{
    ok: boolean;
    shipment?: InternationalShipment;
    status_changed?: boolean;
    events_received?: number;
  }>("sync-track17-shipment", { shipment_id: shipmentId });
}

export async function runTrack17Admin<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
) {
  return invokeAuthenticated<T>("track17-admin", { action, ...payload });
}

export function internationalTrackingUrl(reference: string) {
  const url = new URL("/international-tracking", window.location.origin);
  if (reference) url.searchParams.set("number", reference);
  return url.toString();
}
