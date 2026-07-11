import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  MapPin,
  PackagePlus,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  deleteOpsMerchant,
  fetchOpsSnapshot,
  updateOpsMerchantStatus,
  type OpsDataSource,
} from "../lib/adminOperationsData";
import type { Merchant, Order } from "../types";

type Insight = {
  merchant: Merchant;
  orders: Order[];
  score: number;
  health: number;
  delivered: number;
  pending: number;
  cancelled: number;
  codTotal: number;
  deliveryTotal: number;
  topCity: string;
  level: "vip" | "good" | "review" | "new";
  tags: string[];
  noteAr: string;
  noteEn: string;
};

const quickAr = ["نشط", "دبي", "أبوظبي", "COD", "يحتاج مراجعة", "بدون طلبات", "VIP"];
const quickEn = ["active", "Dubai", "Abu Dhabi", "COD", "needs review", "no orders", "VIP"];
const statusActions = [
  { status: "active", ar: "تفعيل", en: "Activate" },
  { status: "review", ar: "مراجعة", en: "Review" },
  { status: "paused", ar: "إيقاف مؤقت", en: "Pause" },
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function norm(value: unknown) {
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function digits(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function money(value: number) {
  return `${value.toFixed(2)} AED`;
}

function statusText(value?: string) {
  return norm(value).replace(/[_-]/g, " ");
}

function statusHas(order: Order, words: string[]) {
  const status = statusText(order.status);
  return words.some((word) => status.includes(norm(word)));
}

function common(values: string[]) {
  const map = new Map<string, number>();
  values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) || 0) + 1));
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
}

function belongs(merchant: Merchant, order: Order) {
  return Boolean(merchant.id && order.merchant_id && String(order.merchant_id) === String(merchant.id));
}

function levelClass(level: Insight["level"]) {
  if (level === "vip") return "border-brand-gold/40 bg-brand-gold/10 text-brand-gold";
  if (level === "review") return "border-rose-400/35 bg-rose-500/10 text-rose-200";
  if (level === "new") return "border-brand-sky/35 bg-brand-blue/10 text-brand-sky";
  return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
}

function healthClass(health: number) {
  if (health >= 80) return "text-emerald-300";
  if (health >= 50) return "text-brand-gold";
  return "text-rose-200";
}

