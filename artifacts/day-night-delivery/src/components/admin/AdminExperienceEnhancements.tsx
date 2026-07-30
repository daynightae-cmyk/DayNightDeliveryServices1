import { useAdminFormKeyboardNavigation } from "../../hooks/useAdminFormKeyboardNavigation";
import { useAdminInteractionPerformanceBudget } from "../../hooks/useAdminInteractionPerformanceBudget";
import AbuKhalifaExecutiveCardBridge from "./AbuKhalifaExecutiveCardBridge";
import "../../styles/dn-admin-form-inputs.css";

/**
 * Administration-only interaction enhancements.
 *
 * Identity is rendered by React components. This component intentionally does
 * not scan or rewrite document.body, which keeps public routes and unrelated
 * portal screens outside the admin performance budget.
 */
export default function AdminExperienceEnhancements() {
  useAdminFormKeyboardNavigation(true);
  useAdminInteractionPerformanceBudget(true);
  return <AbuKhalifaExecutiveCardBridge />;
}
