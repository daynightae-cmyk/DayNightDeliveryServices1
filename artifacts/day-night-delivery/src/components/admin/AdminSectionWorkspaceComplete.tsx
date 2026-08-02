import type { ComponentProps } from "react";
import AdminMerchantAccountsRoute from "./AdminMerchantAccountsRoute";
import AdminSectionWorkspaceCompleteLegacy from "./AdminSectionWorkspaceCompleteLegacy";

type Props = ComponentProps<typeof AdminSectionWorkspaceCompleteLegacy>;

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
