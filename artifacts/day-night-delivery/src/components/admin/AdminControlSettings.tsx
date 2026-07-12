import { useEffect, useMemo, useState } from "react";
import { Bell, Bot, ImagePlus, Map, Moon, RotateCcw, Save, SlidersHorizontal, Sun, Zap } from "lucide-react";
import AdminAudioSettings from "./AdminAudioSettings";
import companyMeta from "../../data/companyMeta";
import { adminMapRegions, adminSettingsCatalog, deriveCommandMetrics } from "../../data/adminCommandExpansion";
import type { FinanceSummary } from "../../lib/adminData";
import type { Merchant } from "../../types";
import "../../styles/dn-admin-control-settings.css";

type Props = { isArabic: boolean; orders: any[]; merchants: Merchant[]; financeSummary: FinanceSummary | null };
type ThemeMode = "night" | "day";
type DensityMode = "comfortable" | "compact";
type MapMode = "standard" | "satellite" | "terrain";

type SettingsState = {
  theme: ThemeMode;
  density: DensityMode;
  mapMode: MapMode;
  region: string;
  glow: number;
  kpiMotion: boolean;
  khalifaAvatar: string;
};

const storageKey = "dn_admin_control_settings_v2";
const fallbackSettings: SettingsState = {
  theme: "night",
  density: "comfortable",
  mapMode: "standard",
  region: "all",
  glow: 72,
  kpiMotion: true,
  khalifaAvatar: "",
};

const isThemeMode = (value: unknown): value is ThemeMode => value === "night" || value === "day";
const isDensityMode = (value: unknown): value is DensityMode => value === "comfortable" || value === "compact";
const isMapMode = (value: unknown): value is MapMode => value === "standard" || value === "satellite" || value === "terrain";
const isRegion = (value: unknown) => Boolean(value && adminMapRegions.some((region) => region.id === value));

function readSettings(): SettingsState {
  if (typeof window === "undefined") return fallbackSettings;

  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const savedMapMode = localStorage.getItem("dn_admin_map_mode");
    const savedRegion = localStorage.getItem("dn_admin_map_region");
    const savedAvatar = localStorage.getItem("dn_admin_khalifa_avatar");

    return {
      theme: isThemeMode(parsed.theme) ? parsed.theme : fallbackSettings.theme,
      density: isDensityMode(parsed.density) ? parsed.density : fallbackSettings.density,
      mapMode: isMapMode(savedMapMode) ? savedMapMode : isMapMode(parsed.mapMode) ? parsed.mapMode : fallbackSettings.mapMode,
      region: isRegion(savedRegion) ? String(savedRegion) : isRegion(parsed.region) ? String(parsed.region) : fallbackSettings.region,
      glow: Math.max(20, Math.min(100, Number(parsed.glow || fallbackSettings.glow))),
      kpiMotion: typeof parsed.kpiMotion === "boolean" ? parsed.kpiMotion : fallbackSettings.kpiMotion,
      khalifaAvatar: savedAvatar || parsed.khalifaAvatar || "",
    };
  } catch {
    return fallbackSettings;
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
  else localStorage.removeItem("dn_admin_khalifa_avatar");

  window.dispatchEvent(new CustomEvent("dn-admin-settings-change", { detail: settings }));
}

