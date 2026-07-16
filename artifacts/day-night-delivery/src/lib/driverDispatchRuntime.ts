import { supabase } from "../supabase";
import type {
  DriverDispatchAction,
  DriverDispatchResult,
  DriverLocation,
  DriverProfile,
} from "../types/driver";

export type DispatchRuntimeHealth = {
  ok: boolean;
  assignment_history_table?: boolean;
  transaction_rpc?: boolean;
  runtime_rpc?: boolean;
  candidates_rpc?: boolean;
  runtime_execute_grant?: boolean;
  candidates_execute_grant?: boolean;
  anonymous_candidates_blocked?: boolean;
  history_select_grant?: boolean;
  orders_assignment_metadata?: boolean;
  compatibility_mode?: boolean;
  api_discovery_pending?: boolean;
};

export type DispatchCandidate = DriverProfile & {
  active_orders: number;
  is_online: boolean;
  last_seen_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  current_order_id?: string | null;
  is_current_driver?: boolean;
  location?: DriverLocation | null;
};

export type DispatchRuntimeInput = {
  orderId: string;
  driverId?: string | null;
  action: DriverDispatchAction;
  note?: string | null;
  force?: boolean;
};

function client() {
  if (!supabase) throw new Error("Supabase client is not configured.");
  return supabase;
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message || "");
  }
  return String(error || "Unknown dispatch error");
}

function isRpcDiscoveryError(error: unknown) {
  return /PGRST202|PGRST203|schema cache|could not find the function|function .* does not exist|admin_dispatch_order_runtime|admin_dispatch_candidates_secure/i.test(
    messageOf(error),
  );
}

function normalizeResult(data: unknown): DriverDispatchResult {
  const result = (Array.isArray(data) ? data[0] : data) as DriverDispatchResult | null;
  if (!result?.ok) throw new Error("dispatch_operation_failed");
  return result;
}

export async function fetchDispatchRuntimeHealth(): Promise<DispatchRuntimeHealth> {
  const db = client();
  const { data, error } = await db.rpc("admin_dispatch_runtime_health");
  if (!error) {
    return (Array.isArray(data) ? data[0] : data) as DispatchRuntimeHealth;
  }

  // PostgREST may briefly serve an older schema snapshot after a successful SQL
  // migration. The already-established transactional health RPC is the first
  // compatibility source of truth during that window.
  const { data: legacyData, error: legacyError } = await db.rpc("admin_dispatch_health");
  if (!legacyError && legacyData) {
    const legacy = (Array.isArray(legacyData) ? legacyData[0] : legacyData) as Record<string, unknown>;
    const transactionAvailable = Boolean(legacy.ok && legacy.dispatch_rpc);
    return {
      ok: transactionAvailable,
      transaction_rpc: Boolean(legacy.dispatch_rpc),
      assignment_history_table: Boolean(legacy.assignment_history_table),
      orders_assignment_metadata: Boolean(legacy.orders_assignment_metadata),
      compatibility_mode: true,
      api_discovery_pending: true,
    };
  }

  // Do not disable a real dispatch workflow merely because PostgREST has not
  // exposed either health function yet. Assignment execution below performs a
  // strict cascade through the runtime RPC, stable wrappers and transactional
  // RPC. A genuine backend failure is therefore reported only when an actual
  // operation is attempted and every audited route is unavailable.
  if (isRpcDiscoveryError(error) && isRpcDiscoveryError(legacyError)) {
    return {
      ok: true,
      compatibility_mode: true,
      api_discovery_pending: true,
    };
  }

  return {
    ok: false,
    runtime_rpc: false,
    transaction_rpc: false,
  };
}

export async function fetchDispatchCandidates(orderId?: string | null): Promise<DispatchCandidate[]> {
  const db = client();
  const { data, error } = await db.rpc("admin_dispatch_candidates_secure", {
    p_order_id: orderId || null,
  });
  if (error) throw new Error(error.message);

  const rows = (Array.isArray(data) ? data : []) as DispatchCandidate[];
  return rows.map((row) => {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
    return {
      ...row,
      active_orders: Number(row.active_orders || 0),
      is_online: Boolean(row.is_online),
      location: hasLocation
        ? {
            driver_id: row.id,
            lat,
            lng,
            accuracy: row.accuracy ?? null,
            is_online: Boolean(row.is_online),
            last_seen_at: row.last_seen_at ?? null,
            current_order_id: row.current_order_id ?? null,
          }
        : null,
    };
  });
}

async function callTransactionalRpc(input: DispatchRuntimeInput) {
  const db = client();
  const { data, error } = await db.rpc("admin_dispatch_order", {
    p_order_id: input.orderId,
    p_driver_id: input.driverId || null,
    p_action: input.action,
    p_note: input.note || null,
    p_force: Boolean(input.force),
  });
  if (error) throw new Error(error.message);
  return normalizeResult(data);
}

