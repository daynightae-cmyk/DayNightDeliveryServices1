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
import { Search, Package, MapPin, Truck, Clock, User, MessageSquare, AlertCircle, CheckCircle2 } from "lucide-react";

/* ─── Demo mock order shown for code "DN-2026-DEMO" ──────────────── */
const DEMO_ORDER: Order = {
  id: "demo-001",
  tracking_code: "DN-2026-DEMO",
  tracking_number: "DN-2026-DEMO",
  status: "In Transit",
  sender_city: "Abu Dhabi",
  receiver_city: "Dubai",
  package_type: "Documents",
  weight: 0.5,
  delivery_price: 30,
  created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  status_history: [
    { status: "Order Created",       date: new Date(Date.now() - 3 * 60 * 60 * 1000).toLocaleDateString("en-AE", { hour: "2-digit", minute: "2-digit" }), note: "Shipment registered" },
    { status: "Picked Up",           date: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleDateString("en-AE", { hour: "2-digit", minute: "2-digit" }), note: "Driver picked up package" },
    { status: "In Transit",          date: new Date(Date.now() - 40 * 60 * 1000).toLocaleDateString("en-AE", { hour: "2-digit", minute: "2-digit" }), note: "En route to Dubai" },
  ],
} as unknown as Order;

interface TrackingProps {
  initialTrackingId?: string;
}

