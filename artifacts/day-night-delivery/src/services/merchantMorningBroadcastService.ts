import { getMerchantPortalUrl } from "../config/companyContact";
import { supabase } from "../supabase";
import {
  formatProfessionalMessage,
  readMessagePresentationSettings,
  sanitizeWhatsAppPhone,
} from "./whatsappMessageCore.mjs";

export type MerchantMorningRecipient = {
  id: string;
  merchant_code?: string | null;
  trade_name?: string | null;
  owner_name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  created_at?: string | null;
  whatsapp_broadcast_enabled?: boolean | null;
  whatsapp_broadcast_language?: "ar" | "en" | string | null;
  normalizedPhone: string;
};

export type MerchantMorningAudience = {
  all: MerchantMorningRecipient[];
  eligible: MerchantMorningRecipient[];
  missingPhone: MerchantMorningRecipient[];
  excluded: MerchantMorningRecipient[];
};

export type MerchantMorningBroadcastHealth = {
  ok: boolean;
  cloud_configured: boolean;
  missing_configuration?: string[];
  eligible_merchants?: number;
  already_sent_today?: number;
  function_ready?: boolean;
};

export type MerchantMorningBroadcastResult = {
  ok: boolean;
  campaign_id?: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  recipients?: Array<{
    merchant_id: string;
    merchant_name: string;
    status: string;
    code?: string | null;
  }>;
};

export type MerchantMorningBroadcastHistory = {
  id: string;
  campaign_date: string;
  template_key: string;
  locale: string;
  status: string;
  requested_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  completed_at?: string | null;
};

const BLOCKED_STATUSES = new Set([
  "deleted",
  "archived",
  "blocked",
  "suspended",
  "inactive",
  "rejected",
  "closed",
]);

