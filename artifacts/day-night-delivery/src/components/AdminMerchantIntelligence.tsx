import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Copy, Eye, RefreshCw, Search, Sparkles, Store, Target, TrendingUp, Users } from "lucide-react";
import { fetchAllOrders } from "../supabase";
import { fetchMerchants } from "../lib/adminData";
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

function clean(value: unknown) { return String(value ?? "").trim(); }
function norm(value: unknown) {
  return clean(value).toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}
function digits(value: unknown) { return clean(value).replace(/\D/g, ""); }
function money(value: number) { return `${value.toFixed(2)} AED`; }
function statusText(value?: string) { return norm(value).replace(/[_-]/g, " "); }
function statusHas(order: Order, words: string[]) { const s = statusText(order.status); return words.some((word) => s.includes(word)); }
function common(values: string[]) {
  const map = new Map<string, number>();
  values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) || 0) + 1));
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
}
function belongs(merchant: Merchant, order: Order) {
  const name = norm(merchant.trade_name);
  const orderName = norm(order.merchant_name || order.sender_name);
  const code = norm(merchant.merchant_code);
  const orderCode = norm(order.merchant_code);
  const phone = digits(merchant.phone).slice(-7);
  const orderPhones = `${digits(order.sender_phone)} ${digits(order.customer_phone)}`;
  return Boolean(
    (merchant.id && order.merchant_id === merchant.id) ||
    (code && orderCode && code === orderCode) ||
    (name && orderName && (orderName.includes(name) || name.includes(orderName))) ||
    (phone && orderPhones.includes(phone))
  );
}
function levelClass(level: Insight["level"]) {
  if (level === "vip") return "border-brand-gold/40 bg-brand-gold/10 text-brand-gold";
  if (level === "review") return "border-rose-400/35 bg-rose-500/10 text-rose-200";
  if (level === "new") return "border-brand-sky/35 bg-brand-blue/10 text-brand-sky";
  return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
}
function buildInsight(merchant: Merchant, allOrders: Order[], query: string): Insight {
  const orders = allOrders.filter((order) => belongs(merchant, order));
  const delivered = orders.filter((order) => statusHas(order, ["delivered", "تم التسليم"])).length;
  const cancelled = orders.filter((order) => statusHas(order, ["cancel", "fail", "ملغي", "فشل"])).length;
  const pending = Math.max(0, orders.length - delivered - cancelled);
  const codTotal = orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
  const deliveryTotal = orders.reduce((sum, order) => sum + Number(order.delivery_price || order.price || 0), 0);
  const fields = [merchant.trade_name, merchant.owner_name, merchant.phone, merchant.email, merchant.city, merchant.address, merchant.pickup_address, merchant.license_number, merchant.trn || merchant.tax_number];
  const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  const deliveryRate = orders.length ? Math.round((delivered / orders.length) * 100) : 0;
  const cancelRate = orders.length ? Math.round((cancelled / orders.length) * 100) : 0;
  const health = Math.max(0, Math.min(100, Math.round(completeness * 0.35 + deliveryRate * 0.45 + Math.min(orders.length * 4, 20) - cancelRate * 0.45)));
  const topCity = common(orders.map((order) => order.receiver_city || order.sender_city || "").concat([merchant.city || merchant.emirate || ""]));
  const tags = Array.from(new Set([merchant.status || "active", merchant.city, merchant.emirate, codTotal > 0 ? "COD" : "", orders.length ? "قيد التشغيل" : "بدون طلبات", health >= 80 ? "VIP" : "", cancelRate >= 20 ? "يحتاج مراجعة" : ""].filter(Boolean) as string[])).slice(0, 7);
  const haystack = norm([merchant.trade_name, merchant.owner_name, merchant.merchant_code, merchant.phone, merchant.alt_phone, merchant.email, merchant.city, merchant.emirate, merchant.status, tags.join(" "), orders.map((order) => [order.coupon_number, order.receiver_name, order.receiver_phone, order.receiver_city, order.status, order.package_type].join(" ")).join(" ")].join(" "));
  const q = norm(query);
  const qDigits = digits(query).slice(-7);
  let score = Math.min(orders.length * 4, 35) + Math.round(health / 8) + (orders.length ? 8 : 0);
  if (q) {
    score = q.split(" ").filter(Boolean).reduce((sum, token) => sum + (norm(merchant.trade_name).startsWith(token) ? 50 : 0) + (norm(merchant.trade_name).includes(token) ? 35 : 0) + (norm(merchant.merchant_code).includes(token) ? 30 : 0) + (haystack.includes(token) ? 12 : 0), 0);
    if (qDigits && [merchant.phone, merchant.alt_phone].some((value) => digits(value).includes(qDigits))) score += 65;
    score += Math.min(orders.length * 2, 18) + Math.round(health / 12);
  }
  let level: Insight["level"] = "good";
  let noteAr = "تاجر مستقر. راجع الطلبات المفتوحة قبل نهاية اليوم وحافظ على متابعة أسبوعية.";
  let noteEn = "Stable merchant. Review open orders before end of day and keep weekly follow-up.";
  if (!orders.length) { level = "new"; noteAr = "تاجر جديد بدون طلبيات. جهّز أول كوبونات تشغيل وتواصل معه لتفعيل الحساب."; noteEn = "New merchant with no orders. Prepare first coupon orders and activate the account."; }
  else if (health >= 82 || deliveryTotal >= 500 || orders.length >= 10) { level = "vip"; noteAr = "تاجر عالي القيمة. رشحه لأولوية الاستلام وكشف أسبوعي سريع."; noteEn = "High-value merchant. Give pickup priority and fast weekly statements."; }
  else if (cancelRate >= 20 || norm(merchant.status).includes("review") || norm(merchant.status).includes("paused")) { level = "review"; noteAr = "يحتاج مراجعة تشغيلية. افحص العناوين والأرقام وأسباب الإلغاء والتحصيل."; noteEn = "Needs operational review. Check addresses, phones, cancellation reasons, and COD."; }
  return { merchant, orders, score, health, delivered, pending, cancelled, codTotal, deliveryTotal, topCity, level, tags, noteAr, noteEn };
}

