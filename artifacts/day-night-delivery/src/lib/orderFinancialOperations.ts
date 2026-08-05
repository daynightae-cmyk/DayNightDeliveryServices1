import { supabase } from "../supabase";
import type { Merchant, Order } from "../types";
import {
  calculateOpsOrderPrice,
  getOpsOrderReference,
  opsErrorDetail,
  type OpsCreateResult,
  type OpsOrderInput,
  type OpsOrderUpdateInput,
} from "./adminOperationsData";
import { createDayNightInvoiceNumber } from "./printableDocuments";
import { createAdminOrder } from "./adminOrderMutations";
import {
  calculateOrderFinancials,
  financialNumber,
  normalizeDeliveryFeeMode,
  orderFinancialValidation,
  type DeliveryFeeMode,
  type OrderFinancialBreakdown,
} from "./orderFinancials";
import {
  resolveCanonicalMerchantForOrder,
  verifySavedOrderMerchant,
} from "./orderMerchantResolver";

export type FinancialOpsOrderInput = OpsOrderInput & {
  goods_value: number | string;
  discount_amount?: number | string;
  delivery_fee_mode: DeliveryFeeMode;
};

export type FinancialOpsOrderUpdateInput = Omit<OpsOrderUpdateInput, keyof OpsOrderInput> &
  FinancialOpsOrderInput;

export type CouponConflict = {
  coupon_number: string;
  order_id: string;
  tracking_number: string;
  merchant_name: string;
  receiver_name: string;
  receiver_phone: string;
};

export const EXPLICIT_ZERO_MANUAL_DELIVERY_FEE = 25;

const clean = (value: unknown) => String(value ?? "").trim();
const normalizeCouponForComparison = (value: unknown) =>
  clean(value)
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/\s+/g, "")
    .toLowerCase();
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function composeAddress(parts: unknown[]) {
  return parts.map(clean).filter(Boolean).join(" - ");
}

function normalizePaymentMethod(value: unknown) {
  const normalized = clean(value || "cod").toLowerCase();
  if (normalized === "merchant_pays") return "sender_pays";
  if (["sender_pays", "receiver_pays", "cod"].includes(normalized)) return normalized;
  return "cod";
}

export function hasExplicitZeroManualDelivery(input: FinancialOpsOrderInput) {
  const raw = input.manual_delivery_price;
  return (
    input.price_mode === "manual" &&
    raw !== "" &&
    raw !== null &&
    raw !== undefined &&
    Number.isFinite(Number(raw)) &&
    Number(raw) === 0
  );
}

/**
 * Manual price rules are intentionally explicit:
 * - any positive manual value is used exactly as entered, including 1000 AED;
 * - an explicitly entered manual zero is a settlement instruction, not free
 *   delivery: the official 25 AED fee is charged to the merchant.
 */
export function effectiveDeliveryFeeMode(input: FinancialOpsOrderInput): DeliveryFeeMode {
  const paymentMethod = clean(input.payment_method).toLowerCase();
  if (paymentMethod === "merchant_pays" || paymentMethod === "sender_pays") {
    return "deduct_from_merchant";
  }
  if (hasExplicitZeroManualDelivery(input)) {
    return "deduct_from_merchant";
  }
  return normalizeDeliveryFeeMode(input.delivery_fee_mode);
}

function operationError(error: unknown, fallback: string) {
  const detail = opsErrorDetail(error);
  const wrapped = new Error(detail || fallback) as Error & { dbDetail?: string };
  wrapped.dbDetail = detail;
  return wrapped;
}

function couponIntegrityUnavailable(error: unknown) {
  const detail = opsErrorDetail(error);
  if (detail) console.warn("Coupon integrity preflight unavailable:", detail);
  const wrapped = new Error(
    "تعذر التحقق من تكرار رقم الكوبون بأمان. لم يتم حفظ الطلب. تأكد من تطبيق Migration حماية الكوبونات ثم أعد المحاولة.",
  ) as Error & { code?: string };
  wrapped.name = "CouponIntegrityCheckUnavailable";
  wrapped.code = "coupon_integrity_check_unavailable";
  return wrapped;
}

