import { coverageAreas, isExtendedCoverage } from "../data/coverage";
import { CURRENCY, domesticPricing, internationalDestinations, internationalPricing } from "../data/pricingData";

export interface PricingResult {
  subtotal: number;
  total: number;
  currency: string;
  pricingCategory: string;
  billableWeight: number;
  requiresCustomQuote: boolean;
  breakdown: string[];
  notes: string;
}

export type DomesticPriceInput = {
  pickupCity?: string | null;
  deliveryCity?: string | null;
  weight?: number | string | null;
  pieces?: number | string | null;
  serviceType?: "standard" | "express" | string | null;
};

export type InternationalPriceInput = {
  countryCode?: string | null;
  destination?: string | null;
  weight?: number | string | null;
};

export const LOCAL_MAIN_CITY_PRICE = domesticPricing.main.base;
export const LOCAL_EXTENDED_AREA_PRICE = domesticPricing.extended.base;
export const EXPRESS_SURCHARGE = domesticPricing.expressSurcharge.amount;
export const ADDITIONAL_PIECE_SURCHARGE = domesticPricing.additionalPieceSurcharge.amount;
export const GCC_FIRST_KG_PRICE = internationalPricing.gcc.firstKg;
export const GCC_ADDITIONAL_KG_PRICE = internationalPricing.gcc.additionalKg;
export const WORLDWIDE_FIRST_KG_PRICE = internationalPricing.worldwide.firstKg;
export const WORLDWIDE_ADDITIONAL_KG_PRICE = internationalPricing.worldwide.additionalKg;

function normalizeWeight(weight: number | string | null | undefined) {
  const parsed = Number(weight);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(parsed));
}

function normalizePieces(pieces: number | string | null | undefined) {
  const parsed = Number(pieces);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(parsed));
}

export function formatAED(amount: number) {
  return `${Number(amount).toFixed(2)} AED`;
}

export function isExtendedArea(cityArOrEn: string | null | undefined): boolean {
  return isExtendedCoverage(cityArOrEn);
}

function resolveDomesticZone(input: DomesticPriceInput) {
  return isExtendedArea(input.pickupCity) || isExtendedArea(input.deliveryCity) ? "extended" : "main";
}

export function calculateDomesticPrice(input: DomesticPriceInput): PricingResult {
  const billableWeight = normalizeWeight(input.weight);
  const billablePieces = normalizePieces(input.pieces);
  const zone = resolveDomesticZone(input);
  const basePrice = zone === "extended" ? domesticPricing.extended.base : domesticPricing.main.base;
  const express = input.serviceType === "express" ? EXPRESS_SURCHARGE : 0;
  const extraPieceFee = Math.max(0, billablePieces - 1) * ADDITIONAL_PIECE_SURCHARGE;
  const subtotal = basePrice + express + extraPieceFee;
  const total = Number(subtotal.toFixed(2));
  const category = zone === "extended" ? domesticPricing.extended.labelEn : domesticPricing.main.labelEn;
  const requiresCustomQuote = billableWeight > 50 || billablePieces > 20;

  return {
    subtotal,
    total,
    currency: CURRENCY,
    pricingCategory: category,
    billableWeight,
    requiresCustomQuote,
    breakdown: [
      `${category}: ${formatAED(basePrice)}`,
      ...(express ? [`Express surcharge: ${formatAED(express)}`] : []),
      ...(extraPieceFee ? [`Additional pieces: ${formatAED(ADDITIONAL_PIECE_SURCHARGE)} x ${billablePieces - 1}`] : [])
    ],
    notes: requiresCustomQuote
      ? "Large shipments may require operational confirmation before pickup."
      : zone === "extended"
        ? "Extended UAE area delivery price."
        : "Main UAE city delivery price."
  };
}

function resolveInternationalDestination(input: InternationalPriceInput) {
  const raw = (input.countryCode || input.destination || "").trim().toLowerCase();
  return internationalDestinations.find((destination) => {
    return destination.countryCode.toLowerCase() === raw ||
      destination.countryNameEn.toLowerCase() === raw ||
      destination.countryNameAr.toLowerCase() === raw;
  }) || internationalDestinations.find((destination) => destination.countryCode === "WORLD")!;
}

export function calculateInternationalPrice(inputOrDestination: InternationalPriceInput | string, weightKg?: number): PricingResult {
  const input = typeof inputOrDestination === "string"
    ? { destination: inputOrDestination, weight: weightKg }
    : inputOrDestination;
  const destination = resolveInternationalDestination(input);
  const billableWeight = normalizeWeight(input.weight);
  const firstKg = destination.firstKg;
  const additionalKg = destination.additionalKg;
  const subtotal = firstKg + ((billableWeight - 1) * additionalKg);
  const total = Number(subtotal.toFixed(2));
  const requiresCustomQuote = billableWeight > 70;

  return {
    subtotal,
    total,
    currency: CURRENCY,
    pricingCategory: destination.region,
    billableWeight,
    requiresCustomQuote,
    breakdown: [
      `First kg: ${formatAED(firstKg)}`,
      `Additional kg: ${formatAED(additionalKg)} x ${Math.max(0, billableWeight - 1)}`
    ],
    notes: `${destination.countryNameEn} shipping estimate. Estimated delivery: ${destination.estimatedDays}.`
  };
}

export function calculateLocalPrice(cityArOrEn: string, weightKg: number): PricingResult {
  return calculateDomesticPrice({
    deliveryCity: cityArOrEn,
    weight: weightKg,
    serviceType: "standard"
  });
}

export function getCoverageOptions() {
  return coverageAreas.map((area) => ({
    value: area.nameEn,
    labelEn: area.nameEn,
    labelAr: area.nameAr,
    zoneType: area.zoneType
  }));
}
