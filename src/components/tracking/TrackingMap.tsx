import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

const mockLocations = {
  mussafah: { labelEn: 'Mussafah', labelAr: 'مصفح', lat: 24.3587, lng: 54.4828 },
  abuDhabi: { labelEn: 'Abu Dhabi', labelAr: 'أبوظبي', lat: 24.4539, lng: 54.3773 },
  dubai: { labelEn: 'Dubai', labelAr: 'دبي', lat: 25.2048, lng: 55.2708 }
};

export default function TrackingMap({ pickupLocation, destinationLocation, status, language }: any) {
  const { lang } = useLanguage();
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    // Try to load leaflet CSS dynamically
    try {
      const id = 'leaflet-css';
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
        document.head.appendChild(link);
      }
    } catch (e) { }

    // Try to dynamic import react-leaflet only in browsers where available
    let mounted = true;
    (async () => {
      try {
        await import('react-leaflet');
        if (mounted) setLeafletReady(true);
      } catch (e) {
        // not installed, we'll show placeholder
        if (mounted) setLeafletReady(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!leafletReady) {
    return (
      <div className="bg-brand-cool/30 rounded-2xl p-4 border border-white/10">
        <h4 className="font-bold text-white">{lang === 'ar' ? 'معاينة مسار الشحنة' : 'Shipment Route Preview'}</h4>
        <p className="text-xs text-white/60">{lang === 'ar' ? 'الخرائط لم تُثبت محليًا. لتفعيل الخريطة، ثبّت الحزم: leaflet و react-leaflet' : 'Map libraries are not installed. To enable map, install: leaflet and react-leaflet'}</p>
        <div className="mt-3 h-56 bg-white/5 rounded-md flex items-center justify-center text-white/50">{lang === 'ar' ? 'مُعطّل: الرجاء تثبيت الحزم' : 'Disabled: please install packages'}</div>
      </div>
    );
  }

  // If leaflet is available, render a simple placeholder map area using the mock coords.
  return (
    <div className="bg-brand-cool/30 rounded-2xl p-4 border border-white/10">
      <h4 className="font-bold text-white">{lang === 'ar' ? 'معاينة مسار الشحنة' : 'Shipment Route Preview'}</h4>
      <p className="text-xs text-white/60">{lang === 'ar' ? 'نقطة الاستلام ونقطة التسليم مع معاينة المسار' : 'Pickup and destination with route preview'}</p>
      <div className="mt-3 h-56 bg-white/5 rounded-md overflow-hidden">
        <div className="w-full h-full flex items-center justify-center text-white/50">{lang === 'ar' ? 'خريطة تفاعلية (قيد التفعيل)' : 'Interactive map (activation pending)'}</div>
      </div>
    </div>
  );
}
