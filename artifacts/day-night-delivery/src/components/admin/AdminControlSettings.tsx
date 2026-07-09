import { useEffect, useMemo, useState } from "react";
import { Bell, Bot, ImagePlus, Map, Moon, RotateCcw, Save, SlidersHorizontal, Sun, Zap } from "lucide-react";
import companyMeta from "../../data/companyMeta";
import { adminMapRegions, adminSettingsCatalog, deriveCommandMetrics } from "../../data/adminCommandExpansion";
import type { FinanceSummary } from "../../lib/adminData";
import type { Merchant } from "../../types";
import "../../styles/dn-admin-control-settings.css";

type Props = { isArabic: boolean; orders: any[]; merchants: Merchant[]; financeSummary: FinanceSummary | null };
type ThemeMode = "night" | "day";
type DensityMode = "comfortable" | "compact";

type SettingsState = {
  theme: ThemeMode;
  density: DensityMode;
  mapMode: "standard" | "satellite" | "terrain";
  region: string;
  glow: number;
  kpiMotion: boolean;
  khalifaAvatar: string;
};

const storageKey = "dn_admin_control_settings_v2";

function readSettings(): SettingsState {
  const fallback: SettingsState = { theme: "night", density: "comfortable", mapMode: "standard", region: "all", glow: 72, kpiMotion: true, khalifaAvatar: "" };
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return { ...fallback, ...parsed, khalifaAvatar: localStorage.getItem("dn_admin_khalifa_avatar") || parsed.khalifaAvatar || "" };
  } catch {
    return fallback;
  }
}

function applySettings(settings: SettingsState) {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.dnAdminTheme = settings.theme;
  document.documentElement.dataset.dnAdminDensity = settings.density;
  document.documentElement.style.setProperty("--dn-admin-glow", `${settings.glow}%`);
  localStorage.setItem(storageKey, JSON.stringify(settings));
  localStorage.setItem("dn_admin_map_mode", settings.mapMode);
  localStorage.setItem("dn_admin_map_region", settings.region);
  if (settings.khalifaAvatar) localStorage.setItem("dn_admin_khalifa_avatar", settings.khalifaAvatar);
  window.dispatchEvent(new CustomEvent("dn-admin-settings-change", { detail: settings }));
}