export default function Tracking({ initialTrackingId = "" }: TrackingProps) {
  const { language, theme } = useAppContext();
  const t = translations[language];
  const isArabic = language === "ar";
  const isLight  = theme === "light";

  const [query,    setQuery]    = useState(initialTrackingId);
  const [order,    setOrder]    = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const trackingCode = useMemo(() => {
    if (!order) return "";
    return order.tracking_code || order.tracking_number || order.id;
  }, [order]);

  useEffect(() => {
    if (initialTrackingId) void handleSearch(initialTrackingId);
  }, [initialTrackingId]);

  async function handleSearch(forcedValue?: string) {
    const key = (forcedValue ?? query).trim().toUpperCase();
    if (!key) return;

    setSearched(true);
    setOrder(null);
    setError("");
    setLoading(true);

    /* Demo mode — always works */
    if (key === "DN-2026-DEMO") {
      await new Promise(r => setTimeout(r, 900));
      setOrder(DEMO_ORDER);
      setLoading(false);
      return;
    }

    try {
      const found = await trackApiCall("track_order", () => trackOrderRpc(key));
      const result = Array.isArray(found) ? found[0] : found;
      if (!result) {
        const attempt = canRetryTracking();
        if (!attempt.allowed) {
          setError(isArabic
            ? "تم تجاوز حد المحاولات مؤقتاً. يرجى المحاولة لاحقاً."
            : "Too many attempts. Please try again later.");
        } else {
          setError(t.tracking.notFoundError || (isArabic ? "الشحنة غير موجودة." : "Shipment not found."));
        }
      } else {
        setOrder(result as Order);
      }
    } catch (e) {
      reportError(e, "tracking_search", { code: key });
      setError(t.tracking.serverError || (isArabic ? "تعذّر الاتصال بالخادم." : "Unable to connect. Try again."));
    } finally {
      setLoading(false);
    }
  }

  /* ── Colour helpers ── */
  const cardBg     = isLight ? "rgba(255,255,255,0.88)"  : "rgba(16,35,63,0.82)";
  const cardBorder = isLight ? "rgba(30,144,255,0.16)"   : "rgba(56,139,253,0.22)";
  const innerBg    = isLight ? "rgba(244,248,255,0.80)"  : "rgba(8,23,44,0.65)";
  const innerBdr   = isLight ? "rgba(10,28,58,0.10)"    : "rgba(255,255,255,0.08)";
  const textMain   = isLight ? "#0A1C3A" : "#F8FAFC";
  const textMuted  = isLight ? "#52627A" : "#7F8EA3";

  return (
    <div
      className="max-w-4xl mx-auto space-y-5"
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* ── Header ── */}
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/25 rounded-full px-4 py-1.5 text-[11px] font-bold text-brand-gold mb-2">
          <Package className="w-3.5 h-3.5" />
          {isArabic ? "تتبع الشحنة" : "Shipment Tracking"}
        </div>
        <h1 style={{ color: textMain }} className="text-2xl sm:text-3xl font-black">
          {t.tracking.title || (isArabic ? "تتبع شحنتك لحظة بلحظة" : "Track Your Shipment")}
        </h1>
        <p style={{ color: textMuted }} className="text-sm">
          {isArabic
            ? "أدخل رقم التتبع للاطلاع على حالة الشحنة فوراً."
            : "Enter your tracking code to see real-time shipment status."}
        </p>
      </div>

      {/* ── Search card ── */}
      <div
        style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }}
        className="rounded-3xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-3.5 my-auto w-4 h-4 text-brand-gold pointer-events-none" style={{ right: isArabic ? "14px" : "auto", left: isArabic ? "auto" : "14px" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void handleSearch()}
              placeholder="DN-2026-DEMO"
              className="w-full rounded-2xl px-4 py-3 font-mono text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              style={{
                background: innerBg,
                border: `1px solid ${innerBdr}`,
                color: textMain,
                paddingLeft: isArabic ? "1rem" : "2.5rem",
                paddingRight: isArabic ? "2.5rem" : "1rem",
              }}
            />
          </div>
          <button
            onClick={() => void handleSearch()}
            disabled={loading}
            className="btn-gold px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 justify-center disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-brand-deep/40 border-t-brand-deep animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {t.tracking.searchBtn || (isArabic ? "تتبع" : "Track")}
          </button>
        </div>

        {/* Demo hint */}
        <div
          style={{ background: isLight ? "rgba(30,144,255,0.06)" : "rgba(30,144,255,0.08)", border: `1px solid rgba(30,144,255,0.20)` }}
          className="rounded-2xl p-3 flex items-center gap-3"
        >
          <div className="shrink-0 w-8 h-8 rounded-xl bg-brand-blue/15 border border-brand-blue/25 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-brand-blue" />
          </div>
          <div>
            <p style={{ color: textMuted }} className="text-xs">
              {isArabic
                ? <>جرّب الكود التجريبي: <span dir="ltr" className="font-mono font-bold text-brand-sky">DN-2026-DEMO</span> لرؤية نموذج التتبع</>
                : <>Try the demo code: <span className="font-mono font-bold text-brand-sky">DN-2026-DEMO</span> to preview tracking</>}
            </p>
          </div>
        </div>
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}` }} className="rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin mx-auto" />
          <p style={{ color: textMuted }} className="text-sm">
            {isArabic ? "جارٍ البحث عن شحنتك…" : "Searching for your shipment…"}
          </p>
        </div>
      )}

      {/* ── Not found / Error ── */}
      {!loading && searched && !order && (
        <div
          style={{ background: cardBg, border: `1px solid rgba(239,68,68,0.25)` }}
          className="rounded-3xl p-6 text-center space-y-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <p style={{ color: textMain }} className="font-bold text-base">
              {isArabic ? "لم يتم العثور على الشحنة" : "Shipment not found"}
            </p>
            <p style={{ color: textMuted }} className="text-sm mt-1">
              {error || (isArabic ? "تحقق من رقم التتبع وأعد المحاولة." : "Please check your tracking code and try again.")}
            </p>
          </div>
          <a
            href={whatsappStatusUpdate(query || "unknown", "support")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold"
          >
            <MessageSquare className="w-4 h-4" />
            {isArabic ? "تواصل مع الدعم" : "Contact Support"}
          </a>
        </div>
      )}

      {/* ── Order found ── */}
      {!loading && order && (
        <div className="space-y-4">
          {/* Status overview */}
          <div
            style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }}
            className="rounded-3xl p-5 sm:p-6"
          >
            {/* Tracking code + status badge */}
            <div className={`flex flex-wrap items-center justify-between gap-3 mb-5 ${isArabic ? "flex-row-reverse" : ""}`}>
              <div>
                <p style={{ color: textMuted }} className="text-[11px] uppercase tracking-wider font-bold">
                  {isArabic ? "رقم التتبع" : "Tracking Code"}
                </p>
                <p dir="ltr" style={{ color: textMain }} className="text-xl font-black font-mono mt-0.5">{trackingCode}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-brand-gold/15 border border-brand-gold/30 text-brand-gold text-xs font-bold rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                {order.status === "In Transit" || order.status === "Out for Delivery" || order.status === "Out For Delivery"
                  ? (isArabic ? "في الطريق" : "In Transit")
                  : order.status === "Delivered"
                  ? (isArabic ? "تم التسليم" : "Delivered")
                  : (isArabic ? "معالجة" : "Processing")}
              </span>
            </div>

            {/* Shipment info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {[
                { icon: MapPin,  label: isArabic ? "المدينة المرسلة" : "From",       val: order.sender_city },
                { icon: MapPin,  label: isArabic ? "المدينة المستلمة" : "To",         val: order.receiver_city },
                { icon: Package, label: isArabic ? "نوع الطرد" : "Package",           val: order.package_type },
                { icon: Truck,   label: isArabic ? "الوزن" : "Weight",               val: `${order.weight} kg` },
                { icon: Clock,   label: isArabic ? "سعر التوصيل" : "Delivery Price", val: `${order.delivery_price} AED` },
                { icon: User,    label: isArabic ? "تاريخ الإنشاء" : "Created",      val: new Date(order.created_at).toLocaleDateString(isArabic ? "ar-AE" : "en-AE") },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} style={{ background: innerBg, border: `1px solid ${innerBdr}` }} className="rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5 text-brand-gold" />
                    <span style={{ color: textMuted }} className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
                  </div>
                  <p style={{ color: textMain }} className="text-sm font-bold">{val}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <ShipmentProgressBar status={order.status} />
          </div>

          {/* Status timeline */}
          {Array.isArray(order.status_history) && (order.status_history?.length ?? 0) > 0 && (
            <div
              style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }}
              className="rounded-3xl p-5 sm:p-6"
            >
              <h3 style={{ color: textMain }} className="font-black text-base mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-gold" />
                {isArabic ? "مسار الشحنة" : "Shipment Timeline"}
              </h3>
              <div className="space-y-0 relative">
                {(order.status_history ?? []).slice().reverse().map((item, idx) => (
                  <div key={`${item.status}-${idx}`} className={`relative flex gap-4 pb-5 last:pb-0 ${isArabic ? "flex-row-reverse text-right" : ""}`}>
                    {/* Line */}
                    {idx < (order.status_history?.length ?? 0) - 1 && (
                      <div
                        className="absolute top-6 bottom-0 w-px"
                        style={{
                          left: isArabic ? "auto" : "11px",
                          right: isArabic ? "11px" : "auto",
                          background: "linear-gradient(to bottom, rgba(212,175,55,0.5), rgba(212,175,55,0.1))",
                        }}
                      />
                    )}
                    {/* Dot */}
                    <div className="shrink-0 w-6 h-6 rounded-full bg-brand-gold/15 border-2 border-brand-gold flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-brand-gold" />
                    </div>
                    {/* Content */}
                    <div>
                      <p style={{ color: textMain }} className="text-sm font-bold">{item.status}</p>
                      <p style={{ color: textMuted }} className="text-xs mt-0.5">{item.date}</p>
                      {item.note && <p style={{ color: textMuted }} className="text-xs mt-0.5 opacity-75">{item.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          <div
            style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }}
            className="rounded-3xl overflow-hidden"
          >
            <div className="p-4 border-b" style={{ borderColor: `rgba(255,255,255,0.08)` }}>
              <h3 style={{ color: textMain }} className="font-black text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-gold" />
                {isArabic ? "الموقع على الخريطة" : "Live Map"}
              </h3>
            </div>
            <div className="h-64 sm:h-80">
              <TrackingMap />
            </div>
          </div>

          {/* Support CTA */}
          <div
            style={{ background: isLight ? "rgba(37,211,102,0.06)" : "rgba(37,211,102,0.07)", border: "1px solid rgba(37,211,102,0.20)" }}
            className="rounded-3xl p-4 flex items-center justify-between gap-4 flex-wrap"
          >
            <div>
              <p style={{ color: textMain }} className="text-sm font-bold">
                {isArabic ? "هل تحتاج مساعدة؟" : "Need help with your shipment?"}
              </p>
              <p style={{ color: textMuted }} className="text-xs mt-0.5">
                {isArabic ? "فريق الدعم جاهز على مدار الساعة" : "Our support team is available 24/7"}
              </p>
            </div>
            <a
              href={whatsappStatusUpdate(trackingCode, "update")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp inline-flex items-center gap-2 px-4 py-2 text-sm font-bold"
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
