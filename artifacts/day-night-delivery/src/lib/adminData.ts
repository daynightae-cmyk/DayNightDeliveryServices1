import { supabase } from "../supabase";
import type { Merchant, Order } from "../types";
import { calculateDomesticPrice, calculateInternationalPrice } from "./pricing";
import { createDayNightInvoiceNumber } from "./printableDocuments";

function clean(value?: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function merchantCode(seed?: string) {
  const suffix = clean(seed).replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) || "SHOP";
  const serial = Date.now().toString(36).toUpperCase().slice(-5);
  return `DN-MER-${suffix}-${serial}`;
}

function removeEmptyUndefined<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;
}

function isMissingSchemaError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || "").toLowerCase();
  return message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("permission denied") ||
    message.includes("violates row-level security") ||
    message.includes("not_authorized");
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc(fn, args);
  if (!error && data) return data as T;

  if (error) {
    console.warn(`${fn} RPC failed. Falling back where possible:`, error.message);
  }
  return null;
}

export type MerchantInput = {
  trade_name: string;
  owner_name?: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  emirate?: string;
  city?: string;
  address?: string;
  pickup_address?: string;
  license_number?: string;
  trn?: string;
  tax_number?: string;
  logo_url?: string;
  bank_name?: string;
  iban?: string;
  settlement_cycle?: string;
  commission_type?: string;
  default_payment_method?: string;
  notes?: string;
  status?: string;
};

export type AdminOrderInput = {
  merchant?: Merchant | null;
  merchant_id?: string;
  merchant_name?: string;
  merchant_code?: string;
  coupon_number?: string;
  shipping_scope: "local" | "international";
  order_count: number;
  pickup_city: string;
  delivery_city: string;
  destination_country?: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  package_type: string;
  package_description?: string;
  weight?: number;
  payment_method: string;
  cod_amount?: number | string | null;
  notes?: string;
  status?: string;
};

export async function fetchMerchants(): Promise<Merchant[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Failed to fetch merchants:", error.message);
    return [];
  }

  return (data || []) as Merchant[];
}

export async function createMerchant(input: MerchantInput): Promise<Merchant> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const now = new Date().toISOString();
  const payload = removeEmptyUndefined({
    merchant_code: merchantCode(input.trade_name),
    trade_name: clean(input.trade_name),
    owner_name: clean(input.owner_name),
    phone: clean(input.phone),
    alt_phone: clean(input.alt_phone),
    email: clean(input.email).toLowerCase(),
    emirate: clean(input.emirate),
    city: clean(input.city),
    address: clean(input.address),
    pickup_address: clean(input.pickup_address || input.address),
    license_number: clean(input.license_number),
    trn: clean(input.trn || input.tax_number),
    tax_number: clean(input.tax_number || input.trn),
    logo_url: clean(input.logo_url),
    bank_name: clean(input.bank_name),
    iban: clean(input.iban),
    settlement_cycle: clean(input.settlement_cycle || "weekly"),
    commission_type: clean(input.commission_type || "fixed_delivery_fee"),
    default_payment_method: clean(input.default_payment_method || "sender_pays"),
    notes: clean(input.notes),
    status: clean(input.status || "active"),
    created_at: now,
    updated_at: now,
  });

  const rpcMerchant = await callRpc<Merchant>("admin_create_merchant", { p_merchant: payload });
  if (rpcMerchant?.id) return rpcMerchant;

  const { data, error } = await supabase
    .from("merchants")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Merchant;
}

export function calculateAdminOrderPrice(input: AdminOrderInput) {
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));
  if (input.shipping_scope === "international") {
    const intl = calculateInternationalPrice({ destination: input.destination_country || "WORLD", weight: numberValue(input.weight, 1) });
    return {
      unitPrice: intl.total,
      total: Number((intl.total * count).toFixed(2)),
      breakdown: [...intl.breakdown, `Admin order count: ${count} x ${intl.total.toFixed(2)} AED`],
      pricingCategory: intl.pricingCategory,
    };
  }

  const local = calculateDomesticPrice({ pickupCity: input.pickup_city, deliveryCity: input.delivery_city, pieces: count, serviceType: "standard" });
  return {
    unitPrice: count > 0 ? Number((local.total / count).toFixed(2)) : local.total,
    total: local.total,
    breakdown: local.breakdown,
    pricingCategory: local.pricingCategory,
  };
}

function buildLegacyAdminOrderPayload(payload: Record<string, unknown>) {
  const legacy = { ...payload };
  for (const key of [
    "invoice_number",
    "coupon_number",
    "merchant_id",
    "merchant_name",
    "merchant_code",
    "order_count",
    "shipping_scope",
    "destination_country",
    "source_channel",
    "package_description",
    "source_domain",
    "subtotal",
    "base_price",
    "total",
    "total_price",
    "amount",
    "price",
    "currency",
    "status_history",
  ]) {
    delete legacy[key];
  }
  return legacy;
}

