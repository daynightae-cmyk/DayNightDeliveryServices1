import type { ComponentProps } from "react";
import AdminMerchantAccountsRoute from "./AdminMerchantAccountsRoute";
import AdminOperationsLayerLegacy from "./AdminOperationsLayerLegacy";

type Props = ComponentProps<typeof AdminOperationsLayerLegacy>;

function navigateAdminSection(target: string) {
  const control = document.querySelector<HTMLElement>(`[data-dn-command-section="${target}"]`);
  control?.click();
}

export default function AdminOperationsLayer(props: Props) {
  if (props.id === "accounts") {
    return (
      <AdminMerchantAccountsRoute
        isArabic={props.isArabic}
        orders={props.orders}
        merchants={props.merchants}
        onRefresh={props.onRefresh}
        onNavigate={navigateAdminSection}
      />
    );
  }

  return <AdminOperationsLayerLegacy {...props} />;
}
