import { supabase } from "../supabase";
import type { FinanceRow, FinanceSummary } from "./adminData";

export type AdminProductionSource = "db" | "unavailable";

export type AdminProductionFilters = {
  merchantId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
};

export type AdminProductionRowsResult = {
  rows: FinanceRow[];
  source: AdminProductionSource;
  table: string;
  synced: boolean;
  message?: string;
};

export type AdminProductionSyncResult = {
  ok: boolean;
  synced: boolean;
  details?: Record<string, unknown>;
  message?: string;
};

export type AdminProductionFinanceResult = {
  summary: FinanceSummary | null;
  source: AdminProductionSource;
  message?: string;
};

const emptyFinanceSummary: FinanceSummary = {
  total_income: 0,
  total_expenses: 0,
  cod_collected: 0,
  cod_pending: 0,
  cod_reconciled: 0,
  cod_total: 0,
  merchant_payable: 0,
  driver_payable: 0,
  net_estimate: 0,
  average_order_revenue: 0,
  total_orders: 0,
  active_orders: 0,
  delivered_orders: 0,
  cancelled_orders: 0,
  returned_orders: 0,
};

function numeric(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeMessage(error: unknown, fallback: string) {
  const message = String((error as { message?: string })?.message || error || "").toLowerCase();
  if (message.includes("does not exist") || message.includes("could not find") || message.includes("schema cache")) {
    return "Required admin database migration is not applied.";
  }

  if (message.includes("permission") || message.includes("row-level security") || message.includes("not_authorized")) {
    return "Signed-in admin does not have database permission for this operation.";
  }

  return fallback;
}

function normalizeFinance(row: Record<string, unknown> | null | undefined): FinanceSummary {
  const source = row || {};
  const summary = { ...emptyFinanceSummary };
  (Object.keys(summary) as Array<keyof FinanceSummary>).forEach((key) => {
    summary[key] = numeric(source[key]);
  });
  summary.cod_total = summary.cod_total || summary.cod_collected + summary.cod_pending;
  summary.net_estimate = summary.net_estimate || summary.total_income - summary.total_expenses;
  summary.average_order_revenue = summary.average_order_revenue || (summary.total_orders ? summary.total_income / summary.total_orders : 0);
  return summary;
}

export function productionTableForSection(id: string) {
  if (id === "expenses") return { table: "admin_expenses", dateColumn: "expense_date" };
  if (id === "adjustments") return { table: "admin_adjustments", dateColumn: "created_at" };
  if (id === "audit_log") return { table: "admin_audit_events", dateColumn: "created_at" };
  if (id === "print") return { table: "print_jobs", dateColumn: "created_at" };
  if (id === "cod") return { table: "cod_collections", dateColumn: "created_at" };
  if (id === "driver_statements") return { table: "driver_statement_entries", dateColumn: "entry_date" };
  if (id === "merchant_statements") return { table: "merchant_statement_entries", dateColumn: "entry_date" };
  if (id === "reports") return { table: "admin_audit_events", dateColumn: "created_at" };
  return { table: "orders", dateColumn: "created_at" };
}

export async function syncAdminProductionRows(): Promise<AdminProductionSyncResult> {
  if (!supabase) {
    return { ok: false, synced: false, message: "Supabase is not configured." };
  }

  const { data, error } = await supabase.rpc("admin_sync_order_operation_rows");
  if (error) {
    return {
      ok: false,
      synced: false,
      message: safeMessage(error, "Could not sync operation rows from database."),
    };
  }

  return {
    ok: true,
    synced: true,
    details: (data || {}) as Record<string, unknown>,
  };
}

async function fetchTableRows(table: string, dateColumn: string, filters: AdminProductionFilters = {}) {
  if (!supabase) throw new Error("Supabase is not configured.");

  let query = supabase.from(table).select("*");
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.merchantId) query = query.eq("merchant_id", filters.merchantId);
  if (filters.driverId) query = query.eq("driver_id", filters.driverId);
  if (filters.dateFrom) query = query.gte(dateColumn, filters.dateFrom);
  if (filters.dateTo) query = query.lte(dateColumn, filters.dateTo);

  const { data, error } = await query.order(dateColumn, { ascending: false }).limit(1000);
  if (error) throw error;
  return (data || []) as FinanceRow[];
}

