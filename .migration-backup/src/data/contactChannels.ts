import companyMeta from "./companyMeta";

export const contactChannels = [
  {
    id: "whatsapp",
    type: "whatsapp",
    labelEn: "WhatsApp Support",
    labelAr: "دعم واتساب",
    value: companyMeta.phone,
    href: companyMeta.whatsappUrl,
    primary: true
  },
  {
    id: "phone",
    type: "phone",
    labelEn: "Phone",
    labelAr: "الهاتف",
    value: companyMeta.phone,
    href: `tel:${companyMeta.phone.replace(/\s/g, "")}`,
    primary: true
  },
  {
    id: "email",
    type: "email",
    labelEn: "Email",
    labelAr: "البريد الإلكتروني",
    value: companyMeta.email,
    href: `mailto:${companyMeta.email}`,
    primary: true
  },
  {
    id: "website",
    type: "website",
    labelEn: "Website",
    labelAr: "الموقع الإلكتروني",
    value: companyMeta.domain,
    href: companyMeta.domain,
    primary: true
  },
  {
    id: "address",
    type: "address",
    labelEn: "Address",
    labelAr: "العنوان",
    value: companyMeta.addressEn,
    href: companyMeta.mapUrl,
    primary: false
  }
];
