import { useAppContext } from "../../lib/AppContext";
import DriverAuthGuard from "./DriverAuthGuard";
import "../../styles/dn-driver-operations.css";
import "../../styles/dn-driver-profiles.css";
import "../../styles/dn-driver-flex.css";
import "../../styles/dn-driver-figma.css";
import "../../styles/dn-driver-figma-exact.css";

export default function DriverPortal() {
  const { language } = useAppContext();
  return <DriverAuthGuard isArabic={language === "ar"} />;
}
