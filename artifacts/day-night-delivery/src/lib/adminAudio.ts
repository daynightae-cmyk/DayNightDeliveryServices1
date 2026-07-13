import {
  handleAdminNotification,
  playDayNightSound,
  preloadDayNightSounds,
  readDayNightAudioSettings,
  resetDayNightAudioSettings,
  stopAllDayNightSounds,
  unlockDayNightAudio,
  writeDayNightAudioSettings,
  type DayNightSoundKey,
} from "./audioManager";

export type AdminAudioEvent =
  | "click"
  | "hover"
  | "success"
  | "error"
  | "warning"
  | "notification"
  | "new_order"
  | "cod_alert"
  | "urgent_alert"
  | "critical_alert"
  | "khalifa_question"
  | "khalifa_insight"
  | "daily_closing_ready"
  | "daily_closing_warning"
  | "database_health_ok"
  | "database_health_warning"
  | "print_ready"
  | "print_done";

export type AdminAudioSettings = {
  enabled: boolean;
  muted: boolean;
  volume: number;
  clickSounds: boolean;
  notificationSounds: boolean;
  khalifaSounds: boolean;
  khalifaVoice: boolean;
  warningSounds: boolean;
  browserNotifications: boolean;
  lastEnabledAt?: string;
};

export type AdminNotificationType =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "new_order"
  | "cod"
  | "print"
  | "database"
  | "daily_closing"
  | "khalifa";

export type AdminNotificationPriority = "low" | "normal" | "high" | "critical";
export type AdminNotification = {
  id: string;
  type: AdminNotificationType;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  createdAt: string;
  sectionId?: string;
  priority?: AdminNotificationPriority;
  read?: boolean;
  dedupeKey?: string;
};

type AddNotificationInput = Omit<AdminNotification, "id" | "createdAt" | "read"> & {
  id?: string;
  createdAt?: string;
  read?: boolean;
  audioEvent?: AdminAudioEvent;
  dedupeMs?: number;
};

type RoutedAudio = {
  key: DayNightSoundKey;
  volume: number;
  channel: string;
  minIntervalMs: number;
  priority: number;
};

export const ADMIN_AUDIO_SETTINGS_KEY = "dn_admin_audio_settings_v1";
export const ADMIN_NOTIFICATIONS_KEY = "dn_admin_notifications_v1";
export const ADMIN_NOTIFICATION_DEDUPE_KEY = "dn_admin_notification_dedupe_v1";

const fallback: AdminAudioSettings = {
  enabled: true,
  muted: false,
  volume: 0.35,
  clickSounds: true,
  notificationSounds: true,
  khalifaSounds: true,
  khalifaVoice: false,
  warningSounds: true,
  browserNotifications: false,
};

const moduleLoadedAt = Date.now();
const initialNotificationAudioMuteUntil = moduleLoadedAt + 8500;
let unlocked = false;
let lastVoiceAt = 0;
let pendingAudio: AdminAudioEvent[] = [];
let khalifaQuestionBindingInstalled = false;

const hasWindow = () => typeof window !== "undefined";

function safeJson<T>(raw: string | null, fb: T): T {
  if (!raw) return fb;
  try {
    return { ...fb, ...JSON.parse(raw) };
  } catch {
    return fb;
  }
}

function installKhalifaQuestionAudioBinding() {
  if (!hasWindow() || khalifaQuestionBindingInstalled) return;
  khalifaQuestionBindingInstalled = true;

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || !button.closest(".dn-khalifa-live") || button.disabled) return;

      const isSubmit = button.getAttribute("type") === "submit";
      const isQuestionChip = button.classList.contains("dn-khalifa-question-chip");
      const label = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      const isSend = label.includes("إرسال") || label.includes("send") || label.includes("اسأل") || label.includes("ask");

      if (isSubmit || isQuestionChip || isSend) playAdminAudioEvent("khalifa_question", readAdminAudioSettings());
    },
    true,
  );
}

export function readAdminAudioSettings(): AdminAudioSettings {
  if (!hasWindow()) return fallback;
  const stored = safeJson(window.localStorage.getItem(ADMIN_AUDIO_SETTINGS_KEY), fallback);
  const dayNight = readDayNightAudioSettings();

  return {
    ...fallback,
    ...stored,
    enabled: dayNight.enabled,
    muted: dayNight.muted,
    volume: dayNight.volume,
  };
}

