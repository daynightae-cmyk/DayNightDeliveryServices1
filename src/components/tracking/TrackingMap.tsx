import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function TrackingMap({ pickupLocation, destinationLocation, status, language }: any) {
  const { lang } = useLanguage();

  return (
    <div className="bg-brand-cool/30 rounded-2xl p-4 border border-white/10">
      <h4 className="font-bold text-white">{lang === 'ar' ? 'معاينة مسار الشحنة' : 'Shipment Route Preview'}</h4>
      <p className="text-xs text-white/60">{lang === 'ar' ? 'نقطة الاستلام ونقطة التسليم مع معاينة المسار' : 'Pickup and destination with route preview'}</p>
      <div className="mt-3 h-56 bg-white/5 rounded-md overflow-hidden">
        <div className="w-full h-full flex flex-col items-center justify-center text-white/50 px-4 text-center">
          <div className="font-semibold mb-2">{lang === 'ar' ? 'الخريطة قيد العرض التجريبي' : 'Map preview is currently in demo mode'}</div>
          <div>{lang === 'ar' ? 'يمكن تفعيل العرض التفاعلي بعد تثبيت حزم الخرائط المناسبة.' : 'Interactive map support can be enabled after installing the map libraries.'}</div>
        </div>
      </div>
      <div className="mt-4 text-xs text-white/50 space-y-1">
        <div><strong>{lang === 'ar' ? 'نقطة الاستلام:' : 'Pickup Point:'}</strong> {pickupLocation?.labelAr || pickupLocation?.labelEn || (lang === 'ar' ? 'مصفح' : 'Mussafah')}</div>
        <div><strong>{lang === 'ar' ? 'نقطة التسليم:' : 'Destination Point:'}</strong> {destinationLocation?.labelAr || destinationLocation?.labelEn || (lang === 'ar' ? 'أبوظبي' : 'Abu Dhabi')}</div>
        <div><strong>{lang === 'ar' ? 'الحالة الحالية:' : 'Current status:'}</strong> {status || (lang === 'ar' ? 'غير محددة' : 'Unknown')}</div>
      </div>
    </div>
  );
}
