import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";
import { supabase } from "../../supabase";
import localAssets, { withRemoteFallback } from "../../data/localAssets";
import {
  NATIVE_BIOMETRIC_POLICY,
  disableNativeBiometric,
  enableNativeBiometric,
  getNativeBiometricAvailability,
  hasNativeBiometricEnrollment,
  isNativeRoleShell,
  restoreNativeBiometricSession,
  validateNativeRole,
  type NativeBiometricAvailability,
  type NativeBiometricRole,
} from "../../lib/nativeBiometric";
import "../../styles/dn-native-biometric.css";

const EMPTY_AVAILABILITY: NativeBiometricAvailability = {
  available: false,
  enrolled: false,
  deviceCredentialAvailable: false,
};

function errorText(code: string | undefined, isArabic: boolean) {
  const messages: Record<string, [string, string]> = {
    biometric_cancelled: ["تم إلغاء التحقق.", "Authentication was cancelled."],
    biometric_authentication_failed: ["لم يتم التعرف على البصمة.", "Biometric authentication failed."],
    biometric_locked: ["تم قفل المستشعر مؤقتًا. استخدم قفل الجهاز أو كلمة المرور.", "The sensor is temporarily locked. Use device lock or password."],
    biometric_not_enrolled: ["أضف بصمة أو وجهًا من إعدادات الهاتف أولًا.", "Add a fingerprint or face in phone settings first."],
    secure_lock_not_configured: ["أضف بصمة أو قفل شاشة من إعدادات الهاتف أولًا.", "Configure biometrics or a secure device lock first."],
    biometric_hardware_unavailable: ["الجهاز لا يدعم الدخول البيومتري.", "This device does not support biometric sign-in."],
    biometric_temporarily_unavailable: ["الحماية البيومترية غير متاحة مؤقتًا.", "Biometric protection is temporarily unavailable."],
    biometric_session_expired: ["انتهت صلاحية الدخول الآمن. يرجى تسجيل الدخول مرة أخرى.", "Secure sign-in expired. Please sign in again."],
    biometric_session_revoked: ["تم إبطال جلسة الدخول الآمن. يرجى تسجيل الدخول مرة أخرى.", "The secure session was revoked. Please sign in again."],
    biometric_key_invalidated: ["تغيرت حماية الجهاز. فعّل الدخول بالبصمة من جديد.", "Device protection changed. Enable biometric sign-in again."],
    role_binding_mismatch: ["الحساب لا يطابق نوع هذا التطبيق.", "This account does not match the application role."],
    account_binding_mismatch: ["تم تغيير الحساب. استخدم تسجيل الدخول العادي.", "The account changed. Use normal sign-in."],
    driver_role_or_status_invalid: ["هذا الحساب ليس حساب مندوب معتمدًا.", "This is not an approved driver account."],
    merchant_role_or_status_invalid: ["هذا الحساب ليس حساب تاجر معتمدًا.", "This is not an approved merchant account."],
    refresh_token_invalid: ["انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.", "The session expired. Please sign in again."],
    native_biometric_timeout: ["انتهت مهلة التحقق. أعد المحاولة.", "Authentication timed out. Try again."],
  };
  const pair = messages[code || ""] || ["تعذر إكمال الدخول الآمن. استخدم كلمة المرور.", "Secure sign-in could not be completed. Use your password."];
  return pair[isArabic ? 0 : 1];
}

function roleName(role: NativeBiometricRole, isArabic: boolean) {
  if (role === "driver") return isArabic ? "داي نايت للمندوب" : "DAY NIGHT Driver";
  return isArabic ? "داي نايت للتاجر" : "DAY NIGHT Merchant";
}

