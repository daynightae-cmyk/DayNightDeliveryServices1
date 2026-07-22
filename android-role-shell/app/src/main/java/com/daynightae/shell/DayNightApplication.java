package com.daynightae.shell;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

/**
 * Native fail-safe for the live Driver and Merchant WebViews.
 *
 * The role splash is a web layer and must never be allowed to cover a loaded
 * login/dashboard indefinitely. Android schedules these checks independently
 * from JavaScript timers, requestAnimationFrame, service workers, and cached
 * page state.
 */
public final class DayNightApplication extends Application {
    private static final String TAG = "DAYNIGHT_SPLASH";
    private static final long[] WATCHDOG_DELAYS_MS = {1800L, 3500L, 6500L};
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            @Override
            public void onActivityResumed(Activity activity) {
                scheduleSplashWatchdog(activity);
            }

            @Override public void onActivityCreated(Activity activity, Bundle state) {}
            @Override public void onActivityStarted(Activity activity) {}
            @Override public void onActivityPaused(Activity activity) {}
            @Override public void onActivityStopped(Activity activity) {}
            @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}
            @Override public void onActivityDestroyed(Activity activity) {}
        });
    }

    private void scheduleSplashWatchdog(Activity activity) {
        for (int index = 0; index < WATCHDOG_DELAYS_MS.length; index += 1) {
            final int attempt = index + 1;
            final boolean force = attempt > 1;
            mainHandler.postDelayed(
                    () -> removeRoleSplash(activity, attempt, force),
                    WATCHDOG_DELAYS_MS[index]
            );
        }
    }

    private void removeRoleSplash(Activity activity, int attempt, boolean force) {
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            return;
        }

        WebView webView = findWebView(activity.getWindow().getDecorView());
        if (webView == null) {
            Log.w(TAG, BuildConfig.ROLE + " attempt=" + attempt + " webview=missing");
            return;
        }

        String script = "(function(){"
                + "var boot=document.getElementById('dn-role-boot');"
                + "var root=document.getElementById('root');"
                + "var rendered=!!(root&&root.childElementCount>0);"
                + "var force=" + (force ? "true" : "false") + ";"
                + "if(boot&&(rendered||force)){boot.classList.add('is-complete');boot.remove();}"
                + "return !document.getElementById('dn-role-boot');"
                + "})()";

        webView.evaluateJavascript(script, result -> Log.i(
                TAG,
                BuildConfig.ROLE + " attempt=" + attempt + " force=" + force + " result=" + result
        ));
    }

    private WebView findWebView(View view) {
        if (view instanceof WebView) {
            return (WebView) view;
        }
        if (!(view instanceof ViewGroup)) {
            return null;
        }

        ViewGroup group = (ViewGroup) view;
        for (int index = 0; index < group.getChildCount(); index += 1) {
            WebView webView = findWebView(group.getChildAt(index));
            if (webView != null) {
                return webView;
            }
        }
        return null;
    }
}
