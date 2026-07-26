import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Fingerprint, KeyRound, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { supabase } from "../../supabase";
import { isAdminUser } from "../../supabaseAdminOps";
import { adminSignInWithPasskey, SUPABASE_PASSKEYS_ENABLED } from "../../lib/supabasePasskeys";
import { markAdminStepUp, type AdminStepUpRequest } from "../../lib/adminStepUp";

type Factor = { id: string; status?: string };

function actionLabel(action: string, ar: boolean) {
  const labels: Record<string, [string, string]> = {
    delete_order: ["حذف طلب", "Delete an order"],
    change_salary: ["تغيير راتب", "Change salary"],
    create_employee: ["إضافة موظف إداري", "Create an employee"],
    modify_payroll: ["تعديل الرواتب والحركات", "Modify payroll"],
    void_payroll_entry: ["إلغاء حركة راتب", "Void a payroll entry"],
    modify_bank_details: ["تعديل بيانات بنكية", "Modify bank details"],
    change_permissions: ["تغيير الصلاحيات", "Change permissions"],
    export_sensitive_data: ["تصدير بيانات حساسة", "Export sensitive data"],
  };
  return (labels[action] || ["إجراء إداري حساس", "Sensitive admin action"])[ar ? 0 : 1];
}

function errorText(error: unknown, ar: boolean) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/code|challenge|otp|totp|verification/i.test(raw)) return ar ? "رمز التحقق غير صحيح أو انتهت صلاحيته." : "The verification code is invalid or expired.";
  if (/admin|identity/i.test(raw)) return ar ? "تعذر التحقق من حساب الإدارة." : "The administrator identity could not be verified.";
  if (/passkey/i.test(raw)) return ar ? "تعذر التحقق باستخدام Passkey." : "Passkey verification failed.";
  return ar ? "تعذر إكمال التحقق الإضافي." : "Step-up verification could not be completed.";
}

