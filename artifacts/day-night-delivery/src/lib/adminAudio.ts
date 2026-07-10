export type AdminAudioEvent =
  | "click" | "hover" | "success" | "error" | "warning" | "notification" | "new_order" | "cod_alert" | "khalifa_insight" | "daily_closing_ready" | "daily_closing_warning" | "database_health_ok" | "database_health_warning" | "print_ready" | "print_done";

export type AdminAudioSettings = {
  enabled: boolean;
  muted: boolean;
  volume: number;
  clickSounds: boolean;
  notificationSounds: boolean;
  khalifaSounds: boolean;
  warningSounds: boolean;
  browserNotifications: boolean;
  lastEnabledAt?: string;
};

export type AdminNotificationType = "success" | "warning" | "error" | "info" | "new_order" | "cod" | "print" | "database" | "daily_closing" | "khalifa";
export type AdminNotificationPriority = "low" | "normal" | "high";
export type AdminNotification = { id: string; type: AdminNotificationType; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; createdAt: string; sectionId?: string; priority?: AdminNotificationPriority; read?: boolean; dedupeKey?: string };
export type AdminNotificationInput = Omit<AdminNotification, "id" | "createdAt" | "read"> & { id?: string; createdAt?: string; audioEvent?: AdminAudioEvent };

export const adminAudioStorageKey = "dn_admin_audio_settings_v1";
export const adminNotificationsStorageKey = "dn_admin_notifications_v1";
const adminNotificationDedupeKey = "dn_admin_notification_dedupe_v1";

export const defaultAdminAudioSettings: AdminAudioSettings = { enabled: false, muted: false, volume: 0.35, clickSounds: true, notificationSounds: true, khalifaSounds: true, warningSounds: true, browserNotifications: false };

type ToneStep = { frequency: number; duration: number; type?: OscillatorType; gain?: number };
const profiles: Record<AdminAudioEvent, ToneStep[]> = {
  click: [{ frequency: 900, duration: 0.055, type: "sine", gain: 0.22 }],
  hover: [{ frequency: 680, duration: 0.045, type: "sine", gain: 0.14 }],
  success: [{ frequency: 660, duration: 0.11 }, { frequency: 920, duration: 0.16 }],
  error: [{ frequency: 260, duration: 0.13, type: "triangle" }, { frequency: 190, duration: 0.13, type: "triangle" }],
  warning: [{ frequency: 330, duration: 0.18, type: "triangle" }, { frequency: 294, duration: 0.18, type: "triangle" }],
  notification: [{ frequency: 720, duration: 0.12 }, { frequency: 1080, duration: 0.18 }],
  new_order: [{ frequency: 740, duration: 0.1 }, { frequency: 988, duration: 0.13 }, { frequency: 1244, duration: 0.16 }],
  cod_alert: [{ frequency: 523, duration: 0.12, type: "triangle" }, { frequency: 659, duration: 0.18, type: "sine" }],
  khalifa_insight: [{ frequency: 880, duration: 0.08 }, { frequency: 1320, duration: 0.18, gain: 0.2 }],
  daily_closing_ready: [{ frequency: 587, duration: 0.13 }, { frequency: 784, duration: 0.2 }],
  daily_closing_warning: [{ frequency: 294, duration: 0.22, type: "triangle" }, { frequency: 392, duration: 0.18, type: "triangle" }],
  database_health_ok: [{ frequency: 620, duration: 0.1 }, { frequency: 930, duration: 0.14 }],
  database_health_warning: [{ frequency: 440, duration: 0.11, type: "square", gain: 0.14 }, { frequency: 330, duration: 0.2, type: "triangle" }],
  print_ready: [{ frequency: 698, duration: 0.09 }, { frequency: 784, duration: 0.12 }, { frequency: 1046, duration: 0.13 }],
  print_done: [{ frequency: 784, duration: 0.12 }, { frequency: 1175, duration: 0.14 }],
};

let audioContext: AudioContext | null = null;
let lastSoundAt = 0;
let unlocked = false;

function storageGet(key: string) { if (typeof window === "undefined") return null; try { return window.localStorage.getItem(key); } catch { return null; } }
function storageSet(key: string, value: string) { if (typeof window === "undefined") return; try { window.localStorage.setItem(key, value); } catch (error) { console.warn("Admin localStorage warning:", error); } }

