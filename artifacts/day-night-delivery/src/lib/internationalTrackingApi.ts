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

export type TrackingOperationError = Error & {
  code?: string;
  status?: number;
  details?: string;
};

const SUPABASE_FUNCTIONS_BASE = "https://ngdwybpgacauorygoedi.supabase.co/functions/v1";
const SUPABASE_ANON_KEY = String((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "").trim();
const FUNCTION_TIMEOUT_MS = 35_000;

function requireSupabase() {
  if (!supabase) throw operationError("supabase_unavailable", "Supabase client is unavailable.");
  return supabase;
}

function requireAnonKey() {
  if (!SUPABASE_ANON_KEY) throw operationError("supabase_anon_key_missing", "Supabase publishable key is missing from the web deployment.");
  return SUPABASE_ANON_KEY;
}

function operationError(code: string, message: string, details = "", status = 0): TrackingOperationError {
  const error = new Error(message) as TrackingOperationError;
  error.code = code;
  error.details = details;
  error.status = status;
  return error;
}

function normalizeReference(value: string) {
  const reference = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9\-_.]{5,80}$/.test(reference)) {
    throw operationError("invalid_tracking_reference", "Invalid tracking reference.");
  }
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

function trackingError(name: string, response: Response, payload: any): TrackingOperationError {
  const code = String(payload?.code || `${name}_failed`);
  const message = String(payload?.message_ar || payload?.message_en || code || `HTTP ${response.status}`);
  const details = String(payload?.details || payload?.error_message || payload?.provider_message || "");
  return operationError(code, message, details, response.status);
}

async function callFunction<T>(
  name: string,
  body: Record<string, unknown>,
  accessToken?: string,
): Promise<T> {
  const anonKey = requireAnonKey();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FUNCTION_TIMEOUT_MS);

  try {
    const response = await fetch(`${SUPABASE_FUNCTIONS_BASE}/${name}`, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken || anonKey}`,
        "X-Client-Info": "day-night-web-track17/4.0",
      },
      body: JSON.stringify(body),
    });

    const payload = await parseResponse(response);
    if (!response.ok) throw trackingError(name, response, payload);
    return payload as T;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw operationError("function_timeout", `The ${name} request timed out.`, "", 504);
    }
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function accessToken(forceRefresh = false) {
  const client = requireSupabase();

  if (forceRefresh) {
    const refreshed = await client.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      return refreshed.data.session.access_token;
    }
  }

  const sessionResult = await client.auth.getSession();
  if (sessionResult.error) {
    throw operationError("not_authenticated", "Administrator session could not be read.", sessionResult.error.message, 401);
  }

  const session = sessionResult.data.session;
  const expiresSoon = !session?.expires_at || session.expires_at * 1000 <= Date.now() + 90_000;
  if (session?.access_token && !expiresSoon) return session.access_token;

  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) {
    if (session?.access_token) return session.access_token;
    throw operationError("not_authenticated", "Administrator session has expired.", refreshed.error?.message || "", 401);
  }
  return refreshed.data.session.access_token;
}

async function invokeAuthenticated<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  let token = await accessToken(false);
  try {
    return await callFunction<T>(name, body, token);
  } catch (cause) {
    const error = cause as TrackingOperationError;
    const status = Number(error?.status || 0);
    const code = String(error?.code || "");
    if (status !== 401 && !/not_authenticated/i.test(code)) throw cause;
    token = await accessToken(true);
    return callFunction<T>(name, body, token);
  }
}

async function directAdminList(limit: number) {
  const client = requireSupabase();
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 100)));
  const [shipmentsResult, webhookResult, quotaResult] = await Promise.all([
    client
      .from("international_shipments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(safeLimit),
    client
      .from("track17_webhook_logs")
      .select("id,event_type,tracking_number,signature_valid,processing_status,http_result,error_code,received_at,processed_at")
      .order("received_at", { ascending: false })
      .limit(20),
    client
      .from("track17_quota_cache")
      .select("*")
      .eq("id", true)
      .maybeSingle(),
  ]);

  if (shipmentsResult.error) {
    throw operationError(
      "shipment_list_failed",
      "International shipments could not be read.",
      shipmentsResult.error.message,
      500,
    );
  }

  return {
    ok: true,
    shipments: shipmentsResult.data || [],
    webhook_logs: webhookResult.error ? [] : (webhookResult.data || []),
    quota: quotaResult.error ? null : (quotaResult.data || null),
  };
}

async function directQuota() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("track17_quota_cache")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw operationError("quota_cache_failed", "Quota cache could not be read.", error.message, 500);
  return { ok: true, cached: true, quota: data || null };
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
    already_registered_at_provider?: boolean;
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
  const normalizedAction = String(action || "").trim().toLowerCase();

  // Listing is a normal authenticated database read and should not depend on an
  // Edge Function round trip. This keeps the center usable even when a provider
  // operation or Edge cold start is unavailable.
  if (normalizedAction === "list") {
    try {
      return await directAdminList(Number(payload.limit || 100)) as T;
    } catch (directCause) {
      try {
        return await invokeAuthenticated<T>("track17-admin", { action, ...payload });
      } catch (edgeCause) {
        const direct = directCause as TrackingOperationError;
        const edge = edgeCause as TrackingOperationError;
        throw operationError(
          edge.code || direct.code || "tracking_center_load_failed",
          edge.message || direct.message || "Tracking center data could not be loaded.",
          [direct.details, edge.details].filter(Boolean).join(" | "),
          edge.status || direct.status || 500,
        );
      }
    }
  }

  if (normalizedAction === "quota") {
    try {
      return await invokeAuthenticated<T>("track17-admin", { action, ...payload });
    } catch {
      return await directQuota() as T;
    }
  }

  return invokeAuthenticated<T>("track17-admin", { action, ...payload });
}

export function internationalTrackingUrl(reference: string) {
  const url = new URL("/international-tracking", window.location.origin);
  if (reference) url.searchParams.set("number", reference);
  return url.toString();
}
