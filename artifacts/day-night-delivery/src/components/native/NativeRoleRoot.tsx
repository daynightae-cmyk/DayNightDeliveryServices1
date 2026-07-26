import { useEffect } from "react";
import DriverPortal from "../driver/DriverPortal";
import MerchantPortal from "../merchant/MerchantPortalCommandCenter";
import DriverRuntimeVisualAcceptance from "./DriverRuntimeVisualAcceptance";
import "../../styles/dn-merchant-native-scroll-final.css";

export type NativeRole = "driver" | "merchant";

const DRIVER_RUNTIME_VISUAL_TEST = (import.meta as any).env?.VITE_DRIVER_RUNTIME_VISUAL_TEST === "1";

/**
 * The role portals own their complete Supabase authentication and authorization
 * lifecycle. The native root only selects the requested role. It deliberately
 * does not add a second session check, fixed loading cover, or duplicate login.
 */
export default function NativeRoleRoot({ role }: { role: NativeRole }) {
  useEffect(() => {
    if (role !== "merchant") return;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverflowX: html.style.overflowX,
      htmlOverflowY: html.style.overflowY,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyOverflowX: body.style.overflowX,
      bodyOverflowY: body.style.overflowY,
      bodyHeight: body.style.height,
      bodyPosition: body.style.position,
      rootOverflow: root?.style.overflow || "",
      rootHeight: root?.style.height || "",
      rootMinHeight: root?.style.minHeight || "",
    };

    html.classList.add("dn-native-merchant-scroll");
    html.style.overflow = "";
    html.style.overflowX = "hidden";
    html.style.overflowY = "auto";
    html.style.height = "auto";

    body.style.overflow = "";
    body.style.overflowX = "hidden";
    body.style.overflowY = "auto";
    body.style.height = "auto";
    body.style.position = "static";

    if (root) {
      root.style.overflow = "visible";
      root.style.height = "auto";
      root.style.minHeight = "100dvh";
    }

    return () => {
      html.classList.remove("dn-native-merchant-scroll");
      html.style.overflow = previous.htmlOverflow;
      html.style.overflowX = previous.htmlOverflowX;
      html.style.overflowY = previous.htmlOverflowY;
      html.style.height = previous.htmlHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.overflowX = previous.bodyOverflowX;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.height = previous.bodyHeight;
      body.style.position = previous.bodyPosition;
      if (root) {
        root.style.overflow = previous.rootOverflow;
        root.style.height = previous.rootHeight;
        root.style.minHeight = previous.rootMinHeight;
      }
    };
  }, [role]);

  if (DRIVER_RUNTIME_VISUAL_TEST && role === "driver") {
    return <DriverRuntimeVisualAcceptance />;
  }

  return role === "driver" ? <DriverPortal /> : <MerchantPortal />;
}
