import { requireAdmin } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorMessage, jsonResponse, readJson } from "../_shared/http.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

type MerchantRow = {
  id: string;
  merchant_code?: string | null;
  trade_name?: string | null;
  owner_name?: string | null;
  phone?: string | null;
  status?: string | null;
  whatsapp_broadcast_enabled?: boolean | null;
  whatsapp_broadcast_language?: string | null;
};

type ProviderConfiguration = {
  accessToken: string;
  phoneNumberId: string;
  graphVersion: string;
  templateName: string;
  languageAr: string;
  languageEn: string;
  configured: boolean;
  missing: string[];
};

type RecipientResult = {
  merchant_id: string;
  merchant_name: string;
  status: "sent" | "failed" | "skipped";
  code?: string | null;
};

const TEMPLATE_KEY = "merchant_orders_today";
const EXCLUDED_STATUSES = new Set([
  "deleted",
  "archived",
  "blocked",
  "suspended",
  "inactive",
  "rejected",
  "closed",
]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function configuration(): ProviderConfiguration {
  const accessToken = clean(Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN"));
  const phoneNumberId = clean(Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"));
  const graphVersion = clean(Deno.env.get("WHATSAPP_GRAPH_VERSION"));
  const templateName =
    clean(Deno.env.get("WHATSAPP_MERCHANT_MORNING_TEMPLATE")) ||
    "day_night_merchant_orders_today";
  const languageAr =
    clean(Deno.env.get("WHATSAPP_MERCHANT_MORNING_LANGUAGE_AR")) || "ar";
  const languageEn =
    clean(Deno.env.get("WHATSAPP_MERCHANT_MORNING_LANGUAGE_EN")) || "en_US";
  const missing = [
    !accessToken ? "WHATSAPP_CLOUD_ACCESS_TOKEN" : "",
    !phoneNumberId ? "WHATSAPP_PHONE_NUMBER_ID" : "",
    !graphVersion ? "WHATSAPP_GRAPH_VERSION" : "",
  ].filter(Boolean);

  return {
    accessToken,
    phoneNumberId,
    graphVersion,
    templateName,
    languageAr,
    languageEn,
    configured: missing.length === 0,
    missing,
  };
}

function normalizeLocale(value: unknown): "ar" | "en" {
  return clean(value).toLowerCase().startsWith("en") ? "en" : "ar";
}

function normalizePhone(value: unknown) {
  let digits = clean(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `971${digits}`;
  if (!/^\d{8,15}$/.test(digits)) return "";
  return digits;
}

function merchantName(merchant: MerchantRow) {
  return (
    clean(merchant.trade_name) ||
    clean(merchant.owner_name) ||
    clean(merchant.merchant_code) ||
    merchant.id
  );
}

function merchantStatus(merchant: MerchantRow) {
  return clean(merchant.status || "active").toLowerCase().replace(/[\s-]+/g, "_");
}

async function loadAudience(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  requestedIds: string[],
) {
  const { data, error } = await supabase
    .from("merchants")
    .select(
      "id,merchant_code,trade_name,owner_name,phone,status,whatsapp_broadcast_enabled,whatsapp_broadcast_language",
    )
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`merchant_audience_failed:${error.message}`);

  const requested = new Set(requestedIds.filter(Boolean));
  const selected = (data || []).filter((row: MerchantRow) =>
    requested.size ? requested.has(row.id) : true,
  );
  const eligible: Array<MerchantRow & { normalized_phone: string }> = [];
  let missingPhone = 0;
  let excluded = 0;

  for (const merchant of selected as MerchantRow[]) {
    if (
      merchant.whatsapp_broadcast_enabled === false ||
      EXCLUDED_STATUSES.has(merchantStatus(merchant))
    ) {
      excluded += 1;
      continue;
    }
    const normalizedPhone = normalizePhone(merchant.phone);
    if (!normalizedPhone) {
      missingPhone += 1;
      continue;
    }
    eligible.push({ ...merchant, normalized_phone: normalizedPhone });
  }

  return {
    total: selected.length,
    eligible,
    missingPhone,
    excluded,
  };
}

async function sentTodayMerchantIds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  merchantIds: string[],
) {
  if (!merchantIds.length) return new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const { data: campaigns, error: campaignError } = await supabase
    .from("merchant_broadcast_campaigns")
    .select("id")
    .eq("campaign_date", today)
    .eq("template_key", TEMPLATE_KEY);
  if (campaignError) throw new Error(`broadcast_campaign_lookup_failed:${campaignError.message}`);
  const campaignIds = (campaigns || []).map((campaign: { id: string }) => campaign.id);
  if (!campaignIds.length) return new Set<string>();

  const { data: recipients, error: recipientError } = await supabase
    .from("merchant_broadcast_recipients")
    .select("merchant_id")
    .in("campaign_id", campaignIds)
    .in("merchant_id", merchantIds)
    .eq("status", "sent");
  if (recipientError) throw new Error(`broadcast_recipient_lookup_failed:${recipientError.message}`);
  return new Set(
    (recipients || [])
      .map((recipient: { merchant_id?: string | null }) => clean(recipient.merchant_id))
      .filter(Boolean),
  );
}

function providerError(payload: Record<string, unknown>) {
  const error = (payload.error || {}) as Record<string, unknown>;
  const code = clean(error.code || error.error_subcode || "whatsapp_provider_failed");
  const message = clean(error.message || "WhatsApp provider rejected the message").slice(0, 500);
  return { code, message };
}

async function sendTemplateMessage(
  config: ProviderConfiguration,
  merchant: MerchantRow & { normalized_phone: string },
  locale: "ar" | "en",
) {
  const endpoint = `https://graph.facebook.com/${encodeURIComponent(config.graphVersion)}/${encodeURIComponent(config.phoneNumberId)}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: merchant.normalized_phone,
      type: "template",
      template: {
        name: config.templateName,
        language: {
          code: locale === "ar" ? config.languageAr : config.languageEn,
        },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: merchantName(merchant).slice(0, 120) }],
          },
        ],
      },
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const failure = providerError(payload);
    const wrapped = new Error(`${failure.code}:${failure.message}`) as Error & {
      providerCode?: string;
      providerPayload?: Record<string, unknown>;
    };
    wrapped.providerCode = failure.code;
    wrapped.providerPayload = payload;
    throw wrapped;
  }
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const first = (messages[0] || {}) as Record<string, unknown>;
  const messageId = clean(first.id);
  if (!messageId) throw new Error("whatsapp_provider_returned_no_message_id");
  return { messageId, payload };
}

async function updateRecipient(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  campaignId: string,
  merchantId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("merchant_broadcast_recipients")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("campaign_id", campaignId)
    .eq("merchant_id", merchantId);
  if (error) throw new Error(`broadcast_recipient_update_failed:${error.message}`);
}

async function processMerchant(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  config: ProviderConfiguration,
  campaignId: string,
  merchant: MerchantRow & { normalized_phone: string },
  locale: "ar" | "en",
): Promise<RecipientResult> {
  const name = merchantName(merchant);
  try {
    await updateRecipient(supabase, campaignId, merchant.id, { status: "sending" });
    const provider = await sendTemplateMessage(config, merchant, locale);
    await updateRecipient(supabase, campaignId, merchant.id, {
      status: "sent",
      provider_message_id: provider.messageId,
      provider_response: provider.payload,
      provider_error_code: null,
      provider_error_message: null,
      sent_at: new Date().toISOString(),
    });
    return { merchant_id: merchant.id, merchant_name: name, status: "sent", code: null };
  } catch (cause) {
    const error = cause as Error & {
      providerCode?: string;
      providerPayload?: Record<string, unknown>;
    };
    const code = clean(error.providerCode || error.message.split(":")[0] || "send_failed");
    const message = clean(error.message).slice(0, 500);
    await updateRecipient(supabase, campaignId, merchant.id, {
      status: "failed",
      provider_error_code: code,
      provider_error_message: message,
      provider_response: error.providerPayload || {},
    });
    return { merchant_id: merchant.id, merchant_name: name, status: "failed", code };
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
) {
  const results: R[] = [];
  for (let index = 0; index < values.length; index += concurrency) {
    const batch = values.slice(index, index + concurrency);
    results.push(...(await Promise.all(batch.map(task))));
  }
  return results;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, code: "method_not_allowed" }, 405);
  }

  const supabase = getSupabaseAdmin();
  let campaignId = "";

  try {
    const actor = await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const action = clean(body.action || "preview").toLowerCase();
    const locale = normalizeLocale(body.locale);
    const requestedIds = Array.isArray(body.merchant_ids)
      ? body.merchant_ids.map(clean).filter(Boolean).slice(0, 1000)
      : [];
    const config = configuration();
    const audience = await loadAudience(supabase, requestedIds);
    const merchantIds = audience.eligible.map((merchant) => merchant.id);
    const alreadySent = await sentTodayMerchantIds(supabase, merchantIds);

    if (action === "preview" || action === "health") {
      return jsonResponse(req, {
        ok: true,
        function_ready: true,
        cloud_configured: config.configured,
        missing_configuration: config.missing,
        provider_template_name: config.templateName,
        eligible_merchants: audience.eligible.length,
        missing_phone: audience.missingPhone,
        excluded_merchants: audience.excluded,
        already_sent_today: alreadySent.size,
      });
    }

    if (action !== "send") throw new Error("unsupported_broadcast_action");
    if (!config.configured) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: "whatsapp_cloud_not_configured",
          missing_configuration: config.missing,
          message_ar: "يلزم ربط بيانات WhatsApp Business الرسمية قبل الإرسال التلقائي.",
          message_en: "Official WhatsApp Business configuration is required before automatic sending.",
        },
        503,
      );
    }
    if (!audience.eligible.length) throw new Error("no_eligible_merchants");

    const force = Boolean(body.force);
    const toSend = audience.eligible.filter((merchant) => force || !alreadySent.has(merchant.id));
    const skipped = audience.eligible.filter((merchant) => !force && alreadySent.has(merchant.id));
    const today = new Date().toISOString().slice(0, 10);

    const { data: campaign, error: campaignError } = await supabase
      .from("merchant_broadcast_campaigns")
      .insert({
        campaign_date: today,
        template_key: TEMPLATE_KEY,
        provider_template_name: config.templateName,
        locale,
        status: "preparing",
        requested_count: audience.eligible.length,
        skipped_count: skipped.length,
        force_resend: force,
        created_by: actor.id,
        metadata: {
          requested_ids: requestedIds.length,
          missing_phone: audience.missingPhone,
          excluded: audience.excluded,
          source: "admin_message_control_center",
        },
      })
      .select("id")
      .single();
    if (campaignError || !campaign?.id) {
      throw new Error(`broadcast_campaign_create_failed:${campaignError?.message || "no_id"}`);
    }
    campaignId = campaign.id;

    const queuedRows = [
      ...toSend.map((merchant) => ({
        campaign_id: campaignId,
        merchant_id: merchant.id,
        merchant_name: merchantName(merchant),
        recipient_phone: merchant.normalized_phone,
        locale,
        status: "queued",
      })),
      ...skipped.map((merchant) => ({
        campaign_id: campaignId,
        merchant_id: merchant.id,
        merchant_name: merchantName(merchant),
        recipient_phone: merchant.normalized_phone,
        locale,
        status: "skipped",
        provider_error_code: "already_sent_today",
        provider_error_message: "Daily duplicate protection",
      })),
    ];
    const { error: queueError } = await supabase
      .from("merchant_broadcast_recipients")
      .insert(queuedRows);
    if (queueError) throw new Error(`broadcast_queue_create_failed:${queueError.message}`);

    await supabase
      .from("merchant_broadcast_campaigns")
      .update({ status: "sending" })
      .eq("id", campaignId);

    const processed = await mapWithConcurrency(toSend, 4, (merchant) =>
      processMerchant(supabase, config, campaignId, merchant, locale),
    );
    const skippedResults: RecipientResult[] = skipped.map((merchant) => ({
      merchant_id: merchant.id,
      merchant_name: merchantName(merchant),
      status: "skipped",
      code: "already_sent_today",
    }));
    const recipients = [...processed, ...skippedResults];
    const sentCount = recipients.filter((item) => item.status === "sent").length;
    const failedCount = recipients.filter((item) => item.status === "failed").length;
    const skippedCount = recipients.filter((item) => item.status === "skipped").length;
    const status = failedCount === 0
      ? "completed"
      : sentCount > 0 || skippedCount > 0
      ? "partial"
      : "failed";

    const { error: completeError } = await supabase
      .from("merchant_broadcast_campaigns")
      .update({
        status,
        sent_count: sentCount,
        failed_count: failedCount,
        skipped_count: skippedCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
    if (completeError) throw new Error(`broadcast_campaign_finalize_failed:${completeError.message}`);

    return jsonResponse(req, {
      ok: failedCount === 0,
      campaign_id: campaignId,
      total: audience.eligible.length,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      recipients,
    }, failedCount === 0 ? 200 : 207);
  } catch (cause) {
    const message = errorMessage(cause);
    if (campaignId) {
      await supabase
        .from("merchant_broadcast_campaigns")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", campaignId);
    }
    const code = message.split(":")[0] || "merchant_broadcast_failed";
    const status = code === "not_authenticated"
      ? 401
      : code === "not_authorized"
      ? 403
      : /required|unsupported|no_eligible/.test(code)
      ? 400
      : 500;
    return jsonResponse(req, {
      ok: false,
      code,
      message_ar: "تعذر تنفيذ حملة رسائل التجار.",
      message_en: "Unable to complete the merchant messaging campaign.",
    }, status);
  }
});
