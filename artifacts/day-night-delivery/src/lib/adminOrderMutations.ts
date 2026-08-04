import { supabase } from "../supabase";
import type { Order } from "../types";

export type AdminOrderWarning = {
  code: string;
  [key: string]: unknown;
};

export type AdminOrderMutationOperation =
  | "create"
  | "update"
  | "status"
  | "archive"
  | "soft_delete"
  | "restore";

export type AdminOrderMutationResult = {
  success: true;
  operation: AdminOrderMutationOperation;
  order: Order;
  warnings: AdminOrderWarning[];
  reconciliationRequired: boolean;
  auditId: string | null;
  requestId: string;
  changedFields: string[];
  replayed: boolean;
  source: "rpc";
};

export type AdminOrderBulkItemResult = {
  orderId: string;
  success: boolean;
  warning: boolean;
  failed: boolean;
  reason?: string;
  reconciliationRequired: boolean;
  result?: unknown;
};

export type AdminOrderBulkResult = {
  operation: AdminOrderMutationOperation;
  requestId: string;
  results: AdminOrderBulkItemResult[];
};

type RpcEnvelope = {
  ok?: boolean;
  success?: boolean;
  operation?: AdminOrderMutationOperation;
  order?: Order;
  warnings?: AdminOrderWarning[];
  reconciliation_required?: boolean;
  audit_id?: string | null;
  request_id?: string;
  changed_fields?: string[];
  replayed?: boolean;
};

type MutationOptions = {
  reason?: string;
  note?: string;
  sourcePage?: string;
  requestId?: string;
};

type BulkMutationOptions = MutationOptions & {
  operation?: AdminOrderMutationOperation;
  status?: string;
};

const inFlight = new Map<string, Promise<AdminOrderMutationResult>>();

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function requestId(prefix = "admin-order") {
  const id = globalThis.crypto?.randomUUID?.();
  return id || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function diagnostic(error: unknown) {
  const value = (error || {}) as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  return [value.code, value.message, value.details, value.hint]
    .map(clean)
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .join(" | ");
}

function normalizeEnvelope(data: unknown): RpcEnvelope {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new Error("admin_order_v3_returned_no_result");
  }
  return value as RpcEnvelope;
}

function normalizeWarnings(value: unknown): AdminOrderWarning[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({ code: clean(item.code || "admin_order_warning"), ...item }));
}

async function invokeMutation(
  orderId: string,
  operation: AdminOrderMutationOperation,
  patch: Record<string, unknown>,
  options: MutationOptions = {},
): Promise<AdminOrderMutationResult> {
  if (!supabase) throw new Error("supabase_unavailable");
  const normalizedOrderId = clean(orderId);
  if (!normalizedOrderId) throw new Error("order_id_required");

  const mutationRequestId = clean(options.requestId) || requestId(operation);
  const submissionKey = `${operation}:${normalizedOrderId}:${mutationRequestId}`;
  const existing = inFlight.get(submissionKey);
  if (existing) return existing;

  const promise: Promise<AdminOrderMutationResult> = (async (): Promise<AdminOrderMutationResult> => {
    const payload = {
      order_id: normalizedOrderId,
      operation,
      request_id: mutationRequestId,
      source_page: clean(options.sourcePage) || "admin_order_manager",
      reason: clean(options.reason || options.note) || "DAY NIGHT Admin order update",
      note: clean(options.note),
      patch,
    };

    const { data, error } = await supabase.rpc("admin_update_order_complete_v3", {
      p_payload: payload,
    });
    if (error) throw new Error(diagnostic(error) || "admin_update_order_complete_v3_failed");

    const envelope = normalizeEnvelope(data);
    if (envelope.ok !== true || envelope.success !== true || !envelope.order?.id) {
      throw new Error("admin_order_v3_core_save_not_confirmed");
    }

    return {
      success: true,
      operation: envelope.operation || operation,
      order: envelope.order,
      warnings: normalizeWarnings(envelope.warnings),
      reconciliationRequired: Boolean(envelope.reconciliation_required),
      auditId: clean(envelope.audit_id) || null,
      requestId: clean(envelope.request_id) || mutationRequestId,
      changedFields: Array.isArray(envelope.changed_fields)
        ? envelope.changed_fields.map(clean).filter(Boolean)
        : [],
      replayed: Boolean(envelope.replayed),
      source: "rpc",
    };
  })();

  inFlight.set(submissionKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(submissionKey);
  }
}

