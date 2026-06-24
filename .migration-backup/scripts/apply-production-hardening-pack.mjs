import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function p(file) {
  return path.join(root, file);
}

function read(file) {
  return fs.readFileSync(p(file), "utf8").replace(/^\uFEFF/, "");
}

function write(file, content) {
  fs.mkdirSync(path.dirname(p(file)), { recursive: true });
  fs.writeFileSync(p(file), content, "utf8");
}

function replaceInFile(file, replacer) {
  if (!fs.existsSync(p(file))) return;
  const before = read(file);
  const after = replacer(before);
  if (before !== after) write(file, after);
}

function replaceAllCanonical(content) {
  return content
    .replaceAll("https://www.daynightae.com", "https://daynightae.com")
    .replaceAll("www.daynightae.com", "daynightae.com");
}

/* 1) Canonical domain */
[
  "src/data/companyMeta.ts",
  "src/lib/seo.ts",
  "src/hooks/usePageSEO.ts",
  "index.html",
  "public/robots.txt",
  "public/sitemap.xml"
].forEach((file) => replaceInFile(file, replaceAllCanonical));

replaceInFile("index.html", (html) => {
  return html
    .replaceAll('content="/logo-daynight.svg"', 'content="https://daynightae.com/logo-daynight.png"')
    .replaceAll('href="/logo-daynight.svg"', 'href="/logo-daynight.png"');
});

/* 2) Unified public pricing copy */
replaceInFile("src/hooks/usePageSEO.ts", (seo) => {
  return seo
    .replace(
      "Official final prices: UAE delivery from 31.50 AED, GCC from 99.75 AED, worldwide from 199.50 AED. Customer view shows final price only.",
      "Official prices: UAE main areas 30 AED, UAE extended areas 50 AED, GCC 95 AED first kg plus 45 AED additional kg, worldwide 190 AED first kg plus 90 AED additional kg."
    )
    .replace(
      "Local delivery across all UAE emirates. Main cities 31.50 AED and extended areas 52.50 AED as final customer prices.",
      "Local delivery across all UAE emirates. Main cities 30 AED and extended areas 50 AED, with express surcharge shown clearly when selected."
    );
});

/* 3) Harden Vercel config */
write("vercel.json", `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "corepack enable && corepack prepare pnpm@10.34.4 --activate && pnpm install --frozen-lockfile --config.optional=true",
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "trailingSlash": false,
  "redirects": [
    {
      "source": "/(.*)",
      "has": [
        {
          "type": "host",
          "value": "www.daynightae.com"
        }
      ],
      "destination": "https://daynightae.com/$1",
      "permanent": true
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' https://ngdwybpgacauorygoedi.supabase.co wss://ngdwybpgacauorygoedi.supabase.co https://api.qrserver.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
`);

/* 4) Turnstile component */
write("src/components/security/TurnstileCaptcha.tsx", `import { useEffect, useRef } from "react";

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
`);

/* 5) Wire CAPTCHA into RequestDelivery */
replaceInFile("src/components/RequestDelivery.tsx", (content) => {
  let rd = content;

  if (!rd.includes('TurnstileCaptcha from "./security/TurnstileCaptcha"')) {
    rd = rd.replace(
      'import { translations } from "../data/translations";',
      'import { translations } from "../data/translations";\nimport TurnstileCaptcha from "./security/TurnstileCaptcha";'
    );
  }

  if (!rd.includes("captchaSiteKey")) {
    rd = rd.replace(
      'const [validationError, setValidationError] = useState("");',
      `const [validationError, setValidationError] = useState("");
  const captchaSiteKey = String(((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || "")).trim();
  const captchaEnabled = Boolean(captchaSiteKey);
  const [captchaToken, setCaptchaToken] = useState("");`
    );
  }

  rd = rd.replace(
    'notesRequired: "يرجى إضافة ملاحظات الطلب قبل الإرسال.",',
    'notesRequired: "يرجى إضافة ملاحظات الطلب قبل الإرسال.",\n      captchaRequired: "يرجى تأكيد التحقق الأمني قبل إرسال الطلب.",'
  );

  rd = rd.replace(
    'notesRequired: "Please add order notes before submission.",',
    'notesRequired: "Please add order notes before submission.",\n      captchaRequired: "Please complete the security verification before submitting the request.",'
  );

  if (!rd.includes("return tr.captchaRequired")) {
    rd = rd.replace(
      `    if (paymentMethod === "cod" && (!Number.isFinite(Number(codAmount)) || Number(codAmount) <= 0)) {
      return tr.invalidCod;
    }

    if (!notes.trim()) {`,
      `    if (paymentMethod === "cod" && (!Number.isFinite(Number(codAmount)) || Number(codAmount) <= 0)) {
      return tr.invalidCod;
    }

    if (captchaEnabled && !captchaToken) {
      return tr.captchaRequired;
    }

    if (!notes.trim()) {`
    );
  }

  if (!rd.includes("captcha_token: captchaToken")) {
    rd = rd.replace(
      'currency: "AED",',
      'currency: "AED",\n      source_domain: "daynightae.com",\n      captcha_token: captchaToken || null,'
    );
  }

  if (!rd.includes("<TurnstileCaptcha")) {
    rd = rd.replace(
      "            {/* Calculations Detail Box */}",
      `            {captchaEnabled && (
              <TurnstileCaptcha
                siteKey={captchaSiteKey}
                language={language}
                onVerify={(token) => {
                  setCaptchaToken(token);
                  setValidationError("");
                }}
                onExpire={() => setCaptchaToken("")}
              />
            )}

            {/* Calculations Detail Box */}`
    );
  }

  if (!rd.includes("disabled={loading || (captchaEnabled && !captchaToken)}")) {
    rd = rd.replace(
      "disabled={loading}",
      "disabled={loading || (captchaEnabled && !captchaToken)}"
    );
  }

  if (!rd.includes('setCaptchaToken("");')) {
    rd = rd.replace(
      '                  setCodAmount("");',
      '                  setCodAmount("");\n                  setCaptchaToken("");'
    );
  }

  return rd;
});

