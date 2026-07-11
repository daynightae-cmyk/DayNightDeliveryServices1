export type AdminAudioEvent =
  | "click"
  | "hover"
  | "success"
  | "error"
  | "warning"
  | "notification"
  | "new_order"
  | "cod_alert"
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

export type AdminNotificationPriority = "low" | "normal" | "high";
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

export const ADMIN_AUDIO_SETTINGS_KEY = "dn_admin_audio_settings_v1";
export const ADMIN_NOTIFICATIONS_KEY = "dn_admin_notifications_v1";
export const ADMIN_NOTIFICATION_DEDUPE_KEY = "dn_admin_notification_dedupe_v1";

const fallback: AdminAudioSettings = {
  enabled: true,
  muted: false,
  volume: 0.42,
  clickSounds: true,
  notificationSounds: true,
  khalifaSounds: true,
  khalifaVoice: false,
  warningSounds: true,
  browserNotifications: false,
};

let ctx: AudioContext | null = null;
let unlocked = false;
let lastSoundAt = 0;
let lastVoiceAt = 0;
let pendingAudio: AdminAudioEvent[] = [];

const hasWindow = () => typeof window !== "undefined";

function safeJson<T>(raw: string | null, fb: T): T {
  if (!raw) return fb;
  try {
    return { ...fb, ...JSON.parse(raw) };
  } catch {
    return fb;
  }
}

export function readAdminAudioSettings(): AdminAudioSettings {
  if (!hasWindow()) return fallback;
  return safeJson(window.localStorage.getItem(ADMIN_AUDIO_SETTINGS_KEY), fallback);
}

export function writeAdminAudioSettings(settings: AdminAudioSettings) {
  if (!hasWindow()) return;
  const next = { ...fallback, ...settings, volume: Math.max(0, Math.min(1, Number(settings.volume ?? fallback.volume))) };
  try {
    window.localStorage.setItem(ADMIN_AUDIO_SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("dn-admin-audio-settings-change", { detail: next }));
  } catch {
    // noop
  }
}

export function resetAdminAudioSettings() {
  writeAdminAudioSettings(fallback);
  return fallback;
}

function getContext() {
  if (!hasWindow()) return null;
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  ctx ||= new AudioCtor();
  return ctx;
}

export function unlockAdminAudio() {
  const audio = getContext();
  unlocked = true;
  if (audio?.state === "suspended") void audio.resume().catch(() => undefined);
  const queued = [...pendingAudio].slice(-4);
  pendingAudio = [];
  queued.forEach((event, index) => window.setTimeout(() => playAdminAudioEvent(event), index * 180));
}

const profiles: Record<AdminAudioEvent, Array<[number, number, OscillatorType?]>> = {
  click: [[680, 0.045, "sine"]],
  hover: [[540, 0.035, "sine"]],
  success: [[660, 0.1, "sine"], [920, 0.14, "sine"], [1240, 0.1, "sine"]],
  error: [[180, 0.16, "triangle"], [140, 0.18, "sawtooth"]],
  warning: [[330, 0.13, "sine"], [260, 0.16, "triangle"], [330, 0.12, "sine"]],
  notification: [[820, 0.08, "sine"], [1120, 0.14, "sine"]],
  new_order: [[740, 0.08, "sine"], [980, 0.1, "sine"], [1180, 0.14, "sine"]],
  cod_alert: [[520, 0.09, "triangle"], [660, 0.11, "sine"], [520, 0.12, "triangle"]],
  khalifa_insight: [[880, 0.08, "sine"], [1320, 0.13, "sine"], [1760, 0.1, "sine"]],
  daily_closing_ready: [[560, 0.12, "sine"], [720, 0.14, "sine"]],
  daily_closing_warning: [[300, 0.18, "triangle"], [240, 0.16, "triangle"]],
  database_health_ok: [[980, 0.08, "sine"], [1240, 0.1, "sine"]],
  database_health_warning: [[420, 0.11, "square"], [320, 0.16, "triangle"]],
  print_ready: [[700, 0.075, "sine"], [940, 0.1, "sine"]],
  print_done: [[760, 0.1, "sine"], [900, 0.09, "sine"]],
};

function allowed(event: AdminAudioEvent, s: AdminAudioSettings) {
  if (!s.enabled || s.muted) return false;
  if ((event === "click" || event === "hover") && !s.clickSounds) return false;
  if (["notification", "new_order", "cod_alert", "print_ready", "print_done", "daily_closing_ready"].includes(event) && !s.notificationSounds) return false;
  if (event === "khalifa_insight" && !s.khalifaSounds) return false;
  if (["error", "warning", "daily_closing_warning", "database_health_warning"].includes(event) && !s.warningSounds) return false;
  return true;
}

export function playAdminAudioEvent(event: AdminAudioEvent, settings = readAdminAudioSettings()) {
  if (!allowed(event, settings)) return;
  if (!unlocked) {
    pendingAudio = [...pendingAudio, event].slice(-4);
    return;
  }

  const now = Date.now();
  if (now - lastSoundAt < 115) return;
  const audio = getContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().catch(() => undefined);

  lastSoundAt = now;
  let offset = 0;
  const masterVolume = Math.max(0.001, settings.volume * 0.085);

  for (const [freq, dur, type = "sine"] of profiles[event]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audio.currentTime + offset);
    gain.gain.setValueAtTime(0.0001, audio.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(masterVolume, audio.currentTime + offset + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + offset + dur);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(audio.currentTime + offset);
    osc.stop(audio.currentTime + offset + dur + 0.025);
    offset += dur + 0.025;
  }
}

function notificationAudio(type: AdminNotificationType, priority?: AdminNotificationPriority): AdminAudioEvent {
  if (type === "khalifa") return "khalifa_insight";
  if (type === "new_order") return "new_order";
  if (type === "cod") return "cod_alert";
  if (type === "print") return "print_ready";
  if (type === "database") return priority === "high" ? "database_health_warning" : "database_health_ok";
  if (type === "daily_closing") return priority === "high" ? "daily_closing_warning" : "daily_closing_ready";
  if (type === "error") return "error";
  if (type === "warning") return "warning";
  if (type === "success") return "success";
  return "notification";
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
  playAdminAudioEvent(input.audioEvent || notificationAudio(item.type, item.priority), settings);
  if (item.type === "khalifa") speakKhalifa(item.bodyAr || item.titleAr, "ar", settings);
  return item;
}

export function markAdminNotificationsRead(ids?: string[]) {
  writeAdminNotifications(readAdminNotifications().map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
}

export function clearAdminNotifications() {
  writeAdminNotifications([]);
}
