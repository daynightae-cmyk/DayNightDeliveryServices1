import type { ComponentProps } from "react";
import { useAppContext } from "../../lib/AppContext";
import AdminMerchantPickerEnhancer from "./AdminMerchantPickerEnhancer";
import AdminNewOrderCouponGuard from "./AdminNewOrderCouponGuard";

type Props = ComponentProps<typeof AdminNewOrderCouponGuard>;

export default function AdminNewOrder(props: Props) {
  const { language } = useAppContext();
  return (
    <>
      <AdminNewOrderCouponGuard {...props} />
      <AdminMerchantPickerEnhancer isArabic={language === "ar"} />
    </>
  );
}
