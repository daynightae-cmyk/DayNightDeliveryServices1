import { supabase } from "../supabase";
import type { Order } from "../types";
import { financialsFromOrder } from "./orderFinancials";

export type FinanceLedgerRow = Record<string, unknown> & {
  id?: string;
  order_id?: string;
  order_reference?: string;
  merchant_id?: string;
  category?: string;
  status?: string;
  amount?: number;
  created_at?: string;
  posted_at?: string;
};

export type FinanceBudgetRow = FinanceLedgerRow & {
  period_start?: string;
  period_end?: string;
  allocated_amount?: number;
  spent_amount?: number;
  remaining_amount?: number;
  utilization_percent?: number;
};

export type FinanceLedgerSummary = {
  ordersTotal: number;
  deliveredOrders: number;
  financiallyPostedOrders: number;
  unpostedDeliveredOrders: number;
  goodsValue: number;
  deliveryRevenue: number;
  discounts: number;
  customerTotal: number;
  collectedAmount: number;
  pendingCollection: number;
  merchantDue: number;
  approvedExpenses: number;
  draftExpenses: number;
  adjustmentsNet: number;
  operatingNet: number;
  budgetAllocated: number;
  budgetSpent: number;
  budgetRemaining: number;
};

export type FinanceLedgerSnapshot = {
  ok: boolean;
  source: "rpc" | "tables" | "orders";
  generatedAt: string;
  period: { from: string; to: string };
  summary: FinanceLedgerSummary;
  settlements: FinanceLedgerRow[];
  accountEntries: FinanceLedgerRow[];
  expenses: FinanceLedgerRow[];
  adjustments: FinanceLedgerRow[];
  budgets: FinanceBudgetRow[];
  driverEntries: FinanceLedgerRow[];
  auditEvents: FinanceLedgerRow[];
  warning?: string;
};

export type ExpenseDraft = {
  expense_date?: string;
  category: string;
  amount: number | string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
};

export type AdjustmentDraft = {
  adjustment_type: string;
  direction: "positive" | "negative";
  amount: number | string;
  reference_number?: string;
  reason: string;
  notes?: string;
  merchant_id?: string;
  order_id?: string;
  driver_id?: string;
};

export type BudgetDraft = {
  period_start: string;
  period_end: string;
  category: string;
  allocated_amount: number | string;
  notes?: string;
};

const clean = (value: unknown) => String(value ?? "").trim();
const amount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
};
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

