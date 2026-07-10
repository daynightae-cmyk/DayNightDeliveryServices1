import { useCallback, useEffect, useState } from "react";
import { defaultAdminAudioSettings, playAdminAudioEvent, readAdminAudioSettings, unlockAdminAudio, writeAdminAudioSettings, type AdminAudioEvent, type AdminAudioSettings } from "../lib/adminAudio";

export function useAdminAudio() {
  const [settings, setSettingsState] = useState<AdminAudioSettings>(() => readAdminAudioSettings());
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = (event: Event) => setSettingsState((event as CustomEvent<AdminAudioSettings>).detail || readAdminAudioSettings());
    window.addEventListener("dn-admin-audio-settings-change", handler);
    return () => window.removeEventListener("dn-admin-audio-settings-change", handler);
  }, []);

  const setSettings = useCallback((next: AdminAudioSettings | ((current: AdminAudioSettings) => AdminAudioSettings)) => {
    setSettingsState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      const normalized = { ...resolved, volume: Math.min(1, Math.max(0, Number(resolved.volume))) };
      writeAdminAudioSettings(normalized);
      return normalized;
    });
  }, []);

  const enable = useCallback(() => { unlockAdminAudio(); setSettings((current) => ({ ...current, enabled: true, muted: false, lastEnabledAt: new Date().toISOString() })); setMessage(""); }, [setSettings]);
  const reset = useCallback(() => { writeAdminAudioSettings(defaultAdminAudioSettings); setSettingsState(defaultAdminAudioSettings); }, []);
  const play = useCallback((event: AdminAudioEvent) => { try { playAdminAudioEvent(event, readAdminAudioSettings()); } catch { setMessage("Audio unavailable in this browser."); } }, []);

  return { settings, setSettings, enable, reset, play, message, playClick: () => play("click"), playSuccess: () => play("success"), playWarning: () => play("warning"), playError: () => play("error"), playNotification: () => play("notification") };
}
