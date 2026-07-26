package com.daynightae.shell;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebBackForwardList;
import android.webkit.WebChromeClient;
import android.webkit.WebHistoryItem;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.fragment.app.FragmentActivity;

import com.daynightae.shell.security.BiometricSessionManager;
import com.daynightae.shell.security.DayNightBiometricBridge;

import org.json.JSONObject;

import java.util.Locale;

/**
 * Thin, role-isolated Android host for the real DAY NIGHT React application.
 * Authentication remains owned by Supabase. Native biometrics only decrypt a
 * role- and package-bound refresh token after a successful system prompt.
 */
public final class MainActivity extends FragmentActivity {
    private static final int LOCATION_PERMISSION_REQUEST = 4001;
    private static final int FILE_CHOOSER_REQUEST = 4002;
    private static final String WEB_CACHE_PREFERENCES = "daynight_web_cache";
    private static final String WEB_CACHE_VERSION_KEY = "version_name";
    private static final String OFFLINE_BRIDGE_NAME = "DAYNIGHT";
    private static final String BIOMETRIC_BRIDGE_NAME = "DAYNIGHT_BIOMETRIC";

    private WebView webView;
    private ProgressBar loadingIndicator;
    private ValueCallback<Uri[]> fileChooserCallback;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private boolean offlineVisible;
    private boolean biometricBridgeAttached;
    private long backgroundedAt;
    private BiometricSessionManager biometricSessionManager;
    private DayNightBiometricBridge biometricBridge;

