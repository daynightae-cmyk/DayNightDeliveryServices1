export type PromotionRule = {
  code: string;
  title: string;
  discountPercent: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

export type CorporatePricingRule = {
  contractId: string;
  companyName: string;
  discountPercent: number;
  active: boolean;
};

export const promotionRules: PromotionRule[] = [
  {
    code: "WELCOME10",
    title: "Welcome 10%",
    discountPercent: 10,
    active: true,
    startsAt: "2026-01-01T00:00:00Z",
    endsAt: "2026-12-31T23:59:59Z"
  }
];

export const corporatePricingRules: CorporatePricingRule[] = [
  {
    contractId: "CORP-DN-001",
    companyName: "Enterprise Contract",
    discountPercent: 12,
    active: true
  }
];

export const packagingFees = {
  standard: 0,
  special: 12
};

export const hazardousSurcharge = 25;
