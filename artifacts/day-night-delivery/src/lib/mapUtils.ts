import { defaultLocations } from "../data/defaultLocations";

export type LatLngTuple = [number, number];
export type CityPoint = { labelEn: string; labelAr: string; lat: number; lng: number };

export const uaeCityPoints: Record<string, CityPoint> = {
  "abu dhabi": defaultLocations.abuDhabi,
  "أبوظبي": defaultLocations.abuDhabi,
  "ابوظبي": defaultLocations.abuDhabi,
  abudhabi: defaultLocations.abuDhabi,
  mussafah: defaultLocations.mussafah,
  "مصفح": defaultLocations.mussafah,
  dubai: defaultLocations.dubai,
  "دبي": defaultLocations.dubai,
  sharjah: defaultLocations.sharjah,
  "الشارقة": defaultLocations.sharjah,
  ajman: { labelEn: "Ajman", labelAr: "عجمان", lat: 25.4052, lng: 55.5136 },
  "عجمان": { labelEn: "Ajman", labelAr: "عجمان", lat: 25.4052, lng: 55.5136 },
  "umm al quwain": { labelEn: "Umm Al Quwain", labelAr: "أم القيوين", lat: 25.5647, lng: 55.5552 },
  "أم القيوين": { labelEn: "Umm Al Quwain", labelAr: "أم القيوين", lat: 25.5647, lng: 55.5552 },
  "ras al khaimah": { labelEn: "Ras Al Khaimah", labelAr: "رأس الخيمة", lat: 25.8007, lng: 55.9762 },
  "رأس الخيمة": { labelEn: "Ras Al Khaimah", labelAr: "رأس الخيمة", lat: 25.8007, lng: 55.9762 },
  fujairah: { labelEn: "Fujairah", labelAr: "الفجيرة", lat: 25.1288, lng: 56.3265 },
  "الفجيرة": { labelEn: "Fujairah", labelAr: "الفجيرة", lat: 25.1288, lng: 56.3265 },
  khorfakkan: { labelEn: "Khorfakkan", labelAr: "خورفكان", lat: 25.3313, lng: 56.3410 },
  "خورفكان": { labelEn: "Khorfakkan", labelAr: "خورفكان", lat: 25.3313, lng: 56.3410 },
  "al ain": defaultLocations.alAin,
  "العين": defaultLocations.alAin,
  "al dhafra": { labelEn: "Al Dhafra", labelAr: "الظفرة", lat: 23.6574, lng: 53.7052 },
  "الظفرة": { labelEn: "Al Dhafra", labelAr: "الظفرة", lat: 23.6574, lng: 53.7052 },
  liwa: { labelEn: "Liwa", labelAr: "ليوا", lat: 23.1336, lng: 53.7726 },
  "ليوا": { labelEn: "Liwa", labelAr: "ليوا", lat: 23.1336, lng: 53.7726 },
  ruwais: { labelEn: "Al Ruwais", labelAr: "الرويس", lat: 24.1103, lng: 52.7306 },
  "الرويس": { labelEn: "Al Ruwais", labelAr: "الرويس", lat: 24.1103, lng: 52.7306 },
};

export function getOrderString(order: any, keys: string[]) {
  for (const key of keys) {
    const raw = order?.[key];
    if (raw !== null && raw !== undefined && String(raw).trim()) return String(raw).trim();
  }
  return "";
}

export function getOrderNumber(order: any, keys: string[]) {
  for (const key of keys) {
    const raw = order?.[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function resolveUaePoint(city?: string | null, fallback: CityPoint = defaultLocations.abuDhabi) {
  const raw = String(city || "").trim().toLowerCase();
  if (uaeCityPoints[raw]) return uaeCityPoints[raw];
  const loose = Object.entries(uaeCityPoints).find(([key]) => raw.includes(key) || (raw.length > 2 && key.includes(raw)));
  return loose?.[1] || fallback;
}

export function interpolatePoint(a: LatLngTuple, b: LatLngTuple, t: number): LatLngTuple {
  const safe = Math.max(0, Math.min(1, t));
  return [Number((a[0] + (b[0] - a[0]) * safe).toFixed(6)), Number((a[1] + (b[1] - a[1]) * safe).toFixed(6))];
}

export function progressFromStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (value.includes("deliver")) return 0.92;
  if (value.includes("out")) return 0.74;
  if (value.includes("transit") || value.includes("route")) return 0.58;
  if (value.includes("pickup") || value.includes("picked")) return 0.34;
  if (value.includes("assign") || value.includes("confirm")) return 0.18;
  return 0.12;
}

export function getOrderReference(order: any) {
  return getOrderString(order, ["tracking_code", "tracking_number", "invoice_number", "coupon_number", "id"]) || "DAY NIGHT";
}

export function getOrderRouteCities(order: any) {
  return {
    pickupCity: getOrderString(order, ["sender_city", "pickup_city", "origin_city", "from_city"]) || "Mussafah",
    deliveryCity: getOrderString(order, ["receiver_city", "delivery_city", "destination_city", "to_city"]) || "Abu Dhabi",
  };
}
