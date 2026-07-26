package com.daynightae.shell.security;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.os.Build;

import androidx.biometric.BiometricManager;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import com.daynightae.shell.BuildConfig;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.Arrays;
import java.util.List;

@RunWith(AndroidJUnit4.class)
public final class BiometricCompatibilityTest {
    @Test
    public void flavorIsBoundToExpectedPackageRoleKeyAndPolicy() {
        Context context = ApplicationProvider.getApplicationContext();
        if ("driver".equals(BuildConfig.ROLE)) {
            assertEquals("com.daynightae.driver", context.getPackageName());
            assertEquals("daynight_driver_biometric_session_v1", BuildConfig.BIOMETRIC_KEY_ALIAS);
            assertEquals(86_400L, BuildConfig.BIOMETRIC_MAX_AGE_SECONDS);
        } else {
            assertEquals("merchant", BuildConfig.ROLE);
            assertEquals("com.daynightae.merchant", context.getPackageName());
            assertEquals("daynight_merchant_biometric_session_v1", BuildConfig.BIOMETRIC_KEY_ALIAS);
            assertEquals(43_200L, BuildConfig.BIOMETRIC_MAX_AGE_SECONDS);
        }
    }

    @Test
    public void biometricManagerReturnsAHandledPlatformStatus() {
        Context context = ApplicationProvider.getApplicationContext();
        int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            authenticators |= BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        }
        int status = BiometricManager.from(context).canAuthenticate(authenticators);
        List<Integer> handled = Arrays.asList(
                BiometricManager.BIOMETRIC_SUCCESS,
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED,
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
                BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED,
                BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED,
                BiometricManager.BIOMETRIC_STATUS_UNKNOWN
        );
        assertTrue("Unexpected BiometricManager status: " + status, handled.contains(status));
    }

    @Test
    public void cleanInstallHasNoBiometricSessionEnrollment() {
        Context context = ApplicationProvider.getApplicationContext();
        SecureSessionStore store = new SecureSessionStore(context);
        store.clear();
        assertFalse(store.hasEnrollment(BuildConfig.ROLE));
    }
}
