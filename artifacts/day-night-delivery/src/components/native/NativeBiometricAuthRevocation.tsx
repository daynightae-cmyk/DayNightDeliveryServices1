import { useEffect } from "react";
import { supabase } from "../../supabase";
import { disableNativeBiometric, type NativeBiometricRole } from "../../lib/nativeBiometric";

/**
 * Password/email/security updates revoke the encrypted local binding. Account
 * disablement and role changes are also rejected by the server validation on
 * the next unlock/session refresh.
 */
export default function NativeBiometricAuthRevocation({ role }: { role: NativeBiometricRole }) {
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "USER_UPDATED") return;
      window.setTimeout(() => {
        void disableNativeBiometric(role, "biometric_session_revoked", "user_credentials_updated");
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [role]);

  return null;
}
