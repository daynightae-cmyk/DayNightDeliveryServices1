# DAY NIGHT thin native shells intentionally contain no secrets.
# Keep the JavaScript bridge used by the offline retry page.
-keepclassmembers class com.daynightae.shell.MainActivity$OfflineBridge {
    @android.webkit.JavascriptInterface <methods>;
}
