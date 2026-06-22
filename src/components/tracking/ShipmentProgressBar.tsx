import React from 'react';
import { Package, Settings, Truck, CheckCircle } from 'lucide-react';

type Props = {
  currentStatus: string;
  language?: 'en' | 'ar';
};

const statusToStep: Record<string, string> = {
  order_created: 'order_placed',
  pickup_scheduled: 'processing',
  driver_assigned: 'processing',
  picked_up: 'processing',
  in_transit: 'processing',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'issue',
  failed_delivery: 'issue'
};

const steps = [
  { key: 'order_placed', labelEn: 'Order Placed', labelAr: 'تم إنشاء الطلب', icon: <Package className="w-5 h-5"/> },
  { key: 'processing', labelEn: 'Processing', labelAr: 'قيد المعالجة', icon: <Settings className="w-5 h-5"/> },
  { key: 'out_for_delivery', labelEn: 'Out for Delivery', labelAr: 'في الطريق للتسليم', icon: <Truck className="w-5 h-5"/> },
  { key: 'delivered', labelEn: 'Delivered', labelAr: 'تم التسليم', icon: <CheckCircle className="w-5 h-5"/> }
];

export default function ShipmentProgressBar({ currentStatus, language = 'en' }: Props) {
  const normalized = (currentStatus || '').toString().toLowerCase().replace(/\s+/g, '_');
  const activeStepKey = statusToStep[normalized] || normalized || 'order_placed';
  const activeIndex = steps.findIndex(s => s.key === activeStepKey);

  return (
    <div className="w-full">
      <div className="hidden md:flex items-center justify-between gap-4">
        {steps.map((s, idx) => {
          const state = idx < activeIndex ? 'completed' : idx === activeIndex ? 'active' : 'pending';
          return (
            <div key={s.key} className="flex-1 flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${state === 'completed' ? 'bg-brand-gold border-brand-gold text-brand-deep' : state === 'active' ? 'bg-brand-blue/80 border-brand-gold text-white animate-pulse' : 'bg-white/5 border-white/10 text-white/40'}`}>
                {s.icon}
              </div>
              <div className="flex-1">
                <div className={`font-bold ${state === 'completed' ? 'text-white' : state === 'active' ? 'text-white' : 'text-white/50'}`}>{language === 'ar' ? s.labelAr : s.labelEn}</div>
                <div className="text-xs text-white/50">{state === 'completed' ? (language === 'ar' ? 'مكتمل' : 'Completed') : state === 'active' ? (language === 'ar' ? 'جاري التنفيذ' : 'In progress') : ''}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile stacked view */}
      <div className="md:hidden space-y-3">
        {steps.map((s, idx) => {
          const state = idx < activeIndex ? 'completed' : idx === activeIndex ? 'active' : 'pending';
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${state === 'completed' ? 'bg-brand-gold border-brand-gold text-brand-deep' : state === 'active' ? 'bg-brand-blue/80 border-brand-gold text-white animate-pulse' : 'bg-white/5 border-white/10 text-white/40'}`}>
                {s.icon}
              </div>
              <div>
                <div className={`font-bold ${state === 'completed' ? 'text-white' : state === 'active' ? 'text-white' : 'text-white/50'}`}>{language === 'ar' ? s.labelAr : s.labelEn}</div>
                <div className="text-xs text-white/50">{state === 'completed' ? (language === 'ar' ? 'مكتمل' : 'Completed') : state === 'active' ? (language === 'ar' ? 'جاري التنفيذ' : 'In progress') : ''}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
