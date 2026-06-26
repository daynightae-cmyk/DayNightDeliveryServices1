import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Fingerprint, KeyRound, LogOut, Mail, ShieldCheck, Truck, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../../supabase";
import companyMeta from "../../data/companyMeta";
import { useAppContext } from "../../lib/AppContext";
import TurnstileCaptcha from "../security/TurnstileCaptcha";

type CustomerUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown>;
};

type OAuthProvider = "google" | "azure";
type AuthMode = "login" | "signup" | "magic" | "reset";

function ProviderIcon({ label }: { label: string }) {
  return <span className="w-5 h-5 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center text-[10px] font-black">{label}</span>;
}

function cleanOAuthError(value: string) {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

function safeAuthError(value: string, isArabic: boolean) {
  const clean = cleanOAuthError(value);
  const normalized = clean.toLowerCase();

  if (normalized.includes("captcha") || normalized.includes("challenge")) {
    return isArabic ? "يرجى إكمال التحقق الأمني ثم المحاولة مرة أخرى." : "Please complete the security check and try again.";
  }

  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) {
    return isArabic ? "بيانات الدخول غير صحيحة." : "Invalid sign-in details.";
  }

  if (normalized.includes("already") && normalized.includes("registered")) {
    return isArabic ? "هذا البريد مسجل بالفعل. استخدم تسجيل الدخول أو نسيت كلمة المرور." : "This email is already registered. Sign in or use password recovery.";
  }

  if (normalized.includes("getting user email") || normalized.includes("external provider")) {
    return isArabic
      ? "تعذر إكمال الدخول لأن مزود الحساب لم يرسل بريدًا إلكترونيًا مؤكدًا. استخدم Google أو رابط البريد الآن."
      : "Sign-in could not be completed because the provider did not return a verified email. Use Google or email link now.";
  }

  if (normalized.includes("database error") || normalized.includes("saving new user") || normalized.includes("server_error")) {
    return isArabic
      ? "تعذر إنشاء الحساب الآن. جرّب Google أو رابط البريد، أو تواصل مع الدعم."
      : "The account could not be created right now. Try Google or email link, or contact support.";
  }

  return clean;
}

