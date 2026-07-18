import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

    // Explicitly use bitmap launcher resources. Do not allow Android 13/Samsung
    // themed-icon monochrome rendering to replace the official colored company logo.
    if (/android:icon="[^"]*"/.test(next)) {
      next = next.replace(/android:icon="[^"]*"/, 'android:icon="@mipmap/ic_launcher"');
    } else {
      next += '\n        android:icon="@mipmap/ic_launcher"';
    }
    if (/android:roundIcon="[^"]*"/.test(next)) {
      next = next.replace(/android:roundIcon="[^"]*"/, 'android:roundIcon="@mipmap/ic_launcher_round"');
    } else {
      next += '\n        android:roundIcon="@mipmap/ic_launcher_round"';
    }

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

await write(
  resolve(resRoot, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#071A33</color>
</resources>
`,
);

// Use the exact official company logo for the launcher and splash.
await copy(officialLogo, resolve(resRoot, "drawable-nodpi", "day_night_logo.png"));
await copy(officialLogo, resolve(resRoot, "drawable", "splash.png"));

for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  await copy(officialLogo, resolve(resRoot, `mipmap-${density}`, "ic_launcher.png"));
  await copy(officialLogo, resolve(resRoot, `mipmap-${density}`, "ic_launcher_round.png"));

  // Remove unused generated foregrounds so they cannot be selected by launchers.
  await rm(resolve(resRoot, `mipmap-${density}`, "ic_launcher_foreground.png"), { force: true });
}

// Critical Samsung/Android 13 fix:
// remove adaptive and monochrome icon XML resources. The previous <monochrome>
// entry treated the opaque white logo canvas as a solid white mask, which is why
// the launcher displayed a blank white icon even though the colored PNG existed.
for (const path of [
  resolve(resRoot, "mipmap-anydpi-v26", "ic_launcher.xml"),
  resolve(resRoot, "mipmap-anydpi-v26", "ic_launcher_round.xml"),
  resolve(resRoot, "drawable", "ic_launcher_foreground.xml"),
  resolve(resRoot, "drawable-v24", "ic_launcher_foreground.xml"),
]) {
  await rm(path, { force: true });
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
  .replace(/versionCode\s*=\s*\d+/, "versionCode = 10101")
  .replace(/versionCode\s+\d+/, "versionCode 10101")
  .replace(/versionName\s*=\s*["'][^"']+["']/, 'versionName = "1.1.1"')
  .replace(/versionName\s+["'][^"']+["']/, 'versionName "1.1.1"');
await write(gradlePath, gradle);

const variablesPath = resolve(androidRoot, "variables.gradle");
let variables = await read(variablesPath);
variables = variables
  .replace(/minSdkVersion\s*=\s*\d+/, "minSdkVersion = 24")
  .replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36")
  .replace(/targetSdkVersion\s*=\s*\d+/, "targetSdkVersion = 36");
await write(variablesPath, variables);

console.log("DAY NIGHT Android configured with forced full-color legacy launcher icons; themed monochrome icons disabled.");
