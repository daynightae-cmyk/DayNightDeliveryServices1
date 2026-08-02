import type React from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabase";
import { isAdminUser } from "../supabaseAdminOps";
import { clearAdminStepUp } from "../lib/adminStepUp";
import {
  cacheAuthenticatedAccessToken,
  clearAuthenticatedAccessToken,
} from "../lib/authenticatedAccessToken";
import AdminSecuritySettings from "./admin/AdminSecuritySettings";
import AdminStepUpProvider from "./admin/AdminStepUpProvider";

type ProtectedAdminRouteProps = {
  children: React.ReactNode;
};

const ADMIN_AUTH_TIMEOUT_MS = 25_000;

function withAdminAuthTimeout<T>(promise: PromiseLike<T>, operation: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${operation}_timeout`)),
      ADMIN_AUTH_TIMEOUT_MS,
    );

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        window.clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

export default function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let active = true;
    let verificationRunning = false;
    let verificationRequested = false;
    let scheduledVerification: number | null = null;

    async function verifyAdminAccess() {
      if (!active) return;
      if (verificationRunning) {
        verificationRequested = true;
        return;
      }

      verificationRunning = true;
      verificationRequested = false;

      try {
        if (!supabase) {
          clearAuthenticatedAccessToken();
          if (active) setStatus("denied");
          return;
        }

        let { data, error } = await withAdminAuthTimeout(
          supabase.auth.getUser(),
          "admin_get_user",
        );

        if (error || !data.user?.id) {
          const refreshed = await withAdminAuthTimeout(
            supabase.auth.refreshSession(),
            "admin_refresh_session",
          );
          if (!refreshed.error) {
            cacheAuthenticatedAccessToken(refreshed.data.session);
            const retried = await withAdminAuthTimeout(
              supabase.auth.getUser(),
              "admin_get_user_retry",
            );
            data = retried.data;
            error = retried.error;
          }
        }

        if (error || !data.user?.id) {
          clearAuthenticatedAccessToken();
          clearAdminStepUp();
          if (active) setStatus("denied");
          return;
        }

        const [profileAllowed, databaseRole] = await withAdminAuthTimeout(
          Promise.all([
            isAdminUser(data.user.id),
            supabase.rpc("is_admin_or_support"),
          ]),
          "admin_role_verification",
        );
        const allowed = profileAllowed && !databaseRole.error && databaseRole.data === true;

        if (active) {
          if (!allowed) {
            clearAuthenticatedAccessToken();
            clearAdminStepUp(data.user.id);
          }
          setStatus(allowed ? "allowed" : "denied");
        }
      } catch (cause) {
        console.error("Administrator access verification failed.", cause);
        clearAuthenticatedAccessToken();
        clearAdminStepUp();
        if (active) setStatus("denied");
      } finally {
        verificationRunning = false;
        if (active && verificationRequested) scheduleVerification();
      }
    }

    function scheduleVerification() {
      if (!active || scheduledVerification !== null) return;
      // Supabase explicitly dispatches auth events while its auth lock is held.
      // Defer all follow-up Supabase calls until the callback has returned to
      // prevent the protected route from remaining permanently in "checking".
      scheduledVerification = window.setTimeout(() => {
        scheduledVerification = null;
        void verifyAdminAccess();
      }, 0);
    }

    scheduleVerification();
    const { data } = supabase?.auth.onAuthStateChange((event, session) => {
      // Capture the session token synchronously while Supabase provides it.
      // Protected feature reads can then authenticate without re-entering the
      // auth mutex that is active during this callback on some mobile engines.
      if (session?.access_token) cacheAuthenticatedAccessToken(session);
      if (event === "SIGNED_OUT") {
        clearAuthenticatedAccessToken();
        clearAdminStepUp();
      } else if (event === "USER_UPDATED") {
        clearAdminStepUp();
      }
      scheduleVerification();
    }) || { data: null };

    return () => {
      active = false;
      if (scheduledVerification !== null) window.clearTimeout(scheduledVerification);
      data?.subscription.unsubscribe();
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="max-w-md mx-auto py-20 text-center text-white">
        <p className="text-brand-gold font-bold text-sm">
          Checking administrator permissions...
        </p>
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AdminStepUpProvider>
      {children}
      <AdminSecuritySettings />
    </AdminStepUpProvider>
  );
}
