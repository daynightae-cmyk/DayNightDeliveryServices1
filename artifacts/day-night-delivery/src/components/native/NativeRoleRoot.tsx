import DriverPortal from "../driver/DriverPortal";
import MerchantPortal from "../merchant/MerchantPortalCommandCenter";
import DriverRuntimeVisualAcceptance from "./DriverRuntimeVisualAcceptance";

export type NativeRole = "driver" | "merchant";

const DRIVER_RUNTIME_VISUAL_TEST = (import.meta as any).env?.VITE_DRIVER_RUNTIME_VISUAL_TEST === "1";

/**
 * The role portals own their complete Supabase authentication and authorization
 * lifecycle. The native root only selects the requested role. It deliberately
 * does not add a second session check, fixed loading cover, or duplicate login.
 */
export default function NativeRoleRoot({ role }: { role: NativeRole }) {
  if (DRIVER_RUNTIME_VISUAL_TEST && role === "driver") {
    return <DriverRuntimeVisualAcceptance />;
  }

  return role === "driver" ? <DriverPortal /> : <MerchantPortal />;
}
