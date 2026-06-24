import { calculateDomesticPrice, calculateInternationalPrice } from "./pricing";
import { corporatePricingRules, hazardousSurcharge, packagingFees, promotionRules } from "../data/pricingRules";
import { supabase } from "../supabase";

export type AdvancedPricingInput = {
  type: "domestic" | "international";
  pickupCity?: string;
  deliveryCity?: string;
  destination?: string;
  weightKg: number;
  dimensionsCm?: { length: number; width: number; height: number };
  express?: boolean;
  hazardous?: boolean;
  specialPackaging?: boolean;
  promoCode?: string;
  corporateContractId?: string;
};

function normalizedWeight(weightKg: number) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 1;
  return Math.max(1, Math.ceil(weightKg));
}

function volumetricWeight(dim?: { length: number; width: number; height: number }) {
  if (!dim) return 0;
  const value = (dim.length * dim.width * dim.height) / 5000;
  return Number(value.toFixed(2));
}

function activePromoDiscount(promoCode?: string) {
  if (!promoCode) return 0;
  const now = Date.now();
  const rule = promotionRules.find((p) => p.code.toLowerCase() === promoCode.toLowerCase());
  if (!rule || !rule.active) return 0;
  const starts = new Date(rule.startsAt).getTime();
  const ends = new Date(rule.endsAt).getTime();
  return now >= starts && now <= ends ? rule.discountPercent : 0;
}

function corporateDiscount(contractId?: string) {
  if (!contractId) return 0;
  const rule = corporatePricingRules.find((c) => c.contractId === contractId && c.active);
  return rule ? rule.discountPercent : 0;
}

export function calculateAdvancedPrice(input: AdvancedPricingInput) {
  const physicalWeight = normalizedWeight(input.weightKg);
  const vWeight = volumetricWeight(input.dimensionsCm);
  const billableWeight = Math.max(physicalWeight, Math.ceil(vWeight));

  const base = input.type === "domestic"
    ? calculateDomesticPrice({
      pickupCity: input.pickupCity,
      deliveryCity: input.deliveryCity,
      weight: billableWeight,
      serviceType: input.express ? "express" : "standard"
    })
    : calculateInternationalPrice({
      destination: input.destination,
      weight: billableWeight
    });

  let subtotal = base.subtotal;
  if (input.hazardous) subtotal += hazardousSurcharge;
  if (input.specialPackaging) subtotal += packagingFees.special;

  const bestDiscountPercent = Math.max(activePromoDiscount(input.promoCode), corporateDiscount(input.corporateContractId));
  const discountAmount = Number(((subtotal * bestDiscountPercent) / 100).toFixed(2));
  const discountedSubtotal = Number((subtotal - discountAmount).toFixed(2));
  const total = discountedSubtotal;

  return {
    ...base,
    billableWeight,
    physicalWeight,
    volumetricWeight: vWeight,
    subtotal: discountedSubtotal,
    discountPercent: bestDiscountPercent,
    discountAmount,
    total,
    pricingRulesSource: "pricing_rules",
    breakdown: [
      ...base.breakdown,
      ...(input.hazardous ? [`Hazardous surcharge: ${hazardousSurcharge.toFixed(2)} AED`] : []),
      ...(input.specialPackaging ? [`Special packaging: ${packagingFees.special.toFixed(2)} AED`] : []),
      ...(bestDiscountPercent > 0 ? [`Discount ${bestDiscountPercent}%: -${discountAmount.toFixed(2)} AED`] : []),
      `Total: ${total.toFixed(2)} AED`
    ]
  };
}

export async function syncPricingRulesToSupabase() {
  if (!supabase) return false;

  const payload = [
    ...promotionRules.map((rule) => ({
      pricing_key: `promo_${rule.code.toLowerCase()}`,
      rule_name: rule.title,
      base_price: -Math.abs(rule.discountPercent),
      active: rule.active
    })),
    ...corporatePricingRules.map((rule) => ({
      pricing_key: `corp_${rule.contractId.toLowerCase()}`,
      rule_name: rule.companyName,
      base_price: -Math.abs(rule.discountPercent),
      active: rule.active
    })),
    {
      pricing_key: "hazardous_surcharge",
      rule_name: "Hazardous surcharge",
      base_price: hazardousSurcharge,
      active: true
    },
    {
      pricing_key: "special_packaging",
      rule_name: "Special packaging",
      base_price: packagingFees.special,
      active: true
    }
  ];

  const { error } = await supabase.from("pricing_rules").upsert(payload, { onConflict: "pricing_key" });
  return !error;
}
