import { Bell, RotateCcw, Volume2, VolumeX, Zap } from "lucide-react";
import { useAdminAudio } from "../../hooks/useAdminAudio";
import "../../styles/dn-admin-audio.css";

type Props = { isArabic: boolean };

export default function AdminAudioSettings({ isArabic }: Props) {
  const { settings, setSettings, enable, reset, play, message } = useAdminAudio();
  const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const requestBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    update("browserNotifications", permission === "granted");
  };
  const browserPermission = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";

  return <article className="dn-admin-audio-settings dn-admin-preference-card is-wide">
    <div><Volume2 className="h-5 w-5" /><strong>{isArabic ? "نظام الأصوات الاحترافي" : "Premium audio feedback"}</strong></div>
    <p>{isArabic ? "أصوات قصيرة وهادئة تعمل فقط بعد التفعيل أو أول تفاعل، بدون ملفات خارجية أو تشغيل تلقائي مزعج." : "Short, subtle generated tones. No external files, and no audio before opt-in/user interaction."}</p>
    <div className="dn-audio-grid">
      <label className="dn-admin-check"><input type="checkbox" checked={settings.enabled} onChange={(event) => event.target.checked ? enable() : update("enabled", false)} />{isArabic ? "تفعيل الأصوات" : "Enable sounds"}</label>
      <label className="dn-admin-check"><input type="checkbox" checked={settings.muted} onChange={(event) => update("muted", event.target.checked)} />{isArabic ? "كتم كل الأصوات" : "Mute all sounds"}</label>
      <label>{isArabic ? "مستوى الصوت" : "Volume level"}<input type="range" min="0" max="1" step="0.01" value={settings.volume} onChange={(event) => update("volume", Number(event.target.value))} /></label>
      <label className="dn-admin-check"><input type="checkbox" checked={settings.clickSounds} onChange={(event) => update("clickSounds", event.target.checked)} />{isArabic ? "أصوات النقرات" : "Click sounds"}</label>
      <label className="dn-admin-check"><input type="checkbox" checked={settings.notificationSounds} onChange={(event) => update("notificationSounds", event.target.checked)} />{isArabic ? "أصوات الإشعارات" : "Notification sounds"}</label>
      <label className="dn-admin-check"><input type="checkbox" checked={settings.khalifaSounds} onChange={(event) => update("khalifaSounds", event.target.checked)} />{isArabic ? "صوت خليفة" : "Khalifa sound"}</label>
      <label className="dn-admin-check"><input type="checkbox" checked={settings.warningSounds} onChange={(event) => update("warningSounds", event.target.checked)} />{isArabic ? "صوت الأخطاء والتحذيرات" : "Error and warning sounds"}</label>
      <label className="dn-admin-check"><input type="checkbox" checked={settings.browserNotifications} onChange={(event) => update("browserNotifications", event.target.checked)} />{isArabic ? "تفعيل إشعارات المتصفح" : "Browser notifications"}</label>
    </div>
    <div className="dn-audio-actions"><button type="button" onClick={() => { enable(); play("success"); }}><Zap className="h-4 w-4" />{isArabic ? "اختبار الصوت" : "Test sound"}</button><button type="button" onClick={reset}><RotateCcw className="h-4 w-4" />{isArabic ? "إعادة ضبط إعدادات الصوت" : "Reset audio settings"}</button><button type="button" onClick={() => void requestBrowserNotifications()}><Bell className="h-4 w-4" />{browserPermission === "granted" ? (isArabic ? "مسموح" : "Allowed") : (isArabic ? "السماح بالإشعارات" : "Allow notifications")}</button><span><VolumeX className="h-4 w-4" />{browserPermission === "default" ? (isArabic ? "لم يتم السماح بعد" : "Not allowed yet") : browserPermission}</span></div>
    {message && <small>{message}</small>}
  </article>;
}
