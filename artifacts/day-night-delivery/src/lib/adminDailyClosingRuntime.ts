import { supabase } from "../supabase";

export type DailyClosingStatus = "draft" | "needs_review" | "closed" | "reopened";
export type DailyClosingSource = "rpc" | "persisted" | "tables" | "unavailable";

export type DailyClosingSnapshot = Record<string, unknown> & {
  closing_date: string;
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  goods_value: number;
  delivery_income: number;
  discounts_total: number;
  customer_total: number;
  merchant_due: number;
  cod_total: number;
  cod_collected: number;
  cod_pending: number;
  cod_reconciled: number;
  expenses_total: number;
  adjustments_net: number;
  net_total: number;
  budget_allocated: number;
  budget_remaining: number;
  unassigned_orders: number;
  pending_review_orders: number;
  unreconciled_cod: number;
  unposted_delivered_orders: number;
  print_jobs_pending: number;
  status: DailyClosingStatus;
  source: DailyClosingSource;
  authoritative: boolean;
  generated_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  updated_at?: string | null;
  notes?: string;
  reason?: string;
  data_version?: string;
};

type Row = Record<string, unknown>;

const clean = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
};
const normalizeStatus = (value: unknown) => clean(value).toLowerCase().replace(/[\s-]+/g, "_");
const isDelivered = (row: Row) => ["delivered", "completed", "complete"].includes(normalizeStatus(row.status));
const isCancelled = (row: Row) => ["cancelled", "canceled", "failed"].includes(normalizeStatus(row.status));
const isReturned = (row: Row) => normalizeStatus(row.status) === "returned";
const isPendingReview = (row: Row) => ["pending", "review", "under_review", "confirmed"].includes(normalizeStatus(row.status));
const sum = (rows: Row[], key: string) => rows.reduce((total, row) => total + num(row[key]), 0);

export function isDailyClosingSchemaError(error: unknown) {
  const text = clean((error as { message?: string; code?: string })?.message || (error as { code?: string })?.code || error).toLowerCase();
  return (
    text.includes("schema cache") ||
    text.includes("could not find") ||
    text.includes("does not exist") ||
    text.includes("pgrst202") ||
    text.includes("pgrst205") ||
    text.includes("42p01") ||
    text.includes("42883")
  );
}

function blank(date: string, reason = "finance_unavailable"): DailyClosingSnapshot {
  return {
    closing_date: date,
    total_orders: 0,
    delivered_orders: 0,
    cancelled_orders: 0,
    returned_orders: 0,
    goods_value: 0,
    delivery_income: 0,
    discounts_total: 0,
    customer_total: 0,
    merchant_due: 0,
    cod_total: 0,
    cod_collected: 0,
    cod_pending: 0,
    cod_reconciled: 0,
    expenses_total: 0,
    adjustments_net: 0,
    net_total: 0,
    budget_allocated: 0,
    budget_remaining: 0,
    unassigned_orders: 0,
    pending_review_orders: 0,
    unreconciled_cod: 0,
    unposted_delivered_orders: 0,
    print_jobs_pending: 0,
    status: "needs_review",
    source: "unavailable",
    authoritative: false,
    generated_at: new Date().toISOString(),
    reason,
    data_version: "daily-closing-v3",
  };
}

