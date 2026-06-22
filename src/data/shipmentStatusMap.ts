export const shipmentStatuses: Record<string, { en: string, ar: string }> = {
  "Pending": {
    en: "Order Created",
    ar: "تم إنشاء الطلب"
  },
  "Accepted": {
    en: "Pickup Scheduled",
    ar: "تم جدولة الاستلام"
  },
  "Driver Assigned": {
    en: "Driver Assigned",
    ar: "تم تعيين السائق"
  },
  "Picked Up": {
    en: "Picked Up",
    ar: "تم استلام الشحنة"
  },
  "In Transit": {
    en: "In Transit",
    ar: "الشحنة في الطريق"
  },
  "Out for Delivery": {
    en: "Out for Delivery",
    ar: "في الطريق للتسليم"
  },
  "Delivered": {
    en: "Delivered",
    ar: "تم التسليم"
  },
  "Cancelled": {
    en: "Cancelled",
    ar: "تم الإلغاء"
  },
  "Failed": {
    en: "Failed Delivery",
    ar: "تعذر التسليم"
  }
};

export function getStatusTranslation(status: string, lang: 'ar' | 'en') {
  const mappedObj = shipmentStatuses[status] || Object.values(shipmentStatuses).find(s => s.en.toLowerCase() === status.toLowerCase() || s.ar === status) || { en: status, ar: status };
  return mappedObj[lang];
}