function duplicateCouponError(conflict: CouponConflict, requestedCoupon: unknown) {
  const coupon = clean(conflict.coupon_number || requestedCoupon) || "غير محدد";
  const tracking = clean(conflict.tracking_number || conflict.order_id) || "غير محدد";
  const merchant = clean(conflict.merchant_name) || "غير محدد";
  const receiver = clean(conflict.receiver_name);
  const receiverSuffix = receiver ? `، والمستلم ${receiver}` : "";
  const wrapped = new Error(
    `رقم الكوبون «${coupon}» مسجل بالفعل على الطلب ${tracking} للتاجر ${merchant}${receiverSuffix}. لا يمكن تكرار رقم الكوبون. افتح الطلب الموجود من صفحة كافة الطلبات أو استخدم رقم كوبون جديدًا.`,
  ) as Error & { code?: string; conflict?: CouponConflict };
  wrapped.name = "DuplicateCouponError";
  wrapped.code = "coupon_number_already_exists";
  wrapped.conflict = conflict;
  return wrapped;
}

export async function findCouponConflict(
  couponNumber: unknown,
  excludeOrderId: string | null = null,
): Promise<CouponConflict | null> {
  if (!supabase) throw couponIntegrityUnavailable(null);
  const coupon = clean(couponNumber);
  if (!coupon) return null;

  const { data, error } = await supabase.rpc("admin_find_coupon_conflict", {
    p_coupon: coupon,
    p_exclude_order_id: excludeOrderId,
  });
  if (error) throw couponIntegrityUnavailable(error);

  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const conflict: CouponConflict = {
    coupon_number: clean(row.coupon_number || coupon),
    order_id: clean(row.order_id),
    tracking_number: clean(row.tracking_number),
    merchant_name: clean(row.merchant_name),
    receiver_name: clean(row.receiver_name),
    receiver_phone: clean(row.receiver_phone),
  };

  if (!conflict.order_id && !conflict.tracking_number) return null;
  return conflict;
}

async function recoverCouponConflict(
  couponNumber: unknown,
  excludeOrderId: string | null = null,
) {
  try {
    return await findCouponConflict(couponNumber, excludeOrderId);
  } catch (error) {
    console.warn("Could not recover precise coupon conflict after database rejection:", opsErrorDetail(error));
    return null;
  }
}

function buildFinanceNote(financials: OrderFinancialBreakdown) {
  const settlementLine =
    financials.merchantDue < 0
      ? `Merchant debit ${financials.merchantDue.toFixed(2)} AED`
      : `Merchant net ${financials.merchantDue.toFixed(2)} AED`;
  const lines = [
    `Goods value ${financials.goodsValue.toFixed(2)} AED`,
    `Delivery fee ${financials.deliveryFee.toFixed(2)} AED`,
  ];
  if (financials.discountAmount > 0) {
    lines.push(`Discount ${financials.discountAmount.toFixed(2)} AED`);
  }
  lines.push(
    `Customer total ${financials.customerTotal.toFixed(2)} AED`,
    settlementLine,
    `DAY NIGHT revenue ${financials.companyRevenue.toFixed(2)} AED`,
    `Delivery fee mode ${financials.deliveryFeeMode}`,
  );
  return lines.join(" | ");
}

export function calculateFinancialOpsOrder(input: FinancialOpsOrderInput): OrderFinancialBreakdown & {
  systemDeliveryFee: number;
  priceSource: "system" | "manual";
} {
  const pricing = calculateOpsOrderPrice(input);
  const explicitZero = hasExplicitZeroManualDelivery(input);
  const deliveryFee = explicitZero
    ? EXPLICIT_ZERO_MANUAL_DELIVERY_FEE
    : pricing.total;
  const deliveryFeeMode = effectiveDeliveryFeeMode(input);
  const validation = orderFinancialValidation({
    goodsValue: input.goods_value,
    deliveryFee,
    discountAmount: input.discount_amount,
    deliveryFeeMode,
  });
  if (validation) throw new Error(validation);

  return {
    ...calculateOrderFinancials({
      goodsValue: input.goods_value,
      deliveryFee,
      discountAmount: input.discount_amount,
      deliveryFeeMode,
    }),
    systemDeliveryFee: pricing.systemTotal,
    priceSource: input.price_mode === "manual" ? "manual" : pricing.priceSource,
  };
}

