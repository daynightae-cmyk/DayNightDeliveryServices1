/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { fetchAllOrders } from "../supabase";
import { Order } from "../types";
import { 
  Search, 
  MapPin, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Truck,
  Package,
  CalendarDays,
  Barcode
} from "lucide-react";

interface TrackingProps {
  initialTrackingId?: string;
}

export default function Tracking({ initialTrackingId = "" }: TrackingProps) {
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
      const orders = await fetchAllOrders();
      // Case insensitive match
      const found = orders.find(o => o.id.toLowerCase() === key.toLowerCase());
      if (found) {
        setOrder(found);
      } else {
        setErrorMsg("لم يتم العثور على شحنة تطابق الرقم المدخل. يرجى التحقق وإعادة المحاولة.");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم لمراجعة رقم التتبع.");
    }
  }



  const statusMilestones: { status: Order["status"]; labelAr: string; labelEn: string; desc: string }[] = [
    { status: "Pending", labelAr: "استلام طلب التوصيل", labelEn: "Pending Request", desc: "تم تدوين بيانات طلب الشحن وجاري مراجعة الإدارة" },
    { status: "Confirmed", labelAr: "تأكيد الطلب", labelEn: "Confirmed Order", desc: "تم التحقق وتأكيد تفاصيل الشحن والوجهة بنجاح" },
    { status: "Assigned", labelAr: "تعيين السائق", labelEn: "Driver Assigned", desc: "تم تخصيص كابتن التوصيل لجمع الشحنة من المرسل" },
    { status: "Picked Up", labelAr: "تم استلام الشحنة", labelEn: "Parcel Picked Up", desc: "تم استلام السلعة رسمياً ودخولها مخازن الفرز" },
    { status: "In Transit", labelAr: "الشحنة في الطريق", labelEn: "In Transit Hub", desc: "الشحنة في وسيلة النقل متجهة لمدينة الاستلام" },
    { status: "Out For Delivery", labelAr: "جاري التوصيل النهائي", labelEn: "Out For Delivery", desc: "الشحنة مع مندوب التوزيع الأخير للتسليم اليوم" },
    { status: "Delivered", labelAr: "تم التسليم بنجاح", labelEn: "Delivered Successfully", desc: "تم تسليم السلعة مغلقة ومستوفاة وتوقيع العميل" }
  ];

  // Derive active index
  const activeIndex = order ? statusMilestones.findIndex(m => m.status === order.status) : -1;

  return (
    <div className="max-w-3xl mx-auto space-y-12 text-right">
      {/* Search Widget */}
      <section className="bg-brand-cool/40 border border-white/10 p-6 sm:p-10 rounded-3xl text-white space-y-6 relative overflow-hidden text-center">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl"></div>
        <div className="max-w-xl mx-auto space-y-4 relative z-10">
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">تابع حالة الشحنة والطلبات فورياً</h3>
          <p className="text-white/60 text-xs sm:text-sm leading-relaxed">
            أدخل رقم التتبع الخاص بشحنتك (مثال: <span className="text-brand-gold font-mono font-bold tracking-wide">DN-2026-89101</span>) واطلع على حركة الطرد والمخطط الزمني للتسليم.
          </p>
 
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <input
              id="tracking_query_input"
              type="text"
              placeholder="مثال: DN-2026-XXXXX"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3.5 text-center text-white uppercase font-mono font-bold placeholder:text-white/20 focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all text-right"
            />
            <button
              id="tracking_query_submit"
              onClick={() => handleTrackSearch()}
              className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>بحث وتتبع</span>
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
                <div className="space-y-1 text-right">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 justify-end font-sans">
                    <span>تاريخ إنشاء الشحنة</span>
                    <CalendarDays className="w-4 h-4 text-white/40" />
                  </p>
                  <p className="text-sm font-extrabold text-white font-sans">{new Date(order.created_at).toLocaleString()}</p>
                  <p className="text-xs text-emerald-400 font-bold">الحالة: {order.status}</p>
                </div>

                <div className="space-y-1 text-right md:border-r md:border-l md:border-white/10 md:px-4">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 justify-end font-sans">
                    <span>مسار التوصيل</span>
                    <MapPin className="w-4 h-4 text-white/40" />
                  </p>
                  <p className="text-base font-extrabold text-white">من {order.sender_city} إلى {order.receiver_city}</p>
                  <p className="text-xs text-brand-gold">طريقة الدفع: {order.payment_method === "cod" ? `تحصيل COD بمبلغ ${order.cod_amount} درهم` : "مدفوع مسبقاً"}</p>
                </div>

                <div className="space-y-1 text-right md:pr-4">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 justify-end font-sans">
                    <span>رقم التتبع المعتمد</span>
                    <Barcode className="w-4 h-4 text-white/40" />
                  </p>
                  <p className="text-xl font-extrabold text-brand-gold font-mono">{order.id}</p>
                  <p className="text-xs text-white/40 font-sans tracking-wide">نوع الطرد: {order.package_type}</p>
                </div>
              </div>
 
              {/* Status Timeline Map */}
              <div className="bg-brand-cool/30 rounded-3xl p-6 sm:p-10 border border-white/10 space-y-8">
                <h4 className="text-lg font-bold text-white border-r-4 border-brand-gold pr-3">المخطط الزمني لحركة الشحنة</h4>
                
                <div className="relative border-r border-white/15 pr-6 mr-3 space-y-8 text-right font-sans">
                  {statusMilestones.map((m, idx) => {
                    const isPassed = idx <= activeIndex;
                    const isUpcoming = idx > activeIndex && order.status !== "Cancelled" && order.status !== "Failed";
 
                    return (
                      <div id={`milestone_${idx}`} key={idx} className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        {/* Circle Bullet Indicator */}
                        <div className={`absolute -right-[31px] w-4 h-4 rounded-full border-4 flex items-center justify-center transition-all ${
                          isPassed 
                            ? "bg-brand-deep border-brand-gold scale-125 shadow-[0_0_12px_rgba(235,188,4,0.4)]" 
                            : "bg-brand-deep border-white/20"
                        }`} />
 
                        <div className="space-y-1 flex-1 pr-2">
                          <div className={`font-bold transition-colors ${isPassed ? "text-white text-base" : "text-white/30 text-sm"}`}>
                            {m.labelAr} <span className="font-mono text-xs uppercase tracking-wider text-white/30 font-bold">({m.labelEn})</span>
                          </div>
                          <p className={`text-xs ${isPassed ? "text-white/70" : "text-white/30"}`}>
                            {m.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
 
              {/* Status Details / History log */}
              {order.status_history && order.status_history.length > 0 && (
                <div className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10 space-y-4 text-right">
                  <h4 className="text-base font-bold text-white border-b border-white/10 pb-3">سجل المربعات والبيانات المفصلة للطلب</h4>
                  <div className="divide-y divide-white/5 space-y-3 font-sans text-xs">
                    {order.status_history.slice().reverse().map((h, i) => (
                      <div key={i} className="pt-3 flex justify-between items-start gap-4 text-right">
                        <span className="text-white/40 shrink-0 font-sans font-medium">{h.date}</span>
                        <div>
                          <p className="font-bold text-white">{h.status}</p>
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
              <h4 className="font-bold text-white text-lg">لم يتم العثور على الشحنة</h4>
              <p className="text-white/50 text-xs sm:text-sm leading-relaxed pr-2 pl-2">
                {errorMsg || "تأكد من كتابة رقم التتبع بصورة دقيقة كما يلي: DN-2026-X. يمكنك أيضاً فحص لوحة الإدارة لمراجعة أرقام التتبع المتاحة للطلبات الحية."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
