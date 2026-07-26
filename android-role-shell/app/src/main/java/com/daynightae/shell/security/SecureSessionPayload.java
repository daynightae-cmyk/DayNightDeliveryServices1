package com.daynightae.shell.security;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Minimal encrypted payload for restoring a Supabase session.
 * Passwords and access tokens are deliberately excluded.
 */
public final class SecureSessionPayload {
    public static final int SCHEMA_VERSION = 1;

    private final String refreshToken;
    private final String userId;
    private final String expectedRole;
    private final String packageName;
    private final long createdAtEpochMs;

    public SecureSessionPayload(
            String refreshToken,
            String userId,
            String expectedRole,
            String packageName,
            long createdAtEpochMs
    ) {
        this.refreshToken = required(refreshToken, "refresh_token_required");
        this.userId = required(userId, "user_id_required");
        this.expectedRole = required(expectedRole, "expected_role_required");
        this.packageName = required(packageName, "package_name_required");
        this.createdAtEpochMs = createdAtEpochMs;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public String getUserId() {
        return userId;
    }

    public String getExpectedRole() {
        return expectedRole;
    }

    public String getPackageName() {
        return packageName;
    }

    public long getCreatedAtEpochMs() {
        return createdAtEpochMs;
    }

    public JSONObject toJson() throws JSONException {
        return new JSONObject()
                .put("schemaVersion", SCHEMA_VERSION)
                .put("refreshToken", refreshToken)
                .put("userId", userId)
                .put("expectedRole", expectedRole)
                .put("packageName", packageName)
                .put("createdAt", createdAtEpochMs);
    }

    public static SecureSessionPayload fromJson(JSONObject json) throws JSONException {
        if (json.optInt("schemaVersion", -1) != SCHEMA_VERSION) {
            throw new JSONException("unsupported_schema_version");
        }
        return new SecureSessionPayload(
                json.optString("refreshToken", ""),
                json.optString("userId", ""),
                json.optString("expectedRole", ""),
                json.optString("packageName", ""),
                json.optLong("createdAt", 0L)
        );
    }

    public void validateBinding(String role, String currentPackage, long maxAgeMs, long nowEpochMs) {
        if (!expectedRole.equals(role)) {
            throw new SecurityException("role_binding_mismatch");
        }
        if (!packageName.equals(currentPackage)) {
            throw new SecurityException("package_binding_mismatch");
        }
        if (createdAtEpochMs <= 0L || nowEpochMs < createdAtEpochMs) {
            throw new SecurityException("invalid_session_timestamp");
        }
        if (maxAgeMs > 0L && nowEpochMs - createdAtEpochMs > maxAgeMs) {
            throw new SecurityException("biometric_session_expired");
        }
    }

    private static String required(String value, String error) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(error);
        }
        return normalized;
    }
}