function normalizeStatus(value: unknown) {
  return clean(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function isDelivered(order: Order) {
  return ["delivered", "completed", "complete"].includes(normalizeStatus(order.status));
}

function isMissingSchemaError(error: unknown) {
  const text = clean((error as { message?: string; code?: string })?.message || (error as { code?: string })?.code || error).toLowerCase();
  return text.includes("schema cache") || text.includes("could not find") || text.includes("does not exist") || text.includes("pgrst202") || text.includes("pgrst205") || text.includes("42p01");
}

function rowsFrom(value: unknown): FinanceLedgerRow[] {
  return Array.isArray(value) ? (value as FinanceLedgerRow[]) : [];
}

function budgetRowsFrom(value: unknown): FinanceBudgetRow[] {
  return Array.isArray(value) ? (value as FinanceBudgetRow[]) : [];
}

function sum(rows: FinanceLedgerRow[], selector: (row: FinanceLedgerRow) => number) {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function summaryFromTables(input: {
  orders?: Order[];
  settlements: FinanceLedgerRow[];
  expenses: FinanceLedgerRow[];
  adjustments: FinanceLedgerRow[];
  budgets: FinanceBudgetRow[];
}): FinanceLedgerSummary {
  const settlements = input.settlements;
  const deliveredOrders = input.orders?.filter(isDelivered).length ?? settlements.length;
  const postedOrders = settlements.length;
  const approvedExpenses = sum(input.expenses.filter((row) => normalizeStatus(row.status) === "approved"), (row) => amount(row.amount));
  const draftExpenses = sum(input.expenses.filter((row) => !["approved", "void", "cancelled"].includes(normalizeStatus(row.status))), (row) => amount(row.amount));
  const adjustmentsNet = sum(
    input.adjustments.filter((row) => normalizeStatus(row.status) === "approved"),
    (row) => (normalizeStatus(row.direction) === "negative" ? -amount(row.amount) : amount(row.amount)),
  );
  const budgetAllocated = sum(input.budgets, (row) => amount(row.allocated_amount));
  const budgetSpent = sum(input.budgets, (row) => amount(row.spent_amount));
  const collectedAmount = sum(settlements, (row) => amount(row.collected_amount));
  const customerTotal = sum(settlements, (row) => amount(row.customer_total));
  const deliveryRevenue = sum(settlements, (row) => amount(row.company_revenue ?? row.delivery_fee));

  return {
    ordersTotal: input.orders?.length ?? settlements.length,
    deliveredOrders,
    financiallyPostedOrders: postedOrders,
    unpostedDeliveredOrders: Math.max(0, deliveredOrders - postedOrders),
    goodsValue: sum(settlements, (row) => amount(row.goods_value)),
    deliveryRevenue,
    discounts: sum(settlements, (row) => amount(row.discount_amount)),
    customerTotal,
    collectedAmount,
    pendingCollection: Math.max(0, customerTotal - collectedAmount),
    merchantDue: sum(settlements, (row) => amount(row.merchant_due)),
    approvedExpenses,
    draftExpenses,
    adjustmentsNet,
    operatingNet: deliveryRevenue - approvedExpenses + adjustmentsNet,
    budgetAllocated,
    budgetSpent,
    budgetRemaining: budgetAllocated - budgetSpent,
  };
}

function summaryFromOrders(orders: Order[]): FinanceLedgerSummary {
  const delivered = orders.filter(isDelivered);
  const posted = delivered.filter((order) => Boolean(order.financial_posted_at));
  const financials = delivered.map((order) => financialsFromOrder(order as Order & Record<string, unknown>));
  const reduce = (key: keyof ReturnType<typeof financialsFromOrder>) =>
    financials.reduce((total, row) => total + amount(row[key]), 0);
  const customerTotal = reduce("customerTotal");
  const collectedAmount = delivered.reduce(
    (total, order) => total + amount(order.collected_amount ?? (order.financial_posted_at ? financialsFromOrder(order as Order & Record<string, unknown>).customerTotal : 0)),
    0,
  );
  const deliveryRevenue = reduce("companyRevenue");

  return {
    ordersTotal: orders.length,
    deliveredOrders: delivered.length,
    financiallyPostedOrders: posted.length,
    unpostedDeliveredOrders: Math.max(0, delivered.length - posted.length),
    goodsValue: reduce("goodsValue"),
    deliveryRevenue,
    discounts: reduce("discountAmount"),
    customerTotal,
    collectedAmount,
    pendingCollection: Math.max(0, customerTotal - collectedAmount),
    merchantDue: reduce("merchantDue"),
    approvedExpenses: 0,
    draftExpenses: 0,
    adjustmentsNet: 0,
    operatingNet: deliveryRevenue,
    budgetAllocated: 0,
    budgetSpent: 0,
    budgetRemaining: 0,
  };
}

async function selectRows(table: string, dateColumn: string, from: string, to: string) {
  if (!supabase) return [] as FinanceLedgerRow[];
  let query = supabase.from(table).select("*").order(dateColumn, { ascending: false }).limit(1000);
  if (from) query = query.gte(dateColumn, `${from}T00:00:00`);
  if (to) query = query.lte(dateColumn, `${to}T23:59:59.999`);
  const { data, error } = await query;
  if (error) {
    if (!isMissingSchemaError(error)) console.warn(`DAY NIGHT finance read failed for ${table}.`);
    return [] as FinanceLedgerRow[];
  }
  return rowsFrom(data);
}

async function selectBudgets(from: string, to: string) {
  if (!supabase) return [] as FinanceBudgetRow[];
  const { data, error } = await supabase
    .from("admin_finance_budget_status")
    .select("*")
    .lte("period_start", to)
    .gte("period_end", from)
    .order("period_start", { ascending: false })
    .limit(500);
  if (error) {
    if (!isMissingSchemaError(error)) console.warn("DAY NIGHT budget read failed.");
    return [] as FinanceBudgetRow[];
  }
  return budgetRowsFrom(data);
}

function normalizeSummary(raw: Record<string, unknown> | undefined): FinanceLedgerSummary | null {
  if (!raw) return null;
  const read = (...keys: string[]) => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null) return amount(raw[key]);
    }
    return 0;
  };
  return {
    ordersTotal: read("orders_total", "ordersTotal"),
    deliveredOrders: read("delivered_orders", "deliveredOrders"),
    financiallyPostedOrders: read("financially_posted_orders", "financiallyPostedOrders"),
    unpostedDeliveredOrders: read("unposted_delivered_orders", "unpostedDeliveredOrders"),
    goodsValue: read("goods_value", "goodsValue"),
    deliveryRevenue: read("delivery_revenue", "company_revenue", "deliveryRevenue"),
    discounts: read("discounts", "discount_amount"),
    customerTotal: read("customer_total", "customerTotal"),
    collectedAmount: read("collected_amount", "collectedAmount"),
    pendingCollection: read("pending_collection", "pendingCollection"),
    merchantDue: read("merchant_due", "merchantDue"),
    approvedExpenses: read("approved_expenses", "approvedExpenses"),
    draftExpenses: read("draft_expenses", "draftExpenses"),
    adjustmentsNet: read("adjustments_net", "adjustmentsNet"),
    operatingNet: read("operating_net", "operatingNet"),
    budgetAllocated: read("budget_allocated", "budgetAllocated"),
    budgetSpent: read("budget_spent", "budgetSpent"),
    budgetRemaining: read("budget_remaining", "budgetRemaining"),
  };
}

