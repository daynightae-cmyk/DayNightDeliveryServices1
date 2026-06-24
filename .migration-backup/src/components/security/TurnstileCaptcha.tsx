import { useEffect, useRef } from "react";

type TurnstileCaptchaProps = {
  siteKey: string;
  language: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Turnstile script failed to load")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Turnstile script failed to load"));
      document.head.appendChild(script);
    });
  }

  return turnstileScriptPromise;
}

export default function TurnstileCaptcha({ siteKey, language, onVerify, onExpire }: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const verifyRef = useRef(onVerify);
  const expireRef = useRef(onExpire);

  verifyRef.current = onVerify;
  expireRef.current = onExpire;

  useEffect(() => {
    let cancelled = false;

    if (!siteKey) return;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          language: language === "ar" ? "ar" : "en",
          theme: "auto",
          callback: (token: string) => verifyRef.current(token),
          "expired-callback": () => expireRef.current(),
          "error-callback": () => expireRef.current()
        });
      })
      .catch(() => expireRef.current());

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, language]);

  return (
    <div className="rounded-2xl border border-brand-gold/25 bg-brand-deep/70 p-4 flex flex-col items-center justify-center gap-2">
      <div ref={containerRef} />
      <p className="text-[10px] text-white/45 font-bold text-center">
        {language === "ar" ? "تحقق أمني لحماية الطلبات من السبام" : "Security verification to protect delivery requests"}
      </p>
    </div>
  );
}
