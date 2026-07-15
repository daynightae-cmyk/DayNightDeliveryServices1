import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../../supabase";
import DriverLogin from "./DriverLogin";
import DriverDashboard from "./DriverDashboard";
import type { DriverProfile, ProfileRole } from "../../types/driver";

export default function DriverAuthGuard({ isArabic }: { isArabic: boolean }) {
  const [loading, setLoading] = useState(true); const [profile, setProfile] = useState<ProfileRole | null>(null); const [driver, setDriver] = useState<DriverProfile | null>(null); const [signedIn, setSignedIn] = useState(false);
  async function load() { if (!supabase) { setLoading(false); return; } setLoading(true); const { data: sessionData } = await supabase.auth.getSession(); const user = sessionData.session?.user; setSignedIn(Boolean(user)); if (!user) { setProfile(null); setDriver(null); setLoading(false); return; } const { data: profileRow } = await supabase.from("profiles").select("id, role, full_name, name, phone, status").eq("id", user.id).maybeSingle(); const p = profileRow as ProfileRole | null; setProfile(p); if (String(p?.role || "").toLowerCase() === "driver") { const { data: driverRow } = await supabase.from("driver_profiles").select("*").eq("user_id", user.id).maybeSingle(); setDriver(driverRow as DriverProfile | null); } setLoading(false); }
  useEffect(() => { void load(); if (!supabase) return; const { data } = supabase.auth.onAuthStateChange(() => void load()); return () => data.subscription.unsubscribe(); }, []);
  if (loading) return <div className="grid min-h-[55vh] place-items-center text-white"><Loader2 className="h-8 w-8 animate-spin text-brand-gold" /></div>;
  if (!signedIn) return <DriverLogin isArabic={isArabic} />;
  if (String(profile?.role || "").toLowerCase() !== "driver") return <div className="mx-auto max-w-md rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-center font-black text-red-100">{isArabic ? "هذا القسم مخصص للمندوبين فقط" : "This section is for drivers only."}</div>;
  if (!driver || String(driver.status || "active").toLowerCase() === "inactive") return <div className="mx-auto max-w-md rounded-3xl border border-amber-400/20 bg-amber-500/10 p-6 text-center font-black text-amber-100">{isArabic ? "حساب المندوب غير مفعل. تواصل مع الإدارة." : "Driver profile is not active. Contact admin."}</div>;
  return <DriverDashboard profile={profile as ProfileRole} driver={driver} isArabic={isArabic} />;
}
