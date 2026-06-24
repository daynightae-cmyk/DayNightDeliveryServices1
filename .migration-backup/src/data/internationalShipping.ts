export type InternationalGuide = {
  code: string;
  country: string;
  eta: string;
  requiredDocuments: string[];
  prohibitedItems: string[];
  insuranceOptionalFee: number;
  specialPackagingFee: number;
};

export const internationalShippingGuides: InternationalGuide[] = [
  {
    code: "SA",
    country: "Saudi Arabia",
    eta: "2-5 days",
    requiredDocuments: ["Commercial invoice", "ID copy for receiver"],
    prohibitedItems: ["Illegal substances", "Unlicensed medicines", "Hazardous liquids"],
    insuranceOptionalFee: 20,
    specialPackagingFee: 15
  },
  {
    code: "US",
    country: "United States",
    eta: "5-10 days",
    requiredDocuments: ["Commercial invoice", "Item declaration", "Receiver phone"],
    prohibitedItems: ["Flammable goods", "Cash and negotiable instruments"],
    insuranceOptionalFee: 35,
    specialPackagingFee: 18
  },
  {
    code: "WORLD",
    country: "Worldwide",
    eta: "7-14 days",
    requiredDocuments: ["Commercial invoice", "Contents declaration"],
    prohibitedItems: ["Dangerous goods", "Restricted customs items"],
    insuranceOptionalFee: 45,
    specialPackagingFee: 20
  }
];
