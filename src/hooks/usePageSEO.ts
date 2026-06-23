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
    description: "Official clean prices: UAE main 30 AED, UAE extended 50 AED, GCC 95 AED first kg plus 45 AED additional kg, worldwide 190 AED first kg plus 90 AED additional kg."
  },
  "/uae-delivery": {
    title: "التوصيل المحلي داخل الإمارات | DAY NIGHT DELIVERY SERVICES",
    description: "Local delivery across all UAE emirates. Main cities 30 AED and extended areas 50 AED as clean customer prices."
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
  "/customer": {
    title: "Customer Login | DAY NIGHT DELIVERY SERVICES",
    description: "Protected customer order access.",
    noindex: true
  },
  "/privacy": {
    title: "Privacy Policy | DAY NIGHT DELIVERY SERVICES",
    description: "Privacy and data handling policy for DAY NIGHT delivery customers."
  },
  "/terms": {
    title: "Terms & Conditions | DAY NIGHT DELIVERY SERVICES",
    description: "Service terms, delivery policies, returns, cancellation, and prohibited items."
  },
  "/trust": {
    title: "Trust & Safety | DAY NIGHT DELIVERY SERVICES",
    description: "Security, tracking, confidentiality, proof of delivery, and official contact channels."
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
