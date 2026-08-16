import type { ComponentProps } from "react";
import "../../styles/dn-merchant-finance-files.css";
import AdminFinanceOperationsCenter, { type FinanceArea } from "./AdminFinanceOperationsCenter";
import AdminMerchantAccountsRoute from "./AdminMerchantAccountsRoute";
import AdminSectionWorkspaceCompleteLegacy from "./AdminSectionWorkspaceCompleteLegacy";

type Props = ComponentProps<typeof AdminSectionWorkspaceCompleteLegacy>;

const FINANCE_SECTIONS = new Set<Props["id"]>([
  "finance_dashboard",
  "driver_statements",
  "merchant_statements",
  "income",
  "cod",
  "expenses",
  "adjustments",
  "audit_log",
]);

/**
 * Performance boundary for the two heaviest admin workspaces.
 *
 * Merchant accounts stay on their dedicated safe route. Finance views are
 * rendered directly here so switching Finance tabs remains local to the finance
 * center instead of changing the parent Admin section and remounting the whole
 * workspace. Navigation is still escalated when a finance child explicitly
 * targets a non-finance Admin section.
 */
export default function AdminSectionWorkspaceComplete(props: Props) {
  if (props.id === "accounts") {
    return (
      <AdminMerchantAccountsRoute
        isArabic={props.isArabic}
        orders={props.orders}
        merchants={props.merchants}
        onRefresh={props.onRefresh || (async () => undefined)}
        onNavigate={(target) => props.onNavigate?.(target as Props["id"])}
      />
    );
  }

  if (FINANCE_SECTIONS.has(props.id)) {
    return (
      <div className="dn-admin-finance-performance-scope" data-admin-finance-local-navigation="true">
        <AdminFinanceOperationsCenter
          isArabic={props.isArabic}
          activeSection={props.id as FinanceArea}
          orders={props.allOrders ?? props.orders}
          merchants={props.merchants}
          financeSummary={props.financeSummary}
          financeSummarySource={props.financeSummarySource ?? "derived"}
          onRefresh={props.onRefresh || (async () => undefined)}
          onNavigate={(target) => {
            if (FINANCE_SECTIONS.has(target as Props["id"])) return;
            props.onNavigate?.(target as Props["id"]);
          }}
        />
      </div>
    );
  }

  return <AdminSectionWorkspaceCompleteLegacy {...props} />;
}
