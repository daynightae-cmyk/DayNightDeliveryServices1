# DAY NIGHT Android launcher icon hotfix — v1.1.1

## Confirmed root cause

The v1.1.0 APK contained the correct colored company PNG, but also declared it as an Android 13 `monochrome` adaptive-icon layer. The official logo image has an opaque white circular canvas. Samsung/One UI themed-icon rendering therefore interpreted that entire opaque canvas as one solid monochrome mask and displayed a blank white icon.

## Permanent fix

- Remove `mipmap-anydpi-v26/ic_launcher.xml`.
- Remove `mipmap-anydpi-v26/ic_launcher_round.xml`.
- Remove all generated `ic_launcher_foreground` resources.
- Keep `android:icon` and `android:roundIcon` pointing to ordinary full-color PNG bitmap resources.
- Copy the exact official company logo to every launcher density.
- Build as version `1.1.1 (10101)`.

## CI proof

The Android workflow now opens the built APK and fails unless all of the following are true:

1. No adaptive launcher XML exists inside the APK.
2. No foreground/monochrome icon resource exists inside the APK.
3. The SHA-256 of the APK's xxxhdpi launcher PNG is exactly equal to the SHA-256 of the official repository logo.

The APK must not be distributed unless this verification step passes.