export async function fetchProductionRows(sectionId: string, filters: AdminProductionFilters = {}): Promise<AdminProductionRowsResult> {
  const { table, dateColumn } = productionTableForSection(sectionId);
  const sync = await syncAdminProductionRows();

  if (!supabase) {
    return { rows: [], source: "unavailable", table, synced: false, message: "Supabase is not configured." };
  }

  try {
    if (sectionId === "reports") {
      const [expenses, adjustments, cod, merchant, driver, print, audit] = await Promise.all([
        fetchTableRows("admin_expenses", "expense_date", filters).catch(() => [] as FinanceRow[]),
        fetchTableRows("admin_adjustments", "created_at", filters).catch(() => [] as FinanceRow[]),
        fetchTableRows("cod_collections", "created_at", filters).catch(() => [] as FinanceRow[]),
        fetchTableRows("merchant_statement_entries", "entry_date", filters).catch(() => [] as FinanceRow[]),
        fetchTableRows("driver_statement_entries", "entry_date", filters).catch(() => [] as FinanceRow[]),
        fetchTableRows("print_jobs", "created_at", filters).catch(() => [] as FinanceRow[]),
        fetchTableRows("admin_audit_events", "created_at", filters).catch(() => [] as FinanceRow[]),
      ]);
      return { rows: [...expenses, ...adjustments, ...cod, ...merchant, ...driver, ...print, ...audit], source: "db", table: "admin_production_tables", synced: sync.synced, message: sync.message };
    }

    const rows = await fetchTableRows(table, dateColumn, filters);
    return { rows, source: "db", table, synced: sync.synced, message: sync.message };
  } catch (error) {
    return {
      rows: [],
      source: "unavailable",
      table,
      synced: sync.synced,
      message: safeMessage(error, `Could not read ${table} from database.`),
    };
  }
}

export async function fetchProductionFinanceSummary(): Promise<AdminProductionFinanceResult> {
  const sync = await syncAdminProductionRows();
  if (!supabase) return { summary: null, source: "unavailable", message: "Supabase is not configured." };

  const rpc = await supabase.rpc("get_finance_summary");
  if (!rpc.error && rpc.data) {
    return { summary: normalizeFinance(Array.isArray(rpc.data) ? rpc.data[0] : rpc.data as Record<string, unknown>), source: "db", message: sync.message };
  }

  const view = await supabase.from("finance_summary").select("*").maybeSingle();
  if (!view.error && view.data) {
    return { summary: normalizeFinance(view.data as Record<string, unknown>), source: "db", message: sync.message };
  }

  return {
    summary: null,
    source: "unavailable",
    message: safeMessage(rpc.error || view.error, "Finance summary is not connected to the database."),
  };
}

export function rowAmount(row: FinanceRow, keys: string[]) {
  for (const key of keys) {
    const value = numeric(row[key]);
    if (value > 0) return value;
  }
  return 0;
}

export function rowDebit(row: FinanceRow) {
  return rowAmount(row, ["debit", "expense_amount"]);
}

export function rowCredit(row: FinanceRow) {
  return rowAmount(row, ["credit", "amount", "cod_amount", "collected_amount", "delivery_fee", "payout_amount"]);
}

export function rowBalance(row: FinanceRow) {
  return rowAmount(row, ["balance", "net_amount", "cod_amount", "collected_amount", "amount", "credit"]);
}

export function rowDate(row: FinanceRow) {
  return String(row.entry_date || row.expense_date || row.collection_date || row.printed_at || clean(row.created_at) || new Date().toISOString()).slice(0, 10);
}

export function rowReference(row: FinanceRow) {
  return String(row.tracking_number || row.reference_number || row.entity_id || row.order_id || row.id || "—");
}

export function rowType(row: FinanceRow) {
  return String(row.entry_type || row.adjustment_type || row.job_type || row.category || row.action || row.status || "—");
}

export function rowNotes(row: FinanceRow) {
  return String(row.notes || row.reason || row.entity_type || row.file_name || "—");
}

export function summarizeRows(rows: FinanceRow[]) {
  const debit = rows.reduce((sum, row) => sum + rowDebit(row), 0);
  const credit = rows.reduce((sum, row) => sum + rowCredit(row), 0);
  return {
    count: rows.length,
    debit,
    credit,
    balance: rows.reduce((sum, row) => sum + rowBalance(row), 0),
    pending: rows.filter((row) => /draft|pending|queued/.test(String(row.status || ""))).length,
  };
}

export async function fetchProductionCodRows() {
  const result = await fetchProductionRows("cod");
  const rows = result.rows;
  return {
    ...result,
    total: rows.reduce((sum, row) => sum + rowAmount(row, ["cod_amount", "amount", "credit"]), 0),
    collected: rows.reduce((sum, row) => sum + rowAmount(row, ["collected_amount"]), 0),
    reconciled: rows.reduce((sum, row) => sum + rowAmount(row, ["reconciled_amount"]), 0),
    pending: rows.reduce((sum, row) => sum + Math.max(0, rowAmount(row, ["cod_amount", "amount", "credit"]) - rowAmount(row, ["reconciled_amount", "collected_amount"])), 0),
  };
}

export async function fetchProductionStatementSummary(kind: "merchant" | "driver", filters: AdminProductionFilters = {}) {
  const result = await fetchProductionRows(kind === "merchant" ? "merchant_statements" : "driver_statements", filters);
  const debit = result.rows.reduce((sum, row) => sum + rowDebit(row), 0);
  const credit = result.rows.reduce((sum, row) => sum + rowCredit(row), 0);
  return {
    ...result,
    debit,
    credit,
    balance: result.rows.length ? rowBalance(result.rows[result.rows.length - 1]) || credit - debit : credit - debit,
  };
}
