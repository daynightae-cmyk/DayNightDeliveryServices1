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

type DispatchSourceRow = Record<string, unknown>;

const DIRECT_HISTORY_PAGE_SIZE = 1000;
const STATUS_RPC_TIMEOUT_MS = 12_000;
const STATUS_TABLE_TIMEOUT_MS = 15_000;
const CONFIRM_TIMEOUT_MS = 30_000;
const PROTECTED_HISTORY_ATTEMPTS = 2;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

/**
 * Abort the actual PostgREST request. Merely rejecting a wrapper promise leaves
 * the network request alive and can block a second protected request on mobile.
 */
function withAbortTimeout<T>(
  createOperation: (signal: AbortSignal) => PromiseLike<T>,
  label: string,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();

  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      controller.abort();
      reject(new Error(`${label}_timeout_${timeoutMs}ms`));
    }, timeoutMs);

    let operation: PromiseLike<T>;
    try {
      operation = createOperation(controller.signal);
    } catch (cause) {
      globalThis.clearTimeout(timer);
      reject(cause);
      return;
    }

    Promise.resolve(operation).then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        globalThis.clearTimeout(timer);
        reject(cause);
      },
    );
  });
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

function normalizeRpcStatusRows(data: unknown): MerchantStatementDispatchStatus[] {
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows
    .map((row) => {
      const source = row as DispatchSourceRow;
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

function normalizeDirectStatusRows(rows: DispatchSourceRow[]): MerchantStatementDispatchStatus[] {
  const counts = new Map<string, number>();
  const latest = new Map<string, MerchantStatementDispatchStatus>();

  for (const source of rows) {
    const orderId = clean(source.order_id);
    if (!orderId) continue;
    counts.set(orderId, (counts.get(orderId) || 0) + 1);

    if (!latest.has(orderId)) {
      latest.set(orderId, {
        orderId,
        latestSentAt: clean(source.sent_at),
        sentCount: 0,
        latestBatchId: clean(source.batch_id),
        latestSentBy: clean(source.sent_by) || null,
        lastResendReason: clean(source.resend_reason) || null,
        latestChannel: clean(source.channel) || null,
      });
    }
  }

  return [...latest.values()]
    .map((row) => ({ ...row, sentCount: counts.get(row.orderId) || 0 }))
    .filter((row) => row.latestSentAt);
}

async function fetchDispatchStatusDirectly(merchantId: string) {
  const client = supabase;
  if (!client) throw new Error("merchant_statement_dispatch_supabase_not_configured");

  const rows: DispatchSourceRow[] = [];
  for (let page = 0; page < 100; page += 1) {
    const from = page * DIRECT_HISTORY_PAGE_SIZE;
    const to = from + DIRECT_HISTORY_PAGE_SIZE - 1;
    const result = await withAbortTimeout(
      (signal) =>
        client
          .from("merchant_statement_dispatch_log")
          .select("order_id,sent_at,batch_id,sent_by,resend_reason,channel,created_at,id")
          .eq("merchant_id", merchantId)
          .order("sent_at", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to)
          .abortSignal(signal),
      `merchant_statement_dispatch_direct_page_${page + 1}`,
      STATUS_TABLE_TIMEOUT_MS,
    );

    if (result.error) {
      throw new Error(
        rpcErrorMessage(result.error) || "merchant_statement_dispatch_direct_status_failed",
      );
    }

    const pageRows = Array.isArray(result.data) ? (result.data as DispatchSourceRow[]) : [];
    rows.push(...pageRows);
    if (pageRows.length < DIRECT_HISTORY_PAGE_SIZE) break;
  }

  return normalizeDirectStatusRows(rows);
}

export function merchantStatementDispatchErrorCode(error: unknown) {
  const message = rpcErrorMessage(error).toLowerCase();
  if (message.includes("merchant_statement_resend_reason_required")) return "resend_reason_required";
  if (message.includes("merchant_statement_dispatch_order_ownership_mismatch")) return "ownership_mismatch";
  if (message.includes("merchant_statement_dispatch_not_authorized")) return "not_authorized";
  if (message.includes("permission denied") || message.includes("row-level security")) return "not_authorized";
  if (message.includes("jwt expired") || message.includes("invalid jwt") || message.includes("not authenticated")) return "not_authorized";
  if (message.includes("merchant_statement_dispatch_merchant_not_found")) return "merchant_not_found";
  if (message.includes("merchant_statement_dispatch_orders_required")) return "orders_required";
  if (message.includes("could not find the function") || message.includes("schema cache")) return "runtime_missing";
  return "unknown";
}

export async function fetchMerchantStatementDispatchStatus(
  merchantId: string,
): Promise<MerchantStatementDispatchStatus[]> {
  const client = supabase;
  if (!client) throw new Error("merchant_statement_dispatch_supabase_not_configured");
  const normalizedMerchantId = clean(merchantId);
  if (!normalizedMerchantId) throw new Error("merchant_statement_dispatch_merchant_required");

  // Do not call auth.getSession() here. This screen is already protected and
  // the same client has just loaded the merchant/order data. An extra auth-lock
  // preflight can stall on mobile while the protected PostgREST request itself
  // would succeed and enforce authorization at the database boundary.
  let rpcDetail = "merchant_statement_dispatch_status_failed";
  try {
    const result = await withAbortTimeout(
      (signal) =>
        client
          .rpc("admin_get_merchant_statement_dispatch_status", {
            p_merchant_id: normalizedMerchantId,
          })
          .abortSignal(signal),
      "merchant_statement_dispatch_status_rpc",
      STATUS_RPC_TIMEOUT_MS,
    );

    if (!result.error) return normalizeRpcStatusRows(result.data);
    rpcDetail = rpcErrorMessage(result.error) || rpcDetail;
  } catch (rpcFailure) {
    rpcDetail = rpcErrorMessage(rpcFailure) || clean(rpcFailure) || rpcDetail;
  }

  console.warn(
    "Merchant statement status RPC failed or timed out; retrying through the protected RLS table.",
    rpcDetail,
  );

  let fallbackDetail = "protected history read was not attempted";
  for (let attempt = 1; attempt <= PROTECTED_HISTORY_ATTEMPTS; attempt += 1) {
    try {
      if (attempt > 1) await wait(700);
      return await fetchDispatchStatusDirectly(normalizedMerchantId);
    } catch (fallbackError) {
      fallbackDetail = rpcErrorMessage(fallbackError) || clean(fallbackError);
      console.warn(
        `Merchant statement protected history attempt ${attempt} failed.`,
        fallbackDetail,
      );
    }
  }

  throw new Error(
    `merchant_statement_dispatch_status_failed | rpc: ${rpcDetail} | protected_table: ${fallbackDetail}`,
  );
}

export async function confirmMerchantStatementDispatch(
  input: ConfirmMerchantStatementDispatchInput,
): Promise<ConfirmMerchantStatementDispatchResult> {
  const client = supabase;
  if (!client) throw new Error("merchant_statement_dispatch_supabase_not_configured");

  const merchantId = clean(input.merchantId);
  const orderIds = [...new Set(input.orderIds.map(clean).filter(Boolean))];
  if (!merchantId) throw new Error("merchant_statement_dispatch_merchant_required");
  if (!orderIds.length) throw new Error("merchant_statement_dispatch_orders_required");

  // No client-side auth preflight and no write retry. The security-definer RPC
  // checks the current JWT and either commits the complete batch once or writes
  // nothing. Retrying an ambiguous write automatically could duplicate a batch.
  const result = await withAbortTimeout(
    (signal) =>
      client
        .rpc("admin_confirm_merchant_statement_dispatch", {
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
        })
        .abortSignal(signal),
    "merchant_statement_dispatch_confirm_rpc",
    CONFIRM_TIMEOUT_MS,
  );

  if (result.error) throw new Error(rpcErrorMessage(result.error) || "merchant_statement_dispatch_confirm_failed");

  const source = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown> | null;
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
