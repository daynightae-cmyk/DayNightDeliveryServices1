/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { fetchAllOrders, updateExistingOrderStatus } from "../supabase";
import { supabase, isAdminUser } from "../supabase";
import { Order, OrderStatus } from "../types";
import Auth from "./Auth";
import { getStatusConfig } from "../lib/statusLabels";
import { 
  Search, 
  RefreshCw, 
  CheckSquare, 
  Package, 
  TrendingUp,
  ShieldAlert
} from "lucide-react";

export default function AdminPanel() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [statusUpdateValue, setStatusUpdateValue] = useState<OrderStatus>("pending");

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setAuthChecked(true);
        setIsAuthenticated(false);
        return;
      }
      const admin = await isAdminUser(session.user.id);
      setIsAuthenticated(admin);
      setAuthChecked(true);
      if (admin) loadOrders();
    }
    checkAuth();
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

  async function handleStatusUpdate() {
    if (!selectedOrder) return;
    const updated = await updateExistingOrderStatus(selectedOrder.id, statusUpdateValue, statusNote);
    if (updated) {
      loadOrders();
      setSelectedOrder(null);
      setStatusNote("");
    }
  }

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render Auth Gate
  if (!isAuthenticated) {
    return (
      <div className="space-y-6 text-right">
        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-rose-400 font-bold text-sm">هذه الصفحة محمية — يجب تسجيل الدخول بحساب مسؤول</p>
        </div>
        <Auth onAuthSuccess={async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const admin = await isAdminUser(session.user.id);
            setIsAuthenticated(admin);
            if (admin) loadOrders();
          }
        }} />
      </div>
    );
  }

  // Filtered orders list
  const filteredOrders = orders.filter(o => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      o.id.toLowerCase().includes(term) ||
      o.sender_name.toLowerCase().includes(term) ||
      o.receiver_name.toLowerCase().includes(term) ||
      o.receiver_phone.includes(term);

    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const transitCount = orders.filter(o => o.status === "in_transit" || o.status === "assigned").length;
  const completedCount = orders.filter(o => o.status === "delivered").length;
  const codCollectedSum = orders
    .filter(o => o.status === "delivered" && o.payment_method === "cod" && o.cod_amount)
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
            <RefreshCw className="w-6 h-6 text-brand-gold" />
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

          <select
            id="admin_status_filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-44 bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark] cursor-pointer"
          >
            <option value="all">كل الطلبات وحالات الشحن</option>
            <option value="pending">قيد المراجعة</option>
            <option value="confirmed">تم التأكيد</option>
            <option value="assigned">تم تعيين السائق</option>
            <option value="picked_up">تم الاستلام</option>
            <option value="in_transit">قيد التوصيل</option>
            <option value="delivered">تم التسليم</option>
            <option value="cancelled">تم الإلغاء</option>
            <option value="returned">مرتجع</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto font-sans">
          <button
            id="admin_reload_btn"
            onClick={loadOrders}
            disabled={loading}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl text-xs border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث الجدول</span>
          </button>
        </div>
      </section>

      {/* Orders Table Grid */}
      <section className="bg-brand-cool/20 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto text-right">
          <table className="w-full text-xs font-sans">
            <thead className="bg-brand-deep/80 text-white/40 font-bold border-b border-white/10">
              <tr>
                <th className="p-3 text-right">رقم التتبع</th>
                <th className="p-3 text-right">المرسل</th>
                <th className="p-3 text-right">المستلم</th>
                <th className="p-3 text-right">المسار</th>
                <th className="p-3 text-right">التسعير</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-white/40 font-bold">
                    جاري تحميل الطلبات من قاعدة البيانات...
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((o) => {
                  const statusCfg = getStatusConfig(o.status);
                  return (
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
                      </td>
                      <td className="p-4">
                        <p className="font-mono text-white/90"><span className="font-bold text-brand-gold">{o.delivery_price} AED</span></p>
                        <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">
                          {o.payment_method === "cod" ? `COD: ${o.cod_amount} AED` : o.payment_method === "sender_pays" ? "مدفوع بالراسل" : "مدفوع بالمستلم"}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusCfg.bgColor} ${statusCfg.color} border border-current/20`}>
                          {statusCfg.labelAr}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          id={`btn_manage_order_${o.id}`}
                          onClick={() => { setSelectedOrder(o); setStatusUpdateValue(o.status); }}
                          className="px-3.5 py-1.5 bg-brand-deep hover:bg-brand-gold hover:text-brand-deep font-bold rounded-lg text-white text-[10px] border border-white/10 transition-colors cursor-pointer"
                        >
                          تعديل الحالة
                        </button>
                      </td>
                    </tr>
                  );
                })
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
              <h4 className="text-lg font-bold text-white">تعديل حالة الشحنة</h4>
              <p className="text-white/40 text-xs font-mono mt-0.5">رقم التتبع: {selectedOrder.id}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 px-0.5">
                <label className="text-white/70 text-xs font-bold">الحالة الجديدة:</label>
                <select
                  id="modal_status_select"
                  value={statusUpdateValue}
                  onChange={(e) => setStatusUpdateValue(e.target.value as OrderStatus)}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]"
                >
                  <option value="pending">قيد المراجعة</option>
                  <option value="confirmed">تم التأكيد</option>
                  <option value="assigned">تم تعيين السائق</option>
                  <option value="picked_up">تم الاستلام</option>
                  <option value="in_transit">قيد التوصيل</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">تم الإلغاء</option>
                  <option value="returned">مرتجع</option>
                </select>
              </div>

              <div className="space-y-1.5 px-0.5">
                <label className="text-white/70 text-xs font-bold">ملاحظة التحديث (اختياري):</label>
                <input
                  id="modal_note_input"
                  type="text"
                  placeholder="مثال: تم التنسيق مع العميل وسيتم التسليم غداً"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold text-right"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between gap-3 border-t border-white/10">
              <button
                onClick={() => { setSelectedOrder(null); setStatusNote(""); }}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer border border-white/10"
              >
                إلغاء
              </button>
              <button
                id="modal_save_btn"
                onClick={handleStatusUpdate}
                className="flex-1 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-black rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}