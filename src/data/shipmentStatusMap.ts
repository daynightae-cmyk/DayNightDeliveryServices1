export const shipmentStatuses: Record<string, { en: string, ar: string }> = {
  // Official lowercase statuses
  "pending": { en: "Order Created", ar: "تم إنشاء الطلب" },
  "confirmed": { en: "Confirmed", ar: "تم التأكيد" },
  "assigned": { en: "Driver Assigned", ar: "تم تعيين السائق" },
  "picked_up": { en: "Picked Up", ar: "تم الاستلام" },
  "in_transit": { en: "In Transit", ar: "قيد التوصيل" },
  "delivered": { en: "Delivered", ar: "تم التسليم" },
  "cancelled": { en: "Cancelled", ar: "تم الإلغاء" },
  "returned": { en: "Returned", ar: "مرتجع" },
  // Legacy PascalCase — mapped for backward compatibility
  "Pending": { en: "Order Created", ar: "تم إنشاء الطلب" },
  "Confirmed": { en: "Confirmed", ar: "تم التأكيد" },
  "Assigned": { en: "Driver Assigned", ar: "تم تعيين السائق" },
  "Picked Up": { en: "Picked Up", ar: "تم الاستلام" },
  "In Transit": { en: "In Transit", ar: "قيد التوصيل" },
  "Out For Delivery": { en: "In Transit", ar: "قيد التوصيل" },
  "Delivered": { en: "Delivered", ar: "تم التسليم" },
  "Cancelled": { en: "Cancelled", ar: "تم الإلغاء" },
  "Failed": { en: "Failed Delivery", ar: "تعذر التسليم" }
};

export function getStatusTranslation(status: string, lang: 'ar' | 'en') {
  const mappedObj = shipmentStatuses[status]
    || Object.values(shipmentStatuses).find(s => s.en.toLowerCase() === status.toLowerCase() || s.ar === status)
    || { en: status, ar: status };
  return mappedObj[lang];
}

