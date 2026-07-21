import { Home, PackageCheck, PackagePlus, Store, WalletCards } from "lucide-react";
import type { MerchantNavigate, MerchantSectionId } from "./merchantViewModels";

export interface MerchantBottomNavigationProps {
  currentSection: MerchantSectionId;
  isArabic: boolean;
  onNavigate: MerchantNavigate;
}

const items: Array<{
  id: MerchantSectionId;
  ar: string;
  en: string;
  icon: typeof Home;
  primary?: boolean;
}> = [
  { id: "dashboard", ar: "الرئيسية", en: "Home", icon: Home },
  { id: "orders", ar: "الطلبات", en: "Orders", icon: PackageCheck },
  { id: "new_order", ar: "إضافة طلب", en: "Create", icon: PackagePlus, primary: true },
  { id: "cod", ar: "المالية", en: "Finance", icon: WalletCards },
  { id: "profile", ar: "حسابي", en: "Account", icon: Store },
];

export function MerchantBottomNavigation({ currentSection, isArabic, onNavigate }: MerchantBottomNavigationProps) {
  return (
    <nav className="dn-merchant-bottom-nav" aria-label={isArabic ? "التنقل الرئيسي" : "Primary navigation"}>
      {items.map(({ id, ar, en, icon: Icon, primary }) => {
        const active = currentSection === id;
        return (
          <button
            key={id}
            type="button"
            className={`${active ? "is-active" : ""} ${primary ? "is-primary" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(id, undefined as never)}
          >
            <span><Icon className="h-5 w-5" aria-hidden /></span>
            <small>{isArabic ? ar : en}</small>
          </button>
        );
      })}
    </nav>
  );
}
