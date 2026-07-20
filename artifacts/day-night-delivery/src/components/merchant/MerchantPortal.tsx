import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  Building2,
  Camera,
  CheckCircle2,
  FileText,
  Globe2,
  Home,
  Image as ImageIcon,
  ListFilter,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  PackageCheck,
  Pencil,
  Phone,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { supabase } from "../../supabase";
import { useAppContext } from "../../lib/AppContext";
import companyMeta from "../../data/companyMeta";
import { UAE_LOCATIONS, getAreasForEmirate } from "../../data/uaeLocations";
import type { Merchant, Order } from "../../types";
import TrackingMap from "../tracking/TrackingMap";
import "../../styles/dn-merchant-figma.css";

type SupabaseClient = NonNullable<typeof supabase>;
type MerchantRecord = Merchant & Record<string, any>;
type MerchantOrder = Order & Record<string, any>;
type PortalTab = "overview" | "services" | "orders" | "finance" | "tracking" | "account";

type MerchantProfileForm = {
  trade_name: string;
  owner_name: string;
  phone: string;
  alt_phone: string;
  emirate: string;
  city: string;
  address: string;
  pickup_address: string;
  logo_url: string;
  license_number: string;
  trn: string;
  notes: string;
};

const closedStatuses = new Set(["delivered", "cancelled", "returned", "failed"]);
const activeStatuses = new Set(["pending", "confirmed", "assigned", "accepted", "picked_up", "in_transit", "out_for_delivery"]);

const emptyProfile: MerchantProfileForm = {
  trade_name: "",
  owner_name: "",
  phone: "",
  alt_phone: "",
  emirate: "Abu Dhabi",
  city: "Mussafah",
  address: "",
  pickup_address: "",
  logo_url: "",
  license_number: "",
  trn: "",
  notes: "",
};

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
    out_for_delivery: { ar: "خرج للتسليم", en: "Out for delivery" },
    delivered: { ar: "تم التسليم", en: "Delivered" },
    cancelled: { ar: "ملغي", en: "Cancelled" },
    returned: { ar: "مرتجع", en: "Returned" },
    failed: { ar: "متعثر", en: "Issue" },
  };
  return isArabic ? labels[status]?.ar || status : labels[status]?.en || status;
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
  return order.total_price ?? order.total ?? order.total_amount ?? order.amount ?? order.price ?? order.delivery_price ?? order.subtotal ?? 0;
}

function orderCod(order: MerchantOrder) {
  return order.cod_amount ?? order.cash_on_delivery ?? order.cod ?? 0;
}

function orderMerchantDue(order: MerchantOrder) {
  return order.merchant_due ?? order.merchant_net ?? order.net_due ?? 0;
}

function orderCollected(order: MerchantOrder) {
  const explicitAmount = order.collected_amount;
  if (explicitAmount !== null && explicitAmount !== undefined) return explicitAmount;
  const status = normalizeStatus(order.status);
  const isFinanciallyPosted = Boolean(order.financial_posted_at || order.settlement_id || order.settled_at || order.cod_collected_at);
  return status === "delivered" || isFinanciallyPosted ? orderCod(order) : 0;
}

function progressIndex(value?: unknown) {
  const status = normalizeStatus(value);
  if (status === "delivered") return 4;
  if (["in_transit", "out_for_delivery"].includes(status)) return 3;
  if (status === "picked_up") return 2;
  if (["accepted", "assigned"].includes(status)) return 1;
  return 0;
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
  return { email, phone, phoneDigits: digits(phone) };
}

function profileFromMerchant(merchant?: MerchantRecord | null): MerchantProfileForm {
  if (!merchant) return emptyProfile;
  return {
    trade_name: clean(merchant.trade_name),
    owner_name: clean(merchant.owner_name),
    phone: clean(merchant.phone),
    alt_phone: clean(merchant.alt_phone),
    emirate: clean(merchant.emirate) || "Abu Dhabi",
    city: clean(merchant.city) || "Mussafah",
    address: clean(merchant.address),
    pickup_address: clean(merchant.pickup_address),
    logo_url: clean(merchant.logo_url),
    license_number: clean(merchant.license_number),
    trn: clean(merchant.trn || merchant.tax_number),
    notes: clean(merchant.notes),
  };
}

function portalErrorMessage(error: unknown, isArabic: boolean) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/invalid login|credentials|password|email/i.test(raw)) return isArabic ? "بيانات الدخول غير صحيحة." : "The sign-in details are not correct.";
  if (/not_authenticated|jwt|session/i.test(raw)) return isArabic ? "انتهت الجلسة. سجّل الدخول مرة أخرى." : "Your session expired. Please sign in again.";
  if (/merchant_profile_not_found|merchant_record_missing/i.test(raw)) return isArabic ? "لم يتم العثور على ملف التاجر المرتبط بهذا الحساب." : "No merchant profile is linked to this account.";
  if (/invalid_logo_url/i.test(raw)) return isArabic ? "رابط الشعار يجب أن يبدأ بـ https:// أو يُترك فارغًا." : "The logo URL must start with https:// or remain empty.";
  if (/phone|sms|otp/i.test(raw)) return isArabic ? "تعذر إكمال تحقق الهاتف حالياً." : "Phone verification is unavailable right now.";
  return isArabic ? "تعذر تحديث البيانات حالياً. حاول مرة أخرى أو تواصل مع الدعم." : "We could not update the data right now. Please retry or contact support.";
}

async function queryMerchantsBy(client: SupabaseClient, column: string, value: string, mode: "eq" | "ilike" = "eq") {
  if (!value) return { rows: [] as MerchantRecord[], error: "" };
  const query = client.from("merchants").select("*").limit(20);
  const { data, error } = mode === "ilike" ? await query.ilike(column, value) : await query.eq(column, value);
  return { rows: (data || []) as MerchantRecord[], error: error?.message || "" };
}

