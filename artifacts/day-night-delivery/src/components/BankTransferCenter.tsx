import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  Banknote,
  Building2,
  Check,
  ClipboardCopy,
  ExternalLink,
  Landmark,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import {
  DAY_NIGHT_BANK_ACCOUNTS,
  bankDetailsText,
  buildCashConfirmationWhatsAppUrl,
  buildTransferProofWhatsAppUrl,
  getDayNightBank,
  normalizeBankId,
  normalizeCustomerPaymentMode,
  type CustomerPaymentMode,
  type DayNightBankId,
} from "../config/bankTransfer";

function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-sky/25 bg-brand-sky/10 px-3 text-xs font-black text-brand-sky transition hover:border-brand-gold/50 hover:text-brand-gold">
      {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

export default function BankTransferCenter() {
  const { language, theme } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const isArabic = (searchParams.get("lang") || language) !== "en";
  const isLight = theme === "light";
  const reference = String(searchParams.get("order") || "").trim();
  const amount = Number(searchParams.get("amount") || 0);
  const selectedMode = normalizeCustomerPaymentMode(searchParams.get("mode"));
  const selectedBankId = normalizeBankId(searchParams.get("bank"));
  const selectedBank = useMemo(() => getDayNightBank(selectedBankId), [selectedBankId]);
  const details = bankDetailsText(selectedBank, isArabic);

  function setMode(mode: CustomerPaymentMode) {
    const next = new URLSearchParams(searchParams);
    next.set("mode", mode);
    next.set("lang", isArabic ? "ar" : "en");
    setSearchParams(next, { replace: true });
  }

  function selectBank(bank: DayNightBankId) {
    const next = new URLSearchParams(searchParams);
    next.set("mode", "online");
    next.set("bank", bank);
    next.set("lang", isArabic ? "ar" : "en");
    setSearchParams(next, { replace: true });
  }

  return (
    <section className={`mx-auto max-w-6xl rounded-[2.4rem] border p-4 shadow-2xl sm:p-7 ${isLight ? "border-[#071A33]/10 bg-white/88 text-[#071A33]" : "border-white/10 bg-gradient-to-br from-[#06162b] via-[#08233f] to-[#0a3559] text-white"}`} dir={isArabic ? "rtl" : "ltr"}>
      <header className="grid gap-5 rounded-[2rem] border border-brand-gold/30 bg-brand-gold/10 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-brand-gold"><ShieldCheck className="h-4 w-4" /> DAY NIGHT SECURE PAYMENT</span>
          <h1 className="mt-2 text-2xl font-black sm:text-4xl">{isArabic ? "مركز دفع الشحنات الآمن" : "Secure shipment payment center"}</h1>
          <p className={`mt-3 max-w-3xl text-sm font-bold leading-7 ${isLight ? "text-[#071A33]/65" : "text-white/65"}`}>
            {isArabic
              ? "اختر الدفع كاش عند الاستلام أو التحويل الأونلاين إلى أحد حسابات DAY NIGHT الرسمية. جميع بيانات الطلب والمبلغ تنتقل تلقائيًا داخل الرابط."
              : "Choose cash on delivery or an online transfer to an official DAY NIGHT bank account. The order reference and amount are carried automatically in the link."}
          </p>
        </div>
        <div className="grid min-w-[220px] gap-2 rounded-2xl border border-brand-gold/30 bg-black/10 p-4 text-center">
          <small className="font-black text-brand-gold">{isArabic ? "بيانات العملية" : "Payment details"}</small>
          <strong className="text-lg font-black" dir="ltr">{reference || (isArabic ? "بدون رقم طلب" : "No order reference")}</strong>
          <strong className="text-2xl font-black text-emerald-400" dir="ltr">{Number.isFinite(amount) && amount > 0 ? `${amount.toFixed(2)} AED` : (isArabic ? "حدد المبلغ" : "Enter amount")}</strong>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setMode("cash")} className={`min-h-20 rounded-[1.6rem] border p-4 text-sm font-black transition ${selectedMode === "cash" ? "border-brand-gold bg-brand-gold text-[#071A33] shadow-lg" : isLight ? "border-[#071A33]/10 bg-[#F4F8FF]" : "border-white/10 bg-white/[0.045]"}`}>
          <Banknote className="mx-auto mb-2 h-6 w-6" />
          {isArabic ? "كاش عند الاستلام" : "Cash on delivery"}
        </button>
        <button type="button" onClick={() => setMode("online")} className={`min-h-20 rounded-[1.6rem] border p-4 text-sm font-black transition ${selectedMode === "online" ? "border-emerald-400 bg-emerald-400 text-[#05251c] shadow-lg" : isLight ? "border-[#071A33]/10 bg-[#F4F8FF]" : "border-white/10 bg-white/[0.045]"}`}>
          <Landmark className="mx-auto mb-2 h-6 w-6" />
          {isArabic ? "دفع أونلاين" : "Pay online"}
        </button>
      </div>

      {selectedMode === "cash" ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className={`rounded-[2rem] border p-5 ${isLight ? "border-[#071A33]/10 bg-[#F8FAFF]" : "border-white/10 bg-black/10"}`}>
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-8 w-8 shrink-0 text-brand-gold" />
              <div>
                <h2 className="text-xl font-black">{isArabic ? "تم اختيار الدفع كاش عند الاستلام" : "Cash on delivery selected"}</h2>
                <p className={`mt-2 text-sm font-bold leading-7 ${isLight ? "text-[#071A33]/65" : "text-white/65"}`}>
                  {isArabic
                    ? "جهّز المبلغ المسجل عند وصول المندوب. اضغط زر التأكيد لإرسال رقم الطلب والمبلغ وطريقة الدفع إلى خدمة عملاء DAY NIGHT."
                    : "Prepare the recorded amount when the driver arrives. Confirm the order number, amount, and payment method with DAY NIGHT support."}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className={`rounded-2xl border p-4 ${isLight ? "border-[#071A33]/10 bg-white" : "border-white/10 bg-white/[0.04]"}`}><dt className="text-[10px] font-black text-brand-gold">{isArabic ? "رقم الطلب" : "Order"}</dt><dd className="mt-1 font-black" dir="ltr">{reference || "—"}</dd></div>
              <div className={`rounded-2xl border p-4 ${isLight ? "border-[#071A33]/10 bg-white" : "border-white/10 bg-white/[0.04]"}`}><dt className="text-[10px] font-black text-brand-gold">{isArabic ? "المبلغ" : "Amount"}</dt><dd className="mt-1 font-black" dir="ltr">{Number.isFinite(amount) && amount > 0 ? `${amount.toFixed(2)} AED` : "—"}</dd></div>
            </dl>
          </article>
          <aside className="space-y-3 rounded-[2rem] border border-[#25D366]/25 bg-[#25D366]/10 p-5">
            <MessageCircle className="h-9 w-9 text-[#25D366]" />
            <h2 className="text-lg font-black">{isArabic ? "تأكيد اختيار الكاش" : "Confirm cash selection"}</h2>
            <p className={`text-xs font-bold leading-6 ${isLight ? "text-[#071A33]/65" : "text-white/65"}`}>
              {isArabic ? "يفتح واتساب برسالة جاهزة تحتوي رقم الطلب والمبلغ وطريقة الدفع." : "Opens WhatsApp with a ready message containing the order, amount, and payment method."}
            </p>
            <a href={buildCashConfirmationWhatsAppUrl({ orderReference: reference, amount, isArabic })} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-sm font-black text-[#05251c]">
              <MessageCircle className="h-5 w-5" />
              {isArabic ? "تأكيد الدفع كاش عبر واتساب" : "Confirm cash payment on WhatsApp"}
            </a>
          </aside>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {DAY_NIGHT_BANK_ACCOUNTS.map((bank) => {
              const active = bank.id === selectedBankId;
              return (
                <button key={bank.id} type="button" onClick={() => selectBank(bank.id)} className={`relative overflow-hidden rounded-[1.8rem] border p-5 text-start transition ${active ? "border-brand-gold bg-brand-gold/12 shadow-[0_18px_48px_rgba(212,175,55,0.16)]" : isLight ? "border-[#071A33]/10 bg-[#F4F8FF] hover:border-brand-gold/40" : "border-white/10 bg-white/[0.045] hover:border-brand-gold/40"}`}>
                  {active && <BadgeCheck className="absolute end-4 top-4 h-6 w-6 text-brand-gold" />}
                  <div className="flex min-h-16 items-center gap-4">
                    <div className="grid h-16 w-32 place-items-center overflow-hidden rounded-2xl bg-white p-2 shadow-inner"><img src={bank.logoUrl} alt={`${bank.shortName} logo`} className="max-h-12 max-w-full object-contain" /></div>
                    <div><strong className="block text-xl font-black">{bank.shortName}</strong><span className={`text-xs font-bold ${isLight ? "text-[#071A33]/55" : "text-white/55"}`}>{isArabic ? bank.bankNameAr : bank.bankNameEn}</span></div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
            <article className={`rounded-[2rem] border p-5 ${isLight ? "border-[#071A33]/10 bg-[#F8FAFF]" : "border-white/10 bg-black/10"}`}>
              <div className="flex items-center justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">{selectedBank.shortName}</span><h2 className="mt-1 text-xl font-black">{isArabic ? "بيانات حساب الشركة" : "Company account details"}</h2></div><Landmark className="h-8 w-8 text-brand-gold" /></div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {[[isArabic ? "اسم صاحب الحساب" : "Account title", selectedBank.accountTitle],[isArabic ? "رقم الحساب" : "Account number", selectedBank.accountNumber],[isArabic ? "رقم الآيبان" : "IBAN", selectedBank.iban],[isArabic ? "السويفت" : "SWIFT", selectedBank.swift],[isArabic ? "العملة" : "Currency", selectedBank.currency],[isArabic ? "مرجع التحويل" : "Transfer reference", reference || "DAY NIGHT"]].map(([label, value]) => <div key={label} className={`rounded-2xl border p-3 ${isLight ? "border-[#071A33]/10 bg-white" : "border-white/10 bg-white/[0.04]"}`}><dt className={`text-[10px] font-black ${isLight ? "text-[#071A33]/45" : "text-white/45"}`}>{label}</dt><dd className="mt-1 break-all text-sm font-black" dir="ltr">{value}</dd></div>)}
              </dl>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <CopyButton value={selectedBank.iban} label={isArabic ? "نسخ الآيبان" : "Copy IBAN"} copiedLabel={isArabic ? "تم نسخ الآيبان" : "IBAN copied"} />
                <CopyButton value={selectedBank.accountNumber} label={isArabic ? "نسخ رقم الحساب" : "Copy account"} copiedLabel={isArabic ? "تم النسخ" : "Copied"} />
                <CopyButton value={reference || "DAY NIGHT"} label={isArabic ? "نسخ مرجع الطلب" : "Copy reference"} copiedLabel={isArabic ? "تم النسخ" : "Copied"} />
                <CopyButton value={details} label={isArabic ? "نسخ كل البيانات" : "Copy all details"} copiedLabel={isArabic ? "تم نسخ البيانات" : "Details copied"} />
              </div>
            </article>

            <aside className="space-y-3 rounded-[2rem] border border-emerald-400/25 bg-emerald-400/10 p-5">
              <div className="flex items-center gap-3"><Smartphone className="h-8 w-8 text-emerald-400" /><div><span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">MOBILE BANKING</span><h2 className="text-lg font-black">{isArabic ? "أكمل التحويل من تطبيق البنك" : "Complete in your banking app"}</h2></div></div>
              <p className={`text-xs font-bold leading-6 ${isLight ? "text-[#071A33]/65" : "text-white/65"}`}>{isArabic ? "لأسباب أمنية لا يقوم الموقع بتنفيذ التحويل نيابة عنك. الزر يفتح الصفحة الرسمية لتطبيق البنك، ثم انسخ الآيبان والمبلغ داخل التطبيق." : "For security, the website does not execute the transfer. The button opens the bank's official mobile-banking page; copy the IBAN and amount into your app."}</p>
              <a href={selectedBank.mobileBankingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-[#05251c] shadow-lg"><Smartphone className="h-5 w-5" />{isArabic ? `فتح تطبيق ${selectedBank.shortName}` : `Open ${selectedBank.shortName} app`}<ExternalLink className="h-4 w-4" /></a>
              <a href={buildTransferProofWhatsAppUrl({ orderReference: reference, amount, bank: selectedBank.id, isArabic })} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-sm font-black text-[#05251c]"><MessageCircle className="h-5 w-5" />{isArabic ? "إرسال إيصال التحويل" : "Send transfer receipt"}</a>
              <div className={`rounded-2xl border p-3 text-xs font-bold leading-6 ${isLight ? "border-[#071A33]/10 bg-white" : "border-white/10 bg-black/10"}`}><ReceiptText className="mb-2 h-5 w-5 text-brand-gold" />{isArabic ? "بعد التحويل أرسل صورة الإيصال مع رقم الطلب. لا تُرسل كلمة مرور أو رمز OTP أو بيانات البطاقة لأي شخص." : "After payment, send the receipt with the order number. Never share a password, OTP, or card credentials."}</div>
            </aside>
          </div>
        </>
      )}

      <footer className={`mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-xs font-bold ${isLight ? "border-[#071A33]/10 bg-[#F4F8FF] text-[#071A33]/65" : "border-white/10 bg-white/[0.04] text-white/60"}`}>
        <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-gold" /> DAY NIGHT DELIVERY SERVICES</span>
        <span>{isArabic ? "الدفع متاح كاش أو تحويل بنكي بالدرهم الإماراتي AED" : "Payment is available by cash or AED bank transfer"}</span>
      </footer>
    </section>
  );
}
