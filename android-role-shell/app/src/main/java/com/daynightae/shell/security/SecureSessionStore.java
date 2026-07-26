package com.daynightae.shell.security;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

/**
 * Stores ciphertext and non-sensitive metadata only. The AES key remains in
 * Android Keystore and can only be used after biometric/device authentication.
 */
public final class SecureSessionStore {
    private static final String PREFS = "daynight_biometric_session_v1";
    private static final String CIPHERTEXT = "ciphertext";
    private static final String IV = "iv";
    private static final String USER_ID = "user_id";
    private static final String ROLE = "role";
    private static final String CREATED_AT = "created_at";
    private static final String SCHEMA = "schema";

    private final SharedPreferences preferences;

    public SecureSessionStore(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public void save(byte[] ciphertext, byte[] initializationVector, SecureSessionPayload payload) {
        preferences.edit()
                .putString(CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .putString(IV, Base64.encodeToString(initializationVector, Base64.NO_WRAP))
                .putString(USER_ID, payload.getUserId())
                .putString(ROLE, payload.getExpectedRole())
                .putLong(CREATED_AT, payload.getCreatedAtEpochMs())
                .putInt(SCHEMA, SecureSessionPayload.SCHEMA_VERSION)
                .apply();
    }

    public EncryptedRecord read() {
        String ciphertext = preferences.getString(CIPHERTEXT, "");
        String iv = preferences.getString(IV, "");
        if (ciphertext == null || ciphertext.isEmpty() || iv == null || iv.isEmpty()) {
            return null;
        }
        try {
            return new EncryptedRecord(
                    Base64.decode(ciphertext, Base64.NO_WRAP),
                    Base64.decode(iv, Base64.NO_WRAP),
                    preferences.getString(USER_ID, ""),
                    preferences.getString(ROLE, ""),
                    preferences.getLong(CREATED_AT, 0L),
                    preferences.getInt(SCHEMA, -1)
            );
        } catch (IllegalArgumentException malformed) {
            clear();
            return null;
        }
    }

    public boolean hasEnrollment(String expectedRole) {
        EncryptedRecord record = read();
        return record != null
                && record.schemaVersion == SecureSessionPayload.SCHEMA_VERSION
                && expectedRole.equals(record.role);
    }

    public void clear() {
        preferences.edit().clear().apply();
    }

    public static final class EncryptedRecord {
        public final byte[] ciphertext;
        public final byte[] initializationVector;
        public final String userId;
        public final String role;
        public final long createdAt;
        public final int schemaVersion;

        EncryptedRecord(
                byte[] ciphertext,
                byte[] initializationVector,
                String userId,
                String role,
                long createdAt,
                int schemaVersion
        ) {
            this.ciphertext = ciphertext;
            this.initializationVector = initializationVector;
            this.userId = userId == null ? "" : userId;
            this.role = role == null ? "" : role;
            this.createdAt = createdAt;
            this.schemaVersion = schemaVersion;
        }
    }
}
