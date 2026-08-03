import { supabase } from "../supabase";
import type { Order } from "../types";
import { normalizeInternationalDestination } from "../data/internationalDestinations";
import { isPersonalAdminOrder } from "./adminOrderLogic";
import {
  PERSONAL_ORDER_DELIVERY_FEE,
  calculatePersonalOrderFinancials,
} from "./personalOrderOperations";
import {
  calculateFinancialOpsOrder,
  updateFinancialOpsOrder,
  type FinancialOpsOrderUpdateInput,
} from "./orderFinancialOperations";

export type AdminOrderEditSaveResult = {
  row: Order;
  source: "rpc" | "db";
  financialsLocked?: boolean;
  auditId?: string;
  changedFields?: string[];
  merchantChanged?: boolean;
};

const clean = (value: unknown) => String(value ?? "").trim();
const ORDERS_SCHEMA_COLUMN_RE =
  /Could not find the '([^']+)' column of 'orders' in the schema cache/i;

function errorDetail(error: unknown) {
  const record = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
    dbDetail?: string;
  };
  return [record?.code, record?.dbDetail, record?.message, record?.details, record?.hint]
    .map(clean)
    .filter(Boolean)
    .join(" | ");
}

function missingOrdersSchemaColumn(error: unknown) {
  return errorDetail(error).match(ORDERS_SCHEMA_COLUMN_RE)?.[1] || "";
}

function withoutPatchColumn(patch: Record<string, unknown>, column: string) {
  const next = { ...patch };
  delete next[column];
  return next;
}

function databaseErrorCode(error: unknown) {
  return clean((error as { code?: string })?.code).toUpperCase();
}

function isMissingRpcRuntime(error: unknown, functionNames: readonly string[]) {
  const code = databaseErrorCode(error);
  if (code === "PGRST202" || code === "42883") return true;

  const detail = errorDetail(error).toLowerCase();
  return functionNames.some((functionName) => {
    const bare = functionName.toLowerCase();
    const qualified = `public.${bare}`;
    return (
      detail.includes(`could not find the function ${bare}`) ||
      detail.includes(`could not find the function ${qualified}`) ||
      (detail.includes(`function ${bare}`) && detail.includes("does not exist")) ||
      (detail.includes(`function ${qualified}`) && detail.includes("does not exist"))
    );
  });
}

function isMissingFinancialUpdateRuntime(error: unknown) {
  return isMissingRpcRuntime(error, ["admin_update_order_with_financials"]);
}

function isMissingCompleteEditRuntime(error: unknown) {
  return isMissingRpcRuntime(error, [
    "admin_update_order_complete_verified_v2",
    "admin_update_order_complete_verified",
  ]);
}

function financialsAreLocked(order: Order) {
  const status = clean(order.status).toLowerCase().replace(/[\s-]+/g, "_");
  return (
    Boolean(order.financial_posted_at) ||
    ["delivered", "completed", "complete"].includes(status)
  );
}

function uniqueAddress(parts: unknown[]) {
  const seen = new Set<string>();
  return parts
    .map(clean)
    .filter((part) => {
      if (!part || seen.has(part.toLowerCase())) return false;
      seen.add(part.toLowerCase());
      return true;
    })
    .join(" - ");
}

function normalizedPaymentMethod(value: unknown) {
  const normalized = clean(value || "cod").toLowerCase();
  if (normalized === "merchant_pays") return "sender_pays";
  if (["sender_pays", "receiver_pays", "cod", "prepaid"].includes(normalized)) {
    return normalized;
  }
  return "cod";
}

function corePatch(input: FinancialOpsOrderUpdateInput) {
  const merchant = input.merchant;
  if (!merchant?.id) throw new Error("merchant_required");
  const isInternational = input.shipping_scope === "international";
  const receiverCity = isInternational
    ? normalizeInternationalDestination(
        input.destination_country || input.delivery_city || "WORLD",
        "WORLD",
      )
    : clean(input.delivery_city || "Abu Dhabi");
  const packageValue = clean(
    input.package_description || input.package_type || "Shipment",
  );
  const count = Math.max(1, Math.ceil(Number(input.order_count || 1)));
  const notes = clean(input.notes);
  const editReason = clean(input.edit_reason || "Updated from admin order editor");

  return {
    merchant_id: merchant.id,
    merchant_name: merchant.trade_name,
    merchant_code: merchant.merchant_code || "",
    sender_name: clean(input.sender_name || merchant.trade_name),
    sender_phone: clean(input.sender_phone || merchant.phone),
    sender_city: clean(input.pickup_city || merchant.emirate),
    sender_address: uniqueAddress([
      input.pickup_area,
      input.pickup_street,
      merchant.pickup_address,
      merchant.address,
    ]),
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: uniqueAddress([
      input.delivery_area,
      input.delivery_street,
      input.receiver_address,
    ]),
    coupon_number: clean(input.coupon_number),
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, Number(input.weight || 1)),
    pieces: count,
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? receiverCity : null,
    service_type: isInternational ? "international" : "standard",
    notes: [notes, `Admin edit: ${editReason}`].filter(Boolean).join(" | "),
    updated_at: new Date().toISOString(),
  };
}

