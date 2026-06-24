import { supabase } from "../supabase";

type Metric = {
  event: string;
  value?: number;
  meta?: Record<string, unknown>;
  created_at: string;
};

const state = {
  failedRequests: 0
};

const isDev = (import.meta as any).env?.DEV === true;

async function safeInsert(table: string, payload: Record<string, unknown>) {
  if (!supabase) return;
  try {
    await supabase.from(table).insert(payload);
  } catch {
    // Monitoring failures must never crash app runtime.
  }
}

export function reportError(error: unknown, context: string, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  const stack = error instanceof Error ? error.stack : undefined;

  if (isDev) {
    console.error("[monitoring]", context, message, extra || {});
  }

  safeInsert("error_logs", {
    context,
    message,
    stack,
    extra: extra || {},
    created_at: new Date().toISOString()
  });
}

export function trackPageLoad(page: string) {
  if (typeof performance === "undefined") return;
  const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  const timing = entries[0];
  const value = timing ? Number(timing.loadEventEnd - timing.startTime) : 0;

  const metric: Metric = {
    event: "page_load",
    value,
    meta: { page },
    created_at: new Date().toISOString()
  };

  if (isDev) {
    console.info("[monitoring] page_load", metric);
  }

  safeInsert("performance_logs", metric as unknown as Record<string, unknown>);
}

export async function trackApiCall<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await operation();
    const elapsed = Number((performance.now() - startedAt).toFixed(2));
    safeInsert("performance_logs", {
      event: "api_call_success",
      value: elapsed,
      meta: { name },
      created_at: new Date().toISOString()
    });
    return result;
  } catch (error) {
    state.failedRequests += 1;
    safeInsert("performance_logs", {
      event: "api_call_failure",
      value: Number((performance.now() - startedAt).toFixed(2)),
      meta: { name, failedRequests: state.failedRequests },
      created_at: new Date().toISOString()
    });
    reportError(error, `api:${name}`);
    throw error;
  }
}

export function getMonitoringStats() {
  return {
    failedRequests: state.failedRequests
  };
}
