import { Bell, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useAdminAudio } from "../../hooks/useAdminAudio";

export default function AdminAudioSettings({ isArabic }: { isArabic: boolean }) {
  const { settings, setSettings, enable, reset, playSuccess, playWarning, message } = useAdminAudio();
  const label = (ar: string, en: string) => isArabic ? ar : en;
  const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setSettings({ ...settings, [key]: value });
  const allowNotifications = async () => { if (typeof window === "undefined" || !("Notification" in window)) return; const result = await Notification.requestPermission(); update("browserNotifications", result === "granted"); };
  return <article className="dn-admin-audio-card is-wide"><div><Volume2 className="h-5 w-5" /><strong>{label("الأصوات والإشعارات", "Audio & notifications")}</strong></div><div className="dn-admin-audio-grid">
    <label><input type="checkbox" checked={settings.enabled} onChange={(e) => e.target.checked ? enable() : update("enabled", false)} />{label("تفعيل الأصوات", "Enable sounds")}</label>
    <label><input type="checkbox" checked={settings.muted} onChange={(e) => update("muted", e.target.checked)} />{label("كتم كل الأصوات", "Mute all sounds")}</label>
    <label>{label("مستوى الصوت", "Volume level")}<input type="range" min="0" max="1" step="0.01" value={settings.volume} onChange={(e) => update("volume", Number(e.target.value))} /></label>
    <label><input type="checkbox" checked={settings.clickSounds} onChange={(e) => update("clickSounds", e.target.checked)} />{label("أصوات النقرات", "Click sounds")}</label>
    <label><input type="checkbox" checked={settings.notificationSounds} onChange={(e) => update("notificationSounds", e.target.checked)} />{label("أصوات الإشعارات", "Notification sounds")}</label>
    <label><input type="checkbox" checked={settings.khalifaSounds} onChange={(e) => update("khalifaSounds", e.target.checked)} />{label("صوت خليفة", "Khalifa sound")}</label>
    <label><input type="checkbox" checked={settings.warningSounds} onChange={(e) => update("warningSounds", e.target.checked)} />{label("صوت الأخطاء والتحذيرات", "Error and warning sounds")}</label>
    <label><input type="checkbox" checked={settings.browserNotifications} onChange={(e) => update("browserNotifications", e.target.checked)} />{label("تفعيل إشعارات المتصفح", "Enable browser notifications")}</label>
  </div><div className="dn-admin-audio-actions"><button type="button" onClick={playSuccess}><Bell />{label("اختبار الصوت", "Test sound")}</button><button type="button" onClick={playWarning}><VolumeX />{label("اختبار التحذير", "Test warning")}</button><button type="button" onClick={reset}><RotateCcw />{label("إعادة ضبط إعدادات الصوت", "Reset audio settings")}</button><button type="button" onClick={() => void allowNotifications()}>{label("السماح بالإشعارات", "Allow notifications")}</button><span>{settings.browserNotifications ? label("مسموح", "Allowed") : label("لم يتم السماح بعد", "Not allowed yet")}</span>{message && <span>{message}</span>}</div></article>;
}
