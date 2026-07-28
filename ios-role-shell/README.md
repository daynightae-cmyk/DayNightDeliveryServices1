# DAY NIGHT iOS Role Apps v1.2.0

This directory contains two isolated iOS applications for the production DAY NIGHT web platform:

| App | Bundle ID | Start route |
|---|---|---|
| DAY NIGHT Driver / داي نايت للمندوب | `com.daynightae.driver` | `https://www.daynightae.com/driver` |
| DAY NIGHT Merchant / داي نايت للتاجر | `com.daynightae.merchant` | `https://www.daynightae.com/merchant` |

## Security and runtime contract

- Each target opens its own role route directly and blocks navigation into public or other-role routes.
- Supabase remains the authority for authentication, user identity, role, and account status.
- Face ID, Touch ID, or the device passcode protects a role-bound refresh token in iOS Keychain.
- Keychain material uses `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` and `userPresence`; it does not sync to iCloud.
- Passwords and access tokens are never persisted by the native shell.
- Driver and merchant use different Keychain service identifiers and different maximum biometric session ages.
- The driver requests location access for mission start and in-app navigation.
- External HTTPS, telephone, email, SMS, and WhatsApp links open outside the role shell.

## Generate and test the Xcode project

Requirements: macOS, Xcode, Homebrew, XcodeGen, Python 3, and Pillow.

```bash
brew install xcodegen
python3 -m venv ios-role-shell/.venv
ios-role-shell/.venv/bin/pip install "pillow>=10,<13"
ios-role-shell/.venv/bin/python ios-role-shell/scripts/prepare_icons.py
xcodegen generate --spec ios-role-shell/project.yml
open ios-role-shell/DayNightRoleApps.xcodeproj
```

The GitHub Actions workflow builds both targets for the iPhone Simulator with code signing disabled. Those `.app.zip` artifacts validate compilation and UI-shell packaging but **cannot be installed on a physical iPhone**.

## Produce installable IPA files

Apple requires every physical-device iOS app to be signed with a valid Apple Development or Apple Distribution certificate and a provisioning profile. There is no usable unsigned iPhone equivalent of Android's debug APK.

1. Enroll the company in the Apple Developer Program.
2. Register both explicit Bundle IDs shown above.
3. In Xcode, sign in with the Apple Account and select the DAY NIGHT development Team.
4. Set the Team ID and export method, then run:

```bash
export APPLE_TEAM_ID="YOUR_APPLE_TEAM_ID"
export IOS_EXPORT_METHOD="app-store-connect" # or ad-hoc / development
bash ios-role-shell/scripts/build_signed_ipas.sh
```

The script produces:

- `DAY-NIGHT-Driver-v1.2.0.ipa`
- `DAY-NIGHT-Merchant-v1.2.0.ipa`
- SHA-256 files
- `DAY-NIGHT-iOS-Apps-v1.2.0-SIGNED.zip`

For normal staff distribution, upload the archives to App Store Connect and deliver them through TestFlight. For direct Ad Hoc installation, every target iPhone UDID must be registered in the Apple Developer account and included in the provisioning profile.

## Files intentionally excluded

- Signing certificates (`.p12`, `.cer`)
- Provisioning profiles (`.mobileprovision`)
- App Store Connect private keys (`.p8`)
- Apple Account credentials

Never commit these assets to GitHub.
