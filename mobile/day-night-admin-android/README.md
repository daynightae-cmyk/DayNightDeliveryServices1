# DAY NIGHT Admin — Android APK

Native Android packaging for the production DAY NIGHT Admin portal.

## Runtime model

- Capacitor 8 native Android container.
- Application ID: `ae.daynight.admin`.
- App name: `DAY NIGHT Admin`.
- Production portal: `https://daynightae.com/auth` over HTTPS only.
- Native back-button handling, external browser handling, deep links, haptics, keyboard resizing, status bar, splash screen, safe-area layout, camera/file upload support, network state, and location permissions.
- Local branded offline/error screen.
- Android API 36 target, API 24 minimum.

The production portal remains the authoritative application code, so approved GitHub/Vercel updates appear in the Android shell without distributing fake or stale operational data.

## Local build

Requirements:

- Node.js 22+
- Android Studio 2025.2.1+
- Android SDK Platform 36
- JDK supplied by Android Studio, or JDK 21

```bash
cd mobile/day-night-admin-android
npm install
npm run android:debug
```

Installable debug APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Unsigned release APK:

```bash
npm run android:release
```

```text
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## GitHub Actions

Workflow:

```text
.github/workflows/day-night-admin-android.yml
```

It builds and uploads:

- `DAY-NIGHT-Admin-Android-debug.apk` — installable internal APK.
- `DAY-NIGHT-Admin-Android-release-unsigned.apk` — release binary awaiting permanent signing.
- `SHA256SUMS.txt`.
- Android build report.

## Permanent release signing

A production APK/AAB must use one permanent private keystore. Never commit the keystore or passwords to GitHub.

Repository Actions secrets supported by the workflow:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

`ANDROID_KEYSTORE_BASE64` is the base64 representation of the permanent `.jks` file. Once configured, the workflow can be extended to sign release APK/AAB artifacts using the same key for all upgrades.

## Deep links

Supported entry points:

```text
daynightadmin://open/auth
daynightadmin://open/admin
https://daynightae.com/auth
https://daynightae.com/admin
```

Android App Links verification requires publishing the matching `assetlinks.json` after the permanent signing certificate is created.