export async function createAdminOrder(input: AdminOrderInput): Promise<Order> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const merchant = input.merchant || null;
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));
  const pricing = calculateAdminOrderPrice({ ...input, order_count: count });
  const createdAt = new Date().toISOString();
  const trackingSeed = clean(input.coupon_number) || `${merchant?.merchant_code || "ADMIN"}-${Date.now().toString(36)}`;
  const invoiceNumber = createDayNightInvoiceNumber(trackingSeed, new Date(createdAt));
  const senderName = clean(merchant?.trade_name || input.merchant_name || "DAY NIGHT Merchant");
  const senderPhone = clean(merchant?.phone || "971568757331");
  const senderCity = clean(merchant?.city || merchant?.emirate || input.pickup_city || "Abu Dhabi");
  const senderAddress = clean(merchant?.pickup_address || merchant?.address || senderCity);
  const description = clean(input.package_description || input.package_type || "Admin shipment");
  const paymentMethod = clean(input.payment_method || merchant?.default_payment_method || "sender_pays");
  const isInternational = input.shipping_scope === "international";
  const receiverCity = isInternational
    ? clean(input.destination_country || input.delivery_city || "WORLD")
    : clean(input.delivery_city || "Dubai");
  const deliveryWeight = isInternational ? Math.max(1, numberValue(input.weight, 1)) : 1;

  const payload: Record<string, unknown> = removeEmptyUndefined({
    invoice_number: invoiceNumber,
    coupon_number: clean(input.coupon_number),
    merchant_id: merchant?.id || clean(input.merchant_id) || null,
    merchant_name: senderName,
    merchant_code: merchant?.merchant_code || clean(input.merchant_code),
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? clean(input.destination_country || receiverCity || "WORLD") : null,
    source_channel: "admin_panel",
    source_domain: "daynightae.com",
    sender_name: senderName,
    sender_phone: senderPhone,
    sender_city: senderCity,
    sender_address: senderAddress,
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: clean(input.receiver_address),
    package_type: description,
    package_description: description,
    weight: deliveryWeight,
    pieces: count,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? Math.max(0, numberValue(input.cod_amount, 0)) : null,
    delivery_price: pricing.total,
    subtotal: pricing.total,
    base_price: pricing.total,
    total: pricing.total,
    total_price: pricing.total,
    amount: pricing.total,
    price: pricing.total,
    currency: "AED",
    notes: clean(input.notes) || "N/A",
    status: clean(input.status || "pending"),
    created_at: createdAt,
    updated_at: createdAt,
    status_history: [{ status: clean(input.status || "pending"), date: createdAt, note: "Created from DAY NIGHT admin merchant operations hub" }],
  });

  const rpcOrder = await callRpc<Order>("admin_create_coupon_order", { p_order: payload });
  if (rpcOrder?.id || rpcOrder?.invoice_number) return rpcOrder;

  for (const candidate of [payload, buildLegacyAdminOrderPayload(payload)]) {
    const { data, error } = await supabase
      .from("orders")
      .insert(candidate)
      .select("*")
      .single();

    if (!error && data) return data as Order;
    if (error && !isMissingSchemaError(error)) throw new Error(error.message);
    if (error) console.warn("Admin order insert fallback failed:", error.message);
  }

  throw new Error("Order could not be created. Confirm the admin SQL migration was applied and the signed-in user has admin/support role.");
}

export type AdminStats = {
  pending: number;
  in_transit: number;
  delivered: number;
  cancelled: number;
  total_orders: number;
  today_orders: number;
  active_merchants: number;
  cod_total: number;
  delivery_income: number;
};

export type ExpenseInput = {
  category_id?: string;
  account_id?: string;
  amount: number | string;
  vat_amount?: number | string;
  payment_method?: string;
  paid_at?: string;
  receipt_url?: string;
  notes?: string;
  status?: string;
};

export type FinanceSummary = {
  total_income: number;
  total_expenses: number;
  cod_collected: number;
  cod_pending: number;
  cod_reconciled: number;
  cod_total: number;
  merchant_payable: number;
  driver_payable: number;
  net_estimate: number;
  average_order_revenue: number;
  total_orders: number;
  active_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
};

export type FinanceSummarySource = "rpc" | "view" | "derived";
export type FinanceSummaryResult = { summary: FinanceSummary; source: FinanceSummarySource; warning?: string };

export type FinanceRow = Record<string, unknown> & { id?: string; created_at?: string; status?: string };

function orderStatus(order: Order) {
  return clean(order.status).toLowerCase().replace(/[\s-]+/g, "_");
}

function orderDeliveryIncome(order: Order) {
  return numberValue(order.delivery_price ?? order.price ?? order.base_price, 0);
}