export function writeAdminAudioSettings(settings: AdminAudioSettings) {
  if (!hasWindow()) return;
  const next = { ...fallback, ...settings, volume: Math.max(0, Math.min(1, Number(settings.volume ?? fallback.volume))) };
  try {
    window.localStorage.setItem(ADMIN_AUDIO_SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("dn-admin-audio-settings-change", { detail: next }));
  } catch {
    // localStorage can be blocked; audio preferences will still work for this session.
  }
  writeDayNightAudioSettings({ enabled: next.enabled, muted: next.muted, volume: next.volume });
}

export function resetAdminAudioSettings() {
  resetDayNightAudioSettings();
  writeAdminAudioSettings(fallback);
  return fallback;
}

export function unlockAdminAudio() {
  unlocked = true;
  unlockDayNightAudio();
  preloadDayNightSounds();
  installKhalifaQuestionAudioBinding();
  const queued = [...pendingAudio].slice(-4);
  pendingAudio = [];
  queued.forEach((event, index) => window.setTimeout(() => playAdminAudioEvent(event), index * 180));
}

function allowed(event: AdminAudioEvent, s: AdminAudioSettings) {
  if (!s.enabled || s.muted) return false;
  if ((event === "click" || event === "hover") && !s.clickSounds) return false;
  if (["notification", "new_order", "cod_alert", "print_ready", "print_done", "daily_closing_ready", "urgent_alert"].includes(event) && !s.notificationSounds) return false;
  if ((event === "khalifa_question" || event === "khalifa_insight") && !s.khalifaSounds) return false;
  if (["error", "warning", "daily_closing_warning", "database_health_warning", "critical_alert"].includes(event) && !s.warningSounds) return false;
  return true;
}

function routeAdminAudioEvent(event: AdminAudioEvent): RoutedAudio | null {
  if (event === "click" || event === "hover") return null;

  if (event === "critical_alert") {
    return { key: "glassBreak", volume: 0.5, channel: "admin-critical-alert", minIntervalMs: 6200, priority: 100 };
  }

  if (event === "khalifa_insight") {
    return { key: "glassBreak", volume: 0.36, channel: "admin-khalifa-insight", minIntervalMs: 4200, priority: 92 };
  }

  if (event === "urgent_alert" || event === "khalifa_question") {
    return { key: "carHorn", volume: event === "khalifa_question" ? 0.62 : 0.68, channel: event === "khalifa_question" ? "admin-khalifa-question" : "admin-urgent-horn", minIntervalMs: event === "khalifa_question" ? 1700 : 2600, priority: 80 };
  }

  if (event === "success" || event === "print_ready" || event === "print_done" || event === "database_health_ok" || event === "daily_closing_ready") {
    return { key: "doorClose", volume: 0.28, channel: "admin-soft-confirm", minIntervalMs: 850, priority: 35 };
  }

  if (event === "notification" || event === "new_order" || event === "cod_alert") {
    return { key: "sectionDoor", volume: 0.3, channel: "admin-important-notification", minIntervalMs: 1200, priority: 18 };
  }

  if (event === "warning" || event === "error" || event === "daily_closing_warning" || event === "database_health_warning") {
    return { key: "sectionDoor", volume: 0.34, channel: "admin-warning", minIntervalMs: 1200, priority: 20 };
  }

  return null;
}

export function playAdminAudioEvent(event: AdminAudioEvent, settings = readAdminAudioSettings()) {
  installKhalifaQuestionAudioBinding();
  if (!allowed(event, settings)) return;
  if (!unlocked) {
    if (!["notification", "new_order", "cod_alert", "urgent_alert", "critical_alert", "warning", "error"].includes(event)) {
      pendingAudio = [...pendingAudio, event].slice(-4);
    }
    return;
  }

  const routed = routeAdminAudioEvent(event);
  if (!routed) return;

  playDayNightSound(routed.key, {
    channel: routed.channel,
    volume: routed.volume,
    minIntervalMs: routed.minIntervalMs,
    priority: routed.priority,
  });
}

function compactVoiceText(input: string) {
  return input.replace(/COD/g, "التحصيل عند التسليم").replace(/AED/g, "درهم").replace(/\s+/g, " ").trim().slice(0, 180);
}