function requireSupabase() {
  if (!supabase) throw new Error("supabase_not_configured");
  return supabase;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedStatus(value: unknown) {
  return clean(value || "active").toLowerCase().replace(/[\s-]+/g, "_");
}

function asRecipient(row: Record<string, unknown>): MerchantMorningRecipient {
  return {
    ...(row as Omit<MerchantMorningRecipient, "normalizedPhone">),
    id: clean(row.id),
    normalizedPhone: sanitizeWhatsAppPhone(row.phone),
  };
}

function classify(rows: Record<string, unknown>[]): MerchantMorningAudience {
  const all = rows
    .map(asRecipient)
    .filter((merchant) => merchant.id)
    .sort((left, right) =>
      clean(left.trade_name || left.owner_name).localeCompare(
        clean(right.trade_name || right.owner_name),
        "ar",
      ),
    );

  const excluded = all.filter(
    (merchant) =>
      merchant.whatsapp_broadcast_enabled === false ||
      BLOCKED_STATUSES.has(normalizedStatus(merchant.status)),
  );
  const candidates = all.filter((merchant) => !excluded.includes(merchant));
  const missingPhone = candidates.filter((merchant) => !merchant.normalizedPhone);
  const eligible = candidates.filter((merchant) => Boolean(merchant.normalizedPhone));

  return { all, eligible, missingPhone, excluded };
}

export async function loadMerchantMorningAudience(): Promise<MerchantMorningAudience> {
  const client = requireSupabase();
  const preferredColumns =
    "id,merchant_code,trade_name,owner_name,phone,email,status,created_at,whatsapp_broadcast_enabled,whatsapp_broadcast_language";
  let result = await client
    .from("merchants")
    .select(preferredColumns)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (result.error) {
    const detail = clean(result.error.message).toLowerCase();
    const compatibilityError =
      detail.includes("whatsapp_broadcast_enabled") ||
      detail.includes("whatsapp_broadcast_language") ||
      detail.includes("schema cache");
    if (!compatibilityError) throw result.error;

    result = await client
      .from("merchants")
      .select("id,merchant_code,trade_name,owner_name,phone,email,status,created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
  }

  if (result.error) throw result.error;
  return classify((result.data || []) as Record<string, unknown>[]);
}

export function subscribeMerchantMorningAudience(onChange: () => void) {
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel(`merchant-morning-audience-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "merchants" },
      () => onChange(),
    )
    .subscribe();

  return () => {
    if (supabase) void supabase.removeChannel(channel);
  };
}

export function merchantMorningPreview(
  merchant: MerchantMorningRecipient | null,
  locale: "ar" | "en",
) {
  const merchantName = clean(merchant?.trade_name || merchant?.owner_name) ||
    (locale === "ar" ? "شريكنا الكريم" : "valued partner");
  const portalUrl = getMerchantPortalUrl();
  const message =
    locale === "ar"
      ? `السلام عليكم ورحمة الله وبركاته يا ${merchantName} 👋\n\nصباح الخير من فريق داي نايت لخدمات التوصيل والشحن 💙\n\nنحن جاهزون اليوم لاستلام وتوصيل طلباتكم بكل سرعة واهتمام. هل لديكم طلبيات جاهزة للاستلام اليوم؟ 📦🚚\n\nيمكنكم تسجيل الطلبات مباشرة من لوحة التاجر:\n🏪 ${portalUrl}\n\nأو الرد على هذه الرسالة بكلمة «نعم»، وسيتواصل معكم فريق العمليات فورًا لترتيب الاستلام.\n\nعند إرسال الطلب يرجى توضيح اسم العميل، رقم الهاتف، عنوان التوصيل، المبلغ المطلوب تحصيله، وأي ملاحظات خاصة.\n\nنتمنى لكم يومًا موفقًا ومبيعات مباركة.\nداي نايت لخدمات التوصيل والشحن\nسريع • آمن • موثوق`
      : `Good morning ${merchantName} 👋\n\nDAY NIGHT DELIVERY SERVICES is ready to collect and deliver your orders today with speed and care. Do you have shipments ready for pickup? 📦🚚\n\nCreate orders in the merchant portal:\n🏪 ${portalUrl}\n\nOr reply “Yes” and our operations team will contact you to arrange pickup. Please include the customer name, phone, delivery address, collection amount, and any special notes.\n\nWishing you a successful day.\nDAY NIGHT DELIVERY SERVICES\nFast • Reliable • Every Time`;

  return formatProfessionalMessage(message, readMessagePresentationSettings());
}

async function functionRequest<T>(body: Record<string, unknown>): Promise<T> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke("merchant-morning-broadcast", { body });
  if (!error && data) return data as T;

  let code = "merchant_broadcast_request_failed";
  let details: Record<string, unknown> | null = null;
  try {
    const response = (error as { context?: Response } | null)?.context;
    if (response && typeof response.clone === "function") {
      details = (await response.clone().json()) as Record<string, unknown>;
      code = clean(details?.code) || code;
    }
  } catch {
    // Keep the stable public error code below.
  }
  const wrapped = new Error(code) as Error & { code?: string; details?: Record<string, unknown> | null };
  wrapped.code = code;
  wrapped.details = details;
  throw wrapped;
}

export async function loadMerchantMorningBroadcastHealth(
  locale: "ar" | "en",
): Promise<MerchantMorningBroadcastHealth> {
  try {
    return await functionRequest<MerchantMorningBroadcastHealth>({
      action: "preview",
      locale,
    });
  } catch (error) {
    const code = clean((error as Error & { code?: string })?.code || (error as Error)?.message);
    return {
      ok: false,
      function_ready: false,
      cloud_configured: false,
      missing_configuration: code ? [code] : ["merchant_broadcast_function_unavailable"],
    };
  }
}

export async function sendMerchantMorningBroadcast(input: {
  locale: "ar" | "en";
  merchantIds: string[];
  force?: boolean;
}): Promise<MerchantMorningBroadcastResult> {
  return functionRequest<MerchantMorningBroadcastResult>({
    action: "send",
    locale: input.locale,
    merchant_ids: input.merchantIds,
    force: Boolean(input.force),
  });
}

export async function loadMerchantMorningBroadcastHistory(): Promise<
  MerchantMorningBroadcastHistory[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("merchant_broadcast_campaigns")
    .select(
      "id,campaign_date,template_key,locale,status,requested_count,sent_count,failed_count,skipped_count,created_at,completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) {
    const detail = clean(error.message).toLowerCase();
    if (detail.includes("does not exist") || detail.includes("schema cache")) return [];
    throw error;
  }
  return (data || []) as MerchantMorningBroadcastHistory[];
}

export async function setMerchantMorningBroadcastEnabled(
  merchantId: string,
  enabled: boolean,
) {
  const client = requireSupabase();
  const { error } = await client
    .from("merchants")
    .update({ whatsapp_broadcast_enabled: enabled })
    .eq("id", merchantId);
  if (error) throw error;
}
