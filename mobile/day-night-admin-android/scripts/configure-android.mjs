import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const androidRoot = resolve(root, "android");
const appRoot = resolve(androidRoot, "app");
const mainRoot = resolve(appRoot, "src", "main");
const resRoot = resolve(mainRoot, "res");

async function read(path) {
  return readFile(path, "utf8");
}

async function write(path, value) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, value, "utf8");
}

function ensureIncludes(source, marker, insertion) {
  return source.includes(insertion.trim()) ? source : source.replace(marker, `${insertion}\n${marker}`);
}

const manifestPath = resolve(mainRoot, "AndroidManifest.xml");
let manifest = await read(manifestPath);

const permissions = [
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
];

for (const permission of permissions) {
  manifest = ensureIncludes(manifest, "<application", `    ${permission}`);
}

manifest = manifest.replace(
  /<application\b([^>]*)>/,
  (_full, attrs) => {
    let next = attrs;
    if (!/android:usesCleartextTraffic=/.test(next)) next += '\n        android:usesCleartextTraffic="false"';
    if (!/android:allowBackup=/.test(next)) next += '\n        android:allowBackup="false"';
    if (!/android:fullBackupContent=/.test(next)) next += '\n        android:fullBackupContent="false"';
    if (!/android:networkSecurityConfig=/.test(next)) next += '\n        android:networkSecurityConfig="@xml/network_security_config"';
    return `<application${next}>`;
  },
);

manifest = manifest.replace(
  /android:configChanges="([^"]*)"/,
  (_full, changes) => `android:configChanges="${changes.includes("density") ? changes : `${changes}|density`}"`,
);

const deepLinkFilter = `
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="daynightae.com" android:pathPrefix="/auth" />
                <data android:scheme="https" android:host="daynightae.com" android:pathPrefix="/admin" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="daynightadmin" android:host="open" />
            </intent-filter>`;

if (!manifest.includes('android:scheme="daynightadmin"')) {
  manifest = manifest.replace("        </activity>", `${deepLinkFilter}\n        </activity>`);
}

await write(manifestPath, manifest);

await write(
  resolve(resRoot, "xml", "network_security_config.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">daynightae.com</domain>
        <domain includeSubdomains="true">supabase.co</domain>
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
</network-security-config>
`,
);

await write(
  resolve(resRoot, "values", "colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#071A33</color>
    <color name="colorPrimaryDark">#020B17</color>
    <color name="colorAccent">#D4AF37</color>
    <color name="ic_launcher_background">#071A33</color>
    <color name="day_night_gold">#D4AF37</color>
    <color name="day_night_sky">#18A8E8</color>
</resources>
`,
);

await write(
  resolve(resRoot, "drawable", "ic_launcher_foreground.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#071A33"
        android:pathData="M54,8A46,46 0,1 0,54 100A46,46 0,1 0,54 8" />
    <path
        android:fillColor="#00000000"
        android:strokeColor="#D4AF37"
        android:strokeWidth="5"
        android:strokeLineCap="round"
        android:pathData="M24,54A30,30 0,1 0,84 54A30,30 0,1 0,24 54" />
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFF"
        android:strokeWidth="6"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M34,35L34,73L49,73C65,73 74,65 74,54C74,43 65,35 49,35Z" />
    <path
        android:fillColor="#00000000"
        android:strokeColor="#D4AF37"
        android:strokeWidth="5"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M48,68L61,41L74,68" />
</vector>
`,
);

for (const fileName of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  await write(
    resolve(resRoot, "mipmap-anydpi-v26", fileName),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`,
  );
}

const stringsPath = resolve(resRoot, "values", "strings.xml");
let strings = await read(stringsPath);
strings = strings
  .replace(/<string name="app_name">[\s\S]*?<\/string>/, '<string name="app_name">DAY NIGHT Admin</string>')
  .replace(/<string name="title_activity_main">[\s\S]*?<\/string>/, '<string name="title_activity_main">DAY NIGHT Admin</string>');
await write(stringsPath, strings);

const gradlePath = resolve(appRoot, "build.gradle");
let gradle = await read(gradlePath);
gradle = gradle
  .replace(/versionCode\s*=\s*\d+/, "versionCode = 10000")
  .replace(/versionCode\s+\d+/, "versionCode 10000")
  .replace(/versionName\s*=\s*["'][^"']+["']/, 'versionName = "1.0.0"')
  .replace(/versionName\s+["'][^"']+["']/, 'versionName "1.0.0"');
await write(gradlePath, gradle);

const variablesPath = resolve(androidRoot, "variables.gradle");
let variables = await read(variablesPath);
variables = variables
  .replace(/minSdkVersion\s*=\s*\d+/, "minSdkVersion = 24")
  .replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36")
  .replace(/targetSdkVersion\s*=\s*\d+/, "targetSdkVersion = 36");
await write(variablesPath, variables);

console.log("DAY NIGHT Android project configured and hardened.");
