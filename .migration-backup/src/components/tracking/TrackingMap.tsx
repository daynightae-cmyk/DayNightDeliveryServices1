import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { defaultLocations } from "../../data/defaultLocations";
import { useAppContext } from "../../lib/AppContext";
import { translations } from "../../data/translations";
import { MapPin } from "lucide-react";

import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Marker.prototype.options.icon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

const destinationIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function TrackingMap() {
  const { language } = useAppContext();
  const t = translations[language].trackingMap;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-64 bg-brand-deep rounded-2xl animate-pulse"></div>;

  const pickup = defaultLocations.mussafah;
  const dest = defaultLocations.abuDhabi;
  const polylinePositions: [number, number][] = [
    [pickup.lat, pickup.lng],
    [dest.lat, dest.lng],
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

          <Polyline positions={polylinePositions} color="#EAB308" weight={3} dashArray="10, 10" opacity={0.8} />
        </MapContainer>
      </div>
      <p className={`mt-3 text-white/40 font-mono text-[10px] uppercase ${language === 'ar' ? 'text-right' : 'text-left'}`}>
        ⚡ {t.gpsSoon}
      </p>
    </div>
  );
}
