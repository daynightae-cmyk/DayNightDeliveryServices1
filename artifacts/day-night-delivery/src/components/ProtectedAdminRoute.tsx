import type React from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabase";
import { isAdminUser } from "../supabaseAdminOps";
import AdminSecuritySettings from "./admin/AdminSecuritySettings";

type ProtectedAdminRouteProps = {
  children: React.ReactNode;
};

export default function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let active = true;

    async function verifyAdminAccess() {
      try {
        if (!supabase) {
          if (active) setStatus("denied");
          return;
        }

        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user?.id) {
          if (active) setStatus("denied");
          return;
        }

        const allowed = await isAdminUser(data.user.id);

        if (active) {
          setStatus(allowed ? "allowed" : "denied");
        }
      } catch {
        if (active) setStatus("denied");
      }
    }

    void verifyAdminAccess();
    const { data } = supabase?.auth.onAuthStateChange(() => void verifyAdminAccess()) || { data: null };

    return () => {
      active = false;
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

  return <>{children}<AdminSecuritySettings /></>;
}
