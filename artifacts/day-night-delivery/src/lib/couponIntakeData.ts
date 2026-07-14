import { supabase } from "../supabase";
import type { CouponPhotoReview } from "../components/shared/CouponPhotoIntake";

export type CouponIntakeAuditResult = {
  id: string;
  imagePath: string;
  source: "rpc" | "db" | "metadata-only" | "unavailable";
  warning?: string;
};

type AdminCouponIntakeInput = {
  review: CouponPhotoReview;
  orderReference?: string;
  merchantId?: string;
};

type PublicCouponIntakeInput = {
  review: CouponPhotoReview;
  trackingNumber: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeError(error: unknown, fallback: string) {
  const detail = clean((error as { message?: string })?.message || error);
  if (detail) console.warn("Coupon intake database detail:", detail);
  return new Error(fallback);
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  return "jpg";
}

function fileToken() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeExtractedFields(review: CouponPhotoReview) {
  const fields = review.result.fields as Record<string, unknown>;
  const allowed = [
    "coupon_number",
    "receiver_name",
    "receiver_phone",
    "receiver_address",
    "delivery_city",
    "delivery_area",
    "delivery_street",
    "package_type",
    "package_description",
    "weight",
    "order_count",
    "payment_method",
    "cod_amount",
    "notes",
  ];
  return Object.fromEntries(
    allowed
      .map((key) => [key, fields[key]])
      .filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

async function uploadAdminCouponImage(file: File) {
  if (!supabase) throw safeError(null, "Supabase is not configured for coupon image storage.");
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw safeError(null, "Admin authentication is required before uploading coupon images.");

  const month = new Date().toISOString().slice(0, 7);
  const path = `${userId}/${month}/${fileToken()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from("coupon-images").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw safeError(error, "Coupon image storage is not ready. Apply the coupon photo intake migration.");
  return path;
}

export async function createAdminCouponIntakeSession({
  review,
  orderReference,
  merchantId,
}: AdminCouponIntakeInput): Promise<CouponIntakeAuditResult> {
  if (!supabase) return { id: "", imagePath: "", source: "unavailable", warning: "Supabase is not configured." };

  let imagePath = "";
  let storageWarning = "";
  if (review.file) {
    try {
      imagePath = await uploadAdminCouponImage(review.file);
    } catch (error) {
      storageWarning = clean((error as Error)?.message || error);
    }
  }

  const payload = {
    tracking_number: clean(orderReference),
    coupon_number: clean(review.result.fields.coupon_number),
    merchant_id: clean(merchantId) || null,
    image_path: imagePath || null,
    extraction_source: review.result.source,
    intake_source: review.source,
    extraction_confidence: clampConfidence(review.confidence),
    extracted_fields: safeExtractedFields(review),
    raw_text_preview: clean(review.result.rawText).slice(0, 2000),
    status: orderReference ? "order_created" : "reviewed",
    reviewed_at: new Date().toISOString(),
  };

  const rpc = await supabase.rpc("admin_create_coupon_intake_session", { p_payload: payload });
  if (!rpc.error && rpc.data) {
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    return {
      id: clean((row as { id?: unknown })?.id),
      imagePath,
      source: "rpc",
      warning: storageWarning || undefined,
    };
  }

  const { data, error } = await supabase.from("coupon_intake_sessions").insert(payload).select("id").single();
  if (error) {
    return {
      id: "",
      imagePath,
      source: imagePath ? "metadata-only" : "unavailable",
      warning: storageWarning || "Coupon audit metadata could not be saved. Apply the coupon photo intake migration.",
    };
  }

  return {
    id: clean((data as { id?: unknown })?.id),
    imagePath,
    source: "db",
    warning: storageWarning || undefined,
  };
}

export async function createPublicCouponIntakeAudit({
  review,
  trackingNumber,
}: PublicCouponIntakeInput): Promise<CouponIntakeAuditResult> {
  if (!supabase) return { id: "", imagePath: "", source: "unavailable", warning: "Supabase is not configured." };

  const payload = {
    tracking_number: clean(trackingNumber),
    coupon_number: clean(review.result.fields.coupon_number),
    extraction_source: review.result.source,
    intake_source: review.source,
    extraction_confidence: clampConfidence(review.confidence),
    extracted_fields: safeExtractedFields(review),
    raw_text_preview: clean(review.result.rawText).slice(0, 1200),
    status: "order_created",
  };

  const { data, error } = await supabase.rpc("public_create_coupon_intake_session", { p_payload: payload });
  if (error || !data) {
    return {
      id: "",
      imagePath: "",
      source: "metadata-only",
      warning: "Public coupon audit RPC is not installed. The order was still created safely.",
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { id: clean((row as { id?: unknown })?.id), imagePath: "", source: "rpc" };
}