export async function createAdminOrder(
  patch: Record<string, unknown>,
  options: MutationOptions = {},
): Promise<AdminOrderMutationResult> {
  if (!supabase) throw new Error("supabase_unavailable");
  const mutationRequestId = clean(options.requestId) || requestId("create");
  const submissionKey = `create:${mutationRequestId}`;
  const existing = inFlight.get(submissionKey);
  if (existing) return existing;

  const promise: Promise<AdminOrderMutationResult> = (async () => {
    const { data, error } = await supabase.rpc("admin_create_order_v3", {
      p_payload: {
        operation: "create",
        request_id: mutationRequestId,
        source_page: clean(options.sourcePage) || "admin_new_order",
        reason: clean(options.reason || options.note) || "DAY NIGHT Admin order creation",
        order: patch,
      },
    });
    if (error) throw new Error(diagnostic(error) || "admin_create_order_v3_failed");
    const envelope = normalizeEnvelope(data);
    if (envelope.ok !== true || envelope.success !== true || !envelope.order?.id) {
      throw new Error("admin_order_v3_create_not_confirmed");
    }
    return {
      success: true,
      operation: "create",
      order: envelope.order,
      warnings: normalizeWarnings(envelope.warnings),
      reconciliationRequired: Boolean(envelope.reconciliation_required),
      auditId: clean(envelope.audit_id) || null,
      requestId: clean(envelope.request_id) || mutationRequestId,
      changedFields: Array.isArray(envelope.changed_fields)
        ? envelope.changed_fields.map(clean).filter(Boolean)
        : [],
      replayed: Boolean(envelope.replayed),
      source: "rpc",
    };
  })();

  inFlight.set(submissionKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(submissionKey);
  }
}

export function updateAdminOrder(
  orderId: string,
  patch: Record<string, unknown>,
  options: MutationOptions = {},
) {
  return invokeMutation(orderId, "update", patch, options);
}

export function updateAdminOrderStatus(
  orderId: string,
  status: string,
  options: MutationOptions = {},
) {
  const normalizedStatus = clean(status);
  return invokeMutation(
    orderId,
    "status",
    { status: normalizedStatus },
    { ...options, reason: options.reason || options.note || "Admin quick status update" },
  );
}

export function softDeleteAdminOrder(
  orderId: string,
  options: MutationOptions = {},
) {
  return invokeMutation(orderId, "soft_delete", {}, options);
}

export function archiveAdminOrder(
  orderId: string,
  options: MutationOptions = {},
) {
  return invokeMutation(orderId, "archive", {}, options);
}

export function restoreAdminOrder(
  orderId: string,
  options: MutationOptions = {},
) {
  return invokeMutation(orderId, "restore", {}, options);
}

export async function permanentlyDeleteAdminOrder(
  orderId: string,
  confirmation: string,
  options: MutationOptions = {},
) {
  if (!supabase) throw new Error("supabase_unavailable");
  const mutationRequestId = clean(options.requestId) || requestId("permanent-delete");
  const { data, error } = await supabase.rpc("admin_permanently_delete_order_v3", {
    p_payload: {
      order_id: clean(orderId),
      confirmation: clean(confirmation),
      request_id: mutationRequestId,
      source_page: clean(options.sourcePage) || "admin_trash",
      reason: clean(options.reason) || "Explicit Super Admin permanent deletion",
    },
  });
  if (error) throw new Error(diagnostic(error) || "admin_permanent_delete_v3_failed");
  return Array.isArray(data) ? data[0] : data;
}

export async function bulkUpdateAdminOrders(
  orderIds: string[],
  patch: Record<string, unknown>,
  options: BulkMutationOptions = {},
): Promise<AdminOrderBulkResult> {
  if (!supabase) throw new Error("supabase_unavailable");
  const ids = [...new Set(orderIds.map(clean).filter(Boolean))];
  if (!ids.length) throw new Error("order_ids_required");
  const operation = options.operation || "update";
  const mutationRequestId = clean(options.requestId) || requestId("bulk");
  const { data, error } = await supabase.rpc("admin_bulk_mutate_orders_v3", {
    p_payload: {
      order_ids: ids,
      operation,
      request_id: mutationRequestId,
      source_page: clean(options.sourcePage) || "admin_bulk",
      reason: clean(options.reason || options.note) || "Admin bulk order mutation",
      status: clean(options.status),
      patch,
    },
  });
  if (error) throw new Error(diagnostic(error) || "admin_bulk_mutate_orders_v3_failed");
  const value = (Array.isArray(data) ? data[0] : data) as {
    operation?: AdminOrderMutationOperation;
    request_id?: string;
    results?: Array<Record<string, unknown>>;
  } | null;
  if (!value || !Array.isArray(value.results)) {
    throw new Error("admin_bulk_mutation_returned_no_results");
  }
  return {
    operation: value.operation || operation,
    requestId: clean(value.request_id) || mutationRequestId,
    results: value.results.map((item) => ({
      orderId: clean(item.order_id),
      success: Boolean(item.success),
      warning: Boolean(item.warning),
      failed: Boolean(item.failed),
      reason: clean(item.reason) || undefined,
      reconciliationRequired: Boolean(item.reconciliation_required),
      result: item.result,
    })),
  };
}
