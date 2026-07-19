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
  url: "https://daynightae.com",
  image: "https://daynightae.com/logo-daynight.png",
};

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let meta = document.querySelector(selector) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function updateCanonical(pathname: string) {
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  const canonicalUrl = new URL(normalizedPath || "/", `${SEO_METADATA.url}/`).toString();
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;
  return canonicalUrl;
}

export function updateMetaTags(title?: string, description?: string, pathname?: string) {
  if (typeof document === "undefined") return;

  const resolvedTitle = title || SEO_METADATA.title;
  const resolvedDescription = description || SEO_METADATA.description;
  const canonicalUrl = updateCanonical(pathname || window.location.pathname || "/");

  document.title = resolvedTitle;
  upsertMeta('meta[name="description"]', "name", "description", resolvedDescription);
  upsertMeta('meta[property="og:title"]', "property", "og:title", resolvedTitle);
  upsertMeta('meta[property="og:description"]', "property", "og:description", resolvedDescription);
  upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
  upsertMeta('meta[property="og:image"]', "property", "og:image", SEO_METADATA.image);
  upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", resolvedTitle);
  upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", resolvedDescription);
  upsertMeta('meta[name="twitter:url"]', "name", "twitter:url", canonicalUrl);
  upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", SEO_METADATA.image);
}
