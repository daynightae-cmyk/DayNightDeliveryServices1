import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  Globe2,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";
import { supabase } from "../../supabase";
import { useAppContext } from "../../lib/AppContext";
import companyMeta from "../../data/companyMeta";
import type { Merchant, Order } from "../../types";

type SupabaseClient = NonNullable<typeof supabase>;
type MerchantRecord = Merchant & Record<string, any>;
type MerchantOrder = Order & Record<string, any>;
type PortalTab = "overview" | "orders" | "tracking" | "account";

const closedStatuses = new Set(["delivered", "cancelled", "returned", "failed"]);
const activeStatuses = new Set(["pending", "confirmed", "assigned", "accepted", "picked_up", "in_transit", "out_for_delivery"]);

function clean(value?: unknown) {
  return String(value || "").trim();
}

function digits(value?: unknown) {
  return clean(value).replace(/\D/g, "");
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${parsed.toFixed(2)} AED`;
}

function normalizeStatus(value?: unknown) {
  return clean(value).toLowerCase().replace(/[\s-]+/g, "_") || "pending";
}

function statusLabel(status: string, isArabic: boolean) {
  const labels: Record<string, { ar: string; en: string }> = {
    pending: { ar: "بانتظار التأكيد", en: "Pending" },
    confirmed: { ar: "مؤكد", en: "Confirmed" },
    assigned: { ar: "مع المندوب", en: "With driver" },
    accepted: { ar: "قبله المندوب", en: "Accepted" },
    picked_up: { ar: "تم الاستلام", en: "Picked up" },
    in_transit: { ar: "في الطريق", en: "In transit" },
    out_for_delivery: { ar: "خارج للتسليم", en: "Out for delivery" },
    delivered: { ar: "تم التسليم", en: "Delivered" },
    cancelled: { ar: "ملغي", en: "Cancelled" },
    returned: { ar: "راجع", en: "Returned" },
    failed: { ar: "متعثر", en: "Issue" },
  };
  return isArabic ? labels[status]?.ar || status : labels[status]?.en || status;
}

function statusTone(status: string) {
  if (status === "delivered") return "border-emerald-400/35 bg-emerald-400/10 text-emerald-200";
  if (status === "cancelled" || status === "returned" || status === "failed") return "border-rose-400/35 bg-rose-400/10 text-rose-200";
  if (status === "assigned" || status === "accepted" || status === "picked_up" || status === "in_transit" || status === "out_for_delivery") return "border-brand-sky/35 bg-brand-sky/10 text-brand-sky";
  return "border-brand-gold/35 bg-brand-gold/10 text-brand-gold";
}

function formatDate(value: unknown, isArabic: boolean) {
  const raw = clean(value);
  if (!raw) return "—";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw;
  return date.toLocaleString(isArabic ? "ar-AE" : "en-AE", { dateStyle: "medium", timeStyle: "short" });
}

function merchantTitle(merchant?: MerchantRecord | null) {
  return clean(merchant?.trade_name) || clean(merchant?.owner_name) || clean(merchant?.merchant_code) || "DAY NIGHT Merchant";
}

function initials(value: string) {
  const parts = clean(value).split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "DN";
}

function orderReference(order: MerchantOrder) {
  return clean(order.tracking_code) || clean(order.tracking_number) || clean(order.invoice_number) || clean(order.coupon_number) || clean(order.id);
}

function orderAmount(order: MerchantOrder) {
  return order.total_price ?? order.total ?? order.amount ?? order.price ?? order.delivery_price ?? order.subtotal;
}

function orderCod(order: MerchantOrder) {
  return order.cod_amount ?? order.cash_on_delivery ?? order.cod ?? 0;
}

function dedupeRows<T extends Record<string, any>>(rows: T[], fallbackPrefix: string) {
  const seen = new Set<string>();
  const output: T[] = [];
  rows.forEach((row, index) => {
    const key = clean(row.id) || clean(row.merchant_code) || clean(row.tracking_code) || clean(row.tracking_number) || clean(row.invoice_number) || `${fallbackPrefix}-${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(row);
  });
  return output;
}