async function queryOrdersBy(client: SupabaseClient, column: string, value: string, mode: "eq" | "ilike" = "eq") {
  if (!value) return { rows: [] as MerchantOrder[], error: "" };
  const query = client.from("orders").select("*").order("created_at", { ascending: false }).limit(180);
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

  const fragments = Array.from(new Set([identity.phoneDigits, identity.phoneDigits.slice(-9), identity.phoneDigits.slice(-7)].filter((part) => part && part.length >= 7)));
  for (const fragment of fragments) {
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
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [selectedTrackingReference, setSelectedTrackingReference] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<MerchantProfileForm>(emptyProfile);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");

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
      let merchantRpc = await client.rpc("merchant_get_session_profile");
      if (!merchantRpc.error) {
        const payload = merchantRpc.data as any;
        if (Array.isArray(payload?.merchants)) resolvedMerchants = payload.merchants as MerchantRecord[];
      } else errors.push(merchantRpc.error.message);

      if (!resolvedMerchants.length) {
        const claim = await client.rpc("merchant_claim_approved_account");
        if (!claim.error) {
          merchantRpc = await client.rpc("merchant_get_session_profile");
          const payload = merchantRpc.data as any;
          if (!merchantRpc.error && Array.isArray(payload?.merchants)) resolvedMerchants = payload.merchants as MerchantRecord[];
        } else if (!/merchant_account_not_approved/i.test(claim.error.message)) errors.push(claim.error.message);
      }

      if (resolvedMerchants.length) {
        const ordersRpc = await client.rpc("merchant_portal_orders", { p_limit: 180 });
        if (!ordersRpc.error) {
          const payload = ordersRpc.data as any;
          if (Array.isArray(payload?.orders)) resolvedOrders = payload.orders as MerchantOrder[];
        } else errors.push(ordersRpc.error.message);
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
      resolvedOrders = dedupeRows(resolvedOrders, "order").sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime());
      setMerchants(resolvedMerchants);
      setOrders(resolvedOrders);

      const meaningfulErrors = Array.from(new Set(errors.filter(Boolean))).filter((message) => !/does not exist|schema cache/i.test(message));
      if ((!resolvedMerchants.length || (resolvedMerchants.length && !resolvedOrders.length)) && meaningfulErrors.length) setDataError(portalErrorMessage(meaningfulErrors[0], isArabic));
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
      setEditingProfile(false);
    }
  }, [user, loadMerchantData]);

  useEffect(() => {
    if (!supabase || !user || merchants.length === 0) return;
    const channel = supabase
      .channel(`merchant-portal-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadMerchantData(user))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "merchants" }, () => void loadMerchantData(user))
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
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
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: redirectTo() } });
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
    setEditingProfile(false);
  }

  const currentMerchant = merchants[0] || null;
  const currentMerchantName = merchantTitle(currentMerchant);

  useEffect(() => {
    if (!currentMerchant || editingProfile) return;
    setProfileForm(profileFromMerchant(currentMerchant));
  }, [currentMerchant, editingProfile]);

  function beginProfileEdit() {
    setProfileForm(profileFromMerchant(currentMerchant));
    setProfileError("");
    setProfileNotice("");
    setEditingProfile(true);
    setTab("account");
  }

  function cancelProfileEdit() {
    setProfileForm(profileFromMerchant(currentMerchant));
    setProfileError("");
    setEditingProfile(false);
  }

  function updateProfileField<K extends keyof MerchantProfileForm>(key: K, value: MerchantProfileForm[K]) {
    setProfileForm((current) => ({ ...current, [key]: value }));
  }

  async function saveMerchantProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !currentMerchant) return;
    const tradeName = clean(profileForm.trade_name);
    const merchantPhone = clean(profileForm.phone);
    if (!tradeName || !merchantPhone) {
      setProfileError(isArabic ? "اسم النشاط ورقم الهاتف حقول إلزامية." : "Business name and phone are required.");
      return;
    }
    if (profileForm.logo_url && !/^https:\/\//i.test(profileForm.logo_url)) {
      setProfileError(isArabic ? "رابط الشعار يجب أن يبدأ بـ https:// أو يُترك فارغًا." : "Logo URL must start with https:// or remain empty.");
      return;
    }
    setProfileSaving(true);
    setProfileError("");
    setProfileNotice("");
    try {
      const { data, error } = await supabase.rpc("merchant_update_own_profile", { p_updates: { ...profileForm, trade_name: tradeName, phone: merchantPhone } });
      if (error) throw error;
      const payload = data as any;
      const updatedMerchant = payload?.merchant as MerchantRecord | undefined;
      if (updatedMerchant?.id) {
        setMerchants((rows) => [updatedMerchant, ...rows.filter((row) => clean(row.id) !== clean(updatedMerchant.id))]);
        setProfileForm(profileFromMerchant(updatedMerchant));
      } else await loadMerchantData(user);
      setProfileNotice(isArabic ? "تم حفظ بيانات التاجر بنجاح." : "Merchant details were saved successfully.");
      setEditingProfile(false);
    } catch (error) {
      setProfileError(portalErrorMessage(error, isArabic));
    } finally {
      setProfileSaving(false);
    }
  }

  const activeOrders = useMemo(() => orders.filter((order) => activeStatuses.has(normalizeStatus(order.status)) || !closedStatuses.has(normalizeStatus(order.status))), [orders]);
  const deliveredOrders = useMemo(() => orders.filter((order) => normalizeStatus(order.status) === "delivered"), [orders]);
  const codTotal = useMemo(() => orders.reduce((sum, order) => sum + toNumber(orderCod(order)), 0), [orders]);
  const collectedTotal = useMemo(() => orders.reduce((sum, order) => sum + toNumber(orderCollected(order)), 0), [orders]);
  const merchantDueTotal = useMemo(() => orders.reduce((sum, order) => sum + toNumber(orderMerchantDue(order)), 0), [orders]);
  const revenueTotal = useMemo(() => orders.reduce((sum, order) => sum + toNumber(orderAmount(order)), 0), [orders]);
  const deliveredValue = useMemo(() => deliveredOrders.reduce((sum, order) => sum + toNumber(orderAmount(order)), 0), [deliveredOrders]);
  const activeCod = useMemo(() => activeOrders.reduce((sum, order) => sum + toNumber(orderCod(order)), 0), [activeOrders]);
  const latestOrder = orders[0];
  const mapOrder = activeOrders.find((order) => orderReference(order) === selectedTrackingReference) || activeOrders[0] || latestOrder || null;
  const profileAreas = getAreasForEmirate(profileForm.emirate);

  const filteredOrders = useMemo(() => {
    const query = clean(orderSearch).toLowerCase();
    return orders.filter((order) => {
      const status = normalizeStatus(order.status);
      if (orderStatusFilter !== "all" && status !== orderStatusFilter) return false;
      if (!query) return true;
      return [orderReference(order), order.sender_name, order.receiver_name, order.sender_city, order.receiver_city, order.driver_name]
        .some((value) => clean(value).toLowerCase().includes(query));
    });
  }, [orders, orderSearch, orderStatusFilter]);

  const timeline = [
    { ar: "تم إنشاء الطلب", en: "Order created" },
    { ar: "تم الإسناد", en: "Assigned" },
    { ar: "تم الاستلام", en: "Picked up" },
    { ar: "في الطريق", en: "In transit" },
    { ar: "تم التسليم", en: "Delivered" },
  ];

  const services = [
    { key: "new", icon: PlusCircle, title: isArabic ? "إنشاء طلب توصيل" : "Create delivery order", text: isArabic ? "سجّل طلباً محلياً أو دولياً ببيانات العميل والشحنة." : "Create a local or international order with customer and parcel details.", href: "/request?source=merchant", tone: "gold" },
    { key: "coupon", icon: Camera, title: isArabic ? "إدخال الكوبون بالتصوير" : "Coupon photo intake", text: isArabic ? "افتح كاميرا الكوبون لالتقاط البيانات ومراجعتها قبل الحفظ." : "Open the coupon camera, extract details, and review before saving.", href: "/request?source=merchant&mode=coupon", tone: "blue" },
    { key: "orders", icon: PackageCheck, title: isArabic ? "إدارة الطلبيات" : "Order management", text: isArabic ? "تابع كل الطلبات والحالات والمندوب والمسار من مكان واحد." : "Review every order, status, driver, and route in one place.", tab: "orders" as PortalTab, tone: "navy" },
    { key: "tracking", icon: MapPin, title: isArabic ? "التتبع المباشر" : "Live tracking", text: isArabic ? "راقب المندوب والمسار والتحديثات الحية على الخريطة." : "Monitor the courier, route, and realtime updates on the map.", tab: "tracking" as PortalTab, tone: "blue" },
    { key: "finance", icon: WalletCards, title: isArabic ? "التحصيل والتسويات" : "COD & settlements", text: isArabic ? "راجع مبالغ COD، المستحقات، الطلبات المسلمة ودورة التسوية." : "Review COD, merchant due, delivered value, and settlement cycle.", tab: "finance" as PortalTab, tone: "gold" },
    { key: "profile", icon: Store, title: isArabic ? "هوية المتجر" : "Store identity", text: isArabic ? "حدّث الشعار والعنوان وبيانات النشاط ونقطة الاستلام." : "Update logo, address, business details, and pickup point.", tab: "account" as PortalTab, tone: "navy" },
    { key: "support", icon: MessageCircle, title: isArabic ? "دعم العمليات 24/7" : "24/7 operations support", text: isArabic ? "اتصل بفريق DAY NIGHT أو افتح واتساب مباشرة." : "Call DAY NIGHT operations or open WhatsApp immediately.", href: companyMeta.whatsappUrl, external: true, tone: "green" },
  ];

  if (authLoading) {
    return <section className="dn-merchant-state-v3" dir={isArabic ? "rtl" : "ltr"}><Loader2 className="dn-spin" /><strong>{isArabic ? "جاري تجهيز بوابة التاجر..." : "Preparing merchant portal..."}</strong></section>;
  }

  if (!user) {
    return (
      <section className="dn-merchant-login-v3" dir={isArabic ? "rtl" : "ltr"}>
        <div className="dn-merchant-login-visual-v3">
          <div className="dn-merchant-login-brand-v3">
            <img src={companyMeta.logoUrl} onError={(event) => { event.currentTarget.src = companyMeta.logoRemoteUrl; }} alt="DAY NIGHT" />
            <div><small>DAY NIGHT DELIVERY SERVICES</small><h1>{isArabic ? "بوابة التاجر الذكية" : "Smart Merchant Portal"}</h1></div>
          </div>
          <p>{isArabic ? "مركز بسيط وحديث لإنشاء الطلبات، تصوير الكوبونات، متابعة الشحنات، إدارة التحصيل، ومراجعة أداء متجرك." : "A clean modern center for orders, coupon capture, live tracking, collections, and store performance."}</p>
          <div className="dn-merchant-login-services-v3">
            <article><PlusCircle /><strong>{isArabic ? "طلبات فورية" : "Instant orders"}</strong></article>
            <article><MapPin /><strong>{isArabic ? "تتبع مباشر" : "Live tracking"}</strong></article>
            <article><WalletCards /><strong>{isArabic ? "تحصيل واضح" : "Clear COD"}</strong></article>
          </div>
          <footer><span>{companyMeta.sloganAr}</span><span>{companyMeta.sloganEn}</span></footer>
        </div>

        <div className="dn-merchant-login-card-v3">
          <header><span><Building2 /></span><div><h2>{isArabic ? "دخول التاجر" : "Merchant sign in"}</h2><p>{isArabic ? "استخدم البريد أو الهاتف المسجل لدى الشركة." : "Use the email or phone registered with DAY NIGHT."}</p></div></header>
          <form onSubmit={signInWithPassword}>
            <label><span>{isArabic ? "البريد الإلكتروني" : "Email address"}</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label><span>{isArabic ? "كلمة المرور" : "Password"}</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <button type="submit" disabled={authBusy || !email.trim() || !password}>{authBusy ? <Loader2 className="dn-spin" /> : <LockKeyhole />}{isArabic ? "دخول آمن" : "Secure sign in"}</button>
          </form>
          <div className="dn-merchant-auth-alternatives-v3">
            <button type="button" disabled={authBusy} onClick={() => void signInWithGoogle()}><Globe2 /> Google</button>
            <button type="button" disabled={authBusy} onClick={() => void sendMagicLink()}><Mail />{isArabic ? "رابط بالبريد" : "Email link"}</button>
          </div>
          <div className="dn-merchant-phone-auth-v3">
            <label><span>{isArabic ? "رقم الهاتف" : "Phone number"}</span><input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} dir="ltr" /></label>
            <div><input type="text" inputMode="numeric" value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value)} placeholder={isArabic ? "رمز التحقق" : "Verification code"} dir="ltr" /><button type="button" disabled={authBusy || !phone.trim()} onClick={() => void sendPhoneOtp()}><Phone />{isArabic ? "إرسال" : "Send"}</button></div>
            <button type="button" disabled={authBusy || !phoneOtp.trim()} onClick={() => void verifyPhoneOtp()}>{isArabic ? "تأكيد رمز الهاتف" : "Verify phone code"}</button>
          </div>
          {authError && <p className="dn-merchant-message-v3 is-error">{authError}</p>}
          {authNotice && <p className="dn-merchant-message-v3 is-success">{authNotice}</p>}
        </div>
      </section>
    );
  }

  if (dataLoading && merchants.length === 0) {
    return <section className="dn-merchant-state-v3" dir={isArabic ? "rtl" : "ltr"}><Loader2 className="dn-spin" /><strong>{isArabic ? "جاري تجهيز لوحة التاجر..." : "Preparing merchant dashboard..."}</strong></section>;
  }

  if (!currentMerchant) {
    return (
      <section className="dn-merchant-state-v3 is-warning" dir={isArabic ? "rtl" : "ltr"}>
        <AlertTriangle /><h1>{isArabic ? "الحساب بانتظار التفعيل" : "Account pending activation"}</h1>
        <p>{isArabic ? "لم نجد ملفاً تجارياً مرتبطاً بهذا الدخول. تواصل مع فريق DAY NIGHT لتفعيل الوصول." : "No merchant profile is linked to this sign-in. Contact DAY NIGHT to activate access."}</p>
        {dataError && <p className="dn-merchant-message-v3 is-error">{dataError}</p>}
        <div><button type="button" onClick={() => void loadMerchantData(user)}><RefreshCw />{isArabic ? "إعادة الفحص" : "Retry"}</button><a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle />{isArabic ? "الدعم" : "Support"}</a><button type="button" onClick={() => void signOut()}><LogOut />{isArabic ? "خروج" : "Sign out"}</button></div>
      </section>
    );
  }

  const latestProgress = progressIndex(latestOrder?.status);

  return (
    <section className="dn-merchant-shell-v3" dir={isArabic ? "rtl" : "ltr"}>
      <aside className="dn-merchant-rail-v3" aria-label={isArabic ? "تنقل لوحة التاجر" : "Merchant navigation"}>
        <button type="button" className="dn-merchant-brand-v3" onClick={() => setTab("overview")}>
          {currentMerchant.logo_url ? <img src={currentMerchant.logo_url} alt={currentMerchantName} /> : <span>{initials(currentMerchantName)}</span>}
        </button>
        <nav>
          {([
            ["overview", Home, isArabic ? "الرئيسية" : "Overview"],
            ["services", Sparkles, isArabic ? "الخدمات" : "Services"],
            ["orders", PackageCheck, isArabic ? "الطلبيات" : "Orders"],
            ["finance", WalletCards, isArabic ? "المالية" : "Finance"],
            ["tracking", MapPin, isArabic ? "الخريطة" : "Map"],
            ["account", UserRound, isArabic ? "الحساب" : "Account"],
          ] as const).map(([value, Icon, label]) => <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)} title={label}><Icon />{value === "orders" && activeOrders.length > 0 && <b>{activeOrders.length}</b>}</button>)}
        </nav>
        <div><a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle /></a><button type="button" onClick={() => void signOut()} title={isArabic ? "تسجيل الخروج" : "Sign out"}><LogOut /></button></div>
      </aside>

      <main className="dn-merchant-workspace-v3">
        <header className="dn-merchant-topbar-v3">
          <div className="dn-merchant-identity-v3">
            <img src={companyMeta.logoUrl} onError={(event) => { event.currentTarget.src = companyMeta.logoRemoteUrl; }} alt="DAY NIGHT" />
            <div><small>{isArabic ? "مركز أعمال DAY NIGHT" : "DAY NIGHT BUSINESS CENTER"}</small><h1>{currentMerchantName}</h1><p>{clean(currentMerchant.merchant_code) || clean(currentMerchant.email) || clean(currentMerchant.phone)}</p></div>
          </div>
          <div className="dn-merchant-top-actions-v3">
            <span className={`is-${clean(currentMerchant.status).toLowerCase() || "active"}`}><ShieldCheck />{clean(currentMerchant.status) || (isArabic ? "نشط" : "Active")}</span>
            <button type="button" onClick={() => void loadMerchantData(user)} title={isArabic ? "تحديث" : "Refresh"}><RefreshCw className={dataLoading ? "dn-spin" : ""} /></button>
          </div>
        </header>

        {dataError && <div className="dn-merchant-message-v3 is-error">{dataError}</div>}

        {tab === "overview" && (
          <>
            <section className="dn-merchant-hero-v3">
              <div>
                <span><Sparkles />{isArabic ? "لوحة التاجر الذكية" : "SMART MERCHANT WORKSPACE"}</span>
                <h2>{isArabic ? "كل خدمات متجرك في واجهة واحدة" : "Every merchant service in one clear workspace"}</h2>
                <p>{isArabic ? "أنشئ الطلب، صوّر الكوبون، تابع المندوب، راجع التحصيل، وحدّث بيانات متجرك بدون ازدحام." : "Create orders, capture coupons, track drivers, review COD, and manage your store without clutter."}</p>
                <div><a href="/request?source=merchant"><PlusCircle />{isArabic ? "طلب جديد" : "New order"}</a><button type="button" onClick={() => setTab("services")}><Sparkles />{isArabic ? "كل الخدمات" : "All services"}</button></div>
              </div>
              <aside>
                <img src={currentMerchant.logo_url || companyMeta.logoUrl} onError={(event) => { event.currentTarget.src = companyMeta.logoRemoteUrl; }} alt={currentMerchantName} />
                <small>{isArabic ? "دورة التسوية" : "Settlement cycle"}</small><strong>{clean(currentMerchant.settlement_cycle) || (isArabic ? "حسب الاتفاق" : "As agreed")}</strong><p>{clean(currentMerchant.pickup_address) || clean(currentMerchant.address) || companyMeta.addressAr}</p>
              </aside>
            </section>

            <section className="dn-merchant-kpis-v3">
              <article><PackageCheck /><small>{isArabic ? "إجمالي الطلبات" : "Total orders"}</small><strong>{orders.length}</strong></article>
              <article><Truck /><small>{isArabic ? "قيد التنفيذ" : "In progress"}</small><strong>{activeOrders.length}</strong></article>
              <article><CheckCircle2 /><small>{isArabic ? "تم التسليم" : "Delivered"}</small><strong>{deliveredOrders.length}</strong></article>
              <article><Banknote /><small>{isArabic ? "COD نشط" : "Active COD"}</small><strong>{money(activeCod)}</strong></article>
            </section>

            <section className="dn-merchant-overview-grid-v3">
              <article className="dn-merchant-latest-order-v3">
                <header><div><small>{isArabic ? "آخر طلب" : "Latest order"}</small><h3>{latestOrder ? orderReference(latestOrder) : (isArabic ? "لا توجد طلبات" : "No orders yet")}</h3></div><PackageCheck /></header>
                {latestOrder ? <>
                  <div className="dn-merchant-timeline-v3">{timeline.map((step, index) => <span key={step.en} className={index <= latestProgress ? "is-done" : ""}><i>{index <= latestProgress ? <CheckCircle2 /> : index + 1}</i><small>{isArabic ? step.ar : step.en}</small></span>)}</div>
                  <div className="dn-merchant-route-v3"><article><span>1</span><div><small>{isArabic ? "الاستلام" : "Pickup"}</small><strong>{[latestOrder.sender_city, latestOrder.sender_address].filter(Boolean).join("، ") || "—"}</strong></div></article><article><span>2</span><div><small>{isArabic ? "التسليم" : "Drop-off"}</small><strong>{[latestOrder.receiver_city, latestOrder.receiver_address].filter(Boolean).join("، ") || "—"}</strong></div></article></div>
                  <div className="dn-merchant-latest-actions-v3"><button type="button" onClick={() => setTab("orders")}><PackageCheck />{isArabic ? "تفاصيل الطلب" : "Order details"}</button><a href={`/tracking?code=${encodeURIComponent(orderReference(latestOrder))}`}><MapPin />{isArabic ? "فتح التتبع" : "Open tracking"}</a></div>
                </> : <div className="dn-merchant-empty-v3"><ShieldCheck /><p>{isArabic ? "ابدأ بإنشاء أول طلب وسيظهر هنا مباشرة." : "Create your first order and it will appear here."}</p></div>}
              </article>

              <article className="dn-merchant-map-card-v3"><header><div><small>{isArabic ? "التتبع المباشر" : "Live operations map"}</small><h3>{mapOrder ? orderReference(mapOrder) : (isArabic ? "الخريطة جاهزة" : "Map ready")}</h3></div><MapPin /></header><div><TrackingMap order={mapOrder} /></div><button type="button" onClick={() => setTab("tracking")}>{isArabic ? "عرض الخريطة الكاملة" : "Open full map"}</button></article>

              <article className="dn-merchant-finance-snapshot-v3"><header><div><small>{isArabic ? "ملخص التحصيل" : "Collection snapshot"}</small><h3>{money(codTotal)}</h3></div><WalletCards /></header><div><span><small>{isArabic ? "قيمة الطلبات" : "Order value"}</small><strong>{money(revenueTotal)}</strong></span><span><small>{isArabic ? "تم تحصيله" : "Collected"}</small><strong>{money(collectedTotal)}</strong></span><span><small>{isArabic ? "مستحق التاجر" : "Merchant due"}</small><strong>{money(merchantDueTotal)}</strong></span></div><button type="button" onClick={() => setTab("finance")}>{isArabic ? "فتح التفاصيل المالية" : "Open finance details"}</button></article>
            </section>

            <section className="dn-merchant-services-strip-v3"><header><div><small>{isArabic ? "الخدمات السريعة" : "Quick merchant services"}</small><h3>{isArabic ? "ابدأ أي مهمة بضغطة واحدة" : "Start any merchant task in one click"}</h3></div><button type="button" onClick={() => setTab("services")}>{isArabic ? "عرض الكل" : "View all"}</button></header><div>{services.slice(0, 4).map(({ key, icon: Icon, title, href, tab: serviceTab, external, tone }) => href ? <a key={key} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={`is-${tone}`}><Icon /><strong>{title}</strong></a> : <button key={key} type="button" onClick={() => serviceTab && setTab(serviceTab)} className={`is-${tone}`}><Icon /><strong>{title}</strong></button>)}</div></section>
          </>
        )}

        {tab === "services" && <section className="dn-merchant-section-v3"><header><div><small>{isArabic ? "مركز الخدمات" : "MERCHANT SERVICES"}</small><h2>{isArabic ? "خدمات التاجر موزعة بوضوح" : "Merchant services, clearly organized"}</h2><p>{isArabic ? "كل خدمة مرتبطة بمسارها الحقيقي داخل النظام، دون أزرار وهمية أو بيانات تجريبية." : "Every service is connected to a real system path—no fake buttons or mock operational data."}</p></div><Sparkles /></header><div className="dn-merchant-service-grid-v3">{services.map(({ key, icon: Icon, title, text, href, tab: serviceTab, external, tone }) => { const content = <><span className={`is-${tone}`}><Icon /></span><div><h3>{title}</h3><p>{text}</p></div><b>↗</b></>; return href ? <a key={key} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{content}</a> : <button key={key} type="button" onClick={() => serviceTab && setTab(serviceTab)}>{content}</button>; })}</div><div className="dn-merchant-support-banner-v3"><div><MessageCircle /><span><strong>{isArabic ? "فريق العمليات معك 24/7" : "Operations support is available 24/7"}</strong><small>{companyMeta.phone} · {companyMeta.email}</small></span></div><div><a href={`tel:${companyMeta.phone.replace(/\s/g, "")}`}><Phone />{isArabic ? "اتصال" : "Call"}</a><a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></div></div></section>}

        {tab === "orders" && <section className="dn-merchant-section-v3"><header><div><small>{isArabic ? "إدارة الطلبيات" : "ORDER MANAGEMENT"}</small><h2>{isArabic ? "كل طلبات متجرك" : "All store orders"}</h2><p>{isArabic ? "ابحث برقم التتبع أو العميل أو المدينة، وصفِّ النتائج حسب الحالة." : "Search by reference, customer, or city and filter by status."}</p></div><PackageCheck /></header><div className="dn-merchant-order-tools-v3"><label><Search /><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder={isArabic ? "ابحث في الطلبات..." : "Search orders..."} /></label><label><ListFilter /><select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}><option value="all">{isArabic ? "كل الحالات" : "All statuses"}</option><option value="pending">{statusLabel("pending", isArabic)}</option><option value="assigned">{statusLabel("assigned", isArabic)}</option><option value="picked_up">{statusLabel("picked_up", isArabic)}</option><option value="in_transit">{statusLabel("in_transit", isArabic)}</option><option value="delivered">{statusLabel("delivered", isArabic)}</option><option value="returned">{statusLabel("returned", isArabic)}</option></select></label><a href="/request?source=merchant"><PlusCircle />{isArabic ? "طلب جديد" : "New order"}</a></div><div className="dn-merchant-order-list-v3">{filteredOrders.length === 0 && <div className="dn-merchant-empty-v3"><PackageCheck /><h3>{isArabic ? "لا توجد نتائج" : "No matching orders"}</h3><p>{isArabic ? "غيّر البحث أو أنشئ طلباً جديداً." : "Adjust the filters or create a new order."}</p></div>}{filteredOrders.map((order) => { const reference = orderReference(order); const status = normalizeStatus(order.status); return <article key={reference}><header><div><span className={`is-${status}`}>{statusLabel(status, isArabic)}</span><h3>{reference}</h3><p>{formatDate(order.created_at, isArabic)}</p></div><strong>{money(orderAmount(order))}</strong></header><div className="dn-merchant-order-data-v3"><span><small>{isArabic ? "المسار" : "Route"}</small><b>{clean(order.sender_city) || "—"} <ArrowRightLeft /> {clean(order.receiver_city) || "—"}</b></span><span><small>{isArabic ? "العميل" : "Customer"}</small><b>{clean(order.receiver_name) || "—"}</b></span><span><small>{isArabic ? "المندوب" : "Driver"}</small><b>{clean(order.driver_name) || clean(order.assigned_driver_name) || "—"}</b></span><span><small>COD</small><b>{money(orderCod(order))}</b></span></div><footer><a href={`/tracking?code=${encodeURIComponent(reference)}`}><MapPin />{isArabic ? "تتبع الطلب" : "Track order"}</a></footer></article>; })}</div></section>}

        {tab === "finance" && <section className="dn-merchant-section-v3"><header><div><small>{isArabic ? "التحصيل والتسويات" : "COD & SETTLEMENTS"}</small><h2>{isArabic ? "الملخص المالي للتاجر" : "Merchant financial summary"}</h2><p>{isArabic ? "القيم أدناه محسوبة فقط من الطلبات الحقيقية المرتبطة بحساب التاجر." : "The figures below are calculated only from real orders linked to this merchant account."}</p></div><WalletCards /></header><div className="dn-merchant-finance-grid-v3"><article><ReceiptText /><small>{isArabic ? "قيمة كل الطلبات" : "All order value"}</small><strong>{money(revenueTotal)}</strong></article><article><CheckCircle2 /><small>{isArabic ? "قيمة الطلبات المسلمة" : "Delivered value"}</small><strong>{money(deliveredValue)}</strong></article><article><Banknote /><small>{isArabic ? "إجمالي COD" : "Total COD"}</small><strong>{money(codTotal)}</strong></article><article><Truck /><small>{isArabic ? "COD قيد التنفيذ" : "Active COD"}</small><strong>{money(activeCod)}</strong></article><article><WalletCards /><small>{isArabic ? "تم تحصيله" : "Collected"}</small><strong>{money(collectedTotal)}</strong></article><article><Store /><small>{isArabic ? "مستحق التاجر" : "Merchant due"}</small><strong>{money(merchantDueTotal)}</strong></article></div><div className="dn-merchant-settlement-card-v3"><div><small>{isArabic ? "دورة التسوية المسجلة" : "Registered settlement cycle"}</small><h3>{clean(currentMerchant.settlement_cycle) || (isArabic ? "غير محددة" : "Not specified")}</h3><p>{isArabic ? "إعدادات العمولة والتسوية الأساسية تدار من لوحة الإدارة لضمان دقة الحسابات." : "Core commission and settlement controls remain admin-managed for financial accuracy."}</p></div><FileText /></div><div className="dn-merchant-finance-table-v3"><header><span>{isArabic ? "آخر الطلبات المالية" : "Recent financial orders"}</span><span>{isArabic ? "الإجمالي" : "Total"}</span><span>COD</span><span>{isArabic ? "مستحق" : "Due"}</span></header>{orders.slice(0, 12).map((order) => <article key={orderReference(order)}><span><b>{orderReference(order)}</b><small>{statusLabel(normalizeStatus(order.status), isArabic)}</small></span><span>{money(orderAmount(order))}</span><span>{money(orderCod(order))}</span><span>{money(orderMerchantDue(order))}</span></article>)}</div></section>}

        {tab === "tracking" && <section className="dn-merchant-section-v3"><header><div><small>{isArabic ? "الخريطة المباشرة" : "LIVE TRACKING"}</small><h2>{isArabic ? "مراقبة الشحنات والمندوبين" : "Monitor shipments and couriers"}</h2><p>{isArabic ? "الخريطة تستخدم بيانات الطلب والمندوب الحقيقية المتاحة في Supabase." : "The map uses real order and courier data available in Supabase."}</p></div><MapPin /></header><div className="dn-merchant-tracking-grid-v3"><article><TrackingMap order={mapOrder} /></article><aside><h3>{isArabic ? "الطلبات النشطة" : "Active shipments"}</h3>{activeOrders.length === 0 && <p>{isArabic ? "لا توجد طلبات نشطة الآن." : "No active shipments right now."}</p>}{activeOrders.slice(0, 10).map((order) => <button key={orderReference(order)} type="button" onClick={() => setSelectedTrackingReference(orderReference(order))}><span><strong>{orderReference(order)}</strong><small>{clean(order.receiver_city) || "—"}</small></span><b>{statusLabel(normalizeStatus(order.status), isArabic)}</b></button>)}<a href="/tracking"><Search />{isArabic ? "بحث برقم تتبع آخر" : "Track another reference"}</a></aside></div></section>}

        {tab === "account" && <section className="dn-merchant-section-v3"><header><div><small>{isArabic ? "ملف المتجر" : "STORE PROFILE"}</small><h2>{isArabic ? "هوية النشاط وبيانات الاستلام" : "Business identity and pickup details"}</h2><p>{isArabic ? "حدّث المعلومات التي تظهر لفريق العمليات، مع إبقاء صلاحيات التسوية والأمان تحت إدارة الشركة." : "Update operational business details while settlement and security controls remain company-managed."}</p></div>{!editingProfile ? <button type="button" onClick={beginProfileEdit}><Pencil />{isArabic ? "تعديل البيانات" : "Edit details"}</button> : <button type="button" onClick={cancelProfileEdit} disabled={profileSaving}><X />{isArabic ? "إلغاء" : "Cancel"}</button>}</header>{profileNotice && <div className="dn-merchant-message-v3 is-success">{profileNotice}</div>}{profileError && <div className="dn-merchant-message-v3 is-error">{profileError}</div>}{!editingProfile ? <div className="dn-merchant-profile-v3"><div className="dn-merchant-profile-hero-v3"><div>{currentMerchant.logo_url ? <img src={currentMerchant.logo_url} alt={currentMerchantName} /> : <span>{initials(currentMerchantName)}</span>}</div><section><h3>{currentMerchantName}</h3><p>{clean(currentMerchant.merchant_code) || "—"}</p><span><ShieldCheck />{clean(currentMerchant.status) || (isArabic ? "نشط" : "Active")}</span></section></div><div className="dn-merchant-profile-grid-v3">{[[isArabic ? "المالك" : "Owner", currentMerchant.owner_name],[isArabic ? "البريد" : "Email", currentMerchant.email],[isArabic ? "الهاتف" : "Phone", currentMerchant.phone],[isArabic ? "هاتف بديل" : "Alternate phone", currentMerchant.alt_phone],[isArabic ? "الإمارة" : "Emirate", currentMerchant.emirate],[isArabic ? "المنطقة" : "Area", currentMerchant.city],[isArabic ? "العنوان" : "Address", currentMerchant.address],[isArabic ? "عنوان الاستلام" : "Pickup address", currentMerchant.pickup_address],[isArabic ? "رقم الرخصة" : "License number", currentMerchant.license_number],[isArabic ? "الرقم الضريبي" : "TRN", currentMerchant.trn || currentMerchant.tax_number],[isArabic ? "دورة التسوية" : "Settlement", currentMerchant.settlement_cycle],[isArabic ? "آخر تحديث" : "Updated", formatDate(currentMerchant.updated_at || currentMerchant.created_at, isArabic)]].map(([label, value]) => <article key={String(label)}><small>{label}</small><strong>{clean(value) || "—"}</strong></article>)}</div>{clean(currentMerchant.notes) && <div className="dn-merchant-notes-v3"><small>{isArabic ? "ملاحظات النشاط" : "Business notes"}</small><p>{clean(currentMerchant.notes)}</p></div>}</div> : <form onSubmit={saveMerchantProfile} className="dn-merchant-profile-form-v3"><div className="dn-merchant-logo-editor-v3"><div>{profileForm.logo_url ? <img src={profileForm.logo_url} alt="" /> : <ImageIcon />}</div><section><h3>{isArabic ? "شعار النشاط" : "Business logo"}</h3><p>{isArabic ? "استخدم رابطاً آمناً يبدأ بـ https://." : "Use a secure image URL beginning with https://."}</p><input type="url" value={profileForm.logo_url} onChange={(event) => updateProfileField("logo_url", event.target.value)} placeholder="https://..." dir="ltr" /></section></div><div className="dn-merchant-fields-v3"><label><span>{isArabic ? "اسم النشاط التجاري *" : "Business name *"}</span><input value={profileForm.trade_name} onChange={(event) => updateProfileField("trade_name", event.target.value)} maxLength={160} required /></label><label><span>{isArabic ? "اسم المالك أو المسؤول" : "Owner or manager"}</span><input value={profileForm.owner_name} onChange={(event) => updateProfileField("owner_name", event.target.value)} maxLength={160} /></label><label><span>{isArabic ? "رقم الهاتف *" : "Phone number *"}</span><input type="tel" value={profileForm.phone} onChange={(event) => updateProfileField("phone", event.target.value)} maxLength={40} required dir="ltr" /></label><label><span>{isArabic ? "هاتف بديل" : "Alternate phone"}</span><input type="tel" value={profileForm.alt_phone} onChange={(event) => updateProfileField("alt_phone", event.target.value)} maxLength={40} dir="ltr" /></label><label><span>{isArabic ? "الإمارة" : "Emirate"}</span><select value={profileForm.emirate} onChange={(event) => { const emirate = event.target.value; const areas = getAreasForEmirate(emirate); setProfileForm((current) => ({ ...current, emirate, city: areas.some((area) => area.value === current.city) ? current.city : areas[0]?.value || "" })); }}>{UAE_LOCATIONS.map((location) => <option key={location.value} value={location.value}>{isArabic ? location.ar : location.en}</option>)}</select></label><label><span>{isArabic ? "المنطقة" : "Area"}</span><select value={profileForm.city} onChange={(event) => updateProfileField("city", event.target.value)}>{profileAreas.map((area) => <option key={area.value} value={area.value}>{isArabic ? area.ar : area.en}</option>)}</select></label><label className="is-wide"><span>{isArabic ? "العنوان التجاري" : "Business address"}</span><input value={profileForm.address} onChange={(event) => updateProfileField("address", event.target.value)} maxLength={500} /></label><label className="is-wide"><span>{isArabic ? "عنوان استلام الطلبيات" : "Order pickup address"}</span><input value={profileForm.pickup_address} onChange={(event) => updateProfileField("pickup_address", event.target.value)} maxLength={500} /></label><label><span>{isArabic ? "رقم الرخصة التجارية" : "Trade license number"}</span><input value={profileForm.license_number} onChange={(event) => updateProfileField("license_number", event.target.value)} maxLength={120} dir="ltr" /></label><label><span>{isArabic ? "الرقم الضريبي TRN" : "Tax registration number"}</span><input value={profileForm.trn} onChange={(event) => updateProfileField("trn", event.target.value)} maxLength={120} dir="ltr" /></label><label className="is-wide"><span>{isArabic ? "ملاحظات النشاط" : "Business notes"}</span><textarea value={profileForm.notes} onChange={(event) => updateProfileField("notes", event.target.value)} maxLength={1200} rows={4} /></label></div><div className="dn-merchant-form-note-v3"><ShieldCheck /><p>{isArabic ? "البريد، كود التاجر، الحالة، العمولة ودورة التسوية تظل تحت إدارة DAY NIGHT." : "Email, merchant code, status, commission, and settlement cycle remain DAY NIGHT managed."}</p></div><div className="dn-merchant-form-actions-v3"><button type="submit" disabled={profileSaving}>{profileSaving ? <Loader2 className="dn-spin" /> : <Save />}{isArabic ? "حفظ التعديلات" : "Save changes"}</button><button type="button" onClick={cancelProfileEdit} disabled={profileSaving}><X />{isArabic ? "إلغاء" : "Cancel"}</button></div></form>}</section>}
      </main>

      <nav className="dn-merchant-mobile-dock-v3" aria-label={isArabic ? "تنقل التاجر" : "Merchant navigation"}>
        <button type="button" className={tab === "overview" ? "is-active" : ""} onClick={() => setTab("overview")}><Home /><span>{isArabic ? "الرئيسية" : "Home"}</span></button>
        <button type="button" className={tab === "services" ? "is-active" : ""} onClick={() => setTab("services")}><Sparkles /><span>{isArabic ? "الخدمات" : "Services"}</span></button>
        <button type="button" className={tab === "orders" ? "is-active" : ""} onClick={() => setTab("orders")}><PackageCheck /><span>{isArabic ? "الطلبات" : "Orders"}</span>{activeOrders.length > 0 && <b>{activeOrders.length}</b>}</button>
        <button type="button" className={tab === "finance" ? "is-active" : ""} onClick={() => setTab("finance")}><WalletCards /><span>{isArabic ? "المالية" : "Finance"}</span></button>
        <button type="button" className={tab === "account" ? "is-active" : ""} onClick={() => setTab("account")}><UserRound /><span>{isArabic ? "الحساب" : "Account"}</span></button>
      </nav>
    </section>
  );
}
