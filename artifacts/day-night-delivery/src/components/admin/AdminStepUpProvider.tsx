import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Fingerprint, KeyRound, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { supabase } from "../../supabase";
import { isAdminUser } from "../../supabaseAdminOps";
import { adminSignInWithPasskey, SUPABASE_PASSKEYS_ENABLED } from "../../lib/supabasePasskeys";
import { markAdminStepUp, type AdminStepUpRequest } from "../../lib/adminStepUp";

function actionLabel(action: string, isArabic: boolean) {
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
  const pair = labels[action] || ["إجراء إداري حساس", "Sensitive admin action"];
  return pair[isArabic ? 0 : 1];
}

function friendlyError(value: unknown, isArabic: boolean) {
  const raw = value instanceof Error ? value.message : String(value || "");
  if (/invalid.*code|challenge|otp|totp|verification/i.test(raw)) {
    return isArabic ? "رمز التحقق غير صحيح أو انتهت صلاحيته." : "The verification code is invalid or expired.";
  }
  if (/admin_role_required|not.*admin/i.test(raw)) {
    return isArabic ? "هذا الحساب لا يمتلك صلاحية الإدارة." : "This account does not have administrator access.";
  }
  if (/passkey/i.test(raw)) {
    return isArabic ? "تعذر التحقق باستخدام Passkey. استخدم كلمة المرور أو MFA." : "Passkey verification failed. Use password or MFA.";
  }
  return isArabic ? "تعذر إكمال التحقق الإضافي. أعد المحاولة." : "Step-up verification could not be completed. Try again.";
}

type Factor = { id: string; factor_type?: string; status?: string; friendly_name?: string };

