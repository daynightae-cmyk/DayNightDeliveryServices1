import { useEffect, useMemo, useState } from "react";
import { supabase, trackOrderRpc } from "../supabase";
import type { Order } from "../types";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import ShipmentProgressBar from "./tracking/ShipmentProgressBar";
import TrackingMap from "./tracking/TrackingMap";
import { canRetryTracking } from "../lib/security";
import { reportError, trackApiCall } from "../lib/monitoring";
import { whatsappStatusUpdate } from "../lib/whatsapp";
import { AlertCircle, CheckCircle2, Clock, Hash, ListChecks, MapPin, MessageSquare, Package, Phone, Search, Truck, User } from "lucide-react";

interface TrackingProps {
  initialTrackingId?: string;
}

type SearchMode = "code" | "phone";

function digitsOnly(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function isPhoneLookup(value: string) {
  const clean = value.trim();
  return digitsOnly(clean).length >= 7 && !/[A-Za-z]/.test(clean);
}

function orderKey(order: Order) {
  return String(order.id || order.tracking_code || order.tracking_number || "");
}

function trackingReference(order: Order) {
  return order.tracking_code || order.tracking_number || order.id;
}

function formatAed(value?: number | string | null) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? `${amount.toFixed(2)} AED` : "—";
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale);
}

async function trackOrdersByPhone(phone: string): Promise<Order[]> {
  if (!supabase) return [];

  const safePhone = digitsOnly(phone);
  if (safePhone.length < 7) return [];

  const { data, error } = await supabase.rpc("track_orders_by_phone", {
    p_phone: safePhone,
    p_limit: 10,
  });

  if (error) {
    console.warn("track_orders_by_phone RPC failed or is not installed.");
    return [];
  }

  if (Array.isArray(data)) return data as Order[];
  return data ? [data as Order] : [];
}

