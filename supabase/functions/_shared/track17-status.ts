export type NormalizedTrackingStatus =
  | "not_found"
  | "information_received"
  | "picked_up"
  | "departed_origin"
  | "in_transit"
  | "customs_clearance"
  | "customs_exception"
  | "arrived_destination"
  | "available_for_pickup"
  | "out_for_delivery"
  | "delivery_failed"
  | "delivered"
  | "exception"
  | "expired"
  | "returned"
  | "cancelled"
  | "unknown";

export type StatusDescriptor = {
  normalized: NormalizedTrackingStatus;
  rank: number;
  ar: string;
  en: string;
  tone: "neutral" | "info" | "warning" | "danger" | "success";
};

const descriptors: Record<NormalizedTrackingStatus, StatusDescriptor> = {
  not_found: { normalized: "not_found", rank: 0, ar: "لم يتم العثور على الشحنة", en: "Shipment not found", tone: "danger" },
  information_received: { normalized: "information_received", rank: 10, ar: "تم استلام بيانات الشحنة", en: "Shipment information received", tone: "info" },
  picked_up: { normalized: "picked_up", rank: 20, ar: "تم استلام الشحنة من المرسل", en: "Shipment picked up", tone: "info" },
  departed_origin: { normalized: "departed_origin", rank: 30, ar: "غادرت الشحنة بلد المنشأ", en: "Departed origin country", tone: "info" },
  in_transit: { normalized: "in_transit", rank: 40, ar: "الشحنة في الطريق", en: "Shipment in transit", tone: "info" },
  customs_clearance: { normalized: "customs_clearance", rank: 50, ar: "الشحنة قيد التخليص الجمركي", en: "Customs clearance in progress", tone: "warning" },
  customs_exception: { normalized: "customs_exception", rank: 51, ar: "توجد ملاحظة جمركية", en: "Customs attention required", tone: "warning" },
  arrived_destination: { normalized: "arrived_destination", rank: 60, ar: "وصلت الشحنة إلى بلد الوجهة", en: "Arrived in destination country", tone: "info" },
  available_for_pickup: { normalized: "available_for_pickup", rank: 70, ar: "الشحنة جاهزة للاستلام", en: "Available for pickup", tone: "info" },
  out_for_delivery: { normalized: "out_for_delivery", rank: 80, ar: "خرجت الشحنة للتسليم", en: "Out for delivery", tone: "info" },
  delivery_failed: { normalized: "delivery_failed", rank: 81, ar: "تعذر تسليم الشحنة", en: "Delivery attempt failed", tone: "danger" },
  delivered: { normalized: "delivered", rank: 100, ar: "تم تسليم الشحنة", en: "Shipment delivered", tone: "success" },
  exception: { normalized: "exception", rank: 45, ar: "يوجد تنبيه أو استثناء على الشحنة", en: "Shipment exception", tone: "warning" },
  expired: { normalized: "expired", rank: 5, ar: "انتهت مدة التتبع دون تحديث", en: "Tracking expired", tone: "warning" },
  returned: { normalized: "returned", rank: 90, ar: "الشحنة مرتجعة", en: "Shipment returned", tone: "danger" },
  cancelled: { normalized: "cancelled", rank: 1, ar: "تم إلغاء الشحنة", en: "Shipment cancelled", tone: "danger" },
  unknown: { normalized: "unknown", rank: 0, ar: "حالة غير محددة", en: "Unknown status", tone: "neutral" },
};

function canonical(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function describeTrack17Status(status: unknown, subStatus?: unknown, description?: unknown): StatusDescriptor {
  const raw = `${canonical(status)} ${canonical(subStatus)} ${canonical(description)}`;

  if (/delivered/.test(raw) && !/undelivered|deliveryfailure|failed/.test(raw)) return descriptors.delivered;
  if (/outfordelivery/.test(raw)) return descriptors.out_for_delivery;
  if (/availableforpickup|pickupnotified/.test(raw)) return descriptors.available_for_pickup;
  if (/deliveryfailure|undelivered|deliveryattemptfailed/.test(raw)) return descriptors.delivery_failed;
  if (/returning|returned|returntosender/.test(raw)) return descriptors.returned;
  if (/customs/.test(raw) && /hold|exception|failed|delay|attention|tax|duty/.test(raw)) return descriptors.customs_exception;
  if (/customs|clearance/.test(raw)) return descriptors.customs_clearance;
  if (/arrival|arrivedatdestination|destinationcountry/.test(raw)) return descriptors.arrived_destination;
  if (/departure|departed|exported/.test(raw)) return descriptors.departed_origin;
  if (/pickedup|pickup|collected/.test(raw)) return descriptors.picked_up;
  if (/intransit|transit/.test(raw)) return descriptors.in_transit;
  if (/inforeceived|informationreceived|labelcreated|pretransit/.test(raw)) return descriptors.information_received;
  if (/notfound/.test(raw)) return descriptors.not_found;
  if (/expired|stopped/.test(raw)) return descriptors.expired;
  if (/cancel/.test(raw)) return descriptors.cancelled;
  if (/exception|alert|problem|delay|failed/.test(raw)) return descriptors.exception;
  return descriptors.unknown;
}

export function statusDescriptor(normalized: string) {
  return descriptors[normalized as NormalizedTrackingStatus] || descriptors.unknown;
}

export function statusCanAdvance(currentRank: number | null | undefined, next: StatusDescriptor, nextEventAt?: string | null, currentEventAt?: string | null) {
  if (next.normalized === "delivered") return true;
  if (next.normalized === "delivery_failed" || next.normalized === "customs_exception" || next.normalized === "exception") return true;
  if (nextEventAt && currentEventAt) {
    const nextTime = Date.parse(nextEventAt);
    const currentTime = Date.parse(currentEventAt);
    if (Number.isFinite(nextTime) && Number.isFinite(currentTime) && nextTime < currentTime) return false;
  }
  return next.rank >= Number(currentRank || 0);
}
