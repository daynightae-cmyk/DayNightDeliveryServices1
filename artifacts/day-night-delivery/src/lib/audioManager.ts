export type DayNightSoundKey = "glassBreak" | "doorClose" | "carHorn" | "engineStart" | "sectionDoor";

export type DayNightAudioSettings = {
  enabled: boolean;
  muted: boolean;
  volume: number;
};

type PlayOptions = {
  volume?: number;
  loop?: boolean;
  channel?: string;
  restart?: boolean;
  minIntervalMs?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  respectSettings?: boolean;
  priority?: number;
};

type NotificationLike = {
  id?: string;
  type?: string;
  priority?: "low" | "normal" | "high" | "critical" | string;
  createdAt?: string;
};

const ENABLED_KEY = "daynight_audio_enabled";
const VOLUME_KEY = "daynight_audio_volume";
const MUTED_KEY = "daynight_audio_muted";
const LEGACY_SETTINGS_KEY = "dn_admin_audio_settings_v1";
const PLAYED_NOTIFICATION_KEY = "daynight_audio_played_notification_ids_v1";
const NAVIGATION_COOLDOWN_MS = 620;

export const DAY_NIGHT_SOUND_URLS: Record<DayNightSoundKey, string> = {
  glassBreak: "https://files.catbox.moe/kuvupd.mp3",
  doorClose: "https://files.catbox.moe/5r0qat.mp3",
  carHorn: "https://files.catbox.moe/18hnsm.mp3",
  engineStart: "https://files.catbox.moe/p9nk1c.mp3",
  sectionDoor: "https://files.catbox.moe/e6pio3.mp3",
};

const defaultSettings: DayNightAudioSettings = {
  enabled: true,
  muted: false,
  volume: 0.35,
};

const audioByKey = new Map<DayNightSoundKey, HTMLAudioElement>();
const activeByChannel = new Map<string, HTMLAudioElement>();
const lastPlayedAt = new Map<string, number>();
let browserUnlocked = false;
let unlockListenersInstalled = false;
let navAudioBindingInstalled = false;
let pendingAfterUnlock: Array<{ key: DayNightSoundKey; options: PlayOptions }> = [];
let lastKnownSectionTitle = "";
let lastNavigationAudioAt = 0;
let lastLogoutAudioAt = 0;
let playedNotificationIds = new Set<string>();

function hasBrowserAudio(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined" && typeof Audio !== "undefined";
}

function clamp01(value: unknown, fallback = defaultSettings.volume): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function readLegacyPartial(): Partial<DayNightAudioSettings> {
  if (!hasBrowserAudio()) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEGACY_SETTINGS_KEY) || "{}");
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : undefined,
      muted: typeof parsed.muted === "boolean" ? parsed.muted : undefined,
      volume: typeof parsed.volume === "number" ? clamp01(parsed.volume) : undefined,
    };
  } catch {
    return {};
  }
}

export function readDayNightAudioSettings(): DayNightAudioSettings {
  if (!hasBrowserAudio()) return defaultSettings;
  const legacy = readLegacyPartial();
  const enabledRaw = window.localStorage.getItem(ENABLED_KEY);
  const mutedRaw = window.localStorage.getItem(MUTED_KEY);
  const volumeRaw = window.localStorage.getItem(VOLUME_KEY);

  return {
    enabled: enabledRaw === null ? legacy.enabled ?? defaultSettings.enabled : enabledRaw === "true",
    muted: mutedRaw === null ? legacy.muted ?? defaultSettings.muted : mutedRaw === "true",
    volume: volumeRaw === null ? legacy.volume ?? defaultSettings.volume : clamp01(volumeRaw),
  };
}

export function writeDayNightAudioSettings(patch: Partial<DayNightAudioSettings>): DayNightAudioSettings {
  const current = readDayNightAudioSettings();
  const next = { ...current, ...patch, volume: clamp01(patch.volume ?? current.volume) };
  if (!hasBrowserAudio()) return next;

  try {
    window.localStorage.setItem(ENABLED_KEY, String(next.enabled));
    window.localStorage.setItem(MUTED_KEY, String(next.muted));
    window.localStorage.setItem(VOLUME_KEY, String(next.volume));
    window.dispatchEvent(new CustomEvent("daynight-audio-settings-change", { detail: next }));
  } catch {
    // localStorage can be unavailable in private browsing; keep the UI alive.
  }

  if (!next.enabled || next.muted || next.volume <= 0) stopAllDayNightSounds(120);
  return next;
}

