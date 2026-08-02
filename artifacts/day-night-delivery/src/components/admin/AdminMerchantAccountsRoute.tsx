import { useEffect, useRef, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, Search } from "lucide-react";
import type { Merchant, Order } from "../../types";
import { fetchAdminOrders, fetchMerchants } from "../../lib/adminData";
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
const OPERATIONAL_REQUEST_TIMEOUT_MS = 8_000;
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function withOperationalTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label}_timeout`)),
      OPERATIONAL_REQUEST_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        window.clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

async function withOperationalRetry<T>(task: () => Promise<T>, label: string): Promise<T> {
  let latest: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withOperationalTimeout(task(), label);
    } catch (cause) {
      latest = cause;
      if (attempt < 2) await wait(500 * (attempt + 1));
    }
  }
  throw new Error(`${label}: ${latest instanceof Error ? latest.message : String(latest || "unknown failure")}`);
}

/**
 * The merchant directory and exact-UUID order view are operational data and
 * must remain usable even while the heavier finance snapshot is still loading.
 * Missing parent data is recovered directly from the same protected admin
 * sources, while finance rows fail closed and never replace merchant/order data.
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
  const [authoritativeOrders, setAuthoritativeOrders] = useState<Order[]>(orders);
  const [authoritativeMerchants, setAuthoritativeMerchants] = useState<Merchant[]>(merchants);
  const [snapshot, setSnapshot] = useState<FinanceLedgerSnapshot | null>(null);
  const [financeBusy, setFinanceBusy] = useState(false);
  const [operationalBusy, setOperationalBusy] = useState(() => !orders.length || !merchants.length);
  const [financeError, setFinanceError] = useState("");
  const [operationalError, setOperationalError] = useState("");
  const financeRequest = useRef(0);
  const operationalRequest = useRef(0);

  useEffect(() => {
    if (orders.length) setAuthoritativeOrders(orders);
  }, [orders]);

  useEffect(() => {
    if (merchants.length) setAuthoritativeMerchants(merchants);
  }, [merchants]);

  async function recoverOperationalData(force = false) {
    const requestId = ++operationalRequest.current;
    const needOrders = force || !orders.length;
    const needMerchants = force || !merchants.length;
    if (!needOrders && !needMerchants) {
      setOperationalBusy(false);
      return;
    }

    setOperationalBusy(true);
    setOperationalError("");
    const [ordersResult, merchantsResult] = await Promise.allSettled([
      needOrders
        ? withOperationalRetry(fetchAdminOrders, "orders recovery failed")
        : Promise.resolve(orders),
      needMerchants
        ? withOperationalRetry(fetchMerchants, "merchants recovery failed")
        : Promise.resolve(merchants),
    ]);

    if (requestId !== operationalRequest.current) return;

    const failures: string[] = [];
    if (ordersResult.status === "fulfilled") {
      setAuthoritativeOrders(Array.isArray(ordersResult.value) ? ordersResult.value : []);
    } else {
      failures.push(ordersResult.reason instanceof Error ? ordersResult.reason.message : String(ordersResult.reason));
    }

    if (merchantsResult.status === "fulfilled") {
      setAuthoritativeMerchants(Array.isArray(merchantsResult.value) ? merchantsResult.value : []);
    } else {
      failures.push(merchantsResult.reason instanceof Error ? merchantsResult.reason.message : String(merchantsResult.reason));
    }

    if (failures.length) {
      setOperationalError(
        isArabic
          ? "تعذر تحديث الطلبات أو التجار بعد إعادة المحاولة. استمر عرض البيانات المحمية المحملة مسبقاً، ولم يتم عرض بيانات مختلطة."
          : "Orders or merchants could not be refreshed after retrying. Previously loaded protected data remains visible, and no mixed data was shown.",
      );
    }
    setOperationalBusy(false);
  }

  useEffect(() => {
    void recoverOperationalData(false);
  }, [orders.length, merchants.length]);

  useEffect(() => {
    const requestId = ++financeRequest.current;
    setFinanceError("");

    if (!authoritativeOrders.length) {
      setSnapshot(null);
      setFinanceBusy(false);
      return;
    }

    setFinanceBusy(true);
    void fetchFinanceLedgerSnapshot(authoritativeOrders, dateFrom, dateTo)
      .then((next) => {
        if (requestId !== financeRequest.current) return;
        setSnapshot(next);
      })
      .catch((cause) => {
        if (requestId !== financeRequest.current) return;
        console.error("Merchant accounts finance snapshot failed.", cause);
        setSnapshot(null);
        setFinanceError(
          isArabic
            ? "تعذر تحميل الحركات المالية للفترة المحددة. دليل التجار وطلبياتهم الموثوقة ما زالا متاحين بدون خلط بيانات."
            : "Finance movements could not be loaded for the selected period. The verified merchant directory and orders remain available without mixing data.",
        );
      })
      .finally(() => {
        if (requestId === financeRequest.current) setFinanceBusy(false);
      });
  }, [authoritativeOrders, dateFrom, dateTo, isArabic]);

  async function refreshAll() {
    await recoverOperationalData(true);
    void onRefresh().catch((cause) => {
      console.warn("Merchant accounts parent refresh failed.", cause);
    });
  }

  const busy = operationalBusy || financeBusy;

  return (
    <section
      className="space-y-4"
      dir={isArabic ? "rtl" : "ltr"}
      data-authoritative-order-count={authoritativeOrders.length}
      data-authoritative-merchant-count={authoritativeMerchants.length}
    >
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
          disabled={operationalBusy}
          onClick={() => void refreshAll()}
          className="self-end inline-flex items-center justify-center gap-2 rounded-xl border border-brand-sky/35 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky disabled:opacity-50"
        >
          {operationalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isArabic ? "تحديث" : "Refresh"}
        </button>
      </section>

      {operationalError && (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs font-bold text-rose-200">
          {operationalError}
        </p>
      )}

      {financeError && (
        <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs font-bold text-amber-100">
          {financeError}
        </p>
      )}

      {busy && (
        <p
          data-admin-merchant-accounts-loading="true"
          className="flex items-center gap-3 rounded-xl border border-brand-sky/25 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {operationalBusy
            ? isArabic
              ? "جاري تحديث الطلبات والتجار من المصادر المحمية دون إخفاء الدليل الحالي..."
              : "Refreshing orders and merchants from protected sources without hiding the current directory..."
            : isArabic
              ? "دليل التجار والطلبيات جاهز؛ يجري تحميل الحركات المالية في الخلفية..."
              : "Merchant directory and orders are ready; finance movements are loading in the background..."}
        </p>
      )}

      <AdminMerchantAccountsCenter
        isArabic={isArabic}
        merchants={authoritativeMerchants}
        orders={authoritativeOrders}
        accountEntries={snapshot?.accountEntries || []}
        settlements={snapshot?.settlements || []}
        query={query}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onNavigate={onNavigate}
      />
    </section>
  );
}
