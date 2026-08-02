import { useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, Search } from "lucide-react";
import type { Merchant, Order } from "../../types";
import {
  fetchFinanceLedgerSnapshot,
  type FinanceLedgerSnapshot,
} from "../../lib/adminFinanceLedger";
import AdminMerchantAccountsCenter from "./AdminMerchantAccountsCenter";

type Props = {
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  onRefresh: () => Promise<void>;
  onNavigate: (id: string) => void;
};

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

/**
 * Consumes the authoritative order array already loaded by the admin command
 * center, then loads only the finance snapshot for the selected period. This
 * avoids a second full paginated order query while the parent is still loading.
 */
export default function AdminMerchantAccountsRoute({
  isArabic,
  orders,
  merchants,
  onRefresh,
  onNavigate,
}: Props) {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [query, setQuery] = useState("");
  const [authoritativeOrders, setAuthoritativeOrders] = useState<Order[]>([]);
  const [snapshot, setSnapshot] = useState<FinanceLedgerSnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function loadFromAdminOrders(sourceOrders: Order[]) {
    if (!sourceOrders.length) {
      setBusy(true);
      setAuthoritativeOrders([]);
      setSnapshot(null);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const next = await fetchFinanceLedgerSnapshot(sourceOrders, dateFrom, dateTo);
      setAuthoritativeOrders(sourceOrders);
      setSnapshot(next);
    } catch (cause) {
      console.error("Merchant accounts route load failed.", cause);
      setAuthoritativeOrders([]);
      setSnapshot(null);
      setError(
        isArabic
          ? "تعذر تحميل حسابات التجار للفترة المحددة من قاعدة البيانات. لم يتم عرض بيانات ناقصة أو مختلطة."
          : "Merchant accounts could not be loaded for the selected period. No incomplete or mixed fallback was shown.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadFromAdminOrders(orders);
  }, [dateFrom, dateTo, orders]);

  async function refreshAll() {
    setBusy(true);
    setError("");
    try {
      await onRefresh();
    } catch (cause) {
      console.error("Merchant accounts parent refresh failed.", cause);
      setError(
        isArabic
          ? "تعذر تحديث قائمة الطلبات. احتفظ النظام بالبيانات الموثوقة الحالية دون خلطها."
          : "The order list could not be refreshed. The current verified data was retained without mixing records.",
      );
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" dir={isArabic ? "rtl" : "ltr"} data-authoritative-order-count={authoritativeOrders.length}>
      <section className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-[#031226] p-4 md:grid-cols-[1fr_1fr_minmax(260px,1.3fr)_auto]">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-black text-white/55">
            <CalendarDays className="h-4 w-4 text-brand-gold" />
            {isArabic ? "من تاريخ" : "From"}
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white outline-none focus:border-brand-gold/50"
          />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-black text-white/55">
            <CalendarDays className="h-4 w-4 text-brand-gold" />
            {isArabic ? "إلى تاريخ" : "To"}
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white outline-none focus:border-brand-gold/50"
          />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-black text-white/55">
            <Search className="h-4 w-4 text-brand-sky" />
            {isArabic ? "بحث عن تاجر" : "Merchant search"}
          </span>
          <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 focus-within:border-brand-gold/50">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
              placeholder={isArabic ? "الاسم، الكود، الهاتف..." : "Name, code, phone..."}
            />
          </span>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshAll()}
          className="self-end inline-flex items-center justify-center gap-2 rounded-xl border border-brand-sky/35 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isArabic ? "تحديث" : "Refresh"}
        </button>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs font-bold text-rose-200">
          {error}
        </p>
      )}

      {busy && !snapshot ? (
        <div className="grid min-h-64 place-items-center rounded-[1.8rem] border border-white/10 bg-[#031226] text-sm font-black text-white/55">
          <span className="inline-flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-brand-gold" />
            {orders.length
              ? isArabic
                ? `جاري تجهيز حسابات ${orders.length} طلبية موثوقة...`
                : `Preparing accounts for ${orders.length} verified orders...`
              : isArabic
                ? "بانتظار تحميل قائمة الطلبات الموثوقة من لوحة الإدارة..."
                : "Waiting for the verified admin order list..."}
          </span>
        </div>
      ) : (
        <AdminMerchantAccountsCenter
          isArabic={isArabic}
          merchants={merchants}
          orders={authoritativeOrders}
          accountEntries={snapshot?.accountEntries || []}
          settlements={snapshot?.settlements || []}
          query={query}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onNavigate={onNavigate}
        />
      )}
    </section>
  );
}
