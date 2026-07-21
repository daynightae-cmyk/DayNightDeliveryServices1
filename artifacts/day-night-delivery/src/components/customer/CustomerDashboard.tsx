import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CheckCircle, Fingerprint, KeyRound, LogOut, Mail, ShieldCheck, Truck, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { Order } from "../../types";
import { fetchCustomerOrders, supabase } from "../../supabase";
import companyMeta from "../../data/companyMeta";
import { useAppContext } from "../../lib/AppContext";
import TurnstileCaptcha from "../security/TurnstileCaptcha";
import CustomerOrderHistory from "./CustomerOrderHistory";

type OAuthProvider = "google" | "azure";
type AuthMode = "login" | "signup" | "magic" | "reset";

function ProviderIcon({ label }: { label: string }) {
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-gold/15 text-[10px] font-black text-brand-gold">{label}</span>;
}

function cleanOAuthError(value: string) {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

function safeAuthError(value: string, isArabic: boolean) {
  const clean = cleanOAuthError(value);
  const normalized = clean.toLowerCase();
  if (normalized.includes("captcha") || normalized.includes("challenge")) return isArabic ? "يرجى إكمال التحقق الأمني ثم المحاولة مرة أخرى." : "Please complete the security check and try again.";
  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) return isArabic ? "بيانات الدخول غير صحيحة." : "Invalid sign-in details.";
  if (normalized.includes("already") && normalized.includes("registered")) return isArabic ? "هذا البريد مسجل بالفعل. استخدم تسجيل الدخول أو نسيت كلمة المرور." : "This email is already registered. Sign in or use password recovery.";
  if (normalized.includes("database error") || normalized.includes("server_error")) return isArabic ? "تعذر تنفيذ العملية الآن. استخدم رابط البريد أو تواصل مع الدعم." : "The operation could not be completed. Use the email link or contact support.";
  return clean || (isArabic ? "تعذر إكمال العملية." : "The operation could not be completed.");
}

