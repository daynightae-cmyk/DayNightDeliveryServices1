import { useState, type FormEvent } from "react";
import { supabase } from "../../supabase";

type NativeRole = "driver" | "merchant";

export default function NativeRoleLogin({ role, isArabic }: { role: NativeRole; isArabic: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const roleLabel = role === "driver"
    ? (isArabic ? "المندوب" : "Driver")
    : (isArabic ? "التاجر" : "Merchant");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError(isArabic ? "خدمة تسجيل الدخول غير متاحة حالياً." : "Sign-in is currently unavailable.");
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (authError) {
      setError(isArabic ? "بيانات الدخول غير صحيحة أو الحساب غير مفعل." : "The sign-in details are incorrect or the account is inactive.");
    }
    setBusy(false);
  }

  return (
    <section
      className={`dn-native-role-login dn-native-role-login--${role}`}
      data-native-role-login={role}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <style>{`
        html[data-native-shell],html[data-native-shell] body,html[data-native-shell] #root{width:100%!important;min-width:0!important;min-height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#071a33!important;}
        .dn-native-role-login,.dn-native-role-login *{box-sizing:border-box!important;animation:none!important;transition:none!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transform:none!important;mix-blend-mode:normal!important;}
        .dn-native-role-login{position:fixed!important;inset:0!important;z-index:2147483640!important;display:block!important;width:100vw!important;height:100dvh!important;min-height:100dvh!important;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))!important;overflow-x:hidden!important;overflow-y:auto!important;background:#eef4fc!important;color:#071a33!important;font-family:Cairo,Arial,sans-serif!important;opacity:1!important;visibility:visible!important;}
        .dn-native-role-login-card{position:relative!important;z-index:2!important;display:flex!important;flex-direction:column!important;width:100%!important;max-width:520px!important;min-height:calc(100dvh - 28px)!important;margin:0 auto!important;padding:24px 18px!important;border:1px solid rgba(7,26,51,.14)!important;border-radius:26px!important;background:#fff!important;color:#071a33!important;box-shadow:0 18px 55px rgba(7,26,51,.16)!important;opacity:1!important;visibility:visible!important;overflow:visible!important;}
        .dn-native-role-brand{display:flex!important;align-items:center!important;gap:13px!important;margin-bottom:24px!important;}
        .dn-native-role-mark{display:grid!important;place-items:center!important;width:58px!important;height:58px!important;flex:0 0 58px!important;border:2px solid #d4af37!important;border-radius:18px!important;background:#071a33!important;color:#f4d96f!important;font:900 20px/1 Arial,sans-serif!important;}
        .dn-native-role-brand small{display:block!important;margin-bottom:3px!important;color:#9a7204!important;font-size:9px!important;font-weight:900!important;letter-spacing:.13em!important;}
        .dn-native-role-brand h1{margin:0!important;color:#071a33!important;font-size:25px!important;line-height:1.2!important;font-weight:900!important;}
        .dn-native-role-copy{margin:0 0 22px!important;color:#52647a!important;font-size:13px!important;line-height:1.8!important;font-weight:700!important;}
        .dn-native-role-form{display:flex!important;flex-direction:column!important;gap:15px!important;width:100%!important;}
        .dn-native-role-form label{display:flex!important;flex-direction:column!important;gap:7px!important;width:100%!important;}
        .dn-native-role-form label span{color:#071a33!important;font-size:12px!important;font-weight:900!important;}
        .dn-native-role-form input{display:block!important;width:100%!important;min-height:56px!important;margin:0!important;padding:0 15px!important;border:1px solid rgba(7,26,51,.18)!important;border-radius:15px!important;outline:none!important;background:#fff!important;color:#071a33!important;-webkit-text-fill-color:#071a33!important;font-size:16px!important;font-weight:700!important;opacity:1!important;}
        .dn-native-role-form input:focus{border-color:#0b4db2!important;box-shadow:0 0 0 3px rgba(11,77,178,.12)!important;}
        .dn-native-role-submit{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-height:58px!important;margin-top:3px!important;border:0!important;border-radius:15px!important;background:#0b4db2!important;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:15px!important;font-weight:900!important;opacity:1!important;}
        .dn-native-role-submit:disabled{background:#91a8c3!important;color:#fff!important;}
        .dn-native-role-error{margin:0!important;padding:11px 12px!important;border:1px solid rgba(220,38,38,.22)!important;border-radius:13px!important;background:#fff1f2!important;color:#b42318!important;font-size:12px!important;line-height:1.7!important;font-weight:800!important;}
        .dn-native-role-trust{display:block!important;width:100%!important;margin:auto 0 0!important;padding:24px 0 0!important;border:0!important;background:transparent!important;color:#667085!important;font-size:11px!important;line-height:1.8!important;font-weight:700!important;text-align:start!important;}
        .dn-native-role-trust strong{display:block!important;margin-bottom:4px!important;color:#071a33!important;font-size:12px!important;}
        @media(min-width:700px){.dn-native-role-login{display:grid!important;place-items:center!important;padding:24px!important;}.dn-native-role-login-card{min-height:0!important;padding:32px!important;}}
      `}</style>

      <main className="dn-native-role-login-card" data-native-role-card={role}>
        <header className="dn-native-role-brand">
          <span className="dn-native-role-mark" aria-hidden="true">DN</span>
          <div>
            <small>DAY NIGHT DELIVERY SERVICES</small>
            <h1>{isArabic ? `دخول ${roleLabel}` : `${roleLabel} sign in`}</h1>
          </div>
        </header>

        <p className="dn-native-role-copy">
          {isArabic
            ? "استخدم البريد وكلمة المرور المعتمدين لدى عمليات داي نايت. بعد الدخول ستفتح مساحة العمل الحقيقية مباشرة."
            : "Use the email and password approved by DAY NIGHT operations. Your live workspace opens immediately after sign-in."}
        </p>

        <form className="dn-native-role-form" onSubmit={submit}>
          <label>
            <span>{isArabic ? "البريد الإلكتروني" : "Email address"}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              inputMode="email"
              placeholder={isArabic ? "البريد المعتمد" : "Approved email"}
              required
            />
          </label>

          <label>
            <span>{isArabic ? "كلمة المرور" : "Password"}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder={isArabic ? "كلمة المرور" : "Password"}
              required
            />
          </label>

          {error && <p className="dn-native-role-error" role="alert">{error}</p>}

          <button className="dn-native-role-submit" type="submit" disabled={busy || !email.trim() || !password}>
            {busy
              ? (isArabic ? "جاري تسجيل الدخول..." : "Signing in...")
              : (isArabic ? "فتح مساحة العمل" : "Open workspace")}
          </button>
        </form>

        <div className="dn-native-role-trust">
          <strong>{isArabic ? "اتصال آمن ومباشر" : "Secure live connection"}</strong>
          {isArabic
            ? "لا توجد بيانات تجريبية داخل التطبيق. الطلبات والمبالغ والصلاحيات تُقرأ من الحساب الحقيقي."
            : "The app contains no demo records. Orders, balances, and permissions come from the live account."}
        </div>
      </main>
    </section>
  );
}
