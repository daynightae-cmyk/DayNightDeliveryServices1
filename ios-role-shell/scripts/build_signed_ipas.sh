#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IOS_DIR="$ROOT/ios-role-shell"
TEAM_ID="${APPLE_TEAM_ID:-}"
EXPORT_METHOD="${IOS_EXPORT_METHOD:-app-store-connect}"
OUTPUT_DIR="$IOS_DIR/dist-signed-v120"

if [[ -z "$TEAM_ID" ]]; then
  echo "APPLE_TEAM_ID is required. Use the Team ID from the Apple Developer account." >&2
  exit 2
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is required: brew install xcodegen" >&2
  exit 2
fi

python3 "$IOS_DIR/scripts/prepare_icons.py"
xcodegen generate --spec "$IOS_DIR/project.yml"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

build_role() {
  local scheme="$1"
  local bundle_id="$2"
  local output_name="$3"
  local archive="$IOS_DIR/build-signed/${scheme}.xcarchive"
  local export_dir="$OUTPUT_DIR/${scheme}"
  local export_plist="$IOS_DIR/build-signed/${scheme}-ExportOptions.plist"

  rm -rf "$archive" "$export_dir"
  mkdir -p "$(dirname "$archive")" "$export_dir"

  cat > "$export_plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${EXPORT_METHOD}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
PLIST

  xcodebuild \
    -project "$IOS_DIR/DayNightRoleApps.xcodeproj" \
    -scheme "$scheme" \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$archive" \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    CODE_SIGN_STYLE=Automatic \
    -allowProvisioningUpdates \
    clean archive

  xcodebuild \
    -exportArchive \
    -archivePath "$archive" \
    -exportPath "$export_dir" \
    -exportOptionsPlist "$export_plist" \
    -allowProvisioningUpdates

  local ipa
  ipa="$(find "$export_dir" -maxdepth 1 -type f -name '*.ipa' | head -n 1)"
  test -s "$ipa"
  cp "$ipa" "$OUTPUT_DIR/$output_name"
  /usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleIdentifier' "$archive/Info.plist" | grep -Fx "$bundle_id"
}

build_role "DayNightDriver" "com.daynightae.driver" "DAY-NIGHT-Driver-v1.2.0.ipa"
build_role "DayNightMerchant" "com.daynightae.merchant" "DAY-NIGHT-Merchant-v1.2.0.ipa"

(
  cd "$OUTPUT_DIR"
  shasum -a 256 DAY-NIGHT-Driver-v1.2.0.ipa > DAY-NIGHT-Driver-v1.2.0-iOS.sha256
  shasum -a 256 DAY-NIGHT-Merchant-v1.2.0.ipa > DAY-NIGHT-Merchant-v1.2.0-iOS.sha256
  zip -9 DAY-NIGHT-iOS-Apps-v1.2.0-SIGNED.zip \
    DAY-NIGHT-Driver-v1.2.0.ipa DAY-NIGHT-Driver-v1.2.0-iOS.sha256 \
    DAY-NIGHT-Merchant-v1.2.0.ipa DAY-NIGHT-Merchant-v1.2.0-iOS.sha256
)

echo "Signed iOS packages are available in: $OUTPUT_DIR"
