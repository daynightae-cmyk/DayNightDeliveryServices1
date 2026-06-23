import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { Package, Truck, MapPin, FileText, Phone, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface Order {
  id: string;
  tracking_code: string;
  status: string;
  price: number;
  created_at: string;
  sender_name?: string;
  receiver_name?: string;
  receiver_phone?: string;
}

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?redirect=/customer");
      return;
    }
    setUser(session.user);
    fetchOrders(session.user.id);
  }

  async function fetchOrders(userId: string) {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "text-emerald-500 bg-emerald-500/10";
      case "in_transit": return "text-blue-500 bg-blue-500/10";
      case "out_for_delivery": return "text-amber-500 bg-amber-500/10";
      case "picked_up": return "text-purple-500 bg-purple-500/10";
      case "failed": return "text-red-500 bg-red-500/10";
      default: return "text-white/60 bg-white/5";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "قيد المعالجة",
      picked_up: "تم الاستلام",
      in_transit: "أثناء النقل",
      out_for_delivery: "خارج للتوصيل",
      delivered: "تم التوصيل",
      failed: "فشل التوصيل"
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-deep flex items-center justify-center">
        <div className="text-brand-gold text-xl">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-deep pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
            لوحة تحكم العميل
          </h1>
          <p className="text-white/60 text-sm">
            تتبع طلباتك وشحناتك بسهولة
          </p>
          {user && (
            <p className="text-brand-gold text-xs mt-2 font-mono">
              {user.email}
            </p>
          )}
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-brand-cool/30 rounded-2xl p-12 border border-white/10 text-center">
            <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">لا توجد طلبات بعد</h3>
            <p className="text-white/40 text-sm mb-6">
              ابدأ بإنشاء طلب توصيل جديد
            </p>
            <button
              onClick={() => navigate("/request")}
              className="bg-brand-gold text-brand-deep px-6 py-3 rounded-xl font-bold hover:bg-brand-gold/90 transition-colors"
            >
              إنشاء طلب جديد
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-brand-cool/30 rounded-xl p-6 border border-white/10 hover:border-brand-gold/50 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-brand-gold font-bold text-lg">
                        {order.tracking_code}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-white/60">
                        <p className="text-xs text-white/40">المرسل إليه</p>
                        <p className="text-white font-bold">{order.receiver_name || "-"}</p>
                      </div>
                      <div className="text-white/60">
                        <p className="text-xs text-white/40">السعر</p>
                        <p className="text-brand-gold font-bold">{order.price || 0} AED</p>
                      </div>
                    </div>

                    <p className="text-white/40 text-xs flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {new Date(order.created_at).toLocaleDateString("ar-AE")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate(`/tracking/${order.tracking_code}`)}
                      className="flex items-center gap-2 bg-brand-blue/20 text-brand-blue px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-blue/30 transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      تتبع
                    </button>
                    <button
                      onClick={() => window.open(`https://wa.me/971568757331?text=Order: ${order.tracking_code}`, "_blank")}
                      className="flex items-center gap-2 bg-emerald-500/20 text-emerald-500 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-500/30 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      واتساب
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
