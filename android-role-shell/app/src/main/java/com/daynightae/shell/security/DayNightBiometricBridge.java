package com.daynightae.shell.security;

import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.Locale;

/**
 * Narrow JavaScript-to-native bridge. Every call is rejected unless the main
 * WebView is on the official DAY NIGHT origin and the path matches this APK role.
 */
public final class DayNightBiometricBridge {
    private final WebView webView;
    private final BiometricSessionManager manager;
    private final String role;
    private final String packageName;
    private volatile boolean attached;

    public DayNightBiometricBridge(
            WebView webView,
            BiometricSessionManager manager,
            String role,
            String packageName
    ) {
        this.webView = webView;
        this.manager = manager;
        this.role = role;
        this.packageName = packageName;
    }

    public void setAttached(boolean attached) {
        this.attached = attached;
    }

    @JavascriptInterface
    public void isAvailable(String requestId) {
        runAuthorized(requestId, () -> resolve(requestId, manager.availability()));
    }

    @JavascriptInterface
    public void hasEnrollment(String requestId) {
        runAuthorized(requestId, () -> {
            JSONObject result = success();
            put(result, "enrolled", manager.hasEnrollment());
            resolve(requestId, result);
        });
    }

    @JavascriptInterface
    public void enableForCurrentSession(String requestId, String inputJson) {
        runAuthorized(requestId, () -> {
            try {
                JSONObject input = new JSONObject(inputJson == null ? "{}" : inputJson);
                String expectedRole = input.optString("expectedRole", "").trim().toLowerCase(Locale.ROOT);
                if (!role.equals(expectedRole)) {
                    manager.disable();
                    resolve(requestId, failure("role_binding_mismatch", false));
                    return;
                }
                SecureSessionPayload payload = new SecureSessionPayload(
                        input.optString("refreshToken", ""),
                        input.optString("userId", ""),
                        expectedRole,
                        packageName,
                        System.currentTimeMillis()
                );
                boolean isArabic = input.optBoolean("isArabic", false);
                manager.enable(payload, isArabic, result -> resolve(requestId, result));
            } catch (Exception error) {
                manager.disable();
                resolve(requestId, failure("invalid_enable_payload", false));
            }
        });
    }

    @JavascriptInterface
    public void authenticate(String requestId, String inputJson) {
        runAuthorized(requestId, () -> {
            boolean isArabic = false;
            try {
                JSONObject input = new JSONObject(inputJson == null ? "{}" : inputJson);
                isArabic = input.optBoolean("isArabic", false);
            } catch (Exception ignored) {
                // Language is non-sensitive; fall back to English.
            }
            manager.authenticate(isArabic, result -> resolve(requestId, result));
        });
    }

    @JavascriptInterface
    public void disable(String requestId) {
        runAuthorized(requestId, () -> resolve(requestId, manager.disable()));
    }

    @JavascriptInterface
    public void cancel(String requestId) {
        runAuthorized(requestId, () -> {
            manager.cancel();
            resolve(requestId, success());
        });
    }

    private void runAuthorized(String requestId, Runnable runnable) {
        webView.post(() -> {
            if (!isAuthorizedMainFrame()) {
                resolve(requestId, failure("bridge_origin_rejected", false));
                return;
            }
            runnable.run();
        });
    }

    private boolean isAuthorizedMainFrame() {
        if (!attached) return false;
        String value = webView.getUrl();
        if (value == null) return false;
        try {
            Uri uri = Uri.parse(value);
            if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!"daynightae.com".equals(host) && !"www.daynightae.com".equals(host)) return false;
            String path = uri.getPath() == null ? "" : uri.getPath();
            String rolePrefix = "/" + role;
            return path.equals(rolePrefix) || path.startsWith(rolePrefix + "/");
        } catch (RuntimeException error) {
            return false;
        }
    }

    private void resolve(String requestId, JSONObject result) {
        String safeRequestId = JSONObject.quote(requestId == null ? "" : requestId);
        String safeResult = JSONObject.quote(result == null ? "{}" : result.toString());
        String script = "window.__dayNightBiometricNativeResolve&&window.__dayNightBiometricNativeResolve("
                + safeRequestId + "," + safeResult + ");";
        webView.post(() -> webView.evaluateJavascript(script, null));
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

    private static void put(JSONObject target, String key, Object value) {
        try {
            target.put(key, value);
        } catch (Exception ignored) {
            // Primitive values are safe here.
        }
    }
}
