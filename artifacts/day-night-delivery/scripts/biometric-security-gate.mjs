import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = false;

function read(relative) {
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`FAIL: missing ${relative}`);
    failed = true;
    return "";
  }
  console.log(`PASS: ${relative}`);
  return fs.readFileSync(file, "utf8");
}

function expect(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function reject(content, pattern, label) {
  if (pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

console.log("\n--- DAY NIGHT biometric and passkey security gate ---");

const gradle = read("../../android-role-shell/app/build.gradle");
const manifest = read("../../android-role-shell/app/src/main/AndroidManifest.xml");
const activity = read("../../android-role-shell/app/src/main/java/com/daynightae/shell/MainActivity.java");
const payload = read("../../android-role-shell/app/src/main/java/com/daynightae/shell/security/SecureSessionPayload.java");
const keystore = read("../../android-role-shell/app/src/main/java/com/daynightae/shell/security/AndroidKeystoreManager.java");
const store = read("../../android-role-shell/app/src/main/java/com/daynightae/shell/security/SecureSessionStore.java");
const manager = read("../../android-role-shell/app/src/main/java/com/daynightae/shell/security/BiometricSessionManager.java");
const bridge = read("../../android-role-shell/app/src/main/java/com/daynightae/shell/security/DayNightBiometricBridge.java");
const nativeRuntime = read("src/lib/nativeBiometric.ts");
const boundary = read("src/components/native/NativeBiometricBoundary.tsx");
const revocation = read("src/components/native/NativeBiometricAuthRevocation.tsx");
const passkeys = read("src/lib/supabasePasskeys.ts");
const adminSecurity = read("src/components/admin/AdminSecuritySettings.tsx");
const adminStepUp = read("src/lib/adminStepUp.ts");
const adminStepUpProvider = read("src/components/admin/AdminStepUpProvider.tsx");
const adminStepUpPlugin = read("scripts/admin-step-up-rule-plugin.ts");
const adminExport = read("src/components/admin/AdminPdfExportButton.tsx");
const auth = read("src/components/Auth.tsx");
const auditMigration = read("../../supabase/migrations/20260727123000_auth_security_audit.sql");
const visualWorkflow = read("../../.github/workflows/android-role-arabic-visual.yml");

expect(gradle, /versionName\s+"1\.2\.0"/, "Android role apps are version 1.2.0");
expect(gradle, /androidx\.biometric:biometric:1\.1\.0/, "Official stable AndroidX biometric library is used");
expect(gradle, /daynight_driver_biometric_session_v1/, "Driver has an isolated Keystore alias");
expect(gradle, /daynight_merchant_biometric_session_v1/, "Merchant has an isolated Keystore alias");
expect(manifest, /android\.permission\.USE_BIOMETRIC/, "Biometric permission is declared");
expect(activity, /extends FragmentActivity/, "MainActivity supports AndroidX BiometricPrompt lifecycle");
expect(activity, /syncBiometricBridge/, "Bridge attachment follows main-frame navigation");
expect(activity, /removeJavascriptInterface\(BIOMETRIC_BRIDGE_NAME\)/, "Bridge is removed outside authorized pages and on destruction");

expect(keystore, /AES\/GCM\/NoPadding/, "AES-GCM protects the stored session");
expect(keystore, /AndroidKeyStore/, "Key remains inside Android Keystore");
expect(keystore, /AUTH_BIOMETRIC_STRONG[\s\S]*AUTH_DEVICE_CREDENTIAL/, "Android 11+ supports strong biometric or device credential");
expect(manager, /BiometricPrompt\.CryptoObject/, "Encryption and decryption require CryptoObject authentication");
expect(manager, /AtomicBoolean/, "Duplicate biometric prompts are blocked");
expect(manager, /biometric_key_invalidated|biometric_session_revoked/, "Invalidated keys revoke the secure session");

expect(payload, /private final String refreshToken;/, "Only the refresh token is eligible for encrypted restoration");
reject(payload, /private final String (?:password|accessToken);|\.put\("(?:password|accessToken)"/i, "Payload never contains a password or access token field");
expect(store, /ciphertext/, "Preferences store ciphertext");
expect(store, /initializationVector|\bIV\b/, "Preferences store an IV");
reject(store, /putString\([^\n]*(refresh|password|access)/i, "Preferences never store a plaintext credential");

expect(bridge, /daynightae\.com/, "Bridge allows only official DAY NIGHT hosts");
expect(bridge, /rolePrefix/, "Bridge requires the matching role path");
expect(bridge, /role_binding_mismatch/, "Bridge rejects cross-role enrollment");
reject(`${keystore}\n${store}\n${manager}\n${bridge}`, /\bLog\.|System\.out|printStackTrace/, "Native security code never logs secrets or payloads");

expect(nativeRuntime, /refreshSession\(\{ refresh_token:/, "Supabase session is restored through a refresh token");
expect(nativeRuntime, /validateNativeRole/, "Server-side role and status are revalidated after biometric success");
expect(nativeRuntime, /signOut\(\{ scope: "local" \}\)/, "Invalid restored sessions are cleared locally");
expect(boundary, /autoPromptAttempted/, "Automatic prompting occurs at most once per launch");
expect(boundary, /daynight-native-resume/, "Background return is governed by the role policy");
expect(boundary, /استخدام حساب آخر/, "Account switching explicitly removes device binding");
expect(revocation, /USER_UPDATED/, "Password and account-security updates revoke biometric binding");

expect(passkeys, /VITE_ENABLE_SUPABASE_PASSKEYS/, "Passkeys are protected by an explicit feature flag");
expect(passkeys, /experimental:\s*\{ passkey: true \}/, "Supabase passkey support is explicitly enabled only in the isolated client");
expect(passkeys, /isAdminUser/, "Admin role is checked before and after passkey operations");
expect(adminSecurity, /registerAdminPasskey/, "Admin can register a passkey after authentication");
expect(adminSecurity, /removeAdminPasskey/, "Admin can remove registered passkeys");
expect(auth, /adminSignInWithPasskey/, "Admin login supports passkey authentication behind the flag");
reject(auth, /console\.(?:log|error)[\s\S]{0,120}(password|token|email)/i, "Admin auth does not log credentials or account identifiers");

expect(adminStepUp, /RECENT_AUTH_MS\s*=\s*2 \* 60 \* 1000/, "Sensitive admin verification expires after two minutes");
expect(adminStepUp, /getAuthenticatorAssuranceLevel/, "Step-up checks Supabase AAL");
expect(adminStepUpProvider, /mfa\.challenge/, "MFA factors receive a real Supabase challenge");
expect(adminStepUpProvider, /mfa\.verify/, "MFA codes are verified by Supabase");
expect(adminStepUpProvider, /signInWithPassword/, "Password re-authentication remains available without storing the password");
expect(adminStepUpPlugin, /delete_order/, "Order deletion requires step-up");
expect(adminStepUpPlugin, /change_salary/, "Salary changes require step-up");
expect(adminStepUpPlugin, /modify_bank_details/, "Bank details require step-up");
expect(adminStepUpPlugin, /create_employee/, "Employee creation requires step-up");
expect(adminExport, /export_sensitive_data/, "Sensitive report exports require step-up");

expect(auditMigration, /auth_security_audit/, "Security audit table exists");
expect(auditMigration, /record_auth_security_event/, "Audit events are written through a constrained RPC");
expect(auditMigration, /enable row level security/, "Security audit table uses RLS");
reject(auditMigration, /^\s*(?:password|access_token|refresh_token|credential_secret)\s+[a-z]/im, "Audit table defines no credential-secret column");

expect(visualWorkflow, /roleReady\\+":true/, "Visual acceptance matches escaped role-ready Android diagnostics");
expect(visualWorkflow, /driverRuntime\\+":true/, "Visual acceptance matches escaped Driver runtime diagnostics");
expect(visualWorkflow, /merchantLogin\\+":true/, "Visual acceptance matches escaped Merchant login diagnostics");

if (failed) {
  console.error("Biometric and passkey security gate FAILED.\n");
  process.exit(1);
}
console.log("Biometric and passkey security gate PASSED.\n");