function persistedManualDeliveryPrice(
  input: FinancialOpsOrderInput,
  financials: ReturnType<typeof calculateFinancialOpsOrder>,
) {
  if (hasExplicitZeroManualDelivery(input)) return 0;
  return financials.priceSource === "manual" ? financials.deliveryFee : null;
}

function buildFinancialOrderPayload(
  input: FinancialOpsOrderInput,
  merchant: Merchant | null,
  financials: ReturnType<typeof calculateFinancialOpsOrder>,
  trackingNumber: string,
  createdAt: string,
) {
  const isInternational = input.shipping_scope === "international";
  const receiverCity = isInternational
    ? clean(input.destination_country || input.delivery_city || "WORLD")
    : clean(input.delivery_city || "Abu Dhabi");
  const senderCity = clean(input.pickup_city || merchant?.emirate || "Abu Dhabi");
  const senderAddress = composeAddress([
    input.pickup_area,
    input.pickup_street,
    merchant?.pickup_address || merchant?.address || senderCity,
  ]);
  const receiverAddress = composeAddress([
    input.delivery_area,
    input.delivery_street,
    input.receiver_address || receiverCity,
  ]);
  const packageValue = clean(input.package_description || input.package_type || "Shipment");
  const paymentMethod = normalizePaymentMethod(input.payment_method);
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));
  const codAmount = paymentMethod === "cod" ? financials.customerTotal : 0;
  const financeNote = buildFinanceNote(financials);

  return {
    tracking_number: trackingNumber,
    tracking_code: trackingNumber,
    invoice_number: trackingNumber,
    coupon_number: clean(input.coupon_number),
    merchant_id: merchant?.id || clean(input.merchant_id) || null,
    merchant_name: merchant?.trade_name || clean(input.merchant_name) || null,
    merchant_code: merchant?.merchant_code || clean(input.merchant_code) || null,
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? receiverCity : null,
    source_channel: "admin_financial_order",
    source_domain: "daynightae.com",
    sender_name: merchant?.trade_name || clean(input.sender_name) || "DAY NIGHT Admin",
    sender_phone: clean(merchant?.phone || input.sender_phone),
    sender_city: senderCity,
    sender_address: senderAddress,
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: receiverAddress,
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, numberValue(input.weight, 1)),
    pieces: count,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: codAmount,
    goods_value: financials.goodsValue,
    delivery_fee: financials.deliveryFee,
    discount_amount: financials.discountAmount,
    delivery_fee_mode: financials.deliveryFeeMode,
    customer_total: financials.customerTotal,
    merchant_due: financials.merchantDue,
    company_revenue: financials.companyRevenue,
    collected_amount: 0,
    financial_version: 2,
    delivery_price: financials.deliveryFee,
    base_price: financials.deliveryFee,
    subtotal: financials.customerTotal,
    total: financials.customerTotal,
    total_price: financials.customerTotal,
    amount: financials.customerTotal,
    price: financials.customerTotal,
    manual_delivery_price: persistedManualDeliveryPrice(input, financials),
    price_source: financials.priceSource,
    currency: "AED",
    notes: [clean(input.notes), financeNote].filter(Boolean).join(" | "),
    status: "pending",
    status_history: [
      {
        status: "pending",
        date: createdAt,
        created_at: createdAt,
        note: financeNote,
      },
    ],
    created_at: createdAt,
    updated_at: createdAt,
  };
}

export async function createFinancialOpsOrder(
  input: FinancialOpsOrderInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase) throw operationError(null, "Supabase is not configured.");
  const merchant = input.merchant || null;

  const existingConflict = await findCouponConflict(input.coupon_number);
  if (existingConflict) throw duplicateCouponError(existingConflict, input.coupon_number);

  const financials = calculateFinancialOpsOrder(input);
  const createdAt = new Date().toISOString();
  const trackingSeed =
    clean(input.coupon_number) ||
    `${merchant?.merchant_code || clean(input.merchant_code) || "ADMIN"}-${Date.now().toString(36)}`;
  const trackingNumber = createDayNightInvoiceNumber(trackingSeed, new Date(createdAt));
  const payload = buildFinancialOrderPayload(input, merchant, financials, trackingNumber, createdAt);
  let result;
  try {
    result = await createAdminOrder(payload, {
      sourcePage: "admin_new_order_complete",
      reason: "Admin financially complete order creation",
    });
  } catch (error) {
    const conflict = await recoverCouponConflict(input.coupon_number);
    if (conflict) throw duplicateCouponError(conflict, input.coupon_number);
    throw error;
  }
  return {
    row: result.order,
    source: "rpc",
    warnings: result.warnings,
    reconciliationRequired: result.reconciliationRequired,
    requestId: result.requestId,
  };
}

