import { useAppContext } from "../../lib/AppContext";
import DriverAuthGuard from "./DriverAuthGuard";
export default function DriverPortal() { const { language } = useAppContext(); return <DriverAuthGuard isArabic={language === "ar"} />; }
