import { useEffect } from "react";
import AdminNexusOrbitalLiveCommandMap, { type AdminNexusLiveCommandMapProps } from "./AdminNexusOrbitalLiveCommandMap";

export default function AdminNexusOrbitalLiveResizer(props: AdminNexusLiveCommandMapProps) {
  useEffect(() => {
    const timers = [80, 260, 700, 1500].map((delay) => window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, delay));

    const host = document.querySelector<HTMLElement>(".dn-nexus-map-host");
    const observer = typeof ResizeObserver !== "undefined" && host
      ? new ResizeObserver(() => window.dispatchEvent(new Event("resize")))
      : null;
    observer?.observe(host!);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
    };
  }, []);

  return <AdminNexusOrbitalLiveCommandMap {...props} />;
}
