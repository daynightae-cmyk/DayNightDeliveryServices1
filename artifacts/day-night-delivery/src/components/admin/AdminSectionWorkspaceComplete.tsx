import type { ComponentProps } from "react";
import "../../styles/dn-merchant-finance-files.css";
import AdminMerchantAccountsRoute from "./AdminMerchantAccountsRoute";
import AdminSectionWorkspaceCompleteLegacy from "./AdminSectionWorkspaceCompleteLegacy";

type Props = ComponentProps<typeof AdminSectionWorkspaceCompleteLegacy>;

/**
 * The accounts section is intentionally intercepted before the legacy finance
 * workspace so merchant rows can never be mixed in the generic ledger table.
 * Every other admin section remains byte-for-byte compatible through the
 * preserved legacy component.
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

  return <AdminSectionWorkspaceCompleteLegacy {...props} />;
}
