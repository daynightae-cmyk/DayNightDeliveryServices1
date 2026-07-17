import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Globe2, Loader2, LockKeyhole, Mail, Navigation, ShieldCheck } from "lucide-react";
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
    <section className="dn-driver-login-page" dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-driver-login-card">
        <div className="dn-driver-login-brand">
          <span className="dn-driver-login-icon">
            <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-full w-full rounded-2xl bg-white object-contain p-1" />
          </span>
          <div>
            <small>DAY NIGHT DELIVERY SERVICES</small>
            <h1>{isArabic ? "بوابة المندوب" : "Driver Operations Portal"}</h1>
            <p>{isArabic ? "طلباتك، موقعك الحي، وحالة التوصيل من هاتفك." : "Assigned orders, live location, and delivery status from your phone."}</p>
          </div>
        </div>

        <div className="dn-driver-login-security">
          <ShieldCheck className="h-5 w-5" />
          <span>{isArabic ? "دخول آمن ومشفّر لحساب المندوب" : "Secure encrypted driver access"}</span>
        </div>

        <form onSubmit={submit} className="dn-driver-login-form">
          <label>
            <span>{isArabic ? "البريد الإلكتروني" : "Email address"}</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            <span>{isArabic ? "كلمة المرور" : "Password"}</span>
            <div className="dn-driver-password-field">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>

          {error && <p className="dn-driver-login-error">{error}</p>}
          {notice && <p className="dn-driver-login-note">{notice}</p>}

          <button type="submit" disabled={busy} className="dn-driver-primary-button">
            {busy ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
            {isArabic ? "دخول إلى قسم المندوب" : "Open driver workspace"}
          </button>
        </form>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => void signInWithGoogle()} className="dn-driver-primary-button">
            <Globe2 className="h-4 w-4" /> Google
          </button>
          <button type="button" disabled={busy} onClick={() => void sendMagicLink()} className="dn-driver-primary-button">
            <Mail className="h-4 w-4" /> {isArabic ? "رابط بالبريد" : "Email link"}
          </button>
        </div>

        <p className="dn-driver-login-note">
          <Navigation className="inline h-4 w-4" /> {isArabic
            ? "بعد الدخول اضغط بدء الوردية واسمح بالموقع حتى تظهر حركتك للإدارة."
            : "After login, start your shift and allow location access so operations can follow your route."}
        </p>
      </div>
    </section>
  );
}
