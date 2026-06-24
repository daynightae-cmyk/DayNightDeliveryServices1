import { Link } from "react-router-dom";
import { Truck, Search, MessageSquare } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";
import { useLocation } from "react-router-dom";

const HIDDEN_ON = ["/admin", "/driver", "/customer", "/auth"];

export default function StickyMobileBar() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const location = useLocation();

  if (HIDDEN_ON.some((r) => location.pathname.startsWith(r))) return null;

  const actions = [
    {
      id: "sticky_request",
      label: isArabic ? "اطلب توصيل" : "Request",
      icon: Truck,
      to: "/request",
      isLink: true,
      className: "text-brand-gold",
    },
    {
      id: "sticky_track",
      label: isArabic ? "تتبع" : "Track",
      icon: Search,
      to: "/tracking",
      isLink: true,
      className: "text-brand-gold",
    },
    {
      id: "sticky_whatsapp",
      label: "WhatsApp",
      icon: MessageSquare,
      to: companyMeta.whatsappUrl,
      isLink: false,
      className: "text-[#25D366]",
    },
  ];

  return (
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-30 h-14 flex items-stretch border-t backdrop-blur-xl bg-brand-deep/95 border-white/10`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      {actions.map(({ id, label, icon: Icon, to, isLink, className }) =>
        isLink ? (
          <Link
            key={id}
            id={id}
            to={to}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white/60 hover:text-brand-gold transition-colors active:scale-95"
          >
            <Icon className={`w-5 h-5 ${className}`} />
            <span className="text-[9px] font-bold">{label}</span>
          </Link>
        ) : (
          <a
            key={id}
            id={id}
            href={to}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white/60 hover:text-[#25D366] transition-colors active:scale-95"
          >
            <Icon className={`w-5 h-5 ${className}`} />
            <span className="text-[9px] font-bold">{label}</span>
          </a>
        )
      )}
    </div>
  );
}