export function speakKhalifa(text: string, language: "ar" | "en" = "ar", settings = readAdminAudioSettings()) {
  if (!hasWindow() || !settings.enabled || settings.muted || !settings.khalifaVoice || !settings.khalifaSounds || !unlocked) return;
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
  const now = Date.now();
  if (now - lastVoiceAt < 6500) return;
  lastVoiceAt = now;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(compactVoiceText(text));
    utterance.lang = language === "ar" ? "ar-AE" : "en-US";
    utterance.rate = language === "ar" ? 0.92 : 0.96;
    utterance.pitch = 1.02;
    utterance.volume = Math.max(0.05, Math.min(1, settings.volume));
    const voices = window.speechSynthesis.getVoices?.() || [];
    const preferred = voices.find((voice) => voice.lang?.toLowerCase().startsWith(language === "ar" ? "ar" : "en"));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Browser voice is optional; the tone still works.
  }
}

export function readAdminNotifications(): AdminNotification[] {
  if (!hasWindow()) return [];
  const items = safeJson<AdminNotification[]>(window.localStorage.getItem(ADMIN_NOTIFICATIONS_KEY), []);
  return Array.isArray(items) ? items : [];
}

export function writeAdminNotifications(items: AdminNotification[]) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify(items.slice(0, 50)));
    window.dispatchEvent(new CustomEvent("dn-admin-notifications-change"));
  } catch {
    // noop
  }
}

function readDedupe(): Record<string, number> {
  return hasWindow() ? safeJson<Record<string, number>>(window.localStorage.getItem(ADMIN_NOTIFICATION_DEDUPE_KEY), {}) : {};
}

function writeDedupe(map: Record<string, number>) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(ADMIN_NOTIFICATION_DEDUPE_KEY, JSON.stringify(map));
  } catch {
    // noop
  }
}

function showBrowserNotification(item: AdminNotification, settings: AdminAudioSettings) {
  if (!hasWindow() || !settings.browserNotifications || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(item.titleEn, { body: item.bodyEn, tag: item.dedupeKey || item.id, silent: true });
  } catch {
    // noop
  }
}

export function requestAdminBrowserNotifications() {
  if (!hasWindow() || !("Notification" in window)) return Promise.resolve("unsupported" as const);
  if (Notification.permission === "granted") return Promise.resolve("granted" as const);
  return Notification.requestPermission();
}

function isOldOrInitialNotification(input: AddNotificationInput, now: number): boolean {
  if (input.createdAt) {
    const createdTime = new Date(input.createdAt).getTime();
    if (Number.isFinite(createdTime) && createdTime < moduleLoadedAt) return true;
  }

  return now < initialNotificationAudioMuteUntil && Boolean(input.dedupeKey);
}

export function addAdminNotification(input: AddNotificationInput): AdminNotification | null {
  const now = Date.now();
  if (input.dedupeKey) {
    const map = readDedupe();
    if (now - (map[input.dedupeKey] || 0) < (input.dedupeMs ?? 300000)) return null;
    map[input.dedupeKey] = now;
    writeDedupe(map);
  }

  const item: AdminNotification = {
    id: input.id || `${now}-${Math.random().toString(36).slice(2)}`,
    type: input.type,
    titleAr: input.titleAr,
    titleEn: input.titleEn,
    bodyAr: input.bodyAr,
    bodyEn: input.bodyEn,
    createdAt: input.createdAt || new Date(now).toISOString(),
    sectionId: input.sectionId,
    priority: input.priority || "normal",
    read: false,
    dedupeKey: input.dedupeKey,
  };

  writeAdminNotifications([item, ...readAdminNotifications()]);
  const settings = readAdminAudioSettings();
  showBrowserNotification(item, settings);

  if (!isOldOrInitialNotification(input, now) && settings.enabled && !settings.muted && settings.notificationSounds) {
    if (input.audioEvent === "khalifa_insight" || input.audioEvent === "khalifa_question") {
      playAdminAudioEvent(input.audioEvent, settings);
    } else {
      handleAdminNotification({ id: item.id, type: item.type, priority: item.priority, createdAt: item.createdAt });
    }
    if (item.type === "khalifa") speakKhalifa(item.bodyAr || item.titleAr, "ar", settings);
  }

  return item;
}

export function markAdminNotificationsRead(ids?: string[]) {
  writeAdminNotifications(readAdminNotifications().map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
}

export function clearAdminNotifications() {
  writeAdminNotifications([]);
}

export function muteAdminAudioImmediately() {
  stopAllDayNightSounds(120);
  writeAdminAudioSettings({ ...readAdminAudioSettings(), muted: true });
}
