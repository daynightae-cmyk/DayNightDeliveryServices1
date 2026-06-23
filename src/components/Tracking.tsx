import { useEffect, useMemo, useState } from "react";
import { trackOrderRpc } from "../supabase";
import type { Order } from "../types";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import ShipmentProgressBar from "./tracking/ShipmentProgressBar";
import TrackingMap from "./tracking/TrackingMap";
import { canRetryTracking } from "../lib/security";
import { reportError, trackApiCall } from "../lib/monitoring";
import { whatsappStatusUpdate } from "../lib/whatsapp";

interface TrackingProps {
  initialTrackingId?: string;
}

const DEMO_TRACKING_CODE = "DN-2026-00001";

function buildDemoTrackingOrder(): Order {
  const createdAt = new Date().toISOString();

  return {
    id: DEMO_TRACKING_CODE,
    tracking_code: DEMO_TRACKING_CODE,
    tracking_number: DEMO_TRACKING_CODE,
    sender_name: "DAY NIGHT Operations",
    sender_phone: "+971 56 875 7331",
    sender_city: "Abu Dhabi",
    sender_address: "UAE ABUDHABI MUSSAFAH 40",
    receiver_name: "Customer",
    receiver_phone: "+971 56 875 7331",
    receiver_city: "Dubai",
    receiver_address: "Business Bay",
    package_type: "Parcel",
    weight: 1,
    pieces: 1,
    service_type: "standard",
    delivery_price: 30,
    payment_method: "sender_pays",
    notes: "Demo tracking preview for local UI verification.",
    status: "In Transit",
    status_history: [
      { status: "Pending", date: createdAt, note: "Order created." },
      { status: "Accepted", date: createdAt, note: "Accepted by operations." },
      { status: "Picked Up", date: createdAt, note: "Shipment picked up." },
      { status: "In Transit", date: createdAt, note: "Shipment is moving between hubs." },
    ],
    created_at: createdAt,
  } as Order;
}

export default function Tracking({ initialTrackingId = "" }: TrackingProps) {
  const { language } = useAppContext();
  const t = translations[language];

  const [query, setQuery] = useState(initialTrackingId);
  const [order, setOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const trackingCode = useMemo(() => {
    if (!order) return "";
    return order.tracking_code || order.tracking_number || order.id;
  }, [order]);

  useEffect(() => {
    if (initialTrackingId) {
      void handleSearch(initialTrackingId);
    }
  }, [initialTrackingId]);

  async function handleSearch(forcedValue?: string) {
    const key = (forcedValue || query).trim();
    if (!key) return;

    setSearched(true);
    setOrder(null);
    setError("");

    try {
      const found = await trackApiCall("track_order", () => trackOrderRpc(key));
      const result = Array.isArray(found) ? found[0] : found;

      if (!result) {
        if (key.toUpperCase() === DEMO_TRACKING_CODE) {
          setOrder(buildDemoTrackingOrder());
          return;
        }

        const attempt = canRetryTracking();
        if (!attempt.allowed) {
          setError(language === "ar" ? "تم تجاوز حد محاولات التتبع الفاشلة مؤقتاً. يرجى المحاولة لاحقاً." : "Tracking retry limit exceeded temporarily. Please try again later.");
          return;
        }
        setError(t.tracking.notFoundError || "Shipment not found");
        return;
      }

      setOrder(result as Order);
    } catch (e) {
      reportError(e, "tracking_search", { code: key });
      setError(t.tracking.serverError || "Unable to fetch tracking now.");
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="bg-brand-cool/40 border border-white/10 rounded-3xl p-6 space-y-4 text-center">
        <h2 className="text-2xl font-bold text-white">{t.tracking.title || "Track Your Shipment"}</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="DN-2026-XXXXX"
            className="flex-1 bg-brand-deep border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono"
          />
          <button onClick={() => void handleSearch()} className="px-6 py-3 bg-brand-gold text-brand-deep rounded-xl font-bold">
            {t.tracking.searchBtn || "Search"}
          </button>
        </div>
      </section>

      {searched && !order && (
        <section className="bg-brand-cool/30 border border-white/10 rounded-2xl p-6 text-center space-y-3">
          <p className="text-white">{error || (language === "ar" ? "لم يتم العثور على الشحنة." : "Shipment not found.")}</p>
          <a href={whatsappStatusUpdate(query || "unknown", "support")} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm">
            WhatsApp Support
          </a>
        </section>
      )}

      {order && (
        <section className="space-y-4">
          <div className="bg-brand-cool/30 border border-white/10 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <p className="text-white/80"><span className="text-brand-gold">Tracking:</span> {trackingCode}</p>
            <p className="text-white/80"><span className="text-brand-gold">Status:</span> {order.status}</p>
            <p className="text-white/80"><span className="text-brand-gold">Sender city:</span> {order.sender_city}</p>
            <p className="text-white/80"><span className="text-brand-gold">Receiver city:</span> {order.receiver_city}</p>
            <p className="text-white/80"><span className="text-brand-gold">Package:</span> {order.package_type}</p>
            <p className="text-white/80" dir="ltr"><span className="text-brand-gold">Weight:</span> {order.weight} kg</p>
            <p className="text-white/80" dir="ltr"><span className="text-brand-gold">Delivery price:</span> {order.delivery_price} AED</p>
            <p className="text-white/80"><span className="text-brand-gold">Created:</span> {new Date(order.created_at).toLocaleString()}</p>
          </div>

          <ShipmentProgressBar status={order.status} />
          <TrackingMap />

          {Array.isArray(order.status_history) && order.status_history.length > 0 && (
            <div className="bg-brand-cool/30 border border-white/10 rounded-2xl p-6 space-y-2">
              <h3 className="text-white font-bold">Status History</h3>
              {order.status_history.slice().reverse().map((item, index) => (
                <div key={`${item.status}-${item.date}-${index}`} className="text-xs text-white/70 border-b border-white/5 pb-2">
                  <p className="font-bold text-white">{item.status}</p>
                  <p>{item.date}</p>
                  {item.note ? <p>{item.note}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
