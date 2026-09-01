import type { ComponentProps } from "react";
import "../../styles/dn-merchant-finance-files.css";
import AdminFinanceOperationsCenter, { type FinanceArea } from "./AdminFinanceOperationsCenter";
import AdminMerchantAccountsRoute from "./AdminMerchantAccountsRoute";
import AdminOrderWorkspaceProfessional from "./AdminOrderWorkspaceProfessional";
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

const ORDER_SECTIONS = new Set<Props["id"]>([
  "personal_orders",
  "all_orders",
  "cancelled",
  "review",
  "postponed",
  "returned",
  "pickup",
  "abu_dhabi",
  "external",
  "out_scope",
]);

/**
 * Performance boundary for the heaviest Admin workspaces.
 *
 * Merchant accounts stay on their dedicated safe route. Finance views are kept
 * local to the finance center. Operational order sections use one shared,
 * selectable register so every bucket has the same filters, bulk selection,
 * PDF/CSV/Word export contract and responsive DAY NIGHT presentation.
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

  if (ORDER_SECTIONS.has(props.id)) {
    return <AdminOrderWorkspaceProfessional {...props} />;
  }

  return <AdminSectionWorkspaceCompleteLegacy {...props} />;
}
