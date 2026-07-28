import { handleCors } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { errorMessage, jsonResponse, readJson } from "../_shared/http.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import {
  ARAMEX_CARRIER_CODE,
  ARAMEX_CARRIER_NAME,
  assertTrackingNumber,
} from "../_shared/track17-config.ts";
import {
  acceptedRows,
  rejectedRows,
  track17Request,
  Track17RequestError,
} from "../_shared/track17-client.ts";
import { parseTrack17Row } from "../_shared/track17-parser.ts";
import { persistParsedShipment } from "../_shared/track17-persistence.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse(req, { ok: false, code: "method_not_allowed" }, 405);

  const supabase = getSupabaseAdmin();
  let trackingNumber = "";
  let started = Date.now();

  try {
    const actor = await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const orderId = String(body.order_id || "").trim();
    if (!uuidPattern.test(orderId)) throw new Error("invalid_order_id");
    trackingNumber = assertTrackingNumber(body.tracking_number);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw new Error(`order_lookup_failed:${orderError.message}`);
    if (!order) throw new Error("order_not_found");

    const { data: existing, error: existingError } = await supabase
      .from("international_shipments")
      .select("*")
      .eq("provider", "17track")
      .eq("carrier_code", ARAMEX_CARRIER_CODE)
      .eq("tracking_number", trackingNumber)
      .maybeSingle();
    if (existingError) throw new Error(`shipment_lookup_failed:${existingError.message}`);
    if (existing) {
      return jsonResponse(req, { ok: true, already_registered: true, shipment: existing });
    }

    const orderJson = order as Record<string, any>;
    const publicTrackingNumber = String(
      orderJson.tracking_code || orderJson.tracking_number || orderJson.invoice_number || orderJson.id,
    );
    const originCountry = String(body.origin_country || orderJson.sender_country || "AE").trim().toUpperCase();
    const destinationCountry = String(body.destination_country || orderJson.receiver_country || "").trim().toUpperCase();
    const destinationCity = String(body.destination_city || orderJson.receiver_city || "").trim();
    const shipDate = String(body.ship_date || "").trim();

    const registerItem: Record<string, unknown> = {
      number: trackingNumber,
      carrier: ARAMEX_CARRIER_CODE,
      lang: "en",
      order_no: publicTrackingNumber,
      tag: publicTrackingNumber,
      origin_country: originCountry || undefined,
      destination_country: destinationCountry || undefined,
      destination_city: destinationCity || undefined,
      ship_date: shipDate || undefined,
    };
    for (const key of Object.keys(registerItem)) {
      if (registerItem[key] === undefined || registerItem[key] === "") delete registerItem[key];
    }

    let registerPayload: any = null;
    let alreadyRegisteredAtProvider = false;
    try {
      const result = await track17Request("register", [registerItem]);
      registerPayload = result.payload;
      const accepted = acceptedRows(result.payload);
      const rejected = rejectedRows(result.payload);
      const acceptedRow = accepted.find((row: any) => String(row.number).toUpperCase() === trackingNumber);
      const rejection = rejected.find((row: any) => String(row.number).toUpperCase() === trackingNumber);

      if (!acceptedRow && Number(rejection?.error?.code) === -18019901) {
        alreadyRegisteredAtProvider = true;
      } else if (!acceptedRow) {
        throw new Error(`track17_registration_rejected:${rejection?.error?.code || "unknown"}:${rejection?.error?.message || "rejected"}`);
      } else if (Number(acceptedRow.carrier) !== ARAMEX_CARRIER_CODE) {
        throw new Error(`carrier_mismatch:${acceptedRow.carrier || 0}`);
      }

      await supabase.from("track17_api_logs").insert({
        operation: "register",
        tracking_number: trackingNumber,
        provider_response_code: Number(result.payload.code || 0),
        accepted: accepted.length,
        rejected: rejected.length,
        duration_ms: result.durationMs,
      });
    } catch (error) {
      if (errorMessage(error).includes("-18019901")) {
        alreadyRegisteredAtProvider = true;
      } else {
        throw error;
      }
    }

    const { data: shipment, error: insertError } = await supabase
      .from("international_shipments")
      .insert({
        order_id: orderId,
        provider: "17track",
        carrier_name: ARAMEX_CARRIER_NAME,
        carrier_code: ARAMEX_CARRIER_CODE,
        tracking_number: trackingNumber,
        public_tracking_number: publicTrackingNumber,
        normalized_status: "information_received",
        status_rank: 10,
        origin_country: originCountry || null,
        origin_city: String(body.origin_city || orderJson.sender_city || "").trim() || null,
        destination_country: destinationCountry || null,
        destination_city: destinationCity || null,
        pieces: Number(orderJson.pieces || 0) || null,
        weight_kg: Number(orderJson.weight || orderJson.weight_kg || 0) || null,
        registered_at: new Date().toISOString(),
        registration_response: registerPayload,
        created_by: actor.id,
      })
      .select("*")
      .single();
    if (insertError) throw new Error(`shipment_insert_failed:${insertError.message}`);

    let syncWarning: string | null = null;
    try {
      const infoResult = await track17Request("gettrackinfo", [{ number: trackingNumber, carrier: ARAMEX_CARRIER_CODE }]);
      const row = acceptedRows(infoResult.payload)[0];
      if (row) {
        const parsed = await parseTrack17Row(row);
        await persistParsedShipment(supabase, shipment, parsed, { synced: true });
      }
      await supabase.from("track17_api_logs").insert({
        operation: "gettrackinfo_after_register",
        shipment_id: shipment.id,
        tracking_number: trackingNumber,
        provider_response_code: Number(infoResult.payload.code || 0),
        accepted: acceptedRows(infoResult.payload).length,
        rejected: rejectedRows(infoResult.payload).length,
        duration_ms: infoResult.durationMs,
      });
    } catch (error) {
      syncWarning = errorMessage(error);
    }

    const { data: finalShipment } = await supabase
      .from("international_shipments")
      .select("*")
      .eq("id", shipment.id)
      .single();

    return jsonResponse(req, {
      ok: true,
      already_registered_at_provider: alreadyRegisteredAtProvider,
      shipment: finalShipment || shipment,
      sync_warning: syncWarning,
    }, 201);
  } catch (error) {
    const message = errorMessage(error);
    const status = message === "not_authenticated" ? 401
      : message === "not_authorized" ? 403
      : message.includes("not_found") ? 404
      : message.includes("invalid_") ? 400
      : error instanceof Track17RequestError ? error.httpStatus
      : 500;

    await supabase.from("track17_api_logs").insert({
      operation: "register",
      tracking_number: trackingNumber || null,
      provider_response_code: error instanceof Track17RequestError ? error.providerCode : null,
      error_code: message.split(":")[0],
      error_message: message.slice(0, 500),
      duration_ms: Date.now() - started,
    });

    return jsonResponse(req, {
      ok: false,
      code: message.split(":")[0],
      message_ar: "تعذر تسجيل شحنة أرامكس للتتبع.",
      message_en: "Unable to register the Aramex shipment for tracking.",
    }, status);
  }
});
