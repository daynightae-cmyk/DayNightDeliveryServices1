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
 * legacy site styles. Blur/backdrop composition is disabled because older and
 * low-memory Android WebViews may otherwise create a transparent login layer.
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
        String roleCss = driverRole
                ? "html[data-native-shell=\"driver\"] .dn-driver-login-page::before,html[data-native-shell=\"driver\"] .dn-driver-login-page::after{display:none!important;}"
                    + "html[data-native-shell=\"driver\"] .dn-driver-auth-card{background:#fff!important;color:#071a33!important;border:1px solid rgba(7,26,51,.14)!important;box-shadow:0 18px 54px rgba(7,26,51,.18)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;isolation:auto!important;mix-blend-mode:normal!important;}"
                    + "html[data-native-shell=\"driver\"] .dn-driver-auth-card *{opacity:1!important;visibility:visible!important;content-visibility:visible!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:none!important;mix-blend-mode:normal!important;}"
                    + "html[data-native-shell=\"driver\"] .dn-driver-auth-card :is(h1,h2,h3,p,strong,small,label>span){color:#071a33!important;}"
                    + "html[data-native-shell=\"driver\"] .dn-driver-auth-card input{display:block!important;background:#fff!important;color:#071a33!important;border:1px solid rgba(7,26,51,.18)!important;-webkit-text-fill-color:#071a33!important;}"
                    + "html[data-native-shell=\"driver\"] .dn-driver-auth-card .dn-portal-auth-primary{display:flex!important;background:#0b4db2!important;color:#fff!important;}"
                : "html[data-native-shell=\"merchant\"] .dn-merchant-login-v3::before,html[data-native-shell=\"merchant\"] .dn-merchant-login-v3::after{display:none!important;}"
                    + "html[data-native-shell=\"merchant\"] .dn-merchant-login-card-v3{background:#fff!important;color:#071a33!important;border:1px solid rgba(7,26,51,.14)!important;box-shadow:0 18px 54px rgba(7,26,51,.18)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;isolation:auto!important;mix-blend-mode:normal!important;}"
                    + "html[data-native-shell=\"merchant\"] .dn-merchant-login-card-v3 *{opacity:1!important;visibility:visible!important;content-visibility:visible!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:none!important;mix-blend-mode:normal!important;}"
                    + "html[data-native-shell=\"merchant\"] .dn-merchant-login-card-v3 :is(h1,h2,h3,p,strong,small,label>span){color:#071a33!important;}"
                    + "html[data-native-shell=\"merchant\"] .dn-merchant-login-card-v3 input{display:block!important;background:#fff!important;color:#071a33!important;border:1px solid rgba(7,26,51,.18)!important;-webkit-text-fill-color:#071a33!important;}"
                    + "html[data-native-shell=\"merchant\"] .dn-merchant-login-card-v3 button[type=submit]{display:flex!important;background:#0b4db2!important;color:#fff!important;}";

        String script = "(function(){"
                + "function forceStyle(element,name,value){if(element){element.style.setProperty(name,value,'important');}}"
                + "function forceMany(element,values){if(!element)return;Object.keys(values).forEach(function(name){forceStyle(element,name,values[name]);});}"
                + "var styleTag=document.getElementById('dn-native-last-paint-style');"
                + "if(!styleTag){styleTag=document.createElement('style');styleTag.id='dn-native-last-paint-style';document.head.appendChild(styleTag);}"
                + "styleTag.textContent=" + quoteForJavascript(roleCss) + ";"
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
                + "forceMany(login,{position:'fixed',inset:'0',top:'0',right:'0',bottom:'0',left:'0',zIndex:'2147483000',display:'block',width:'100vw',minWidth:'0',maxWidth:'none',height:'100dvh',minHeight:'100dvh',margin:'0',padding:'10px',overflowX:'hidden',overflowY:'auto',transform:'none',translate:'none',filter:'none',opacity:'1',visibility:'visible',contentVisibility:'visible',clip:'auto',clipPath:'none',scrollBehavior:'auto',backdropFilter:'none',WebkitBackdropFilter:'none'});"
                + "if(shell){forceMany(shell,{position:'static',display:'block',width:'100%',minWidth:'0',maxWidth:'none',height:'auto',minHeight:'0',margin:'0',padding:'0',overflow:'visible',transform:'none',translate:'none'});}"
                + "if(visual){forceStyle(visual,'display','none');}"
                + "if(card){"
                + "forceMany(card,{position:'relative',inset:'auto',top:'auto',right:'auto',bottom:'auto',left:'auto',zIndex:'2',display:'flex',flexDirection:'column',justifyContent:'flex-start',alignSelf:'auto',justifySelf:'auto',width:'100%',minWidth:'0',maxWidth:'560px',height:'auto',minHeight:'0',maxHeight:'none',margin:'0 auto',padding:'22px 17px 20px',overflow:'visible',transform:'none',translate:'none',filter:'none',opacity:'1',visibility:'visible',contentVisibility:'visible',clip:'auto',clipPath:'none',borderRadius:'24px',background:'#ffffff',color:'#071a33',border:'1px solid rgba(7,26,51,.14)',boxShadow:'0 18px 54px rgba(7,26,51,.18)',backdropFilter:'none',WebkitBackdropFilter:'none',isolation:'auto',mixBlendMode:'normal'});"
                + "Array.from(card.querySelectorAll('*')).forEach(function(child){forceMany(child,{opacity:'1',visibility:'visible',contentVisibility:'visible',filter:'none',backdropFilter:'none',WebkitBackdropFilter:'none',animation:'none',mixBlendMode:'normal'});});"
                + "}"
                + "}"
                + "var target=card||surface;"
                + "var style=target?getComputedStyle(target):null;"
                + "var rect=target?target.getBoundingClientRect():null;"
                + "var first=card&&card.firstElementChild?card.firstElementChild:null;"
                + "var firstStyle=first?getComputedStyle(first):null;"
                + "var firstRect=first?first.getBoundingClientRect():null;"
                + "var visible=!!(target&&style&&rect&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>0&&rect.width>2&&rect.height>2&&rect.bottom>0&&rect.top<window.innerHeight);"
                + "var roleReady=false;"
                + "if(visible){window.scrollTo(0,0);document.documentElement.scrollTop=0;if(document.body){document.body.scrollTop=0;}if(target.dataset.dnNativePaintProbe==='1'){roleReady=true;}else{target.dataset.dnNativePaintProbe='1';void target.offsetHeight;requestAnimationFrame(function(){requestAnimationFrame(function(){target.dataset.dnNativePainted='1';});});}}"
                + "var force=" + (force ? "true" : "false") + ";"
                + "if(boot&&(rendered||force)){boot.classList.add('is-complete');boot.remove();}"
                + "return 'removed='+(!document.getElementById('dn-role-boot'))"
                + "+',rendered='+rendered+',login='+(!!login)+',card='+(!!card)"
                + "+',textLength='+(card?String(card.innerText||'').length:-1)"
                + "+',children='+(card?card.childElementCount:-1)"
                + "+',roleVisible='+visible+',roleReady='+roleReady"
                + "+',rootChildren='+(root?root.childElementCount:-1)"
                + "+',background='+(style?style.backgroundColor:'missing')"
                + "+',display='+(style?style.display:'missing')"
                + "+',visibility='+(style?style.visibility:'missing')"
                + "+',opacity='+(style?style.opacity:'missing')"
                + "+',rect='+(rect?[Math.round(rect.left),Math.round(rect.top),Math.round(rect.width),Math.round(rect.height)].join(':'):'missing')"
                + "+',first='+(firstStyle&&firstRect?[firstStyle.display,firstStyle.visibility,firstStyle.opacity,Math.round(firstRect.left),Math.round(firstRect.top),Math.round(firstRect.width),Math.round(firstRect.height)].join(':'):'missing')"
                + "+',viewport='+window.innerWidth+'x'+window.innerHeight+',ready='+document.readyState+',href='+String(location.href);"
                + "})()";

        webView.evaluateJavascript(script, result -> {
            Log.i(TAG, BuildConfig.ROLE + " attempt=" + attempt + " force=" + force + " diagnostics=" + result);
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