function metadataText(user: User | null, keys: string[]) {
  const metadata = user?.user_metadata || {};
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isStrongPassword(value: string) {
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
}

export default function CustomerDashboard() {
  const { language } = useAppContext();
  const location = useLocation();
  const isArabic = language === "ar";
  const isPasswordUpdateRoute = location.pathname === "/update-password";

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaNonce, setCaptchaNonce] = useState(0);

  const captchaSiteKey = String(((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || "")).trim();
  const captchaEnabled = Boolean(captchaSiteKey);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) {
      setError(safeAuthError(oauthError, isArabic));
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!supabase) {
      setAuthLoading(false);
      return () => { mounted = false; };
    }

    void supabase.auth.getSession().then(({ data }) => {
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
  }, [isArabic]);

  const loadCustomerOrders = useCallback(async (activeUser = user) => {
    if (!activeUser?.id) {
      setCustomerOrders([]);
      return;
    }
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const orders = await fetchCustomerOrders(activeUser.id);
      setCustomerOrders(orders);
    } catch (loadError) {
      setOrdersError(loadError instanceof Error ? loadError.message : String(loadError || "orders_load_failed"));
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id || isPasswordUpdateRoute) {
      setCustomerOrders([]);
      return;
    }
    void loadCustomerOrders(user);
  }, [user?.id, isPasswordUpdateRoute, loadCustomerOrders]);

  useEffect(() => {
    if (!supabase || !user?.id || isPasswordUpdateRoute) return;
    const channel = supabase
      .channel(`customer-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadCustomerOrders(user))
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [user, isPasswordUpdateRoute, loadCustomerOrders]);

  const customerName = useMemo(
    () => metadataText(user, ["full_name", "name", "preferred_username", "user_name"]) || user?.email || user?.phone || (isArabic ? "عميل داي نايت" : "DAY NIGHT Customer"),
    [isArabic, user],
  );
  const avatarUrl = useMemo(() => metadataText(user, ["avatar_url", "picture"]), [user]);
  const customerIdentity = useMemo(() => user?.email || metadataText(user, ["email", "preferred_username", "upn"]) || user?.phone || user?.id || "", [user]);

  function resetHumanCheck() {
    setCaptchaToken("");
    setCaptchaNonce((value) => value + 1);
  }

  function requireHumanCheck() {
    if (captchaEnabled && !captchaToken) {
      setError(isArabic ? "أكمل التحقق الأمني أولاً." : "Complete the security check first.");
      return false;
    }
    return true;
  }

  function validateEmail() {
    if (!email.trim() || !email.includes("@")) {
      setError(isArabic ? "أدخل بريدًا إلكترونيًا صحيحًا." : "Enter a valid email address.");
      return false;
    }
    return true;
  }

  function validatePasswordPair(requireName = false) {
    if (requireName && !fullName.trim()) {
      setError(isArabic ? "أدخل اسمك." : "Enter your name.");
      return false;
    }
    if (!isStrongPassword(password)) {
      setError(isArabic ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل مع حرف كبير وحرف صغير ورقم." : "Password must be at least 8 characters with uppercase, lowercase, and a number.");
      return false;
    }
    if (password !== confirmPassword) {
      setError(isArabic ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
      return false;
    }
    return true;
  }

  async function sendEmailLink() {
    setError(""); setMessage("");
    if (!validateEmail() || !requireHumanCheck()) return;
    if (!supabase) return setError(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is unavailable.");
    setLoading(true);
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/customer`, captchaToken: captchaToken || undefined },
    } as any);
    setLoading(false); resetHumanCheck();
    if (linkError) setError(safeAuthError(linkError.message, isArabic));
    else setMessage(isArabic ? "تم إرسال رابط دخول آمن إلى بريدك." : "A secure sign-in link was sent to your email.");
  }

  async function passwordLogin() {
    setError(""); setMessage("");
    if (!validateEmail() || !requireHumanCheck()) return;
    if (!password) return setError(isArabic ? "أدخل كلمة المرور." : "Enter your password.");
    if (!supabase) return setError(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is unavailable.");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken: captchaToken || undefined } } as any);
    setLoading(false); resetHumanCheck();
    if (signInError) setError(safeAuthError(signInError.message, isArabic));
    else setMessage(isArabic ? "تم تسجيل الدخول بنجاح." : "Signed in successfully.");
  }

  async function createAccount() {
    setError(""); setMessage("");
    if (!validateEmail() || !validatePasswordPair(true) || !requireHumanCheck()) return;
    if (!supabase) return setError(isArabic ? "خدمة التسجيل غير متاحة حالياً." : "Secure signup is unavailable.");
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: fullName.trim(), account_type: "customer" }, emailRedirectTo: `${window.location.origin}/customer`, captchaToken: captchaToken || undefined },
    } as any);
    setLoading(false); resetHumanCheck();
    if (signUpError) setError(safeAuthError(signUpError.message, isArabic));
    else setMessage(isArabic ? "تم إنشاء الحساب. افحص بريدك للتأكيد." : "Account created. Check your email to confirm.");
  }

  async function sendRecoveryLink() {
    setError(""); setMessage("");
    if (!validateEmail() || !requireHumanCheck()) return;
    if (!supabase) return setError(isArabic ? "خدمة الاستعادة غير متاحة حالياً." : "Password recovery is unavailable.");
    setLoading(true);
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/update-password`, captchaToken: captchaToken || undefined } as any);
    setLoading(false); resetHumanCheck();
    if (recoveryError) setError(safeAuthError(recoveryError.message, isArabic));
    else setMessage(isArabic ? "تم إرسال رابط تغيير كلمة المرور." : "A password reset link was sent.");
  }

  async function providerLogin(provider: OAuthProvider) {
    setError(""); setMessage("");
    if (!supabase) return setError(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is unavailable.");
    const scopes = provider === "azure" ? "openid email profile User.Read" : "openid email profile";
    const { error: providerError } = await supabase.auth.signInWithOAuth({ provider: provider as any, options: { redirectTo: `${window.location.origin}/customer`, scopes } });
    if (providerError) setError(safeAuthError(providerError.message, isArabic));
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null); setCustomerOrders([]);
  }

  async function updatePassword() {
    setError(""); setMessage("");
    if (!validatePasswordPair(false)) return;
    if (!supabase || !user) return setError(isArabic ? "افتح رابط تغيير كلمة المرور من بريدك أولاً." : "Open the password reset link from your email first.");
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) setError(safeAuthError(updateError.message, isArabic));
    else { setPassword(""); setConfirmPassword(""); setMessage(isArabic ? "تم تحديث كلمة المرور بنجاح." : "Password updated successfully."); }
  }

  if (authLoading) return <section className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-brand-cool/40 p-10 text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-brand-gold/30 border-t-brand-gold" /><p className="text-sm font-bold text-white/60">{isArabic ? "جاري التحقق من حسابك..." : "Checking your account..."}</p></section>;

  if (isPasswordUpdateRoute) {
    return <section className="mx-auto max-w-5xl overflow-hidden rounded-[2.25rem] border border-brand-gold/25 bg-[#061225] shadow-2xl" dir={isArabic ? "rtl" : "ltr"}><div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]"><div className="flex flex-col justify-center bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_40%)] p-7 sm:p-12"><span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black text-brand-gold"><ShieldCheck className="h-4 w-4" />{isArabic ? "استعادة آمنة" : "Secure recovery"}</span><h1 className="mt-6 text-4xl font-black text-white">{isArabic ? "تحديث كلمة المرور" : "Update Password"}</h1></div><div className="flex items-center p-6 sm:p-10"><div className="w-full rounded-[2rem] border border-white/10 bg-white/[0.07] p-6"><div className="mb-6 text-center"><KeyRound className="mx-auto mb-3 h-10 w-10 text-brand-gold" /><h2 className="text-2xl font-black text-white">{isArabic ? "كلمة مرور جديدة" : "New password"}</h2></div>{error && <p className="mb-3 rounded-xl bg-rose-500/10 p-3 text-xs font-bold text-rose-200">{error}</p>}{message && <p className="mb-3 rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200">{message}</p>}<div className="space-y-3"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isArabic ? "كلمة المرور الجديدة" : "New password"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" /><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={isArabic ? "تأكيد كلمة المرور" : "Confirm password"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" /><button type="button" onClick={() => void updatePassword()} disabled={loading || !user} className="w-full rounded-2xl bg-brand-gold py-4 text-sm font-black text-brand-deep disabled:opacity-50">{loading ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ كلمة المرور" : "Save password")}</button><Link to="/customer" className="inline-flex w-full justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white">{isArabic ? "الرجوع إلى حسابي" : "Back to My Account"}</Link></div></div></div></div></section>;
  }

  if (user) {
    return <section className="mx-auto max-w-7xl space-y-6" dir={isArabic ? "rtl" : "ltr"}><div className="overflow-hidden rounded-[2.25rem] border border-brand-gold/25 bg-[#061225] shadow-2xl"><div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]"><div className="flex flex-col justify-center bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_35%)] p-7 sm:p-12 lg:p-14"><div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-brand-gold/40 bg-white/5">{avatarUrl ? <img src={avatarUrl} alt={customerName} className="h-full w-full object-cover" /> : <UserRound className="h-11 w-11 text-brand-gold" />}</div><div className="text-center"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-1.5 text-xs font-black text-emerald-200"><ShieldCheck className="h-4 w-4" />{isArabic ? "تم تسجيل الدخول" : "Signed in"}</span><h1 className="mt-5 text-3xl font-black text-white sm:text-5xl">{customerName}</h1><p className="mt-3 break-all font-mono text-xs text-brand-gold" dir="ltr">{customerIdentity}</p></div></div><div className="flex flex-col justify-center p-7 sm:p-12 lg:p-14"><h2 className="text-3xl font-black text-white sm:text-5xl">{isArabic ? "مركز حساب العميل" : "Customer Account Hub"}</h2><p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/60">{isArabic ? "طلباتك النشطة وسجل التسليم النهائي متصلان مباشرة ببيانات Supabase لحسابك المصادق عليه." : "Your active requests and final delivery history are loaded directly from Supabase for your authenticated account."}</p><div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3"><Link to="/tracking" className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-5 text-center text-xs font-black text-brand-gold">{isArabic ? "تتبع شحنة" : "Track shipment"}</Link><Link to="/request" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-xs font-black text-white">{isArabic ? "طلب توصيل" : "Request delivery"}</Link><Link to="/policy" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-xs font-black text-white">{isArabic ? "حقوق العميل" : "Customer rights"}</Link></div><button type="button" onClick={() => void signOut()} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-5 py-3 text-xs font-black text-rose-200"><LogOut className="h-4 w-4" />{isArabic ? "تسجيل الخروج" : "Sign out"}</button></div></div></div><CustomerOrderHistory orders={customerOrders} loading={ordersLoading} error={ordersError} isArabic={isArabic} onRefresh={() => loadCustomerOrders()} /></section>;
  }

  const primaryAction = mode === "login" ? passwordLogin : mode === "signup" ? createAccount : mode === "reset" ? sendRecoveryLink : sendEmailLink;
  const primaryText = mode === "login" ? (isArabic ? "تسجيل الدخول" : "Sign in") : mode === "signup" ? (isArabic ? "إنشاء حساب" : "Create account") : mode === "reset" ? (isArabic ? "إرسال رابط الاستعادة" : "Send recovery link") : (isArabic ? "إرسال رابط الدخول" : "Send sign-in link");

  return <section className="mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#061225] shadow-2xl" dir={isArabic ? "rtl" : "ltr"}><div className="grid grid-cols-1 lg:grid-cols-[1fr_0.95fr]"><div className="bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_35%)] p-7 sm:p-12 lg:p-14"><div className="mb-10 flex items-center gap-3"><img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-14 w-14 rounded-full border border-brand-gold/35 object-contain" /><div><p className="font-black text-white">DAY NIGHT DELIVERY SERVICES</p><p className="text-xs font-bold text-brand-gold">{companyMeta.sloganEn}</p></div></div><span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black text-brand-gold"><ShieldCheck className="h-4 w-4" />{isArabic ? "بوابة عملاء مستقلة" : "Dedicated customer portal"}</span><h1 className="mt-6 text-4xl font-black leading-tight text-white sm:text-6xl">{isArabic ? "دخول العملاء الذكي" : "Smart Customer Access"}</h1><p className="mt-5 max-w-xl leading-relaxed text-white/65">{isArabic ? "تتبع الشحنات، طلب التوصيل، سجل الطلبات، وتأكيدات البريد في حساب واحد." : "Track shipments, request deliveries, view order history, and receive email confirmations in one account."}</p></div><div className="flex items-center p-6 sm:p-10 lg:p-14"><div className="w-full rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 backdrop-blur-2xl sm:p-7"><div className="mb-6 text-center"><UserRound className="mx-auto mb-4 h-10 w-10 text-brand-gold" /><h2 className="text-2xl font-black text-white">{isArabic ? "ادخل إلى حسابك" : "Access your account"}</h2></div><div className="mb-4 grid grid-cols-2 gap-2">{([['login', isArabic ? 'دخول' : 'Login'], ['signup', isArabic ? 'تسجيل جديد' : 'Sign up'], ['magic', isArabic ? 'رابط البريد' : 'Email link'], ['reset', isArabic ? 'نسيت كلمة السر' : 'Forgot password']] as [AuthMode, string][]).map(([key, label]) => <button key={key} type="button" onClick={() => { setMode(key); setError(""); setMessage(""); }} className={`rounded-2xl border px-3 py-3 text-[11px] font-black ${mode === key ? "border-brand-gold bg-brand-gold text-brand-deep" : "border-white/10 bg-white/5 text-white"}`}>{label}</button>)}</div>{error && <p className="mb-4 rounded-2xl bg-rose-500/10 p-3 text-xs font-bold text-rose-200">{error}</p>}{message && <p className="mb-4 rounded-2xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200">{message}</p>}<div className="space-y-3">{mode === "signup" && <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={isArabic ? "اسمك" : "Your name"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" />}<div className="relative"><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@email.com" dir="ltr" className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 pe-11 text-white outline-none focus:border-brand-gold" /><Mail className="absolute end-4 top-4 h-5 w-5 text-white/35" /></div>{(mode === "login" || mode === "signup") && <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isArabic ? "كلمة المرور" : "Password"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" dir="ltr" />}{mode === "signup" && <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={isArabic ? "تأكيد كلمة المرور" : "Confirm password"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" dir="ltr" />}{captchaEnabled && <TurnstileCaptcha key={captchaNonce} siteKey={captchaSiteKey} language={language} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken("")} />}<button type="button" onClick={() => void primaryAction()} disabled={loading} className="w-full rounded-2xl bg-brand-gold py-4 text-sm font-black text-brand-deep disabled:opacity-50">{loading ? (isArabic ? "جاري التنفيذ..." : "Processing...") : primaryText}</button></div><div className="my-6 h-px bg-white/10" /><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" onClick={() => void providerLogin("google")} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white"><ProviderIcon label="G" />Google</button><button type="button" onClick={() => void providerLogin("azure")} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white"><ProviderIcon label="M" />Microsoft</button><button type="button" onClick={() => setMessage(isArabic ? "سيتم تفعيل مفاتيح المرور لاحقاً." : "Passkeys will be enabled later.")} className="flex items-center justify-center gap-2 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-xs font-black text-brand-gold sm:col-span-2"><Fingerprint className="h-4 w-4" />{isArabic ? "بصمة / Face ID لاحقاً" : "Passkey / Face ID later"}</button></div><Link to="/request" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white"><Truck className="h-4 w-4" />{isArabic ? "طلب توصيل بدون دخول" : "Request delivery without login"}</Link></div></div></div></section>;
}
