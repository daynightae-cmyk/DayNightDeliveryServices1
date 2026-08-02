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
type PersistedSessionCandidate = {
  access_token?: unknown;
  expires_at?: unknown;
  session?: unknown;
  currentSession?: unknown;
  data?: unknown;
};

const SUPABASE_URL = String((import.meta as any).env?.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const SUPABASE_ANON_KEY = String((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "").trim();
const DIRECT_HISTORY_PAGE_SIZE = 1000;
const READ_TIMEOUT_MS = 18_000;
const WRITE_TIMEOUT_MS = 30_000;
const SESSION_FALLBACK_TIMEOUT_MS = 8_000;

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

function decodeJwtExpiry(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload || typeof globalThis.atob !== "function") return 0;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(globalThis.atob(padded)) as { exp?: unknown };
    return numeric(parsed.exp);
  } catch {
    return 0;
  }
}

function extractSessionCandidate(value: unknown): { accessToken: string; expiresAt: number } | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as PersistedSessionCandidate;
  const accessToken = clean(candidate.access_token);
  if (accessToken) {
    return {
      accessToken,
      expiresAt: numeric(candidate.expires_at) || decodeJwtExpiry(accessToken),
    };
  }

  for (const nested of [candidate.session, candidate.currentSession, candidate.data]) {
    const extracted = extractSessionCandidate(nested);
    if (extracted) return extracted;
  }
  return null;
}

function readPersistedSession() {
  if (!SUPABASE_URL || typeof window === "undefined") return null;
  try {
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    if (!projectRef) return null;
    const raw = window.localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    return extractSessionCandidate(JSON.parse(raw));
  } catch {
    return null;
  }
}

function tokenIsUsable(session: { accessToken: string; expiresAt: number } | null) {
  if (!session?.accessToken) return false;
  if (!session.expiresAt) return true;
  return session.expiresAt * 1000 > Date.now() + 30_000;
}

function withPromiseTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new Error(`${label}_timeout_${timeoutMs}ms`)),
      timeoutMs,
    );
    Promise.resolve(promise).then(
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

async function resolveAccessToken() {
  const persisted = readPersistedSession();
  if (tokenIsUsable(persisted)) return persisted!.accessToken;
  if (!supabase) throw new Error("merchant_statement_dispatch_supabase_not_configured");

  const sessionResult = await withPromiseTimeout<{
    data: { session: { access_token?: string | null } | null };
    error: unknown;
  }>(
    supabase.auth.getSession(),
    "merchant_statement_dispatch_get_session",
    SESSION_FALLBACK_TIMEOUT_MS,
  );
  if (sessionResult.error) {
    throw new Error(rpcErrorMessage(sessionResult.error) || "merchant_statement_dispatch_session_failed");
  }

  const accessToken = clean(sessionResult.data.session?.access_token);
  if (!accessToken) throw new Error("merchant_statement_dispatch_not_authenticated");
  return accessToken;
}

async function protectedRestRequest(
  path: string,
  init: RequestInit,
  label: string,
  timeoutMs: number,
) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("merchant_statement_dispatch_supabase_not_configured");
  }

  const accessToken = await resolveAccessToken();
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const detail = rpcErrorMessage(payload) || clean(payload) || response.statusText;
      throw new Error(`${label}_http_${response.status}${detail ? ` | ${detail}` : ""}`);
    }
    return payload;
  } catch (cause) {
    if ((cause as { name?: string })?.name === "AbortError") {
      throw new Error(`${label}_timeout_${timeoutMs}ms`);
    }
    throw cause;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function fetchDispatchStatusDirectly(merchantId: string) {
  const rows: DispatchSourceRow[] = [];
  for (let page = 0; page < 100; page += 1) {
    const offset = page * DIRECT_HISTORY_PAGE_SIZE;
    const query = new URLSearchParams({
      select: "order_id,sent_at,batch_id,sent_by,resend_reason,channel,created_at,id",
      merchant_id: `eq.${merchantId}`,
      order: "sent_at.desc,created_at.desc",
      offset: String(offset),
      limit: String(DIRECT_HISTORY_PAGE_SIZE),
    });
    const payload = await protectedRestRequest(
      `merchant_statement_dispatch_log?${query.toString()}`,
      { method: "GET" },
      `merchant_statement_dispatch_direct_page_${page + 1}`,
      READ_TIMEOUT_MS,
    );
    const pageRows = Array.isArray(payload) ? (payload as DispatchSourceRow[]) : [];
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
  if (message.includes("merchant_statement_dispatch_not_authenticated")) return "not_authorized";
  if (message.includes("merchant_statement_dispatch_merchant_not_found")) return "merchant_not_found";
  if (message.includes("merchant_statement_dispatch_orders_required")) return "orders_required";
  if (message.includes("could not find the function") || message.includes("schema cache")) return "runtime_missing";
  return "unknown";
}

export async function fetchMerchantStatementDispatchStatus(
  merchantId: string,
): Promise<MerchantStatementDispatchStatus[]> {
  const normalizedMerchantId = clean(merchantId);
  if (!normalizedMerchantId) throw new Error("merchant_statement_dispatch_merchant_required");

  let rpcDetail = "merchant_statement_dispatch_status_failed";
  try {
    const payload = await protectedRestRequest(
      "rpc/admin_get_merchant_statement_dispatch_status",
      {
        method: "POST",
        body: JSON.stringify({ p_merchant_id: normalizedMerchantId }),
      },
      "merchant_statement_dispatch_status_rpc",
      READ_TIMEOUT_MS,
    );
    return normalizeRpcStatusRows(payload);
  } catch (rpcFailure) {
    rpcDetail = rpcErrorMessage(rpcFailure) || clean(rpcFailure) || rpcDetail;
  }

  try {
    return await fetchDispatchStatusDirectly(normalizedMerchantId);
  } catch (fallbackError) {
    const fallbackDetail = rpcErrorMessage(fallbackError) || clean(fallbackError);
    throw new Error(
      `merchant_statement_dispatch_status_failed | rpc: ${rpcDetail} | protected_table: ${fallbackDetail}`,
    );
  }
}

export async function confirmMerchantStatementDispatch(
  input: ConfirmMerchantStatementDispatchInput,
): Promise<ConfirmMerchantStatementDispatchResult> {
  const merchantId = clean(input.merchantId);
  const orderIds = [...new Set(input.orderIds.map(clean).filter(Boolean))];
  if (!merchantId) throw new Error("merchant_statement_dispatch_merchant_required");
  if (!orderIds.length) throw new Error("merchant_statement_dispatch_orders_required");

  // This write is deliberately sent once. An ambiguous timeout must not be
  // retried automatically because the database RPC owns batch idempotency.
  const payload = await protectedRestRequest(
    "rpc/admin_confirm_merchant_statement_dispatch",
    {
      method: "POST",
      body: JSON.stringify({
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
      }),
    },
    "merchant_statement_dispatch_confirm_rpc",
    WRITE_TIMEOUT_MS,
  );

  const source = (Array.isArray(payload) ? payload[0] : payload) as Record<string, unknown> | null;
  if (!source || source.ok !== true) {
    throw new Error("merchant_statement_dispatch_confirmation_unverified");
  }

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
