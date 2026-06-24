import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Order } from "../../types";
import { supabase, updateExistingOrderStatus } from "../../supabase";
import DriverMobileView from "./DriverMobileView";
import { useAppContext } from "../../lib/AppContext";
import { pageCopy } from "../../data/pageCopy";
import companyMeta from "../../data/companyMeta";
import GlassCard from "../ui/GlassCard";
import { KeyRound, MessageSquare, Loader2 } from "lucide-react";

export default function DriverPortal() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const t = pageCopy[language].driverPage;

  const [driverCode, setDriverCode] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);

  const loadOrders = useCallback(async (code: string) => {
    if (!supabase) return [];
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, sender_city, receiver_city, created_at, driver_code, driver_phone")
      .eq("driver_code", code)
      .in("status", ["confirmed", "assigned", "picked_up", "in_transit", "Picked Up", "In Transit", "Processing"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (fetchError) {
      console.warn("Driver orders fetch failed.");
      return [];
    }
    return (data || []) as Order[];
  }, []);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const code = driverCode.trim().toUpperCase();
    if (code.length < 4) {
      setError(t.invalidCode);
      setLoading(false);
      return;
    }

    if (supabase) {
      const { data: driverRow } = await supabase
        .from("drivers")
        .select("id, code, phone, active")
        .eq("code", code)
        .maybeSingle();

      if (driverRow && driverRow.active === false) {
        setError(t.invalidCode);
        setLoading(false);
        return;
      }
    }

    const assigned = await loadOrders(code);
    if (assigned.length === 0 && !supabase) {
      setError(t.invalidCode);
      setLoading(false);
      return;
    }

    setOrders(assigned);
    setVerified(true);
    setLoading(false);
  }

  async function handleStatusChange(orderId: string, status: Order["status"], note?: string) {
    const ok = await updateExistingOrderStatus(orderId, status, note);
    if (ok) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    }
  }

  useEffect(() => {
    if (!verified || !driverCode) return;
    const interval = window.setInterval(async () => {
      const fresh = await loadOrders(driverCode.trim().toUpperCase());
      setOrders(fresh);
    }, 60000);
    return () => window.clearInterval(interval);
  }, [verified, driverCode, loadOrders]);

  if (!verified) {
    return (
      <div className="max-w-md mx-auto space-y-6" dir={isArabic ? "rtl" : "ltr"}>
        <GlassCard className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <KeyRound className="w-12 h-12 text-brand-gold mx-auto" />
            <h1 className="text-2xl font-black text-white">{t.title}</h1>
            <p className="text-white/60 text-sm">{t.subtitle}</p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-white/75 text-xs font-bold">{t.codeLabel} *</label>
              <input
                value={driverCode}
                onChange={(e) => setDriverCode(e.target.value.toUpperCase())}
                className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono tracking-widest focus:outline-none focus:border-brand-gold"
                placeholder="DN-DRV-XXXX"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-white/75 text-xs font-bold">{t.phoneLabel}</label>
              <input
                type="tel"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold"
                dir="ltr"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-black rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t.login}
            </button>
          </form>

          <a
            href={companyMeta.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-[#25D366] font-bold hover:underline"
          >
            <MessageSquare className="w-4 h-4" />
            {t.support}
          </a>
        </GlassCard>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <GlassCard className="p-8 text-center space-y-4">
        <p className="text-white/70">{t.noOrders}</p>
        <button onClick={() => setVerified(false)} className="text-brand-gold text-sm font-bold hover:underline">
          {isArabic ? "تسجيل خروج" : "Sign out"}
        </button>
      </GlassCard>
    );
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"}>
      <DriverMobileView orders={orders} onStatusChange={handleStatusChange} />
    </div>
  );
}
