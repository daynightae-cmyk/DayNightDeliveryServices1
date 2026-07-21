import { X } from "lucide-react";
import { merchantNavigationGroups } from "./MerchantDesktopSidebar";
import type { MerchantNavigate, MerchantProfileViewModel, MerchantSectionId } from "./merchantViewModels";

export interface MerchantMobileMoreSheetProps {
  open: boolean;
  currentSection: MerchantSectionId;
  merchant: MerchantProfileViewModel;
  isArabic: boolean;
  onClose(): void;
  onNavigate: MerchantNavigate;
}

export function MerchantMobileMoreSheet({ open, currentSection, merchant, isArabic, onClose, onNavigate }: MerchantMobileMoreSheetProps) {
  if (!open) return null;
  return (
    <div className="dn-merchant-mobile-sheet-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="dn-merchant-mobile-sheet">
        <header>
          <div className="dn-merchant-store-avatar">{merchant.logoUrl ? <img src={merchant.logoUrl} alt={merchant.tradeName} /> : merchant.tradeName.slice(0, 2).toUpperCase()}</div>
          <div><strong>{merchant.tradeName}</strong><small dir="ltr">{merchant.merchantCode || merchant.email || "—"}</small></div>
          <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"}><X className="h-5 w-5" /></button>
        </header>
        <div>
          {merchantNavigationGroups.map((group) => (
            <section key={group.en}>
              <h2>{isArabic ? group.ar : group.en}</h2>
              <div>
                {group.items.map(({ id, ar, en, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={currentSection === id ? "is-active" : ""}
                    onClick={() => { onNavigate(id, undefined as never); onClose(); }}
                  >
                    <Icon className="h-5 w-5" /><span>{isArabic ? ar : en}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
