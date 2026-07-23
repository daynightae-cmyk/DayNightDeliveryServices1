package com.daynightae.shell;

import android.app.Application;

/**
 * DAY NIGHT application entry point.
 *
 * Role authentication, routing, loading states, dashboard rendering, and map
 * lifecycle are owned by the real React application. This class deliberately
 * does not inject HTML, move React elements off-screen, rewrite CSS, or mirror
 * credentials into hidden forms.
 */
public final class DayNightApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
    }
}
