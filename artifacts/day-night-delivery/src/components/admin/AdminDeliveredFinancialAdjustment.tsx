import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileClock,
  Loader2,
  LockKeyholeOpen,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import type { Order } from "../../types";
import {
  calculateOrderFinancials,
  financialsFromOrder,
  normalizeDeliveryFeeMode,
  type DeliveryFeeMode,
} from "../../lib/orderFinancials";
import { adjustDeliveredOrderFinancials } from "../../lib/adminDeliveredFinancialAdjustment";

const clean = (value: unknown) => String(value ?? "").trim();
const inputClass =
  "w-full rounded-xl border border-white/12 bg-[#04152b] px-3 py-3 text-sm font-black text-white outline-none transition placeholder:text-white/30 focus:border-brand-gold/70 focus:ring-2 focus:ring-brand-gold/15";

function moneyValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function MoneyMetric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <span
      className={`rounded-xl border p-3 text-center text-[10px] font-black ${
        accent
          ? "border-brand-gold/45 bg-brand-gold/12 text-brand-gold"
          : "border-white/10 bg-black/10 text-white/65"
      }`}
    >
      {label}
      <b className="mt-1 block text-base" dir="ltr">{value.toFixed(2)} AED</b>
    </span>
  );
}

export default function AdminDeliveredFinancialAdjustment({
  order,
  isArabic,
  onSaved,
}: {
  order: Order;
  isArabic: boolean;
  onSaved?: (order: Order) => Promise<void> | void;
}) {
  const initial = useMemo(
    () => financialsFromOrder(order as Order & Record<string, unknown>),
    [order],
  );
  const [expanded, setExpanded] = useState(true);
  const [goodsValue, setGoodsValue] = useState<number | string>(initial.goodsValue);
  const [deliveryFee, setDeliveryFee] = useState<number | string>(initial.deliveryFee);
  const [discountAmount, setDiscountAmount] = useState<number | string>(initial.discountAmount);
  const [deliveryFeeMode, setDeliveryFeeMode] = useState<DeliveryFeeMode>(initial.deliveryFeeMode);
  const [paymentMethod, setPaymentMethod] = useState(
    clean(order.payment_method) === "sender_pays" ? "merchant_pays" : clean(order.payment_method || "cod"),
  );
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = financialsFromOrder(order as Order & Record<string, unknown>);
    setGoodsValue(next.goodsValue);
    setDeliveryFee(next.deliveryFee);
    setDiscountAmount(next.discountAmount);
    setDeliveryFeeMode(next.deliveryFeeMode);
    setPaymentMethod(clean(order.payment_method) === "sender_pays" ? "merchant_pays" : clean(order.payment_method || "cod"));
    setReason("");
    setConfirmed(false);
    setMessage("");
    setError("");
  }, [order]);

  const preview = useMemo(() => {
    try {
      const normalizedMode = paymentMethod === "merchant_pays"
        ? "deduct_from_merchant"
        : normalizeDeliveryFeeMode(deliveryFeeMode);
      return calculateOrderFinancials({
        goodsValue,
        deliveryFee,
        discountAmount,
        deliveryFeeMode: normalizedMode,
      });
    } catch {
      return null;
    }
  }, [deliveryFee, deliveryFeeMode, discountAmount, goodsValue, paymentMethod]);

  function choosePayment(value: string) {
    setPaymentMethod(value);
    if (value === "merchant_pays") setDeliveryFeeMode("deduct_from_merchant");
    setMessage("");
    setError("");
  }

  async function saveAdjustment() {
    setMessage("");
    setError("");
    if (!preview) {
      setError(isArabic ? "راجع المبالغ؛ الخصم لا يمكن أن يتجاوز المبلغ المسموح." : "Review the amounts; the discount exceeds the allowed total.");
      return;
    }
    if (clean(reason).length < 6) {
      setError(isArabic ? "اكتب سببًا واضحًا للتعديل المالي لا يقل عن 6 أحرف." : "Enter a clear financial adjustment reason of at least 6 characters.");
      return;
    }
    if (!confirmed) {
      setError(isArabic ? "أكد أنك راجعت أثر التعديل على العميل والتاجر وحساب الشركة." : "Confirm that you reviewed the customer, merchant, and company impact.");
      return;
    }

    setBusy(true);
    try {
      const result = await adjustDeliveredOrderFinancials({
        order,
        goodsValue,
        deliveryFee,
        discountAmount,
        deliveryFeeMode,
        paymentMethod,
        reason,
      });
      const saved = result.order;
      const refreshed = financialsFromOrder(saved as Order & Record<string, unknown>);
      setGoodsValue(refreshed.goodsValue);
      setDeliveryFee(refreshed.deliveryFee);
      setDiscountAmount(refreshed.discountAmount);
      setDeliveryFeeMode(refreshed.deliveryFeeMode);
      setReason("");
      setConfirmed(false);
      setMessage(
        isArabic
          ? `تم حفظ التصحيح المالي فعليًا وتسجيله في سجل التدقيق. رقم العملية: ${result.adjustmentId || "—"}`
          : `The financial correction was saved and audited. Adjustment: ${result.adjustmentId || "—"}`,
      );
      window.dispatchEvent(
        new CustomEvent("dn-admin-orders-updated", {
          detail: { order: saved, source: "audited_financial_adjustment" },
        }),
      );
      await onSaved?.(saved);
    } catch (cause) {
      const detail = clean((cause as any)?.message || (cause as any)?.details || cause);
      setError(
        isArabic
          ? `تعذر حفظ التصحيح المالي في قاعدة البيانات.${detail ? ` السبب: ${detail}` : ""}`
          : `The audited financial correction could not be saved.${detail ? ` Reason: ${detail}` : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-[1.5rem] border border-cyan-300/30 bg-[linear-gradient(135deg,rgba(3,30,58,.95),rgba(8,53,83,.88),rgba(104,79,10,.30))] shadow-[0_18px_50px_rgba(0,0,0,.25)]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-4 text-start"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold">
            <LockKeyholeOpen className="h-5 w-5" />
          </span>
          <span>
            <strong className="block text-sm font-black text-white">
              {isArabic ? "تصحيح مالي مُدقّق للطلب المُسلّم" : "Audited correction for delivered order"}
            </strong>
            <small className="mt-1 block text-[10px] font-bold leading-5 text-white/55">
              {isArabic
                ? "عدّل قيمة البضاعة أو التوصيل أو الخصم، واختر من يتحمل رسوم التوصيل. النظام يعيد حساب العميل والتاجر والشركة ويحفظ سجلًا قبل/بعد."
                : "Edit goods, delivery, discount, and fee owner. Customer, merchant, and company totals are recalculated with a before/after audit record."}
            </small>
          </span>
        </span>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-cyan-200">
          {expanded ? (isArabic ? "إخفاء" : "Hide") : (isArabic ? "فتح" : "Open")}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4 sm:p-5">
          <div className="mb-4 flex gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/8 p-3 text-[11px] font-bold leading-6 text-amber-100">
            <ShieldCheck className="h-5 w-5 shrink-0 text-brand-gold" />
            {isArabic
              ? "هذا ليس فك قفل عشوائيًا. كل تعديل يُحفظ بمعرّف المدير والسبب والقيم السابقة والجديدة، ويحدّث الإجماليات المكررة والتحصيل والترحيل المالي في عملية واحدة."
              : "This is not an unsafe unlock. Every change records the actor, reason, before/after values, and updates duplicated totals, collection, and posting atomically."}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-[11px] font-black text-white/65">
              <span>{isArabic ? "قيمة البضاعة" : "Goods value"}</span>
              <input type="number" min={0} step="0.01" name="dn_delivered_goods_value_no_history_20260805" autoComplete="off" aria-autocomplete="none" inputMode="decimal" data-form-type="other" value={goodsValue} onChange={(event) => setGoodsValue(event.target.value)} className={inputClass} dir="ltr" />
            </label>
            <label className="space-y-1 text-[11px] font-black text-white/65">
              <span>{isArabic ? "سعر التوصيل اليدوي" : "Manual delivery fee"}</span>
              <input type="number" min={0} step="0.01" value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} className={inputClass} dir="ltr" placeholder="1000.00" />
            </label>
            <label className="space-y-1 text-[11px] font-black text-white/65">
              <span>{isArabic ? "الخصم" : "Discount"}</span>
              <input type="number" min={0} step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} className={inputClass} dir="ltr" />
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-[11px] font-black text-white/65">
              <span>{isArabic ? "طريقة التحصيل" : "Payment method"}</span>
              <select value={paymentMethod} onChange={(event) => choosePayment(event.target.value)} className={inputClass}>
                <option value="cod">{isArabic ? "تحصيل من العميل عند التسليم" : "Collect from customer on delivery"}</option>
                <option value="receiver_pays">{isArabic ? "المستلم دفع مسبقًا" : "Receiver prepaid"}</option>
                <option value="merchant_pays">{isArabic ? "على حساب التاجر" : "Merchant account"}</option>
                <option value="prepaid">{isArabic ? "مدفوع مسبقًا" : "Prepaid"}</option>
              </select>
            </label>
            <div className="space-y-1 text-[11px] font-black text-white/65">
              <span>{isArabic ? "من يتحمل رسوم التوصيل؟" : "Who pays delivery?"}</span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={paymentMethod === "merchant_pays"} onClick={() => setDeliveryFeeMode("customer_pays")} className={`rounded-xl border p-3 text-xs font-black ${deliveryFeeMode === "customer_pays" && paymentMethod !== "merchant_pays" ? "border-brand-gold bg-brand-gold text-brand-deep" : "border-white/10 text-white/60 disabled:opacity-40"}`}>{isArabic ? "يُضاف على العميل" : "Customer pays"}</button>
                <button type="button" onClick={() => setDeliveryFeeMode("deduct_from_merchant")} className={`rounded-xl border p-3 text-xs font-black ${deliveryFeeMode === "deduct_from_merchant" || paymentMethod === "merchant_pays" ? "border-brand-gold bg-brand-gold text-brand-deep" : "border-white/10 text-white/60"}`}>{isArabic ? "يُخصم من التاجر" : "Merchant pays"}</button>
              </div>
            </div>
          </div>

          {preview && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MoneyMetric label={isArabic ? "البضاعة" : "Goods"} value={preview.goodsValue} />
              <MoneyMetric label={isArabic ? "التوصيل" : "Delivery"} value={preview.deliveryFee} />
              <MoneyMetric label={isArabic ? "الخصم" : "Discount"} value={preview.discountAmount} />
              <MoneyMetric label={isArabic ? "المطلوب من العميل" : "Customer total"} value={preview.customerTotal} accent />
              <MoneyMetric label={preview.merchantDue < 0 ? (isArabic ? "على التاجر" : "Merchant debit") : (isArabic ? "للتاجر" : "Due to merchant")} value={preview.merchantDue} />
              <MoneyMetric label={isArabic ? "دخل داي نايت" : "DAY NIGHT revenue"} value={preview.companyRevenue} />
            </div>
          )}

          <label className="mt-4 block space-y-1 text-[11px] font-black text-white/65">
            <span className="flex items-center gap-2"><FileClock className="h-4 w-4 text-brand-gold" />{isArabic ? "سبب التعديل المالي — مطلوب للتدقيق" : "Financial adjustment reason — required"}</span>
            <textarea rows={3} maxLength={600} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} placeholder={isArabic ? "مثال: تصحيح سعر التوصيل بعد مراجعة فاتورة الشحن واعتماد الإدارة." : "Example: Corrected delivery fee after invoice review and management approval."} />
          </label>

          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/10 p-3 text-[11px] font-bold leading-6 text-white/70">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#D4AF37]" />
            <span>{isArabic ? "راجعت قيمة البضاعة والتوصيل والخصم، وأفهم أن الحفظ سيحدّث المطلوب من العميل وصافي التاجر ودخل الشركة والتحصيل المسجّل." : "I reviewed goods, delivery, and discount, and understand that saving updates customer total, merchant net, company revenue, and recorded collection."}</span>
          </label>

          {message && <p className="mt-3 flex gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-xs font-black leading-6 text-emerald-100"><CheckCircle2 className="h-5 w-5 shrink-0" />{message}</p>}
          {error && <p className="mt-3 flex gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs font-black leading-6 text-rose-100"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</p>}

          <button type="button" disabled={busy || !preview} onClick={() => void saveAdjustment()} className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-gold to-[#F7D665] px-5 text-sm font-black text-brand-deep shadow-xl disabled:opacity-45">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ReceiptText className="h-5 w-5" />}
            {busy ? (isArabic ? "جارٍ الحفظ والتحقق..." : "Saving and verifying...") : (isArabic ? "حفظ التصحيح المالي الآن" : "Save audited financial correction")}
          </button>
        </div>
      )}
    </section>
  );
}