function fullPatch(input: FinancialOpsOrderUpdateInput) {
  const merchant = input.merchant;
  if (!merchant?.id) throw new Error("merchant_required");
  const financials = calculateFinancialOpsOrder(input);
  const isInternational = input.shipping_scope === "international";
  const paymentMethod = normalizedPaymentMethod(input.payment_method);
  const receiverCity = isInternational
    ? normalizeInternationalDestination(
        input.destination_country || input.delivery_city || "WORLD",
        "WORLD",
      )
    : clean(input.delivery_city || "Abu Dhabi");
  const packageValue = clean(
    input.package_description || input.package_type || "Shipment",
  );
  const count = Math.max(1, Math.ceil(Number(input.order_count || 1)));
  const notes = clean(input.notes);

  return {
    merchant_id: merchant.id,
    merchant_name: merchant.trade_name,
    merchant_code: merchant.merchant_code || "",
    sender_name: clean(input.sender_name || merchant.trade_name),
    sender_phone: clean(input.sender_phone || merchant.phone),
    sender_city: clean(input.pickup_city || merchant.emirate),
    sender_address: uniqueAddress([
      input.pickup_area,
      input.pickup_street,
      merchant.pickup_address,
      merchant.address,
    ]),
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: uniqueAddress([
      input.delivery_area,
      input.delivery_street,
      input.receiver_address,
    ]),
    coupon_number: clean(input.coupon_number),
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, Number(input.weight || 1)),
    pieces: count,
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? receiverCity : null,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? financials.customerTotal : 0,
    goods_value: financials.goodsValue,
    delivery_fee: financials.deliveryFee,
    discount_amount: financials.discountAmount,
    delivery_fee_mode: financials.deliveryFeeMode,
    customer_total: financials.customerTotal,
    merchant_due: financials.merchantDue,
    company_revenue: financials.companyRevenue,
    delivery_price: financials.deliveryFee,
    base_price: financials.deliveryFee,
    subtotal: financials.customerTotal,
    total: financials.customerTotal,
    total_price: financials.customerTotal,
    amount: financials.customerTotal,
    price: financials.customerTotal,
    manual_delivery_price:
      financials.priceSource === "manual"
        ? Number(input.manual_delivery_price ?? financials.deliveryFee)
        : null,
    price_source: financials.priceSource,
    currency: "AED",
    notes,
    updated_at: new Date().toISOString(),
  };
}

function personalCorePatch(input: FinancialOpsOrderUpdateInput) {
  const couponNumber = clean(input.coupon_number);
  if (!couponNumber) throw new Error("coupon_number_required_for_personal_order");
  const receiverCity = clean(input.delivery_city || "Abu Dhabi");
  const packageValue = clean(
    input.package_description || input.package_type || "Shipment",
  );
  const count = Math.max(1, Math.ceil(Number(input.order_count || 1)));
  return {
    merchant_id: null,
    merchant_name: null,
    merchant_code: null,
    source_channel: "admin_personal_order",
    sender_name: clean(input.sender_name || input.order.sender_name),
    sender_phone: clean(input.sender_phone || input.order.sender_phone),
    sender_city: clean(input.pickup_city || input.order.sender_city || "Abu Dhabi"),
    sender_address: uniqueAddress([
      input.pickup_area,
      input.pickup_street,
      input.order.sender_address,
    ]),
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: uniqueAddress([
      input.delivery_area,
      input.delivery_street,
      input.receiver_address,
    ]),
    coupon_number: couponNumber,
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, Number(input.weight || 1)),
    pieces: count,
    order_count: count,
    notes: [
      clean(input.notes),
      `Admin edit: ${clean(input.edit_reason || "Updated personal order")}`,
    ]
      .filter(Boolean)
      .join(" | "),
    updated_at: new Date().toISOString(),
  };
}

function personalFullPatch(input: FinancialOpsOrderUpdateInput) {
  const core = personalCorePatch(input);
  const financials = calculatePersonalOrderFinancials({
    goodsValue: input.goods_value,
    discountAmount: input.discount_amount,
    deliveryFee: PERSONAL_ORDER_DELIVERY_FEE,
  });
  const normalized = normalizedPaymentMethod(input.payment_method);
  const paymentMethod = normalized === "sender_pays" ? "prepaid" : normalized;
  return {
    ...core,
    shipping_scope: "local",
    destination_country: null,
    service_type: "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? financials.customerTotal : 0,
    goods_value: financials.goodsValue,
    delivery_fee: PERSONAL_ORDER_DELIVERY_FEE,
    discount_amount: financials.discountAmount,
    delivery_fee_mode: "customer_pays",
    customer_total: financials.customerTotal,
    merchant_due: 0,
    company_revenue: PERSONAL_ORDER_DELIVERY_FEE,
    delivery_price: PERSONAL_ORDER_DELIVERY_FEE,
    base_price: PERSONAL_ORDER_DELIVERY_FEE,
    subtotal: financials.customerTotal,
    total: financials.customerTotal,
    total_price: financials.customerTotal,
    amount: financials.customerTotal,
    price: financials.customerTotal,
    currency: "AED",
  };
}

