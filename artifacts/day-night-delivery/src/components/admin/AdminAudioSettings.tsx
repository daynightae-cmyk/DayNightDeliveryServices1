import { AlertTriangle, Bell, Car, DoorOpen, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useAdminAudio } from "../../hooks/useAdminAudio";

export default function AdminAudioSettings({ isArabic }: { isArabic: boolean }) {
  const {
    settings,
    setSettings,
    enable,
    reset,
    muteNow,
    playEngine,
    playDoor,
    playDoorClose,
    playHorn,
    playGlass,
    message,
  } = useAdminAudio();
  const label = (ar: string, en: string) => isArabic ? ar : en;
  const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setSettings({ ...settings, [key]: value });
  const allowNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    update("browserNotifications", result === "granted");
  };

  return <article className="dn-admin-audio-card is-wide">
    <div>
      <Volume2 className="h-5 w-5" />
      <strong>{label("الأصوات والمؤثرات", "Sound effects")}</strong>
    </div>

    <p className="dn-admin-audio-copy">
      {label(
        "أصوات تشغيل السيارة، الانتقال بين الأقسام، إغلاق الباب، الكلاكس، وكسر الزجاج مربوطة بالأحداث الحقيقية فقط ومحفوظة في المتصفح.",
        "Engine start, section doors, door close, horn, and glass break are tied only to real events and saved in this browser.",
      )}
    </p>

    <div className="dn-admin-audio-grid">
      <label><input type="checkbox" checked={settings.enabled && !settings.muted} onChange={(e) => e.target.checked ? enable() : muteNow()} />{label("تفعيل كل المؤثرات", "Enable all effects")}</label>
      <label><input type="checkbox" checked={settings.muted} onChange={(e) => e.target.checked ? muteNow() : enable()} />{label("كتم فوري لكل الأصوات", "Instant mute all sounds")}</label>
      <label>{label("مستوى الصوت العام", "Master volume")}<input type="range" min="0" max="1" step="0.01" value={settings.volume} onChange={(e) => update("volume", Number(e.target.value))} /><b>{Math.round(settings.volume * 100)}%</b></label>
      <label><input type="checkbox" checked={settings.notificationSounds} onChange={(e) => update("notificationSounds", e.target.checked)} />{label("أصوات الإشعارات المهمة", "Important notification sounds")}</label>
      <label><input type="checkbox" checked={settings.khalifaSounds} onChange={(e) => update("khalifaSounds", e.target.checked)} />{label("صوت خليفة", "Khalifa sound")}</label>
      <label><input type="checkbox" checked={settings.warningSounds} onChange={(e) => update("warningSounds", e.target.checked)} />{label("صوت الأخطاء والتحذيرات", "Error and warning sounds")}</label>
      <label><input type="checkbox" checked={settings.browserNotifications} onChange={(e) => update("browserNotifications", e.target.checked)} />{label("إشعارات المتصفح", "Browser notifications")}</label>
    </div>

    <div className="dn-admin-audio-actions dn-admin-audio-test-suite">
      <button type="button" onClick={playEngine}><Car />{label("تجربة تشغيل المحرك", "Test engine start")}</button>
      <button type="button" onClick={playDoor}><DoorOpen />{label("تجربة باب الأقسام", "Test section door")}</button>
      <button type="button" onClick={playDoorClose}><DoorOpen />{label("تجربة إغلاق الباب", "Test door close")}</button>
      <button type="button" onClick={playHorn}><Bell />{label("تجربة الكلاكس", "Test horn")}</button>
      <button type="button" onClick={playGlass}><AlertTriangle />{label("تجربة كسر الزجاج", "Test glass break")}</button>
      <button type="button" onClick={reset}><RotateCcw />{label("استعادة الافتراضي", "Restore defaults")}</button>
      <button type="button" onClick={() => void allowNotifications()}><Volume2 />{label("السماح بالإشعارات", "Allow notifications")}</button>
      <button type="button" onClick={muteNow}><VolumeX />{label("كتم الآن", "Mute now")}</button>
      <span>{settings.browserNotifications ? label("إشعارات المتصفح مفعّلة", "Browser notifications enabled") : label("إشعارات المتصفح غير مفعّلة", "Browser notifications not enabled")}</span>
      {message && <span>{message}</span>}
    </div>
  </article>;
}