export async function fetchAdminOrders(): Promise<Order[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    console.warn("Failed to fetch admin orders:", error.message);
    return [];
  }
  return (data || []) as Order[];
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const fallback: AdminStats = { pending: 0, in_transit: 0, delivered: 0, cancelled: 0, total_orders: 0, today_orders: 0, active_merchants: 0, cod_total: 0, delivery_income: 0 };
  const [ordersResult, merchantsResult] = await Promise.allSettled([fetchAdminOrders(), fetchMerchants()]);
  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
  const merchants = merchantsResult.status === "fulfilled" ? merchantsResult.value : [];
  const today = new Date().toISOString().slice(0, 10);
  return orders.reduce<AdminStats>((stats, order) => {
    const status = orderStatus(order);
    stats.total_orders += 1;
    if (String(order.created_at || "").slice(0, 10) === today) stats.today_orders += 1;
    if (status.includes("deliver") || status.includes("complete")) stats.delivered += 1;
    else if (status.includes("cancel") || status.includes("fail")) stats.cancelled += 1;
    else if (status.includes("transit") || status.includes("assign") || status.includes("pick")) stats.in_transit += 1;
    else stats.pending += 1;
    stats.cod_total += numberValue(order.cod_amount, 0);
    stats.delivery_income += orderDeliveryIncome(order);
    return stats;
  }, { ...fallback, active_merchants: merchants.filter((m) => clean(m.status || "active").toLowerCase() !== "paused").length });
}

