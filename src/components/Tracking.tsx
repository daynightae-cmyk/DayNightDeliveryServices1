/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { trackOrderRpc } from "../supabase";
import { Order } from "../types";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import { shipmentStatuses, getStatusTranslation } from "../data/shipmentStatusMap";
import TrackingMap from "./tracking/TrackingMap";
import ShipmentProgressBar from "./tracking/ShipmentProgressBar";
import SignatureCapture from "./signature/SignatureCapture";
import { 
  Search, 
  MapPin, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Truck,
  Package,
  CalendarDays,
  Barcode,
  PackageCheck
} from "lucide-react";

interface TrackingProps {
  initialTrackingId?: string;
}

export default function Tracking({ initialTrackingId = "" }: TrackingProps) {
  const { language } = useAppContext();
  const t = translations[language];

  const [query, setQuery] = useState(initialTrackingId);
  const [order, setOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialTrackingId) {
       handleTrackSearch(initialTrackingId);
    }
  }, [initialTrackingId]);

  async function handleTrackSearch(idToSearch?: string) {
    const key = (idToSearch || query || "").trim();
    if (!key) return;

    setSearched(true);
    setErrorMsg("");
    setOrder(null);

    try {
      const found = await trackOrderRpc(key);
      if (found) {
        // Data returned from RPC may be wrapped depending on Postgres setup, e.g. an array or a single object.
        // Usually, a function returning an order would give the object:
        if (Array.isArray(found)) {
           setOrder(found[0]);
        } else {
           setOrder(found);
        }
      } else {
        setErrorMsg(t.tracking.notFoundError);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(t.tracking.serverError);
    }
  }



  const statusMilestones: { status: Order["status"]; key: keyof typeof shipmentStatuses; descAr: string; descEn: string }[] = [
    { status: "Pending", key: "Pending", descAr: "تم تدوين بيانات طلب الشحن وجاري مراجعة الإدارة", descEn: "The shipping request details have been recorded and are being reviewed." },
    { status: "Confirmed", key: "Confirmed", descAr: "تم التحقق وتأكيد تفاصيل الشحن والوجهة بنجاح", descEn: "Shipping details and destination have been verified and confirmed." },
    { status: "Assigned", key: "Assigned", descAr: "تم تخصيص كابتن التوصيل لجمع الشحنة من المرسل", descEn: "A delivery captain has been assigned to collect the shipment." },
    { status: "Picked Up", key: "Picked Up", descAr: "تم استلام السلعة رسمياً ودخولها مخازن الفرز", descEn: "The item has been officially picked up and entered into sorting." },
    { status: "In Transit", key: "In Transit", descAr: "الشحنة في وسيلة النقل متجهة لمدينة الاستلام", descEn: "The shipment is in transit heading to the delivery city." },
    { status: "Out For Delivery", key: "Out For Delivery", descAr: "الشحنة مع مندوب التوزيع الأخير للتسليم اليوم", descEn: "The shipment is with the final delivery agent for delivery today." },
    { status: "Delivered", key: "Delivered", descAr: "تم تسليم السلعة مغلقة ومستوفاة وتوقيع العميل", descEn: "The item has been successfully delivered and signed for." }
  ];

  // Derive active index
  const activeIndex = order ? statusMilestones.findIndex(m => m.status === order.status) : -1;

  return (
    <div className={`max-w-3xl mx-auto space-y-12 relative ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      {searched && order && (
        <div className="sticky top-20 z-30 mb-6 bg-brand-deep border border-brand-gold/30 shadow-[0_4px_15px_rgba(212,175,55,0.15)] rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shrink-0">
               <PackageCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className={language === 'ar' ? 'text-right' : 'text-left'}>
              <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold">{t.tracking.lastUpdate} <span className="text-brand-gold font-mono">{order.id}</span></p>
              <p className="text-sm font-extrabold text-white">{getStatusTranslation(order.status, language)}</p>
            </div>
          </div>
          <button onClick={() => window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'})} className="text-xs text-brand-gold hover:text-white underline font-bold cursor-pointer shrink-0">{t.tracking.fullDetails}</button>
        </div>
      )}

      {/* Search Widget */}
      <section className="bg-brand-cool/40 border border-white/10 p-6 sm:p-10 rounded-3xl text-white space-y-6 relative overflow-hidden text-center">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl"></div>
        <div className="max-w-xl mx-auto space-y-4 relative z-10">
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{t.tracking.title}</h3>
          <p className="text-white/60 text-xs sm:text-sm leading-relaxed">
            {t.tracking.subtitle} <span className="text-brand-gold font-mono font-bold tracking-wide">DN-2026-89101</span>
          </p>
 
          <div className={`flex flex-col sm:flex-row gap-2 pt-2`}>
            <input
              id="tracking_query_input"
              type="text"
              placeholder="DN-2026-XXXXX :مثال"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`flex-1 bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3.5 text-center text-white uppercase font-mono font-bold placeholder:text-white/20 focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all outline-none`}
            />
            <button
              id="tracking_query_submit"
              onClick={() => handleTrackSearch()}
              className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>{t.tracking.searchBtn}</span>
            </button>
          </div>
        </div>
      </section>
 
      {/* Searched Results State */}
      {searched && (
        <div className="space-y-8">
          {order ? (
            <div className="space-y-8">
              {/* Order Info Stats */}
              <div className="bg-brand-cool/30 p-6 sm:p-8 rounded-3xl border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  <p className={`text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-sans ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                    {language === 'en' && <CalendarDays className="w-4 h-4 text-white/40" />}
                    <span>{t.tracking.creationDate}</span>
                    {language === 'ar' && <CalendarDays className="w-4 h-4 text-white/40" />}
                  </p>
                  <p className="text-sm font-extrabold text-white font-sans">{new Date(order.created_at).toLocaleString()}</p>
                  <p className="text-xs text-emerald-400 font-bold">{t.tracking.statusIs || "Status:"} {getStatusTranslation(order.status, language)}</p>
                </div>

                <div className={`space-y-1 ${language === 'ar' ? 'text-right md:border-r' : 'text-left md:border-l'} md:border-white/10 md:px-4`}>
                  <p className={`text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-sans ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                    {language === 'en' && <MapPin className="w-4 h-4 text-white/40" />}
                    <span>{t.tracking.route}</span>
                    {language === 'ar' && <MapPin className="w-4 h-4 text-white/40" />}
                  </p>
                  <p className="text-base font-extrabold text-white">{language === 'ar' ? `من ${order.sender_city} إلى ${order.receiver_city}` : `From ${order.sender_city} to ${order.receiver_city}`}</p>
                  <p className="text-xs text-brand-gold">{t.tracking.payment}: {order.payment_method === "cod" ? `${language === 'ar' ? `تحصيل COD بمبلغ ${order.cod_amount} درهم` : `COD amount ${order.cod_amount} AED`}` : (language === 'ar' ? "مدفوع مسبقاً" : "Prepaid")}</p>
                </div>

                <div className={`space-y-1 ${language === 'ar' ? 'text-right md:pr-4' : 'text-left md:pl-4'}`}>
                  <p className={`text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-sans ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                    {language === 'en' && <Barcode className="w-4 h-4 text-white/40" />}
                    <span>{t.tracking.trackingLabel || "Tracking No"}</span>
                    {language === 'ar' && <Barcode className="w-4 h-4 text-white/40" />}
                  </p>
                  <p className="text-xl font-extrabold text-brand-gold font-mono">{order.id}</p>
                  <p className="text-xs text-white/40 font-sans tracking-wide">{t.tracking.packageType}: {order.package_type}</p>
                </div>
              </div>

              <div className="space-y-6">
                <ShipmentProgressBar status={order.status} />
                <TrackingMap />
                <SignatureCapture status={order.status} />
              </div>

              {/* Status Details / History log */}
              {order.status_history && order.status_history.length > 0 && (
                <div className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10 space-y-4">
                  <h4 className={`text-base font-bold text-white border-b border-white/10 pb-3 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{t.tracking.historyLog}</h4>
                  <div className="divide-y divide-white/5 space-y-3 font-sans text-xs">
                    {order.status_history.slice().reverse().map((h, i) => (
                      <div key={i} className={`pt-3 flex justify-between items-start gap-4 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                        <span className="text-white/40 shrink-0 font-sans font-medium">{h.date}</span>
                        <div>
                          <p className="font-bold text-white">{getStatusTranslation(h.status, language)}</p>
                          <p className="text-white/60 mt-1 leading-normal">{h.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 bg-brand-cool/40 border border-white/10 rounded-3xl text-center space-y-3 max-w-md mx-auto">
              <AlertCircle className="w-12 h-12 text-brand-gold mx-auto" />
              <h4 className="font-bold text-white text-lg">{t.tracking.notFoundError}</h4>
              <p className="text-white/50 text-xs sm:text-sm leading-relaxed pr-2 pl-2">
                {errorMsg || (language === 'ar' ? "تأكد من كتابة رقم التتبع بصورة دقيقة كما يلي: DN-2026-X. يمكنك أيضاً فحص لوحة الإدارة لمراجعة أرقام التتبع المتاحة للطلبات الحية." : "Please make sure to enter the exact tracking ID format (e.g. DN-2026-X). You may also check the admin dashboard for live tracking IDs.")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
