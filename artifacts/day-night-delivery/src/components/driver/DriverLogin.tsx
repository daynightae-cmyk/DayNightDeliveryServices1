import { useState, type FormEvent } from "react";
import {
  Banknote,
  Camera,
  Eye,
  EyeOff,
  Globe2,
  Headphones,
  Loader2,
  LockKeyhole,
  Mail,
  MapPinned,
  Navigation,
  PackageCheck,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../../supabase";
import companyMeta from "../../data/companyMeta";

export default function DriverLogin({ isArabic }: { isArabic: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const redirectTo = () => `${window.location.origin}/driver`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    if (!supabase) {
      setError(isArabic ? "الخدمة غير متاحة حالياً." : "The service is unavailable right now.");
      setBusy(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setError(isArabic ? "بيانات الدخول غير صحيحة أو الحساب غير مفعل." : "The sign-in details are not correct or the account is not active.");
    }
    setBusy(false);
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (authError) {
      setError(isArabic ? "تعذر فتح تسجيل الدخول عبر Google حالياً." : "Google sign-in is unavailable right now.");
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!supabase) return;
    if (!email.trim()) {
      setError(isArabic ? "اكتب بريد المندوب أولاً." : "Enter the driver email first.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo() },
    });

    if (authError) setError(isArabic ? "تعذر إرسال رابط الدخول حالياً." : "The sign-in link could not be sent right now.");
    else setNotice(isArabic ? "تم إرسال رابط دخول آمن إلى بريد المندوب." : "A secure sign-in link was sent to the driver email.");
    setBusy(false);
  }

  return (
    <section className="dn-driver-login-page dn-portal-auth-page dn-driver-auth-v5" dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-portal-auth-shell">
        <aside className="dn-portal-auth-visual dn-driver-auth-visual">
          <div className="dn-portal-auth-brand">
            <img
              src={companyMeta.logoUrl}
              onError={(event) => { event.currentTarget.src = companyMeta.logoRemoteUrl; }}
              alt="DAY NIGHT"
            />
            <div>
              <small>DAY NIGHT DRIVER OPERATIONS</small>
              <h1>{isArabic ? "مركز تشغيل المندوب" : "Driver Operations Center"}</h1>
            </div>
          </div>

          <div className="dn-portal-auth-copy">
            <span><ShieldCheck />{isArabic ? "دخول تشغيلي آمن" : "SECURE OPERATIONS ACCESS"}</span>
            <h2>{isArabic ? "مهامك ومسارك وإثبات التسليم في واجهة واحدة" : "Jobs, navigation, and proof of delivery in one clear workspace"}</h2>
            <p>{isArabic
              ? "بعد الدخول ستظهر طلباتك الحقيقية فقط، موقعك المباشر، حالة الوردية، الملاحة، التحصيل، وإجراءات الاستلام والتسليم المرتبطة بنظام DAY NIGHT."
              : "After sign-in you will see only your real assigned orders, live location, shift status, navigation, collections, pickup, and delivery actions connected to DAY NIGHT."
            }</p>
          </div>

          <div className="dn-portal-auth-feature-grid">
            <article>
              <PackageCheck />
              <div><strong>{isArabic ? "المهام المسندة" : "Assigned jobs"}</strong><small>{isArabic ? "طلبات المندوب الحقيقية من Supabase" : "Real Supabase driver assignments"}</small></div>
            </article>
            <article>
              <MapPinned />
              <div><strong>{isArabic ? "GPS وملاحة مباشرة" : "Live GPS & navigation"}</strong><small>{isArabic ? "المسار والموقع وآخر مزامنة" : "Route, location, and last sync"}</small></div>
            </article>
            <article>
              <Camera />
              <div><strong>{isArabic ? "إثبات وتسليم وCOD" : "Proof, delivery & COD"}</strong><small>{isArabic ? "تحديث الحالة والتحصيل بدون بيانات وهمية" : "Status and collection without mock data"}</small></div>
            </article>
          </div>

          <div className="dn-portal-auth-support">
            <a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer"><Headphones />{isArabic ? "البلاغات والدعم" : "Reports & support"}</a>
            <a href={`tel:${companyMeta.phone}`}><PhoneCall />{companyMeta.phone}</a>
          </div>

          <footer><span>{companyMeta.sloganAr}</span><span>{companyMeta.sloganEn}</span></footer>
        </aside>

        <main className="dn-portal-auth-card dn-driver-auth-card">
          <header>
            <span><Navigation /></span>
            <div>
              <h2>{isArabic ? "دخول المندوب" : "Driver sign in"}</h2>
              <p>{isArabic ? "استخدم البريد المعتمد لدى عمليات DAY NIGHT." : "Use the email approved by DAY NIGHT operations."}</p>
            </div>
          </header>

          <form onSubmit={submit} className="dn-portal-auth-form">
            <label>
              <span>{isArabic ? "البريد الإلكتروني" : "Email address"}</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={isArabic ? "بريد المندوب المعتمد" : "Approved driver email"}
                required
              />
            </label>

            <label>
              <span>{isArabic ? "كلمة المرور" : "Password"}</span>
              <div className="dn-portal-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isArabic ? "كلمة المرور" : "Password"}
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={isArabic ? "إظهار أو إخفاء كلمة المرور" : "Show or hide password"}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>

            {error && <p className="dn-portal-auth-message is-error">{error}</p>}
            {notice && <p className="dn-portal-auth-message is-success">{notice}</p>}

            <button type="submit" disabled={busy || !email.trim() || !password} className="dn-portal-auth-primary">
              {busy ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
              {isArabic ? "فتح مركز التشغيل" : "Open operations center"}
            </button>
          </form>

          <div className="dn-portal-auth-alternatives">
            <button type="button" disabled={busy} onClick={() => void signInWithGoogle()}>
              <Globe2 /> Google
            </button>
            <button type="button" disabled={busy || !email.trim()} onClick={() => void sendMagicLink()}>
              <Mail /> {isArabic ? "رابط دخول بالبريد" : "Email sign-in link"}
            </button>
          </div>

          <p className="dn-portal-auth-note">
            <Banknote />
            <span>{isArabic
              ? "لن تظهر أي مبالغ أو طلبات تجريبية. البيانات داخل اللوحة تُقرأ من حساب المندوب المرتبط وقاعدة البيانات الحقيقية."
              : "No demo orders or balances are displayed. The workspace reads from the linked driver account and production data."
            }</span>
          </p>
        </main>
      </div>
    </section>
  );
}
