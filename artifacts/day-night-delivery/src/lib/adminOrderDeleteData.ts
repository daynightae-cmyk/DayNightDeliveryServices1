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

async function locateOrder(reference: string, supplied: Order) {
  if (!supabase) return null;
  if (supplied.id) return supplied;

  for (const column of [
    "tracking_number",
    "invoice_number",
    "coupon_number",
    "id",
  ]) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq(column, reference)
      .limit(1);
    if (!error && data?.[0]) return data[0] as Order;
  }

  return null;
}

async function orderStillExists(reference: string, supplied: Order) {
  const row = await locateOrder(reference, supplied);
  return Boolean(row);
}

async function deleteDirectly(reference: string, supplied: Order) {
  if (!supabase) return null;

  const target = await locateOrder(reference, supplied);
  const targetId = clean(target?.id || supplied.id);

  if (targetId) {
    // Compatibility cleanup for installations where order history does not cascade.
    await supabase
      .from("order_status_history")
      .delete()
      .eq("order_id", targetId);

    const { data, error } = await supabase
      .from("orders")
      .delete()
      .eq("id", targetId)
      .select("id");

    if (!error && (data?.length || !(await orderStillExists(reference, supplied)))) {
      return { deleted: true, reference, source: "db" as const };
    }
  }

  for (const column of ["tracking_number", "invoice_number", "coupon_number"]) {
    const { data, error } = await supabase
      .from("orders")
      .delete()
      .eq(column, reference)
      .select("id");

    if (!error && (data?.length || !(await orderStillExists(reference, supplied)))) {
      return { deleted: true, reference, source: "db" as const };
    }
  }

  return null;
}

/**
 * Deletes an order immediately without collecting or displaying a reason.
 *
 * The compatibility chain supports production databases that are temporarily on
 * different migration generations. The authoritative no-reason RPC is preferred,
 * then the legacy signatures are attempted, and finally the admin RLS delete path
 * is used so installed live shells are not blocked by a stale PostgREST schema cache.
 */
export async function deleteAdminOrderImmediately(
  order: Order,
): Promise<AdminOrderDeleteResult> {
  if (!supabase) throw new Error("supabase_unavailable");

  const reference = orderReference(order);
  if (!reference) throw new Error("order_reference_missing");

  const rpcAttempts: Array<{
    name: string;
    args: Record<string, unknown>;
  }> = [
    {
      name: "admin_delete_order_runtime",
      args: { p_payload: { reference } },
    },
    {
      name: "admin_delete_order_runtime",
      args: { p_reference: reference },
    },
    {
      name: "admin_delete_order",
      args: { p_reference: reference },
    },
    {
      name: "admin_delete_order",
      args: { p_order_id: clean(order.id || reference) },
    },
  ];

  let lastError: unknown = null;

  for (const attempt of rpcAttempts) {
    const { data, error } = await supabase.rpc(attempt.name, attempt.args);
    if (error) {
      lastError = error;
      continue;
    }

    const result = normalizeRpcResult(data);
    if (result?.deleted || !(await orderStillExists(reference, order))) {
      return {
        deleted: true,
        reference: clean(result?.reference || reference),
        source: "rpc",
      };
    }
  }

  const direct = await deleteDirectly(reference, order);
  if (direct) return direct;

  console.error("DAY NIGHT admin order deletion failed", lastError);
  throw new Error("admin_order_delete_failed");
}
