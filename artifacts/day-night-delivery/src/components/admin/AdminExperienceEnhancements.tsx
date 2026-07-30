import { useAppContext } from "../../lib/AppContext";
import { useAdminFormKeyboardNavigation } from "../../hooks/useAdminFormKeyboardNavigation";
import { useAdminManagerIdentity } from "../../hooks/useAdminManagerIdentity";
import AbuKhalifaExecutiveCardBridge from "./AbuKhalifaExecutiveCardBridge";
import "../../styles/dn-admin-form-inputs.css";

/**
 * Installs administration-only interaction and identity enhancements without
 * coupling them to one form or one dashboard section.
 */
export default function AdminExperienceEnhancements() {
  const { language } = useAppContext();
  const isArabic = language === "ar";

  useAdminFormKeyboardNavigation(true);
  useAdminManagerIdentity(true, isArabic);

  return <AbuKhalifaExecutiveCardBridge />;
}
