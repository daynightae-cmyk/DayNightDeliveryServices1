import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, Loader2, RefreshCw, WalletCards } from "lucide-react";
import { createPortal } from "react-dom";
import { supabase } from "../../supabase";

type DeferredOrder = {
  id: string;
  tracking_number?: string | null;
  invoice_number?: string | null;
  coupon_number?: string | null;
  merchant_id?: string | null;
  merchant_name?: string | null;
  merchant_code?: string | null;
  status?: string | null;
  financial_posted_at?: string | null;
  goods_value?: number | null;
  delivery_fee?: number | null;
  customer_total?: number | null;
  merchant_due?: number | null;
  company_revenue?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const clean = (value: unknown) => String(value ?? "").trim();
const amount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const deliveredStatuses = new Set(["delivered", "completed", "complete"]);

function activeAdminSectionText() {
  const command = document.querySelector<HTMLElement>(".dncc-page-title strong");
  const legacy = document.querySelector<HTMLElement>(".dn-admin-side-nav button.is-active");
  return clean(command?.textContent || legacy?.textContent).toLowerCase();
}

function isAccountingSection(text: string) {
  return (
    text.includes("الحسابات") ||
    text.includes("كشوفات التجار") ||
    text.includes("accounts") ||
    text.includes("merchant statements")
  );
}

function referenceOf(order: DeferredOrder) {
  return clean(order.tracking_number || order.invoice_number || order.coupon_number || order.id);
}

export default function AdminDeferredMerchantAccounting() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [orders, setOrders] = useState<DeferredOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => {
      const nextHost = document.querySelector<HTMLElement>(".dn-admin-workspace-host");
      const onAdmin = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
      setHost(nextHost);
      setVisible(Boolean(onAdmin && nextHost && isAccountingSection(activeAdminSectionText())));
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "aria-current"],
    });
    window.addEventListener("popstate", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", sync);
    };
  }, []);

  async function load() {
    if (!supabase || !visible) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("orders")
        .select(
          "id,tracking_number,invoice_number,coupon_number,merchant_id,merchant_name,merchant_code,status,financial_posted_at,goods_value,delivery_fee,customer_total,merchant_due,company_revenue,created_at,updated_at",
        )
        .not("merchant_id", "is", null)
        .is("financial_posted_at", null)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (queryError) throw queryError;
      const deferred = ((data || []) as DeferredOrder[]).filter((order) =>
        deliveredStatuses.has(clean(order.status).toLowerCase().replace(/[\s-]+/g, "_")),
      );
      setOrders(deferred);
    } catch (cause) {
      setOrders([]);
      setError(clean((cause as { message?: string })?.message || cause) || "تعذر تحميل الطلبات المنتظرة.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [visible]);

  const zeroOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          amount(order.goods_value) === 0 &&
          amount(order.delivery_fee) === 0 &&
          amount(order.customer_total) === 0 &&
          amount(order.merchant_due) === 0 &&
          amount(order.company_revenue) === 0,
      ),
    [orders],
  );

  async function closeAccounting(order: DeferredOrder) {
    if (!supabase || !order.id) return;
    setClosingId(order.id);
    setMessage("");
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "admin_close_merchant_order_accounting",
        {
          p_order_id: order.id,
          p_delivery_fee: 30,
        },
      );
      if (rpcError) throw rpcError;
      const saved = (Array.isArray(data) ? data[0] : data) as DeferredOrder | null;
      setMessage(
        `تم قفل حساب الطلب ${referenceOf(saved || order)}: العميل 0.00 درهم، التاجر مدين 30.00 درهم، ودخل داي نايت 30.00 درهم.`,
      );
      await load();
    } catch (cause) {
      setError(clean((cause as { message?: string })?.message || cause) || "تعذر قفل الحساب.");
    } finally {
      setClosingId("");
    }
  }

  if (!visible || !host) return null;

  return createPortal(
    <section
      className="mt-5 overflow-hidden rounded-[1.8rem] border border-brand-gold/30 bg-[#031226] p-5 shadow-2xl shadow-black/25"
      dir="rtl"
      data-dn-deferred-accounting="true"
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold">
            <WalletCards className="h-6 w-6" />
          </span>
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-gold">
              قفل حساب التاجر
            </span>
            <h2 className="mt-1 text-xl font-black text-white">
              طلبات مسلّمة بقيمة صفر بانتظار ترحيل 30 درهم
            </h2>
            <p className="mt-1 text-xs font-bold leading-6 text-white/55">
              الطلب يبقى مرتبطًا بالتاجر بقيمة صفر أثناء التشغيل. عند قفل الحساب يُسجّل 30 درهم مدينًا على التاجر ودخلًا لداي نايت مرة واحدة فقط.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          تحديث
        </button>
      </header>

      {message && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs font-bold leading-6 text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold leading-6 text-rose-100">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] border-collapse text-right text-xs">
          <thead className="bg-[#0b2948] text-brand-gold">
            <tr>
              <th className="p-3">الطلب</th>
              <th className="p-3">التاجر</th>
              <th className="p-3">الحالة الحالية</th>
              <th className="p-3">قيمة العميل</th>
              <th className="p-3">المطلوب عند القفل</th>
              <th className="p-3">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {zeroOrders.map((order) => (
              <tr key={order.id} className="border-t border-white/10 bg-[#071a33] text-white">
                <td className="p-3 font-black" dir="ltr">{referenceOf(order)}</td>
                <td className="p-3">
                  <strong className="block text-white">{order.merchant_name || order.merchant_code || order.merchant_id}</strong>
                  <small className="text-white/45" dir="ltr">{order.merchant_code || order.merchant_id}</small>
                </td>
                <td className="p-3 text-emerald-200">مسلّمة · غير مُرحّلة</td>
                <td className="p-3 font-black" dir="ltr">0.00 AED</td>
                <td className="p-3 font-black text-brand-gold" dir="ltr">-30.00 AED على التاجر</td>
                <td className="p-3">
                  <button
                    type="button"
                    disabled={Boolean(closingId)}
                    onClick={() => void closeAccounting(order)}
                    className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 font-black text-brand-deep disabled:opacity-50"
                  >
                    {closingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    قفل الحساب وخصم 30
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && zeroOrders.length === 0 && (
          <div className="grid min-h-28 place-items-center bg-[#071a33] p-5 text-center text-sm font-bold text-white/55">
            لا توجد حاليًا طلبات مسلّمة بقيمة صفر تنتظر قفل الحساب.
          </div>
        )}
      </div>
    </section>,
    host,
  );
}