export async function updateOrderStatus(orderId: string, status: string, note?: string): Promise<Order | null> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const rpcOrder = await callRpc<Order>("admin_update_order_status", { p_order_id: orderId, p_status: clean(status), p_note: clean(note || "Admin status update") });
  if (rpcOrder?.id) return rpcOrder;
  const { data, error } = await supabase
    .from("orders")
    .update({ status: clean(status), updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Order;
}

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

function normalizeFinanceSummary(row: Partial<FinanceSummary> | Record<string, unknown> | null | undefined): FinanceSummary {
  const source = row || {};
  const summary = { ...emptyFinanceSummary };
  (Object.keys(summary) as Array<keyof FinanceSummary>).forEach((key) => {
    summary[key] = numberValue((source as Record<string, unknown>)[key], summary[key]);
  });
  summary.cod_total = summary.cod_total || summary.cod_collected + summary.cod_pending;
  summary.net_estimate = summary.net_estimate || summary.total_income - summary.total_expenses;
  summary.average_order_revenue = summary.average_order_revenue || (summary.total_orders ? summary.total_income / summary.total_orders : 0);
  return summary;
}

async function deriveFinanceSummaryFromOrders(): Promise<FinanceSummary> {
  const [ordersResult, expensesResult, adjustmentsResult, codResult] = await Promise.allSettled([
    fetchAdminOrders(),
    fetchExpenses(),
    fetchAdjustments(),
    fetchCodCollections(),
  ]);
  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
  const expenses = expensesResult.status === "fulfilled" ? expensesResult.value : [];
  const adjustments = adjustmentsResult.status === "fulfilled" ? adjustmentsResult.value : [];
  const codRows = codResult.status === "fulfilled" ? codResult.value : [];
  const delivered = orders.filter((order) => /deliver|complete/.test(orderStatus(order)));
  const cancelled = orders.filter((order) => /cancel|fail/.test(orderStatus(order)));
  const returned = orders.filter((order) => /return/.test(orderStatus(order)));
  const active = orders.filter((order) => !/deliver|complete|cancel|fail|return/.test(orderStatus(order)));
  const totalIncome = orders.reduce((sum, order) => sum + orderDeliveryIncome(order), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + numberValue(row.amount ?? row.total ?? row.debit, 0), 0);
  const adjustmentsNet = adjustments.reduce((sum, row) => {
    const direction = clean(row.direction).toLowerCase();
    const amount = numberValue(row.amount ?? row.credit ?? row.debit, 0);
    return sum + (direction === "negative" ? -amount : amount);
  }, 0);
  const orderCodTotal = orders.reduce((sum, order) => sum + numberValue(order.cod_amount, 0), 0);
  const codCollected = codRows.length ? codRows.reduce((sum, row) => sum + numberValue(row.collected_amount ?? row.amount, 0), 0) : delivered.reduce((sum, order) => sum + numberValue(order.cod_amount, 0), 0);
  const codReconciled = codRows.filter((row) => /reconcile|closed/.test(clean(row.status).toLowerCase())).reduce((sum, row) => sum + numberValue(row.collected_amount ?? row.cod_amount ?? row.amount, 0), 0);
  const codPending = Math.max(0, orderCodTotal - codCollected);
  return normalizeFinanceSummary({
    total_income: totalIncome,
    total_expenses: totalExpenses,
    cod_collected: codCollected,
    cod_pending: codPending,
    cod_reconciled: codReconciled,
    cod_total: orderCodTotal,
    merchant_payable: Math.max(0, orderCodTotal - totalIncome),
    driver_payable: Math.max(0, delivered.length * 5),
    net_estimate: totalIncome - totalExpenses + adjustmentsNet,
    average_order_revenue: orders.length ? totalIncome / orders.length : 0,
    total_orders: orders.length,
    active_orders: active.length,
    delivered_orders: delivered.length,
    cancelled_orders: cancelled.length,
    returned_orders: returned.length,
  });
}

export async function fetchFinanceSummary(): Promise<FinanceSummaryResult> {
  if (!supabase) return { summary: await deriveFinanceSummaryFromOrders(), source: "derived", warning: "Finance summary temporarily derived from orders" };

  const rpc = await supabase.rpc("get_finance_summary");
  if (!rpc.error && rpc.data) return { summary: normalizeFinanceSummary(Array.isArray(rpc.data) ? rpc.data[0] : rpc.data), source: "rpc" };
  if (rpc.error && !isMissingSchemaError(rpc.error)) console.warn("finance_summary rpc unavailable:", rpc.error.message);

  const view = await supabase.from("finance_summary").select("*").maybeSingle();
  if (!view.error && view.data) return { summary: normalizeFinanceSummary(view.data), source: "view" };
  if (view.error && !isMissingSchemaError(view.error)) console.warn("finance_summary view unavailable:", view.error.message);

  return { summary: await deriveFinanceSummaryFromOrders(), source: "derived", warning: "Finance summary temporarily derived from orders" };
}


export type AdminDateFilters = { dateFrom?: string; dateTo?: string; status?: string; merchantId?: string; driverId?: string; orderId?: string; category?: string; type?: string };
export type AdminExpensePayload = { expense_date?: string; category: string; amount: number | string; payment_method?: string; status?: string; notes?: string; reference_number?: string; attachment_url?: string };
export type AdminAdjustmentPayload = { adjustment_type: string; direction: "positive" | "negative"; amount: number | string; order_id?: string; merchant_id?: string; driver_id?: string; reason: string; notes?: string; status?: string };
export type StatementEntryPayload = Record<string, unknown> & { merchant_id?: string; driver_id?: string; order_id?: string; tracking_number?: string; entry_date?: string; entry_type: string; debit?: number; credit?: number; balance?: number; notes?: string };
export type ImportRowValidation = { rowIndex: number; raw: Record<string, unknown>; normalized: Record<string, unknown>; errors: string[]; status: "valid" | "invalid"; duplicateWarning?: string };

function cleanAdminError(error: unknown, fallback = "Admin operation is temporarily unavailable.") {
  if (error) console.warn("Admin operation technical detail:", (error as { message?: string })?.message || error);
  return new Error(fallback);
}

function applyAdminFilters(query: any, filters?: AdminDateFilters, dateColumn = "created_at") {
  let next = query;
  if (filters?.status) next = next.eq("status", filters.status);
  if (filters?.merchantId) next = next.eq("merchant_id", filters.merchantId);
  if (filters?.driverId) next = next.eq("driver_id", filters.driverId);
  if (filters?.orderId) next = next.eq("order_id", filters.orderId);
  if (filters?.category) next = next.eq("category", filters.category);
  if (filters?.type) next = next.eq("entry_type", filters.type);
  if (filters?.dateFrom) next = next.gte(dateColumn, filters.dateFrom);
  if (filters?.dateTo) next = next.lte(dateColumn, filters.dateTo);
  return next;
}

async function fetchTableRows(table: string, filters?: AdminDateFilters, dateColumn = "created_at") {
  if (!supabase) return [] as FinanceRow[];
  const { data, error } = await applyAdminFilters(supabase.from(table).select("*"), filters, dateColumn).order(dateColumn, { ascending: false }).limit(1000);
  if (error) {
    if (isMissingSchemaError(error)) return [] as FinanceRow[];
    throw cleanAdminError(error);
  }
  return (data || []) as FinanceRow[];
}

async function insertTableRow(table: string, payload: Record<string, unknown>) {
  if (!supabase) throw cleanAdminError(null, "Supabase is not configured.");
  const { data, error } = await supabase.from(table).insert(removeEmptyUndefined(payload)).select("*").single();
  if (error) throw cleanAdminError(error);
  return data as FinanceRow;
}

async function updateTableRow(table: string, id: string, payload: Record<string, unknown>) {
  if (!supabase) throw cleanAdminError(null, "Supabase is not configured.");
  const { data, error } = await supabase.from(table).update(removeEmptyUndefined({ ...payload, updated_at: new Date().toISOString() })).eq("id", id).select("*").single();
  if (error) throw cleanAdminError(error);
  return data as FinanceRow;
}

export async function createAdminAuditEvent(payload: { entity_type: string; entity_id?: string; action: string; before_data?: unknown; after_data?: unknown; metadata?: unknown }): Promise<FinanceRow | null> {
  if (!supabase) return null;
  const user = await supabase.auth.getUser().catch(() => null);
  const actor = user?.data?.user;
  try {
    return await insertTableRow("admin_audit_events", { ...payload, actor_id: actor?.id, actor_email: actor?.email, created_at: new Date().toISOString() });
  } catch (error) { console.warn("Audit event skipped:", (error as Error).message); return null; }
}

export async function fetchExpenses(filters?: AdminDateFilters): Promise<FinanceRow[]> {
  const adminRows = await fetchTableRows("admin_expenses", filters, "expense_date");
  if (adminRows.length) return adminRows;
  return fetchTableRows("expenses", filters, "created_at");
}

export async function createExpense(input: AdminExpensePayload | ExpenseInput): Promise<FinanceRow> {
  const row = await insertTableRow("admin_expenses", { expense_date: (input as AdminExpensePayload).expense_date || new Date().toISOString().slice(0, 10), category: (input as AdminExpensePayload).category || "other", amount: Math.max(0, numberValue(input.amount, 0)), payment_method: input.payment_method || "cash", status: input.status || "draft", notes: input.notes, reference_number: (input as AdminExpensePayload).reference_number, attachment_url: (input as AdminExpensePayload).attachment_url, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  void createAdminAuditEvent({ entity_type: "admin_expense", entity_id: String(row.id || ""), action: "create", after_data: row });
  return row;
}

export async function approveExpense(id: string): Promise<FinanceRow> {
  const row = await updateTableRow("admin_expenses", id, { status: "approved", approved_at: new Date().toISOString() });
  void createAdminAuditEvent({ entity_type: "admin_expense", entity_id: id, action: "approve", after_data: row });
  return row;
}

export async function voidExpense(expenseId: string, reason: string): Promise<FinanceRow> {
  const row = await updateTableRow("admin_expenses", expenseId, { status: "void", voided_at: new Date().toISOString(), notes: reason || "Voided by admin" });
  void createAdminAuditEvent({ entity_type: "admin_expense", entity_id: expenseId, action: "void", metadata: { reason } });
  return row;
}

export async function fetchAdjustments(filters?: AdminDateFilters): Promise<FinanceRow[]> { return fetchTableRows("admin_adjustments", filters, "created_at"); }
export async function createAdjustment(payload: AdminAdjustmentPayload): Promise<FinanceRow> { const row = await insertTableRow("admin_adjustments", { ...payload, amount: Math.max(0, numberValue(payload.amount, 0)), status: payload.status || "draft", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); void createAdminAuditEvent({ entity_type: "admin_adjustment", entity_id: String(row.id || ""), action: "create", after_data: row }); return row; }
export async function approveAdjustment(id: string): Promise<FinanceRow> { const row = await updateTableRow("admin_adjustments", id, { status: "approved", approved_at: new Date().toISOString() }); void createAdminAuditEvent({ entity_type: "admin_adjustment", entity_id: id, action: "approve", after_data: row }); return row; }
export async function voidAdjustment(id: string, reason: string): Promise<FinanceRow> { const row = await updateTableRow("admin_adjustments", id, { status: "void", voided_at: new Date().toISOString(), notes: reason }); void createAdminAuditEvent({ entity_type: "admin_adjustment", entity_id: id, action: "void", metadata: { reason } }); return row; }

export async function fetchCodCollections(filters?: AdminDateFilters): Promise<FinanceRow[]> { return fetchTableRows("cod_collections", filters, "created_at"); }
export async function createOrSyncCodCollectionFromOrder(order: Order): Promise<FinanceRow | null> { if (!Number(order.cod_amount || 0)) return null; const row = await insertTableRow("cod_collections", { order_id: order.id, merchant_id: order.merchant_id, driver_id: (order as any).driver_id || (order as any).assigned_driver_id, tracking_number: order.tracking_number || order.invoice_number, cod_amount: numberValue(order.cod_amount, 0), collected_amount: 0, status: "pending" }); void createAdminAuditEvent({ entity_type: "cod_collection", entity_id: String(row.id || ""), action: "sync_from_order", after_data: row }); return row; }
export async function markCodCollected(id: string, amount: number | string, notes?: string): Promise<FinanceRow> { const row = await updateTableRow("cod_collections", id, { status: "collected", collected_amount: numberValue(amount, 0), collection_date: new Date().toISOString().slice(0, 10), notes }); void createAdminAuditEvent({ entity_type: "cod_collection", entity_id: id, action: "mark_collected", after_data: row }); return row; }
export async function markCodReconciled(id: string, notes?: string): Promise<FinanceRow> { const row = await updateTableRow("cod_collections", id, { status: "reconciled", reconciled_at: new Date().toISOString(), notes }); void createAdminAuditEvent({ entity_type: "cod_collection", entity_id: id, action: "mark_reconciled", after_data: row }); return row; }

export async function fetchDriverStatementEntries(filters?: AdminDateFilters): Promise<FinanceRow[]> { return fetchTableRows("driver_statement_entries", filters, "entry_date"); }
export async function createDriverStatementEntry(payload: StatementEntryPayload): Promise<FinanceRow> { return insertTableRow("driver_statement_entries", { ...payload, entry_date: payload.entry_date || new Date().toISOString().slice(0, 10) }); }
export function deriveDriverStatementFromOrders(driverId: string | undefined, orders: Order[] = [], filters?: AdminDateFilters): FinanceRow[] { let balance = 0; return orders.filter((o:any)=>!driverId || o.driver_id===driverId || o.assigned_driver_id===driverId).filter((o)=>!filters?.dateFrom || String(o.created_at || "") >= filters.dateFrom!).map((o:any)=>{ const credit = /deliver|complete/.test(orderStatus(o)) ? orderDeliveryIncome(o) : 0; const debit = numberValue(o.cod_amount, 0); balance += credit - debit; return { id: `derived-driver-${o.id}`, driver_id: o.driver_id || o.assigned_driver_id || "unassigned", order_id: o.id, tracking_number: o.tracking_number || o.invoice_number, entry_date: String(o.created_at || new Date().toISOString()).slice(0,10), entry_type: debit ? "cod_collected" : "delivery_earning", debit, credit, balance, notes: "Derived from orders because driver statement entries are empty.", created_at: o.created_at } as FinanceRow; }); }

export async function fetchMerchantStatementEntries(filters?: AdminDateFilters): Promise<FinanceRow[]> { return fetchTableRows("merchant_statement_entries", filters, "entry_date"); }
export async function createMerchantStatementEntry(payload: StatementEntryPayload): Promise<FinanceRow> { return insertTableRow("merchant_statement_entries", { ...payload, entry_date: payload.entry_date || new Date().toISOString().slice(0, 10) }); }
export function deriveMerchantStatementFromOrders(merchantId: string | undefined, orders: Order[] = [], filters?: AdminDateFilters): FinanceRow[] { let balance = 0; return orders.filter((o)=>!merchantId || o.merchant_id===merchantId).filter((o)=>!filters?.dateFrom || String(o.created_at || "") >= filters.dateFrom!).flatMap((o:any)=>{ const cod = numberValue(o.cod_amount,0); const fee = orderDeliveryIncome(o); balance += cod - fee; return [{ id:`derived-merchant-cod-${o.id}`, merchant_id:o.merchant_id || "unknown", order_id:o.id, tracking_number:o.tracking_number || o.invoice_number, entry_date:String(o.created_at || new Date().toISOString()).slice(0,10), entry_type:"order_cod", debit:0, credit:cod, balance, notes:"Derived COD from orders.", created_at:o.created_at }, { id:`derived-merchant-fee-${o.id}`, merchant_id:o.merchant_id || "unknown", order_id:o.id, tracking_number:o.tracking_number || o.invoice_number, entry_date:String(o.created_at || new Date().toISOString()).slice(0,10), entry_type:"delivery_fee", debit:fee, credit:0, balance: balance - fee, notes:"Derived delivery fee from orders.", created_at:o.created_at }] as FinanceRow[]; }); }

export async function fetchAdminAuditEvents(filters?: AdminDateFilters): Promise<FinanceRow[]> { return fetchTableRows("admin_audit_events", filters, "created_at"); }

export async function createImportBatch(payload: { merchant_id?: string; file_name: string; import_mode: string; total_rows?: number; valid_rows?: number; invalid_rows?: number }): Promise<FinanceRow> { return insertTableRow("import_batches", { ...payload, status: "preview", created_at: new Date().toISOString() }); }
export function validateImportRows(rows: Record<string, unknown>[], merchantId?: string): ImportRowValidation[] { const seen = new Set<string>(); return rows.map((raw, index)=>{ const normalized = { merchant_id: merchantId, receiver_name: clean(raw.receiver_name || raw.name), receiver_phone: clean(raw.receiver_phone || raw.phone), receiver_city: clean(raw.city || raw.receiver_city), receiver_address: clean(raw.address || raw.receiver_address), cod_amount: numberValue(raw.cod_amount, 0), notes: clean(raw.notes) }; const errors = [!normalized.receiver_name && "receiver_name required", !normalized.receiver_phone && "receiver_phone required", !normalized.receiver_city && "city required", !normalized.receiver_address && "address required"].filter(Boolean) as string[]; const dupKey = normalized.receiver_phone; const duplicateWarning = dupKey && seen.has(dupKey) ? "duplicate phone in file" : undefined; if (dupKey) seen.add(dupKey); return { rowIndex:index+1, raw, normalized, errors: duplicateWarning ? [...errors, duplicateWarning] : errors, status: errors.length ? "invalid" : "valid", duplicateWarning }; }); }
export async function saveImportPreviewRows(batchId: string, rows: ImportRowValidation[]): Promise<FinanceRow[]> { if (!supabase) return []; const payload = rows.map((row)=>({ batch_id: batchId, row_index: row.rowIndex, raw_payload: row.raw, normalized_payload: row.normalized, validation_errors: row.errors, status: row.status })); const { data, error } = await supabase.from("import_batch_rows").insert(payload).select("*"); if (error) throw cleanAdminError(error); return (data || []) as FinanceRow[]; }
export async function commitValidImportRows(batchId: string): Promise<{ created: number; message: string }> { void createAdminAuditEvent({ entity_type: "import_batch", entity_id: batchId, action: "commit_preview", metadata: { mode: "requires server order creation" } }); return { created: 0, message: "Preview rows saved. Order creation must be confirmed with the admin order workflow before marking import as completed." }; }

export async function createPrintJob(payload: { job_type: string; language: string; order_ids?: unknown[]; merchant_id?: string; filters?: unknown; pdf_payload?: unknown }): Promise<FinanceRow> { const row = await insertTableRow("print_jobs", { ...payload, status: "queued", order_ids: payload.order_ids || [], filters: payload.filters || {}, pdf_payload: payload.pdf_payload || {}, created_at: new Date().toISOString() }); void createAdminAuditEvent({ entity_type: "print_job", entity_id: String(row.id || ""), action: "create", after_data: row }); return row; }
export async function fetchPrintJobs(filters?: AdminDateFilters): Promise<FinanceRow[]> { return fetchTableRows("print_jobs", filters, "created_at"); }
export async function markPrintJobPrinted(id: string): Promise<FinanceRow> { const row = await updateTableRow("print_jobs", id, { status: "printed", printed_at: new Date().toISOString() }); void createAdminAuditEvent({ entity_type: "print_job", entity_id: id, action: "mark_printed", after_data: row }); return row; }

export async function fetchLedgerEntries(): Promise<FinanceRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("ledger_entries").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) {
    console.warn("Failed to fetch ledger entries:", error.message);
    return [];
  }
  return (data || []) as FinanceRow[];
}

export async function fetchMerchantStatements(): Promise<FinanceRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("merchant_settlements").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) {
    console.warn("Failed to fetch merchant statements:", error.message);
    return [];
  }
  return (data || []) as FinanceRow[];
}