export async function fetchFinanceLedgerSnapshot(
  orders: Order[] = [],
  from = monthStart(),
  to = today(),
): Promise<FinanceLedgerSnapshot> {
  const emptyBase = {
    generatedAt: new Date().toISOString(),
    period: { from, to },
  };

  if (supabase) {
    const { data, error } = await supabase.rpc("admin_finance_operations_snapshot", {
      p_date_from: from,
      p_date_to: to,
    });
    if (!error && data && typeof data === "object") {
      const payload = data as Record<string, unknown>;
      const settlements = rowsFrom(payload.settlements);
      const expenses = rowsFrom(payload.expenses);
      const adjustments = rowsFrom(payload.adjustments);
      const budgets = budgetRowsFrom(payload.budgets);
      const summary = normalizeSummary(payload.summary as Record<string, unknown> | undefined) ||
        summaryFromTables({ orders, settlements, expenses, adjustments, budgets });
      return {
        ok: payload.ok !== false,
        source: "rpc",
        generatedAt: clean(payload.generated_at) || emptyBase.generatedAt,
        period: {
          from: clean((payload.period as Record<string, unknown> | undefined)?.from) || from,
          to: clean((payload.period as Record<string, unknown> | undefined)?.to) || to,
        },
        summary,
        settlements,
        accountEntries: rowsFrom(payload.account_entries),
        expenses,
        adjustments,
        budgets,
        driverEntries: rowsFrom(payload.driver_entries),
        auditEvents: rowsFrom(payload.audit_events),
      };
    }
    if (error && !isMissingSchemaError(error)) console.warn("DAY NIGHT finance snapshot RPC failed.");

    const [settlements, accountEntries, expenses, adjustments, budgets, driverEntries, auditEvents] = await Promise.all([
      selectRows("order_financial_settlements", "posted_at", from, to),
      selectRows("financial_account_entries", "posted_at", from, to),
      selectRows("admin_expenses", "created_at", from, to),
      selectRows("admin_adjustments", "created_at", from, to),
      selectBudgets(from, to),
      selectRows("driver_statement_entries", "created_at", from, to),
      selectRows("admin_audit_events", "created_at", from, to),
    ]);

    if (settlements.length || expenses.length || adjustments.length || budgets.length || accountEntries.length) {
      return {
        ok: true,
        source: "tables",
        ...emptyBase,
        summary: summaryFromTables({ orders, settlements, expenses, adjustments, budgets }),
        settlements,
        accountEntries,
        expenses,
        adjustments,
        budgets,
        driverEntries,
        auditEvents,
        warning: "Finance snapshot RPC is unavailable; verified production tables are being used.",
      };
    }
  }

  return {
    ok: orders.length >= 0,
    source: "orders",
    ...emptyBase,
    summary: summaryFromOrders(orders),
    settlements: [],
    accountEntries: [],
    expenses: [],
    adjustments: [],
    budgets: [],
    driverEntries: [],
    auditEvents: [],
    warning: "Finance migration or permissions are incomplete. Order data is shown without inventing ledger rows.",
  };
}