async function updateCompleteMerchantOrder(
  input: FinancialOpsOrderUpdateInput,
): Promise<AdminOrderEditSaveResult> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const orderId = clean(input.order.id);
  if (!orderId) throw new Error("order_id_required_for_complete_edit");
  const reason = clean(input.edit_reason);
  if (reason.length < 6) throw new Error("admin_edit_reason_required_min_6");

  const patch = fullPatch(input);
  const financials = calculateFinancialOpsOrder(input);
  const args = {
    p_payload: {
      order_id: orderId,
      patch,
      financials: {
        goods_value: financials.goodsValue,
        delivery_fee: financials.deliveryFee,
        discount_amount: financials.discountAmount,
        delivery_fee_mode: financials.deliveryFeeMode,
      },
      reason,
    },
  };

  let { data, error } = await supabase.rpc(
    "admin_update_order_complete_verified_v2",
    args,
  );
  if (error && isMissingCompleteEditRuntime(error)) {
    const compatibility = await supabase.rpc(
      "admin_update_order_complete_verified",
      args,
    );
    data = compatibility.data;
    error = compatibility.error;
  }
  if (error) throw error;

  const payload = (Array.isArray(data) ? data[0] : data) as
    | {
        ok?: boolean;
        order?: Order;
        audit_id?: string;
        changed_fields?: string[];
        merchant_changed?: boolean;
      }
    | null;
  if (!payload?.ok || !payload.order?.id) {
    throw new Error("complete_order_edit_returned_no_order");
  }

  return {
    row: payload.order,
    source: "rpc",
    financialsLocked: false,
    auditId: clean(payload.audit_id),
    changedFields: Array.isArray(payload.changed_fields)
      ? payload.changed_fields
      : [],
    merchantChanged: Boolean(payload.merchant_changed),
  };
}

async function updateByColumn(
  column: string,
  value: string,
  patch: Record<string, unknown>,
  strict: boolean,
): Promise<Order | null> {
  if (!supabase) throw new Error("Supabase is not configured.");
  let compatiblePatch = { ...patch };

  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (!Object.keys(compatiblePatch).length) {
      throw new Error("order_update_patch_became_empty");
    }

    const { data, error } = await supabase
      .from("orders")
      .update(compatiblePatch)
      .eq(column, value)
      .select("*")
      .limit(1);

    if (!error && data?.[0]?.id) return data[0] as Order;

    if (error) {
      const missingColumn = missingOrdersSchemaColumn(error);
      if (
        missingColumn &&
        Object.prototype.hasOwnProperty.call(compatiblePatch, missingColumn)
      ) {
        console.warn(
          `[DAY NIGHT] Retrying order edit without unavailable orders.${missingColumn}`,
        );
        compatiblePatch = withoutPatchColumn(compatiblePatch, missingColumn);
        continue;
      }

      if (strict) {
        throw new Error(errorDetail(error) || "order_update_failed");
      }
    }

    return null;
  }

  throw new Error("order_update_schema_compatibility_retry_limit");
}

async function updateWithPatch(
  input: FinancialOpsOrderUpdateInput,
  patch: Record<string, unknown>,
): Promise<Order> {
  const orderId = clean(input.order.id);

  if (orderId) {
    const row = await updateByColumn("id", orderId, patch, true);
    if (!row?.id) throw new Error("order_update_verification_failed");
    return row;
  }

  const reference = clean(
    input.order.tracking_number ||
      input.order.invoice_number ||
      input.order.coupon_number,
  );
  if (!reference) throw new Error("order_reference_required");

  for (const column of ["tracking_number", "invoice_number", "coupon_number"]) {
    const row = await updateByColumn(column, reference, patch, false);
    if (row?.id) return row;
  }
  throw new Error("order_update_verification_failed");
}

export async function saveAdminOrderEdit(
  input: FinancialOpsOrderUpdateInput,
): Promise<AdminOrderEditSaveResult> {
  if (isPersonalAdminOrder(input.order)) {
    const locked = financialsAreLocked(input.order);
    const row = await updateWithPatch(
      input,
      locked ? personalCorePatch(input) : personalFullPatch(input),
    );
    return { row, source: "db", financialsLocked: locked };
  }

  try {
    return await updateCompleteMerchantOrder(input);
  } catch (error) {
    if (!isMissingCompleteEditRuntime(error)) throw error;
    if (financialsAreLocked(input.order)) {
      throw new Error(
        "admin_complete_order_edit_runtime_missing_apply_migration_20260802084500",
      );
    }
  }

  try {
    const result = await updateFinancialOpsOrder(input);
    if (!result.row?.id) throw new Error("financial_order_update_returned_no_row");
    return { row: result.row, source: result.source, financialsLocked: false };
  } catch (error) {
    if (!isMissingFinancialUpdateRuntime(error)) throw error;
    const row = await updateWithPatch(input, fullPatch(input));
    return { row, source: "db", financialsLocked: false };
  }
}
