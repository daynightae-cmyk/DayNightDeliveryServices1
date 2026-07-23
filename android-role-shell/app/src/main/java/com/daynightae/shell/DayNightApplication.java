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
 * The deployed Driver glass login can exist in the DOM without being painted by
 * some Android WebView GPU implementations. The watchdog therefore mounts a
 * simple deterministic credential bridge directly under document.body. It
 * forwards credentials into the real React/Supabase form, removes itself after
 * authentication, and leaves the authenticated dashboard/map hardware accelerated.
 */
public final class DayNightApplication extends Application {
    private static final String TAG = "DAYNIGHT_SPLASH";
    private static final int MAX_WATCHDOG_ATTEMPTS = 50;
    private static final long FIRST_WATCHDOG_DELAY_MS = 500L;
    private static final long NEXT_WATCHDOG_DELAY_MS = 1200L;

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
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.postDelayed(() -> probeRoleSurface(webView, 1, false), FIRST_WATCHDOG_DELAY_MS);
    }

    private void probeRoleSurface(WebView webView, int attempt, boolean force) {
        if (webView == null || !webView.isAttachedToWindow()) {
            Log.w(TAG, BuildConfig.ROLE + " attempt=" + attempt + " webview=detached");
            return;
        }

        String roleSelector = "driver".equals(BuildConfig.ROLE)
                ? "#dn-driver-native-login,.dn-native-role-login,[data-native-role-loading=\"driver\"],.dn-driver-login-page,.dn-driver-loading-card,.dn-driver-exact-shell,.dn-driver-state-card,.dn-driver-shell-v3,[data-driver-runtime-acceptance=\"ready\"]"
                : ".dn-native-role-login,[data-native-role-loading=\"merchant\"],.dn-merchant-app,.dn-merchant-state-v3,.dn-merchant-shell-v3";

        String driverOverlayCss = "#dn-driver-native-login{position:fixed!important;inset:0!important;z-index:2147483646!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;width:100vw!important;height:100dvh!important;overflow:auto!important;padding:calc(16px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom))!important;background:linear-gradient(160deg,#071a33 0%,#0a2d58 55%,#1156a5 100%)!important;font-family:Cairo,Arial,sans-serif!important;color:#071a33!important;box-sizing:border-box!important;}"
                + "#dn-driver-native-login *{box-sizing:border-box!important;opacity:1!important;visibility:visible!important;transform:none!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:none!important;}"
                + "#dn-driver-native-login .dn-driver-native-login-card{display:block!important;position:relative!important;width:min(100%,460px)!important;min-height:0!important;margin:0 auto!important;padding:22px 18px 20px!important;border:1px solid rgba(212,175,55,.62)!important;border-radius:26px!important;background:#fff!important;color:#071a33!important;box-shadow:0 22px 60px rgba(0,0,0,.34)!important;}"
                + "#dn-driver-native-login .dn-native-brand{display:flex!important;align-items:center!important;gap:12px!important;margin-bottom:18px!important;}"
                + "#dn-driver-native-login .dn-native-mark{display:grid!important;place-items:center!important;flex:0 0 58px!important;width:58px!important;height:58px!important;border-radius:18px!important;background:#071a33!important;color:#d4af37!important;border:2px solid #d4af37!important;font-size:20px!important;font-weight:900!important;}"
                + "#dn-driver-native-login h1{display:block!important;margin:0!important;color:#071a33!important;font-size:23px!important;line-height:1.3!important;font-weight:900!important;}"
                + "#dn-driver-native-login .dn-native-subtitle{display:block!important;margin:5px 0 0!important;color:#52677e!important;font-size:13px!important;line-height:1.6!important;font-weight:700!important;}"
                + "#dn-driver-native-login label{display:block!important;margin:13px 0 0!important;color:#253b55!important;font-size:13px!important;font-weight:900!important;}"
                + "#dn-driver-native-login input{display:block!important;width:100%!important;height:52px!important;margin-top:7px!important;padding:0 14px!important;border:1px solid #aebdcc!important;border-radius:14px!important;outline:none!important;background:#fff!important;color:#071a33!important;font-size:16px!important;font-weight:700!important;direction:ltr!important;text-align:left!important;}"
                + "#dn-driver-native-login input:focus{border-color:#176bc0!important;box-shadow:0 0 0 3px rgba(23,107,192,.14)!important;}"
                + "#dn-driver-native-login .dn-native-submit{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:52px!important;margin-top:18px!important;border:0!important;border-radius:15px!important;background:#d4af37!important;color:#071a33!important;font-size:16px!important;font-weight:900!important;}"
                + "#dn-driver-native-login .dn-native-submit:disabled{opacity:.65!important;}"
                + "#dn-driver-native-login .dn-native-status{display:block!important;min-height:22px!important;margin:12px 0 0!important;color:#a12828!important;font-size:12px!important;line-height:1.6!important;font-weight:800!important;text-align:center!important;}"
                + "#dn-driver-native-login .dn-native-foot{display:block!important;margin:9px 0 0!important;color:#728399!important;font-size:11px!important;line-height:1.7!important;text-align:center!important;}";

        String driverBridge = "driver".equals(BuildConfig.ROLE)
                ? "var dashboard=document.querySelector('.dn-driver-exact-shell,.dn-driver-shell-v3,.dn-driver-state-card,[data-driver-runtime-acceptance=\"ready\"]');"
                    + "var login=document.querySelector('.dn-driver-login-page');"
                    + "var overlay=document.getElementById('dn-driver-native-login');"
                    + "if(dashboard&&overlay){overlay.remove();overlay=null;}"
                    + "if(login&&!dashboard){"
                    + "var style=document.getElementById('dn-driver-native-login-style');"
                    + "if(!style){style=document.createElement('style');style.id='dn-driver-native-login-style';document.head.appendChild(style);}"
                    + "style.textContent=" + quoteForJavascript(driverOverlayCss) + ";"
                    + "login.style.setProperty('position','fixed','important');login.style.setProperty('left','-200vw','important');login.style.setProperty('top','0','important');login.style.setProperty('width','1px','important');login.style.setProperty('height','1px','important');login.style.setProperty('overflow','hidden','important');login.style.setProperty('opacity','0','important');login.style.setProperty('pointer-events','none','important');"
                    + "if(!overlay){"
                    + "var ar=(document.documentElement.dir==='rtl'||document.documentElement.lang==='ar');"
                    + "overlay=document.createElement('section');overlay.id='dn-driver-native-login';overlay.dir=ar?'rtl':'ltr';"
                    + "overlay.innerHTML='<div class=\"dn-driver-native-login-card\"><div class=\"dn-native-brand\"><span class=\"dn-native-mark\">DN</span><div><h1>'+(ar?'دخول المندوب':'Driver sign in')+'</h1><p class=\"dn-native-subtitle\">'+(ar?'استخدم بيانات حساب المندوب المعتمدة لدى عمليات DAY NIGHT.':'Use the driver account approved by DAY NIGHT operations.')+'</p></div></div><form id=\"dn-driver-native-form\"><label>'+(ar?'البريد الإلكتروني':'Email address')+'<input id=\"dn-driver-native-email\" type=\"email\" autocomplete=\"username\" required></label><label>'+(ar?'كلمة المرور':'Password')+'<input id=\"dn-driver-native-password\" type=\"password\" autocomplete=\"current-password\" required></label><button class=\"dn-native-submit\" type=\"submit\">'+(ar?'فتح مركز التشغيل':'Open operations center')+'</button><p class=\"dn-native-status\" aria-live=\"polite\"></p><small class=\"dn-native-foot\">DAY NIGHT DELIVERY SERVICES · '+(ar?'دخول آمن ومتصل بالنظام الحقيقي':'Secure access to the live operations system')+'</small></form></div>';"
                    + "document.body.appendChild(overlay);"
                    + "var bridgeForm=overlay.querySelector('#dn-driver-native-form');"
                    + "bridgeForm.addEventListener('submit',function(event){event.preventDefault();"
                    + "var status=overlay.querySelector('.dn-native-status');var button=overlay.querySelector('.dn-native-submit');"
                    + "var email=overlay.querySelector('#dn-driver-native-email').value.trim();var password=overlay.querySelector('#dn-driver-native-password').value;"
                    + "var webForm=login.querySelector('form');var webEmail=login.querySelector('input[type=\"email\"]');var webPassword=login.querySelector('input[type=\"password\"],input[autocomplete=\"current-password\"]');"
                    + "if(!webForm||!webEmail||!webPassword){status.textContent=ar?'جاري تجهيز صفحة الدخول، حاول بعد لحظة.':'Preparing sign-in. Try again in a moment.';return;}"
                    + "button.disabled=true;status.style.color='#52677e';status.textContent=ar?'جاري تسجيل الدخول...':'Signing in...';"
                    + "var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;"
                    + "setter.call(webEmail,email);webEmail.dispatchEvent(new Event('input',{bubbles:true}));webEmail.dispatchEvent(new Event('change',{bubbles:true}));"
                    + "setter.call(webPassword,password);webPassword.dispatchEvent(new Event('input',{bubbles:true}));webPassword.dispatchEvent(new Event('change',{bubbles:true}));"
                    + "window.setTimeout(function(){if(webForm.requestSubmit){webForm.requestSubmit();}else{webForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}},120);"
                    + "});"
                    + "}"
                    + "var originalError=login.querySelector('.dn-portal-auth-message.is-error');"
                    + "if(originalError&&String(originalError.innerText||'').trim()&&overlay){var s=overlay.querySelector('.dn-native-status');var b=overlay.querySelector('.dn-native-submit');s.style.color='#a12828';s.textContent=String(originalError.innerText||'').trim();b.disabled=false;}"
                    + "}"
                : "";

        String script = "(function(){"
                + driverBridge
                + "var boot=document.getElementById('dn-role-boot');"
                + "var root=document.getElementById('root');"
                + "var rendered=!!(root&&root.childElementCount>0);"
                + "var surface=document.querySelector(" + quoteForJavascript(roleSelector) + ");"
                + "var card=document.querySelector('.dn-driver-native-login-card,.dn-native-role-login-card,.dn-driver-auth-card,.dn-portal-auth-card');"
                + "var dashboard=document.querySelector('.dn-driver-exact-shell,.dn-driver-shell-v3,.dn-driver-state-card');"
                + "var runtime=document.querySelector('[data-driver-runtime-acceptance=\"ready\"]');"
                + "var map=document.querySelector('[data-driver-map-ready]');"
                + "var vehicle=document.querySelector('[data-driver-vehicle-ready=\"true\"],.dn-official-vehicle-leaflet-icon');"
                + "var target=card||dashboard||surface||runtime;"
                + "var computed=target?getComputedStyle(target):null;"
                + "var rect=target?target.getBoundingClientRect():null;"
                + "var visible=!!(target&&computed&&rect"
                + "&&computed.display!=='none'&&computed.visibility!=='hidden'"
                + "&&Number(computed.opacity||1)>0&&rect.width>2&&rect.height>2"
                + "&&rect.bottom>0&&rect.top<window.innerHeight);"
                + "var roleReady=false;"
                + "if(visible){if(target.dataset.dnNativePaintProbe==='1'){roleReady=true;}else{target.dataset.dnNativePaintProbe='1';void target.offsetHeight;requestAnimationFrame(function(){requestAnimationFrame(function(){target.dataset.dnNativePainted='1';});});}}"
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
                + "+',display='+(computed?computed.display:'missing')"
                + "+',visibility='+(computed?computed.visibility:'missing')"
                + "+',opacity='+(computed?computed.opacity:'missing')"
                + "+',background='+(computed?computed.backgroundColor:'missing')"
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
            if (credentialReady || dashboardReady) {
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
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
