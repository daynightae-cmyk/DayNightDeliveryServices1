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
};

const ENABLED_KEY = "daynight_audio_enabled";
const VOLUME_KEY = "daynight_audio_volume";
const MUTED_KEY = "daynight_audio_muted";
const LEGACY_SETTINGS_KEY = "dn_admin_audio_settings_v1";

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
    audio.crossOrigin = "anonymous";
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

export function installAdminNavigationAudioBinding(): void {
  if (!hasBrowserAudio() || navAudioBindingInstalled) return;
  navAudioBindingInstalled = true;

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest(".dn-admin-side-nav button") as HTMLButtonElement | null;
    if (!button || button.disabled || button.classList.contains("is-active")) return;

    const label = (button.textContent || "").trim().toLowerCase();
    unlockDayNightAudio();

    if (label.includes("تسجيل الخروج") || label.includes("logout")) {
      playDayNightSound("doorClose", { channel: "admin-logout", volume: 0.55, minIntervalMs: 1200, fadeOutMs: 180 });
      return;
    }

    playDayNightSound("sectionDoor", { channel: "admin-section-navigation", volume: 0.44, minIntervalMs: 650, fadeOutMs: 160 });
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
    if (ratio < 1) {
      window.requestAnimationFrame(step);
    } else {
      done?.();
    }
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

export function playDayNightSound(key: DayNightSoundKey, options: PlayOptions = {}): boolean {
  if (!hasBrowserAudio()) return false;
  installUnlockListeners();
  installAdminNavigationAudioBinding();

  const settings = readDayNightAudioSettings();
  if (options.respectSettings !== false && (!settings.enabled || settings.muted || settings.volume <= 0)) return false;

  const intervalKey = options.channel || key;
  const now = Date.now();
  const minInterval = options.minIntervalMs ?? (key === "carHorn" ? 1400 : key === "engineStart" ? 2800 : 420);
  if (now - (lastPlayedAt.get(intervalKey) || 0) < minInterval) return false;
  lastPlayedAt.set(intervalKey, now);

  const audio = ensureAudio(key);
  if (!audio) return false;

  const channel = options.channel;
  if (channel) {
    const current = activeByChannel.get(channel);
    if (current && current !== audio) stopAudioElement(current, options.fadeOutMs ?? 120);
    activeByChannel.set(channel, audio);
  }

  try {
    if (options.restart !== false || audio.ended || audio.paused) audio.currentTime = 0;
  } catch {
    // Some remote streams may not allow currentTime before metadata is ready.
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
        if (!browserUnlocked) {
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

export function fadeOutDayNightSound(key: DayNightSoundKey, fadeOutMs = 450): void {
  stopDayNightSound(key, fadeOutMs);
}

export const dayNightAudioDistribution: Array<{ key: DayNightSoundKey; ar: string; en: string; auto: boolean }> = [
  { key: "engineStart", ar: "صفحة التحميل بعد تسجيل دخول صحيح", en: "Loading page after successful admin login", auto: true },
  { key: "sectionDoor", ar: "الانتقال الحقيقي بين أقسام لوحة التحكم والتنبيهات المهمة الهادئة", en: "Real admin section changes and quiet important alerts", auto: true },
  { key: "doorClose", ar: "تسجيل الخروج ونهاية المشاهد الكبيرة", en: "Logout and major scene closure", auto: true },
  { key: "carHorn", ar: "زر الكلاكس أو تجربة يضغطها المستخدم فقط", en: "Horn button or explicit user test only", auto: false },
  { key: "glassBreak", ar: "مشهد كسر زجاج مخصص أو تجربة يضغطها المستخدم فقط", en: "Dedicated glass-break scene or explicit user test only", auto: false },
];

if (hasBrowserAudio()) {
  installAdminNavigationAudioBinding();
}
