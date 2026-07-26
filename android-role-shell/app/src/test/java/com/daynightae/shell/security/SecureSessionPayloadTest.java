package com.daynightae.shell.security;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

public final class SecureSessionPayloadTest {
    private static SecureSessionPayload payload(long createdAt) {
        return new SecureSessionPayload(
                "refresh-token-used-only-in-test-memory",
                "user-123",
                "driver",
                "com.daynightae.driver",
                createdAt
        );
    }

    @Test
    public void acceptsMatchingRolePackageAndAge() {
        long now = 1_800_000L;
        payload(now - 1_000L).validateBinding("driver", "com.daynightae.driver", 60_000L, now);
    }

    @Test
    public void rejectsWrongRole() {
        try {
            payload(1_000L).validateBinding("merchant", "com.daynightae.driver", 60_000L, 2_000L);
            fail("Expected role binding mismatch");
        } catch (SecurityException expected) {
            assertTrue(expected.getMessage().contains("role_binding_mismatch"));
        }
    }

    @Test
    public void rejectsWrongPackage() {
        try {
            payload(1_000L).validateBinding("driver", "com.daynightae.merchant", 60_000L, 2_000L);
            fail("Expected package binding mismatch");
        } catch (SecurityException expected) {
            assertTrue(expected.getMessage().contains("package_binding_mismatch"));
        }
    }

    @Test
    public void rejectsExpiredEnrollment() {
        try {
            payload(1_000L).validateBinding("driver", "com.daynightae.driver", 60_000L, 62_000L);
            fail("Expected biometric session expiry");
        } catch (SecurityException expected) {
            assertTrue(expected.getMessage().contains("biometric_session_expired"));
        }
    }

    @Test
    public void payloadClassHasNoPasswordOrAccessTokenField() {
        String fields = Arrays.stream(SecureSessionPayload.class.getDeclaredFields())
                .map(Field::getName)
                .map(value -> value.toLowerCase(Locale.ROOT))
                .collect(Collectors.joining(" "));
        assertFalse(fields.contains("password"));
        assertFalse(fields.contains("accesstoken"));
        assertTrue(fields.contains("refreshtoken"));
    }
}