export async function fetchDriverStatements(): Promise<FinanceRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("driver_settlements").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) {
    console.warn("Failed to fetch driver statements:", error.message);
    return [];
  }
  return (data || []) as FinanceRow[];
}

export type DailyClosingStatus = "draft" | "needs_review" | "closed" | "reopened";
export type DailyClosingSource = "rpc" | "view" | "derived" | "local";

export type DailyClosingSnapshot = {
  closing_date: string;
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  delivery_income: number;
  cod_total: number;
  cod_collected: number;
  cod_pending: number;
  cod_reconciled: number;
  expenses_total: number;
  adjustments_net: number;
  net_total: number;
  unassigned_orders: number;
  pending_review_orders: number;
  unreconciled_cod: number;
  print_jobs_pending: number;
  status: DailyClosingStatus;
  source: "rpc" | "view" | "derived";
  notes?: string;
  snapshot?: Record<string, unknown>;
};

export type DailyClosingResult = {
  snapshot: DailyClosingSnapshot | null;
  source: DailyClosingSource;
  saved: boolean;
  warning?: string;
};

function normalizeDailyClosing(row: Record<string, unknown>): DailyClosingSnapshot {
  return {
    closing_date: String(row.closing_date || new Date().toISOString().slice(0, 10)),
    total_orders: numberValue(row.total_orders),
    delivered_orders: numberValue(row.delivered_orders),
    cancelled_orders: numberValue(row.cancelled_orders),
    returned_orders: numberValue(row.returned_orders),
    delivery_income: numberValue(row.delivery_income),
    cod_total: numberValue(row.cod_total),
    cod_collected: numberValue(row.cod_collected),
    cod_pending: numberValue(row.cod_pending),
    cod_reconciled: numberValue(row.cod_reconciled),
    expenses_total: numberValue(row.expenses_total),
    adjustments_net: numberValue(row.adjustments_net),
    net_total: numberValue(row.net_total),
    unassigned_orders: numberValue(row.unassigned_orders),
    pending_review_orders: numberValue(row.pending_review_orders),
    unreconciled_cod: numberValue(row.unreconciled_cod),
    print_jobs_pending: numberValue(row.print_jobs_pending),
    status: ["draft", "needs_review", "closed", "reopened"].includes(String(row.status)) ? row.status as DailyClosingStatus : "draft",
    source: ["rpc", "view"].includes(String(row.source)) ? row.source as "rpc" | "view" : "derived",
    notes: clean(row.notes) || undefined,
    snapshot: typeof row.snapshot === "object" && row.snapshot ? row.snapshot as Record<string, unknown> : {},
  };
}

