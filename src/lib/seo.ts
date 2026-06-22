/**
 * SEO metadata configurations for DAY NIGHT Delivery Services
 */
export const SEO_METADATA = {
  title: "DAY NIGHT DELIVERY | Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ§Ù„Ø´Ø­Ù†",
  description: "Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ§Ù„Ø´Ø­Ù† - ØªØºØ·ÙŠØ© Ø´Ø§Ù…Ù„Ø© Ù„ÙƒØ§ÙØ© Ø¥Ù…Ø§Ø±Ø§Øª Ø§Ù„Ø¯ÙˆÙ„Ø© Ø¨Ø£Ø³Ø¹Ø§Ø± ØªØ¨Ø¯Ø£ Ù…Ù† 30 Ø¯Ø±Ù‡Ù… ÙˆØ´Ø­Ù† Ø¯ÙˆÙ„ÙŠ Ø³Ø±ÙŠØ¹ Ù„Ø¯ÙˆÙ„ Ø§Ù„Ø®Ù„ÙŠØ¬ ÙˆØ§Ù„Ø¹Ø§Ù„Ù… Ø¹Ù„Ù‰ Ù…Ø¯Ø§Ø± Ø§Ù„Ø³Ø§Ø¹Ø©.",
  keywords: "Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª, ØªÙˆØµÙŠÙ„ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª, Ø´Ø­Ù† Ø¯Ø¨ÙŠ, Ø´Ø­Ù† Ø£Ø¨ÙˆØ¸Ø¨ÙŠ, ØªÙˆØµÙŠÙ„ Ø§Ù„Ø¹ÙŠÙ†, ØªÙˆØµÙŠÙ„ Ø³Ø±ÙŠØ¹ Ø§Ù„Ø¥Ù…Ø§Ø±Ø§Øª, Ø´Ø­Ù† Ø¯ÙˆÙ„ÙŠ Ø§Ù„Ø®Ù„ÙŠØ¬",
  ogType: "website",
  url: "https://www.daynightae.com",
  image: "https://www.daynightae.com/logo.png"
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

