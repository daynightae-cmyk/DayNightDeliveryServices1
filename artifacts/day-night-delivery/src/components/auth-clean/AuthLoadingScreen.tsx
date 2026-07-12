import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthLanguage } from "./AuthIntroScreen";
import { isAdminLoadingAudioMuted, setAdminLoadingAudioMuted, startAdminLoadingEngineAudio, stopAdminLoadingEngineAudio } from "../../lib/adminLoadingAudio";
import "./auth-loading-final.css";

interface AuthLoadingScreenProps {
  language?: AuthLanguage;
  percent?: number;
  onComplete?: () => void;
}

const HERO_IMAGE_URL = "https://i.postimg.cc/vB7ffX39/Chat-GPT-Image-1-ywlyw-2026-12-56-59-m.png";
const MIN_SCENE_MS = 3500;
const MAX_IMAGE_WAIT_MS = 1500;

const text = {
  ar: {
    eyebrow: "DAY NIGHT DELIVERY SERVICES",
    title: "جارٍ تشغيل مركز القيادة",
    body: "Starting Operations Command Center",
    engine: "تشغيل المحرك",
    control: "فتح لوحة التحكم",
    mute: "كتم الصوت",
    unmute: "تشغيل الصوت",
    audioOn: "صوت المحرك يعمل",
    audioOff: "الصوت مكتوم",
    progress: "نسبة التهيئة",
  },
  en: {
    eyebrow: "DAY NIGHT DELIVERY SERVICES",
    title: "Starting Operations Command Center",
    body: "جارٍ تشغيل مركز القيادة",
    engine: "Engine start",
    control: "Opening admin dashboard",
    mute: "Mute sound",
    unmute: "Enable sound",
    audioOn: "Engine audio active",
    audioOff: "Audio muted",
    progress: "Initialization progress",
  },
} as const;

export default function AuthLoadingScreen({ language = "ar", percent = 100, onComplete }: AuthLoadingScreenProps) {
  const isArabic = language === "ar";
  const t = text[language];
  const targetPercent = useMemo(() => Math.max(18, Math.min(100, percent)), [percent]);
  const startedAudioRef = useRef(false);
  const completedRef = useRef(false);

  const [progress, setProgress] = useState(18);
  const [isMuted, setIsMuted] = useState(() => isAdminLoadingAudioMuted());
  const [audioReady, setAudioReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [sceneElapsed, setSceneElapsed] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const image = new Image();
    const finish = () => setImageReady(true);
    image.decoding = "async";
    image.onload = finish;
    image.onerror = finish;
    image.src = HERO_IMAGE_URL;

    const fallback = window.setTimeout(finish, MAX_IMAGE_WAIT_MS);
    return () => window.clearTimeout(fallback);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= targetPercent) return targetPercent;
        const acceleration = current < 62 ? 5 : current < 88 ? 3 : 1;
        return Math.min(targetPercent, current + acceleration);
      });
    }, 130);

    const sceneTimer = window.setTimeout(() => setSceneElapsed(true), MIN_SCENE_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(sceneTimer);
    };
  }, [targetPercent]);

  useEffect(() => {
    if (!imageReady || !sceneElapsed || completedRef.current) return;
    completedRef.current = true;
    setProgress(100);
    setIsLeaving(true);
    stopAdminLoadingEngineAudio();
    window.setTimeout(() => onComplete?.(), 520);
  }, [imageReady, sceneElapsed, onComplete]);

  useEffect(() => {
    let mounted = true;

    if (isMuted) {
      stopAdminLoadingEngineAudio();
      setAudioReady(false);
      return () => {
        mounted = false;
      };
    }

    if (!startedAudioRef.current) {
      startedAudioRef.current = true;
      void startAdminLoadingEngineAudio().then((started) => {
        if (!mounted) {
          stopAdminLoadingEngineAudio();
          return;
        }
        setAudioReady(started);
      });
    }

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

    startedAudioRef.current = false;
    void startAdminLoadingEngineAudio().then((started) => {
      startedAudioRef.current = true;
      setAudioReady(started);
    });
  }

  return (
    <section className={`auth-clean auth-clean--loading auth-clean--final-loading ${imageReady ? "is-image-ready" : ""} ${isLeaving ? "is-leaving" : ""}`} dir={isArabic ? "rtl" : "ltr"} aria-busy="true">
      <main className="auth-loading-stage--final" aria-label={t.title}>
        <div className="auth-loading-cinematic-frame" aria-hidden="true">
          <img className="auth-loading-cinematic-image" src={HERO_IMAGE_URL} alt="" draggable={false} />
          <span className="auth-loading-cinematic-vignette" />
          <span className="auth-loading-cinematic-ambient" />
          <span className="auth-loading-cinematic-sweep" />
          <span className="auth-loading-cinematic-particles" />
        </div>

        <section className="auth-loading-console--final">
          <p className="auth-clean__eyebrow">{t.eyebrow}</p>
          <h1 className="auth-clean__title">{t.title}</h1>
          <p className="auth-clean__body">{t.body}</p>

          <div className="auth-loading-steps" aria-label={t.progress}>
            <span>{t.engine}</span>
            <span>{t.control}</span>
          </div>

          <div className="auth-clean__progress auth-loading-progress" aria-label={`${t.progress} ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="auth-loading-footer">
            <strong>{progress}%</strong>
            <button type="button" className="auth-loading-audio--final" onClick={toggleAudio} aria-pressed={!isMuted}>
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
