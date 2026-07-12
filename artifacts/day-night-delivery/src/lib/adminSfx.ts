import type { AdminAudioEvent } from "./adminAudio";
import { playDayNightSound, preloadDayNightSounds, startDayNightAudioEngineLoop, stopDayNightChannel, type DayNightSoundKey } from "./audioManager";

export type AdminSfxAssetKey = DayNightSoundKey;

const eventAssets: Partial<Record<AdminAudioEvent, { key: DayNightSoundKey; volume: number; minIntervalMs?: number }>> = {
  success: { key: "doorClose", volume: 0.2, minIntervalMs: 900 },
  error: { key: "sectionDoor", volume: 0.16, minIntervalMs: 900 },
  warning: { key: "sectionDoor", volume: 0.18, minIntervalMs: 900 },
  notification: { key: "sectionDoor", volume: 0.16, minIntervalMs: 900 },
  new_order: { key: "sectionDoor", volume: 0.18, minIntervalMs: 900 },
  cod_alert: { key: "sectionDoor", volume: 0.18, minIntervalMs: 900 },
  khalifa_insight: { key: "sectionDoor", volume: 0.14, minIntervalMs: 900 },
  daily_closing_ready: { key: "doorClose", volume: 0.16, minIntervalMs: 900 },
  daily_closing_warning: { key: "sectionDoor", volume: 0.18, minIntervalMs: 900 },
  database_health_ok: { key: "doorClose", volume: 0.13, minIntervalMs: 900 },
  database_health_warning: { key: "sectionDoor", volume: 0.18, minIntervalMs: 900 },
  print_ready: { key: "doorClose", volume: 0.13, minIntervalMs: 900 },
  print_done: { key: "doorClose", volume: 0.12, minIntervalMs: 900 },
};

export function preloadAdminSfx(): void {
  preloadDayNightSounds();
}

export function playAdminSfxAsset(key: AdminSfxAssetKey, volume = 0.35): boolean {
  return playDayNightSound(key, { volume, minIntervalMs: key === "carHorn" ? 1400 : 700 });
}

export function playAdminSfxEvent(event: AdminAudioEvent, masterVolume: number): boolean {
  const asset = eventAssets[event];
  if (!asset) return false;
  return playDayNightSound(asset.key, {
    volume: Math.max(0, Math.min(1, masterVolume)) * asset.volume,
    channel: `admin-event-${event}`,
    minIntervalMs: asset.minIntervalMs,
  });
}

export async function startAdminLoadingSfx(volume = 0.35): Promise<boolean> {
  return startDayNightAudioEngineLoop(volume);
}

export function stopAdminLoadingSfx(): void {
  stopDayNightChannel("admin-loading-engine", 450);
}

export const adminSfxDistribution: Array<{ key: DayNightSoundKey; usedForAr: string; usedForEn: string }> = [
  { key: "engineStart", usedForAr: "لودينج الدخول وتشغيل محرك مركز القيادة", usedForEn: "Admin loading page engine start" },
  { key: "sectionDoor", usedForAr: "التنقل الحقيقي بين أقسام لوحة التحكم والتنبيهات المهمة الهادئة", usedForEn: "Real section navigation and quiet important alerts" },
  { key: "doorClose", usedForAr: "تسجيل الخروج وإنهاء المشاهد الكبيرة والطباعة", usedForEn: "Logout, major closure scenes, and print completion" },
  { key: "carHorn", usedForAr: "الكلاكس عند ضغط المستخدم فقط", usedForEn: "Horn only on explicit user action" },
  { key: "glassBreak", usedForAr: "كسر زجاج فقط عند وجود مشهد بصري مخصص أو زر تجربة", usedForEn: "Glass break only with a dedicated visual scene or test button" },
];
