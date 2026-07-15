import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, Navigation, ShieldCheck } from "lucide-react";
import { supabase } from "../../supabase";

export default function DriverLogin({ isArabic }: { isArabic: boolean }) {
  const [email, setEmail] = useState("driver@daynightae.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    if (!supabase) {
      setError(isArabic ? "إعداد Supabase غير متاح." : "Supabase is not configured.");
      setBusy(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setError(isArabic ? "بيانات الدخول غير صحيحة أو الحساب غير مفعل." : authError.message);
    }
    setBusy(false);
  }

  return (
    <section className="dn-driver-login-page" dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-driver-login-card">
        <div className="dn-driver-login-brand">
          <span className="dn-driver-login-icon"><Navigation /></span>
          <div>
            <small>DAY NIGHT DELIVERY SERVICES</small>
            <h1>{isArabic ? "بوابة المندوب" : "Driver Operations Portal"}</h1>
            <p>{isArabic ? "طلباتك، موقعك الحي، وحالة التوصيل من هاتفك." : "Assigned orders, live GPS and delivery status from your phone."}</p>
          </div>
        </div>

        <div className="dn-driver-login-security">
          <ShieldCheck className="h-5 w-5" />
          <span>{isArabic ? "الدخول محمي بحساب Supabase المعتمد" : "Protected by approved Supabase authentication"}</span>
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

          <button type="submit" disabled={busy} className="dn-driver-primary-button">
            {busy ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
            {isArabic ? "دخول إلى قسم المندوب" : "Open driver workspace"}
          </button>
        </form>

        <p className="dn-driver-login-note">
          {isArabic
            ? "بعد الدخول اضغط بدء الوردية واسمح للموقع حتى تظهر حركتك للإدارة."
            : "After login, start your shift and allow location access so operations can follow your route."}
        </p>
      </div>
    </section>
  );
}
