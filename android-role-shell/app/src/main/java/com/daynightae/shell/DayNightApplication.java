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
 * Driver credentials use a software layer because the deployed glass login
 * card can exist in the DOM yet fail GPU composition on Android WebView. Once
 * the authenticated workspace or map appears, hardware acceleration is
 * restored for smooth Leaflet navigation and vehicle animation.
 */
public final class DayNightApplication extends Application {
    private static final String TAG = "DAYNIGHT_SPLASH";
    private static final int MAX_WATCHDOG_ATTEMPTS = 40;
    private static final long FIRST_WATCHDOG_DELAY_MS = 700L;
    private static final long NEXT_WATCHDOG_DELAY_MS = 1500L;

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
        if ("driver".equals(BuildConfig.ROLE)) {
            webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        }
        webView.postDelayed(() -> probeRoleSurface(webView, 1, false), FIRST_WATCHDOG_DELAY_MS);
    }

    private void probeRoleSurface(WebView webView, int attempt, boolean force) {
        if (webView == null || !webView.isAttachedToWindow()) {
            Log.w(TAG, BuildConfig.ROLE + " attempt=" + attempt + " webview=detached");
            return;
        }

        String roleSelector = "driver".equals(BuildConfig.ROLE)
                ? ".dn-native-role-login,[data-native-role-loading=\"driver\"],.dn-driver-login-page,.dn-driver-auth-card,.dn-portal-auth-card,.dn-driver-loading-card,.dn-driver-exact-shell,.dn-driver-state-card,.dn-driver-shell-v3,[data-driver-runtime-acceptance=\"ready\"]"
                : ".dn-native-role-login,[data-native-role-loading=\"merchant\"],.dn-merchant-app,.dn-merchant-state-v3,.dn-merchant-shell-v3";

        String driverAuthCss = "html[data-native-shell=driver] .dn-driver-login-page,body[data-native-role=driver] .dn-driver-login-page{"
                + "display:block!important;position:relative!important;inset:auto!important;transform:none!important;"
                + "width:100%!important;max-width:none!important;min-height:100dvh!important;height:auto!important;"
                + "margin:0!important;padding:12px!important;overflow:visible!important;background:#f7f5ea!important;"
                + "filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}"
                + "html[data-native-shell=driver] .dn-driver-login-page .dn-portal-auth-shell,body[data-native-role=driver] .dn-driver-login-page .dn-portal-auth-shell{"
                + "display:block!important;position:relative!important;inset:auto!important;transform:none!important;"
                + "width:100%!important;max-width:560px!important;min-height:0!important;height:auto!important;"
                + "margin:0 auto!important;padding:0!important;overflow:visible!important;contain:none!important;isolation:auto!important;}"
                + "html[data-native-shell=driver] .dn-driver-login-page .dn-portal-auth-visual,body[data-native-role=driver] .dn-driver-login-page .dn-portal-auth-visual{display:none!important;}"
                + "html[data-native-shell=driver] .dn-driver-login-page .dn-driver-auth-card,"
                + "html[data-native-shell=driver] .dn-driver-login-page .dn-portal-auth-card,"
                + "body[data-native-role=driver] .dn-driver-login-page .dn-driver-auth-card,"
                + "body[data-native-role=driver] .dn-driver-login-page .dn-portal-auth-card{"
                + "display:block!important;position:relative!important;inset:auto!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;"
                + "transform:none!important;translate:none!important;opacity:1!important;visibility:visible!important;animation:none!important;"
                + "filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;mix-blend-mode:normal!important;contain:none!important;will-change:auto!important;"
                + "width:100%!important;max-width:520px!important;min-width:0!important;min-height:0!important;height:auto!important;"
                + "margin:0 auto!important;padding:24px 18px!important;overflow:visible!important;"
                + "border-radius:24px!important;background:#fff!important;color:#071a33!important;z-index:10!important;}"
                + "html[data-native-shell=driver] .dn-driver-login-page .dn-driver-auth-card *,"
                + "html[data-native-shell=driver] .dn-driver-login-page .dn-portal-auth-card *,"
                + "body[data-native-role=driver] .dn-driver-login-page .dn-driver-auth-card *,"
                + "body[data-native-role=driver] .dn-driver-login-page .dn-portal-auth-card *{"
                + "opacity:1!important;visibility:visible!important;transform:none!important;animation:none!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}"
                + "html[data-native-shell=driver] .dn-driver-login-page input,body[data-native-role=driver] .dn-driver-login-page input{"
                + "display:block!important;width:100%!important;min-height:50px!important;background:#fff!important;color:#071a33!important;border:1px solid #b8c4d2!important;}"
                + "html[data-native-shell=driver] .dn-driver-login-page button,body[data-native-role=driver] .dn-driver-login-page button{min-height:48px!important;}";

        String driverCompatibility = "driver".equals(BuildConfig.ROLE)
                ? "var fix=document.getElementById('dn-driver-public-auth-fix');"
                    + "if(!fix){fix=document.createElement('style');fix.id='dn-driver-public-auth-fix';document.head.appendChild(fix);}"
                    + "fix.textContent=" + quoteForJavascript(driverAuthCss) + ";"
                    + "var login=document.querySelector('.dn-driver-login-page');"
                    + "if(login){window.scrollTo(0,0);document.documentElement.scrollTop=0;if(document.body){document.body.scrollTop=0;}}"
                : "";

        String script = "(function(){"
                + driverCompatibility
                + "var boot=document.getElementById('dn-role-boot');"
                + "var root=document.getElementById('root');"
                + "var rendered=!!(root&&root.childElementCount>0);"
                + "var surface=document.querySelector(" + quoteForJavascript(roleSelector) + ");"
                + "var card=document.querySelector('.dn-native-role-login-card,.dn-driver-auth-card,.dn-portal-auth-card');"
                + "var dashboard=document.querySelector('.dn-driver-exact-shell,.dn-driver-shell-v3,.dn-driver-state-card');"
                + "var runtime=document.querySelector('[data-driver-runtime-acceptance=\"ready\"]');"
                + "var map=document.querySelector('[data-driver-map-ready]');"
                + "var vehicle=document.querySelector('[data-driver-vehicle-ready=\"true\"],.dn-official-vehicle-leaflet-icon');"
                + "var target=card||dashboard||surface||runtime;"
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
                + "+',dashboard='+(!!dashboard)"
                + "+',runtime='+(!!runtime)"
                + "+',map='+(!!map)"
                + "+',vehicle='+(!!vehicle)"
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
            boolean credentialReady = result != null
                    && result.contains("card=true")
                    && result.contains("roleVisible=true")
                    && result.contains("roleReady=true");
            boolean dashboardReady = result != null
                    && (result.contains("dashboard=true") || result.contains("runtime=true") || result.contains("map=true"))
                    && !result.contains("card=true");
            if (dashboardReady && "driver".equals(BuildConfig.ROLE)) {
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            } else if (credentialReady && "driver".equals(BuildConfig.ROLE)) {
                webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            }
            if (credentialReady || dashboardReady) {
                webView.requestLayout();
                webView.invalidate();
                webView.postInvalidateOnAnimation();
                return;
            }
            if (attempt < MAX_WATCHDOG_ATTEMPTS && webView.isAttachedToWindow()) {
                webView.postDelayed(() -> probeRoleSurface(webView, attempt + 1, true), NEXT_WATCHDOG_DELAY_MS);
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
