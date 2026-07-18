import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const www = resolve(root, "www");
const configPath = resolve(root, "capacitor.config.json");

const config = JSON.parse(await readFile(configPath, "utf8"));
if (config.appId !== "ae.daynight.admin") throw new Error("Unexpected Android appId.");
if (config.appName !== "DAY NIGHT") throw new Error("Android wrapper must use the full DAY NIGHT product name.");
if (config.server?.url !== "https://daynightae.com/") throw new Error("Android wrapper must point to the official full production portal.");
if (config.server?.cleartext !== false) throw new Error("Cleartext traffic must remain disabled.");

await mkdir(www, { recursive: true });

const offlinePage = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#071A33" />
  <title>DAY NIGHT</title>
  <style>
    :root{color-scheme:dark;font-family:Arial,Tahoma,sans-serif}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;background:radial-gradient(circle at 50% 12%,#0d3b70 0,#071a33 42%,#020b17 100%);color:#fff;padding:24px}
    main{width:min(92vw,460px);text-align:center;border:1px solid rgba(212,175,55,.35);border-radius:32px;background:rgba(7,26,51,.84);padding:34px 24px;box-shadow:0 26px 70px rgba(0,0,0,.48)}
    img{width:132px;height:132px;object-fit:contain;margin:0 auto 22px;border-radius:28px;background:#fff;box-shadow:0 0 0 5px rgba(212,175,55,.22),0 0 46px rgba(26,136,255,.32)}
    h1{margin:0 0 12px;font-size:30px}
    p{margin:0;color:rgba(255,255,255,.72);line-height:1.9;font-weight:700}
    button{margin-top:24px;border:0;border-radius:999px;background:linear-gradient(135deg,#f3c838,#d4af37);color:#071a33;padding:14px 28px;font-size:15px;font-weight:1000;cursor:pointer}
    small{display:block;margin-top:20px;color:rgba(255,255,255,.42)}
  </style>
</head>
<body>
  <main>
    <img src="https://daynightae.com/assets/daynight/logo.png" alt="DAY NIGHT" />
    <h1>DAY NIGHT</h1>
    <p>تعذر الاتصال بمنصة داي نايت الآن.<br/>تأكد من الإنترنت ثم أعد المحاولة.</p>
    <button onclick="location.href='https://daynightae.com/?refresh='+Date.now()">إعادة المحاولة</button>
    <small>داي نايت لخدمات التوصيل والشحن</small>
  </main>
</body>
</html>`;

await writeFile(resolve(www, "index.html"), offlinePage, "utf8");
await writeFile(resolve(www, "offline.html"), offlinePage, "utf8");
await writeFile(resolve(www, "robots.txt"), "User-agent: *\nDisallow: /\n", "utf8");

console.log("DAY NIGHT Android live wrapper prepared:", www);