function normalizeSnapshot(raw: Row, fallbackDate: string, source?: DailyClosingSource): DailyClosingSnapshot {
  const status = normalizeStatus(raw.status);
  const rawSource = source || clean(raw.source).toLowerCase();
  const normalizedSource: DailyClosingSource = ["rpc", "persisted", "tables", "unavailable"].includes(rawSource)
    ? (rawSource as DailyClosingSource)
    : "rpc";
  return {
    ...raw,
    closing_date: clean(raw.closing_date) || fallbackDate,
    total_orders: num(raw.total_orders),
    delivered_orders: num(raw.delivered_orders),
    cancelled_orders: num(raw.cancelled_orders),
    returned_orders: num(raw.returned_orders),
    goods_value: num(raw.goods_value),
    delivery_income: num(raw.delivery_income),
    discounts_total: num(raw.discounts_total),
    customer_total: num(raw.customer_total),
    merchant_due: num(raw.merchant_due),
    cod_total: num(raw.cod_total),
    cod_collected: num(raw.cod_collected),
    cod_pending: num(raw.cod_pending),
    cod_reconciled: num(raw.cod_reconciled),
    expenses_total: num(raw.expenses_total),
    adjustments_net: num(raw.adjustments_net),
    net_total: num(raw.net_total),
    budget_allocated: num(raw.budget_allocated),
    budget_remaining: num(raw.budget_remaining),
    unassigned_orders: num(raw.unassigned_orders),
    pending_review_orders: num(raw.pending_review_orders),
    unreconciled_cod: num(raw.unreconciled_cod),
    unposted_delivered_orders: num(raw.unposted_delivered_orders),
    print_jobs_pending: num(raw.print_jobs_pending),
    status: ["draft", "needs_review", "closed", "reopened"].includes(status) ? (status as DailyClosingStatus) : "needs_review",
    source: normalizedSource,
    authoritative: normalizedSource !== "unavailable",
    generated_at: clean(raw.generated_at) || clean(raw.updated_at) || new Date().toISOString(),
    reviewed_at: clean(raw.reviewed_at) || null,
    reviewed_by: clean(raw.reviewed_by) || null,
    updated_at: clean(raw.updated_at) || null,
    notes: clean(raw.notes) || undefined,
    reason: clean(raw.reason) || undefined,
    data_version: clean(raw.data_version) || "daily-closing-v3",
  };
}

async function readPersisted(date: string): Promise<Row | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("admin_daily_closings").select("*").eq("closing_date", date).maybeSingle();
  if (error) {
    if (!isDailyClosingSchemaError(error)) console.warn("DAY NIGHT daily closing persisted read failed.", error);
    return null;
  }
  return data && typeof data === "object" ? (data as Row) : null;
}

function persistedClosedSnapshot(row: Row | null, date: string): DailyClosingSnapshot | null {
  if (!row || normalizeStatus(row.status) !== "closed") return null;
  const rawSnapshot = row.snapshot;
  const snapshot = rawSnapshot && typeof rawSnapshot === "object" && !Array.isArray(rawSnapshot) ? (rawSnapshot as Row) : row;
  return normalizeSnapshot(
    {
      ...snapshot,
      closing_date: row.closing_date || date,
      status: "closed",
      source: "persisted",
      notes: row.notes,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      updated_at: row.updated_at,
      generated_at: row.reviewed_at || row.updated_at || (snapshot as Row).generated_at,
      data_version: row.snapshot_version || (snapshot as Row).data_version || "daily-closing-v3",
    },
    date,
    "persisted",
  );
}

async function queryRowsByTimestamp(table: string, column: string, date: string) {
  if (!supabase) return { rows: [] as Row[], error: new Error("supabase_not_configured") };
  const from = `${date}T00:00:00`;
  const to = `${date}T23:59:59.999`;
  const { data, error } = await supabase.from(table).select("*").gte(column, from).lte(column, to).limit(5000);
  return { rows: Array.isArray(data) ? (data as Row[]) : [], error };
}

