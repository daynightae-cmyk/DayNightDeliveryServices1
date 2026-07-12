import { useEffect, useMemo, useState } from "react";
import type { AuthLanguage } from "./AuthIntroScreen";
import { isAdminLoadingAudioMuted, setAdminLoadingAudioMuted, startAdminLoadingEngineAudio, stopAdminLoadingEngineAudio } from "../../lib/adminLoadingAudio";
import "./auth-loading-final.css";

interface AuthLoadingScreenProps {
  language?: AuthLanguage;
  percent?: number;
}

const text = {
  ar: {
    eyebrow: "DAY NIGHT DELIVERY SERVICES",
    title: "تشغيل مركز القيادة",
    body: "نضيء الخريطة الحية ونشغّل محرك العمليات قبل دخول لوحة التحكم.",
    live: "مزامنة العمليات الحية",
    map: "إضاءة خريطة الإمارات",
    engine: "تشغيل محرك الأسطول",
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
    body: "Lighting the live UAE map and starting the operations engine before dashboard entry.",
    live: "Syncing live operations",
    map: "Lighting UAE network map",
    engine: "Starting fleet engine",
    control: "Opening command hub",
    mute: "Mute engine",
    unmute: "Start engine",
    audioOn: "Engine audio active",
    audioOff: "Audio muted",
    progress: "Initialization progress",
  },
} as const;

const mapNodes: Array<[number, number]> = [
  [142, 250], [210, 214], [284, 183], [358, 164], [460, 94], [544, 67], [620, 74], [657, 171], [617, 285], [452, 324], [326, 355], [184, 283], [397, 169], [446, 226], [514, 181],
];

const meshRoutes = [
  "M142 250 L210 214 L284 183 L358 164 L460 94 L544 67 L620 74 L657 171 L617 285 L452 324 L326 355 L184 283 Z",
  "M210 214 L397 169 L514 181 L617 285 M284 183 L446 226 L452 324 M358 164 L446 226 L544 67",
  "M184 283 L326 355 L446 226 L657 171 M142 250 L397 169 L620 74 M276 335 L514 181 L617 285",
];

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
      <div className="auth-loading-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <main className="auth-loading-stage auth-loading-stage--final" aria-label={t.title}>
        <div className="auth-loading-final-particles" aria-hidden="true" />
        <div className="auth-loading-final-halo" aria-hidden="true" />
        <div className="auth-loading-final-road" aria-hidden="true" />

        <div className="auth-loading-skyline" aria-hidden="true">
          <span className="tower tower--burj" />
          <span className="tower tower--mid" />
          <span className="tower tower--sail" />
          <span className="tower tower--small" />
        </div>

        <svg className="auth-loading-map auth-loading-map--final" viewBox="0 0 760 430" role="img" aria-label={t.map}>
          <defs>
            <filter id="dn-auth-map-glow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="dn-auth-route" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#17a9ff" />
              <stop offset="42%" stopColor="#ffffff" />
              <stop offset="58%" stopColor="#ffd66b" />
              <stop offset="100%" stopColor="#18a8e8" />
            </linearGradient>
          </defs>
          <path
            className="auth-loading-map__outline"
            d="M116 255 C155 214 214 183 291 171 C359 160 405 130 461 91 C502 60 553 48 621 70 C602 110 621 145 673 171 C633 193 614 232 618 285 C552 266 503 277 451 325 C393 378 322 377 276 335 C234 296 181 283 116 255 Z"
          />
          {meshRoutes.map((route, index) => <path key={route} className="auth-loading-map__mesh" d={route} style={{ animationDelay: `${index * 0.18}s` }} />)}
          <path className="auth-loading-map__route route--one" d="M122 254 C215 200 315 219 397 169 C486 116 565 118 658 171" />
          <path className="auth-loading-map__route route--two" d="M179 283 C267 245 348 287 446 226 C518 181 571 215 617 285" />
          <path className="auth-loading-map__route route--three" d="M280 335 C334 274 367 224 461 91" />
          {mapNodes.map(([cx, cy], index) => (
            <circle key={`${cx}-${cy}`} className="auth-loading-map__node" cx={cx} cy={cy} r={index % 5 === 0 ? 7 : 5} />
          ))}
          <g className="auth-loading-map__pin" transform="translate(386 146)">
            <path d="M0 -26 C15 -26 26 -15 26 0 C26 18 0 42 0 42 C0 42 -26 18 -26 0 C-26 -15 -15 -26 0 -26 Z" />
            <circle cx="0" cy="0" r="9" />
          </g>
        </svg>

        <div className="auth-loading-car auth-loading-car--final" aria-hidden="true">
          <div className="auth-loading-car__beam auth-loading-car__beam--left" />
          <div className="auth-loading-car__beam auth-loading-car__beam--right" />
          <div className="auth-loading-car__body">
            <span className="auth-loading-car__sweep" />
            <span className="auth-loading-car__roof" />
            <span className="auth-loading-car__glass" />
            <span className="auth-loading-car__hood" />
            <span className="auth-loading-car__grille" />
            <span className="auth-loading-car__badge" />
            <span className="auth-loading-car__light auth-loading-car__light--left" />
            <span className="auth-loading-car__light auth-loading-car__light--right" />
            <span className="auth-loading-car__wheel auth-loading-car__wheel--left" />
            <span className="auth-loading-car__wheel auth-loading-car__wheel--right" />
          </div>
          <span className="auth-loading-car__spark auth-loading-car__spark--one" />
          <span className="auth-loading-car__spark auth-loading-car__spark--two" />
          <span className="auth-loading-car__spark auth-loading-car__spark--three" />
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
