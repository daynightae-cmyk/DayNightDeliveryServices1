/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { fetchAllOrders, updateExistingOrderStatus, supabase } from "../supabase";
import { Order } from "../types";
import { 
  Users, 
  Search, 
  MapPin, 
  RefreshCw, 
  CheckSquare, 
  Eye, 
  Package, 
  PlusCircle, 
  TrendingUp, 
  Users2, 
  UserCheck2 
} from "lucide-react";

export default function AdminPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pricingOverview, setPricingOverview] = useState<any[]>([]);
  const [settingsOverview, setSettingsOverview] = useState<any[]>([]);
  const [searchQuery, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusNote, setStatusNote] = useState("");

  useEffect(() => {
    loadOrders();
    loadOverview();
  }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const all = await fetchAllOrders();
      setOrders(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadOverview() {
    if (!supabase) return;

    const [{ data: pricingData }, { data: settingsData }] = await Promise.all([
      supabase.from("daynight_pricing_master").select("pricing_key, label_en, base_price, first_kg, additional_kg, vat_rate, currency").eq("active", true),
      supabase.from("admin_settings").select("setting_key, setting_value").limit(8)
    ]);

    setPricingOverview(pricingData || []);
    setSettingsOverview(settingsData || []);
  }

  async function handleStatusUpdate(orderId: string, status: Order["status"]) {
    const updated = await updateExistingOrderStatus(orderId, status, statusNote);
    if (updated) {
       loadOrders();
       setSelectedOrder(null);
       setStatusNote("");
    }
  }

  


  // Filtered orders list
  const filteredOrders = orders.filter(o => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      o.id.toLowerCase().includes(term) ||
      o.sender_name.toLowerCase().includes(term) ||
      o.receiver_name.toLowerCase().includes(term) ||
      o.receiver_phone.includes(term);

    const matchesStatus = statusFilter === "all" || o.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const pendingCount = orders.filter(o => o.status === "Pending").length;
  const transitCount = orders.filter(o => o.status === "In Transit" || o.status === "Out for Delivery" || o.status === "Out For Delivery").length;
  const completedCount = orders.filter(o => o.status === "Delivered").length;
  const codCollectedSum = orders
    .filter(o => o.status === "Delivered" && o.payment_method === "cod" && o.cod_amount)
    .reduce((sum, o) => sum + (o.cod_amount || 0), 0);

  return (
    <div className="space-y-10 text-right">
      {/* Metrics Banner */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-brand-cool/30 p-5 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/10">
            <Package className="w-6 h-6 text-brand-gold" />
          </div>
          <div>
            <p className="text-white/40 text-xs font-bold">طلبات بانتظار التأكيد</p>
            <p className="text-2xl font-extrabold text-white font-mono mt-0.5">{pendingCount} طلبات</p>
          </div>
        </div>

        <div className="bg-brand-cool/30 p-5 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/10">
            <RefreshCw className="w-6 h-6 text-brand-gold animate-spin-slow" />
          </div>
          <div>
            <p className="text-white/40 text-xs font-bold">شحنات قيد التوزيع حالياً</p>
            <p className="text-2xl font-extrabold text-white font-mono mt-0.5">{transitCount} شحنات</p>
          </div>
        </div>

        <div className="bg-brand-cool/30 p-5 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/10">
            <CheckSquare className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-white/40 text-xs font-bold">طلبات تم تسليمها بنجاح</p>
            <p className="text-2xl font-extrabold text-white font-mono mt-0.5">{completedCount} طلبات</p>
          </div>
        </div>

        <div className="bg-brand-cool/30 p-5 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/20">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-white/40 text-xs font-bold">عوائد الـ COD المحصلة نقداً</p>
            <p className="text-2xl font-extrabold text-emerald-400 font-mono mt-0.5">{codCollectedSum} AED</p>
          </div>
        </div>
      </section>

      {/* Control bar */}
      <section className="bg-brand-cool/30 p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search query */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="admin_search_bar"
              type="text"
              placeholder="ابحث برقم التتبع أو العميل..."
              value={searchQuery}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-2.5 pl-9 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
            />
          </div>

          {/* Status Filter */}
          <select
            id="admin_status_filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-44 bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark] cursor-pointer"
          >
            <option value="all">كل الطلبات وحالات الشحن</option>
            <option value="pending">Pending (قيد الانتظار)</option>
            <option value="accepted">Accepted (مقبول)</option>
            <option value="driver assigned">Driver Assigned (تم تعيين السائق)</option>
            <option value="picked up">Picked Up (تم الاستلام)</option>
            <option value="in transit">In Transit (في الطريق)</option>
            <option value="out for delivery">Out for Delivery (قيد التوصيل)</option>
            <option value="delivered">Delivered (سلمت بنجاح)</option>
            <option value="cancelled">Cancelled (ملغي)</option>
          </select>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 self-end md:self-auto font-sans">
          {/* Production: removed unsafe test-order button */}
          
          <button
            id="admin_reload_btn"
            onClick={loadOrders}
            disabled={loading}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl text-xs border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث الجدول</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-brand-cool/30 p-5 rounded-2xl border border-white/10 space-y-3">
          <h3 className="text-white font-extrabold text-sm">Pricing overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pricingOverview.slice(0, 6).map((row) => (
              <div key={row.pricing_key} className="bg-brand-deep/70 border border-white/10 rounded-xl p-3 text-xs">
                <p className="text-brand-gold font-mono font-bold">{row.pricing_key}</p>
                <p className="text-white/70">{row.label_en}</p>
                <p className="text-white/45 font-mono" dir="ltr">
                  {row.base_price ? `${row.base_price} ${row.currency}` : `${row.first_kg} + ${row.additional_kg}/kg ${row.currency}`}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-brand-cool/30 p-5 rounded-2xl border border-white/10 space-y-3">
          <h3 className="text-white font-extrabold text-sm">Settings overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {settingsOverview.map((row) => (
              <div key={row.setting_key} className="bg-brand-deep/70 border border-white/10 rounded-xl p-3 text-xs">
                <p className="text-brand-gold font-mono font-bold">{row.setting_key}</p>
                <p className="text-white/60 truncate">{JSON.stringify(row.setting_value)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Orders Table Grid */}
      <section className="bg-brand-cool/20 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto text-right">
          <table className="w-full text-xs font-sans">
            <thead className="bg-brand-deep/80 text-white/40 font-bold border-b border-white/10">
              <tr>
                <th className="p-3 text-right">معرّف التتبع (ID)</th>
                <th className="p-3 text-right">الراسل (Sender)</th>
                <th className="p-3 text-right">المرسل إليه (Receiver)</th>
                <th className="p-3 text-right">الوجهة والمسار</th>
                <th className="p-3 text-right">نوع الخدمة والمالية</th>
                <th className="p-3 text-right">حالة الشحنة</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-white/40 font-bold">
                    جاري تحميل الطلبات وتعديلاتها من قاعدة البيانات...
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-mono font-extrabold text-brand-gold">{o.id}</td>
                    <td className="p-4">
                      <p className="font-bold text-white">{o.sender_name}</p>
                      <p className="text-[10px] text-white/40 font-mono mt-0.5">{o.sender_phone}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-white">{o.receiver_name}</p>
                      <p className="text-[10px] text-white/40 font-mono mt-0.5">{o.receiver_phone}</p>
                    </td>
                    <td className="p-4 text-white/80">
                      من <span className="font-semibold text-white">{o.sender_city}</span> إلى <span className="font-semibold text-white">{o.receiver_city}</span>
                      <p className="text-[10px] text-white/40 mt-0.5">{o.receiver_address}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-mono text-white/90">التوزيع: <span className="font-bold text-brand-gold">{o.delivery_price} AED</span></p>
                      <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">
                        {o.payment_method === "cod" ? `COD: ${o.cod_amount} AED` : o.payment_method === "sender_pays" ? "مدفوع بالراسل" : "مدفوع بالمستلم"}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        o.status === "Pending" ? "bg-brand-gold/10 text-brand-gold border border-brand-gold/20" :
                        (o.status === "Accepted" || o.status === "Confirmed") ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/20" :
                        o.status === "Delivered" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-550/20" :
                        "bg-white/5 text-white/60 border border-white/10"
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        id={`btn_manage_order_${o.id}`}
                        onClick={() => setSelectedOrder(o)}
                        className="px-3.5 py-1.5 bg-brand-deep hover:bg-brand-gold hover:text-brand-deep font-bold rounded-lg text-white text-[10px] border border-white/10 transition-colors cursor-pointer"
                      >
                        تعديل الحالة
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-white/30 leading-relaxed font-bold">
                    لا تتوفر أي طلبات حالية تطابق التصفية والبحث في النظام.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit status Modal overlay */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-brand-deep/85 backdrop-blur-md flex items-center justify-center p-4 z-50 text-right">
          <div className="bg-brand-cool rounded-3xl p-6 sm:p-8 border border-white/15 max-w-md w-full space-y-5 animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
            <div className="border-b border-white/10 pb-3">
              <h4 className="text-lg font-bold text-white">تعديل وتحديد حالة شحنة التوصيل</h4>
              <p className="text-white/40 text-xs font-mono mt-0.5">الطلب المعرف: {selectedOrder.id}</p>
            </div>

            <div className="space-y-4">
              {/* Select dropdown status */}
              <div className="space-y-1.5 px-0.5">
                <label className="text-white/70 text-xs font-bold leading-normal">الحرية المطلوبة لحالة التوزيع:</label>
                <select
                  id="modal_status_select"
                  value={selectedOrder.status}
                  onChange={(e) => handleStatusUpdate(selectedOrder.id, e.target.value as Order["status"])}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]"
                >
                  <option value="Pending">Pending (قيد استلام الطلب)</option>
                  <option value="Accepted">Accepted (تم قبول الطلب)</option>
                  <option value="Driver Assigned">Driver Assigned (تم تعيين كابتن التوصيل)</option>
                  <option value="Picked Up">Picked Up (تأكيد استلام الطرد)</option>
                  <option value="In Transit">In Transit (الشحنة في وسيلة النقل)</option>
                  <option value="Out for Delivery">Out for Delivery (الموزع في الطريق للعميل)</option>
                  <option value="Delivered">Delivered (تم تسليم السلعة بنجاح)</option>
                  <option value="Failed">Failed Delivery (فشل التسليم والمحاولة)</option>
                  <option value="Cancelled">Cancelled (تم إلغاء الطلب من الراسل)</option>
                </select>
              </div>

              {/* Status Note input */}
              <div className="space-y-1.5 px-0.5">
                <label className="text-white/70 text-xs font-bold">ملاحظة التحديث التفريعية (سجل الحركة):</label>
                <input
                  id="modal_note_input"
                  type="text"
                  placeholder="مثال: تم التنسيق مع العميل وسيتم التسليم غداً جراء التأجيل"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold text-right"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between gap-3 border-t border-white/10">
              <button
                id="modal_close_btn"
                onClick={() => { setSelectedOrder(null); setStatusNote(""); }}
                className="w-full py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-black rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                إغلاق ورفع التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