export function resetDayNightAudioSettings(): DayNightAudioSettings {
  return writeDayNightAudioSettings(defaultSettings);
}

export function setDayNightAudioEnabled(enabled: boolean): DayNightAudioSettings {
  return writeDayNightAudioSettings({ enabled, muted: enabled ? false : true });
}

export function setDayNightAudioMuted(muted: boolean): DayNightAudioSettings {
  return writeDayNightAudioSettings({ muted, enabled: muted ? readDayNightAudioSettings().enabled : true });
}

export function setDayNightAudioVolume(volume: number): DayNightAudioSettings {
  return writeDayNightAudioSettings({ volume: clamp01(volume), enabled: true, muted: false });
}

function ensureAudio(key: DayNightSoundKey): HTMLAudioElement | null {
  if (!hasBrowserAudio()) return null;
  const existing = audioByKey.get(key);
  if (existing) return existing;

  try {
    const audio = new Audio(DAY_NIGHT_SOUND_URLS[key]);
    audio.preload = "auto";
    audioByKey.set(key, audio);
    return audio;
  } catch {
    return null;
  }
}

function installUnlockListeners(): void {
  if (!hasBrowserAudio() || unlockListenersInstalled) return;
  unlockListenersInstalled = true;

  const unlock = () => unlockDayNightAudio();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
}

function getCurrentAdminSectionTitle(): string {
  if (!hasBrowserAudio()) return "";
  const element = document.querySelector(".dn-admin-current-section strong");
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function isLogoutButton(target: HTMLElement | null): boolean {
  const text = (target?.closest("button")?.textContent || "").replace(/\s+/g, " ").toLowerCase();
  return text.includes("تسجيل الخروج") || text.includes("logout");
}

export function installAdminNavigationAudioBinding(): void {
  if (!hasBrowserAudio() || navAudioBindingInstalled) return;
  navAudioBindingInstalled = true;
  lastKnownSectionTitle = getCurrentAdminSectionTitle();

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button") as HTMLButtonElement | null;
    if (!button || button.disabled || !button.closest(".dn-admin-fullscreen")) return;

    unlockDayNightAudio();

    if (isLogoutButton(target)) {
      handleAdminLogout();
      return;
    }

    const before = getCurrentAdminSectionTitle() || lastKnownSectionTitle;
    window.setTimeout(() => {
      const after = getCurrentAdminSectionTitle();
      if (!after) return;
      if (!before) {
        lastKnownSectionTitle = after;
        return;
      }
      if (after !== before) {
        handleSectionNavigation(after, before);
        lastKnownSectionTitle = after;
      }
    }, 80);
  }, true);
}

function fadeVolume(audio: HTMLAudioElement, target: number, durationMs: number, done?: () => void): void {
  if (!hasBrowserAudio() || durationMs <= 0) {
    audio.volume = target;
    done?.();
    return;
  }

  const start = audio.volume;
  const startedAt = performance.now();
  const step = () => {
    const ratio = Math.min(1, (performance.now() - startedAt) / durationMs);
    audio.volume = start + (target - start) * ratio;
    if (ratio < 1) window.requestAnimationFrame(step);
    else done?.();
  };
  window.requestAnimationFrame(step);
}

export function preloadDayNightSounds(keys: DayNightSoundKey[] = ["engineStart", "sectionDoor", "doorClose", "carHorn", "glassBreak"]): void {
  if (!hasBrowserAudio()) return;
  installUnlockListeners();
  installAdminNavigationAudioBinding();
  keys.forEach((key) => {
    const audio = ensureAudio(key);
    try {
      audio?.load();
    } catch {
      // Loading is opportunistic only.
    }
  });
}

export function unlockDayNightAudio(): void {
  if (!hasBrowserAudio()) return;
  browserUnlocked = true;
  preloadDayNightSounds();
  const queued = pendingAfterUnlock.splice(0, 3);
  queued.forEach(({ key, options }, index) => {
    window.setTimeout(() => playDayNightSound(key, { ...options, respectSettings: true }), index * 120);
  });
}

