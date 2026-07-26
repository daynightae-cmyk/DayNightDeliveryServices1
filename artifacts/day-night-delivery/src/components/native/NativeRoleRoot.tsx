import { useEffect } from "react";
import DriverPortal from "../driver/DriverPortal";
import MerchantPortal from "../merchant/MerchantPortalCommandCenter";
import DriverRuntimeVisualAcceptance from "./DriverRuntimeVisualAcceptance";
import NativeBiometricAuthRevocation from "./NativeBiometricAuthRevocation";
import NativeBiometricBoundary from "./NativeBiometricBoundary";
import "../../styles/dn-merchant-native-scroll-final.css";

export type NativeRole = "driver" | "merchant";

const DRIVER_RUNTIME_VISUAL_TEST = (import.meta as any).env?.VITE_DRIVER_RUNTIME_VISUAL_TEST === "1";
const MERCHANT_SCROLL_CLASS = "dn-native-merchant-scroll";
const MERCHANT_DASHBOARD_CLASS = "dn-native-merchant-dashboard";

/**
 * The role portals remain the source of Supabase authentication and role data.
 * NativeBiometricBoundary can only restore a Supabase refresh session after the
 * Android system prompt, then repeats server-side role/status validation before
 * allowing the existing portal to remain unlocked.
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
      htmlMaxHeight: html.style.maxHeight,
      bodyOverflow: body.style.overflow,
      bodyOverflowX: body.style.overflowX,
      bodyOverflowY: body.style.overflowY,
      bodyHeight: body.style.height,
      bodyMaxHeight: body.style.maxHeight,
      bodyPosition: body.style.position,
      bodyInset: body.style.inset,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      rootOverflow: root?.style.overflow || "",
      rootHeight: root?.style.height || "",
      rootMinHeight: root?.style.minHeight || "",
      rootMaxHeight: root?.style.maxHeight || "",
    };

    let frame = 0;

    const syncMerchantScrollState = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const dashboardMounted = Boolean(
          document.querySelector('.dn-merchant-app[data-merchant-authenticated="true"]'),
        );

        html.classList.toggle(MERCHANT_DASHBOARD_CLASS, dashboardMounted);
        body.style.position = "static";
        body.style.inset = "";
        body.style.top = "";
        body.style.width = "";

        if (dashboardMounted) {
          html.style.overflow = "hidden";
          html.style.overflowX = "hidden";
          html.style.overflowY = "hidden";
          html.style.height = "100%";
          html.style.maxHeight = "100%";
          body.style.overflow = "hidden";
          body.style.overflowX = "hidden";
          body.style.overflowY = "hidden";
          body.style.height = "100%";
          body.style.maxHeight = "100%";
          if (root) {
            root.style.overflow = "hidden";
            root.style.height = "100dvh";
            root.style.minHeight = "100dvh";
            root.style.maxHeight = "100dvh";
          }
          return;
        }

        html.style.overflow = "";
        html.style.overflowX = "hidden";
        html.style.overflowY = "auto";
        html.style.height = "auto";
        html.style.maxHeight = "none";
        body.style.overflow = "";
        body.style.overflowX = "hidden";
        body.style.overflowY = "auto";
        body.style.height = "auto";
        body.style.maxHeight = "none";
        if (root) {
          root.style.overflow = "visible";
          root.style.height = "auto";
          root.style.minHeight = "100dvh";
          root.style.maxHeight = "none";
        }
      });
    };

    html.classList.add(MERCHANT_SCROLL_CLASS);
    syncMerchantScrollState();

    const observer = new MutationObserver(syncMerchantScrollState);
    observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-merchant-authenticated"] });
    window.addEventListener("pageshow", syncMerchantScrollState);
    window.addEventListener("resize", syncMerchantScrollState);
    window.addEventListener("orientationchange", syncMerchantScrollState);
    document.addEventListener("visibilitychange", syncMerchantScrollState);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", syncMerchantScrollState);
      window.removeEventListener("resize", syncMerchantScrollState);
      window.removeEventListener("orientationchange", syncMerchantScrollState);
      document.removeEventListener("visibilitychange", syncMerchantScrollState);
      html.classList.remove(MERCHANT_SCROLL_CLASS, MERCHANT_DASHBOARD_CLASS);
      html.style.overflow = previous.htmlOverflow;
      html.style.overflowX = previous.htmlOverflowX;
      html.style.overflowY = previous.htmlOverflowY;
      html.style.height = previous.htmlHeight;
      html.style.maxHeight = previous.htmlMaxHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.overflowX = previous.bodyOverflowX;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.height = previous.bodyHeight;
      body.style.maxHeight = previous.bodyMaxHeight;
      body.style.position = previous.bodyPosition;
      body.style.inset = previous.bodyInset;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      if (root) {
        root.style.overflow = previous.rootOverflow;
        root.style.height = previous.rootHeight;
        root.style.minHeight = previous.rootMinHeight;
        root.style.maxHeight = previous.rootMaxHeight;
      }
    };
  }, [role]);

  if (DRIVER_RUNTIME_VISUAL_TEST && role === "driver") {
    return <DriverRuntimeVisualAcceptance />;
  }

  return (
    <NativeBiometricBoundary role={role}>
      <NativeBiometricAuthRevocation role={role} />
      {role === "driver" ? <DriverPortal /> : <MerchantPortal />}
    </NativeBiometricBoundary>
  );
}
