import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(root, "../..");
const androidRoot = resolve(root, "android");
const appRoot = resolve(androidRoot, "app");
const mainRoot = resolve(appRoot, "src", "main");
const resRoot = resolve(mainRoot, "res");
const officialLogo = resolve(
  repositoryRoot,
  "artifacts",
  "day-night-delivery",
  "public",
  "assets",
  "daynight",
  "logo.png",
);

async function read(path) {
  return readFile(path, "utf8");
}

async function write(path, value) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, value, "utf8");
}

async function copy(path, destination) {
  await mkdir(resolve(destination, ".."), { recursive: true });
  await copyFile(path, destination);
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
                <data android:scheme="https" android:host="daynightae.com" />
                <data android:scheme="https" android:host="www.daynightae.com" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="daynight" android:host="open" />
                <data android:scheme="daynightadmin" android:host="open" />
            </intent-filter>`;

if (!manifest.includes('android:scheme="daynight"')) {
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
    <color name="day_night_gold">#D4AF37</color>
    <color name="day_night_sky">#18A8E8</color>
</resources>
`,
);

// Capacitor creates this resource. Overwrite that exact file instead of declaring
// the same color in colors.xml, which would create a duplicate Android resource.
await write(
  resolve(resRoot, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
`,
);

// Use the exact official company logo instead of a generated placeholder/vector.
await copy(officialLogo, resolve(resRoot, "drawable-nodpi", "day_night_logo.png"));
await copy(officialLogo, resolve(resRoot, "drawable", "splash.png"));

for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  for (const fileName of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
    await copy(officialLogo, resolve(resRoot, `mipmap-${density}`, fileName));
  }
}

await write(
  resolve(resRoot, "drawable", "ic_launcher_foreground.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/day_night_logo"
    android:inset="6%" />
`,
);

for (const fileName of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  await write(
    resolve(resRoot, "mipmap-anydpi-v26", fileName),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`,
  );
}

const stringsPath = resolve(resRoot, "values", "strings.xml");
let strings = await read(stringsPath);
strings = strings
  .replace(/<string name="app_name">[\s\S]*?<\/string>/, '<string name="app_name">DAY NIGHT</string>')
  .replace(/<string name="title_activity_main">[\s\S]*?<\/string>/, '<string name="title_activity_main">DAY NIGHT</string>');
await write(stringsPath, strings);

const gradlePath = resolve(appRoot, "build.gradle");
let gradle = await read(gradlePath);
gradle = gradle
  .replace(/versionCode\s*=\s*\d+/, "versionCode = 10100")
  .replace(/versionCode\s+\d+/, "versionCode 10100")
  .replace(/versionName\s*=\s*["'][^"']+["']/, 'versionName = "1.1.0"')
  .replace(/versionName\s+["'][^"']+["']/, 'versionName "1.1.0"');
await write(gradlePath, gradle);

const variablesPath = resolve(androidRoot, "variables.gradle");
let variables = await read(variablesPath);
variables = variables
  .replace(/minSdkVersion\s*=\s*\d+/, "minSdkVersion = 24")
  .replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36")
  .replace(/targetSdkVersion\s*=\s*\d+/, "targetSdkVersion = 36");
await write(variablesPath, variables);

console.log("DAY NIGHT Android full application configured with the official logo.");