function userIdentity(user: User) {
  const meta = user.user_metadata || {};
  const email = clean(user.email || meta.email).toLowerCase();
  const phone = clean(user.phone || meta.phone || meta.phone_number || meta.mobile || meta.mobile_number);
  const phoneDigits = digits(phone);
  return { email, phone, phoneDigits };
}

function portalErrorMessage(error: unknown, isArabic: boolean) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/invalid login|credentials|password|email/i.test(raw)) {
    return isArabic ? "بيانات الدخول غير صحيحة." : "The sign-in details are not correct.";
  }
  if (/not_authenticated|jwt|session/i.test(raw)) {
    return isArabic ? "انتهت الجلسة. سجّل الدخول مرة أخرى." : "Your session expired. Please sign in again.";
  }
  if (/phone|sms|otp/i.test(raw)) {
    return isArabic ? "تعذر إكمال تحقق الهاتف حالياً." : "Phone verification is unavailable right now.";
  }
  return isArabic ? "تعذر تحديث البيانات حالياً. حاول مرة أخرى أو تواصل مع الدعم." : "We could not refresh the workspace right now. Please retry or contact support.";
}

async function queryMerchantsBy(client: SupabaseClient, column: string, value: string, mode: "eq" | "ilike" = "eq") {
  if (!value) return { rows: [] as MerchantRecord[], error: "" };
  const query = client.from("merchants").select("*").limit(20);
  const { data, error } = mode === "ilike" ? await query.ilike(column, value) : await query.eq(column, value);
  return { rows: (data || []) as MerchantRecord[], error: error?.message || "" };
}

async function queryOrdersBy(client: SupabaseClient, column: string, value: string, mode: "eq" | "ilike" = "eq") {
  if (!value) return { rows: [] as MerchantOrder[], error: "" };
  const query = client.from("orders").select("*").order("created_at", { ascending: false }).limit(120);
  const { data, error } = mode === "ilike" ? await query.ilike(column, value) : await query.eq(column, value);
  return { rows: (data || []) as MerchantOrder[], error: error?.message || "" };
}

async function directMerchantLookup(client: SupabaseClient, user: User) {
  const identity = userIdentity(user);
  const rows: MerchantRecord[] = [];
  const errors: string[] = [];

  async function collect(column: string, value: string, mode: "eq" | "ilike" = "eq") {
    const result = await queryMerchantsBy(client, column, value, mode);
    rows.push(...result.rows);
    if (result.error) errors.push(result.error);
  }

  if (identity.email) {
    await collect("email", identity.email);
    await collect("email", identity.email, "ilike");
  }

  if (identity.phone) {
    await collect("phone", identity.phone);
    await collect("alt_phone", identity.phone);
  }

  const phoneFragments = Array.from(new Set([
    identity.phoneDigits,
    identity.phoneDigits.slice(-9),
    identity.phoneDigits.slice(-7),
  ].filter((part) => part && part.length >= 7)));

  for (const fragment of phoneFragments) {
    await collect("phone", `%${fragment}%`, "ilike");
    await collect("alt_phone", `%${fragment}%`, "ilike");
  }

  return { rows: dedupeRows(rows, "merchant"), errors: Array.from(new Set(errors)) };
}

async function directOrderLookup(client: SupabaseClient, merchants: MerchantRecord[]) {
  const rows: MerchantOrder[] = [];
  const errors: string[] = [];

  async function collect(column: string, value: string, mode: "eq" | "ilike" = "eq") {
    const result = await queryOrdersBy(client, column, value, mode);
    rows.push(...result.rows);
    if (result.error) errors.push(result.error);
  }

  for (const merchant of merchants) {
    const id = clean(merchant.id);
    const code = clean(merchant.merchant_code);
    const title = merchantTitle(merchant);
    if (id) await collect("merchant_id", id);
    if (code) await collect("merchant_code", code);
    if (title) await collect("merchant_name", title);
    if (title) await collect("merchant_name", `%${title}%`, "ilike");
  }

  return { rows: dedupeRows(rows, "order"), errors: Array.from(new Set(errors)) };
}

