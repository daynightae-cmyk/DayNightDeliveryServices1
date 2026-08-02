import { supabase } from "../supabase";

export type MerchantStatementDispatchStatus = {
  orderId: string;
  latestSentAt: string;
  sentCount: number;
  latestBatchId: string;
  latestSentBy?: string | null;
  lastResendReason?: string | null;
  latestChannel?: string | null;
};

export type ConfirmMerchantStatementDispatchInput = {
  merchantId: string;
  orderIds: string[];
  periodLabel: string;
  resendReason?: string;
  metadata?: Record<string, unknown>;
};

export type ConfirmMerchantStatementDispatchResult = {
  ok: boolean;
  dryRun: boolean;
  batchId: string;
  merchantId: string;
  orderCount: number;
  previouslySentCount: number;
  resend: boolean;
  sentAt: string;
  channel: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rpcErrorMessage(error: unknown) {
  const candidate = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };
  return [candidate?.message, candidate?.details, candidate?.hint, candidate?.code]
    .map(clean)
    .filter(Boolean)
    .join(" | ");
}

export function merchantStatementDispatchErrorCode(error: unknown) {
  const message = rpcErrorMessage(error).toLowerCase();
  if (message.includes("merchant_statement_resend_reason_required")) return "resend_reason_required";
  if (message.includes("merchant_statement_dispatch_order_ownership_mismatch")) return "ownership_mismatch";
  if (message.includes("merchant_statement_dispatch_not_authorized")) return "not_authorized";
  if (message.includes("merchant_statement_dispatch_merchant_not_found")) return "merchant_not_found";
  if (message.includes("merchant_statement_dispatch_orders_required")) return "orders_required";
  if (message.includes("could not find the function") || message.includes("schema cache")) return "runtime_missing";
  return "unknown";
}

export async function fetchMerchantStatementDispatchStatus(
  merchantId: string,
): Promise<MerchantStatementDispatchStatus[]> {
  if (!supabase) throw new Error("merchant_statement_dispatch_supabase_not_configured");
  const normalizedMerchantId = clean(merchantId);
  if (!normalizedMerchantId) throw new Error("merchant_statement_dispatch_merchant_required");

  const { data, error } = await supabase.rpc("admin_get_merchant_statement_dispatch_status", {
    p_merchant_id: normalizedMerchantId,
  });

  if (error) throw new Error(rpcErrorMessage(error) || "merchant_statement_dispatch_status_failed");

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows
    .map((row) => {
      const source = row as Record<string, unknown>;
      return {
        orderId: clean(source.order_id),
        latestSentAt: clean(source.latest_sent_at),
        sentCount: numeric(source.sent_count),
        latestBatchId: clean(source.latest_batch_id),
        latestSentBy: clean(source.latest_sent_by) || null,
        lastResendReason: clean(source.last_resend_reason) || null,
        latestChannel: clean(source.latest_channel) || null,
      } satisfies MerchantStatementDispatchStatus;
    })
    .filter((row) => row.orderId && row.latestSentAt);
}

export async function confirmMerchantStatementDispatch(
  input: ConfirmMerchantStatementDispatchInput,
): Promise<ConfirmMerchantStatementDispatchResult> {
  if (!supabase) throw new Error("merchant_statement_dispatch_supabase_not_configured");

  const merchantId = clean(input.merchantId);
  const orderIds = [...new Set(input.orderIds.map(clean).filter(Boolean))];
  if (!merchantId) throw new Error("merchant_statement_dispatch_merchant_required");
  if (!orderIds.length) throw new Error("merchant_statement_dispatch_orders_required");

  const { data, error } = await supabase.rpc("admin_confirm_merchant_statement_dispatch", {
    p_merchant_id: merchantId,
    p_order_ids: orderIds,
    p_period_label: clean(input.periodLabel) || null,
    p_channel: "pdf_only",
    p_resend_reason: clean(input.resendReason) || null,
    p_metadata: {
      source: "admin_merchant_statements_center",
      status_trigger: "successful_pdf_export",
      pdf_generation_succeeded: true,
      whatsapp_changes_status: false,
      ...input.metadata,
    },
    p_dry_run: false,
  });

  if (error) throw new Error(rpcErrorMessage(error) || "merchant_statement_dispatch_confirm_failed");

  const source = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!source || source.ok !== true) throw new Error("merchant_statement_dispatch_confirmation_unverified");

  return {
    ok: true,
    dryRun: Boolean(source.dry_run),
    batchId: clean(source.batch_id),
    merchantId: clean(source.merchant_id),
    orderCount: numeric(source.order_count),
    previouslySentCount: numeric(source.previously_sent_count),
    resend: Boolean(source.resend),
    sentAt: clean(source.sent_at),
    channel: clean(source.channel),
  };
}
