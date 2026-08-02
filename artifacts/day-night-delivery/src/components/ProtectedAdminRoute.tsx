import type React from "react";
import { useEffect, useRef, useState } from "react";
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
  const allowedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let verificationRunning = false;
    let verificationQueued = false;
    let scheduledVerification: number | null = null;

    function applyDenied(userId?: string) {
      allowedRef.current = false;
      clearAuthenticatedAccessToken();
      if (userId) clearAdminStepUp(userId);
      else clearAdminStepUp();
      if (active) setStatus("denied");
    }

    async function verifyAdminAccess(preserveAllowedOnTransientFailure = false) {
      if (!active) return;
      if (verificationRunning) {
        verificationQueued = true;
        return;
      }

      verificationRunning = true;
      verificationQueued = false;

      try {
        if (!supabase) {
          applyDenied();
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
          applyDenied();
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

        if (!active) return;
        if (!allowed) {
          applyDenied(data.user.id);
          return;
        }

        allowedRef.current = true;
        setStatus("allowed");
      } catch (cause) {
        console.error("Administrator access verification failed.", cause);
        // Once the administrator has been positively verified, a transient
        // revalidation timeout must not eject the whole admin workspace. Every
        // protected read/write remains fail-closed through PostgREST/RLS.
        if (!(preserveAllowedOnTransientFailure && allowedRef.current)) applyDenied();
      } finally {
        verificationRunning = false;
        if (active && verificationQueued) scheduleVerification(true);
      }
    }

    function scheduleVerification(preserveAllowedOnTransientFailure = false) {
      if (!active || scheduledVerification !== null) return;
      scheduledVerification = window.setTimeout(() => {
        scheduledVerification = null;
        void verifyAdminAccess(preserveAllowedOnTransientFailure);
      }, 0);
    }

    // Perform exactly one authoritative verification on mount. INITIAL_SESSION
    // and TOKEN_REFRESHED events only update the cached token; re-running
    // getUser for each event created competing auth calls and could redirect a
    // valid administrator while a protected PDF request was still in flight.
    scheduleVerification(false);
    const { data } = supabase?.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) cacheAuthenticatedAccessToken(session);

      if (event === "SIGNED_OUT") {
        applyDenied(session?.user?.id);
        return;
      }

      if (event === "USER_UPDATED") {
        clearAdminStepUp(session?.user?.id);
        scheduleVerification(true);
        return;
      }

      // SIGNED_IN can recover a route that was previously denied. Do not
      // revalidate an already allowed route for INITIAL_SESSION/TOKEN_REFRESHED.
      if (event === "SIGNED_IN" && !allowedRef.current) scheduleVerification(false);
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
