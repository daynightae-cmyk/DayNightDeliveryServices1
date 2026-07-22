import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { updateMetaTags } from "../lib/seo";

type RouteMeta = { title: string; description: string; noindex?: boolean };

const routeMeta: Record<string, RouteMeta> = {
  "/": {
    title: "DAY NIGHT DELIVERY SERVICES | UAE Delivery & International Shipping",
    description: "Fast, reliable delivery and shipping across the UAE and worldwide. Local delivery, international shipping, tracking, COD, and 24/7 support.",
  },
  "/about": {
    title: "عن DAY NIGHT | خدمات التوصيل والشحن في الإمارات",
    description: "تعرف على DAY NIGHT DELIVERY SERVICES ورؤيتنا في تقديم خدمات توصيل وشحن موثوقة داخل الإمارات وخارجها.",
  },
  "/services": {
    title: "خدمات التوصيل والشحن | DAY NIGHT DELIVERY SERVICES",
    description: "توصيل محلي، شحن دولي، حلول متاجر إلكترونية، COD، تتبع مباشر وخدمات شركات داخل دولة الإمارات.",
  },
  "/pricing": {
    title: "أسعار التوصيل والشحن | DAY NIGHT DELIVERY SERVICES",
    description: "Official prices: UAE main areas 25 AED, UAE extended areas 50 AED, GCC 95 AED first kg plus 45 AED additional kg, worldwide 190 AED first kg plus 90 AED additional kg.",
  },
  "/uae-delivery": {
    title: "التوصيل المحلي داخل الإمارات | DAY NIGHT DELIVERY SERVICES",
    description: "Local delivery across all UAE emirates. Main cities 25 AED and extended areas 50 AED, with express surcharge shown clearly when selected.",
  },
  "/international-shipping": {
    title: "الشحن الدولي من الإمارات | DAY NIGHT DELIVERY SERVICES",
    description: "International shipping from UAE to GCC, Europe, USA, Canada, and worldwide destinations.",
  },
  "/international-advanced": {
    title: "حلول الشحن الدولي المتقدمة | DAY NIGHT DELIVERY SERVICES",
    description: "حلول شحن دولية للشركات والمتاجر من الإمارات إلى دول الخليج وأوروبا وأمريكا وكندا والعالم.",
  },
  "/ecommerce": {
    title: "حلول توصيل المتاجر الإلكترونية | DAY NIGHT DELIVERY SERVICES",
    description: "إدارة توصيل طلبات المتاجر الإلكترونية والتحصيل النقدي والتتبع وخدمات العملاء داخل الإمارات.",
  },
  "/corporate": {
    title: "حلول الشركات والعقود | DAY NIGHT DELIVERY SERVICES",
    description: "Corporate and contract delivery solutions for businesses and institutions in the UAE.",
  },
  "/tracking": {
    title: "تتبع شحنتك | DAY NIGHT DELIVERY SERVICES",
    description: "Track your DAY NIGHT shipment with your official tracking number or coupon number.",
  },
  "/request": {
    title: "اطلب توصيل | DAY NIGHT DELIVERY SERVICES",
    description: "Request delivery with instant price calculation and an official DAY NIGHT tracking number.",
  },
  "/contact": {
    title: "تواصل معنا | DAY NIGHT DELIVERY SERVICES",
    description: "Contact DAY NIGHT DELIVERY SERVICES — phone, WhatsApp, email, and Abu Dhabi headquarters.",
  },
  "/gallery": {
    title: "المعرض | DAY NIGHT DELIVERY SERVICES",
    description: "Visual gallery — fleet, delivery operations, branding, and service visuals.",
  },
  "/faq": {
    title: "الأسئلة الشائعة | DAY NIGHT DELIVERY SERVICES",
    description: "إجابات واضحة عن الأسعار والتوصيل والتتبع والتحصيل والشحن الدولي وخدمات DAY NIGHT.",
  },
  "/qr": {
    title: "روابط التواصل السريع | DAY NIGHT DELIVERY SERVICES",
    description: "Quick contact links, QR codes, shipment tracking, request delivery, and official DAY NIGHT channels.",
  },
  "/policy": {
    title: "سياسات الخدمة | DAY NIGHT DELIVERY SERVICES",
    description: "سياسات التوصيل والاستلام والتسليم والإلغاء والمواد المحظورة وخدمات DAY NIGHT.",
  },
  "/privacy": {
    title: "Privacy Policy | DAY NIGHT DELIVERY SERVICES",
    description: "Privacy and data handling policy for DAY NIGHT delivery customers, merchants, drivers, and authorized users.",
  },
  "/terms": {
    title: "Terms & Conditions | DAY NIGHT DELIVERY SERVICES",
    description: "Service terms, delivery policies, returns, cancellation, and prohibited items.",
  },
  "/shipping-policy": {
    title: "Shipping Policy | DAY NIGHT DELIVERY SERVICES",
    description: "Official DAY NIGHT local and international shipping policy, service coverage, delivery handling, and responsibilities.",
  },
  "/refund-policy": {
    title: "Refund & Cancellation Policy | DAY NIGHT DELIVERY SERVICES",
    description: "Official refund, cancellation, failed-delivery, and return policy for DAY NIGHT services.",
  },
  "/trust": {
    title: "Trust & Safety | DAY NIGHT DELIVERY SERVICES",
    description: "Security, tracking, confidentiality, proof of delivery, and official contact channels.",
  },
  "/driver": {
    title: "صفحة المندوب | DAY NIGHT DELIVERY SERVICES",
    description: "Protected driver portal for assigned orders, location, and delivery status updates.",
    noindex: true,
  },
  "/merchant": {
    title: "بوابة التاجر | DAY NIGHT DELIVERY SERVICES",
    description: "Protected merchant portal for orders, COD collection, tracking, and business profile management.",
    noindex: true,
  },
  "/customer": {
    title: "Customer Account | DAY NIGHT DELIVERY SERVICES",
    description: "Protected customer order access.",
    noindex: true,
  },
  "/update-password": {
    title: "Update Password | DAY NIGHT DELIVERY SERVICES",
    description: "Secure customer password recovery page.",
    noindex: true,
  },
  "/admin": {
    title: "Admin Operations | DAY NIGHT DELIVERY SERVICES",
    description: "Protected DAY NIGHT administration and operations portal.",
    noindex: true,
  },
  "/auth": {
    title: "Secure Login | DAY NIGHT DELIVERY SERVICES",
    description: "Secure login for authorized DAY NIGHT users.",
    noindex: true,
  },
};

export function usePageSEO() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const trackingDetail = pathname.startsWith("/tracking/") || (pathname === "/tracking" && new URLSearchParams(search).has("code"));
    const routeKey = pathname.startsWith("/tracking/") ? "/tracking" : pathname;
    const meta = routeMeta[routeKey] || {
      title: "DAY NIGHT DELIVERY SERVICES",
      description: "Professional delivery and shipping services in the UAE.",
      noindex: true,
    };
    const noindex = Boolean(meta.noindex || trackingDetail);
    const canonicalPath = trackingDetail ? "/tracking" : routeKey;

    updateMetaTags(meta.title, meta.description, canonicalPath);

    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = noindex
      ? "noindex, nofollow, noarchive"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  }, [pathname, search]);
}

export default usePageSEO;