export default function NativeBiometricBoundary({
  role,
  children,
}: {
  role: NativeBiometricRole;
  children: ReactNode;
}) {
  const isArabic = document.documentElement.lang === "ar" || new URLSearchParams(window.location.search).get("lang") === "ar";
  const native = isNativeRoleShell(role);
  const autoPromptAttempted = useRef(false);
  const [availability, setAvailability] = useState<NativeBiometricAvailability>(EMPTY_AVAILABILITY);
  const [enrolled, setEnrolled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offer, setOffer] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const refreshNativeState = useCallback(async () => {
    if (!native) return { available: false, enrollment: false };
    const [nextAvailability, nextEnrollment] = await Promise.all([
      getNativeBiometricAvailability(),
      hasNativeBiometricEnrollment(),
    ]);
    setAvailability(nextAvailability);
    setEnrolled(nextEnrollment);
    return { available: nextAvailability.available, enrollment: nextEnrollment };
  }, [native]);

  const clearInvalidAccount = useCallback(async (reason: string) => {
    await disableNativeBiometric(role, "biometric_session_revoked", reason);
    await supabase?.auth.signOut({ scope: "local" });
    setEnrolled(false);
    setAuthenticated(false);
    setLocked(false);
    setOffer(false);
    setError(errorText(reason, isArabic));
  }, [isArabic, role]);

  const validateCurrentSession = useCallback(async () => {
    if (!supabase) return false;
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user?.id) {
      setAuthenticated(false);
      return false;
    }
    const validation = await validateNativeRole(role, session.data.session.user.id);
    if (!validation.valid) {
      await clearInvalidAccount(validation.reason || "role_binding_mismatch");
      return false;
    }
    setAuthenticated(true);
    setDisplayName(validation.displayName || session.data.session.user.email || "");
    return true;
  }, [clearInvalidAccount, role]);

  const unlock = useCallback(async () => {
    if (!native || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await restoreNativeBiometricSession(role, isArabic);
      if (result.success) {
        const valid = await validateCurrentSession();
        if (valid) {
          setLocked(false);
          setAuthenticated(true);
        }
        return;
      }
      if (!result.cancelled) setError(errorText(result.error, isArabic));
      else setError(errorText("biometric_cancelled", isArabic));
      if (["biometric_session_expired", "biometric_session_revoked", "biometric_key_invalidated", "refresh_token_invalid", "account_binding_mismatch"].includes(result.error || "")) {
        setEnrolled(false);
        setLocked(false);
      }
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "native_biometric_timeout";
      setError(errorText(code, isArabic));
    } finally {
      setBusy(false);
    }
  }, [busy, isArabic, native, role, validateCurrentSession]);

  const enable = useCallback(async () => {
    if (!native || busy) return;
    setBusy(true);
    setError("");
    try {
      const valid = await validateCurrentSession();
      if (!valid) return;
      const result = await enableNativeBiometric(role, isArabic);
      if (result.success) {
        setEnrolled(true);
        setOffer(false);
        sessionStorage.removeItem(`dn-biometric-dismissed:${role}`);
      } else {
        setError(errorText(result.error, isArabic));
      }
    } catch (cause) {
      setError(errorText(cause instanceof Error ? cause.message : undefined, isArabic));
    } finally {
      setBusy(false);
    }
  }, [busy, isArabic, native, role, validateCurrentSession]);

  const disable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await disableNativeBiometric(role);
      setEnrolled(false);
      setLocked(false);
      setOffer(false);
      setSecurityOpen(false);
    } finally {
      setBusy(false);
    }
  }, [busy, role]);

  const useAnotherAccount = useCallback(async () => {
    setBusy(true);
    try {
      await disableNativeBiometric(role, "biometric_session_revoked", "account_switch");
      await supabase?.auth.signOut({ scope: "local" });
      setEnrolled(false);
      setAuthenticated(false);
      setLocked(false);
      setOffer(false);
      setSecurityOpen(false);
      setDisplayName("");
    } finally {
      setBusy(false);
    }
  }, [role]);

  useEffect(() => {
    if (!native) return;
    let alive = true;

    async function bootstrap() {
      const nativeState = await refreshNativeState();
      if (!alive) return;
      const session = await supabase?.auth.getSession();
      const hasSession = Boolean(session?.data.session?.user?.id);
      if (hasSession) {
        const valid = await validateCurrentSession();
        if (!alive || !valid) return;
        const dismissed = sessionStorage.getItem(`dn-biometric-dismissed:${role}`) === "1";
        setOffer(nativeState.available && !nativeState.enrollment && !dismissed);
        return;
      }
      setAuthenticated(false);
      if (nativeState.enrollment) {
        setLocked(true);
        if (!autoPromptAttempted.current) {
          autoPromptAttempted.current = true;
          window.setTimeout(() => void unlock(), 250);
        }
      }
    }

    void bootstrap();
    const onBridgeReady = () => void bootstrap();
    window.addEventListener("daynight-biometric-bridge-ready", onBridgeReady);
    return () => {
      alive = false;
      window.removeEventListener("daynight-biometric-bridge-ready", onBridgeReady);
    };
  }, [native, refreshNativeState, role, unlock, validateCurrentSession]);

  useEffect(() => {
    if (!native || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        if (event === "SIGNED_OUT") {
          setAuthenticated(false);
          setOffer(false);
          setDisplayName("");
          if (enrolled) {
            void disableNativeBiometric(role).then(() => setEnrolled(false));
          }
          return;
        }
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session?.user?.id) {
          void validateCurrentSession().then(async (valid) => {
            if (!valid) return;
            const state = await refreshNativeState();
            const dismissed = sessionStorage.getItem(`dn-biometric-dismissed:${role}`) === "1";
            setOffer(state.available && !state.enrollment && !dismissed);
          });
        }
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [enrolled, native, refreshNativeState, role, validateCurrentSession]);

  useEffect(() => {
    if (!native) return;
    const onResume = (event: Event) => {
      const detail = (event as CustomEvent<{ backgroundMs?: number }>).detail;
      const backgroundMs = Number(detail?.backgroundMs || 0);
      if (authenticated && enrolled && backgroundMs >= NATIVE_BIOMETRIC_POLICY[role].maximumBackgroundMs) {
        setLocked(true);
        setError("");
      }
    };
    window.addEventListener("daynight-native-resume", onResume);
    return () => window.removeEventListener("daynight-native-resume", onResume);
  }, [authenticated, enrolled, native, role]);

  if (!native) return <>{children}</>;

  return (
    <div className="dn-biometric-boundary" data-biometric-role={role} dir={isArabic ? "rtl" : "ltr"}>
      {children}

      {authenticated && (
        <button
          type="button"
          className="dn-biometric-settings-trigger"
          onClick={() => setSecurityOpen(true)}
          aria-label={isArabic ? "الأمان وتسجيل الدخول" : "Security and sign-in"}
        >
          <ShieldCheck />
        </button>
      )}

      {(locked || offer || securityOpen) && <div className="dn-biometric-backdrop" aria-hidden="true" />}

      {locked && (
        <section className="dn-biometric-screen" role="dialog" aria-modal="true" aria-labelledby="dn-biometric-lock-title">
          <main className="dn-biometric-card dn-biometric-lock-card">
            <img src={localAssets.logo} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt="DAY NIGHT" />
            <span className="dn-biometric-kicker"><LockKeyhole />{roleName(role, isArabic)}</span>
            <h1 id="dn-biometric-lock-title">{isArabic ? "الدخول بالبصمة" : "Biometric sign-in"}</h1>
            <p>{isArabic ? "استخدم بصمة الإصبع أو التعرف على الوجه أو قفل الجهاز لفتح حسابك المشفر." : "Use your fingerprint, face, or device lock to open your encrypted account session."}</p>
            {displayName && <strong className="dn-biometric-account">{displayName}</strong>}
            {error && <div className="dn-biometric-error" role="alert">{error}</div>}
            <button type="button" className="dn-biometric-primary" onClick={() => void unlock()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Fingerprint />}
              {busy ? (isArabic ? "جاري التحقق..." : "Authenticating...") : (isArabic ? "الدخول بالبصمة" : "Sign in securely")}
            </button>
            <button type="button" className="dn-biometric-secondary" onClick={() => { setLocked(false); setError(""); }} disabled={busy}>
              <KeyRound />{isArabic ? "استخدم كلمة المرور بدلًا من ذلك" : "Use password instead"}
            </button>
            <button type="button" className="dn-biometric-link" onClick={() => void useAnotherAccount()} disabled={busy}>
              <UserRoundPlus />{isArabic ? "استخدام حساب آخر" : "Use another account"}
            </button>
          </main>
        </section>
      )}

      {offer && !locked && (
        <section className="dn-biometric-modal" role="dialog" aria-modal="true" aria-labelledby="dn-biometric-offer-title">
          <main className="dn-biometric-card">
            <span className="dn-biometric-icon"><Fingerprint /></span>
            <h2 id="dn-biometric-offer-title">{isArabic ? "تفعيل الدخول بالبصمة" : "Enable biometric sign-in"}</h2>
            <p>{isArabic ? "استخدم بصمة الإصبع أو التعرف على الوجه للدخول بسرعة وأمان في المرات القادمة. ستظل بيانات حسابك مشفرة داخل هذا الجهاز." : "Use your fingerprint, face, or device lock to sign in quickly and securely next time. Your account session remains encrypted on this device."}</p>
            {error && <div className="dn-biometric-error" role="alert">{error}</div>}
            <div className="dn-biometric-actions">
              <button type="button" className="dn-biometric-primary" onClick={() => void enable()} disabled={busy || !availability.available}>
                {busy ? <Loader2 className="animate-spin" /> : <Fingerprint />}
                {isArabic ? "تفعيل الآن" : "Enable now"}
              </button>
              <button type="button" className="dn-biometric-secondary" onClick={() => { sessionStorage.setItem(`dn-biometric-dismissed:${role}`, "1"); setOffer(false); setError(""); }} disabled={busy}>
                {isArabic ? "ليس الآن" : "Not now"}
              </button>
            </div>
            {!availability.available && <small>{errorText(availability.reason, isArabic)}</small>}
          </main>
        </section>
      )}

      {securityOpen && !locked && !offer && (
        <section className="dn-biometric-modal" role="dialog" aria-modal="true" aria-labelledby="dn-biometric-security-title">
          <main className="dn-biometric-card dn-biometric-security-card">
            <button type="button" className="dn-biometric-close" onClick={() => setSecurityOpen(false)} aria-label={isArabic ? "إغلاق" : "Close"}><X /></button>
            <span className="dn-biometric-icon"><Settings2 /></span>
            <h2 id="dn-biometric-security-title">{isArabic ? "الأمان وتسجيل الدخول" : "Security and sign-in"}</h2>
            <div className="dn-biometric-status">
              <Smartphone />
              <span>{isArabic ? "حالة البصمة" : "Biometric status"}</span>
              <strong>{enrolled ? (isArabic ? "مفعلة" : "Enabled") : (isArabic ? "غير مفعلة" : "Disabled")}</strong>
            </div>
            <div className="dn-biometric-status">
              <ShieldCheck />
              <span>{isArabic ? "الحماية المتاحة" : "Available protection"}</span>
              <strong>{availability.deviceCredentialAvailable ? (isArabic ? "بصمة / وجه / قفل الجهاز" : "Biometric / device lock") : (isArabic ? "بصمة قوية" : "Strong biometric")}</strong>
            </div>
            {error && <div className="dn-biometric-error" role="alert">{error}</div>}
            <div className="dn-biometric-security-actions">
              {!enrolled ? (
                <button type="button" className="dn-biometric-primary" onClick={() => void enable()} disabled={busy || !availability.available}><Fingerprint />{isArabic ? "تفعيل الدخول بالبصمة" : "Enable biometric sign-in"}</button>
              ) : (
                <>
                  <button type="button" className="dn-biometric-primary" onClick={() => { setSecurityOpen(false); setLocked(true); }} disabled={busy}><LockKeyhole />{isArabic ? "قفل التطبيق الآن" : "Lock app now"}</button>
                  <button type="button" className="dn-biometric-secondary" onClick={() => void disable()} disabled={busy}><Trash2 />{isArabic ? "إيقاف الدخول بالبصمة" : "Disable biometric sign-in"}</button>
                </>
              )}
              <button type="button" className="dn-biometric-secondary" onClick={() => void supabase?.auth.signOut({ scope: "local" })} disabled={busy}><LogOut />{isArabic ? "تسجيل الخروج من هذا الجهاز" : "Sign out on this device"}</button>
              <button type="button" className="dn-biometric-danger" onClick={() => void useAnotherAccount()} disabled={busy}><UserRoundPlus />{isArabic ? "إزالة هذا الجهاز واستخدام حساب آخر" : "Remove device and use another account"}</button>
            </div>
          </main>
        </section>
      )}
    </div>
  );
}
