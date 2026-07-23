package com.daynightae.shell;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

/**
 * Native startup watchdog for Driver and Merchant WebViews.
 *
 * The Android role route now mounts an isolated native React root, so the
 * watchdog only removes obsolete splash markup and verifies that the dedicated
 * login/loading/dashboard surface is visible. It never mutates dashboard CSS.
 */
public final class DayNightApplication extends Application {
    private static final String TAG = "DAYNIGHT_SPLASH";
    private static final long[] WATCHDOG_DELAYS_MS = {
            1200L,
            2400L,
            4200L,
            7000L,
            12000L,
            20000L,
            30000L
    };

    @Override
    public void onCreate() {
        super.onCreate();
        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            @Override
            public void onActivityResumed(Activity activity) {
                scheduleWatchdog(activity);
            }

            @Override public void onActivityCreated(Activity activity, Bundle state) {}
            @Override public void onActivityStarted(Activity activity) {}
            @Override public void onActivityPaused(Activity activity) {}
            @Override public void onActivityStopped(Activity activity) {}
            @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}
            @Override public void onActivityDestroyed(Activity activity) {}
        });
    }

    private void scheduleWatchdog(Activity activity) {
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;
        WebView webView = findWebView(activity.getWindow().getDecorView());
        if (webView == null) {
            Log.w(TAG, BuildConfig.ROLE + " schedule webview=missing");
            return;
        }

        for (int index = 0; index < WATCHDOG_DELAYS_MS.length; index += 1) {
            final int attempt = index + 1;
            final boolean force = attempt > 1;
            webView.postDelayed(() -> probeRoleSurface(webView, attempt, force), WATCHDOG_DELAYS_MS[index]);
        }
    }

    private void probeRoleSurface(WebView webView, int attempt, boolean force) {
        if (webView == null || !webView.isAttachedToWindow()) {
            Log.w(TAG, BuildConfig.ROLE + " attempt=" + attempt + " webview=detached");
            return;
        }

        String roleSelector = "driver".equals(BuildConfig.ROLE)
                ? ".dn-native-role-login,[data-native-role-loading=\"driver\"],.dn-driver-exact-shell,.dn-driver-state-card,.dn-driver-shell-v3"
                : ".dn-native-role-login,[data-native-role-loading=\"merchant\"],.dn-merchant-app,.dn-merchant-state-v3,.dn-merchant-shell-v3";

        String script = "(function(){"
                + "var boot=document.getElementById('dn-role-boot');"
                + "var root=document.getElementById('root');"
                + "var rendered=!!(root&&root.childElementCount>0);"
                + "var surface=document.querySelector(" + quoteForJavascript(roleSelector) + ");"
                + "var card=document.querySelector('.dn-native-role-login-card');"
                + "var target=card||surface;"
                + "var style=target?getComputedStyle(target):null;"
                + "var rect=target?target.getBoundingClientRect():null;"
                + "var visible=!!(target&&style&&rect"
                + "&&style.display!=='none'&&style.visibility!=='hidden'"
                + "&&Number(style.opacity||1)>0&&rect.width>2&&rect.height>2"
                + "&&rect.bottom>0&&rect.top<window.innerHeight);"
                + "var roleReady=false;"
                + "if(visible){"
                + "window.scrollTo(0,0);document.documentElement.scrollTop=0;if(document.body){document.body.scrollTop=0;}"
                + "if(target.dataset.dnNativePaintProbe==='1'){roleReady=true;}"
                + "else{target.dataset.dnNativePaintProbe='1';void target.offsetHeight;requestAnimationFrame(function(){requestAnimationFrame(function(){target.dataset.dnNativePainted='1';});});}"
                + "}"
                + "var force=" + (force ? "true" : "false") + ";"
                + "if(boot&&(rendered||force)){boot.classList.add('is-complete');boot.remove();}"
                + "return 'removed='+(!document.getElementById('dn-role-boot'))"
                + "+',rendered='+rendered"
                + "+',surface='+(!!surface)"
                + "+',card='+(!!card)"
                + "+',textLength='+(target?String(target.innerText||'').length:-1)"
                + "+',roleVisible='+visible"
                + "+',roleReady='+roleReady"
                + "+',rootChildren='+(root?root.childElementCount:-1)"
                + "+',display='+(style?style.display:'missing')"
                + "+',visibility='+(style?style.visibility:'missing')"
                + "+',opacity='+(style?style.opacity:'missing')"
                + "+',background='+(style?style.backgroundColor:'missing')"
                + "+',rect='+(rect?[Math.round(rect.left),Math.round(rect.top),Math.round(rect.width),Math.round(rect.height)].join(':'):'missing')"
                + "+',viewport='+window.innerWidth+'x'+window.innerHeight"
                + "+',ready='+document.readyState"
                + "+',href='+String(location.href);"
                + "})()";

        webView.evaluateJavascript(script, result -> {
            Log.i(TAG, BuildConfig.ROLE + " attempt=" + attempt + " force=" + force + " diagnostics=" + result);
            if (result != null && result.contains("roleReady=true")) {
                webView.requestLayout();
                webView.invalidate();
                webView.postInvalidateOnAnimation();
            }
        });
    }

    private static String quoteForJavascript(String value) {
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    private WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (!(view instanceof ViewGroup)) return null;
        ViewGroup group = (ViewGroup) view;
        for (int index = 0; index < group.getChildCount(); index += 1) {
            WebView webView = findWebView(group.getChildAt(index));
            if (webView != null) return webView;
        }
        return null;
    }
}