export async function fetchDailyClosing(date: string): Promise<DailyClosingResult> {
  if (!supabase) return { snapshot: null, source: "local", saved: false, warning: "مراجعة محلية مؤقتة — لم يتم الحفظ في قاعدة البيانات." };
  const { data, error } = await supabase.from("admin_daily_closings").select("*").eq("closing_date", date).maybeSingle();
  if (error) {
    console.warn("Daily closing fetch failed:", error.message);
    return { snapshot: null, source: "local", saved: false, warning: "تعذر حفظ إغلاق اليوم في قاعدة البيانات، تم الاحتفاظ بالملخص مؤقتاً فقط." };
  }
  return { snapshot: data ? normalizeDailyClosing(data as Record<string, unknown>) : null, source: data ? "view" : "derived", saved: Boolean(data) };
}

export function buildDailyClosingSnapshot(date: string, orders: Order[], financeSummary: FinanceSummary | null, operationRows: FinanceRow[] = []): DailyClosingSnapshot {
  const dayOrders = orders.filter((order) => String(order.created_at || order.updated_at || "").slice(0, 10) === date);
  const delivered = dayOrders.filter((order) => /deliver|complete/.test(orderStatus(order)));
  const cancelled = dayOrders.filter((order) => /cancel|fail/.test(orderStatus(order)));
  const returned = dayOrders.filter((order) => /return/.test(orderStatus(order)));
  const unassigned = dayOrders.filter((order) => !(order as Order & { driver_id?: string; assigned_driver_id?: string }).driver_id && !(order as Order & { driver_id?: string; assigned_driver_id?: string }).assigned_driver_id && !order.driver_name);
  const pendingReview = dayOrders.filter((order) => /review|confirm|hold|pending/.test(orderStatus(order)));
  const deliveryIncome = dayOrders.reduce((sum, order) => sum + orderDeliveryIncome(order), 0);
  const codTotal = dayOrders.reduce((sum, order) => sum + numberValue(order.cod_amount), 0);
  const codCollected = delivered.reduce((sum, order) => sum + numberValue(order.cod_amount), 0);
  const codReconciled = numberValue(financeSummary?.cod_reconciled);
  const expenses = numberValue(financeSummary?.total_expenses);
  const adjustments = operationRows.reduce((sum, row) => sum + (clean(row.direction).toLowerCase() === "negative" ? -numberValue(row.amount) : numberValue(row.amount)), 0);
  const codPending = Math.max(0, numberValue(financeSummary?.cod_pending, codTotal - codCollected));
  const unreconciled = Math.max(0, codCollected - codReconciled);
  const printPending = operationRows.filter((row) => /print|invoice|label/.test(clean(row.entry_type || row.adjustment_type || row.job_type || row.category || row.action || row.status)) && /draft|pending|queued/.test(clean(row.status))).length;
  const status: DailyClosingStatus = codPending > 0 || unreconciled > 0 || pendingReview.length > 0 || unassigned.length > 0 ? "needs_review" : "draft";
  return { closing_date: date, total_orders: dayOrders.length, delivered_orders: delivered.length, cancelled_orders: cancelled.length, returned_orders: returned.length, delivery_income: deliveryIncome, cod_total: codTotal, cod_collected: codCollected, cod_pending: codPending, cod_reconciled: codReconciled, expenses_total: expenses, adjustments_net: adjustments, net_total: deliveryIncome - expenses + adjustments, unassigned_orders: unassigned.length, pending_review_orders: pendingReview.length, unreconciled_cod: unreconciled, print_jobs_pending: printPending, status, source: "derived", snapshot: { generated_at: new Date().toISOString() } };
}