async function tableSnapshot(date: string): Promise<DailyClosingSnapshot> {
  if (!supabase) return blank(date, "supabase_not_configured");

  const [ordersCreated, ordersUpdated, settlements, expenses, adjustments, budgets] = await Promise.all([
    queryRowsByTimestamp("orders", "created_at", date),
    queryRowsByTimestamp("orders", "updated_at", date),
    queryRowsByTimestamp("order_financial_settlements", "posted_at", date),
    supabase.from("admin_expenses").select("*").eq("expense_date", date).limit(5000),
    queryRowsByTimestamp("admin_adjustments", "created_at", date),
    supabase.from("admin_finance_budget_status").select("*").lte("period_start", date).gte("period_end", date).limit(5000),
  ]);

  const requiredErrors = [ordersCreated.error, settlements.error, expenses.error, adjustments.error, budgets.error].filter(Boolean);
  if (requiredErrors.some((error) => isDailyClosingSchemaError(error))) {
    return blank(date, "finance_migration_required");
  }
  if (requiredErrors.length) {
    console.warn("DAY NIGHT direct daily closing table read failed.", requiredErrors[0]);
    return blank(date, "finance_permission_or_runtime_error");
  }

  const dayOrders = ordersCreated.rows;
  const settlementRows = settlements.rows;
  const expenseRows = Array.isArray(expenses.data) ? (expenses.data as Row[]) : [];
  const adjustmentRows = adjustments.rows;
  const budgetRows = Array.isArray(budgets.data) ? (budgets.data as Row[]) : [];
  const updatedRows = ordersUpdated.error ? [] : ordersUpdated.rows;

  const approvedExpenses = expenseRows.filter((row) => normalizeStatus(row.status) === "approved");
  const approvedAdjustments = adjustmentRows.filter((row) => normalizeStatus(row.status) === "approved");
  const activeOrders = dayOrders.filter((row) => !isCancelled(row) && !isReturned(row));
  const deliveredActivity = updatedRows.filter(isDelivered);
  const unpostedDelivered = deliveredActivity.filter((row) => !clean(row.financial_posted_at));

  const goodsValue = sum(settlementRows, "goods_value");
  const deliveryIncome = settlementRows.reduce((total, row) => total + num(row.company_revenue ?? row.delivery_fee), 0);
  const discountsTotal = sum(settlementRows, "discount_amount");
  const customerTotal = sum(settlementRows, "customer_total");
  const merchantDue = sum(settlementRows, "merchant_due");
  const collected = sum(settlementRows, "collected_amount");
  const pending = Math.max(0, customerTotal - collected);
  const expensesTotal = sum(approvedExpenses, "amount");
  const adjustmentsNet = approvedAdjustments.reduce(
    (total, row) => total + (normalizeStatus(row.direction) === "negative" ? -num(row.amount) : num(row.amount)),
    0,
  );
  const budgetAllocated = sum(budgetRows, "allocated_amount");
  const budgetRemaining = sum(budgetRows, "remaining_amount");

  return normalizeSnapshot(
    {
      closing_date: date,
      total_orders: dayOrders.length,
      delivered_orders: settlementRows.length,
      cancelled_orders: dayOrders.filter(isCancelled).length,
      returned_orders: dayOrders.filter(isReturned).length,
      goods_value: goodsValue,
      delivery_income: deliveryIncome,
      discounts_total: discountsTotal,
      customer_total: customerTotal,
      merchant_due: merchantDue,
      cod_total: customerTotal,
      cod_collected: collected,
      cod_pending: pending,
      cod_reconciled: collected,
      expenses_total: expensesTotal,
      adjustments_net: adjustmentsNet,
      net_total: deliveryIncome - expensesTotal + adjustmentsNet,
      budget_allocated: budgetAllocated,
      budget_remaining: budgetRemaining,
      unassigned_orders: activeOrders.filter(
        (row) => !clean(row.driver_name) && !clean(row.driver_id) && !clean(row.assigned_driver_id),
      ).length,
      pending_review_orders: dayOrders.filter(isPendingReview).length,
      unreconciled_cod: pending,
      unposted_delivered_orders: unpostedDelivered.length,
      print_jobs_pending: 0,
      status: unpostedDelivered.length > 0 ? "needs_review" : "draft",
      source: "tables",
      authoritative: true,
      generated_at: new Date().toISOString(),
      data_version: "daily-closing-v3-tables",
    },
    date,
    "tables",
  );
}

export async function fetchDailyClosing(date: string): Promise<DailyClosingSnapshot> {
  if (!supabase) return blank(date, "supabase_not_configured");

  const persisted = await readPersisted(date);
  const closed = persistedClosedSnapshot(persisted, date);
  if (closed) return closed;

  const { data, error } = await supabase.rpc("admin_daily_closing_snapshot", { p_date: date });
  if (!error && data && typeof data === "object") {
    return normalizeSnapshot(
      {
        ...(data as Row),
        status: persisted?.status || (data as Row).status,
        notes: persisted?.notes,
        reviewed_at: persisted?.reviewed_at,
        reviewed_by: persisted?.reviewed_by,
        updated_at: persisted?.updated_at,
        source: "rpc",
      },
      date,
      "rpc",
    );
  }

  if (error && !isDailyClosingSchemaError(error)) {
    console.warn("DAY NIGHT daily closing RPC failed; trying verified finance tables.", error);
  }

  const direct = await tableSnapshot(date);
  if (persisted && direct.source !== "unavailable") {
    return normalizeSnapshot(
      {
        ...direct,
        status: persisted.status || direct.status,
        notes: persisted.notes,
        reviewed_at: persisted.reviewed_at,
        reviewed_by: persisted.reviewed_by,
        updated_at: persisted.updated_at,
        source: "tables",
      },
      date,
      "tables",
    );
  }
  return direct;
}