function buildInsight(merchant: Merchant, allOrders: Order[], query: string): Insight {
  const orders = allOrders.filter((order) => belongs(merchant, order));
  const delivered = orders.filter((order) => statusHas(order, ["delivered", "completed", "تم التسليم"])).length;
  const cancelled = orders.filter((order) => statusHas(order, ["cancel", "fail", "ملغي", "فشل"])).length;
  const pending = Math.max(0, orders.length - delivered - cancelled);
  const codTotal = orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
  const deliveryTotal = orders.reduce((sum, order) => sum + Number(order.delivery_price || order.price || 0), 0);
  const fields = [merchant.trade_name, merchant.owner_name, merchant.phone, merchant.email, merchant.city, merchant.address, merchant.pickup_address, merchant.license_number, merchant.trn || merchant.tax_number];
  const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  const deliveryRate = orders.length ? Math.round((delivered / orders.length) * 100) : 0;
  const cancelRate = orders.length ? Math.round((cancelled / orders.length) * 100) : 0;
  const health = Math.max(0, Math.min(100, Math.round(completeness * 0.55 + deliveryRate * 0.25 + Math.min(orders.length * 3, 20) - cancelRate * 0.45)));
  const topCity = common(orders.map((order) => order.receiver_city || order.sender_city || "").concat([merchant.city || merchant.emirate || ""]));
  const tags = Array.from(new Set([
    merchant.status || "active",
    merchant.city,
    merchant.emirate,
    codTotal > 0 ? "COD" : "",
    orders.length ? "مرتبط بطلبيات مباشرة" : "بدون طلبات مباشرة",
    health >= 80 ? "VIP" : "",
    cancelRate >= 20 ? "يحتاج مراجعة" : "",
  ].filter(Boolean) as string[])).slice(0, 7);
  const haystack = norm([
    merchant.trade_name,
    merchant.owner_name,
    merchant.merchant_code,
    merchant.phone,
    merchant.alt_phone,
    merchant.email,
    merchant.city,
    merchant.emirate,
    merchant.status,
    merchant.bank_name,
    merchant.iban,
    merchant.trn || merchant.tax_number,
    tags.join(" "),
    orders.map((order) => [order.coupon_number, order.receiver_name, order.receiver_phone, order.receiver_city, order.status, order.package_type].join(" ")).join(" "),
  ].join(" "));
  const q = norm(query);
  const qDigits = digits(query).slice(-7);
  let score = Math.min(orders.length * 4, 35) + Math.round(health / 8) + (orders.length ? 8 : 0);

  if (q) {
    score = q.split(" ").filter(Boolean).reduce((sum, token) => {
      return sum +
        (norm(merchant.trade_name).startsWith(token) ? 50 : 0) +
        (norm(merchant.trade_name).includes(token) ? 35 : 0) +
        (norm(merchant.merchant_code).includes(token) ? 30 : 0) +
        (haystack.includes(token) ? 12 : 0);
    }, 0);
    if (qDigits && [merchant.phone, merchant.alt_phone].some((value) => digits(value).includes(qDigits))) score += 65;
    score += Math.min(orders.length * 2, 18) + Math.round(health / 12);
  }

  let level: Insight["level"] = "good";
  let noteAr = "تاجر مستقر. الأرقام المعروضة هنا من الطلبات المرتبطة مباشرة بمعرف التاجر فقط.";
  let noteEn = "Stable merchant. The numbers shown here come only from orders directly linked by merchant_id.";

  if (!orders.length) {
    level = "new";
    noteAr = "لا توجد طلبات مرتبطة مباشرة بهذا التاجر. لن يتم احتساب أي طلب بالاسم أو الهاتف حتى لا تظهر أرقام غير صحيحة.";
    noteEn = "No orders are directly linked to this merchant. Name/phone matching is not used, so unrelated orders are not counted.";
  } else if (health >= 82 || deliveryTotal >= 500 || orders.length >= 10) {
    level = "vip";
    noteAr = "تاجر عالي القيمة بناءً على طلبات مرتبطة مباشرة. رشحه لأولوية الاستلام وكشف أسبوعي سريع.";
    noteEn = "High-value merchant based on directly linked orders. Give pickup priority and fast weekly statements.";
  } else if (cancelRate >= 20 || norm(merchant.status).includes("review") || norm(merchant.status).includes("paused")) {
    level = "review";
    noteAr = "يحتاج مراجعة تشغيلية. افحص العناوين والأرقام وأسباب الإلغاء والتحصيل للطلبات المرتبطة مباشرة فقط.";
    noteEn = "Needs operational review. Check addresses, phones, cancellation reasons, and COD for directly linked orders only.";
  }

  return { merchant, orders, score, health, delivered, pending, cancelled, codTotal, deliveryTotal, topCity, level, tags, noteAr, noteEn };
}