/* 6) Production gate script */
write("scripts/production-hardening-gate.mjs", `import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/^\\uFEFF/, "");
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of read(file).split(/\\r?\\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log("PASS:", message);
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const vercel = read("vercel.json");
const seo = read("src/hooks/usePageSEO.ts");
const sitemap = read("public/sitemap.xml");
const index = read("index.html");

assert(vercel.includes('"headers"'), "Vercel security headers exist");
assert(vercel.includes('"redirects"'), "Canonical redirect config exists");
assert(vercel.includes('"outputDirectory": "dist"'), "Vercel output directory is dist");
assert(!sitemap.includes("www.daynightae.com"), "Sitemap canonical is apex domain");
assert(!index.includes("www.daynightae.com"), "Index canonical is apex domain");
assert(!seo.includes("31.50 AED") && !seo.includes("52.50 AED"), "SEO prices use unified public pricing");
assert(fs.existsSync("src/components/security/TurnstileCaptcha.tsx"), "Turnstile component exists");

if (process.env.DN_RUN_ORDER_TEST !== "1") {
  console.log("SKIP: Live Supabase order/tracking/admin test. Set DN_RUN_ORDER_TEST=1 to run it.");
  process.exit(process.exitCode || 0);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert(Boolean(SUPABASE_URL), "VITE_SUPABASE_URL is present");
assert(Boolean(SUPABASE_ANON_KEY), "VITE_SUPABASE_ANON_KEY is present");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const timestamp = Date.now();
const testOrder = {
  sender_name: "DAY NIGHT PRODUCTION TEST",
  sender_phone: "+971 56 875 7331",
  sender_city: "أبوظبي",
  sender_address: "Production hardening test pickup address",
  receiver_name: "Production Test Receiver",
  receiver_phone: "+971 56 875 7331",
  receiver_city: "دبي",
  receiver_address: "Production hardening test delivery address",
  package_type: "Documents",
  weight: 1,
  pieces: 1,
  service_type: "standard",
  delivery_price: 30,
  subtotal: 30,
  total: 30,
  total_price: 30,
  amount: 30,
  price: 30,
  currency: "AED",
  payment_method: "sender_pays",
  cod_amount: null,
  notes: "[PRODUCTION HARDENING TEST] Safe test order created at " + new Date(timestamp).toISOString(),
  status: "Pending",
  source_domain: "daynightae.com",
  captcha_token: "production-gate-test"
};

const created = await supabase.rpc("create_public_order", { p_order_data: testOrder });
assert(!created.error, "create_public_order RPC succeeded");

const createdData = created.data;
const trackingCode =
  typeof createdData === "string"
    ? createdData
    : createdData?.tracking_code || createdData?.tracking_number || createdData?.id;

assert(Boolean(trackingCode), "Tracking code returned from create_public_order");

const tracked = await supabase.rpc("track_order", { p_tracking_code: trackingCode });
assert(!tracked.error, "track_order RPC succeeded");

const trackedOrder = Array.isArray(tracked.data) ? tracked.data[0] : tracked.data;
assert(Boolean(trackedOrder), "Created order can be tracked");

if (!SERVICE_ROLE_KEY) {
  console.log("SKIP: Admin update test. Add SUPABASE_SERVICE_ROLE_KEY locally to test admin_update_order_status.");
  process.exit(process.exitCode || 0);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const orderId = trackedOrder?.id || createdData?.id;

if (!orderId) {
  console.log("SKIP: Admin update test. Could not resolve order id.");
  process.exit(process.exitCode || 0);
}

const updated = await admin.rpc("admin_update_order_status", {
  p_order_id: orderId,
  p_status: "In Transit",
  p_note: "Production hardening gate status update test"
});

assert(!updated.error, "admin_update_order_status RPC succeeded");
console.log("DONE: Production hardening live gate passed.");
`);

/* 7) Add npm script */
const pkg = JSON.parse(read("package.json"));
pkg.scripts = pkg.scripts || {};
pkg.scripts["production:gate"] = "node scripts/production-hardening-gate.mjs";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

console.log("Production hardening pack applied.");