export async function saveDailyClosingSnapshot(snapshot: DailyClosingSnapshot): Promise<DailyClosingResult> {
  if (!supabase) return { snapshot, source: "local", saved: false, warning: "مراجعة محلية مؤقتة — لم يتم الحفظ في قاعدة البيانات." };
  const { data, error } = await supabase.from("admin_daily_closings").upsert({ ...snapshot, updated_at: new Date().toISOString() }, { onConflict: "closing_date" }).select("*").single();
  if (error) {
    console.warn("Daily closing save failed:", error.message);
    return { snapshot, source: "local", saved: false, warning: "تعذر حفظ إغلاق اليوم في قاعدة البيانات، تم الاحتفاظ بالملخص مؤقتاً فقط." };
  }
  void createAdminAuditEvent({ entity_type: "admin_daily_closing", entity_id: String((data as FinanceRow).id || snapshot.closing_date), action: "save", after_data: data });
  return { snapshot: normalizeDailyClosing(data as Record<string, unknown>), source: "view", saved: true };
}

export async function markDailyClosingReviewed(date: string, notes?: string): Promise<DailyClosingResult> {
  const current = await fetchDailyClosing(date);
  const snapshot = current.snapshot || buildDailyClosingSnapshot(date, [], null, []);
  return saveDailyClosingSnapshot({ ...snapshot, status: "closed", notes: clean(notes || snapshot.notes || "Closing reviewed") });
}

export async function reopenDailyClosing(date: string, notes?: string): Promise<DailyClosingResult> {
  const current = await fetchDailyClosing(date);
  const snapshot = current.snapshot || buildDailyClosingSnapshot(date, [], null, []);
  return saveDailyClosingSnapshot({ ...snapshot, status: "reopened", notes: clean(notes || snapshot.notes || "Reopen day") });
}

export async function fetchFinanceSummaryResult(): Promise<FinanceSummaryResult> {
  return fetchFinanceSummary();
}
