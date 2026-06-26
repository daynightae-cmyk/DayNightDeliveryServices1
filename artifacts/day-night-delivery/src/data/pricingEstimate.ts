import { coverageAreas, findCoverageArea, isExtendedCoverage } from "./coverage";

export type QuickEstimate = {
  min: number;
  max: number;
  base: number;
  category: "main" | "extended";
  pickupZone: "main" | "extended";
  deliveryZone: "main" | "extended";
};

export type WeightSurchargeEstimate = {
  min: number;
  max: number;
  billableWeight: number;
  extraBillableKg: number;
  needsCustomQuote: boolean;
  noteEn: string;
  noteAr: string;
};

const MAIN_AREA_PRICE = 30;
const EXTENDED_AREA_PRICE = 50;
const INCLUDED_WEIGHT_KG = 1;
const ESTIMATED_EXTRA_KG_MIN = 3;
const ESTIMATED_EXTRA_KG_MAX = 5;
const CUSTOM_QUOTE_WEIGHT_KG = 20;

export const cityOptions = coverageAreas.map((area) => ({
  value: area.nameEn,
  labelEn: area.nameEn,
  labelAr: area.nameAr,
  zoneType: area.zoneType,
}));

export const cities = cityOptions.map((city) => city.value);

function normalizeCity(value: string | null | undefined) {
  return String(value || "").trim();
}

function zoneForCity(value: string | null | undefined): "main" | "extended" {
  const city = normalizeCity(value);
  const area = findCoverageArea(city);
  if (area) return area.zoneType;
  return isExtendedCoverage(city) ? "extended" : "main";
}

function normalizeWeight(weightKg: number | string | null | undefined) {
  const parsed = Number(weightKg);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.ceil(parsed));
}

export function getCityLabel(value: string, language: "ar" | "en") {
  const area = findCoverageArea(value);
  if (!area) return value;
  return language === "ar" ? area.nameAr : area.nameEn;
}

export function getWeightSurcharge(weightKg: number | string | null): WeightSurchargeEstimate {
  const billableWeight = normalizeWeight(weightKg);
  const extraBillableKg = Math.max(0, billableWeight - INCLUDED_WEIGHT_KG);
  const needsCustomQuote = billableWeight > CUSTOM_QUOTE_WEIGHT_KG;

  if (needsCustomQuote) {
    return {
      min: 0,
      max: 0,
      billableWeight,
      extraBillableKg,
      needsCustomQuote,
      noteEn: "Large shipment. Continue to booking for operations confirmation.",
      noteAr: "شحنة كبيرة. تابع إلى الحجز الكامل لتأكيد السعر تشغيلياً.",
    };
  }

  const min = extraBillableKg * ESTIMATED_EXTRA_KG_MIN;
  const max = extraBillableKg * ESTIMATED_EXTRA_KG_MAX;

  return {
    min,
    max,
    billableWeight,
    extraBillableKg,
    needsCustomQuote,
    noteEn: extraBillableKg > 0
      ? `Billable weight ${billableWeight} kg. Extra weight estimate ${extraBillableKg} kg.`
      : "First kg included in the local delivery base price.",
    noteAr: extraBillableKg > 0
      ? `الوزن المحتسب ${billableWeight} كجم. تقدير الوزن الإضافي ${extraBillableKg} كجم.`
      : "أول كجم داخل ضمن سعر التوصيل المحلي الأساسي.",
  };
}

export function getQuickEstimate(from: string, to: string): QuickEstimate | null {
  const pickupCity = normalizeCity(from);
  const deliveryCity = normalizeCity(to);
  if (!pickupCity || !deliveryCity) return null;

  const pickupZone = zoneForCity(pickupCity);
  const deliveryZone = zoneForCity(deliveryCity);
  const category = pickupZone === "extended" || deliveryZone === "extended" ? "extended" : "main";
  const price = category === "extended" ? EXTENDED_AREA_PRICE : MAIN_AREA_PRICE;

  return {
    min: price,
    max: price,
    base: price,
    category,
    pickupZone,
    deliveryZone,
  };
}
