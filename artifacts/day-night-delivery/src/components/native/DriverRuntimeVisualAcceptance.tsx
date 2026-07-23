import { Link, useNavigate } from "react-router-dom";
import TrackingMap from "../tracking/TrackingMap";
import type { Order } from "../../types";

const acceptanceOrder = {
  id: "DN-DRIVER-MAP-ACCEPTANCE",
  tracking_number: "DN-MAP-112",
  status: "confirmed",
  sender_city: "Mussafah",
  sender_address: "Mussafah Industrial Area, Abu Dhabi",
  pickup_lat: 24.3589,
  pickup_lng: 54.4827,
  receiver_city: "Abu Dhabi",
  receiver_address: "Al Reem Island, Abu Dhabi",
  delivery_lat: 24.4942,
  delivery_lng: 54.4071,
  driver_id: "driver-runtime-acceptance",
} as unknown as Order;

export default function DriverRuntimeVisualAcceptance() {
  const navigate = useNavigate();

  return (
    <section
      data-driver-runtime-acceptance="ready"
      dir="rtl"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483640,
        display: "grid",
        gridTemplateRows: "auto minmax(0,1fr)",
        width: "100vw",
        height: "100dvh",
        padding: "max(10px,env(safe-area-inset-top)) 10px max(10px,env(safe-area-inset-bottom))",
        gap: 10,
        overflow: "hidden",
        background: "#071a33",
        color: "#ffffff",
        fontFamily: "Cairo,Arial,sans-serif",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 74, padding: "10px 13px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 20, background: "#0b2544" }}>
        <div>
          <small style={{ color: "#d4af37", fontWeight: 900 }}>DAY NIGHT DRIVER</small>
          <h1 style={{ margin: "3px 0 0", fontSize: 20, fontWeight: 900 }}>اختبار الملاحة الداخلية الحية</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => navigate("/driver?nativeShell=driver&nosplash=1")} style={{ minHeight: 42, border: 0, borderRadius: 12, padding: "0 13px", background: "#d4af37", color: "#071a33", fontWeight: 900 }}>الرئيسية</button>
          <Link to="/driver?nativeShell=driver&nosplash=1" style={{ display: "grid", placeItems: "center", minHeight: 42, borderRadius: 12, padding: "0 13px", background: "rgba(255,255,255,.1)", color: "#fff", fontWeight: 900 }}>رجوع</Link>
        </div>
      </header>
      <main style={{ minHeight: 0, overflow: "hidden", borderRadius: 24 }}>
        <TrackingMap
          order={acceptanceOrder}
          navigationMode
          devicePosition={{
            latitude: 24.4539,
            longitude: 54.3773,
            heading: 44,
            speed: 12,
            accuracy: 6,
          }}
        />
      </main>
    </section>
  );
}