function metadataText(user: CustomerUser | null, keys: string[]) {
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
  const [user, setUser] = useState<CustomerUser | null>(null);
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

    async function loadSession() {
      if (!supabase) {
        setAuthLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser((data.session?.user as CustomerUser | undefined) || null);
      setAuthLoading(false);
    }

    void loadSession();

    if (!supabase) return () => { mounted = false; };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((session?.user as CustomerUser | undefined) || null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [isArabic]);

  const customerName = useMemo(() => {
    return metadataText(user, ["full_name", "name", "preferred_username", "user_name"]) || user?.email || user?.phone || (isArabic ? "عميل داي نايت" : "DAY NIGHT Customer");
  }, [isArabic, user]);

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
      setError(isArabic ? "أدخل اسمك أو اسم المتجر." : "Enter your name or store name.");
      return false;
    }
    if (!isStrongPassword(password)) {
      setError(isArabic ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل مع حرف كبير وحرف صغير ورقم." : "Password must be at least 8 characters with uppercase, lowercase, and a number.");
      return false;
    }
    if (requireName && password !== confirmPassword) {
      setError(isArabic ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
      return false;
    }
    return true;
  }

  async function sendEmailLink() {
    setError("");
    setMessage("");
    if (!validateEmail() || !requireHumanCheck()) return;
    if (!supabase) return setError(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is currently unavailable.");
    setLoading(true);
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/customer`, captchaToken: captchaToken || undefined },
    } as any);
    setLoading(false);
    resetHumanCheck();
    if (linkError) setError(safeAuthError(linkError.message, isArabic));
    else setMessage(isArabic ? "تم إرسال رابط دخول آمن إلى بريدك." : "A secure sign-in link was sent to your email.");
  }

  async function passwordLogin() {
    setError("");
    setMessage("");
    if (!validateEmail() || !requireHumanCheck()) return;
    if (!password) return setError(isArabic ? "أدخل كلمة المرور." : "Enter your password.");
    if (!supabase) return setError(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is currently unavailable.");

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { captchaToken: captchaToken || undefined },
    } as any);
    setLoading(false);
    resetHumanCheck();

    if (signInError) setError(safeAuthError(signInError.message, isArabic));
    else setMessage(isArabic ? "تم تسجيل الدخول بنجاح." : "Signed in successfully.");
  }

  async function createAccount() {
    setError("");
    setMessage("");
    if (!validateEmail() || !validatePasswordPair(true) || !requireHumanCheck()) return;
    if (!supabase) return setError(isArabic ? "خدمة التسجيل غير متاحة حالياً." : "Secure signup is currently unavailable.");

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), account_type: "customer" },
        emailRedirectTo: `${window.location.origin}/customer`,
        captchaToken: captchaToken || undefined,
      },
    } as any);
    setLoading(false);
    resetHumanCheck();

    if (signUpError) setError(safeAuthError(signUpError.message, isArabic));
    else setMessage(isArabic ? "تم إنشاء الحساب. افحص بريدك للتأكيد أو افتح حسابك إذا كان التأكيد غير مطلوب." : "Account created. Check your email to confirm, or open your account if confirmation is not required.");
  }

  async function sendRecoveryLink() {
    setError("");
    setMessage("");
    if (!validateEmail() || !requireHumanCheck()) return;
    if (!supabase) return setError(isArabic ? "خدمة الاستعادة غير متاحة حالياً." : "Password recovery is currently unavailable.");

    setLoading(true);
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/update-password`,
      captchaToken: captchaToken || undefined,
    } as any);
    setLoading(false);
    resetHumanCheck();

    if (recoveryError) setError(safeAuthError(recoveryError.message, isArabic));
    else setMessage(isArabic ? "تم إرسال رابط تغيير كلمة المرور إلى بريدك." : "A password reset link was sent to your email.");
  }

  async function providerLogin(provider: OAuthProvider) {
    setError("");
    setMessage("");
    if (!supabase) return setError(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is currently unavailable.");

    const scopes = provider === "azure" ? "openid email profile User.Read" : "openid email profile";
    const { error: providerError } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo: `${window.location.origin}/customer`,
        scopes,
      },
    });
    if (providerError) setError(safeAuthError(providerError.message, isArabic));
  }

  function passkeyNotice() {
    setError("");
    setMessage(isArabic ? "الدخول بالبصمة سيظهر بعد تفعيل مفاتيح المرور لحسابك." : "Passkey sign-in appears after passkeys are enabled for your account.");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null);
    setMessage(isArabic ? "تم تسجيل الخروج بنجاح." : "Signed out successfully.");
  }

  async function updatePassword() {
    setError("");
    setMessage("");
    if (!validatePasswordPair(false)) return;
    if (password !== confirmPassword) {
      setError(isArabic ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
      return;
    }
    if (!supabase || !user) {
      setError(isArabic ? "افتح رابط تغيير كلمة المرور من بريدك أولاً." : "Open the password reset link from your email first.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) setError(safeAuthError(updateError.message, isArabic));
    else {
      setPassword("");
      setConfirmPassword("");
      setMessage(isArabic ? "تم تحديث كلمة المرور بنجاح." : "Password updated successfully.");
    }
  }

  if (authLoading) {
    return (
      <section className="max-w-4xl mx-auto rounded-[2rem] border border-white/10 bg-brand-cool/40 p-10 text-center">
        <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-brand-gold/30 border-t-brand-gold animate-spin" />
        <p className="text-white/60 text-sm font-bold">{isArabic ? "جاري التحقق من حسابك..." : "Checking your account..."}</p>
      </section>
    );
  }

  if (isPasswordUpdateRoute) {
    return (
      <section className="max-w-5xl mx-auto overflow-hidden rounded-[2.25rem] border border-brand-gold/25 bg-[#061225] shadow-2xl" dir={isArabic ? "rtl" : "ltr"}>
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="p-7 sm:p-12 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_40%)] flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-8">
              <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-14 w-14 rounded-full border border-brand-gold/35 object-contain" />
              <div>
                <p className="text-white font-black">DAY NIGHT DELIVERY SERVICES</p>
                <p className="text-brand-gold text-xs font-bold">{companyMeta.sloganEn}</p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black text-brand-gold">
              <ShieldCheck className="w-4 h-4" /> {isArabic ? "استعادة آمنة" : "Secure recovery"}
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl font-black text-white leading-tight">{isArabic ? "تحديث كلمة المرور" : "Update Password"}</h1>
            <p className="mt-5 text-white/65 leading-relaxed max-w-xl">{isArabic ? "اختر كلمة مرور قوية لحساب العميل. بعد الحفظ يمكنك الرجوع مباشرة إلى مركز حسابك." : "Choose a strong password for your customer account. After saving, return to your account hub."}</p>
          </div>

          <div className="p-6 sm:p-10 lg:p-12 flex items-center">
            <div className="w-full rounded-[2rem] border border-white/12 bg-white/[0.07] p-5 sm:p-7 backdrop-blur-2xl">
              <div className="text-center mb-6">
                <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-brand-gold text-brand-deep flex items-center justify-center"><KeyRound className="w-8 h-8" /></div>
                <h2 className="text-white text-2xl font-black">{isArabic ? "كلمة مرور جديدة" : "New password"}</h2>
                <p className="text-white/45 text-xs mt-2">{isArabic ? "حساب العميل منفصل عن لوحة الإدارة" : "Customer account is separate from admin"}</p>
              </div>

              {!user && <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-200">{isArabic ? "لا توجد جلسة استعادة نشطة. اطلب رابطًا جديدًا من صفحة حسابي." : "No active recovery session. Request a new link from My Account."}</div>}
              {error && <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-200">{error}</div>}
              {message && <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {message}</div>}

              <div className="space-y-3">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isArabic ? "كلمة المرور الجديدة" : "New password"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" dir="ltr" />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={isArabic ? "تأكيد كلمة المرور" : "Confirm password"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" dir="ltr" />
                <button onClick={updatePassword} disabled={loading || !user} className="w-full rounded-2xl bg-brand-gold py-4 text-sm font-black text-brand-deep hover:bg-white disabled:opacity-50 disabled:hover:bg-brand-gold transition-colors">{loading ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ كلمة المرور" : "Save password")}</button>
                <Link to="/customer" className="w-full inline-flex justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white text-xs font-black hover:bg-white/10 transition-colors">{isArabic ? "الرجوع إلى حسابي" : "Back to My Account"}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (user) {
    return (
      <section className="max-w-7xl mx-auto overflow-hidden rounded-[2.25rem] border border-brand-gold/25 bg-[#061225] shadow-2xl" dir={isArabic ? "rtl" : "ltr"}>
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="p-7 sm:p-12 lg:p-14 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_35%)] flex flex-col justify-center">
            <div className="mx-auto mb-6 h-24 w-24 rounded-full border border-brand-gold/40 bg-white/5 flex items-center justify-center overflow-hidden">
              {avatarUrl ? <img src={avatarUrl} alt={customerName} className="h-full w-full object-cover" /> : <UserRound className="w-11 h-11 text-brand-gold" />}
            </div>
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-1.5 text-xs font-black text-emerald-200"><ShieldCheck className="w-4 h-4" /> {isArabic ? "تم تسجيل الدخول" : "Signed in"}</span>
              <h1 className="mt-5 text-3xl sm:text-5xl font-black text-white leading-tight">{customerName}</h1>
              <p className="mt-3 text-brand-gold text-xs font-mono break-all" dir="ltr">{customerIdentity}</p>
            </div>
          </div>

          <div className="p-7 sm:p-12 lg:p-14 flex flex-col justify-center">
            <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">{isArabic ? "مركز حساب العميل" : "Customer Account Hub"}</h2>
            <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-2xl">{isArabic ? "حسابك متصل الآن. يمكنك تتبع الشحنات، إنشاء طلب توصيل، ومراجعة السياسات من مكان واحد." : "Your account is connected. Track shipments, create delivery requests, and review policies from one place."}</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link to="/tracking" className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-5 text-center text-brand-gold font-black text-xs hover:bg-brand-gold/20 transition-colors">{isArabic ? "تتبع شحنة" : "Track shipment"}</Link>
              <Link to="/request" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-white font-black text-xs hover:bg-white/10 transition-colors">{isArabic ? "طلب توصيل" : "Request delivery"}</Link>
              <Link to="/policy" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-white font-black text-xs hover:bg-white/10 transition-colors">{isArabic ? "حقوق العميل" : "Customer rights"}</Link>
            </div>
            <button onClick={signOut} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-5 py-3 text-rose-200 text-xs font-black hover:bg-rose-500/20 transition-colors"><LogOut className="w-4 h-4" /> {isArabic ? "تسجيل الخروج" : "Sign out"}</button>
          </div>
        </div>
      </section>
    );
  }

  const primaryAction = mode === "login" ? passwordLogin : mode === "signup" ? createAccount : mode === "reset" ? sendRecoveryLink : sendEmailLink;
  const primaryText = mode === "login" ? (isArabic ? "تسجيل الدخول" : "Sign in") : mode === "signup" ? (isArabic ? "إنشاء حساب" : "Create account") : mode === "reset" ? (isArabic ? "إرسال رابط الاستعادة" : "Send recovery link") : (isArabic ? "إرسال رابط الدخول" : "Send sign-in link");

  return (
    <section className="max-w-7xl mx-auto overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#061225] shadow-2xl" dir={isArabic ? "rtl" : "ltr"}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.95fr]">
        <div className="p-7 sm:p-12 lg:p-14 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_35%)]">
          <div className="flex items-center gap-3 mb-10">
            <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-14 w-14 rounded-full border border-brand-gold/35 object-contain" />
            <div><p className="text-white font-black">DAY NIGHT DELIVERY SERVICES</p><p className="text-brand-gold text-xs font-bold">{companyMeta.sloganEn}</p></div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black text-brand-gold"><ShieldCheck className="w-4 h-4" /> {isArabic ? "بوابة عملاء مستقلة" : "Dedicated customer portal"}</span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-black text-white leading-tight">{isArabic ? "دخول العملاء الذكي" : "Smart Customer Access"}</h1>
          <p className="mt-5 text-white/65 leading-relaxed max-w-xl">{isArabic ? "صفحة منفصلة للعملاء لتتبع الشحنات، طلب التوصيل، واستلام التحديثات بأمان وسلاسة." : "A separate customer portal for tracking shipments, delivery requests, and secure updates."}</p>
          <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[isArabic ? "تسجيل بالبريد وكلمة مرور" : "Email and password", "Google / Microsoft", isArabic ? "رابط دخول سريع" : "Magic link access", isArabic ? "منفصل عن لوحة الإدارة" : "Separate from admin"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4"><CheckCircle className="mb-3 w-5 h-5 text-brand-gold" /><p className="text-white/85 text-xs font-bold">{item}</p></div>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-10 lg:p-14 flex items-center">
          <div className="w-full rounded-[2rem] border border-white/12 bg-white/[0.07] p-5 sm:p-7 backdrop-blur-2xl">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-brand-gold text-brand-deep flex items-center justify-center"><UserRound className="w-8 h-8" /></div>
              <h2 className="text-white text-2xl font-black">{isArabic ? "ادخل إلى حسابك" : "Access your account"}</h2>
              <p className="text-white/45 text-xs mt-2">{isArabic ? "بوابة العملاء منفصلة عن الإدارة" : "Customer access is separate from admin"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {([
                ["login", isArabic ? "دخول" : "Login"],
                ["signup", isArabic ? "تسجيل جديد" : "Sign up"],
                ["magic", isArabic ? "رابط البريد" : "Email link"],
                ["reset", isArabic ? "نسيت كلمة السر" : "Forgot password"],
              ] as [AuthMode, string][]).map(([key, label]) => (
                <button key={key} onClick={() => { setMode(key); setError(""); setMessage(""); }} className={`rounded-2xl border px-3 py-3 text-[11px] font-black transition-colors ${mode === key ? "border-brand-gold bg-brand-gold text-brand-deep" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>{label}</button>
              ))}
            </div>

            {error && <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-200">{error}</div>}
            {message && <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200">{message}</div>}

            <div className="space-y-3">
              {mode === "signup" && <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={isArabic ? "اسمك أو اسم المتجر" : "Your name or store name"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" />}
              <div className="relative"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" dir="ltr" className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 pe-11 text-white outline-none focus:border-brand-gold" /><Mail className="absolute top-4 end-4 w-5 h-5 text-white/35" /></div>
              {(mode === "login" || mode === "signup") && <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isArabic ? "كلمة المرور" : "Password"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" dir="ltr" />}
              {mode === "signup" && <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={isArabic ? "تأكيد كلمة المرور" : "Confirm password"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 text-white outline-none focus:border-brand-gold" dir="ltr" />}
              {captchaEnabled && <TurnstileCaptcha key={captchaNonce} siteKey={captchaSiteKey} language={language} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken("")} />}
              <button onClick={() => void primaryAction()} disabled={loading} className="w-full rounded-2xl bg-brand-gold py-4 text-sm font-black text-brand-deep hover:bg-white disabled:opacity-50 transition-colors">{loading ? (isArabic ? "جاري التنفيذ..." : "Processing...") : primaryText}</button>
            </div>

            <div className="my-6 h-px bg-white/10" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={() => void providerLogin("google")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white text-xs font-black flex items-center justify-center gap-2"><ProviderIcon label="G" /> Google</button>
              <button onClick={() => void providerLogin("azure")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white text-xs font-black flex items-center justify-center gap-2"><ProviderIcon label="M" /> Microsoft</button>
              <button onClick={passkeyNotice} className="sm:col-span-2 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-brand-gold text-xs font-black flex items-center justify-center gap-2"><Fingerprint className="w-4 h-4" /> {isArabic ? "بصمة / Face ID لاحقاً" : "Passkey / Face ID later"}</button>
            </div>
            <Link to="/request" className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white text-xs font-black"><Truck className="w-4 h-4" /> {isArabic ? "طلب توصيل بدون دخول" : "Request delivery without login"}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