export default function Tracking({ initialTrackingId = "" }: TrackingProps) {
  const { language, theme } = useAppContext();
  const t = translations[language];
  const isArabic = language === "ar";
  const isLight = theme === "light";

  const [query, setQuery] = useState(initialTrackingId);
  const [order, setOrder] = useState<Order | null>(null);
  const [matches, setMatches] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("code");

  const trackingCode = useMemo(() => (order ? trackingReference(order) : ""), [order]);
  const selectedKey = order ? orderKey(order) : "";

  useEffect(() => {
    if (initialTrackingId) void handleSearch(initialTrackingId);
  }, [initialTrackingId]);

  async function handleSearch(forcedValue?: string) {
    const raw = (forcedValue ?? query).trim();
    if (!raw) return;

    const mode: SearchMode = isPhoneLookup(raw) ? "phone" : "code";
    const lookupValue = mode === "phone" ? digitsOnly(raw) : raw.toUpperCase();

    setSearched(true);
    setOrder(null);
    setMatches([]);
    setError("");
    setLoading(true);
    setSearchMode(mode);

    try {
      let foundOrders: Order[] = [];

      if (mode === "phone") {
        foundOrders = await trackApiCall("track_orders_by_phone", () => trackOrdersByPhone(lookupValue));
      } else {
        const found = await trackApiCall("track_order", () => trackOrderRpc(lookupValue));
        const result = Array.isArray(found) ? found[0] : found;
        foundOrders = result ? [result as Order] : [];
      }

      if (!foundOrders.length) {
        const attempt = canRetryTracking();
        if (!attempt.allowed) {
          setError(isArabic ? "تم تجاوز حد المحاولات مؤقتاً. يرجى المحاولة لاحقاً." : "Too many attempts. Please try again later.");
        } else if (mode === "phone") {
          setError(isArabic ? "لم يتم العثور على شحنات مرتبطة بهذا الهاتف." : "No shipments were found for this phone number.");
        } else {
          setError(t.tracking.notFoundError || (isArabic ? "الشحنة غير موجودة." : "Shipment not found."));
        }
        return;
      }

      setMatches(foundOrders);
      setOrder(foundOrders[0]);
    } catch (e) {
      reportError(e, "tracking_search", { mode, value: lookupValue });
      setError(t.tracking.serverError || (isArabic ? "تعذّر الاتصال بالخادم." : "Unable to connect. Try again."));
    } finally {
      setLoading(false);
    }
  }

  const cardBg = isLight ? "rgba(255,255,255,0.88)" : "rgba(16,35,63,0.82)";
  const cardBorder = isLight ? "rgba(30,144,255,0.16)" : "rgba(56,139,253,0.22)";
  const innerBg = isLight ? "rgba(244,248,255,0.80)" : "rgba(8,23,44,0.65)";
  const innerBdr = isLight ? "rgba(10,28,58,0.10)" : "rgba(255,255,255,0.08)";
  const textMain = isLight ? "#0A1C3A" : "#F8FAFC";
  const textMuted = isLight ? "#52627A" : "#7F8EA3";
  const locale = isArabic ? "ar-AE" : "en-AE";

  const statusText = order?.status === "Delivered"
    ? (isArabic ? "تم التسليم" : "Delivered")
    : order?.status === "In Transit" || order?.status === "Out for Delivery" || order?.status === "Out For Delivery"
      ? (isArabic ? "في الطريق" : "In Transit")
      : (isArabic ? "معالجة" : "Processing");

  return (
    <div className="max-w-4xl mx-auto space-y-5" dir={isArabic ? "rtl" : "ltr"}>
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/25 rounded-full px-4 py-1.5 text-[11px] font-bold text-brand-gold mb-2">
          <Package className="w-3.5 h-3.5" />
          {isArabic ? "تتبع الشحنة" : "Shipment Tracking"}
        </div>
        <h1 style={{ color: textMain }} className="text-2xl sm:text-3xl font-black">
          {t.tracking.title || (isArabic ? "تتبع شحنتك لحظة بلحظة" : "Track Your Shipment")}
        </h1>
        <p style={{ color: textMuted }} className="text-sm leading-7">
          {isArabic
            ? "أدخل رقم التتبع أو رقم الهاتف المسجل في الطلب كمرسل أو مستلم."
            : "Enter the tracking code or the phone number used on the shipment."}
        </p>
      </div>

      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }} className="rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-3.5 my-auto w-4 h-4 text-brand-gold pointer-events-none" style={{ right: isArabic ? "14px" : "auto", left: isArabic ? "auto" : "14px" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
              placeholder={isArabic ? "رقم التتبع أو رقم الهاتف" : "Tracking code or phone number"}
              className="w-full rounded-2xl px-4 py-3 text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              dir="ltr"
              style={{
                background: innerBg,
                border: `1px solid ${innerBdr}`,
                color: textMain,
                paddingLeft: isArabic ? "1rem" : "2.5rem",
                paddingRight: isArabic ? "2.5rem" : "1rem",
              }}
            />
          </div>
          <button onClick={() => void handleSearch()} disabled={loading} className="btn-gold px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 justify-center disabled:opacity-60">
            {loading ? <span className="w-4 h-4 rounded-full border-2 border-brand-deep/40 border-t-brand-deep animate-spin" /> : <Search className="w-4 h-4" />}
            {t.tracking.searchBtn || (isArabic ? "تتبع" : "Track")}
          </button>
        </div>

        <div style={{ background: isLight ? "rgba(30,144,255,0.06)" : "rgba(30,144,255,0.08)", border: "1px solid rgba(30,144,255,0.20)" }} className="rounded-2xl p-3 flex items-center gap-3">
          <div className="shrink-0 w-8 h-8 rounded-xl bg-brand-blue/15 border border-brand-blue/25 flex items-center justify-center">
            {isPhoneLookup(query) ? <Phone className="w-4 h-4 text-brand-blue" /> : <Hash className="w-4 h-4 text-brand-blue" />}
          </div>
          <p style={{ color: textMuted }} className="text-xs leading-6">
            {isArabic
              ? "يمكنك التتبع برقم الشحنة أو رقم الهاتف المسجل في الطلب. عند استخدام الهاتف سنعرض آخر الشحنات المرتبطة به."
              : "You can track by shipment code or by the phone number saved on the order. Phone lookup shows the latest linked shipments."}
          </p>
        </div>
      </div>

      {loading && (
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}` }} className="rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin mx-auto" />
          <p style={{ color: textMuted }} className="text-sm">{isArabic ? "جارٍ البحث عن شحنتك…" : "Searching for your shipment…"}</p>
        </div>
      )}

      {!loading && searched && !order && (
        <div style={{ background: cardBg, border: "1px solid rgba(239,68,68,0.25)" }} className="rounded-3xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <p style={{ color: textMain }} className="font-bold text-base">{isArabic ? "لم يتم العثور على الشحنة" : "Shipment not found"}</p>
            <p style={{ color: textMuted }} className="text-sm mt-1">{error || (isArabic ? "تحقق من البيانات وأعد المحاولة." : "Please check your details and try again.")}</p>
          </div>
          <a href={whatsappStatusUpdate(query || "unknown", "support")} target="_blank" rel="noopener noreferrer" className="btn-whatsapp inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold">
            <MessageSquare className="w-4 h-4" />
            {isArabic ? "تواصل مع الدعم" : "Contact Support"}
          </a>
        </div>
      )}

      {!loading && matches.length > 1 && (
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}` }} className="rounded-3xl p-5 sm:p-6 space-y-3">
          <h3 style={{ color: textMain }} className="font-black text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-brand-gold" />
            {isArabic ? "الشحنات المرتبطة بهذا الرقم" : "Shipments linked to this phone"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.map((item) => {
              const active = orderKey(item) === selectedKey;
              return (
                <button key={orderKey(item)} onClick={() => setOrder(item)} className={`rounded-2xl border p-4 text-start transition-all ${active ? "border-brand-gold bg-brand-gold/10" : "border-white/10 bg-white/5 hover:border-brand-gold/40"}`}>
                  <span className="block font-mono text-xs font-black text-brand-gold" dir="ltr">{trackingReference(item)}</span>
                  <span style={{ color: textMain }} className="mt-2 block text-sm font-bold">{item.sender_city || "—"} → {item.receiver_city || "—"}</span>
                  <span style={{ color: textMuted }} className="mt-1 block text-xs">{item.status || "Pending"} • {formatDate(item.created_at, locale)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!loading && order && (
        <div className="space-y-4">
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }} className="rounded-3xl p-5 sm:p-6">
            <div className={`flex flex-wrap items-center justify-between gap-3 mb-5 ${isArabic ? "flex-row-reverse" : ""}`}>
              <div>
                <p style={{ color: textMuted }} className="text-[11px] uppercase tracking-wider font-bold">{isArabic ? "رقم التتبع" : "Tracking Code"}</p>
                <p dir="ltr" style={{ color: textMain }} className="text-xl font-black font-mono mt-0.5">{trackingCode}</p>
                {searchMode === "phone" && <p style={{ color: textMuted }} className="mt-1 text-[11px]">{isArabic ? "تم الوصول للشحنة عبر رقم الهاتف" : "Found by phone number"}</p>}
              </div>
              <span className="inline-flex items-center gap-1.5 bg-brand-gold/15 border border-brand-gold/30 text-brand-gold text-xs font-bold rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                {statusText}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {[
                { icon: MapPin, label: isArabic ? "المدينة المرسلة" : "From", val: order.sender_city || "—" },
                { icon: MapPin, label: isArabic ? "المدينة المستلمة" : "To", val: order.receiver_city || "—" },
                { icon: Package, label: isArabic ? "نوع الطرد" : "Package", val: order.package_type || "—" },
                { icon: Truck, label: isArabic ? "الوزن" : "Weight", val: order.weight ? `${order.weight} kg` : "—" },
                { icon: Clock, label: isArabic ? "سعر التوصيل" : "Delivery Price", val: formatAed(order.delivery_price) },
                { icon: User, label: isArabic ? "تاريخ الإنشاء" : "Created", val: formatDate(order.created_at, locale) },
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

            <ShipmentProgressBar status={order.status} />
          </div>

          {Array.isArray(order.status_history) && order.status_history.length > 0 && (
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }} className="rounded-3xl p-5 sm:p-6">
              <h3 style={{ color: textMain }} className="font-black text-base mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-gold" />
                {isArabic ? "مسار الشحنة" : "Shipment Timeline"}
              </h3>
              <div className="space-y-0 relative">
                {order.status_history.slice().reverse().map((item, idx) => {
                  const dateText = item.date || item.created_at || item.timestamp || "";
                  return (
                    <div key={`${item.status}-${idx}`} className={`relative flex gap-4 pb-5 last:pb-0 ${isArabic ? "flex-row-reverse text-right" : ""}`}>
                      {idx < (order.status_history?.length ?? 0) - 1 && <div className="absolute top-6 bottom-0 w-px" style={{ left: isArabic ? "auto" : "11px", right: isArabic ? "11px" : "auto", background: "linear-gradient(to bottom, rgba(212,175,55,0.5), rgba(212,175,55,0.1))" }} />}
                      <div className="shrink-0 w-6 h-6 rounded-full bg-brand-gold/15 border-2 border-brand-gold flex items-center justify-center mt-0.5"><div className="w-2 h-2 rounded-full bg-brand-gold" /></div>
                      <div>
                        <p style={{ color: textMain }} className="text-sm font-bold">{item.status}</p>
                        {dateText && <p style={{ color: textMuted }} className="text-xs mt-0.5">{dateText}</p>}
                        {item.note && <p style={{ color: textMuted }} className="text-xs mt-0.5 opacity-75">{item.note}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }} className="rounded-3xl overflow-hidden">
            <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <h3 style={{ color: textMain }} className="font-black text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-gold" />{isArabic ? "الموقع على الخريطة" : "Live Map"}</h3>
            </div>
            <div className="h-64 sm:h-80"><TrackingMap /></div>
          </div>

          <div style={{ background: isLight ? "rgba(37,211,102,0.06)" : "rgba(37,211,102,0.07)", border: "1px solid rgba(37,211,102,0.20)" }} className="rounded-3xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p style={{ color: textMain }} className="text-sm font-bold">{isArabic ? "هل تحتاج مساعدة؟" : "Need help with your shipment?"}</p>
              <p style={{ color: textMuted }} className="text-xs mt-0.5">{isArabic ? "فريق الدعم جاهز على مدار الساعة" : "Our support team is available 24/7"}</p>
            </div>
            <a href={whatsappStatusUpdate(trackingCode || query, "update")} target="_blank" rel="noopener noreferrer" className="btn-whatsapp inline-flex items-center gap-2 px-4 py-2 text-sm font-bold">
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
