import {
  playEngineStart,
  preloadDayNightSounds,
  readDayNightAudioSettings,
  setDayNightAudioMuted,
  stopDayNightChannel,
  unlockDayNightAudio,
} from "./audioManager";

export function isAdminLoadingAudioMuted(): boolean {
  return readDayNightAudioSettings().muted;
}

export function setAdminLoadingAudioMuted(muted: boolean): void {
  setDayNightAudioMuted(muted);
  if (muted) stopAdminLoadingEngineAudio();
}

export async function armAdminLoadingAudio(): Promise<boolean> {
  unlockDayNightAudio();
  preloadDayNightSounds(["engineStart", "sectionDoor", "doorClose"]);
  return true;
}

export async function startAdminLoadingEngineAudio(): Promise<boolean> {
  unlockDayNightAudio();
  return playEngineStart();
}

export function stopAdminLoadingEngineAudio(): void {
  stopDayNightChannel("admin-loading-engine", 650);
}
