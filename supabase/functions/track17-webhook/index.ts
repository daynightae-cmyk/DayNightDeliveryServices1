import { jsonResponse } from "../_shared/http.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { ARAMEX_CARRIER_CODE, normalizeTrackingNumber } from "../_shared/track17-config.ts";
import { parseTrack17Row, track17Rows } from "../_shared/track17-parser.ts";
import { findShipmentByTracking, persistParsedShipment } from "../_shared/track17-persistence.ts";
import {
  signaturePreview,
  verifyTrack17Signature,
} from "../_shared/track17-signature.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, code: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseAdmin();
  const rawBody = await req.text();
  const receivedSignature = req.headers.get("sign");
  let logId: string | null = null;

  try {
    const signatureValid = await verifyTrack17Signature(rawBody, receivedSignature);
    let payload: Record<string, any> = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      const { data: invalidLog } = await supabase.from("track17_webhook_logs").insert({
        signature_preview: signaturePreview(receivedSignature),
        signature_valid: signatureValid,
        processing_status: "invalid_json",
        http_result: 400,
        error_code: "invalid_json_body",
        error_message: "Webhook body is not valid JSON",
      }).select("id").maybeSingle();
      logId = invalidLog?.id || null;
      return new Response(JSON.stringify({ ok: false, code: "invalid_json_body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const eventType = String(payload.event || "TRACKING_UPDATED").trim().toUpperCase();
    const rows = track17Rows(payload);
    const firstRow = rows[0] || (payload.data && typeof payload.data === "object" ? payload.data : {});
    const trackingNumber = normalizeTrackingNumber(firstRow?.number);
    const carrierCode = Number(firstRow?.carrier || 0) || null;

    const { data: createdLog, error: logError } = await supabase
      .from("track17_webhook_logs")
      .insert({
        event_type: eventType,
        tracking_number: trackingNumber || null,
        carrier_code: carrierCode,
        signature_preview: signaturePreview(receivedSignature),
        signature_valid: signatureValid,
        processing_status: signatureValid ? "received" : "invalid_signature",
        http_result: signatureValid ? null : 401,
        payload,
        error_code: signatureValid ? null : "invalid_signature",
      })
      .select("id")
      .maybeSingle();
    if (!logError) logId = createdLog?.id || null;

    if (!signatureValid) {
      return new Response(JSON.stringify({ ok: false, code: "invalid_signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!rows.length && !trackingNumber) {
      if (logId) {
        await supabase.from("track17_webhook_logs").update({
          processing_status: "test_acknowledged",
          http_result: 200,
          processed_at: new Date().toISOString(),
        }).eq("id", logId);
      }
      return new Response(JSON.stringify({ ok: true, test: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let ignored = 0;
    const errors: string[] = [];
    const processRows = rows.length ? rows : [firstRow];

    for (const row of processRows) {
      const number = normalizeTrackingNumber(row?.number);
      const carrier = Number(row?.carrier || 0);
      if (!number) {
        ignored += 1;
        continue;
      }
      if (carrier !== ARAMEX_CARRIER_CODE) {
        ignored += 1;
        errors.push(`non_aramex_carrier:${carrier}`);
        continue;
      }

      try {
        const shipment = await findShipmentByTracking(supabase, number, carrier);
        if (!shipment) {
          ignored += 1;
          errors.push(`shipment_not_found:${number}`);
          continue;
        }

        if (eventType === "TRACKING_STOPPED") {
          await supabase.from("international_shipments").update({
            tracking_stopped_at: new Date().toISOString(),
            last_webhook_at: new Date().toISOString(),
            latest_payload: row,
          }).eq("id", shipment.id);
          processed += 1;
          continue;
        }

        const parsed = await parseTrack17Row(row);
        await persistParsedShipment(supabase, shipment, parsed, { webhook: true });
        processed += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (logId) {
      await supabase.from("track17_webhook_logs").update({
        processing_status: errors.length ? (processed ? "processed_with_warnings" : "ignored") : "processed",
        http_result: 200,
        error_code: errors.length ? "processing_warning" : null,
        error_message: errors.length ? errors.join(" | ").slice(0, 1000) : null,
        processed_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    // 17TRACK retries any non-200 response. Unknown or already-removed shipments are
    // therefore acknowledged and recorded instead of causing a retry storm.
    return new Response(JSON.stringify({ ok: true, processed, ignored }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "webhook_failed");
    if (logId) {
      await supabase.from("track17_webhook_logs").update({
        processing_status: "failed",
        http_result: 500,
        error_code: message.split(":")[0],
        error_message: message.slice(0, 1000),
        processed_at: new Date().toISOString(),
      }).eq("id", logId);
    }
    return new Response(JSON.stringify({ ok: false, code: "webhook_processing_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
