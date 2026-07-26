package com.daynightae.shell.security;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Android Keystore AES/GCM key management. Keys are non-exportable. */
public final class AndroidKeystoreManager {
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private final String alias;

    public AndroidKeystoreManager(String alias) {
        this.alias = alias;
    }

    public Cipher createEncryptionCipher() throws Exception {
        SecretKey key = getOrCreateKey();
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, key);
        return cipher;
    }

    public Cipher createDecryptionCipher(byte[] initializationVector) throws Exception {
        SecretKey key = getExistingKey();
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, initializationVector));
        return cipher;
    }

    public void deleteKey() {
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(alias)) {
                keyStore.deleteEntry(alias);
            }
        } catch (Exception ignored) {
            // Deliberately do not log key or session details.
        }
    }

    private SecretKey getExistingKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        KeyStore.Entry entry = keyStore.getEntry(alias, null);
        if (!(entry instanceof KeyStore.SecretKeyEntry)) {
            throw new IllegalStateException("biometric_key_missing");
        }
        return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
    }

    private SecretKey getOrCreateKey() throws Exception {
        try {
            return getExistingKey();
        } catch (IllegalStateException missing) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
            KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                    alias,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .setUserAuthenticationRequired(true);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                builder.setUserAuthenticationParameters(
                        0,
                        KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL
                );
            } else {
                // Pre-Android 11 crypto prompts cannot combine device credential with CryptoObject.
                // A strong biometric is required; password login remains the universal fallback.
                builder.setUserAuthenticationValidityDurationSeconds(-1);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    builder.setInvalidatedByBiometricEnrollment(true);
                }
            }

            generator.init(builder.build());
            return generator.generateKey();
        }
    }
}
