import { useCallback, useEffect, useState } from "react";
import { playAdminAudioEvent, readAdminAudioSettings, resetAdminAudioSettings, unlockAdminAudio, writeAdminAudioSettings, type AdminAudioEvent, type AdminAudioSettings } from "../lib/adminAudio";
import { playDayNightSound, stopAllDayNightSounds, type DayNightSoundKey } from "../lib/audioManager";

export function useAdminAudio() {
  const [settings, setLocalSettings] = useState<AdminAudioSettings>(() => readAdminAudioSettings());
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sync = () => setLocalSettings(readAdminAudioSettings());
    window.addEventListener("dn-admin-audio-settings-change", sync);
    window.addEventListener("daynight-audio-settings-change", sync);
    return () => {
      window.removeEventListener("dn-admin-audio-settings-change", sync);
      window.removeEventListener("daynight-audio-settings-change", sync);
    };
  }, []);

  const setSettings = useCallback((next: AdminAudioSettings | ((current: AdminAudioSettings) => AdminAudioSettings)) => {
    setLocalSettings((current) => {
      const value = typeof next === "function" ? next(current) : next;
      writeAdminAudioSettings(value);
      return readAdminAudioSettings();
    });
  }, []);

  const enable = useCallback(() => {
    unlockAdminAudio();
    setSettings((current) => ({ ...current, enabled: true, muted: false, lastEnabledAt: new Date().toISOString() }));
    setMessage("Audio enabled");
  }, [setSettings]);

  const reset = useCallback(() => {
    const fresh = resetAdminAudioSettings();
    setLocalSettings(fresh);
    setMessage("Audio settings reset");
  }, []);

  const play = useCallback((event: AdminAudioEvent) => {
    try {
      unlockAdminAudio();
      playAdminAudioEvent(event, readAdminAudioSettings());
      setMessage("Audio test played");
    } catch {
      setMessage("Audio unavailable in this browser");
    }
  }, []);

  const playSfx = useCallback((key: DayNightSoundKey) => {
    try {
      unlockAdminAudio();
      const result = playDayNightSound(key, {
        volume: key === "carHorn" ? 0.7 : key === "glassBreak" ? 0.45 : 0.6,
        channel: `settings-test-${key}`,
        minIntervalMs: key === "carHorn" ? 1400 : 800,
      });
      setMessage(result ? "Audio test played" : "Audio is muted or waiting for browser permission");
    } catch {
      setMessage("Audio unavailable in this browser");
    }
  }, []);

  const muteNow = useCallback(() => {
    stopAllDayNightSounds(120);
    setSettings((current) => ({ ...current, enabled: current.enabled, muted: true }));
    setMessage("Audio muted");
  }, [setSettings]);

  return {
    settings,
    setSettings,
    enable,
    reset,
    play,
    playSfx,
    muteNow,
    playClick: () => play("click"),
    playSuccess: () => play("success"),
    playWarning: () => play("warning"),
    playError: () => play("error"),
    playNotification: () => play("notification"),
    playEngine: () => playSfx("engineStart"),
    playDoor: () => playSfx("sectionDoor"),
    playDoorClose: () => playSfx("doorClose"),
    playHorn: () => playSfx("carHorn"),
    playGlass: () => playSfx("glassBreak"),
    message,
  };
}
