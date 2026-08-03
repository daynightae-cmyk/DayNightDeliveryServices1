import { useRef, useState, type FormEvent } from "react";
import type { Merchant, Order } from "../../types";
import {
  findCouponConflict,
  type CouponConflict,
} from "../../lib/orderFinancialOperations";
import AdminNewOrderComplete from "./AdminNewOrderComplete";

type AdminNewOrderCouponGuardProps = {
  isArabic: boolean;
  merchants: Merchant[];
  orders: Order[];
  onSaved?: (order: Order) => void;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function duplicateCouponMessage(
  conflict: CouponConflict,
  requestedCoupon: string,
  isArabic: boolean,
) {
  const coupon = clean(conflict.coupon_number || requestedCoupon) || requestedCoupon;
  const tracking = clean(conflict.tracking_number || conflict.order_id) || "غير محدد";
  const merchant = clean(conflict.merchant_name) || "غير محدد";
  const receiver = clean(conflict.receiver_name);

  if (!isArabic) {
    return `Coupon “${coupon}” is already registered on order ${tracking} for merchant ${merchant}${receiver ? ` and receiver ${receiver}` : ""}. Duplicate coupon numbers are not allowed. Open the existing order from All Orders or use a new coupon number.`;
  }

  return `رقم الكوبون «${coupon}» مسجل بالفعل على الطلب ${tracking} للتاجر ${merchant}${receiver ? `، والمستلم ${receiver}` : ""}. لا يمكن تكرار رقم الكوبون. افتح الطلب الموجود من صفحة كافة الطلبات أو استخدم رقم كوبون جديدًا.`;
}

export default function AdminNewOrderCouponGuard(
  props: AdminNewOrderCouponGuardProps,
) {
  const bypassNextSubmit = useRef(false);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");

  async function handleSubmitCapture(event: FormEvent<HTMLDivElement>) {
    if (bypassNextSubmit.current) {
      bypassNextSubmit.current = false;
      setCouponError("");
      return;
    }

    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const couponInput = form.querySelector<HTMLInputElement>(
      "[data-admin-next-order-focus='true']",
    );
    const coupon = clean(couponInput?.value);

    // Empty-field validation remains owned by the complete production form.
    if (!coupon) return;

    event.preventDefault();
    event.stopPropagation();
    if (checkingCoupon) return;

    setCheckingCoupon(true);
    setCouponError("");

    try {
      const conflict = await findCouponConflict(coupon);
      if (conflict) {
        setCouponError(duplicateCouponMessage(conflict, coupon, props.isArabic));
        couponInput?.focus();
        return;
      }

      // The authoritative preflight passed. Continue through the original form once.
      bypassNextSubmit.current = true;
      form.requestSubmit();
    } catch (cause) {
      const detail = cause instanceof Error ? clean(cause.message) : "";
      setCouponError(
        detail ||
          (props.isArabic
            ? "تعذر التحقق من رقم الكوبون بأمان. لم يتم حفظ الطلب. أعد المحاولة."
            : "The coupon number could not be verified safely. The order was not saved. Try again."),
      );
      couponInput?.focus();
    } finally {
      setCheckingCoupon(false);
    }
  }

  function handleSaved(order: Order) {
    setCouponError("");

    // The complete merchant and personal forms already clear their editable
    // fields and focus the first field for the next order. Publish the saved row
    // to open admin workspaces, but deliberately do not call the legacy parent
    // callback because it navigates to All Orders and starts a global refresh.
    window.dispatchEvent(
      new CustomEvent("dn-admin-orders-updated", {
        detail: {
          mutation: "upsert",
          order,
          source: "new_order_stay_in_place",
        },
      }),
    );
  }

  return (
    <div
      data-admin-order-stay-in-place="true"
      onSubmitCapture={handleSubmitCapture}
    >
      {couponError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 rounded-2xl border border-rose-400/40 bg-rose-400/12 p-4 text-sm font-black leading-7 text-rose-100"
        >
          {couponError}
        </div>
      )}
      {checkingCoupon && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 p-3 text-xs font-black text-brand-gold"
        >
          {props.isArabic
            ? "جارٍ التحقق من عدم تكرار رقم الكوبون..."
            : "Checking that the coupon number is unique..."}
        </div>
      )}
      <AdminNewOrderComplete {...props} onSaved={handleSaved} />
    </div>
  );
}
