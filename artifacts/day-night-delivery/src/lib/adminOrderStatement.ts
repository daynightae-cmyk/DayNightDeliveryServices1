import type { Merchant, Order } from "../types";

const clean = (value: unknown) => String(value ?? "").trim();

export function buildAdminMerchantLookup(merchants: Merchant[]) {
  return new Map(merchants.map((merchant) => [clean(merchant.id), merchant]));
}

export function orderStatementCoupon(order: Order) {
  return clean(
    order.coupon_number ||
      order.invoice_number ||
      order.tracking_number ||
      order.tracking_code ||
      order.id ||
      "—",
  );
}

export function orderStatementMerchant(
  order: Order,
  merchantLookup?: ReadonlyMap<string, Merchant>,
) {
  const merchant = merchantLookup?.get(clean(order.merchant_id));
  return clean(
    merchant?.trade_name ||
      merchant?.owner_name ||
      merchant?.merchant_code ||
      order.merchant_name ||
      order.sender_name ||
      order.merchant_code ||
      "—",
  );
}

export function orderStatementCustomer(order: Order) {
  return clean(order.receiver_name || order.customer_name || "—");
}

export function orderStatementPhone(order: Order) {
  return clean(order.receiver_phone || order.customer_phone || "—");
}

export function orderStatementArea(order: Order, isArabic: boolean) {
  const row = order as Order & Record<string, unknown>;

  // Match the proven Driver Statements behavior first: prefer the real
  // delivery area, then city, then the stored delivery address. Older DAY
  // NIGHT orders do not all have a dedicated area column populated, so the
  // address fallback is required instead of printing a misleading dash.
  const arabicDelivery = [
    row.receiver_area_ar,
    row.delivery_area_ar,
    row.receiver_area,
    row.delivery_area,
    row.receiver_city_ar,
    row.delivery_city_ar,
    row.receiver_city,
    row.delivery_city,
    row.receiver_emirate_ar,
    row.delivery_emirate_ar,
    row.receiver_emirate,
    row.delivery_emirate,
    row.receiver_address_ar,
    row.delivery_address_ar,
    row.delivery_street_ar,
    row.receiver_address,
    row.delivery_address,
    row.delivery_street,
  ];
  const englishDelivery = [
    row.receiver_area,
    row.delivery_area,
    row.receiver_area_ar,
    row.delivery_area_ar,
    row.receiver_city,
    row.delivery_city,
    row.receiver_city_ar,
    row.delivery_city_ar,
    row.receiver_emirate,
    row.delivery_emirate,
    row.receiver_emirate_ar,
    row.delivery_emirate_ar,
    row.receiver_address,
    row.delivery_address,
    row.delivery_street,
    row.receiver_address_ar,
    row.delivery_address_ar,
    row.delivery_street_ar,
  ];
  const pickupFallback = isArabic
    ? [
        row.sender_area_ar,
        row.pickup_area_ar,
        row.sender_area,
        row.pickup_area,
        row.sender_city_ar,
        row.pickup_city_ar,
        row.sender_city,
        row.pickup_city,
        row.sender_address_ar,
        row.pickup_address_ar,
        row.sender_address,
        row.pickup_address,
      ]
    : [
        row.sender_area,
        row.pickup_area,
        row.sender_area_ar,
        row.pickup_area_ar,
        row.sender_city,
        row.pickup_city,
        row.sender_city_ar,
        row.pickup_city_ar,
        row.sender_address,
        row.pickup_address,
        row.sender_address_ar,
        row.pickup_address_ar,
      ];
  const internationalFallback = isArabic
    ? [row.destination_country_ar, row.destination_country]
    : [row.destination_country, row.destination_country_ar];

  return clean(
    [
      ...(isArabic ? arabicDelivery : englishDelivery),
      ...pickupFallback,
      ...internationalFallback,
    ].find((value) => clean(value)) || "—",
  );
}

export function orderStatementPrice(order: Order) {
  const candidates: unknown[] = [
    order.customer_total,
    order.total_amount,
    order.total_price,
    order.total,
    order.amount,
    order.cod_amount,
    order.delivery_price,
  ];
  for (const candidate of candidates) {
    const text = clean(candidate);
    if (!text) continue;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function orderStatementStatus(order: Order) {
  return clean(order.status || "—");
}
