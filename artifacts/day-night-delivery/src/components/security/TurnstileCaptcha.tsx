import { useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";

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
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "strict-origin-when-cross-origin";
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
  const [status, setStatus] = useState<"loading" | "ready" | "verified" | "error">("loading");
  const [nonce, setNonce] = useState(0);

  verifyRef.current = onVerify;
  expireRef.current = onExpire;

  useEffect(() => {
    let cancelled = false;

    if (!siteKey) return;
    setStatus("loading");

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          language: language === "ar" ? "ar" : "en",
          theme: "auto",
          appearance: "always",
          retry: "auto",
          "retry-interval": 8000,
          "refresh-expired": "auto",
          callback: (token: string) => {
            setStatus("verified");
            verifyRef.current(token);
          },
          "expired-callback": () => {
            setStatus("ready");
            expireRef.current();
          },
          "timeout-callback": () => {
            setStatus("error");
            expireRef.current();
          },
          "error-callback": () => {
            setStatus("error");
            expireRef.current();
          }
        });
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
        expireRef.current();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, language, nonce]);

  function retry() {
    expireRef.current();
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }
    setNonce((value) => value + 1);
  }

  return (
    <div className="rounded-2xl border border-brand-gold/25 bg-brand-deep/70 p-4 flex flex-col items-center justify-center gap-2">
      <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
      {status === "error" ? (
        <div className="text-center space-y-2">
          <p className="text-[11px] text-amber-200 font-black flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            {language === "ar" ? "تعذر تحميل تحقق Cloudflare. أعد المحاولة أو عطّل مانع التتبع مؤقتاً." : "Cloudflare verification could not load. Retry or temporarily disable tracking blockers."}
          </p>
          <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-[10px] font-black text-brand-gold hover:bg-brand-gold hover:text-brand-deep">
            <RefreshCw className="w-3 h-3" /> {language === "ar" ? "إعادة التحقق" : "Retry verification"}
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-white/45 font-bold text-center">
          {status === "verified"
            ? (language === "ar" ? "تم التحقق الأمني بنجاح" : "Security verification completed")
            : (language === "ar" ? "تحقق أمني لحماية الطلبات من السبام" : "Security verification to protect delivery requests")}
        </p>
      )}
    </div>
  );
}
