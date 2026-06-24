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
  Pending: {
    labelAr: "قيد الانتظار",
    labelEn: "Pending",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    descriptionAr: "تم استلام الطلب وبانتظار التأكيد من الإدارة"
  },
  Confirmed: {
    labelAr: "تم التأكيد",
    labelEn: "Confirmed",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    descriptionAr: "تم تأكيد طلب الشحن وجاري تنسيق الاستلام"
  },
  Assigned: {
    labelAr: "تم التعيين للكابتن",
    labelEn: "Assigned",
    color: "text-indigo-400",
    bgColor: "bg-indigo-400/10",
    descriptionAr: "تم تعيين مندوب التوصيل لاستلام الشحنة"
  },
  "Picked Up": {
    labelAr: "تم استلام الشحنة",
    labelEn: "Picked Up",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    descriptionAr: "تم استلام الطرد بنجاح من المرسل"
  },
  "In Transit": {
    labelAr: "في الطريق",
    labelEn: "In Transit",
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    descriptionAr: "الشحنة في طريقها إلى المركز اللوجستي للتوزيع"
  },
  "Out For Delivery": {
    labelAr: "مع المندوب للتوصيل",
    labelEn: "Out For Delivery",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    descriptionAr: "الشحنة خارجة مع كابتن التوزيع النهائي"
  },
  Delivered: {
    labelAr: "تم التسليم بنجاح",
    labelEn: "Delivered",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    descriptionAr: "تم تسليم الطرد للمستلم بنجاح"
  },
  Cancelled: {
    labelAr: "ملغي",
    labelEn: "Cancelled",
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    descriptionAr: "تم إلغاء طلب التوصيل من قبل المرسل أو الإدارة"
  }
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_LABELS[status] || {
    labelAr: status,
    labelEn: status,
    color: "text-white/60",
    bgColor: "bg-white/5",
    descriptionAr: "تحديث حالة الشحنة اللوجستية"
  };
}