function buildCorePatch(
  input: FinancialOpsOrderUpdateInput,
  merchant: Merchant,
  financials: ReturnType<typeof calculateFinancialOpsOrder>,
) {
  const isInternational = input.shipping_scope === "international";
  const receiverCity = isInternational
    ? clean(input.destination_country || input.delivery_city || "WORLD")
    : clean(input.delivery_city || "Abu Dhabi");
  const packageValue = clean(input.package_description || input.package_type || "Shipment");
  const paymentMethod = normalizePaymentMethod(input.payment_method);
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));

  return {
    merchant_id: merchant.id,
    merchant_name: merchant.trade_name,
    merchant_code: merchant.merchant_code || "",
    sender_name: merchant.trade_name,
    sender_phone: clean(merchant.phone),
    sender_city: clean(input.pickup_city || merchant.emirate),
    sender_address: composeAddress([input.pickup_area, input.pickup_street, merchant.pickup_address || merchant.address]),
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: composeAddress([input.delivery_area, input.delivery_street, input.receiver_address]),
    coupon_number: clean(input.coupon_number),
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, numberValue(input.weight, 1)),
    pieces: count,
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? receiverCity : null,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? financials.customerTotal : 0,
    delivery_price: financials.deliveryFee,
    base_price: financials.deliveryFee,
    subtotal: financials.customerTotal,
    total: financials.customerTotal,
    total_price: financials.customerTotal,
    amount: financials.customerTotal,
    price: financials.customerTotal,
    manual_delivery_price: persistedManualDeliveryPrice(input, financials),
    price_source: financials.priceSource,
    currency: "AED",
    notes: clean(input.notes),
  };
}

export async function updateFinancialOpsOrder(
  input: FinancialOpsOrderUpdateInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase) throw operationError(null, "Supabase is not configured.");
  const reference = getOpsOrderReference(input.order);
  if (!reference) throw operationError(null, "order_reference_required");
  const selectedMerchant = input.merchant;
  if (!selectedMerchant?.id) throw operationError(null, "merchant_required");
  const merchantChanged = clean(selectedMerchant.id) !== clean(input.order.merchant_id);
  const merchant = merchantChanged
    ? (await resolveCanonicalMerchantForOrder(selectedMerchant)).merchant
    : selectedMerchant;

  const excludeOrderId = clean(input.order.id) || null;
  const couponChanged =
    normalizeCouponForComparison(input.coupon_number) !==
    normalizeCouponForComparison(input.order.coupon_number);
  if (couponChanged) {
    const existingConflict = await findCouponConflict(input.coupon_number, excludeOrderId);
    if (existingConflict) throw duplicateCouponError(existingConflict, input.coupon_number);
  }

  const financials = calculateFinancialOpsOrder(input);
  const corePatch = buildCorePatch(input, merchant, financials);
  const { data, error } = await supabase.rpc("admin_update_order_with_financials", {
    p_payload: {
      reference,
      patch: corePatch,
      financials: {
        goods_value: financials.goodsValue,
        delivery_fee: financials.deliveryFee,
        discount_amount: financials.discountAmount,
        delivery_fee_mode: financials.deliveryFeeMode,
      },
      reason: clean(input.edit_reason) || "Updated from admin financial order editor",
    },
  });
  if (error) {
    if (couponChanged) {
      const conflict = await recoverCouponConflict(input.coupon_number, excludeOrderId);
      if (conflict) throw duplicateCouponError(conflict, input.coupon_number);
    }
    throw operationError(
      error,
      "Could not update the financial order. Delivered settlements are locked and require an audited adjustment.",
    );
  }
  const row = (Array.isArray(data) ? data[0] : data) as Order | null;
  if (!row?.id) throw operationError(null, "financial_order_update_returned_no_row");
  return { row, source: "rpc" };
}
