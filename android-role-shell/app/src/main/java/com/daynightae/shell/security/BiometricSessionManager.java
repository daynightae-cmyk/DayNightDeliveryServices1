package com.daynightae.shell.security;

import android.app.KeyguardManager;
import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyPermanentlyInvalidatedException;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;

/**
 * Owns all biometric prompts and cryptographic session operations. At most one
 * prompt can be active, and secrets are never written to logs.
 */
public final class BiometricSessionManager {
    public interface ResultCallback {
        void onResult(JSONObject result);
    }

    private final FragmentActivity activity;
    private final String expectedRole;
    private final String packageName;
    private final long maximumAgeMs;
    private final AndroidKeystoreManager keystore;
    private final SecureSessionStore store;
    private final Executor executor;
    private final AtomicBoolean promptActive = new AtomicBoolean(false);
    private BiometricPrompt activePrompt;

    public BiometricSessionManager(
            FragmentActivity activity,
            String expectedRole,
            String keyAlias,
            long maximumAgeSeconds
    ) {
        this.activity = activity;
        this.expectedRole = expectedRole;
        this.packageName = activity.getPackageName();
        this.maximumAgeMs = Math.max(60L, maximumAgeSeconds) * 1000L;
        this.keystore = new AndroidKeystoreManager(keyAlias);
        this.store = new SecureSessionStore(activity);
        this.executor = ContextCompat.getMainExecutor(activity);
    }

    public JSONObject availability() {
        JSONObject result = new JSONObject();
        try {
            int authenticators = allowedAuthenticators();
            int status = BiometricManager.from(activity).canAuthenticate(authenticators);
            KeyguardManager keyguard = (KeyguardManager) activity.getSystemService(Context.KEYGUARD_SERVICE);
            boolean deviceSecure = keyguard != null && keyguard.isDeviceSecure();
            boolean available = status == BiometricManager.BIOMETRIC_SUCCESS;
            result.put("available", available);
            result.put("enrolled", available);
            result.put("deviceCredentialAvailable", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && deviceSecure);
            result.put("biometricType", "biometric");
            result.put("reason", availabilityReason(status, deviceSecure));
        } catch (Exception error) {
            put(result, "available", false);
            put(result, "enrolled", false);
            put(result, "deviceCredentialAvailable", false);
            put(result, "reason", "availability_check_failed");
        }
        return result;
    }

    public boolean hasEnrollment() {
        return store.hasEnrollment(expectedRole);
    }

    public void enable(SecureSessionPayload payload, boolean isArabic, ResultCallback callback) {
        try {
            payload.validateBinding(expectedRole, packageName, maximumAgeMs, System.currentTimeMillis());
            Cipher cipher = keystore.createEncryptionCipher();
            authenticateWithCipher(
                    cipher,
                    isArabic,
                    isArabic ? "تفعيل الدخول بالبصمة" : "Enable biometric sign-in",
                    authenticatedCipher -> {
                        try {
                            byte[] encrypted = authenticatedCipher.doFinal(
                                    payload.toJson().toString().getBytes(StandardCharsets.UTF_8)
                            );
                            store.save(encrypted, authenticatedCipher.getIV(), payload);
                            callback.onResult(success());
                        } catch (Exception error) {
                            clearInternal();
                            callback.onResult(failure("encryption_failed", false));
                        }
                    },
                    callback
            );
        } catch (Exception error) {
            clearInternal();
            callback.onResult(failure(errorCode(error, "enable_failed"), false));
        }
    }

    public void authenticate(boolean isArabic, ResultCallback callback) {
        SecureSessionStore.EncryptedRecord record = store.read();
        if (record == null) {
            callback.onResult(failure("no_enrollment", false));
            return;
        }
        if (!expectedRole.equals(record.role)
                || record.schemaVersion != SecureSessionPayload.SCHEMA_VERSION
                || record.createdAt <= 0L
                || System.currentTimeMillis() - record.createdAt > maximumAgeMs) {
            clearInternal();
            callback.onResult(failure("biometric_session_expired", false));
            return;
        }

        try {
            Cipher cipher = keystore.createDecryptionCipher(record.initializationVector);
            authenticateWithCipher(
                    cipher,
                    isArabic,
                    isArabic ? "الدخول بالبصمة" : "Biometric sign-in",
                    authenticatedCipher -> {
                        try {
                            byte[] decrypted = authenticatedCipher.doFinal(record.ciphertext);
                            SecureSessionPayload payload = SecureSessionPayload.fromJson(
                                    new JSONObject(new String(decrypted, StandardCharsets.UTF_8))
                            );
                            payload.validateBinding(expectedRole, packageName, maximumAgeMs, System.currentTimeMillis());
                            JSONObject result = success();
                            result.put("refreshToken", payload.getRefreshToken());
                            result.put("userId", payload.getUserId());
                            result.put("expectedRole", payload.getExpectedRole());
                            result.put("createdAt", payload.getCreatedAtEpochMs());
                            callback.onResult(result);
                        } catch (AEADBadTagException | KeyPermanentlyInvalidatedException error) {
                            clearInternal();
                            callback.onResult(failure("biometric_session_revoked", false));
                        } catch (Exception error) {
                            clearInternal();
                            callback.onResult(failure(errorCode(error, "decryption_failed"), false));
                        }
                    },
                    callback
            );
        } catch (KeyPermanentlyInvalidatedException error) {
            clearInternal();
            callback.onResult(failure("biometric_key_invalidated", false));
        } catch (Exception error) {
            clearInternal();
            callback.onResult(failure(errorCode(error, "authentication_setup_failed"), false));
        }
    }

