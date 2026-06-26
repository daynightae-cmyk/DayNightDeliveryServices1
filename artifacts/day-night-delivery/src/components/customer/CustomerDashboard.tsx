import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Fingerprint, LogOut, Mail, ShieldCheck, Truck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabase";
import companyMeta from "../../data/companyMeta";
import { useAppContext } from "../../lib/AppContext";

type CustomerUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown>;
};

function ProviderIcon({ label }: { label: string }) {
  return <span className="w-5 h-5 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center text-[10px] font-black">{label}</span>;
}

function cleanOAuthError(value: string) {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

export default function CustomerDashboard() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<CustomerUser | null>(null);

  useEffect(() => {
    let mounted = true;

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) {
      setError(cleanOAuthError(oauthError));
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
  }, []);

  const customerName = useMemo(() => {
    const metadata = user?.user_metadata || {};
    return String(metadata.full_name || metadata.name || user?.email || user?.phone || (isArabic ? "عميل داي نايت" : "DAY NIGHT Customer"));
  }, [isArabic, user]);

  const avatarUrl = useMemo(() => {
    const metadata = user?.user_metadata || {};
    return typeof metadata.avatar_url === "string" ? metadata.avatar_url : "";
  }, [user]);

  async function sendEmailLink() {
    setError("");
    setMessage("");
    if (!email.trim()) return setError(isArabic ? "أدخل البريد الإلكتروني." : "Enter your email address.");
    if (!supabase) return setError(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is currently unavailable.");
    setLoading(true);
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/customer` },
    });
    setLoading(false);
    if (linkError) setError(linkError.message);
    else setMessage(isArabic ? "تم إرسال رابط دخول آمن إلى بريدك." : "A secure sign-in link was sent to your email.");
  }

  async function providerLogin(provider: "google" | "azure") {
    setError("");
    setMessage("");
    if (!supabase) return setError(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is currently unavailable.");
    const { error: providerError } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: { redirectTo: `${window.location.origin}/customer` },
    });
    if (providerError) setError(providerError.message);
  }

  function passkeyNotice() {
    setError("");
    setMessage(isArabic ? "الدخول بالبصمة يظهر بعد تفعيل مفاتيح المرور لحسابك." : "Passkey sign-in appears after passkeys are enabled for your account.");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null);
    setMessage(isArabic ? "تم تسجيل الخروج بنجاح." : "Signed out successfully.");
  }

  if (authLoading) {
    return (
      <section className="max-w-4xl mx-auto rounded-[2rem] border border-white/10 bg-brand-cool/40 p-10 text-center">
        <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-brand-gold/30 border-t-brand-gold animate-spin" />
        <p className="text-white/60 text-sm font-bold">{isArabic ? "جاري التحقق من حسابك..." : "Checking your account..."}</p>
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
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-1.5 text-xs font-black text-emerald-200">
                <ShieldCheck className="w-4 h-4" /> {isArabic ? "تم تسجيل الدخول" : "Signed in"}
              </span>
              <h1 className="mt-5 text-3xl sm:text-5xl font-black text-white leading-tight">{customerName}</h1>
              <p className="mt-3 text-brand-gold text-xs font-mono" dir="ltr">{user.email || user.phone || user.id}</p>
            </div>
          </div>

          <div className="p-7 sm:p-12 lg:p-14 flex flex-col justify-center">
            <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
              {isArabic ? "مركز حساب العميل" : "Customer Account Hub"}
            </h2>
            <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-2xl">
              {isArabic ? "حسابك متصل الآن. يمكنك تتبع الشحنات، إنشاء طلب توصيل، ومراجعة السياسات من مكان واحد." : "Your account is connected. Track shipments, create delivery requests, and review policies from one place."}
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link to="/tracking" className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-5 text-center text-brand-gold font-black text-xs hover:bg-brand-gold/20 transition-colors">
                {isArabic ? "تتبع شحنة" : "Track shipment"}
              </Link>
              <Link to="/request" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-white font-black text-xs hover:bg-white/10 transition-colors">
                {isArabic ? "طلب توصيل" : "Request delivery"}
              </Link>
              <Link to="/policy" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-white font-black text-xs hover:bg-white/10 transition-colors">
                {isArabic ? "حقوق العميل" : "Customer rights"}
              </Link>
            </div>

            <button onClick={signOut} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-5 py-3 text-rose-200 text-xs font-black hover:bg-rose-500/20 transition-colors">
              <LogOut className="w-4 h-4" /> {isArabic ? "تسجيل الخروج" : "Sign out"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#061225] shadow-2xl" dir={isArabic ? "rtl" : "ltr"}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.95fr]">
        <div className="p-7 sm:p-12 lg:p-14 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_35%)]">
          <div className="flex items-center gap-3 mb-10">
            <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-14 w-14 rounded-full border border-brand-gold/35 object-contain" />
            <div>
              <p className="text-white font-black">DAY NIGHT DELIVERY SERVICES</p>
              <p className="text-brand-gold text-xs font-bold">{companyMeta.sloganEn}</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black text-brand-gold">
            <ShieldCheck className="w-4 h-4" /> {isArabic ? "بوابة عملاء مستقلة" : "Dedicated customer portal"}
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-black text-white leading-tight">
            {isArabic ? "دخول العملاء الذكي" : "Smart Customer Access"}
          </h1>
          <p className="mt-5 text-white/65 leading-relaxed max-w-xl">
            {isArabic ? "صفحة منفصلة للعملاء لتتبع الشحنات، طلب التوصيل، واستلام التحديثات بأمان وسلاسة." : "A separate customer portal for tracking shipments, delivery requests, and secure updates."}
          </p>

          <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[isArabic ? "تسجيل مجاني عبر البريد" : "Free email access", "Google / Microsoft", isArabic ? "البصمة لاحقاً بعد التفعيل" : "Passkey ready later", isArabic ? "منفصل عن لوحة الإدارة" : "Separate from admin"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <CheckCircle className="mb-3 w-5 h-5 text-brand-gold" />
                <p className="text-white/85 text-xs font-bold">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-10 lg:p-14 flex items-center">
          <div className="w-full rounded-[2rem] border border-white/12 bg-white/[0.07] p-5 sm:p-7 backdrop-blur-2xl">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-brand-gold text-brand-deep flex items-center justify-center">
                <UserRound className="w-8 h-8" />
              </div>
              <h2 className="text-white text-2xl font-black">{isArabic ? "ادخل إلى حسابك" : "Access your account"}</h2>
              <p className="text-white/45 text-xs mt-2">{isArabic ? "بوابة العملاء منفصلة عن الإدارة" : "Customer access is separate from admin"}</p>
            </div>

            {error && <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-200">{error}</div>}
            {message && <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200">{message}</div>}

            <div className="space-y-3">
              <div className="relative">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" dir="ltr" className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-4 pe-11 text-white outline-none focus:border-brand-gold" />
                <Mail className="absolute top-4 end-4 w-5 h-5 text-white/35" />
              </div>
              <button onClick={sendEmailLink} disabled={loading} className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-black text-white hover:bg-white/10 disabled:opacity-50">
                {loading ? (isArabic ? "جاري الإرسال..." : "Sending...") : (isArabic ? "إرسال رابط دخول البريد" : "Send email sign-in link")}
              </button>
            </div>

            <div className="my-6 h-px bg-white/10" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={() => void providerLogin("google")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white text-xs font-black flex items-center justify-center gap-2"><ProviderIcon label="G" /> Google</button>
              <button onClick={() => void providerLogin("azure")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white text-xs font-black flex items-center justify-center gap-2"><ProviderIcon label="M" /> Microsoft</button>
              <button onClick={passkeyNotice} className="sm:col-span-2 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-brand-gold text-xs font-black flex items-center justify-center gap-2"><Fingerprint className="w-4 h-4" /> {isArabic ? "بصمة / Face ID لاحقاً" : "Passkey / Face ID later"}</button>
            </div>

            <Link to="/request" className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white text-xs font-black">
              <Truck className="w-4 h-4" /> {isArabic ? "طلب توصيل بدون دخول" : "Request delivery without login"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
