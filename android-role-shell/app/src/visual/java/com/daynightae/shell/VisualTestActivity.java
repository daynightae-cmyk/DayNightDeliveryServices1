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
 *
 * Production debug/release artifacts never include or launch this Activity.
 * It intentionally accepts the GitHub runner's local HTTP Vite server so the
 * exact pull-request build can be inspected inside Android WebView before the
 * production HTTPS deployment exists.
 */
public final class VisualTestActivity extends Activity {
    private static final String TAG = "DAYNIGHT_VISUAL";
    private WebView webView;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 26, 51));
        getWindow().setNavigationBarColor(Color.rgb(7, 26, 51));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 26, 51));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
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
                logDomState(view, "commit", url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                logDomState(view, "finished", url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showFailure(error == null ? "unknown" : String.valueOf(error.getErrorCode()));
                }
            }
        });

        Log.i(TAG, BuildConfig.ROLE + " start=" + BuildConfig.START_URL);
        webView.loadUrl(BuildConfig.START_URL);
    }

    private void logDomState(WebView view, String phase, String url) {
        String script = "(function(){"
                + "var root=document.getElementById('root');"
                + "return JSON.stringify({"
                + "ready:document.readyState,"
                + "boot:!!document.getElementById('dn-role-boot'),"
                + "rootChildren:root?root.childElementCount:-1,"
                + "bodyChildren:document.body?document.body.childElementCount:-1,"
                + "scripts:Array.from(document.scripts||[]).map(function(s){return s.src||'inline';})"
                + "});"
                + "})()";
        view.evaluateJavascript(script, result -> Log.i(
                TAG,
                BuildConfig.ROLE + " phase=" + phase + " url=" + url + " diagnostics=" + result
        ));
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
