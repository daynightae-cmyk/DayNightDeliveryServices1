package com.daynightae.shell;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

/**
 * Native fail-safe for the live Driver and Merchant WebViews.
 *
 * Android removes obsolete web splash layers and applies a final inline mobile
 * authentication layout. Inline important declarations deliberately outrank
 * legacy site styles, so a Driver/Merchant credential card cannot be positioned
 * below the visible phone or tablet viewport.
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
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            return;
        }

        WebView webView = findWebView(activity.getWindow().getDecorView());
        if (webView == null) {
            Log.w(TAG, BuildConfig.ROLE + " schedule webview=missing");
            return;
        }

        for (int index = 0; index < WATCHDOG_DELAYS_MS.length; index += 1) {
            final int attempt = index + 1;
            final boolean force = attempt > 1;
            webView.postDelayed(
                    () -> stabilizeRoleSurface(webView, attempt, force),
                    WATCHDOG_DELAYS_MS[index]
            );
        }
    }

    private void stabilizeRoleSurface(WebView webView, int attempt, boolean force) {
        if (webView == null || !webView.isAttachedToWindow()) {
            Log.w(TAG, BuildConfig.ROLE + " attempt=" + attempt + " webview=detached");
            return;
        }

        boolean driverRole = "driver".equals(BuildConfig.ROLE);
        String roleSelector = driverRole
                ? ".dn-driver-login-page,.dn-driver-exact-shell,.dn-driver-state-card"
                : ".dn-merchant-login-v3,.dn-merchant-app,.dn-merchant-state-v3";
        String loginSelector = driverRole ? ".dn-driver-login-page" : ".dn-merchant-login-v3";
        String cardSelector = driverRole ? ".dn-driver-auth-card" : ".dn-merchant-login-card-v3";
        String visualSelector = driverRole ? ".dn-driver-auth-visual" : ".dn-merchant-login-visual-v3";
        String shellSelector = driverRole ? ".dn-portal-auth-shell" : "";

        String script = "(function(){"
                + "function forceStyle(element,name,value){if(element){element.style.setProperty(name,value,'important');}}"
                + "function forceMany(element,values){if(!element)return;Object.keys(values).forEach(function(name){forceStyle(element,name,values[name]);});}"
                + "var boot=document.getElementById('dn-role-boot');"
                + "var root=document.getElementById('root');"
                + "var rendered=!!(root&&root.childElementCount>0);"
                + "var login=document.querySelector(" + quoteForJavascript(loginSelector) + ");"
                + "var surface=document.querySelector(" + quoteForJavascript(roleSelector) + ");"
                + "var card=login?login.querySelector(" + quoteForJavascript(cardSelector) + "):null;"
                + "var visual=login?login.querySelector(" + quoteForJavascript(visualSelector) + "):null;"
                + "var shell=" + (driverRole ? "(login?login.querySelector(" + quoteForJavascript(shellSelector) + "):null)" : "null") + ";"
                + "if(login){"
                + "forceMany(document.documentElement,{width:'100%',minWidth:'0',minHeight:'100%',overflowX:'hidden'});"
                + "forceMany(document.body,{width:'100%',minWidth:'0',minHeight:'100%',margin:'0',padding:'0',overflowX:'hidden'});"
                + "forceMany(login,{position:'fixed',inset:'0',top:'0',right:'0',bottom:'0',left:'0',zIndex:'2147483000',display:'block',width:'100vw',minWidth:'0',maxWidth:'none',height:'100dvh',minHeight:'100dvh',margin:'0',padding:'10px',overflowX:'hidden',overflowY:'auto',transform:'none',translate:'none',filter:'none',opacity:'1',visibility:'visible',contentVisibility:'visible',clip:'auto',clipPath:'none',scrollBehavior:'auto'});"
                + "if(shell){forceMany(shell,{position:'static',display:'block',width:'100%',minWidth:'0',maxWidth:'none',height:'auto',minHeight:'0',margin:'0',padding:'0',overflow:'visible',transform:'none',translate:'none'});}"
                + "if(visual){forceStyle(visual,'display','none');}"
                + "if(card){forceMany(card,{position:'relative',inset:'auto',top:'auto',right:'auto',bottom:'auto',left:'auto',zIndex:'2',display:'flex',flexDirection:'column',justifyContent:'flex-start',alignSelf:'auto',justifySelf:'auto',width:'100%',minWidth:'0',maxWidth:'560px',height:'auto',minHeight:'0',maxHeight:'none',margin:'0 auto',padding:'22px 17px 20px',overflow:'visible',transform:'none',translate:'none',filter:'none',opacity:'1',visibility:'visible',contentVisibility:'visible',clip:'auto',clipPath:'none',borderRadius:'24px'});}"
                + "}"
                + "var target=card||surface;"
                + "var style=target?getComputedStyle(target):null;"
                + "var rect=target?target.getBoundingClientRect():null;"
                + "var visible=!!(target&&style&&rect&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>0&&rect.width>2&&rect.height>2&&rect.bottom>0&&rect.top<window.innerHeight);"
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
                + "+',login='+(!!login)"
                + "+',card='+(!!card)"
                + "+',roleVisible='+visible"
                + "+',roleReady='+roleReady"
                + "+',rootChildren='+(root?root.childElementCount:-1)"
                + "+',display='+(style?style.display:'missing')"
                + "+',visibility='+(style?style.visibility:'missing')"
                + "+',opacity='+(style?style.opacity:'missing')"
                + "+',rect='+(rect?[Math.round(rect.left),Math.round(rect.top),Math.round(rect.width),Math.round(rect.height)].join(':'):'missing')"
                + "+',viewport='+window.innerWidth+'x'+window.innerHeight"
                + "+',ready='+document.readyState"
                + "+',href='+String(location.href);"
                + "})()";

        webView.evaluateJavascript(script, result -> {
            Log.i(
                    TAG,
                    BuildConfig.ROLE + " attempt=" + attempt + " force=" + force + " diagnostics=" + result
            );
            if (result != null && result.contains("roleReady=true")) {
                webView.postInvalidateOnAnimation();
            }
        });
    }

    private static String quoteForJavascript(String value) {
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'";
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
