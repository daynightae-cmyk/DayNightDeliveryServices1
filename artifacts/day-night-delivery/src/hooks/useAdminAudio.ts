import { useCallback, useEffect, useState } from "react";
import { playAdminAudioEvent, readAdminAudioSettings, resetAdminAudioSettings, unlockAdminAudio, writeAdminAudioSettings, type AdminAudioEvent, type AdminAudioSettings } from "../lib/adminAudio";

export function useAdminAudio() {
  const [settings, setLocalSettings] = useState<AdminAudioSettings>(() => readAdminAudioSettings());
  const [message, setMessage] = useState("");
  useEffect(() => { const sync = () => setLocalSettings(readAdminAudioSettings()); window.addEventListener("dn-admin-audio-settings-change", sync); return () => window.removeEventListener("dn-admin-audio-settings-change", sync); }, []);
  const setSettings = useCallback((next: AdminAudioSettings | ((current: AdminAudioSettings) => AdminAudioSettings)) => { setLocalSettings((current) => { const value = typeof next === "function" ? next(current) : next; writeAdminAudioSettings(value); return value; }); }, []);
  const enable = useCallback(() => { unlockAdminAudio(); setSettings((current) => ({ ...current, enabled: true, lastEnabledAt: new Date().toISOString() })); setMessage("Audio enabled"); }, [setSettings]);
  const reset = useCallback(() => { setLocalSettings(resetAdminAudioSettings()); setMessage("Audio settings reset"); }, []);
  const play = useCallback((event: AdminAudioEvent) => { try { unlockAdminAudio(); playAdminAudioEvent(event, readAdminAudioSettings()); } catch { setMessage("Audio unavailable in this browser"); } }, []);
  return { settings, setSettings, enable, reset, play, playClick: () => play("click"), playSuccess: () => play("success"), playWarning: () => play("warning"), playError: () => play("error"), playNotification: () => play("notification"), message };
}