export function readAdminAudioSettings(): AdminAudioSettings {
  try {
    const parsed = JSON.parse(storageGet(adminAudioStorageKey) || "{}") as Partial<AdminAudioSettings>;
    return { ...defaultAdminAudioSettings, ...parsed, volume: Math.min(1, Math.max(0, Number(parsed.volume ?? defaultAdminAudioSettings.volume))) };
  } catch { return defaultAdminAudioSettings; }
}

export function writeAdminAudioSettings(settings: AdminAudioSettings) { storageSet(adminAudioStorageKey, JSON.stringify(settings)); if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dn-admin-audio-settings-change", { detail: settings })); }

export function unlockAdminAudio() {
  unlocked = true;
  if (typeof window === "undefined" || !("AudioContext" in window || "webkitAudioContext" in window)) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  audioContext ||= new Ctor();
  void audioContext.resume().catch(() => undefined);
}

function eventAllowed(event: AdminAudioEvent, settings: AdminAudioSettings) {
  if (!settings.enabled || settings.muted) return false;
  if (event === "click" || event === "hover") return settings.clickSounds;
  if (event === "khalifa_insight") return settings.khalifaSounds;
  if (["warning", "error", "daily_closing_warning", "database_health_warning", "cod_alert"].includes(event)) return settings.warningSounds;
  return settings.notificationSounds;
}

export function playAdminAudioEvent(event: AdminAudioEvent, settings = readAdminAudioSettings()) {
  if (typeof document !== "undefined" && document.hidden) return;
  if (!unlocked || !eventAllowed(event, settings)) return;
  const now = Date.now();
  if (now - lastSoundAt < 150) return;
  lastSoundAt = now;
  try {
    unlockAdminAudio();
    if (!audioContext) return;
    let offset = 0;
    profiles[event].forEach((step) => {
      if (!audioContext) return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = step.type || "sine";
      osc.frequency.setValueAtTime(step.frequency, audioContext.currentTime + offset);
      const peak = Math.min(0.22, Math.max(0.01, settings.volume * (step.gain ?? 0.18)));
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(peak, audioContext.currentTime + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + offset + step.duration);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(audioContext.currentTime + offset);
      osc.stop(audioContext.currentTime + offset + step.duration + 0.02);
      offset += step.duration * 0.82;
    });
  } catch (error) { console.warn("Admin audio warning:", (error as Error)?.message || error); }
}

export function readAdminNotifications(): AdminNotification[] {
  try { const parsed = JSON.parse(storageGet(adminNotificationsStorageKey) || "[]") as AdminNotification[]; return Array.isArray(parsed) ? parsed.slice(0, 30) : []; } catch { return []; }
}

export function writeAdminNotifications(items: AdminNotification[]) { storageSet(adminNotificationsStorageKey, JSON.stringify(items.slice(0, 30))); if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dn-admin-notifications-change", { detail: items.slice(0, 30) })); }

function readDedupe(): Record<string, string> { try { const parsed = JSON.parse(storageGet(adminNotificationDedupeKey) || "{}") as Record<string, string>; return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; } }

export function addAdminNotification(input: AdminNotificationInput, options?: { dedupeMs?: number; playSound?: boolean }) {
  const dedupeKey = input.dedupeKey || `${input.type}:${input.sectionId || "global"}:${input.titleEn}`;
  const dedupe = readDedupe();
  const previous = Date.parse(dedupe[dedupeKey] || "");
  const now = Date.now();
  if (previous && now - previous < (options?.dedupeMs ?? 300000)) return null;
  dedupe[dedupeKey] = new Date(now).toISOString();
  storageSet(adminNotificationDedupeKey, JSON.stringify(dedupe));
  const notification: AdminNotification = { ...input, id: input.id || `${now}-${Math.random().toString(36).slice(2, 8)}`, createdAt: input.createdAt || new Date(now).toISOString(), read: false };
  const next = [notification, ...readAdminNotifications().filter((item) => item.id !== notification.id)].slice(0, 30);
  writeAdminNotifications(next);
  if (options?.playSound !== false && input.audioEvent) playAdminAudioEvent(input.audioEvent);
  return notification;
}

export function markAdminNotificationsRead() { writeAdminNotifications(readAdminNotifications().map((item) => ({ ...item, read: true }))); }
export function clearAdminNotifications() { writeAdminNotifications([]); }

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }
