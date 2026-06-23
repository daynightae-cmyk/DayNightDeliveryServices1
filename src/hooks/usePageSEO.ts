import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { updateMetaTags } from "../lib/seo";

const routeMeta: Record<string, { title: string; description: string; noindex?: boolean }> = {
  "/": {
    title: "DAY NIGHT DELIVERY SERVICES | UAE Delivery & International Shipping",
    description: "Fast, reliable delivery and shipping across the UAE and worldwide. Local delivery, international shipping, tracking, and 24/7 support."
  },
  "/pricing": {
    title: "أسعار التوصيل والشحن | DAY NIGHT DELIVERY SERVICES",
    description: "Official final pricing: local delivery from 30 AED, GCC from 95 AED, worldwide from 190 AED."
  },
  "/uae-delivery": {
    title: "التوصيل المحلي داخل الإمارات | DAY NIGHT DELIVERY SERVICES",
    description: "Local delivery across all UAE emirates. Main areas 30 AED and extended areas 50 AED final price."
  },
  "/international-shipping": {
    title: "الشحن الدولي من الإمارات | DAY NIGHT DELIVERY SERVICES",
    description: "International shipping from UAE to GCC, Europe, USA, Canada, and worldwide destinations."
  },
  "/tracking": {
    title: "تتبع شحنتك | DAY NIGHT DELIVERY SERVICES",
    description: "Track your DAY NIGHT shipment with your official tracking number."
  },
  "/contact": {
    title: "تواصل معنا | DAY NIGHT DELIVERY SERVICES",
    description: "Contact DAY NIGHT DELIVERY SERVICES — phone, WhatsApp, email, and Abu Dhabi headquarters."
  },
  "/gallery": {
    title: "المعرض | DAY NIGHT DELIVERY SERVICES",
    description: "Visual gallery — fleet, delivery operations, branding, and service visuals."
  },
  "/corporate": {
    title: "حلول الشركات والعقود | DAY NIGHT DELIVERY SERVICES",
    description: "Corporate and contract delivery solutions for businesses and institutions in the UAE."
  },
  "/request": {
    title: "اطلب توصيل | DAY NIGHT DELIVERY SERVICES",
    description: "Request delivery with instant price calculation and official tracking number."
  },
  "/qr": {
    title: "روابط التواصل السريع | DAY NIGHT DELIVERY SERVICES",
    description: "Quick contact links, QR codes, and official DAY NIGHT channels."
  },
  "/driver": {
    title: "صفحة السائق | DAY NIGHT DELIVERY SERVICES",
    description: "Driver portal for assigned orders and delivery status updates.",
    noindex: true
  },
  "/admin": {
    title: "Admin | DAY NIGHT DELIVERY SERVICES",
    description: "Admin portal",
    noindex: true
  },
  "/auth": {
    title: "Login | DAY NIGHT DELIVERY SERVICES",
    description: "Admin login",
    noindex: true
  }
};

export function usePageSEO() {
  const { pathname } = useLocation();

  useEffect(() => {
    const base = pathname.split("?")[0];
    const meta = routeMeta[base] || {
      title: "DAY NIGHT DELIVERY SERVICES",
      description: "Professional delivery and shipping services in the UAE."
    };

    updateMetaTags(meta.title, meta.description);

    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (meta.noindex) {
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.appendChild(robots);
      }
      robots.content = "noindex, nofollow";
    } else if (robots) {
      robots.content = "index, follow";
    }
  }, [pathname]);
}

export default usePageSEO;