export default function AdminMerchantIntelligence({
  isArabic,
  onSearchOrders,
  onCreateOrder,
}: {
  isArabic: boolean;
  onSearchOrders: (term: string) => void;
  onCreateOrder: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [source, setSource] = useState<OpsDataSource | "none">("none");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const snapshot = await fetchOpsSnapshot();
      setOrders(snapshot.orders);
      setMerchants(snapshot.merchants);
      setSource(snapshot.source);
      setMessage(isArabic ? "تم تحديث التجار والطلبات من قاعدة البيانات." : "Merchants and orders refreshed from database.");
    } catch (err) {
      setSource("none");
      setError(String((err as Error).message || err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const insights = useMemo(
    () => merchants
      .map((merchant) => buildInsight(merchant, orders, query))
      .filter((item) => !query.trim() || item.score > 0)
      .sort((a, b) => b.score - a.score || b.orders.length - a.orders.length)
      .slice(0, 40),
    [merchants, orders, query],
  );

  const selected = insights.find((item) => item.merchant.id === selectedId) || insights[0] || null;
  const vip = insights.filter((item) => item.level === "vip").length;
  const review = insights.filter((item) => item.level === "review").length;
  const active = merchants.filter((merchant) => norm(merchant.status || "active") === "active").length;
  const paused = merchants.filter((merchant) => norm(merchant.status).includes("paused")).length;
  const linkedOrdersTotal = insights.reduce((sum, item) => sum + item.orders.length, 0);
  const linkedDeliveryTotal = insights.reduce((sum, item) => sum + item.deliveryTotal, 0);
  const quick = isArabic ? quickAr : quickEn;

  function copyCard(item: Insight) {
    const text = [
      "DAY NIGHT MERCHANT",
      item.merchant.trade_name,
      item.merchant.merchant_code || "",
      item.merchant.phone,
      item.merchant.city || item.merchant.emirate || "",
      `Direct orders: ${item.orders.length}`,
      `Health: ${item.health}%`,
      `COD: ${money(item.codTotal)}`,
    ].join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(text);
  }

  async function changeStatus(merchantId: string, status: string) {
    setLoading(true);
    setError("");
    try {
      const result = await updateOpsMerchantStatus(merchantId, status);
      setSource(result.source);
      setMerchants((current) => current.map((merchant) => merchant.id === merchantId ? result.row : merchant));
      setMessage(isArabic ? `تم تحديث حالة التاجر إلى ${status}.` : `Merchant status updated to ${status}.`);
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteMerchant(item: Insight) {
    const hasLinkedOrders = item.orders.length > 0;
    const confirmText = hasLinkedOrders
      ? (isArabic ? "لا يمكن حذف تاجر له طلبات مرتبطة مباشرة. استخدم إيقاف مؤقت أو مراجعة." : "Merchants with directly linked orders cannot be deleted. Use Pause or Review instead.")
      : (isArabic ? `تأكيد حذف التاجر من قاعدة البيانات: ${item.merchant.trade_name}؟` : `Delete merchant from database: ${item.merchant.trade_name}?`);

    if (hasLinkedOrders) {
      setError(confirmText);
      return;
    }

    const approved = typeof window === "undefined" ? true : window.confirm(confirmText);
    if (!approved) return;

    setLoading(true);
    setError("");
    try {
      const result = await deleteOpsMerchant(item.merchant.id);
      setSource(result.source);
      setMerchants((current) => current.filter((merchant) => merchant.id !== item.merchant.id));
      setSelectedId("");
      setMessage(isArabic ? `تم حذف التاجر من قاعدة البيانات: ${item.merchant.trade_name}.` : `Merchant deleted from database: ${item.merchant.trade_name}.`);
    } catch (err) {
      const text = String((err as Error).message || err);
      setError(text.includes("directly linked")
        ? (isArabic ? "لا يمكن حذف هذا التاجر لأن لديه طلبات مرتبطة مباشرة بمعرف التاجر. استخدم إيقاف مؤقت أو مراجعة." : text)
        : text);
    } finally {
      setLoading(false);
    }
  }

  const sourceText = source === "rpc"
    ? (isArabic ? "مصدر الإدارة: RPC إنتاجي" : "Admin source: production RPC")
    : source === "db"
      ? (isArabic ? "مصدر الإدارة: جداول Supabase الحقيقية" : "Admin source: real Supabase tables")
      : (isArabic ? "غير متصل بقاعدة البيانات" : "Not connected to database");

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-brand-sky/20 bg-brand-cool/25 p-5 shadow-2xl shadow-black/25 sm:p-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(245,183,0,0.12),transparent_22rem),radial-gradient(circle_at_86%_18%,rgba(24,168,232,0.14),transparent_24rem)]" />
      <div className="relative z-10 space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-brand-gold">
              <Sparkles className="h-4 w-4" />
              {isArabic ? "قسم العمليات · التجار" : "Operations · Merchants"}
            </span>
            <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
              {isArabic ? "إدارة التجار من قاعدة البيانات الحقيقية" : "Database-backed merchant operations"}
            </h2>
            <p className="mt-2 max-w-4xl text-xs font-bold leading-6 text-white/55">
              {isArabic
                ? "يقرأ هذا القسم merchants و orders مباشرة. إحصائيات كل تاجر تُحسب فقط من الطلبات التي تحمل merchant_id الخاص به؛ لا يتم التخمين بالاسم أو الهاتف حتى لا تظهر أرقام مفتوحة/ملغية غير صحيحة."
                : "This section reads merchants and orders directly. Per-merchant metrics are calculated only from orders carrying that merchant_id; no name/phone guessing is used, so unrelated open/cancelled orders are not counted."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200">
              <Database className="h-4 w-4" />
              {sourceText}
            </span>
            <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {isArabic ? "تحديث" : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4" />{message}</div>}
        {error && <div className="flex items-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-200"><AlertTriangle className="h-4 w-4" />{error}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard icon={<Users className="h-5 w-5" />} label={isArabic ? "إجمالي التجار" : "total merchants"} value={merchants.length} />
          <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label={isArabic ? "نشط" : "active"} value={active} tone="green" />
          <SummaryCard icon={<Target className="h-5 w-5" />} label="VIP" value={vip} />
          <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label={isArabic ? "مراجعة/إيقاف" : "review/paused"} value={review + paused} tone="red" />
          <SummaryCard icon={<BarChart3 className="h-5 w-5" />} label={isArabic ? "طلبات مرتبطة مباشرة" : "direct linked orders"} value={linkedOrdersTotal} tone="blue" />
          <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label={isArabic ? "دخل مباشر" : "direct income"} value={money(linkedDeliveryTotal)} />
        </div>

        <div className="rounded-3xl border border-white/10 bg-brand-deep/65 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-brand-sky/20 bg-black/20 px-4 py-3 text-brand-gold">
              <Search className="h-5 w-5 flex-none" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm font-black text-white outline-none placeholder:text-white/28" placeholder={isArabic ? "اسم، هاتف، كود، مدينة، COD، يحتاج مراجعة..." : "Name, phone, code, city, COD, needs review..."} />
            </div>
            <div className="flex flex-wrap gap-2">{quick.map((item) => <button key={item} type="button" onClick={() => setQuery(item)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white/65 transition hover:border-brand-gold/40 hover:text-brand-gold">{item}</button>)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-3">
            {insights.map((item) => {
              const selectedCard = selected?.merchant.id === item.merchant.id;
              return (
                <button key={item.merchant.id} type="button" onClick={() => setSelectedId(item.merchant.id)} className={`group w-full overflow-hidden rounded-3xl border p-4 text-start shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-brand-gold/35 ${selectedCard ? "border-brand-gold/55 bg-gradient-to-br from-brand-gold/[0.12] via-white/[0.045] to-brand-sky/[0.06]" : "border-white/10 bg-white/[0.035]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <p className="truncate text-base font-black text-white">{item.merchant.trade_name}</p>
                      <p className="text-[11px] font-bold text-white/50" dir="ltr">{item.merchant.merchant_code || "NO-CODE"}</p>
                      <div className="flex flex-wrap gap-2 text-[11px] font-bold text-white/50">
                        <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-brand-gold" />{item.merchant.phone || "—"}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-brand-sky" />{item.merchant.city || item.merchant.emirate || "—"}</span>
                      </div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${levelClass(item.level)}`}>{item.level}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-black">
                    <span className="rounded-2xl border border-white/10 bg-black/20 px-2 py-2 text-white/70">{isArabic ? "طلبات مباشرة" : "Direct orders"}<b className="block text-white">{item.orders.length}</b></span>
                    <span className="rounded-2xl border border-white/10 bg-black/20 px-2 py-2 text-white/70">COD<b className="block text-brand-gold">{money(item.codTotal)}</b></span>
                    <span className="rounded-2xl border border-white/10 bg-black/20 px-2 py-2 text-white/70">{isArabic ? "صحة" : "Health"}<b className={`block ${healthClass(item.health)}`}>{item.health}%</b></span>
                  </div>
                </button>
              );
            })}
            {!insights.length && <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.035] p-6 text-center text-sm font-bold text-white/55">{isArabic ? "لا يوجد تجار مطابقون للبحث من قاعدة البيانات." : "No database merchants match this search."}</div>}
          </div>

          <div className="rounded-3xl border border-brand-sky/20 bg-brand-deep/60 p-4 shadow-xl shadow-black/15">
            {selected ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-gold"><Store className="h-4 w-4" />{isArabic ? "ملف تاجر حي" : "Live merchant file"}</span>
                    <h3 className="mt-3 text-2xl font-black text-white">{selected.merchant.trade_name}</h3>
                    <p className="mt-1 text-xs font-bold text-white/50" dir="ltr">{selected.merchant.merchant_code || "NO-CODE"} · {selected.merchant.phone}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${levelClass(selected.level)}`}>{selected.level}</span>
                </div>

                <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm font-bold leading-7 text-white/70">{isArabic ? selected.noteAr : selected.noteEn}</p>

                {!selected.orders.length && (
                  <div className="rounded-2xl border border-brand-sky/20 bg-brand-sky/10 p-4 text-xs font-bold leading-6 text-brand-sky">
                    {isArabic
                      ? "تنبيه دقيق: لا توجد طلبات مرتبطة مباشرة بهذا التاجر عبر merchant_id، لذلك ستظهر كل أرقام الطلبات والتحصيل صفر حتى يتم إنشاء طلب لهذا التاجر من زر إضافة طلب لهذا التاجر."
                      : "Precise note: no orders are directly linked to this merchant by merchant_id, so order and COD metrics remain zero until an order is created for this merchant."}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Metric label={isArabic ? "طلبات مباشرة" : "Direct orders"} value={selected.orders.length} />
                  <Metric label={isArabic ? "مفتوحة مباشرة" : "Direct pending"} value={selected.pending} />
                  <Metric label={isArabic ? "مسلمة مباشرة" : "Direct delivered"} value={selected.delivered} />
                  <Metric label={isArabic ? "ملغية مباشرة" : "Direct cancelled"} value={selected.cancelled} />
                  <Metric label="COD" value={money(selected.codTotal)} />
                  <Metric label={isArabic ? "الدخل" : "Income"} value={money(selected.deliveryTotal)} />
                  <Metric label={isArabic ? "الحالة" : "Status"} value={selected.merchant.status || "active"} />
                  <Metric label={isArabic ? "التسوية" : "Settlement"} value={selected.merchant.settlement_cycle || "weekly"} />
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <InfoTile icon={<Phone className="h-4 w-4" />} label={isArabic ? "الهاتف" : "Phone"} value={selected.merchant.phone || "—"} />
                  <InfoTile icon={<MapPin className="h-4 w-4" />} label={isArabic ? "المدينة / الإمارة" : "City / Emirate"} value={[selected.merchant.city, selected.merchant.emirate].filter(Boolean).join(" · ") || "—"} />
                  <InfoTile icon={<Banknote className="h-4 w-4" />} label={isArabic ? "البنك / IBAN" : "Bank / IBAN"} value={[selected.merchant.bank_name, selected.merchant.iban].filter(Boolean).join(" · ") || "—"} />
                  <InfoTile icon={<ShieldCheck className="h-4 w-4" />} label="TRN" value={selected.merchant.trn || selected.merchant.tax_number || "—"} />
                </div>

                <div className="flex flex-wrap gap-2">
                  {selected.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-white/60">{tag}</span>)}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <button type="button" onClick={() => onCreateOrder()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-gold px-4 py-3 text-xs font-black text-brand-deep transition hover:-translate-y-0.5"><PackagePlus className="h-4 w-4" />{isArabic ? "إضافة طلب لهذا التاجر" : "Create order"}</button>
                  <button type="button" onClick={() => onSearchOrders(selected.merchant.merchant_code || selected.merchant.trade_name)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-sky/25 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky transition hover:-translate-y-0.5"><Eye className="h-4 w-4" />{isArabic ? "فتح طلباته" : "Open orders"}</button>
                  <button type="button" onClick={() => copyCard(selected)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white transition hover:-translate-y-0.5"><Copy className="h-4 w-4" />{isArabic ? "نسخ البطاقة" : "Copy card"}</button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-3 text-xs font-black text-white/60">{isArabic ? "تحكم مباشر في قاعدة البيانات" : "Direct database controls"}</p>
                  <div className="flex flex-wrap gap-2">
                    {statusActions.map((action) => (
                      <button key={action.status} type="button" disabled={loading} onClick={() => void changeStatus(selected.merchant.id, action.status)} className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-2 text-xs font-black text-brand-gold transition hover:-translate-y-0.5 disabled:opacity-60">
                        {isArabic ? action.ar : action.en}
                      </button>
                    ))}
                    <button type="button" disabled={loading} onClick={() => void deleteMerchant(selected)} className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-black text-rose-200 transition hover:-translate-y-0.5 hover:bg-rose-500/15 disabled:opacity-60">
                      <span className="inline-flex items-center gap-2"><Trash2 className="h-4 w-4" />{isArabic ? "حذف التاجر" : "Delete merchant"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.035] p-8 text-center text-sm font-bold text-white/55">{isArabic ? "اختر تاجر من القائمة." : "Select a merchant from the list."}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ icon, label, value, tone = "gold" }: { icon: React.ReactNode; label: string; value: string | number; tone?: "gold" | "green" | "red" | "blue" }) {
  const toneClass = tone === "green" ? "text-emerald-300" : tone === "red" ? "text-rose-300" : tone === "blue" ? "text-brand-sky" : "text-brand-gold";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className={`mb-2 ${toneClass}`}>{icon}</div>
      <p className={`text-xl font-black ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] font-bold text-white/45">{label}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
      <p className="text-[11px] font-bold text-white/45">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 inline-flex items-center gap-2 text-brand-gold">
        {icon}
        <span className="text-[11px] font-black text-white/45">{label}</span>
      </div>
      <p className="break-words text-xs font-black leading-5 text-white/75" dir="auto">{value}</p>
    </div>
  );
}