export default function AdminStepUpProvider({ children }: { children: ReactNode }) {
  const ar = document.documentElement.lang === "ar";
  const [request, setRequest] = useState<AdminStepUpRequest | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState<Factor | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = useMemo(() => request ? actionLabel(request.action, ar) : "", [ar, request]);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const next = (event as CustomEvent<AdminStepUpRequest>).detail;
      if (!next?.requestId) return;
      setRequest((current) => {
        if (current) {
          next.reject(new Error("admin_step_up_busy"));
          return current;
        }
        return next;
      });
      setPassword("");
      setCode("");
      setFactor(null);
      setChallengeId("");
      setError("");
    };
    window.addEventListener("daynight-admin-step-up-required", onRequest);
    return () => window.removeEventListener("daynight-admin-step-up-required", onRequest);
  }, []);

  useEffect(() => {
    if (!request || !supabase) return;
    const client = supabase;
    const activeRequest = request;
    let active = true;

    void (async () => {
      const user = await client.auth.getUser();
      if (!active) return;
      setEmail(user.data.user?.email || "");
      if (!activeRequest.requiresMfa) return;

      const factors = await client.auth.mfa.listFactors();
      if (!active) return;
      if (factors.error) {
        setError(errorText(factors.error, ar));
        return;
      }
      const raw = factors.data as any;
      const all = (Array.isArray(raw?.all) ? raw.all : [
        ...(Array.isArray(raw?.totp) ? raw.totp : []),
        ...(Array.isArray(raw?.phone) ? raw.phone : []),
      ]) as Factor[];
      const selected = all.find((item) => item?.id && (!item.status || item.status === "verified"));
      if (!selected) {
        setError(ar ? "الحساب يتطلب MFA ولا توجد وسيلة تحقق مفعلة." : "MFA is required, but no verified factor exists.");
        return;
      }
      setFactor(selected);
      const challenge = await client.auth.mfa.challenge({ factorId: selected.id });
      if (!active) return;
      if (challenge.error || !challenge.data?.id) {
        setError(errorText(challenge.error, ar));
        return;
      }
      setChallengeId(challenge.data.id);
    })();

    return () => { active = false; };
  }, [ar, request]);

  function reset() {
    setRequest(null);
    setPassword("");
    setCode("");
    setFactor(null);
    setChallengeId("");
    setError("");
    setBusy(false);
  }

  function cancel() {
    request?.reject(new Error("admin_step_up_cancelled"));
    reset();
  }

  async function finish() {
    if (!request || !supabase) throw new Error("admin_step_up_missing");
    const userResult = await supabase.auth.getUser();
    const user = userResult.data.user;
    if (userResult.error || !user?.id || user.id !== request.userId || !(await isAdminUser(user.id))) throw new Error("admin_role_required");
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (request.nextLevel === "aal2" && assurance.data?.currentLevel !== "aal2") throw new Error("admin_mfa_required");
    markAdminStepUp(user.id);
    const resolve = request.resolve;
    reset();
    resolve();
  }

  async function verifyMfa() {
    if (!supabase || !factor?.id || !challengeId || code.length < 6) return;
    setBusy(true); setError("");
    try {
      const verified = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId, code });
      if (verified.error) throw verified.error;
      await finish();
    } catch (cause) { setError(errorText(cause, ar)); setBusy(false); }
  }

  async function verifyPassword() {
    if (!supabase || !email || !password || !request) return;
    setBusy(true); setError("");
    try {
      const signed = await supabase.auth.signInWithPassword({ email, password });
      setPassword("");
      if (signed.error || signed.data.user?.id !== request.userId) throw signed.error || new Error("identity_changed");
      await finish();
    } catch (cause) { setPassword(""); setError(errorText(cause, ar)); setBusy(false); }
  }

  async function verifyPasskey() {
    if (!request) return;
    setBusy(true); setError("");
    try {
      const user = await adminSignInWithPasskey();
      if (!user?.id || user.id !== request.userId) throw new Error("identity_changed");
      await finish();
    } catch (cause) { setError(errorText(cause, ar)); setBusy(false); }
  }

  return <>
    {children}
    {request && <div className="dn-admin-step-up-backdrop" role="dialog" aria-modal="true" dir={ar ? "rtl" : "ltr"}>
      <section className="dn-admin-step-up-card">
        <button type="button" className="dn-admin-step-up-close" onClick={cancel} aria-label={ar ? "إلغاء" : "Cancel"}><X /></button>
        <span className="dn-admin-step-up-icon">{request.requiresMfa ? <ShieldAlert /> : <ShieldCheck />}</span>
        <h2>{ar ? "تحقق أمني إضافي" : "Additional security verification"}</h2>
        <strong>{title}</strong>
        <p>{request.requiresMfa ? (ar ? "هذا الإجراء يتطلب MFA ‏AAL2 ورمزًا حديثًا." : "This action requires MFA AAL2 and a fresh code.") : (ar ? "أعد إثبات هويتك. يستمر التحقق لمدة دقيقتين فقط." : "Re-verify your identity. Verification lasts two minutes only.")}</p>
        {request.requiresMfa ? <div className="dn-admin-step-up-form">
          <label>{ar ? "رمز تطبيق المصادقة" : "Authenticator code"}</label>
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="000000" dir="ltr" />
          <button type="button" className="primary" onClick={() => void verifyMfa()} disabled={busy || !factor || !challengeId || code.length < 6}>{busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{ar ? "تأكيد MFA" : "Verify MFA"}</button>
        </div> : <div className="dn-admin-step-up-form">
          {SUPABASE_PASSKEYS_ENABLED && <button type="button" className="primary" onClick={() => void verifyPasskey()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Fingerprint />}{ar ? "التحقق باستخدام Passkey" : "Verify with passkey"}</button>}
          <label>{ar ? "كلمة مرور الإدارة" : "Admin password"}</label>
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button type="button" className="secondary" onClick={() => void verifyPassword()} disabled={busy || !password}>{busy ? <Loader2 className="animate-spin" /> : <KeyRound />}{ar ? "إعادة التحقق" : "Re-authenticate"}</button>
        </div>}
        {error && <div className="dn-admin-step-up-error" role="alert">{error}</div>}
      </section>
      <style>{`.dn-admin-step-up-backdrop{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center;overflow:auto;padding:max(18px,env(safe-area-inset-top)) 14px max(22px,env(safe-area-inset-bottom));background:rgba(2,10,24,.86);backdrop-filter:blur(12px)}.dn-admin-step-up-card{position:relative;width:min(100%,480px);margin:auto;padding:30px 20px;border:1px solid rgba(212,175,55,.52);border-radius:28px;background:linear-gradient(155deg,#fff,#eef5ff);color:#071a33;box-shadow:0 30px 100px rgba(0,0,0,.5);text-align:center}.dn-admin-step-up-close{position:absolute;top:13px;right:13px;width:44px;height:44px;border:1px solid #dce5f1;border-radius:14px;background:#fff}.dn-admin-step-up-backdrop[dir=rtl] .dn-admin-step-up-close{right:auto;left:13px}.dn-admin-step-up-icon{display:grid;place-items:center;width:66px;height:66px;margin:0 auto 15px;border-radius:22px;background:#071a33;color:#d4af37}.dn-admin-step-up-card h2{margin:0;font-size:25px}.dn-admin-step-up-card>strong{display:inline-block;margin-top:8px;padding:7px 11px;border-radius:12px;background:#fff5d6;color:#8b6500;font-size:12px}.dn-admin-step-up-card p{color:#52647a;font-size:12px;line-height:1.8}.dn-admin-step-up-form{display:flex;flex-direction:column;gap:10px;text-align:start}.dn-admin-step-up-form label{font-size:11px;font-weight:900}.dn-admin-step-up-form input{min-height:48px;border:1px solid #cad6e5;border-radius:14px;padding:10px 13px;font-size:16px}.dn-admin-step-up-form button{display:flex;align-items:center;justify-content:center;gap:9px;min-height:50px;border-radius:14px;padding:10px 14px;font-weight:950}.dn-admin-step-up-form .primary{border:0;background:#d4af37;color:#071a33}.dn-admin-step-up-form .secondary{border:1px solid #cbd7e6;background:#fff;color:#071a33}.dn-admin-step-up-error{margin-top:12px;padding:11px;border:1px solid #fecdd3;border-radius:13px;background:#fff1f2;color:#b42318;font-size:12px;font-weight:800}`}</style>
    </div>}
  </>;
}