function coordinatesFor(order: MerchantOrder) {
  const pairs = [
    ["receiver_lat", "receiver_lng"],
    ["delivery_lat", "delivery_lng"],
    ["dropoff_lat", "dropoff_lng"],
    ["current_lat", "current_lng"],
    ["live_lat", "live_lng"],
    ["lat", "lng"],
  ];

  for (const [latKey, lngKey] of pairs) {
    const lat = Number(order[latKey]);
    const lng = Number(order[lngKey]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }

  return null;
}

export default function MerchantPortal() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [merchants, setMerchants] = useState<MerchantRecord[]>([]);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [tab, setTab] = useState<PortalTab>("overview");

  const redirectTo = useCallback(() => `${window.location.origin}/merchant`, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user || null);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const loadMerchantData = useCallback(async (activeUser: User) => {
    if (!supabase) return;
    setDataLoading(true);
    setDataError("");

    const client = supabase;
    const errors: string[] = [];
    let resolvedMerchants: MerchantRecord[] = [];
    let resolvedOrders: MerchantOrder[] = [];

    try {
      const merchantRpc = await client.rpc("merchant_get_session_profile");
      if (!merchantRpc.error) {
        const payload = merchantRpc.data as any;
        if (Array.isArray(payload?.merchants)) resolvedMerchants = payload.merchants as MerchantRecord[];
      } else {
        errors.push(merchantRpc.error.message);
      }

      if (resolvedMerchants.length) {
        const ordersRpc = await client.rpc("merchant_portal_orders", { p_limit: 120 });
        if (!ordersRpc.error) {
          const payload = ordersRpc.data as any;
          if (Array.isArray(payload?.orders)) resolvedOrders = payload.orders as MerchantOrder[];
        } else {
          errors.push(ordersRpc.error.message);
        }
      }

      if (!resolvedMerchants.length) {
        const directMerchants = await directMerchantLookup(client, activeUser);
        resolvedMerchants = directMerchants.rows;
        errors.push(...directMerchants.errors);
      }

      if (resolvedMerchants.length && !resolvedOrders.length) {
        const directOrders = await directOrderLookup(client, resolvedMerchants);
        resolvedOrders = directOrders.rows;
        errors.push(...directOrders.errors);
      }

      resolvedMerchants = dedupeRows(resolvedMerchants, "merchant");
      resolvedOrders = dedupeRows(resolvedOrders, "order").sort((a, b) => {
        const aTime = new Date(a.created_at || a.updated_at || 0).getTime();
        const bTime = new Date(b.created_at || b.updated_at || 0).getTime();
        return bTime - aTime;
      });

      setMerchants(resolvedMerchants);
      setOrders(resolvedOrders);

      const meaningfulErrors = Array.from(new Set(errors.filter(Boolean))).filter((message) => !/does not exist|schema cache/i.test(message));
      if (!resolvedMerchants.length && meaningfulErrors.length) setDataError(portalErrorMessage(meaningfulErrors[0], isArabic));
      else if (resolvedMerchants.length && !resolvedOrders.length && meaningfulErrors.length) setDataError(portalErrorMessage(meaningfulErrors[0], isArabic));
    } catch (error) {
      setDataError(portalErrorMessage(error, isArabic));
    } finally {
      setDataLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    if (user) void loadMerchantData(user);
    else {
      setMerchants([]);
      setOrders([]);
      setDataError("");
    }
  }, [user, loadMerchantData]);

  useEffect(() => {
    if (!supabase || !user || merchants.length === 0) return;
    const channel = supabase
      .channel(`merchant-portal-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadMerchantData(user))
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [user, merchants.length, loadMerchantData]);

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setAuthError(isArabic ? "الخدمة غير متاحة حالياً." : "The service is unavailable right now.");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) setAuthError(portalErrorMessage(error, isArabic));
    setAuthBusy(false);
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) {
      setAuthError(isArabic ? "تعذر فتح الدخول عبر Google حالياً." : "Google sign-in is unavailable right now.");
      setAuthBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!supabase) return;
    if (!email.trim()) {
      setAuthError(isArabic ? "اكتب بريد التاجر أولاً." : "Enter the merchant email first.");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) setAuthError(portalErrorMessage(error, isArabic));
    else setAuthNotice(isArabic ? "تم إرسال رابط الدخول إلى بريد التاجر." : "A sign-in link was sent to the merchant email.");
    setAuthBusy(false);
  }

  async function sendPhoneOtp() {
    if (!supabase) return;
    if (!phone.trim()) {
      setAuthError(isArabic ? "اكتب رقم هاتف التاجر أولاً." : "Enter the merchant phone first.");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
    if (error) setAuthError(portalErrorMessage(error, isArabic));
    else setAuthNotice(isArabic ? "تم إرسال رمز التحقق إلى الهاتف." : "The verification code was sent to the phone.");
    setAuthBusy(false);
  }

  async function verifyPhoneOtp() {
    if (!supabase) return;
    if (!phone.trim() || !phoneOtp.trim()) {
      setAuthError(isArabic ? "اكتب رقم الهاتف ورمز التحقق." : "Enter the phone number and verification code.");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: phoneOtp.trim(), type: "sms" });
    if (error) setAuthError(portalErrorMessage(error, isArabic));
    setAuthBusy(false);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null);
    setMerchants([]);
    setOrders([]);
  }

  const currentMerchant = merchants[0] || null;
  const currentMerchantName = merchantTitle(currentMerchant);
  const activeOrders = useMemo(() => orders.filter((order) => activeStatuses.has(normalizeStatus(order.status)) || !closedStatuses.has(normalizeStatus(order.status))), [orders]);
  const deliveredOrders = useMemo(() => orders.filter((order) => normalizeStatus(order.status) === "delivered"), [orders]);
  const codTotal = useMemo(() => orders.reduce((sum, order) => sum + toNumber(orderCod(order)), 0), [orders]);
  const revenueTotal = useMemo(() => orders.reduce((sum, order) => sum + toNumber(orderAmount(order)), 0), [orders]);
  const latestOrder = orders[0];
  const mappedOrder = orders.find((order) => coordinatesFor(order));
  const mappedCoords = mappedOrder ? coordinatesFor(mappedOrder) : null;
  const mapSrc = mappedCoords ? `https://maps.google.com/maps?q=${mappedCoords.lat},${mappedCoords.lng}&z=13&output=embed` : "";

  const kpis = [
    { icon: PackageCheck, value: orders.length, label: isArabic ? "كل الطلبات" : "Total orders" },
    { icon: Truck, value: activeOrders.length, label: isArabic ? "قيد التنفيذ" : "In progress" },
    { icon: CheckCircle2, value: deliveredOrders.length, label: isArabic ? "تم تسليمها" : "Delivered" },
    { icon: Banknote, value: money(codTotal), label: isArabic ? "تحصيل نقدي" : "Cash collection" },
  ];

  const quickActions = [
    { href: "/request", icon: PlusCircle, label: isArabic ? "طلب جديد" : "New order" },
    { href: "/tracking", icon: MapPin, label: isArabic ? "تتبع شحنة" : "Track shipment" },
    { href: companyMeta.whatsappUrl, icon: MessageCircle, label: isArabic ? "الدعم" : "Support", external: true },
  ];

  if (authLoading) {
    return (
      <section className="grid min-h-[65vh] place-items-center" dir={isArabic ? "rtl" : "ltr"}>
        <div className="rounded-[2rem] border border-brand-gold/25 bg-[#031226] px-8 py-7 text-center shadow-2xl shadow-black/30">
          <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-brand-gold" />
          <p className="font-black text-white">{isArabic ? "جاري تجهيز بوابة التاجر..." : "Preparing merchant portal..."}</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="space-y-7" dir={isArabic ? "rtl" : "ltr"}>
        <div className="relative overflow-hidden rounded-[2.5rem] border border-brand-gold/25 bg-[#031226] p-6 shadow-2xl shadow-black/35 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(212,166,42,0.22),transparent_23rem),radial-gradient(circle_at_90%_8%,rgba(24,168,232,0.22),transparent_28rem)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:52px_52px] opacity-50" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-16 w-16 rounded-2xl border border-brand-gold/45 bg-white object-contain p-1 shadow-xl shadow-brand-gold/10" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">DAY NIGHT</p>
                  <h1 className="text-3xl font-black text-white sm:text-5xl">{isArabic ? "بوابة التاجر" : "Merchant Portal"}</h1>
                </div>
              </div>
              <p className="max-w-2xl text-sm font-bold leading-8 text-white/65">
                {isArabic
                  ? "مساحة أنيقة لإدارة الطلبات، متابعة التحصيل، ومراقبة مسار الشحنات المرتبطة بحسابك التجاري."
                  : "A refined workspace for orders, collections, and shipment progress linked to your merchant account."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"><Store className="mb-3 h-5 w-5 text-brand-gold" /><strong className="block text-white">{isArabic ? "حساب تجاري" : "Merchant account"}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"><PackageCheck className="mb-3 h-5 w-5 text-brand-sky" /><strong className="block text-white">{isArabic ? "طلبياتك" : "Your orders"}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"><ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" /><strong className="block text-white">{isArabic ? "دخول آمن" : "Secure access"}</strong></div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-brand-sky/10 backdrop-blur-xl">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gold text-brand-deep shadow-lg shadow-brand-gold/20"><Building2 className="h-6 w-6" /></span>
                <div>
                  <h2 className="text-xl font-black text-white">{isArabic ? "دخول التاجر" : "Merchant sign in"}</h2>
                  <p className="text-xs font-bold text-white/55">{isArabic ? "استخدم بريدك أو هاتفك المسجل لدى الشركة." : "Use your registered merchant email or phone."}</p>
                </div>
              </div>

              <form onSubmit={signInWithPassword} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-white/75">{isArabic ? "البريد الإلكتروني" : "Email address"}</span>
                  <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#071A33]/80 px-4 py-3 text-sm font-bold text-white outline-none ring-brand-gold/30 focus:ring-4" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-white/75">{isArabic ? "كلمة المرور" : "Password"}</span>
                  <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#071A33]/80 px-4 py-3 text-sm font-bold text-white outline-none ring-brand-gold/30 focus:ring-4" />
                </label>
                <button type="submit" disabled={authBusy || !email.trim() || !password} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-gold px-4 py-3 text-sm font-black text-brand-deep shadow-xl shadow-brand-gold/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                  {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  {isArabic ? "دخول بالبريد" : "Sign in with email"}
                </button>
              </form>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={authBusy} onClick={() => void signInWithGoogle()} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-4 py-3 text-xs font-black text-[#071A33] disabled:opacity-50"><Globe2 className="h-4 w-4" /> Google</button>
                <button type="button" disabled={authBusy} onClick={() => void sendMagicLink()} className="flex items-center justify-center gap-2 rounded-2xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky disabled:opacity-50"><Mail className="h-4 w-4" /> {isArabic ? "رابط بالبريد" : "Email link"}</button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[#071A33]/60 p-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-white/75">{isArabic ? "رقم الهاتف" : "Phone number"}</span>
                  <input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#031226] px-4 py-3 text-sm font-bold text-white outline-none ring-brand-sky/30 focus:ring-4" />
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input type="text" inputMode="numeric" value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value)} aria-label={isArabic ? "رمز الهاتف" : "Phone code"} className="rounded-2xl border border-white/10 bg-[#031226] px-4 py-3 text-sm font-bold text-white outline-none ring-brand-sky/30 focus:ring-4" />
                  <button type="button" disabled={authBusy || !phone.trim()} onClick={() => void sendPhoneOtp()} className="rounded-2xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3 text-xs font-black text-brand-gold disabled:opacity-50"><Phone className="mr-1 inline h-4 w-4" />{isArabic ? "إرسال الرمز" : "Send code"}</button>
                </div>
                <button type="button" disabled={authBusy || !phoneOtp.trim()} onClick={() => void verifyPhoneOtp()} className="mt-2 w-full rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200 disabled:opacity-50">{isArabic ? "تأكيد الرمز" : "Verify code"}</button>
              </div>

              {authError && <p className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-400/10 px-4 py-3 text-xs font-bold text-rose-100">{authError}</p>}
              {authNotice && <p className="mt-4 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-3 text-xs font-bold text-emerald-100">{authNotice}</p>}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (dataLoading && merchants.length === 0) {
    return (
      <section className="grid min-h-[65vh] place-items-center" dir={isArabic ? "rtl" : "ltr"}>
        <div className="rounded-[2rem] border border-brand-gold/25 bg-[#031226] px-8 py-7 text-center shadow-2xl shadow-black/30">
          <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-brand-gold" />
          <p className="font-black text-white">{isArabic ? "جاري تجهيز لوحة التاجر..." : "Preparing merchant dashboard..."}</p>
        </div>
      </section>
    );
  }

  if (!currentMerchant) {
    return (
      <section className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
        <div className="rounded-[2rem] border border-amber-300/30 bg-[#031226] p-7 shadow-2xl shadow-black/30">
          <AlertTriangle className="mb-4 h-10 w-10 text-brand-gold" />
          <h1 className="text-3xl font-black text-white">{isArabic ? "الحساب بانتظار التفعيل" : "Account pending activation"}</h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-white/62">
            {isArabic
              ? "لم نجد ملفاً تجارياً مرتبطاً بهذا الدخول. تواصل مع فريق DAY NIGHT لتفعيل الوصول إلى لوحة التاجر."
              : "We could not find a merchant profile for this sign-in. Contact DAY NIGHT to activate merchant access."}
          </p>
          {dataError && <p className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-400/10 px-4 py-3 text-xs font-bold text-rose-100">{dataError}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadMerchantData(user)} className="inline-flex items-center gap-2 rounded-2xl border border-brand-sky/35 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"><RefreshCw className="h-4 w-4" />{isArabic ? "إعادة الفحص" : "Retry"}</button>
            <a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200"><MessageCircle className="h-4 w-4" />{isArabic ? "تواصل مع الدعم" : "Contact support"}</a>
            <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/75"><LogOut className="h-4 w-4" />{isArabic ? "تسجيل الخروج" : "Sign out"}</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-7" dir={isArabic ? "rtl" : "ltr"}>
      <div className="relative overflow-hidden rounded-[2.5rem] border border-brand-gold/25 bg-[#031226] p-6 shadow-2xl shadow-black/35 sm:p-8 lg:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(212,166,42,0.20),transparent_25rem),radial-gradient(circle_at_92%_12%,rgba(24,168,232,0.20),transparent_28rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:54px_54px] opacity-50" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[1.6rem] border border-brand-gold/45 bg-white/95 shadow-2xl shadow-brand-gold/10">
              {currentMerchant.logo_url ? <img src={currentMerchant.logo_url} alt={currentMerchantName} className="h-full w-full object-contain p-2" /> : <span className="text-2xl font-black text-[#071A33]">{initials(currentMerchantName)}</span>}
            </div>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-gold"><Sparkles className="h-3.5 w-3.5" /> {isArabic ? "لوحة التاجر" : "Merchant dashboard"}</span>
              <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">{currentMerchantName}</h1>
              <p className="mt-2 text-sm font-bold text-white/58">{clean(currentMerchant.merchant_code) || clean(currentMerchant.email) || clean(currentMerchant.phone)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {quickActions.map(({ href, icon: Icon, label, external }) => (
              <a key={label} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/75 hover:border-brand-gold/40 hover:text-brand-gold"><Icon className="h-4 w-4" />{label}</a>
            ))}
            <button type="button" onClick={() => void loadMerchantData(user)} className="inline-flex items-center gap-2 rounded-2xl border border-brand-sky/35 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"><RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} />{isArabic ? "تحديث" : "Refresh"}</button>
            <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/75"><LogOut className="h-4 w-4" />{isArabic ? "خروج" : "Sign out"}</button>
          </div>
        </div>
      </div>

      {dataError && <div className="rounded-2xl border border-rose-400/35 bg-rose-400/10 px-4 py-3 text-xs font-bold text-rose-100">{dataError}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ icon: Icon, value, label }) => (
          <article key={label} className="rounded-[1.6rem] border border-white/10 bg-[#031226] p-5 shadow-xl shadow-black/20">
            <Icon className="mb-4 h-6 w-6 text-brand-gold" />
            <strong className="block text-2xl font-black text-white" dir="ltr">{value}</strong>
            <span className="mt-1 block text-xs font-black text-white/55">{label}</span>
          </article>
        ))}
      </div>

      <nav className="grid gap-2 rounded-[1.6rem] border border-white/10 bg-[#031226] p-2 sm:grid-cols-4">
        {([
          ["overview", isArabic ? "الرئيسية" : "Overview", Store],
          ["orders", isArabic ? "الطلبيات" : "Orders", PackageCheck],
          ["tracking", isArabic ? "الخريطة" : "Map", MapPin],
          ["account", isArabic ? "الحساب" : "Account", Building2],
        ] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black transition ${tab === value ? "bg-brand-gold text-brand-deep" : "text-white/62 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[2rem] border border-white/10 bg-[#031226] p-6 shadow-xl shadow-black/20">
            <header className="mb-5 flex items-center justify-between gap-3">
              <div><p className="text-xs font-black text-brand-gold">{isArabic ? "آخر طلب" : "Latest order"}</p><h2 className="text-2xl font-black text-white">{latestOrder ? orderReference(latestOrder) : isArabic ? "لا توجد طلبيات حالياً" : "No orders yet"}</h2></div>
              <Clock3 className="h-7 w-7 text-brand-sky" />
            </header>
            {latestOrder ? (
              <div className="space-y-3 text-sm font-bold text-white/65">
                <p>{isArabic ? "الحالة" : "Status"}: <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(normalizeStatus(latestOrder.status))}`}>{statusLabel(normalizeStatus(latestOrder.status), isArabic)}</span></p>
                <p>{isArabic ? "من" : "From"}: {clean(latestOrder.sender_city) || "—"}</p>
                <p>{isArabic ? "إلى" : "To"}: {clean(latestOrder.receiver_city) || "—"}</p>
                <p>{isArabic ? "آخر تحديث" : "Last update"}: {formatDate(latestOrder.updated_at || latestOrder.created_at, isArabic)}</p>
                <a href={`/tracking?code=${encodeURIComponent(orderReference(latestOrder))}`} className="inline-flex items-center gap-2 rounded-2xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-2 text-xs font-black text-brand-gold"><MapPin className="h-4 w-4" />{isArabic ? "فتح التتبع" : "Open tracking"}</a>
              </div>
            ) : (
              <p className="text-sm font-bold leading-7 text-white/58">{isArabic ? "عند تسجيل طلبات جديدة ستظهر هنا مباشرة مع حالتها وتفاصيلها." : "New orders will appear here with their status and details."}</p>
            )}
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-[#031226] p-6 shadow-xl shadow-black/20">
            <header className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-black text-brand-gold">{isArabic ? "الملخص المالي" : "Financial summary"}</p><h2 className="text-2xl font-black text-white">{money(revenueTotal)}</h2></div><Banknote className="h-7 w-7 text-brand-gold" /></header>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><span className="text-xs font-bold text-white/50">{isArabic ? "قيمة الطلبات" : "Order value"}</span><strong className="mt-2 block text-xl font-black text-white" dir="ltr">{money(revenueTotal)}</strong></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><span className="text-xs font-bold text-white/50">{isArabic ? "التحصيل" : "Collection"}</span><strong className="mt-2 block text-xl font-black text-white" dir="ltr">{money(codTotal)}</strong></div>
            </div>
          </article>
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-3">
          {orders.length === 0 && <div className="rounded-[2rem] border border-white/10 bg-[#031226] p-8 text-center"><PackageCheck className="mx-auto mb-4 h-9 w-9 text-brand-gold" /><h2 className="text-2xl font-black text-white">{isArabic ? "لا توجد طلبيات حالياً" : "No orders yet"}</h2><p className="mt-2 text-sm font-bold text-white/58">{isArabic ? "أنشئ طلباً جديداً أو تواصل مع فريق العمليات للمساعدة." : "Create a new order or contact operations for assistance."}</p></div>}
          {orders.map((order) => {
            const status = normalizeStatus(order.status);
            const reference = orderReference(order);
            return (
              <article key={reference} className="rounded-[1.6rem] border border-white/10 bg-[#031226] p-5 shadow-xl shadow-black/20">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${statusTone(status)}`}>{statusLabel(status, isArabic)}</span>
                    <h3 className="mt-3 text-xl font-black text-white" dir="ltr">{reference}</h3>
                    <p className="mt-2 text-xs font-bold text-white/55">{formatDate(order.created_at, isArabic)}</p>
                  </div>
                  <div className="grid min-w-[42%] gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"><span className="text-[11px] font-black text-white/45">{isArabic ? "المسار" : "Route"}</span><p className="mt-1 text-xs font-bold text-white/75">{clean(order.sender_city) || "—"} <ArrowRightLeft className="inline h-3 w-3 text-brand-gold" /> {clean(order.receiver_city) || "—"}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"><span className="text-[11px] font-black text-white/45">{isArabic ? "الإجمالي" : "Total"}</span><p className="mt-1 text-sm font-black text-white" dir="ltr">{money(orderAmount(order))}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"><span className="text-[11px] font-black text-white/45">{isArabic ? "المندوب" : "Driver"}</span><p className="mt-1 text-xs font-bold text-white/75">{clean(order.driver_name) || clean(order.assigned_driver_name) || "—"}</p></div>
                  </div>
                </div>
                {reference && <a href={`/tracking?code=${encodeURIComponent(reference)}`} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-2 text-xs font-black text-brand-gold"><MapPin className="h-4 w-4" />{isArabic ? "متابعة الطلب" : "Track order"}</a>}
              </article>
            );
          })}
        </div>
      )}

      {tab === "tracking" && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#031226] shadow-xl shadow-black/20">
            {mapSrc ? <iframe title="Merchant order map" src={mapSrc} className="h-[420px] w-full border-0" loading="lazy" /> : <div className="grid h-[420px] place-items-center p-8 text-center"><MapPin className="mb-4 h-10 w-10 text-brand-gold" /><h2 className="text-2xl font-black text-white">{isArabic ? "الخريطة بانتظار أول موقع" : "Map awaiting first location"}</h2><p className="mt-2 max-w-md text-sm font-bold leading-7 text-white/58">{isArabic ? "ستظهر الخريطة عند توفر موقع تسليم محفوظ للطلب." : "The map appears when an order has a saved delivery location."}</p></div>}
          </article>
          <article className="rounded-[2rem] border border-white/10 bg-[#031226] p-6 shadow-xl shadow-black/20">
            <h2 className="text-2xl font-black text-white">{isArabic ? "طلبيات على الخريطة" : "Orders on map"}</h2>
            <div className="mt-5 space-y-3">
              {orders.filter((order) => coordinatesFor(order)).slice(0, 8).map((order) => (
                <div key={orderReference(order)} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <strong className="block text-sm font-black text-white" dir="ltr">{orderReference(order)}</strong>
                  <span className="mt-1 block text-xs font-bold text-white/55">{clean(order.receiver_city) || clean(order.receiver_address) || "—"}</span>
                </div>
              ))}
              {orders.filter((order) => coordinatesFor(order)).length === 0 && <p className="text-sm font-bold leading-7 text-white/58">{isArabic ? "لا توجد مواقع محفوظة للطلبات حالياً." : "No saved order locations right now."}</p>}
            </div>
          </article>
        </div>
      )}

      {tab === "account" && (
        <article className="rounded-[2rem] border border-white/10 bg-[#031226] p-6 shadow-xl shadow-black/20">
          <h2 className="text-2xl font-black text-white">{isArabic ? "بيانات الحساب" : "Account details"}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [isArabic ? "الكود" : "Code", currentMerchant.merchant_code],
              [isArabic ? "المالك" : "Owner", currentMerchant.owner_name],
              [isArabic ? "البريد" : "Email", currentMerchant.email],
              [isArabic ? "الهاتف" : "Phone", currentMerchant.phone],
              [isArabic ? "الإمارة" : "Emirate", currentMerchant.emirate],
              [isArabic ? "العنوان" : "Address", currentMerchant.pickup_address || currentMerchant.address],
              [isArabic ? "الحالة" : "Status", currentMerchant.status],
              [isArabic ? "دورة التسوية" : "Settlement", currentMerchant.settlement_cycle],
              [isArabic ? "آخر تحديث" : "Updated", formatDate(currentMerchant.updated_at || currentMerchant.created_at, isArabic)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <span className="text-[11px] font-black text-white/45">{label}</span>
                <p className="mt-2 break-words text-sm font-bold text-white/80">{clean(value) || "—"}</p>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}