export default function AdminMerchantIntelligence({ isArabic, onSearchOrders, onCreateOrder }: { isArabic: boolean; onSearchOrders: (term: string) => void; onCreateOrder: () => void; }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  async function refresh() {
    setLoading(true);
    try { const [nextOrders, nextMerchants] = await Promise.all([fetchAllOrders(), fetchMerchants()]); setOrders(nextOrders); setMerchants(nextMerchants); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  const insights = useMemo(() => merchants.map((merchant) => buildInsight(merchant, orders, query)).filter((item) => !query.trim() || item.score > 0).sort((a, b) => b.score - a.score || b.orders.length - a.orders.length).slice(0, 12), [merchants, orders, query]);
  const selected = insights.find((item) => item.merchant.id === selectedId) || insights[0] || null;
  const vip = insights.filter((item) => item.level === "vip").length;
  const review = insights.filter((item) => item.level === "review").length;
  const quick = isArabic ? quickAr : quickEn;
  function copyCard(item: Insight) {
    navigator.clipboard?.writeText(["DAY NIGHT MERCHANT", item.merchant.trade_name, item.merchant.merchant_code || "", item.merchant.phone, item.merchant.city || item.merchant.emirate || "", `Orders: ${item.orders.length}`, `Health: ${item.health}%`, `COD: ${money(item.codTotal)}`].join("\n"));
  }
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-brand-sky/20 bg-brand-cool/25 p-5 shadow-2xl shadow-black/25 sm:p-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_12%_10%,rgba(245,183,0,0.13),transparent_22rem),radial-gradient(circle_at_86%_18%,rgba(24,168,232,0.16),transparent_24rem)]" />
      <div className="relative z-10 space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-brand-gold"><Sparkles className="h-4 w-4" /> {isArabic ? "ذكاء التجار التشغيلي" : "Merchant intelligence"}</span><h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">{isArabic ? "بحث ذكي عن التجار بقوة البيانات الحقيقية" : "Smart merchant search powered by live data"}</h2><p className="mt-2 max-w-3xl text-xs font-bold leading-6 text-white/50">{isArabic ? "يحلل التجار والطلبات الحقيقية ويظهر القوة، المخاطر، COD، المدن، والاقتراح التشغيلي." : "Analyzes live merchants and orders to show strength, risk, COD, cities, and next action."}</p></div><button type="button" onClick={refresh} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:bg-white/10"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {isArabic ? "تحديث" : "Refresh"}</button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><Users className="mb-2 h-5 w-5 text-brand-gold" /><p className="text-2xl font-black text-white">{merchants.length}</p><p className="text-[11px] font-bold text-white/45">{isArabic ? "تاجر" : "merchants"}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><Target className="mb-2 h-5 w-5 text-brand-gold" /><p className="text-2xl font-black text-brand-gold">{vip}</p><p className="text-[11px] font-bold text-white/45">VIP</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><AlertTriangle className="mb-2 h-5 w-5 text-rose-300" /><p className="text-2xl font-black text-rose-300">{review}</p><p className="text-[11px] font-bold text-white/45">{isArabic ? "مراجعة" : "review"}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><BarChart3 className="mb-2 h-5 w-5 text-brand-sky" /><p className="text-2xl font-black text-brand-sky">{orders.length}</p><p className="text-[11px] font-bold text-white/45">{isArabic ? "طلب" : "orders"}</p></div></div>
        <div className="rounded-3xl border border-white/10 bg-brand-deep/65 p-3 sm:p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-brand-sky/20 bg-black/20 px-4 py-3 text-brand-gold"><Search className="h-5 w-5 flex-none" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm font-black text-white outline-none placeholder:text-white/28" placeholder={isArabic ? "اسم، هاتف، كود، مدينة، COD، يحتاج مراجعة..." : "Name, phone, code, city, COD, needs review..."} /></div><div className="flex flex-wrap gap-2">{quick.map((item) => <button key={item} type="button" onClick={() => setQuery(item)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white/65 hover:border-brand-gold/40 hover:text-brand-gold">{item}</button>)}</div></div></div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]"><div className="space-y-3">{insights.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm font-bold text-white/55">{isArabic ? "لا يوجد تاجر مطابق." : "No matching merchant."}</div>}{insights.slice(0, 8).map((item) => <button key={item.merchant.id} type="button" onClick={() => setSelectedId(item.merchant.id)} className={`w-full rounded-2xl border p-4 text-start transition-all hover:-translate-y-0.5 ${selected?.merchant.id === item.merchant.id ? "border-brand-gold/45 bg-brand-gold/10" : "border-white/10 bg-white/[0.04] hover:border-brand-sky/25"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-white">{item.merchant.trade_name}</p><p className="mt-1 font-mono text-[11px] text-white/45" dir="ltr">{item.merchant.phone} • {item.merchant.merchant_code || "NO-CODE"}</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${levelClass(item.level)}`}>{item.health}%</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><span className="rounded-xl bg-black/18 p-2"><b className="block text-brand-gold">{item.orders.length}</b><small className="text-white/38">{isArabic ? "طلبات" : "orders"}</small></span><span className="rounded-xl bg-black/18 p-2"><b className="block text-emerald-300">{item.delivered}</b><small className="text-white/38">{isArabic ? "مسلم" : "done"}</small></span><span className="rounded-xl bg-black/18 p-2"><b className="block text-brand-sky">{item.topCity}</b><small className="text-white/38">{isArabic ? "مدينة" : "city"}</small></span></div></button>)}</div>{selected && <article className="rounded-[1.6rem] border border-brand-gold/20 bg-gradient-to-br from-white/[0.07] to-white/[0.025] p-5 shadow-xl shadow-black/20"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-brand-gold/30 bg-brand-gold/10 text-brand-gold"><Store className="h-6 w-6" /></span><div><h3 className="text-2xl font-black text-white">{selected.merchant.trade_name}</h3><p className="font-mono text-xs text-white/45" dir="ltr">{selected.merchant.merchant_code || "—"}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{selected.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-white/58">{tag}</span>)}</div></div><div className={`rounded-2xl border px-4 py-3 text-center ${levelClass(selected.level)}`}><p className="text-[11px] font-black">{isArabic ? "مؤشر" : "Score"}</p><p className="text-3xl font-black">{selected.health}%</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-black/18 p-3"><p className="text-xl font-black text-white">{selected.orders.length}</p><p className="text-[11px] font-bold text-white/42">{isArabic ? "طلبات" : "orders"}</p></div><div className="rounded-2xl border border-white/10 bg-black/18 p-3"><TrendingUp className="mb-2 h-4 w-4 text-emerald-300" /><p className="text-xl font-black text-emerald-300">{selected.delivered}</p><p className="text-[11px] font-bold text-white/42">{isArabic ? "تم التسليم" : "delivered"}</p></div><div className="rounded-2xl border border-white/10 bg-black/18 p-3"><p className="text-xl font-black text-brand-sky">{money(selected.deliveryTotal)}</p><p className="text-[11px] font-bold text-white/42">{isArabic ? "رسوم" : "fees"}</p></div><div className="rounded-2xl border border-white/10 bg-black/18 p-3"><p className="text-xl font-black text-brand-gold">{money(selected.codTotal)}</p><p className="text-[11px] font-bold text-white/42">COD</p></div></div><div className="mt-5 rounded-2xl border border-brand-sky/15 bg-brand-blue/10 p-4"><p className="flex items-center gap-2 text-sm font-black text-white"><Sparkles className="h-4 w-4 text-brand-gold" /> {isArabic ? "اقتراح تشغيلي" : "Next action"}</p><p className="mt-2 text-sm font-bold leading-7 text-white/62">{isArabic ? selected.noteAr : selected.noteEn}</p></div><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3"><button type="button" onClick={() => onSearchOrders(selected.merchant.trade_name)} className="rounded-2xl border border-brand-gold/25 bg-brand-gold/12 px-4 py-3 text-xs font-black text-brand-gold hover:bg-brand-gold/20"><Eye className="mx-auto mb-1 h-4 w-4" />{isArabic ? "عرض طلباته" : "View orders"}</button><button type="button" onClick={() => { onCreateOrder(); navigator.clipboard?.writeText(selected.merchant.trade_name); }} className="rounded-2xl border border-brand-sky/25 bg-brand-blue/12 px-4 py-3 text-xs font-black text-brand-sky hover:bg-brand-blue/20"><CheckCircle2 className="mx-auto mb-1 h-4 w-4" />{isArabic ? "طلبية جديدة" : "New order"}</button><button type="button" onClick={() => copyCard(selected)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/70 hover:text-white"><Copy className="mx-auto mb-1 h-4 w-4" />{isArabic ? "نسخ البطاقة" : "Copy card"}</button></div></article>}</div>
      </div>
    </section>
  );
}
