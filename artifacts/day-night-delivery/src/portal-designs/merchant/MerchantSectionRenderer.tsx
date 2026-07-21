import { MerchantAnalyticsWorkspace, MerchantControlWorkspace, MerchantExceptionWorkspace, MerchantFinanceWorkspace, MerchantImportWorkspace, MerchantPickupRequestsWorkspace, MerchantTrackingWorkspace } from "./MerchantWorkspaces";
import { MerchantBusinessWorkspace } from "./MerchantBusinessWorkspace";
import { MerchantCreateOrderView } from "./MerchantCreateOrderView";
import { MerchantDashboardView } from "./MerchantDashboardView";
import { MerchantOrderDetailsView } from "./MerchantOrderDetailsView";
import { MerchantOrdersView } from "./MerchantOrdersView";
import { MerchantStatePanel } from "./MerchantUi";
import type { MerchantPortalCallbacks } from "./merchantCallbacks";
import type { MerchantPortalData, MerchantSectionId } from "./merchantViewModels";

export interface MerchantSectionRendererProps {
  section: MerchantSectionId;
  data: MerchantPortalData;
  callbacks: MerchantPortalCallbacks;
  isArabic: boolean;
  isDark: boolean;
}

export function MerchantSectionRenderer({ section, data, callbacks, isArabic }: MerchantSectionRendererProps) {
  if (data.loading) return <MerchantStatePanel type="loading" isArabic={isArabic} />;
  if (data.error) return <MerchantStatePanel type="error" isArabic={isArabic} descriptionAr={data.error} descriptionEn={data.error} onRetry={() => void callbacks.onRefreshData()} />;
  if (data.connection.state === "offline" && section === "new_order") return <MerchantStatePanel type="offline" isArabic={isArabic} descriptionAr="يمكنك مراجعة البيانات، لكن إنشاء طلب جديد يتطلب اتصالاً بالخادم." descriptionEn="Loaded data is available, but creating a new order requires a server connection." />;

  switch (section) {
    case "dashboard":
      return <MerchantDashboardView data={data} callbacks={callbacks} isArabic={isArabic} />;
    case "new_order":
      return <MerchantCreateOrderView isArabic={isArabic} merchant={data.merchant} branches={data.branches} callbacks={callbacks} readOnly={data.readOnly} />;
    case "orders":
      return <MerchantOrdersView isArabic={isArabic} orders={data.orders} callbacks={callbacks} readOnly={data.readOnly} />;
    case "order_details":
      return <MerchantOrderDetailsView isArabic={isArabic} order={data.selectedOrder} timeline={data.timeline || []} callbacks={callbacks} readOnly={data.readOnly} />;
    case "tracking":
      return <MerchantTrackingWorkspace isArabic={isArabic} order={data.selectedOrder || data.orders.find(order => ["assigned", "accepted", "picked_up", "in_transit", "out_for_delivery"].includes(order.status.toLowerCase()))} timeline={data.timeline || []} connection={data.connection} mapSlot={data.mapSlot} callbacks={callbacks} />;
    case "pickup_requests":
      return <MerchantPickupRequestsWorkspace isArabic={isArabic} requests={data.pickupRequests} branches={data.branches} callbacks={callbacks} readOnly={data.readOnly} />;
    case "returns":
    case "cancelled":
    case "postponed":
    case "under_review":
      return <MerchantExceptionWorkspace isArabic={isArabic} mode={section} orders={data.orders} callbacks={callbacks} />;
    case "import_shipments":
      return <MerchantImportWorkspace isArabic={isArabic} callbacks={callbacks} branches={data.branches} readOnly={data.readOnly} />;
    case "cod":
    case "settlements":
    case "statements":
    case "invoices":
    case "wallet":
    case "transactions":
      return <MerchantFinanceWorkspace isArabic={isArabic} section={section} cod={data.codSummary} codTransactions={data.codTransactions} settlements={data.settlements} statements={data.statements} invoices={data.invoices} wallet={data.wallet} transactions={data.transactions} callbacks={callbacks} />;
    case "analytics":
    case "reports":
      return <MerchantAnalyticsWorkspace isArabic={isArabic} analytics={data.analytics} orders={data.orders} callbacks={callbacks} mode={section} />;
    case "branches":
    case "pickup_addresses":
    case "address_book":
    case "profile":
    case "branding":
    case "business_details":
    case "bank_details":
    case "documents":
    case "team":
      return <MerchantBusinessWorkspace isArabic={isArabic} section={section} merchant={data.merchant} branches={data.branches} addressBook={data.addressBook} documents={data.documents} team={data.team} callbacks={callbacks} readOnly={data.readOnly} />;
    case "notifications":
    case "support":
    case "integrations":
    case "settings":
    case "security":
      return <MerchantControlWorkspace isArabic={isArabic} section={section} notifications={data.notifications} tickets={data.supportTickets} integrations={data.integrations} callbacks={callbacks} merchant={data.merchant} readOnly={data.readOnly} />;
    default: {
      const exhaustive: never = section;
      return exhaustive;
    }
  }
}