export default function AdminControlSettings({ isArabic, orders, merchants, financeSummary }: Props) {
  const [settings, setSettings] = useState<SettingsState>(() => readSettings());
  const [saved, setSaved] = useState(false);
  const metrics = useMemo(() => deriveCommandMetrics(orders, merchants, financeSummary), [orders, merchants, financeSummary]);

  useEffect(() => { applySettings(settings); }, []);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const save = () => { applySettings(settings); setSaved(true); window.setTimeout(() => setSaved(false), 2200); };
  const reset = () => { const fresh = { theme: "night", density: "comfortable", mapMode: "standard", region: "all", glow: 72, kpiMotion: true, khalifaAvatar: "" } as SettingsState; setSettings(fresh); localStorage.removeItem("dn_admin_khalifa_avatar"); applySettings(fresh); };
  const uploadAvatar = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("khalifaAvatar", String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const title = isArabic ? "إعدادات لوحة التحكم" : "Control Center Settings";
  const subtitle = isArabic ? "إعدادات حقيقية للوحة الإدارة: الصورة، الإضاءة، الخريطة، كثافة العرض، والتنبيهات." : "Real admin UI preferences: avatar, lighting, map defaults, density, and alerts.";

  return <section className="dn-admin-settings-workspace">
    <header className="dn-admin-section-hero"><span>{isArabic ? "إعدادات فعلية" : "Live preferences"}</span><h1>{title}</h1><p>{subtitle}</p></header>
    <div className="dn-admin-section-kpis">
      <article><strong>{settings.theme === "day" ? (isArabic ? "نهاري" : "Day") : (isArabic ? "ليلي" : "Night")}</strong><span>{isArabic ? "وضع العرض" : "Theme"}</span></article>
      <article><strong>{settings.mapMode}</strong><span>{isArabic ? "الخريطة الافتراضية" : "Default map"}</span></article>
      <article><strong>{metrics.unassigned}</strong><span>{isArabic ? "بدون مندوب" : "Unassigned"}</span></article>
      <article><strong>{metrics.codRatio.toFixed(1)}%</strong><span>{isArabic ? "نسبة COD" : "COD ratio"}</span></article>
    </div>

    <div className="dn-admin-settings-live-grid">
      <article className="dn-admin-preference-card is-wide"><div><Sun className="h-5 w-5" /><strong>{isArabic ? "الإضاءة والوضع" : "Lighting & theme"}</strong></div><p>{isArabic ? "يُطبق فوراً على لوحة التحكم ولا يغير /auth أو /tracking." : "Applies immediately to admin only; /auth and /tracking are not changed."}</p><div className="dn-admin-toggle-row"><button type="button" className={settings.theme === "night" ? "is-active" : ""} onClick={() => update("theme", "night")}><Moon className="h-4 w-4" />{isArabic ? "ليلي" : "Night"}</button><button type="button" className={settings.theme === "day" ? "is-active" : ""} onClick={() => update("theme", "day")}><Sun className="h-4 w-4" />{isArabic ? "نهاري" : "Day"}</button></div><label>{isArabic ? "قوة اللمعة" : "Glow strength"}<input type="range" min="20" max="100" value={settings.glow} onChange={(e) => update("glow", Number(e.target.value))} /></label></article>
      <article className="dn-admin-preference-card"><div><ImagePlus className="h-5 w-5" /><strong>{isArabic ? "صورة خليفة" : "Khalifa avatar"}</strong></div><img className="dn-admin-avatar-preview" src={settings.khalifaAvatar || companyMeta.logoUrl} alt="Khalifa preview" /><input type="file" accept="image/*" onChange={(e) => uploadAvatar(e.target.files?.[0])} /></article>
      <article className="dn-admin-preference-card"><div><Map className="h-5 w-5" /><strong>{isArabic ? "الخريطة الافتراضية" : "Map defaults"}</strong></div><select value={settings.mapMode} onChange={(e) => update("mapMode", e.target.value as SettingsState["mapMode"])}><option value="standard">{isArabic ? "عادي" : "Standard"}</option><option value="satellite">{isArabic ? "ساتلايت" : "Satellite"}</option><option value="terrain">{isArabic ? "تضاريس" : "Terrain"}</option></select><select value={settings.region} onChange={(e) => update("region", e.target.value)}>{adminMapRegions.map((region) => <option key={region.id} value={region.id}>{isArabic ? region.ar : region.en}</option>)}</select></article>
      <article className="dn-admin-preference-card"><div><SlidersHorizontal className="h-5 w-5" /><strong>{isArabic ? "كثافة اللوحة" : "Panel density"}</strong></div><div className="dn-admin-toggle-row"><button type="button" className={settings.density === "comfortable" ? "is-active" : ""} onClick={() => update("density", "comfortable")}>{isArabic ? "مريح" : "Comfort"}</button><button type="button" className={settings.density === "compact" ? "is-active" : ""} onClick={() => update("density", "compact")}>{isArabic ? "مضغوط" : "Compact"}</button></div><label className="dn-admin-check"><input type="checkbox" checked={settings.kpiMotion} onChange={(e) => update("kpiMotion", e.target.checked)} />{isArabic ? "حركة مؤشرات ناعمة" : "Soft KPI motion"}</label></article>
      <article className="dn-admin-preference-card is-wide"><div><Bot className="h-5 w-5" /><strong>{isArabic ? "خليفة حي من بيانات الإدارة" : "Live data Khalifa"}</strong></div><p>{isArabic ? `خليفة يقرأ الآن ${orders.length} طلب، ${merchants.length} تاجر، ${metrics.unassigned} طلب بدون مندوب، وصافي تشغيلي تقديري ${metrics.netEstimate.toFixed(2)} AED.` : `Khalifa reads ${orders.length} orders, ${merchants.length} merchants, ${metrics.unassigned} unassigned orders, and estimated net ${metrics.netEstimate.toFixed(2)} AED.`}</p><p>{isArabic ? "لا يتم كشف أسرار Supabase أو مفاتيح البيئة داخل هذه الصفحة." : "Supabase secrets and environment keys are not exposed here."}</p></article>
      <article className="dn-admin-preference-card is-wide"><div><Bell className="h-5 w-5" /><strong>{isArabic ? "كتالوج إعدادات الإدارة" : "Admin settings catalog"}</strong></div><div className="dn-admin-settings-chip-grid">{adminSettingsCatalog.map((group) => <span key={group.id}>{isArabic ? group.ar : group.en}</span>)}</div></article>
    </div>

    <div className="dn-admin-settings-actions"><button type="button" onClick={save}><Save className="h-4 w-4" />{isArabic ? "حفظ وتطبيق" : "Save & apply"}</button><button type="button" onClick={reset}><RotateCcw className="h-4 w-4" />{isArabic ? "إعادة ضبط" : "Reset"}</button>{saved && <strong><Zap className="h-4 w-4" />{isArabic ? "تم الحفظ والتطبيق" : "Saved and applied"}</strong>}</div>
  </section>;
}