async function requireRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || name);
  return data as T;
}

export async function createFinanceExpense(input: ExpenseDraft) {
  const value = amount(input.amount);
  if (value <= 0) throw new Error("expense_amount_required");
  return requireRpc<FinanceLedgerRow>("admin_create_expense", {
    p_expense: {
      expense_date: input.expense_date || today(),
      category: clean(input.category) || "other",
      amount: value,
      payment_method: clean(input.payment_method) || "cash",
      reference_number: clean(input.reference_number) || null,
      notes: clean(input.notes) || null,
      status: "draft",
    },
  });
}

export async function setFinanceExpenseStatus(id: string, status: "approved" | "void", reason?: string) {
  return requireRpc<FinanceLedgerRow>("admin_set_expense_status", {
    p_expense_id: id,
    p_status: status,
    p_reason: clean(reason) || null,
  });
}

export async function createFinanceAdjustment(input: AdjustmentDraft) {
  const value = amount(input.amount);
  if (value <= 0 || !clean(input.reason)) throw new Error("adjustment_fields_required");
  return requireRpc<FinanceLedgerRow>("admin_create_adjustment", {
    p_adjustment: {
      adjustment_type: clean(input.adjustment_type) || "manual",
      direction: input.direction,
      amount: value,
      reference_number: clean(input.reference_number) || null,
      reason: clean(input.reason),
      notes: clean(input.notes) || null,
      merchant_id: clean(input.merchant_id) || null,
      order_id: clean(input.order_id) || null,
      driver_id: clean(input.driver_id) || null,
      status: "draft",
    },
  });
}

export async function setFinanceAdjustmentStatus(id: string, status: "approved" | "void", reason?: string) {
  return requireRpc<FinanceLedgerRow>("admin_set_adjustment_status", {
    p_adjustment_id: id,
    p_status: status,
    p_reason: clean(reason) || null,
  });
}

export async function upsertFinanceBudget(input: BudgetDraft) {
  const allocated = amount(input.allocated_amount);
  if (allocated < 0 || !clean(input.category) || !clean(input.period_start) || !clean(input.period_end)) {
    throw new Error("budget_fields_required");
  }
  return requireRpc<FinanceBudgetRow>("admin_upsert_finance_budget", {
    p_budget: {
      period_start: input.period_start,
      period_end: input.period_end,
      category: clean(input.category),
      allocated_amount: allocated,
      notes: clean(input.notes) || null,
    },
  });
}

export async function fetchFinanceHardeningHealth(): Promise<Record<string, unknown>> {
  if (!supabase) return { ok: false, reason: "supabase_not_configured" };
  const { data, error } = await supabase.rpc("admin_finance_hardening_health");
  if (error) return { ok: false, reason: isMissingSchemaError(error) ? "migration_required" : "permission_or_runtime_error" };
  return (data && typeof data === "object" ? data : { ok: false }) as Record<string, unknown>;
}

export async function fetchAuthoritativeDailyClosing(date = today()) {
  const live = await requireRpc<Record<string, unknown>>("admin_daily_closing_snapshot", { p_date: date });
  if (!supabase) return live;

  const { data: persisted, error } = await supabase
    .from("admin_daily_closings")
    .select("status, notes, reviewed_at, reviewed_by, updated_at")
    .eq("closing_date", date)
    .maybeSingle();

  if (error) {
    if (!isMissingSchemaError(error)) console.warn("DAY NIGHT persisted daily closing status read failed.");
    return live;
  }

  return persisted ? { ...live, ...persisted, source: "rpc" } : live;
}

export async function saveAuthoritativeDailyClosing(snapshot: Record<string, unknown>) {
  return requireRpc<FinanceLedgerRow>("admin_save_daily_closing", { p_snapshot: snapshot });
}
