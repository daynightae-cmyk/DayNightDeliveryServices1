import type { ComponentProps } from "react";
import "../../styles/dn-merchant-finance-files.css";
import AdminMerchantStatementsCenterPdf from "./AdminMerchantStatementsCenterPdf";

type Props = ComponentProps<typeof AdminMerchantStatementsCenterPdf>;

// Merchant statement status is defined only by successful PDF generation.
// Selecting orders or opening WhatsApp never changes that status.
export default function AdminMerchantStatementsCenter(props: Props) {
  return (
    <div data-admin-merchant-pdf-statements="true">
      <AdminMerchantStatementsCenterPdf {...props} />
    </div>
  );
}
