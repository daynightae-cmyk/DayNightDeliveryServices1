import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, Loader2, LogOut, ShieldCheck, Trash2, X } from "lucide-react";
import { supabase } from "../../supabase";
import {
  SUPABASE_PASSKEYS_ENABLED,
  listAdminPasskeys,
  registerAdminPasskey,
  removeAdminPasskey,
  type AdminPasskeyRecord,
} from "../../lib/supabasePasskeys";

function formatDate(value: string | undefined, isArabic: boolean) {
  if (!value) return isArabic ? "غير متاح" : "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(isArabic ? "ar-AE" : "en-AE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminSecuritySettings() {
  const isArabic = document.documentElement.lang === "ar";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [passkeys, setPasskeys] = useState<AdminPasskeyRecord[]>([]);
  const [aal, setAal] = useState("");

  async function refresh() {
    if (!SUPABASE_PASSKEYS_ENABLED || !supabase) return;
    setBusy(true);
    setError("");
    try {
      const [records, assurance] = await Promise.all([
        listAdminPasskeys(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      setPasskeys(records);
      setAal(assurance.data?.currentLevel || "aal1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "security_settings_unavailable");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  if (!SUPABASE_PASSKEYS_ENABLED) return null;

  async function register() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await registerAdminPasskey();
      setNotice(isArabic ? "تمت إضافة Passkey لهذا الجهاز بنجاح." : "A passkey was added for this device.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "passkey_registration_failed");
      setBusy(false);
    }
  }

  async function remove(passkeyId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await removeAdminPasskey(passkeyId);
      setNotice(isArabic ? "تم حذف Passkey." : "The passkey was removed.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "passkey_removal_failed");
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    setBusy(true);
    setError("");
    const { error: signOutError } = await supabase?.auth.signOut({ scope: "global" }) || { error: new Error("supabase_unavailable") };
    if (signOutError) {
      setError(signOutError.message);
      setBusy(false);
      return;
    }
    window.location.assign("/auth");
  }

  return (
    <>
      <button type="button" className="dn-admin-passkey-trigger" onClick={() => setOpen(true)} aria-label={isArabic ? "الأمان وتسجيل الدخول" : "Security and sign-in"}>
        <ShieldCheck />
      </button>
      {open && (
        <div className="dn-admin-passkey-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
          <section className="dn-admin-passkey-card">
            <button type="button" className="dn-admin-passkey-close" onClick={() => setOpen(false)} aria-label={isArabic ? "إغلاق" : "Close"}><X /></button>
            <span className="dn-admin-passkey-icon"><Fingerprint /></span>
            <h2>{isArabic ? "الأمان وتسجيل الدخول" : "Security and sign-in"}</h2>
            <p>{isArabic ? "أضف Windows Hello أو بصمة الهاتف أو PIN الجهاز أو مفتاح أمان. لا يمكن التسجيل إلا بعد التحقق من حساب الإدارة." : "Add Windows Hello, phone biometrics, device PIN, or a security key. Registration requires a verified admin session."}</p>

            <div className="dn-admin-passkey-aal"><ShieldCheck /><span>{isArabic ? "مستوى الجلسة الحالي" : "Current assurance level"}</span><strong>{aal || "—"}</strong></div>
            <button type="button" className="dn-admin-passkey-primary" onClick={() => void register()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
              {isArabic ? "إضافة بصمة أو Passkey لهذا الجهاز" : "Add a passkey for this device"}
            </button>

            {notice && <div className="dn-admin-passkey-notice">{notice}</div>}
            {error && <div className="dn-admin-passkey-error" role="alert">{error}</div>}

            <div className="dn-admin-passkey-list">
              <h3>{isArabic ? "الأجهزة وPasskeys المسجلة" : "Registered devices and passkeys"}</h3>
              {!passkeys.length && !busy && <p>{isArabic ? "لا توجد Passkeys مسجلة لهذا الحساب." : "No passkeys are registered for this account."}</p>}
              {passkeys.map((passkey) => (
                <article key={passkey.id}>
                  <div><strong>{passkey.friendly_name || (isArabic ? "Passkey بدون اسم" : "Unnamed passkey")}</strong><small>{isArabic ? "أضيفت" : "Created"}: {formatDate(passkey.created_at, isArabic)}{passkey.last_used_at ? ` · ${isArabic ? "آخر استخدام" : "Last used"}: ${formatDate(passkey.last_used_at, isArabic)}` : ""}</small></div>
                  <button type="button" onClick={() => void remove(passkey.id)} disabled={busy} aria-label={isArabic ? "حذف Passkey" : "Delete passkey"}><Trash2 /></button>
                </article>
              ))}
            </div>

            <button type="button" className="dn-admin-passkey-danger" onClick={() => void signOutEverywhere()} disabled={busy}><LogOut />{isArabic ? "تسجيل الخروج من جميع الأجهزة" : "Sign out from all devices"}</button>
            <small className="dn-admin-passkey-experimental">{isArabic ? "ميزة Passkeys تجريبية ومحمية بعلم VITE_ENABLE_SUPABASE_PASSKEYS. تسجيل الدخول التقليدي وMFA يظلان متاحين دائمًا." : "Passkeys are experimental and protected by VITE_ENABLE_SUPABASE_PASSKEYS. Password sign-in and MFA always remain available."}</small>
          </section>
        </div>
      )}
      <style>{`
        .dn-admin-passkey-trigger{position:fixed;z-index:2147481000;right:20px;bottom:20px;display:grid;place-items:center;width:50px;height:50px;border:1px solid rgba(212,175,55,.6);border-radius:16px;background:linear-gradient(145deg,#071a33,#0b4db2);color:#d4af37;box-shadow:0 18px 45px rgba(0,0,0,.35)}.dn-admin-passkey-trigger svg{width:23px}.dn-admin-passkey-backdrop{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;overflow:auto;padding:max(18px,env(safe-area-inset-top)) 14px max(22px,env(safe-area-inset-bottom));background:rgba(2,11,26,.82);backdrop-filter:blur(12px)}.dn-admin-passkey-card{position:relative;width:min(100%,620px);margin:auto;padding:30px 22px;border:1px solid rgba(212,175,55,.48);border-radius:28px;background:linear-gradient(155deg,#fff,#eef5ff);color:#071a33;box-shadow:0 30px 100px rgba(0,0,0,.5);text-align:center}.dn-admin-passkey-card h2{margin:0;font-size:26px;font-weight:950}.dn-admin-passkey-card>p{color:#52647a;font-size:13px;line-height:1.8}.dn-admin-passkey-close{position:absolute;top:14px;right:14px;display:grid;place-items:center;width:44px;height:44px;border:1px solid #d9e1ec;border-radius:14px;background:#fff;color:#071a33}.dn-admin-passkey-backdrop[dir=rtl] .dn-admin-passkey-close{right:auto;left:14px}.dn-admin-passkey-icon{display:grid;place-items:center;width:66px;height:66px;margin:0 auto 15px;border-radius:22px;background:#071a33;color:#d4af37}.dn-admin-passkey-icon svg{width:31px}.dn-admin-passkey-primary,.dn-admin-passkey-danger{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:50px;border:0;border-radius:15px;padding:10px 15px;font-weight:900}.dn-admin-passkey-primary{background:linear-gradient(135deg,#d4af37,#f5ca4c);color:#071a33}.dn-admin-passkey-danger{margin-top:15px;border:1px solid rgba(190,18,60,.18);background:#fff1f2;color:#9f1239}.dn-admin-passkey-primary svg,.dn-admin-passkey-danger svg{width:18px}.dn-admin-passkey-aal{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:8px;margin:15px 0;padding:13px;border:1px solid #dce5f1;border-radius:15px;background:#fff;text-align:start}.dn-admin-passkey-aal svg{color:#0b4db2}.dn-admin-passkey-aal span{font-size:12px;font-weight:800}.dn-admin-passkey-aal strong{color:#966d00}.dn-admin-passkey-list{margin-top:18px;text-align:start}.dn-admin-passkey-list h3{font-size:14px}.dn-admin-passkey-list>p{color:#667085;font-size:12px}.dn-admin-passkey-list article{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:9px;padding:13px;border:1px solid #dce5f1;border-radius:15px;background:#fff}.dn-admin-passkey-list article div{min-width:0}.dn-admin-passkey-list article strong{display:block;font-size:12px;overflow-wrap:anywhere}.dn-admin-passkey-list article small{display:block;margin-top:4px;color:#667085;font-size:10px;line-height:1.6}.dn-admin-passkey-list article button{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border:1px solid #fecdd3;border-radius:13px;background:#fff1f2;color:#be123c}.dn-admin-passkey-list article button svg{width:18px}.dn-admin-passkey-error,.dn-admin-passkey-notice{margin-top:12px;padding:11px;border-radius:13px;font-size:12px;font-weight:800}.dn-admin-passkey-error{border:1px solid #fecdd3;background:#fff1f2;color:#b42318}.dn-admin-passkey-notice{border:1px solid #a7f3d0;background:#ecfdf5;color:#047857}.dn-admin-passkey-experimental{display:block;margin-top:13px;color:#667085;font-size:10px;line-height:1.7}@media(max-width:600px){.dn-admin-passkey-trigger{right:14px;bottom:78px}.dn-admin-passkey-card{padding:26px 16px}.dn-admin-passkey-list article{align-items:flex-start}}
      `}</style>
    </>
  );
}
