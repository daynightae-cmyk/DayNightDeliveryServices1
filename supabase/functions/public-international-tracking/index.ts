import { handleCors } from "../_shared/cors.ts";
import { errorMessage, jsonResponse, readJson } from "../_shared/http.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { normalizeTrackingNumber } from "../_shared/track17-config.ts";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

function clientKey(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimit(req: Request) {
  const key = clientKey(req);
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  attempts.set(key, current);
  return {
    allowed: current.count <= MAX_REQUESTS,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

function normalizeReference(value: unknown) {
  const input = String(value || "").trim();
  if (!input || input.length < 5 || input.length > 80) throw new Error("invalid_tracking_reference");
  if (!/^[A-Za-z0-9\-_.]+$/.test(input)) throw new Error("invalid_tracking_reference");
  return normalizeTrackingNumber(input);
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse(req, { ok: false, code: "method_not_allowed" }, 405);

  const limit = rateLimit(req);
  if (!limit.allowed) {
    return jsonResponse(req, {
      ok: false,
      code: "rate_limited",
      message_ar: "عدد محاولات التتبع كبير مؤقتًا. حاول بعد قليل.",
      message_en: "Too many tracking attempts. Please try again shortly.",
    }, 429, { "Retry-After": String(limit.retryAfter) });
  }

  try {
    const body = await readJson<Record<string, unknown>>(req);
    const reference = normalizeReference(body.tracking_number ?? body.reference ?? body.number);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("daynight_public_international_tracking", {
      p_reference: reference,
    });
    if (error) throw new Error(`tracking_rpc_failed:${error.message}`);

    if (!data?.ok) {
      return jsonResponse(req, {
        ok: false,
        code: "not_found",
        message_ar: "لم يتم العثور على شحنة دولية بهذا الرقم.",
        message_en: "No international shipment was found for this reference.",
      }, 404);
    }

    return jsonResponse(req, data, 200);
  } catch (error) {
    const message = errorMessage(error);
    const status = message.includes("invalid_tracking") || message === "invalid_json_body" ? 400 : 500;
    return jsonResponse(req, {
      ok: false,
      code: status === 400 ? "invalid_tracking_reference" : "tracking_unavailable",
      message_ar: status === 400 ? "أدخل رقم تتبع صحيحًا." : "تعذرت قراءة حالة الشحنة حاليًا.",
      message_en: status === 400 ? "Enter a valid tracking reference." : "Shipment tracking is temporarily unavailable.",
    }, status);
  }
});
