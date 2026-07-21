export type MerchantStatusTone = "neutral" | "blue" | "sky" | "green" | "amber" | "red" | "slate";

export type MerchantStatusDefinition = {
  ar: string;
  en: string;
  tone: MerchantStatusTone;
  closed?: boolean;
  active?: boolean;
};

export function normalizeMerchantStatus(value?: string | null): string {
  return String(value || "pending").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export const merchantStatusMap: Record<string, MerchantStatusDefinition> = {
  draft: { ar: "مسودة", en: "Draft", tone: "slate" },
  pending: { ar: "قيد الانتظار", en: "Pending", tone: "amber", active: true },
  confirmed: { ar: "مؤكد", en: "Confirmed", tone: "blue", active: true },
  pickup_requested: { ar: "تم طلب الاستلام", en: "Pickup requested", tone: "sky", active: true },
  assigned: { ar: "تم التعيين", en: "Assigned", tone: "blue", active: true },
  accepted: { ar: "تم القبول", en: "Accepted", tone: "blue", active: true },
  heading_to_pickup: { ar: "في الطريق للاستلام", en: "Heading to pickup", tone: "sky", active: true },
  arrived_at_pickup: { ar: "وصل إلى الاستلام", en: "Arrived at pickup", tone: "sky", active: true },
  picked_up: { ar: "تم استلام الشحنة", en: "Picked up", tone: "amber", active: true },
  at_hub: { ar: "في مركز العمليات", en: "At operations hub", tone: "slate", active: true },
  in_transit: { ar: "في الطريق", en: "In transit", tone: "sky", active: true },
  out_for_delivery: { ar: "خرج للتوصيل", en: "Out for delivery", tone: "sky", active: true },
  arrived_at_customer: { ar: "وصل إلى العميل", en: "Arrived at customer", tone: "blue", active: true },
  delivered: { ar: "تم التسليم", en: "Delivered", tone: "green", closed: true },
  failed: { ar: "تعذر التسليم", en: "Delivery failed", tone: "red" },
  delivery_failed: { ar: "تعذر التسليم", en: "Delivery failed", tone: "red" },
  under_review: { ar: "قيد المراجعة", en: "Under review", tone: "amber" },
  review: { ar: "قيد المراجعة", en: "Under review", tone: "amber" },
  postponed: { ar: "مؤجل", en: "Postponed", tone: "amber" },
  return_requested: { ar: "تم طلب الإرجاع", en: "Return requested", tone: "amber" },
  returned: { ar: "تم الإرجاع", en: "Returned", tone: "slate", closed: true },
  cancelled: { ar: "ملغي", en: "Cancelled", tone: "red", closed: true },
};

export function merchantStatusDefinition(status?: string | null): MerchantStatusDefinition {
  const normalized = normalizeMerchantStatus(status);
  return merchantStatusMap[normalized] || { ar: status || "غير محدد", en: status || "Unknown", tone: "neutral" };
}

export function merchantStatusLabel(status: string | null | undefined, isArabic: boolean): string {
  const definition = merchantStatusDefinition(status);
  return isArabic ? definition.ar : definition.en;
}

export function merchantStatusClass(status?: string | null): string {
  const tone = merchantStatusDefinition(status).tone;
  return `dn-merchant-status is-${tone}`;
}

export function isMerchantOrderActive(status?: string | null): boolean {
  return Boolean(merchantStatusDefinition(status).active);
}

export function isMerchantOrderClosed(status?: string | null): boolean {
  return Boolean(merchantStatusDefinition(status).closed);
}
