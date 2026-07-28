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
      "X-Client-Info": "day-night-web-track17/3.0",
    },
    body: JSON.stringify(body),
  });

  const payload = await parseResponse(response);
  if (!response.ok) throw trackingError(name, response, payload);
  return payload as T;
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
  if (sessionResult.error) throw new Error("not_authenticated");

  const session = sessionResult.data.session;
  const expiresSoon = !session?.expires_at || session.expires_at * 1000 <= Date.now() + 90_000;
  if (session?.access_token && !expiresSoon) return session.access_token;

  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) {
    if (session?.access_token) return session.access_token;
    throw new Error("not_authenticated");
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
    const status = Number((cause as { status?: number })?.status || 0);
    const code = String((cause as { code?: string })?.code || "");
    if (status !== 401 && !/not_authenticated/i.test(code)) throw cause;
    token = await accessToken(true);
    return callFunction<T>(name, body, token);
  }
}

async function directAdminListFallback(limit: number) {
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

  if (shipmentsResult.error) throw new Error(`shipment_list_failed:${shipmentsResult.error.message}`);
  return {
    ok: true,
    shipments: shipmentsResult.data || [],
    webhook_logs: webhookResult.error ? [] : (webhookResult.data || []),
    quota: quotaResult.error ? null : (quotaResult.data || null),
  };
}

async function directQuotaFallback() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("track17_quota_cache")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(`quota_cache_failed:${error.message}`);
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
  try {
    return await invokeAuthenticated<T>("track17-admin", { action, ...payload });
  } catch (cause) {
    const normalizedAction = String(action || "").trim().toLowerCase();
    if (normalizedAction === "list") {
      return await directAdminListFallback(Number(payload.limit || 100)) as T;
    }
    if (normalizedAction === "quota") {
      return await directQuotaFallback() as T;
    }
    throw cause;
  }
}

export function internationalTrackingUrl(reference: string) {
  const url = new URL("/international-tracking", window.location.origin);
  if (reference) url.searchParams.set("number", reference);
  return url.toString();
}
