import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useAppContext } from "../../lib/AppContext";
import { supabase } from "../../supabase";
import DriverPortal from "../driver/DriverPortal";
import MerchantPortal from "../merchant/MerchantPortalCommandCenter";
import NativeRoleLogin from "./NativeRoleLogin";

export type NativeRole = "driver" | "merchant";

const VISUAL_ROLE_TEST = (import.meta as any).env?.VITE_ROLE_VISUAL_TEST === "1";

function NativeRoleLoading({ role, isArabic }: { role: NativeRole; isArabic: boolean }) {
  const label = role === "driver"
    ? (isArabic ? "المندوب" : "Driver")
    : (isArabic ? "التاجر" : "Merchant");

  return (
    <section
      data-native-role-loading={role}
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483640,
        display: "grid",
        placeItems: "center",
        width: "100vw",
        height: "100dvh",
        padding: 20,
        overflow: "hidden",
        background: "#071a33",
        color: "#ffffff",
        fontFamily: "Cairo, Arial, sans-serif",
      }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: 15, textAlign: "center" }}>
        <span style={{
          display: "grid",
          placeItems: "center",
          width: 68,
          height: 68,
          border: "2px solid #d4af37",
          borderRadius: 21,
          color: "#f4d96f",
          fontSize: 22,
          fontWeight: 900,
        }}>DN</span>
        <strong style={{ fontSize: 18, fontWeight: 900 }}>
          {isArabic ? `جاري فتح مساحة ${label}...` : `Opening ${label} workspace...`}
        </strong>
        <span style={{ width: 42, height: 4, borderRadius: 99, background: "#3195f7" }} />
      </div>
    </section>
  );
}

export default function NativeRoleRoot({ role }: { role: NativeRole }) {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(!VISUAL_ROLE_TEST);

  useEffect(() => {
    if (VISUAL_ROLE_TEST || !supabase) {
      setCheckingSession(false);
      return;
    }

    let mounted = true;
    const timeout = window.setTimeout(() => {
      if (mounted) setCheckingSession(false);
    }, 7000);

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user || null);
      setCheckingSession(false);
      window.clearTimeout(timeout);
    }).catch(() => {
      if (!mounted) return;
      setCheckingSession(false);
      window.clearTimeout(timeout);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user || null);
      setCheckingSession(false);
    });

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) return <NativeRoleLoading role={role} isArabic={isArabic} />;
  if (!user) return <NativeRoleLogin role={role} isArabic={isArabic} />;

  return role === "driver" ? <DriverPortal /> : <MerchantPortal />;
}
