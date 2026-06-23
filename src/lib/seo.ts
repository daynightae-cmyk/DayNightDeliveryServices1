/**
 * SEO metadata configurations for DAY NIGHT Delivery Services
 */
export const SEO_METADATA = {
  title: "DAY NIGHT DELIVERY | داي نايت لخدمات التوصيل والشحن",
  description: "داي نايت لخدمات التوصيل والشحن - تغطية شاملة لكافة إمارات الدولة بأسعار تبدأ من 30 درهم وشحن دولي سريع لدول الخليج والعالم على مدار الساعة.",
  keywords: "داي نايت, توصيل داي نايت, شحن دبي, شحن أبوظبي, توصيل العين, توصيل سريع الإمارات, شحن دولي الخليج",
  ogType: "website",
  url: "https://www.daynightae.com",
  image: "/logo-daynight.png"
};

export function updateMetaTags(title?: string, description?: string) {
  if (typeof document === "undefined") return;
  document.title = title || SEO_METADATA.title;
  
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", description || SEO_METADATA.description);
  } else {
    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = description || SEO_METADATA.description;
    document.head.appendChild(meta);
  }
}
