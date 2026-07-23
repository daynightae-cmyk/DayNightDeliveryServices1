package com.daynightae.shell;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;

/**
 * CI-only visual harness for the `visual` build type.
 * Production debug/release artifacts never include or launch this Activity.
 */
public final class VisualTestActivity extends Activity {
    private static final String TAG = "DAYNIGHT_VISUAL";
    private static final int MAX_PROBE_ATTEMPTS = 60;
    private WebView webView;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 26, 51));
        getWindow().setNavigationBarColor(Color.rgb(7, 26, 51));
        getWindow().getDecorView().setBackgroundColor(Color.rgb(7, 26, 51));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 26, 51));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setAlpha(1f);
        webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setTextZoom(100);
        settings.setSupportMultipleWindows(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                Log.i(
                        "DAYNIGHT_CONSOLE",
                        BuildConfig.ROLE + " " + message.messageLevel() + " "
                                + message.sourceId() + ":" + message.lineNumber() + " " + message.message()
                );
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                settleCompositor(view);
                scheduleRoleProbe(view, 1, "commit", url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                settleCompositor(view);
                scheduleRoleProbe(view, 1, "finished", url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showFailure(error == null ? "unknown" : String.valueOf(error.getErrorCode()));
                }
            }
        });

        Log.i(TAG, BuildConfig.ROLE + " start=" + BuildConfig.START_URL + " layer=software");
        webView.loadUrl(BuildConfig.START_URL);
    }

    private void settleCompositor(WebView view) {
        if (view == null) return;
        view.setAlpha(1f);
        view.requestLayout();
        view.invalidate();
        view.postInvalidateOnAnimation();
    }

    private void scheduleRoleProbe(WebView view, int attempt, String phase, String url) {
        if (view == null || !view.isAttachedToWindow()) return;

        String script = "(function(){"
                + "var root=document.getElementById('root');"
                + "var driverRuntime=document.querySelector('[data-driver-runtime-acceptance=\"ready\"],.dn-driver-exact-shell');"
                + "var driverLogin=document.querySelector('.dn-driver-login-page,.dn-native-role-login--driver');"
                + "var merchantLogin=document.querySelector('.dn-merchant-login-v3,.dn-native-role-login--merchant');"
                + "var merchantApp=document.querySelector('.dn-merchant-app[data-merchant-authenticated=\"true\"]');"
                + "var card=document.querySelector('.dn-driver-auth-card,.dn-portal-auth-card,.dn-merchant-login-card-v3,.dn-native-role-login-card');"
                + "var map=document.querySelector('[data-driver-map-ready]');"
                + "var vehicle=document.querySelector('[data-driver-vehicle-ready=\"true\"],.dn-official-vehicle-leaflet-icon');"
                + "var role=" + quote(BuildConfig.ROLE) + ";"
                + "var target=role==='driver'?(driverRuntime||driverLogin||card):(merchantApp||merchantLogin||card);"
                + "var style=target?getComputedStyle(target):null;"
                + "var rect=target?target.getBoundingClientRect():null;"
                + "var visible=!!(target&&style&&rect&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>0&&rect.width>2&&rect.height>2&&rect.bottom>0&&rect.top<window.innerHeight);"
                + "var roleReady=role==='driver'?!!(visible&&((driverRuntime&&map&&vehicle)||driverLogin)):!!(visible&&(merchantApp||merchantLogin));"
                + "return JSON.stringify({"
                + "ready:document.readyState,"
                + "boot:!!document.getElementById('dn-role-boot'),"
                + "rootChildren:root?root.childElementCount:-1,"
                + "driverRuntime:!!driverRuntime,driverLogin:!!driverLogin,merchantLogin:!!merchantLogin,merchantApp:!!merchantApp,card:!!card,map:!!map,vehicle:!!vehicle,"
                + "visible:visible,roleReady:roleReady,"
                + "rect:rect?[Math.round(rect.left),Math.round(rect.top),Math.round(rect.width),Math.round(rect.height)].join(':'):'missing',"
                + "textLength:target?String(target.innerText||'').length:-1,href:String(location.href)"
                + "});"
                + "})()";

        view.evaluateJavascript(script, result -> {
            Log.i(TAG, BuildConfig.ROLE + " attempt=" + attempt + " phase=" + phase + " url=" + url + " diagnostics=" + result);
            boolean ready = result != null && result.contains("\\\"roleReady\\\":true");
            if (ready) {
                settleCompositor(view);
                return;
            }
            if (attempt < MAX_PROBE_ATTEMPTS && view.isAttachedToWindow()) {
                view.postDelayed(() -> scheduleRoleProbe(view, attempt + 1, phase, url), 1000L);
            }
        });
    }

    private static String quote(String value) {
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    private void showFailure(String code) {
        TextView message = new TextView(this);
        message.setBackgroundColor(Color.rgb(7, 26, 51));
        message.setTextColor(Color.WHITE);
        message.setGravity(android.view.Gravity.CENTER);
        message.setTextSize(18);
        message.setPadding(36, 36, 36, 36);
        message.setText("DAY NIGHT visual build could not load\n" + BuildConfig.START_URL + "\n" + code);
        setContentView(message);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
