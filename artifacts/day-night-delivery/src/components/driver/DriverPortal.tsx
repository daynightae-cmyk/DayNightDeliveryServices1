import { useEffect } from "react";
import { useAppContext } from "../../lib/AppContext";
import DriverAuthGuard from "./DriverAuthGuard";
import "../../styles/dn-driver-operations.css";
import "../../styles/dn-driver-profiles.css";
import "../../styles/dn-driver-flex.css";
import "../../styles/dn-driver-figma.css";
import "../../styles/dn-driver-figma-exact.css";
import "../../styles/dn-driver-mobile-runtime-final.css";
import "../../styles/dn-driver-runtime-v114.css";

export default function DriverPortal() {
  const { language } = useAppContext();

  useEffect(() => {
    document.getElementById("dn-driver-native-login")?.remove();
    document.getElementById("dn-driver-native-login-style")?.remove();
    document.getElementById("dn-driver-public-auth-fix")?.remove();
    document.documentElement.setAttribute("data-driver-runtime", "v1.1.4");

    return () => {
      document.documentElement.removeAttribute("data-driver-runtime");
    };
  }, []);

  return <DriverAuthGuard isArabic={language === "ar"} />;
}
