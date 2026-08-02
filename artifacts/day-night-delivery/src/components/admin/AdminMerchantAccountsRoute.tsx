import { useEffect, useRef, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, Search } from "lucide-react";
import type { Merchant, Order } from "../../types";
import { fetchMerchants } from "../../lib/adminData";
import {
  fetchAdminOrdersResilient,
  waitForAdminOperationalSession,
} from "../../lib/adminOrderRecovery";
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
const OPERATIONAL_REQUEST_TIMEOUT_MS = 30_000;
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
      if (attempt < 2) await wait(700 * (attempt + 1));
    }
  }
  throw new Error(`${label}: ${latest instanceof Error ? latest.message : String(latest || "unknown failure")}`);
}

/**
 * Merchant ownership is exposed only after the authenticated browser session,
 * complete protected order set, and merchant directory have all been verified.
 * Finance remains independent and can never fabricate operational ownership.
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
  const [ordersVerified, setOrdersVerified] = useState(() => orders.length > 0);
  const [merchantsVerified, setMerchantsVerified] = useState(() => merchants.length > 0);
  const [snapshot, setSnapshot] = useState<FinanceLedgerSnapshot | null>(null);
  const [financeBusy, setFinanceBusy] = useState(false);
  const [operationalBusy, setOperationalBusy] = useState(() => !orders.length || !merchants.length);
  const [financeError, setFinanceError] = useState("");
  const [operationalError, setOperationalError] = useState("");
  const [operationalDiagnostic, setOperationalDiagnostic] = useState("");
  const financeRequest = useRef(0);
  const operationalRequest = useRef(0);

  useEffect(() => {
    if (orders.length) {
      setAuthoritativeOrders(orders);
      setOrdersVerified(true);
    }
  }, [orders]);

  useEffect(() => {
    if (merchants.length) {
      setAuthoritativeMerchants(merchants);
      setMerchantsVerified(true);
    }
  }, [merchants]);

  async function recoverOperationalData(force = false) {
    const requestId = ++operationalRequest.current;
    const needOrders = force || !ordersVerified;
    const needMerchants = force || !merchantsVerified;
    if (!needOrders && !needMerchants) {
      setOperationalBusy(false);
      return;
    }

    setOperationalBusy(true);
    setOperationalError("");
    setOperationalDiagnostic("");

    try {
      await waitForAdminOperationalSession();
    } catch (cause) {
      if (requestId !== operationalRequest.current) return;
      const detail = cause instanceof Error ? cause.message : String(cause || "admin session unavailable");
      console.error("Merchant accounts authenticated session recovery failed.", cause);
      setOperationalDiagnostic(detail);
      setOperationalError(
        isArabic
          ? "لم تكتمل جلسة الإدارة الموثقة بعد. لم يتم عرض أي حسابات ناقصة؛ اضغط تحديث لإعادة المحاولة."
          : "The authenticated admin session is not ready yet. No incomplete account data was shown; press Refresh to retry.",
      );
      setOperationalBusy(false);
      return;
    }

    const [ordersResult, merchantsResult] = await Promise.allSettled([
      needOrders ? fetchAdminOrdersResilient() : Promise.resolve(authoritativeOrders),
      needMerchants
        ? withOperationalRetry(fetchMerchants, "merchants recovery failed")
        : Promise.resolve(authoritativeMerchants),
    ]);

    if (requestId !== operationalRequest.current) return;

    const failures: string[] = [];
    if (ordersResult.status === "fulfilled" && Array.isArray(ordersResult.value) && ordersResult.value.length > 0) {
      setAuthoritativeOrders(ordersResult.value);
      setOrdersVerified(true);
    } else {
      if (!ordersVerified) setOrdersVerified(false);
      failures.push(
        ordersResult.status === "rejected"
          ? ordersResult.reason instanceof Error
            ? ordersResult.reason.message
            : String(ordersResult.reason)
          : "protected orders query returned an empty set",
      );
    }

    if (merchantsResult.status === "fulfilled" && Array.isArray(merchantsResult.value) && merchantsResult.value.length > 0) {
      setAuthoritativeMerchants(merchantsResult.value);
      setMerchantsVerified(true);
    } else {
      if (!merchantsVerified) setMerchantsVerified(false);
      failures.push(
        merchantsResult.status === "rejected"
          ? merchantsResult.reason instanceof Error
            ? merchantsResult.reason.message
            : String(merchantsResult.reason)
          : "protected merchants query returned an empty set",
      );
    }

    if (failures.length) {
      const diagnostic = failures.join(" | ");
      console.error("Merchant accounts protected operational recovery failed:", diagnostic);
      setOperationalDiagnostic(diagnostic);
      setOperationalError(
        isArabic
          ? "تعذر التحقق الكامل من الطلبات أو التجار بعد إعادة المحاولة. لم يتم فتح أي ملف تاجر ببيانات ناقصة أو مختلطة."
          : "Orders or merchants could not be fully verified after retrying. No merchant account was opened with incomplete or mixed data.",
      );
    }
    setOperationalBusy(false);
  }

  useEffect(() => {
    void recoverOperationalData(false);
  }, [ordersVerified, merchantsVerified]);

  useEffect(() => {
    const requestId = ++financeRequest.current;
    setFinanceError("");

    if (!ordersVerified) {
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
  }, [authoritativeOrders, dateFrom, dateTo, isArabic, ordersVerified]);

  async function refreshAll() {
    await recoverOperationalData(true);
    void onRefresh().catch((cause) => {
      console.warn("Merchant accounts parent refresh failed.", cause);
    });
  }

  const operationalReady = ordersVerified && merchantsVerified;
  const busy = operationalBusy || financeBusy;
  const visibleMerchants = operationalReady ? authoritativeMerchants : [];

  return (
    <section
      className="space-y-4"
      dir={isArabic ? "rtl" : "ltr"}
      data-authoritative-order-count={operationalReady ? authoritativeOrders.length : 0}
      data-authoritative-merchant-count={visibleMerchants.length}
      data-admin-merchant-accounts-ready={operationalReady ? "true" : "false"}
      data-admin-merchant-accounts-error={operationalError ? "true" : "false"}
      data-admin-merchant-accounts-diagnostic={operationalDiagnostic}
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
              disabled={!operationalReady}
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
              ? "جاري التحقق الكامل من الطلبات والتجار عبر المصادر المحمية..."
              : "Verifying the complete orders and merchant sets through protected sources..."
            : isArabic
              ? "دليل التجار والطلبيات جاهز؛ يجري تحميل الحركات المالية في الخلفية..."
              : "Merchant directory and orders are ready; finance movements are loading in the background..."}
        </p>
      )}

      <AdminMerchantAccountsCenter
        isArabic={isArabic}
        merchants={visibleMerchants}
        orders={operationalReady ? authoritativeOrders : []}
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