function rowFromSnapshot(snapshot: DailyClosingSnapshot, status: DailyClosingStatus, notes?: string, userId?: string | null) {
  const reviewed = status === "closed";
  const now = new Date().toISOString();
  const canonical = {
    ...snapshot,
    closing_date: snapshot.closing_date,
    status,
    notes: clean(notes) || null,
    source: snapshot.source === "persisted" ? "rpc" : snapshot.source,
    generated_at: snapshot.generated_at || now,
    data_version: snapshot.data_version || "daily-closing-v3",
  };
  return {
    closing_date: snapshot.closing_date,
    total_orders: snapshot.total_orders,
    delivered_orders: snapshot.delivered_orders,
    cancelled_orders: snapshot.cancelled_orders,
    returned_orders: snapshot.returned_orders,
    goods_value: snapshot.goods_value,
    delivery_income: snapshot.delivery_income,
    discounts_total: snapshot.discounts_total,
    customer_total: snapshot.customer_total,
    merchant_due: snapshot.merchant_due,
    cod_total: snapshot.cod_total,
    cod_collected: snapshot.cod_collected,
    cod_pending: snapshot.cod_pending,
    cod_reconciled: snapshot.cod_reconciled,
    expenses_total: snapshot.expenses_total,
    adjustments_net: snapshot.adjustments_net,
    net_total: snapshot.net_total,
    budget_allocated: snapshot.budget_allocated,
    budget_remaining: snapshot.budget_remaining,
    unassigned_orders: snapshot.unassigned_orders,
    pending_review_orders: snapshot.pending_review_orders,
    unreconciled_cod: snapshot.unreconciled_cod,
    unposted_delivered_orders: snapshot.unposted_delivered_orders,
    print_jobs_pending: snapshot.print_jobs_pending,
    status,
    source: canonical.source,
    notes: canonical.notes,
    snapshot: canonical,
    reviewed_at: reviewed ? now : null,
    reviewed_by: reviewed ? userId || null : null,
    updated_at: now,
    snapshot_version: "daily-closing-v3",
  };
}

export async function saveDailyClosing(
  snapshot: DailyClosingSnapshot,
  status: DailyClosingStatus,
  notes?: string,
): Promise<DailyClosingSnapshot> {
  if (!supabase) throw new Error("supabase_not_configured");
  if (!snapshot.authoritative || snapshot.source === "unavailable") throw new Error("authoritative_finance_required");
  if (status === "closed" && snapshot.unposted_delivered_orders > 0) throw new Error("closing_blocked_unposted_delivered");

  const { data, error } = await supabase.rpc("admin_save_daily_closing", {
    p_snapshot: {
      closing_date: snapshot.closing_date,
      status,
      notes: clean(notes) || null,
    },
  });
  if (!error && data && typeof data === "object") {
    return fetchDailyClosing(snapshot.closing_date);
  }
  if (error && !isDailyClosingSchemaError(error)) throw new Error(error.message || "daily_closing_save_failed");

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id || null;
  const row = rowFromSnapshot(snapshot, status, notes, userId);
  const { data: persisted, error: upsertError } = await supabase
    .from("admin_daily_closings")
    .upsert(row, { onConflict: "closing_date" })
    .select("*")
    .single();
  if (upsertError) throw new Error(upsertError.message || "daily_closing_direct_save_failed");

  if (userId) {
    void supabase
      .from("admin_audit_events")
      .insert({
        entity_type: "admin_daily_closing",
        entity_id: clean((persisted as Row)?.id) || snapshot.closing_date,
        action: status,
        actor_id: userId,
        after_data: persisted,
        metadata: { source: "client_table_fallback", data_version: "daily-closing-v3" },
      })
      .then(({ error: auditError }) => {
        if (auditError && !isDailyClosingSchemaError(auditError)) console.warn("DAY NIGHT daily closing audit fallback failed.");
      });
  }

  return fetchDailyClosing(snapshot.closing_date);
}