export default function AdminStepUpProvider({ children }: { children: ReactNode }) {
  const isArabic = document.documentElement.lang === "ar";
  const [request, setRequest] = useState<AdminStepUpRequest | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState<Factor | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requiresMfa = Boolean(request?.requiresMfa);
  const title = useMemo(() => request ? actionLabel(request.action, isArabic) : "", [isArabic, request]);

  useEffect(() => {
    const listener = (event: CustomEvent<AdminStepUpRequest>) => {
      const next = event.detail;
      if (!next?.requestId || !next.resolve || !next.reject) return;
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
    window.addEventListener("daynight-admin-step-up-required", listener as EventListener);
    return () => window.removeEventListener("daynight-admin-step-up-required", listener as EventListener);
  }, []);

  useEffect(() => {
    const client = supabase;
    const activeRequest = request;
    if (!activeRequest || !client) return;
    let active = true;
    async function prepare() {
      const userResult = await client.auth.getUser();
      if (!active) return;
      setEmail(userResult.data.user?.email || "");
      if (!activeRequest.requiresMfa) return;
      const factors = await client.auth.mfa.listFactors();
      if (!active) return;
      if (factors.error) {
        setError(friendlyError(factors.error, isArabic));
        return;
      }
      const raw = factors.data as any;
      const all = (Array.isArray(raw?.all) ? raw.all : [
        ...(Array.isArray(raw?.totp) ? raw.totp : []),
        ...(Array.isArray(raw?.phone) ? raw.phone : []),
      ]) as Factor[];
      const verified = all.find((item) => item?.id && (!item.status || item.status === "verified"));
      if (!verified) {
        setError(isArabic ? "الحساب يتطلب MFA ولكن لا توجد وسيلة تحقق مفعلة. افتح إعدادات الحساب وأضف TOTP أولًا." : "MFA is required but no verified factor exists. Add a TOTP factor in account settings first.");
        return;
      }
      setFactor(verified);
      const challenged = await client.auth.mfa.challenge({ factorId: verified.id });
      if (!active) return;
      if (challenged.error || !challenged.data?.id) {
        setError(friendlyError(challenged.error, isArabic));
        return;
      }
      setChallengeId(challenged.data.id);
    }
    void prepare();
    return () => { active = false; };
  }, [isArabic, request]);

  function close(reason = "admin_step_up_cancelled") {
    request?.reject(new Error(reason));
    setRequest(null);
    setPassword("");
    setCode("");
    setFactor(null);
    setChallengeId("");
    setError("");
    setBusy(false);
  }

  async function finishVerification() {
    const client = supabase;
    const activeRequest = request;
    if (!activeRequest || !client) return;
    const userResult = await client.auth.getUser();
    const user = userResult.data.user;
    if (userResult.error || !user?.id || user.id !== activeRequest.userId || !(await isAdminUser(user.id))) {
      throw new Error("admin_role_required");
    }
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (activeRequest.nextLevel === "aal2" && assurance.data?.currentLevel !== "aal2") {
      throw new Error("admin_mfa_required");
    }
    markAdminStepUp(user.id);
    const resolve = activeRequest.resolve;
    setRequest(null);
    setPassword("");
    setCode("");
    setFactor(null);
    setChallengeId("");
    setError("");
    setBusy(false);
    resolve();
  }

  async function verifyMfa() {
    const client = supabase;
    if (!client || !factor?.id || !challengeId || !code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await client.auth.mfa.verify({
        factorId: factor.id,
        challengeId,
        code: code.trim(),
      });
      if (result.error) throw result.error;
      await finishVerification();
    } catch (cause) {
      setError(friendlyError(cause, isArabic));
      setBusy(false);
    }
  }

  async function verifyPassword() {
    const client = supabase;
    if (!client || !email || !password) return;
    setBusy(true);
    setError("");
    try {
      const result = await client.auth.signInWithPassword({ email, password });
      setPassword("");
      if (result.error || result.data.user?.id !== request?.userId) throw result.error || new Error("identity_changed");
      await finishVerification();
    } catch (cause) {
      setPassword("");
      setError(friendlyError(cause, isArabic));
      setBusy(false);
    }
  }

  async function verifyPasskey() {
    setBusy(true);
    setError("");
    try {
      const user = await adminSignInWithPasskey();
      if (!user?.id || user.id !== request?.userId) throw new Error("identity_changed");
      await finishVerification();
    } catch (cause) {
      setError(friendlyError(cause, isArabic));
      setBusy(false);
    }
  }

  return (
    <>
      {children}
      {request && (
        <div className="dn-admin-step-up-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
          <section className="dn-admin-step-up-card">
            <button type="button" className="dn-admin-step-up-close" onClick={() => close()} aria-label={isArabic ? "إلغاء" : "Cancel"}><X /></button>
            <span className="dn-admin-step-up-icon">{requiresMfa ? <ShieldAlert /> : <ShieldCheck />}</span>
            <h2>{isArabic ? "تحقق أمني إضافي" : "Additional security verification"}</h2>
            <strong className="dn-admin-step-up-action">{title}</strong>
            <p>{requiresMfa
              ? (isArabic ? "هذا الإجراء يتطلب مستوى MFA ‏AAL2 ورمزًا حديثًا." : "This action requires MFA assurance level AAL2 and a fresh code.")
              : (isArabic ? "أعد إثبات هويتك قبل تنفيذ هذا الإجراء الحساس. يستمر التحقق لمدة دقيقتين فقط." : "Re-verify your identity before this sensitive action. Verification remains valid for two minutes only.")}</p>

            {requiresMfa ? (
              <div className="dn-admin-step-up-form">
                <label>{isArabic ? "رمز تطبيق المصادقة" : "Authenticator code"}</label>
                <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="000000" dir="ltr" />
                <button type="button" className="dn-admin-step-up-primary" onClick={() => void verifyMfa()} disabled={busy || !factor || !challengeId || code.length < 6}>{busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{isArabic ? "تأكيد MFA" : "Verify MFA"}</button>
              </div>
            ) : (
              <div className="dn-admin-step-up-form">
                {SUPABASE_PASSKEYS_ENABLED && <button type="button" className="dn-admin-step-up-primary" onClick={() => void verifyPasskey()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Fingerprint />}{isArabic ? "التحقق باستخدام Passkey" : "Verify with passkey"}</button>}
                <div className="dn-admin-step-up-divider"><span>{isArabic ? "أو كلمة المرور" : "or password"}</span></div>
                <label>{isArabic ? "كلمة مرور الإدارة" : "Admin password"}</label>
                <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="dn-admin-step-up-secondary" onClick={() => void verifyPassword()} disabled={busy || !password}>{busy ? <Loader2 className="animate-spin" /> : <KeyRound />}{isArabic ? "إعادة التحقق" : "Re-authenticate"}</button>
              </div>
            )}

            {error && <div className="dn-admin-step-up-error" role="alert">{error}</div>}
          </section>
          <style>{`
            .dn-admin-step-up-backdrop{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center;overflow:auto;padding:max(18px,env(safe-area-inset-top)) 14px max(22px,env(safe-area-inset-bottom));background:rgba(2,10,24,.86);backdrop-filter:blur(12px)}.dn-admin-step-up-card{position:relative;width:min(100%,480px);margin:auto;padding:30px 20px;border:1px solid rgba(212,175,55,.52);border-radius:28px;background:linear-gradient(155deg,#fff,#eef5ff);color:#071a33;box-shadow:0 30px 100px rgba(0,0,0,.5);text-align:center}.dn-admin-step-up-close{position:absolute;top:13px;right:13px;display:grid;place-items:center;width:44px;height:44px;border:1px solid #dce5f1;border-radius:14px;background:#fff;color:#071a33}.dn-admin-step-up-backdrop[dir=rtl] .dn-admin-step-up-close{right:auto;left:13px}.dn-admin-step-up-icon{display:grid;place-items:center;width:66px;height:66px;margin:0 auto 15px;border-radius:22px;background:#071a33;color:#d4af37}.dn-admin-step-up-icon svg{width:31px}.dn-admin-step-up-card h2{margin:0;font-size:25px;font-weight:950}.dn-admin-step-up-action{display:inline-block;margin-top:8px;padding:7px 11px;border-radius:12px;background:#fff5d6;color:#8b6500;font-size:12px}.dn-admin-step-up-card p{color:#52647a;font-size:12px;line-height:1.8}.dn-admin-step-up-form{display:flex;flex-direction:column;gap:10px;text-align:start}.dn-admin-step-up-form label{font-size:11px;font-weight:900}.dn-admin-step-up-form input{width:100%;min-height:48px;border:1px solid #cad6e5;border-radius:14px;padding:10px 13px;background:#fff;color:#071a33;font-size:16px;outline:none}.dn-admin-step-up-form input:focus{border-color:#0b4db2;box-shadow:0 0 0 3px rgba(11,77,178,.12)}.dn-admin-step-up-primary,.dn-admin-step-up-secondary{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:50px;border-radius:14px;padding:10px 14px;font:inherit;font-size:13px;font-weight:950}.dn-admin-step-up-primary{border:0;background:linear-gradient(135deg,#d4af37,#f4cb54);color:#071a33}.dn-admin-step-up-secondary{border:1px solid #cbd7e6;background:#fff;color:#071a33}.dn-admin-step-up-primary svg,.dn-admin-step-up-secondary svg{width:18px}.dn-admin-step-up-divider{display:flex;align-items:center;gap:9px;color:#667085;font-size:10px;font-weight:800}.dn-admin-step-up-divider:before,.dn-admin-step-up-divider:after{content:"";flex:1;height:1px;background:#dce5f1}.dn-admin-step-up-error{margin-top:12px;padding:11px;border:1px solid #fecdd3;border-radius:13px;background:#fff1f2;color:#b42318;font-size:12px;font-weight:800}
          `}</style>
        </div>
      )}
    </>
  );
}
