import { useMemo, useState } from "react";
import { Banknote, BadgeCheck, ExternalLink, Landmark, MessageCircle, ShieldCheck } from "lucide-react";
import {
  DAY_NIGHT_BANK_ACCOUNTS,
  buildCashConfirmationWhatsAppUrl,
  buildCustomerPaymentUrl,
  normalizeBankId,
  normalizePaymentMode,
  type CustomerPaymentMode,
  type DayNightBankId,
} from "../../config/bankTransfer";

type Props = {
  orderReference: string;
  amount: number;
  recordedPaymentMethod?: string | null;
  isArabic: boolean;
  isLight: boolean;
};

function formatAmount(amount: number, isArabic: boolean) {
  return new Intl.NumberFormat(isArabic ? "ar-AE" : "en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default function CustomerPaymentActions({
  orderReference,
  amount,
  recordedPaymentMethod,
  isArabic,
  isLight,
}: Props) {
  const [mode, setMode] = useState<CustomerPaymentMode>(() => normalizePaymentMode(recordedPaymentMethod));
  const [bankId, setBankId] = useState<DayNightBankId>("adib");
  const selectedBank = useMemo(
    () => DAY_NIGHT_BANK_ACCOUNTS.find((bank) => bank.id === normalizeBankId(bankId)) || DAY_NIGHT_BANK_ACCOUNTS[0],
    [bankId],
  );

  const paymentUrl = buildCustomerPaymentUrl({
    orderReference,
    amount,
    bank: bankId,
    mode: "online",
    locale: isArabic ? "ar" : "en",
  });
  const cashConfirmationUrl = buildCashConfirmationWhatsAppUrl({
    orderReference,
    amount,
    isArabic,
  });

  return (
    <section
      className={`rounded-3xl border p-4 sm:p-5 ${
        isLight
          ? "border-[#071A33]/10 bg-white/92 text-[#071A33]"
          : "border-white/10 bg-gradient-to-br from-[#071A33]/95 to-[#0A3153]/92 text-white"
      }`}
      aria-label={isArabic ? "خيارات دفع الشحنة" : "Shipment payment options"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">
            <ShieldCheck className="h-4 w-4" /> DAY NIGHT SECURE PAYMENT
          </span>
          <h3 className="mt-1 text-lg font-black sm:text-xl">
            {isArabic ? "اختر طريقة دفع الشحنة" : "Choose your shipment payment method"}
          </h3>
          <p className={`mt-1 text-xs font-bold leading-6 ${isLight ? "text-[#071A33]/60" : "text-white/60"}`}>
            {isArabic
              ? "يمكنك تأكيد الدفع كاش عند الاستلام أو اختيار التحويل الأونلاين إلى أحد حسابات الشركة الرسمية."
              : "Confirm cash on delivery or choose an online bank transfer to an official DAY NIGHT account."}
          </p>
        </div>
        <div className="rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-center">
          <small className="block text-[10px] font-black text-brand-gold">{isArabic ? "المبلغ المسجل" : "Recorded amount"}</small>
          <strong className="mt-1 block text-lg font-black" dir="ltr">{formatAmount(amount, isArabic)} AED</strong>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("cash")}
          className={`min-h-16 rounded-2xl border px-3 py-3 text-sm font-black transition ${
            mode === "cash"
              ? "border-brand-gold bg-brand-gold text-[#071A33] shadow-lg"
              : isLight
                ? "border-[#071A33]/10 bg-[#F4F8FF] text-[#071A33]"
                : "border-white/10 bg-white/[0.05] text-white"
          }`}
        >
          <Banknote className="mx-auto mb-1 h-5 w-5" />
          {isArabic ? "كاش عند الاستلام" : "Cash on delivery"}
        </button>
        <button
          type="button"
          onClick={() => setMode("online")}
          className={`min-h-16 rounded-2xl border px-3 py-3 text-sm font-black transition ${
            mode === "online"
              ? "border-emerald-400 bg-emerald-400 text-[#05251c] shadow-lg"
              : isLight
                ? "border-[#071A33]/10 bg-[#F4F8FF] text-[#071A33]"
                : "border-white/10 bg-white/[0.05] text-white"
          }`}
        >
          <Landmark className="mx-auto mb-1 h-5 w-5" />
          {isArabic ? "دفع أونلاين" : "Pay online"}
        </button>
      </div>

      {mode === "cash" ? (
        <div className="mt-4 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-4">
          <div className="flex items-start gap-3">
            <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand-gold" />
            <div>
              <strong className="block text-sm font-black">{isArabic ? "الدفع كاش عند الاستلام" : "Cash on delivery selected"}</strong>
              <p className={`mt-1 text-xs font-bold leading-6 ${isLight ? "text-[#071A33]/60" : "text-white/60"}`}>
                {isArabic
                  ? "جهّز المبلغ المسجل عند وصول المندوب. يمكنك إرسال تأكيد الاختيار إلى خدمة العملاء بضغطة واحدة."
                  : "Prepare the recorded amount when the driver arrives. Confirm your choice with DAY NIGHT support in one tap."}
              </p>
            </div>
          </div>
          <a
            href={cashConfirmationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-sm font-black text-[#05251c]"
          >
            <MessageCircle className="h-5 w-5" />
            {isArabic ? "تأكيد الدفع كاش عبر واتساب" : "Confirm cash payment on WhatsApp"}
          </a>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {DAY_NIGHT_BANK_ACCOUNTS.map((bank) => {
              const active = bank.id === bankId;
              return (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => setBankId(bank.id)}
                  className={`relative flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-start transition ${
                    active
                      ? "border-brand-gold bg-brand-gold/12"
                      : isLight
                        ? "border-[#071A33]/10 bg-[#F4F8FF]"
                        : "border-white/10 bg-white/[0.05]"
                  }`}
                >
                  <span className="grid h-12 w-24 place-items-center overflow-hidden rounded-xl bg-white p-2">
                    <img src={bank.logoUrl} alt={`${bank.shortName} logo`} className="max-h-9 max-w-full object-contain" />
                  </span>
                  <span>
                    <strong className="block text-sm font-black">{bank.shortName}</strong>
                    <small className={isLight ? "text-[#071A33]/55" : "text-white/55"}>
                      {isArabic ? bank.bankNameAr : bank.bankNameEn}
                    </small>
                  </span>
                  {active && <BadgeCheck className="absolute end-3 top-3 h-5 w-5 text-brand-gold" />}
                </button>
              );
            })}
          </div>
          <a
            href={paymentUrl}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-[#05251c] shadow-lg"
          >
            <Landmark className="h-5 w-5" />
            {isArabic ? `فتح الدفع عبر ${selectedBank.shortName}` : `Continue with ${selectedBank.shortName}`}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}
    </section>
  );
}
