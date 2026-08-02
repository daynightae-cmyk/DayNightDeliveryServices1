import { supabase } from "../supabase";
import type { Order } from "../types";

const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 12_000;
const RETRY_DELAYS_MS = [0, 500, 1_200];

type OrderPage = {
  rows: Order[];
  count: number;
};

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label}_timeout`)),
      REQUEST_TIMEOUT_MS,
    );

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        window.clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

async function refreshAdminSession() {
  if (!supabase) return;
  const session = await withTimeout(supabase.auth.getSession(), "admin_orders_get_session").catch(() => null);
  if (!session?.data?.session) return;
  await withTimeout(supabase.auth.refreshSession(), "admin_orders_refresh_session").catch(() => null);
}

async function fetchPage(page: number): Promise<OrderPage> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  let latestMessage = "Orders could not be loaded safely right now.";

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt] > 0) await wait(RETRY_DELAYS_MS[attempt]);

    const result = await withTimeout(
      supabase
        .from("orders")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to),
      `admin_orders_page_${page}_attempt_${attempt + 1}`,
    ).catch((cause) => ({
      data: null,
      count: null,
      error: {
        message: cause instanceof Error ? cause.message : String(cause || "unknown request failure"),
      },
    }));

    if (!result.error) {
      const rows = Array.isArray(result.data) ? (result.data as Order[]) : [];
      return {
        rows,
        count: typeof result.count === "number" ? result.count : rows.length,
      };
    }

    latestMessage = String(result.error.message || latestMessage);
    console.warn(
      `Admin orders page ${page} attempt ${attempt + 1} failed:`,
      latestMessage,
    );
    await refreshAdminSession();
  }

  throw new Error(`Orders could not be loaded safely after retrying: ${latestMessage}`);
}

/**
 * Reads the complete protected admin order set with bounded retries. Every page
 * comes from the authenticated orders table and the function fails closed when
 * any page is incomplete, so merchant ownership can never be inferred from a
 * partial or mixed browser fallback.
 */
export async function fetchAdminOrdersResilient(): Promise<Order[]> {
  const first = await fetchPage(1);
  const totalPages = Math.max(1, Math.ceil(first.count / PAGE_SIZE));
  const rows = [...first.rows];

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchPage(page);
    rows.push(...next.rows);
  }

  if (rows.length !== first.count) {
    throw new Error(
      `Admin orders pagination incomplete: expected ${first.count}, received ${rows.length}.`,
    );
  }

  return rows;
}
