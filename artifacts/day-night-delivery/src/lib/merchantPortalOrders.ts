import { supabase } from "../supabase";
import type { Order } from "../types";

type MerchantOrderPage = {
  ok?: boolean;
  merchant_id?: unknown;
  page?: unknown;
  page_size?: unknown;
  total_count?: unknown;
  total_pages?: unknown;
  orders?: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function rows(value: unknown): Order[] {
  return Array.isArray(value) ? (value as Order[]) : [];
}

export type MerchantOrdersResult = {
  merchantId: string;
  totalCount: number;
  orders: Order[];
};

/** Fetch every authorized page; never convert a failed page into an empty success. */
export async function fetchAllMerchantPortalOrders(pageSize = 200): Promise<MerchantOrdersResult> {
  if (!supabase) throw new Error("merchant_orders_backend_unavailable");

  const safePageSize = Math.min(Math.max(Math.trunc(pageSize), 1), 250);
  const collected: Order[] = [];
  const seen = new Set<string>();
  let expectedMerchantId = "";
  let expectedTotal = -1;
  let expectedPages = 1;

  for (let page = 1; page <= expectedPages; page += 1) {
    if (page > 10_000) throw new Error("merchant_orders_pagination_safety_limit");
    const { data, error } = await supabase.rpc("merchant_portal_orders_page", {
      p_page: page,
      p_page_size: safePageSize,
    });
    if (error) throw error;

    const payload = (Array.isArray(data) ? data[0] : data) as MerchantOrderPage | null;
    const merchantId = clean(payload?.merchant_id);
    const totalCount = Number(payload?.total_count);
    const totalPages = Math.max(1, Number(payload?.total_pages || 1));
    const returnedPage = Number(payload?.page || page);
    if (!payload?.ok || !merchantId || returnedPage !== page || !Number.isFinite(totalCount)) {
      throw new Error("merchant_orders_page_contract_invalid");
    }
    if (expectedMerchantId && merchantId !== expectedMerchantId) {
      throw new Error("merchant_orders_owner_changed_during_pagination");
    }
    if (expectedTotal >= 0 && totalCount !== expectedTotal) {
      throw new Error("merchant_orders_count_changed_during_pagination");
    }

    expectedMerchantId = merchantId;
    expectedTotal = totalCount;
    expectedPages = totalPages;
    for (const order of rows(payload.orders)) {
      const id = clean(order.id);
      if (!id || clean(order.merchant_id) !== merchantId) {
        throw new Error("merchant_orders_cross_owner_row_rejected");
      }
      if (seen.has(id)) continue;
      seen.add(id);
      collected.push(order);
    }
  }

  if (collected.length !== expectedTotal) {
    throw new Error(`merchant_orders_incomplete_${collected.length}_of_${expectedTotal}`);
  }

  return { merchantId: expectedMerchantId, totalCount: expectedTotal, orders: collected };
}