    public JSONObject disable() {
        clearInternal();
        return success();
    }

    public void cancel() {
        BiometricPrompt prompt = activePrompt;
        if (prompt != null) {
            prompt.cancelAuthentication();
        }
        activePrompt = null;
        promptActive.set(false);
    }

    private void authenticateWithCipher(
            Cipher cipher,
            boolean isArabic,
            String title,
            CipherSuccess success,
            ResultCallback callback
    ) {
        if (!promptActive.compareAndSet(false, true)) {
            callback.onResult(failure("biometric_prompt_busy", false));
            return;
        }

        JSONObject availability = availability();
        if (!availability.optBoolean("available", false)) {
            promptActive.set(false);
            callback.onResult(failure(availability.optString("reason", "biometric_unavailable"), false));
            return;
        }

        BiometricPrompt.AuthenticationCallback authenticationCallback = new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                promptActive.set(false);
                activePrompt = null;
                BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                Cipher authenticatedCipher = crypto == null ? null : crypto.getCipher();
                if (authenticatedCipher == null) {
                    callback.onResult(failure("crypto_object_missing", false));
                    return;
                }
                success.onSuccess(authenticatedCipher);
            }

            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                promptActive.set(false);
                activePrompt = null;
                boolean cancelled = errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                        || errorCode == BiometricPrompt.ERROR_USER_CANCELED
                        || errorCode == BiometricPrompt.ERROR_CANCELED;
                callback.onResult(failure(mapPromptError(errorCode), cancelled));
            }

            @Override
            public void onAuthenticationFailed() {
                // The system prompt stays open and lets the user retry safely.
            }
        };

        activePrompt = new BiometricPrompt(activity, executor, authenticationCallback);
        BiometricPrompt.PromptInfo.Builder promptBuilder = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(isArabic
                        ? "استخدم بصمة الإصبع أو الوجه أو قفل الجهاز"
                        : "Use your fingerprint, face, or device lock")
                .setConfirmationRequired(false)
                .setAllowedAuthenticators(allowedAuthenticators());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            promptBuilder.setNegativeButtonText(isArabic ? "استخدام كلمة المرور" : "Use password");
        }
        activePrompt.authenticate(promptBuilder.build(), new BiometricPrompt.CryptoObject(cipher));
    }

    private int allowedAuthenticators() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return BiometricManager.Authenticators.BIOMETRIC_STRONG
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        }
        return BiometricManager.Authenticators.BIOMETRIC_STRONG;
    }

    private String availabilityReason(int status, boolean deviceSecure) {
        if (status == BiometricManager.BIOMETRIC_SUCCESS) return "";
        if (status == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
            return deviceSecure ? "biometric_not_enrolled" : "secure_lock_not_configured";
        }
        if (status == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE) return "biometric_hardware_unavailable";
        if (status == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE) return "biometric_temporarily_unavailable";
        if (status == BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED) return "security_update_required";
        if (status == BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED) return "authenticator_unsupported";
        return "biometric_unavailable";
    }

    private void clearInternal() {
        cancel();
        store.clear();
        keystore.deleteKey();
    }

    private static JSONObject success() {
        JSONObject result = new JSONObject();
        put(result, "success", true);
        return result;
    }

    private static JSONObject failure(String error, boolean cancelled) {
        JSONObject result = new JSONObject();
        put(result, "success", false);
        put(result, "error", error);
        put(result, "cancelled", cancelled);
        return result;
    }

    private static String errorCode(Exception error, String fallback) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) return fallback;
        if (message.contains("role_binding_mismatch")) return "role_binding_mismatch";
        if (message.contains("package_binding_mismatch")) return "package_binding_mismatch";
        if (message.contains("expired")) return "biometric_session_expired";
        if (message.contains("schema")) return "unsupported_schema_version";
        return fallback;
    }

    private static String mapPromptError(int errorCode) {
        if (errorCode == BiometricPrompt.ERROR_LOCKOUT || errorCode == BiometricPrompt.ERROR_LOCKOUT_PERMANENT) {
            return "biometric_locked";
        }
        if (errorCode == BiometricPrompt.ERROR_NO_BIOMETRICS) return "biometric_not_enrolled";
        if (errorCode == BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL) return "secure_lock_not_configured";
        if (errorCode == BiometricPrompt.ERROR_HW_NOT_PRESENT) return "biometric_hardware_unavailable";
        if (errorCode == BiometricPrompt.ERROR_HW_UNAVAILABLE) return "biometric_temporarily_unavailable";
        if (errorCode == BiometricPrompt.ERROR_TIMEOUT) return "biometric_timeout";
        if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                || errorCode == BiometricPrompt.ERROR_USER_CANCELED
                || errorCode == BiometricPrompt.ERROR_CANCELED) {
            return "biometric_cancelled";
        }
        return "biometric_authentication_failed";
    }

    private static void put(JSONObject target, String key, Object value) {
        try {
            target.put(key, value);
        } catch (Exception ignored) {
            // JSONObject insertion for primitive values should not fail.
        }
    }

    private interface CipherSuccess {
        void onSuccess(Cipher cipher);
    }
}
