import { useEffect } from "react";
import PortalRuntimeOverlay from "../portals/PortalRuntimeOverlay";

/**
 * Keep the operating-system pointer for zero-latency desktop interaction.
 * The former cursor used a permanent requestAnimationFrame loop plus global
 * pointer listeners, which caused visible lag on administration workstations.
 */
export function DNOfficialCursor() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      "dn-custom-cursor-enabled",
      "dn-custom-cursor-visible",
      "dn-custom-cursor-pressed",
    );
  }, []);

  return <PortalRuntimeOverlay />;
}
