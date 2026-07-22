# DAY NIGHT Driver & Merchant Android Apps

This directory contains one thin native Android shell with two isolated product flavors:

| Flavor | App name | Package ID | Start route |
|---|---|---|---|
| `driver` | DAY NIGHT Driver / داي نايت للمندوب | `com.daynightae.driver` | `https://www.daynightae.com/driver` |
| `merchant` | DAY NIGHT Merchant / داي نايت للتاجر | `com.daynightae.merchant` | `https://www.daynightae.com/merchant` |

## Runtime architecture

- The APK contains a secure native WebView shell and opens only the assigned DAY NIGHT role route.
- Supabase authentication, Realtime, orders, maps, chat, and live web updates remain sourced from the production website.
- Web UI/data changes appear without reinstalling the APK because the shell loads the HTTPS production route.
- Native changes such as permissions, package IDs, Android code, icons, and splash resources require a new APK/AAB release.
- Session cookies and web storage remain inside the Android application sandbox. Android backup and device transfer are disabled for application data.
- Non-DAY-NIGHT navigation opens in the external browser; HTTP cleartext traffic is blocked.

## Local build

Requirements: Java 17, Android SDK 35, Gradle 8.9, and Python 3 with Pillow.

```bash
python -m pip install pillow
python android-role-shell/scripts/prepare_icons.py
gradle -p android-role-shell clean lintDriverRelease lintMerchantRelease \
  assembleDriverDebug assembleMerchantDebug \
  bundleDriverRelease bundleMerchantRelease
```

## Secure release signing

Never commit a keystore. Supply these environment variables only in a protected CI environment or a secure local shell:

```text
DAYNIGHT_ANDROID_KEYSTORE=/absolute/path/daynight-release.jks
DAYNIGHT_ANDROID_STORE_PASSWORD=...
DAYNIGHT_ANDROID_KEY_ALIAS=...
DAYNIGHT_ANDROID_KEY_PASSWORD=...
```

Without those variables, CI intentionally produces installable debug APKs and unsigned release AABs for signing later.

## Official icons

The build script downloads the two official role icons and compiles them into the corresponding APK/AAB. The applications do not fetch launcher artwork at runtime.
