import type { AdminAudioEvent } from "./adminAudio";

export type AdminSfxAssetKey =
  | "carDoorSlam"
  | "carDoubleHorn"
  | "carStarting"
  | "shortIgnition"
  | "gettingIntoCar"
  | "carWindowBreaking";

type AssetState = {
  url: string | null;
  loading?: Promise<string | null>;
};

const ADMIN_SFX_BASE = "/assets/audio/admin-sfx";

const assetFiles: Record<AdminSfxAssetKey, string> = {
  carDoorSlam: "mixkit-car-door-slam-1564.wav",
  carDoubleHorn: "mixkit-car-double-horn-719.wav",
  carStarting: "mixkit-cars-starting-1561.wav",
  shortIgnition: "mixkit-short-car-ignition-1541.wav",
  gettingIntoCar: "mixkit-getting-into-a-car-1539.wav",
  carWindowBreaking: "mixkit-car-window-breaking-1551.wav",
};

const eventAssets: Record<AdminAudioEvent, { key: AdminSfxAssetKey; volume: number }> = {
  click: { key: "carDoorSlam", volume: 0.1 },
  hover: { key: "shortIgnition", volume: 0.035 },
  success: { key: "gettingIntoCar", volume: 0.14 },
  error: { key: "carWindowBreaking", volume: 0.16 },
  warning: { key: "carDoubleHorn", volume: 0.18 },
  notification: { key: "carDoubleHorn", volume: 0.16 },
  new_order: { key: "carDoubleHorn", volume: 0.22 },
  cod_alert: { key: "carDoubleHorn", volume: 0.18 },
  khalifa_insight: { key: "gettingIntoCar", volume: 0.17 },
  daily_closing_ready: { key: "shortIgnition", volume: 0.13 },
  daily_closing_warning: { key: "carDoubleHorn", volume: 0.18 },
  database_health_ok: { key: "shortIgnition", volume: 0.12 },
  database_health_warning: { key: "carWindowBreaking", volume: 0.13 },
  print_ready: { key: "carDoorSlam", volume: 0.12 },
  print_done: { key: "carDoorSlam", volume: 0.11 },
};

const cache = new Map<AdminSfxAssetKey, AssetState>();
let activeLoop: HTMLAudioElement | null = null;

function canUseHtmlAudio(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined" && typeof Audio !== "undefined";
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.3));
}

async function resolveAssetUrl(key: AdminSfxAssetKey): Promise<string | null> {
  if (!canUseHtmlAudio()) return null;

  const cached = cache.get(key);
  if (cached?.url !== undefined) return cached.url;
  if (cached?.loading) return cached.loading;

  const file = assetFiles[key];
  const loading = (async () => {
    const directPath = `${ADMIN_SFX_BASE}/${file}`;
    const b64Path = `${directPath}.b64`;

    try {
      const b64Response = await window.fetch(b64Path, { cache: "force-cache" });
      if (b64Response.ok) {
        const b64 = (await b64Response.text()).trim();
        if (b64.length > 256) return `data:audio/wav;base64,${b64}`;
      }
    } catch {
      // Optional b64 delivery is allowed to fail; try direct wav next.
    }

    try {
      const directResponse = await window.fetch(directPath, { cache: "force-cache" });
      if (directResponse.ok) {
        const blob = await directResponse.blob();
        if (blob.size > 128) return URL.createObjectURL(blob);
      }
    } catch {
      // Browser-safe fallback stays in adminAudio/adminLoadingAudio.
    }

    return null;
  })();

  cache.set(key, { url: null, loading });
  const url = await loading;
  cache.set(key, { url });
  return url;
}

export function preloadAdminSfx(keys: AdminSfxAssetKey[] = ["carDoubleHorn", "gettingIntoCar", "shortIgnition", "carDoorSlam"]): void {
  if (!canUseHtmlAudio()) return;
  keys.forEach((key) => {
    void resolveAssetUrl(key);
  });
}

export function playAdminSfxAsset(key: AdminSfxAssetKey, volume = 0.25): boolean {
  if (!canUseHtmlAudio() || document.hidden) return false;
  const cached = cache.get(key);
  if (!cached?.url) {
    void resolveAssetUrl(key);
    return false;
  }

  try {
    const audio = new Audio(cached.url);
    audio.preload = "auto";
    audio.volume = clampVolume(volume);
    void audio.play().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function playAdminSfxEvent(event: AdminAudioEvent, masterVolume: number): boolean {
  const asset = eventAssets[event];
  if (!asset) return false;
  return playAdminSfxAsset(asset.key, clampVolume(masterVolume) * asset.volume);
}

export async function startAdminLoadingSfx(volume = 0.28): Promise<boolean> {
  if (!canUseHtmlAudio()) return false;
  stopAdminLoadingSfx();

  const url = await resolveAssetUrl("carStarting") || await resolveAssetUrl("shortIgnition");
  if (!url) return false;

  try {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = clampVolume(volume);
    audio.loop = true;
    activeLoop = audio;
    await audio.play();
    return true;
  } catch {
    activeLoop = null;
    return false;
  }
}

export function stopAdminLoadingSfx(): void {
  if (!activeLoop) return;
  try {
    const audio = activeLoop;
    const fade = window.setInterval(() => {
      audio.volume = Math.max(0, audio.volume - 0.08);
      if (audio.volume <= 0.01) {
        window.clearInterval(fade);
        audio.pause();
        audio.currentTime = 0;
      }
    }, 50);
  } catch {
    try {
      activeLoop.pause();
    } catch {
      // noop
    }
  } finally {
    activeLoop = null;
  }
}

export const adminSfxDistribution: Array<{ file: string; usedForAr: string; usedForEn: string }> = [
  { file: assetFiles.carStarting, usedForAr: "لودينج الدخول وتشغيل محرك مركز القيادة", usedForEn: "Admin loading page engine start" },
  { file: assetFiles.shortIgnition, usedForAr: "تشغيل سريع، نجاح، قاعدة البيانات، وإغلاق يومي جاهز", usedForEn: "Fast ignition, success, database OK, and daily closing ready" },
  { file: assetFiles.carDoubleHorn, usedForAr: "الإشعارات المهمة، طلب جديد، والتحصيل عند التسليم", usedForEn: "Important notifications, new orders, and cash-on-delivery alerts" },
  { file: assetFiles.gettingIntoCar, usedForAr: "كارت خليفة وتوصيات خليفة المهمة", usedForEn: "Khalifa card and insight recommendations" },
  { file: assetFiles.carDoorSlam, usedForAr: "النقرات الخفيفة، الطباعة، وإغلاق إجراءات سريعة", usedForEn: "Soft clicks, print actions, and quick operation closure" },
  { file: assetFiles.carWindowBreaking, usedForAr: "الأخطاء والتحذيرات الحرجة فقط", usedForEn: "Critical errors and high-risk warnings only" },
];
