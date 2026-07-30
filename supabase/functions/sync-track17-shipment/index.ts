import { handleCors } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { errorMessage, jsonResponse, readJson } from "../_shared/http.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { ARAMEX_CARRIER_CODE, TRACK17_SYNC_COOLDOWN_MS } from "../_shared/track17-config.ts";
import { acceptedRows, rejectedRows, track17Request, Track17RequestError } from "../_shared/track17-client.ts";
import { parseTrack17Row } from "../_shared/track17-parser.ts";
import { persistParsedShipment } from "../_shared/track17-persistence.ts";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse(req, { ok: false, code: "method_not_allowed" }, 405);

  const supabase = getSupabaseAdmin();
  let shipmentId = "";
  let trackingNumber = "";
  const started = Date.now();

  try {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    shipmentId = String(body.shipment_id || "").trim();
    const force = body.force === true;
    if (!shipmentId) throw new Error("shipment_id_required");

    const { data: shipment, error: shipmentError } = await supabase
      .from("international_shipments")
      .select("*")
      .eq("id", shipmentId)
      .maybeSingle();
    if (shipmentError) throw new Error(`shipment_lookup_failed:${shipmentError.message}`);
    if (!shipment) throw new Error("shipment_not_found");
    trackingNumber = shipment.tracking_number;

    const lastSync = shipment.last_synced_at ? Date.parse(shipment.last_synced_at) : 0;
    if (!force && Number.isFinite(lastSync) && Date.now() - lastSync < TRACK17_SYNC_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((TRACK17_SYNC_COOLDOWN_MS - (Date.now() - lastSync)) / 1000);
      return jsonResponse(req, {
        ok: false,
        code: "sync_cooldown",
        retry_after_seconds: retryAfterSeconds,
        message_ar: "تمت المزامنة مؤخرًا. انتظر قليلًا قبل المحاولة مرة أخرى.",
        message_en: "This shipment was synced recently. Please wait before trying again.",
      }, 429, { "Retry-After": String(retryAfterSeconds) });
    }

    const result = await track17Request("gettrackinfo", [{
      number: trackingNumber,
      carrier: ARAMEX_CARRIER_CODE,
    }]);
    const accepted = acceptedRows(result.payload);
    const rejected = rejectedRows(result.payload);
    const row = accepted[0];
    if (!row) {
      const rejection = rejected[0];
      throw new Error(`track17_tracking_rejected:${rejection?.error?.code || "unknown"}:${rejection?.error?.message || "no_data"}`);
    }

    const parsed = await parseTrack17Row(row);
    if (parsed.carrierCode !== ARAMEX_CARRIER_CODE) throw new Error(`carrier_mismatch:${parsed.carrierCode}`);
    const persistence = await persistParsedShipment(supabase, shipment, parsed, { synced: true });

    await supabase.from("track17_api_logs").insert({
      operation: "gettrackinfo",
      shipment_id: shipment.id,
      tracking_number: trackingNumber,
      provider_response_code: Number(result.payload.code || 0),
      accepted: accepted.length,
      rejected: rejected.length,
      duration_ms: result.durationMs,
    });

    const { data: updatedShipment } = await supabase
      .from("international_shipments")
      .select("*")
      .eq("id", shipment.id)
      .single();

    return jsonResponse(req, {
      ok: true,
      shipment: updatedShipment || shipment,
      status_changed: persistence.statusChanged,
      events_received: parsed.events.length,
      forced: force,
    });
  } catch (error) {
    const message = errorMessage(error);
    await supabase.from("track17_api_logs").insert({
      operation: "gettrackinfo",
      shipment_id: shipmentId || null,
      tracking_number: trackingNumber || null,
      provider_response_code: error instanceof Track17RequestError ? error.providerCode : null,
      error_code: message.split(":")[0],
      error_message: message.slice(0, 500),
      duration_ms: Date.now() - started,
    });

    const status = message === "not_authenticated" ? 401
      : message === "not_authorized" ? 403
      : message.includes("not_found") ? 404
      : message.includes("required") ? 400
      : error instanceof Track17RequestError ? error.httpStatus
      : 500;
    return jsonResponse(req, {
      ok: false,
      code: message.split(":")[0],
      message_ar: "تعذرت مزامنة شحنة أرامكس.",
      message_en: "Unable to synchronize the Aramex shipment.",
    }, status);
  }
});
