import { Suspense, lazy, useEffect, useState } from "react";

const AdminNexusEntry = lazy(() => import("./AdminNexusEntry"));

function isAdminLocation() {
  if (typeof window === "undefined") return false;
  return /^\/admin(?:\/|$)/i.test(window.location.pathname);
}

export default function AdminNexusRouteBridge() {
  const [isAdmin, setIsAdmin] = useState(isAdminLocation);

  useEffect(() => {
    let lastPath = window.location.pathname;
    const sync = () => {
      const nextPath = window.location.pathname;
      if (nextPath === lastPath) return;
      lastPath = nextPath;
      setIsAdmin(isAdminLocation());
    };

    const interval = window.setInterval(sync, 500);
    window.addEventListener("popstate", sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  if (!isAdmin) return null;
  return (
    <Suspense fallback={null}>
      <AdminNexusEntry />
    </Suspense>
  );
}