function stopLowerPriorityAudio(nextPriority: number): void {
  if (nextPriority >= 90) {
    audioByKey.forEach((audio, key) => {
      if (key !== "glassBreak") stopAudioElement(audio, 120);
    });
    activeByChannel.clear();
    return;
  }

  if (nextPriority >= 70) {
    stopDayNightChannel("admin-section-navigation", 80);
    stopDayNightChannel("admin-important-notification", 80);
    stopDayNightChannel("admin-khalifa", 80);
  }
}

export function playDayNightSound(key: DayNightSoundKey, options: PlayOptions = {}): boolean {
  if (!hasBrowserAudio()) return false;
  installUnlockListeners();
  installAdminNavigationAudioBinding();

  const settings = readDayNightAudioSettings();
  if (options.respectSettings !== false && (!settings.enabled || settings.muted || settings.volume <= 0)) return false;

  const intervalKey = options.channel || key;
  const now = Date.now();
  const minInterval = options.minIntervalMs ?? (key === "glassBreak" ? 5200 : key === "carHorn" ? 2200 : key === "engineStart" ? 2800 : 420);
  if (now - (lastPlayedAt.get(intervalKey) || 0) < minInterval) return false;
  lastPlayedAt.set(intervalKey, now);

  const audio = ensureAudio(key);
  if (!audio) return false;

  stopLowerPriorityAudio(options.priority ?? 10);

  const channel = options.channel;
  if (channel) {
    const current = activeByChannel.get(channel);
    if (current) stopAudioElement(current, options.fadeOutMs ?? 80);
    activeByChannel.set(channel, audio);
  }

  try {
    if (options.restart !== false || audio.ended || audio.paused) audio.currentTime = 0;
  } catch {
    // Some remote files may not allow currentTime before metadata is ready.
  }

  const targetVolume = clamp01(settings.volume * (options.volume ?? 1));
  audio.loop = Boolean(options.loop);
  audio.volume = options.fadeInMs ? 0.001 : targetVolume;

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    void playPromise
      .then(() => {
        if (options.fadeInMs) fadeVolume(audio, targetVolume, options.fadeInMs);
      })
      .catch(() => {
        if (!browserUnlocked && options.respectSettings !== false) {
          pendingAfterUnlock = [...pendingAfterUnlock, { key, options }].slice(-3);
        }
      });
  }

  return true;
}

function stopAudioElement(audio: HTMLAudioElement, fadeOutMs = 0): void {
  const finish = () => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // noop
    }
  };

  try {
    if (fadeOutMs > 0 && !audio.paused) fadeVolume(audio, 0, fadeOutMs, finish);
    else finish();
  } catch {
    finish();
  }
}

export function stopDayNightSound(key: DayNightSoundKey, fadeOutMs = 0): void {
  const audio = audioByKey.get(key);
  if (audio) stopAudioElement(audio, fadeOutMs);
}

export function stopDayNightChannel(channel: string, fadeOutMs = 0): void {
  const audio = activeByChannel.get(channel);
  if (audio) stopAudioElement(audio, fadeOutMs);
  activeByChannel.delete(channel);
}

export function stopAllDayNightSounds(fadeOutMs = 0): void {
  audioByKey.forEach((audio) => stopAudioElement(audio, fadeOutMs));
  activeByChannel.clear();
}

export function stopCurrentAudio(fadeOutMs = 120): void {
  stopAllDayNightSounds(fadeOutMs);
}

export function stopAllAudio(fadeOutMs = 120): void {
  stopAllDayNightSounds(fadeOutMs);
}

export function fadeOutDayNightSound(key: DayNightSoundKey, fadeOutMs = 450): void {
  stopDayNightSound(key, fadeOutMs);
}

export function playEngineStart(): boolean {
  unlockDayNightAudio();
  return playDayNightSound("engineStart", {
    channel: "admin-loading-engine",
    volume: 1,
    restart: true,
    minIntervalMs: 2800,
    fadeInMs: 120,
    fadeOutMs: 500,
    priority: 75,
  });
}

export function playSectionDoor(): boolean {
  return playDayNightSound("sectionDoor", {
    channel: "admin-section-navigation",
    volume: 0.44,
    restart: true,
    minIntervalMs: NAVIGATION_COOLDOWN_MS,
    fadeOutMs: 120,
    priority: 20,
  });
}

export function playDoorClose(): boolean {
  return playDayNightSound("doorClose", {
    channel: "admin-door-close",
    volume: 0.55,
    restart: true,
    minIntervalMs: 1000,
    fadeOutMs: 140,
    priority: 35,
  });
}

