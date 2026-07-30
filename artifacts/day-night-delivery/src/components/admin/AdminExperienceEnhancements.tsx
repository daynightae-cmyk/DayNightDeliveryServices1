import { useAdminFormKeyboardNavigation } from "../../hooks/useAdminFormKeyboardNavigation";
import { useAdminInteractionPerformanceBudget } from "../../hooks/useAdminInteractionPerformanceBudget";
import "../../styles/dn-admin-form-inputs.css";

/**
 * Administration-only form and interaction-performance enhancements.
 * Executive identity is rendered directly by AdminPanelLuxury.
 */
export default function AdminExperienceEnhancements() {
  useAdminFormKeyboardNavigation(true);
  useAdminInteractionPerformanceBudget(true);
  return null;
}
