import { handleCors } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { errorMessage, jsonResponse, readJson } from "../_shared/http.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { ARAMEX_CARRIER_CODE } from "../_shared/track17-config.ts";
import { acceptedRows, rejectedRows, track17Request, Track17RequestError } from "../_shared/track17-client.ts";

async function shipmentById(supabase: ReturnType<typeof getSupabaseAdmin>, shipmentId: string) {
  const { data, error } = await supabase
    .from("international_shipments")
    .select("*")
    .eq("id", shipmentId)
    .maybeSingle();
  if (error) throw new Error(`shipment_lookup_failed:${error.message}`);
  if (!data) throw new Error("shipment_not_found");
  return data;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse(req, { ok: false, code: "method_not_allowed" }, 405);

  const supabase = getSupabaseAdmin();
  const started = Date.now();
  let operation = "unknown";
  let trackingNumber = "";
  let shipmentId: string | null = null;

  try {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    operation = String(body.action || "list").trim().toLowerCase();

    if (operation === "list") {
      const limit = Math.max(1, Math.min(100, Number(body.limit || 50)));
      const { data: shipments, error } = await supabase
        .from("international_shipments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`shipment_list_failed:${error.message}`);

      const { data: webhookLogs } = await supabase
        .from("track17_webhook_logs")
        .select("id, event_type, tracking_number, signature_valid, processing_status, http_result, error_code, received_at, processed_at")
        .order("received_at", { ascending: false })
        .limit(20);

      const { data: quota } = await supabase
        .from("track17_quota_cache")
        .select("*")
        .eq("id", true)
        .maybeSingle();

      return jsonResponse(req, {
        ok: true,
        shipments: shipments || [],
        webhook_logs: webhookLogs || [],
        quota: quota || null,
      });
    }

    if (operation === "details") {
      shipmentId = String(body.shipment_id || "").trim();
      const shipment = await shipmentById(supabase, shipmentId);
      const { data: events, error } = await supabase
        .from("international_tracking_events")
        .select("id, provider_status, provider_sub_status, normalized_status, description, description_ar, location, city, state, country, postal_code, longitude, latitude, event_time")
        .eq("shipment_id", shipment.id)
        .order("event_time", { ascending: false });
      if (error) throw new Error(`events_lookup_failed:${error.message}`);
      return jsonResponse(req, { ok: true, shipment, events: events || [] });
    }

    if (operation === "quota") {
      const cached = await supabase.from("track17_quota_cache").select("*").eq("id", true).maybeSingle();
      const checkedAt = cached.data?.checked_at ? Date.parse(cached.data.checked_at) : 0;
      if (checkedAt && Date.now() - checkedAt < 15 * 60 * 1000 && !body.force) {
        return jsonResponse(req, { ok: true, cached: true, quota: cached.data });
      }

      const result = await track17Request("getquota", []);
      const payload: any = result.payload;
      const data = payload.data || {};
      const quotaRow = {
        id: true,
        quota_total: Number(data.quota_total ?? data.quota ?? data.total ?? 0) || null,
        quota_used: Number(data.quota_used ?? data.used ?? 0) || null,
        quota_remain: Number(data.quota_remain ?? data.remain ?? data.remaining ?? 0) || null,
        today_used: Number(data.today_used ?? data.consumed_today ?? 0) || null,
        max_track_daily: Number(data.max_track_daily ?? data.daily_limit ?? 0) || null,
        payload: data,
        checked_at: new Date().toISOString(),
      };
      const { data: savedQuota, error: quotaError } = await supabase
        .from("track17_quota_cache")
        .upsert(quotaRow, { onConflict: "id" })
        .select("*")
        .single();
      if (quotaError) throw new Error(`quota_cache_failed:${quotaError.message}`);

      await supabase.from("track17_api_logs").insert({
        operation: "getquota",
        provider_response_code: Number(result.payload.code || 0),
        duration_ms: result.durationMs,
      });
      return jsonResponse(req, { ok: true, cached: false, quota: savedQuota });
    }

    if (["stop", "retrack", "push"].includes(operation)) {
      shipmentId = String(body.shipment_id || "").trim();
      const shipment = await shipmentById(supabase, shipmentId);
      trackingNumber = shipment.tracking_number;
      const apiOperation = operation === "stop" ? "stoptrack" : operation;
      const result = await track17Request(apiOperation, [{
        number: trackingNumber,
        carrier: ARAMEX_CARRIER_CODE,
      }]);
      const accepted = acceptedRows(result.payload);
      const rejected = rejectedRows(result.payload);
      if (!accepted.length) {
        const rejection: any = rejected[0];
        throw new Error(`track17_${apiOperation}_rejected:${rejection?.error?.code || "unknown"}:${rejection?.error?.message || "rejected"}`);
      }

      const update: Record<string, unknown> = {};
      if (operation === "stop") update.tracking_stopped_at = new Date().toISOString();
      if (operation === "retrack") update.tracking_stopped_at = null;
      if (Object.keys(update).length) {
        const { error } = await supabase.from("international_shipments").update(update).eq("id", shipment.id);
        if (error) throw new Error(`shipment_update_failed:${error.message}`);
      }

      await supabase.from("track17_api_logs").insert({
        operation: apiOperation,
        shipment_id: shipment.id,
        tracking_number: trackingNumber,
        provider_response_code: Number(result.payload.code || 0),
        accepted: accepted.length,
        rejected: rejected.length,
        duration_ms: result.durationMs,
      });
      return jsonResponse(req, { ok: true, action: operation, shipment_id: shipment.id });
    }

    if (operation === "health") {
      const [{ count: shipmentCount }, { count: failedWebhookCount }, { data: latestWebhook }, { data: latestApi }] = await Promise.all([
        supabase.from("international_shipments").select("id", { count: "exact", head: true }),
        supabase.from("track17_webhook_logs").select("id", { count: "exact", head: true }).neq("http_result", 200),
        supabase.from("track17_webhook_logs").select("event_type, signature_valid, processing_status, http_result, received_at").order("received_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("track17_api_logs").select("operation, provider_response_code, error_code, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return jsonResponse(req, {
        ok: true,
        connected: true,
        shipment_count: shipmentCount || 0,
        webhook_failure_count: failedWebhookCount || 0,
        latest_webhook: latestWebhook || null,
        latest_api_call: latestApi || null,
      });
    }

    throw new Error("unsupported_admin_action");
  } catch (error) {
    const message = errorMessage(error);
    await supabase.from("track17_api_logs").insert({
      operation,
      shipment_id: shipmentId,
      tracking_number: trackingNumber || null,
      provider_response_code: error instanceof Track17RequestError ? error.providerCode : null,
      error_code: message.split(":")[0],
      error_message: message.slice(0, 500),
      duration_ms: Date.now() - started,
    });

    const status = message === "not_authenticated" ? 401
      : message === "not_authorized" ? 403
      : message.includes("not_found") ? 404
      : message.includes("unsupported") || message.includes("required") ? 400
      : error instanceof Track17RequestError ? error.httpStatus
      : 500;
    return jsonResponse(req, {
      ok: false,
      code: message.split(":")[0],
      message_ar: "تعذر تنفيذ عملية إدارة تتبع أرامكس.",
      message_en: "Unable to complete the Aramex tracking administration action.",
    }, status);
  }
});