async function callStableWrapper(input: DispatchRuntimeInput) {
  const db = client();

  if (input.action === "unassign") {
    const { data, error } = await db.rpc("admin_unassign_driver", {
      p_order_id: input.orderId,
      p_note: input.note || null,
      p_force: Boolean(input.force),
    });
    if (error) throw new Error(error.message);
    return normalizeResult(data);
  }

  if (!input.driverId) throw new Error("driver_required");

  // The compatibility assignment wrapper invokes the same audited transaction.
  // When an order already has a driver, the database records the operation as a
  // reassignment and enforces the required reason. Forced in-progress transfers
  // must use the five-argument transaction so the safety flag is preserved.
  if (input.action === "reassign" && input.force) {
    return callTransactionalRpc(input);
  }

  const { data, error } = await db.rpc("admin_assign_driver", {
    p_order_id: input.orderId,
    p_driver_id: input.driverId,
    p_note: input.note || null,
  });
  if (error) throw new Error(error.message);
  return normalizeResult(data);
}

export async function dispatchOrderRuntime(
  input: DispatchRuntimeInput,
): Promise<DriverDispatchResult> {
  const db = client();
  const payload = {
    order_id: input.orderId,
    driver_id: input.driverId || null,
    action: input.action,
    note: input.note || null,
    force: Boolean(input.force),
  };

  const { data, error } = await db.rpc("admin_dispatch_order_runtime", {
    p_payload: payload,
  });

  if (!error) return normalizeResult(data);
  if (!isRpcDiscoveryError(error)) throw new Error(error.message);

  const failures: string[] = [messageOf(error)];

  try {
    return await callStableWrapper(input);
  } catch (wrapperError) {
    if (!isRpcDiscoveryError(wrapperError)) throw wrapperError;
    failures.push(messageOf(wrapperError));
  }

  try {
    return await callTransactionalRpc(input);
  } catch (transactionError) {
    if (!isRpcDiscoveryError(transactionError)) throw transactionError;
    failures.push(messageOf(transactionError));
  }

  throw new Error(`dispatch_service_unavailable: ${failures.filter(Boolean).join(" | ")}`);
}

export function dispatchRuntimeErrorMessage(error: unknown, isArabic: boolean) {
  const raw = messageOf(error);
  const messages: Array<[RegExp, string, string]> = [
    [/closed_order_cannot_be_dispatched/i, "لا يمكن توزيع طلب مُسلّم أو ملغي أو راجع.", "Closed orders cannot be dispatched."],
    [/reassignment_reason_required/i, "اكتب سبب إعادة التعيين.", "A reassignment reason is required."],
    [/unassignment_reason_required/i, "اكتب سبب إلغاء الإسناد.", "An unassignment reason is required."],
    [/force_required_for_in_progress_reassign/i, "الطلب بدأ تنفيذه؛ فعّل النقل الاضطراري بعد تأكيد التسليم بين المندوبين.", "The order is in progress. Enable forced transfer after confirming handoff."],
    [/force_required_for_in_progress_unassign/i, "الطلب بدأ تنفيذه؛ فعّل الإلغاء الاضطراري لإعادته إلى المراجعة.", "The order is in progress. Enable forced unassignment to return it to review."],
    [/active_driver_not_found/i, "المندوب غير موجود أو حسابه غير نشط.", "The driver does not exist or is inactive."],
    [/invalid_driver_id/i, "معرّف المندوب غير صالح.", "The driver id is invalid."],
    [/driver_required/i, "اختر مندوبًا قبل تنفيذ التعيين.", "Select a driver before assigning."],
    [/order_required|order_not_found/i, "الطلب غير موجود في قاعدة البيانات.", "The order was not found."],
    [/not_authorized|permission|row-level security/i, "جلسة الإدارة الحالية لا تملك صلاحية التوزيع. أعد تسجيل الدخول بحساب الإدارة.", "The current admin session lacks dispatch permission. Sign in again as admin."],
    [/dispatch_service_unavailable/i, "تعذر الوصول إلى مسارات التوزيع الثلاثة من Supabase API رغم اكتمال قاعدة البيانات. أعد تسجيل دخول الإدارة ثم أعد المحاولة.", "All three Supabase dispatch API routes were unavailable although the database is configured. Sign in to admin again and retry."],
    [/PGRST202|PGRST203|schema cache|could not find the function|function .* does not exist/i, "Supabase API يعيد تحميل مخطط الدوال الآن. أعد المحاولة بعد ثوانٍ؛ الطلب والبيانات لم يتغيرا.", "Supabase API is refreshing its function schema. Retry in a few seconds; no order data changed."],
  ];
  const match = messages.find(([pattern]) => pattern.test(raw));
  return match ? (isArabic ? match[1] : match[2]) : raw;
}
