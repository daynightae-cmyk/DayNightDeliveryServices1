import type { TrackingLanguage } from "./i18n";

export type TrackingTone = "neutral" | "info" | "success" | "warning" | "danger";
export type TrackingStatusMeta = { key: string; ar: string; en: string; stage: number; progress: number; tone: TrackingTone };

export const trackingStatuses: Record<string, TrackingStatusMeta> = {
  booked: { key: "booked", ar: "تم حجز الشحنة", en: "Shipment booked", stage: 1, progress: 6, tone: "info" },
  pending: { key: "pending", ar: "بانتظار الاستلام", en: "Awaiting pickup", stage: 1, progress: 8, tone: "neutral" },
  information_received: { key: "information_received", ar: "تم استلام بيانات الشحنة", en: "Information received", stage: 1, progress: 10, tone: "info" },
  picked_up: { key: "picked_up", ar: "تم استلام الشحنة", en: "Shipment picked up", stage: 2, progress: 18, tone: "info" },
  at_origin_facility: { key: "at_origin_facility", ar: "في مركز المنشأ", en: "At origin facility", stage: 2, progress: 24, tone: "info" },
  export_customs: { key: "export_customs", ar: "جمارك التصدير", en: "Export customs", stage: 3, progress: 30, tone: "warning" },
  export_cleared: { key: "export_cleared", ar: "تم التخليص للتصدير", en: "Export cleared", stage: 3, progress: 35, tone: "success" },
  departed: { key: "departed", ar: "غادرت بلد المنشأ", en: "Departed origin", stage: 4, progress: 40, tone: "info" },
  departed_origin: { key: "departed_origin", ar: "غادرت بلد المنشأ", en: "Departed origin", stage: 4, progress: 40, tone: "info" },
  in_transit: { key: "in_transit", ar: "الشحنة في الطريق", en: "In transit", stage: 5, progress: 52, tone: "info" },
  at_transit_hub: { key: "at_transit_hub", ar: "في محطة ترانزيت", en: "At transit hub", stage: 5, progress: 58, tone: "info" },
  customs_clearance: { key: "customs_clearance", ar: "قيد التخليص الجمركي", en: "Customs clearance", stage: 6, progress: 65, tone: "warning" },
  import_customs: { key: "import_customs", ar: "جمارك الاستيراد", en: "Import customs", stage: 6, progress: 65, tone: "warning" },
  customs_exception: { key: "customs_exception", ar: "توجد ملاحظة جمركية", en: "Customs attention required", stage: 6, progress: 65, tone: "warning" },
  import_cleared: { key: "import_cleared", ar: "تم التخليص الجمركي", en: "Import cleared", stage: 6, progress: 72, tone: "success" },
  arrived_destination: { key: "arrived_destination", ar: "وصلت بلد الوجهة", en: "Arrived at destination", stage: 7, progress: 78, tone: "info" },
  available_for_pickup: { key: "available_for_pickup", ar: "جاهزة للاستلام", en: "Available for pickup", stage: 8, progress: 88, tone: "info" },
  out_for_delivery: { key: "out_for_delivery", ar: "خرجت للتسليم", en: "Out for delivery", stage: 8, progress: 92, tone: "info" },
  delivered: { key: "delivered", ar: "تم تسليم الشحنة", en: "Delivered", stage: 9, progress: 100, tone: "success" },
  delayed: { key: "delayed", ar: "تأخير في الرحلة", en: "Shipment delayed", stage: 5, progress: 52, tone: "warning" },
  exception: { key: "exception", ar: "يوجد تنبيه على الشحنة", en: "Shipment exception", stage: 5, progress: 50, tone: "warning" },
  delivery_failed: { key: "delivery_failed", ar: "تعذر التسليم", en: "Delivery attempt failed", stage: 8, progress: 92, tone: "danger" },
  on_hold: { key: "on_hold", ar: "الشحنة معلقة", en: "Shipment on hold", stage: 5, progress: 50, tone: "warning" },
  returned: { key: "returned", ar: "الشحنة مرتجعة", en: "Returned", stage: 7, progress: 68, tone: "danger" },
  cancelled: { key: "cancelled", ar: "تم إلغاء الشحنة", en: "Cancelled", stage: 0, progress: 0, tone: "danger" },
  expired: { key: "expired", ar: "انتهت مدة التتبع", en: "Tracking expired", stage: 0, progress: 0, tone: "warning" },
  not_found: { key: "not_found", ar: "لم يتم العثور على الشحنة", en: "Shipment not found", stage: 0, progress: 0, tone: "danger" },
  unknown: { key: "unknown", ar: "جاري تحديث الحالة", en: "Status updating", stage: 0, progress: 4, tone: "neutral" },
};

export const journeyStages = ["information_received", "picked_up", "departed_origin", "in_transit", "customs_clearance", "arrived_destination", "out_for_delivery", "delivered"] as const;

export function statusMeta(value: unknown) {
  const key = String(value || "unknown").trim().toLowerCase();
  return trackingStatuses[key] || trackingStatuses.unknown;
}

export function statusLabel(value: unknown, language: TrackingLanguage) {
  const meta = statusMeta(value);
  return language === "ar" ? meta.ar : meta.en;
}
