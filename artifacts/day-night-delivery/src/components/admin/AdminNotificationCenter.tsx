import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Radio,
  Sparkles,
  AlertTriangle,
  BellRing,
  RotateCcw,
} from "lucide-react";
import {
  addAdminNotification,
  clearAdminNotifications,
  markAdminNotificationsRead,
  playAdminAudioEvent,
  readAdminAudioSettings,
  readAdminNotifications,
  requestAdminBrowserNotifications,
  resetAdminAudioSettings,
  unlockAdminAudio,
  writeAdminAudioSettings,
  type AdminAudioSettings,
  type AdminNotification,
} from "../../lib/adminAudio";

function useNotifications() {
  const [items, setItems] = useState<AdminNotification[]>(() => readAdminNotifications());

  useEffect(() => {
    const sync = () => setItems(readAdminNotifications());
    window.addEventListener("dn-admin-notifications-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("dn-admin-notifications-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return [items, setItems] as const;
}

function useAudioSettings() {
  const [settings, setSettings] = useState<AdminAudioSettings>(() => readAdminAudioSettings());

  useEffect(() => {
    const sync = () => setSettings(readAdminAudioSettings());
    window.addEventListener("dn-admin-audio-settings-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("dn-admin-audio-settings-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = (patch: Partial<AdminAudioSettings>) => {
    unlockAdminAudio();
    const next = { ...readAdminAudioSettings(), ...patch, lastEnabledAt: new Date().toISOString() };
    writeAdminAudioSettings(next);
    setSettings(next);
    playAdminAudioEvent("success", next);
  };

  return [settings, update, setSettings] as const;
}

const text = (isArabic: boolean, ar: string, en: string) => (isArabic ? ar : en);

function AudioToggle({
  isArabic,
  active,
  icon: Icon,
  titleAr,
  titleEn,
  hintAr,
  hintEn,
  onClick,
}: {
  isArabic: boolean;
  active: boolean;
  icon: typeof Volume2;
  titleAr: string;
  titleEn: string;
  hintAr: string;
  hintEn: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`dn-admin-audio-toggle ${active ? "is-on" : "is-off"}`} onClick={onClick}>
      <Icon className="h-4 w-4" />
      <span>
        <strong>{text(isArabic, titleAr, titleEn)}</strong>
        <small>{text(isArabic, hintAr, hintEn)}</small>
      </span>
    </button>
  );
}

export function AdminNotificationBell({ isArabic, onOpen }: { isArabic: boolean; onOpen: () => void }) {
  const [items] = useNotifications();
  const [settings, update] = useAudioSettings();
  const unread = items.filter((item) => !item.read).length;

  const toggleMute = () => {
    update({ enabled: true, muted: !settings.muted });
  };

  return (
    <div className="dn-admin-notification-bell">
      <button type="button" onClick={onOpen} aria-label={text(isArabic, "الإشعارات", "Notifications")}>
        <Bell className="h-4 w-4" />
        {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
      </button>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={settings.muted ? text(isArabic, "تشغيل الصوت", "Unmute") : text(isArabic, "كتم الصوت", "Mute")}
        title={settings.muted ? text(isArabic, "تشغيل الصوت", "Unmute") : text(isArabic, "كتم الصوت", "Mute")}
      >
        {settings.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function AdminNotificationCenter({ isArabic, open, onClose }: { isArabic: boolean; open: boolean; onClose: () => void }) {
  const [items, setItems] = useNotifications();
  const [settings, update, setSettings] = useAudioSettings();
  const unreadIds = useMemo(() => items.filter((item) => !item.read).map((item) => item.id), [items]);

  const markRead = () => {
    markAdminNotificationsRead(unreadIds);
    setItems(readAdminNotifications());
    playAdminAudioEvent("success");
  };

  const clear = () => {
    clearAdminNotifications();
    setItems([]);
    playAdminAudioEvent("click");
  };

  const resetAudio = () => {
    unlockAdminAudio();
    const next = resetAdminAudioSettings();
    setSettings(next);
    playAdminAudioEvent("success", next);
  };

  const enableBrowserNotifications = async () => {
    unlockAdminAudio();
    const permission = await requestAdminBrowserNotifications();
    update({ browserNotifications: permission === "granted", enabled: true, muted: false });
    addAdminNotification({
      type: permission === "granted" ? "success" : "warning",
      priority: permission === "granted" ? "normal" : "high",
      titleAr: permission === "granted" ? "تم تشغيل إشعارات المتصفح" : "لم يتم تفعيل إشعارات المتصفح",
      titleEn: permission === "granted" ? "Browser notifications enabled" : "Browser notifications not enabled",
      bodyAr: permission === "granted" ? "سيظهر التنبيه المهم داخل المتصفح مع صوت اللوحة." : "استمر صوت اللوحة الداخلي، لكن المتصفح لم يمنح إذن الإشعارات.",
      bodyEn: permission === "granted" ? "Important alerts will appear in the browser with admin audio." : "Internal admin audio still works, but the browser permission was not granted.",
      audioEvent: permission === "granted" ? "success" : "warning",
      dedupeKey: `browser-permission:${permission}`,
      dedupeMs: 2000,
    });
  };

  const testNotification = () => {
    unlockAdminAudio();
    addAdminNotification({
      type: "info",
      titleAr: "اختبار صوت الإشعارات",
      titleEn: "Notification sound test",
      bodyAr: "هذا تنبيه تجريبي من لوحة الإدارة.",
      bodyEn: "This is a test alert from the admin dashboard.",
      audioEvent: "notification",
      dedupeKey: `audio-test-${Date.now()}`,
      dedupeMs: 1,
    });
  };

  const testKhalifa = () => {
    unlockAdminAudio();
    addAdminNotification({
      type: "khalifa",
      priority: "normal",
      titleAr: "صوت خليفة جاهز",
      titleEn: "Khalifa sound is ready",
      bodyAr: "خليفة متصل بالبيانات الحية، وسيظهر صوته عند التوصيات المهمة.",
      bodyEn: "Khalifa is connected to live data and will speak on important recommendations.",
      audioEvent: "khalifa_insight",
      dedupeKey: `khalifa-test-${Date.now()}`,
      dedupeMs: 1,
    });
  };

  const testWarning = () => {
    unlockAdminAudio();
    addAdminNotification({
      type: "warning",
      priority: "high",
      titleAr: "اختبار التحذيرات",
      titleEn: "Warning sound test",
      bodyAr: "هذا صوت الأخطاء والتحذيرات داخل لوحة الإدارة.",
      bodyEn: "This is the error and warning sound inside the admin dashboard.",
      audioEvent: "warning",
      dedupeKey: `warning-test-${Date.now()}`,
      dedupeMs: 1,
    });
  };

  if (!open) return null;

  return (
    <aside className="dn-admin-notification-drawer" dir={isArabic ? "rtl" : "ltr"}>
      <header>
        <div>
          <span>DAY NIGHT</span>
          <h2>{text(isArabic, "الإشعارات والأصوات", "Notifications & Audio")}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label={text(isArabic, "إغلاق", "Close")}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <section className="dn-admin-audio-panel" aria-label={text(isArabic, "إعدادات الأصوات", "Audio settings")}>
        <div className="dn-admin-audio-title">
          <Radio className="h-4 w-4" />
          <strong>{text(isArabic, "مركز الصوت الحي", "Live audio center")}</strong>
          <small>{text(isArabic, "تشغيل الأصوات يحتاج أول ضغطة داخل اللوحة فقط.", "Audio is unlocked by the first click inside the dashboard.")}</small>
        </div>

        <div className="dn-admin-audio-grid">
          <AudioToggle
            isArabic={isArabic}
            active={settings.enabled && !settings.muted}
            icon={settings.muted ? VolumeX : Volume2}
            titleAr="الصوت العام"
            titleEn="Master audio"
            hintAr="تشغيل/كتم كل أصوات اللوحة"
            hintEn="Enable or mute all admin sounds"
            onClick={() => update({ enabled: true, muted: !settings.muted })}
          />
          <AudioToggle
            isArabic={isArabic}
            active={settings.notificationSounds}
            icon={BellRing}
            titleAr="أصوات الإشعارات"
            titleEn="Notification sounds"
            hintAr="طلبات وتنبيهات وتحصيل عند التسليم"
            hintEn="Orders, alerts, and cash-on-delivery"
            onClick={() => update({ notificationSounds: !settings.notificationSounds, enabled: true, muted: false })}
          />
          <AudioToggle
            isArabic={isArabic}
            active={settings.khalifaSounds}
            icon={Sparkles}
            titleAr="صوت خليفة"
            titleEn="Khalifa sound"
            hintAr="نغمة خليفة عند التوصيات المهمة"
            hintEn="Khalifa tone on key recommendations"
            onClick={() => update({ khalifaSounds: !settings.khalifaSounds, enabled: true, muted: false })}
          />
          <AudioToggle
            isArabic={isArabic}
            active={settings.khalifaVoice}
            icon={Sparkles}
            titleAr="نطق خليفة"
            titleEn="Khalifa voice"
            hintAr="نطق اختياري للتوصيات المهمة"
            hintEn="Optional spoken key guidance"
            onClick={() => update({ khalifaVoice: !settings.khalifaVoice, khalifaSounds: true, enabled: true, muted: false })}
          />
          <AudioToggle
            isArabic={isArabic}
            active={settings.warningSounds}
            icon={AlertTriangle}
            titleAr="الأخطاء والتحذيرات"
            titleEn="Errors & warnings"
            hintAr="نغمة مختلفة للمخاطر والأخطاء"
            hintEn="Distinct tone for risks and errors"
            onClick={() => update({ warningSounds: !settings.warningSounds, enabled: true, muted: false })}
          />
        </div>

        <label className="dn-admin-volume-control">
          <span>{text(isArabic, "مستوى الصوت", "Volume")}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={(event) => update({ volume: Number(event.target.value), enabled: true, muted: false })}
          />
          <b>{Math.round(settings.volume * 100)}%</b>
        </label>

        <div className="dn-admin-audio-tests">
          <button type="button" onClick={testNotification}>{text(isArabic, "اختبار إشعار", "Test alert")}</button>
          <button type="button" onClick={testKhalifa}>{text(isArabic, "اختبار خليفة", "Test Khalifa")}</button>
          <button type="button" onClick={testWarning}>{text(isArabic, "اختبار تحذير", "Test warning")}</button>
          <button type="button" onClick={enableBrowserNotifications}>{text(isArabic, "إشعارات المتصفح", "Browser notifications")}</button>
          <button type="button" onClick={resetAudio}><RotateCcw className="h-3.5 w-3.5" />{text(isArabic, "إعادة ضبط الصوت", "Reset audio")}</button>
        </div>
      </section>

      <div className="dn-admin-notification-actions">
        <button type="button" onClick={markRead}>
          <CheckCheck />
          {text(isArabic, "تحديد كمقروء", "Mark read")}
        </button>
        <button type="button" onClick={clear}>
          <Trash2 />
          {text(isArabic, "مسح الكل", "Clear all")}
        </button>
      </div>

      <div className="dn-admin-notification-list">
        {items.length === 0 ? (
          <p>{text(isArabic, "لا توجد إشعارات حالياً", "No notifications right now")}</p>
        ) : (
          items.map((item) => (
            <article key={item.id} className={`dn-admin-notification-row is-${item.priority || "normal"} ${item.read ? "is-read" : ""}`}>
              <div>
                <span>{item.type}</span>
                {item.priority === "high" && <b>{text(isArabic, "أولوية عالية", "High priority")}</b>}
              </div>
              <strong>{isArabic ? item.titleAr : item.titleEn}</strong>
              <p>{isArabic ? item.bodyAr : item.bodyEn}</p>
              <small>{new Date(item.createdAt).toLocaleString(isArabic ? "ar-AE" : "en-AE")}</small>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
