import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { mockLocations } from "../../data/mockLocations";
import { useAppContext } from "../../lib/AppContext";
import { translations } from "../../data/translations";
import { MapPin, AlertTriangle } from "lucide-react";

// Fix Leaflet marker icon issue in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const destinationIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface TrackingMapProps {
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  driverLat?: number;
  driverLng?: number;
}

export default function TrackingMap({ pickupLat, pickupLng, deliveryLat, deliveryLng }: TrackingMapProps) {
  const { language } = useAppContext();
  const t = translations[language].trackingMap;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-64 bg-brand-deep rounded-2xl animate-pulse"></div>;

  const pickup = { lat: pickupLat ?? mockLocations.mussafah.lat, lng: pickupLng ?? mockLocations.mussafah.lng, labelAr: mockLocations.mussafah.labelAr, labelEn: mockLocations.mussafah.labelEn };
  const dest = { lat: deliveryLat ?? mockLocations.abuDhabi.lat, lng: deliveryLng ?? mockLocations.abuDhabi.lng, labelAr: mockLocations.abuDhabi.labelAr, labelEn: mockLocations.abuDhabi.labelEn };

  const hasRealCoords = !!(pickupLat && pickupLng && deliveryLat && deliveryLng);
  const polylinePositions: [number, number][] = [
    [pickup.lat, pickup.lng],
    [dest.lat, dest.lng]
  ];

  return (
    <div className="bg-brand-cool/20 rounded-2xl border border-white/10 p-5 mt-8 shadow-lg">
      <div className={`flex flex-col mb-4 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
        <h3 className="text-white font-bold text-lg flex items-center gap-2 justify-start flex-row-reverse">
          <span>{t.title}</span>
          <MapPin className="w-5 h-5 text-brand-gold" />
        </h3>
        <p className="text-white/60 text-xs">{t.description}</p>
      </div>

      {!hasRealCoords && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-400/80 text-xs font-bold">خريطة تقديرية غير مباشرة — لا تمثل موقعاً حقيقياً للشحنة</p>
        </div>
      )}

      <div className="h-64 sm:h-80 w-full rounded-xl overflow-hidden border border-brand-gold/20 relative z-0">
        <MapContainer
          center={[24.4063, 54.4300]}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
          />

          <Marker position={[pickup.lat, pickup.lng]}>
             <Popup>
               <div className={`text-xs font-bold font-sans ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  <p className="text-brand-blue uppercase">{t.pickupPoint}</p>
                  <p>{language === 'ar' ? pickup.labelAr : pickup.labelEn}</p>
               </div>
             </Popup>
          </Marker>

          <Marker position={[dest.lat, dest.lng]} icon={destinationIcon}>
             <Popup>
               <div className={`text-xs font-bold font-sans ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  <p className="text-brand-gold uppercase">{t.destinationPoint}</p>
                  <p>{language === 'ar' ? dest.labelAr : dest.labelEn}</p>
               </div>
             </Popup>
          </Marker>

          <Polyline 
            positions={polylinePositions} 
            color="#EAB308"
            weight={3}
            dashArray="10, 10"
            opacity={0.8}
          />
        </MapContainer>
      </div>
      <p className={`mt-3 text-white/40 font-mono text-[10px] uppercase ${language === 'ar' ? 'text-right' : 'text-left'}`}>
        ⚡ {t.gpsSoon}
      </p>
    </div>
  );
}

