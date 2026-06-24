/**
 * SEO metadata configurations for DAY NIGHT DELIVERY SERVICES.
 */
export const SEO_METADATA = {
  title: "DAY NIGHT DELIVERY SERVICES | داي نايت لخدمات التوصيل والشحن",
  description:
    "DAY NIGHT DELIVERY SERVICES - داي نايت لخدمات التوصيل والشحن في الإمارات. توصيل محلي، شحن دولي، دعم 24/7، وأسعار واضحة عبر daynightae.com.",
  keywords:
    "DAY NIGHT DELIVERY SERVICES, داي نايت لخدمات التوصيل والشحن, daynightae.com, UAE delivery, Abu Dhabi delivery, international shipping",
  ogType: "website",
  url: "https://www.daynightae.com",
  image: "https://www.daynightae.com/logo-daynight.png"
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