    @Override
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(7, 26, 51));
        window.setNavigationBarColor(Color.rgb(7, 26, 51));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7, 26, 51));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(
                webView,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );

        loadingIndicator = new ProgressBar(this);
        loadingIndicator.setIndeterminate(true);
        FrameLayout.LayoutParams loadingLayout = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        loadingLayout.gravity = Gravity.CENTER;
        root.addView(loadingIndicator, loadingLayout);
        setContentView(root);

        biometricSessionManager = new BiometricSessionManager(
                this,
                BuildConfig.ROLE,
                BuildConfig.BIOMETRIC_KEY_ALIAS,
                BuildConfig.BIOMETRIC_MAX_AGE_SECONDS
        );
        biometricBridge = new DayNightBiometricBridge(
                webView,
                biometricSessionManager,
                BuildConfig.ROLE,
                getPackageName()
        );

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        configureWebView();
        clearWebCacheAfterUpgrade();

        if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null) {
            syncBiometricBridge(webView.getUrl());
            hideLoadingIndicator();
            return;
        }
        openStartRoute();
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setUserAgentString(settings.getUserAgentString() + " DAYNIGHT/1.2 " + BuildConfig.ROLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new OfflineBridge(), OFFLINE_BRIDGE_NAME);
        syncBiometricBridge(BuildConfig.START_URL);
        webView.setWebViewClient(new RoleWebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                requestLocationForWebsite(origin, callback);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Camera/microphone WebRTC stays denied. Normal file/camera upload
                // continues through the system file chooser below.
                request.deny();
            }

            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> uploadCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = uploadCallback;
                try {
                    Intent chooser = fileChooserParams.createIntent();
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileChooserCallback = null;
                    Toast.makeText(
                            MainActivity.this,
                            isArabic() ? "لا يوجد تطبيق لاختيار الملف." : "No file picker is available.",
                            Toast.LENGTH_LONG
                    ).show();
                    return false;
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (ActivityNotFoundException error) {
                Toast.makeText(
                        this,
                        isArabic() ? "تعذر فتح ملف التنزيل." : "Unable to open this download.",
                        Toast.LENGTH_LONG
                ).show();
            }
        });
    }

    private final class RoleWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleNavigation(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleNavigation(Uri.parse(url));
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            syncBiometricBridge(url);
            if (!offlineVisible) {
                showLoadingIndicator();
            }
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            super.onPageCommitVisible(view, url);
            syncBiometricBridge(url);
            if (!offlineVisible) {
                injectNativeRoleShell();
                hideLoadingIndicator();
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            syncBiometricBridge(url);
            if (offlineVisible) {
                hideLoadingIndicator();
                return;
            }

            Uri uri = safeUri(url);
            if (uri != null && isOfficialHost(uri.getHost()) && !isRolePath(uri.getPath())) {
                openStartRoute();
                return;
            }
            injectNativeRoleShell();
            hideLoadingIndicator();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request.isForMainFrame()) {
                showOfflinePage(error == null ? "network_error" : String.valueOf(error.getErrorCode()));
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request.isForMainFrame() && errorResponse != null && errorResponse.getStatusCode() >= 500) {
                showOfflinePage("http_" + errorResponse.getStatusCode());
            }
        }
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) {
            return true;
        }
        String scheme = lower(uri.getScheme());
        if ("about".equals(scheme) || "data".equals(scheme) || "blob".equals(scheme)) {
            return false;
        }
        if ("tel".equals(scheme) || "mailto".equals(scheme) || "sms".equals(scheme)
                || "geo".equals(scheme) || "market".equals(scheme)) {
            openExternal(uri);
            return true;
        }
        if (!"https".equals(scheme)) {
            return true;
        }

        String host = lower(uri.getHost());
        if (isOfficialHost(host)) {
            if (isRolePath(uri.getPath())) {
                return false;
            }
            openStartRoute();
            return true;
        }
        if (host.endsWith(".supabase.co")) {
            // OAuth callbacks may load Supabase pages. The biometric interface is
            // detached by onPageStarted before those documents execute.
            return false;
        }

        openExternal(uri);
        return true;
    }

    private void requestLocationForWebsite(String origin, GeolocationPermissions.Callback callback) {
        if (hasLocationPermission()) {
            callback.invoke(origin, true, false);
            return;
        }

        pendingGeoOrigin = origin;
        pendingGeoCallback = callback;

        new AlertDialog.Builder(this)
                .setTitle(isArabic() ? "السماح بالموقع" : "Allow location")
                .setMessage(isArabic()
                        ? "يحتاج تطبيق داي نايت إلى موقع الهاتف لبدء المهمة وعرض الملاحة الحية داخل التطبيق."
                        : "DAY NIGHT needs the phone location to start missions and show live in-app navigation.")
                .setPositiveButton(isArabic() ? "متابعة" : "Continue", (dialog, which) ->
                        requestPermissions(
                                new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                                LOCATION_PERMISSION_REQUEST
                        ))
                .setNegativeButton(isArabic() ? "ليس الآن" : "Not now", (dialog, which) -> denyPendingLocation())
                .setOnCancelListener(dialog -> denyPendingLocation())
                .show();
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void denyPendingLocation() {
        if (pendingGeoCallback != null && pendingGeoOrigin != null) {
            pendingGeoCallback.invoke(pendingGeoOrigin, false, false);
        }
        pendingGeoCallback = null;
        pendingGeoOrigin = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != LOCATION_PERMISSION_REQUEST) {
            return;
        }

        boolean granted = hasLocationPermission();
        if (pendingGeoCallback != null && pendingGeoOrigin != null) {
            pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
        }
        pendingGeoCallback = null;
        pendingGeoOrigin = null;

        if (!granted) {
            Toast.makeText(
                    this,
                    isArabic()
                            ? "تم رفض الموقع. يمكن تفعيله لاحقًا من إعدادات التطبيق."
                            : "Location was denied. You can enable it later in app settings.",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileChooserCallback != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileChooserCallback.onReceiveValue(result);
            fileChooserCallback = null;
        }
    }

    private void openStartRoute() {
        offlineVisible = false;
        showLoadingIndicator();
        if (!hasInternetTransport()) {
            showOfflinePage("offline");
            return;
        }
        syncBiometricBridge(BuildConfig.START_URL);
        webView.loadUrl(BuildConfig.START_URL);
    }

    private void showOfflinePage(String reason) {
        if (offlineVisible) {
            return;
        }
        offlineVisible = true;
        syncBiometricBridge(null);
        hideLoadingIndicator();
        String title = isArabic() ? "لا يوجد اتصال بالإنترنت" : "No internet connection";
        String body = isArabic()
                ? "تحقق من الشبكة ثم اضغط إعادة المحاولة. ستظل جلسة حسابك المشفرة محفوظة داخل التطبيق."
                : "Check your connection, then retry. Your encrypted account session remains stored in the app.";
        String retry = isArabic() ? "إعادة المحاولة" : "Retry";
        String html = "<!doctype html><html lang=\"" + (isArabic() ? "ar" : "en") + "\" dir=\""
                + (isArabic() ? "rtl" : "ltr") + "\"><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><style>"
                + "*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#071a33;color:#fff;font-family:Arial,sans-serif}"
                + "body{display:grid;place-items:center;min-height:100dvh;padding:calc(24px + env(safe-area-inset-top)) 22px calc(24px + env(safe-area-inset-bottom))}"
                + ".card{width:min(100%,480px);padding:28px;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:linear-gradient(145deg,#0b2544,#071a33);box-shadow:0 24px 70px rgba(0,0,0,.32);text-align:center}"
                + ".mark{width:76px;height:76px;margin:0 auto 18px;border:3px solid #d4af37;border-radius:50%;display:grid;place-items:center;color:#d4af37;font-size:28px;font-weight:900}"
                + "h1{font-size:24px;margin:0 0 12px}p{color:#c8d6e7;line-height:1.8;margin:0 0 22px}button{min-height:48px;border:0;border-radius:14px;padding:0 24px;background:#d4af37;color:#071a33;font-size:16px;font-weight:900;cursor:pointer}small{display:block;margin-top:18px;color:#6f86a1;overflow-wrap:anywhere}"
                + "</style></head><body><main class=\"card\"><div class=\"mark\">DN</div><h1>" + title + "</h1><p>" + body
                + "</p><button onclick=\"DAYNIGHT.retry()\">" + retry + "</button><small>" + BuildConfig.ROLE + " · " + reason
                + "</small></main></body></html>";
        webView.loadDataWithBaseURL("https://offline.daynight.invalid/", html, "text/html", "UTF-8", null);
    }

    @SuppressLint("AddJavascriptInterface")
    private void syncBiometricBridge(String value) {
        boolean shouldAttach = isRoleUrl(value);
        if (shouldAttach && !biometricBridgeAttached) {
            webView.addJavascriptInterface(biometricBridge, BIOMETRIC_BRIDGE_NAME);
            biometricBridgeAttached = true;
        } else if (!shouldAttach && biometricBridgeAttached) {
            biometricBridge.setAttached(false);
            webView.removeJavascriptInterface(BIOMETRIC_BRIDGE_NAME);
            biometricBridgeAttached = false;
        }
        biometricBridge.setAttached(shouldAttach && biometricBridgeAttached);
    }

    private void injectNativeRoleShell() {
        String css = "html,body,#root{width:100%!important;min-height:100%!important;min-height:100dvh!important;overflow-x:hidden!important;}"
                + "html,body{margin:0!important;padding:0!important;overscroll-behavior-y:none!important;-webkit-text-size-adjust:100%;}"
                + "#root>div{width:100%!important;max-width:none!important;min-height:100dvh!important;margin:0!important;justify-content:flex-start!important;}"
                + ".dn-official-shell-frame{display:none!important;}"
                + "#root>div>[aria-hidden=\"true\"]{display:none!important;}"
                + "#root>div>main{display:block!important;width:100%!important;max-width:none!important;min-height:100dvh!important;margin:0!important;padding:0!important;overflow:visible!important;}"
                + "#root>div>main~*,#root>div>footer{display:none!important;}"
                + "input,select,textarea{font-size:16px!important;}"
                + "button,a,input,select,textarea{touch-action:manipulation;}";

        String script = "(function(){try{"
                + "var role=" + JSONObject.quote(BuildConfig.ROLE) + ";"
                + "window.__DAY_NIGHT_NATIVE_ROLE__=role;document.documentElement.setAttribute('data-native-shell',role);"
                + "var style=document.getElementById('dn-native-shell-style');if(!style){style=document.createElement('style');style.id='dn-native-shell-style';document.head.appendChild(style);}"
                + "style.textContent=" + JSONObject.quote(css) + ";"
                + "document.body&&document.body.setAttribute('data-native-role',role);"
                + "if(window.DAYNIGHT_BIOMETRIC){window.dispatchEvent(new CustomEvent('daynight-biometric-bridge-ready',{detail:{role:role}}));}"
                + "}catch(error){console.error('DAY_NIGHT_NATIVE_SHELL',error);}})();";
        webView.evaluateJavascript(script, null);
    }

    private void clearWebCacheAfterUpgrade() {
        SharedPreferences preferences = getSharedPreferences(WEB_CACHE_PREFERENCES, MODE_PRIVATE);
        String previousVersion = preferences.getString(WEB_CACHE_VERSION_KEY, "");
        if (!BuildConfig.VERSION_NAME.equals(previousVersion)) {
            webView.clearCache(true);
            preferences.edit().putString(WEB_CACHE_VERSION_KEY, BuildConfig.VERSION_NAME).apply();
        }
    }

    private void showLoadingIndicator() {
        if (loadingIndicator != null) {
            loadingIndicator.setVisibility(View.VISIBLE);
            loadingIndicator.bringToFront();
        }
    }

    private void hideLoadingIndicator() {
        if (loadingIndicator != null) {
            loadingIndicator.setVisibility(View.GONE);
        }
    }

    private boolean hasInternetTransport() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager == null) {
            return true;
        }
        Network network = manager.getActiveNetwork();
        if (network == null) {
            return false;
        }
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
        return capabilities != null
                && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private boolean isOfficialHost(String host) {
        String normalized = lower(host);
        return "daynightae.com".equals(normalized) || "www.daynightae.com".equals(normalized);
    }

    private boolean isRolePath(String path) {
        if (path == null) {
            return false;
        }
        String prefix = "/" + BuildConfig.ROLE;
        return path.equals(prefix) || path.startsWith(prefix + "/");
    }

    private boolean isRoleUrl(String value) {
        Uri uri = safeUri(value);
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && isOfficialHost(uri.getHost())
                && isRolePath(uri.getPath());
    }

    private void openExternal(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (ActivityNotFoundException error) {
            Toast.makeText(
                    this,
                    isArabic() ? "لا يوجد تطبيق مناسب لفتح الرابط." : "No application can open this link.",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private static Uri safeUri(String value) {
        try {
            return value == null ? null : Uri.parse(value);
        } catch (RuntimeException error) {
            return null;
        }
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private boolean isArabic() {
        return "ar".equalsIgnoreCase(Locale.getDefault().getLanguage());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Uri data = intent == null ? null : intent.getData();
        if (data != null && isOfficialHost(data.getHost()) && isRolePath(data.getPath())) {
            syncBiometricBridge(data.toString());
            webView.loadUrl(data.toString());
        } else {
            openStartRoute();
        }
    }

    @Override
    public void onBackPressed() {
        WebBackForwardList history = webView.copyBackForwardList();
        int previousIndex = history.getCurrentIndex() - 1;
        if (previousIndex >= 0) {
            WebHistoryItem previous = history.getItemAtIndex(previousIndex);
            if (previous != null && isRoleUrl(previous.getUrl())) {
                webView.goBack();
                return;
            }
        }
        moveTaskToBack(true);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        if (offlineVisible && hasInternetTransport()) {
            openStartRoute();
            return;
        }
        if (backgroundedAt > 0L && isRoleUrl(webView.getUrl())) {
            long backgroundMs = Math.max(0L, System.currentTimeMillis() - backgroundedAt);
            String script = "window.dispatchEvent(new CustomEvent('daynight-native-resume',{detail:{backgroundMs:"
                    + backgroundMs + "}}));";
            webView.evaluateJavascript(script, null);
        }
        backgroundedAt = 0L;
    }

    @Override
    protected void onPause() {
        backgroundedAt = System.currentTimeMillis();
        webView.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        denyPendingLocation();
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (biometricSessionManager != null) {
            biometricSessionManager.cancel();
        }
        if (biometricBridge != null) {
            biometricBridge.setAttached(false);
        }
        webView.removeJavascriptInterface(BIOMETRIC_BRIDGE_NAME);
        webView.removeJavascriptInterface(OFFLINE_BRIDGE_NAME);
        webView.stopLoading();
        webView.setWebChromeClient(null);
        webView.setWebViewClient(null);
        webView.destroy();
        super.onDestroy();
    }

    public final class OfflineBridge {
        @JavascriptInterface
        public void retry() {
            runOnUiThread(MainActivity.this::openStartRoute);
        }

        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            });
        }
    }
}
