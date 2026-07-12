import { useEffect, useMemo, useState } from "react";
import type { AuthLanguage } from "./AuthIntroScreen";
import { isAdminLoadingAudioMuted, setAdminLoadingAudioMuted, startAdminLoadingEngineAudio, stopAdminLoadingEngineAudio } from "../../lib/adminLoadingAudio";
import "./auth-loading-final.css";

interface AuthLoadingScreenProps {
  language?: AuthLanguage;
  percent?: number;
}

const HERO_IMAGE_URL = "https://i.postimg.cc/SsqTCqXB/Chat-GPT-Image-Jul-12-2026-06-14-09-PM.png";

const text = {
  ar: {
    eyebrow: "DAY NIGHT DELIVERY SERVICES",
    title: "تشغيل مركز القيادة",
    body: "محرك الأسطول يعمل الآن، والخريطة الحية تستعد لفتح لوحة التحكم.",
    live: "مزامنة العمليات الحية",
    map: "إضاءة خريطة الإمارات",
    engine: "تشغيل المحرك",
    control: "فتح لوحة التحكم",
    mute: "كتم المحرك",
    unmute: "تشغيل المحرك",
    audioOn: "صوت المحرك يعمل",
    audioOff: "الصوت مكتوم",
    progress: "نسبة التهيئة",
  },
  en: {
    eyebrow: "DAY NIGHT DELIVERY SERVICES",
    title: "Launching Command Center",
    body: "The fleet engine is running while the live UAE map prepares the dashboard.",
    live: "Syncing live operations",
    map: "Lighting UAE network map",
    engine: "Starting engine",
    control: "Opening command hub",
    mute: "Mute engine",
    unmute: "Start engine",
    audioOn: "Engine audio active",
    audioOff: "Audio muted",
    progress: "Initialization progress",
  },
} as const;

export default function AuthLoadingScreen({ language = "ar", percent = 98 }: AuthLoadingScreenProps) {
  const isArabic = language === "ar";
  const t = text[language];
  const targetPercent = useMemo(() => Math.max(18, Math.min(100, percent)), [percent]);
  const [progress, setProgress] = useState(18);
  const [isMuted, setIsMuted] = useState(() => isAdminLoadingAudioMuted());
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) return 100;
        const acceleration = current < 72 ? 6 : current < 92 ? 4 : 2;
        const next = current < targetPercent ? current + acceleration : current + 1;
        return Math.min(100, next);
      });
    }, 120);

    return () => window.clearInterval(interval);
  }, [targetPercent]);

  useEffect(() => {
    let mounted = true;

    if (isMuted) {
      stopAdminLoadingEngineAudio();
      setAudioReady(false);
      return () => {
        mounted = false;
      };
    }

    void startAdminLoadingEngineAudio().then((started) => {
      if (!mounted) {
        stopAdminLoadingEngineAudio();
        return;
      }
      setAudioReady(started);
    });

    return () => {
      mounted = false;
      stopAdminLoadingEngineAudio();
    };
  }, [isMuted]);

  function toggleAudio() {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setAdminLoadingAudioMuted(nextMuted);
    if (nextMuted) {
      stopAdminLoadingEngineAudio();
      setAudioReady(false);
      return;
    }

    void startAdminLoadingEngineAudio().then((started) => {
      setAudioReady(started);
    });
  }

  return (
    <section className="auth-clean auth-clean--loading auth-clean--luxury-loading auth-clean--final-loading" dir={isArabic ? "rtl" : "ltr"} aria-busy="true">
      <main className="auth-loading-stage auth-loading-stage--final" aria-label={t.title}>
        <div className="auth-loading-cinematic-frame" aria-hidden="true">
          <img className="auth-loading-cinematic-image" src={HERO_IMAGE_URL} alt="" draggable={false} />
          <span className="auth-loading-cinematic-vignette" />
          <span className="auth-loading-cinematic-map-glow" />
          <span className="auth-loading-cinematic-engine-glow" />
          <span className="auth-loading-cinematic-headlight auth-loading-cinematic-headlight--left" />
          <span className="auth-loading-cinematic-headlight auth-loading-cinematic-headlight--right" />
          <span className="auth-loading-cinematic-sweep auth-loading-cinematic-sweep--blue" />
          <span className="auth-loading-cinematic-sweep auth-loading-cinematic-sweep--gold" />
          <span className="auth-loading-cinematic-particles" />
        </div>

        <section className="auth-loading-console auth-loading-console--final">
          <p className="auth-clean__eyebrow">{t.eyebrow}</p>
          <h1 className="auth-clean__title">{t.title}</h1>
          <p className="auth-clean__body">{t.body}</p>

          <div className="auth-loading-steps" aria-label={t.live}>
            <span>{t.engine}</span>
            <span>{t.map}</span>
            <span>{t.control}</span>
          </div>

          <div className="auth-clean__progress auth-loading-progress" aria-label={`${t.progress} ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="auth-loading-footer">
            <strong>{progress}%</strong>
            <button type="button" className="auth-loading-audio auth-loading-audio--final" onClick={toggleAudio} aria-pressed={!isMuted}>
              <span className={audioReady && !isMuted ? "is-live" : ""} aria-hidden="true" />
              {isMuted ? t.unmute : t.mute}
            </button>
            <em>{isMuted ? t.audioOff : t.audioOn}</em>
          </div>
        </section>
      </main>
    </section>
  );
}
