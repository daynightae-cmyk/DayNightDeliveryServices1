export const shipmentStatuses: Record<string, { en: string; ar: string }> = {
  order_created: { en: 'Order Created', ar: 'تم إنشاء الطلب' },
  pickup_scheduled: { en: 'Pickup Scheduled', ar: 'تم جدولة الاستلام' },
  driver_assigned: { en: 'Driver Assigned', ar: 'تم تعيين السائق' },
  picked_up: { en: 'Picked Up', ar: 'تم استلام الشحنة' },
  in_transit: { en: 'In Transit', ar: 'الشحنة في الطريق' },
  out_for_delivery: { en: 'Out for Delivery', ar: 'في الطريق للتسليم' },
  delivered: { en: 'Delivered', ar: 'تم التسليم' },
  cancelled: { en: 'Cancelled', ar: 'تم الإلغاء' },
  failed_delivery: { en: 'Failed Delivery', ar: 'تعذر التسليم' }
};