function scrollSettingsIntoView() {
  if (typeof window === "undefined") return;

  window.requestAnimationFrame(() => {
    document.querySelector(".dn-admin-content-full")?.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector(".dn-admin-workspace-host")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

function money(value: unknown, isArabic: boolean) {
  const amount = Number(value || 0).toFixed(2);
  return isArabic ? `${amount} درهم` : `${amount} AED`;
}

function mapModeLabel(mode: MapMode, isArabic: boolean) {
  const labels: Record<MapMode, { ar: string; en: string }> = {
    standard: { ar: "خريطة عادية", en: "Standard map" },
    satellite: { ar: "صور فضائية", en: "Satellite" },
    terrain: { ar: "تضاريس", en: "Terrain" },
  };
  return isArabic ? labels[mode].ar : labels[mode].en;
}

export default function AdminControlSettings({ isArabic, orders, merchants, financeSummary }: Props) {
  const [settings, setSettings] = useState<SettingsState>(() => readSettings());
  const [saved, setSaved] = useState(false);
  const metrics = useMemo(() => deriveCommandMetrics(orders || [], merchants || [], financeSummary), [orders, merchants, financeSummary]);

  useEffect(() => {
    applySettings(settings);
    scrollSettingsIntoView();
  }, []);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const save = () => {
    applySettings(settings);
    scrollSettingsIntoView();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const reset = () => {
    const fresh = { ...fallbackSettings };
    setSettings(fresh);
    applySettings(fresh);
    scrollSettingsIntoView();
  };

  const uploadAvatar = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("khalifaAvatar", String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const title = isArabic ? "إعدادات لوحة التحكم" : "Control Center Settings";
  const subtitle = isArabic
    ? "تحكم فعلي في شكل لوحة الإدارة، صورة خليفة، الخريطة، كثافة العرض، الإشعارات، وأصوات التنبيه. تم وضع الأصوات في أول الصفحة حتى يسهل اختبارها فوراً."
    : "Live preferences for admin appearance, Khalifa avatar, map defaults, density, notifications, and sound effects. Audio controls are now first for immediate testing.";

  return (
    <section className="dn-admin-settings-workspace" id="admin-audio-settings">
      <header className="dn-admin-section-hero">
        <span>{isArabic ? "إعدادات تشغيل حقيقية" : "Live preferences"}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>

      <AdminAudioSettings isArabic={isArabic} />

      <div className="dn-admin-section-kpis">
        <article><strong>{settings.theme === "day" ? (isArabic ? "نهاري" : "Day") : (isArabic ? "ليلي" : "Night")}</strong><span>{isArabic ? "وضع العرض" : "Theme"}</span></article>
        <article><strong>{mapModeLabel(settings.mapMode, isArabic)}</strong><span>{isArabic ? "الخريطة الافتراضية" : "Default map"}</span></article>
        <article><strong>{metrics.unassigned}</strong><span>{isArabic ? "طلبات بلا مندوب" : "Unassigned"}</span></article>
        <article><strong>{Number(metrics.codRatio || 0).toFixed(1)}%</strong><span>{isArabic ? "نسبة التحصيل عند التسليم" : "COD ratio"}</span></article>
      </div>

      <div className="dn-admin-settings-live-grid">
        <article className="dn-admin-preference-card is-wide">
          <div><Sun className="h-5 w-5" /><strong>{isArabic ? "الإضاءة ووضع العرض" : "Lighting & theme"}</strong></div>
          <p>{isArabic ? "يتم تطبيق الوضع فوراً على لوحة الإدارة فقط دون التأثير على صفحات الدخول أو التتبع العامة." : "Applies immediately to admin only; /auth and /tracking are not changed."}</p>
          <div className="dn-admin-toggle-row">
            <button type="button" className={settings.theme === "night" ? "is-active" : ""} onClick={() => update("theme", "night")}><Moon className="h-4 w-4" />{isArabic ? "ليلي" : "Night"}</button>
            <button type="button" className={settings.theme === "day" ? "is-active" : ""} onClick={() => update("theme", "day")}><Sun className="h-4 w-4" />{isArabic ? "نهاري" : "Day"}</button>
          </div>
          <label>{isArabic ? "قوة اللمعة" : "Glow strength"}<input type="range" min="20" max="100" value={settings.glow} onChange={(e) => update("glow", Number(e.target.value))} /></label>
        </article>

        <article className="dn-admin-preference-card">
          <div><ImagePlus className="h-5 w-5" /><strong>{isArabic ? "صورة خليفة" : "Khalifa avatar"}</strong></div>
          <img className="dn-admin-avatar-preview" src={settings.khalifaAvatar || companyMeta.logoUrl} alt={isArabic ? "معاينة صورة خليفة" : "Khalifa preview"} />
          <input type="file" accept="image/*" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
        </article>

        <article className="dn-admin-preference-card">
          <div><Map className="h-5 w-5" /><strong>{isArabic ? "الخريطة الافتراضية" : "Map defaults"}</strong></div>
          <select value={settings.mapMode} onChange={(e) => update("mapMode", e.target.value as MapMode)}>
            <option value="standard">{isArabic ? "خريطة عادية" : "Standard map"}</option>
            <option value="satellite">{isArabic ? "صور فضائية" : "Satellite"}</option>
            <option value="terrain">{isArabic ? "تضاريس" : "Terrain"}</option>
          </select>
          <select value={settings.region} onChange={(e) => update("region", e.target.value)}>
            {adminMapRegions.map((region) => <option key={region.id} value={region.id}>{isArabic ? region.ar : region.en}</option>)}
          </select>
        </article>

        <article className="dn-admin-preference-card">
          <div><SlidersHorizontal className="h-5 w-5" /><strong>{isArabic ? "كثافة اللوحة" : "Panel density"}</strong></div>
          <div className="dn-admin-toggle-row">
            <button type="button" className={settings.density === "comfortable" ? "is-active" : ""} onClick={() => update("density", "comfortable")}>{isArabic ? "مريح" : "Comfort"}</button>
            <button type="button" className={settings.density === "compact" ? "is-active" : ""} onClick={() => update("density", "compact")}>{isArabic ? "مضغوط" : "Compact"}</button>
          </div>
          <label className="dn-admin-check"><input type="checkbox" checked={settings.kpiMotion} onChange={(e) => update("kpiMotion", e.target.checked)} />{isArabic ? "حركة مؤشرات ناعمة" : "Soft KPI motion"}</label>
        </article>

        <article className="dn-admin-preference-card is-wide">
          <div><Bot className="h-5 w-5" /><strong>{isArabic ? "خليفة متصل ببيانات الإدارة" : "Live data Khalifa"}</strong></div>
          <p>{isArabic ? `خليفة يقرأ الآن ${orders.length} طلبية، ${merchants.length} تاجر، ${metrics.unassigned} طلبية بلا مندوب، وصافي تشغيلي تقديري ${money(metrics.netEstimate, true)}.` : `Khalifa reads ${orders.length} orders, ${merchants.length} merchants, ${metrics.unassigned} unassigned orders, and estimated net ${money(metrics.netEstimate, false)}.`}</p>
          <p>{isArabic ? "لا يتم كشف أسرار Supabase أو مفاتيح البيئة داخل هذه الصفحة." : "Supabase secrets and environment keys are not exposed here."}</p>
        </article>

        <article className="dn-admin-preference-card is-wide">
          <div><Bell className="h-5 w-5" /><strong>{isArabic ? "كتالوج إعدادات الإدارة" : "Admin settings catalog"}</strong></div>
          <div className="dn-admin-settings-chip-grid">
            {adminSettingsCatalog.map((group) => <span key={group.id} title={(isArabic ? group.fieldsAr : group.fieldsEn).join(" • ")}>{isArabic ? group.ar : group.en}</span>)}
          </div>
        </article>
      </div>

      <div className="dn-admin-settings-actions">
        <button type="button" onClick={save}><Save className="h-4 w-4" />{isArabic ? "حفظ وتطبيق" : "Save & apply"}</button>
        <button type="button" onClick={reset}><RotateCcw className="h-4 w-4" />{isArabic ? "إعادة ضبط" : "Reset"}</button>
        {saved && <strong><Zap className="h-4 w-4" />{isArabic ? "تم الحفظ والتطبيق" : "Saved and applied"}</strong>}
      </div>
    </section>
  );
}
