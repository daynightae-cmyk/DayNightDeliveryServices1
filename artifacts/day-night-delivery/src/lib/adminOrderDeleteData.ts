import { supabase } from "../supabase";
import type { Order } from "../types";

export type AdminOrderDeleteResult = {
  deleted: boolean;
  reference: string;
  source: "rpc" | "db";
};

type RpcDeleteResult = {
  deleted?: boolean;
  reference?: string;
};

type ErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type RpcAttempt = {
  name: string;
  args: Record<string, unknown>;
};

const INTERNAL_DELETE_REASON =
  "Automatic one-click deletion from DAY NIGHT admin order manager";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function orderReference(order: Order) {
  return clean(
    order.id ||
      order.tracking_number ||
      order.invoice_number ||
      order.coupon_number,
  );
}

function normalizeRpcResult(data: unknown): RpcDeleteResult | null {
  const value = Array.isArray(data) ? data[0] : data;
  if (value === true) return { deleted: true };
  if (!value || typeof value !== "object") return null;
  return value as RpcDeleteResult;
}

function diagnostic(error: unknown) {
  const value = (error || {}) as ErrorLike;
  return [value.code, value.message, value.details, value.hint]
    .map(clean)
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .join(" | ");
}

function deletionError(error: unknown) {
  const value = (error || {}) as ErrorLike;
  const detail = diagnostic(error) || "admin_order_delete_failed";
  const wrapped = new Error(detail) as Error & ErrorLike;
  wrapped.code = clean(value.code || "ADMIN_ORDER_DELETE_FAILED");
  wrapped.details = clean(value.details);
  wrapped.hint = clean(value.hint);
  return wrapped;
}

async function fetchOrder(reference: string, orderId?: string) {
  if (!supabase) return { row: null as Order | null, error: null as unknown };

  if (clean(orderId)) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", clean(orderId))
      .limit(1);
    return { row: (data?.[0] as Order | undefined) || null, error };
  }

  let lastError: unknown = null;
  for (const column of ["tracking_number", "invoice_number", "coupon_number", "id"]) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq(column, reference)
      .limit(1);
    if (error) {
      lastError = error;
      continue;
    }
    if (data?.[0]) return { row: data[0] as Order, error: null };
  }

  return { row: null, error: lastError };
}

async function orderStillExists(reference: string, supplied: Order) {
  const lookup = await fetchOrder(reference, clean(supplied.id));
  if (lookup.error) throw lookup.error;
  return Boolean(lookup.row);
}

async function deleteDirectly(reference: string, supplied: Order) {
  if (!supabase) return { result: null as AdminOrderDeleteResult | null, error: null as unknown };

  const lookup = supplied.id
    ? { row: supplied, error: null as unknown }
    : await fetchOrder(reference);
  if (lookup.error) return { result: null, error: lookup.error };
  const targetId = clean(lookup.row?.id);
  let lastError: unknown = null;

  if (targetId) {
    const history = await supabase
      .from("order_status_history")
      .delete()
      .eq("order_id", targetId);
    if (history.error) lastError = history.error;

    const deleted = await supabase
      .from("orders")
      .delete()
      .eq("id", targetId)
      .select("id");
    if (deleted.error) {
      lastError = deleted.error;
    } else if (deleted.data?.length || !(await orderStillExists(reference, supplied))) {
      return {
        result: { deleted: true, reference, source: "db" as const },
        error: null,
      };
    }
  }

  for (const column of ["tracking_number", "invoice_number", "coupon_number"]) {
    const deleted = await supabase
      .from("orders")
      .delete()
      .eq(column, reference)
      .select("id");
    if (deleted.error) {
      lastError = deleted.error;
      continue;
    }
    if (deleted.data?.length || !(await orderStillExists(reference, supplied))) {
      return {
        result: { deleted: true, reference, source: "db" as const },
        error: null,
      };
    }
  }

  return { result: null, error: lastError };
}

/**
 * Deletes an exact order without asking the operator for a reason.
 * A professional internal audit reason is always supplied for compatibility with
 * older production RPCs, while the v2 RPC removes status and assignment blocks.
 */
export async function deleteAdminOrderImmediately(
  order: Order,
): Promise<AdminOrderDeleteResult> {
  if (!supabase) throw deletionError({ message: "supabase_unavailable" });

  const reference = orderReference(order);
  if (!reference) throw deletionError({ message: "order_reference_missing" });

  const payload = {
    reference,
    order_id: clean(order.id || reference),
    reason: INTERNAL_DELETE_REASON,
    audit_reason: INTERNAL_DELETE_REASON,
  };
  const orderId = clean(order.id || reference);
  const rpcAttempts: RpcAttempt[] = [
    { name: "admin_delete_order_flexible_v2", args: { p_payload: payload } },
    { name: "admin_delete_order_runtime", args: { p_payload: payload } },
    {
      name: "admin_delete_order_runtime",
      args: { p_reference: reference, p_reason: INTERNAL_DELETE_REASON },
    },
    { name: "admin_delete_order_runtime", args: { p_reference: reference } },
    {
      name: "admin_delete_order",
      args: { p_reference: reference, p_reason: INTERNAL_DELETE_REASON },
    },
    { name: "admin_delete_order", args: { p_reference: reference } },
    {
      name: "admin_delete_order",
      args: { p_order_id: orderId, p_reason: INTERNAL_DELETE_REASON },
    },
    { name: "admin_delete_order", args: { p_order_id: orderId } },
  ];

  let lastError: unknown = null;

  for (const attempt of rpcAttempts) {
    const { data, error } = await supabase.rpc(attempt.name, attempt.args);
    if (error) {
      lastError = error;
      continue;
    }

    const result = normalizeRpcResult(data);
    if (result?.deleted) {
      return {
        deleted: true,
        reference: clean(result.reference || reference),
        source: "rpc",
      };
    }

    try {
      if (!(await orderStillExists(reference, order))) {
        return { deleted: true, reference, source: "rpc" };
      }
    } catch (verifyError) {
      lastError = verifyError;
    }
  }

  const direct = await deleteDirectly(reference, order);
  if (direct.result) return direct.result;
  if (direct.error) lastError = direct.error;

  console.error("DAY NIGHT admin order deletion failed", diagnostic(lastError));
  throw deletionError(lastError);
}
