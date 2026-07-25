export type DayNightBankId = "adib" | "adcb";

export type DayNightBankAccount = {
  id: DayNightBankId;
  shortName: string;
  bankNameAr: string;
  bankNameEn: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  swift: string;
  currency: "AED";
  logoUrl: string;
  mobileBankingUrl: string;
  websiteUrl: string;
};

export const DAY_NIGHT_BANK_ACCOUNTS: readonly DayNightBankAccount[] = [
  {
    id: "adib",
    shortName: "ADIB",
    bankNameAr: "مصرف أبوظبي الإسلامي",
    bankNameEn: "Abu Dhabi Islamic Bank",
    accountTitle: "MANSOUR ALI ABDELHAMID HASSANIN",
    accountNumber: "28787988",
    iban: "AE450500000000028787988",
    swift: "ABDIAEADXXX",
    currency: "AED",
    logoUrl:
      "https://www.adib.ae/-/media/project/adib/adibsite/header/logo.svg?h=53&hash=410F7C438CB85524DC3E09F61B807495&iar=0&w=269",
    mobileBankingUrl: "https://www.adib.ae/en/personal/services/mobile-banking",
    websiteUrl: "https://www.adib.ae/",
  },
  {
    id: "adcb",
    shortName: "ADCB",
    bankNameAr: "بنك أبوظبي التجاري",
    bankNameEn: "Abu Dhabi Commercial Bank PJSC",
    accountTitle: "MANSOUR ALI ABDELHAMID HASSANIN",
    accountNumber: "13496442920001",
    iban: "AE250030013496442920001",
    swift: "ADCBAEAA",
    currency: "AED",
    logoUrl:
      "https://www.adcb.com/en/Images/ADCB_Master_CMYK_Pos-thumbnail_tcm41-412485.png",
    mobileBankingUrl: "https://www.adcb.com/mobileapp/",
    websiteUrl: "https://www.adcb.com/en/personal/index.aspx",
  },
] as const;

export function getDayNightBank(bankId: string | null | undefined) {
  return (
    DAY_NIGHT_BANK_ACCOUNTS.find((bank) => bank.id === bankId) ||
    DAY_NIGHT_BANK_ACCOUNTS[0]
  );
}

export function normalizeBankId(value: string | null | undefined): DayNightBankId {
  return value === "adcb" ? "adcb" : "adib";
}

export function normalizePaymentMode(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (["bank_transfer", "online", "card", "wallet", "prepaid", "paid", "sender_pays"].includes(normalized)) {
    return "online" as const;
  }
  return "cash" as const;
}

export function paymentModeLabel(mode: "cash" | "online", isArabic: boolean) {
  if (mode === "online") return isArabic ? "تحويل بنكي / دفع أونلاين" : "Bank transfer / online payment";
  return isArabic ? "كاش عند الاستلام" : "Cash on delivery";
}

export function buildBankTransferUrl(input: {
  orderReference?: string | null;
  amount?: number | string | null;
  bank?: DayNightBankId;
  locale?: "ar" | "en";
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://daynightae.com";
  const params = new URLSearchParams();
  const reference = String(input.orderReference || "").trim();
  const amount = Number(input.amount || 0);
  if (reference) params.set("order", reference);
  if (Number.isFinite(amount) && amount > 0) params.set("amount", amount.toFixed(2));
  params.set("bank", input.bank || "adib");
  params.set("lang", input.locale || "ar");
  return `${origin}/payment?${params.toString()}`;
}

export function buildTransferProofWhatsAppUrl(input: {
  orderReference?: string | null;
  amount?: number | string | null;
  bank?: DayNightBankId;
  isArabic?: boolean;
}) {
  const bank = getDayNightBank(input.bank);
  const reference = String(input.orderReference || "").trim() || "—";
  const amount = Number(input.amount || 0);
  const amountText = Number.isFinite(amount) && amount > 0 ? `${amount.toFixed(2)} AED` : "—";
  const message = input.isArabic === false
    ? `Hello DAY NIGHT, I completed a bank transfer.\nOrder: ${reference}\nAmount: ${amountText}\nBank: ${bank.shortName}\nI will attach the transfer receipt.`
    : `السلام عليكم شركة داي نايت، تم تنفيذ تحويل بنكي.\nرقم الطلب: ${reference}\nالمبلغ: ${amountText}\nالبنك: ${bank.shortName}\nسأرفق إيصال التحويل الآن.`;
  return `https://wa.me/971568757331?text=${encodeURIComponent(message)}`;
}

export function bankDetailsText(bank: DayNightBankAccount, isArabic: boolean) {
  return isArabic
    ? `البنك: ${bank.bankNameAr} (${bank.shortName})\nاسم صاحب الحساب: ${bank.accountTitle}\nرقم الحساب: ${bank.accountNumber}\nالآيبان: ${bank.iban}\nالسويفت: ${bank.swift}\nالعملة: ${bank.currency}`
    : `Bank: ${bank.bankNameEn} (${bank.shortName})\nAccount title: ${bank.accountTitle}\nAccount number: ${bank.accountNumber}\nIBAN: ${bank.iban}\nSWIFT: ${bank.swift}\nCurrency: ${bank.currency}`;
}
