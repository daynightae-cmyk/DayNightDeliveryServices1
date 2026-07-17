import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "../../supabase";
import { driverErrorMessage, fetchDriverSession } from "../../lib/driverData";
import DriverLogin from "./DriverLogin";
import DriverDashboard from "./DriverDashboard";
import type { DriverProfile, ProfileRole } from "../../types/driver";

export default function DriverAuthGuard({ isArabic }: { isArabic: boolean }) {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<ProfileRole | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setError(isArabic ? "الخدمة غير متاحة حالياً." : "The service is unavailable right now.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      setSignedIn(Boolean(data.session?.user));
      if (!data.session?.user) {
        setProfile(null);
        setDriver(null);
        return;
      }

      const payload = await fetchDriverSession();
      setProfile(payload?.profile || null);
      setDriver(payload?.driver?.id ? payload.driver : null);
    } catch (loadError) {
      setError(driverErrorMessage(loadError, isArabic));
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    void load();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => void load());
    return () => data.subscription.unsubscribe();
  }, [load]);

  async function signOut() {
    await supabase?.auth.signOut();
    setSignedIn(false);
    setProfile(null);
    setDriver(null);
  }

  if (loading) {
    return (
      <div className="dn-driver-shell grid min-h-[65vh] place-items-center">
        <div className="dn-driver-loading-card">
          <Loader2 className="h-9 w-9 animate-spin" />
          <strong>{isArabic ? "جاري التحقق من حساب المندوب..." : "Validating driver account..."}</strong>
        </div>
      </div>
    );
  }

  if (!signedIn) return <DriverLogin isArabic={isArabic} />;

  if (error) {
    return (
      <section className="dn-driver-shell" dir={isArabic ? "rtl" : "ltr"}>
        <div className="dn-driver-state-card dn-driver-state-error">
          <AlertTriangle className="h-9 w-9" />
          <h1>{isArabic ? "تعذر فتح قسم المندوب" : "Driver workspace unavailable"}</h1>
          <p>{error}</p>
          <div className="dn-driver-state-actions">
            <button type="button" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              {isArabic ? "إعادة المحاولة" : "Retry"}
            </button>
            <button type="button" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              {isArabic ? "تسجيل الخروج" : "Sign out"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="dn-driver-shell" dir={isArabic ? "rtl" : "ltr"}>
        <div className="dn-driver-state-card dn-driver-state-error">
          <AlertTriangle className="h-9 w-9" />
          <h1>{isArabic ? "الحساب بانتظار التفعيل" : "Account pending activation"}</h1>
          <p>{isArabic ? "تواصل مع الإدارة لتفعيل صلاحية الدخول إلى قسم المندوب." : "Contact operations to activate driver access for this account."}</p>
          <div className="dn-driver-state-actions">
            <button type="button" onClick={() => void load()}><RefreshCw className="h-4 w-4" />{isArabic ? "إعادة الفحص" : "Check again"}</button>
            <button type="button" onClick={() => void signOut()}><LogOut className="h-4 w-4" />{isArabic ? "تسجيل الخروج" : "Sign out"}</button>
          </div>
        </div>
      </section>
    );
  }

  if (String(profile.role || "").toLowerCase() !== "driver") {
    return (
      <section className="dn-driver-shell" dir={isArabic ? "rtl" : "ltr"}>
        <div className="dn-driver-state-card dn-driver-state-error">
          <AlertTriangle className="h-9 w-9" />
          <h1>{isArabic ? "هذا القسم مخصص للمندوبين فقط" : "Drivers only"}</h1>
          <p>{isArabic ? "الحساب الحالي لا يحمل صلاحية مندوب." : "The current account does not have driver access."}</p>
          <button type="button" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            {isArabic ? "تسجيل الخروج" : "Sign out"}
          </button>
        </div>
      </section>
    );
  }

  if (!driver || String(driver.status || "active").toLowerCase() !== "active") {
    return (
      <section className="dn-driver-shell" dir={isArabic ? "rtl" : "ltr"}>
        <div className="dn-driver-state-card dn-driver-state-warning">
          <AlertTriangle className="h-9 w-9" />
          <h1>{isArabic ? "ملف المندوب بانتظار التفعيل" : "Driver profile pending activation"}</h1>
          <p>{isArabic ? "تواصل مع الإدارة لتفعيل ملف المندوب ثم أعد المحاولة." : "Contact operations to activate the driver profile, then retry."}</p>
          <div className="dn-driver-state-actions">
            <button type="button" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              {isArabic ? "إعادة الفحص" : "Check again"}
            </button>
            <button type="button" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              {isArabic ? "تسجيل الخروج" : "Sign out"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return <DriverDashboard profile={profile} driver={driver} isArabic={isArabic} onProfileUpdated={load} />;
}
