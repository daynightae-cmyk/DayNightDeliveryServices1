/**
 * Shipment statuses mapped to English & Arabic labels, colors, and notes
 */
export interface StatusConfig {
  labelAr: string;
  labelEn: string;
  color: string;
  bgColor: string;
  descriptionAr: string;
}

export const STATUS_LABELS: Record<string, StatusConfig> = {
  pending: {
    labelAr: "قيد المراجعة",
    labelEn: "Pending Review",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    descriptionAr: "تم استلام الطلب وبانتظار التأكيد من الإدارة"
  },
  confirmed: {
    labelAr: "تم التأكيد",
    labelEn: "Confirmed",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    descriptionAr: "تم تأكيد طلب الشحن وجاري تنسيق الاستلام"
  },
  assigned: {
    labelAr: "تم تعيين السائق",
    labelEn: "Driver Assigned",
    color: "text-indigo-400",
    bgColor: "bg-indigo-400/10",
    descriptionAr: "تم تعيين مندوب التوصيل لاستلام الشحنة"
  },
  picked_up: {
    labelAr: "تم الاستلام",
    labelEn: "Picked Up",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    descriptionAr: "تم استلام الطرد بنجاح من المرسل"
  },
  in_transit: {
    labelAr: "قيد التوصيل",
    labelEn: "In Transit",
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    descriptionAr: "الشحنة في طريقها إلى عنوان التسليم"
  },
  delivered: {
    labelAr: "تم التسليم",
    labelEn: "Delivered",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    descriptionAr: "تم تسليم الطرد للمستلم بنجاح"
  },
  cancelled: {
    labelAr: "تم الإلغاء",
    labelEn: "Cancelled",
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    descriptionAr: "تم إلغاء طلب التوصيل"
  },
  returned: {
    labelAr: "مرتجع",
    labelEn: "Returned",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    descriptionAr: "تم إرجاع الشحنة إلى المرسل"
  }
};

/** Normalize legacy PascalCase statuses to snake_case */
function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    "Pending": "pending",
    "Confirmed": "confirmed",
    "Assigned": "assigned",
    "Picked Up": "picked_up",
    "In Transit": "in_transit",
    "Out For Delivery": "in_transit",
    "Delivered": "delivered",
    "Failed": "cancelled",
    "Cancelled": "cancelled",
    "Returned": "returned"
  };
  return map[status] || status.toLowerCase().replace(/ /g, "_");
}

export function getStatusConfig(status: string): StatusConfig {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] || {
    labelAr: status,
    labelEn: status,
    color: "text-white/60",
    bgColor: "bg-white/5",
    descriptionAr: "تحديث حالة الشحنة اللوجستية"
  };
}