export function playHornAlert(): boolean {
  return playDayNightSound("carHorn", {
    channel: "admin-urgent-horn",
    volume: 0.68,
    restart: true,
    minIntervalMs: 2600,
    fadeOutMs: 120,
    priority: 80,
  });
}

export function playCriticalAlert(): boolean {
  return playDayNightSound("glassBreak", {
    channel: "admin-critical-alert",
    volume: 0.5,
    restart: true,
    minIntervalMs: 6200,
    fadeOutMs: 160,
    priority: 100,
  });
}

export function handleSectionNavigation(nextSection: string, currentSection?: string): boolean {
  if (!hasBrowserAudio()) return false;
  const next = String(nextSection || "").trim();
  const current = String(currentSection || "").trim();
  if (!next || (current && next === current)) return false;

  const now = Date.now();
  if (now - lastNavigationAudioAt < NAVIGATION_COOLDOWN_MS) return false;
  lastNavigationAudioAt = now;
  return playSectionDoor();
}

export function handleAdminLogout(): boolean {
  const now = Date.now();
  if (now - lastLogoutAudioAt < 1500) return false;
  lastLogoutAudioAt = now;
  stopAllDayNightSounds(90);
  return playDoorClose();
}

function readPlayedNotificationIds(): Set<string> {
  if (!hasBrowserAudio()) return playedNotificationIds;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(PLAYED_NOTIFICATION_KEY) || "[]");
    if (Array.isArray(stored)) playedNotificationIds = new Set(stored.map(String).slice(-160));
  } catch {
    // Keep in-memory set.
  }
  return playedNotificationIds;
}

function writePlayedNotificationIds(ids: Set<string>): void {
  if (!hasBrowserAudio()) return;
  try {
    window.sessionStorage.setItem(PLAYED_NOTIFICATION_KEY, JSON.stringify([...ids].slice(-160)));
  } catch {
    // Session storage can be unavailable; in-memory protection remains.
  }
}

export function handleAdminNotification(notification: NotificationLike): boolean {
  if (!notification) return false;
  const id = String(notification.id || `${notification.type || "notice"}:${notification.createdAt || ""}`);
  const ids = readPlayedNotificationIds();
  if (id && ids.has(id)) return false;
  if (id) {
    ids.add(id);
    writePlayedNotificationIds(ids);
  }

  const priority = String(notification.priority || "normal").toLowerCase();
  if (priority === "critical") return playCriticalAlert();
  if (priority === "high" || priority === "urgent") return playHornAlert();

  return playDayNightSound("sectionDoor", {
    channel: "admin-important-notification",
    volume: 0.3,
    restart: true,
    minIntervalMs: 1200,
    fadeOutMs: 120,
    priority: 18,
  });
}

export function handleOperationCompleted(operationType?: string): boolean {
  const type = String(operationType || "").toLowerCase();
  if (/critical|security|danger/.test(type)) return playCriticalAlert();
  if (/settlement|closing|out.?scope|delivery|approved|printed|completed/.test(type)) return playDoorClose();
  return false;
}

export function handleCriticalSystemEvent(event?: { id?: string; type?: string; priority?: string }): boolean {
  return handleAdminNotification({ ...event, priority: "critical" });
}

export const dayNightAudioDistribution: Array<{ key: DayNightSoundKey; ar: string; en: string; auto: boolean }> = [
  { key: "engineStart", ar: "صفحة التحميل بعد تسجيل دخول صحيح", en: "Loading page after successful admin login", auto: true },
  { key: "sectionDoor", ar: "الانتقال الحقيقي بين أقسام لوحة التحكم والتنبيهات المهمة الهادئة", en: "Real admin section changes and quiet important alerts", auto: true },
  { key: "doorClose", ar: "تسجيل الخروج ونهاية العمليات الرئيسية", en: "Logout and major operation completion", auto: true },
  { key: "carHorn", ar: "تنبيه عاجل جديد فقط أو تجربة يضغطها المستخدم", en: "New urgent alert or explicit user test only", auto: false },
  { key: "glassBreak", ar: "حادث حرج حقيقي فقط أو تجربة يضغطها المستخدم", en: "Real critical incident or explicit user test only", auto: false },
];

if (hasBrowserAudio()) {
  installAdminNavigationAudioBinding();
}
