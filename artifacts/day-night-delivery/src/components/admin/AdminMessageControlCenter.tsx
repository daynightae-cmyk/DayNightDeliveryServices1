import AdminMerchantMorningBroadcast from "./AdminMerchantMorningBroadcast";
import AdminMessagePresentationSettings from "./AdminMessagePresentationSettings";

export default function AdminMessageControlCenter({ isArabic }: { isArabic: boolean }) {
  return (
    <div
      className="mx-3 mt-3 space-y-5 sm:mx-6 sm:mt-5"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <AdminMerchantMorningBroadcast isArabic={isArabic} />
      <AdminMessagePresentationSettings isArabic={isArabic} />
    </div>
  );
}
